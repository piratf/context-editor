/**
 * BulkCopier - Batch file copying with concurrency control
 *
 * This service handles copying multiple files with controlled concurrency,
 * progress reporting, and proper directory structure preservation.
 *
 * Architecture:
 * - Service layer: Contains business logic for batch copying
 * - Depends on FileAccessService for cross-platform file operations
 * - No VS Code imports - completely testable
 */

import * as path from "node:path";
import type { FileNode } from "./nodeCollector.js";
import type { FileAccessService } from "./fileAccessService.js";
import type { Progress } from "../adapters/progress.js";

/**
 * Options for copy operation
 */
export interface CopyOptions {
  /** Whether to overwrite existing files */
  readonly overwrite?: boolean;
  /** Filter function to exclude files */
  readonly filter?: (file: FileNode) => boolean;
}

/**
 * Result of a single file copy
 */
export interface CopyFileResult {
  /** Whether the copy succeeded */
  readonly success: boolean;
  /** Source file path */
  readonly sourcePath: string;
  /** Destination file path */
  readonly destPath: string;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Result of batch copy operation
 */
export interface CopyResult {
  /** Number of successfully copied files */
  readonly successCount: number;
  /** Number of failed files */
  readonly failCount: number;
  /** List of copied file paths (destination) */
  readonly copied: readonly string[];
  /** List of failed files with errors */
  readonly failed: readonly CopyFileResult[];
}

/**
 * Path mapping for export structure
 */
export interface PathMapping {
  /** Source file path */
  readonly sourcePath: string;
  /** Destination path in export directory */
  readonly destPath: string;
  /** Relative path from export root */
  readonly relativePath: string;
}

/**
 * BulkCopier - batch file copying with concurrency control
 */
export class BulkCopier {
  /** Maximum concurrent copy operations */
  private readonly CONCURRENCY = 10;

  constructor(private readonly fileAccessService: FileAccessService) {}

  /**
   * Copy files to export directory, preserving directory structure
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
   *
   * @param files - Files to copy
   * @param targetDirectory - Root export directory
   * @param options - Copy options
   * @param progress - Progress reporter
   * @returns Copy result
   */
  async copyFiles(
    files: readonly FileNode[],
    targetDirectory: string,
    options: CopyOptions = {},
    progress?: Progress
  ): Promise<CopyResult> {
    let successCount = 0;
    let failCount = 0;
    const copied: string[] = [];
    const failed: CopyFileResult[] = [];

    // Apply filter if provided
    const filesToCopy = options.filter ? files.filter(options.filter) : files;

    const totalFiles = filesToCopy.length;

    // Process in batches with controlled concurrency
    for (let i = 0; i < totalFiles; i += this.CONCURRENCY) {
      const batch = filesToCopy.slice(i, i + this.CONCURRENCY);

      const results = await Promise.all(
        batch.map((file) => this.copyFile(file, targetDirectory, options))
      );

      for (const result of results) {
        if (result.success) {
          successCount++;
          copied.push(result.destPath);
        } else {
          failCount++;
          failed.push(result);
        }
      }

      // Report progress
      const completed = successCount + failCount;
      progress?.report(`已复制 ${String(completed)}/${String(totalFiles)} 个文件`, completed);
    }

    return { successCount, failCount, copied, failed };
  }

  /**
   * Copy a single file to export directory
   */
  private async copyFile(
    file: FileNode,
    targetDirectory: string,
    options: CopyOptions
  ): Promise<CopyFileResult> {
    try {
      const pathMapping = this.calculatePathMapping(file, targetDirectory);

      // Ensure target directory exists
      await this.ensureDirectoryExists(path.dirname(pathMapping.destPath));

      // Check if file exists and overwrite option
      if (options.overwrite === false) {
        const exists = await this.fileAccessService.fileExists(pathMapping.destPath);
        if (exists) {
          return {
            success: false,
            sourcePath: file.path,
            destPath: pathMapping.destPath,
            error: "File already exists",
          };
        }
      }

      // Perform copy using FileAccessService
      const sourceInfo = await this.fileAccessService.statFile(file.path);
      if (!sourceInfo.exists) {
        return {
          success: false,
          sourcePath: file.path,
          destPath: pathMapping.destPath,
          error: "Source file not found",
        };
      }

      // Read and write file
      const content = await this.fileAccessService.readFile(file.path, "utf-8");
      await this.writeFile(pathMapping.destPath, content);

      return {
        success: true,
        sourcePath: file.path,
        destPath: pathMapping.destPath,
      };
    } catch (error) {
      return {
        success: false,
        sourcePath: file.path,
        destPath: this.calculatePathMapping(file, targetDirectory).destPath,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Calculate destination path for a file in export directory
   */
  calculatePathMapping(file: FileNode, targetDirectory: string): PathMapping {
    let relativePath: string;

    if (file.category === "global") {
      // Global files go into global/ directory
      relativePath = this.getGlobalRelativePath(file);
    } else {
      // Project files go into projects/[project-name]/ directory
      relativePath = this.getProjectRelativePath(file);
    }

    const destPath = path.join(targetDirectory, relativePath);

    return {
      sourcePath: file.path,
      destPath,
      relativePath,
    };
  }

  /**
   * Get relative path for global configuration files
   *
   * Global files are stored under: global/...
   * - ~/.claude.json -> global/.claude.json
   * - ~/.claude/settings.json -> global/.claude/settings.json
   */
  private getGlobalRelativePath(file: FileNode): string {
    // Get the home directory root
    const parts = file.path.split(/[/\\]/);

    // Find .claude.json or .claude directory
    const claudeIndex = parts.findIndex((p) => p === ".claude.json" || p === ".claude");

    if (claudeIndex >= 0) {
      // Everything from .claude.json or .claude onwards
      const rest = parts.slice(claudeIndex);
      return path.join("global", ...rest);
    }

    // Fallback: use filename only
    return path.join("global", file.label);
  }

  /**
   * Get relative path for project files
   *
   * Project files are stored under: projects/[project-name]/...
   * - /path/to/project/.claude/settings.json -> projects/myproject/.claude/settings.json
   * - /path/to/project/CLAUDE.md -> projects/myproject/CLAUDE.md
   */
  private getProjectRelativePath(file: FileNode): string {
    const projectName = file.projectName || "unknown-project";

    // Find a project root marker (directory containing .claude or CLAUDE.md)
    const parts = file.path.split(/[/\\]/);

    // Look for .claude directory or CLAUDE.md
    const claudeIndex = parts.findIndex((p) => p === ".claude");
    const claudeMdIndex = parts.findIndex((p) => p === "CLAUDE.md");

    let startIndex = Math.max(claudeIndex, claudeMdIndex);

    if (startIndex < 0) {
      // No project marker found, use parent directory
      startIndex = parts.length - 1;
    }

    // Everything from the found marker onwards
    const rest = parts.slice(startIndex);

    return path.join("projects", projectName, ...rest);
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
    // Use Node.js fs directly since FileAccessService doesn't have mkdir
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

  /**
   * Create .gitignore file in export directory
   */
  async createGitignore(exportDirectory: string): Promise<void> {
    const gitignorePath = path.join(exportDirectory, ".gitignore");

    const exists = await this.fileAccessService.fileExists(gitignorePath);
    if (exists) {
      return; // Don't overwrite existing .gitignore
    }

    const content = "# Ignore Claude local settings\n.settings.local.yaml\n";
    await this.writeFile(gitignorePath, content);
  }
}
