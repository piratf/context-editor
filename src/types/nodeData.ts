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
 *
 * Node Type System (Bitwise):
 * - Uses bitwise flags to represent node types
 * - Multiple flags can be combined using bitwise OR
 * - Example: FILE | CLAUDE_JSON represents a Claude JSON file
 * - PROJECT and DIRECTORY are completely separate types (not hierarchical)
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
 * Node category for VIRTUAL nodes
 *
 * 定义虚拟节点的类别，用于导出时确定目录结构
 */
export const enum NodeCategory {
  /** Global configuration category */
  GLOBAL = "global",
  /** Projects category */
  PROJECTS = "projects",
}

/**
 * Node type flags (bitwise)
 *
 * Multiple flags can be combined using bitwise OR.
 * Example: FILE | CLAUDE_JSON = 1 | 4 = 5
 *
 * Type storage: The `type` field in NodeData stores these bitwise values directly.
 * No separate `flags` field is needed.
 *
 * PROJECT vs DIRECTORY:
 * - PROJECT is a completely independent type from DIRECTORY
 * - PROJECT nodes are registered project roots (special handling)
 * - DIRECTORY nodes are regular directories
 * - A node cannot be both PROJECT and DIRECTORY simultaneously
 */
export const enum NodeType {
  /** File node (has content) */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  FILE = 1 << 0, // 1
  /** Directory node (can have children) */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  DIRECTORY = 1 << 1, // 2
  /** Claude JSON file (special config file) */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  CLAUDE_JSON = 1 << 2, // 4
  /** Project root directory (registered Claude project) */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  PROJECT = 1 << 3, // 8
  /** Virtual node (no file system path) */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  VIRTUAL = 1 << 4, // 16
  /** Error node */
  // eslint-disable-next-line @typescript-eslint/prefer-literal-enum-member -- Bitwise operations are intentional for type flags
  ERROR = 1 << 5, // 32
}

/**
 * Type guard helpers for NodeType
 *
 * Provides type-safe checking for bitwise node types.
 * Use these helpers instead of direct bitwise operations.
 */
export const NodeTypeGuard = {
  /**
   * Check if node has FILE flag
   */
  isFile: (type: NodeType): boolean => (type & NodeType.FILE) !== 0,

  /**
   * Check if node has DIRECTORY flag (and NOT PROJECT)
   */
  isDirectory: (type: NodeType): boolean =>
    (type & NodeType.DIRECTORY) !== 0 && (type & NodeType.PROJECT) === 0,

  /**
   * Check if node has CLAUDE_JSON flag
   */
  isClaudeJson: (type: NodeType): boolean => (type & NodeType.CLAUDE_JSON) !== 0,

  /**
   * Check if node has PROJECT flag
   */
  isProject: (type: NodeType): boolean => (type & NodeType.PROJECT) !== 0,

  /**
   * Check if node has VIRTUAL flag
   */
  isVirtual: (type: NodeType): boolean => (type & NodeType.VIRTUAL) !== 0,

  /**
   * Check if node has ERROR flag
   */
  isError: (type: NodeType): boolean => (type & NodeType.ERROR) !== 0,
};

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
 *
 * Type field: Stores bitwise NodeType flags.
 * Can be a single type (e.g., NodeType.FILE = 1)
 * Or combined types (e.g., NodeType.FILE | NodeType.CLAUDE_JSON = 5)
 */
