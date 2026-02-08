/**
 * Batch operations for multi-select in Context Editor tree view.
 *
 * These commands handle operations on multiple selected nodes:
 * - Copy all names
 * - Copy all paths
 * - Batch delete
 * - Batch copy
 * - Batch cut
 */

import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import type { TreeNode } from "../types/treeNode.js";

/**
 * Copy all selected node names to clipboard (one per line)
 */
export async function copyNames(nodes: unknown[]): Promise<void> {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    vscode.window.showWarningMessage("No items selected");
    return;
  }

  const names = nodes
    .filter((n): n is TreeNode => isTreeNode(n))
    .map((n) => n.label)
    .join("\n");

  await vscode.env.clipboard.writeText(names);
  vscode.window.showInformationMessage(`Copied ${String(nodes.length)} item name(s)`);
}

/**
 * Copy all selected node paths to clipboard (one per line)
 */
export async function copyPaths(nodes: unknown[]): Promise<void> {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    vscode.window.showWarningMessage("No items selected");
    return;
  }

  const paths = nodes
    .filter((n): n is TreeNode => isTreeNode(n) && n.path !== undefined)
    .map((n) => n.path)
    .join("\n");

  if (paths === "") {
    vscode.window.showWarningMessage("No valid paths to copy");
    return;
  }

  await vscode.env.clipboard.writeText(paths);
  vscode.window.showInformationMessage(`Copied ${String(nodes.length)} path(s)`);
}

/**
 * Batch delete all selected nodes with confirmation
 */
export async function batchDelete(nodes: unknown[]): Promise<void> {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    vscode.window.showWarningMessage("No items selected");
    return;
  }

  const validNodes = nodes.filter((n): n is TreeNode => isTreeNode(n) && n.path !== undefined);

  if (validNodes.length === 0) {
    vscode.window.showWarningMessage("No valid items to delete");
    return;
  }

  // Confirm deletion
  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete ${String(validNodes.length)} item(s)?`,
    { modal: true },
    "Delete"
  );

  if (confirm !== "Delete") {
    return;
  }

  let deleted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const node of validNodes) {
    if (node.path === undefined) continue;
    try {
      await fs.rm(node.path, { recursive: true, force: true });
      deleted++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${node.label}: ${message}`);
    }
  }

  // Show results
  if (deleted > 0) {
    vscode.window.showInformationMessage(`Deleted ${String(deleted)} item(s)`);
  }

  if (failed > 0) {
    const errorList = errors.slice(0, 5).join("\n");
    const more = errors.length > 5 ? `\n... and ${String(errors.length - 5)} more` : "";
    vscode.window.showErrorMessage(`Failed to delete ${String(failed)} item(s):\n${errorList}${more}`);
  }

  // Refresh the tree view
  await vscode.commands.executeCommand("contextEditor.refresh");
}

/**
 * Type guard to check if value is a TreeNode
 */
function isTreeNode(value: unknown): value is TreeNode {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "label" in value &&
    "collapsibleState" in value
  );
}

/**
 * Store for copied/cut items
 */
interface ClipboardStore {
  items: TreeNode[];
  mode: "copy" | "cut";
  sourcePath?: string;
}

let clipboardStore: ClipboardStore | null = null;

/**
 * Batch copy selected nodes to internal clipboard
 */
export function batchCopy(nodes: unknown[]): void {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    vscode.window.showWarningMessage("No items selected");
    return;
  }

  const validNodes = nodes.filter((n): n is TreeNode => isTreeNode(n) && n.path !== undefined);

  if (validNodes.length === 0) {
    vscode.window.showWarningMessage("No valid items to copy");
    return;
  }

  clipboardStore = {
    items: validNodes,
    mode: "copy",
  };

  vscode.window.showInformationMessage(`Copied ${String(validNodes.length)} item(s) to clipboard`);
}

/**
 * Batch cut selected nodes to internal clipboard
 */
export function batchCut(nodes: unknown[]): void {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    vscode.window.showWarningMessage("No items selected");
    return;
  }

  const validNodes = nodes.filter((n): n is TreeNode => isTreeNode(n) && n.path !== undefined);

  if (validNodes.length === 0) {
    vscode.window.showWarningMessage("No valid items to cut");
    return;
  }

  clipboardStore = {
    items: validNodes,
    mode: "cut",
  };

  vscode.window.showInformationMessage(`Cut ${String(validNodes.length)} item(s) to clipboard`);
}

/**
 * Paste previously copied/cut items
 */
export async function paste(target: unknown): Promise<void> {
  if (clipboardStore === null || clipboardStore.items.length === 0) {
    vscode.window.showInformationMessage("Nothing to paste");
    return;
  }

  if (!isTreeNode(target) || target.path === undefined) {
    vscode.window.showWarningMessage("Invalid paste target");
    return;
  }

  // Verify target is a directory
  try {
    const stats = await fs.stat(target.path);
    if (!stats.isDirectory()) {
      vscode.window.showWarningMessage("Can only paste into directories");
      return;
    }
  } catch {
    vscode.window.showWarningMessage("Cannot access target directory");
    return;
  }

  const targetPath = target.path;
  let pasted = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of clipboardStore.items) {
    if (item.path === undefined) continue;

    const itemName = item.label;
    const destPath = `${targetPath}/${itemName}`;

    try {
      if (clipboardStore.mode === "copy") {
        await fs.cp(item.path, destPath, { recursive: true });
      } else {
        // For cut, we need to move
        await fs.rename(item.path, destPath);
      }
      pasted++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${itemName}: ${message}`);
    }
  }

  // Show results
  if (pasted > 0) {
    const action = clipboardStore.mode === "copy" ? "copied" : "moved";
    vscode.window.showInformationMessage(`${String(pasted)} item(s) ${action}`);
  }

  if (failed > 0) {
    const errorList = errors.slice(0, 5).join("\n");
    const more = errors.length > 5 ? `\n... and ${String(errors.length - 5)} more` : "";
    vscode.window.showErrorMessage(`Failed to paste ${String(failed)} item(s):\n${errorList}${more}`);
  }

  // Clear clipboard after paste if it was a cut operation
  if (clipboardStore.mode === "cut") {
    clipboardStore = null;
  }

  // Refresh the tree view
  await vscode.commands.executeCommand("contextEditor.refresh");
}

/**
 * Get clipboard store for testing purposes
 */
export function getClipboardStore(): ClipboardStore | null {
  return clipboardStore;
}

/**
 * Clear clipboard store
 */
export function clearClipboardStore(): void {
  clipboardStore = null;
}
