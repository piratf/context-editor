/**
 * Unit tests for context menu functionality.
 *
 * Tests cover:
 * - Type guard functions (isCopyable, isDeletable, isOpenableInVscode)
 * - Helper functions (buildContextValue)
 * - Command constants
 *
 * Note: Full command handler tests require mocking VS Code API which is
 * challenging due to non-configurable properties. Those tests should be
 * done as integration tests where possible.
 */

import * as assert from "node:assert";
import { DirectoryNode, FileNode, ClaudeJsonNode } from "../../types/nodeClasses.js";
import { NodeType } from "../../types/treeNode.js";
import {
  isCopyable,
  isDeletable,
  isOpenableInVscode,
  CONTEXT_MARKERS,
  buildContextValue,
  MenuCommands,
} from "../../types/menuInterfaces.js";
import type { CollapsibleState } from "../../types/treeNode.js";

suite("Context Menu - Type Guards", () => {
  suite("isCopyable", () => {
    test("should return true for FileNode", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(isCopyable(node), true);
    });

    test("should return true for DirectoryNode", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "test",
        path: "/home/test",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(isCopyable(node), true);
    });

    test("should return true for ClaudeJsonNode", () => {
      const data = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "claudeJson+copyable+deletable",
      };
      const node = new ClaudeJsonNode(data);

      assert.strictEqual(isCopyable(node), true);
    });

    test("should return false for non-object", () => {
      assert.strictEqual(isCopyable(null), false);
      assert.strictEqual(isCopyable(undefined), false);
      assert.strictEqual(isCopyable("string"), false);
      assert.strictEqual(isCopyable(123), false);
    });

    test("should return false for object without required methods", () => {
      const invalidNode = { label: "test" };
      assert.strictEqual(isCopyable(invalidNode), false);
    });
  });

  suite("isDeletable", () => {
    test("should return true for FileNode", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(isDeletable(node), true);
    });

    test("should return true for DirectoryNode", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "test",
        path: "/home/test",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(isDeletable(node), true);
    });

    test("should return true for ClaudeJsonNode", () => {
      const data = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "claudeJson+copyable+deletable",
      };
      const node = new ClaudeJsonNode(data);

      assert.strictEqual(isDeletable(node), true);
    });

    test("should return false for non-object", () => {
      assert.strictEqual(isDeletable(null), false);
      assert.strictEqual(isDeletable(undefined), false);
    });

    test("should return false for object without required methods", () => {
      const invalidNode = { label: "test", delete: "not a function" };
      assert.strictEqual(isDeletable(invalidNode), false);
    });
  });

  suite("isOpenableInVscode", () => {
    test("should return true for DirectoryNode", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "test",
        path: "/home/test",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(isOpenableInVscode(node), true);
    });

    test("should return false for FileNode", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(isOpenableInVscode(node), false);
    });

    test("should return false for non-object", () => {
      assert.strictEqual(isOpenableInVscode(null), false);
      assert.strictEqual(isOpenableInVscode(undefined), false);
    });
  });
});

suite("Context Menu - Helper Functions", () => {
  suite("buildContextValue", () => {
    test("should build contextValue with single interface", () => {
      const result = buildContextValue("file", [CONTEXT_MARKERS.COPYABLE]);
      assert.strictEqual(result, "file+copyable");
    });

    test("should build contextValue with multiple interfaces", () => {
      const result = buildContextValue("directory", [
        CONTEXT_MARKERS.COPYABLE,
        CONTEXT_MARKERS.DELETABLE,
        CONTEXT_MARKERS.OPENABLE_IN_VSCODE,
      ]);
      assert.strictEqual(result, "directory+copyable+deletable+openableInVscode");
    });

    test("should filter out empty interface markers", () => {
      const result = buildContextValue("file", ["", CONTEXT_MARKERS.COPYABLE]);
      assert.strictEqual(result, "file+copyable");
    });

    test("should handle empty interfaces array", () => {
      const result = buildContextValue("file", []);
      assert.strictEqual(result, "file");
    });

    test("should handle empty base type", () => {
      const result = buildContextValue("", [CONTEXT_MARKERS.COPYABLE]);
      assert.strictEqual(result, "copyable");
    });
  });
});

