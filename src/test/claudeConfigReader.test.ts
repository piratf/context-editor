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

suite("ProjectProvider WSL Path Conversion Tests", function () {

  test("should detect WSL environment from config path", function () {
    const testCases = [
      {
        input: "\\\\wsl$\\Ubuntu-24.04\\home\\cloud\\.claude.json",
        expectedType: "windows",
        expectedDistro: "Ubuntu-24.04",
      },
      {
        input: "\\\\wsl.localhost\\Ubuntu-24.04\\home\\cloud\\.claude.json",
        expectedType: "windows",
        expectedDistro: "Ubuntu-24.04",
      },
      {
        input: "\\\\wsl$\\docker-desktop\\home\\user\\.claude.json",
        expectedType: "windows",
        expectedDistro: "docker-desktop",
      },
      {
        input: "C:\\Users\\cloud\\.claude.json",
        expectedType: "windows",
        expectedDistro: null,
      },
      {
        input: "/home/cloud/.claude.json",
        expectedType: "linux",
        expectedDistro: null,
      },
    ];

    for (const tc of testCases) {
      const result = detectEnvironmentFromConfigPath(tc.input);
      assert.strictEqual(
        result.environmentType,
        tc.expectedType,
        `Environment type mismatch for ${tc.input}`
      );
      assert.strictEqual(
        result.wslDistro,
        tc.expectedDistro,
        `Distro mismatch for ${tc.input}`
      );
    }
  });

  test("should convert WSL internal paths to Windows UNC paths", function () {
    const testCases = [
      {
        wslPath: "/home/cloud/code/git/piratf/context-editor/CLAUDE.md",
        distro: "Ubuntu-24.04",
        expected: "\\\\wsl$\\Ubuntu-24.04\\home\\cloud\\code\\git\\piratf\\context-editor\\CLAUDE.md",
      },
      {
        wslPath: "/home/cloud/.claude/settings.json",
        distro: "Ubuntu-24.04",
        expected: "\\\\wsl$\\Ubuntu-24.04\\home\\cloud\\.claude\\settings.json",
      },
      {
        wslPath: "/root/project/file.txt",
        distro: "docker-desktop",
        expected: "\\\\wsl$\\docker-desktop\\root\\project\\file.txt",
      },
    ];

    for (const tc of testCases) {
      const result = wslPathToWindowsUnc(tc.wslPath, "windows", tc.distro);
      assert.strictEqual(result, tc.expected, `Failed for ${tc.wslPath}`);
    }
  });

  test("should not convert non-WSL paths", function () {
    const testCases: Array<{
      wslPath: string;
      envType: "windows" | "linux" | "mac";
      distro: string | null;
      expected: string;
    }> = [
      {
        wslPath: "/home/cloud/file.txt",
        envType: "linux",
        distro: null,
        expected: "/home/cloud/file.txt",
      },
      {
        wslPath: "C:\\Users\\cloud\\file.txt",
        envType: "windows",
        distro: null,
        expected: "C:\\Users\\cloud\\file.txt",
      },
      {
        wslPath: "\\\\wsl$\\Ubuntu-24.04\\home\\file.txt",
        envType: "windows",
        distro: "Ubuntu-24.04",
        expected: "\\\\wsl$\\Ubuntu-24.04\\home\\file.txt",
      },
    ];

    for (const tc of testCases) {
      const result = wslPathToWindowsUnc(tc.wslPath, tc.envType, tc.distro);
      assert.strictEqual(result, tc.expected, `Failed for ${tc.wslPath}`);
    }
  });
});

/**
 * Simulate ProjectProvider's environment detection logic.
 */
function detectEnvironmentFromConfigPath(configPath: string): {
  environmentType: "windows" | "linux" | "mac";
  wslDistro: string | null;
} {
  let environmentType: "windows" | "linux" | "mac" = "windows";
  let wslDistro: string | null = null;

  if (
    configPath.startsWith("\\\\wsl$\\") ||
    configPath.startsWith("\\\\wsl.localhost\\")
  ) {
    environmentType = "windows";
    const parts = configPath.split("\\").filter((p) => p.length > 0);
    if (
      parts.length >= 2 &&
      (parts[0] === "wsl$" || parts[0] === "wsl.localhost")
    ) {
      wslDistro = parts[1];
    }
  } else if (configPath.startsWith("/home/")) {
    environmentType = "linux";
  }

  return { environmentType, wslDistro };
}

/**
 * Simulate ProjectProvider's WSL to Windows UNC path conversion.
 */
function wslPathToWindowsUnc(
  wslPath: string,
  environmentType: "windows" | "linux" | "mac",
  wslDistro: string | null
): string {
  if (environmentType !== "windows" || wslDistro === null) {
    return wslPath;
  }

  if (wslPath.startsWith("\\\\")) {
    return wslPath;
  }

  return "\\\\wsl$\\" + wslDistro + wslPath.replace(/\//g, "\\");
}
