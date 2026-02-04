/**
 * TreeDataProvider for Claude Code projects.
 * Displays registered projects from ~/.claude.json in a tree view.
 *
 * New Architecture:
 * - Uses ConfigSearch to get data facades for all environments
 * - Shows projects from all environments, grouped by environment
 * - Supports cross-environment path resolution
 * - No environment switching - all environments shown at once
 */

import * as vscode from "vscode";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import { ConfigSearch } from "../services/configSearch.js";

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
  ENVIRONMENT = "environment",
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
  readonly facadeIndex?: number;
  readonly projectIndex?: number;
}

/**
 * Tree data provider for Claude Code projects view.
 * Shows projects from all accessible environments.
 */
export class ProjectProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private configSearch: ConfigSearch;
  private rootNodes: TreeNode[] = [];

   
  constructor(search: ConfigSearch, _debugOutput: vscode.OutputChannel) {
    this.configSearch = search;
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

    // No element = root level
    if (element === undefined) {
      return this.rootNodes;
    }

    // Environment node children - show projects for that environment
    if (element.type === NodeType.ENVIRONMENT && element.facadeIndex !== undefined) {
      return this.getEnvironmentProjects(element.facadeIndex);
    }

    // Settings node children
    if (element.type === NodeType.SETTINGS && element.facadeIndex !== undefined && element.projectIndex !== undefined) {
      return this.getProjectSettings(element.facadeIndex, element.projectIndex);
    }

    // CLAUDE.md node children
    if (element.type === NodeType.CLAUDE_MD && element.facadeIndex !== undefined && element.projectIndex !== undefined) {
      return this.getProjectClaudeMd(element.facadeIndex, element.projectIndex);
    }

    // MCP Servers node children
    if (element.type === NodeType.MCP_SERVERS && element.facadeIndex !== undefined && element.projectIndex !== undefined) {
      return this.getProjectMcpServers(element.facadeIndex, element.projectIndex);
    }

    return [];
  }

  /**
   * Load root level nodes - one environment per accessible facade
   */
  private async loadRootNodes(): Promise<void> {
    this.rootNodes = [];

    try {
      const facades = this.configSearch.getAllFacades();

      if (facades.length === 0) {
        this.rootNodes.push({
          type: NodeType.ERROR,
          label: "No environments found",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No accessible Claude configuration found",
          contextValue: "empty",
        });
        return;
      }

      // Create a node for each environment's projects
      for (let i = 0; i < facades.length; i++) {
        const facade = facades[i];
        const info = facade.getEnvironmentInfo();

        // Get project count for this environment
        const projects = await this.getFacadeProjects(facade);

        const displayName = this.getEnvironmentDisplayName(info.type, info.instanceName);

        // Add node even if no projects
        this.rootNodes.push({
          type: NodeType.ENVIRONMENT,
          label: `${displayName} (${String(projects.length)})`,
          collapsibleState: projects.length > 0 ? 1 : 0,
          iconPath: new vscode.ThemeIcon("server"),
          tooltip: `${String(projects.length)} project(s) in ${info.configPath}`,
          contextValue: "environment",
          facadeIndex: i,
        });
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
   * Get projects for a specific environment by facade index
   */
  private async getEnvironmentProjects(facadeIndex: number): Promise<TreeNode[]> {
    const facades = this.configSearch.getAllFacades();
    if (facadeIndex >= facades.length) {
      return [];
    }
    return this.getFacadeProjects(facades[facadeIndex]);
  }

  /**
   * Get projects for a specific environment
   */
  private async getFacadeProjects(facade: import("../services/dataFacade.js").ClaudeDataFacade): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      const projects = await facade.getProjects();

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        const projectName = this.getProjectName(project.path);

        // Project node
        const projectNode: TreeNode = {
          type: NodeType.PROJECT,
          label: projectName,
          path: project.path,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("folder"),
          tooltip: project.path,
          contextValue: "project",
        };

        nodes.push(projectNode);

        // Add Settings child node
        const hasSettings = project.state !== undefined && Object.keys(project.state).length > 0;
        if (hasSettings) {
          nodes.push({
            type: NodeType.SETTINGS,
            label: "Settings",
            collapsibleState: 1,
            iconPath: new vscode.ThemeIcon("gear"),
            tooltip: "Project settings",
            contextValue: "settings",
            facadeIndex: this.getFacadeIndex(facade),
            projectIndex: i,
          });
        }

        // Add CLAUDE.md child node
        nodes.push({
          type: NodeType.CLAUDE_MD,
          label: "CLAUDE.md",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("file-text"),
          tooltip: "Project context file",
          contextValue: "claudeMd",
          facadeIndex: this.getFacadeIndex(facade),
          projectIndex: i,
        });

        // Add MCP Servers child node
        const hasMcpServers = project.mcpServers !== undefined && Object.keys(project.mcpServers).length > 0;
        if (hasMcpServers) {
          const serverNames = project.mcpServers !== undefined ? Object.keys(project.mcpServers).join(", ") : "";
          nodes.push({
            type: NodeType.MCP_SERVERS,
            label: "MCP Servers",
            collapsibleState: 0,
            iconPath: new vscode.ThemeIcon("server"),
            tooltip: `MCP servers: ${serverNames}`,
            contextValue: "mcpServers",
            facadeIndex: this.getFacadeIndex(facade),
            projectIndex: i,
          });
        }
      }

      // If no projects, show empty message
      if (nodes.length === 0) {
        nodes.push({
          type: NodeType.ERROR,
          label: "(no projects found)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No projects found in this environment",
          contextValue: "empty",
        });
      }
    } catch (error) {
      nodes.push({
        type: NodeType.ERROR,
        label: "Error loading projects",
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
   * Get settings for a specific project
   */
  private async getProjectSettings(facadeIndex: number, projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      const facades = this.configSearch.getAllFacades();
      if (facadeIndex >= facades.length) {
        return [];
      }

      const facade = facades[facadeIndex];
      const projects = await facade.getProjects();

      if (projectIndex >= projects.length) {
        return [];
      }

      const project = projects[projectIndex];
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
  private async getProjectClaudeMd(facadeIndex: number, projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      const facades = this.configSearch.getAllFacades();
      if (facadeIndex >= facades.length) {
        return [];
      }

      const facade = facades[facadeIndex];
      const projectName = await this.getProjectNameFromIndex(facadeIndex, projectIndex);
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
  private async getProjectMcpServers(facadeIndex: number, projectIndex: number): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      const facades = this.configSearch.getAllFacades();
      if (facadeIndex >= facades.length) {
        return [];
      }

      const facade = facades[facadeIndex];
      const projects = await facade.getProjects();

      if (projectIndex >= projects.length) {
        return [];
      }

      const project = projects[projectIndex];
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
   * Get facade index by searching through all facades
   */
  private getFacadeIndex(facade: import("../services/dataFacade.js").ClaudeDataFacade): number {
    const facades = this.configSearch.getAllFacades();
    return facades.indexOf(facade);
  }

  /**
   * Get project name from project path
   */
  private getProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] || projectPath;
  }

  /**
   * Get project name from indices
   */
  private async getProjectNameFromIndex(facadeIndex: number, projectIndex: number): Promise<string> {
    try {
      const facades = this.configSearch.getAllFacades();
      if (facadeIndex >= facades.length) {
        return "unknown";
      }

      const facade = facades[facadeIndex];
      const projects = await facade.getProjects();

      if (projectIndex >= projects.length) {
        return "unknown";
      }

      return this.getProjectName(projects[projectIndex].path);
    } catch {
      return "unknown";
    }
  }

  /**
   * Get a display name for an environment
   */
  private getEnvironmentDisplayName(envType: import("../services/dataFacade.js").EnvironmentType, instanceName?: string): string {
    switch (envType) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "windows":
        return "Windows";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "wsl":
        return instanceName !== undefined && instanceName !== "" ? `WSL (${instanceName})` : "WSL";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "macos":
        return "macOS";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "linux":
        return "Linux";
      default:
        return "Unknown";
    }
  }
}
