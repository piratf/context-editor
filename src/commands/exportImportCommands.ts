/**
 * Export/Import Commands
 *
 * VS Code commands for exporting and importing Claude configuration.
 * Follows the command-driven architecture pattern used in contextMenu.ts.
 */

import * as vscode from "vscode";
import type { ClaudeDataFacade } from "../services/dataFacade.js";
import type { SimpleDIContainer } from "../di/container.js";
import type { ConfigurationService } from "../adapters/configuration.js";
import type { DirectorySelector } from "../adapters/directorySelector.js";
import type { FileSystemOperations } from "../adapters/fileSystem.js";
import type { ProgressService } from "../adapters/progress.js";
import type { UserInteraction } from "../adapters/ui.js";
import { ExportImportService } from "../services/exportImportService.js";
import {
  validateExportConfig,
  createFilterFromConfig,
  type ExportConfig,
} from "../types/configSchema.js";

/**
 * Command execution context
 */
interface CommandContext {
  /** DI container */
  container: SimpleDIContainer;
  /** Current data facade */
  facade: ClaudeDataFacade;
  /** Configuration service */
  config: ConfigurationService;
  /** Directory selector */
  directorySelector: DirectorySelector;
  /** File system operations */
  fileSystem: FileSystemOperations;
  /** Progress service */
  progress: ProgressService;
  /** User interaction */
  ui: UserInteraction;
}

/**
 * Execute export command
 *
 * @param container - DI container
 * @param options - Command options
 */
export async function executeExportCommand(
  container: SimpleDIContainer,
  options: { facade?: ClaudeDataFacade; targetDirectory?: string }
): Promise<void> {
  // Get services from container
  const config = container.get<ConfigurationService>("ConfigurationService" as never);
  const directorySelector = container.get<DirectorySelector>("DirectorySelector" as never);
  const fileSystem = container.get<FileSystemOperations>("FileSystemOperations" as never);
  const progress = container.get<ProgressService>("ProgressService" as never);
  const ui = container.get<UserInteraction>("UserInteraction" as never);

  // Get current facade from options or environment manager
  const facade = options.facade;
  if (!facade) {
    ui.showError("错误", "无法获取当前环境信息");
    return;
  }

  const context: CommandContext = {
    container,
    facade,
    config,
    directorySelector,
    fileSystem,
    progress,
    ui,
  };

  await performExport(context, options.targetDirectory);
}

/**
 * Perform export operation
 */
async function performExport(context: CommandContext, targetDirectory?: string): Promise<void> {
  const { config, directorySelector, ui, progress } = context;

  // Get export configuration from VS Code settings
  const exportConfigData = config.getExportConfig();

  // Determine target directory
  let exportDir = targetDirectory ?? exportConfigData.directory;

  if (!exportDir) {
    // Show directory selector
    const selected = await directorySelector.selectDirectory({
      title: "选择导出目录",
      canSelectFiles: false,
      canSelectFolders: true,
    });

    if (!selected) {
      return; // User cancelled
    }

    exportDir = selected.path;

    // Save to configuration for future use
    await config.updateConfig("contextEditor.export.directory", exportDir);
  }

  // Build export options
  const exportConfig: ExportConfig = {
    directory: exportDir,
    filters: exportConfigData.filters,
    createGitignore: exportConfigData.createGitignore,
  };

  // Validate export configuration
  const validation = validateExportConfig(exportConfig);
  if (!validation.valid) {
    ui.showError("验证失败", validation.error ?? "配置验证失败");
    return;
  }

  // Create filter from config
  const filter = createFilterFromConfig(exportConfig);

  // Perform export with progress
  try {
    const result = await progress.showProgress("导出配置", async (progress) => {
      const service = new ExportImportService(context.fileSystem);
      return service.export(
        context.facade,
        {
          targetDirectory: exportDir,
          filter,
          createGitignore: exportConfig.createGitignore,
        },
        progress
      );
    });

    ui.showInfo(
      `导出完成！\n` +
        `目标目录: ${result.exportPath}\n` +
        `导出文件: ${String(result.fileCount)} 个`
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    ui.showError("导出失败", errorMsg);
  }
}

/**
 * Execute import command
 *
 * @param container - DI container
 * @param options - Command options
 */
export async function executeImportCommand(
  container: SimpleDIContainer,
  options: { facade?: ClaudeDataFacade; sourceDirectory?: string }
): Promise<void> {
  // Get services from container
  const config = container.get<ConfigurationService>("ConfigurationService" as never);
  const directorySelector = container.get<DirectorySelector>("DirectorySelector" as never);
  const fileSystem = container.get<FileSystemOperations>("FileSystemOperations" as never);
  const progress = container.get<ProgressService>("ProgressService" as never);
  const ui = container.get<UserInteraction>("UserInteraction" as never);

  // Get current facade from options or environment manager
  const facade = options.facade;
  if (!facade) {
    ui.showError("错误", "无法获取当前环境信息");
    return;
  }

  const context: CommandContext = {
    container,
    facade,
    config,
    directorySelector,
    fileSystem,
    progress,
    ui,
  };

  await performImport(context, options.sourceDirectory);
}

/**
 * Perform import operation
 */
async function performImport(context: CommandContext, sourceDirectory?: string): Promise<void> {
  const { config, directorySelector, ui, progress } = context;

  // Determine source directory
  let importDir = sourceDirectory ?? config.getExportConfig().directory;

  if (!importDir) {
    // Show directory selector
    const selected = await directorySelector.selectDirectory({
      title: "选择导入源目录",
      canSelectFiles: false,
      canSelectFolders: true,
    });

    if (!selected) {
      return; // User cancelled
    }

    importDir = selected.path;
  }

  // Confirm import operation
  const confirm = await ui.showWarningMessage(
    `即将从以下目录导入配置:\n${importDir}\n\n` + `此操作将覆盖现有配置文件。`,
    { modal: true },
    "继续",
    "取消"
  );

  if (confirm !== "继续") {
    return;
  }

  // Perform import with progress
  try {
    const result = await progress.showProgress("导入配置", async (progress) => {
      const service = new ExportImportService(context.fileSystem);
      return service.import(
        context.facade,
        {
          sourceDirectory: importDir,
          overwrite: true,
        },
        progress
      );
    });

    let message = `导入完成！\n` + `导入文件: ${String(result.fileCount)} 个`;
    if (result.skippedCount > 0) {
      message += `\n跳过文件: ${String(result.skippedCount)} 个`;
    }

    ui.showInfo(message);

    // Trigger refresh of the tree view
    await vscode.commands.executeCommand("contextEditor.refresh");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    ui.showError("导入失败", errorMsg);
  }
}

/**
 * Execute select export directory command
 *
 * @param container - DI container
 */
export async function executeSelectExportDirectoryCommand(
  container: SimpleDIContainer
): Promise<void> {
  const config = container.get<ConfigurationService>("ConfigurationService" as never);
  const directorySelector = container.get<DirectorySelector>("DirectorySelector" as never);
  const ui = container.get<UserInteraction>("UserInteraction" as never);

  const selected = await directorySelector.selectDirectory({
    title: "选择默认导出目录",
    canSelectFiles: false,
    canSelectFolders: true,
  });

  if (!selected) {
    return;
  }

  await config.updateConfig("contextEditor.export.directory", selected.path);
  ui.showInfo(`导出目录已设置为: ${selected.path}`);
}
