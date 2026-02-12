/**
 * Export/Import Service
 *
 * Handles export and import of Claude configuration files using
 * new export components (ExportScanner, ExportExecutor).
 *
 * Export directory structure:
 * <export-dir>/
 *   global/                # NodeCategory.GLOBAL
 *     .claude.json
 *     .claude/
 *       settings.json
 *       ...
 *   projects/              # NodeCategory.PROJECTS
 *     [project-name]/
 *       .claude/
 *       CLAUDE.md
 *       ...
 */

import * as path from "node:path";
import type { NodeData } from "../types/nodeData.js";
import type { Progress } from "../adapters/progress.js";
import type { ExportFile } from "../types/export.js";
import type { NodeService } from "../services/nodeService.js";
import type { ConfigurationService } from "../adapters/configuration.js";
import type { DialogService } from "../adapters/vscode.js";
import { ExportPathCalculator } from "./exportPathCalculator.js";
import { ExportScanner, type NodeChildrenProvider } from "./exportScanner.js";
import { FsExportExecutor } from "./exportExecutor.js";
import type { FileAccessService } from "./fileAccessService.js";
import type {
  ExportOptions,
  ImportOptions,
  ExportResult as ConfigExportResult,
  ImportResult as ConfigImportResult,
} from "../types/configSchema.js";

/**
 * 导入文件映射
 */
interface ImportFileMapping {
  /** 导出目录中的文件路径 */
  readonly exportAbsPath: string;
  /** 目标文件路径 */
  readonly targetAbsPath: string;
  /** 文件是否存在 */
  readonly exists: boolean;
}

/**
 * Export/Import service using new export components
 */
export class ExportImportService {
  private readonly pathCalculator: ExportPathCalculator;
  private readonly scanner: ExportScanner;
  private readonly executor: FsExportExecutor;

  constructor(
    private readonly fileAccessService: FileAccessService,
    nodeService: NodeService,
    private readonly configService: ConfigurationService,
    private readonly dialog: DialogService,
    childrenProvider?: NodeChildrenProvider
  ) {
    this.pathCalculator = new ExportPathCalculator();
    this.scanner = new ExportScanner(nodeService, this.pathCalculator, childrenProvider);
    this.executor = new FsExportExecutor(fileAccessService);
  }

  /**
   * Export configuration to target directory using node tree traversal
   *
   * @param rootNodes - Root nodes to export
   * @param options - Export options
   * @param progress - Optional progress reporter
   * @param childrenProvider - Optional provider for handling VIRTUAL nodes' children
   */
  async export(
    rootNodes: readonly NodeData[],
    options: ExportOptions,
    progress?: Progress,
    childrenProvider?: NodeChildrenProvider
  ): Promise<ConfigExportResult> {
    const targetDir = options.targetDirectory;

    progress?.report("准备导出配置...");

    // 扫描节点树生成导出计划
    const plan = await this.scanner.scan(rootNodes, childrenProvider);

    progress?.report(
      `找到 ${String(plan.filesToCopy.length)} 个文件，` +
        `${String(plan.directoriesToCopy.length)} 个目录，` +
        `${String(plan.directoriesToCreate.length)} 个空目录`
    );

    // 执行导出计划（创建目录 + 复制文件）
    const result = await this.executor.execute(plan, targetDir, progress);

    // 创建 .gitignore 如果请求
    if (options.createGitignore) {
      await this.createGitignore(targetDir);
    }

    const failureCount = result.failures.length;
    progress?.report(
      `导出完成！成功 ${String(result.filesCopiedCount)} 个文件` +
        (failureCount > 0 ? `，失败 ${String(failureCount)} 个` : "")
    );

    return {
      fileCount: result.filesCopiedCount,
      exportPath: targetDir,
      exportedFiles: plan.filesToCopy.map((f) => f.dstRelativePath),
    };
  }

