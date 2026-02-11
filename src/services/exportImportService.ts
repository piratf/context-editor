/**
 * Export/Import Service
 *
 * Handles export and import of Claude configuration files using
 * node tree traversal instead of JSON serialization.
 *
 * Export directory structure:
 * <export-dir>/
 *   global/                # Global configuration files
 *     .claude.json
 *     .claude/
 *       settings.json
 *       ...
 *   projects/              # Project files
 *     [project-name]/
 *       .claude/
 *       CLAUDE.md
 *       ...
 */

import * as path from "node:path";
import type { NodeData } from "../types/nodeData.js";
import type { Progress } from "../adapters/progress.js";
import type { FileNode } from "./nodeCollector.js";
import { NodeCollector } from "./nodeCollector.js";
import { BulkCopier } from "./bulkCopier.js";
import type { FileAccessService } from "./fileAccessService.js";
import type {
  ExportOptions,
  ImportOptions,
  ExportResult,
  ImportResult,
} from "../types/configSchema.js";

/**
 * Export/Import service using node tree traversal
 */
export class ExportImportService {
  constructor(
    private readonly fileAccessService: FileAccessService,
    private readonly nodeCollector: NodeCollector,
    private readonly bulkCopier: BulkCopier
  ) {}

  /**
   * Export configuration to target directory using node tree traversal
   *
   * @param rootNodes - Root nodes from the tree view
   * @param options - Export options
   * @param progress - Progress reporter
   * @returns Export result
   */
  async export(
    rootNodes: readonly NodeData[],
    options: ExportOptions,
    progress?: Progress
  ): Promise<ExportResult> {
    const targetDir = options.targetDirectory;

    progress?.report("准备导出配置...");

    // Collect all file nodes from the tree
    const collectionResult = await this.nodeCollector.collectFromRoots(rootNodes);

    progress?.report(
      `找到 ${String(collectionResult.files.length)} 个文件 ` +
        `(全局: ${String(collectionResult.counts.global)}, ` +
        `项目: ${String(collectionResult.counts.projects)})`
    );

    // Copy files to export directory
    const copyResult = await this.bulkCopier.copyFiles(
      collectionResult.files,
      targetDir,
      options.filter
        ? {
            overwrite: false,
            filter: (file: FileNode) => {
              // Apply the filter from config
              const filterContext = {
                path: file.path,
                name: file.label,
                parentPath: file.parentPath,
                isDirectory: false,
                pathSep: path.sep,
              };
              const filter = options.filter;
              if (!filter) {
                return true;
              }
              const result = filter.evaluate(filterContext);
              // Handle both sync and async filters
              return result instanceof Promise ? false : result.include;
            },
          }
        : {
            overwrite: false,
          },
      progress
    );

    // Create .gitignore if requested
    if (options.createGitignore) {
      await this.bulkCopier.createGitignore(targetDir);
    }

    progress?.report(
      `导出完成！成功 ${String(copyResult.successCount)} 个` +
        (copyResult.failCount > 0 ? `，失败 ${String(copyResult.failCount)} 个` : "")
    );

    return {
      fileCount: copyResult.successCount,
      exportPath: targetDir,
      exportedFiles: copyResult.copied,
    };
  }

  /**
   * Import configuration from source directory
   *
   * Reads exported files and copies them back to their original locations.
   *
   * @param rootNodes - Root nodes from the tree view (for context)
   * @param options - Import options
   * @param progress - Progress reporter
   * @returns Import result
   */
  async import(
    rootNodes: readonly NodeData[],
    options: ImportOptions,
    progress?: Progress
  ): Promise<ImportResult> {
    const sourceDir = options.sourceDirectory;

    progress?.report("准备导入配置...");

    // Collect file nodes to understand what should be imported
    const collectionResult = await this.nodeCollector.collectFromRoots(rootNodes);

    progress?.report(`检测到 ${String(collectionResult.files.length)} 个配置文件`);

    // Map exported files back to their original locations
    const importFiles = await this.mapImportFiles(collectionResult.files, sourceDir);

    // Filter out files that don't exist in export
    const filesToImport = importFiles.filter((f) => f.exportExists);

    progress?.report(`找到 ${String(filesToImport.length)} 个文件待导入`);

    let importCount = 0;
    let skipCount = 0;
    const importedFiles: string[] = [];
    const skippedFiles: string[] = [];

    // Import files
    for (const importFile of filesToImport) {
      // Check if target exists
      const targetExists = await this.fileAccessService.fileExists(importFile.targetPath);

      if (targetExists && options.overwrite !== true) {
        skippedFiles.push(importFile.targetPath);
        skipCount++;
        continue;
      }

      // Perform copy
      const success = await this.copyFile(importFile.exportPath, importFile.targetPath);

      if (success) {
        importedFiles.push(importFile.targetPath);
        importCount++;
      }

      progress?.report(`已导入 ${String(importCount)}/${String(filesToImport.length)} 个文件...`);
    }

    progress?.report(
      `导入完成！成功 ${String(importCount)} 个` +
        (skipCount > 0 ? `，跳过 ${String(skipCount)} 个` : "")
    );

    return {
      fileCount: importCount,
      skippedCount: skipCount,
      importedFiles,
      skippedFiles,
    };
  }

  /**
   * Map exported files back to their original locations
   */
  private async mapImportFiles(
    files: readonly FileNode[],
    exportDir: string
  ): Promise<
    readonly {
      readonly file: FileNode;
      readonly exportPath: string;
      readonly targetPath: string;
      readonly exportExists: boolean;
    }[]
  > {
    const bulkCopier = new BulkCopier(this.fileAccessService);

    const results = await Promise.all(
      files.map(async (file) => {
        const pathMapping = bulkCopier.calculatePathMapping(file, exportDir);
        const exportPath = pathMapping.destPath;
        const exportExists = await this.fileAccessService.fileExists(exportPath);

        return {
          file,
          exportPath,
          targetPath: file.path,
          exportExists,
        };
      })
    );

    return results;
  }

  /**
   * Copy a single file from source to destination
   */
  private async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await this.ensureDirectoryExists(targetDir);

      // Read and write file
      const content = await this.fileAccessService.readFile(sourcePath, "utf-8");
      await this.writeFile(targetPath, content);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists, create if not
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const exists = await this.fileAccessService.directoryExists(dirPath);
    if (!exists) {
      await this.createDirectoryRecursive(dirPath);
    }
  }

  /**
   * Create directory recursively
   */
  private async createDirectoryRecursive(dirPath: string): Promise<void> {
    const parts = dirPath.split(/[/\\]/);
    let currentPath = "";

    for (const part of parts) {
      if (part === "") continue;

      currentPath = currentPath === "" ? part : path.join(currentPath, part);

      const exists = await this.fileAccessService.directoryExists(currentPath);
      if (!exists) {
        await this.makeDirectory(currentPath);
      }
    }
  }

  /**
   * Create a single directory
   */
  private async makeDirectory(dirPath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Write file content
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.writeFile(filePath, content, "utf-8");
  }
}

/**
 * Factory for creating export/import service instances
 */
export const ExportImportServiceFactory = {
  create(fileAccessService: FileAccessService, nodeCollector: NodeCollector): ExportImportService {
    const bulkCopier = new BulkCopier(fileAccessService);
    return new ExportImportService(fileAccessService, nodeCollector, bulkCopier);
  },
} as const;
