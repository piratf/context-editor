/**
 * TreeNode classes with getChildren() logic.
 * OOP approach where each node type knows how to load its own children.
 *
 * VS Code TreeView Integration:
 * - NodeBase extends vscode.TreeItem so getTreeItem() can return the node itself
 * - This ensures commands receive the full node object with both TreeItem properties
 *   and our custom interface methods (ICopyable, IDeletable, IOpenableInVscode)
 *
 * Menu Interface Implementation:
 * - Node classes implement menu interfaces to indicate which actions they support
 * - ICopyable: FileNode, DirectoryNode, ClaudeJsonNode
 * - IDeletable: FileNode, DirectoryNode, ClaudeJsonNode
 * - IOpenableInVscode: DirectoryNode only
 * - ContextValue is built from implemented interfaces for menu visibility
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { TreeNode, CollapsibleState } from "./treeNode.js";
import { NodeType } from "./treeNode.js";
import type { SyncFileFilter, FilterContext } from "./fileFilter.js";
import {
  ClaudeCodeFileFilter,
  ProjectClaudeFileFilter,
  createFilterContext,
} from "./fileFilter.js";
import {
  type ICopyable,
  type IDeletable,
  type IOpenableInVscode,
  CONTEXT_MARKERS,
  buildContextValue,
} from "./menuInterfaces.js";

/**
 * Convert CollapsibleState to vscode.TreeItemCollapsibleState
 */
function toVscodeCollapsibleState(state: CollapsibleState): vscode.TreeItemCollapsibleState {
  switch (state) {
    case 0:
      return vscode.TreeItemCollapsibleState.None;
    case 1:
      return vscode.TreeItemCollapsibleState.Collapsed;
    case 2:
      return vscode.TreeItemCollapsibleState.Expanded;
    default:
      return vscode.TreeItemCollapsibleState.None;
  }
}

/**
 * Result of a delete operation
 */
export type DeleteResult =
  | { success: true; method: "trash" | "permanent" }
  | { success: false; reason: "cancelled" | "error"; error?: Error };

/**
 * Delete function signature for dependency injection in tests
 */
export type DeleteFunction = (uri: vscode.Uri, options: { recursive: boolean; useTrash: boolean }) => Promise<void>;

/**
 * Default delete implementation using vscode.workspace.fs.delete
 */
const defaultDelete: DeleteFunction = async (uri, options) => {
  await vscode.workspace.fs.delete(uri, options);
};

/**
 * Helper function to delete a file/directory with useTrash fallback
 *
 * Some file systems (WSL remote, Windows files from WSL) don't support trash.
 * This function handles the error and provides user option to delete permanently.
 *
 * @param uri - URI of the file/directory to delete
 * @param itemName - Display name for user messages
 * @param deleteFn - Delete function (for testing, defaults to vscode.workspace.fs.delete)
 * @returns Result indicating success/failure and method used
 */
export async function deleteWithTrashFallback(
  uri: vscode.Uri,
  itemName: string,
  deleteFn: DeleteFunction = defaultDelete
): Promise<DeleteResult> {
  try {
    // Try to delete with trash first (safer)
    await deleteFn(uri, {
      recursive: true,
      useTrash: true,
    });
    return { success: true, method: "trash" };
  } catch (error) {
    // Check if error is about trash/recycle bin not being supported
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for various trash/recycle bin error patterns:
    // - WSL: "Unable to delete file via trash because provider does not support it"
    // - Windows: "Failed to move '...' to the recycle bin" or similar
    const isTrashError =
      (errorMessage.includes("trash") || errorMessage.includes("recycle")) &&
      (errorMessage.includes("does not support") ||
       errorMessage.includes("Failed to move") ||
       errorMessage.includes("Failed to perform delete"));

    if (isTrashError) {
      // Trash/recycle bin not supported, ask user if they want to permanently delete
      const confirmed = await vscode.window.showWarningMessage(
        `Cannot move to trash (file system does not support it).\n\nDo you want to permanently delete "${itemName}"?`,
        { modal: true },
        "Delete Permanently"
      );

      if (confirmed !== "Delete Permanently") {
        return { success: false, reason: "cancelled" };
      }

      // Delete permanently
      await deleteFn(uri, {
        recursive: true,
        useTrash: false,
      });
      return { success: true, method: "permanent" };
    } else {
      // Re-throw other errors
      return { success: false, reason: "error", error: error instanceof Error ? error : new Error(errorMessage) };
    }
  }
}

/**
 * Abstract base class for tree nodes
 * Extends vscode.TreeItem so getTreeItem() can return the node itself
 * This ensures context menu commands receive the full node with interface methods
 */
export abstract class NodeBase extends vscode.TreeItem {
  abstract readonly type: NodeType;
  readonly path: string | undefined;
  readonly error: Error | undefined;

