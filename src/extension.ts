/**
 * Context Editor Extension for VS Code.
 * Provides a tree view for managing Claude Code projects and configurations.
 */

import * as vscode from "vscode";
import { ProjectProvider } from "./views/projectProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Context Editor extension is now active!");

  // Create and register the tree data provider
  const projectProvider = new ProjectProvider();
  vscode.window.registerTreeDataProvider(
    "contextEditorProjects",
    projectProvider,
  );

  // Register the refresh command
  const refreshCommand = vscode.commands.registerCommand(
    "contextEditor.refresh",
    () => {
      projectProvider.refresh();
    },
  );

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
          `Failed to open file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );

  context.subscriptions.push(refreshCommand, openFileCommand);
}

export function deactivate(): void {
  console.log("Context Editor extension is now deactivated!");
}
