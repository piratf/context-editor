/**
 * TreeItemFactory - Adapter for converting NodeData to vscode.TreeItem
 *
 * This adapter handles all VS Code UI object creation, isolating
 * VS Code dependencies from the domain logic.
 *
 * Architecture:
 * - Adapter layer: Converts pure data to VS Code UI objects
 * - Domain layer (NodeData) has no vscode dependency
 * - This factory bridges the gap
 *
 * NEW: Context value is generated dynamically by ContextMenuRegistry
 * - No static configuration of menu markers
 * - Menu visibility is determined by command canExecute() methods
 * - Duck typing: contextValue is space-separated context keys
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import type { CollapsibleState } from "../types/nodeData.js";
import type { ContextMenuRegistry } from "./contextMenuRegistry.js";

/**
 * Convert CollapsibleState to vscode.TreeItemCollapsibleState
 */
function toVscodeCollapsibleState(state: CollapsibleState): vscode.TreeItemCollapsibleState {
  switch (state) {
    case 0:
      return vscode.TreeItemCollapsibleState.None;
    case 1:
      return vscode.TreeItemCollapsibleState.Collapsed;
    case 2:
      return vscode.TreeItemCollapsibleState.Expanded;
    default:
      return vscode.TreeItemCollapsibleState.None;
  }
}

/**
 * Factory for creating vscode.TreeItem from NodeData
 *
 * Context value generation is delegated to ContextMenuRegistry,
 * which uses duck typing to build dynamic menu markers.
 */
export class TreeItemFactory {
  constructor(private readonly menuRegistry: ContextMenuRegistry) {}

  /**
   * Create a vscode.TreeItem from NodeData
   *
   * Context value is generated dynamically by checking all commands'
   * canExecute() methods. No static configuration needed.
   *
   * @param data - Node data to convert
   * @returns vscode.TreeItem ready for TreeDataProvider
   */
  createTreeItem(data: NodeData): vscode.TreeItem {
    // Build context value by checking all commands (duck typing)
    const contextValue = this.menuRegistry.buildContextValue(data);

    // Debug: log context value construction
    console.log(`[TreeItemFactory] Node: "${data.label}" (${data.type}), ` +
      `contextValue: "${contextValue}"`);

    // Create TreeItem
    const item = new vscode.TreeItem(data.label, toVscodeCollapsibleState(data.collapsibleState));

    // Set id for tree item identification
    item.id = data.id;

    // Set context value for menu visibility (duck typing, space-separated)
    item.contextValue = contextValue;

    // Set icon
    if (data.iconId !== undefined) {
      item.iconPath = new vscode.ThemeIcon(data.iconId);
    }

    // Set tooltip
    if (data.tooltip !== undefined) {
      item.tooltip = data.tooltip;
    }

    return item;
  }

  /**
   * Create TreeItem for command handling
   *
   * When nodes are passed to commands, they need the proper context value
   * set for menu item visibility. This method ensures the context value
   * is properly generated.
   *
   * @param data - Node data
   * @returns vscode.TreeItem with proper menu context
   */
  createForCommand(data: NodeData): vscode.TreeItem {
    return this.createTreeItem(data);
  }
}
