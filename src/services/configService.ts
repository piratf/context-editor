/**
 * Configuration Service
 *
 * Manages application configuration with typed methods.
 * Depends on ConfigurationStore interface for storage, not directly on VS Code.
 */

/**
 * Git export configuration
 */
export interface ExportToDirectoryConfig {
  readonly enabled: boolean;
  readonly targetPath: string;
}

/**
 * Categories export configuration
 * Key is category ID (e.g., "skills", "agents", "commands")
 */
export interface CategoriesExportConfig {
  readonly [categoryId: string]: boolean;
}

/**
 * Complete export state
 */
export interface ExportState {
  readonly directory: ExportToDirectoryConfig;
  readonly categories: CategoriesExportConfig;
}

/**
 * Default export state
 */
export const DEFAULT_EXPORT_STATE: ExportState = {
  directory: { enabled: false, targetPath: "" },
  categories: { skills: true, agents: true, commands: true },
};

/**
 * Configuration keys
 */
export const CONFIG_KEYS = {
  DIRECTORY: "contextEditor.export.directory",
  CATEGORIES: "contextEditor.export.categories",
  SELECTED_NODES: "contextEditor.export.selectedNodes",
  EXPANDED_NODES: "contextEditor.export.expandedNodes",
} as const;

/**
 * Configuration service interface
 */
export interface ConfigService {
  /**
   * Get complete export state
   * @returns Export state or default if not set
   */
  getExportState(): ExportState;

  /**
   * Set complete export state (overwrite)
   * @param state - Full export state to save
   */
  setExportState(state: ExportState): Promise<void>;

  /**
   * Get selected node IDs for export tree
   * @returns Array of selected node IDs
   */
  getExportSelectedNodes(): string[];

  /**
   * Set selected node IDs for export tree
   * @param nodeIds - Array of selected node IDs
   */
  setExportSelectedNodes(nodeIds: string[]): Promise<void>;

  /**
   * Get expanded node IDs for export tree
   * @returns Array of expanded node IDs
   */
  getExportExpandedNodes(): string[];

  /**
   * Set expanded node IDs for export tree
   * @param nodeIds - Array of expanded node IDs
   */
  setExportExpandedNodes(nodeIds: string[]): Promise<void>;
}
