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
import { GlobalProvider } from "./views/globalProvider.js";
import { ProjectProvider } from "./views/projectProvider.js";
import { ConfigSearch, ConfigSearchFactory } from "./services/configSearch.js";
import { EnvironmentManager, type EnvironmentChangeEvent } from "./services/environmentManager.js";

// Global state
let configSearch: ConfigSearch;
let environmentManager: EnvironmentManager;
let globalProvider: GlobalProvider;
let projectProvider: ProjectProvider;
let environmentStatusBarItem: vscode.StatusBarItem;

// Set context variable for UI conditionals
function updateCurrentEnvironmentContext(envName: string): void {
  void vscode.commands.executeCommand("setContext", "contextEditor.currentEnv", envName);
}

// Update status bar item with current environment
function updateEnvironmentStatusBar(envName: string): void {
  environmentStatusBarItem.text = `$(server-environment) ${envName}`;
  environmentStatusBarItem.tooltip = `Current environment: ${envName}. Click to switch.`;
  environmentStatusBarItem.show();
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("Context Editor extension is now active!");

  // Create debug output channel
  const debugOutput = vscode.window.createOutputChannel("Context Editor");
  context.subscriptions.push(debugOutput);

  debugOutput.appendLine("Initializing Context Editor...");

  // Initialize config search and discover all environments
  configSearch = await ConfigSearchFactory.createAndDiscover();

  const facades = configSearch.getAllFacades();
  debugOutput.appendLine(`Discovered ${String(facades.length)} environment(s):`);

  for (const facade of facades) {
    const info = facade.getEnvironmentInfo();
    debugOutput.appendLine(`  - ${info.type}: ${info.configPath}`);
  }

  // Initialize environment manager (defaults to native facade)
  environmentManager = new EnvironmentManager(configSearch);
  const currentEnvName = environmentManager.getCurrentEnvironmentName();
  updateCurrentEnvironmentContext(currentEnvName);
  debugOutput.appendLine(`Current environment: ${currentEnvName}`);

  // Create status bar item for environment switching
  environmentStatusBarItem = vscode.window.createStatusBarItem(
    "contextEditor.environmentStatus",
    vscode.StatusBarAlignment.Left,
    100 // Priority
  );
  environmentStatusBarItem.command = "contextEditor.switchEnvironment";
  context.subscriptions.push(environmentStatusBarItem);
  updateEnvironmentStatusBar(currentEnvName);

  // Register views with environment manager
  registerViews(context, environmentManager, debugOutput);

  // Register commands
  registerCommands(context, environmentManager, debugOutput);

  // Subscribe to environment changes
  environmentManager.on("environmentChanged", (event: EnvironmentChangeEvent) => {
    debugOutput.appendLine(`Environment changed: ${event.environmentName}`);
    updateCurrentEnvironmentContext(event.environmentName);
    updateEnvironmentStatusBar(event.environmentName);

    // Refresh views to show data from new environment
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    globalProvider?.refresh();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    projectProvider?.refresh();
  });

  // Subscribe to data facades changes
  configSearch.on("dataFacadesChanged", (facades) => {
    debugOutput.appendLine(`Data facades changed: ${String(facades.length)} environment(s)`);
    environmentManager.updateConfigSearch(configSearch);

    // Update status bar with new current environment name
    const updatedEnvName = environmentManager.getCurrentEnvironmentName();
    updateEnvironmentStatusBar(updatedEnvName);

    // Refresh views to show updated data
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    globalProvider?.refresh();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    projectProvider?.refresh();
  });
}

/**
 * Register the tree view data providers.
 */
function registerViews(
  _context: vscode.ExtensionContext,
  envManager: EnvironmentManager,
  debugOutput: vscode.OutputChannel
): void {
  debugOutput.appendLine("Registering views...");

  // Create providers with environment manager
  globalProvider = new GlobalProvider(envManager, debugOutput);
  projectProvider = new ProjectProvider(envManager, debugOutput);

  // Register the tree data providers
  vscode.window.registerTreeDataProvider("contextEditorPrimaryGlobal", globalProvider);
  vscode.window.registerTreeDataProvider("contextEditorPrimaryProjects", projectProvider);
}

/**
 * Register extension commands.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  envManager: EnvironmentManager,
  debugOutput: vscode.OutputChannel
): void {
  // Show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    debugOutput.show();
  });
  context.subscriptions.push(showDebugCommand);

  // Switch environment command - shows quick pick
  const switchEnvironmentCommand = vscode.commands.registerCommand(
    "contextEditor.switchEnvironment",
    async () => {
      debugOutput.appendLine("Switch environment command triggered");
      await envManager.showEnvironmentQuickPick();
    }
  );
  context.subscriptions.push(switchEnvironmentCommand);

  // Refresh command - refreshes both views and re-discovers environments
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", async () => {
    debugOutput.appendLine("Refreshing environments...");
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
        vscode.window.showErrorMessage(
          `Failed to open file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
  context.subscriptions.push(openFileCommand);
}

export function deactivate(): void {
  console.log("Context Editor extension is now deactivated!");
  // Dispose status bar item
  environmentStatusBarItem.dispose();
}
