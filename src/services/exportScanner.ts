import { ExportPlan } from "../types/exportPlan";

export interface ExportScanner {
  scan(): Promise<ExportPlan>;
}
