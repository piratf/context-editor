/**
 * Context Editor Extension for VS Code.
 * Provides tree views for managing Claude Code projects and configurations
 * across multiple environments (Windows, WSL, macOS, Linux).
 *
 * New Architecture:
 * - Uses ConfigSearch to discover all accessible environments
 * - Displays projects from all environments simultaneously
 * - No environment switching - all environments are shown at once
 */

import * as vscode from "vscode";
import { GlobalProvider } from "./views/globalProvider.js";
import { ProjectProvider } from "./views/projectProvider.js";
import { ConfigSearch, ConfigSearchFactory } from "./services/configSearch.js";

// Global state
let configSearch: ConfigSearch;
let globalProvider: GlobalProvider;
let projectProvider: ProjectProvider;

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

  // Register views with config search
  registerViews(context, configSearch, debugOutput);

  // Register commands
  registerCommands(context, configSearch, debugOutput);

  // Subscribe to data facades changes
  configSearch.on('dataFacadesChanged', (facades) => {
    debugOutput.appendLine(`Data facades changed: ${String(facades.length)} environment(s)`);

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
  search: ConfigSearch,
  debugOutput: vscode.OutputChannel
): void {
  debugOutput.appendLine("Registering views...");

  // Create providers with config search
  globalProvider = new GlobalProvider(search, debugOutput);
  projectProvider = new ProjectProvider(search, debugOutput);

  // Register the tree data providers
  vscode.window.registerTreeDataProvider("contextEditorPrimaryGlobal", globalProvider);
  vscode.window.registerTreeDataProvider("contextEditorPrimaryProjects", projectProvider);
}

/**
 * Register extension commands.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  search: ConfigSearch,
  debugOutput: vscode.OutputChannel
): void {
  // Show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    debugOutput.show();
  });
  context.subscriptions.push(showDebugCommand);

  // Refresh command - refreshes both views and re-discovers environments
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", async () => {
    debugOutput.appendLine("Refreshing environments...");
    await search.refresh();
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
}
