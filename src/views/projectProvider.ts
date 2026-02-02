/**
 * TreeDataProvider for Claude Code projects.
 * Displays registered projects from ~/.claude.json in a tree view.
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import {
  getConfigReader,
  type ClaudeConfigWithProjects,
  type ClaudeProjectEntry,
} from "../services/claudeConfigReader.js";

/**
 * Tree node types for internal representation.
 */
export enum NodeType {
  ROOT = "root",
  PROJECT = "project",
  SETTINGS = "settings",
  CLAUDE_MD = "claudeMd",
  MCP_SERVERS = "mcpServers",
  ERROR = "error",
}

/**
 * Internal tree node representation.
 */
interface TreeNode {
  readonly type: NodeType;
  readonly label: string;
  readonly path?: string;
  readonly collapsibleState: CollapsibleState;
  readonly iconPath?: vscode.ThemeIcon;
  readonly tooltip?: string;
  readonly contextValue?: string;
  readonly error?: Error;
}

/**
 * Tree data provider for Claude Code projects view.
 */
export class ProjectProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private configReader = getConfigReader();
  private cachedConfig: ClaudeConfigWithProjects | null = null;
  private cacheError: Error | null = null;

  constructor() {
    void this.loadConfig();
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this.configReader.clearCache();
    void this.loadConfig();
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Get the tree item for a given node.
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
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

    // Only assign openFile command to FILE nodes (CLAUDE_MD, SETTINGS), not PROJECT directories
    const isClickable = element.type === NodeType.CLAUDE_MD || element.type === NodeType.SETTINGS;
    if (isClickable && element.path !== undefined) {
      treeItem.resourceUri = vscode.Uri.file(element.path);
      treeItem.command = {
        command: "contextEditor.openFile",
        title: "Open File",
        arguments: [element.path],
      };
    } else if (element.path !== undefined) {
      // For directories, set resourceUri but no command (only expandable)
      treeItem.resourceUri = vscode.Uri.file(element.path);
    }

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node is provided.
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (this.cacheError) {
      return [
        {
          type: NodeType.ERROR,
          label: "Error loading configuration",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("error"),
          tooltip: this.cacheError.message,
          contextValue: "error",
          error: this.cacheError,
        },
      ];
    }

    // No element = root level
    if (element === undefined) {
      return this.getRootChildren();
    }

    // Project node children
    if (element.type === NodeType.PROJECT) {
      const projectPath = element.path;
      if (projectPath !== undefined) {
        return this.getProjectChildren(projectPath);
      }
    }

    return [];
  }

  /**
   * Get root level children (projects).
   */
  private async getRootChildren(): Promise<TreeNode[]> {
    if (!this.cachedConfig) {
      await this.loadConfig();
    }

    if (!this.cachedConfig || this.cachedConfig.projects.length === 0) {
      return [
        {
          type: NodeType.ERROR,
          label: "No Claude projects found",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "Add projects using Claude Code CLI",
          contextValue: "empty",
        },
      ];
    }

    return this.cachedConfig.projects.map(
      (project): TreeNode => ({
        type: NodeType.PROJECT,
        label: this.getProjectLabel(project),
        path: project.path,
        collapsibleState: 1, // Collapsed
        iconPath: new vscode.ThemeIcon("folder"),
        tooltip: project.path,
        contextValue: "project",
      })
    );
  }

  /**
   * Get children for a project node.
   */
  private async getProjectChildren(projectPath: string): Promise<TreeNode[]> {
    const children: TreeNode[] = [];

    // Check for CLAUDE.md in project root
    const claudeMdPath = path.join(projectPath, "CLAUDE.md");
    const hasClaudeMd = await this.fileExists(claudeMdPath);
    if (hasClaudeMd) {
      children.push({
        type: NodeType.CLAUDE_MD,
        label: "CLAUDE.md",
        path: claudeMdPath,
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("file"),
        tooltip: claudeMdPath,
        contextValue: "claudeMd",
      });
    }

    // Check for .claude directory
    const claudeDirPath = path.join(projectPath, ".claude");
    const hasClaudeDir = await this.directoryExists(claudeDirPath);

    if (hasClaudeDir) {
      // Check for .claude/CLAUDE.md
      const nestedClaudeMdPath = path.join(claudeDirPath, "CLAUDE.md");
      const hasNestedClaudeMd = await this.fileExists(nestedClaudeMdPath);
      if (hasNestedClaudeMd) {
        children.push({
          type: NodeType.CLAUDE_MD,
          label: ".claude/CLAUDE.md",
          path: nestedClaudeMdPath,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("file"),
          tooltip: nestedClaudeMdPath,
          contextValue: "claudeMd",
        });
      }

      // Check for .claude/settings.json
      const settingsPath = path.join(claudeDirPath, "settings.json");
      const hasSettings = await this.fileExists(settingsPath);
      if (hasSettings) {
        children.push({
          type: NodeType.SETTINGS,
          label: "settings.json",
          path: settingsPath,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("settings-gear"),
          tooltip: settingsPath,
          contextValue: "settings",
        });
      }
    }

    // If no config files found, show empty message
    if (children.length === 0) {
      children.push({
        type: NodeType.ERROR,
        label: "No config files",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("info"),
        tooltip: "Add CLAUDE.md or .claude/settings.json",
        contextValue: "empty",
      });
    }

    return children;
  }

  /**
   * Load configuration from ~/.claude.json.
   */
  private async loadConfig(): Promise<void> {
    try {
      this.cachedConfig = await this.configReader.readConfig();
      this.cacheError = null;
    } catch (error) {
      this.cachedConfig = null;
      this.cacheError = error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Get a display label for a project entry.
   */
  private getProjectLabel(project: ClaudeProjectEntry): string {
    // Try to get the project name from the path
    const pathBasename = path.basename(project.path);
    if (pathBasename.length > 0) {
      return pathBasename;
    }
    return project.path;
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
