import type { ExportRequest } from "../types/exportRequest";
import type { ExportItem } from "../types/exportPlan";

export interface ExportProgress {
  readonly current: number;
  readonly total: number;
  readonly currentItem: string;
  readonly status: "copying" | "completed" | "error";
}

export type ProgressCallback = (progress: ExportProgress) => void;

export interface ExportResult {
  readonly success: boolean;
  readonly exportedCount: number;
  readonly errors: readonly ExportError[];
}

export interface ExportError {
  readonly item: ExportItem;
  readonly error: string;
}

export interface ExportService {
  export(request: ExportRequest, progressCallback: ProgressCallback): Promise<ExportResult>;
}
