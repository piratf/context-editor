/**
 * Context Editor Extension for VS Code.
 * Provides tree views for managing Claude Code projects and configurations
 * across multiple environments (Windows, WSL, macOS, Linux).
 */

import * as vscode from "vscode";
import { ProjectProvider } from "./views/projectProvider.js";
import { GlobalProvider } from "./views/globalProvider.js";
import { setDebugOutput } from "./services/claudeConfigReader.js";
import { EnvironmentDetector, type Environment } from "./services/environmentDetector.js";

// Global refresh event emitter
const refreshEventEmitter = new vscode.EventEmitter<void>();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log("Context Editor extension is now active!");

  // Create debug output channel
  const debugOutput = vscode.window.createOutputChannel("Context Editor");
  context.subscriptions.push(debugOutput);

  // Set debug output for config reader
  setDebugOutput(debugOutput);

  // Detect available environments
  const detector = new EnvironmentDetector();
  const environments = await detector.detect();

  debugOutput.appendLine("Context Editor extension activated");
  debugOutput.appendLine(`Detected ${String(environments.length)} environment(s):`);
  for (const env of environments) {
    debugOutput.appendLine(`  - ${env.name} (${env.configPath})`);
  }

  // Register views based on detected environments
  if (environments.length === 1) {
    registerSingleEnvironment(context, environments[0], debugOutput);
  } else {
    registerMultiEnvironments(context, environments, debugOutput);
  }

  // Register shared commands (including global refresh command)
  registerSharedCommands(context, debugOutput);
}

/**
 * Register views for single environment mode.
 */
function registerSingleEnvironment(
  context: vscode.ExtensionContext,
  env: Environment,
  debugOutput: vscode.OutputChannel
): void {
  debugOutput.appendLine(`Registering single environment mode: ${env.name}`);

  // Set context for single mode
  vscode.commands.executeCommand("setContext", "contextEditor.mode", "single");

  // Create providers
  const globalProvider = new GlobalProvider(env.configPath, env.name);
  const projectProvider = new ProjectProvider(env.configPath);

  // Register views
  vscode.window.registerTreeDataProvider("contextEditorPrimaryGlobal", globalProvider);
  vscode.window.registerTreeDataProvider("contextEditorPrimaryProjects", projectProvider);

  // Subscribe providers to refresh event
  const refreshSubscription = refreshEventEmitter.event(() => {
    globalProvider.refresh();
    projectProvider.refresh();
  });
  context.subscriptions.push(refreshSubscription);
}

/**
 * Register views for multi-environment mode (Windows + WSL).
 */
function registerMultiEnvironments(
  context: vscode.ExtensionContext,
  environments: Environment[],
  debugOutput: vscode.OutputChannel
): void {
  debugOutput.appendLine("Registering multi-environment mode");

  // Set context for multi mode
  vscode.commands.executeCommand("setContext", "contextEditor.mode", "multi");

  for (const env of environments) {
    debugOutput.appendLine(`  Registering ${env.name} view`);

    // Set availability context
    vscode.commands.executeCommand("setContext", `contextEditor.${env.id}Available`, true);

    // Determine view ID prefix
    const viewPrefix = env.id === "windows" ? "contextEditorWindows" : "contextEditorWsl";

    // Create providers
    const globalProvider = new GlobalProvider(env.configPath, env.name);
    const projectProvider = new ProjectProvider(env.configPath);

    // Register views
    vscode.window.registerTreeDataProvider(`${viewPrefix}Global`, globalProvider);
    vscode.window.registerTreeDataProvider(`${viewPrefix}Projects`, projectProvider);

    // Subscribe providers to refresh event
    const refreshSubscription = refreshEventEmitter.event(() => {
      globalProvider.refresh();
      projectProvider.refresh();
    });
    context.subscriptions.push(refreshSubscription);
  }
}

/**
 * Register commands that are shared across all modes.
 */
function registerSharedCommands(
  context: vscode.ExtensionContext,
  debugOutput: vscode.OutputChannel
): void {
  // Show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    debugOutput.show();
  });
  context.subscriptions.push(showDebugCommand);

  // Global refresh command - triggers all subscribed providers to refresh
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", () => {
    refreshEventEmitter.fire();
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
