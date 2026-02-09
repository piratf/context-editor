/**
 * Unified tree node type system for Context Editor views.
 * Provides a common interface for all tree nodes across providers.
 */

import * as vscode from "vscode";
import { buildContextValue, CONTEXT_MARKERS } from "./menuInterfaces.js";

/**
 * Tree node types - unified across all providers
 */
export enum NodeType {
  ROOT = "root",
  DIRECTORY = "directory",
  FILE = "file",
  CLAUDE_JSON = "claudeJson",
  ERROR = "error",
}

/**
 * Collapsible state enum (0=none, 1=collapsed, 2=expanded)
 * Using number to match CollapsibleState from claudeConfig.ts
 */
export type CollapsibleState = 0 | 1 | 2;

/**
 * Base interface for all tree nodes
 * This is a read-only interface to ensure immutability
 */
export interface TreeNode {
  /** Type of the node */
  readonly type: NodeType;
  /** Display label */
  readonly label: string;
  /** File system path (if applicable) */
  readonly path?: string;
  /** Collapsible state */
  readonly collapsibleState: CollapsibleState;
  /** Icon to display */
  readonly iconPath?: vscode.ThemeIcon;
  /** Tooltip text */
  readonly tooltip?: string;
  /** Context value for menu contributions */
  readonly contextValue?: string;
  /** Error object (for ERROR type nodes) */
  readonly error?: Error;
}

/**
 * Factory for creating tree nodes
 * Provides a centralized way to create nodes with consistent defaults
 */
export const TreeNodeFactory = {
  /**
   * Create a directory node with menu markers
   * Automatically adds copyable, deletable, and openableInVscode markers
   */
  createDirectory(
    label: string,
    path: string,
    options: {
      collapsibleState?: CollapsibleState;
      tooltip?: string;
      contextValue?: string;
      iconId?: string;
    } = {}
  ): TreeNode {
    const { collapsibleState = 1, tooltip, contextValue, iconId } = options;

    // Use provided contextValue as base type, otherwise default to "directory"
    // Then add menu interface markers
    const baseType = contextValue ?? "directory";
    const finalContextValue = buildContextValue(baseType, [
      CONTEXT_MARKERS.COPYABLE,
      CONTEXT_MARKERS.DELETABLE,
      CONTEXT_MARKERS.OPENABLE_IN_VSCODE,
    ]);

    return {
      type: NodeType.DIRECTORY,
      label,
      path,
      collapsibleState,
      // Only set iconPath for non-collapsible nodes (leaf nodes) to avoid VS Code indentation issues
      ...(collapsibleState === 0 && iconId !== undefined && iconId !== "" ? { iconPath: new vscode.ThemeIcon(iconId) } : {}),
      tooltip: tooltip ?? path,
      contextValue: finalContextValue,
    };
  },

  /**
   * Create a file node with menu markers
   * Automatically adds copyable and deletable markers
   */
  createFile(
    label: string,
    path: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      iconId?: string;
    } = {}
  ): TreeNode {
    const { tooltip, contextValue, iconId = "file" } = options;

    // Use provided contextValue as base type, otherwise default to "file"
    // Then add menu interface markers
    const baseType = contextValue ?? "file";
    const finalContextValue = buildContextValue(baseType, [
      CONTEXT_MARKERS.COPYABLE,
      CONTEXT_MARKERS.DELETABLE,
    ]);

    return {
      type: NodeType.FILE,
      label,
      path,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: tooltip ?? path,
      contextValue: finalContextValue,
    };
  },

  /**
   * Create a Claude JSON config file node with menu markers
   * Automatically adds copyable and deletable markers
   */
  createClaudeJson(
    label: string,
    path: string,
    options: {
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): TreeNode {
    const { tooltip, contextValue } = options;

    // Use provided contextValue as base type, otherwise default to "claudeJson"
    // Then add menu interface markers
    const baseType = contextValue ?? "claudeJson";
    const finalContextValue = buildContextValue(baseType, [
      CONTEXT_MARKERS.COPYABLE,
      CONTEXT_MARKERS.DELETABLE,
    ]);

    return {
      type: NodeType.CLAUDE_JSON,
      label,
      path,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("settings-gear"),
      tooltip: tooltip ?? path,
      contextValue: finalContextValue,
    };
  },

  /**
   * Create an error node
   */
  createError(
    label: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      error?: Error;
    } = {}
  ): TreeNode {
    const { tooltip, contextValue = "error", error } = options;

    return {
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("error"),
      tooltip: tooltip ?? label,
      contextValue,
      error,
    } as TreeNode;
  },

  /**
   * Create an info/empty node
   */
  createInfo(
    label: string,
    options: {
      tooltip?: string;
      contextValue?: string;
      iconId?: string;
    } = {}
  ): TreeNode {
    const { tooltip, contextValue = "empty", iconId = "info" } = options;

    return {
      type: NodeType.ERROR,
      label,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: tooltip ?? label,
      contextValue,
    };
  },
} as const;
