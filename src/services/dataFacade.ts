/**
 * Data Facade layer - Abstract interface for accessing Claude configuration data.
 *
 * The data facade provides a unified interface for accessing .claude.json data
 * across different environments (Windows, WSL, macOS, Linux).
 *
 * Key responsibilities:
 * - Abstract data access for a single environment
 * - Return paths converted to the current environment's usable format
 * - Provide environment information
 * - Handle path conversion internally (transparent to upper layers)
 *
 * Three implementations:
 * - NativeDataFacade: Access current environment's config (no path conversion)
 * - WindowsToWslDataFacade: Windows accessing WSL config (converts WSL paths to Windows UNC)
 * - WslToWindowsDataFacade: WSL accessing Windows config (converts Windows paths to WSL /mnt/)
 */

import { EnvironmentType } from './environment.js';

// Re-export EnvironmentType for convenience
export { EnvironmentType };

/**
 * Environment information for a data facade
 */
export interface EnvironmentInfo {
  /** Environment type */
  type: EnvironmentType;
  /** Full path to the .claude.json configuration file */
  configPath: string;
  /** WSL instance name (only for WSL environments) */
  instanceName?: string;
}

/**
 * Project entry from .claude.json
 */
export interface ProjectEntry {
  /** Absolute path to the project (converted to current environment format) */
  path: string;
  /** Project-specific state (allowed tools, trust settings) */
  state?: ProjectState;
  /** Per-project MCP servers configuration */
  mcpServers?: McpServers;
}

/**
 * Project state configuration
 */
export interface ProjectState {
  /** Allowed tools for this project */
  allowedTools?: readonly string[];
  /** Trust settings for this project */
  trust?: unknown;
}

/**
 * MCP server configuration
 */
export interface McpServer {
  /** Environment variables for the MCP server */
  env?: Record<string, string>;
  /** Command to run the MCP server */
  command?: string;
  /** Arguments to pass to the MCP server command */
  args?: readonly string[];
  /** URL for stdio-based MCP server connection */
  url?: string;
}

/**
 * MCP servers configuration
 */
export type McpServers = Readonly<Record<string, McpServer>>;

/**
 * Global configuration from .claude.json
 */
export interface ClaudeGlobalConfig {
  /** User settings preferences */
  settings?: Record<string, unknown>;
  /** User-scoped MCP server configurations */
  mcpServers?: McpServers;
  /** Registered projects and their configurations */
  projects?: Readonly<Record<string, ProjectEntry>> | readonly ProjectEntry[];
}

/**
 * Result of reading the configuration file
 */
export interface ConfigReadResult {
  /** Parsed configuration object */
  config: ClaudeGlobalConfig;
  /** Project entries with converted paths */
  projects: readonly ProjectEntry[];
}

/**
 * Data facade interface for accessing Claude configuration
 *
 * This interface provides unified access to .claude.json data across
 * different environments. Implementations handle path conversion internally.
 */
export interface ClaudeDataFacade {
  /**
   * Get environment information
   * @returns Information about this facade's environment
   */
  getEnvironmentInfo(): EnvironmentInfo;

  /**
   * Get list of projects from .claude.json
   * Paths are converted to the current environment's usable format.
   * @returns Promise resolving to array of project entries
   */
  getProjects(): Promise<readonly ProjectEntry[]>;

  /**
   * Get global configuration value
   * @param key - Configuration key (e.g., 'settings', 'mcpServers')
   * @returns Promise resolving to the configuration value
   */
  getGlobalConfig(key: string): Promise<unknown>;

  /**
   * Get context files for a specific project
   * @param projectName - Name or path of the project
   * @returns Promise resolving to array of context file paths
   */
  getProjectContextFiles(projectName: string): Promise<readonly string[]>;

  /**
   * Refresh the configuration cache
   * Clears any cached data and forces a re-read of the configuration file.
   */
  refresh(): Promise<void>;

  /**
   * Check if this facade is accessible
   * Some facades may represent environments that are currently unavailable
   * (e.g., WSL instance not running, no permissions).
   * @returns True if the facade can access its configuration
   */
  isAccessible(): boolean;

  /**
   * Get the configuration path
   * @returns Full path to the .claude.json file
   */
  getConfigPath(): string;
}

/**
 * Base class for data facade implementations
 * Provides common functionality and helper methods.
 */
export abstract class BaseDataFacade implements ClaudeDataFacade {
  protected readonly environmentInfo: EnvironmentInfo;
  protected configCache: ConfigReadResult | null = null;
  protected cacheTimestamp: number = 0;
  protected readonly cacheTtl: number = 5000; // 5 seconds cache

