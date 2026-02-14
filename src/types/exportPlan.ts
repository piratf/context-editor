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
