/**
 * Unified tree node type system for Context Editor views.
 * Provides a common interface for all tree nodes across providers.
 */

import * as vscode from "vscode";

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
   * Create a directory node
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
    const { collapsibleState = 1, tooltip, contextValue = "directory", iconId } = options;

    return {
      type: NodeType.DIRECTORY,
      label,
      path,
      collapsibleState,
      iconPath: new vscode.ThemeIcon(iconId ?? "folder"),
      tooltip: tooltip ?? path,
      contextValue,
    };
  },

  /**
   * Create a file node
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
    const { tooltip, contextValue = "file", iconId = "file" } = options;

    return {
      type: NodeType.FILE,
      label,
      path,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon(iconId),
      tooltip: tooltip ?? path,
      contextValue,
    };
  },

  /**
   * Create a Claude JSON config file node
   */
  createClaudeJson(
    label: string,
    path: string,
    options: {
      tooltip?: string;
      contextValue?: string;
    } = {}
  ): TreeNode {
    const { tooltip, contextValue = "claudeJson" } = options;

    return {
      type: NodeType.CLAUDE_JSON,
      label,
      path,
      collapsibleState: 0,
      iconPath: new vscode.ThemeIcon("settings-gear"),
      tooltip: tooltip ?? path,
      contextValue,
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
