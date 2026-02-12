/**
 * ExportPathCalculator - 计算导出路径
 *
 * 根据 category 和 projectName 生成正确的相对路径结构。
 *
 * 导出目录结构：
 *   export/
 *   ├── global/           ← NodeCategory.GLOBAL
 *   │   ├── .claude.json
 *   │   └── .claude/
 *   └── projects/          ← NodeCategory.PROJECTS
 *       └── <project-name>/
 *           └── .claude/
 */

import * as path from "node:path";
import type { NodeData } from "../types/nodeData.js";
import { NodeCategory } from "../types/nodeData.js";

/**
 * 计算导出路径
 *
 * 根据 category 和 projectName 生成正确的相对路径结构
 */
export class ExportPathCalculator {
  /**
   * 计算相对路径
   *
   * 目录结构：
   *   export/
   *   ├── global/           ← NodeCategory.GLOBAL
   *   │   ├── .claude.json
   *   │   └── .claude/
   *   └── projects/          ← NodeCategory.PROJECTS
   *       └── <project-name>/
   *           └── .claude/
   *
   * @param sourcePath - 源文件/目录路径
   * @param category - 节点类别
   * @param projectName - 项目名称
   * @returns 相对路径（相对于导出根目录）
   */
  calculateRelativePath(sourcePath: string, category: NodeCategory, projectName: string): string {
    const basename = path.basename(sourcePath);

    if (category === NodeCategory.GLOBAL) {
      // Global 文件放在 category 目录中（即 global 目录）
      return path.join(category, basename);
    }

    // Projects 文件放在 projects/<projectName>/ 下
    if (projectName) {
      return path.join("projects", projectName, basename);
    }

    return basename;
  }

  /**
   * 计算目录的相对路径（处理嵌套目录）
   *
   * 对于目录，需要计算相对于项目根目录的路径。
   * 例如：project/.claude/settings.json -> projects/myproject/.claude/settings.json
   *
   * @param dirPath - 目录路径
   * @param projectRootPath - 项目根目录路径
   * @param category - 节点类别
   * @param projectName - 项目名称
   * @returns 相对路径（相对于导出根目录）
   */
  calculateDirectoryRelativePath(
    dirPath: string,
    projectRootPath: string,
    category: NodeCategory,
    projectName: string
  ): string {
    // 计算目录相对于项目根目录的路径
    const relativeToProject = path.relative(projectRootPath, dirPath);

    if (category === NodeCategory.GLOBAL) {
      return path.join(category, relativeToProject);
    }

    if (projectName) {
      return path.join("projects", projectName, relativeToProject);
    }

    return relativeToProject;
  }

  /**
   * 从节点数据计算相对路径
   *
   * 根据节点类型和路径信息，计算导出时的相对路径。
   *
   * @param node - 节点数据
   * @param category - 节点类别
   * @param projectName - 项目名称
   * @returns 相对路径（相对于导出根目录）
   */
  calculateFromNode(node: NodeData, category: NodeCategory, projectName: string): string {
    const nodePath = node.path;
    if (nodePath === undefined) {
      // VIRTUAL 节点没有路径，直接返回类别名
      return category;
    }

    // 对于目录，需要特殊处理
    if (category === NodeCategory.GLOBAL) {
      // Global 文件：找到 .claude.json 或 .claude 目录
      const parts = nodePath.split(/[/\\]/);
      const claudeIndex = parts.findIndex((p) => p === ".claude.json" || p === ".claude");

      if (claudeIndex >= 0) {
        // 从 .claude.json 或 .claude 开始的路径
        const rest = parts.slice(claudeIndex);
        return path.join(category, ...rest);
      }

      // 后备方案：使用文件名
      return path.join(category, path.basename(nodePath));
    }

    // Projects 文件：找到项目标记
    const projectNameNormalized = projectName || "unknown-project";

    // 查找 .claude 目录或 CLAUDE.md
    const parts = nodePath.split(/[/\\]/);
    const claudeIndex = parts.findIndex((p) => p === ".claude");
    const claudeMdIndex = parts.findIndex((p) => p === "CLAUDE.md");

    const startIndex = Math.max(claudeIndex, claudeMdIndex);

    // 从找到的标记开始的路径
    const rest = startIndex < 0 ? parts.slice(parts.length - 1) : parts.slice(startIndex);

    // 特殊处理：当没有找到标记且只有一个元素时，检查是否是项目根目录本身
    // 只有当 rest[0] 就是项目名时，才说明是项目根目录（避免重复拼接项目名）
    if (startIndex < 0 && rest.length === 1 && rest[0] === projectNameNormalized) {
      return path.join("projects", projectNameNormalized);
    }

    return path.join("projects", projectNameNormalized, ...rest);
  }
}
