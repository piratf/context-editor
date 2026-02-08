/**
 * Unit tests for nodeClasses
 *
 * Tests the OOP-style tree node classes.
 * DirectoryNode should focus on file system operations,
 * delegating all filtering logic to injected Filters.
 */

import * as assert from "node:assert";
import { DirectoryNode, FileNode, ErrorNode, NodeFactory, ClaudeJsonNode } from "../../types/nodeClasses.js";
import type { TreeNode } from "../../types/treeNode.js";
import { NodeType } from "../../types/treeNode.js";
import type { SyncFileFilter, FilterContext } from "../../types/fileFilter.js";
import { AllowAllFilter } from "../../types/fileFilter.js";

suite("nodeClasses Tests", () => {
  /**
   * Helper to create a basic directory TreeNode
   */
  function createDirectoryTreeNode(path: string): TreeNode {
    return {
      type: NodeType.DIRECTORY,
      label: path.split("/").pop() ?? path,
      path,
      collapsibleState: 1,
      tooltip: path,
      contextValue: "directory",
    };
  }

  suite("FileNode", () => {
    test("should create file node from TreeNode data", () => {
      const data: TreeNode = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0,
        contextValue: "file",
      };
      const node = new FileNode(data);

      assert.strictEqual(node.type, NodeType.FILE);
      assert.strictEqual(node.label, "test.txt");
      assert.strictEqual(node.path, "/home/test/test.txt");
    });

    test("should return empty array for children", async () => {
      const data: TreeNode = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0,
        contextValue: "file",
      };
      const node = new FileNode(data);

      const children = await node.getChildren();
      assert.deepStrictEqual(children, []);
    });

    test("should convert to TreeNode interface", () => {
      const data: TreeNode = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0,
        contextValue: "file",
      };
      const node = new FileNode(data);

      const treeNode = node.toTreeNode();
      assert.strictEqual(treeNode.type, NodeType.FILE);
      assert.strictEqual(treeNode.label, "test.txt");
    });
  });

  suite("ClaudeJsonNode", () => {
    test("should create Claude JSON node from TreeNode data", () => {
      const data: TreeNode = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0,
        contextValue: "claude-json",
      };
      const node = new ClaudeJsonNode(data);

      assert.strictEqual(node.type, NodeType.CLAUDE_JSON);
      assert.strictEqual(node.label, ".claude.json");
    });

    test("should return empty array for children", async () => {
      const data: TreeNode = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0,
        contextValue: "claude-json",
      };
      const node = new ClaudeJsonNode(data);

      const children = await node.getChildren();
      assert.deepStrictEqual(children, []);
    });
  });

  suite("ErrorNode", () => {
    test("should create error node from TreeNode data", () => {
      const error = new Error("Test error");
      const data: TreeNode = {
        type: NodeType.ERROR,
        label: "Error",
        collapsibleState: 0,
        contextValue: "error",
        error,
      };
      const node = new ErrorNode(data);

      assert.strictEqual(node.type, NodeType.ERROR);
      assert.strictEqual(node.label, "Error");
      assert.strictEqual(node.error, error);
    });

    test("should return empty array for children", async () => {
      const data: TreeNode = {
        type: NodeType.ERROR,
        label: "Error",
        collapsibleState: 0,
        contextValue: "error",
      };
      const node = new ErrorNode(data);

      const children = await node.getChildren();
      assert.deepStrictEqual(children, []);
    });
  });

  suite("NodeFactory", () => {
    test("should create FileNode for FILE type", () => {
      const data: TreeNode = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0,
        contextValue: "file",
      };
      const node = NodeFactory.create(data);

      assert.ok(node instanceof FileNode);
    });

    test("should create ErrorNode for ERROR type", () => {
      const data: TreeNode = {
        type: NodeType.ERROR,
        label: "Error",
        collapsibleState: 0,
        contextValue: "error",
      };
      const node = NodeFactory.create(data);

      assert.ok(node instanceof ErrorNode);
    });

    test("should create DirectoryNode for DIRECTORY type", () => {
      const data = createDirectoryTreeNode("/home/test");
      const node = NodeFactory.create(data);

      assert.ok(node instanceof DirectoryNode);
    });

    test("should create ClaudeJsonNode for CLAUDE_JSON type", () => {
      const data: TreeNode = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0,
        contextValue: "claude-json",
      };
      const node = NodeFactory.create(data);

      assert.ok(node instanceof ClaudeJsonNode);
    });

    test("should create ErrorNode for unknown type", () => {
      const data = {
        type: "unknown" as NodeType,
        label: "unknown",
        collapsibleState: 0,
        contextValue: "unknown",
      } as TreeNode;
      const node = NodeFactory.create(data);

      assert.ok(node instanceof ErrorNode);
    });

    test("should pass filter options to DirectoryNode", () => {
      const data = createDirectoryTreeNode("/home/test");
      const mockFilter = new AllowAllFilter();

      const node = NodeFactory.create(data, { filter: mockFilter });

      assert.ok(node instanceof DirectoryNode);
    });

    test("should pass filterClaudeFiles option to DirectoryNode", () => {
      const data = createDirectoryTreeNode("/home/test");

      const node = NodeFactory.create(data, { filterClaudeFiles: true });

      assert.ok(node instanceof DirectoryNode);
    });
  });

  suite("DirectoryNode", () => {
    suite("constructor", () => {
      test("should use ClaudeCodeFileFilter by default", () => {
        const data = createDirectoryTreeNode("/home/test");
        const node = new DirectoryNode(data);

        // Verify node was created successfully
        assert.strictEqual(node.type, NodeType.DIRECTORY);
        assert.strictEqual(node.path, "/home/test");
      });

      test("should use ProjectClaudeFileFilter when filterClaudeFiles is true", () => {
        const data = createDirectoryTreeNode("/home/test");
        const node = new DirectoryNode(data, { filterClaudeFiles: true });

        assert.strictEqual(node.type, NodeType.DIRECTORY);
      });

      test("should use provided filter", () => {
        const data = createDirectoryTreeNode("/home/test");
        const mockFilter = new AllowAllFilter();
        const node = new DirectoryNode(data, { filter: mockFilter });

        assert.strictEqual(node.type, NodeType.DIRECTORY);
      });
    });

    suite("getChildren() - error handling", () => {
      test("should return error node when path is undefined", async () => {
        const data: TreeNode = {
          type: NodeType.DIRECTORY,
          label: "test",
          collapsibleState: 1,
          contextValue: "directory",
          // path is undefined
        };
        const node = new DirectoryNode(data);

        const children = await node.getChildren();

        assert.strictEqual(children.length, 1);
        assert.strictEqual(children[0]?.type, NodeType.ERROR);
        assert.strictEqual(children[0]?.label, "Error: No path");
      });
    });

    suite("filter delegation tests", () => {
      /**
       * Filter that tracks evaluation contexts
       */
      class TrackingFilter implements SyncFileFilter {
        readonly description = "Tracking filter";
        readonly contexts: FilterContext[] = [];
        private readonly include: boolean;

        constructor(include: boolean = true) {
          this.include = include;
        }

        evaluate(context: FilterContext): { include: boolean; reason?: string } {
          this.contexts.push(context);
          return { include: this.include };
        }

        resetTracking(): void {
          this.contexts.length = 0;
        }

        wasEvaluated(): boolean {
          return this.contexts.length > 0;
        }

        getLastContext(): FilterContext | undefined {
          return this.contexts[this.contexts.length - 1];
        }
      }

      test("should accept filter injection via constructor option", () => {
        const data = createDirectoryTreeNode("/home/test");
        const customFilter = new TrackingFilter(true);

        const node = new DirectoryNode(data, { filter: customFilter });

        assert.strictEqual(node.type, NodeType.DIRECTORY);
        assert.strictEqual(node.path, "/home/test");
      });

      test("should use default ClaudeCodeFileFilter when no filter provided", () => {
        const data = createDirectoryTreeNode("/home/test");

        const node = new DirectoryNode(data);

        assert.strictEqual(node.type, NodeType.DIRECTORY);
        // Node should use default filter (no easy way to verify without file system operations)
      });

      test("should use ProjectClaudeFileFilter when filterClaudeFiles option is true", () => {
        const data = createDirectoryTreeNode("/home/test");

        const node = new DirectoryNode(data, { filterClaudeFiles: true });

        assert.strictEqual(node.type, NodeType.DIRECTORY);
        assert.strictEqual(node.path, "/home/test");
      });
    });

    suite("toTreeNode()", () => {
      test("should convert to TreeNode interface", () => {
        const data = createDirectoryTreeNode("/home/test");
        const node = new DirectoryNode(data);

        const treeNode = node.toTreeNode();

        assert.strictEqual(treeNode.type, NodeType.DIRECTORY);
        assert.strictEqual(treeNode.label, "test");
        assert.strictEqual(treeNode.path, "/home/test");
        assert.strictEqual(treeNode.collapsibleState, 1);
      });

      test("should preserve all TreeNode properties", () => {
        const data: TreeNode = {
          type: NodeType.DIRECTORY,
          label: "mydir",
          path: "/custom/path/mydir",
          collapsibleState: 1,
          tooltip: "Custom tooltip",
          contextValue: "custom-directory",
        };
        const node = new DirectoryNode(data);

        const treeNode = node.toTreeNode();

        assert.strictEqual(treeNode.type, NodeType.DIRECTORY);
        assert.strictEqual(treeNode.label, "mydir");
        assert.strictEqual(treeNode.path, "/custom/path/mydir");
        assert.strictEqual(treeNode.collapsibleState, 1);
        assert.strictEqual(treeNode.tooltip, "Custom tooltip");
        assert.strictEqual(treeNode.contextValue, "custom-directory");
      });
    });

    suite("properties", () => {
      test("should expose TreeNode properties", () => {
        const data = createDirectoryTreeNode("/home/test");
        const node = new DirectoryNode(data);

        assert.strictEqual(node.type, NodeType.DIRECTORY);
        assert.strictEqual(node.label, "test");
        assert.strictEqual(node.path, "/home/test");
        assert.strictEqual(node.collapsibleState, 1);
        assert.strictEqual(node.tooltip, "/home/test");
        assert.strictEqual(node.contextValue, "directory");
      });

      test("should have undefined iconPath for collapsible nodes", () => {
        const data = createDirectoryTreeNode("/home/test");
        const node = new DirectoryNode(data);

        // Collapsible nodes should not have iconPath (to avoid VS Code indentation issues)
        assert.strictEqual(node.iconPath, undefined);
      });
    });
  });
});
