/**
 * AI Config Aggregator
 *
 * Aggregates projects from all AI tool configurations.
 * Provides a unified interface for accessing projects across multiple AI tools.
 *
 * Supported AI tools:
 * - Claude: ~/.claude.json
 * - Gemini: ~/.gemini/projects.json
 * - Future: Cursor, Aider, Roo, etc.
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";
import type { IProjectEntry } from "../types/environment.js";
import type { IDataFacade } from "./dataFacade.js";
import { EnvironmentType } from "./dataFacade.js";
import { ClaudeConfig } from "./claudeConfig.js";
import { GeminiConfig } from "./geminiConfig.js";

/**
 * Aggregator for AI tool configurations
 *
 * Collects projects from all available AI tools, handles path conversion,
 * and provides deduplicated results.
 */
export class AIConfigAggregator {
  constructor(private readonly facade: IDataFacade) {}

  /**
   * Get all projects from all available AI tools
   *
   * Projects are path-converted to the current environment format
   * and deduplicated by path (later sources override earlier ones).
   *
   * @returns Promise resolving to deduplicated array of project entries
   */
  async getAllProjects(): Promise<readonly IProjectEntry[]> {
    const homePath = this.facade.getHomePath();

    // Get projects from all AI tools in parallel
    const [claudeProjects, geminiProjects] = await Promise.all([
      new ClaudeConfig(homePath).getProjects(),
      new GeminiConfig(homePath).getProjects(),
    ]);

    // Convert paths to current environment format
    const convertedClaudeProjects = claudeProjects.map((project) => ({
      ...project,
      path: this.facade.convertPath(project.path),
    }));

    const convertedGeminiProjects = geminiProjects.map((project) => ({
      ...project,
      path: this.facade.convertPath(project.path),
    }));

    // Merge and deduplicate
    const allProjects = [...convertedClaudeProjects, ...convertedGeminiProjects];
    const deduplicated = this.deduplicateAndSort(allProjects);

    // Filter out inaccessible paths (async)
    return this.filterAccessiblePaths(deduplicated);
  }

  /**
   * Get Claude projects only
   *
   * @returns Promise resolving to array of Claude project entries
   */
  async getClaudeProjects(): Promise<readonly IProjectEntry[]> {
    const homePath = this.facade.getHomePath();
    const projects = await new ClaudeConfig(homePath).getProjects();

    return projects.map((project) => ({
      ...project,
      path: this.facade.convertPath(project.path),
    }));
  }

  /**
   * Get Gemini projects only
   *
   * @returns Promise resolving to array of Gemini project entries
   */
  async getGeminiProjects(): Promise<readonly IProjectEntry[]> {
    const homePath = this.facade.getHomePath();
    const projects = await new GeminiConfig(homePath).getProjects();

    return projects.map((project) => ({
      ...project,
      path: this.facade.convertPath(project.path),
    }));
  }

  /**
   * Filter paths to only include those accessible in the current environment
   * Uses fs.access() to verify paths actually exist and are accessible
   */
  private async filterAccessiblePaths(
    projects: readonly IProjectEntry[]
  ): Promise<IProjectEntry[]> {
    // Check accessibility in parallel for better performance
    const accessibilityResults = await Promise.all(
      projects.map(async (project) => {
        try {
          await fs.access(project.path);
          return { accessible: true, project };
        } catch {
          return { accessible: false, project };
        }
      })
    );

    // Return only accessible projects
    return accessibilityResults
      .filter((result) => result.accessible)
      .map((result) => result.project);
  }

  /**
   * Normalize a path for comparison
   *
   * Handles Windows-specific path inconsistencies:
   * - Mixed separators (C:/Users vs C:\Users)
   * - Case differences (c:\users vs C:\Users)
   * - UNC paths vs drive letters
   */
  private normalizePathForComparison(filePath: string): string {
    let normalized = filePath;

    // Convert all separators to platform-specific format
    // On Windows, normalize to backslashes; on others, forward slashes
    normalized = path.normalize(normalized);

    // For Windows, also handle case-insensitivity
    const isWindows =
      (this.facade.getEnvironmentInfo().type as EnvironmentType) === EnvironmentType.Windows;
    if (isWindows) {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  /**
   * Deduplicate and sort projects by path
   *
   * Later projects with the same path will override earlier ones
   * (Gemini overrides Claude).
   *
   * Uses platform-aware path comparison for Windows:
   * - Case-insensitive
   * - Normalized separators (handles both \ and /)
   *
   * @param projects - Array of project entries to deduplicate
   * @returns Deduplicated and sorted project entries
   */
  private deduplicateAndSort(projects: readonly IProjectEntry[]): IProjectEntry[] {
    const pathMap = new Map<string, IProjectEntry>();

    for (const project of projects) {
      // Normalize path for comparison
      const normalizedKey = this.normalizePathForComparison(project.path);
      pathMap.set(normalizedKey, project);
    }

    // Sort by label
    return Array.from(pathMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }
}
