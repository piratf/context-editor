/**
 * ClaudeCodeRootNodeService - Root node service for Claude Code Context Editor
 *
 * This service handles the creation and children retrieval for root nodes:
 * - "Global Configuration" node (USER_ROOT)
 * - "Projects" node (PROJECTS_ROOT)
 *
 * Architecture:
 * - Service layer: Contains business logic for root nodes
 * - Depends on IEnvironmentManagerService and ILoggerService (via DI)
 * - No VS Code types dependency (fully testable)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

import type { ILoggerService } from "./loggerService.js";
import type { IDataFacade, IEnvironmentManagerService } from "./environmentManagerService.js";
import { type NodeData, NodeDataFactory, NodeType } from "../types/nodeData.js";
import { RootNodeService } from "./rootNodeService.js";
import { EMPTY_CHILDREN_RESULT, GetChildrenResult } from "./nodeService";

/**
 * Service for managing Claude Code root nodes
 *
 * Responsibilities:
 * - Create root nodes (Global Configuration, Projects)
 * - Get children for root nodes
 * - Helper methods for file system operations
 */
export class ClaudeCodeRootNodeService implements RootNodeService {
  constructor(
    private readonly environmentManager: IEnvironmentManagerService,
    private readonly logger: ILoggerService
  ) {
    this.logger.logEntry("constructor");
  }

  /**
   * Create root level nodes
   *
   * Returns exactly 2 nodes: "Global Configuration" and "Projects"
   * when a facade is available, or 1 node "No environment selected"
   */
  createRootNodes(): readonly NodeData[] {
    const facade = this.environmentManager.getCurrentFacade();

    if (facade === null) {
      this.logger.debug("No facade available");
      return [this.createNoEnvironmentNode()];
    }

    const info = facade.getEnvironmentInfo();
    this.logger.debug("Current environment", { type: info.type, configPath: info.configPath });

    return [this.createGlobalConfigNode(), this.createProjectsNode()];
  }

  /**
   * Get children for a root node
   *
   * Handles both USER_ROOT and PROJECTS_ROOT node types
   */
  async getRootNodeChildren(node: NodeData): Promise<GetChildrenResult> {
    this.logger.logEntry("getRootNodeChildren", { nodeLabel: node.label });

    const facade = this.environmentManager.getCurrentFacade();

    if (facade === null) {
      this.logger.debug("No facade available");
      return { success: true, children: [this.createNoEnvironmentNode()] };
    }

    if (node.type === NodeType.USER_ROOT) {
      return this.getGlobalConfigChildren(facade);
    }

    if (node.type === NodeType.PROJECTS_ROOT) {
      return this.getProjectsChildren(facade);
    }

    this.logger.warn("Unknown root node type", { type: node.type });
    return EMPTY_CHILDREN_RESULT;
  }

  /**
   * Get children for Global Configuration node
   */
  private async getGlobalConfigChildren(facade: IDataFacade): Promise<GetChildrenResult> {
    this.logger.debug("getGlobalConfigChildren called");

    const children: NodeData[] = [];
    const hasConfig = await this.doesConfigExist(facade);

    // Add ~/.claude.json file
    if (hasConfig) {
      const info = facade.getEnvironmentInfo();
      children.push(
        NodeDataFactory.createClaudeJson("~/.claude.json", info.configPath, {
          tooltip: info.configPath,
        })
      );
    }

    // Add ~/.claude/ directory
    const claudeDir = this.deriveClaudeDir(facade);
    const hasClaudeDir = await this.directoryExists(claudeDir);
    if (hasClaudeDir) {
      children.push(
        NodeDataFactory.createDirectory("~/.claude", claudeDir, {
          collapsibleState: 1,
          tooltip: claudeDir,
        })
      );
    }

    // If nothing found, show empty message
    if (children.length === 0) {
      children.push(
        this.createInfoNode(
          "(no configuration found)",
          "No ~/.claude.json or ~/.claude/ directory found"
        )
      );
    }

    this.logger.debug(`getGlobalConfigChildren: returning ${String(children.length)} children`);
    return { success: true, children };
  }

  /**
   * Get children for Projects node
   */
  private async getProjectsChildren(facade: IDataFacade): Promise<GetChildrenResult> {
    this.logger.debug("getProjectsChildren called");

    const children: NodeData[] = [];
    const info = facade.getEnvironmentInfo();
    this.logger.debug("Current facade for projects", {
      type: info.type,
      configPath: info.configPath,
    });

    // Get projects for current environment
    const projects = await facade.getProjects();

    this.logger.debug(`Found ${String(projects.length)} projects`);

    if (projects.length === 0) {
      children.push(
        this.createInfoNode("(no projects found)", "No projects found in this environment")
      );
    } else {
      // Create directory nodes for each project
      // Project directories are REAL file system nodes - they have paths and can be opened
      for (const project of projects) {
        const projectName = this.getProjectName(project.path);
        this.logger.debug(`Adding project: ${projectName}`, { path: project.path });
        children.push(
          NodeDataFactory.createDirectory(projectName, project.path, {
            collapsibleState: 1,
            tooltip: project.path,
          })
        );
      }
    }

    this.logger.debug(`getProjectsChildren: returning ${String(children.length)} children`);
    return { success: true, children };
  }

  /**
   * Create the "No environment" node
   */
  private createNoEnvironmentNode(): NodeData {
    return NodeDataFactory.createInfo("No environment selected", {
      tooltip: "Select an environment using the dropdown menu",
    });
  }

  /**
   * Create the Global Configuration root node
   */
  private createGlobalConfigNode(): NodeData {
    return NodeDataFactory.createVirtualNode("Global Configuration", NodeType.USER_ROOT, {
      collapsibleState: 1,
      tooltip: "Global Claude configuration files",
    });
  }

  /**
   * Create the Projects root node
   */
  private createProjectsNode(): NodeData {
    return NodeDataFactory.createVirtualNode("Projects", NodeType.PROJECTS_ROOT, {
      collapsibleState: 1,
      tooltip: "Registered Claude projects",
    });
  }

  /**
   * Derive the .claude directory path from the config file path
   */
  private deriveClaudeDir(facade: IDataFacade): string {
    const info = facade.getEnvironmentInfo();
    const dir = path.dirname(info.configPath);
    return path.join(dir, ".claude");
  }

  /**
   * Check if the config file exists for a given facade
   */
  private async doesConfigExist(facade: IDataFacade): Promise<boolean> {
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
  
  /**
   * Create an info node
   */
  private createInfoNode(label: string, tooltip: string): NodeData {
    this.logger.debug(label, { tooltip });
    return NodeDataFactory.createInfo(label, {
      tooltip,
      iconId: "info",
    });
  }
}
