import fs from "node:fs/promises";
import path from "node:path";

/**
 * File system entry information
 */
export interface FsEntry {
  readonly name: string;
  readonly isDirectory: boolean;
}

/**
 * File system interface - abstraction for file system operations
 * Allows mocking for unit tests
 */
export interface FileSystem {
  /**
   * Read directory contents
   * @param dirPath - Directory path to read
   * @param options
   * @returns Array of file system entries
   * @throws Error if directory cannot be read
   */
  readDirectory(
    dirPath: string,
    options?: {
      recursive?: boolean;
    }
  ): Promise<FsEntry[]>;

  /**
   * Get file statistics
   * @param filePath - Path to file or directory
   * @returns File stats including existence, type, etc.
   */
  stat?(filePath: string): Promise<{ exists: boolean; isDirectory: boolean }>;

  /**
   * Get path separator
   */
  readonly pathSep: string;
}

export class NodeFileSystemService implements FileSystem {
  readonly pathSep: string = path.sep;

  async readDirectory(
    dirPath: string,
    options?: {
      recursive?: boolean;
    }
  ): Promise<{ name: string; isDirectory: boolean }[]> {
    const { recursive = false } = options ?? {};
    const fs = await import("node:fs/promises");
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: recursive });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  }

  async stat(filePath: string): Promise<{ exists: boolean; isDirectory: boolean }> {
    {
      return fs
        .stat(filePath)
        .then((stats) => ({
          exists: true,
          isDirectory: stats.isDirectory(),
        }))
        .catch((): { exists: false; isDirectory: false } => ({
          exists: false,
          isDirectory: false,
        }));
    }
  }
}
