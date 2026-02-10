/**
 * Context Menu Registry (Adapter Layer)
 *
 * Central registry for all context menu commands.
 * Lives in adapters/ because it depends on vscode for command registration.
 *
 * Provides:
 * - Command registration with VS Code
 * - Context value generation (by checking all commands)
 * - VS Code-specific operations (like refresh)
 */

import * as vscode from "vscode";
import { ALL_COMMANDS } from "../commands/menuCommands.js";
import { MenuCommands } from "../commands/contextMenu.js";
import type { SimpleDIContainer } from "../di/container.js";
import type { ContextMenuCommand } from "../types/contextMenu.js";
import type { NodeData } from "../types/nodeData.js";
import { isNodeData } from "../types/nodeData.js";

/**
 * Extract NodeData from command argument
 */
function extractNodeData(node: unknown): NodeData | null {
  return isNodeData(node) ? node : null;
}

/**
 * Context Menu Registry
 *
 * Lives in adapter layer because it depends on vscode for command registration.
 * Command implementations are in commands/menuCommands.ts (no vscode dependency).
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
   * Command implementations are imported from commands/menuCommands.ts.
   *
   * @param context - VS Code extension context
   */
  async registerCommands(context: vscode.ExtensionContext): Promise<void> {
    // Import commands from pure command implementations
    const {
      copyNameCommand,
      copyPathCommand,
      deleteCommand,
      openVscodeCommand,
      createFileCommand,
      createFolderCommand,
    } = await import("../commands/menuCommands.js");

    // Copy Name
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.COPY_NAME, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) {
          await copyNameCommand.execute(data, this.container);
        }
      })
    );

    // Copy Path
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.COPY_PATH, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) {
          await copyPathCommand.execute(data, this.container);
        }
      })
    );

    // Delete
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.DELETE, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) {
          await deleteCommand.execute(data, this.container);
          // Refresh view after successful delete
          await vscode.commands.executeCommand("contextEditor.refresh");
        }
      })
    );

    // Open VSCode
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.OPEN_VSCODE, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) await openVscodeCommand.execute(data, this.container);
      })
    );

    // Create File
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.CREATE_FILE, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) {
          await createFileCommand.execute(data, this.container);
          // Refresh view after successful creation
          await vscode.commands.executeCommand("contextEditor.refresh");
        }
      })
    );

    // Create Folder
    context.subscriptions.push(
      vscode.commands.registerCommand(MenuCommands.CREATE_FOLDER, async (node: unknown) => {
        const data = extractNodeData(node);
        if (data) {
          await createFolderCommand.execute(data, this.container);
          // Refresh view after successful creation
          await vscode.commands.executeCommand("contextEditor.refresh");
        }
      })
    );
  }
}
