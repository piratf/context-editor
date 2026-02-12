/**
 * ExportExecutor - 执行导出计划
 *
 * 执行导出计划：创建目录 + 复制文件。
 * 不了解节点树结构，只执行计划。
 *
 * 职责：
 * - 创建目录结构
 * - 复制文件
 * - 报告执行结果
 */

import * as path from "node:path";
import type { ExportPlan, ExportResult, ExportFailure } from "../types/export.js";
import type { FileAccessService } from "./fileAccessService.js";
import type { Progress } from "../adapters/progress.js";

/**
 * 导出执行器接口
 *
 * 执行导出计划：创建目录 + 复制文件
 */
export interface ExportExecutor {
  /**
   * 执行导出计划
   *
   * @param plan - 导出计划
   * @param dstAbsDir - 目标导出目录（绝对路径）
   * @param progress - 可选的进度报告器
   * @returns 执行结果
   */
  execute(plan: ExportPlan, dstAbsDir: string, progress?: Progress): Promise<ExportResult>;
}

/**
 * 文件系统导出执行器
 *
 * 使用 node:fs/promises 直接执行文件操作。
 */
export class FsExportExecutor implements ExportExecutor {
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(_fileAccess: FileAccessService) {
    // Parameter accepted for API compatibility but intentionally unused
    // FsExportExecutor uses node:fs/promises directly
  }

  /**
   * 执行导出计划
   *
   * 分三个阶段：
   * 1. 创建所有空目录
   * 2. 递归复制所有目录
   * 3. 复制所有文件
   *
   * @param plan - 导出计划
   * @param dstAbsDir - 目标导出目录（绝对路径）
   * @param progress - 可选的进度报告器
   * @returns 执行结果
   */
  async execute(plan: ExportPlan, dstAbsDir: string, progress?: Progress): Promise<ExportResult> {
    const failures: ExportFailure[] = [];
    let directoriesCreatedCount = 0;
    let directoriesCopiedCount = 0;
    let filesCopiedCount = 0;

    // 计算总操作数，用于增量进度
    const totalOperations =
      plan.directoriesToCreate.length + plan.directoriesToCopy.length + plan.filesToCopy.length;

    let currentOperation = 0;
    const reportProgress = (message: string): void => {
      currentOperation++;
      const increment = totalOperations > 0 ? (1 / totalOperations) * 100 : 0;
      progress?.report(
        `${message} (${String(currentOperation)}/${String(totalOperations)})`,
        increment
      );
    };

    // 阶段 1: 创建所有空目录
    for (const dir of plan.directoriesToCreate) {
      const dstAbsPath = path.join(dstAbsDir, dir.dstRelativePath);

      // 跳过 VIRTUAL 节点的空路径
      if (dir.srcAbsPath === "" && dir.dstRelativePath === dir.category.valueOf()) {
        // 这是 VIRTUAL 节点的占位目录，不需要创建
        directoriesCreatedCount++;
        reportProgress("创建目录结构...");
        continue;
      }

      try {
        await this.createDirectory(dstAbsPath);
        directoriesCreatedCount++;
        reportProgress("创建目录结构...");
      } catch (error) {
        failures.push({
          srcAbsPath: dir.srcAbsPath,
          dstAbsPath,
          error: String(error),
        });
      }
    }

    // 阶段 2: 递归复制所有目录
    for (const dir of plan.directoriesToCopy) {
      const dstAbsPath = path.join(dstAbsDir, dir.dstRelativePath);
      reportProgress(`正在复制目录：${dir.label}`);
      try {
        await this.copyDirectory(dir.srcAbsPath, dstAbsPath);
        directoriesCopiedCount++;
      } catch (error) {
        failures.push({
          srcAbsPath: dir.srcAbsPath,
          dstAbsPath,
          error: String(error),
        });
      }
    }

    // 阶段 3: 复制所有文件
    for (const file of plan.filesToCopy) {
      const dstAbsPath = path.join(dstAbsDir, file.dstRelativePath);
      const fileName = path.basename(file.srcAbsPath);
      reportProgress(`正在复制文件：${fileName}`);
      try {
        // 确保父目录存在
        const parentDir = path.dirname(dstAbsPath);
        await this.createDirectory(parentDir);

        // 复制文件
        const fs = await import("node:fs/promises");
        await fs.copyFile(file.srcAbsPath, dstAbsPath);
        filesCopiedCount++;
      } catch (error) {
        failures.push({
          srcAbsPath: file.srcAbsPath,
          dstAbsPath,
          error: String(error),
        });
      }
    }

    return { directoriesCreatedCount, directoriesCopiedCount, filesCopiedCount, failures };
  }

  /**
   * 创建目录
   */
  async createDirectory(dirPath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * 递归复制目录
   *
   * 使用 fs.cp 递归复制整个目录（包括所有子文件和子目录）
   */
  async copyDirectory(srcAbsPath: string, dstAbsPath: string): Promise<void> {
    const fs = await import("node:fs/promises");
    // 确保父目录存在
    const parentDir = path.dirname(dstAbsPath);
    await this.createDirectory(parentDir);
    // 递归复制目录
    await fs.cp(srcAbsPath, dstAbsPath, { recursive: true });
  }
}
