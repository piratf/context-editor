/**
 * Gemini Configuration Reader
 *
 * Reads ~/.gemini/projects.json to get Gemini AI project list.
 * Projects are returned in the same IProjectEntry format used by Claude config.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import type { IProjectEntry } from "../types/environment.js";

/**
 * Gemini projects.json configuration structure
 */
export interface GeminiProjectsConfig {
  readonly projects: Readonly<Record<string, string>>;
}

/**
 * Gemini configuration reader
 * Reads ~/.gemini/projects.json to get project list
 */
export class GeminiConfig {
  constructor(private readonly homePath: string) {}

  /**
   * Get Gemini projects from ~/.gemini/projects.json
   * @returns Promise resolving to array of project entries
   */
  async getProjects(): Promise<readonly IProjectEntry[]> {
    const projectsPath = this.joinPath(this.homePath, ".gemini", "projects.json");

    try {
      const content = await fs.readFile(projectsPath, "utf-8");
      const config = this.parseConfig(content);
      return this.normalizeProjects(config.projects);
    } catch {
      return [];
    }
  }

  /**
   * Parse the configuration file content
   * @param content - JSON content from projects.json
   * @returns Parsed configuration object
   */
  private parseConfig(content: string): GeminiProjectsConfig {
    if (!content || content.trim().length === 0) {
      return { projects: {} };
    }
    try {
      const parsed = JSON.parse(content) as Partial<GeminiProjectsConfig>;
      // Ensure projects key exists, default to empty object if missing
      return { projects: parsed.projects ?? {} };
    } catch {
      return { projects: {} };
    }
  }

  /**
   * Normalize Gemini projects to IProjectEntry format
   * @param projects - Projects record from projects.json
   * @returns Array of project entries
   */
  private normalizeProjects(projects: Readonly<Record<string, string>>): IProjectEntry[] {
    return Object.entries(projects).map(
      ([path, configuredLabel]): IProjectEntry => ({
        path,
        // Use configured label, or extract from path as fallback
        label: configuredLabel || this.extractLabelFromPath(path),
      })
    );
  }

  /**
   * Extract label from path
   * @param path - Project path
   * @returns Label extracted from the last path component
   */
  private extractLabelFromPath(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] ?? path;
  }

  /**
   * Join path parts using platform-appropriate separator
   * @param parts - Path parts to join
   * @returns Joined path
   */
  private joinPath(...parts: string[]): string {
    return path.join(...parts);
  }
}
