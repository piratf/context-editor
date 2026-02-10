/**
 * Context menu command handlers for Context Editor tree nodes.
 *
 * Refactored to use Service layer for business logic:
 * - Commands extract data from nodes
 * - Service layer handles business logic
 * - Commands handle UI feedback and refresh
 *
 * Architecture:
 * - Command Layer: Extract data, call services, handle UI feedback
 * - Service Layer: Business logic (delete, copy, etc.)
 * - Adapter Layer: VS Code API abstractions
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { isNodeData } from "../types/nodeData.js";
import { DeleteServiceFactory } from "../services/deleteService.js";
import { CopyServiceFactory } from "../services/copyService.js";
import { OpenVscodeServiceFactory } from "../services/openVscodeService.js";
import { VsCodeFileDeleter, VsCodeDialogService } from "../adapters/vscode.js";
import { VsCodeClipboardService, VsCodeFolderOpener } from "../adapters/ui.js";

/**
 * Menu command identifiers
 */
export const MenuCommands = {
  COPY_NAME: "contextEditor.copyName",
  COPY_PATH: "contextEditor.copyPath",
  DELETE: "contextEditor.delete",
  OPEN_VSCODE: "contextEditor.openVscode",
} as const;

/**
 * Extract NodeData from node passed to commands
 *
 * Uses Symbol-based type guard for fast, reliable runtime checking.
 * This is a single O(1) property lookup instead of 8 conditional checks.
 */
function extractNodeData(node: unknown): NodeData | null {
  return isNodeData(node) ? node : null;
}

/**
 * Copy the display name (file/directory name) to clipboard
 *
 * Uses CopyService for business logic
 */
export async function copyName(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy name", "Selected item does not support copying names.");
    return;
  }

  const clipboardService = new VsCodeClipboardService();
  const copyService = CopyServiceFactory.create(clipboardService);

  const result = await copyService.copyName(data);

  if (result.success) {
    showInfoMessage(`Copied name: ${result.copiedText}`);
  } else if (result.reason === "error") {
    showErrorMessage("Failed to copy name", result.error?.message ?? "Unknown error");
  }
}

/**
 * Copy the full file system path to clipboard
 *
 * Uses CopyService for business logic
 */
export async function copyPath(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy path", "Selected item does not support copying paths.");
    return;
  }

  const clipboardService = new VsCodeClipboardService();
  const copyService = CopyServiceFactory.create(clipboardService);

  const result = await copyService.copyPath(data);

  if (result.success) {
    showInfoMessage(`Copied path: ${result.copiedText}`);
  } else if (result.reason === "no_path") {
    showErrorMessage("Cannot copy path", "Selected item has no path.");
  } else if (result.reason === "error") {
    showErrorMessage("Failed to copy path", result.error?.message ?? "Unknown error");
  }
}

/**
 * Delete the file/directory represented by the node
 *
 * Uses DeleteService for business logic
 */
export async function deleteNode(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot delete", "Selected item does not support deletion.");
    return;
  }

  // Create service with VS Code adapters
  const fileDeleter = new VsCodeFileDeleter();
  const dialogService = new VsCodeDialogService();
  const deleteService = DeleteServiceFactory.create(fileDeleter, dialogService);

  // Check if deletion is safe
  if (!deleteService.canDelete(data)) {
    showErrorMessage("Cannot delete", "This item cannot be deleted (may be a system directory).");
    return;
  }

  // Show confirmation dialog
  const confirmMessage = data.path
    ? `Are you sure you want to delete "${data.label}"?\n\n${data.path}`
    : `Are you sure you want to delete "${data.label}"?`;

  const confirmed = await vscode.window.showWarningMessage(
    confirmMessage,
    { modal: true },
    "Delete"
  );

  if (confirmed !== "Delete") {
    return; // User cancelled
  }

  // Execute delete
  const result = await deleteService.execute(data);

  if (result.success) {
    showInfoMessage(`Deleted: ${data.label} (${result.method})`);

    // Trigger refresh of the tree view
    await vscode.commands.executeCommand("contextEditor.refresh");
  } else if (result.reason === "cancelled") {
    showInfoMessage("Deletion cancelled");
  } else if (result.reason === "error") {
    showErrorMessage("Failed to delete", result.error?.message ?? "Unknown error");
  }
}

/**
 * Open the directory in a new VS Code window
 *
 * Uses OpenVscodeService for business logic
 */
export async function openVscode(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot open", "Selected item is not a directory that can be opened.");
    return;
  }

  const folderOpener = new VsCodeFolderOpener();
  const openVscodeService = OpenVscodeServiceFactory.create(folderOpener);

  const result = await openVscodeService.execute(data);

  if (!result.success) {
    if (result.reason === "notDirectory") {
      showErrorMessage("Cannot open", "Selected item is not a directory.");
    } else if (result.reason === "noPath") {
      showErrorMessage("Cannot open", "Directory path is missing.");
    } else if (result.reason === "error") {
      showErrorMessage("Failed to open", result.error?.message ?? "Unknown error");
    }
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
