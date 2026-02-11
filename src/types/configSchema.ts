/**
 * Configuration Schema Types
 *
 * Defines types and validation for export/import configuration.
 * Supports path format validation (Unix, Windows, UNC) and filter patterns.
 */

import type { FileFilter } from "./fileFilter.js";
import { NamePatternFilter, AllowAllFilter } from "./fileFilter.js";

/**
 * Path format types supported by the export system
 */
export enum PathFormat {
  /** Unix-style path: /home/user/export */
  Unix = "unix",
  /** Windows path: C:\Users\user\export */
  Windows = "windows",
  /** UNC path: \\server\share\export */
  Unc = "unc",
  /** Unknown or invalid format */
  Unknown = "unknown",
}

/**
 * Export configuration interface
 */
export interface ExportConfig {
  /** Target directory path for export */
  directory: string;
  /** Filter patterns for files to exclude during export */
  filters: readonly string[];
  /** Whether to create .gitignore file in export directory */
  createGitignore: boolean;
}

/**
 * Path validation result
 */
export interface PathValidationResult {
  /** Whether the path is valid */
  valid: boolean;
  /** Detected path format */
  format: PathFormat;
  /** Error message if invalid */
  error?: string;
}

/**
 * Export options for the export service
 */
export interface ExportOptions {
  /** Target directory path */
  targetDirectory: string;
  /** Optional file filter */
  filter?: FileFilter;
  /** Whether to create .gitignore */
  createGitignore: boolean;
}

/**
 * Import options for the import service
 */
export interface ImportOptions {
  /** Source directory path */
  sourceDirectory: string;
  /** Whether to overwrite existing files */
  overwrite?: boolean;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Number of files exported */
  fileCount: number;
  /** Export directory path */
  exportPath: string;
  /** List of exported files */
  exportedFiles: readonly string[];
}

/**
 * Import result
 */
export interface ImportResult {
  /** Number of files imported */
  fileCount: number;
  /** Number of files skipped */
  skippedCount: number;
  /** List of imported files */
  importedFiles: readonly string[];
  /** List of skipped files */
  skippedFiles: readonly string[];
}

/**
 * Regular expressions for path format detection
 */
const PATH_PATTERNS = {
  /** Unix absolute path: /path/to/dir */
  unix: /^\/[^\s/]+(?:\/[^\s/]*)*$/,

  /** Windows drive path: C:\path\to\dir */
  windows: /^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$/,

  /** UNC path: \\server\share\path */
  unc: /^\\\\[^\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n]+)+$/,

  /** WSL path: /mnt/c/Users/... (auto-convert to Windows) */
  wsl: /^\/mnt\/[a-z]\/.+/,
} as const;

/**
 * Detect the format of a path
 *
 * @param path - Path to analyze
 * @returns Detected path format
 */
export function detectPathFormat(path: string): PathFormat {
  if (!path) {
    return PathFormat.Unknown;
  }

  if (PATH_PATTERNS.unix.test(path)) {
    // Check if it's a WSL path that should be treated as Windows
    if (PATH_PATTERNS.wsl.test(path)) {
      return PathFormat.Windows;
    }
    return PathFormat.Unix;
  }

  if (PATH_PATTERNS.windows.test(path)) {
    return PathFormat.Windows;
  }

  if (PATH_PATTERNS.unc.test(path)) {
    return PathFormat.Unc;
  }

  return PathFormat.Unknown;
}

/**
 * Validate a path for export/import operations
 *
 * @param path - Path to validate
 * @returns Path validation result
 */
export function validatePath(path: string): PathValidationResult {
  if (!path || path.trim() === "") {
    return {
      valid: false,
      format: PathFormat.Unknown,
      error: "路径不能为空",
    };
  }

  const trimmedPath = path.trim();
  const format = detectPathFormat(trimmedPath);

  if (format === PathFormat.Unknown) {
    return {
      valid: false,
      format: PathFormat.Unknown,
      error:
        "无效的路径格式。支持的格式: Unix (/path/to/dir), Windows (C:\\path\\to\\dir), UNC (\\\\server\\share)",
    };
  }

  return {
    valid: true,
    format,
  };
}

