/**
 * Pure data interfaces for tree nodes - NO vscode dependency
 *
 * This module defines read-only data interfaces for tree nodes that are
 * completely independent of VS Code types. These interfaces represent
 * the domain model and can be used in unit tests without VS Code environment.
 *
 * Architecture:
 * - NodeData: Pure data interface, no vscode dependency
 * - Used by Service layer for business logic
 * - Converted to vscode.TreeItem by TreeItemFactory (adapter layer)
 *
 * Type Safety:
 * - Uses Symbol as runtime type marker for efficient type checking
 * - All NodeData instances created by NodeDataFactory include the marker
 * - isNodeData() provides a fast, single-check type guard
 */

/**
 * Symbol used as runtime type marker for NodeData instances
 *
 * This symbol is attached to all NodeData objects created by NodeDataFactory,
 * providing a fast and reliable way to identify NodeData instances at runtime.
 * Unlike property-based checking, symbols cannot be forged or accidentally collide.
 */
export const NodeDataMarker = Symbol("NodeData");

/**
 * Tree node types - unified across all providers
 */
export enum NodeType {
  DIRECTORY = "directory",
  FILE = "file",
  CLAUDE_JSON = "claudeJson",
  ERROR = "error",
  USER_ROOT = "userRoot",
  PROJECTS_ROOT = "projectsRoot",
}

/**
 * Collapsible state enum (0=none, 1=collapsed, 2=expanded)
 */
export type CollapsibleState = 0 | 1 | 2;

/**
 * Icon identifier for VS Code ThemeIcons
 * String identifier like "file", "folder", "settings-gear", etc.
 */
export type IconId = string;

/**
 * Base interface for all tree node data
 * Pure data interface - NO vscode dependency
 *
 * The NodeDataMarker symbol provides runtime type identification.
 * All NodeData instances created by NodeDataFactory include this marker.
 */
export interface NodeData {
  /** Runtime type marker - ensures only factory-created objects pass type checks */
  readonly [NodeDataMarker]: true;
  /** Unique identifier for this node */
  readonly id: string;
  /** Type of the node */
  readonly type: NodeType;
  /** Display label */
  readonly label: string;
  /** File system path (if applicable) */
  readonly path?: string;
  /** Collapsible state */
  readonly collapsibleState: CollapsibleState;
  /** Icon identifier (for VS Code ThemeIcon) */
  readonly iconId?: IconId;
  /** Tooltip text */
  readonly tooltip?: string;
  /** Context value for menu contributions */
  readonly contextValue?: string;
  /** Error object (for ERROR type nodes) */
  readonly error?: Readonly<ErrorData>;
}

/**
 * Error data - serializable error information
 */
export interface ErrorData {
  readonly name: string;
  readonly message: string;
  readonly stack?: string | undefined;
}

/**
 * Convert Error to ErrorData
 */
export function toErrorData(error: Error | string | object): ErrorData | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? undefined,
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }
  // Handle plain objects (not null, not string, not Error)
  const errorObj = error as Record<string, unknown> | null;
  if (errorObj !== null && "message" in errorObj && typeof errorObj.message === "string") {
    return {
      name: "name" in errorObj && typeof errorObj.name === "string" ? errorObj.name : "Error",
      message: errorObj.message,
      stack: "stack" in errorObj && typeof errorObj.stack === "string" ? errorObj.stack : undefined,
    };
  }
  return undefined;
}

export function toErrorDataSafe(error: Error | string | object | undefined): ErrorData | undefined {
  if (error === undefined) {
    return undefined;
  }
  return toErrorData(error);
}

/**
 * Directory node data
 */
export interface DirectoryData extends NodeData {
  readonly type: NodeType.DIRECTORY;
  readonly path: string;
}

/**
 * File node data
 */
export interface FileData extends NodeData {
  readonly type: NodeType.FILE;
  readonly path: string;
}

/**
 * Claude JSON config file node data
 */
export interface ClaudeJsonData extends NodeData {
  readonly type: NodeType.CLAUDE_JSON;
  readonly path: string;
}

/**
 * Error node data
 */
export interface ErrorDataNode extends NodeData {
  readonly type: NodeType.ERROR;
  readonly error?: ErrorData;
}