  constructor(data: TreeNode) {
    // Initialize TreeItem with label and collapsible state
    super(data.label, toVscodeCollapsibleState(data.collapsibleState));

    // Set TreeItem properties from TreeNode data
    this.path = data.path;
    this.error = data.error;

    if (data.iconPath !== undefined) {
      this.iconPath = data.iconPath;
    }

    if (data.tooltip !== undefined) {
      this.tooltip = data.tooltip;
    }

    if (data.contextValue !== undefined) {
      this.contextValue = data.contextValue;
    }
  }

  /**
   * Get children for this node - must be implemented by subclasses
   * Returns NodeBase[] since nodes extend vscode.TreeItem
   */
  abstract getChildren(): Promise<NodeBase[]>;

  /**
   * Get the display name (file/directory name without path)
   * Used by ICopyable interface
   * Label is always a string since we pass it from TreeNode which has string label
   */
  getDisplayName(): string {
    // TreeItem.label can be string | TreeItemLabel | undefined,
    // but we always pass a string from TreeNode, so this is safe
    if (typeof this.label === "string") {
      return this.label;
    }
    // Handle TreeItemLabel case (has label and description)
    if (this.label && typeof this.label === "object" && "label" in this.label) {
      const labelObj = this.label as { label: string };
      return labelObj.label;
    }
    return "";
  }

  /**
   * Get the accessible file system path
   * Used by ICopyable interface
   */
  getAccessiblePath(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.path!;
  }

  /**
   * Check if deletion is safe
   * Used by IDeletable interface
   * Default implementation allows deletion
   */
  canDelete(): boolean {
    return true;
  }

  /**
   * Delete the file/directory this node represents
   * Used by IDeletable interface
   *
   * Attempts to use trash first, falls back to permanent delete if unsupported.
   * Some file systems (e.g., WSL remote, Windows files from WSL) don't support trash.
   */
  async delete(): Promise<void> {
    if (this.path === undefined) {
      throw new Error("Cannot delete node without path");
    }

    const uri = vscode.Uri.file(this.path);
    const result = await deleteWithTrashFallback(uri, this.getDisplayName());

    if (!result.success) {
      if (result.reason === "cancelled") {
        throw new Error("Deletion cancelled by user");
      }
      throw result.error ?? new Error("Deletion failed");
    }
  }
}

/**
 * Directory node - reads filesystem for children
 *
 * Implements ICopyable, IDeletable, IOpenableInVscode
 *
 * Responsible for file system operations only:
 * - Reading directory contents
 * - Creating child nodes
 * - Delegating filtering to the Filter
 */
export class DirectoryNode extends NodeBase implements ICopyable, IDeletable, IOpenableInVscode {
  readonly type = NodeType.DIRECTORY;
  private readonly filter: SyncFileFilter;
  private readonly pathSep: string;

  constructor(
    data: TreeNode,
    options: {
      filterClaudeFiles?: boolean;
      filter?: SyncFileFilter;
    } = {}
  ) {
    super(data);
    this.pathSep = path.sep;

    // Use provided filter or create default based on filterClaudeFiles flag
    if (options.filter !== undefined) {
      this.filter = options.filter;
    } else if (options.filterClaudeFiles === true) {
      // Use project Claude file filter for filtered mode
      this.filter = new ProjectClaudeFileFilter();
    } else {
      // Default: use Claude Code filter
      this.filter = new ClaudeCodeFileFilter();
    }
  }

  /**
   * Get the directory path for opening in new window
   * Used by IOpenableInVscode interface
   */
  getDirectoryPath(): string {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.path!;
  }

  /**
   * Open this directory in a new VS Code window
   * Used by IOpenableInVscode interface
   */
  async openInNewWindow(): Promise<void> {
    if (this.path === undefined) {
      throw new Error("Cannot open directory without path");
    }

    await vscode.commands.executeCommand(
      "vscode.openFolder",
      vscode.Uri.file(this.path),
      { forceNewWindow: true }
    );
  }

  /**
   * Check if deletion is safe
   * Override to prevent deletion of root or system directories
   */
  canDelete(): boolean {
    // Don't allow deleting if no path
    if (this.path === undefined) {
      return false;
    }

    // Additional safety checks could go here
    // For example, check if it's a home directory, system directory, etc.
    return true;
  }

  /**
   * Delete the directory
   * Uses parent class implementation which handles trash not supported errors
   */

