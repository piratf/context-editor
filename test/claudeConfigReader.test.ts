/**
 * Unit tests for ClaudeConfigReader service.
 */

import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import { describe, it, beforeEach, afterEach } from "node:test";
import { ConfigErrorType, ClaudeConfigReader } from "../services/claudeConfigReader.js";

// Mock fs module
const mockFs = {
  readFile: async (_path: string): Promise<string> => "{}",
  mkdir: async (): Promise<void> => {},
  writeFile: async (): Promise<void> => {},
};

// Store original fs functions
const originalReadFile = fs.readFile;

describe("ClaudeConfigReader", () => {
  let reader: ClaudeConfigReader;

  beforeEach(() => {
    // Create reader with test config path
    reader = new ClaudeConfigReader("/tmp/test-claude.json");
  });

  afterEach(() => {
    reader.clearCache();
  });

  describe("getConfigPath", () => {
    it("should return the config path provided in constructor", () => {
      const customPath = "/custom/path/.claude.json";
      const customReader = new ClaudeConfigReader(customPath);
      assert.strictEqual(customReader.getConfigPath(), customPath);
    });

    it("should return default path when not provided", () => {
      const defaultReader = new ClaudeConfigReader();
      const path = defaultReader.getConfigPath();
      assert.ok(path.endsWith(".claude.json"));
    });
  });

  describe("readConfig", () => {
    it("should parse valid JSON config", async () => {
      // Mock fs.readFile
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        mockFs.readFile;

      const result = await reader.readConfig();

      assert.ok(Array.isArray(result.projects));
    });

    it("should return empty config for empty file", async () => {
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () => "";

      const result = await reader.readConfig();

      assert.deepStrictEqual(result.config, {});
      assert.deepStrictEqual(result.projects, []);
    });

    it("should handle array format projects", async () => {
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () =>
          JSON.stringify({
            projects: [
              { path: "/path/to/project1" },
              { path: "/path/to/project2" },
            ],
          });

      const result = await reader.readConfig();

      assert.strictEqual(result.projects.length, 2);
      assert.strictEqual(result.projects[0]?.path, "/path/to/project1");
      assert.strictEqual(result.projects[1]?.path, "/path/to/project2");
    });

    it("should handle record format projects", async () => {
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () =>
          JSON.stringify({
            projects: {
              "project1": { path: "/path/to/project1" },
              "project2": { path: "/path/to/project2" },
            },
          });

      const result = await reader.readConfig();

      assert.strictEqual(result.projects.length, 2);
    });

    it("should filter out invalid project entries", async () => {
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () =>
          JSON.stringify({
            projects: [
              { path: "/valid/project" },
              null,
              { invalid: "entry" },
              { path: 123 },
            ],
          });

      const result = await reader.readConfig();

      assert.strictEqual(result.projects.length, 1);
      assert.strictEqual(result.projects[0]?.path, "/valid/project");
    });

    it("should throw ConfigError with FILE_NOT_FOUND for missing file", async () => {
      const notFoundError = new Error("ENOENT") as Error & { code: string };
      notFoundError.code = "ENOENT";

      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () => {
          throw notFoundError;
        };

      const errorPromise = reader.readConfig();
      await assert.rejects(errorPromise, (error: unknown) => {
        const err = error as { name?: string; type?: string };
        return err.name === "ConfigError" &&
          err.type === ConfigErrorType.FILE_NOT_FOUND;
      });
    });

    it("should throw ConfigError with PARSE_ERROR for invalid JSON", async () => {
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () => "{ invalid json }";

      const errorPromise = reader.readConfig();
      await assert.rejects(errorPromise, (error: unknown) => {
        const err = error as { name?: string; type?: string };
        return err.name === "ConfigError" &&
          err.type === ConfigErrorType.PARSE_ERROR;
      });
    });

    it("should use cache for subsequent reads within TTL", async () => {
      let callCount = 0;
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () => {
          callCount++;
          return "{}";
        };

      // First read
      await reader.readConfig();
      const firstCount = callCount;

      // Second read within TTL (should use cache)
      await reader.readConfig();

      assert.strictEqual(callCount, firstCount);
    });

    it("should clear cache when clearCache is called", async () => {
      let callCount = 0;
      (fs as unknown as { readFile: typeof mockFs.readFile }).readFile =
        async () => {
          callCount++;
          return "{}";
        };

      // First read
      await reader.readConfig();
      reader.clearCache();

      // Second read after cache clear
      await reader.readConfig();

      assert.strictEqual(callCount, 2);
    });
  });

  // Restore original fs functions
  after(() => {
    (fs as unknown as { readFile: unknown }).readFile = originalReadFile;
  });
});
