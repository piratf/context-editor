/**
 * Abstract file filter system for Claude Code configuration views.
 *
 * This design provides an extensible, composable filtering mechanism
 * that can be used to show only Claude-related files and directories.
 *
 * The filter system is designed to support:
 * - Claude Code files (.claude/, CLAUDE.md, .mcp.json)
 * - Future AI tool files (gemini cli, etc.)
 * - User-configurable filters
 * - Composable filter combinations (AND, OR, NOT)
 *
 * @example
 * ```typescript
 * const claudeFilter = new ClaudeCodeFileFilter();
 * const includesFilter = new NamePatternFilter(/^include-/);
 * const combined = new OrFilter([claudeFilter, includesFilter]);
 * ```
 */

/**
 * Context information for filtering decisions
 */
export interface FilterContext {
  /** Full path being evaluated */
  readonly path: string;
  /** Parent directory path */
  readonly parentPath: string;
  /** Entry name (file or directory name) */
  readonly name: string;
  /** Whether the entry is a directory */
  readonly isDirectory: boolean;
  /** Whether this is inside a .claude directory */
  readonly isInsideClaudeDir: boolean;
  /** Path separator for the current platform */
  readonly pathSep: string;
}

/**
 * Result of a filter evaluation
 */
export type FilterResult =
  | { readonly include: true; readonly reason?: string }
  | { readonly include: false; readonly reason?: string };

/**
 * Abstract base interface for file filters
 *
 * Filters are used to determine which files and directories should
 * be displayed in the tree view.
 */
export interface FileFilter {
  /**
   * Evaluate whether an entry should be included
   *
   * @param context - Filter context information
   * @returns Filter result with include flag and optional reason
   */
  evaluate(context: FilterContext): FilterResult | Promise<FilterResult>;

  /**
   * Optional description of what this filter does
   */
  readonly description?: string;
}

/**
 * Synchronous filter interface for simple, fast filtering
 */
export interface SyncFileFilter extends FileFilter {
  /**
   * Synchronous evaluate for performance-critical paths
   */
  evaluate(context: FilterContext): FilterResult;
}

/**
 * Abstract base class for filters with common functionality
 */
export abstract class BaseFilter implements FileFilter {
  abstract readonly description?: string;
  abstract evaluate(context: FilterContext): FilterResult | Promise<FilterResult>;

  /**
   * Helper to create an include result
   */
  protected include(reason?: string): FilterResult {
    return reason === undefined ? { include: true } : { include: true, reason };
  }

  /**
   * Helper to create an exclude result
   */
  protected exclude(reason?: string): FilterResult {
    return reason === undefined ? { include: false } : { include: false, reason };
  }
}

/**
 * Filter that includes everything (no filtering)
 */
export class AllowAllFilter extends BaseFilter implements SyncFileFilter {
  readonly description = "Allow all files and directories";

  evaluate(_context: FilterContext): FilterResult {
    return this.include("Allow all");
  }
}

/**
 * Filter that excludes everything
 */
export class DenyAllFilter extends BaseFilter implements SyncFileFilter {
  readonly description = "Deny all files and directories";

  evaluate(_context: FilterContext): FilterResult {
    return this.exclude("Deny all");
  }
}

/**
 * Combines multiple filters with AND logic
 * Entry is included only if ALL filters include it
 */
export class AndFilter extends BaseFilter implements SyncFileFilter {
  readonly description: string;

  constructor(private readonly filters: FileFilter[]) {
    super();
    this.description = `AND(${this.filters.map((f) => f.description ?? "unknown").join(", ")})`;
  }

  evaluate(context: FilterContext): FilterResult {
    const reasons: string[] = [];

    for (const filter of this.filters) {
      const result = filter.evaluate(context);

      // Support async filters - but evaluate synchronously when possible
      if (result instanceof Promise) {
        // For async filters in AND, we need to handle differently
        // For now, throw to indicate this shouldn't be used with async
        throw new Error("AndFilter cannot be used with async filters");
      }

      if (!result.include) {
        return this.exclude(`AND failed: ${result.reason ?? "no reason"}`);
      }
      if (result.reason !== undefined) {
        reasons.push(result.reason);
      }
    }

    return this.include(reasons.length > 0 ? reasons.join(" AND ") : "AND passed");
  }
}

/**
 * Combines multiple filters with OR logic
 * Entry is included if ANY filter includes it
 */
export class OrFilter extends BaseFilter implements SyncFileFilter {
  readonly description: string;

  constructor(private readonly filters: FileFilter[]) {
    super();
    this.description = `OR(${this.filters.map((f) => f.description !== undefined ? f.description : "unknown").join(", ")})`;
  }

