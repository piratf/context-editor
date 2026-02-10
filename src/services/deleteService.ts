/**
 * DeleteService - Business logic for file/directory deletion
 *
 * This service handles deletion operations with proper error handling
 * and user confirmation dialogs. No dependency on VS Code types -
 * all UI operations are abstracted through interfaces.
 *
 * Architecture:
 * - Service layer: Contains deletion business logic
 * - Depends on interfaces: FileDeleter, DialogService
 * - Returns pure data results (DeleteResult)
 */

import type { SimpleUri, FileDeleter, DialogService } from "../adapters/vscode.js";
import type { NodeData } from "../types/nodeData.js";

/**
 * Result of a delete operation
 */
export type DeleteResult =
  | { readonly success: true; readonly method: "trash" | "permanent" }
  | { readonly success: false; readonly reason: "cancelled" | "error"; readonly error?: Error };

/**
 * Service for file/directory deletion operations
 */
export class DeleteService {
  constructor(
    private readonly fileDeleter: FileDeleter,
    private readonly dialogService: DialogService
  ) {}

  /**
   * Delete a file/directory with trash fallback
   *
   * Attempts to use trash first (safer), falls back to permanent delete
   * if trash is not supported (e.g., WSL remote, Windows files from WSL).
   *
   * @param data - Node data to delete
   * @returns Result indicating success/failure and method used
   */
  async execute(data: NodeData): Promise<DeleteResult> {
    if (!data.path) {
      return {
        success: false,
        reason: "error",
        error: new Error("Cannot delete node without path"),
      };
    }

    const uri: SimpleUri = { path: data.path };
    return this.deleteWithTrashFallback(uri, data.label);
  }

  /**
   * Core delete logic with trash fallback
   *
   * This function has NO dependency on vscode types - all dependencies
   * are injected through interfaces (FileDeleter, DialogService).
   *
   * @param uri - URI of the file/directory to delete
   * @param itemName - Display name for user messages
   * @returns Result indicating success/failure and method used
   */
  private async deleteWithTrashFallback(
    uri: SimpleUri,
    itemName: string
  ): Promise<DeleteResult> {
    try {
      // Try to delete with trash first (safer)
      await this.fileDeleter.delete(uri, {
        recursive: true,
        useTrash: true,
      });
      return { success: true, method: "trash" };
    } catch (error) {
      // Check if error is about trash/recycle bin not being supported
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check for various trash/recycle bin error patterns:
      // - WSL: "Unable to delete file via trash because provider does not support it"
      // - Windows: "Failed to move '...' to the recycle bin" or similar
      const isTrashError =
        (errorMessage.includes("trash") || errorMessage.includes("recycle")) &&
        (errorMessage.includes("does not support") ||
         errorMessage.includes("Failed to move") ||
         errorMessage.includes("Failed to perform delete"));

      if (isTrashError) {
        // Trash/recycle bin not supported, ask user if they want to permanently delete
        const confirmed = await this.dialogService.showWarningMessage(
          `Cannot move to trash (file system does not support it).\n\nDo you want to permanently delete "${itemName}"?`,
          { modal: true },
          "Delete Permanently"
        );

        if (confirmed !== "Delete Permanently") {
          return { success: false, reason: "cancelled" };
        }

        // Delete permanently
        await this.fileDeleter.delete(uri, {
          recursive: true,
          useTrash: false,
        });
        return { success: true, method: "permanent" };
      } else {
        // Re-throw other errors
        return {
          success: false,
          reason: "error",
          error: error instanceof Error ? error : new Error(errorMessage),
        };
      }
    }
  }

  /**
   * Check if a node can be safely deleted
   *
   * @param data - Node data to check
   * @returns true if the node can be safely deleted
   */
  canDelete(data: NodeData): boolean {
    // Don't allow deleting if no path
    if (!data.path) {
      return false;
    }

    // Additional safety checks could go here
    // For example, check if it's a home directory, system directory, etc.
    return true;
  }
}

/**
 * Factory for creating DeleteService instances
 */
export const DeleteServiceFactory = {
  /**
   * Create a DeleteService with provided dependencies
   */
  create(
    fileDeleter: FileDeleter,
    dialogService: DialogService
  ): DeleteService {
    return new DeleteService(fileDeleter, dialogService);
  },
} as const;
