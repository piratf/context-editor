/**
 * Export Plan Types
 *
 * Defines the structure for exporting Claude Code resources (skills/agents)
 */

/**
 * Exportable item types
 */
export enum ExportItemType {
  SKILL = "skill",
  AGENT = "agent",
  COMMAND = "command",
  SETTINGS = "settings",
}

/**
 * Individual exportable item (file/folder)
 */
export interface ExportItem {
  readonly id: string;
  readonly type: ExportItemType;
  readonly name: string;
  readonly sourcePath: string;
}

/**
 * Category grouping items by type or directory
 */
export interface ExportCategory {
  readonly id: string;
  readonly name: string;
  readonly items: readonly ExportItem[];
}

/**
 * Complete export plan with categories structure
 */
export interface ExportPlan {
  readonly categories: readonly ExportCategory[];
  readonly totalCount: number;
}

/**
 * Node selection state for tree view
 */
export type NodeSelectionState = "selected" | "unselected" | "indeterminate";

/**
 * Tree node for export interface
 */
export interface ExportTreeNode {
  readonly id: string;
  readonly name: string;
  readonly type: "directory" | "file";
  readonly path: string;
  children: ExportTreeNode[];
  selectionState: NodeSelectionState;
  /** Whether this node is a default safe directory */
  readonly isSafe: boolean;
  /** Whether this node can be collapsed */
  readonly collapsible: boolean;
  /** Whether this node is expanded */
  expanded: boolean;
}

/**
 * Tree export plan with hierarchical structure
 */
export interface TreeExportPlan {
  readonly tree: ExportTreeNode;
  readonly totalCount: number;
  readonly selectedCount: number;
}
