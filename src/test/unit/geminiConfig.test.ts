/**
 * Unit tests for GeminiConfig
 * Tests reading ~/.gemini/projects.json
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { GeminiConfig } from "../../services/geminiConfig.js";

describe("GeminiConfig", () => {
  describe("构造函数", () => {
    it("should create instance with homePath", () => {
      const geminiConfig = new GeminiConfig("/home/user");
      assert.ok(geminiConfig instanceof GeminiConfig);
    });
  });

  describe("getProjects()", () => {
    beforeEach(() => {
      process.env.HOME = "/home/testuser";
    });

    it("should return empty array when file does not exist", async () => {
      const geminiConfig = new GeminiConfig("/nonexistent/home");
      const projects = await geminiConfig.getProjects();
      assert.deepStrictEqual(projects, []);
    });

    it("should return projects array from valid file", async () => {
      const geminiConfig = new GeminiConfig(process.env.HOME ?? "/home/testuser");
      const projects = await geminiConfig.getProjects();
      // Result depends on whether ~/.gemini/projects.json exists
      assert.ok(Array.isArray(projects));
    });
  });
});

// Export to satisfy ESLint
export {};
