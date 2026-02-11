/**
 * Unit tests for DataFacade interface and base class
 *
 * Tests focus on public API behavior rather than implementation details.
 * Tests project normalization through getProjects() public API, not private methods.
 */

/* eslint-disable @typescript-eslint/no-floating-promises */
import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  BaseDataFacade,
  EnvironmentType,
  type ConfigReadResult,
  type EnvironmentInfo,
} from "../../services/dataFacade.js";

/**
 * Test implementation of BaseDataFacade for testing
 */
class TestDataFacade extends BaseDataFacade {
  private mockAccessible = true;
  private mockConfig: ConfigReadResult;

  constructor(environmentInfo: EnvironmentInfo, mockConfig: ConfigReadResult) {
    super(environmentInfo);
    this.mockConfig = mockConfig;
  }

  isAccessible(): boolean {
    return this.mockAccessible;
  }

  setAccessible(value: boolean): void {
    this.mockAccessible = value;
  }

  protected readConfigFile(): Promise<ConfigReadResult> {
    // Read raw config
    const rawConfig = { ...this.mockConfig };

    // Normalize projects (like NativeDataFacade does)
    const projects = this.normalizeProjects(rawConfig.projects);

    return Promise.resolve({ config: rawConfig.config, projects });
  }

  updateMockConfig(config: Partial<ConfigReadResult>): void {
    this.mockConfig = { ...this.mockConfig, ...config };
    // Clear cache to simulate config change
    this.configCache = null;
  }
}

describe("DataFacade", () => {
  describe("EnvironmentInfo", () => {
    it("should store environment type and config path", () => {
      const info: EnvironmentInfo = {
        type: EnvironmentType.Windows,
        configPath: "C:\\Users\\test\\.claude.json",
      };

      assert.strictEqual(info.type, EnvironmentType.Windows);
      assert.strictEqual(info.configPath, "C:\\Users\\test\\.claude.json");
    });

    it("should include WSL instance name when provided", () => {
      const info: EnvironmentInfo = {
        type: EnvironmentType.WSL,
        configPath: "\\\\wsl.localhost\\Ubuntu\\home\\test\\.claude.json",
        instanceName: "Ubuntu",
      };

      assert.strictEqual(info.instanceName, "Ubuntu");
    });
  });

  describe("BaseDataFacade - constructor and properties", () => {
    it("should create facade with environment info", () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      assert.strictEqual(facade.getEnvironmentInfo().type, EnvironmentType.Linux);
      assert.strictEqual(facade.getEnvironmentInfo().configPath, "/home/test/.claude.json");
    });

    it("should return config path", () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      assert.strictEqual(facade.getConfigPath(), "/home/test/.claude.json");
    });

    it("should report accessibility status", () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      assert.ok(facade.isAccessible());

      facade.setAccessible(false);
      assert.ok(!facade.isAccessible());
    });
  });

  describe("BaseDataFacade - getProjects()", () => {
    it("should return project list from array format", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [
          { path: "/home/test/p1" },
          { path: "/home/test/p2" },
        ],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0]?.path, "/home/test/p1");
      assert.strictEqual(projects[1]?.path, "/home/test/p2");
    });

    it("should normalize record format projects to array format", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      // Use record format (actual .claude.json structure)
      const rawProjects = {
        "/home/test/p1": {
          allowedTools: ["Bash", "Read"],
          hasTrustDialogAccepted: true,
        },
        "/home/test/p2": {
          mcpServers: { "test-server": { command: "echo" } },
        },
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: rawProjects as unknown as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      // Should normalize to array format with extracted state and mcpServers
      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0]?.path, "/home/test/p1");
      assert.ok(projects[0]?.state);
      assert.strictEqual(projects[0]?.state?.trust, true);
      assert.deepStrictEqual(projects[0]?.state?.allowedTools, ["Bash", "Read"]);
      assert.strictEqual(projects[1]?.path, "/home/test/p2");
      assert.ok(projects[1]?.mcpServers);
    });

    it("should extract project state from record format", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: {
          "/home/test/p1": {
            allowedTools: ["Bash", "Read", "Write"],
            hasTrustDialogAccepted: true,
          },
        } as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 1);
      assert.strictEqual(projects[0]?.path, "/home/test/p1");
      assert.ok(projects[0]?.state);
      assert.strictEqual(projects[0]?.state?.trust, true);
      assert.deepStrictEqual(projects[0]?.state?.allowedTools, ["Bash", "Read", "Write"]);
    });

    it("should extract mcpServers from record format", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: {
          "/home/test/p1": {
            mcpServers: {
              "test-server": { command: "npx", args: ["--yes", "test"] },
            },
          },
        } as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 1);
      assert.ok(projects[0]?.mcpServers);
      assert.ok("test-server" in projects[0].mcpServers);
    });

    it("should handle empty project list", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 0);
    });

    it("should handle null project list", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: null as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 0);
    });

    it("should handle undefined project list", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: undefined as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 0);
    });

    it("should skip invalid entries in record format", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: {
          "/home/test/p1": { allowedTools: [] },
          "/home/test/p2": null,
          "/home/test/p3": "invalid" as never,
          "/home/test/p4": { allowedTools: [] },
        } as never,
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const projects = await facade.getProjects();

      // Should only include valid object entries
      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0]?.path, "/home/test/p1");
      assert.strictEqual(projects[1]?.path, "/home/test/p4");
    });
  });

  describe("BaseDataFacade - getGlobalConfig()", () => {
    it("should get top-level config value", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {
          settings: { theme: "dark" },
        },
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const value = await facade.getGlobalConfig("settings");

      assert.ok(typeof value === "object");
    });

    it("should get nested config value with dot notation", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {
          settings: { theme: "dark" },
        },
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const value = await facade.getGlobalConfig("settings.theme");

      assert.strictEqual(value, "dark");
    });

    it("should return undefined for non-existent key", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const value = await facade.getGlobalConfig("nonexistent");

      assert.strictEqual(value, undefined);
    });

    it("should return undefined for non-existent nested key", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {
          settings: { theme: "dark" },
        },
        projects: [],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const value = await facade.getGlobalConfig("settings.nonexistent");

      assert.strictEqual(value, undefined);
    });
  });

  describe("BaseDataFacade - getProjectContextFiles()", () => {
    it("should return context file suggestions for existing project", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [{ path: "/home/test/p1" }],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const files = await facade.getProjectContextFiles("p1");

      // Default implementation returns possible file names
      assert.ok(Array.isArray(files));
    });

    it("should return empty array for non-existent project", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [{ path: "/home/test/p1" }],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      const files = await facade.getProjectContextFiles("nonexistent");

      assert.deepStrictEqual(files, []);
    });
  });

  describe("BaseDataFacade - refresh()", () => {
    it("should reload config and return updated projects", async () => {
      const envInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: "/home/test/.claude.json",
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [{ path: "/home/test/p1" }, { path: "/home/test/p2" }],
      };
      const facade = new TestDataFacade(envInfo, mockConfig);

      // Initial projects
      const projects1 = await facade.getProjects();
      assert.strictEqual(projects1.length, 2);

      // Update config
      facade.updateMockConfig({
        projects: [{ path: "/home/test/p3" }],
      });

      // Refresh should reload
      await facade.refresh();

      const projects2 = await facade.getProjects();
      assert.strictEqual(projects2.length, 1);
      assert.strictEqual(projects2[0]?.path, "/home/test/p3");
    });
  });
});
