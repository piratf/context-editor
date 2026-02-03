/**
 * Environment layer - Lightweight singleton for current environment detection.
 * Provides read-only interfaces for other modules to determine the environment type.
 *
 * Responsibilities:
 * - Detect current VS Code runtime environment (Windows, WSL, macOS, Linux)
 * - Provide platform-agnostic path operations (getConfigPath, joinPath)
 * - Singleton pattern, globally unique instance
 *
 * Key differences from old EnvironmentDetector:
 * - Only detects CURRENT environment, not all environments
 * - Does NOT perform cross-environment detection (moved to ConfigSearch layer)
 * - Provides read-only properties
 * - Exposes platform-agnostic utility methods
 */

import * as fs from 'node:fs';

import * as path from 'path';

/**
 * Environment type enumeration
 */
export enum EnvironmentType {
  Windows = 'windows',
  WSL = 'wsl',
  MacOS = 'macos',
  Linux = 'linux'
}

/**
 * Environment information interface
 */
export interface EnvironmentInfo {
  /** Environment type */
  type: EnvironmentType;
  /** Home directory path */
  homeDir: string;
  /** Full path to .claude.json config file */
  configPath: string;
}

/**
 * Singleton class for environment detection and platform-agnostic operations.
 */
export class Environment {
  private static instance: Environment | null = null;

  private readonly _type: EnvironmentType;
  private readonly _homeDir: string;

  private constructor() {
    this._type = this.detectEnvironmentType();
    this._homeDir = this.detectHomeDir();
  }

  /**
   * Get the singleton instance of Environment.
   */
  static getInstance(): Environment {
    if (!Environment.instance) {
      Environment.instance = new Environment();
    }
    return Environment.instance;
  }

  /**
   * Get the detected environment type.
   */
  get type(): EnvironmentType {
    return this._type;
  }

  /**
   * Get the home directory for the current platform.
   */
  get homeDir(): string {
    return this._homeDir;
  }

  /**
   * Get the full path to the .claude.json config file.
   * Returns a platform-agnostic path.
   */
  getConfigPath(): string {
    return path.join(this._homeDir, '.claude.json');
  }

  /**
   * Join path segments using the correct separator for the current platform.
   * Provides platform-agnostic path joining.
   */
  joinPath(...segments: string[]): string {
    return path.join(...segments);
  }

  /**
   * Check if the current environment is Windows.
   */
  isWindows(): boolean {
    return this._type === EnvironmentType.Windows;
  }

  /**
   * Check if the current environment is WSL.
   */
  isWSL(): boolean {
    return this._type === EnvironmentType.WSL;
  }

  /**
   * Check if the current environment is macOS.
   */
  isMacOS(): boolean {
    return this._type === EnvironmentType.MacOS;
  }

  /**
   * Check if the current environment is Linux.
   */
  isLinux(): boolean {
    return this._type === EnvironmentType.Linux;
  }

  /**
   * Get environment information as a structured object.
   */
  getInfo(): EnvironmentInfo {
    return {
      type: this._type,
      homeDir: this._homeDir,
      configPath: this.getConfigPath()
    };
  }

  /**
   * Detect the environment type based on the current platform.
   */
  private detectEnvironmentType(): EnvironmentType {
    const platform = process.platform;

    switch (platform) {
      case 'win32':
        return EnvironmentType.Windows;

      case 'darwin':
        return EnvironmentType.MacOS;

      case 'linux':
        // Check if running in WSL
        if (this.isWslInternal()) {
          return EnvironmentType.WSL;
        }
        return EnvironmentType.Linux;

      default:
        // Fallback to Linux for unknown platforms
        return EnvironmentType.Linux;
    }
  }

  /**
   * Detect the home directory for the current platform.
   */
  private detectHomeDir(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: use USERPROFILE environment variable
      const userProfile = process.env.USERPROFILE;
      return userProfile ?? '';
    }

    // macOS, Linux, WSL: use HOME environment variable
    const home = process.env.HOME;
    return home ?? '';
  }

  /**
   * Internal check for WSL environment.
   * Reads /proc/version to detect if running under WSL.
   */
  private isWslInternal(): boolean {
    try {
      const version = fs.readFileSync('/proc/version', 'utf-8');
      const lower = version.toLowerCase();
      return lower.includes('microsoft') || lower.includes('wsl');
    } catch {
      // /proc/version not accessible, assume not WSL
      return false;
    }
  }
}

/**
 * Utility function to get the Environment singleton instance.
 * Convenience method for quick access.
 */
export function getEnvironment(): Environment {
  return Environment.getInstance();
}
