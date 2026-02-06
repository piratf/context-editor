/**
 * TreeDataProvider for Global Claude configuration.
 * Displays .claude/ directory tree and .claude.json for the currently selected environment.
 *
 * New Architecture:
 * - Uses EnvironmentManager to get the current environment's data facade
 * - Shows global config for the current environment only
 * - Users switch environments via dropdown menu
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CollapsibleState } from "../types/claudeConfig.js";
import { EnvironmentManager } from "../services/environmentManager.js";

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
 * Shows global configuration files for all accessible environments.
 */
export class GlobalProvider implements vscode.TreeDataProvider<GlobalTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GlobalTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private environmentManager: EnvironmentManager;
  private rootNodes: GlobalTreeNode[] = [];
  private readonly debugOutput: vscode.OutputChannel;

  constructor(envManager: EnvironmentManager, debugOutput: vscode.OutputChannel) {
    this.environmentManager = envManager;
    this.debugOutput = debugOutput;
    void this.loadRootNodes();
  }

  /**
   * Refresh the tree view.
   */
  refresh(): void {
    this.debugOutput.appendLine("[GlobalProvider] refresh() called");
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
    // Skip resourceUri entirely to avoid triggering Git scanning and warnings
    const isClickable =
      element.type === GlobalNodeType.FILE || element.type === GlobalNodeType.CLAUDE_JSON;
    if (isClickable && element.path !== undefined) {
      treeItem.command = {
        command: "contextEditor.openFile",
        title: "Open File",
        arguments: [element.path],
      };
    }
    // Note: resourceUri removed to avoid Git scanning and warnings

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node is provided.
   */
  async getChildren(element?: GlobalTreeNode): Promise<GlobalTreeNode[]> {
    this.debugOutput.appendLine(
      `[GlobalProvider] getChildren called, element=${element === undefined ? "undefined (root level)" : element.label}`
    );

    // Return error node if loading failed
    if (this.rootNodes.length === 1 && this.rootNodes[0]?.type === GlobalNodeType.ERROR) {
      this.debugOutput.appendLine("[GlobalProvider] getChildren: returning error node");
      return this.rootNodes;
    }

    // No element = root level
    if (element === undefined) {
      this.debugOutput.appendLine(
        `[GlobalProvider] getChildren: returning ${String(this.rootNodes.length)} root nodes`
      );
      for (let i = 0; i < this.rootNodes.length; i++) {
        const node = this.rootNodes[i];
        this.debugOutput.appendLine(
          `[GlobalProvider]   root node ${String(i)}: type=${node.type}, label="${node.label}", collapsibleState=${String(node.collapsibleState)}`
        );
      }
      return this.rootNodes;
    }

    // Directory node children
    if (element.type === GlobalNodeType.DIRECTORY && element.path !== undefined) {
      this.debugOutput.appendLine(
        `[GlobalProvider] getChildren: getting directory children for path="${element.path}"`
      );
      return this.getDirectoryChildren(element.path);
    }

    this.debugOutput.appendLine(
      "[GlobalProvider] getChildren: no matching case, returning empty array"
    );
    return [];
  }

  /**
   * Load root level nodes - config file and directory from current environment
   */
  private async loadRootNodes(): Promise<void> {
    this.debugOutput.appendLine("[GlobalProvider] loadRootNodes() started");
    this.rootNodes = [];

    try {
      const facade = this.environmentManager.getCurrentFacade();

      if (facade === null) {
        this.debugOutput.appendLine(
          "[GlobalProvider] No current facade - creating 'No environment selected' node"
        );
        this.rootNodes.push({
          type: GlobalNodeType.ERROR,
          label: "No environment selected",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "Select an environment using the dropdown menu",
          contextValue: "empty",
        });
        return;
      }

      const info = facade.getEnvironmentInfo();
      this.debugOutput.appendLine(
        `[GlobalProvider] Current environment: type=${info.type}, configPath="${info.configPath}"`
      );

      // Check if config file exists
      this.debugOutput.appendLine("[GlobalProvider] Checking doesConfigExist...");
      const hasConfig = await this.doesConfigExist(facade);
      this.debugOutput.appendLine(`[GlobalProvider] hasConfig=${String(hasConfig)}`);

      // Add ~/.claude.json file
      if (hasConfig) {
        this.rootNodes.push({
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
        this.rootNodes.push({
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
      if (this.rootNodes.length === 0) {
        this.rootNodes.push({
          type: GlobalNodeType.ERROR,
          label: "(no configuration found)",
          collapsibleState: 0,
          iconPath: new vscode.ThemeIcon("info"),
          tooltip: "No ~/.claude.json or ~/.claude/ directory found",
          contextValue: "empty",
        });
      }

      this.debugOutput.appendLine(
        `[GlobalProvider] loadRootNodes() completed with ${String(this.rootNodes.length)} root nodes`
      );
    } catch (error) {
      this.debugOutput.appendLine(
        `[GlobalProvider] Error in loadRootNodes: ${error instanceof Error ? error.message : String(error)}`
      );
      this.debugOutput.appendLine(
        `[GlobalProvider] Error stack: ${error instanceof Error ? (error.stack ?? "no stack") : "no stack"}`
      );
      this.rootNodes = [
        {
          type: GlobalNodeType.ERROR,
          label: "Error loading configuration",
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
  private async doesConfigExist(
    facade: import("../services/dataFacade.js").ClaudeDataFacade
  ): Promise<boolean> {
    try {
      this.debugOutput.appendLine(
        "[GlobalProvider] doesConfigExist: calling getGlobalConfig('settings')..."
      );
      await facade.getGlobalConfig("settings");
      this.debugOutput.appendLine(
        "[GlobalProvider] doesConfigExist: getGlobalConfig succeeded, returning true"
      );
      return true;
    } catch (error) {
      this.debugOutput.appendLine(
        `[GlobalProvider] doesConfigExist: caught error - ${error instanceof Error ? error.message : String(error)}`
      );
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
}
