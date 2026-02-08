/**
 * TreeNode classes with getChildren() logic.
 * OOP approach where each node type knows how to load its own children.
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

/**
 * Abstract base class for tree nodes
 */
export abstract class NodeBase {
  abstract readonly type: NodeType;
  readonly label: string;
  readonly path: string | undefined;
  readonly collapsibleState: CollapsibleState;
  readonly iconPath: vscode.ThemeIcon | undefined;
  readonly tooltip: string | undefined;
  readonly contextValue: string | undefined;
  readonly error: Error | undefined;

  constructor(data: TreeNode) {
    this.label = data.label;
    this.path = data.path;
    this.collapsibleState = data.collapsibleState;
    this.iconPath = data.iconPath;
    this.tooltip = data.tooltip;
    this.contextValue = data.contextValue;
    this.error = data.error;
  }

  /**
   * Get children for this node - must be implemented by subclasses
   */
  abstract getChildren(): Promise<TreeNode[]>;

  /**
   * Convert to TreeNode interface
   */
  toTreeNode(): TreeNode {
    return {
      type: this.type,
      label: this.label,
      path: this.path,
      collapsibleState: this.collapsibleState,
      iconPath: this.iconPath,
      tooltip: this.tooltip,
      contextValue: this.contextValue,
      error: this.error,
    } as TreeNode;
  }
}

/**
 * Directory node - reads filesystem for children
 *
 * Responsible for file system operations only:
 * - Reading directory contents
 * - Creating child nodes
 * - Delegating filtering to the Filter
 */
export class DirectoryNode extends NodeBase {
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
   * Get children by reading the directory
   */
  async getChildren(): Promise<TreeNode[]> {
    if (this.path === undefined) {
      const node: TreeNode = {
        type: NodeType.ERROR,
        label: "Error: No path",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: "Directory node has no path",
        contextValue: "error",
      };
      return [node];
    }

    try {
      const entries = await fs.readdir(this.path, { withFileTypes: true });

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      const children: TreeNode[] = [];

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
      const node: TreeNode = {
        type: NodeType.ERROR,
        label: "Error reading directory",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: errorObj,
      } as TreeNode;
      return [node];
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
   */
  private createDirectoryNode(name: string): TreeNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);

    return {
      type: NodeType.DIRECTORY,
      label: name,
      path: fullPath,
      collapsibleState: 1,
      // No iconPath for collapsible nodes (directories) to avoid VS Code indentation issues
      tooltip: fullPath,
      contextValue: "directory",
    };
  }

  /**
   * Create a file node for a child
   */
  private createFileNode(name: string): TreeNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);
    const iconId = this.getFileIcon(name);

    return {
      type: NodeType.FILE,
      label: name,
      path: fullPath,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: fullPath,
      contextValue: "file",
    };
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
   */
  private createEmptyNode(): TreeNode {
    return {
      type: NodeType.ERROR,
      label: "(empty)",
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("info"),
      tooltip: "This directory is empty",
      contextValue: "empty",
    };
  }
}

/**
 * File node - leaf node, no children
 */
export class FileNode extends NodeBase {
  readonly type = NodeType.FILE;

  getChildren(): Promise<TreeNode[]> {
    return Promise.resolve([]);
  }
}

/**
 * Claude JSON file node - special file type
 */
export class ClaudeJsonNode extends NodeBase {
  readonly type = NodeType.CLAUDE_JSON;

  getChildren(): Promise<TreeNode[]> {
    return Promise.resolve([]);
  }
}

/**
 * Error node - displays error, no children
 */
export class ErrorNode extends NodeBase {
  readonly type = NodeType.ERROR;

  getChildren(): Promise<TreeNode[]> {
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
