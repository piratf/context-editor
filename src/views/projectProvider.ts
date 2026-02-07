/**
 * TreeDataProvider for Claude Code projects.
 * Displays project files filtered to show only .claude directory and CLAUDE.md files.
 *
 * New Architecture:
 * - Uses EnvironmentManager to get the current environment's data facade
 * - Reads actual file system for each project
 * - Shows only .claude directory and CLAUDE.md files
 * - Provides native VS Code context menu via resourceUri
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import { EnvironmentManager } from "../services/environmentManager.js";

/**
 * Tree node types for file tree representation.
 */
export enum NodeType {
  ROOT = "root",
  DIRECTORY = "directory",
  FILE = "file",
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
 * Shows filtered project files (.claude directory and CLAUDE.md only).
 */
export class ProjectProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private environmentManager: EnvironmentManager;
  private rootNodes: TreeNode[] = [];
  private debugOutput: vscode.OutputChannel;

  constructor(envManager: EnvironmentManager, debugOutput: vscode.OutputChannel) {
    this.environmentManager = envManager;
    this.debugOutput = debugOutput;
    void this.loadRootNodes();
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this.debugOutput.appendLine("[ProjectProvider] refresh() called");
    void this.loadRootNodes();
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

    // Set resourceUri to enable native VS Code context menu
    // Skip all nodes to avoid triggering Git warnings for cross-platform paths
    // Disabled because resourceUri doesn't automatically enable context menu anyway
    // and it triggers unwanted Git scanning
    // if (element.path !== undefined && element.type !== NodeType.FILE) {
    //   treeItem.resourceUri = vscode.Uri.file(element.path);
    // }

    // For files, add command to open (use path directly without resourceUri)
    if (element.type === NodeType.FILE && element.path !== undefined) {
      treeItem.command = {
        command: "vscode.open",
        title: "Open File",
        arguments: [vscode.Uri.file(element.path)],
      };
    }

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node is provided.
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    // Return error node if loading failed
    if (this.rootNodes.length === 1 && this.rootNodes[0]?.type === NodeType.ERROR) {
      return this.rootNodes;
    }

    // No element = root level (show projects)
    if (element === undefined) {
      return this.rootNodes;
    }

    // Directory node children - read filtered contents
    if (element.type === NodeType.DIRECTORY && element.path !== undefined) {
      return this.getDirectoryChildren(element.path);
    }

    return [];
  }

  /**
   * Load root level nodes - projects from current environment
   */
  private async loadRootNodes(): Promise<void> {
    this.rootNodes = [];

    try {
      const facade = this.environmentManager.getCurrentFacade();

      this.debugOutput.appendLine(
        `[ProjectProvider] Current facade: ${facade?.getEnvironmentInfo().type ?? "null"}`
      );
      this.debugOutput.appendLine(
        `[ProjectProvider] Config path: ${facade?.getEnvironmentInfo().configPath ?? "null"}`
      );

      if (facade === null) {
        this.rootNodes.push({
          type: NodeType.ERROR,
          label: "No environment selected",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "Select an environment using the status bar button",
          contextValue: "empty",
        });
        return;
      }

      // Get projects for current environment
      const projects = await facade.getProjects();

      this.debugOutput.appendLine(`[ProjectProvider] Found ${String(projects.length)} projects:`);

      if (projects.length === 0) {
        this.rootNodes.push({
          type: NodeType.ERROR,
          label: "(no projects found)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No projects found in this environment",
          contextValue: "empty",
        });
        return;
      }

      // Create directory nodes for each project
      for (const project of projects) {
        const projectName = this.getProjectName(project.path);

        this.debugOutput.appendLine(`[ProjectProvider]   - ${projectName} | ${project.path}`);

        this.rootNodes.push({
          type: NodeType.DIRECTORY,
          label: projectName,
          path: project.path,
          collapsibleState: 1, // Always collapsible to show "(no Claude files)" message
          tooltip: project.path,
          contextValue: "project",
        });
      }
    } catch (error) {
      this.debugOutput.appendLine(
        `[ProjectProvider] Error: ${error instanceof Error ? error.message : String(error)}`
      );
      this.rootNodes = [
        {
          type: NodeType.ERROR,
          label: "Error loading projects",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("error"),
          tooltip: error instanceof Error ? error.message : String(error),
          contextValue: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        },
      ];
    }
  }

  /**
   * Get children for a directory node (filtered file system read)
   *
   * Filtering rules:
   * - Project root directories: Only show .claude directory and CLAUDE.md files
   * - Inside .claude directory: Show all files and subdirectories
   */
  private async getDirectoryChildren(dirPath: string): Promise<TreeNode[]> {
    this.debugOutput.appendLine(`[ProjectProvider] getDirectoryChildren(): ${dirPath}`);
    const children: TreeNode[] = [];

    // Check if we're inside a .claude directory
    const isInsideClaudeDir =
      dirPath.includes(`${path.sep}.claude${path.sep}`) ||
      dirPath.endsWith(`${path.sep}.claude`) ||
      dirPath.endsWith(`.claude`);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      // Sort: directories first, then files, both alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Inside .claude: show all directories
          // Outside .claude: only show .claude directory
          if (isInsideClaudeDir || entry.name === ".claude") {
            children.push({
              type: NodeType.DIRECTORY,
              label: entry.name,
              path: fullPath,
              collapsibleState: 1, // Collapsed
              tooltip: fullPath,
              contextValue: isInsideClaudeDir ? "claudeDirectory" : "directory",
            });
          }
        } else if (entry.isFile()) {
          // Inside .claude: show all files
          // Outside .claude: only show CLAUDE.md files
          if (isInsideClaudeDir || entry.name === "CLAUDE.md" || entry.name === ".claude.md") {
            // Choose icon based on file type
            let iconId = "file";
            if (entry.name.endsWith(".md")) {
              iconId = "file-text";
            } else if (entry.name.endsWith(".json")) {
              iconId = "settings";
            } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
              iconId = "code";
            }

            children.push({
              type: NodeType.FILE,
              label: entry.name,
              path: fullPath,
              collapsibleState: 0,
              iconPath: new vscode.ThemeIcon(iconId),
              tooltip: fullPath,
              contextValue: isInsideClaudeDir ? "claudeFile" : "claudeMdFile",
            });
          }
        }
      }

      // If directory is empty (no matching files), show empty message
      if (children.length === 0) {
        children.push({
          type: NodeType.ERROR,
          label: isInsideClaudeDir ? "(empty)" : "(no Claude files)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: isInsideClaudeDir
            ? "This directory is empty"
            : "No .claude directory or CLAUDE.md file found",
          contextValue: "empty",
        });
      }
    } catch (error) {
      children.push({
        type: NodeType.ERROR,
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
   * Get project name from project path
   */
  private getProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || projectPath;
  }
}
