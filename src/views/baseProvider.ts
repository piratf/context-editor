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
import { NodeType, NodeTypeGuard } from "../types/nodeData.js";
import { NodeDataFactory } from "../types/nodeData.js";
import { Logger } from "../utils/logger.js";
import type { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { DIContainer } from "../di/container.js";
import { ServiceTokens } from "../di/tokens.js";

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

  protected readonly logger: Logger;
  protected rootNodes: TreeNode[] = [];

  constructor(
    logger: Logger,
    protected readonly container: DIContainer,
    protected readonly treeItemFactory: TreeItemFactory
  ) {
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
   *
   * Converts NodeData to vscode.TreeItem using TreeItemFactory
   */
  getTreeItem(element: TreeNode): vscode.TreeItem {
    const treeItem = this.treeItemFactory.createTreeItem(element);
    this.setNodeCommand(treeItem, element);

    // Debug: log contextValue to verify menu markers
    const contextValueStr = treeItem.contextValue ?? "";
    this.logger.debug(
      `[Menu Debug] Node: "${element.label}" (${String(element.type)}), contextValue: "${contextValueStr}"`
    );

    return treeItem;
  }

  /**
   * Get children of a given node, or root nodes if no node provided
   *
   * Uses NodeService from DI container to get children for directory nodes
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    this.logger.debug("getChildren called", {
      element: element === undefined ? "root" : `"${element.label}" (${String(element.type)})`,
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

    // Only VIRTUAL, PROJECT, and DIRECTORY nodes can have children
    if (
      !NodeTypeGuard.isVirtual(element.type) &&
      !NodeTypeGuard.isProject(element.type) &&
      !NodeTypeGuard.isDirectory(element.type)
    ) {
      return [];
    }

    // Get NodeService from DI container (already configured)
    const nodeService = this.container.get(ServiceTokens.NodeService);
    const result = await nodeService.getChildrenForDirectoryNode(element);

    if (result.success) {
      this.logger.logChildrenRetrieved(element.label, result.children.length);
      return [...result.children];
    } else {
      this.logger.error("Error getting children", new Error(result.error.tooltip));
      return [result.error];
    }
  }

  /**
   * Load root level nodes - must be implemented by subclass
   */
  protected abstract loadRootNodes(): void;

  /**
   * Set command for clickable nodes - can be overridden by subclass
   */
  protected setNodeCommand(treeItem: vscode.TreeItem, element: TreeNode): void {
    const isClickable = NodeTypeGuard.isFile(element.type);
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
  protected createErrorNode(label: string, tooltip: string, error?: Error): TreeNode {
    this.logger.error(label, error);

    // Create as NodeData (new architecture)
    return NodeDataFactory.createError(label, {
      tooltip,
      contextValue: "error",
      error,
    });
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
