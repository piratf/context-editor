import { ExportCategory, ExportItem, ExportItemType, ExportPlan } from "../types/exportPlan";
import { FileSystem, FsEntry } from "./fileSystemService";
import { ExportScanner } from "./exportScanner";

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
    const dirPath = `${this.homeDir}/${categoryName}`;
    const files: FsEntry[] = await this.fileSystem.readDirectory(dirPath);

    for (const file of files) {
      const name = file.name;
      const filePath = `${dirPath}/${name}`;
      items.push({
        type: itemType,
        name: name,
        sourcePath: filePath,
      });
    }

    return {
      name: categoryName,
      items: items,
    };
  }

  async scan(): Promise<ExportPlan> {
    const skillsCategory = await this.scanDirectory("skills", ExportItemType.SKILL);
    const agentsCategory = await this.scanDirectory("agents", ExportItemType.AGENT);
    const commandsCategory = await this.scanDirectory("commands", ExportItemType.COMMAND);

    return {
      categories: [skillsCategory, agentsCategory, commandsCategory],
    };
  }
}
