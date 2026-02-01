/**
 * TreeDataProvider for Global Claude configuration.
 * Displays ~/.claude/ directory tree and ~/.claude.json in a tree view.
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { CollapsibleState } from "../types/claudeConfig.js";

/**
 * Tree node types for global view.
 */
export enum GlobalNodeType {
  ROOT = "root",
  DIRECTORY = "directory",
  FILE = "file",
  CLAUDE_JSON = "claudeJson",
  ERROR = "error",
}

/**
 * Internal tree node representation for global view.
 */
interface GlobalTreeNode {
  readonly type: GlobalNodeType;
  readonly label: string;
  readonly path?: string;
  readonly collapsibleState: CollapsibleState;
  readonly iconPath?: vscode.ThemeIcon;
  readonly tooltip?: string;
  readonly contextValue?: string;
  readonly error?: Error;
}

/**
 * Tree data provider for Global Persona view.
 * Shows ~/.claude/ directory tree and ~/.claude.json
 */
export class GlobalProvider implements vscode.TreeDataProvider<GlobalTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GlobalTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly claudeDir: string;
  private readonly claudeJsonPath: string;
  private rootNodes: GlobalTreeNode[] = [];
  private loadError: Error | null = null;

  constructor() {
    this.claudeDir = path.join(os.homedir(), ".claude");
    this.claudeJsonPath = path.join(os.homedir(), ".claude.json");
    void this.loadRootNodes();
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    void this.loadRootNodes();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get the tree item for a given node.
   */
  getTreeItem(element: GlobalTreeNode): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(
      element.label,
      element.collapsibleState === 2
        ? vscode.TreeItemCollapsibleState.Expanded
        : element.collapsibleState === 1
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None
    );

    if (element.iconPath !== undefined) {
      treeItem.iconPath = element.iconPath;
    }

    if (element.tooltip !== undefined) {
      treeItem.tooltip = element.tooltip;
    }

    if (element.contextValue !== undefined) {
      treeItem.contextValue = element.contextValue;
    }

    if (element.path !== undefined) {
      treeItem.resourceUri = vscode.Uri.file(element.path);
      // Make the item clickable to open the file
      treeItem.command = {
        command: "contextEditor.openFile",
        title: "Open File",
        arguments: [element.path],
      };
    }

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node is provided.
   */
  async getChildren(element?: GlobalTreeNode): Promise<GlobalTreeNode[]> {
    if (this.loadError) {
      return [
        {
          type: GlobalNodeType.ERROR,
          label: "Error loading global configuration",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("error"),
          tooltip: this.loadError.message,
          contextValue: "error",
          error: this.loadError,
        },
      ];
    }

    // No element = root level
    if (element === undefined) {
      return this.rootNodes;
    }

    // Directory node children
    if (element.type === GlobalNodeType.DIRECTORY && element.path !== undefined) {
      return this.getDirectoryChildren(element.path);
    }

    return [];
  }

  /**
   * Load root level nodes.
   */
  private async loadRootNodes(): Promise<void> {
    this.rootNodes = [];
    this.loadError = null;

    try {
      // Add ~/.claude.json file
      const claudeJsonExists = await this.fileExists(this.claudeJsonPath);
      if (claudeJsonExists) {
        this.rootNodes.push({
          type: GlobalNodeType.CLAUDE_JSON,
          label: "~/.claude.json",
          path: this.claudeJsonPath,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("settings-gear"),
          tooltip: this.claudeJsonPath,
          contextValue: "claudeJson",
        });
      }

      // Add ~/.claude/ directory
      const claudeDirExists = await this.directoryExists(this.claudeDir);
      if (claudeDirExists) {
        this.rootNodes.push({
          type: GlobalNodeType.DIRECTORY,
          label: "~/.claude/",
          path: this.claudeDir,
          collapsibleState: 1, // Collapsed
          iconPath: new vscode.ThemeIcon("folder"),
          tooltip: this.claudeDir,
          contextValue: "directory",
        });
      }

      // If nothing found, show empty message
      if (this.rootNodes.length === 0) {
        this.rootNodes.push({
          type: GlobalNodeType.ERROR,
          label: "No Claude global configuration found",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "Create ~/.claude.json or ~/.claude/ directory",
          contextValue: "empty",
        });
      }
    } catch (error) {
      this.loadError = error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Get children for a directory node.
   */
  private async getDirectoryChildren(dirPath: string): Promise<GlobalTreeNode[]> {
    const children: GlobalTreeNode[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        // Skip hidden files/dirs (except .claude.json related)
        if (entry.name.startsWith(".") && entry.name !== ".claude.json") {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          children.push({
            type: GlobalNodeType.DIRECTORY,
            label: entry.name + "/",
            path: fullPath,
            collapsibleState: 1, // Collapsed
            iconPath: new vscode.ThemeIcon("folder"),
            tooltip: fullPath,
            contextValue: "directory",
          });
        } else if (entry.isFile()) {
          // Determine icon based on file extension
          let iconPath = new vscode.ThemeIcon("file");
          if (entry.name.endsWith(".json")) {
            iconPath = new vscode.ThemeIcon("settings-gear");
          } else if (entry.name.endsWith(".md")) {
            iconPath = new vscode.ThemeIcon("file-text");
          }

          children.push({
            type: GlobalNodeType.FILE,
            label: entry.name,
            path: fullPath,
            collapsibleState: 0,
            iconPath: iconPath,
            tooltip: fullPath,
            contextValue: "file",
          });
        }
      }

      // If directory is empty
      if (children.length === 0) {
        children.push({
          type: GlobalNodeType.ERROR,
          label: "(empty)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "This directory is empty",
          contextValue: "empty",
        });
      }
    } catch (error) {
      children.push({
        type: GlobalNodeType.ERROR,
        label: "Error reading directory",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return children;
  }

  /**
   * Check if a file exists.
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists.
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
