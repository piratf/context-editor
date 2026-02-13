/**
 * Abstract base class for tree data providers.
 * Provides common functionality for all view providers.
 *
 * Architecture:
 * - Uses NodeData for pure data representation
 * - Uses TreeItemFactory for TreeItem conversion
 * - Uses NodeService from DI container for business logic
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { NodeType } from "../types/nodeData.js";
import { NodeDataFactory } from "../types/nodeData.js";
import { Logger } from "../utils/logger.js";
import type { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { DIContainer } from "../di/container.js";

/**
 * Node type for TreeDataProvider
 * Uses pure NodeData interface
 */
export type TreeNode = NodeData;

/**
 * Abstract base class for tree data providers
 * Handles common TreeDataProvider boilerplate and error handling
 */
export abstract class BaseProvider implements vscode.TreeDataProvider<TreeNode> {
  protected readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    protected readonly logger: Logger,
    protected readonly container: DIContainer,
    protected readonly treeItemFactory: TreeItemFactory
  ) {}

  /**
   * Refresh the tree view - reloads root nodes and fires change event
   */
  refresh(): void {
    this.logger.logEntry("refresh");
    this._onDidChangeTreeData.fire(undefined);
    this.logger.logExit("refresh");
  }

  /**
   * Get the tree item for a given node
   *
   * Converts NodeData to vscode.TreeItem using TreeItemFactory
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    const treeItem = this.treeItemFactory.createTreeItem(element);
    this.setNodeCommand(treeItem, element);

    // Debug: log contextValue to verify menu markers
    const contextValueStr = treeItem.contextValue ?? "";
    this.logger.debug(
      `[Menu Debug] Node: "${element.label}" (${element.type}), contextValue: "${contextValueStr}"`
    );

    return treeItem;
  }

  abstract getChildren(): Promise<TreeNode[]>;

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
   * Create an info node with standardized format
   */
  protected createInfoNode(label: string, tooltip: string, contextValue = "empty"): TreeNode {
    // Create as NodeData (new architecture)
    return NodeDataFactory.createInfo(label, {
      tooltip,
      contextValue,
      iconId: "info",
    });
  }
}
