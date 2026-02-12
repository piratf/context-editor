/**
 * Export/Import Type Definitions
 *
 * Pure data interfaces for export/import operations.
 * These types describe the structure of exported data without
 * depending on any external services or VS Code APIs.
 */

import type { NodeType } from "./nodeData.js";
import { NodeCategory } from "./nodeData.js";

/**
 * 导出计划 - 描述要导出的目录和文件
 *
 * ExportPlan 是纯数据结构，不包含任何逻辑。
 * 它由 ExportScanner 生成，由 ExportExecutor 执行。
 */
export interface ExportPlan {
  /** 要创建的空目录列表 */
  readonly directoriesToCreate: readonly ExportDirectory[];
  /** 要递归复制的目录列表（包括所有子文件和子目录） */
  readonly directoriesToCopy: readonly ExportDirectoryToCopy[];
  /** 要复制的文件列表 */
  readonly filesToCopy: readonly ExportFile[];
  /** 元数据 */
  readonly metadata: ExportMetadata;
}

/**
 * 导出元数据
 */
export interface ExportMetadata {
  /** 时间戳 */
  readonly timestamp: number;
  /** 源根目录列表 */
  readonly sourceRoots: readonly string[];
}

/**
 * 要创建的导出目录
 */
export interface ExportDirectory {
  /** 源目录绝对路径 */
  readonly srcAbsPath: string;
  /** 目标目录相对路径（相对于导出根目录） */
  readonly dstRelativePath: string;
  /** 目录标签（用于显示） */
  readonly label: string;
  /** 类别（从 NodeData.category 获取） */
  readonly category: NodeCategory;
  /** 项目名称（global 为空字符串） */
  readonly projectName: string;
}

/**
 * 要递归复制的导出目录
 */
export interface ExportDirectoryToCopy {
  /** 源目录绝对路径 */
  readonly srcAbsPath: string;
  /** 目标目录相对路径（相对于导出根目录） */
  readonly dstRelativePath: string;
  /** 目录标签（用于显示） */
  readonly label: string;
  /** 类别（从 NodeData.category 获取） */
  readonly category: NodeCategory;
  /** 项目名称 */
  readonly projectName: string;
}

/**
 * 要复制的导出文件
 */
export interface ExportFile {
  /** 源文件绝对路径 */
  readonly srcAbsPath: string;
  /** 目标文件相对路径（相对于导出根目录） */
  readonly dstRelativePath: string;
  /** 文件类型 */
  readonly type: NodeType;
  /** 文件标签 */
  readonly label: string;
  /** 类别（从 NodeData.category 获取） */
  readonly category: NodeCategory;
  /** 项目名称 */
  readonly projectName: string;
}

/**
 * 导出执行结果
 */
export interface ExportResult {
  /** 成功创建的目录数 */
  readonly directoriesCreatedCount: number;
  /** 成功递归复制的目录数 */
  readonly directoriesCopiedCount: number;
  /** 成功复制的文件数 */
  readonly filesCopiedCount: number;
  /** 失败的操作 */
  readonly failures: readonly ExportFailure[];
}

/**
 * 导出失败详情
 */
export interface ExportFailure {
  /** 源绝对路径 */
  readonly srcAbsPath: string;
  /** 目标绝对路径 */
  readonly dstAbsPath: string;
  /** 错误信息 */
  readonly error: string;
}
