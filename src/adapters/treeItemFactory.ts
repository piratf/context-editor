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
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { NodeType, isDirectoryData } from "../types/nodeData.js";
import type { CollapsibleState } from "../types/nodeData.js";

/**
 * Context value markers for menu visibility
 *
 * These are appended to contextValue strings for VS Code menu filtering.
 * Multiple markers are combined with '+' separator.
 *
 * Examples:
 * - "directory+copyable+deletable+openableInVscode"
 * - "file+copyable+deletable"
 * - "claudeJson+copyable+deletable"
 */
export const CONTEXT_MARKERS = {
  COPYABLE: "copyable",
  DELETABLE: "deletable",
  OPENABLE_IN_VSCODE: "openableInVscode",
} as const;

/**
 * Build contextValue string from base type and markers
 *
 * The contextValue is used by VS Code's when clauses to determine menu visibility.
 * Format: "{baseType}+{marker1}+{marker2}+..."
 *
 * @param baseType - The base node type (e.g., "directory", "file")
 * @param markers - Array of markers to append
 * @returns Combined contextValue string
 */
export function buildContextValue(baseType: string, markers: readonly string[]): string {
  const parts = [baseType, ...markers].filter(Boolean);
  return parts.join("+");
}

/**
 * Menu interface configuration for node types
 */
interface MenuConfig {
  readonly copyable?: boolean;
  readonly deletable?: boolean;
  readonly openableInVscode?: boolean;
}

/**
 * Default menu configurations by node type
 */
const DEFAULT_MENU_CONFIG: Record<NodeType, MenuConfig> = {
  [NodeType.ROOT]: {
    copyable: false,
    deletable: false,
    openableInVscode: false,
  },
  [NodeType.DIRECTORY]: {
    copyable: true,
    deletable: true,
    openableInVscode: true,
  },
  [NodeType.FILE]: {
    copyable: true,
    deletable: true,
    openableInVscode: false,
  },
  [NodeType.CLAUDE_JSON]: {
    copyable: true,
    deletable: true,
    openableInVscode: false,
  },
  [NodeType.ERROR]: {
    copyable: false,
    deletable: false,
    openableInVscode: false,
  },
};

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
 * Get menu configuration for a node type
 */
function getMenuConfig(type: NodeType): MenuConfig {
  return DEFAULT_MENU_CONFIG[type] ?? {};
}

/**
 * Build context value with menu interface markers
 */
function buildContextWithMenuMarkers(
  baseContextValue: string,
  menuConfig: MenuConfig
): string {
  const markers: string[] = [];

  if (menuConfig.copyable) {
    markers.push(CONTEXT_MARKERS.COPYABLE);
  }
  if (menuConfig.deletable) {
    markers.push(CONTEXT_MARKERS.DELETABLE);
  }
  if (menuConfig.openableInVscode) {
    markers.push(CONTEXT_MARKERS.OPENABLE_IN_VSCODE);
  }

  return buildContextValue(baseContextValue, markers);
}

/**
 * Factory for creating vscode.TreeItem from NodeData
 *
 * This factory handles:
 * - Converting NodeData to TreeItem
 * - Adding appropriate icons
 * - Setting context values with menu markers
 * - Configuring collapsible state
 */
export class TreeItemFactory {
  /**
   * Create a vscode.TreeItem from NodeData
   *
   * @param data - Node data to convert
   * @param options - Optional configuration
   * @returns vscode.TreeItem ready for TreeDataProvider
   */
  createTreeItem(
    data: NodeData,
    options: {
      /** Override default menu configuration */
      readonly menuConfig?: MenuConfig;
      /** Additional context value to append */
      readonly additionalContext?: string;
    } = {}
  ): vscode.TreeItem {
    const { menuConfig, additionalContext } = options;

    // Get menu config for node type
    const defaultMenuConfig = getMenuConfig(data.type);
    const finalMenuConfig = menuConfig ?? defaultMenuConfig;

    // Build context value with menu markers
    const baseContextValue = data.contextValue ?? data.type;
    const contextValue = buildContextWithMenuMarkers(baseContextValue, finalMenuConfig);

    // Create TreeItem
    const item = new vscode.TreeItem(data.label, toVscodeCollapsibleState(data.collapsibleState));

    // Set id for tree item identification
    item.id = data.id;

    // Set context value for menu visibility
    item.contextValue = contextValue;

    // Set icon
    if (data.iconId) {
      item.iconPath = new vscode.ThemeIcon(data.iconId);
    }

    // Set tooltip
    if (data.tooltip) {
      item.tooltip = data.tooltip;
    }

    // Set description (optional, for additional info)
    // item.description = "...";

    // For directories, set command to expand on click
    if (isDirectoryData(data)) {
      // Directory nodes are expandable, no command needed
    }

    // Add additional context if provided
    if (additionalContext) {
      item.contextValue = `${item.contextValue}+${additionalContext}`;
    }

    return item;
  }

  /**
   * Create TreeItem with menu configuration for command handling
   *
   * When nodes are passed to commands, they need the proper context value
   * set for menu item visibility. This method ensures the context value
   * includes all necessary menu markers.
   *
   * @param data - Node data
   * @returns vscode.TreeItem with proper menu context
   */
  createForCommand(data: NodeData): vscode.TreeItem {
    return this.createTreeItem(data);
  }
}

/**
 * Helper to get base type from context value
 *
 * Extracts the base node type from a context value string
 * that may include menu markers (e.g., "directory+copyable+deletable" → "directory")
 */
export function getBaseTypeFromContext(contextValue: string): string {
  const parts = contextValue.split("+");
  return parts[0] ?? contextValue;
}

/**
 * Helper to check if context value has a menu marker
 */
export function hasContextMarker(contextValue: string | undefined, marker: string): boolean {
  if (!contextValue) {
    return false;
  }
  const pattern = new RegExp(`\\+${marker}($|\\+)`);
  return pattern.test(contextValue);
}

/**
 * Factory instance
 */
export const treeItemFactory = new TreeItemFactory();
