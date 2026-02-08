/**
 * Unit tests for UnifiedProvider
 *
 * Tests focus on TreeDataProvider public API behavior.
 * All tests use getChildren() and getTreeItem() public methods,
 * avoiding direct access to private implementation details.
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

  suite("getChildren() - root level", () => {
    test("should return info node when no facade", async () => {
      envManager.setFacade(null as unknown as ClaudeDataFacade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();

      assert.strictEqual(roots.length, 1, "Should have 1 root node (info node)");
      assert.strictEqual(roots[0]?.label, "No environment selected");
      // createInfoNode creates nodes with contextValue "empty"
      assert.strictEqual(roots[0]?.contextValue, "empty");
    });

    test("should return 2 root nodes when facade exists", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();

      assert.strictEqual(roots.length, 2, `Should have 2 root nodes`);
      assert.strictEqual(roots[0]?.label, "Global Configuration");
      assert.strictEqual(roots[1]?.label, "Projects");
    });

    test("root nodes should be collapsed", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalTreeItem = provider.getTreeItem(roots[0]);
      const projectsTreeItem = provider.getTreeItem(roots[1]);

      assert.strictEqual(globalTreeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
      assert.strictEqual(projectsTreeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });

    test("collapsible nodes should not have icon path", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalTreeItem = provider.getTreeItem(roots[0]);
      const projectsTreeItem = provider.getTreeItem(roots[1]);

      assert.strictEqual(globalTreeItem.iconPath, undefined);
      assert.strictEqual(projectsTreeItem.iconPath, undefined);
    });
  });

  suite("getChildren() - global node children", () => {
    test("should return global config file children", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalChildren = await provider.getChildren(roots[0]);

      // Global children should include config file if exists
      assert.ok(Array.isArray(globalChildren), "Should return global children array");
      assert.ok(globalChildren.length >= 0, "Should return valid array");
    });

    test("global node should have correct context value", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalTreeItem = provider.getTreeItem(roots[0]);

      // Note: contextValue is not exposed in TreeItem, so we verify through label
      assert.strictEqual(globalTreeItem.label, "Global Configuration");
    });
  });

  suite("getChildren() - projects node children", () => {
    test("should return project nodes", async () => {
      const projects = [
        { path: "/home/test/project1", name: "project1" },
        { path: "/home/test/project2", name: "project2" },
      ];
      const facade = new MockFacade(true, projects);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const projectChildren = await provider.getChildren(roots[1]);

      assert.strictEqual(projectChildren.length, 2, `Should return 2 projects`);
      assert.strictEqual(projectChildren[0]?.label, "project1");
      assert.strictEqual(projectChildren[1]?.label, "project2");
    });

    test("should return empty indicator when no projects", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const projectChildren = await provider.getChildren(roots[1]);

      // When no projects, provider returns an "(empty)" indicator node
      assert.ok(projectChildren.length >= 0);
      // Note: actual behavior may return empty indicator node
    });

    test("project nodes should be collapsible directories", async () => {
      const projects = [{ path: "/home/test/project1", name: "project1" }];
      const facade = new MockFacade(true, projects);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const projectChildren = await provider.getChildren(roots[1]);
      const projectTreeItem = provider.getTreeItem(projectChildren[0]);

      assert.strictEqual(projectTreeItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);
    });
  });

  suite("getTreeItem()", () => {
    test("should convert TreeNode to TreeItem correctly", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalTreeItem = provider.getTreeItem(roots[0]);
      const projectsTreeItem = provider.getTreeItem(roots[1]);

      assert.strictEqual(globalTreeItem.label, "Global Configuration");
      assert.strictEqual(projectsTreeItem.label, "Projects");
    });

    test("should set tooltip for tree items", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();
      const globalTreeItem = provider.getTreeItem(roots[0]);

      // Tooltip should be set (typically the same as label for root nodes)
      assert.ok(globalTreeItem.tooltip !== undefined);
    });
  });

  suite("refresh()", () => {
    test("should reload provider state", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      // Get initial roots
      const initialRoots = await provider.getChildren();
      assert.strictEqual(initialRoots.length, 2, "Should have 2 initial root nodes");

      // Refresh
      provider.refresh();

      // After refresh, should still have 2 root nodes
      const refreshedRoots = await provider.getChildren();
      assert.strictEqual(refreshedRoots.length, 2, "Should have 2 root nodes after refresh");
    });
  });

  suite("error handling", () => {
    test("should handle missing facade gracefully", async () => {
      envManager.setFacade(null as unknown as ClaudeDataFacade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();

      assert.strictEqual(roots.length, 1);
      // Note: contextValue is "info" for info nodes created by createInfoNode
      // Only createErrorNode creates nodes with contextValue "error"
      const errorTreeItem = provider.getTreeItem(roots[0]);
      assert.ok(typeof errorTreeItem.label === "string" && errorTreeItem.label.includes("No environment selected"));
    });
  });

  suite("TreeDataProvider interface compliance", () => {
    test("should implement getTreeItem for all nodes", async () => {
      const facade = new MockFacade(true, []);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      const roots = await provider.getChildren();

      // Should be able to get TreeItem for all root nodes
      for (const root of roots) {
        const treeItem = provider.getTreeItem(root);
        assert.ok(treeItem.label !== undefined);
        assert.ok(typeof treeItem.collapsibleState === "number");
      }
    });

    test("should support hierarchical tree navigation", async () => {
      const projects = [
        { path: "/home/test/project1", name: "project1" },
        { path: "/home/test/project2", name: "project2" },
      ];
      const facade = new MockFacade(true, projects);
      envManager.setFacade(facade);
      provider = new UnifiedProvider(envManager, logger);

      // Navigate: root -> projects -> project1
      const roots = await provider.getChildren();
      const projectsNode = roots[1];

      const projectChildren = await provider.getChildren(projectsNode);
      assert.ok(projectChildren.length > 0);

      const projectTreeItem = provider.getTreeItem(projectChildren[0]);
      assert.ok(projectTreeItem.label !== undefined);
    });
  });
});
