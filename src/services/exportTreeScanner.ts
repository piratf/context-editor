/**
 * Export Tree Scanner
 *
 * Scans the UnifiedProvider tree and converts it to ExportTreeNode format
 * for the tree view export interface.
 */

import type { UnifiedProvider } from "../views/unifiedProvider.js";
import type { NodeData, NodeType } from "../types/nodeData.js";
import { ExportTreeNode, TreeExportPlan } from "../types/exportPlan.js";
import type { ILoggerService } from "./loggerService.js";

/**
 * Safe directory names that should be pre-selected
 */
const SAFE_DIR_NAMES = [
  ".claude",
  ".gemini",
  ".cursor",
  ".mcp",
  ".skills",
  ".agents",
  ".commands",
  "context.json",
  "settings.json",
  "CLAUDE.md",
  ".claude.md",
  ".claude.json",
  ".mcp.json",
];

/**
 * Tree scanner for export interface
 */
export class ExportTreeScanner {
  constructor(
    private readonly unifiedProvider: UnifiedProvider,
    private readonly logger: ILoggerService,
    private readonly savedSelectedIds?: string[],
    private readonly savedExpandedIds?: string[]
  ) {}

  /**
   * Scan the tree and convert to export format
   */
  async scan(): Promise<TreeExportPlan> {
    this.logger.debug("ExportTreeScanner: Starting scan");

    // Get root nodes from UnifiedProvider
    const rootNodes = await this.unifiedProvider.getChildren();

    this.logger.debug("ExportTreeScanner: Got root nodes", {
      count: rootNodes.length,
    });

    // Create a virtual root to hold all nodes
    const virtualRoot: ExportTreeNode = {
      id: "root",
      name: "Root",
      type: "directory",
      path: "",
      children: [],
      selectionState: "unselected",
      isSafe: false,
      collapsible: false,
      expanded: true,
    };

    // Convert each root node
    for (const rootNode of rootNodes) {
      const exportNode = await this.convertNode(rootNode);
      if (exportNode) {
        virtualRoot.children.push(exportNode);
      }
    }

    // Apply saved selections
    if (this.savedSelectedIds && this.savedSelectedIds.length > 0) {
      this.applySavedSelections(virtualRoot, new Set(this.savedSelectedIds));
    }

    // Apply safe defaults for first-time users
    if (!this.savedSelectedIds || this.savedSelectedIds.length === 0) {
      this.applySafeDefaults(virtualRoot);
    }

    // Apply saved expanded state
    if (this.savedExpandedIds) {
      this.applySavedExpandedState(virtualRoot, new Set(this.savedExpandedIds));
    }

    // Recalculate counts after applying selections
    const finalCounts = this.calculateCounts(virtualRoot);

    this.logger.debug("ExportTreeScanner: Scan complete", {
      totalCount: finalCounts.totalCount,
      selectedCount: finalCounts.selectedCount,
    });

    return {
      tree: virtualRoot,
      totalCount: finalCounts.totalCount,
      selectedCount: finalCounts.selectedCount,
    };
  }

  /**
   * Convert a NodeData to ExportTreeNode recursively
   */
  private async convertNode(node: NodeData): Promise<ExportTreeNode | null> {
    // Skip error nodes
    if (node.type === ("error" as NodeType)) {
      return null;
    }

    // Check if this is a safe directory/file
    const isSafe = this.isSafeNode(node);

    const exportNode: ExportTreeNode = {
      id: node.id,
      name: node.label,
      type: this.mapNodeType(node.type),
      path: node.path ?? "",
      children: [],
      selectionState: isSafe ? "selected" : "unselected",
      isSafe,
      collapsible: node.collapsibleState > 0,
      expanded: node.collapsibleState === 2,
    };

    // Get children if this is a directory
    if (node.type === ("directory" as NodeType) || node.collapsibleState > 0) {
      try {
        const children = await this.unifiedProvider.getChildren(node);
        for (const child of children) {
          const exportChild = await this.convertNode(child);
          if (exportChild) {
            exportNode.children.push(exportChild);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to get children for ${node.label}`, error as Error);
      }
    }

    return exportNode;
  }

  /**
   * Map NodeType to export node type
   */
  private mapNodeType(nodeType: NodeType): "directory" | "file" {
    if (nodeType === ("directory" as NodeType)) {
      return "directory";
    }
    return "file";
  }

  /**
   * Check if a node is a safe default (AI tool related)
   */
  private isSafeNode(node: NodeData): boolean {
    const name = node.label.toLowerCase();

    // Check safe directory names
    for (const safeDir of SAFE_DIR_NAMES) {
      if (name.includes(safeDir.toLowerCase())) {
        return true;
      }
    }

    // Check if inside a safe directory
    if (node.path !== undefined && node.path !== "") {
      const pathLower = node.path.toLowerCase();
      for (const safeDir of SAFE_DIR_NAMES) {
        if (
          pathLower.includes(`/${safeDir.toLowerCase()}`) ||
          pathLower.includes(`\\${safeDir.toLowerCase()}`)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate total and selected file counts
   */
  private calculateCounts(node: ExportTreeNode): { totalCount: number; selectedCount: number } {
    let totalCount = 0;
    let selectedCount = 0;

    function count(n: ExportTreeNode): void {
      if (n.type === "file") {
        totalCount++;
        if (n.selectionState === "selected") {
          selectedCount++;
        }
      }
      n.children.forEach(count);
    }

    node.children.forEach(count);

    return { totalCount, selectedCount };
  }

  /**
   * Apply saved selections to the tree
   */
  private applySavedSelections(node: ExportTreeNode, savedIds: Set<string>): void {
    if (savedIds.has(node.id)) {
      node.selectionState = "selected";
    } else {
      node.selectionState = "unselected";
    }

    // Recursively apply to children
    node.children.forEach((child) => {
      this.applySavedSelections(child, savedIds);
    });

    // Update parent state based on children
    if (node.children.length > 0) {
      this.updateParentSelectionState(node);
    }
  }

  /**
   * Update parent selection state based on children
   */
  private updateParentSelectionState(node: ExportTreeNode): void {
    const allSelected = node.children.every((c) => c.selectionState === "selected");
    const noneSelected = node.children.every((c) => c.selectionState === "unselected");

    if (allSelected) {
      node.selectionState = "selected";
    } else if (noneSelected) {
      node.selectionState = "unselected";
    } else {
      node.selectionState = "indeterminate";
    }
  }

  /**
   * Apply safe defaults for first-time users
   */
  private applySafeDefaults(node: ExportTreeNode): void {
    function apply(n: ExportTreeNode): void {
      // If node is safe, select it and all its descendants
      if (n.isSafe) {
        n.selectionState = "selected";
        n.children.forEach((child) => {
          child.selectionState = "selected";
          apply(child);
        });
      } else {
        // For non-safe nodes, check if any children are safe
        n.children.forEach((child) => {
          apply(child);
        });

        const hasSafeChild = n.children.some(
          (child) => child.selectionState === "selected" || child.selectionState === "indeterminate"
        );

        if (hasSafeChild) {
          n.selectionState = "indeterminate";
        } else {
          n.selectionState = "unselected";
        }
      }
    }

    node.children.forEach(apply);
  }

  /**
   * Apply saved expanded state
   */
  private applySavedExpandedState(node: ExportTreeNode, expandedIds: Set<string>): void {
    if (expandedIds.has(node.id)) {
      node.expanded = true;
    } else if (node.id !== "root") {
      // Don't collapse root
      node.expanded = false;
    }

    node.children.forEach((child) => {
      this.applySavedExpandedState(child, expandedIds);
    });
  }
}
