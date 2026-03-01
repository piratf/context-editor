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
import type { NodeData, DirectoryData, ProjectData, ErrorDataNode } from "../types/nodeData.js";
import { NodeDataFactory, NodeTypeGuard } from "../types/nodeData.js";
import type { SyncFileFilter, FilterContext } from "../types/fileFilter.js";
import { AllowAllFilter } from "../types/fileFilter.js";
import { RootNodeService } from "./rootNodeService";

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
 * Constant representing an empty successful result
 */
export const EMPTY_CHILDREN_RESULT: GetChildrenResult = { success: true, children: [] } as const;

/**
 * Service for tree node operations
 *
 * This service handles:
 * - Reading directory contents
 * - Filtering entries based on configured filters
 * - Creating child node data objects
 * - Error handling for file system operations
 *
 * Filtering behavior:
 * - Inside .claude directory: Allow all (Claude-specific files)
 * - Inside other AI tool directories (.gemini, .cursor, etc.): Allow all
 * - In project root: Use configured filter (ProjectClaudeFileFilter by default)
 */
export class NodeService {
  private readonly rootNodeService: RootNodeService;
  private readonly allowAllFilter: AllowAllFilter;

  constructor(
    private readonly fileSystem: FileSystem,
    nodeService: RootNodeService
  ) {
    this.rootNodeService = nodeService;
    this.allowAllFilter = new AllowAllFilter();
  }

  /**
   * Determine the appropriate filter for a given directory path
   * @param dirPath - Directory path to get filter for
   * @returns Appropriate filter for the directory context
   */
  private getFilterForDirectory(_dirPath: string): SyncFileFilter {
    // All directories use allowAllFilter since this service is only used
    // for AI tool directories (.claude, .gemini, etc.)
    return this.allowAllFilter;
  }

  /**
   * Get children for a directory node
   *
   * @param node - Directory node data
   * @returns Array of child node data, or error node if failed
   */
  async getChildrenForDirectoryNode(node: DirectoryData): Promise<GetChildrenResult> {
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
      // Get the appropriate filter for this directory
      const filter = this.getFilterForDirectory(node.path);

      // Read directory entries
      const entries = await this.fileSystem.readDirectory(node.path);

      // Sort: directories first, then files, both alphabetically
      const sortedEntries = this.sortEntries(entries);

      // Create child nodes with filtering
      const children: NodeData[] = [];
      for (const entry of sortedEntries) {
        // Create filter context and evaluate
        const fullPath = path.join(node.path, entry.name);
        const filterContext: FilterContext = {
          path: fullPath,
          parentPath: node.path,
          name: entry.name,
          isDirectory: entry.isDirectory,
          pathSep: this.fileSystem.pathSep,
        };

        const result = filter.evaluate(filterContext);

        // Only include entries that pass the filter
        if (result.include) {
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
   * Get children for a project node
   *
   * @param node - Project node data
   * @returns Array of child node data, or error node if failed
   */
  async getChildrenForProjectNode(node: ProjectData): Promise<GetChildrenResult> {
    // Validate node has path
    if (!node.path) {
      return {
        success: false,
        error: NodeDataFactory.createError("Error: No path", {
          tooltip: "Project node has no path",
          contextValue: "error",
        }),
      };
    }

    // Delegate to rootNodeService for project children
    return await this.rootNodeService.getProjectChildren(node.path);
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
  private toErrorData(
    error: unknown
  ): { name: string; message: string; stack?: string | undefined } | undefined {
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
          name: "name" in e && typeof e.name === "string" ? e.name : "Error",
          message: e.message,
          stack: "stack" in e && typeof e.stack === "string" ? e.stack : undefined,
        };
      }
    }
    return undefined;
  }

  /**
   * Get children by node type (unified entry point)
   *
   * Uses type guard functions to dispatch to appropriate handler based on node type.
   * This provides a single entry point for all child node retrieval.
   *
   * @param node - Parent node data
   * @returns Array of child node data, or error node if failed
   */
  async getChildrenByNodeType(node: NodeData): Promise<GetChildrenResult> {
    // PROJECT - has children (must check before DIRECTORY since isDirectoryData returns true for PROJECT)
    if (NodeTypeGuard.isProject(node)) {
      return await this.getChildrenForProjectNode(node);
    }

    // DIRECTORY - has children
    if (NodeTypeGuard.isDirectoryData(node)) {
      return await this.getChildrenForDirectoryNode(node);
    }

    // USER_ROOT and PROJECTS_ROOT - have children
    if (NodeTypeGuard.isUserRoot(node.type) || NodeTypeGuard.isProjectsRoot(node.type)) {
      return await this.rootNodeService.getRootNodeChildren(node);
    }

    // All other types (FILE, ERROR, ROOT, CLAUDE_JSON) - no children
    return EMPTY_CHILDREN_RESULT;
  }
}
