/**
 * Claude Configuration Reader
 *
 * Reads ~/.claude.json to get Claude AI project list.
 * Projects are returned in the same IProjectEntry format used by other AI tools.
 *
 * This service extracts the Claude config reading logic from BaseDataFacade
 * to enable clean separation of concerns.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import type { IProjectEntry } from "../types/environment.js";

/**
 * Claude .claude.json configuration structure
 */
export interface ClaudeConfigFile {
  readonly projects?: Readonly<Record<string, unknown>> | readonly unknown[];
}

/**
 * Claude configuration reader
 * Reads ~/.claude.json to get project list
 */
export class ClaudeConfig {
  constructor(private readonly homePath: string) {}

  /**
   * Get Claude projects from ~/.claude.json
   * @returns Promise resolving to array of project entries
   */
  async getProjects(): Promise<readonly IProjectEntry[]> {
    const configPath = path.join(this.homePath, ".claude.json");

    try {
      const content = await fs.readFile(configPath, "utf-8");
      const config = this.parseConfig(content);
      return this.normalizeProjects(config.projects);
    } catch {
      return [];
    }
  }

  /**
   * Parse the configuration file content
   * @param content - JSON content from .claude.json
   * @returns Parsed configuration object
   */
  private parseConfig(content: string): ClaudeConfigFile {
    if (!content || content.trim().length === 0) {
      return {};
    }
    try {
      return JSON.parse(content) as ClaudeConfigFile;
    } catch {
      return {};
    }
  }

  /**
   * Normalize Claude projects to IProjectEntry format
   * Handles both array and record formats from .claude.json.
   *
   * The actual .claude.json format uses an object where:
   * - Key: project path (e.g., "/home/cloud", "/mnt/c/Users/...")
   * - Value: project configuration (allowedTools, mcpServers, state, etc.)
   *
   * @param projects - Projects from .claude.json
   * @returns Array of project entries
   */
  private normalizeProjects(projects: unknown): IProjectEntry[] {
    if (projects === null || projects === undefined) {
      return [];
    }

    // Handle array format
    if (Array.isArray(projects)) {
      return projects.filter(this.isValidProjectEntry.bind(this)).map(
        (entry): IProjectEntry => ({
          path: entry.path,
          label: this.extractLabelFromPath(entry.path),
        })
      );
    }

    // Handle record format (key = path, value = config)
    if (typeof projects === "object") {
      const result: IProjectEntry[] = [];
      for (const [projectPath, config] of Object.entries(projects as Record<string, unknown>)) {
        if (typeof config === "object" && config !== null) {
          result.push({
            path: projectPath,
            label: this.extractLabelFromPath(projectPath),
          });
        }
      }
      return result;
    }

    return [];
  }

  /**
   * Extract label from path
   * @param path - Project path
   * @returns Label extracted from the last path component
   */
  private extractLabelFromPath(path: string): string {
    const parts = path.split(/[/\\]/).filter((p) => p.length > 0);
    return parts[parts.length - 1] ?? path;
  }

  /**
   * Validate if an object is a valid project entry
   */
  private isValidProjectEntry(entry: unknown): entry is IProjectEntry {
    return (
      typeof entry === "object" &&
      entry !== null &&
      "path" in entry &&
      typeof (entry as IProjectEntry).path === "string"
    );
  }
}
