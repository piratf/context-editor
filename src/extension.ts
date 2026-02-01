/**
 * Context Editor Extension for VS Code.
 * Provides a tree view for managing Claude Code projects and configurations.
 */

import * as vscode from "vscode";
import * as os from "node:os";
import { ProjectProvider } from "./views/projectProvider.js";
import { setDebugOutput } from "./services/claudeConfigReader.js";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Context Editor extension is now active!");

  // Create debug output channel
  const debugOutput = vscode.window.createOutputChannel("Context Editor");
  context.subscriptions.push(debugOutput);

  // Set debug output for config reader
  setDebugOutput(debugOutput);

  // Show welcome message
  debugOutput.appendLine("Context Editor extension activated");
  debugOutput.appendLine(`Config path: ${os.homedir()}/.claude.json`);

  // Create and register the tree data provider
  const projectProvider = new ProjectProvider();
  vscode.window.registerTreeDataProvider("contextEditorProjects", projectProvider);

  // Register the refresh command
  const refreshCommand = vscode.commands.registerCommand("contextEditor.refresh", () => {
    projectProvider.refresh();
  });

  // Register the show debug output command
  const showDebugCommand = vscode.commands.registerCommand("contextEditor.showDebugOutput", () => {
    debugOutput.show();
  });

  // Register the open file command
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

  context.subscriptions.push(refreshCommand, openFileCommand, showDebugCommand);
}

export function deactivate(): void {
  console.log("Context Editor extension is now deactivated!");
}
