/**
 * Environment information interface
 */
export interface IEnvironmentInfo {
  /** Environment type (e.g., "windows", "wsl", "macos", "linux") */
  readonly type: string;
  /** Full path to the .claude.json configuration file */
  readonly configPath: string;
  /** Home directory path for the environment */
  readonly homePath: string;
  /** WSL instance name (only for WSL environments) */
  readonly instanceName?: string;
}

/**
 * Project entry interface
 *
 * Minimal interface defining the common fields shared across all project types.
 * Additional fields (state, mcpServers) are defined in concrete implementations.
 */
export interface IProjectEntry {
  readonly path: string;
  readonly label: string;
}

/**
 * Data facade interface (simplified for service layer)
 */
export interface IDataFacade {
  /**
   * Get environment information
   * @returns Environment information
   */
  getEnvironmentInfo(): IEnvironmentInfo;

  /**
   * Get list of projects from .claude.json
   * @returns Promise resolving to array of project entries
   */
  getProjects(): Promise<readonly IProjectEntry[]>;

  /**
   * Refresh the configuration cache
   * @returns Promise that resolves when cache is cleared
   */
  refresh(): Promise<void>;

  /**
   * Get the configuration path
   * @returns Full path to the .claude.json file
   */
  getConfigPath(): string;

  /**
   * Get the home directory path
   * @returns Home directory path for this environment
   */
  getHomePath(): string;

  /**
   * Convert a path from the facade's environment to the current environment
   * Used for cross-environment path translation (e.g., WSL paths to Windows)
   * @param path - Path in the facade's environment format
   * @returns Converted path for the current environment, or original if no conversion needed
   */
  convertPath(path: string): string;
}