/**
 * Type guard for NodeData using Symbol marker
 *
 * This is the preferred method for runtime type checking of NodeData instances.
 * It performs a single property check using the Symbol marker, which is:
 * - Fast: O(1) lookup
 * - Safe: Symbols are unique and cannot be forged
 * - Reliable: Only factory-created objects have the marker
 *
 * @param node - Unknown value to check
 * @returns True if the value is a NodeData instance
 *
 * @example
 * ```ts
 * if (isNodeData(unknownValue)) {
 *   // TypeScript knows unknownValue is NodeData here
 *   console.log(unknownValue.label);
 * }
 * ```
 */
export function isNodeData(node: unknown): node is NodeData {
  return typeof node === "object" && node !== null && NodeDataMarker in node;
}

/**
 * NodeTypeGuard - Collection of type guard functions
 */
export const NodeTypeGuard = {
  isDirectoryData: (data: NodeData): data is DirectoryData =>
    data.type === NodeType.DIRECTORY && data.path !== undefined,

  isUserRoot: (type: NodeType): boolean => type === NodeType.USER_ROOT,

  isProjectsRoot: (type: NodeType): boolean => type === NodeType.PROJECTS_ROOT,
} as const;

/**
 * Factory for creating node data objects
 */
export const NodeDataFactory = {
  /**
   * Generate unique ID for a node
   */
  generateId(type: NodeType, path?: string): string {
    if (path !== undefined && path !== "") {
      return `${type}:${path}`;
    }
    return `${type}:${String(Date.now())}:${Math.random().toString(36).slice(2)}`;
  },

  /**
   * Create directory data
   */
  createDirectory(
    label: string,
    dirPath: string,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): DirectoryData {
    const { collapsibleState = 1, tooltip, contextValue } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.DIRECTORY, dirPath),
      type: NodeType.DIRECTORY,
      label,
      path: dirPath,
      collapsibleState,
      tooltip: tooltip ?? dirPath,
      contextValue: contextValue ?? "",
    };
  },

  /**
   * Create file data
   */
  createFile(
    label: string,
    filePath: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      iconId?: IconId;
    } = {}
  ): FileData {
    const { tooltip, contextValue, iconId = "file" } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.FILE, filePath),
      type: NodeType.FILE,
      label,
      path: filePath,
      collapsibleState: 0,
      iconId,
      tooltip: tooltip ?? filePath,
      contextValue: contextValue ?? "",
    };
  },

  /**
   * Create Claude JSON data
   */
  createClaudeJson(
    label: string,
    filePath: string,
    options: {
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): ClaudeJsonData {
    const { tooltip, contextValue } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.CLAUDE_JSON, filePath),
      type: NodeType.CLAUDE_JSON,
      label,
      path: filePath,
      collapsibleState: 0,
      iconId: "settings-gear",
      tooltip: tooltip ?? filePath,
      contextValue: contextValue ?? "",
    };
  },

  /**
   * Create error data
   */
  createError(
    label: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      error?: Error | string | object | undefined;
      iconId?: IconId;
    } = {}
  ): ErrorDataNode {
    const { tooltip, contextValue = "error", error, iconId = "error" } = options;
    const errorData = toErrorDataSafe(error);

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.ERROR),
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconId,
      tooltip: tooltip ?? label,
      contextValue,
      error: errorData ?? { name: "Error", message: "Unknown error" },
    };
  },

  /**
   * Create info/empty data
   */
  createInfo(
    label: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      iconId?: IconId;
    } = {}
  ): NodeData {
    const { tooltip, contextValue = "empty", iconId = "info" } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.ERROR),
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconId,
      tooltip: tooltip ?? label,
      contextValue,
    };
  },

  /**
   * Create a virtual node (non-file-system node)
   *
   * Virtual nodes are grouping nodes that don't represent actual files/directories.
   * They have no path property, so commands that require a path will automatically fail.
   *
   * Examples: "Global Configuration", "Projects" root nodes
   *
   * @param label - Display label
   * @param type - NodeType
   * @param options - Optional configuration
   * @returns Virtual node data
   */
  createVirtualNode(
    label: string,
    type: NodeType,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
    } = {}
  ): NodeData {
    const { collapsibleState = 1, tooltip } = options;

    // Omit path property entirely - this makes virtual nodes distinct from file system nodes
    return {
      [NodeDataMarker]: true,
      id: this.generateId(type, label),
      type: type,
      label,
      // No path property - virtual nodes don't represent file system items
      collapsibleState,
      tooltip: tooltip ?? label,
      // contextValue will be generated dynamically by the command system
    };
  },
} as const;
