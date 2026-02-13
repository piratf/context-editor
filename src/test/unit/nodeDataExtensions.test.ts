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
  });
});
