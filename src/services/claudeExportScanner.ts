import { ExportCategory, ExportItem, ExportItemType, ExportPlan } from "../types/exportPlan";
import { FileSystem, FsEntry } from "./fileSystemService";
import { ExportScanner } from "./exportScanner";
import * as path from "path";
import { ILoggerService } from "./loggerService";

export class ClaudeExportScanner implements ExportScanner {
  constructor(
    private readonly homeDir: string,
    private readonly fileSystem: FileSystem,
    private readonly logger: ILoggerService
  ) {}

  private async scanDirectory(
    categoryName: string,
    itemType: ExportItemType
  ): Promise<ExportCategory> {
    const items: ExportItem[] = [];
    const dirPath = path.join(this.homeDir, categoryName);

    try {
      const files: FsEntry[] = await this.fileSystem.readDirectory(dirPath);

      for (const file of files) {
        const name = file.name;
        const filePath = path.join(dirPath, name);
        items.push({
          id: `${itemType}-${name}`,
          type: itemType,
          name: name,
          sourcePath: filePath,
        });
      }
    } catch (error) {
      // Directory doesn't exist or cannot be read - return empty category
      // This is expected for users who don't have all Claude resource directories
      this.logger.info(`Directory not found, skipping: ${categoryName}`, {
        path: dirPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      id: categoryName,
      name: categoryName,
      items: items,
    };
  }

  async scan(): Promise<ExportPlan> {
    const skillsCategory = await this.scanDirectory(".claude/skills", ExportItemType.SKILL);
    const agentsCategory = await this.scanDirectory(".claude/agents", ExportItemType.AGENT);
    const commandsCategory = await this.scanDirectory(".claude/commands", ExportItemType.COMMAND);

    const categories = [skillsCategory, agentsCategory, commandsCategory];
    const totalCount = categories.reduce((sum, cat) => sum + cat.items.length, 0);

    return {
      categories: categories,
      totalCount: totalCount,
    };
  }
}
