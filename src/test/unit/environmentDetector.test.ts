/**
 * Tests for EnvironmentDetector service.
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import { EnvironmentDetector } from "../../services/environmentDetector.js";

describe("EnvironmentDetector", () => {
  describe("detect", () => {
    it("should return at least one environment (primary)", async () => {
      const detector = new EnvironmentDetector();
      const environments = await detector.detect();
      assert.strictEqual(environments.length >= 1, true);
      assert.strictEqual(environments[0].accessible, true);
    });

    it("should return environment with valid structure", async () => {
      const detector = new EnvironmentDetector();
      const environments = await detector.detect();
      const env = environments[0];

      assert.ok(["primary", "windows", "wsl"].includes(env.id));
      assert.strictEqual(typeof env.name, "string");
      assert.strictEqual(typeof env.configPath, "string");
      assert.ok(["mac", "windows", "wsl", "linux"].includes(env.type));
      assert.strictEqual(typeof env.accessible, "boolean");
    });
  });

  describe("getPrimaryEnvironment", () => {
    it("should detect macOS on darwin platform", async () => {
      const detector = new EnvironmentDetector();
      // This test only validates structure on actual macOS
      const environments = await detector.detect();
      if (process.platform === "darwin") {
        assert.strictEqual(environments[0].type, "mac");
        assert.strictEqual(environments[0].id, "primary");
      }
    });

    it("should detect Windows on win32 platform", async () => {
      const detector = new EnvironmentDetector();
      if (process.platform === "win32") {
        const environments = await detector.detect();
        assert.strictEqual(environments[0].type, "windows");
        assert.strictEqual(environments[0].id, "windows");
      }
    });

    it("should detect WSL when running in WSL", async () => {
      const detector = new EnvironmentDetector();
      if (process.platform === "linux") {
        const envs = await detector.detect();
        if (envs[0].type === "wsl") {
          assert.strictEqual(envs[0].id, "wsl");
          assert.strictEqual(envs[0].name, "WSL");
        }
      }
    });
  });
});

// Export to satisfy ESLint
export {};
