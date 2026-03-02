/**
 * AI Tools Detection Constants and Utilities
 *
 * Defines AI tool directories and configuration files for detection.
 * Used by WSL discovery and other features that need to find AI tools.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * AI tool directories to scan in home folder
 */
export const AI_TOOL_DIRS = [
  // Mainstream AI tool directories
  ".claude",
  ".gemini",
  ".cursor",
  ".aider",
  ".roo",
  ".cline",
  ".trae",
  ".codeium",
  ".github",
  ".openai",
  ".codex",
  // Universal standard and protocol directories
  ".agents",
  ".mcp",
  ".skills",
  ".well-known",
] as const;

/**
 * AI tool configuration files to scan in home folder
 */
export const AI_CONFIG_FILES = [
  { name: "claude", path: ".claude.json" },
  { name: "gemini", path: ".gemini/projects.json" },
  { name: "cursor", path: ".cursor/config.json" },
] as const;

/**
 * Check if a specific path exists and matches the expected type
 *
 * @param targetPath - Full path to check
 * @param type - Expected type ("dir" or "file")
 * @returns Promise resolving to true if path exists and matches type
 */
async function checkPath(targetPath: string, type: "dir" | "file"): Promise<boolean> {
  try {
    const stats = await fs.stat(targetPath);
    return type === "dir" ? stats.isDirectory() : stats.isFile();
  } catch {
    return false;
  }
}

/**
 * Check if any AI tool exists in the given home path
 *
 * This function checks for both AI tool directories and config files.
 * Used primarily for WSL environment discovery to determine if a
 * WSL instance has any AI development tools installed.
 *
 * @param homePath - Home directory path to check
 * @returns Promise resolving to true if any AI tool is detected
 */
export async function hasAnyAITool(homePath: string): Promise<boolean> {
  // Check all AI tool directories
  const dirChecks = AI_TOOL_DIRS.map((dir) => checkPath(path.join(homePath, dir), "dir"));

  // Check all AI config files
  const fileChecks = AI_CONFIG_FILES.map(({ path: p }) =>
    checkPath(path.join(homePath, p), "file")
  );

  // Run all checks in parallel
  const results = await Promise.all([...dirChecks, ...fileChecks]);

  // Return true if any check succeeded
  return results.some(Boolean);
}

/**
 * Check if a specific AI tool directory exists
 *
 * @param homePath - Home directory path
 * @param toolDir - Tool directory name (e.g., ".claude", ".gemini")
 * @returns Promise resolving to true if the directory exists
 */
export async function hasAIToolDirectory(homePath: string, toolDir: string): Promise<boolean> {
  return checkPath(path.join(homePath, toolDir), "dir");
}

/**
 * Check if a specific AI tool config file exists
 *
 * @param homePath - Home directory path
 * @param configPath - Relative path to config file (e.g., ".claude.json")
 * @returns Promise resolving to true if the file exists
 */
export async function hasAIToolConfig(homePath: string, configPath: string): Promise<boolean> {
  return checkPath(path.join(homePath, configPath), "file");
}