suite("Context Menu - MenuCommands Constants", () => {
  test("should have correct command identifiers", () => {
    assert.strictEqual(MenuCommands.COPY_NAME, "contextEditor.copyName");
    assert.strictEqual(MenuCommands.COPY_PATH, "contextEditor.copyPath");
    assert.strictEqual(MenuCommands.DELETE, "contextEditor.delete");
    assert.strictEqual(MenuCommands.OPEN_VSCODE, "contextEditor.openVscode");
  });
});

suite("Context Menu - CONTEXT_MARKERS Constants", () => {
  test("should have correct marker strings", () => {
    assert.strictEqual(CONTEXT_MARKERS.COPYABLE, "copyable");
    assert.strictEqual(CONTEXT_MARKERS.DELETABLE, "deletable");
    assert.strictEqual(CONTEXT_MARKERS.OPENABLE_IN_VSCODE, "openableInVscode");
  });
});

suite("Context Menu - Node Interface Methods", () => {
  suite("ICopyable methods", () => {
    test("FileNode should implement getAccessiblePath and getDisplayName", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(node.getAccessiblePath(), "/home/test/test.txt");
      assert.strictEqual(node.getDisplayName(), "test.txt");
    });

    test("DirectoryNode should implement getAccessiblePath and getDisplayName", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "mydir",
        path: "/home/test/mydir",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(node.getAccessiblePath(), "/home/test/mydir");
      assert.strictEqual(node.getDisplayName(), "mydir");
    });

    test("ClaudeJsonNode should implement getAccessiblePath and getDisplayName", () => {
      const data = {
        type: NodeType.CLAUDE_JSON,
        label: ".claude.json",
        path: "/home/test/.claude.json",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "claudeJson+copyable+deletable",
      };
      const node = new ClaudeJsonNode(data);

      assert.strictEqual(node.getAccessiblePath(), "/home/test/.claude.json");
      assert.strictEqual(node.getDisplayName(), ".claude.json");
    });
  });

  suite("IDeletable methods", () => {
    test("FileNode should implement canDelete and delete", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(typeof node.canDelete, "function");
      assert.strictEqual(typeof node.delete, "function");
      assert.strictEqual(node.canDelete(), true);
    });

    test("DirectoryNode should implement canDelete and delete", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "test",
        path: "/home/test",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(typeof node.canDelete, "function");
      assert.strictEqual(typeof node.delete, "function");
      assert.strictEqual(node.canDelete(), true);
    });
  });

  suite("IOpenableInVscode methods", () => {
    test("DirectoryNode should implement getDirectoryPath and openInNewWindow", () => {
      const data = {
        type: NodeType.DIRECTORY,
        label: "test",
        path: "/home/test",
        collapsibleState: 1 as CollapsibleState,
        contextValue: "directory+copyable+deletable+openableInVscode",
      };
      const node = new DirectoryNode(data);

      assert.strictEqual(typeof node.getDirectoryPath, "function");
      assert.strictEqual(typeof node.openInNewWindow, "function");
      assert.strictEqual(node.getDirectoryPath(), "/home/test");
    });

    test("FileNode should not implement IOpenableInVscode methods", () => {
      const data = {
        type: NodeType.FILE,
        label: "test.txt",
        path: "/home/test/test.txt",
        collapsibleState: 0 as CollapsibleState,
        contextValue: "file+copyable+deletable",
      };
      const node = new FileNode(data);

      assert.strictEqual(typeof (node as { getDirectoryPath?: () => string }).getDirectoryPath, "undefined");
      assert.strictEqual(typeof (node as { openInNewWindow?: () => Promise<void> }).openInNewWindow, "undefined");
    });
  });
});
