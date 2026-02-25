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
 */
export interface IProjectEntry {
  readonly path: string;
  readonly state?: unknown;
  readonly mcpServers?: unknown;
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
   * Get global configuration value
   * @param key - Configuration key
   * @returns Promise resolving to the configuration value
   */
  getGlobalConfig(key: string): Promise<unknown>;

  /**
   * Refresh the configuration cache
   * @returns Promise that resolves when cache is cleared
   */
  refresh(): Promise<void>;

  /**
   * Check if this facade is accessible
   * @returns True if the facade can access its configuration
   */
  isAccessible(): boolean;

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
}
