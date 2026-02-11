/**
 * Unit tests for FileFilter system
 */

/* eslint-disable @typescript-eslint/no-floating-promises */
import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  type FilterContext,
  AllowAllFilter,
  DenyAllFilter,
  AndFilter,
  OrFilter,
  NotFilter,
  NamePatternFilter,
  ClaudeCodeFileFilter,
  ProjectClaudeFileFilter,
  FilterFactory,
  createFilterContext,
  isInsideDirectory,
} from "../../types/fileFilter.js";

describe("FileFilter Tests", () => {
  /**
   * Helper to create a basic filter context
   */
  function createTestContext(
    name: string,
    isDirectory: boolean,
    parentPath: string = "/home/test/project"
  ): FilterContext {
    return createFilterContext(
      `${parentPath}/${name}`,
      name,
      isDirectory,
      parentPath,
      "/"
    );
  }

  describe("createFilterContext", () => {
    it("should create filter context with correct properties", () => {
      const context = createFilterContext("/home/test/.claude/settings.json", "settings.json", false, "/home/test/.claude", "/");

      assert.strictEqual(context.path, "/home/test/.claude/settings.json");
      assert.strictEqual(context.name, "settings.json");
      assert.strictEqual(context.isDirectory, false);
      assert.strictEqual(context.parentPath, "/home/test/.claude");
      assert.strictEqual(context.pathSep, "/");
    });
  });

  describe("isInsideDirectory", () => {
    it("should detect .claude directory in middle of path", () => {
      assert.strictEqual(isInsideDirectory("/home/test/.claude/settings.json", ".claude", "/"), true);
    });

    it("should detect path ending with .claude", () => {
      assert.strictEqual(isInsideDirectory("/home/test/.claude", ".claude", "/"), true);
    });

    it("should return false for non-.claude paths", () => {
      assert.strictEqual(isInsideDirectory("/home/test/project/src", ".claude", "/"), false);
    });

    it("should work with Windows path separators", () => {
      assert.strictEqual(isInsideDirectory("C:\\Users\\test\\.claude\\settings.json", ".claude", "\\"), true);
    });
  });

  describe("AllowAllFilter", () => {
    it("should include all files and directories", () => {
      const filter = new AllowAllFilter();

      const fileResult = filter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(fileResult.include, true);

      const dirResult = filter.evaluate(createTestContext("dirname", true, "/home/test"));
      assert.strictEqual(dirResult.include, true);
    });

    it("should have correct description", () => {
      const filter = new AllowAllFilter();
      assert.strictEqual(filter.description, "Allow all files and directories");
    });
  });

  describe("DenyAllFilter", () => {
    it("should exclude all files and directories", () => {
      const filter = new DenyAllFilter();

      const fileResult = filter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(fileResult.include, false);

      const dirResult = filter.evaluate(createTestContext("dirname", true, "/home/test"));
      assert.strictEqual(dirResult.include, false);
    });

    it("should have correct description", () => {
      const filter = new DenyAllFilter();
      assert.strictEqual(filter.description, "Deny all files and directories");
    });
  });

  describe("AndFilter", () => {
    it("should include only when all filters include", () => {
      const filter1 = new NamePatternFilter({ includePatterns: [/^test/] });
      const filter2 = new NamePatternFilter({ includePatterns: [/\.txt$/] });
      const andFilter = new AndFilter([filter1, filter2]);

      const result = andFilter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should exclude when any filter excludes", () => {
      const filter1 = new NamePatternFilter({ includePatterns: [/^test/] });
      const filter2 = new NamePatternFilter({ includePatterns: [/^hello/] });
      const andFilter = new AndFilter([filter1, filter2]);

      const result = andFilter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result.include, false);
    });

    it("should handle multiple filters", () => {
      const filters = [
        new NamePatternFilter({ includePatterns: [/^claude/] }),
        new NamePatternFilter({ includePatterns: [/\.json$/] }),
        new AllowAllFilter(),
      ];
      const andFilter = new AndFilter(filters);

      const result = andFilter.evaluate(createTestContext("claude.json", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });
  });

  describe("OrFilter", () => {
    it("should include when any filter includes", () => {
      const filter1 = new NamePatternFilter({ includePatterns: [/^test/] });
      const filter2 = new NamePatternFilter({ includePatterns: [/^hello/] });
      const orFilter = new OrFilter([filter1, filter2]);

      const result1 = orFilter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result1.include, true);

      const result2 = orFilter.evaluate(createTestContext("hello.txt", false, "/home/test"));
      assert.strictEqual(result2.include, true);
    });

    it("should exclude when all filters exclude", () => {
      const filter1 = new NamePatternFilter({ includePatterns: [/^test/] });
      const filter2 = new NamePatternFilter({ includePatterns: [/^hello/] });
      const orFilter = new OrFilter([filter1, filter2]);

      const result = orFilter.evaluate(createTestContext("world.txt", false, "/home/test"));
      assert.strictEqual(result.include, false);
    });
  });

  describe("NotFilter", () => {
    it("should invert filter decision", () => {
      const allowFilter = new AllowAllFilter();
      const notFilter = new NotFilter(allowFilter);

      const result = notFilter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result.include, false);
    });

    it("should include when wrapped filter excludes", () => {
      const denyFilter = new DenyAllFilter();
      const notFilter = new NotFilter(denyFilter);

      const result = notFilter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });
  });

  describe("NamePatternFilter", () => {
    it("should match include patterns", () => {
      const filter = new NamePatternFilter({
        includePatterns: [/^test/, /\.txt$/],
      });

      const result1 = filter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result1.include, true);

      const result2 = filter.evaluate(createTestContext("hello.txt", false, "/home/test"));
      assert.strictEqual(result2.include, true);

      const result3 = filter.evaluate(createTestContext("test.json", false, "/home/test"));
      assert.strictEqual(result3.include, true);
    });

    it("should match exclude patterns", () => {
      const filter = new NamePatternFilter({
        excludePatterns: [/^test/, /\.tmp$/],
      });

      const result1 = filter.evaluate(createTestContext("test.txt", false, "/home/test"));
      assert.strictEqual(result1.include, false);

      const result2 = filter.evaluate(createTestContext("hello.tmp", false, "/home/test"));
      assert.strictEqual(result2.include, false);

      const result3 = filter.evaluate(createTestContext("hello.txt", false, "/home/test"));
      assert.strictEqual(result3.include, true);
    });

    it("should respect applyToDirectories flag", () => {
      const filter = new NamePatternFilter({
        includePatterns: [/^src/],
        applyToDirectories: true,
        applyToFiles: false,
      });

      const dirResult = filter.evaluate(createTestContext("src", true, "/home/test"));
      assert.strictEqual(dirResult.include, true);

      const fileResult = filter.evaluate(createTestContext("src.txt", false, "/home/test"));
      assert.strictEqual(fileResult.include, true); // Doesn't apply to files, so include all
    });

    it("should respect applyToFiles flag", () => {
      const filter = new NamePatternFilter({
        includePatterns: [/^src/],
        applyToDirectories: false,
        applyToFiles: true,
      });

      const dirResult = filter.evaluate(createTestContext("src", true, "/home/test"));
      assert.strictEqual(dirResult.include, true); // Doesn't apply to directories, so include all

      const fileResult = filter.evaluate(createTestContext("src.txt", false, "/home/test"));
      assert.strictEqual(fileResult.include, true);
    });
  });

  describe("ClaudeCodeFileFilter", () => {
    it("should include .claude directory", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext(".claude", true, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should include CLAUDE.md files", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext("CLAUDE.md", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should include .claude.md files", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext(".claude.md", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should include .mcp.json files", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext(".mcp.json", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should include .claude.json files", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext(".claude.json", false, "/home/test"));
      assert.strictEqual(result.include, true);
    });

    it("should exclude non-Claude files", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext("README.md", false, "/home/test"));
      assert.strictEqual(result.include, false);
    });

    it("should exclude non-Claude directories", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext("src", true, "/home/test"));
      assert.strictEqual(result.include, false);
    });

    it("should include all files inside .claude directory", () => {
      const filter = new ClaudeCodeFileFilter();
      const context = createFilterContext("/home/test/.claude/settings.json", "settings.json", false, "/home/test/.claude", "/");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, true);
    });

    it("should include all directories inside .claude directory", () => {
      const filter = new ClaudeCodeFileFilter();
      const context = createFilterContext("/home/test/.claude/skills", "skills", true, "/home/test/.claude", "/");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, true);
    });
  });

  describe("ProjectClaudeFileFilter", () => {
    it("should extend ClaudeCodeFileFilter behavior", () => {
      const filter = new ProjectClaudeFileFilter();

      // Should behave the same as ClaudeCodeFileFilter
      const claudeDirResult = filter.evaluate(createTestContext(".claude", true, "/home/test"));
      assert.strictEqual(claudeDirResult.include, true);

      const claudeMdResult = filter.evaluate(createTestContext("CLAUDE.md", false, "/home/test"));
      assert.strictEqual(claudeMdResult.include, true);
    });
  });

  describe("FilterFactory.createFilterForContext", () => {
    it("should create ProjectClaudeFileFilter for project context", () => {
      const filter = FilterFactory.createFilterForContext("project");
      assert.ok(filter instanceof ProjectClaudeFileFilter);
    });

    it("should create AllowAllFilter for claude-dir context", () => {
      const filter = FilterFactory.createFilterForContext("claude-dir");
      assert.ok(filter instanceof AllowAllFilter);
    });

    it("should create ClaudeCodeFileFilter for global context", () => {
      const filter = FilterFactory.createFilterForContext("global");
      assert.ok(filter instanceof ClaudeCodeFileFilter);
    });
  });

  describe("FilterFactory.createClaudeFilterWithExtras", () => {
    it("should return ClaudeCodeFileFilter when no extras provided", () => {
      const filter = FilterFactory.createClaudeFilterWithExtras();
      assert.ok(filter instanceof ClaudeCodeFileFilter);
    });

    it("should combine Claude filter with extra include patterns", () => {
      const filter = FilterFactory.createClaudeFilterWithExtras([/^include-/]);

      const context = createTestContext("include-test.txt", false, "/home/test");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, true);
    });

    it("should apply extra exclude patterns", () => {
      const filter = FilterFactory.createClaudeFilterWithExtras([/^include-/], [/^exclude-/]);

      // File matching include pattern should be included
      const includeContext = createTestContext("include-test.txt", false, "/home/test");
      const includeResult = filter.evaluate(includeContext);
      assert.strictEqual(includeResult.include, true);

      // File matching exclude pattern should be excluded, even if it would match include
      const excludeContext = createTestContext("exclude-test.txt", false, "/home/test");
      const excludeResult = filter.evaluate(excludeContext);
      assert.strictEqual(excludeResult.include, false);
    });
  });

  describe("FilterFactory.fromConfig", () => {
    it("should create Claude filter by default", () => {
      const filter = FilterFactory.fromConfig({});
      assert.ok(filter instanceof ClaudeCodeFileFilter);
    });

    it("should respect useClaudeFilter flag", () => {
      const filter = FilterFactory.fromConfig({ useClaudeFilter: false });
      assert.ok(filter instanceof AllowAllFilter);
    });

    it("should add custom patterns to Claude filter", () => {
      const filter = FilterFactory.fromConfig({
        includePatterns: ["^custom-"],
      });

      const context = createTestContext("custom-file.txt", false, "/home/test");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, true);
    });

    it("should apply custom exclude patterns", () => {
      const filter = FilterFactory.fromConfig({
        includePatterns: ["^test-"],
        excludePatterns: ["-temp$"],
      });

      const context1 = createTestContext("test-file.txt", false, "/home/test");
      const result1 = filter.evaluate(context1);
      assert.strictEqual(result1.include, true);

      const context2 = createTestContext("test-temp", false, "/home/test");
      const result2 = filter.evaluate(context2);
      assert.strictEqual(result2.include, false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty directory names", () => {
      const filter = new ClaudeCodeFileFilter();
      const context = createTestContext("", true, "/home/test");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, false);
    });

    it("should handle special characters in names", () => {
      const filter = new ClaudeCodeFileFilter();
      const result = filter.evaluate(createTestContext("CLAUDE.md.backup", false, "/home/test"));
      assert.strictEqual(result.include, false);
    });

    it("should handle nested .claude directories", () => {
      const filter = new ClaudeCodeFileFilter();
      const context = createFilterContext("/home/test/project/.claude/skills/subskill", "subskill", true, "/home/test/project/.claude/skills", "/");
      const result = filter.evaluate(context);
      assert.strictEqual(result.include, true);
    });

    it("should handle case sensitivity correctly", () => {
      const filter = new ClaudeCodeFileFilter();

      const lowerResult = filter.evaluate(createTestContext("claude.md", false, "/home/test"));
      assert.strictEqual(lowerResult.include, false);

      const upperResult = filter.evaluate(createTestContext("CLAUDE.md", false, "/home/test"));
      assert.strictEqual(upperResult.include, true);
    });
  });
});
