/**
 * Path Converter layer - Converts paths between Windows and WSL formats.
 *
 * Responsibilities:
 * - Convert WSL paths to Windows UNC paths
 * - Convert Windows paths to WSL paths
 * - Handle both new (\\wsl.localhost\) and legacy (\\wsl$) UNC formats
 * - Support multiple WSL distros/instances
 *
 * Key Design:
 * - WSL → Windows: /home/user/project → \\wsl.localhost\Ubuntu\home\user\project
 * - Windows → WSL: C:\Users\user → /mnt/c/Users/user
 * - Priority: Try \\wsl.localhost first, fallback to \\wsl$ if needed
 */

import * as path from 'node:path';

/**
 * WSL distro configuration
 */
export interface WslDistroConfig {
  /** Distro name (e.g., "Ubuntu", "Ubuntu-20.04") */
  distroName: string;
  /** Whether to use legacy \\wsl$ format instead of \\wsl.localhost */
  useLegacyFormat: boolean;
}

/**
 * Result of path conversion with metadata
 */
export interface PathConversionResult {
  /** The converted path */
  path: string;
  /** Whether this is a WSL path */
  isWsl: boolean;
  /** The WSL distro name (if applicable) */
  distro?: string;
}

/**
 * Base interface for path converters
 */
export interface PathConverter {
  /**
   * Convert a path from source format to target format
   * @param path - The path to convert
   * @returns The converted path
   */
  convert(path: string): string;
}

/**
 * Converts WSL paths to Windows UNC paths.
 *
 * Examples:
 * - /home/user/project → \\wsl.localhost\Ubuntu\home\user\project
 * - /mnt/c/Users/user → \\wsl.localhost\Ubuntu\mnt\c\Users\user
 */
export class WslToWindowsPathConverter implements PathConverter {
  private readonly distroConfig: WslDistroConfig;

  constructor(distroConfig: WslDistroConfig) {
    this.distroConfig = distroConfig;
  }

  /**
   * Convert a WSL path to Windows UNC path
   * @param wslPath - Absolute WSL path (e.g., /home/user/project)
   * @returns Windows UNC path (e.g., \\wsl.localhost\Ubuntu\home\user\project)
   */
  convert(wslPath: string): string {
    if (!wslPath.startsWith('/')) {
      // Not an absolute WSL path, return as-is
      return wslPath;
    }

    // Normalize path separators to forward slashes for processing
    const normalizedPath = wslPath.replace(/\\/g, '/');

    // Build UNC path
    const uncPrefix = this.distroConfig.useLegacyFormat
      ? `\\\\wsl$\\${this.distroConfig.distroName}`
      : `\\\\wsl.localhost\\${this.distroConfig.distroName}`;

    // Convert forward slashes to backslashes for UNC path
    const wslPart = normalizedPath.replace(/\//g, '\\');

    return `${uncPrefix}${wslPart}`;
  }

  /**
   * Get the UNC prefix for this converter
   */
  getUncPrefix(): string {
    return this.distroConfig.useLegacyFormat
      ? `\\\\wsl$\\${this.distroConfig.distroName}`
      : `\\\\wsl.localhost\\${this.distroConfig.distroName}`;
  }
}

/**
 * Converts Windows paths to WSL paths.
 *
 * Examples:
 * - C:\Users\user → /mnt/c/Users/user
 * - \\wsl.localhost\Ubuntu\home\user\project → /home/user/project
 */
export class WindowsToWslPathConverter implements PathConverter {
  /**
   * Convert a Windows path to WSL path
   * @param windowsPath - Windows path (e.g., C:\Users\user or \\wsl.localhost\Ubuntu\home\user)
   * @returns WSL path (e.g., /mnt/c/Users/user or /home/user/project)
   */
  convert(windowsPath: string): string {
    // Handle UNC paths to WSL (reverse conversion)
    // Supports both new format \\wsl.localhost\ and legacy \\wsl$\
    const uncMatch = windowsPath.match(/^\\\\wsl(?:\.localhost|\$)?\\([^\\]+)(.*)$/);
    if (uncMatch) {
      // This is a UNC path to WSL, extract the WSL path part
      const wslPart = uncMatch[2];
      // Convert backslashes to forward slashes
      return wslPart.replace(/\\/g, '/') || '/';
    }

    // Handle regular Windows paths (C:\, D:\, etc.)
    const driveMatch = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
    if (driveMatch) {
      const [, drive, rest] = driveMatch;
      const lowerDrive = drive.toLowerCase();
      // Convert backslashes to forward slashes
      const wslPart = rest.replace(/\\/g, '/');
      // Handle empty rest (e.g., "C:\")
      if (wslPart === '') {
        return `/mnt/${lowerDrive}/`;
      }
      return `/mnt/${lowerDrive}/${wslPart}`;
    }

    // If it doesn't match any pattern, return as-is
    return windowsPath;
  }

  /**
   * Check if a Windows path is a UNC path to WSL
   * @param windowsPath - Path to check
   * @returns True if the path is a WSL UNC path
   */
  isWslUncPath(windowsPath: string): boolean {
    return /^\\\\wsl(?:\.localhost|\$)?\\/i.test(windowsPath);
  }

  /**
   * Extract distro name from WSL UNC path
   * @param windowsPath - WSL UNC path (e.g., \\wsl.localhost\Ubuntu\home\user)
   * @returns Distro name or undefined
   */
  extractDistro(windowsPath: string): string | undefined {
    const match = windowsPath.match(/^\\\\wsl(?:\.localhost|\$)?\\([^\\]+)/);
    return match?.[1];
  }
}

/**
 * Factory for creating path converters
 */
export const PathConverterFactory = {
  /**
   * Create a WSL to Windows converter for a specific distro
   * @param distroName - WSL distro name (e.g., "Ubuntu")
   * @param useLegacyFormat - Whether to use legacy \\wsl$ format
   * @returns Configured path converter
   */
  createWslToWindowsConverter(
    distroName: string,
    useLegacyFormat = false
  ): WslToWindowsPathConverter {
    return new WslToWindowsPathConverter({ distroName, useLegacyFormat });
  },

  /**
   * Create a Windows to WSL converter
   * @returns Configured path converter
   */
  createWindowsToWslConverter(): WindowsToWslPathConverter {
    return new WindowsToWslPathConverter();
  },
} as const;

/**
 * Utility functions for path conversion
 */
export const PathConverterUtils = {
  /**
   * Normalize a path for the current platform
   * @param inputPath - Path to normalize
   * @param platform - Target platform
   * @returns Normalized path
   */
  normalizeForPlatform(inputPath: string, platform: NodeJS.Platform): string {
    if (platform === 'win32') {
      // Convert to backslashes
      return inputPath.replace(/\//g, '\\');
    }
    // Convert to forward slashes
    return inputPath.replace(/\\/g, '/');
  },

  /**
   * Check if a path is an absolute path
   * @param inputPath - Path to check
   * @returns True if the path is absolute
   */
  isAbsolutePath(inputPath: string): boolean {
    // Windows absolute: C:\, \\server\share
    // Unix absolute: /home/user
    return /^[A-Z]:\\/i.test(inputPath) ||
           /^\\\\/.test(inputPath) ||
           inputPath.startsWith('/');
  },

  /**
   * Join path segments
   * @param segments - Path segments to join
   * @returns Joined path
   */
  join(...segments: string[]): string {
    return path.join(...segments);
  },
} as const;
