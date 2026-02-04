/**
 * TreeDataProvider for Global Claude configuration.
 * Displays .claude/ directory tree and .claude.json for all accessible environments.
 *
 * New Architecture:
 * - Uses ConfigSearch to get data facades for all environments
 * - Shows global config for each environment in separate tree nodes
 * - Supports both native and cross-environment configurations
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import { ConfigSearch } from "../services/configSearch.js";

/**
 * Tree node types for global view with multi-environment support.
 */
export enum GlobalNodeType {
  ROOT = "root",
  ENVIRONMENT = "environment",
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
  readonly facadeIndex?: number; // Index into configSearch facades array
}

/**
 * Tree data provider for Global Persona view.
 * Shows global configuration files for all accessible environments.
 */
export class GlobalProvider implements vscode.TreeDataProvider<GlobalTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GlobalTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private configSearch: ConfigSearch;
  private rootNodes: GlobalTreeNode[] = [];

   
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

    // Assign openFile command to FILE and CLAUDE_JSON nodes
    const isClickable =
      element.type === GlobalNodeType.FILE || element.type === GlobalNodeType.CLAUDE_JSON;
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
  async getChildren(element?: GlobalTreeNode): Promise<GlobalTreeNode[]> {
    // Return error node if loading failed
    if (this.rootNodes.length === 1 && this.rootNodes[0]?.type === GlobalNodeType.ERROR) {
      return this.rootNodes;
    }

    // No element = root level
    if (element === undefined) {
      return this.rootNodes;
    }

    // Environment node children
    if (element.type === GlobalNodeType.ENVIRONMENT && element.facadeIndex !== undefined) {
      return this.getEnvironmentChildren(element.facadeIndex);
    }

    // Directory node children
    if (element.type === GlobalNodeType.DIRECTORY && element.path !== undefined) {
      return this.getDirectoryChildren(element.path);
    }

    return [];
  }

  /**
   * Load root level nodes - one per accessible environment
   */
  private async loadRootNodes(): Promise<void> {
    this.rootNodes = [];

    try {
      const facades = this.configSearch.getAllFacades();

      if (facades.length === 0) {
        this.rootNodes.push({
          type: GlobalNodeType.ERROR,
          label: "No environments found",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No accessible Claude configuration found",
          contextValue: "empty",
        });
        return;
      }

      // Create a node for each environment
      for (let i = 0; i < facades.length; i++) {
        const facade = facades[i];
        const info = facade.getEnvironmentInfo();

        // Determine display name
        const displayName = this.getEnvironmentDisplayName(info.type, info.instanceName);

        // Check if config file exists
        const hasConfig = await this.doesConfigExist(facade);

        this.rootNodes.push({
          type: GlobalNodeType.ENVIRONMENT,
          label: displayName,
          collapsibleState: hasConfig ? 1 : 0,
          iconPath: new vscode.ThemeIcon("server"),
          tooltip: info.configPath,
          contextValue: "environment",
          facadeIndex: i,
        });
      }
    } catch (error) {
      this.rootNodes = [{
        type: GlobalNodeType.ERROR,
        label: "Error loading environments",
        collapsibleState: 0,
        iconPath: new vscode.ThemeIcon("error"),
        tooltip: error instanceof Error ? error.message : String(error),
        contextValue: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      }];
    }
  }

  /**
   * Get children for an environment node
   */
  private async getEnvironmentChildren(facadeIndex: number): Promise<GlobalTreeNode[]> {
    const children: GlobalTreeNode[] = [];
    const facades = this.configSearch.getAllFacades();

    if (facadeIndex >= facades.length) {
      return [];
    }

    const facade = facades[facadeIndex];
    const info = facade.getEnvironmentInfo();

    try {
      // Add ~/.claude.json file
      const hasConfig = await this.doesConfigExist(facade);
      if (hasConfig) {
        children.push({
          type: GlobalNodeType.CLAUDE_JSON,
          label: "~/.claude.json",
          path: info.configPath,
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("settings-gear"),
          tooltip: info.configPath,
          contextValue: "claudeJson",
        });
      }

      // Add ~/.claude/ directory
      const claudeDir = this.deriveClaudeDir(info.configPath);
      const hasClaudeDir = await this.directoryExists(claudeDir);
      if (hasClaudeDir) {
        children.push({
          type: GlobalNodeType.DIRECTORY,
          label: "~/.claude/",
          path: claudeDir,
          collapsibleState: 1, // Collapsed
          iconPath: new vscode.ThemeIcon("folder"),
          tooltip: claudeDir,
          contextValue: "directory",
        });
      }

      // If nothing found, show empty message
      if (children.length === 0) {
        children.push({
          type: GlobalNodeType.ERROR,
          label: "(no configuration found)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No ~/.claude.json or ~/.claude/ directory found",
          contextValue: "empty",
        });
      }
    } catch (error) {
      children.push({
        type: GlobalNodeType.ERROR,
        label: "Error loading configuration",
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
   * Get children for a directory node
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
   * Derive the .claude directory path from the config file path
   */
  private deriveClaudeDir(configPath: string): string {
    const dir = path.dirname(configPath);
    return path.join(dir, ".claude");
  }

  /**
   * Check if the config file exists for a given facade
   */
  private async doesConfigExist(facade: import("../services/dataFacade.js").ClaudeDataFacade): Promise<boolean> {
    try {
      await facade.getGlobalConfig('settings');
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
