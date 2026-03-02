/**
 * Data Facade layer - Abstract interface for accessing environment data.
 *
 * The data facade provides a unified interface for accessing data
 * across different environments (Windows, WSL, macOS, Linux).
 *
 * Key responsibilities:
 * - Abstract environment access for a single environment
 * - Return paths converted to the current environment's usable format
 * - Provide environment information
 * - Handle path conversion internally (transparent to upper layers)
 *
 * Three implementations:
 * - NativeDataFacade: Access current environment's paths (no path conversion)
 * - WindowsToWslDataFacade: Windows accessing WSL paths (converts WSL paths to Windows UNC)
 * - WslToWindowsDataFacade: WSL accessing Windows paths (converts Windows paths to WSL /mnt/)
 *
 * Note: Configuration reading is now handled by separate AI config services:
 * - ClaudeConfig: Reads ~/.claude.json
 * - GeminiConfig: Reads ~/.gemini/projects.json
 * - Future: CursorConfig, AiderConfig, etc.
 */

import { EnvironmentType } from "./environment.js";
import { IDataFacade, IEnvironmentInfo } from "../types/environment.js";

// Re-export EnvironmentType and IDataFacade for convenience
export { EnvironmentType, IDataFacade };

/**
 * Environment information for a data facade
 */
export interface EnvironmentInfo extends IEnvironmentInfo {
  /** Environment type */
  type: EnvironmentType;
  /** Home directory path for the environment */
  homePath: string;
  /** WSL instance name (only for WSL environments) */
  instanceName?: string;
}

/**
 * Base class for data facade implementations
 * Provides common functionality and helper methods.
 */
export abstract class BaseDataFacade implements IDataFacade {
  protected readonly environmentInfo: EnvironmentInfo;

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
   * Get the home directory path
   */
  getHomePath(): string {
    return this.environmentInfo.homePath;
  }

  /**
   * Convert a path from the facade's environment to the current environment
   * Must be implemented by subclasses to handle environment-specific path conversion.
   * @param path - Path in the facade's environment format
   * @returns Converted path for the current environment, or original if no conversion needed
   */
  abstract convertPath(path: string): string;
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
  createNativeFacade(_environmentInfo: EnvironmentInfo): IDataFacade {
    // Import dynamically to avoid circular dependency
    // The actual implementation will be in nativeDataFacade.ts
    throw new Error("Not implemented yet - use NativeDataFacade class directly");
  },
} as const;
