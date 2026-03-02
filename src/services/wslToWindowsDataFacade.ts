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
import { hasAnyAITool } from "../constants/aiTools.js";
import * as fs from "node:fs/promises";

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
 * Result of Windows user discovery
 */
export interface DiscoveredWindowsUser {
  /** Windows username (e.g., "john") */
  username: string;
  /** Home directory path in WSL format (e.g., "/mnt/c/Users/john") */
  homePath: string;
}

/**
 * Helper function for Windows user discovery
 * Separated from factory for testability
 */
export async function discoverWindowsUsers(): Promise<DiscoveredWindowsUser[]> {
  const discovered: DiscoveredWindowsUser[] = [];
  const usersPath = "/mnt/c/Users";

  try {
    await fs.access(usersPath);
    const entries = await fs.readdir(usersPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const username = entry.name;

      // Skip system directories
      if (username.startsWith(".")) continue;

      const homePath = `${usersPath}/${username}`;

      // Check if ANY AI tool exists
      if (await hasAnyAITool(homePath)) {
        discovered.push({ username, homePath });
      }
    }
  } catch {
    return [];
  }

  return discovered;
}

/**
 * Factory for creating WslToWindowsDataFacade instances
 */
export const WslToWindowsDataFacadeFactory = {
  /**
   * Create a WslToWindowsDataFacade for accessing Windows paths
   * @param windowsUsername - Windows username (e.g., "john").
   * @returns Configured WslToWindowsDataFacade
   */
  create(windowsUsername?: string): WslToWindowsDataFacade {
    return new WslToWindowsDataFacade(windowsUsername);
  },

  /**
   * Create WslToWindowsDataFacade instances for all discovered Windows users
   * Uses hasAnyAITool to discover users with AI tools installed
   * @returns Promise resolving to array of accessible facades
   */
  async createAll(): Promise<WslToWindowsDataFacade[]> {
    const facades: WslToWindowsDataFacade[] = [];
    const discovered = await discoverWindowsUsers();

    for (const user of discovered) {
      const facade = this.create(user.username);
      facades.push(facade);
    }

    return facades;
  },
} as const;
