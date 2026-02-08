/**
 * Context menu command handlers for Context Editor tree nodes.
 *
 * Uses type guards to ensure nodes implement required interfaces before executing commands.
 * Provides user feedback for errors and edge cases.
 *
 * Architecture:
 * - Commands receive TreeNode or unknown from VS Code
 * - Type guards check interface implementation (ICopyable, IDeletable, IOpenableInVscode)
 * - Interface methods are called to execute the action
 * - User feedback provided for success/error
 */

import * as vscode from "vscode";
import {
  isCopyable,
  isDeletable,
  isOpenableInVscode,
  MenuCommands,
} from "../types/menuInterfaces.js";

/**
 * Copy the display name (file/directory name) to clipboard
 *
 * Requires node to implement ICopyable interface
 */
export async function copyName(node: unknown): Promise<void> {
  if (!isCopyable(node)) {
    showErrorMessage("Cannot copy name", "Selected item does not support copying names.");
    return;
  }

  try {
    const name = node.getDisplayName();
    await vscode.env.clipboard.writeText(name);
    showInfoMessage(`Copied name: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorMessage("Failed to copy name", errorMessage);
  }
}

/**
 * Copy the full file system path to clipboard
 *
 * Requires node to implement ICopyable interface
 */
export async function copyPath(node: unknown): Promise<void> {
  if (!isCopyable(node)) {
    showErrorMessage("Cannot copy path", "Selected item does not support copying paths.");
    return;
  }

  try {
    const path = node.getAccessiblePath();
    await vscode.env.clipboard.writeText(path);
    showInfoMessage(`Copied path: ${path}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorMessage("Failed to copy path", errorMessage);
  }
}

/**
 * Delete the file/directory represented by the node
 *
 * Requires node to implement IDeletable interface
 * Shows confirmation dialog before deleting
 */
export async function deleteNode(node: unknown): Promise<void> {
  if (!isDeletable(node)) {
    showErrorMessage("Cannot delete", "Selected item does not support deletion.");
    return;
  }

  // Check if deletion is safe
  if (!node.canDelete()) {
    showErrorMessage("Cannot delete", "This item cannot be deleted (may be a system directory).");
    return;
  }

  // Get path for confirmation message
  let itemPath = "";
  let itemName = "";

  // Try to get path information for confirmation
  if ("getAccessiblePath" in node && typeof node.getAccessiblePath === "function") {
    itemPath = (node as { getAccessiblePath(): string }).getAccessiblePath();
  }

  if ("getDisplayName" in node && typeof node.getDisplayName === "function") {
    itemName = (node as { getDisplayName(): string }).getDisplayName();
  }

  const confirmMessage = itemPath
    ? `Are you sure you want to delete "${itemName}"?\n\n${itemPath}`
    : `Are you sure you want to delete "${itemName}"?`;

  // Show confirmation dialog
  const confirmed = await vscode.window.showWarningMessage(
    confirmMessage,
    { modal: true },
    "Delete"
  );

  if (confirmed !== "Delete") {
    return; // User cancelled
  }

  try {
    await node.delete();
    showInfoMessage(`Deleted: ${itemName}`);

    // Trigger refresh of the tree view
    await vscode.commands.executeCommand("contextEditor.refresh");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorMessage("Failed to delete", errorMessage);
  }
}

/**
 * Open the directory in a new VS Code window
 *
 * Requires node to implement IOpenableInVscode interface
 */
export async function openVscode(node: unknown): Promise<void> {
  if (!isOpenableInVscode(node)) {
    showErrorMessage("Cannot open", "Selected item is not a directory that can be opened.");
    return;
  }

  try {
    await node.openInNewWindow();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorMessage("Failed to open in new window", errorMessage);
  }
}

/**
 * Show an information message to the user
 */
function showInfoMessage(message: string): void {
  void vscode.window.showInformationMessage(message);
}

/**
 * Show an error message to the user
 */
function showErrorMessage(title: string, message: string): void {
  void vscode.window.showErrorMessage(`${title}: ${message}`);
}

/**
 * Register all context menu commands with VS Code
 *
 * Called from extension.ts during activation
 */
export function registerContextMenuCommands(
  context: vscode.ExtensionContext
): void {
  // Register copyName command
  const copyNameCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_NAME,
    async (node: unknown) => {
      await copyName(node);
    }
  );
  context.subscriptions.push(copyNameCommand);

  // Register copyPath command
  const copyPathCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_PATH,
    async (node: unknown) => {
      await copyPath(node);
    }
  );
  context.subscriptions.push(copyPathCommand);

  // Register delete command
  const deleteCommand = vscode.commands.registerCommand(
    MenuCommands.DELETE,
    async (node: unknown) => {
      await deleteNode(node);
    }
  );
  context.subscriptions.push(deleteCommand);

  // Register openVscode command
  const openVscodeCommand = vscode.commands.registerCommand(
    MenuCommands.OPEN_VSCODE,
    async (node: unknown) => {
      await openVscode(node);
    }
  );
  context.subscriptions.push(openVscodeCommand);
}
