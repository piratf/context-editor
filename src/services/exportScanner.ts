/**
 * ExportScanner - 扫描节点树生成导出计划
 *
 * 不执行任何 I/O 操作，仅生成描述导出内容的数据结构。
 *
 * 职责：
 * - 遍历节点树
 * - 应用导出规则
 * - 生成 ExportPlan
 *
 * 导出规则：
 * - VIRTUAL 节点 → 创建固定目录（global/projects）+ 遍历子节点
 * - PROJECT 节点 → 创建目录 + 遍历过滤后的子节点
 * - DIRECTORY 节点 → 添加目录条目 + 停止递归（批量复制）
 * - FILE 节点 → 添加文件条目 + 停止递归
 */

import type { NodeData } from "../types/nodeData.js";
import { NodeTypeGuard, NodeCategory } from "../types/nodeData.js";
import type { ExportPlan, ExportDirectory, ExportFile } from "../types/export.js";
import type { NodeService } from "./nodeService.js";
import { ExportPathCalculator } from "./exportPathCalculator.js";

/**
 * Provider interface for getting children of any node type
 *
 * This interface abstracts the ability to get children for different node types.
 * VIRTUAL nodes require special handling (provider-specific logic),
 * while DIRECTORY/PROJECT nodes can use NodeService.
 */
export interface NodeChildrenProvider {
  /**
   * Get children for any node type
   *
   * @param element - Node to get children for (undefined = root level)
   * @returns Array of child nodes
   */
  getChildren(element?: NodeData): Promise<NodeData[]>;
}

/**
 * ExportScanner - 扫描节点树生成导出计划
 *
 * 不执行任何 I/O 操作，仅生成描述导出内容的数据结构。
 * 完全可测试（无需 mock 文件系统）。
 *
 * 对于 VIRTUAL 节点，使用 NodeChildrenProvider 的特殊逻辑。
 * 对于 DIRECTORY/PROJECT 节点，使用 NodeService 的文件系统读取。
 */
export class ExportScanner {
  constructor(
    private readonly nodeService: NodeService,
    private readonly pathCalculator: ExportPathCalculator,
    private readonly provider?: NodeChildrenProvider
  ) {}

  /**
   * 从根节点扫描生成导出计划
   *
   * @param rootNodes - 根节点列表（Global Configuration, Projects）
   * @param provider - 可选的 Provider，用于处理 VIRTUAL 节点的子节点
   * @returns 导出计划
   */
  async scan(rootNodes: readonly NodeData[], provider?: NodeChildrenProvider): Promise<ExportPlan> {
    const directoriesToCreate: ExportDirectory[] = [];
    const filesToCopy: ExportFile[] = [];

    for (const rootNode of rootNodes) {
      await this.scanNode(
        rootNode,
        directoriesToCreate,
        filesToCopy,
        rootNode.category ?? NodeCategory.GLOBAL,
        "",
        provider
      );
    }

    return {
      directoriesToCreate,
      filesToCopy,
      metadata: {
        timestamp: Date.now(),
        sourceRoots: rootNodes.map((n) => (n.path !== undefined ? n.path : "")).filter(Boolean),
      },
    };
  }

  /**
   * 扫描单个节点
   *
   * 规则：
   * - VIRTUAL 节点 → 创建固定目录 + 遍历子节点
   * - PROJECT 节点 → 创建目录 + 遍历过滤后的子节点
   * - DIRECTORY 节点 → 添加目录条目 + 停止递归
   * - FILE 节点 → 添加文件条目 + 停止递归
   *
   * @param node - 要扫描的节点
   * @param directories - 目录列表（累积）
   * @param files - 文件列表（累积）
   * @param category - 当前类别
   * @param projectName - 当前项目名称
   * @param provider - 可选的 Provider，用于处理 VIRTUAL 节点的子节点
   */
  private async scanNode(
    node: NodeData,
    directories: ExportDirectory[],
    files: ExportFile[],
    category: NodeCategory,
    projectName: string,
    provider?: NodeChildrenProvider
  ): Promise<void> {
    // 规则 1: VIRTUAL 节点 - 创建固定目录 + 遍历子节点
    if (NodeTypeGuard.isVirtual(node.type)) {
      // 使用 node.category 作为目录名（使用 NodeCategory 枚举）
      const virtualCategory = node.category ?? category;

      // 为 VIRTUAL 节点创建目录条目
      directories.push({
        srcAbsPath: "", // VIRTUAL 节点无源路径
        dstRelativePath: virtualCategory, // 从节点获取类别名
        label: virtualCategory,
        category: virtualCategory,
        projectName: "",
      });

      // 遍历子节点 - 使用 Provider 的特殊逻辑处理 VIRTUAL 节点
      const effectiveProvider = provider ?? this.provider;
      let children: NodeData[];
      if (effectiveProvider !== undefined) {
        // 使用 Provider 的 getChildren 方法处理 VIRTUAL 节点
        children = await effectiveProvider.getChildren(node);
      } else {
        // 后备方案：尝试使用 NodeService（可能会失败，因为 VIRTUAL 节点没有 path）
        const result = await this.nodeService.getChildrenForDirectoryNode(node);
        if (result.success) {
          // 使用展开操作符避免 readonly 问题
          children = [...result.children];
        } else {
          children = [];
        }
      }

      for (const child of children) {
        await this.scanNode(child, directories, files, virtualCategory, projectName, provider);
      }
      return;
    }

    // 规则 2: PROJECT 节点 - 创建目录 + 遍历过滤后的子节点
    if (NodeTypeGuard.isProject(node.type)) {
      if (node.path !== undefined) {
        directories.push(this.createDirectoryEntry(node, category, node.label));
      }

      const result = await this.nodeService.getChildrenForDirectoryNode(node);
      if (result.success) {
        for (const child of result.children) {
          await this.scanNode(
            child,
            directories,
            files,
            NodeCategory.PROJECTS,
            node.label,
            provider
          );
        }
      }
      return;
    }

    // 规则 3: DIRECTORY 节点 - 添加目录条目，停止递归
    if (NodeTypeGuard.isDirectory(node.type)) {
      if (node.path !== undefined) {
        directories.push(this.createDirectoryEntry(node, category, projectName));
      }
      return; // 停止递归 - ExportExecutor 会批量复制整个目录
    }

    // 规则 4: FILE 节点 - 添加文件条目，停止递归
    if (NodeTypeGuard.isFile(node.type) && node.path !== undefined) {
      files.push(this.createFileEntry(node, category, projectName));
    }
  }

  /**
   * 创建目录条目
   */
  private createDirectoryEntry(
    node: NodeData,
    category: NodeCategory,
    projectName: string
  ): ExportDirectory {
    const nodePath = node.path;
    if (nodePath === undefined) {
      throw new Error(`Directory node "${node.label}" has no path`);
    }
    const dstRelativePath = this.pathCalculator.calculateFromNode(node, category, projectName);

    return {
      srcAbsPath: nodePath,
      dstRelativePath,
      label: node.label,
      category,
      projectName,
    };
  }

  /**
   * 创建文件条目
   */
  private createFileEntry(node: NodeData, category: NodeCategory, projectName: string): ExportFile {
    const nodePath = node.path;
    if (nodePath === undefined) {
      throw new Error(`File node "${node.label}" has no path`);
    }
    const dstRelativePath = this.pathCalculator.calculateFromNode(node, category, projectName);

    return {
      srcAbsPath: nodePath,
      dstRelativePath,
      type: node.type,
      label: node.label,
      category,
      projectName,
    };
  }
}
