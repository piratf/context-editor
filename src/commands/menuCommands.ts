/**
 * Context Menu Command Implementations
 *
 * Pure command implementations that don't depend on vscode directly.
 * All UI operations go through UserInteraction adapter.
 * VS Code-specific operations (like refresh) are passed as callbacks.
 */

import type { SimpleDIContainer } from "../di/container.js";
import { ServiceTokens } from "../di/tokens.js";
import type { ContextMenuCommand } from "../types/contextMenu.js";
import { ContextKeys } from "../types/contextMenu.js";
import type { NodeData } from "../types/nodeData.js";
import { isDirectoryData } from "../types/nodeData.js";

/**
 * Copy Name Command
 */
export const copyNameCommand: ContextMenuCommand = {
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
export const copyPathCommand: ContextMenuCommand = {
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
export const deleteCommand: ContextMenuCommand = {
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
export const openVscodeCommand: ContextMenuCommand = {
  contextKey: ContextKeys.CAN_OPEN_IN_VSCODE,

  canExecute: (node: NodeData): boolean => {
    // Directories with a non-empty path can be opened
    return isDirectoryData(node) && node.path.length > 0;
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
 * Create File Command
 */
export const createFileCommand: ContextMenuCommand = {
  contextKey: ContextKeys.CAN_CREATE_FILE,

  canExecute: (node: NodeData): boolean => {
    // Can only create files in directories with a non-empty path
    return isDirectoryData(node) && node.path.length > 0;
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const fileCreationService = container.get(ServiceTokens.FileCreationService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const result = await fileCreationService.createFile(node);

    if (!result.success) {
      if (result.reason === "cancelled") {
        // User cancelled, do nothing
        return;
      }
      if (result.reason === "notDirectory") {
        userInteraction.showError("Cannot create file", "Selected item is not a directory.");
      } else if (result.reason === "noPath") {
        userInteraction.showError("Cannot create file", "Directory path is missing.");
      } else {
        userInteraction.showError("Failed to create file", result.error?.message ?? "Unknown error");
      }
    }
  },
};

/**
 * Create Folder Command
 */
export const createFolderCommand: ContextMenuCommand = {
  contextKey: ContextKeys.CAN_CREATE_FOLDER,

  canExecute: (node: NodeData): boolean => {
    // Can only create folders in directories with a non-empty path
    return isDirectoryData(node) && node.path.length > 0;
  },

  execute: async (node: NodeData, container: SimpleDIContainer): Promise<void> => {
    const fileCreationService = container.get(ServiceTokens.FileCreationService);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const result = await fileCreationService.createFolder(node);

    if (!result.success) {
      if (result.reason === "cancelled") {
        // User cancelled, do nothing
        return;
      }
      if (result.reason === "notDirectory") {
        userInteraction.showError("Cannot create folder", "Selected item is not a directory.");
      } else if (result.reason === "noPath") {
        userInteraction.showError("Cannot create folder", "Directory path is missing.");
      } else {
        userInteraction.showError("Failed to create folder", result.error?.message ?? "Unknown error");
      }
    }
  },
};

/**
 * All registered commands
 */
export const ALL_COMMANDS: readonly ContextMenuCommand[] = [
  copyNameCommand,
  copyPathCommand,
  createFileCommand,
  createFolderCommand,
  deleteCommand,
  openVscodeCommand,
] as const;
