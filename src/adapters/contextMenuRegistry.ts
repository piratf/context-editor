/**
 * Context Menu Registry (Adapter Layer)
 *
 * Central registry for all context menu commands.
 * Lives in adapters/ because it depends on vscode for command registration.
 *
 * Provides:
 * - Command registration with VS Code
 * - Context value generation (by checking all commands)
 * - Command implementations (decoupled from vscode via UserInteraction adapter)
 */

import * as vscode from "vscode";
import type { NodeData } from "../types/nodeData.js";
import { isNodeData, isDirectoryData } from "../types/nodeData.js";
import type { ContextMenuCommand } from "../types/contextMenu.js";
import { ContextKeys } from "../types/contextMenu.js";
import type { SimpleDIContainer } from "../di/container.js";
import { ServiceTokens } from "../di/tokens.js";
import { MenuCommands } from "../commands/contextMenu.js";

/**
 * Extract NodeData from command argument
 */
function extractNodeData(node: unknown): NodeData | null {
  return isNodeData(node) ? node : null;
}

/**
 * Copy Name Command
 */
const copyNameCommand: ContextMenuCommand = {
  contextKey: ContextKeys.HAS_NAME_TO_COPY,

  canExecute: (node: NodeData): boolean => {
    return node.label.length > 0;
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const copyService = container.get(ServiceTokens.CopyService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const result = await copyService.copyName(node);

    if (result.success) {
      userInteraction.showInfo(`Copied name: ${result.copiedText}`);
    } else {
      userInteraction.showError("Failed to copy name", result.error?.message ?? "Unknown error");
    }
  },
};

/**
 * Copy Path Command
 */
const copyPathCommand: ContextMenuCommand = {
  contextKey: ContextKeys.HAS_COPYABLE_PATH,

  canExecute: (node: NodeData, container: SimpleDIContainer): boolean => {
    const copyService = container.get(ServiceTokens.CopyService);
    return copyService.hasCopyablePath(node);
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const copyService = container.get(ServiceTokens.CopyService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const result = await copyService.copyPath(node);

    if (result.success) {
      userInteraction.showInfo(`Copied path: ${result.copiedText}`);
    } else if (result.reason === "no_path") {
      userInteraction.showError("Cannot copy path", "Selected item has no path.");
    } else {
      userInteraction.showError("Failed to copy path", result.error?.message ?? "Unknown error");
    }
  },
};

/**
 * Delete Command
 */
const deleteCommand: ContextMenuCommand = {
  contextKey: ContextKeys.CAN_DELETE,

  canExecute: (node: NodeData, container: SimpleDIContainer): boolean => {
    const deleteService = container.get(ServiceTokens.DeleteService);
    return deleteService.canDelete(node);
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const deleteService = container.get(ServiceTokens.DeleteService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const hasPath = node.path !== undefined && node.path.length > 0;
    const confirmMessage = hasPath
      ? `Are you sure you want to delete "${node.label}"?\n\n${node.path}`
      : `Are you sure you want to delete "${node.label}"?`;

    const confirmed = await userInteraction.showWarningMessage(
      confirmMessage,
      { modal: true },
      "Delete"
    );

    if (confirmed !== "Delete") return;

    const result = await deleteService.execute(node);

    if (result.success) {
      userInteraction.showInfo(`Deleted: ${node.label} (${result.method})`);
      // Refresh view - this is a VS Code operation, kept minimal
      await vscode.commands.executeCommand("contextEditor.refresh");
    } else if (result.reason === "cancelled") {
      userInteraction.showInfo("Deletion cancelled");
    } else {
      userInteraction.showError("Failed to delete", result.error?.message ?? "Unknown error");
    }
  },
};

/**
 * Open VSCode Command
 */
const openVscodeCommand: ContextMenuCommand = {
  contextKey: ContextKeys.CAN_OPEN_IN_VSCODE,

  canExecute: (node: NodeData): boolean => {
    // Directories with a non-empty path can be opened
    if (!isDirectoryData(node)) {
      return false;
    }
    return node.path.length > 0;
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const openVscodeService = container.get(ServiceTokens.OpenVscodeService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const result = await openVscodeService.execute(node);

    if (!result.success) {
      if (result.reason === "notDirectory") {
        userInteraction.showError("Cannot open", "Selected item is not a directory.");
      } else if (result.reason === "noPath") {
        userInteraction.showError("Cannot open", "Directory path is missing.");
      } else if (result.reason === "error") {
        userInteraction.showError("Failed to open", result.error?.message ?? "Unknown error");
      }
    }
  },
};

/**
 * All registered commands
 */
const ALL_COMMANDS: readonly ContextMenuCommand[] = [
  copyNameCommand,
  copyPathCommand,
  deleteCommand,
  openVscodeCommand,
] as const;

/**
 * Context Menu Registry
 *
 * Lives in adapter layer because it depends on vscode for command registration.
 * Command implementations are decoupled from vscode via UserInteraction adapter.
 */
export class ContextMenuRegistry {
  constructor(private readonly container: SimpleDIContainer) {}

  /**
   * Get context value for a node
   *
   * Collects contextKeys from all commands where canExecute returns true.
   * Uses space as separator (duck typing - no base type prefix).
   *
   * @param node - Node to generate context value for
   * @returns Space-separated context keys (e.g., "hasNameToCopy canDelete")
   */
  buildContextValue(node: NodeData): string {
    const keys: string[] = [];

    for (const command of ALL_COMMANDS) {
      if (command.canExecute(node, this.container)) {
        keys.push(command.contextKey);
      }
    }

    return keys.join(" ");
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): readonly ContextMenuCommand[] {
    return ALL_COMMANDS;
  }

  /**
   * Register all context menu commands with VS Code
   *
   * This is the only method that directly depends on vscode.
   *
   * @param context - VS Code extension context
   */
  registerCommands(context: vscode.ExtensionContext): void {
    // Copy Name
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.COPY_NAME, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) await copyNameCommand.execute(data, this.container);
      })
    );

    // Copy Path
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.COPY_PATH, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) await copyPathCommand.execute(data, this.container);
      })
    );

    // Delete
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.DELETE, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) await deleteCommand.execute(data, this.container);
      })
    );

    // Open VSCode
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.OPEN_VSCODE, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) await openVscodeCommand.execute(data, this.container);
      })
    );
  }
}