  /**
   * Get children by reading the directory
   * Returns NodeBase[] since nodes extend vscode.TreeItem
   */
  async getChildren(): Promise<NodeBase[]> {
    if (this.path === undefined) {
      return [new ErrorNode({
        type: NodeType.ERROR,
        label: "Error: No path",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: "Directory node has no path",
        contextValue: "error",
      })];
    }

    try {
      const entries = await fs.readdir(this.path, { withFileTypes: true });

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const children: NodeBase[] = [];

      for (const entry of entries) {
        // Apply filtering through the Filter
        if (this.shouldInclude(entry.name, entry.isDirectory())) {
          if (entry.isDirectory()) {
            children.push(this.createDirectoryNode(entry.name));
          } else {
            children.push(this.createFileNode(entry.name));
          }
        }
      }

      // If empty, show empty message
      if (children.length === 0) {
        children.push(this.createEmptyNode());
      }

      return children;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      return [new ErrorNode({
        type: NodeType.ERROR,
        label: "Error reading directory",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: errorObj,
      })];
    }
  }

  /**
   * Determine if an entry should be included using the Filter
   */
  private shouldInclude(name: string, isDirectory: boolean): boolean {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parentPath = this.path!;
    const fullPath = path.join(parentPath, name);

    // Create filter context with path information only
    const context: FilterContext = createFilterContext(
      fullPath,
      name,
      isDirectory,
      parentPath,
      this.pathSep
    );

    // Delegate filtering to the Filter
    const result = this.filter.evaluate(context);
    return result.include;
  }

  /**
   * Create a directory node for a child
   * Returns a DirectoryNode instance (extends NodeBase which extends TreeItem)
   */
  private createDirectoryNode(name: string): DirectoryNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);

    // Build contextValue with menu interface markers
    const baseType = "directory";
    const interfaceMarkers = [
      CONTEXT_MARKERS.COPYABLE,
      CONTEXT_MARKERS.DELETABLE,
      CONTEXT_MARKERS.OPENABLE_IN_VSCODE,
    ];

    return new DirectoryNode({
      type: NodeType.DIRECTORY,
      label: name,
      path: fullPath,
      collapsibleState: 1,
      // No iconPath for collapsible nodes (directories) to avoid VS Code indentation issues
      tooltip: fullPath,
      contextValue: buildContextValue(baseType, interfaceMarkers),
    });
  }

  /**
   * Create a file node for a child
   * Returns a FileNode instance (extends NodeBase which extends TreeItem)
   */
  private createFileNode(name: string): FileNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);
    const iconId = this.getFileIcon(name);

    // Build contextValue with menu interface markers
    const baseType = "file";
    const interfaceMarkers = [CONTEXT_MARKERS.COPYABLE, CONTEXT_MARKERS.DELETABLE];

    return new FileNode({
      type: NodeType.FILE,
      label: name,
      path: fullPath,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: fullPath,
      contextValue: buildContextValue(baseType, interfaceMarkers),
    });
  }

  /**
   * Get appropriate icon for a file
   */
  private getFileIcon(filename: string): string {
    if (filename.endsWith(".json")) return "settings-gear";
    if (filename.endsWith(".md")) return "file-text";
    if (filename.endsWith(".ts") || filename.endsWith(".js")) return "code";
    return "file";
  }

  /**
   * Create an empty node
   * Returns an ErrorNode instance (extends NodeBase which extends TreeItem)
   */
  private createEmptyNode(): ErrorNode {
    return new ErrorNode({
      type: NodeType.ERROR,
      label: "(empty)",
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("info"),
      tooltip: "This directory is empty",
      contextValue: "empty",
    });
  }
}

/**
 * File node - leaf node, no children
 *
 * Implements ICopyable, IDeletable
 */
export class FileNode extends NodeBase implements ICopyable, IDeletable {
  readonly type = NodeType.FILE;

  getChildren(): Promise<NodeBase[]> {
    return Promise.resolve([]);
  }
}

/**
 * Claude JSON file node - special file type
 *
 * Implements ICopyable, IDeletable
 */
export class ClaudeJsonNode extends NodeBase implements ICopyable, IDeletable {
  readonly type = NodeType.CLAUDE_JSON;

  getChildren(): Promise<NodeBase[]> {
    return Promise.resolve([]);
  }
}

/**
 * Error node - displays error, no children
 *
 * Does NOT implement any menu interfaces
 */
export class ErrorNode extends NodeBase {
  readonly type = NodeType.ERROR;

  getChildren(): Promise<NodeBase[]> {
    return Promise.resolve([]);
  }
}

/**
 * Factory to create Node instances from TreeNode data
 */
export const NodeFactory = {
  create(data: TreeNode, options?: { filterClaudeFiles?: boolean; filter?: SyncFileFilter }): NodeBase {
    switch (data.type) {
      case NodeType.DIRECTORY:
        return new DirectoryNode(data, options);
      case NodeType.FILE:
        return new FileNode(data);
      case NodeType.CLAUDE_JSON:
        return new ClaudeJsonNode(data);
      case NodeType.ERROR:
        return new ErrorNode(data);
      default:
        return new ErrorNode(data);
    }
  },
} as const;
