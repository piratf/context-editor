/**
 * Unit tests for ExportScanner
 *
 * 测试 ExportScanner 的节点树遍历和导出计划生成逻辑。
 * 使用 mock NodeService，无需实际文件系统。
 */

import { strict as assert } from "node:assert";
import { test, describe, beforeEach } from "node:test";
import { ExportScanner } from "../../services/exportScanner.js";
import { ExportPathCalculator } from "../../services/exportPathCalculator.js";
import { NodeDataFactory, NodeCategory } from "../../types/nodeData.js";
import type { NodeService } from "../../services/nodeService.js";
import type { GetChildrenResult } from "../../services/nodeService.js";
import type { NodeData } from "../../types/nodeData.js";

void describe("ExportScanner", () => {
  let mockNodeService: NodeService;
  let pathCalculator: ExportPathCalculator;
  let scanner: ExportScanner;
  let getChildrenResults: Map<NodeData, GetChildrenResult> = new Map();

  beforeEach(() => {
    getChildrenResults = new Map();

    // 创建 mock NodeService
    mockNodeService = {
      getChildrenForDirectoryNode: ((node: NodeData) => {
        const result = getChildrenResults.get(node);
        if (result) {
          return Promise.resolve(result);
        }
        return Promise.resolve({ success: true, children: [] });
      }) as unknown as typeof mockNodeService.getChildrenForDirectoryNode,
    } as NodeService;

    pathCalculator = new ExportPathCalculator();
    scanner = new ExportScanner(mockNodeService, pathCalculator);
  });

  void test("scan should handle empty root nodes", async () => {
    const plan = await scanner.scan([]);

    assert.equal(plan.directoriesToCreate.length, 0);
    assert.equal(plan.filesToCopy.length, 0);
    assert.ok(plan.metadata.timestamp > 0);
  });

  void test("scan should process VIRTUAL nodes and traverse children", async () => {
    // 创建 VIRTUAL 节点（Global Configuration）
    const virtualNode = NodeDataFactory.createVirtualNode("Global Configuration", {
      category: NodeCategory.GLOBAL,
    });

    // 创建子节点
    const fileNode = NodeDataFactory.createClaudeJson(".claude.json", "/home/user/.claude.json");

    // 设置 getChildren 返回
    getChildrenResults.set(virtualNode, { success: true, children: [fileNode] });

    const plan = await scanner.scan([virtualNode]);

    // 应该创建 VIRTUAL 目录和文件条目
    assert.ok(plan.directoriesToCreate.length >= 1);
    assert.equal(plan.filesToCopy.length, 1);
    assert.equal(plan.filesToCopy[0]?.label, ".claude.json");
    assert.equal(plan.filesToCopy[0]?.category, NodeCategory.GLOBAL);
  });

  void test("scan should process PROJECT nodes", async () => {
    // 创建 PROJECT 节点
    const projectNode = NodeDataFactory.createProject("myproject", "/home/user/myproject");

    // 创建子文件节点
    const claudeMdNode = NodeDataFactory.createFile("CLAUDE.md", "/home/user/myproject/CLAUDE.md");

    // 设置 getChildren 返回
    getChildrenResults.set(projectNode, { success: true, children: [claudeMdNode] });

    const plan = await scanner.scan([projectNode]);

    // 应该创建项目目录和文件条目
    assert.ok(plan.directoriesToCreate.length >= 1);
    assert.equal(plan.filesToCopy.length, 1);
    assert.equal(plan.filesToCopy[0]?.projectName, "myproject");
    assert.equal(plan.filesToCopy[0]?.category, NodeCategory.PROJECTS);
  });

  void test("scan should process DIRECTORY nodes without recursion", async () => {
    // 创建 DIRECTORY 节点
    const dirNode = NodeDataFactory.createDirectory(".claude", "/home/user/.claude");

    const plan = await scanner.scan([dirNode]);

    // DIRECTORY 节点应该被添加到 directoriesToCopy（整个目录将被递归复制）
    assert.equal(plan.directoriesToCopy.length, 1);
    assert.equal(plan.directoriesToCreate.length, 0);
    assert.equal(plan.filesToCopy.length, 0);
    assert.equal(plan.directoriesToCopy[0]?.label, ".claude");
  });

  void test("scan should process FILE nodes", async () => {
    // 创建 FILE 节点
    const fileNode = NodeDataFactory.createFile(
      "settings.json",
      "/home/user/.claude/settings.json"
    );

    const plan = await scanner.scan([fileNode]);

    // 应该添加文件条目
    assert.equal(plan.directoriesToCreate.length, 0);
    assert.equal(plan.filesToCopy.length, 1);
    assert.equal(plan.filesToCopy[0]?.label, "settings.json");
  });

  void test("scan should use node.category for VIRTUAL nodes", async () => {
    // 创建带有 category 的 VIRTUAL 节点
    const virtualNode = NodeDataFactory.createVirtualNode("Projects", {
      category: NodeCategory.PROJECTS,
    });

    const plan = await scanner.scan([virtualNode]);

    // 应该使用 node.category 作为目录名
    assert.ok(plan.directoriesToCreate.length >= 1);
    assert.equal(plan.directoriesToCreate[0]?.category, NodeCategory.PROJECTS);
    assert.equal(plan.directoriesToCreate[0]?.dstRelativePath, "projects");
  });

  void test("scan should handle nested project files correctly", async () => {
    // 创建 VIRTUAL 节点
    const virtualNode = NodeDataFactory.createVirtualNode("Projects", {
      category: NodeCategory.PROJECTS,
    });

    // 创建 PROJECT 节点
    const projectNode = NodeDataFactory.createProject("test-project", "/home/user/test-project");

    // 创建项目下的文件
    const claudeMdNode = NodeDataFactory.createFile(
      "CLAUDE.md",
      "/home/user/test-project/CLAUDE.md"
    );
    const settingsNode = NodeDataFactory.createFile(
      "settings.json",
      "/home/user/test-project/.claude/settings.json"
    );

    // 设置 getChildren 返回
    getChildrenResults.set(virtualNode, { success: true, children: [projectNode] });
    getChildrenResults.set(projectNode, { success: true, children: [claudeMdNode, settingsNode] });

    const plan = await scanner.scan([virtualNode]);

    // 验证项目文件路径
    const projectFiles = plan.filesToCopy.filter((f) => f.projectName === "test-project");
    assert.ok(projectFiles.length >= 2);

    const claudeMdFile = projectFiles.find((f) => f.label === "CLAUDE.md");
    assert.ok(claudeMdFile);
    assert.equal(claudeMdFile.dstRelativePath, "projects/test-project/CLAUDE.md");

    const settingsFile = projectFiles.find((f) => f.label === "settings.json");
    assert.ok(settingsFile);
    assert.equal(settingsFile.category, NodeCategory.PROJECTS);
  });
});
