/**
 * File System Operations Adapter
 *
 * Provides interface-based access to file system operations.
 * Abstracts VS Code workspace.fs API for better testability.
 */

import type { SimpleUri } from "./vscode.js";

/**
 * File copy options
 */
export interface FileCopyOptions {
  /** Overwrite existing file */
  overwrite?: boolean;
}

/**
 * Directory entry for reading directory contents
 */
export interface DirectoryEntry {
  /** Entry name */
  name: string;
  /** Whether entry is a directory */
  isDirectory: boolean;
}

/**
 * File system operations interface
 */
export interface FileSystemOperations {
  /**
   * Check if a file or directory exists
   *
   * @param uri - URI to check
   * @returns True if exists
   */
  exists(uri: SimpleUri): Promise<boolean>;

  /**
   * Read directory contents
   *
   * @param uri - Directory URI
   * @returns Array of directory entries
   */
  readDirectory(uri: SimpleUri): Promise<readonly DirectoryEntry[]>;

  /**
   * Create a directory
   *
   * @param uri - Directory URI to create
   */
  createDirectory(uri: SimpleUri): Promise<void>;

  /**
   * Copy a file
   *
   * @param source - Source URI
   * @param destination - Destination URI
   * @param options - Copy options
   */
  copyFile(source: SimpleUri, destination: SimpleUri, options?: FileCopyOptions): Promise<void>;

  /**
   * Write file content
   *
   * @param uri - File URI
   * @param content - File content
   */
  writeFile(uri: SimpleUri, content: Uint8Array): Promise<void>;

  /**
   * Read file content
   *
   * @param uri - File URI
   * @returns File content
   */
  readFile(uri: SimpleUri): Promise<Uint8Array>;

  /**
   * Delete a file or directory
   *
   * @param uri - URI to delete
   * @param options - Delete options
   */
  delete(uri: SimpleUri, options: { recursive: boolean }): Promise<void>;
}

/**
 * VS Code file system operations implementation
 */
export class VsCodeFileSystemOperations implements FileSystemOperations {
  async exists(uri: SimpleUri): Promise<boolean> {
    const vscode = await import("vscode");
    try {
      const vscodeUri = vscode.Uri.file(uri.path);
      await vscode.workspace.fs.stat(vscodeUri);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectory(uri: SimpleUri): Promise<readonly DirectoryEntry[]> {
    const vscode = await import("vscode");
    const vscodeUri = vscode.Uri.file(uri.path);
    const entries = await vscode.workspace.fs.readDirectory(vscodeUri);
    return entries.map(([name, type]) => ({
      name,
      isDirectory: type === vscode.FileType.Directory,
    }));
  }

  async createDirectory(uri: SimpleUri): Promise<void> {
    const vscode = await import("vscode");
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.createDirectory(vscodeUri);
  }

  async copyFile(
    source: SimpleUri,
    destination: SimpleUri,

    _options?: FileCopyOptions
  ): Promise<void> {
    const vscode = await import("vscode");
    const sourceUri = vscode.Uri.file(source.path);
    const destUri = vscode.Uri.file(destination.path);

    // VS Code doesn't have a direct copy, so we read and write
    const content = await vscode.workspace.fs.readFile(sourceUri);
    await vscode.workspace.fs.writeFile(destUri, content);
  }

  async writeFile(uri: SimpleUri, content: Uint8Array): Promise<void> {
    const vscode = await import("vscode");
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.writeFile(vscodeUri, content);
  }

  async readFile(uri: SimpleUri): Promise<Uint8Array> {
    const vscode = await import("vscode");
    const vscodeUri = vscode.Uri.file(uri.path);
    return vscode.workspace.fs.readFile(vscodeUri);
  }

  async delete(uri: SimpleUri, options: { recursive: boolean }): Promise<void> {
    const vscode = await import("vscode");
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.delete(vscodeUri, options);
  }
}

/**
 * Mock file system operations for testing
 */
export class MockFileSystemOperations implements FileSystemOperations {
  private readonly files = new Map<string, Uint8Array>();
  private readonly directories = new Set<string>();

  constructor(initialState?: { files?: Record<string, string>; directories?: string[] }) {
    if (initialState) {
      if (initialState.files) {
        for (const [path, content] of Object.entries(initialState.files)) {
          this.files.set(path, new TextEncoder().encode(content));
        }
      }
      if (initialState.directories) {
        for (const dir of initialState.directories) {
          this.directories.add(dir);
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async exists(uri: SimpleUri): Promise<boolean> {
    return this.files.has(uri.path) || this.directories.has(uri.path);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async readDirectory(uri: SimpleUri): Promise<readonly DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];
    const prefix = uri.path.endsWith("/") ? uri.path : `${uri.path}/`;

    for (const path of this.files.keys()) {
      if (path.startsWith(prefix)) {
        const relativePath = path.slice(prefix.length);
        const parts = relativePath.split("/");
        if (parts.length === 1) {
          entries.push({ name: parts[0], isDirectory: false });
        }
      }
    }

    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        const relativePath = dir.slice(prefix.length);
        const parts = relativePath.split("/");
        if (parts.length === 1) {
          entries.push({ name: parts[0], isDirectory: true });
        }
      }
    }

    return entries;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createDirectory(uri: SimpleUri): Promise<void> {
    this.directories.add(uri.path);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async copyFile(source: SimpleUri, destination: SimpleUri): Promise<void> {
    const content = this.files.get(source.path);
    if (content === undefined) {
      throw new Error(`Source file not found: ${source.path}`);
    }
    this.files.set(destination.path, content);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async writeFile(uri: SimpleUri, content: Uint8Array): Promise<void> {
    this.files.set(uri.path, content);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async readFile(uri: SimpleUri): Promise<Uint8Array> {
    const content = this.files.get(uri.path);
    if (content === undefined) {
      throw new Error(`File not found: ${uri.path}`);
    }
    return content;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async delete(uri: SimpleUri): Promise<void> {
    this.files.delete(uri.path);
    this.directories.delete(uri.path);
  }

  // Helper methods for testing
  getFileContent(path: string): string | undefined {
    const content = this.files.get(path);
    return content ? new TextDecoder().decode(content) : undefined;
  }

  hasDirectory(path: string): boolean {
    return this.directories.has(path);
  }
}
