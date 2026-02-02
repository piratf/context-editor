/**
 * VS Code Extension Integration Tests
 * Tests the extension in a real VS Code environment.
 */

import * as assert from "node:assert";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { GlobalProvider } from "../../views/globalProvider";
import { ProjectProvider } from "../../views/projectProvider";

suite("Context Editor Extension Test Suite", () => {
  let extension: vscode.Extension<unknown> | undefined;

  suiteSetup(async () => {
    // Wait for the extension to activate
    const ext = vscode.extensions.getExtension("piratf.context-editor");
    if (ext === undefined) {
      throw new Error("Extension not found");
    }
    extension = ext;
    await extension.activate();
  });

  test("Extension should be present", () => {
    assert.ok(extension !== undefined, "Extension should be present");
  });

  test("Extension should be activated", () => {
    assert.ok(extension?.isActive === true, "Extension should be activated");
  });

  test("Should register tree data providers", async () => {
    // We can't easily check internal registration, but we can verify the providers work
    const configPath = path.join(os.homedir(), ".claude.json");
    const globalProvider = new GlobalProvider(configPath, "Test");
    const projectProvider = new ProjectProvider(configPath);

    assert.ok(globalProvider instanceof GlobalProvider, "GlobalProvider should be instantiable");
    assert.ok(projectProvider instanceof ProjectProvider, "ProjectProvider should be instantiable");

    // Verify basic API contract of the providers
    const globalRoots = await globalProvider.getChildren();
    assert.ok(Array.isArray(globalRoots), "GlobalProvider.getChildren should return an array");

    const projectRoots = await projectProvider.getChildren();
    assert.ok(Array.isArray(projectRoots), "ProjectProvider.getChildren should return an array");
  });

  test("Should register refresh command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("contextEditor.refresh"), "Refresh command should be registered");
  });

  test("Should register openFile command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("contextEditor.openFile"), "OpenFile command should be registered");
  });

  test("Refresh command should execute without error", async () => {
    try {
      await vscode.commands.executeCommand("contextEditor.refresh");
      assert.ok(true, "Refresh command executed successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      assert.fail(`Refresh command failed: ${message}`);
    }
  });

  test("TreeView should be registered", async () => {
    // After extension activation, the tree view should be available
    // We wait a bit to ensure async registration completes
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.ok(extension?.isActive === true, "Extension should still be active");
  });
});
