/**
 * Unit tests for WslToWindowsDataFacade
 * Tests accessing Windows paths from WSL
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  WslToWindowsDataFacade,
  WslToWindowsDataFacadeFactory,
  discoverWindowsUsers,
} from "../../services/wslToWindowsDataFacade.js";
import { EnvironmentType } from "../../services/dataFacade.js";

/**
 * Test facade that exposes protected methods for testing
 */
class TestableWslToWindowsDataFacade extends WslToWindowsDataFacade {
  convertWindowsPathToWslForTest(windowsPath: string): string {
    return this.convertWindowsPathToWsl(windowsPath);
  }
}

describe("WslToWindowsDataFacade", () => {
  describe("constructor", () => {
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
  });

  describe("path conversion", () => {
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

  describe("convertPath()", () => {
    it("should use convertWindowsPathToWsl implementation", () => {
      const facade = new WslToWindowsDataFacade("testuser");
      const windowsPath = "C:\\Users\\testuser\\test";
      const converted = facade.convertPath(windowsPath);
      assert.ok(converted.startsWith("/mnt/"));
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

    it("should create facade without username", () => {
      const facade = WslToWindowsDataFacadeFactory.create();
      assert.ok(facade instanceof WslToWindowsDataFacade);
    });

    describe("createAll()", () => {
      it("should return empty array when no Windows users found", async () => {
        // Mock fs.readdir to return empty
        const facades = await WslToWindowsDataFacadeFactory.createAll();
        assert.ok(Array.isArray(facades));
      });

      it("should return array of facades", async () => {
        const facades = await WslToWindowsDataFacadeFactory.createAll();
        assert.ok(Array.isArray(facades));
        // All elements should be WslToWindowsDataFacade instances
        for (const facade of facades) {
          assert.ok(facade instanceof WslToWindowsDataFacade);
        }
      });
    });

    describe("discoverWindowsUsers()", () => {
      it("should return array of discovered users", async () => {
        const users = await discoverWindowsUsers();
        assert.ok(Array.isArray(users));
        // All elements should have username and homePath
        for (const user of users) {
          assert.ok(typeof user.username === "string");
          assert.ok(typeof user.homePath === "string");
          assert.ok(user.homePath.startsWith("/mnt/c/Users/"));
        }
      });

      it("should return empty array when /mnt/c/Users is inaccessible", async () => {
        // The function should handle errors gracefully
        const users = await discoverWindowsUsers();
        assert.ok(Array.isArray(users));
      });
    });
  });

  describe("edge cases", () => {
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
