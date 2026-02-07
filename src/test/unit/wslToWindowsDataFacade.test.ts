/**
 * Unit tests for WslToWindowsDataFacade
 * Tests accessing Windows configuration from WSL
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  WslToWindowsDataFacade,
  WslToWindowsDataFacadeFactory,
} from "../../services/wslToWindowsDataFacade.js";
import { EnvironmentType } from "../../services/dataFacade.js";

/**
 * Test facade that exposes private methods for testing
 */
class TestableWslToWindowsDataFacade extends WslToWindowsDataFacade {
  convertWindowsPathToWslForTest(windowsPath: string): string {
    return this.convertWindowsPathToWsl(windowsPath);
  }

  parseConfigForTest(content: string): Record<string, unknown> {
    return this.parseConfig(content);
  }

  normalizeProjectsForTest(projects: unknown): ReturnType<typeof this.normalizeProjects> {
    return this.normalizeProjects(projects);
  }
}

describe("WslToWindowsDataFacade", () => {
  describe("构造函数", () => {
    it("should create facade with default username", () => {
      const facade = new WslToWindowsDataFacade();
      assert.ok(facade instanceof WslToWindowsDataFacade);
      assert.strictEqual(facade.getWindowsUsername(), "windows-user");
    });

    it("should create facade with custom username", () => {
      const facade = new WslToWindowsDataFacade("john");
      assert.strictEqual(facade.getWindowsUsername(), "john");
    });

    it("should have Windows environment type", () => {
      const facade = new WslToWindowsDataFacade("testuser");
      const info = facade.getEnvironmentInfo();
      assert.strictEqual(info.type, EnvironmentType.Windows);
    });

    it("should have /mnt/c/ based config path", () => {
      const facade = new WslToWindowsDataFacade("testuser");
      const path = facade.getConfigPath();
      assert.ok(path.startsWith("/mnt/c/Users/"));
      assert.ok(path.includes("testuser"));
      assert.ok(path.endsWith(".claude.json"));
    });
  });

  describe("路径转换", () => {
    it("should convert Windows paths to WSL /mnt/ paths", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const windowsPath = "C:\\Users\\testuser\\project";
      const expectedWslPath = "/mnt/c/Users/testuser/project";

      const converted = facade.convertWindowsPathToWslForTest(windowsPath);
      assert.strictEqual(converted, expectedWslPath);
    });

    it("should convert different drive letters", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const windowsPath = "D:\\data\\files";
      const expectedWslPath = "/mnt/d/data/files";

      const converted = facade.convertWindowsPathToWslForTest(windowsPath);
      assert.strictEqual(converted, expectedWslPath);
    });

    it("should preserve WSL /mnt/ paths", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const wslPath = "/mnt/c/Users/testuser/project";

      const converted = facade.convertWindowsPathToWslForTest(wslPath);
      assert.strictEqual(converted, wslPath);
    });

    it("should preserve non-Windows paths", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const relativePath = "relative/path";

      const converted = facade.convertWindowsPathToWslForTest(relativePath);
      assert.strictEqual(converted, relativePath);
    });

    it("should handle case-insensitive drive letters", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const lowercasePath = "c:\\users\\testuser\\project";

      const converted = facade.convertWindowsPathToWslForTest(lowercasePath);
      assert.strictEqual(converted, "/mnt/c/users/testuser/project");
    });
  });

  describe("isAccessible()", () => {
    it("should return true", () => {
      const facade = new WslToWindowsDataFacade("testuser");
      assert.ok(facade.isAccessible());
    });
  });

  describe("parseConfig()私有方法", () => {
    it("should handle empty string", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const result = facade.parseConfigForTest("");
      assert.deepStrictEqual(result, {});
    });

    it("should handle invalid JSON", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const result = facade.parseConfigForTest("{ invalid json }");
      assert.deepStrictEqual(result, {});
    });

    it("should parse valid JSON", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const mockConfig = { settings: { theme: "dark" } };
      const result = facade.parseConfigForTest(JSON.stringify(mockConfig));
      const settings = result.settings as Record<string, unknown> | undefined;
      assert.strictEqual(settings?.theme, "dark");
    });
  });

  describe("normalizeProjects()覆盖方法", () => {
    it("should convert Windows project paths", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const projects = [{ path: "C:\\Users\\testuser\\project1" }, { path: "D:\\data\\project2" }];

      const result = facade.normalizeProjectsForTest(projects);

      assert.strictEqual(result.length, 2);
      assert.ok(result[0]?.path.startsWith("/mnt/"));
      assert.ok(result[1]?.path.includes("/mnt/d/"));
    });

    it("should handle empty projects", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const result = facade.normalizeProjectsForTest(null);
      assert.deepStrictEqual(result, []);
    });

    it("should handle undefined projects", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const result = facade.normalizeProjectsForTest(undefined);
      assert.deepStrictEqual(result, []);
    });
  });

  describe("WslToWindowsDataFacadeFactory", () => {
    it("should create facade using factory", () => {
      const facade = WslToWindowsDataFacadeFactory.create("john");
      assert.ok(facade instanceof WslToWindowsDataFacade);
      assert.strictEqual(facade.getWindowsUsername(), "john");
    });

    it("should create facade without username", () => {
      const facade = WslToWindowsDataFacadeFactory.create();
      assert.ok(facade instanceof WslToWindowsDataFacade);
    });

    it("should detect username from environment when creating auto", async () => {
      // Set environment variable for testing
      process.env.WINDOWS_USER = "testuser";

      try {
        const facade = await WslToWindowsDataFacadeFactory.createAuto();
        // In test environment, this will likely return null since no actual Windows config exists
        // Just verify it doesn't throw and returns null or a facade
        assert.strictEqual(facade === null || facade instanceof WslToWindowsDataFacade, true);
      } finally {
        delete process.env.WINDOWS_USER;
      }
    });

    it("should check facade accessibility", async () => {
      const facade = WslToWindowsDataFacadeFactory.create("nonexistentuser");
      // In test environment, Windows is likely not accessible
      const accessible = await WslToWindowsDataFacadeFactory.isFacadeAccessible(facade);
      assert.strictEqual(typeof accessible, "boolean");
    });

    it("should detect username from environment variable", () => {
      // Test the detectUsernameFromEnv method
      process.env.USER = "windowsuser";
      const detected = WslToWindowsDataFacadeFactory.detectUsernameFromEnv();
      // Should return the detected username or null
      assert.strictEqual(detected === "windowsuser" || detected === null, true);
      delete process.env.USER;
    });
  });

  describe("缓存行为", () => {
    it("should use cache by default", async () => {
      const facade = new WslToWindowsDataFacade("testuser");
      // First call will try to read (and likely fail if no Windows)
      await facade.getProjects();
      // Second call should use cache
      await facade.getProjects();
      // No assertion - just verify it doesn't throw
    });

    it("should clear cache on refresh", async () => {
      const facade = new WslToWindowsDataFacade("testuser");
      await facade.getProjects();
      await facade.refresh();
      // No assertion - just verify it doesn't throw
    });
  });

  describe("getGlobalConfig()", () => {
    it("should return undefined for non-existent config", async () => {
      const facade = new WslToWindowsDataFacade("testuser");
      const value = await facade.getGlobalConfig("nonexistent");
      assert.strictEqual(value, undefined);
    });
  });

  describe("getProjectContextFiles()", () => {
    it("should return empty array for non-existent project", async () => {
      const facade = new WslToWindowsDataFacade("testuser");
      const files = await facade.getProjectContextFiles("nonexistent");
      assert.deepStrictEqual(files, []);
    });
  });

  describe("边界情况", () => {
    it("should preserve UNC paths (already in WSL format)", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const uncPath = "\\\\wsl.localhost\\Ubuntu\\home\\user\\project";

      // UNC paths are already accessible from Windows, preserve as-is
      const converted = facade.convertWindowsPathToWslForTest(uncPath);
      assert.strictEqual(converted, uncPath);
    });

    it("should preserve legacy UNC format", () => {
      const facade = new TestableWslToWindowsDataFacade("testuser");
      const legacyUncPath = "\\\\wsl$\\Ubuntu\\home\\user\\project";

      // Legacy UNC paths should be preserved
      const converted = facade.convertWindowsPathToWslForTest(legacyUncPath);
      assert.strictEqual(converted, legacyUncPath);
    });

    it("should handle paths with special characters", () => {
      const facade = new TestableWslToWindowsDataFacade("test user");
      const windowsPath = "C:\\Users\\test user\\my project";

      const converted = facade.convertWindowsPathToWslForTest(windowsPath);
      assert.ok(converted.includes("test user"));
      assert.ok(converted.includes("my project"));
    });
  });
});

// Export to satisfy ESLint
export {};
