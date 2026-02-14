// Exportable item types
export enum ExportItemType {
  SKILL = "skill",
  AGENT = "agent",
  COMMAND = "command",
}

// Individual exportable item (file/folder)
export interface ExportItem {
  readonly type: ExportItemType;
  readonly name: string;
  readonly sourcePath: string;
}

// Category grouping items by type
export interface ExportCategory {
  readonly name: string;
  readonly items: readonly ExportItem[];
}

// Complete export plan
export interface ExportPlan {
  readonly categories: readonly ExportCategory[];
}
