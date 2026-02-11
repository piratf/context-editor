/**
 * NodeCollector - Collects file nodes by traversing the node tree
 *
 * This service traverses the node tree using NodeService to collect
 * all file nodes for export operations. It handles both virtual nodes
 * (which are skipped) and real file system nodes.
 *
 * Architecture:
 * - Service layer: Contains business logic for node traversal
 * - Depends on NodeService for getting children
 * - No VS Code imports - completely testable
 */

import * as path from "node:path";
import type { NodeData } from "../types/nodeData.js";
import { NodeType } from "../types/nodeData.js";
import type { NodeService, GetChildrenResult } from "./nodeService.js";

/**
 * File node representation for export
 */
export interface FileNode {
  /** Full path to the file */
  readonly path: string;
  /** Node type */
  readonly type: NodeType.FILE | NodeType.CLAUDE_JSON;
  /** Display label */
  readonly label: string;
  /** Parent directory path (for creating export structure) */
  readonly parentPath: string;
  /** Category: 'global' or 'projects' */
  readonly category: "global" | "projects";
  /** Project name (empty string for global files) */
  readonly projectName: string;
}

/**
 * Result of node collection
 */
export interface CollectionResult {
  /** All collected file nodes */
  readonly files: readonly FileNode[];
  /** Count by category */
  readonly counts: {
    readonly global: number;
    readonly projects: number;
  };
}

/**
 * NodeCollector - traverses node tree to collect file nodes
 */
export class NodeCollector {
  constructor(private readonly nodeService: NodeService) {}

  /**
   * Collect all file nodes from root nodes
   *
   * @param rootNodes - Root nodes to traverse (Global Configuration, Projects)
   * @returns Collection result with all file nodes
   */
  async collectFromRoots(rootNodes: readonly NodeData[]): Promise<CollectionResult> {
    const globalFiles: FileNode[] = [];
    const projectFiles: FileNode[] = [];

    for (const rootNode of rootNodes) {
      if (rootNode.label === "Global Configuration") {
        const files = await this.collectGlobalFiles(rootNode);
        globalFiles.push(...files);
      } else if (rootNode.label === "Projects") {
        const files = await this.collectProjectFiles(rootNode);
        projectFiles.push(...files);
      }
    }

    return {
      files: [...globalFiles, ...projectFiles],
      counts: {
        global: globalFiles.length,
        projects: projectFiles.length,
      },
    };
  }

  /**
   * Collect files from Global Configuration node
   */
  private async collectGlobalFiles(globalNode: NodeData): Promise<FileNode[]> {
    const files: FileNode[] = [];

    // Get children of Global Configuration node
    const childrenResult = await this.getChildren(globalNode);
    if (!childrenResult.success) {
      return files;
    }

    // Traverse each child
    for (const child of childrenResult.children) {
      await this.traverseNode(child, files, "global");
    }

    return files;
  }

  /**
   * Collect files from Projects node
   */
  private async collectProjectFiles(projectsNode: NodeData): Promise<FileNode[]> {
    const files: FileNode[] = [];

    // Get children of Projects node (list of project directories)
    const childrenResult = await this.getChildren(projectsNode);
    if (!childrenResult.success) {
      return files;
    }

    // Traverse each project directory
    for (const projectNode of childrenResult.children) {
      if (
        projectNode.type === NodeType.DIRECTORY &&
        projectNode.path !== undefined &&
        projectNode.path !== ""
      ) {
        // Collect files from this project
        await this.traverseNode(projectNode, files, "projects", projectNode.label);
      }
    }

    return files;
  }

  /**
   * Traverse a node and collect all file nodes
   */
  private async traverseNode(
    node: NodeData,
    files: FileNode[],
    category: "global" | "projects",
    projectName: string = ""
  ): Promise<void> {
    // Skip virtual nodes (no path)
    if (node.path === undefined || node.path === "") {
      // Process children of virtual nodes
      const childrenResult = await this.getChildren(node);
      if (childrenResult.success) {
        for (const child of childrenResult.children) {
          await this.traverseNode(child, files, category, projectName);
        }
      }
      return;
    }

    // File nodes - add to collection
    if (node.type === NodeType.FILE || node.type === NodeType.CLAUDE_JSON) {
      files.push({
        path: node.path,
        type: node.type,
        label: node.label,
        parentPath: path.dirname(node.path),
        category,
        projectName,
      });
      return;
    }

    // Directory nodes - recurse
    if (node.type === NodeType.DIRECTORY) {
      const childrenResult = await this.getChildren(node);
      if (childrenResult.success) {
        for (const child of childrenResult.children) {
          await this.traverseNode(child, files, category, projectName);
        }
      }
    }
  }

  /**
   * Get children for a node using NodeService
   */
  private async getChildren(node: NodeData): Promise<GetChildrenResult> {
    // Only directory nodes can have children
    if (node.type !== NodeType.DIRECTORY && node.type !== NodeType.ROOT) {
      return { success: true, children: [] };
    }

    // Verify the node has a path (directory nodes should have paths)
    if (node.path === undefined || node.path === "") {
      return { success: true, children: [] };
    }

    // At this point we know it's a directory with a path
    const directoryNode = {
      ...node,
      type: NodeType.DIRECTORY,
      path: node.path,
    } as const;

    return await this.nodeService.getChildren(directoryNode);
  }
}
