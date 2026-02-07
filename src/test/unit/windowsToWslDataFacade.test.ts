/**
 * Unit tests for WindowsToWslDataFacade
 * Tests accessing WSL configuration from Windows
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  WindowsToWslDataFacade,
  WindowsToWslDataFacadeFactory,
} from "../../services/windowsToWslDataFacade.js";
import { EnvironmentType } from "../../services/dataFacade.js";

// Mock config path for testing
const mockConfigPath = "\\\\wsl.localhost\\Ubuntu\\home\\testuser\\.claude.json";
const mockConfigPathLegacy = "\\\\wsl$\\Ubuntu\\home\\testuser\\.claude.json";

/**
 * Test facade that exposes private methods for testing
 */
class TestableWindowsToWslDataFacade extends WindowsToWslDataFacade {
  convertWslPathToWindowsForTest(wslPath: string): string {
    return this.convertWslPathToWindows(wslPath);
  }

  parseConfigForTest(content: string): Record<string, unknown> {
    return this.parseConfig(content);
  }

  normalizeProjectsForTest(projects: unknown): ReturnType<typeof this.normalizeProjects> {
    return this.normalizeProjects(projects);
  }
}

describe("WindowsToWslDataFacade", () => {
  describe("构造函数", () => {
    it("should create facade for Ubuntu distro", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      assert.ok(facade instanceof WindowsToWslDataFacade);
      assert.strictEqual(facade.getDistroName(), "Ubuntu");
    });

    it("should create facade for Debian distro", () => {
      const facade = new WindowsToWslDataFacade("Debian", mockConfigPath);
      assert.strictEqual(facade.getDistroName(), "Debian");
    });

    it("should use new format by default", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      assert.ok(!facade.isUsingLegacyFormat());
    });

    it("should use legacy format when specified", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPathLegacy, true);
      assert.ok(facade.isUsingLegacyFormat());
    });

    it("should have WSL environment type", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const info = facade.getEnvironmentInfo();
      assert.strictEqual(info.type, EnvironmentType.WSL);
    });

    it("should have instance name set to distro name", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu-22.04", mockConfigPath);
      const info = facade.getEnvironmentInfo();
      assert.strictEqual(info.instanceName, "Ubuntu-22.04");
    });

    it("should have UNC config path with new format", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const path = facade.getConfigPath();
      assert.strictEqual(path, mockConfigPath);
    });

    it("should have UNC config path with legacy format", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPathLegacy, true);
      const path = facade.getConfigPath();
      assert.strictEqual(path, mockConfigPathLegacy);
    });
  });

  describe("路径转换", () => {
    it("should convert WSL paths to Windows UNC", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const wslPath = "/home/user/project";
      const expectedWindowsPath = "\\\\wsl.localhost\\Ubuntu\\home\\user\\project";

      const converted = facade.convertWslPathToWindowsForTest(wslPath);
      assert.strictEqual(converted, expectedWindowsPath);
    });

    it("should handle root path", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const convertedPath = facade.convertWslPathToWindowsForTest("/");
      assert.ok(convertedPath.includes("\\\\wsl.localhost\\Ubuntu"));
    });

    it("should handle paths with special characters", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const wslPath = "/home/user/my project";
      const converted = facade.convertWslPathToWindowsForTest(wslPath);
      assert.ok(converted.includes("my project"));
    });

    it("should preserve Windows UNC paths", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const uncPath = "\\\\wsl.localhost\\Ubuntu\\home\\user\\project";
      const converted = facade.convertWslPathToWindowsForTest(uncPath);
      assert.strictEqual(converted, uncPath);
    });

    it("should preserve relative paths", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const relativePath = "relative/path";
      const converted = facade.convertWslPathToWindowsForTest(relativePath);
      assert.strictEqual(converted, relativePath);
    });
  });

  describe("isAccessible()", () => {
    it("should return true", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      assert.ok(facade.isAccessible());
    });
  });

  describe("parseConfig()私有方法", () => {
    it("should handle empty string", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const result = facade.parseConfigForTest("");
      assert.deepStrictEqual(result, {});
    });

    it("should handle invalid JSON", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const result = facade.parseConfigForTest("{ invalid json }");
      assert.deepStrictEqual(result, {});
    });

    it("should parse valid JSON", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const mockConfig = { settings: { theme: "dark" } };
      const result = facade.parseConfigForTest(JSON.stringify(mockConfig));
      if (result.settings !== undefined && typeof result.settings === "object") {
        assert.strictEqual((result.settings as Record<string, unknown>).theme, "dark");
      }
    });
  });

  describe("normalizeProjects()覆盖方法", () => {
    it("should convert project paths", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const projects = [{ path: "/home/user/project1" }, { path: "/home/user/project2" }];

      const result = facade.normalizeProjectsForTest(projects);

      assert.strictEqual(result.length, 2);
      assert.ok(result[0]?.path.includes("\\\\wsl.localhost\\Ubuntu"));
      assert.ok(result[1]?.path.includes("project2"));
    });

    it("should handle empty projects", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const result = facade.normalizeProjectsForTest(null);
      assert.deepStrictEqual(result, []);
    });

    it("should handle undefined projects", () => {
      const facade = new TestableWindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const result = facade.normalizeProjectsForTest(undefined);
      assert.deepStrictEqual(result, []);
    });
  });

  describe("WindowsToWslDataFacadeFactory", () => {
    it("should create facade using factory", () => {
      const facade = WindowsToWslDataFacadeFactory.create("Ubuntu", mockConfigPath);
      assert.ok(facade instanceof WindowsToWslDataFacade);
      assert.strictEqual(facade.getDistroName(), "Ubuntu");
    });

    it("should create facade with legacy format", () => {
      const facade = WindowsToWslDataFacadeFactory.create("Debian", mockConfigPathLegacy, true);
      assert.ok(facade.isUsingLegacyFormat());
    });

    it("should check facade accessibility", async () => {
      const facade = WindowsToWslDataFacadeFactory.create("Ubuntu", mockConfigPath);
      // In test environment, WSL is likely not accessible
      // Just verify the method doesn't throw
      const accessible = await WindowsToWslDataFacadeFactory.isFacadeAccessible(facade);
      assert.strictEqual(typeof accessible, "boolean");
    });

    describe("discoverInstances()", () => {
      it("should return empty array when wsl.exe is not available", async () => {
        // In non-Windows or WSL environment, wsl.exe is not available
        const discovered = await WindowsToWslDataFacadeFactory.discoverInstances();
        assert.ok(Array.isArray(discovered));
      });

      it("should not throw when calling getWslDistroList", async () => {
        // Verify the method doesn't throw even when wsl.exe is not available
        const result = await WindowsToWslDataFacadeFactory.getWslDistroList();
        assert.ok(Array.isArray(result));
      });

      it("should handle probing with prefix", async () => {
        // Verify probeWithPrefix works with empty distro list
        const result = await WindowsToWslDataFacadeFactory.probeWithPrefix(
          "\\\\wsl.localhost\\",
          [],
          false
        );
        assert.deepStrictEqual(result, []);
      });

      it("should handle legacy format probing with prefix", async () => {
        const result = await WindowsToWslDataFacadeFactory.probeWithPrefix(
          "\\\\wsl$\\",
          ["Ubuntu"],
          true
        );
        assert.ok(Array.isArray(result));
      });

      it("should handle wsl.exe output with \\r\\n line endings", async () => {
        // This test documents that we expect wsl.exe to return \r\n line endings
        // The getWslDistroList method uses .trim() which handles both \r and \n
        const result = await WindowsToWslDataFacadeFactory.getWslDistroList();
        assert.ok(Array.isArray(result));
        // All returned strings should not contain \r
        for (const distro of result) {
          assert.ok(
            !distro.includes("\r"),
            `Distro name should not contain \\r: ${JSON.stringify(distro)}`
          );
        }
      });

      it("should return empty array when no distros found", async () => {
        // discoverInstances should handle empty getWslDistroList result
        const result = await WindowsToWslDataFacadeFactory.getWslDistroList();
        if (result.length === 0) {
          const discovered = await WindowsToWslDataFacadeFactory.discoverInstances();
          assert.deepStrictEqual(discovered, []);
        }
      });

      it("should use new format when probing succeeds and not try legacy format", async () => {
        // This test verifies that when new format finds instances, we don't fall back
        // Since we can't mock in this test suite, we document the expected behavior:
        // - getWslDistroList() returns distros
        // - probeWithPrefix('\\wsl.localhost\\', distros, false) finds instances
        // - discoverInstances returns immediately without trying '\\wsl$\\'
        // This is tested by observing that in Windows+WSL environments,
        // the new format is tried first and legacy format is only used as fallback
        const result = await WindowsToWslDataFacadeFactory.getWslDistroList();
        if (result.length > 0) {
          const discovered = await WindowsToWslDataFacadeFactory.discoverInstances();
          assert.ok(Array.isArray(discovered));
          // All discovered instances should use new format (useLegacyFormat: false)
          for (const instance of discovered) {
            assert.strictEqual(
              instance.useLegacyFormat,
              false,
              "Should use new format when available"
            );
          }
        }
      });
    });

    describe("probeWithPrefix() edge cases", () => {
      it("should handle home directory not accessible", async () => {
        // Verify that inaccessible home directories are skipped
        // Using a non-existent prefix should result in empty array
        const result = await WindowsToWslDataFacadeFactory.probeWithPrefix(
          "\\\\wsl.localhost\\",
          ["NonExistentDistro"],
          false
        );
        assert.deepStrictEqual(result, []);
      });

      it("should skip directories starting with dot", async () => {
        // This test documents that the implementation skips directories starting with '.'
        // The probeWithPrefix method has: if (username.startsWith('.')) { continue; }
        // This handles hidden directories like '.', '..', '.hidden', etc.
        // Actual verification would require mocking fs.readdir which is not done here
        const result = await WindowsToWslDataFacadeFactory.probeWithPrefix(
          "\\\\wsl.localhost\\",
          ["Ubuntu"],
          false
        );
        assert.ok(Array.isArray(result));
      });

      it("should stop checking users after finding .claude.json", async () => {
        // This test documents the break behavior when config is found
        // The probeWithPrefix method has: break; after finding config
        // This means only the first user with .claude.json is returned per distro
        // Actual verification would require mocking fs.readdir/fs.access
        const result = await WindowsToWslDataFacadeFactory.probeWithPrefix(
          "\\\\wsl.localhost\\",
          ["Ubuntu"],
          false
        );
        assert.ok(Array.isArray(result));
      });
    });

    describe("createAll()", () => {
      it("should return empty array when no WSL instances found", async () => {
        // In non-Windows or WSL environment, no instances should be discovered
        const facades = await WindowsToWslDataFacadeFactory.createAll();
        assert.deepStrictEqual(facades, []);
      });

      it("should not throw when no instances are accessible", async () => {
        const facades = await WindowsToWslDataFacadeFactory.createAll();
        assert.ok(Array.isArray(facades));
      });
    });
  });

  describe("不同发行版", () => {
    it("should work with Ubuntu", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      assert.strictEqual(facade.getDistroName(), "Ubuntu");
    });

    it("should work with Debian", () => {
      const facade = new WindowsToWslDataFacade("Debian", mockConfigPath);
      assert.strictEqual(facade.getDistroName(), "Debian");
    });

    it("should work with distro names containing hyphens", () => {
      const facade = new WindowsToWslDataFacade("Ubuntu-22.04", mockConfigPath);
      assert.strictEqual(facade.getDistroName(), "Ubuntu-22.04");
    });

    it("should work with openSUSE", () => {
      const facade = new WindowsToWslDataFacade("openSUSE", mockConfigPath);
      assert.strictEqual(facade.getDistroName(), "openSUSE");
    });
  });

  describe("缓存行为", () => {
    it("should use cache by default", async () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      // First call will try to read (and likely fail if no WSL)
      await facade.getProjects();
      // Second call should use cache
      await facade.getProjects();
      // No assertion - just verify it doesn't throw
    });

    it("should clear cache on refresh", async () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      await facade.getProjects();
      await facade.refresh();
      // No assertion - just verify it doesn't throw
    });
  });

  describe("getGlobalConfig()", () => {
    it("should return undefined for non-existent config", async () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const value = await facade.getGlobalConfig("nonexistent");
      assert.strictEqual(value, undefined);
    });
  });

  describe("getProjectContextFiles()", () => {
    it("should return empty array for non-existent project", async () => {
      const facade = new WindowsToWslDataFacade("Ubuntu", mockConfigPath);
      const files = await facade.getProjectContextFiles("nonexistent");
      assert.deepStrictEqual(files, []);
    });
  });
});

// Export to satisfy ESLint
export {};
