/**
 * WslToWindowsDataFacade - Access Windows configuration from WSL
 *
 * This facade allows WSL environment to access Windows's configuration.
 *
 * Key features:
 * - Uses /mnt/c/ paths to access Windows filesystem from WSL
 * - Reads Windows's .claude.json file
 * - Converts Windows project paths to WSL-accessible /mnt/ paths
 * - Handles path conversion automatically
 *
 * Path conversion:
 * - Windows config path: C:\Users\user\.claude.json → /mnt/c/Users/user/.claude.json
 * - Windows project path: C:\Users\user\project → /mnt/c/Users/user/project
 */

import * as fs from "node:fs/promises";
import {
  BaseDataFacade,
  type ClaudeGlobalConfig,
  type ConfigReadResult,
  type EnvironmentInfo,
  EnvironmentType,
} from "./dataFacade.js";
import { PathConverterFactory } from "./pathConverter.js";

/**
 * Data facade for accessing Windows configuration from WSL
 */
export class WslToWindowsDataFacade extends BaseDataFacade {
  private readonly pathConverter: ReturnType<
    typeof PathConverterFactory.createWindowsToWslConverter
  >;

  constructor(windowsUsername?: string) {
    const pathConverter = PathConverterFactory.createWindowsToWslConverter();

    // Build WSL path to Windows config
    // Windows config is typically at C:\Users\<username>\.claude.json
    // From WSL, this is accessible at /mnt/c/Users/<username>/.claude.json
    const username = windowsUsername ?? "windows-user"; // Default fallback
    const wslConfigPath = `/mnt/c/Users/${username}/.claude.json`;

    const info: EnvironmentInfo = {
      type: EnvironmentType.Windows,
      configPath: wslConfigPath,
    };

    super(info);
    this.pathConverter = pathConverter;
  }

  /**
   * Check if Windows is accessible from WSL
   */
  isAccessible(): boolean {
    // We can't do async checks here, so return true
    // Actual accessibility will be checked during file operations
    return true;
  }

  /**
   * Read the configuration file from Windows via /mnt/ path
   */
  protected async readConfigFile(): Promise<ConfigReadResult> {
    try {
      const configPath = this.getConfigPath();
      const content = await fs.readFile(configPath, "utf-8");
      const config = this.parseConfig(content);

      // Convert Windows project paths to WSL /mnt/ paths
      const projects = this.normalizeProjects(config.projects);

      return { config, projects };
    } catch (error) {
      // Handle Windows not accessible, config not found, etc.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Config file doesn't exist or Windows not accessible
        return { config: {}, projects: [] };
      }
      // For other errors, return empty config
      return { config: {}, projects: [] };
    }
  }

  /**
   * Normalize project entries and convert Windows paths to WSL /mnt/ paths
   */
  protected normalizeProjects(projects: unknown): import("./dataFacade.js").ProjectEntry[] {
    const baseProjects = super.normalizeProjects(projects);

    // Convert each Windows path to WSL /mnt/ path
    return baseProjects.map((entry) => ({
      ...entry,
      path: this.convertWindowsPathToWsl(entry.path),
    }));
  }

  /**
   * Convert a Windows path to WSL /mnt/ path
   * @param windowsPath - Windows path (e.g., C:\Users\user\project)
   * @returns WSL path (e.g., /mnt/c/Users/user/project)
   */
  protected convertWindowsPathToWsl(windowsPath: string): string {
    // If path is already a WSL /mnt/ path, return as-is
    if (windowsPath.startsWith("/mnt/")) {
      return windowsPath;
    }

    // If path is not a Windows path, return as-is
    if (!windowsPath.match(/^[A-Za-z]:\\/)) {
      return windowsPath;
    }

    // Use the path converter to transform Windows path to WSL path
    return this.pathConverter.convert(windowsPath);
  }

  /**
   * Parse the configuration file content
   */
  protected parseConfig(content: string): ClaudeGlobalConfig {
    if (!content || content.trim().length === 0) {
      return {};
    }

    try {
      return JSON.parse(content) as ClaudeGlobalConfig;
    } catch {
      return {};
    }
  }

  /**
   * Get the Windows username this facade is configured for
   */
  getWindowsUsername(): string {
    // Extract from config path
    const match = this.getConfigPath().match(/^\/mnt\/c\/Users\/([^/]+)\//);
    return match?.[1] ?? "unknown";
  }
}

/**
 * Factory for creating WslToWindowsDataFacade instances
 */
export const WslToWindowsDataFacadeFactory = {
  /**
   * Create a WslToWindowsDataFacade for accessing Windows config
   * @param windowsUsername - Windows username (e.g., "john"). If not provided, will try to detect.
   * @returns Configured WslToWindowsDataFacade
   */
  create(windowsUsername?: string): WslToWindowsDataFacade {
    return new WslToWindowsDataFacade(windowsUsername);
  },

  /**
   * Create WslToWindowsDataFacade by auto-detecting Windows username
   * Tries common usernames and checks which one has a config file
   * @returns Promise resolving to accessible facade or null
   */
  async createAuto(): Promise<WslToWindowsDataFacade | null> {
    // Try to detect Windows username by checking common locations
    const usernames = [this.detectUsernameFromEnv(), "windows-user", "user", "admin"];

    for (const username of usernames) {
      if (username === null || username === "") continue;

      const facade = this.create(username);
      if (await this.isFacadeAccessible(facade)) {
        return facade;
      }
    }

    return null;
  },

  /**
   * Detect Windows username from environment variables
   */
  detectUsernameFromEnv(): string | null {
    // Try common environment variables that might contain Windows username
    const envVars = ["WINDOWS_USER", "WINDOWS_USERNAME", "USER"];

    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value !== undefined && value !== "" && value !== "root" && !value.startsWith("/")) {
        return value;
      }
    }

    return null;
  },

  /**
   * Check if a facade can access its configuration
   */
  async isFacadeAccessible(facade: WslToWindowsDataFacade): Promise<boolean> {
    try {
      await fs.access(facade.getConfigPath());
      return true;
    } catch {
      return false;
    }
  },
} as const;
