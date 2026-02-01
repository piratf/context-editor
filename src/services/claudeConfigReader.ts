/**
 * Service for reading and parsing Claude Code configuration files.
 * Handles ~/.claude.json with proper error handling and validation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type {
  ClaudeConfig,
  ClaudeProjectEntry,
} from "../types/claudeConfig.js";

// Re-export ClaudeProjectEntry for use in other modules
export type { ClaudeProjectEntry };

/**
 * Error types for configuration reading operations.
 */
export enum ConfigErrorType {
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  PARSE_ERROR = "PARSE_ERROR",
  INVALID_PATH = "INVALID_PATH",
  ACCESS_DENIED = "ACCESS_DENIED",
}

/**
 * Custom error class for configuration reading errors.
 */
export class ConfigError extends Error {
  constructor(
    public readonly type: ConfigErrorType,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Result of parsing .claude.json with project entries normalized.
 */
export interface ClaudeConfigWithProjects {
  /**
   * The parsed configuration.
   */
  readonly config: ClaudeConfig;

  /**
   * Normalized array of project entries.
   */
  readonly projects: readonly ClaudeProjectEntry[];
}

/**
 * Service for reading Claude Code configuration.
 */
export class ClaudeConfigReader {
  private readonly configPath: string;
  private cachedConfig: ClaudeConfig | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 5000; // Cache for 5 seconds

  constructor(configPath?: string) {
    this.configPath = configPath ?? path.join(os.homedir(), ".claude.json");
  }

  /**
   * Get the path to the configuration file.
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Read and parse the .claude.json file.
   * Uses a short-lived cache to avoid excessive file reads.
   *
   * @returns The parsed configuration with normalized projects array
   * @throws {ConfigError} If the file cannot be read or parsed
   */
  async readConfig(): Promise<ClaudeConfigWithProjects> {
    const now = Date.now();

    // Return cached config if still valid
    if (
      this.cachedConfig !== null &&
      now - this.cacheTimestamp < this.CACHE_TTL_MS
    ) {
      return this.normalizeProjects(this.cachedConfig);
    }

    try {
      const content = await this.readConfigFile();
      const config = this.parseConfig(content);

      // Update cache
      this.cachedConfig = config;
      this.cacheTimestamp = now;

      return this.normalizeProjects(config);
    } catch (error) {
      // Clear cache on error
      this.cachedConfig = null;
      this.cacheTimestamp = 0;
      throw error;
    }
  }

  /**
   * Clear the cached configuration.
   * Useful when you know the file has been modified externally.
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Read the configuration file from disk.
   *
   * @returns The file content as a string
   * @throws {ConfigError} If the file cannot be read
   */
  private async readConfigFile(): Promise<string> {
    try {
      const absolutePath = this.resolveConfigPath();
      return await fs.readFile(absolutePath, "utf-8");
    } catch (error) {
      if (this.isNodeError(error)) {
        if (error.code === "ENOENT") {
          throw new ConfigError(
            ConfigErrorType.FILE_NOT_FOUND,
            `Configuration file not found: ${this.configPath}`,
            error,
          );
        }
        if (error.code === "EACCES" || error.code === "EPERM") {
          throw new ConfigError(
            ConfigErrorType.ACCESS_DENIED,
            `Permission denied reading configuration file: ${this.configPath}`,
            error,
          );
        }
      }
      throw new ConfigError(
        ConfigErrorType.ACCESS_DENIED,
        `Failed to read configuration file: ${this.configPath}`,
        error,
      );
    }
  }

  /**
   * Parse JSON content with error handling.
   *
   * @param content - The JSON string to parse
   * @returns The parsed configuration object
   * @throws {ConfigError} If the JSON is invalid
   */
  private parseConfig(content: string): ClaudeConfig {
    if (content.trim().length === 0) {
      // Empty file is treated as empty config
      return {};
    }

    try {
      const parsed = JSON.parse(content) as unknown;
      return this.validateConfig(parsed);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigError(
          ConfigErrorType.PARSE_ERROR,
          `Invalid JSON in configuration file: ${this.configPath}`,
          error,
        );
      }
      throw new ConfigError(
        ConfigErrorType.PARSE_ERROR,
        `Failed to parse configuration file: ${this.configPath}`,
        error,
      );
    }
  }

  /**
   * Validate that the parsed object is a valid ClaudeConfig.
   * This is a basic structural validation. For full validation,
   * consider using JSON Schema.
   *
   * @param value - The value to validate
   * @returns The validated ClaudeConfig
   * @throws {ConfigError} If the configuration is invalid
   */
  private validateConfig(value: unknown): ClaudeConfig {
    if (value === null || typeof value !== "object") {
      return {};
    }

    // Basic validation: ensure it's an object with expected structure
    // More detailed validation can be added with JSON Schema
    return value as ClaudeConfig;
  }

  /**
   * Resolve the configuration path to an absolute path.
   *
   * @returns The absolute path to the configuration file
   * @throws {ConfigError} If the path is invalid
   */
  private resolveConfigPath(): string {
    try {
      return path.resolve(this.configPath);
    } catch (error) {
      throw new ConfigError(
        ConfigErrorType.INVALID_PATH,
        `Invalid configuration path: ${this.configPath}`,
        error,
      );
    }
  }

  /**
   * Normalize the projects configuration to a consistent array format.
   * Handles both record and array formats from the JSON.
   *
   * @param config - The parsed configuration
   * @returns The config with normalized projects array
   */
  private normalizeProjects(config: ClaudeConfig): ClaudeConfigWithProjects {
    const { projects } = config;

    if (projects === undefined) {
      return { config, projects: [] };
    }

    // Handle array format: [{ path: "...", state: {...} }]
    if (Array.isArray(projects)) {
      const validProjects = projects.filter(
        (entry): entry is ClaudeProjectEntry =>
          entry !== null &&
          typeof entry === "object" &&
          "path" in entry &&
          typeof (entry as { path: unknown }).path === "string",
      );
      return { config, projects: validProjects };
    }

    // Handle record format: { "project-name": { path: "...", state: {...} } }
    if (typeof projects === "object") {
      const projectEntries: ClaudeProjectEntry[] = [];
      for (const [_key, entry] of Object.entries(projects)) {
        const entryObj = entry as null | { path?: string };
        if (
          entryObj !== null &&
          typeof entryObj.path === "string"
        ) {
          projectEntries.push({ path: entryObj.path });
        }
      }
      return { config, projects: projectEntries };
    }

    return { config, projects: [] };
  }

  /**
   * Check if an error is a Node.js system error with a code property.
   */
  private isNodeError(error: unknown): error is { code: string } & Error {
    return (
      error instanceof Error &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string"
    );
  }
}

/**
 * Singleton instance of the config reader.
 * Use getInstance() to get the shared instance.
 */
let readerInstance: ClaudeConfigReader | null = null;

/**
 * Get the singleton instance of ClaudeConfigReader.
 *
 * @param configPath - Optional custom config path (only used on first call)
 * @returns The shared ClaudeConfigReader instance
 */
export function getConfigReader(configPath?: string): ClaudeConfigReader {
  if (readerInstance === null) {
    readerInstance = new ClaudeConfigReader(configPath);
  }
  return readerInstance;
}
