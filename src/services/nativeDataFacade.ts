/**
 * NativeDataFacade - Access current environment's configuration
 *
 * This facade accesses the .claude.json file in the current running environment.
 * No path conversion is needed since we're accessing the local filesystem directly.
 *
 * Platform support:
 * - Windows: C:\Users\<name>\.claude.json
 * - macOS: /Users/<name>/.claude.json
 * - Linux: /home/<name>/.claude.json
 * - WSL: /home/<name>/.claude.json
 *
 * Key features:
 * - Uses Environment layer for platform-agnostic path operations
 * - Supports all platforms through unified interface
 * - Implements caching for performance
 * - Handles file system errors gracefully
 */

import * as fs from 'node:fs/promises';
import { Environment, getEnvironment } from './environment.js';
import {
  BaseDataFacade,
  type ClaudeGlobalConfig,
  type ConfigReadResult,
  type EnvironmentInfo,
} from './dataFacade.js';

/**
 * Data facade for accessing the current (native) environment's configuration
 */
export class NativeDataFacade extends BaseDataFacade {
  private readonly environment: Environment;

  constructor() {
    const env = getEnvironment();
    const info: EnvironmentInfo = {
      type: env.type,
      configPath: env.getConfigPath(),
    };
    super(info);
    this.environment = env;
  }

  /**
   * Check if the configuration file is accessible
   */
  isAccessible(): boolean {
    // We check accessibility by trying to access the config path
    // Since we can't do async operations here, we return true and
    // handle actual errors during file reading
    return this.environment.homeDir.length > 0;
  }

  /**
   * Read the configuration file from the local filesystem
   */
  protected async readConfigFile(): Promise<ConfigReadResult> {
    try {
      const configPath = this.getConfigPath();
      const content = await fs.readFile(configPath, 'utf-8');
      const config = this.parseConfig(content);
      const projects = this.normalizeProjects(config.projects);

      return { config, projects };
    } catch (error) {
      // Handle file not found or parse errors
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Config file doesn't exist, return empty config
        return { config: {}, projects: [] };
      }
      // For other errors, also return empty config
      return { config: {}, projects: [] };
    }
  }

  /**
   * Parse the configuration file content
   * @param content - JSON content from .claude.json
   * @returns Parsed configuration object
   */
  private parseConfig(content: string): ClaudeGlobalConfig {
    if (!content || content.trim().length === 0) {
      return {};
    }

    try {
      return JSON.parse(content) as ClaudeGlobalConfig;
    } catch {
      // Invalid JSON, return empty config
      return {};
    }
  }

  /**
   * Get project context files for a specific project
   * Checks actual file existence in the project directory.
   */
  async getProjectContextFiles(projectName: string): Promise<readonly string[]> {
    const projects = await this.getProjects();
    const project = projects.find(p => {
      const projectNameLower = projectName.toLowerCase();
      const pathLower = p.path.toLowerCase();
      return pathLower.includes(projectNameLower) || pathLower === projectNameLower;
    });

    if (!project) {
      return [];
    }

    const contextFiles: string[] = [];
    const possibleFiles = ['.claude.md', 'CLAUDE.md', '.clauderc'];

    // Check which files actually exist
    for (const file of possibleFiles) {
      const fullPath = this.environment.joinPath(project.path, file);
      try {
        await fs.access(fullPath);
        contextFiles.push(fullPath);
      } catch {
        // File doesn't exist, skip
      }
    }

    return contextFiles;
  }
}

/**
 * Factory for creating NativeDataFacade instances
 */
export const NativeDataFacadeFactory = {
  /**
   * Create a NativeDataFacade for the current environment
   * @returns Configured NativeDataFacade
   */
  create(): NativeDataFacade {
    return new NativeDataFacade();
  },
} as const;
