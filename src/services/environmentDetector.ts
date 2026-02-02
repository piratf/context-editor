/**
 * Service for detecting Claude Code environments across platforms.
 * Supports Windows, WSL, macOS, and Linux with cross-environment detection.
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Environment type and configuration information.
 */
export interface Environment {
  /** Unique identifier for the environment */
  id: "primary" | "windows" | "wsl";
  /** Display name for UI */
  name: string;
  /** Full path to the .claude.json config file */
  configPath: string;
  /** Platform type */
  type: "mac" | "windows" | "wsl" | "linux";
  /** Whether the config file is accessible */
  accessible: boolean;
}

/**
 * Service for detecting available Claude Code environments.
 */
export class EnvironmentDetector {
  /**
   * Detect all available environments on the current system.
   * Returns primary environment plus any cross-platform environments (Windows ↔ WSL).
   */
  async detect(): Promise<Environment[]> {
    const primary = this.getPrimaryEnvironment();
    const environments: Environment[] = [primary];

    // Only perform cross-environment detection between Windows and WSL
    if (primary.type === "windows") {
      const wsl = await this.detectWslFromWindows();
      if (wsl !== null) {
        environments.push(wsl);
      }
    } else if (primary.type === "wsl") {
      const windows = await this.detectWindowsFromWsl();
      if (windows !== null) {
        environments.push(windows);
      }
    }

    return environments;
  }

  /**
   * Get the primary environment based on the current platform.
   */
  private getPrimaryEnvironment(): Environment {
    const platform = process.platform;
    const configPath = path.join(os.homedir(), ".claude.json");

    switch (platform) {
      case "darwin":
        return {
          id: "primary",
          name: "Context Editor",
          configPath,
          type: "mac",
          accessible: true,
        };

      case "win32":
        return {
          id: "windows",
          name: "Windows",
          configPath,
          type: "windows",
          accessible: true,
        };

      default: {
        // linux - check if running in WSL
        if (this.isWsl()) {
          return {
            id: "wsl",
            name: "WSL",
            configPath,
            type: "wsl",
            accessible: true,
          };
        }
        return {
          id: "primary",
          name: "Context Editor",
          configPath,
          type: "linux",
          accessible: true,
        };
      }
    }
  }

  /**
   * Check if the current Linux environment is WSL.
   */
  private isWsl(): boolean {
    try {
      const version = fs.readFileSync("/proc/version", "utf-8");
      const lower = version.toLowerCase();
      return lower.includes("microsoft") || lower.includes("wsl");
    } catch {
      return false;
    }
  }

  /**
   * Detect WSL environments from Windows.
   * Uses `wsl -l -q` to list installed WSL distributions.
   */
  private async detectWslFromWindows(): Promise<Environment | null> {
    try {
      // Get list of WSL distributions
      const { stdout } = await execAsync("wsl -l -q", { timeout: 5000 });
      const lines = stdout.trim().split("\n");
      const distros = lines.filter((line) => line.trim().length > 0);

      if (distros.length === 0) {
        return null;
      }

      // Use the first distribution to detect config
      const distro = distros[0].trim();

      // Try to detect WSL config by using wsl command to check file existence
      // This is more reliable than using Windows network paths
      try {
        const username = os.userInfo().username;
        const wslHomePath = `/home/${username}`;
        const wslConfigPath = `${wslHomePath}/.claude.json`;

        // Use wsl to check if the config file exists
        const { stdout: testOutput } = await execAsync(
          `wsl -d ${distro} -- test -f ${wslConfigPath} && echo "exists" || echo "not_found"`,
          { timeout: 5000 }
        );

        if (testOutput.includes("exists")) {
          // Return with WSL network path format for Windows access
          // Prefer Windows 11+ format
          const networkPath = `\\\\wsl.localhost\\${distro}\\${wslConfigPath.replace(/\//g, "\\")}`;

          return {
            id: "wsl",
            name: "WSL",
            configPath: networkPath,
            type: "wsl",
            accessible: true,
          };
        }
      } catch {
        // Fall through to try alternative detection methods
      }

      // Fallback: try Windows network paths directly
      const username = os.userInfo().username;
      const paths = [
        // Windows 11+ format
        `\\\\wsl.localhost\\${distro}\\home\\${username}\\.claude.json`,
        // Legacy format
        `\\\\wsl$\\${distro}\\home\\${username}\\.claude.json`,
      ];

      for (const wslPath of paths) {
        if (await this.testAccess(wslPath)) {
          return {
            id: "wsl",
            name: "WSL",
            configPath: wslPath,
            type: "wsl",
            accessible: true,
          };
        }
      }

      return null;
    } catch (error) {
      // Log error for debugging but don't throw
      console.error("Failed to detect WSL from Windows:", error);
      return null;
    }
  }

  /**
   * Detect Windows environment from WSL.
   * Checks for Windows config via /mnt/c/Users/...
   */
  private async detectWindowsFromWsl(): Promise<Environment | null> {
    try {
      const username = os.userInfo().username;
      const windowsPath = `/mnt/c/Users/${username}/.claude.json`;

      if (await this.testAccess(windowsPath)) {
        return {
          id: "windows",
          name: "Windows",
          configPath: windowsPath,
          type: "windows",
          accessible: true,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Test if a file path is accessible.
   */
  private async testAccess(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
