/**
 * TreeNode classes with getChildren() logic.
 * OOP approach where each node type knows how to load its own children.
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { TreeNode, CollapsibleState } from "./treeNode.js";
import { NodeType } from "./treeNode.js";

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
 */
export class DirectoryNode extends NodeBase {
  readonly type = NodeType.DIRECTORY;
  private readonly isInsideClaudeDir: boolean;
  private readonly filterClaudeFiles: boolean;

  constructor(
    data: TreeNode,
    options: {
      isInsideClaudeDir?: boolean;
      filterClaudeFiles?: boolean;
    } = {}
  ) {
    super(data);
    this.isInsideClaudeDir = options.isInsideClaudeDir ?? this.checkIfInsideClaudeDir();
    this.filterClaudeFiles = options.filterClaudeFiles ?? false;
  }

  /**
   * Check if this directory is inside a .claude directory
   */
  private checkIfInsideClaudeDir(): boolean {
    if (this.path === undefined) return false;
    return (
      this.path.includes(`${path.sep}.claude${path.sep}`) ||
      this.path.endsWith(`${path.sep}.claude`) ||
      this.path.endsWith(".claude")
    );
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
        if (entry.isDirectory()) {
          // Apply filtering based on configuration
          if (this.shouldIncludeDirectory(entry.name)) {
            children.push(this.createDirectoryNode(entry.name));
          }
        } else if (entry.isFile()) {
          if (this.shouldIncludeFile(entry.name)) {
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
   * Determine if a directory should be included
   */
  private shouldIncludeDirectory(name: string): boolean {
    if (this.filterClaudeFiles) {
      // In Claude file filtering mode, only show .claude directory
      return name === ".claude";
    }

    if (this.isInsideClaudeDir) {
      // Inside .claude, show all directories
      return true;
    }

    // Skip hidden directories
    if (name.startsWith(".")) {
      return false;
    }

    return true;
  }

  /**
   * Determine if a file should be included
   */
  private shouldIncludeFile(name: string): boolean {
    if (this.filterClaudeFiles) {
      // In Claude file filtering mode, only show CLAUDE.md files
      return name === "CLAUDE.md" || name === ".claude.md";
    }

    if (this.isInsideClaudeDir) {
      // Inside .claude, show all files
      return true;
    }

    // Skip hidden files (except .claude.json)
    if (name.startsWith(".") && name !== ".claude.json") {
      return false;
    }

    return true;
  }

  /**
   * Create a directory node for a child
   */
  private createDirectoryNode(name: string): TreeNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);
    const childInsideClaude =
      this.isInsideClaudeDir || name === ".claude" || fullPath.endsWith(".claude");

    return {
      type: NodeType.DIRECTORY,
      label: name,
      path: fullPath,
      collapsibleState: 1,
      // No iconPath for collapsible nodes (directories) to avoid VS Code indentation issues
      tooltip: fullPath,
      contextValue: childInsideClaude ? "claudeDirectory" : "directory",
    };
  }

  /**
   * Create a file node for a child
   */
  private createFileNode(name: string): TreeNode {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fullPath = path.join(this.path!, name);
    const iconId = this.getFileIcon(name);
    const contextValue = this.isInsideClaudeDir ? "claudeFile" : "file";

    return {
      type: NodeType.FILE,
      label: name,
      path: fullPath,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: fullPath,
      contextValue,
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
    const label = this.filterClaudeFiles
      ? "(no Claude files)"
      : this.isInsideClaudeDir
        ? "(empty)"
        : "(empty)";

    const tooltip = this.filterClaudeFiles
      ? "No .claude directory or CLAUDE.md file found"
      : "This directory is empty";

    return {
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("info"),
      tooltip,
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
  create(data: TreeNode, options?: { isInsideClaudeDir?: boolean; filterClaudeFiles?: boolean }): NodeBase {
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
