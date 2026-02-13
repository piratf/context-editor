/**
 * Unit tests for NodeData extensions
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NodeType, NodeTypeGuard } from "../../types/nodeData.js";

void describe("NodeType extensions (USER_ROOT, PROJECTS_ROOT)", () => {
  void describe("NodeTypeGuard", () => {
    void it("should identify USER_ROOT nodes correctly", () => {
      assert.ok(NodeTypeGuard.isUserRoot(NodeType.USER_ROOT));
    });

    void it("should identify PROJECTS_ROOT nodes correctly", () => {
      assert.ok(NodeTypeGuard.isProjectsRoot(NodeType.PROJECTS_ROOT));
    });

    void it("should return false for non-root nodes", () => {
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.FILE));
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.DIRECTORY));
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.CLAUDE_JSON));
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.ERROR));
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.ROOT));
      assert.ok(!NodeTypeGuard.isUserRoot(NodeType.PROJECTS_ROOT));

      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.FILE));
      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.DIRECTORY));
      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.CLAUDE_JSON));
      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.ERROR));
      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.ROOT));
      assert.ok(!NodeTypeGuard.isProjectsRoot(NodeType.USER_ROOT));
    });
  });
});