  evaluate(context: FilterContext): FilterResult {
    const reasons: string[] = [];

    for (const filter of this.filters) {
      const result = filter.evaluate(context);

      if (result instanceof Promise) {
        throw new Error("OrFilter cannot be used with async filters");
      }

      if (result.include) {
        return this.include(result.reason ?? "OR passed");
      }
      if (result.reason !== undefined) {
        reasons.push(result.reason);
      }
    }

    return this.exclude(`OR failed: all filters rejected (${reasons.join(", ")})`);
  }
}

/**
 * Inverts a filter's decision
 */
export class NotFilter extends BaseFilter implements SyncFileFilter {
  readonly description: string;

  constructor(private readonly filter: FileFilter) {
    super();
    this.description = `NOT(${filter.description !== undefined ? filter.description : "unknown"})`;
  }

  evaluate(context: FilterContext): FilterResult {
    const result = this.filter.evaluate(context);

    if (result instanceof Promise) {
      throw new Error("NotFilter cannot be used with async filters");
    }

    return result.include
      ? this.exclude(`NOT: ${result.reason ?? "excluded by negation"}`)
      : this.include(`NOT: ${result.reason ?? "included by negation"}`);
  }
}

/**
 * Filter based on entry name patterns
 */
export class NamePatternFilter extends BaseFilter implements SyncFileFilter {
  readonly description: string;

  constructor(
    private readonly config: {
      /** RegExp patterns to match (include if ANY pattern matches) */
      includePatterns?: RegExp[];
      /** RegExp patterns to exclude (exclude if ANY pattern matches) */
      excludePatterns?: RegExp[];
      /** Whether to apply to directories */
      applyToDirectories?: boolean;
      /** Whether to apply to files */
      applyToFiles?: boolean;
      /** Filter description */
      description?: string;
    }
  ) {
    super();
    const { includePatterns, excludePatterns, description } = config;
    const includes = includePatterns?.map((p) => p.source).join(", ") ?? "none";
    const excludes = excludePatterns?.map((p) => p.source).join(", ") ?? "none";
    this.description = description ?? `NamePattern(include: [${includes}], exclude: [${excludes}])`;
  }

  evaluate(context: FilterContext): FilterResult {
    const { name, isDirectory } = context;
    const { applyToDirectories = true, applyToFiles = true, includePatterns, excludePatterns } = this.config;

    // Check if filter applies to this entry type
    if (isDirectory && !applyToDirectories) {
      return this.include("Filter does not apply to directories");
    }
    if (!isDirectory && !applyToFiles) {
      return this.include("Filter does not apply to files");
    }

    // Check exclude patterns first
    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        if (pattern.test(name)) {
          return this.exclude(`Name matches exclude pattern: ${pattern.source}`);
        }
      }
    }

    // Check include patterns
    if (includePatterns && includePatterns.length > 0) {
      for (const pattern of includePatterns) {
        if (pattern.test(name)) {
          return this.include(`Name matches include pattern: ${pattern.source}`);
        }
      }
      return this.exclude("Name does not match any include pattern");
    }

    return this.include("No include patterns specified");
  }
}

/**
 * Filter for Claude Code related files and directories
 *
 * Includes:
 * - .claude directory (at any level)
 * - Contents of .claude directory (all files/dirs inside)
 * - CLAUDE.md and .claude.md files
 * - .mcp.json files
 * - .claude.json files
 *
 * Designed to be extensible for future AI tool files
 */
export class ClaudeCodeFileFilter extends BaseFilter implements SyncFileFilter {
  readonly description: string = "Claude Code files filter";

  private readonly CLAUDE_DIR_NAMES = [".claude"];
  private readonly CLAUDE_FILE_PATTERNS = [
    /^CLAUDE\.md$/,
    /^\.claude\.md$/,
    /^\.mcp\.json$/,
    /^\.claude\.json$/,
  ];

  /**
   * Patterns for future AI tool files (extensible)
   * Example: gemini config files would go here
   */
  private readonly AI_TOOL_PATTERNS: RegExp[] = [
    // Future: /^gemini-config\.json$/
    // Future: /^\.ai-cursor$/
  ];

  evaluate(context: FilterContext): FilterResult {
    const { name, isDirectory, isInsideClaudeDir } = context;

    // Always include everything inside .claude directory
    if (isInsideClaudeDir) {
      return this.include("Inside .claude directory");
    }

    // Always include .claude directory itself
    if (isDirectory && this.CLAUDE_DIR_NAMES.includes(name)) {
      return this.include("Claude directory");
    }

    // For files, check Claude file patterns
    if (!isDirectory) {
      for (const pattern of [...this.CLAUDE_FILE_PATTERNS, ...this.AI_TOOL_PATTERNS]) {
        if (pattern.test(name)) {
          return this.include("Claude-related file");
        }
      }
    }

    // Exclude everything else
    return this.exclude("Not a Claude-related file or directory");
  }
}

