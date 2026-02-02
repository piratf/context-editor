/**
 * Service for detecting Claude Code environments across platforms.
 * Supports Windows, WSL, macOS, and Linux with cross-environment detection.
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { exec, execSync } from "node:child_process";
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
      // Note: wsl -l -q output may be UTF-16LE encoded, so use execSync with buffer detection
      let distrosOutput: string;
      try {
        const buffer = execSync("wsl -l -q", { timeout: 5000 }) as Buffer;
        // Check for UTF-16LE BOM or pattern
        if (buffer.length > 1 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
          distrosOutput = buffer.toString("utf16le");
        } else if (buffer.indexOf(0) >= 0 && buffer.indexOf(0) < buffer.length / 2) {
          // Likely UTF-16LE without BOM (null bytes present)
          distrosOutput = buffer.toString("utf16le");
        } else {
          distrosOutput = buffer.toString("utf8");
        }
      } catch (_e) {
        // Fallback to async version
        const { stdout } = await execAsync("wsl -l -q", { timeout: 5000 });
        distrosOutput = stdout;
      }

      // Sanitize: remove null bytes, carriage returns, and extra whitespace
      const cleanStdout = distrosOutput
        .replace(/\0/g, "")
        .replace(/\r/g, "")
        .trim();
      const lines = cleanStdout.split("\n");
      const distros = lines.filter((line) => line.trim().length > 0);

      if (distros.length === 0) {
        return null;
      }

      // Use the first distribution to detect config
      const distro = distros[0].trim();
      const username = os.userInfo().username;
      const wslConfigPath = `/home/${username}/.claude.json`;

      // Build network paths - use string concatenation to avoid template literal issues
      // Legacy format (more widely supported)
      const legacyPath = "\\\\wsl$\\" + distro + "\\home\\" + username + "\\.claude.json";
      // Windows 11+ format
      const newPath = "\\\\wsl.localhost\\" + distro + "\\home\\" + username + "\\.claude.json";

      const networkPaths = [legacyPath, newPath] as const;

      // First, verify the file exists in WSL using wsl command
      let fileExists = false;
      try {
        const { stdout: testOutput } = await execAsync(
          `wsl -d ${distro} -- test -f ${wslConfigPath}`,
          { timeout: 5000 }
        );
        fileExists = testOutput.trim() === ""; // test -f returns empty on success
      } catch {
        // If wsl test fails, try direct network path access
      }

      if (!fileExists) {
        // Fallback: check if network paths are directly accessible
        for (const wslPath of networkPaths) {
          if (await this.testAccess(wslPath)) {
            fileExists = true;
            break;
          }
        }
      }

      if (!fileExists) {
        return null;
      }

      // Return with the first working network path format
      // Prefer legacy format for better compatibility
      return {
        id: "wsl",
        name: "WSL",
        configPath: networkPaths[0],
        type: "wsl",
        accessible: true,
      };
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
