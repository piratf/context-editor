/**
 * Unified TreeDataProvider for Context Editor.
 * Combines Global and Projects views into a single view with two top-level nodes.
 *
 * Root structure:
 * - Global Configuration (shows ~/.claude.json and ~/.claude/ directory)
 * - Projects (shows all registered Claude projects)
 */

import { BaseProvider, TreeNode } from "./baseProvider.js";
import { ServiceTokens } from "../di/tokens";

/**
 * Unified provider that shows both Global and Projects in a single view
 */
export class UnifiedProvider extends BaseProvider {

  /**
   * Get children of a given node, or root nodes if no node provided
   *
   * Uses NodeService from DI container to get children for directory nodes
   */
  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    this.logger.debug("getChildren called", {
      element: element === undefined ? "root" : `"${element.label}" (${element.type})`,
    });

    if (!element) {
      const rootNodeService = this.container.get(ServiceTokens.ClaudeCodeRootNodeService);
      return [...rootNodeService.createRootNodes()];
    }

    // Get NodeService from DI container (already configured)
    const nodeService = this.container.get(ServiceTokens.NodeService);
    const result = await nodeService.getChildrenByNodeType(element);

    if (result.success) {
      this.logger.info("Successfully got children", {
        element: element.label,
        children: result.children.length,
      });
      return [...result.children];
    } else {
      this.logger.error("Error getting children", new Error(result.error.tooltip));
      return [result.error];
    }
  }
}