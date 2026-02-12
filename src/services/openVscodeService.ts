/**
 * OpenVscodeService - Opens directories in new VS Code windows
 *
 * This service handles the business logic for opening directories
 * in new VS Code windows, completely decoupled from VS Code
 * through dependency injection.
 *
 * Architecture:
 * - Business logic separated from VS Code API
 * - Uses VsCodeOpener interface for testability
 * - Returns pure data results
 */

import type { NodeData } from "../types/nodeData.js";
import { isDirectoryData } from "../types/nodeData.js";

/**
 * Result of opening a directory
 */
export interface OpenVscodeResult {
  readonly success: boolean;
  readonly reason?: "notDirectory" | "noPath" | "error";
  readonly error?: Error;
}

/**
 * VS Code opener interface
 *
 * Abstracts VS Code API for opening folders in new windows
 */
export interface VsCodeOpener {
  /**
   * Open a folder in a new VS Code window
   * @param folderPath - The path to the folder to open
   */
  openFolderInNewWindow(folderPath: string): Promise<void>;
}

/**
 * Service for opening directories in new VS Code windows
 */
export class OpenVscodeService {
  constructor(private readonly vsCodeOpener: VsCodeOpener) {}

  /**
   * Execute opening a directory in a new VS Code window
   *
   * @param data - Node data to open
   * @returns Result indicating success or failure reason
   */
  async execute(data: NodeData): Promise<OpenVscodeResult> {
    // Validate that it's a directory
    if (!isDirectoryData(data)) {
      return {
        success: false,
        reason: "notDirectory",
      };
    }

    // Validate path exists (handle undefined and empty string cases)
    if (data.path === undefined || data.path === "") {
      return {
        success: false,
        reason: "noPath",
      };
    }

    // We now know data.path is defined and non-empty
    const dataPath = data.path;

    try {
      await this.vsCodeOpener.openFolderInNewWindow(dataPath);
      return { success: true };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        reason: "error",
        error: errorObj,
      };
    }
  }
}

/**
 * Factory for creating OpenVscodeService instances
 */
export const OpenVscodeServiceFactory = {
  create(vsCodeOpener: VsCodeOpener): OpenVscodeService {
    return new OpenVscodeService(vsCodeOpener);
  },
};
