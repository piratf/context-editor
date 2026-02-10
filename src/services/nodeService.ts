/**
 * NodeService - Business logic for tree node operations
 *
 * This service handles all node-related business logic without any
 * dependency on VS Code types. It operates on pure data interfaces (NodeData)
 * and can be fully unit tested without VS Code environment.
 *
 * Architecture:
 * - Service layer: Contains business logic
 * - Depends on interfaces: FileSystem, SyncFileFilter
 * - No vscode imports - completely testable
 */

import * as path from "node:path";
import type { NodeData, DirectoryData, ErrorDataNode } from "../types/nodeData.js";
import { NodeDataFactory } from "../types/nodeData.js";
import type { SyncFileFilter, FilterContext } from "../types/fileFilter.js";
import { createFilterContext } from "../types/fileFilter.js";

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
   * @returns Array of file system entries
   * @throws Error if directory cannot be read
   */
  readDirectory(dirPath: string): Promise<FsEntry[]>;

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

/**
 * Options for creating child nodes
 */
export interface ChildNodeOptions {
  /** Filter to apply for children */
  readonly filter?: SyncFileFilter;
  /** Base context value for children (menu markers will be added by caller) */
  readonly baseContextValue?: string;
  /** Filter configuration */
  readonly filterClaudeFiles?: boolean;
}

/**
 * Default file icon mapping
 */
const FILE_ICONS: Record<string, string> = {
  ".json": "settings-gear",
  ".md": "file-text",
  ".ts": "code",
  ".js": "code",
  ".tsx": "code",
  ".jsx": "code",
  ".py": "code",
  ".txt": "file-text",
};

/**
 * Get appropriate icon ID for a file
 */
function getFileIcon(filename: string): string {
  const ext = path.extname(filename);
  return FILE_ICONS[ext] ?? "file";
}

/**
 * Result of getting children
 */
export type GetChildrenResult =
  | { readonly success: true; readonly children: readonly NodeData[] }
  | { readonly success: false; readonly error: ErrorDataNode };

/**
 * Service for tree node operations
 *
 * This service handles:
 * - Reading directory contents
 * - Filtering entries based on configured filters
 * - Creating child node data objects
 * - Error handling for file system operations
 */
export class NodeService {
  private readonly filter: SyncFileFilter;
  private readonly pathSep: string;

  constructor(
    private readonly fileSystem: FileSystem,
    options: {
      filter?: SyncFileFilter;
      filterClaudeFiles?: boolean;
    } = {}
  ) {
    this.pathSep = fileSystem.pathSep;

    // Use provided filter or create default
    if (options.filter !== undefined) {
      this.filter = options.filter;
    } else if (options.filterClaudeFiles === true) {
      // Import ProjectClaudeFileFilter dynamically to avoid circular dependency
      const { ProjectClaudeFileFilter } = require("../types/fileFilter.js");
      this.filter = new ProjectClaudeFileFilter();
    } else {
      // Import ClaudeCodeFileFilter dynamically
      const { ClaudeCodeFileFilter } = require("../types/fileFilter.js");
      this.filter = new ClaudeCodeFileFilter();
    }
  }

  /**
   * Get children for a directory node
   *
   * @param node - Directory node data
   * @returns Array of child node data, or error node if failed
   */
  async getChildren(node: DirectoryData): Promise<GetChildrenResult> {
    // Validate node has path
    if (!node.path) {
      return {
        success: false,
        error: NodeDataFactory.createError("Error: No path", {
          tooltip: "Directory node has no path",
          contextValue: "error",
        }),
      };
    }

    try {
      // Read directory entries
      const entries = await this.fileSystem.readDirectory(node.path);

      // Sort: directories first, then files, both alphabetically
      const sortedEntries = this.sortEntries(entries);

      // Create child nodes
      const children: NodeData[] = [];
      for (const entry of sortedEntries) {
        if (this.shouldInclude(entry, node.path)) {
          const childNode = this.createChildNode(entry, node.path);
          children.push(childNode);
        }
      }

      // Show empty message if no children
      if (children.length === 0) {
        children.push(
          NodeDataFactory.createInfo("(empty)", {
            tooltip: "This directory is empty",
            contextValue: "empty",
            iconId: "info",
          })
        );
      }

      return { success: true, children };
    } catch (error) {
      // Return error node on failure
      const errorData = this.toErrorData(error);
      return {
        success: false,
        error: NodeDataFactory.createError("Error reading directory", {
          tooltip: errorData?.message ?? String(error),
          contextValue: "error",
          error: errorData ?? { name: "Error", message: String(error) },
        }),
      };
    }
  }

  /**
   * Check if an entry should be included based on filter
   */
  private shouldInclude(entry: FsEntry, parentPath: string): boolean {
    const fullPath = path.join(parentPath, entry.name);
    const context: FilterContext = createFilterContext(
      fullPath,
      entry.name,
      entry.isDirectory,
      parentPath,
      this.pathSep
    );

    const result = this.filter.evaluate(context);
    return result.include;
  }

  /**
   * Create a child node from a file system entry
   */
  private createChildNode(entry: FsEntry, parentPath: string): NodeData {
    const fullPath = path.join(parentPath, entry.name);

    if (entry.isDirectory) {
      return NodeDataFactory.createDirectory(entry.name, fullPath, {
        collapsibleState: 1,
        tooltip: fullPath,
      });
    } else {
      return NodeDataFactory.createFile(entry.name, fullPath, {
        iconId: getFileIcon(entry.name),
        tooltip: fullPath,
      });
    }
  }

  /**
   * Sort entries: directories first, then files, both alphabetically
   */
  private sortEntries(entries: readonly FsEntry[]): FsEntry[] {
    return [...entries].sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }

  /**
   * Convert error to ErrorData
   */
  private toErrorData(error: unknown): { name: string; message: string; stack?: string | undefined } | undefined {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack ?? undefined,
      };
    }
    if (typeof error === "string") {
      return { name: "Error", message: error };
    }
    if (typeof error === "object" && error !== null) {
      const e = error as Record<string, unknown>;
      if ("message" in e && typeof e.message === "string") {
        return {
          name: ("name" in e && typeof e.name === "string") ? e.name : "Error",
          message: e.message,
          stack: ("stack" in e && typeof e.stack === "string") ? e.stack : undefined,
        };
      }
    }
    return undefined;
  }

  /**
   * Get the filter being used
   */
  getFilter(): SyncFileFilter {
    return this.filter;
  }
}

/**
 * Factory for creating NodeService instances
 */
export const NodeServiceFactory = {
  /**
   * Create a NodeService with real file system
   */
  create(options?: {
    filter?: SyncFileFilter;
    filterClaudeFiles?: boolean;
  }): NodeService {
    const fileSystem: FileSystem = {
      pathSep: path.sep,
      readDirectory: async (dirPath: string) => {
        const fs = await import("node:fs/promises");
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
      },
    };
    return new NodeService(fileSystem, options);
  },
} as const;
