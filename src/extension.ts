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

// Global state
let configSearch: ConfigSearch;
let environmentManager: EnvironmentManager;
let unifiedProvider: UnifiedProvider;
let logger: Logger;

// Set context variable for UI conditionals
function updateCurrentEnvironmentContext(envName: string): void {
  void vscode.commands.executeCommand("setContext", "contextEditor.currentEnv", envName);
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

  // Initialize environment manager (defaults to native facade)
  environmentManager = new EnvironmentManager(configSearch);
  const currentEnvName = environmentManager.getCurrentEnvironmentName();
  updateCurrentEnvironmentContext(currentEnvName);
  logger.info(`Current environment: ${currentEnvName}`);

  // Register views with environment manager
  registerViews(context, environmentManager, logger);

  // Register commands
  registerCommands(context, environmentManager, logger);

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
  logger: Logger
): void {
  logger.logEntry("registerViews");

  // Create unified provider with environment manager
  unifiedProvider = new UnifiedProvider(envManager, logger);

  // Register the tree data provider
  vscode.window.registerTreeDataProvider("contextEditorUnified", unifiedProvider);

  logger.logExit("registerViews");
}

/**
 * Register extension commands.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  envManager: EnvironmentManager,
  logger: Logger
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
        vscode.window.showErrorMessage(
          `Failed to open file: ${errorObj.message}`
        );
      }
    }
  );
  context.subscriptions.push(openFileCommand);
}

export function deactivate(): void {
  console.log("Context Editor extension is now deactivated!");
}
