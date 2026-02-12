/**
 * Unit tests for FsExportExecutor
 *
 * 测试 FsExportExecutor 的导出执行逻辑。
 * 使用临时目录和真实 fs 操作进行测试。
 */

/* eslint-disable @typescript-eslint/restrict-template-expressions */
import { strict as assert } from "node:assert";
import { test, describe, before, after } from "node:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import { FsExportExecutor } from "../../services/exportExecutor.js";

// Helper function to create a directory for testing
async function createDirectory(dirPath: string): Promise<void> {
  const fs = await import("node:fs/promises");
  await fs.mkdir(dirPath, { recursive: true });
}
import type { ExportPlan } from "../../types/export.js";
import { NodeCategory } from "../../types/nodeData.js";
import { NodeType } from "../../types/nodeData.js";
import { FileAccessService } from "../../services/fileAccessService.js";

let tempDir: string;
let mockFileAccess: FileAccessService;

before(async () => {
  const timestamp = Date.now();
  tempDir = `${os.tmpdir()}/export-executor-test-${timestamp}`;
  await fs.mkdir(tempDir, { recursive: true });
  mockFileAccess = new FileAccessService();
});

void describe("FsExportExecutor", () => {
  void test("execute should create directories and copy files", async () => {
    const testDir = `${tempDir}/test1`;
    await fs.mkdir(testDir, { recursive: true });

    // Create source file
    const srcFile = `${testDir}/source.txt`;
    await fs.writeFile(srcFile, "test content");

    const plan: ExportPlan = {
      directoriesToCreate: [
        {
          srcAbsPath: `${testDir}/subdir`,
          dstRelativePath: "global/subdir",
          label: "subdir",
          category: NodeCategory.GLOBAL,
          projectName: "",
        },
      ],
      filesToCopy: [
        {
          srcAbsPath: srcFile,
          dstRelativePath: "global/source.txt",
          type: NodeType.FILE,
          label: "source.txt",
          category: NodeCategory.GLOBAL,
          projectName: "",
        },
      ],

      metadata: {
        timestamp: Date.now(),
        sourceRoots: [],
      },
    };

    const executor = new FsExportExecutor(mockFileAccess);
    const result = await executor.execute(plan, testDir);

    assert.equal(result.directoriesCreatedCount, 1);
    assert.equal(result.filesCopiedCount, 1);
    assert.equal(result.failures.length, 0);

    // Verify results
    assert.ok((await fs.stat(`${testDir}/global/subdir`)).isDirectory());
    assert.ok((await fs.stat(`${testDir}/global/source.txt`)).isFile());
  });

  void test("execute should handle VIRTUAL node directories", async () => {
    const testDir = `${tempDir}/test2`;
    await fs.mkdir(testDir, { recursive: true });

    const plan: ExportPlan = {
      directoriesToCreate: [
        {
          srcAbsPath: "", // VIRTUAL 节点
          dstRelativePath: "global",
          label: "global",
          category: NodeCategory.GLOBAL,
          projectName: "",
        },
      ],
      filesToCopy: [],
      metadata: {
        timestamp: Date.now(),
        sourceRoots: [],
      },
    };

    const executor = new FsExportExecutor(mockFileAccess);
    const result = await executor.execute(plan, testDir);

    assert.equal(result.directoriesCreatedCount, 1);
  });

  void test("execute should create parent directories for files", async () => {
    const testDir = `${tempDir}/test3`;
    await fs.mkdir(testDir, { recursive: true });

    // Create source file
    const srcFile = `${testDir}/source.txt`;
    await fs.writeFile(srcFile, "test content");

    const plan: ExportPlan = {
      directoriesToCreate: [],
      filesToCopy: [
        {
          srcAbsPath: srcFile,
          dstRelativePath: "projects/test-project/file.txt",
          type: NodeType.FILE,
          label: "file.txt",
          category: NodeCategory.PROJECTS,
          projectName: "test-project",
        },
      ],

      metadata: {
        timestamp: Date.now(),
        sourceRoots: [],
      },
    };

    const executor = new FsExportExecutor(mockFileAccess);
    const result = await executor.execute(plan, testDir);

    assert.equal(result.filesCopiedCount, 1);
    assert.ok((await fs.stat(`${testDir}/projects/test-project/file.txt`)).isFile());
  });

  void test("execute should record failures", async () => {
    const testDir = `${tempDir}/test4`;
    await fs.mkdir(testDir, { recursive: true });

    // Create a file that will fail to copy (source doesn't exist)
    const plan: ExportPlan = {
      directoriesToCreate: [],
      filesToCopy: [
        {
          srcAbsPath: `${testDir}/nonexistent.txt`,
          dstRelativePath: "global/nonexistent.txt",
          type: NodeType.FILE,
          label: "nonexistent.txt",
          category: NodeCategory.GLOBAL,
          projectName: "",
        },
      ],

      metadata: {
        timestamp: Date.now(),
        sourceRoots: [],
      },
    };

    const executor = new FsExportExecutor(mockFileAccess);
    const result = await executor.execute(plan, testDir);

    assert.equal(result.filesCopiedCount, 0);
    assert.equal(result.failures.length, 1);
  });
});

void describe("createDirectory", () => {
  void test("should create directory recursively", async () => {
    const testPath = `${tempDir}/test-create-dir`;
    await createDirectory(testPath);

    assert.ok((await fs.stat(testPath)).isDirectory());
  });
});

// Cleanup temporary directory after all tests
after(async () => {
  if (tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});
