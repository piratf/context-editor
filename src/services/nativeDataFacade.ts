/**
 * NativeDataFacade - Access current environment's paths
 *
 * This facade provides access to the current environment's paths.
 * No path conversion is needed since we're accessing the local filesystem directly.
 *
 * Platform support:
 * - Windows: C:\Users\<name>\
 * - macOS: /Users/<name>/
 * - Linux: /home/<name>/
 * - WSL: /home/<name>/
 *
 * Note: Configuration reading is now handled by separate AI config services:
 * - Use ClaudeConfig to read ~/.claude.json
 * - Use GeminiConfig to read ~/.gemini/projects.json
 * - Future: CursorConfig, AiderConfig, etc.
 */

import { BaseDataFacade, type EnvironmentInfo } from "./dataFacade.js";
import { Environment, getEnvironment } from "./environment.js";

/**
 * Data facade for accessing the current (native) environment's paths
 */
export class NativeDataFacade extends BaseDataFacade {
  private readonly environment: Environment;

  constructor() {
    const env = getEnvironment();
    const info: EnvironmentInfo = {
      type: env.type,
      homePath: env.homeDir,
    };
    super(info);
    this.environment = env;
  }

  /**
   * Check if the environment is accessible
   */
  isAccessible(): boolean {
    // We check accessibility by verifying the home directory exists
    return this.environment.homeDir.length > 0;
  }

  /**
   * Get the home directory path
   * @returns Home directory path for the native environment
   */
  getHomePath(): string {
    return this.environment.homeDir;
  }

  /**
   * Convert a path from the facade's environment to the current environment
   * Native environment - no conversion needed.
   * @param path - Path in the facade's environment format
   * @returns Original path (no conversion needed for native environment)
   */
  convertPath(path: string): string {
    // Native environment - no conversion needed
    return path;
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
