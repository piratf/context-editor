/**
 * Unit tests for batch commands (multi-select operations)
 */

import * as assert from "node:assert";
import {
  batchCopy,
  batchCut,
  getClipboardStore,
  clearClipboardStore,
} from "../../commands/batchCommands.js";
import type { TreeNode } from "../../types/treeNode.js";
import { NodeType } from "../../types/treeNode.js";

suite("Batch Commands Tests", () => {
  /**
   * Helper to create mock TreeNode
   */
  function createMockTreeNode(
    label: string,
    path: string,
    _nodeType: NodeType = NodeType.FILE
  ): TreeNode {
    return {
      type: NodeType.FILE,
      label,
      path,
      collapsibleState: 0,
      contextValue: "file",
      tooltip: path,
    };
  }

  setup(() => {
    // Clear clipboard store before each test
    clearClipboardStore();
  });

  suite("batchCopy", () => {
    test("should copy single node to clipboard", () => {
      const node = createMockTreeNode("test.txt", "/home/test/test.txt");
      batchCopy([node]);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.mode, "copy");
      assert.strictEqual(store.items.length, 1);
      assert.strictEqual(store.items[0].label, "test.txt");
    });

    test("should copy multiple nodes to clipboard", () => {
      const nodes = [
        createMockTreeNode("file1.txt", "/home/test/file1.txt"),
        createMockTreeNode("file2.txt", "/home/test/file2.txt"),
      ];
      batchCopy(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 2);
    });

    test("should filter out nodes without paths", () => {
      const nodes = [
        createMockTreeNode("file1.txt", "/home/test/file1.txt"),
        { label: "no-path", type: NodeType.FILE, collapsibleState: 0, contextValue: "file" } as TreeNode,
      ];
      batchCopy(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 1);
      assert.strictEqual(store.items[0].label, "file1.txt");
    });

    test("should show warning when no nodes selected", () => {
      batchCopy([]);

      const store = getClipboardStore();
      assert.strictEqual(store, null);
    });

    test("should handle empty array after filtering", () => {
      const nodes = [
        { label: "no-path", type: NodeType.FILE, collapsibleState: 0, contextValue: "file" } as TreeNode,
      ];
      batchCopy(nodes);

      const store = getClipboardStore();
      assert.strictEqual(store, null);
    });
  });

  suite("batchCut", () => {
    test("should cut single node to clipboard", () => {
      const node = createMockTreeNode("test.txt", "/home/test/test.txt");
      batchCut([node]);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.mode, "cut");
      assert.strictEqual(store.items.length, 1);
    });

    test("should cut multiple nodes to clipboard", () => {
      const nodes = [
        createMockTreeNode("file1.txt", "/home/test/file1.txt"),
        createMockTreeNode("file2.txt", "/home/test/file2.txt"),
      ];
      batchCut(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.mode, "cut");
      assert.strictEqual(store.items.length, 2);
    });
  });

  suite("clipboardStore management", () => {
    test("should clear clipboard store", () => {
      batchCopy([createMockTreeNode("test.txt", "/home/test/test.txt")]);
      assert.ok(getClipboardStore() !== null);

      clearClipboardStore();
      assert.strictEqual(getClipboardStore(), null);
    });

    test("should return current clipboard store", () => {
      const node = createMockTreeNode("test.txt", "/home/test/test.txt");
      batchCopy([node]);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.mode, "copy");
      assert.strictEqual(store.items[0].label, "test.txt");
    });

    test("should overwrite existing clipboard store", () => {
      // First copy
      batchCopy([createMockTreeNode("file1.txt", "/home/test/file1.txt")]);
      let store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 1);
      assert.strictEqual(store.mode, "copy");

      // Second copy should replace
      batchCut([createMockTreeNode("file2.txt", "/home/test/file2.txt")]);
      store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 1);
      assert.strictEqual(store.mode, "cut");
      assert.strictEqual(store.items[0].label, "file2.txt");
    });
  });

  suite("Edge Cases", () => {
    test("should handle empty array", () => {
      batchCopy([]);
      assert.strictEqual(getClipboardStore(), null);

      batchCut([]);
      assert.strictEqual(getClipboardStore(), null);
    });

    test("should handle non-array input", () => {
      batchCopy("invalid" as unknown as []);
      assert.strictEqual(getClipboardStore(), null);

      batchCut({ invalid: true } as unknown as []);
      assert.strictEqual(getClipboardStore(), null);
    });

    test("should handle null input", () => {
      batchCopy(null as unknown as []);
      assert.strictEqual(getClipboardStore(), null);

      batchCut(null as unknown as []);
      assert.strictEqual(getClipboardStore(), null);
    });

    test("should handle nodes with undefined path", () => {
      const nodes = [
        createMockTreeNode("valid.txt", "/home/test/valid.txt"),
        { label: "no-path", type: NodeType.FILE, collapsibleState: 0, contextValue: "file" } as TreeNode,
      ];
      batchCopy(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 1);
      assert.strictEqual(store.items[0].label, "valid.txt");
    });

    test("should handle large number of nodes", () => {
      const nodes: TreeNode[] = [];
      for (let i = 0; i < 100; i++) {
        nodes.push(createMockTreeNode(`file${String(i)}.txt`, `/home/test/file${String(i)}.txt`));
      }

      batchCopy(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 100);
    });

    test("should handle nodes with different types", () => {
      const nodes = [
        createMockTreeNode("file1.txt", "/home/test/file1.txt"),
        createMockTreeNode("file2.json", "/home/test/file2.json"),
        createMockTreeNode("file3.md", "/home/test/file3.md"),
      ];

      batchCopy(nodes);

      const store = getClipboardStore();
      assert.ok(store !== null);
      assert.strictEqual(store.items.length, 3);
      assert.deepStrictEqual(store.items.map((n) => n.label), ["file1.txt", "file2.json", "file3.md"]);
    });
  });
});