/**
 * Filter for project-specific Claude files
 *
 * More restrictive than global Claude filter:
 * - Shows only .claude directory and its contents
 * - Shows CLAUDE.md and .claude.md files
 * - Shows .mcp.json files
 * - Hides everything else
 */
export class ProjectClaudeFileFilter extends ClaudeCodeFileFilter {
  readonly description = "Project Claude files filter";

  // Project filter is more restrictive - inherits from ClaudeCodeFileFilter
  // but can be customized if needed

  override evaluate(context: FilterContext): FilterResult {
    const result = super.evaluate(context);

    // For projects, we might want additional restrictions
    // For now, use the same logic as the global Claude filter
    return result;
  }
}

/**
 * Filter factory namespace for creating common filter combinations
 */
export const FilterFactory = {
  /**
   * Create a filter that combines Claude file filter with additional patterns
   *
   * @param extraIncludePatterns - Additional patterns to include
   * @param extraExcludePatterns - Additional patterns to exclude
   */
  createClaudeFilterWithExtras(
    extraIncludePatterns?: RegExp[],
    extraExcludePatterns?: RegExp[]
  ): SyncFileFilter {
    const filters: FileFilter[] = [new ClaudeCodeFileFilter()];

    if (extraIncludePatterns && extraIncludePatterns.length > 0) {
      const config: {
        includePatterns: RegExp[];
        excludePatterns?: RegExp[];
        applyToDirectories?: boolean;
        applyToFiles?: boolean;
        description?: string;
      } = {
        includePatterns: extraIncludePatterns,
      };
      if (extraExcludePatterns && extraExcludePatterns.length > 0) {
        config.excludePatterns = extraExcludePatterns;
      }
      filters.push(new NamePatternFilter(config));
    }

    return filters.length === 1
      ? (filters[0] as SyncFileFilter)
      : new OrFilter(filters);
  },

  /**
   * Create a chain of filters for different contexts
   *
   * @param context - The filtering context ('global', 'project', 'claude-dir')
   */
  createFilterForContext(context: "global" | "project" | "claude-dir"): SyncFileFilter {
    switch (context) {
      case "project":
        return new ProjectClaudeFileFilter();
      case "claude-dir":
        return new AllowAllFilter(); // Show everything inside .claude
      case "global":
      default:
        return new ClaudeCodeFileFilter();
    }
  },

  /**
   * Create a filter from configuration
   *
   * This allows users to configure filters via settings
   *
   * @param config - Filter configuration
   */
  fromConfig(config: {
    includePatterns?: string[];
    excludePatterns?: string[];
    useClaudeFilter?: boolean;
    context?: "global" | "project" | "claude-dir";
  }): SyncFileFilter {
    const filters: SyncFileFilter[] = [];

    // Add Claude filter if requested
    if (config.useClaudeFilter !== false) {
      filters.push(FilterFactory.createFilterForContext(config.context ?? "project"));
    }

    // Add custom pattern filters
    if (config.includePatterns && config.includePatterns.length > 0) {
      const patternConfig: {
        includePatterns: RegExp[];
        excludePatterns?: RegExp[];
        applyToDirectories?: boolean;
        applyToFiles?: boolean;
        description?: string;
      } = {
        includePatterns: config.includePatterns.map((p) => new RegExp(p)),
      };
      if (config.excludePatterns && config.excludePatterns.length > 0) {
        patternConfig.excludePatterns = config.excludePatterns.map((p) => new RegExp(p));
      }
      filters.push(new NamePatternFilter(patternConfig));
    }

    // Combine with OR if we have Claude filter + custom patterns
    if (filters.length > 1) {
      return new OrFilter(filters);
    }

    return filters[0] ?? new AllowAllFilter();
  },
} as const;

/**
 * Helper function to create filter context from path info
 */
export function createFilterContext(
  path: string,
  name: string,
  isDirectory: boolean,
  isInsideClaudeDir: boolean,
  parentPath: string = "",
  pathSep: string = "/"
): FilterContext {
  return {
    path,
    name,
    isDirectory,
    isInsideClaudeDir,
    parentPath,
    pathSep,
  };
}

/**
 * Helper to check if a path is inside a .claude directory
 */
export function isInsideClaudeDir(path: string, pathSep: string = "/"): boolean {
  return (
    path.includes(`${pathSep}.claude${pathSep}`) ||
    path.endsWith(`${pathSep}.claude`) ||
    path.endsWith(".claude")
  );
}
