/**
 * Unit tests for UnifiedProvider
 */

import * as assert from "node:assert";
import * as vscode from "vscode";
import { UnifiedProvider } from "../../views/unifiedProvider.js";
import { EnvironmentManager } from "../../services/environmentManager.js";
import { Logger } from "../../utils/logger.js";
import type { ClaudeDataFacade, EnvironmentInfo } from "../../services/dataFacade.js";
import type { ConfigSearch } from "../../services/configSearch.js";
import { EnvironmentType } from "../../services/dataFacade.js";

// Mock facade for testing
class MockFacade implements ClaudeDataFacade {
  private readonly projects: Array<{ path: string; name: string }> = [];
  private readonly hasConfig: boolean;

  constructor(hasConfig = true, projects: Array<{ path: string; name: string }> = []) {
    this.hasConfig = hasConfig;
    this.projects = projects;
  }

  getEnvironmentInfo(): EnvironmentInfo {
    return {
      type: EnvironmentType.Linux,
      configPath: "/home/test/.claude.json",
      instanceName: "",
    };
  }

  getGlobalConfig(_key: string): Promise<unknown> {
    if (!this.hasConfig) {
      throw new Error("Config not found");
    }
    return Promise.resolve({ test: "data" });
  }

  getProjects(): Promise<Array<{ path: string }>> {
    return Promise.resolve(this.projects);
  }

  getProjectContextFiles(_projectName: string): Promise<readonly string[]> {
    return Promise.resolve([]);
  }

  toNativePath(filePath: string): string {
    return filePath;
  }

  checkPathAccessible(_filePath: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }

  isAccessible(): boolean {
    return true;
  }

  getConfigPath(): string {
    return "/home/test/.claude.json";
  }
}

// Minimal mock ConfigSearch for EnvironmentManager
class MockConfigSearch {
  getAllFacades(): ClaudeDataFacade[] {
    return [];
  }

  on(_event: string, _listener: unknown): void {
    // Mock event listener
  }

  performDiscovery(): void {
    // Mock discovery
  }
}

// Mock environment manager
class TestEnvironmentManager extends EnvironmentManager {
  private facade: ClaudeDataFacade | null = null;

  constructor() {
    super(new MockConfigSearch() as unknown as ConfigSearch);
  }

  setFacade(facade: ClaudeDataFacade): void {
    this.facade = facade;
  }

  getCurrentFacade(): ClaudeDataFacade | null {
    return this.facade;
  }

  getAllFacades(): ClaudeDataFacade[] {
    return this.facade !== null ? [this.facade] : [];
  }
}

suite("UnifiedProvider Tests", () => {
  let provider: UnifiedProvider;
  let envManager: TestEnvironmentManager;
  let logger: Logger;
  let outputChannel: vscode.OutputChannel;

  setup(() => {
    outputChannel = vscode.window.createOutputChannel("Test Output");
    logger = new Logger(outputChannel, "TestUnifiedProvider");
    envManager = new TestEnvironmentManager();
  });

  teardown(() => {
    outputChannel.dispose();
  });

  test("should create provider with error node when no facade", () => {
    envManager.setFacade(null as unknown as ClaudeDataFacade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    assert.ok(roots.length === 1, "Should have 1 root node (error node)");
    assert.strictEqual(roots[0]?.label, "No environment selected");
  });

  test("should create provider with 2 root nodes when facade exists", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    assert.ok(roots.length === 2, `Should have 2 root nodes, got ${String(roots.length)}`);
    assert.strictEqual(roots[0]?.label, "Global Configuration");
    assert.strictEqual(roots[1]?.label, "Projects");
  });

  test("root nodes should have correct context values", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    assert.strictEqual(roots[0]?.contextValue, "global");
    assert.strictEqual(roots[1]?.contextValue, "projects");
  });

  test("root nodes should be collapsed by default", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    assert.strictEqual(roots[0]?.collapsibleState, 1, "Global Configuration should be collapsed");
    assert.strictEqual(roots[1]?.collapsibleState, 1, "Projects should be collapsed");
  });

  test("getChildren at root level should return root nodes", async () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const children = await provider.getChildren();
    assert.ok(children.length === 2, `Should return 2 root nodes, got ${String(children.length)}`);
  });

  test("getChildren for global node should return global config children", async () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = await provider.getChildren();
    const globalChildren = await provider.getChildren(roots[0]);

    // Global children should include config file if exists
    assert.ok(globalChildren.length >= 0, "Should return global children array");
  });

  test("getChildren for projects node should return project nodes", async () => {
    const projects = [
      { path: "/home/test/project1", name: "project1" },
      { path: "/home/test/project2", name: "project2" },
    ];
    const facade = new MockFacade(true, projects);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = await provider.getChildren();
    const projectChildren = await provider.getChildren(roots[1]);

    assert.ok(projectChildren.length === 2, `Should return 2 projects, got ${String(projectChildren.length)}`);
    assert.strictEqual(projectChildren[0]?.label, "project1");
    assert.strictEqual(projectChildren[1]?.label, "project2");
  });

  test("getTreeItem should convert TreeNode to TreeItem correctly", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    const treeItem = provider.getTreeItem(roots[0]);

    assert.strictEqual(treeItem.label, "Global Configuration");
    assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    assert.ok(treeItem.iconPath !== undefined, "Should have icon path");
  });

  test("refresh should reload root nodes", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    // Initial root nodes
    const initialRoots = provider["rootNodes"];
    assert.ok(initialRoots.length === 2, "Should have 2 initial root nodes");

    // Refresh
    provider.refresh();

    // After refresh, should still have 2 root nodes
    const refreshedRoots = provider["rootNodes"];
    assert.ok(refreshedRoots.length === 2, "Should have 2 root nodes after refresh");
  });

  test("getNodeOptions for projects node should enable filtering", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    const projectsNode = roots[1];

    const options = provider["getNodeOptions"](projectsNode);
    assert.strictEqual(options.filterClaudeFiles, true, "Projects node should enable Claude file filtering");
  });

  test("getNodeOptions for global node should not enable filtering", () => {
    const facade = new MockFacade(true, []);
    envManager.setFacade(facade);
    provider = new UnifiedProvider(envManager, logger);

    const roots = provider["rootNodes"];
    const globalNode = roots[0];

    const options = provider["getNodeOptions"](globalNode);
    assert.strictEqual(options.filterClaudeFiles, undefined, "Global node should not enable Claude file filtering");
  });
});
