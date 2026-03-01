/**
 * WslToWindowsDataFacade - Access Windows paths from WSL
 *
 * This facade allows WSL environment to access Windows's paths.
 *
 * Key features:
 * - Uses /mnt/c/ paths to access Windows filesystem from WSL
 * - Converts Windows paths to WSL-accessible /mnt/ paths
 * - Handles path conversion automatically
 *
 * Path conversion:
 * - Windows path: C:\Users\user\project → /mnt/c/Users/user/project
 *
 * Note: Configuration reading is now handled by separate AI config services:
 * - Use ClaudeConfig to read ~/.claude.json
 * - Use GeminiConfig to read ~/.gemini/projects.json
 */

import { BaseDataFacade, type EnvironmentInfo, EnvironmentType } from "./dataFacade.js";
import { PathConverterFactory } from "./pathConverter.js";

/**
 * Data facade for accessing Windows paths from WSL
 */
export class WslToWindowsDataFacade extends BaseDataFacade {
  private readonly pathConverter: ReturnType<
    typeof PathConverterFactory.createWindowsToWslConverter
  >;

  constructor(windowsUsername?: string) {
    const pathConverter = PathConverterFactory.createWindowsToWslConverter();

    // Build WSL path to Windows user directory
    // Windows user directory is typically at C:\Users\<username>\
    // From WSL, this is accessible at /mnt/c/Users/<username>/
    const username = windowsUsername ?? "windows-user"; // Default fallback
    const wslHomePath = `/mnt/c/Users/${username}`;

    const info: EnvironmentInfo = {
      type: EnvironmentType.Windows,
      homePath: wslHomePath,
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
   * Convert a path from the facade's environment to the current environment
   * Reuses the existing Windows to WSL conversion logic.
   * @param path - Path in the facade's environment format
   * @returns Converted path for the current environment
   */
  convertPath(path: string): string {
    // Reuse existing Windows → WSL conversion logic
    return this.convertWindowsPathToWsl(path);
  }

  /**
   * Get the Windows username this facade is configured for
   * @returns Windows username or "unknown" if not detectable
   */
  getWindowsUsername(): string {
    // Extract from home path
    const match = this.getHomePath().match(/^\/mnt\/c\/Users\/([^/]+)$/);
    return match?.[1] ?? "unknown";
  }

  /**
   * Get the home directory path
   * @returns Home directory path for Windows (in WSL format)
   */
  getHomePath(): string {
    return this.getEnvironmentInfo().homePath;
  }
}

/**
 * Factory for creating WslToWindowsDataFacade instances
 */
export const WslToWindowsDataFacadeFactory = {
  /**
   * Create a WslToWindowsDataFacade for accessing Windows paths
   * @param windowsUsername - Windows username (e.g., "john"). If not provided, will try to detect.
   * @returns Configured WslToWindowsDataFacade
   */
  create(windowsUsername?: string): WslToWindowsDataFacade {
    return new WslToWindowsDataFacade(windowsUsername);
  },

  /**
   * Create WslToWindowsDataFacade by auto-detecting Windows username
   * Tries common usernames and checks which one has a config file
   * @returns Configured facade or null
   */
  createAuto(): WslToWindowsDataFacade | null {
    // Try to detect Windows username by checking common locations
    const usernames = [this.detectUsernameFromEnv(), "windows-user", "user", "admin"];

    for (const username of usernames) {
      if (username === null || username === "") continue;

      return this.create(username);
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
} as const;
