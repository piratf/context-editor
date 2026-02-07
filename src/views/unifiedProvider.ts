/**
 * Unified TreeDataProvider for Context Editor.
 * Combines Global and Projects views into a single view with two top-level nodes.
 *
 * Root structure:
 * - Global Configuration (shows ~/.claude.json and ~/.claude/ directory)
 * - Projects (shows all registered Claude projects)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { BaseProvider } from "./baseProvider.js";
import { TreeNodeFactory, NodeType, type TreeNode } from "../types/treeNode.js";
import { EnvironmentManager } from "../services/environmentManager.js";
import { Logger } from "../utils/logger.js";

/**
 * Root node type for unified view
 */
enum RootNodeType {
  GLOBAL = "global",
  PROJECTS = "projects",
}

/**
 * Unified provider that shows both Global and Projects in a single view
 */
export class UnifiedProvider extends BaseProvider {
  private readonly environmentManager: EnvironmentManager;

  constructor(environmentManager: EnvironmentManager, logger: Logger) {
    super(logger);
    this.environmentManager = environmentManager;
    this.loadRootNodes();
  }

  /**
   * Load root level nodes - exactly 2 nodes: Global Configuration and Projects
   */
  protected loadRootNodes(): void {
    this.logger.logEntry("loadRootNodes");
    this.rootNodes = [];

    try {
      const facade = this.environmentManager.getCurrentFacade();

      if (facade === null) {
        this.rootNodes.push(this.createInfoNode("No environment selected", "Select an environment using the dropdown menu"));
        return;
      }

      const info = facade.getEnvironmentInfo();
      this.logger.debug("Current environment", { type: info.type, configPath: info.configPath } as Record<string, unknown>);

      // Create Global Configuration root node
      this.rootNodes.push(
        TreeNodeFactory.createDirectory("Global Configuration", "", {
          collapsibleState: 1, // Collapsed by default
          tooltip: "Global Claude configuration files",
          contextValue: RootNodeType.GLOBAL,
          iconId: "settings-gear",
        })
      );

      // Create Projects root node
      this.rootNodes.push(
        TreeNodeFactory.createDirectory("Projects", "", {
          collapsibleState: 1, // Collapsed by default
          tooltip: "Registered Claude projects",
          contextValue: RootNodeType.PROJECTS,
          iconId: "folder-library",
        })
      );

      this.logger.debug(`Loaded ${String(this.rootNodes.length)} root nodes`);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Error loading root nodes", errorObj);
      this.rootNodes = [this.createErrorNode("Error loading view", errorObj.message, errorObj)];
    }

    this.logger.logExit("loadRootNodes", { nodeCount: this.rootNodes.length });
  }

  /**
   * Get options for node creation based on node type
   */
  protected getNodeOptions(element: TreeNode): {
    isInsideClaudeDir?: boolean;
    filterClaudeFiles?: boolean;
  } {
    // For project root nodes, enable Claude file filtering
    if (element.contextValue === RootNodeType.PROJECTS) {
      return { filterClaudeFiles: true };
    }
    return {} as Record<string, never>;
  }

  /**
   * Override getChildren to handle root nodes specially
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    this.logger.debug("getChildren called", {
      element: element === undefined ? "root" : `"${element.label}" (${String(element.contextValue)})`,
    });

    // Return error node if loading failed
    if (this.rootNodes.length === 1 && this.rootNodes[0]?.type === NodeType.ERROR) {
      return this.rootNodes;
    }

    // No element = root level (show the two main nodes)
    if (element === undefined) {
      this.logger.debug(`Returning ${String(this.rootNodes.length)} root nodes`);
      return this.rootNodes;
    }

    // Handle root node children - load actual content
    if (element.contextValue === RootNodeType.GLOBAL) {
      return this.getGlobalChildren();
    }

    if (element.contextValue === RootNodeType.PROJECTS) {
      return this.getProjectsChildren();
    }

    // For other nodes, use the base class implementation
    return super.getChildren(element);
  }

  /**
   * Get children for Global Configuration node
   */
  private async getGlobalChildren(): Promise<TreeNode[]> {
    this.logger.debug("getGlobalChildren called");
    const children: TreeNode[] = [];

    try {
      const facade = this.environmentManager.getCurrentFacade();

      if (facade === null) {
        return [this.createInfoNode("No environment selected", "Select an environment")];
      }

      const info = facade.getEnvironmentInfo();

      // Check if config file exists
      const hasConfig = await this.doesConfigExist(facade);

      // Add ~/.claude.json file
      if (hasConfig) {
        children.push(
          TreeNodeFactory.createClaudeJson("~/.claude.json", info.configPath, {
            tooltip: info.configPath,
          })
        );
      }

      // Add ~/.claude/ directory
      const claudeDir = this.deriveClaudeDir(info.configPath);
      const hasClaudeDir = await this.directoryExists(claudeDir);
      if (hasClaudeDir) {
        children.push(
          TreeNodeFactory.createDirectory("~/.claude", claudeDir, {
            collapsibleState: 1,
            tooltip: claudeDir,
          })
        );
      }

      // If nothing found, show empty message
      if (children.length === 0) {
        children.push(
          this.createInfoNode("(no configuration found)", "No ~/.claude.json or ~/.claude/ directory found")
        );
      }

      this.logger.debug(`getGlobalChildren: returning ${String(children.length)} children`);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Error in getGlobalChildren", errorObj);
      children.push(
        this.createErrorNode("Error loading configuration", errorObj.message, errorObj)
      );
    }

    return children;
  }

  /**
   * Get children for Projects node
   */
  private async getProjectsChildren(): Promise<TreeNode[]> {
    this.logger.debug("getProjectsChildren called");
    const children: TreeNode[] = [];

    try {
      const facade = this.environmentManager.getCurrentFacade();

      if (facade === null) {
        return [this.createInfoNode("No environment selected", "Select an environment")];
      }

      const info = facade.getEnvironmentInfo();
      this.logger.debug("Current facade for projects", { type: info.type, configPath: info.configPath });

      // Get projects for current environment
      const projects = await facade.getProjects();

      this.logger.debug(`Found ${String(projects.length)} projects`);

      if (projects.length === 0) {
        children.push(this.createInfoNode("(no projects found)", "No projects found in this environment"));
        return children;
      }

      // Create directory nodes for each project
      for (const project of projects) {
        const projectName = this.getProjectName(project.path);
        this.logger.debug(`Adding project: ${projectName}`, { path: project.path });

        children.push(
          TreeNodeFactory.createDirectory(projectName, project.path, {
            collapsibleState: 1,
            tooltip: project.path,
            contextValue: "project",
          })
        );
      }

      this.logger.debug(`getProjectsChildren: returning ${String(children.length)} children`);
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error("Error in getProjectsChildren", errorObj);
      children.push(
        this.createErrorNode("Error loading projects", errorObj.message, errorObj)
      );
    }

    return children;
  }

  /**
   * Derive the .claude directory path from the config file path
   */
  private deriveClaudeDir(configPath: string): string {
    const dir = path.dirname(configPath);
    return path.join(dir, ".claude");
  }

  /**
   * Check if the config file exists for a given facade
   */
  private async doesConfigExist(
    facade: import("../services/dataFacade.js").ClaudeDataFacade
  ): Promise<boolean> {
    try {
      await facade.getGlobalConfig("settings");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get project name from project path
   */
  private getProjectName(projectPath: string): string {
    const parts = projectPath.split(/[/\\]/);
    return parts[parts.length - 1] ?? projectPath;
  }
}
