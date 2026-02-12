/**
 * FileCreationService - Business logic for file/directory creation
 *
 * This service handles creation operations with proper error handling
 * and user input dialogs. No dependency on VS Code types -
 * all UI operations are abstracted through interfaces.
 *
 * Architecture:
 * - Service layer: Contains creation business logic
 * - Depends on interfaces: FileCreator, InputService
 * - Returns pure data results (CreateResult)
 */

import type { SimpleUri, FileCreator, InputService } from "../adapters/vscode.js";
import type { NodeData } from "../types/nodeData.js";
import { isDirectoryData } from "../types/nodeData.js";

/**
 * Result of a create operation
 */
export type CreateResult =
  | { readonly success: true; readonly createdPath: string }
  | {
      readonly success: false;
      readonly reason: "notDirectory" | "noPath" | "cancelled" | "error";
      readonly error?: Error;
    };

/**
 * Service for file/directory creation operations
 */
export class FileCreationService {
  constructor(
    private readonly fileCreator: FileCreator,
    private readonly inputService: InputService
  ) {}

  /**
   * Create a new file in given directory node
   *
   * @param node - Directory node where file should be created
   * @returns Result indicating success/failure
   */
  async createFile(node: NodeData): Promise<CreateResult> {
    // Check if node is a directory
    if (!isDirectoryData(node)) {
      return {
        success: false,
        reason: "notDirectory",
        error: new Error("Cannot create file in non-directory node"),
      };
    }

    // Check if node has a path
    if (node.path === undefined || node.path.length === 0) {
      return {
        success: false,
        reason: "noPath",
        error: new Error("Cannot create file - node has no path"),
      };
    }

    // We now know node.path is defined and non-empty
    const nodePath = node.path;

    // Ask user for file name
    const fileName = await this.inputService.showInputBox({
      title: "Create File",
      prompt: `Enter file name to create in "${node.label}"`,
      placeHolder: "filename.md",
      validateInput: (value: string): string | undefined => {
        if (!value || value.trim().length === 0) {
          return "File name cannot be empty";
        }
        // Basic validation - check for invalid characters
        if (/[<>:"|?*]/.test(value)) {
          return "File name contains invalid characters";
        }
        return undefined;
      },
    });

    if (fileName === undefined) {
      return { success: false, reason: "cancelled" };
    }

    const trimmedFileName = fileName.trim();
    const newFilePath = `${nodePath}/${nodePath.endsWith("/") ? "" : "/"}${trimmedFileName}`;

    try {
      const uri: SimpleUri = { path: newFilePath };
      await this.fileCreator.createFile(uri, {
        overwrite: false,
        createParentDirectories: false,
      });
      return { success: true, createdPath: newFilePath };
    } catch (error) {
      return {
        success: false,
        reason: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Create a new folder in given directory node
   *
   * @param node - Directory node where folder should be created
   * @returns Result indicating success/failure
   */
  async createFolder(node: NodeData): Promise<CreateResult> {
    // Check if node is a directory
    if (!isDirectoryData(node)) {
      return {
        success: false,
        reason: "notDirectory",
        error: new Error("Cannot create folder in non-directory node"),
      };
    }

    // Check if node has a path
    if (node.path === undefined || node.path.length === 0) {
      return {
        success: false,
        reason: "noPath",
        error: new Error("Cannot create folder - node has no path"),
      };
    }

    // We now know node.path is defined and non-empty
    const nodePath = node.path;

    // Ask user for folder name
    const folderName = await this.inputService.showInputBox({
      title: "Create Folder",
      prompt: `Enter folder name to create in "${node.label}"`,
      placeHolder: "new-folder",
      validateInput: (value: string): string | undefined => {
        if (!value || value.trim().length === 0) {
          return "Folder name cannot be empty";
        }
        // Basic validation - check for invalid characters
        if (/[<>:"|?*]/.test(value)) {
          return "Folder name contains invalid characters";
        }
        return undefined;
      },
    });

    if (folderName === undefined) {
      return { success: false, reason: "cancelled" };
    }

    const trimmedFolderName = folderName.trim();
    const newFolderPath = `${nodePath}/${nodePath.endsWith("/") ? "" : "/"}${trimmedFolderName}`;

    try {
      const uri: SimpleUri = { path: newFolderPath };
      await this.fileCreator.createDirectory(uri);
      return { success: true, createdPath: newFolderPath };
    } catch (error) {
      return {
        success: false,
        reason: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }
}

/**
 * Factory for creating FileCreationService instances
 */
export const FileCreationServiceFactory = {
  /**
   * Create a FileCreationService with provided dependencies
   */
  create(fileCreator: FileCreator, inputService: InputService): FileCreationService {
    return new FileCreationService(fileCreator, inputService);
  },
} as const;
