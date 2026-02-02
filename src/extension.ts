/**
 * Context Editor Extension for VS Code.
 * Provides tree views for managing Claude Code projects and configurations
 * across multiple environments (Windows, WSL, macOS, Linux).
 *
 * Features:
 * - Unified environment switcher with Activity Badge
 * - Dynamic content switching based on selected environment
 * - Support for cross-platform environments (Windows + WSL)
 */

import * as vscode from "vscode";
import { ProjectProvider } from "./views/projectProvider.js";
import { GlobalProvider } from "./views/globalProvider.js";
import { setDebugOutput } from "./services/claudeConfigReader.js";
import { setFileAccessDebugOutput } from "./services/fileAccessService.js";
import { EnvironmentDetector, type Environment } from "./services/environmentDetector.js";
import { EnvironmentStateManager } from "./services/environmentStateManager.js";

// Global state
let environmentState: EnvironmentStateManager;
let globalProvider: GlobalProvider;
let projectProvider: ProjectProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("Context Editor extension is now active!");

  // Create debug output channel
  const debugOutput = vscode.window.createOutputChannel("Context Editor");
  context.subscriptions.push(debugOutput);

  // Set debug output for config reader and file access service
  setDebugOutput(debugOutput);
  setFileAccessDebugOutput(debugOutput);

  // Detect available environments
  const detector = new EnvironmentDetector();
  const environments = await detector.detect();

  debugOutput.appendLine("Context Editor extension activated");
  debugOutput.appendLine(`Detected ${String(environments.length)} environment(s):`);
  for (const env of environments) {
    debugOutput.appendLine(`  - ${env.name} (${env.configPath})`);
  }

  // Initialize environment state manager with the first environment
  environmentState = new EnvironmentStateManager(environments[0]);
  context.subscriptions.push(environmentState);

  // Set initial context
  await vscode.commands.executeCommand(
    "setContext",
    "contextEditor.currentEnv",
    environments[0].id
  );

  // Register views (always use the same 2 views, content changes dynamically)
  registerViews(context, environments[0], debugOutput);

  // Register commands
  registerCommands(context, environments, debugOutput);

  // Subscribe to environment changes to update providers
  context.subscriptions.push(
    environmentState.onDidChangeEnvironment((newEnv) => {
      debugOutput.appendLine(`Switching to environment: ${newEnv.name}`);

      // Update providers with new environment's config path
      globalProvider.updateConfigPath(newEnv.configPath, newEnv.name);
      projectProvider.updateConfigPath(newEnv.configPath);

      // Refresh both views
      globalProvider.refresh();
      projectProvider.refresh();

      // Show notification
      vscode.window.showInformationMessage(`Switched to ${newEnv.name}`);
    })
  );
}

/**
 * Register the tree view data providers.
 */
function registerViews(
  _context: vscode.ExtensionContext,
  initialEnv: Environment,
  debugOutput: vscode.OutputChannel
): void {
  debugOutput.appendLine(`Registering views with initial environment: ${initialEnv.name}`);

  // Create providers with initial environment
  globalProvider = new GlobalProvider(initialEnv.configPath, initialEnv.name);
  projectProvider = new ProjectProvider(initialEnv.configPath);

  // Register the tree data providers
  vscode.window.registerTreeDataProvider("contextEditorPrimaryGlobal", globalProvider);
  vscode.window.registerTreeDataProvider("contextEditorPrimaryProjects", projectProvider);
}

/**
 * Register extension commands.
 */
function registerCommands(
  context: vscode.ExtensionContext,
  environments: Environment[],
  debugOutput: vscode.OutputChannel
): void {
  // Show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    debugOutput.show();
  });
  context.subscriptions.push(showDebugCommand);

  // Refresh command - refreshes both views
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", () => {
    globalProvider.refresh();
    projectProvider.refresh();
  });
  context.subscriptions.push(refreshCommand);

  // Environment switcher command - shows QuickPick to select environment
  const switchEnvironmentCommand = vscode.commands.registerCommand(
    "contextEditor.switchEnvironment",
    async () => {
      const currentEnv = environmentState.currentEnvironment;

      const items = environments.map((env) => ({
        label: env.name,
        description: env.configPath,
        env,
        picked: env.id === currentEnv.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Current: ${currentEnv.name}`,
      });

      if (selected && selected.env.id !== currentEnv.id) {
        await environmentState.switchEnvironment(selected.env);
      }
    }
  );
  context.subscriptions.push(switchEnvironmentCommand);

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
  environmentState.dispose();
}
