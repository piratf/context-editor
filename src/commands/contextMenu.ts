/**
 * Context menu command handlers for Context Editor tree nodes.
 *
 * Refactored to use DI container for service management:
 * - Commands extract data from nodes
 * - Services retrieved from DI container
 * - Commands handle UI feedback and refresh
 *
 * Architecture:
 * - Command Layer: Extract data, get services from container, handle UI feedback
 * - Service Layer: Business logic (delete, copy, etc.) - managed by DI container
 * - Adapter Layer: VS Code API abstractions - shared as singletons
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { isNodeData } from "../types/nodeData.js";
import { SimpleDIContainer } from "../di/container.js";
import { ServiceTokens } from "../di/tokens.js";

/**
 * DI Container instance for service retrieval
 *
 * Set during command registration and used by all command handlers.
 */
let container: SimpleDIContainer;

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
 * Gets CopyService from DI container for business logic
 */
export async function copyName(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy name", "Selected item does not support copying names.");
    return;
  }

  const copyService = container.get(ServiceTokens.CopyService);
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
 * Gets CopyService from DI container for business logic
 */
export async function copyPath(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy path", "Selected item does not support copying paths.");
    return;
  }

  const copyService = container.get(ServiceTokens.CopyService);
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
 * Gets DeleteService from DI container for business logic
 */
export async function deleteNode(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot delete", "Selected item does not support deletion.");
    return;
  }

  const deleteService = container.get(ServiceTokens.DeleteService);

  if (!deleteService.canDelete(data)) {
    showErrorMessage("Cannot delete", "This item cannot be deleted (may be a system directory).");
    return;
  }

  const confirmMessage = data.path && data.path.length > 0
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
 * Gets OpenVscodeService from DI container for business logic
 */
export async function openVscode(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot open", "Selected item is not a directory that can be opened.");
    return;
  }

  const openVscodeService = container.get(ServiceTokens.OpenVscodeService);
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
 * Called from extension.ts during activation.
 * Receives DI container and stores it for use by command handlers.
 *
 * @param context - VS Code extension context for command registration
 * @param diContainer - DI container instance for service retrieval
 */
export function registerContextMenuCommands(
  context: vscode.ExtensionContext,
  diContainer: SimpleDIContainer
): void {
  container = diContainer;

  const copyNameCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_NAME,
    async (node: unknown) => {
      await copyName(node);
    }
  );
  context.subscriptions.push(copyNameCommand);

  const copyPathCommand = vscode.commands.registerCommand(
    MenuCommands.COPY_PATH,
    async (node: unknown) => {
      await copyPath(node);
    }
  );
  context.subscriptions.push(copyPathCommand);

  const deleteCommand = vscode.commands.registerCommand(
    MenuCommands.DELETE,
    async (node: unknown) => {
      await deleteNode(node);
    }
  );
  context.subscriptions.push(deleteCommand);

  const openVscodeCommand = vscode.commands.registerCommand(
    MenuCommands.OPEN_VSCODE,
    async (node: unknown) => {
      await openVscode(node);
    }
  );
  context.subscriptions.push(openVscodeCommand);
}
