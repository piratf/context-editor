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
 */

import * as fs from 'node:fs/promises';
import {
  BaseDataFacade,
  type ClaudeGlobalConfig,
  type ConfigReadResult,
  type EnvironmentInfo,
  EnvironmentType,
} from './dataFacade.js';
import { PathConverterFactory, type WslDistroConfig } from './pathConverter.js';

/**
 * Result of WSL instance discovery
 */
interface DiscoveredWslInstance {
  distroName: string;
  configPath: string;
  useLegacyFormat: boolean;
}

/**
 * Data facade for accessing a WSL instance's configuration from Windows
 */
export class WindowsToWslDataFacade extends BaseDataFacade {
  private readonly distroConfig: WslDistroConfig;
  private readonly pathConverter: ReturnType<typeof PathConverterFactory.createWslToWindowsConverter>;

  constructor(distroName: string, useLegacyFormat = false) {
    const distroConfig: WslDistroConfig = { distroName, useLegacyFormat };
    const pathConverter = PathConverterFactory.createWslToWindowsConverter(
      distroName,
      useLegacyFormat
    );

    // Build Windows UNC path to WSL config
    // WSL config is at /home/<user>/.claude.json
    // We need to convert this to Windows UNC format
    const wslConfigPath = pathConverter.convert('/home/$USER/.claude.json');
    const windowsConfigPath = wslConfigPath.replace('$USER', distroName);

    const info: EnvironmentInfo = {
      type: EnvironmentType.WSL,
      configPath: windowsConfigPath,
      instanceName: distroName,
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
      const content = await fs.readFile(configPath, 'utf-8');
      const config = this.parseConfig(content);

      // Convert WSL project paths to Windows UNC paths
      const projects = this.normalizeProjects(config.projects);

      return { config, projects };
    } catch (error) {
      // Handle WSL instance not running, no permissions, or config not found
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
  protected normalizeProjects(projects: unknown): import('./dataFacade.js').ProjectEntry[] {
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
  private convertWslPathToWindows(wslPath: string): string {
    // If path is already a Windows UNC path, return as-is
    if (wslPath.startsWith('\\\\')) {
      return wslPath;
    }

    // If path is not an absolute WSL path, return as-is
    if (!wslPath.startsWith('/')) {
      return wslPath;
    }

    // Use the path converter to transform WSL path to Windows UNC
    return this.pathConverter.convert(wslPath);
  }

  /**
   * Parse the configuration file content
   */
  private parseConfig(content: string): ClaudeGlobalConfig {
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
}

/**
 * Factory for creating WindowsToWslDataFacade instances
 */
export const WindowsToWslDataFacadeFactory = {
  /**
   * Create a WindowsToWslDataFacade for a specific WSL distro
   * @param distroName - WSL distro name (e.g., "Ubuntu", "Debian")
   * @param useLegacyFormat - Whether to use legacy \\wsl$ format instead of \\wsl.localhost
   * @returns Configured WindowsToWslDataFacade
   */
  create(distroName: string, useLegacyFormat = false): WindowsToWslDataFacade {
    return new WindowsToWslDataFacade(distroName, useLegacyFormat);
  },

  /**
   * Discover WSL instances by path probing
   * Implements the design spec:
   * 1. Try \\wsl.localhost\ to list instances
   * 2. Fall back to \\wsl$\ if first fails
   * 3. For each instance, check if .claude.json exists
   */
  async discoverInstances(): Promise<DiscoveredWslInstance[]> {
    const discovered: DiscoveredWslInstance[] = [];

    // Step 1: Try new format (\\wsl.localhost\) first
    const newFormatInstances = await this.probeWslPath('\\\\wsl.localhost\\', false);
    if (newFormatInstances.length > 0) {
      discovered.push(...newFormatInstances);
      return discovered; // Use new format if successful
    }

    // Step 2: Fall back to legacy format (\\wsl$\)
    const legacyFormatInstances = await this.probeWslPath('\\\\wsl$\\', true);
    discovered.push(...legacyFormatInstances);

    return discovered;
  },

  /**
   * Probe a WSL UNC path to discover instances
   * @param prefix - UNC path prefix (\\wsl.localhost\ or \\wsl$\)
   * @param useLegacyFormat - Whether this is the legacy format
   * @returns List of discovered instances with valid .claude.json
   */
  async probeWslPath(prefix: string, useLegacyFormat: boolean): Promise<DiscoveredWslInstance[]> {
    const discovered: DiscoveredWslInstance[] = [];

    try {
      // Try to list directories in the WSL root
      const entries = await fs.readdir(prefix, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const distroName = entry.name;

        // Skip non-distro directories
        if (distroName.startsWith('$') || distroName === '.') {
          continue;
        }

        // Check if .claude.json exists for this distro
        const configPath = `${prefix}${distroName}\\home\\${distroName}\\.claude.json`;

        try {
          await fs.access(configPath);
          discovered.push({
            distroName,
            configPath,
            useLegacyFormat,
          });
        } catch {
          // Config doesn't exist, skip this distro
        }
      }
    } catch (error) {
      // Cannot access the WSL path - may not be available or permissions issue
      // Return empty array to indicate failure
      return [];
    }

    return discovered;
  },

  /**
   * Create WindowsToWslDataFacade instances for all discovered WSL distros
   * Uses path probing to discover WSL instances dynamically
   * @returns Promise resolving to array of accessible facades
   */
  async createAll(): Promise<WindowsToWslDataFacade[]> {
    const facades: WindowsToWslDataFacade[] = [];

    // Discover instances using path probing
    const discovered = await this.discoverInstances();

    for (const instance of discovered) {
      const facade = this.create(instance.distroName, instance.useLegacyFormat);

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
