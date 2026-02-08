/**
 * Abstract base class for tree data providers.
 * Provides common functionality for all view providers.
 */

import * as vscode from "vscode";
import type { TreeNode } from "../types/treeNode.js";
import { NodeType } from "../types/treeNode.js";
import { Logger } from "../utils/logger.js";
import { NodeFactory } from "../types/nodeClasses.js";

/**
 * Abstract base class for tree data providers
 * Handles common TreeDataProvider boilerplate and error handling
 */
export abstract class BaseProvider implements vscode.TreeDataProvider<TreeNode> {
  protected readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  protected readonly logger: Logger;
  protected rootNodes: TreeNode[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Refresh the tree view - reloads root nodes and fires change event
   */
  refresh(): void {
    this.logger.logEntry("refresh");
    this.loadRootNodes();
    this._onDidChangeTreeData.fire(undefined);
    this.logger.logExit("refresh");
  }

  /**
   * Get the tree item for a given node
   * Since NodeBase extends vscode.TreeItem, we can return it directly
   * For plain TreeNode objects (not NodeBase), we create a new TreeItem
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    // Check if element is already a TreeItem (i.e., a NodeBase instance)
    // NodeBase extends vscode.TreeItem, so we can return it directly
    if ('resourceUri' in element) {
      // This is a vscode.TreeItem (NodeBase), return it directly
      const treeItem = element as vscode.TreeItem;
      // Set command for clickable nodes (only if not already set)
      if (treeItem.command === undefined) {
        this.setNodeCommand(treeItem, element);
      }
      return treeItem;
    }

    // For plain TreeNode objects, create a new TreeItem (backward compatibility)
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

    // Set command for clickable nodes
    this.setNodeCommand(treeItem, element);

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node provided
   * Since NodeBase extends TreeItem and implements TreeNode, we need to handle both types
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    this.logger.debug("getChildren called", {
      element: element === undefined ? "root" : `"${element.label}" (${element.type})`,
    });

    // Return error node if loading failed
    if (this.rootNodes.length === 1 && this.rootNodes[0]?.type === NodeType.ERROR) {
      return this.rootNodes;
    }

    // No element = root level
    if (element === undefined) {
      this.logger.debug(`Returning ${String(this.rootNodes.length)} root nodes`);
      return this.rootNodes;
    }

    // Use NodeBase classes for OOP approach to get children
    const node = NodeFactory.create(element, this.getNodeOptions(element));
    const children = await node.getChildren();
    this.logger.logChildrenRetrieved(element.label, children.length);
    // NodeBase extends TreeItem, but TreeDataProvider expects TreeNode
    // Cast since NodeBase implements all TreeNode properties
    return children as unknown as TreeNode[];
  }

  /**
   * Get options for node creation - can be overridden by subclass
   */
  protected getNodeOptions(_element: TreeNode): {
    isInsideClaudeDir?: boolean;
    filterClaudeFiles?: boolean;
  } {
    return {};
  }

  /**
   * Load root level nodes - must be implemented by subclass
   */
  protected abstract loadRootNodes(): void;

  /**
   * Set command for clickable nodes - can be overridden by subclass
   */
  protected setNodeCommand(treeItem: vscode.TreeItem, element: TreeNode): void {
    const isClickable = element.type === NodeType.FILE || element.type === NodeType.CLAUDE_JSON;
    if (isClickable && element.path !== undefined) {
      treeItem.command = {
        command: "contextEditor.openFile",
        title: "Open File",
        arguments: [element.path],
      };
    }
  }

  /**
   * Create an error node with standardized format
   */
  protected createErrorNode(
    label: string,
    tooltip: string,
    error?: Error
  ): TreeNode {
    this.logger.error(label, error);
    return {
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("error"),
      tooltip,
      contextValue: "error",
      error,
    } as TreeNode;
  }

  /**
   * Create an info node with standardized format
   */
  protected createInfoNode(
    label: string,
    tooltip: string,
    contextValue = "empty"
  ): TreeNode {
    return {
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("info"),
      tooltip,
      contextValue,
    };
  }

  /**
   * Create an empty directory node
   */
  protected createEmptyNode(isInsideClaudeDir = false): TreeNode {
    const label = isInsideClaudeDir ? "(empty)" : "(no Claude files)";
    const tooltip = isInsideClaudeDir
      ? "This directory is empty"
      : "No .claude directory or CLAUDE.md file found";
    return this.createInfoNode(label, tooltip, "empty");
  }
}
