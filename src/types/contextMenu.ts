/**
 * Context menu types
 *
 * Defines the interface for context menu commands and constants.
 */

import type { NodeData } from "./nodeData.js";
import type { SimpleDIContainer } from "../di/container.js";

/**
 * Context menu command interface
 *
 * Each command is self-describing:
 * - contextKey: The marker for VS Code when clause
 * - canExecute: Check if command can run on this node (uses services)
 * - execute: Command handler (uses UserInteraction adapter for UI)
 */
export interface ContextMenuCommand {
  /**
   * Context key for this command
   * Used in VS Code when clauses and in contextValue
   */
  readonly contextKey: string;

  /**
   * Check if this command can execute on the given node
   * Delegates to service layer for business logic
   *
   * @param node - Node to check
   * @param container - DI container for accessing services
   * @returns true if command can execute
   */
  canExecute(node: NodeData, container: SimpleDIContainer): boolean;

  /**
   * Execute the command
   * Uses UserInteraction adapter for UI feedback (decoupled from vscode)
   *
   * @param node - Node to execute command on
   * @param container - DI container for accessing services
   */
  execute(node: NodeData, container: SimpleDIContainer): Promise<void>;
}

/**
 * Context key constants
 *
 * Naming convention: verb+able (based on Service method names)
 */
export const ContextKeys = {
  HAS_NAME_TO_COPY: "hasNameToCopy",
  HAS_COPYABLE_PATH: "hasCopyablePath",
  CAN_DELETE: "canDelete",
  CAN_OPEN_IN_VSCODE: "canOpenInVscode",
  CAN_CREATE_FILE: "canCreateFile",
  CAN_CREATE_FOLDER: "canCreateFolder",
} as const;