  constructor(environmentInfo: EnvironmentInfo) {
    this.environmentInfo = environmentInfo;
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo(): EnvironmentInfo {
    return this.environmentInfo;
  }

  /**
   * Get the configuration path
   */
  getConfigPath(): string {
    return this.environmentInfo.configPath;
  }

  /**
   * Check if this facade is accessible
   * Default implementation checks if config path exists.
   * Subclasses can override for more specific checks.
   */
  abstract isAccessible(): boolean;

  /**
   * Read the configuration file
   * Must be implemented by subclasses to handle environment-specific access.
   */
  protected abstract readConfigFile(): Promise<ConfigReadResult>;

  /**
   * Get list of projects from .claude.json
   * Uses cache if available and not expired.
   */
  async getProjects(): Promise<readonly ProjectEntry[]> {
    const result = await this.getCachedConfig();
    return result.projects;
  }

  /**
   * Get global configuration value
   * Supports dot notation for nested keys (e.g., 'settings.theme').
   */
  async getGlobalConfig(key: string): Promise<unknown> {
    const result = await this.getCachedConfig();
    const keys = key.split('.');
    let value: unknown = result.config;

    for (const k of keys) {
      if (value !== null && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get context files for a specific project
   * Default implementation looks for .claude.md and CLAUDE.md files.
   */
  async getProjectContextFiles(projectName: string): Promise<readonly string[]> {
    const projects = await this.getProjects();
    const project = projects.find(p => p.path.includes(projectName) || p.path === projectName);

    if (!project) {
      return [];
    }

    // Look for context files in the project directory
    const contextFiles: string[] = [];
    const possibleFiles = ['.claude.md', 'CLAUDE.md'];

    // Note: This is a simplified implementation.
    // Subclasses should override to actually check file existence.
    for (const file of possibleFiles) {
      contextFiles.push(file);
    }

    return contextFiles;
  }

  /**
   * Refresh the configuration cache
   */
  async refresh(): Promise<void> {
    this.configCache = null;
    this.cacheTimestamp = 0;
    await this.getCachedConfig(); // Force re-read
  }

  /**
   * Get cached configuration or read if cache is expired
   */
  protected async getCachedConfig(): Promise<ConfigReadResult> {
    const now = Date.now();

    if (this.configCache && (now - this.cacheTimestamp) < this.cacheTtl) {
      return this.configCache;
    }

    const result = await this.readConfigFile();
    this.configCache = result;
    this.cacheTimestamp = now;
    return result;
  }

  /**
   * Normalize project entries to a consistent format
   * Handles both array and record formats from .claude.json.
   */
  protected normalizeProjects(projects: unknown): ProjectEntry[] {
    if (projects === null || projects === undefined) {
      return [];
    }

    if (Array.isArray(projects)) {
      return projects.filter(this.isValidProjectEntry.bind(this)).map((entry): ProjectEntry => {
        const result: ProjectEntry = { path: entry.path };
        if (entry.state !== undefined) result.state = entry.state;
        if (entry.mcpServers !== undefined) result.mcpServers = entry.mcpServers;
        return result;
      });
    }

    if (typeof projects === 'object') {
      const result: ProjectEntry[] = [];
      for (const value of Object.values(projects as Record<string, unknown>)) {
        if (this.isValidProjectEntry(value)) {
          const entry: ProjectEntry = { path: value.path };
          if (value.state !== undefined) entry.state = value.state;
          if (value.mcpServers !== undefined) entry.mcpServers = value.mcpServers;
          result.push(entry);
        }
      }
      return result;
    }

    return [];
  }

  /**
   * Validate if an object is a valid project entry
   */
  protected isValidProjectEntry(entry: unknown): entry is ProjectEntry {
    return (
      typeof entry === 'object' &&
      entry !== null &&
      'path' in entry &&
      typeof (entry as ProjectEntry).path === 'string'
    );
  }
}

/**
 * Factory for creating data facades
 */
export const DataFacadeFactory = {
  /**
   * Create a data facade for the current (native) environment
   * @param environmentInfo - Environment information
   * @returns Configured data facade
   */
  createNativeFacade(_environmentInfo: EnvironmentInfo): ClaudeDataFacade {
    // Import dynamically to avoid circular dependency
    // The actual implementation will be in nativeDataFacade.ts
    throw new Error('Not implemented yet - use NativeDataFacade class directly');
  },
} as const;