  /**
   * Import configuration from source directory
   *
   * @param rootNodes - Root nodes to import
   * @param options - Import options
   * @param progress - Optional progress reporter
   * @param childrenProvider - Optional provider for handling VIRTUAL nodes' children
   */
  async import(
    rootNodes: readonly NodeData[],
    options: ImportOptions,
    progress?: Progress,
    childrenProvider?: NodeChildrenProvider
  ): Promise<ConfigImportResult> {
    const sourceDir = options.sourceDirectory;

    progress?.report("准备导入配置...");

    // 扫描节点树了解应该导入什么
    const plan = await this.scanner.scan(rootNodes, childrenProvider);

    // 映射导出文件到源位置
    const importFiles = await this.mapImportFiles(plan.filesToCopy, sourceDir);

    // 过滤掉不存在的文件
    const filesToImport = importFiles.filter((f) => f.exists);
    progress?.report(`找到 ${String(filesToImport.length)} 个文件待导入`);

    let importCount = 0;
    let skipCount = 0;
    const importedFiles: string[] = [];
    const skippedFiles: string[] = [];

    // 导入文件
    for (const importFile of filesToImport) {
      const shouldImport =
        options.overwrite === true || !(await this.targetFileExists(importFile.targetAbsPath));

      if (!shouldImport) {
        skipCount++;
        skippedFiles.push(importFile.targetAbsPath);
        continue;
      }

      try {
        await this.copyFile(importFile.exportAbsPath, importFile.targetAbsPath);
        importCount++;
        importedFiles.push(importFile.targetAbsPath);
      } catch {
        // 记录错误但继续
      }
    }

    progress?.report(
      `导入完成！成功 ${String(importCount)} 个` +
        (skipCount > 0 ? `，跳过 ${String(skipCount)} 个` : "")
    );

    return {
      fileCount: importCount,
      importedFiles,
      skippedCount: skipCount,
      skippedFiles,
    };
  }

  /**
   * 映射导出文件到源位置
   */
  private async mapImportFiles(
    files: readonly ExportFile[],
    exportDir: string
  ): Promise<ImportFileMapping[]> {
    const results = await Promise.all(
      files.map(async (file) => {
        const exportAbsPath = path.join(exportDir, file.dstRelativePath);
        const targetAbsPath = file.srcAbsPath;
        const exists = await this.fileExists(exportAbsPath);
        return {
          exportAbsPath,
          targetAbsPath,
          exists,
        };
      })
    );
    return results;
  }

  /**
   * 检查目标文件是否存在
   */
  private async targetFileExists(filePath: string): Promise<boolean> {
    try {
      return await this.fileAccessService.fileExists(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      return await this.fileAccessService.fileExists(filePath);
    } catch {
      return false;
    }
  }

  /**
   * 复制文件
   */
  private async copyFile(srcAbsPath: string, dstAbsPath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.copyFile(srcAbsPath, dstAbsPath);
  }

  /**
   * 创建 .gitignore 文件
   */
  private async createGitignore(exportDir: string): Promise<void> {
    const gitignorePath = path.join(exportDir, ".gitignore");
    const exists = await this.fileExists(gitignorePath);

    if (!exists) {
      // 文件不存在，直接创建
      const exportConfig = this.configService.getExportConfig();
      await this.writeFile(gitignorePath, exportConfig.gitignoreContent);
      return;
    }

    // 文件已存在，读取现有内容
    const currentContent = await this.readFile(gitignorePath);
    const exportConfig = this.configService.getExportConfig();
    const configContent = exportConfig.gitignoreContent;

    // 比较内容是否相同
    if (currentContent === configContent) {
      // 内容相同，无需操作
      return;
    }

    // 内容不同，显示两边内容供用户选择
    const choice = await this.dialog.showWarningMessage(
      `.gitignore 文件已存在且内容与配置不同。\n\n` +
        `--- 现有文件内容 ---\n${currentContent}\n` +
        `--- 配置中的内容 ---\n${configContent}\n\n` +
        `请选择如何处理：`,
      { modal: true },
      "使用配置内容覆盖",
      "保留现有文件",
      "取消"
    );

    if (choice === "使用配置内容覆盖") {
      await this.writeFile(gitignorePath, configContent);
    }
    // "保留现有文件" 和 "取消" 都不做任何操作
  }

  /**
   * 写入文件
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.writeFile(filePath, content, "utf-8");
  }

  /**
   * 读取文件
   */
  private async readFile(filePath: string): Promise<string> {
    const fs = await import("node:fs/promises");
    return await fs.readFile(filePath, "utf-8");
  }
}
