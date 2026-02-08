/**
 * Context menu command interfaces for Context Editor tree nodes.
 *
 * This module defines interfaces for menu commands following OOP principles:
 * - Each menu command defines an interface specifying required capabilities
 * - Node classes implement interfaces to indicate menu support
 * - Type guards provide runtime interface checking
 * - Context values map interfaces to VS Code menu visibility
 *
 * Architecture:
 * - Interfaces define what a node must do to support a menu action
 * - Node classes implement interfaces to enable menu items
 * - VS Code when clauses use regex patterns on contextValue for visibility
 * - Type guards ensure runtime safety when executing commands
 */

/**
 * Interface for nodes that can have their name or path copied
 *
 * Provides a file-system accessible path for copy operations.
 * Any node with a valid, accessible file path should implement this.
 */
export interface ICopyable {
  /**
   * Get the accessible file system path for copying
   * @returns The full path to the file/directory
   */
  getAccessiblePath(): string;

  /**
   * Get the display name (file/directory name without path)
   * @returns The display label
   */
  getDisplayName(): string;
}

/**
 * Interface for nodes that can be deleted
 *
 * Provides deletion capability with safety checks.
 * Implementations should verify deletion is safe before executing.
 */
export interface IDeletable {
  /**
   * Check if deletion is safe
   * @returns true if the node can be safely deleted
   */
  canDelete(): boolean;

  /**
   * Delete the file/directory this node represents
   * Should handle both files and directories appropriately
   */
  delete(): Promise<void>;
}

/**
 * Interface for directory nodes that can be opened in new VS Code window
 *
 * Only directory nodes should implement this interface.
 */
export interface IOpenableInVscode {
  /**
   * Get the directory path for opening
   * @returns The full path to the directory
   */
  getDirectoryPath(): string;

  /**
   * Open this directory in a new VS Code window
   */
  openInNewWindow(): Promise<void>;
}

/**
 * Context value markers for interface implementation
 *
 * These are appended to contextValue strings for VS Code menu filtering.
 * Multiple interfaces are combined with '+' separator.
 *
 * Examples:
 * - "directory+copyable+deletable+openableInVscode"
 * - "file+copyable+deletable"
 * - "claudeJson+copyable+deletable"
 */
export const CONTEXT_MARKERS = {
  COPYABLE: "copyable",
  DELETABLE: "deletable",
  OPENABLE_IN_VSCODE: "openableInVscode",
} as const;

/**
 * Build contextValue string from implemented interfaces
 *
 * The contextValue is used by VS Code's when clauses to determine menu visibility.
 * Format: "{baseType}+{interface1}+{interface2}+..."
 *
 * @param baseType - The base node type (e.g., "directory", "file")
 * @param interfaces - Array of implemented interface markers
 * @returns Combined contextValue string
 *
 * @example
 * ```typescript
 * buildContextValue("directory", [CONTEXT_MARKERS.COPYABLE, CONTEXT_MARKERS.DELETABLE]);
 * // Returns: "directory+copyable+deletable"
 * ```
 */
export function buildContextValue(baseType: string, interfaces: readonly string[]): string {
  const parts = [baseType, ...interfaces].filter(Boolean);
  return parts.join("+");
}

/**
 * Type guard for ICopyable interface
 *
 * Checks if a node implements the ICopyable interface at runtime.
 *
 * @param node - The node to check
 * @returns true if the node implements ICopyable
 */
export function isCopyable(node: unknown): node is ICopyable {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  const n = node as Record<string, unknown>;
  return (
    "getAccessiblePath" in n &&
    "getDisplayName" in n &&
    typeof n.getAccessiblePath === "function" &&
    typeof n.getDisplayName === "function"
  );
}

/**
 * Type guard for IDeletable interface
 *
 * Checks if a node implements the IDeletable interface at runtime.
 *
 * @param node - The node to check
 * @returns true if the node implements IDeletable
 */
export function isDeletable(node: unknown): node is IDeletable {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  const n = node as Record<string, unknown>;
  return (
    "canDelete" in node &&
    "delete" in node &&
    typeof n.canDelete === "function" &&
    typeof n.delete === "function"
  );
}

/**
 * Type guard for IOpenableInVscode interface
 *
 * Checks if a node implements the IOpenableInVscode interface at runtime.
 *
 * @param node - The node to check
 * @returns true if the node implements IOpenableInVscode
 */
export function isOpenableInVscode(node: unknown): node is IOpenableInVscode {
  if (typeof node !== "object" || node === null) {
    return false;
  }

  const n = node as Record<string, unknown>;
  return (
    "getDirectoryPath" in n &&
    "openInNewWindow" in n &&
    typeof n.getDirectoryPath === "function" &&
    typeof n.openInNewWindow === "function"
  );
}

/**
 * Menu command identifiers
 */
export const MenuCommands = {
  COPY_NAME: "contextEditor.copyName",
  COPY_PATH: "contextEditor.copyPath",
  DELETE: "contextEditor.delete",
  OPEN_VSCODE: "contextEditor.openVscode",
} as const;

/**
 * Generate package.json menu contribution configuration
 *
 * Creates the contributes.menus configuration for all context menu items.
 * Uses regex patterns to match contextValue containing interface markers.
 *
 * @returns Menu contribution configuration for package.json
 */
export function generateMenuContributions(): {
  commands: Array<{ command: string; title: string }>;
  menus: {
    "view/item/context": Array<{
      command: string;
      when: string;
      group: string;
    }>;
  };
} {
  const commands = [
    { command: MenuCommands.COPY_NAME, title: "Copy Name" },
    { command: MenuCommands.COPY_PATH, title: "Copy Path" },
    { command: MenuCommands.DELETE, title: "Delete" },
    { command: MenuCommands.OPEN_VSCODE, title: "Open in New Window" },
  ];

  const menus = {
    "view/item/context": [
      {
        command: MenuCommands.COPY_NAME,
        // Matches contextValue containing "+copyable" at end or followed by "+"
        when: `view == contextEditorUnified && viewItem =~ /\\+${CONTEXT_MARKERS.COPYABLE}($|\\+)/`,
        group: "copy@1",
      },
      {
        command: MenuCommands.COPY_PATH,
        when: `view == contextEditorUnified && viewItem =~ /\\+${CONTEXT_MARKERS.COPYABLE}($|\\+)/`,
        group: "copy@2",
      },
      {
        command: MenuCommands.DELETE,
        when: `view == contextEditorUnified && viewItem =~ /\\+${CONTEXT_MARKERS.DELETABLE}($|\\+)/`,
        group: "delete@1",
      },
      {
        command: MenuCommands.OPEN_VSCODE,
        when: `view == contextEditorUnified && viewItem =~ /\\+${CONTEXT_MARKERS.OPENABLE_IN_VSCODE}($|\\+)/`,
        group: "inline",
      },
    ],
  };

  return { commands, menus };
}
