/**
 * Context Editor Extension for VS Code.
 * Provides tree views for managing Claude Code projects and configurations
 * across multiple environments (Windows, WSL, macOS, Linux).
 *
 * New Architecture:
 * - Uses ConfigSearch to discover all accessible environments
 * - Uses EnvironmentManager to manage the currently selected environment
 * - Displays projects from the currently selected environment only
 * - User can switch environments via status bar button
 */

import * as vscode from "vscode";
import { UnifiedProvider } from "./views/unifiedProvider.js";
import { ConfigSearch, ConfigSearchFactory } from "./services/configSearch.js";
import { EnvironmentManager, type EnvironmentChangeEvent } from "./services/environmentManager.js";
import { Logger } from "./utils/logger.js";
import { VsCodeUserInteraction } from "./adapters/ui.js";
import { createContainer } from "./di/setup.js";
import { SimpleDIContainer } from "./di/container.js";
import { ServiceTokens } from "./di/tokens.js";
import {
  executeExportCommand,
  executeImportCommand,
  executeSelectExportDirectoryCommand,
} from "./commands/exportImportCommands.js";

// Global state
let configSearch: ConfigSearch;
let environmentManager: EnvironmentManager;
let unifiedProvider: UnifiedProvider;
let treeView: vscode.TreeView<unknown> | undefined;
let logger: Logger;
let container: SimpleDIContainer;

// Set context variable for UI conditionals and update view title
function updateCurrentEnvironmentContext(envName: string): void {
  void vscode.commands.executeCommand("setContext", "contextEditor.currentEnv", envName);
  // Update the tree view title with icon and environment name
  // treeView may not be initialized yet when this function is first called
  if (treeView !== undefined) {
    // Use a Unicode symbol as a workaround since $(icon) syntax doesn't work in TreeView.title
    treeView.title = `⚡ ${envName}`;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("Context Editor extension is now active!");

  // Create debug output channel
  const debugOutput = vscode.window.createOutputChannel("Context Editor");
  context.subscriptions.push(debugOutput);

  // Initialize logger
  logger = new Logger(debugOutput, "ContextEditor");
  logger.logEntry("activate");

  // Initialize config search and discover all environments
  configSearch = await ConfigSearchFactory.createAndDiscover();

  const facades = configSearch.getAllFacades();
  logger.info(`Discovered ${String(facades.length)} environment(s)`);

  for (const facade of facades) {
    const info = facade.getEnvironmentInfo();
    logger.debug(`Environment: ${info.type}`, { configPath: info.configPath });
  }

  // Initialize user interaction adapter
  const userInteraction = new VsCodeUserInteraction();

  // Initialize environment manager (defaults to native facade)
  environmentManager = new EnvironmentManager(configSearch, userInteraction);
  const currentEnvName = environmentManager.getCurrentEnvironmentName();
  updateCurrentEnvironmentContext(currentEnvName);
  logger.info(`Current environment: ${currentEnvName}`);

  // Create DI container for service management
  container = createContainer();
  context.subscriptions.push(container);

  // Register views with environment manager and container
  registerViews(context, environmentManager, logger, container);

  // Register commands
  registerCommands(context, environmentManager, logger, container);

  // Subscribe to environment changes
  environmentManager.on("environmentChanged", (event: EnvironmentChangeEvent) => {
    logger.info(`Environment changed: ${event.environmentName}`);
    updateCurrentEnvironmentContext(event.environmentName);

    // Refresh view to show data from new environment
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    unifiedProvider?.refresh();
  });

  // Subscribe to data facades changes
  configSearch.on("dataFacadesChanged", (facades) => {
    logger.info(`Data facades changed: ${String(facades.length)} environment(s)`);
    environmentManager.updateConfigSearch(configSearch);

    // Refresh view to show updated data
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    unifiedProvider?.refresh();
  });

  logger.logExit("activate");
}

/**
 * Register the tree view data providers.
 */
function registerViews(
  _context: vscode.ExtensionContext,
  envManager: EnvironmentManager,
  logger: Logger,
  container: SimpleDIContainer
): void {
  logger.logEntry("registerViews");

  // Get TreeItemFactory from DI container
  const treeItemFactory = container.get(ServiceTokens.TreeItemFactory);

  // Create unified provider with environment manager, container, and treeItemFactory
  unifiedProvider = new UnifiedProvider(envManager, logger, container, treeItemFactory);

  // Create the tree view with dynamic title support
  treeView = vscode.window.createTreeView("contextEditorUnified", {
    treeDataProvider: unifiedProvider,
  });

  // Set the initial title with the current environment name
  const initialEnvName = envManager.getCurrentEnvironmentName();
  treeView.title = `⚡ ${initialEnvName}`;

  logger.logExit("registerViews");
}

/**
 * Register extension commands.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  envManager: EnvironmentManager,
  logger: Logger,
  container: SimpleDIContainer
): void {
  // Show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    logger.show();
  });
  context.subscriptions.push(showDebugCommand);

  // Switch environment command - shows quick pick
  const switchEnvironmentCommand = vscode.commands.registerCommand(
    "contextEditor.switchEnvironment",
    async () => {
      logger.debug("Switch environment command triggered");
      await envManager.showEnvironmentQuickPick();
    }
  );
  context.subscriptions.push(switchEnvironmentCommand);

  // Title environment switcher command - shows quick pick
  const titleEnvironmentSwitchCommand = vscode.commands.registerCommand(
    "contextEditor.titleEnvironmentSwitch",
    async () => {
      logger.debug("Title environment switch triggered");
      await envManager.showEnvironmentQuickPick();
    }
  );
  context.subscriptions.push(titleEnvironmentSwitchCommand);

  // Refresh command - refreshes view and re-discovers environments
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", async () => {
    logger.debug("Refreshing environments...");
    await configSearch.refresh();
  });
  context.subscriptions.push(refreshCommand);

  // Open file command
  const openFileCommand = vscode.commands.registerCommand(
    "contextEditor.openFile",
    async (filePath: string) => {
      if (typeof filePath !== "string") {
        return;
      }

      try {
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand("vscode.open", uri);
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        logger.error("Failed to open file", errorObj);
        vscode.window.showErrorMessage(`Failed to open file: ${errorObj.message}`);
      }
    }
  );
  context.subscriptions.push(openFileCommand);

  // Export configuration command
  const exportConfigCommand = vscode.commands.registerCommand(
    "contextEditor.exportConfig",
    async () => {
      logger.debug("Export config command triggered");
      await executeExportCommand(container, { unifiedProvider });
    }
  );
  context.subscriptions.push(exportConfigCommand);

  // Import configuration command
  const importConfigCommand = vscode.commands.registerCommand(
    "contextEditor.importConfig",
    async () => {
      logger.debug("Import config command triggered");
      await executeImportCommand(container, { unifiedProvider });
    }
  );
  context.subscriptions.push(importConfigCommand);

  // Select export directory command
  const selectExportDirectoryCommand = vscode.commands.registerCommand(
    "contextEditor.selectExportDirectory",
    async () => {
      logger.debug("Select export directory command triggered");
      await executeSelectExportDirectoryCommand(container);
    }
  );
  context.subscriptions.push(selectExportDirectoryCommand);

  // Register context menu commands via ContextMenuRegistry
  const menuRegistry = container.get(ServiceTokens.ContextMenuRegistry);
  void menuRegistry.registerCommands(context);
}

export function deactivate(): void {
  console.log("Context Editor extension is now deactivated!");
}
