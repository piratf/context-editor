import { ExportError, ExportResult, ExportService, ProgressCallback } from "./exportService";
import { ILoggerService } from "./loggerService";
import { ExportRequest } from "../types/exportRequest";
import { ExportItem } from "../types/exportPlan";
import path from "node:path";
import fs from "node:fs/promises";

export class DirectoryExportService implements ExportService {
  constructor(private readonly logger: ILoggerService) {}

  async export(request: ExportRequest, progressCallback: ProgressCallback): Promise<ExportResult> {
    const { plan, options } = request;
    const targetPath = options.toDirectory?.targetPath;

    if (targetPath == null) {
      throw new Error("Target path is required");
    }

    // Flatten all items from categories
    const allItems: ExportItem[] = plan.categories.flatMap((cat) => cat.items);
    const errors: ExportError[] = [];
    let exportedCount = 0;

    this.logger.info("Exporting...", {
      path: targetPath,
      count: allItems.length,
    });

    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];

      try {
        await this.exportItem(item, targetPath);
        exportedCount++;

        progressCallback({
          current: i + 1,
          total: allItems.length,
          currentItem: item.name,
          status: "copying",
        });
      } catch (error) {
        errors.push({
          item,
          error: error instanceof Error ? error.message : String(error),
        });

        progressCallback({
          current: i + 1,
          total: allItems.length,
          currentItem: item.name,
          status: "error",
        });
      }
    }

    return { success: errors.length === 0, exportedCount, errors };
  }

  private async exportItem(item: ExportItem, targetBasePath: string): Promise<void> {
    // Extract relative path including .claude: /home/user/.claude/skills/x -> .claude/skills/x
    const claudeIndex = item.sourcePath.indexOf(".claude");
    if (claudeIndex === -1) {
      throw new Error(`Invalid source path: ${item.sourcePath}`);
    }
    const relativePath = item.sourcePath.substring(claudeIndex).replace(/^\//, "");
    const targetPath = path.join(targetBasePath, relativePath);

    const stats = await fs.stat(item.sourcePath);

    if (stats.isDirectory()) {
      await this.copyDirectory(item.sourcePath, targetPath);
    } else {
      await this.copyFile(item.sourcePath, targetPath);
    }
  }

  private async copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const src = path.join(sourcePath, entry.name);
      const dst = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(src, dst);
      } else {
        await fs.copyFile(src, dst);
      }
    }
  }

  private async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}
