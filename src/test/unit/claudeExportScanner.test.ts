/**
 * Unit tests for ClaudeExportScanner
 * Tests directory scanning and export plan generation
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { ClaudeExportScanner } from "../../services/claudeExportScanner.js";
import { ExportItemType } from "../../types/exportPlan.js";
import type { FileSystem, FsEntry } from "../../services/fileSystemService.js";

/**
 * Mock implementation of FileSystem for testing
 */
class MockFileSystem implements FileSystem {
  readonly pathSep = "/";
  private directories: Map<string, FsEntry[]> = new Map();

  /**
   * Setup mock directory contents
   */
  setDirectoryContents(dirPath: string, entries: FsEntry[]): void {
    this.directories.set(dirPath, entries);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.directories.clear();
  }

  async readDirectory(dirPath: string): Promise<FsEntry[]> {
    await Promise.resolve();
    const entries = this.directories.get(dirPath);
    if (entries === undefined) {
      throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
    }
    return entries;
  }
}

describe("ClaudeExportScanner", () => {
  const homeDir = "/home/testuser";
  let mockFileSystem: MockFileSystem;
  let scanner: ClaudeExportScanner;

  beforeEach(() => {
    mockFileSystem = new MockFileSystem();
    scanner = new ClaudeExportScanner(homeDir, mockFileSystem);
  });

  describe("scan()", () => {
    it("should return empty categories when all directories are empty", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories.length, 3);
      assert.strictEqual(plan.categories[0].name, "skills");
      assert.strictEqual(plan.categories[0].items.length, 0);
      assert.strictEqual(plan.categories[1].name, "agents");
      assert.strictEqual(plan.categories[1].items.length, 0);
      assert.strictEqual(plan.categories[2].name, "commands");
      assert.strictEqual(plan.categories[2].items.length, 0);
    });

    it("should scan skills directory and return correct items", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "skill1.md", isDirectory: false },
        { name: "skill2.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      const skillsCategory = plan.categories[0];
      assert.strictEqual(skillsCategory.name, "skills");
      assert.strictEqual(skillsCategory.items.length, 2);
      assert.strictEqual(skillsCategory.items[0].type, ExportItemType.SKILL);
      assert.strictEqual(skillsCategory.items[0].name, "skill1.md");
      assert.strictEqual(skillsCategory.items[0].sourcePath, `${homeDir}/skills/skill1.md`);
      assert.strictEqual(skillsCategory.items[1].type, ExportItemType.SKILL);
      assert.strictEqual(skillsCategory.items[1].name, "skill2.md");
      assert.strictEqual(skillsCategory.items[1].sourcePath, `${homeDir}/skills/skill2.md`);
    });

    it("should scan agents directory and return correct items", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, [
        { name: "agent1", isDirectory: true },
        { name: "agent2", isDirectory: true },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      const agentsCategory = plan.categories[1];
      assert.strictEqual(agentsCategory.name, "agents");
      assert.strictEqual(agentsCategory.items.length, 2);
      assert.strictEqual(agentsCategory.items[0].type, ExportItemType.AGENT);
      assert.strictEqual(agentsCategory.items[0].name, "agent1");
      assert.strictEqual(agentsCategory.items[0].sourcePath, `${homeDir}/agents/agent1`);
    });

    it("should scan commands directory and return correct items", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, [
        { name: "command1.sh", isDirectory: false },
      ]);

      const plan = await scanner.scan();

      const commandsCategory = plan.categories[2];
      assert.strictEqual(commandsCategory.name, "commands");
      assert.strictEqual(commandsCategory.items.length, 1);
      assert.strictEqual(commandsCategory.items[0].type, ExportItemType.COMMAND);
      assert.strictEqual(commandsCategory.items[0].name, "command1.sh");
      assert.strictEqual(commandsCategory.items[0].sourcePath, `${homeDir}/commands/command1.sh`);
    });

    it("should scan all three directories and return complete export plan", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "coding-skill.md", isDirectory: false },
        { name: "testing-skill.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, [
        { name: "code-reviewer", isDirectory: true },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, [
        { name: "build.sh", isDirectory: false },
        { name: "test.sh", isDirectory: false },
        { name: "deploy.sh", isDirectory: false },
      ]);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories.length, 3);

      // Verify skills
      assert.strictEqual(plan.categories[0].name, "skills");
      assert.strictEqual(plan.categories[0].items.length, 2);

      // Verify agents
      assert.strictEqual(plan.categories[1].name, "agents");
      assert.strictEqual(plan.categories[1].items.length, 1);

      // Verify commands
      assert.strictEqual(plan.categories[2].name, "commands");
      assert.strictEqual(plan.categories[2].items.length, 3);
    });

    it("should throw error when skills directory does not exist", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      await assert.rejects(async () => await scanner.scan(), {
        message: `ENOENT: no such file or directory, scandir '${homeDir}/skills'`,
      });
    });

    it("should throw error when agents directory does not exist", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      await assert.rejects(async () => await scanner.scan(), {
        message: `ENOENT: no such file or directory, scandir '${homeDir}/agents'`,
      });
    });

    it("should throw error when commands directory does not exist", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);

      await assert.rejects(async () => await scanner.scan(), {
        message: `ENOENT: no such file or directory, scandir '${homeDir}/commands'`,
      });
    });

    it("should handle files with special characters in names", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "skill-with-dash.md", isDirectory: false },
        { name: "skill_with_underscore.md", isDirectory: false },
        { name: "skill.with.dots.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories[0].items.length, 3);
      assert.strictEqual(plan.categories[0].items[0].name, "skill-with-dash.md");
      assert.strictEqual(plan.categories[0].items[1].name, "skill_with_underscore.md");
      assert.strictEqual(plan.categories[0].items[2].name, "skill.with.dots.md");
    });

    it("should handle mixed files and directories in a category", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "file-skill.md", isDirectory: false },
        { name: "folder-skill", isDirectory: true },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories[0].items.length, 2);
      // Both should be included regardless of isDirectory flag
      assert.strictEqual(plan.categories[0].items[0].name, "file-skill.md");
      assert.strictEqual(plan.categories[0].items[1].name, "folder-skill");
    });
  });

  describe("constructor", () => {
    it("should create scanner with custom home directory", () => {
      const customHome = "/custom/home";
      const customScanner = new ClaudeExportScanner(customHome, mockFileSystem);

      assert.ok(customScanner instanceof ClaudeExportScanner);
    });

    it("should accept different home directory paths", async () => {
      const windowsHome = "C:\\Users\\testuser";
      const windowsScanner = new ClaudeExportScanner(windowsHome, mockFileSystem);

      mockFileSystem.setDirectoryContents(`${windowsHome}/skills`, [
        { name: "test.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${windowsHome}/agents`, []);
      mockFileSystem.setDirectoryContents(`${windowsHome}/commands`, []);

      const plan = await windowsScanner.scan();

      assert.strictEqual(plan.categories[0].items[0].sourcePath, `${windowsHome}/skills/test.md`);
    });
  });

  describe("ExportPlan structure", () => {
    it("should return readonly categories array", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      assert.ok(Array.isArray(plan.categories));
      assert.strictEqual(plan.categories.length, 3);
    });

    it("should return categories in correct order: skills, agents, commands", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "skill.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, [
        { name: "agent", isDirectory: true },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, [
        { name: "command.sh", isDirectory: false },
      ]);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories[0].name, "skills");
      assert.strictEqual(plan.categories[1].name, "agents");
      assert.strictEqual(plan.categories[2].name, "commands");
    });

    it("should preserve file order from directory listing", async () => {
      mockFileSystem.setDirectoryContents(`${homeDir}/skills`, [
        { name: "alpha.md", isDirectory: false },
        { name: "beta.md", isDirectory: false },
        { name: "gamma.md", isDirectory: false },
      ]);
      mockFileSystem.setDirectoryContents(`${homeDir}/agents`, []);
      mockFileSystem.setDirectoryContents(`${homeDir}/commands`, []);

      const plan = await scanner.scan();

      assert.strictEqual(plan.categories[0].items[0].name, "alpha.md");
      assert.strictEqual(plan.categories[0].items[1].name, "beta.md");
      assert.strictEqual(plan.categories[0].items[2].name, "gamma.md");
    });
  });
});

// Export to satisfy ESLint
export {};
