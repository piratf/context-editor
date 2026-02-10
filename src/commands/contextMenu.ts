/**
 * Context menu command handlers for Context Editor tree nodes.
 *
 * Refactored to use DI container with closure-captured services:
 * - Commands extract data from nodes
 * - Services captured as closures at registration time
 * - Commands handle UI feedback and refresh
 *
 * Architecture:
 * - Command Layer: Extract data, receive services via parameters, handle UI feedback
 * - Service Layer: Business logic (delete, copy, etc.) - singleton instances
 * - Adapter Layer: VS Code API abstractions - shared as singletons
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { isNodeData } from "../types/nodeData.js";
import { SimpleDIContainer } from "../di/container.js";
import { ServiceTokens } from "../di/tokens.js";
import type { CopyService } from "../services/copyService.js";
import type { DeleteService } from "../services/deleteService.js";
import type { OpenVscodeService } from "../services/openVscodeService.js";

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
 * @param node - Tree node to copy name from
 * @param copyService - Copy service instance (captured via closure)
 */
export async function copyName(node: unknown, copyService: CopyService): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy name", "Selected item does not support copying names.");
    return;
  }

  const result = await copyService.copyName(data);

  if (result.success) {
    showInfoMessage(`Copied name: ${result.copiedText}`);
  } else {
    showErrorMessage("Failed to copy name", result.error?.message ?? "Unknown error");
  }
}

/**
 * Copy the full file system path to clipboard
 *
 * @param node - Tree node to copy path from
 * @param copyService - Copy service instance (captured via closure)
 */
export async function copyPath(node: unknown, copyService: CopyService): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy path", "Selected item does not support copying paths.");
    return;
  }

  const result = await copyService.copyPath(data);

  if (result.success) {
    showInfoMessage(`Copied path: ${result.copiedText}`);
  } else if (result.reason === "no_path") {
    showErrorMessage("Cannot copy path", "Selected item has no path.");
  } else {
    showErrorMessage("Failed to copy path", result.error?.message ?? "Unknown error");
  }
}

/**
 * Delete the file/directory represented by the node
 *
 * @param node - Tree node to delete
 * @param deleteService - Delete service instance (captured via closure)
 */
export async function deleteNode(node: unknown, deleteService: DeleteService): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot delete", "Selected item does not support deletion.");
    return;
  }

  if (!deleteService.canDelete(data)) {
    showErrorMessage("Cannot delete", "This item cannot be deleted (may be a system directory).");
    return;
  }

  const confirmMessage = data.path !== undefined && data.path.length > 0
    ? `Are you sure you want to delete "${data.label}"?\n\n${data.path}`
    : `Are you sure you want to delete "${data.label}"?`;

  const confirmed = await vscode.window.showWarningMessage(
    confirmMessage,
    { modal: true },
    "Delete"
  );

  if (confirmed !== "Delete") {
    return;
  }

  const result = await deleteService.execute(data);

  if (result.success) {
    showInfoMessage(`Deleted: ${data.label} (${result.method})`);
    await vscode.commands.executeCommand("contextEditor.refresh");
  } else if (result.reason === "cancelled") {
    showInfoMessage("Deletion cancelled");
  } else {
    showErrorMessage("Failed to delete", result.error?.message ?? "Unknown error");
  }
}

/**
 * Open the directory in a new VS Code window
 *
 * @param node - Tree node to open
 * @param openVscodeService - Open VS Code service instance (captured via closure)
 */
export async function openVscode(node: unknown, openVscodeService: OpenVscodeService): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot open", "Selected item is not a directory that can be opened.");
    return;
  }

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
 * Services are retrieved once at registration time and captured via closures.
 * This eliminates global state and makes dependencies explicit in function signatures.
 *
 * @param context - VS Code extension context for command registration
 * @param container - DI container instance for service retrieval
 */
export function registerContextMenuCommands(
  context: vscode.ExtensionContext,
  container: SimpleDIContainer
): void {
  // Get singleton services once at registration time
  const copyService = container.get(ServiceTokens.CopyService);
  const deleteService = container.get(ServiceTokens.DeleteService);
  const openVscodeService = container.get(ServiceTokens.OpenVscodeService);

  // Register commands with services captured via closure
  const copyNameCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_NAME,
    async (node: unknown) => {
      await copyName(node, copyService);
    }
  );
  context.subscriptions.push(copyNameCommand);

  const copyPathCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_PATH,
    async (node: unknown) => {
      await copyPath(node, copyService);
    }
  );
  context.subscriptions.push(copyPathCommand);

  const deleteCommand = vscode.commands.registerCommand(
    MenuCommands.DELETE,
    async (node: unknown) => {
      await deleteNode(node, deleteService);
    }
  );
  context.subscriptions.push(deleteCommand);

  const openVscodeCommand = vscode.commands.registerCommand(
    MenuCommands.OPEN_VSCODE,
    async (node: unknown) => {
      await openVscode(node, openVscodeService);
    }
  );
  context.subscriptions.push(openVscodeCommand);
}
