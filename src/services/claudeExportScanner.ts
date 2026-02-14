import { ExportCategory, ExportItem, ExportItemType, ExportPlan } from "../types/exportPlan";
import { FileSystem, FsEntry } from "./fileSystemService";
import { ExportScanner } from "./exportScanner";
import * as path from "path";

export class ClaudeExportScanner implements ExportScanner {
  constructor(
    private readonly homeDir: string,
    private readonly fileSystem: FileSystem
  ) {}

  private async scanDirectory(
    categoryName: string,
    itemType: ExportItemType
  ): Promise<ExportCategory> {
    const items: ExportItem[] = [];
    const dirPath = path.join(this.homeDir, categoryName);
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
