/**
 * WindowsToWslDataFacade - Access WSL configuration from Windows
 *
 * This facade allows Windows environment to access a WSL instance's configuration.
 *
 * Key features:
 * - Uses UNC paths (\\wsl.localhost\ or \\wsl$) to access WSL filesystem
 * - Reads WSL's .claude.json file
 * - Converts WSL project paths to Windows-accessible UNC paths
 * - Each WSL instance gets its own facade instance
 *
 * Path conversion:
 * - WSL config path: /home/user/.claude.json → \\wsl.localhost\Ubuntu\home\user\.claude.json
 * - WSL project path: /home/user/project → \\wsl.localhost\Ubuntu\home\user\project
 *
 * WSL instance discovery:
 * - Uses wsl.exe -l -q to get list of installed WSL distros
 * - Tests \\wsl.localhost\ first, falls back to \\wsl$\
 */

import * as fs from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  BaseDataFacade,
  type ClaudeGlobalConfig,
  type ConfigReadResult,
  type EnvironmentInfo,
  EnvironmentType,
} from "./dataFacade.js";
import { PathConverterFactory, type WslDistroConfig } from "./pathConverter.js";

const execAsync = promisify(exec);

/**
 * Result of WSL instance discovery
 */
export interface DiscoveredWslInstance {
  /** WSL distro name (e.g., "Ubuntu", "Debian") */
  distroName: string;
  /** Home directory path (e.g., "\\\\wsl.localhost\\Ubuntu\\home\\user") */
  homePath: string;
  /** Full path to the .claude.json configuration file */
  configPath: string;
  /** Whether to use legacy \\wsl$ format instead of \\wsl.localhost */
  useLegacyFormat: boolean;
}

/**
 * Data facade for accessing a WSL instance's configuration from Windows
 */
export class WindowsToWslDataFacade extends BaseDataFacade {
  private readonly distroConfig: WslDistroConfig;
  private readonly pathConverter: ReturnType<
    typeof PathConverterFactory.createWslToWindowsConverter
  >;

  constructor(instance: DiscoveredWslInstance) {
    const distroConfig: WslDistroConfig = {
      distroName: instance.distroName,
      useLegacyFormat: instance.useLegacyFormat,
      homePath: instance.homePath,
    };
    const pathConverter = PathConverterFactory.createWslToWindowsConverter(distroConfig);

    const info: EnvironmentInfo = {
      type: EnvironmentType.WSL,
      configPath: instance.configPath,
      instanceName: instance.distroName,
      homePath: instance.homePath,
    };

    super(info);
    this.distroConfig = distroConfig;
    this.pathConverter = pathConverter;
  }

  /**
   * Check if the WSL instance is accessible
   */
  isAccessible(): boolean {
    // We can't do async checks here, so return true
    // Actual accessibility will be checked during file operations
    return true;
  }

  /**
   * Read the configuration file from WSL via UNC path
   */
  protected async readConfigFile(): Promise<ConfigReadResult> {
    try {
      const configPath = this.getConfigPath();
      const content = await fs.readFile(configPath, "utf-8");
      const config = this.parseConfig(content);

      // Convert WSL project paths to Windows UNC paths
      const projects = this.normalizeProjects(config.projects);

      return { config, projects };
    } catch (error) {
      // Handle WSL instance not running, no permissions, or config not found
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Config file doesn't exist or WSL not accessible
        return { config: {}, projects: [] };
      }
      // For other errors, return empty config
      return { config: {}, projects: [] };
    }
  }

  /**
   * Normalize project entries and convert WSL paths to Windows UNC paths
   */
  protected normalizeProjects(projects: unknown): import("./dataFacade.js").ProjectEntry[] {
    const baseProjects = super.normalizeProjects(projects);

    // Convert each WSL path to Windows UNC path
    return baseProjects.map((entry) => ({
      ...entry,
      path: this.convertWslPathToWindows(entry.path),
    }));
  }

  /**
   * Convert a WSL path to Windows UNC path
   * @param wslPath - WSL absolute path (e.g., /home/user/project)
   * @returns Windows UNC path (e.g., \\wsl.localhost\Ubuntu\home\user\project)
   */
  protected convertWslPathToWindows(wslPath: string): string {
    // If path is already a Windows UNC path, return as-is
    if (wslPath.startsWith("\\\\")) {
      return wslPath;
    }

    // If path is not an absolute WSL path, return as-is
    if (!wslPath.startsWith("/")) {
      return wslPath;
    }

    // Use the path converter to transform WSL path to Windows UNC
    return this.pathConverter.convert(wslPath);
  }

  /**
   * Convert a path from the facade's environment to the current environment
   * Reuses the existing WSL to Windows conversion logic.
   * @param path - Path in the facade's environment format
   * @returns Converted path for the current environment
   */
  convertPath(path: string): string {
    // Reuse existing WSL → Windows conversion logic
    return this.convertWslPathToWindows(path);
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
   * Get the WSL distro name
   */
  getDistroName(): string {
    return this.distroConfig.distroName;
  }

  /**
   * Check if using legacy UNC format
   */
  isUsingLegacyFormat(): boolean {
    return this.distroConfig.useLegacyFormat;
  }

  /**
   * Get the home directory path
   * @returns Home directory path for this WSL instance (In Windows format)
   */
  getHomePath(): string {
    return this.distroConfig.homePath;
  }
}

