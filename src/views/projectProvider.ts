/**
 * TreeDataProvider for Claude Code projects.
 * Displays registered projects from ~/.claude.json in a tree view.
 *
 * New Architecture:
 * - Uses EnvironmentManager to get the current environment's data facade
 * - Shows projects from the current environment only
 * - Users switch environments via dropdown menu
 */

import * as vscode from "vscode";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import { EnvironmentManager } from "../services/environmentManager.js";

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
  FILE = "file",
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
  readonly projectIndex?: number;
}

/**
 * Tree data provider for Claude Code projects view.
 * Shows projects from the currently selected environment.
 */
export class ProjectProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private environmentManager: EnvironmentManager;
  private rootNodes: TreeNode[] = [];
  private currentProjects: readonly import("../services/dataFacade.js").ProjectEntry[] = [];
  // @ts-expect-error - Reserved for future debug use
  private readonly __debugOutput: vscode.OutputChannel;

  constructor(envManager: EnvironmentManager, debugOutput: vscode.OutputChannel) {
    this.environmentManager = envManager;
    this.__debugOutput = debugOutput;
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

    // Only make project nodes clickable
    if (element.type === NodeType.PROJECT && element.path !== undefined) {
      treeItem.resourceUri = vscode.Uri.file(element.path);
      treeItem.command = {
        command: "vscode.openFolder",
        title: "Open Project",
        arguments: [element.path],
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

    // Settings node children
    if (element.type === NodeType.SETTINGS && element.projectIndex !== undefined) {
      return this.getProjectSettings(element.projectIndex);
    }

    // CLAUDE.md node children
    if (element.type === NodeType.CLAUDE_MD && element.projectIndex !== undefined) {
      return this.getProjectClaudeMd(element.projectIndex);
    }

    // MCP Servers node children
    if (element.type === NodeType.MCP_SERVERS && element.projectIndex !== undefined) {
      return this.getProjectMcpServers(element.projectIndex);
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

      if (facade === null) {
        this.rootNodes.push({
          type: NodeType.ERROR,
          label: "No environment selected",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "Select an environment using the dropdown menu",
          contextValue: "empty",
        });
        return;
      }

      // Get projects for current environment
      this.currentProjects = await facade.getProjects();

      if (this.currentProjects.length === 0) {
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

      // Create nodes for each project and its children
      for (let i = 0; i < this.currentProjects.length; i++) {
        const project = this.currentProjects[i];
        const projectName = this.getProjectName(project.path);

        // Project node
        this.rootNodes.push({
          type: NodeType.PROJECT,
          label: projectName,
          path: project.path,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("folder"),
          tooltip: project.path,
          contextValue: "project",
        });

        // Add Settings child node if project has settings
        const hasSettings = project.state !== undefined && Object.keys(project.state).length > 0;
        if (hasSettings) {
          this.rootNodes.push({
            type: NodeType.SETTINGS,
            label: "Settings",
            collapsibleState: 1,
            iconPath: new vscode.ThemeIcon("gear"),
            tooltip: "Project settings",
            contextValue: "settings",
            projectIndex: i,
          });
        }

        // Add CLAUDE.md child node
        this.rootNodes.push({
          type: NodeType.CLAUDE_MD,
          label: "CLAUDE.md",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("file-text"),
          tooltip: "Project context file",
          contextValue: "claudeMd",
          projectIndex: i,
        });

        // Add MCP Servers child node if project has MCP servers
        const hasMcpServers = project.mcpServers !== undefined && Object.keys(project.mcpServers).length > 0;
        if (hasMcpServers) {
          const serverNames = Object.keys(project.mcpServers!).join(", ");
          this.rootNodes.push({
            type: NodeType.MCP_SERVERS,
            label: "MCP Servers",
            collapsibleState: 0,
            iconPath: new vscode.ThemeIcon("server"),
            tooltip: `MCP servers: ${serverNames}`,
            contextValue: "mcpServers",
            projectIndex: i,
          });
        }
      }
    } catch (error) {
      this.rootNodes = [{
        type: NodeType.ERROR,
        label: "Error loading projects",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      }];
    }
  }

  /**
   * Get settings for a specific project
   */
  private async getProjectSettings(projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      if (projectIndex >= this.currentProjects.length) {
        return [];
      }

      const project = this.currentProjects[projectIndex];
      if (!project.state) {
        nodes.push({
          type: NodeType.ERROR,
          label: "(no settings)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "This project has no custom settings",
          contextValue: "empty",
        });
        return nodes;
      }

      // Add allowed tools
      const { allowedTools } = project.state;
      if (allowedTools && allowedTools.length > 0) {
        nodes.push({
          type: NodeType.FILE,
          label: `Allowed Tools: ${allowedTools.join(", ")}`,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("check"),
          tooltip: allowedTools.join(", "),
          contextValue: "allowedTools",
        });
      }
    } catch (error) {
      nodes.push({
        type: NodeType.ERROR,
        label: "Error loading settings",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return nodes;
  }

  /**
   * Get CLAUDE.md files for a specific project
   */
  private async getProjectClaudeMd(projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      if (projectIndex >= this.currentProjects.length) {
        return [];
      }

      const facade = this.environmentManager.getCurrentFacade();
      if (facade === null) {
        return [];
      }

      const project = this.currentProjects[projectIndex];
      const projectName = this.getProjectName(project.path);
      const contextFiles = await facade.getProjectContextFiles(projectName);

      for (const filePath of contextFiles) {
        const fileName = path.basename(filePath);
        nodes.push({
          type: NodeType.FILE,
          label: fileName,
          path: filePath,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("file-text"),
          tooltip: filePath,
          contextValue: "claudeMdFile",
        });
      }

      if (nodes.length === 0) {
        nodes.push({
          type: NodeType.ERROR,
          label: "(no CLAUDE.md found)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No CLAUDE.md file found in this project",
          contextValue: "empty",
        });
      }
    } catch (error) {
      nodes.push({
        type: NodeType.ERROR,
        label: "Error loading context files",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return nodes;
  }

  /**
   * Get MCP servers for a specific project
   */
  private async getProjectMcpServers(projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      if (projectIndex >= this.currentProjects.length) {
        return [];
      }

      const project = this.currentProjects[projectIndex];
      if (!project.mcpServers) {
        nodes.push({
          type: NodeType.ERROR,
          label: "(no MCP servers)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "This project has no MCP servers configured",
          contextValue: "empty",
        });
        return nodes;
      }

      // Add each MCP server
      for (const [name, config] of Object.entries(project.mcpServers)) {
        const description = config.command !== undefined ? `Command: ${config.command}` : "No command";
        nodes.push({
          type: NodeType.FILE,
          label: name,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("server"),
          tooltip: description,
          contextValue: "mcpServer",
        });
      }
    } catch (error) {
      nodes.push({
        type: NodeType.ERROR,
        label: "Error loading MCP servers",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    return nodes;
  }

  /**
   * Get project name from project path
   */
  private getProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || projectPath;
  }
}
