/**
 * Export/Import Commands
 *
 * VS Code commands for exporting and importing Claude configuration.
 * Follows the command-driven architecture pattern used in contextMenu.ts.
 */

import * as vscode from "vscode";
import type { UnifiedProvider } from "../views/unifiedProvider.js";
import type { SimpleDIContainer } from "../di/container.js";
import type { ConfigurationService } from "../adapters/configuration.js";
import type { DirectorySelector } from "../adapters/directorySelector.js";
import type { ProgressService } from "../adapters/progress.js";
import type { UserInteraction } from "../adapters/ui.js";
import { ServiceTokens } from "../di/tokens.js";
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
  /** Unified tree provider */
  unifiedProvider: UnifiedProvider;
  /** Configuration service */
  config: ConfigurationService;
  /** Directory selector */
  directorySelector: DirectorySelector;
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
  options: { unifiedProvider: UnifiedProvider; targetDirectory?: string }
): Promise<void> {
  // Get services from container
  const config = container.get(ServiceTokens.ConfigurationService);
  const directorySelector = container.get(ServiceTokens.DirectorySelector);
  const progress = container.get(ServiceTokens.ProgressService);
  const ui = container.get(ServiceTokens.UserInteraction);

  const context: CommandContext = {
    container,
    unifiedProvider: options.unifiedProvider,
    config,
    directorySelector,
    progress,
    ui,
  };

  await performExport(context, options.targetDirectory);
}

/**
 * Perform export operation
 */
async function performExport(context: CommandContext, targetDirectory?: string): Promise<void> {
  const { config, directorySelector, ui, progress, container, unifiedProvider } = context;

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

  // Get root nodes from the unified provider
  const rootNodes = await unifiedProvider.getChildren();

  // Perform export with progress
  try {
    const result = await progress.showProgress("导出配置", async (progress) => {
      const service = container.get(ServiceTokens.ExportImportService);
      return service.export(
        rootNodes,
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
  options: { unifiedProvider: UnifiedProvider; sourceDirectory?: string }
): Promise<void> {
  // Get services from container
  const config = container.get(ServiceTokens.ConfigurationService);
  const directorySelector = container.get(ServiceTokens.DirectorySelector);
  const progress = container.get(ServiceTokens.ProgressService);
  const ui = container.get(ServiceTokens.UserInteraction);

  const context: CommandContext = {
    container,
    unifiedProvider: options.unifiedProvider,
    config,
    directorySelector,
    progress,
    ui,
  };

  await performImport(context, options.sourceDirectory);
}

/**
 * Perform import operation
 */
async function performImport(context: CommandContext, sourceDirectory?: string): Promise<void> {
  const { config, directorySelector, ui, progress, container, unifiedProvider } = context;

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

  // Get root nodes from the unified provider
  const rootNodes = await unifiedProvider.getChildren();

  // Perform import with progress
  try {
    const result = await progress.showProgress("导入配置", async (progress) => {
      const service = container.get(ServiceTokens.ExportImportService);
      return service.import(
        rootNodes,
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
  const config = container.get(ServiceTokens.ConfigurationService);
  const directorySelector = container.get(ServiceTokens.DirectorySelector);
  const ui = container.get(ServiceTokens.UserInteraction);

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
