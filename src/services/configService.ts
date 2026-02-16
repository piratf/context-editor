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
}
