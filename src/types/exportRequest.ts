import type { ExportPlan, TreeExportPlan } from "./exportPlan";

export interface ExportToDirectoryOptions {
  readonly targetPath: string;
}

export interface ExportOptions {
  readonly toDirectory?: ExportToDirectoryOptions;
}

/**
 * Export request with plan and options
 */
export interface ExportRequest {
  readonly plan: ExportPlan | TreeExportPlan;
  readonly options: ExportOptions;
}
