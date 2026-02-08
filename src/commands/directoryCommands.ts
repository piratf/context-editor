/**
 * Directory-specific commands for Context Editor tree view.
 *
 * These commands provide operations specific to directory nodes:
 * - Open in new VS Code window
 * - Create new file
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import type { TreeNode } from "../types/treeNode.js";

/**
 * Open directory in a new VS Code window
 */
export async function openInNewWindow(node: unknown): Promise<void> {
  if (!isTreeNode(node) || node.path === undefined) {
    vscode.window.showWarningMessage("Cannot open: invalid directory");
    return;
  }

  try {
    // Verify it's a directory
    const stats = await fs.stat(node.path);
    if (!stats.isDirectory()) {
      vscode.window.showWarningMessage("Can only open directories in new window");
      return;
    }

    const uri = vscode.Uri.file(node.path);
    await vscode.commands.executeCommand("vscode.openFolder", uri, {
      forceNewWindow: true,
    });
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    vscode.window.showErrorMessage(`Failed to open directory: ${errorObj.message}`);
  }
}

/**
 * Create a new file in the selected directory
 */
export async function createNewFile(node: unknown): Promise<void> {
  if (!isTreeNode(node) || node.path === undefined) {
    vscode.window.showWarningMessage("Cannot create file: invalid directory");
    return;
  }

  try {
    // Verify it's a directory
    const stats = await fs.stat(node.path);
    if (!stats.isDirectory()) {
      vscode.window.showWarningMessage("Can only create files in directories");
      return;
    }

    // Prompt for file name
    const fileName = await vscode.window.showInputBox({
      prompt: "Enter file name",
      placeHolder: "filename.txt",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "File name cannot be empty";
        }
        // Check for invalid characters
        if (/[<>:"|?*]/.test(value)) {
          return "File name contains invalid characters";
        }
        return null;
      },
    });

    if (fileName === undefined) {
      return; // User cancelled
    }

    const filePath = `${node.path}/${fileName}`;

    // Check if file already exists
    try {
      await fs.access(filePath);
      const overwrite = await vscode.window.showWarningMessage(
        `File "${fileName}" already exists. Do you want to overwrite it?`,
        "Overwrite",
        "Cancel"
      );

      if (overwrite !== "Overwrite") {
        return;
      }
    } catch {
      // File doesn't exist, which is fine
    }

    // Create the file
    await fs.writeFile(filePath, "", { encoding: "utf-8" });

    // Open the new file in editor
    const uri = vscode.Uri.file(filePath);
    await vscode.commands.executeCommand("vscode.open", uri);

    vscode.window.showInformationMessage(`Created file: ${fileName}`);

    // Refresh the tree view
    await vscode.commands.executeCommand("contextEditor.refresh");
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    vscode.window.showErrorMessage(`Failed to create file: ${errorObj.message}`);
  }
}

/**
 * Type guard to check if value is a TreeNode
 */
function isTreeNode(value: unknown): value is TreeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "label" in value &&
    "collapsibleState" in value
  );
}
