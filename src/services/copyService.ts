/**
 * CopyService - Business logic for copying text to clipboard
 *
 * This service handles copy operations for node names and paths.
 * No dependency on VS Code types - clipboard operations are
 * abstracted through interfaces.
 *
 * Architecture:
 * - Service layer: Contains copy business logic
 * - Depends on interface: ClipboardService
 * - Returns pure data results
 */

import type { NodeData } from "../types/nodeData.js";

/**
 * Result of a copy operation
 */
export type CopyResult =
  | { readonly success: true; readonly copiedText: string }
  | { readonly success: false; readonly reason: "no_path" | "error"; readonly error?: Error };

/**
 * Clipboard service interface
 *
 * Abstracts clipboard operations for testability
 */
export interface ClipboardService {
  /**
   * Write text to clipboard
   * @param text - Text to copy
   */
  writeText(text: string): Promise<void>;
}

/**
 * Service for copy operations
 */
export class CopyService {
  constructor(private readonly clipboardService: ClipboardService) {}

  /**
   * Copy node name to clipboard
   *
   * @param data - Node data to copy name from
   * @returns Result indicating success/failure
   */
  async copyName(data: NodeData): Promise<CopyResult> {
    const textToCopy = data.label;

    try {
      await this.clipboardService.writeText(textToCopy);
      return { success: true, copiedText: textToCopy };
    } catch (error) {
      return {
        success: false,
        reason: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Copy node path to clipboard
   *
   * @param data - Node data to copy path from
   * @returns Result indicating success/failure
   */
  async copyPath(data: NodeData): Promise<CopyResult> {
    if (!data.path) {
      return {
        success: false,
        reason: "no_path",
        error: new Error("Cannot copy path - node has no path"),
      };
    }

    try {
      await this.clipboardService.writeText(data.path);
      return { success: true, copiedText: data.path };
    } catch (error) {
      return {
        success: false,
        reason: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Check if a node has a path that can be copied
   *
   * @param data - Node data to check
   * @returns true if the node has a path
   */
  hasCopyablePath(data: NodeData): boolean {
    return data.path !== undefined && data.path !== "";
  }
}

/**
 * Factory for creating CopyService instances
 */
export const CopyServiceFactory = {
  /**
   * Create a CopyService with provided clipboard service
   */
  create(clipboardService: ClipboardService): CopyService {
    return new CopyService(clipboardService);
  },
} as const;