/**
 * Factory for creating WindowsToWslDataFacade instances
 */
export const WindowsToWslDataFacadeFactory = {
  /**
   * Create a WindowsToWslDataFacade for a specific WSL distro
   * @param instance - Discovered WSL instance information
   * @returns Configured WindowsToWslDataFacade
   */
  create(instance: DiscoveredWslInstance): WindowsToWslDataFacade {
    return new WindowsToWslDataFacade(instance);
  },

  /**
   * Get list of installed WSL distros using wsl.exe command
   * @returns Array of distro names, empty array if command fails
   */
  async getWslDistroList(): Promise<string[]> {
    try {
      // wsl.exe -l -q returns only distro names, one per line
      // Note: wsl.exe returns UTF-16LE encoded output
      const { stdout } = await execAsync("wsl.exe -l -q", {
        windowsHide: true,
        timeout: 5000, // 5 second timeout
        encoding: "utf16le", // wsl.exe outputs UTF-16LE
      });

      // Parse output: split by lines, trim whitespace (including \r), filter empty
      const distros = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return distros;
    } catch (_error) {
      // wsl.exe command failed (WSL not installed, not available, etc.)
      return [];
    }
  },

  /**
   * Try to discover instances for a given UNC prefix
   * @param prefix - UNC path prefix (\\wsl.localhost\ or \\wsl$\)
   * @param distros - List of distro names from wsl.exe
   * @param useLegacyFormat - Whether this is the legacy format
   * @returns List of discovered instances with valid .claude.json
   */
  async probeWithPrefix(
    prefix: string,
    distros: string[],
    useLegacyFormat: boolean
  ): Promise<DiscoveredWslInstance[]> {
    const discovered: DiscoveredWslInstance[] = [];

    for (const distro of distros) {
      const homeRootPath = `${prefix}${distro}\\home`;

      try {
        // Check if home directory is accessible
        await fs.access(homeRootPath);

        // List subdirectories in home (each subdirectory is a username)
        const entries = await fs.readdir(homeRootPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }

          const username = entry.name;

          // Skip system directories
          if (username.startsWith(".")) {
            continue;
          }

          // Check if .claude.json exists in this user's home directory
          const configPath = `${homeRootPath}\\${username}\\.claude.json`;

          try {
            await fs.access(configPath);
            discovered.push({
              distroName: distro,
              homePath: `${homeRootPath}\\${username}`,
              configPath,
              useLegacyFormat,
            });
            // Found config for this distro, try next distro
            break;
          } catch {
            // Config doesn't exist for this user, try next user
          }
        }
      } catch {
        // Home directory not accessible, skip this distro
        continue;
      }
    }

    return discovered;
  },

  /**
   * Discover WSL instances using wsl.exe command
   * Implements the design spec:
   * 1. Use wsl.exe -l -q to get instance list
   * 2. Try \\wsl.localhost\ first, verify with config check
   * 3. Fall back to \\wsl$\ if needed
   */
  async discoverInstances(): Promise<DiscoveredWslInstance[]> {
    // Step 1: Get distro list from wsl.exe
    const distros = await this.getWslDistroList();

    if (distros.length === 0) {
      return []; // No WSL distros found
    }

    // Step 2: Try new format (\\wsl.localhost\) first
    const newFormatInstances = await this.probeWithPrefix("\\\\wsl.localhost\\", distros, false);
    if (newFormatInstances.length > 0) {
      return newFormatInstances; // Use new format if successful
    }

    // Step 3: Fall back to legacy format (\\wsl$\)
    const legacyFormatInstances = await this.probeWithPrefix("\\\\wsl$\\", distros, true);
    return legacyFormatInstances;
  },

  /**
   * Create WindowsToWslDataFacade instances for all discovered WSL distros
   * Uses wsl.exe command to discover WSL instances dynamically
   * @returns Promise resolving to array of accessible facades
   */
  async createAll(): Promise<WindowsToWslDataFacade[]> {
    const facades: WindowsToWslDataFacade[] = [];

    // Discover instances using wsl.exe command
    const discovered = await this.discoverInstances();

    for (const instance of discovered) {
      // Create facade with the actual discovered config path
      const facade = this.create(instance);

      // Verify facade is accessible
      if (await this.isFacadeAccessible(facade)) {
        facades.push(facade);
      }
    }

    return facades;
  },

  /**
   * Check if a facade can access its configuration
   */
  async isFacadeAccessible(facade: WindowsToWslDataFacade): Promise<boolean> {
    try {
      await fs.access(facade.getConfigPath());
      return true;
    } catch {
      return false;
    }
  },
} as const;
