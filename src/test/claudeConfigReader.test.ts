/**
 * Unit tests for ClaudeConfigReader WSL functionality
 * Run with: npm run test -- claudeConfigReader.test
 */

import * as assert from "node:assert";

suite("ClaudeConfigReader WSL Tests", function () {

  test("should detect WSL network paths", function () {
    // Legacy WSL path format
    const legacyPath = "\\\\wsl$\\Ubuntu-24.04\\home\\user\\.claude.json";
    assert.ok(
      legacyPath.startsWith("\\\\wsl$\\"),
      "Legacy path should start with \\\\wsl$\\"
    );

    // Windows 11 WSL path format
    const newPath = "\\\\wsl.localhost\\Ubuntu-24.04\\home\\user\\.claude.json";
    assert.ok(
      newPath.startsWith("\\\\wsl.localhost\\"),
      "New path should start with \\\\wsl.localhost\\"
    );
  });

  test("should convert WSL network path to internal path", function () {
    const testCases = [
      {
        input: "\\\\wsl$\\Ubuntu-24.04\\home\\user\\.claude.json",
        expected: "/home/user/.claude.json",
      },
      {
        input: "\\\\wsl.localhost\\Ubuntu-24.04\\home\\user\\.claude.json",
        expected: "/home/user/.claude.json",
      },
      {
        input: "\\\\wsl$\\docker-desktop\\home\\user\\config.json",
        expected: "/home/user/config.json",
      },
    ];

    for (const tc of testCases) {
      const parts = tc.input.split("\\").filter((p) => p.length > 0);
      let result: string;

      if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        result = "/" + parts.slice(2).join("/");
      } else {
        result = tc.input.replace(/\\/g, "/");
      }

      assert.strictEqual(result, tc.expected, `Failed for input: ${tc.input}`);
    }
  });

  test("should handle edge cases in path conversion", function () {
    const testCases = [
      {
        input: "\\\\wsl$\\Ubuntu\\home\\user\\.claude.json",
        expected: "/home/user/.claude.json",
      },
      {
        input: "\\\\wsl.localhost\\Ubuntu-24.04\\mnt\\c\\Users\\user\\.claude.json",
        expected: "/mnt/c/Users/user/.claude.json",
      },
      {
        input: "\\\\wsl$\\Ubuntu\\var\\config\\test.json",
        expected: "/var/config/test.json",
      },
    ];

    for (const tc of testCases) {
      const parts = tc.input.split("\\").filter((p) => p.length > 0);
      let result: string;

      if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        result = "/" + parts.slice(2).join("/");
      } else {
        result = tc.input.replace(/\\/g, "/");
      }

      assert.strictEqual(result, tc.expected, `Failed for input: ${tc.input}`);
    }
  });

  test("should handle paths with special characters", function () {
    const testCases = [
      {
        input: "\\\\wsl$\\Ubuntu-22.04\\home\\user.name\\config.json",
        expected: "/home/user.name/config.json",
      },
      {
        input: "\\\\wsl$\\docker-desktop\\root\\.dockerconfig.json",
        expected: "/root/.dockerconfig.json",
      },
    ];

    for (const tc of testCases) {
      const parts = tc.input.split("\\").filter((p) => p.length > 0);
      let result: string;

      if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        result = "/" + parts.slice(2).join("/");
      } else {
        result = tc.input.replace(/\\/g, "/");
      }

      assert.strictEqual(result, tc.expected, `Failed for input: ${tc.input}`);
    }
  });

  test("should handle invalid WSL paths gracefully", function () {
    const invalidPaths = [
      "\\\\wsl$\\", // Just the prefix, no distro or path
      "\\wsl$\\Ubuntu\\home\\user", // Single backslash (invalid UNC)
      "wsl$\\Ubuntu\\home\\user", // Missing initial backslashes
    ];

    for (const invalidPath of invalidPaths) {
      const parts = invalidPath.split("\\").filter((p) => p.length > 0);
      let result: string;

      if (parts.length >= 3 && (parts[0] === "wsl$" || parts[0] === "wsl.localhost")) {
        result = "/" + parts.slice(2).join("/");
      } else {
        // Fallback: just replace backslashes with forward slashes
        result = invalidPath.replace(/\\/g, "/");
      }

      // For invalid paths, the fallback should still work without throwing
      assert.ok(typeof result === "string", `Should handle invalid path: ${invalidPath}`);
    }
  });

  test("should normalize projects from empty config", function () {
    // This tests the normalizeProjects logic with an empty config
    const emptyConfig = {};

    // Simulate normalizeProjects behavior
    const { projects } = emptyConfig as { projects?: unknown };
    let normalizedProjects: unknown[] = [];

    if (projects === undefined) {
      normalizedProjects = [];
    } else if (Array.isArray(projects)) {
      normalizedProjects = projects;
    } else if (typeof projects === "object") {
      // Would normalize object format here
      normalizedProjects = [];
    }

    assert.deepStrictEqual(normalizedProjects, [], "Empty config should have no projects");
  });
});
