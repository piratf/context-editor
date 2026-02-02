/**
 * Cross-platform file access service for Windows/WSL environments.
 * Handles path conversion and provides unified file access API.
 */

import * as fs from "node:fs/promises";
import * as vscode from "vscode";

/**
 * Debug output channel for logging.
 */
let debugOutput: vscode.OutputChannel | null = null;

/**
 * Set the debug output channel for logging.
 */
export function setFileAccessDebugOutput(channel: vscode.OutputChannel): void {
  debugOutput = channel;
}

/**
 * Log a debug message if debug output is available.
 */
function debugLog(message: string): void {
  if (debugOutput !== null) {
    debugOutput.appendLine(`[FileAccessService] ${message}`);
  }
}

/**
 * Path type enumeration.
 */
export enum PathType {
  WINDOWS_ABSOLUTE = "windows_absolute",
  WINDOWS_UNC = "windows_unc",
  WSL_UNC = "wsl_unc",
  WSL_INTERNAL = "wsl_internal",
  UNIX_ABSOLUTE = "unix_absolute",
  UNKNOWN = "unknown",
}

/**
 * Detected path information.
 */
export interface PathInfo {
  /** The detected path type */
  type: PathType;
  /** Whether this is a WSL network path */
  isWslPath: boolean;
  /** The extracted WSL distro name (if applicable) */
  wslDistro: string | null;
  /** The original path */
  originalPath: string;
  /** The normalized path for the current platform */
  normalizedPath: string;
}

/**
 * File stat result with additional metadata.
 */
export interface FileStatResult {
  /** Whether the file exists */
  exists: boolean;
  /** Whether it's a file (true) or directory (false) */
  isFile: boolean;
  /** Whether it's a directory */
  isDirectory: boolean;
  /** File size in bytes */
  size: number;
  /** The path that was actually accessed (after conversion) */
  accessedPath: string;
  /** Error message if access failed */
  error?: string;
}

/**
 * Cross-platform file access service.
 * Handles Windows/WSL path conversion and provides unified file access API.
 */
export class FileAccessService {
  private currentPlatform: "windows" | "linux" | "darwin";
  private wslDistro: string | null = null;

  constructor() {
    this.currentPlatform = process.platform === "win32" ? "windows" :
                          process.platform === "darwin" ? "darwin" : "linux";

    // Try to detect WSL distro if we're on WSL
    if (this.currentPlatform === "linux") {
      this.wslDistro = this.detectWslDistro();
    }

    debugLog(`FileAccessService initialized: platform=${this.currentPlatform}, wslDistro=${this.wslDistro !== null && this.wslDistro.length > 0 ? this.wslDistro : "none"}`);
  }

  /**
   * Set the WSL distro name (for when accessing WSL from Windows).
   */
  setWslDistro(distro: string | null): void {
    this.wslDistro = distro;
    debugLog(`WSL distro set to: ${distro !== null && distro.length > 0 ? distro : "none"}`);
  }

  /**
   * Get the current WSL distro name.
   */
  getWslDistro(): string | null {
    return this.wslDistro;
  }

