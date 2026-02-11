/**
 * Export/Import Service
 *
 * Handles export and import of Claude configuration files.
 * Organizes exported files by environment type (windows, wsl, macos, linux).
 */

import * as path from "node:path";
import type { ClaudeDataFacade } from "./dataFacade.js";
import type { FileSystemOperations } from "../adapters/fileSystem.js";
import type { Progress } from "../adapters/progress.js";
import type { SimpleUri } from "../adapters/vscode.js";
import type {
  ExportOptions,
  ImportOptions,
  ExportResult,
  ImportResult,
} from "../types/configSchema.js";
import {
  getEnvironmentDirectoryName,
  joinPathParts,
  detectPathFormat,
  normalizePathSeparators,
  PathFormat,
} from "../types/configSchema.js";

/**
 * Export/Import service
 */
export class ExportImportService {
  constructor(private readonly fileSystem: FileSystemOperations) {}

  /**
   * Get environment display name
   */
  private getEnvironmentDisplayName(envInfo: { type: string }): string {
    const type = envInfo.type.toLowerCase();
    const typeNames: Record<string, string> = {
      windows: "Windows",
      wsl: "WSL",
      macos: "macOS",
      darwin: "macOS",
      linux: "Linux",
    };
    return typeNames[type] ?? type;
  }

  /**
   * Export configuration to target directory
   *
   * @param facade - Data facade for current environment
   * @param options - Export options
   * @param progress - Progress reporter
   * @returns Export result
   */
  async export(
    facade: ClaudeDataFacade,
    options: ExportOptions,
    progress?: Progress
  ): Promise<ExportResult> {
    const exportedFiles: string[] = [];
    const targetDir = options.targetDirectory;

    // Get environment info
    const envInfo = facade.getEnvironmentInfo();
    const envDirName = getEnvironmentDirectoryName(envInfo.type);
    const envDisplayName = this.getEnvironmentDisplayName(envInfo);

    progress?.report(`准备导出 ${envDisplayName} 配置...`);

    // Create environment-specific directory
    const envDir = joinPathParts([targetDir, envDirName], this.useWindowsSeparators(targetDir));
    await this.ensureDirectoryExists(envDir);

    progress?.report(`正在导出配置文件...`);

    // Get all file paths from the facade
    const filePaths = await this.collectAllFilePaths(facade);

    // Copy files to export directory
    let fileCount = 0;
    for (const filePath of filePaths) {
      // Apply filter if provided
      if (options.filter) {
        const filterContext = {
          path: filePath,
          name: path.basename(filePath),
          parentPath: path.dirname(filePath),
          isDirectory: false,
          pathSep: path.sep,
        };
        const result = await options.filter.evaluate(filterContext);
        if (!result.include) {
          continue; // Skip filtered files
        }
      }

      // Calculate relative path from config root
      const configPath = envInfo.configPath;
      const relativePath = this.getRelativePath(filePath, configPath);

      // Create target path
      const targetFilePath = joinPathParts(
        [envDir, relativePath],
        this.useWindowsSeparators(targetDir)
      );

      // Copy file
      const success = await this.copyFile(filePath, targetFilePath);
      if (success) {
        exportedFiles.push(targetFilePath);
        fileCount++;
      }

      progress?.report(`已导出 ${String(fileCount)} 个文件...`, fileCount);
    }

    // Create .gitignore if requested
    if (options.createGitignore) {
      await this.createGitignore(envDir);
    }

    progress?.report(`导出完成！共 ${String(fileCount)} 个文件。`);

    return {
      fileCount,
      exportPath: targetDir,
      exportedFiles,
    };
  }

