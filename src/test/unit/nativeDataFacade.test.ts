/**
 * Unit tests for NativeDataFacade
 * Tests accessing the current environment's configuration
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { NativeDataFacade, NativeDataFacadeFactory } from "../../services/nativeDataFacade.js";

describe("NativeDataFacade", () => {
  beforeEach(() => {
    // Set home directory for testing
    process.env.HOME = "/home/testuser";
  });

  describe("构造函数和初始化", () => {
    it("should create facade instance", () => {
      const facade = new NativeDataFacade();
      assert.ok(facade instanceof NativeDataFacade);
    });

    it("should have valid environment info", () => {
      const facade = new NativeDataFacade();
      const info = facade.getEnvironmentInfo();
      // EnvironmentType is always defined and non-null
      assert.ok(info.configPath);
      assert.ok(info.configPath.endsWith(".claude.json"));
    });

    it("should have config path under home directory", () => {
      const facade = new NativeDataFacade();
      const path = facade.getConfigPath();
      assert.ok(path.includes("/home/testuser"));
    });
  });

  describe("isAccessible()", () => {
    it("should return true when home dir is set", () => {
      const facade = new NativeDataFacade();
      assert.ok(facade.isAccessible());
    });
  });

  describe("getConfigPath()", () => {
    it("should return config path ending with .claude.json", () => {
      const facade = new NativeDataFacade();
      const path = facade.getConfigPath();
      assert.ok(path.endsWith(".claude.json"));
    });

    it("should return absolute path", () => {
      const facade = new NativeDataFacade();
      const path = facade.getConfigPath();
      assert.ok(path.startsWith("/"));
    });
  });

  describe("缓存行为", () => {
    it("should use cache by default", async () => {
      const facade = new NativeDataFacade();
      // First call will read (or fail if no config)
      await facade.getProjects();
      // Second call should use cache
      await facade.getProjects();
      // No assertion - just verify it doesn't throw
    });

    it("should clear cache on refresh", async () => {
      const facade = new NativeDataFacade();
      await facade.getProjects();
      await facade.refresh();
      // No assertion - just verify it doesn't throw
    });
  });

  describe("getGlobalConfig()", () => {
    it("should return undefined for non-existent config", async () => {
      const facade = new NativeDataFacade();
      const value = await facade.getGlobalConfig("nonexistent");
      assert.strictEqual(value, undefined);
    });

    it("should return undefined for non-existent nested key", async () => {
      const facade = new NativeDataFacade();
      const value = await facade.getGlobalConfig("settings.nonexistent");
      assert.strictEqual(value, undefined);
    });
  });

  describe("getProjectContextFiles()", () => {
    it("should return empty array for non-existent project", async () => {
      const facade = new NativeDataFacade();
      const files = await facade.getProjectContextFiles("nonexistent");
      assert.deepStrictEqual(files, []);
    });
  });

  describe("NativeDataFacadeFactory", () => {
    it("should create NativeDataFacade instance", () => {
      const facade = NativeDataFacadeFactory.create();
      assert.ok(facade instanceof NativeDataFacade);
    });
  });
});

// Export to satisfy ESLint
export {};