  /**
   * Detect if we're running in WSL and get the distro name.
   */
  private detectWslDistro(): string | null {
    try {
      // Using dynamic import to avoid require() style import issues
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const childProcess = require("node:child_process") as { execSync: (command: string) => Buffer };
      const version = childProcess.execSync("cat /proc/version");
      const versionStr = version.toString("utf8");
      const lower = versionStr.toLowerCase();

      if (lower.includes("microsoft") || lower.includes("wsl")) {
        // Try to get distro from /etc/os-release or /etc/lsb-release
        try {
          const osRelease = childProcess.execSync("cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null");
          const osReleaseStr = osRelease.toString("utf8");
          const match = osReleaseStr.match(/^(ID|DISTRIB_ID)=(.+)/m);
          if (match !== null) {
            return match[2].trim().replace(/"/g, "");
          }
        } catch {
          // Fall back to "wsl"
        }
        return "wsl";
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Detect the type of a file path.
   */
  detectPathType(filePath: string): PathInfo {
    const originalPath = filePath;
    let type = PathType.UNKNOWN;
    let isWslPath = false;
    let wslDistro: string | null = null;

    // Check for WSL UNC paths (\\wsl$\distro\... or \\wsl.localhost\distro\...)
    if (filePath.startsWith("\\\\wsl$\\") || filePath.startsWith("\\\\wsl.localhost\\")) {
      type = PathType.WSL_UNC;
      isWslPath = true;
      const parts = filePath.split("\\").filter((p) => p.length > 0);
      if (parts.length >= 2 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        wslDistro = parts[1];
      }
    }
    // Check for Windows UNC paths (\\server\share\...)
    else if (filePath.startsWith("\\\\")) {
      type = PathType.WINDOWS_UNC;
    }
    // Check for Windows absolute paths (C:\...)
    else if (/^[A-Za-z]:\\/.test(filePath)) {
      type = PathType.WINDOWS_ABSOLUTE;
    }
    // Check for Unix absolute paths (/home/..., /mnt/...)
    else if (filePath.startsWith("/")) {
      type = PathType.UNIX_ABSOLUTE;
      // On WSL, Unix paths are WSL internal paths
      if (this.currentPlatform === "linux" && this.wslDistro !== null) {
        type = PathType.WSL_INTERNAL;
        isWslPath = true;
        wslDistro = this.wslDistro;
      }
    }

    return {
      type,
      isWslPath,
      wslDistro,
      originalPath,
      normalizedPath: this.normalizePathForCurrentPlatform(filePath, type, wslDistro),
    };
  }

  /**
   * Normalize a path for access on the current platform.
   * Converts between Windows UNC, WSL internal, and Unix paths as needed.
   */
  private normalizePathForCurrentPlatform(
    filePath: string,
    pathType: PathType,
    pathWslDistro: string | null
  ): string {
    debugLog(`normalizePath: input=${filePath}, type=${pathType}, wslDistro=${pathWslDistro !== null ? pathWslDistro : "null"}`);

    // If we're on Linux/WSL and have a Windows UNC path
    if (this.currentPlatform === "linux" && pathType === PathType.WSL_UNC) {
      // Convert \\wsl$\distro\path to /path
      const parts = filePath.split("\\").filter((p) => p.length > 0);
      if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        // Extract distro name for logging
        const distro = parts[1];
        const internalPath = "/" + parts.slice(2).join("/");
        debugLog(`  -> converted to WSL internal: ${internalPath} (distro: ${distro})`);
        return internalPath;
      }
    }

    // If we're on Windows and have a WSL internal path
    if (this.currentPlatform === "windows" && pathType === PathType.UNIX_ABSOLUTE) {
      // Check if this looks like a WSL path (starts with /home/, /mnt/, /root/)
      if (filePath.startsWith("/home/") || filePath.startsWith("/mnt/") || filePath.startsWith("/root/")) {
        if (this.wslDistro !== null) {
          // Convert to Windows UNC path
          const windowsPath = "\\\\wsl$\\" + this.wslDistro + filePath.replace(/\//g, "\\");
          debugLog(`  -> converted to Windows UNC: ${windowsPath}`);
          return windowsPath;
        }
      }
    }

    // Otherwise, return as-is
    debugLog(`  -> no conversion needed`);
    return filePath;
  }

  /**
   * Check if a file exists and get its stats.
   * Handles cross-platform path conversion automatically.
   */
  async statFile(filePath: string): Promise<FileStatResult> {
    const pathInfo = this.detectPathType(filePath);
    const accessPath = pathInfo.normalizedPath;

    debugLog(`statFile: ${filePath}`);
    debugLog(`  detected type: ${pathInfo.type}`);
    debugLog(`  isWslPath: ${pathInfo.isWslPath ? "true" : "false"}`);
    debugLog(`  access path: ${accessPath}`);

    try {
      const stats = await fs.stat(accessPath);
      return {
        exists: true,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        accessedPath: accessPath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`  stat failed: ${errorMessage}`);
      return {
        exists: false,
        isFile: false,
        isDirectory: false,
        size: 0,
        accessedPath: accessPath,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if a file exists.
   */
  async fileExists(filePath: string): Promise<boolean> {
    const result = await this.statFile(filePath);
    debugLog(`fileExists: ${filePath} -> ${result.exists ? "true" : "false"}`);
    return result.exists && result.isFile;
  }

  /**
   * Check if a directory exists.
   */
  async directoryExists(filePath: string): Promise<boolean> {
    const result = await this.statFile(filePath);
    debugLog(`directoryExists: ${filePath} -> ${result.exists ? "true" : "false"}`);
    return result.exists && result.isDirectory;
  }

  /**
   * Read file content.
   */
  async readFile(filePath: string, encoding: "utf-8" = "utf-8"): Promise<string> {
    const pathInfo = this.detectPathType(filePath);
    const accessPath = pathInfo.normalizedPath;

    debugLog(`readFile: ${filePath}`);
    debugLog(`  access path: ${accessPath}`);

    try {
      return await fs.readFile(accessPath, encoding);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`  read failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Read directory contents.
   */
  async readDirectory(filePath: string): Promise<string[]> {
    const pathInfo = this.detectPathType(filePath);
    const accessPath = pathInfo.normalizedPath;

    debugLog(`readDirectory: ${filePath}`);
    debugLog(`  access path: ${accessPath}`);

    try {
      return await fs.readdir(accessPath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog(`  readdir failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Convert a WSL internal path to Windows UNC path.
   * /home/user/project -> \\wsl$\Ubuntu-24.04\home\user\project
   */
  wslPathToWindowsUnc(wslPath: string, distro: string): string {
    if (!wslPath.startsWith("/")) {
      return wslPath; // Not a WSL path
    }
    debugLog(`wslPathToWindowsUnc: ${wslPath} -> distro=${distro}`);
    return "\\\\wsl$\\" + distro + wslPath.replace(/\//g, "\\");
  }

  /**
   * Convert a Windows UNC path to WSL internal path.
   * \\wsl$\Ubuntu-24.04\home\user\project -> /home/user/project
   */
  windowsUncToWslPath(windowsPath: string): string {
    const parts = windowsPath.split("\\").filter((p) => p.length > 0);
    if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
      // Extract distro name for logging (but not used in return value)
      const distro = parts[1];
      debugLog(`windowsUncToWslPath: ${windowsPath} -> distro=${distro}`);
      // Remove distro name and join with forward slashes
      return "/" + parts.slice(2).join("/");
    }
    return windowsPath;
  }

  /**
   * Convert a Windows path to WSL mount point.
   * C:\Users\user -> /mnt/c/Users/user
   */
  windowsPathToWslMount(windowsPath: string): string {
    const match = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
    if (match) {
      const drive = match[1].toLowerCase();
      const path = match[2].replace(/\\/g, "/");
      return `/mnt/${drive}/${path}`;
    }
    return windowsPath;
  }

  /**
   * Convert a WSL mount point to Windows path.
   * /mnt/c/Users/user -> C:\Users\user
   */
  wslMountToWindowsPath(wslPath: string): string {
    const match = wslPath.match(/^\/mnt\/([a-z])\/(.*)$/);
    if (match) {
      const drive = match[1].toUpperCase();
      const path = match[2].replace(/\//g, "\\");
      return `${drive}:\\${path}`;
    }
    return wslPath;
  }
}
