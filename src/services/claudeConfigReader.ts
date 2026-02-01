/**
 * Service for reading and parsing Claude Code configuration files.
 * Handles ~/.claude.json with proper error handling and validation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as vscode from "vscode";
import type { ClaudeConfig, ClaudeProjectEntry } from "../types/claudeConfig.js";

// Re-export ClaudeProjectEntry for use in other modules
export type { ClaudeProjectEntry };

/**
 * Debug output channel for logging.
 */
let debugOutput: vscode.OutputChannel | null = null;

/**
 * Set the debug output channel for logging.
 */
export function setDebugOutput(channel: vscode.OutputChannel): void {
  debugOutput = channel;
}

/**
 * Log a debug message if debug output is available.
 */
function debugLog(message: string): void {
  if (debugOutput !== null) {
    debugOutput.appendLine(`[ClaudeConfigReader] ${message}`);
  }
}

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
    public readonly cause?: unknown
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

    debugLog(`Reading config from: ${this.configPath}`);

    // Return cached config if still valid
    if (this.cachedConfig !== null && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      debugLog("Using cached config");
      return this.normalizeProjects(this.cachedConfig);
    }

    try {
      const content = await this.readConfigFile();
      const config = this.parseConfig(content);

      // Update cache
      this.cachedConfig = config;
      this.cacheTimestamp = now;

      const result = this.normalizeProjects(config);
      debugLog(`Found ${String(result.projects.length)} project(s)`);

      return result;
    } catch (error) {
      // Clear cache on error
      this.cachedConfig = null;
      this.cacheTimestamp = 0;
      debugLog(`Error reading config: ${error instanceof Error ? error.message : String(error)}`);
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
            error
          );
        }
        if (error.code === "EACCES" || error.code === "EPERM") {
          throw new ConfigError(
            ConfigErrorType.ACCESS_DENIED,
            `Permission denied reading configuration file: ${this.configPath}`,
            error
          );
        }
      }
      throw new ConfigError(
        ConfigErrorType.ACCESS_DENIED,
        `Failed to read configuration file: ${this.configPath}`,
        error
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
          error
        );
      }
      throw new ConfigError(
        ConfigErrorType.PARSE_ERROR,
        `Failed to parse configuration file: ${this.configPath}`,
        error
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
        error
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
          typeof (entry as { path: unknown }).path === "string"
      );
      return { config, projects: validProjects };
    }

    // Handle record format: { "project-name": { path: "...", state: {...} } }
    // OR: { "/absolute/path": { mcpServers: {...} } } where key IS the path
    if (typeof projects === "object") {
      debugLog(
        `Processing projects as object format with ${String(Object.keys(projects).length)} entries`
      );
      const projectEntries: ClaudeProjectEntry[] = [];
      for (const [key, entry] of Object.entries(projects)) {
        const entryObj = entry as unknown;

        // Skip null entries
        if (entryObj === null) {
          debugLog(`Skipping null entry for key: ${key}`);
          continue;
        }

        const entryRecord = entryObj as Record<string, unknown>;

        // Try to get path from entry object first
        if ("path" in entryRecord && typeof entryRecord.path === "string") {
          debugLog(`Found project from entry.path: ${entryRecord.path}`);
          projectEntries.push({ path: entryRecord.path });
          continue;
        }

        // If no path in entry, check if the key itself is a path (starts with / or ~)
        // This handles the format: { "/Users/xxx/project": { mcpServers: {...} } }
        if (typeof key === "string" && (key.startsWith("/") || key.startsWith("~"))) {
          debugLog(`Found project from key (path-like): ${key}`);
          projectEntries.push({ path: key, state: entryRecord });
        }
      }
      debugLog(`Normalized ${String(projectEntries.length)} project(s) from object format`);
      return { config, projects: projectEntries };
    }

    debugLog("Projects format not recognized (not array or object)");
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