/**
 * Validate export configuration
 *
 * @param config - Export configuration to validate
 * @returns Validation result with optional error message
 */
export function validateExportConfig(config: ExportConfig): {
  valid: boolean;
  error?: string;
} {
  // Validate directory
  const pathValidation = validatePath(config.directory);
  if (!pathValidation.valid) {
    return {
      valid: false,
      error: `导出目录无效: ${pathValidation.error ?? "未知错误"}`,
    };
  }

  // Validate filters (each should be a valid regex string)
  for (const filter of config.filters) {
    try {
      new RegExp(filter);
    } catch {
      return {
        valid: false,
        error: `无效的正则表达式模式: ${filter}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Create a FileFilter from export configuration
 *
 * If filters are provided, creates a NamePatternFilter with exclude patterns.
 * Otherwise, returns an AllowAllFilter.
 *
 * @param config - Export configuration
 * @returns FileFilter instance
 */
export function createFilterFromConfig(config: ExportConfig): FileFilter {
  if (config.filters.length === 0) {
    return new AllowAllFilter();
  }

  // Convert string patterns to RegExp
  const excludePatterns = config.filters.map((pattern) => new RegExp(pattern));

  return new NamePatternFilter({
    excludePatterns,
    description: "Export filter",
  });
}

/**
 * Get environment directory name for export
 *
 * Maps environment type to directory name in export structure.
 *
 * @param environmentType - Environment type (e.g., "windows", "wsl", "macos", "linux")
 * @returns Directory name for export
 */
export function getEnvironmentDirectoryName(environmentType: string): string {
  const typeMap: Record<string, string> = {
    windows: "windows",
    wsl: "wsl",
    macos: "macos",
    darwin: "macos",
    linux: "linux",
    native: "native",
  };

  return typeMap[environmentType.toLowerCase()] ?? environmentType.toLowerCase();
}

/**
 * Convert WSL path to Windows path
 *
 * /mnt/c/Users/user -> C:\Users\user
 *
 * @param wslPath - WSL path to convert
 * @returns Windows path
 */
export function wslPathToWindows(wslPath: string): string {
  const match = wslPath.match(/^\/mnt\/([a-z])\/(.+)$/);
  if (!match) {
    return wslPath;
  }

  const [, drive, rest] = match;
  const windowsPath = rest.replace(/\//g, "\\");
  return `${drive.toUpperCase()}:${windowsPath}`;
}

/**
 * Convert Windows path to WSL path
 *
 * C:\Users\user -> /mnt/c/Users/user
 *
 * @param windowsPath - Windows path to convert
 * @returns WSL path
 */
export function windowsPathToWsl(windowsPath: string): string {
  const match = windowsPath.match(/^([A-Za-z]):\\(.+)$/);
  if (!match) {
    return windowsPath;
  }

  const [, drive, rest] = match;
  const wslPath = rest.replace(/\\/g, "/");
  return `/mnt/${drive.toLowerCase()}/${wslPath}`;
}

/**
 * Normalize path separators based on current platform
 *
 * @param path - Path to normalize
 * @param useWindowsSeparators - Whether to use Windows separators
 * @returns Normalized path
 */
export function normalizePathSeparators(path: string, useWindowsSeparators: boolean): string {
  const separator = useWindowsSeparators ? "\\" : "/";
  return path.replace(/[\\/]/g, separator);
}

/**
 * Join path parts with appropriate separator
 *
 * @param parts - Path parts to join
 * @param useWindowsSeparators - Whether to use Windows separators
 * @returns Joined path
 */
export function joinPathParts(parts: readonly string[], useWindowsSeparators: boolean): string {
  const separator = useWindowsSeparators ? "\\" : "/";
  return parts.filter(Boolean).join(separator);
}
