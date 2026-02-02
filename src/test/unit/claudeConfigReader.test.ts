/**
 * Unit tests for ClaudeConfigReader service.
 */

import * as assert from "node:assert";
// We don't need to import fs anymore for mocking, just for types if needed
import { describe, it, beforeEach, afterEach } from "node:test";
import { ConfigErrorType, ClaudeConfigReader } from "../../services/claudeConfigReader.js";

void describe("ClaudeConfigReader", () => {
  let reader: ClaudeConfigReader;

  beforeEach(() => {
    // Create reader with test config path
    reader = new ClaudeConfigReader("/tmp/test-claude.json");
  });

  afterEach(() => {
    reader.clearCache();
  });

  void describe("getConfigPath", () => {
    void it("should return the config path provided in constructor", () => {
      const customPath = "/custom/path/.claude.json";
      const customReader = new ClaudeConfigReader(customPath);
      assert.strictEqual(customReader.getConfigPath(), customPath);
    });

    void it("should return default path when not provided", () => {
      const defaultReader = new ClaudeConfigReader();
      const path = defaultReader.getConfigPath();
      assert.ok(path.endsWith(".claude.json"));
    });
  });

  void describe("readConfig", () => {
    void it("should parse valid JSON config", async () => {
      reader.setFileReader(() => Promise.resolve("{}"));
      const result = await reader.readConfig();
      assert.ok(Array.isArray(result.projects));
    });

    void it("should return empty config for empty file", async () => {
      reader.setFileReader(() => Promise.resolve(""));
      const result = await reader.readConfig();
      assert.deepStrictEqual(result.config, {});
      assert.deepStrictEqual(result.projects, []);
    });

    void it("should handle array format projects", async () => {
      reader.setFileReader(() =>
        Promise.resolve(
          JSON.stringify({
            projects: [{ path: "/path/to/project1" }, { path: "/path/to/project2" }],
          })
        )
      );

      const result = await reader.readConfig();

      assert.strictEqual(result.projects.length, 2);
      assert.strictEqual(result.projects[0]?.path, "/path/to/project1");
      assert.strictEqual(result.projects[1]?.path, "/path/to/project2");
    });

    void it("should handle record format projects", async () => {
      reader.setFileReader(() =>
        Promise.resolve(
          JSON.stringify({
            projects: {
              project1: { path: "/path/to/project1" },
              project2: { path: "/path/to/project2" },
            },
          })
        )
      );

      const result = await reader.readConfig();
      assert.strictEqual(result.projects.length, 2);
    });

    void it("should filter out invalid project entries", async () => {
      reader.setFileReader(() =>
        Promise.resolve(
          JSON.stringify({
            projects: [{ path: "/valid/project" }, null, { invalid: "entry" }, { path: 123 }],
          })
        )
      );

      const result = await reader.readConfig();
      assert.strictEqual(result.projects.length, 1);
      assert.strictEqual(result.projects[0]?.path, "/valid/project");
    });

    void it("should throw ConfigError with FILE_NOT_FOUND for missing file", async () => {
      const notFoundError = new Error("ENOENT") as Error & { code: string };
      notFoundError.code = "ENOENT";

      reader.setFileReader(() => Promise.reject(notFoundError));

      const errorPromise = reader.readConfig();
      await assert.rejects(errorPromise, (error: unknown) => {
        const err = error as { name?: string; type?: string };
        return err.name === "ConfigError" && err.type === ConfigErrorType.FILE_NOT_FOUND;
      });
    });

    void it("should throw ConfigError with PARSE_ERROR for invalid JSON", async () => {
      reader.setFileReader(() => Promise.resolve("{ invalid json }"));

      const errorPromise = reader.readConfig();
      await assert.rejects(errorPromise, (error: unknown) => {
        const err = error as { name?: string; type?: string };
        return err.name === "ConfigError" && err.type === ConfigErrorType.PARSE_ERROR;
      });
    });

    void it("should use cache for subsequent reads within TTL", async () => {
      let callCount = 0;
      reader.setFileReader(() => {
        callCount++;
        return Promise.resolve("{}");
      });

      // First read
      await reader.readConfig();
      const firstCount = callCount;

      // Second read within TTL (should use cache)
      await reader.readConfig();

      assert.strictEqual(callCount, firstCount);
    });

    void it("should clear cache when clearCache is called", async () => {
      let callCount = 0;
      reader.setFileReader(() => {
        callCount++;
        return Promise.resolve("{}");
      });

      // First read
      await reader.readConfig();
      reader.clearCache();

      // Second read after cache clear
      await reader.readConfig();

      assert.strictEqual(callCount, 2);
    });
  });
});