export interface NodeData {
  /** Runtime type marker - ensures only factory-created objects pass type checks */
  readonly [NodeDataMarker]: true;
  /** Unique identifier for this node */
  readonly id: string;
  /** Bitwise type flags (can be combined) - stores NodeType flags directly */
  readonly type: NodeType;
  /** Display label */
  readonly label: string;
  /** File system path (if applicable) */
  readonly path?: string;
  /** Category for VIRTUAL nodes (用于导出时确定目录结构） */
  readonly category?: NodeCategory;
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
 * Type guard for directory nodes (including PROJECT nodes)
 *
 * Note: This checks if the node has a path and is a directory-like node.
 * For strict DIRECTORY (non-PROJECT) checking, use NodeTypeGuard.isDirectory()
 */
export function isDirectoryData(data: NodeData): data is NodeData {
  return (
    (NodeTypeGuard.isDirectory(data.type) || NodeTypeGuard.isProject(data.type)) &&
    data.path !== undefined
  );
}

/**
 * Type guard for file nodes (including CLAUDE_JSON)
 */
export function isFileData(data: NodeData): data is NodeData {
  return NodeTypeGuard.isFile(data.type) && data.path !== undefined;
}

/**
 * Type guard for Claude JSON nodes
 */
export function isClaudeJsonData(data: NodeData): data is NodeData {
  return NodeTypeGuard.isClaudeJson(data.type) && data.path !== undefined;
}

/**
 * Type guard for project nodes
 */
export function isProjectData(data: NodeData): data is NodeData {
  return NodeTypeGuard.isProject(data.type) && data.path !== undefined;
}

/**
 * Type guard for error nodes
 */
export function isErrorDataNode(data: NodeData): data is NodeData {
  return NodeTypeGuard.isError(data.type);
}

/**
 * Get the name of a NodeType value
 * Helper for generating consistent IDs from enum values
 */
function getNodeTypeName(type: NodeType): string {
  switch (type) {
    case NodeType.FILE:
      return "FILE";
    case NodeType.DIRECTORY:
      return "DIRECTORY";
    case NodeType.CLAUDE_JSON:
      return "CLAUDE_JSON";
    case NodeType.PROJECT:
      return "PROJECT";
    case NodeType.VIRTUAL:
      return "VIRTUAL";
    case NodeType.ERROR:
      return "ERROR";
    default:
      return `UNKNOWN_${String(type)}`;
  }
}

/**
 * Factory for creating node data objects
 *
 * Creates NodeData objects with proper type flags.
 * Uses bitwise OR for combining flags (e.g., FILE | CLAUDE_JSON).
 */
export const NodeDataFactory = {
  /**
   * Generate unique ID for a node
   */
  generateId(type: NodeType, path?: string): string {
    const typeKey = getNodeTypeName(type);
    if (path !== undefined && path !== "") {
      return `${typeKey}:${path}`;
    }
    return `${typeKey}:${String(Date.now())}:${Math.random().toString(36).slice(2)}`;
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
  ): NodeData {
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
   * Create Claude JSON file data (FILE | CLAUDE_JSON)
   */
  createClaudeJson(
    label: string,
    filePath: string,
    options: {
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): NodeData {
    const { tooltip, contextValue } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.CLAUDE_JSON, filePath),
      type: NodeType.FILE | NodeType.CLAUDE_JSON,
      label,
      path: filePath,
      collapsibleState: 0,
      iconId: "settings-gear",
      tooltip: tooltip ?? filePath,
      contextValue: contextValue ?? "",
    };
  },

  /**
   * Create directory data (pure DIRECTORY type, not PROJECT)
   */
  createDirectory(
    label: string,
    dirPath: string,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): NodeData {
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
   * Create project data (PROJECT type - independent from DIRECTORY)
   *
   * IMPORTANT: PROJECT is NOT a DIRECTORY subtype!
   * - PROJECT nodes get filtered children (ProjectClaudeFileFilter)
   * - DIRECTORY nodes get all children (no filter)
   */
  createProject(
    label: string,
    projectPath: string,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): NodeData {
    const { collapsibleState = 1, tooltip, contextValue } = options;

    return {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.PROJECT, projectPath),
      type: NodeType.PROJECT,
      label,
      path: projectPath,
      collapsibleState,
      tooltip: tooltip ?? projectPath,
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
  ): NodeData {
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
   * @param options - Optional configuration
   * @returns Virtual node data
   */
  createVirtualNode(
    label: string,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
      category?: NodeCategory;
    } = {}
  ): NodeData {
    const { collapsibleState = 1, tooltip, category } = options;

    // Omit path property entirely - this makes virtual nodes distinct from file system nodes
    const node: NodeData = {
      [NodeDataMarker]: true,
      id: this.generateId(NodeType.VIRTUAL, label),
      type: NodeType.VIRTUAL,
      label,
      // No path property - virtual nodes don't represent file system items
      collapsibleState,
      tooltip: tooltip ?? label,
      ...(category !== undefined ? { category } : {}),
      // contextValue will be generated dynamically by the command system
    };
    return node;
  },
} as const;
