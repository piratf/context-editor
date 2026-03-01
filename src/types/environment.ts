/**
 * Environment information interface
 *
 * Represents a purely abstract environment without coupling to any
 * specific AI tool's configuration. This enables support for multiple
 * AI tools (Claude, Gemini, Cursor, etc.) through separate config services.
 */
export interface IEnvironmentInfo {
  /** Environment type (e.g., "windows", "wsl", "macos", "linux") */
  readonly type: string;
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
 *
 * Provides a pure environment abstraction without coupling to any
 * specific AI tool's configuration. Use AI config services (ClaudeConfig,
 * GeminiConfig, etc.) to read tool-specific configurations.
 */
export interface IDataFacade {
  /**
   * Get environment information
   * @returns Environment information
   */
  getEnvironmentInfo(): IEnvironmentInfo;

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