  /**
   * Import configuration from source directory
   *
   * @param facade - Data facade for current environment
   * @param options - Import options
   * @param progress - Progress reporter
   * @returns Import result
   */
  async import(
    facade: ClaudeDataFacade,
    options: ImportOptions,
    progress?: Progress
  ): Promise<ImportResult> {
    const importedFiles: string[] = [];
    const skippedFiles: string[] = [];

    // Get environment info
    const envInfo = facade.getEnvironmentInfo();
    const envDirName = getEnvironmentDirectoryName(envInfo.type);
    const envDisplayName = this.getEnvironmentDisplayName(envInfo);

    progress?.report(`准备从 ${options.sourceDirectory} 导入 ${envDisplayName} 配置...`);

    // Get environment-specific source directory
    const sourceEnvDir = joinPathParts(
      [options.sourceDirectory, envDirName],
      this.useWindowsSeparators(options.sourceDirectory)
    );

    // Check if source directory exists
    const sourceUri = { path: sourceEnvDir };
    const sourceExists = await this.fileSystem.exists(sourceUri);

    if (!sourceExists) {
      throw new Error(`源目录不存在: ${sourceEnvDir}`);
    }

    // Collect all files from source directory
    const sourceFiles = await this.collectSourceFiles(sourceEnvDir);

    progress?.report(`找到 ${String(sourceFiles.length)} 个文件待导入...`);

    let importCount = 0;
    let skipCount = 0;

    for (const sourceFile of sourceFiles) {
      // Calculate target path (relative to config root)
      const relativePath = this.getRelativePath(sourceFile, sourceEnvDir);
      const targetPath = path.join(envInfo.configPath, relativePath);

      // Check if target exists
      const targetUri = { path: targetPath };
      const targetExists = await this.fileSystem.exists(targetUri);

      if (targetExists && options.overwrite !== true) {
        skippedFiles.push(sourceFile);
        skipCount++;
        continue;
      }

      // Copy file
      const success = await this.copyFile(sourceFile, targetPath);
      if (success) {
        importedFiles.push(targetPath);
        importCount++;
      }

      progress?.report(`已导入 ${String(importCount)} 个文件...`, importCount);
    }

    progress?.report(`导入完成！成功 ${String(importCount)} 个，跳过 ${String(skipCount)} 个。`);

    return {
      fileCount: importCount,
      skippedCount: skipCount,
      importedFiles,
      skippedFiles,
    };
  }

  /**
   * Determine if target directory uses Windows path separators
   */
  private useWindowsSeparators(targetPath: string): boolean {
    const format = detectPathFormat(targetPath);
    return format === PathFormat.Windows || format === PathFormat.Unc;
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const uri = { path: dirPath };
    const exists = await this.fileSystem.exists(uri);

    if (!exists) {
      await this.fileSystem.createDirectory(uri);
    }
  }

  /**
   * Collect all file paths from the facade
   */
  private async collectAllFilePaths(facade: ClaudeDataFacade): Promise<string[]> {
    const filePaths: string[] = [];

    // Get config file path
    const envInfo = facade.getEnvironmentInfo();
    filePaths.push(envInfo.configPath);

    // Get projects from facade
    const projects = await facade.getProjects();
    for (const project of projects) {
      // Add project path itself
      filePaths.push(project.path);
    }

    return filePaths;
  }

  /**
   * Collect all files from source directory recursively
   */
  private async collectSourceFiles(sourceDir: string): Promise<string[]> {
    const files: string[] = [];
    const sourceUri = { path: sourceDir };

    const entries = await this.fileSystem.readDirectory(sourceUri);

    for (const entry of entries) {
      const entryPath = path.join(sourceDir, entry.name);

      if (entry.isDirectory) {
        const subFiles = await this.collectSourceFiles(entryPath);
        files.push(...subFiles);
      } else {
        files.push(entryPath);
      }
    }

    return files;
  }

  /**
   * Copy a file from source to destination
   */
  private async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await this.ensureDirectoryExists(targetDir);

      // Copy file
      const sourceUri: SimpleUri = { path: sourcePath };
      const targetUri: SimpleUri = { path: targetPath };

      await this.fileSystem.copyFile(sourceUri, targetUri);
      return true;
    } catch {
      // Log error but continue
      return false;
    }
  }

  /**
   * Get relative path from base
   */
  private getRelativePath(filePath: string, basePath: string): string {
    // Normalize paths
    const normalizedBase = normalizePathSeparators(basePath, false);
    const normalizedFile = normalizePathSeparators(filePath, false);

    if (normalizedFile.startsWith(normalizedBase)) {
      let relativePath = normalizedFile.slice(normalizedBase.length);
      // Remove leading separator
      if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
        relativePath = relativePath.slice(1);
      }
      return relativePath;
    }

    // Fallback: return filename only
    return path.basename(filePath);
  }

  /**
   * Create .gitignore file in export directory
   */
  private async createGitignore(dirPath: string): Promise<void> {
    const gitignorePath = path.join(dirPath, ".gitignore");
    const gitignoreUri: SimpleUri = { path: gitignorePath };

    // Check if .gitignore already exists
    const exists = await this.fileSystem.exists(gitignoreUri);
    if (exists) {
      return; // Don't overwrite existing .gitignore
    }

    const content = new TextEncoder().encode(
      "# Ignore Claude local settings\n.settings.local.yaml\n"
    );

    await this.fileSystem.writeFile(gitignoreUri, content);
  }
}

/**
 * Factory for creating export/import service instances
 */
export const ExportImportServiceFactory = {
  create(fileSystem: FileSystemOperations): ExportImportService {
    return new ExportImportService(fileSystem);
  },
} as const;
