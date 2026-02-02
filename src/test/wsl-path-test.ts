/**
 * Test script to verify WSL path access from Windows Node.js
 */

import * as fs from "node:fs/promises";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function testWslAccess(): Promise<void> {
  console.log("=== WSL Path Access Test ===\n");

  // 1. Get WSL distribution list
  console.log("1. Testing WSL distribution detection...");
  try {
    const { stdout } = await execAsync("wsl -l -q", { timeout: 5000 });
    const distros = stdout.trim().split("\n").filter((line) => line.trim().length > 0);

    console.log(`   Found ${distros.length} WSL distribution(s):`);
    distros.forEach((d: string) => console.log(`   - ${d}`));

    if (distros.length === 0) {
      results.push({ name: "WSL Detection", success: false, error: "No WSL distributions found" });
      printResults();
      return;
    }

    const distro = distros[0].trim();
    const username = os.userInfo().username;

    results.push({
      name: "WSL Detection",
      success: true,
      details: `Found distro: ${distro}, username: ${username}`
    });

    // Test different path formats
    const testPaths = [
      {
        name: "Legacy UNC Path (\\\\wsl$\\...)",
        path: `\\\\wsl$\\${distro}\\home\\${username}`
      },
      {
        name: "Windows 11 UNC Path (\\\\wsl.localhost\\...)",
        path: `\\\\wsl.localhost\\${distro}\\home\\${username}`
      },
      {
        name: "Legacy UNC Path with .claude.json",
        path: `\\\\wsl$\\${distro}\\home\\${username}\\.claude.json`
      },
      {
        name: "Windows 11 UNC Path with .claude.json",
        path: `\\\\wsl.localhost\\${distro}\\home\\${username}\\.claude.json`
      }
    ];

    for (const test of testPaths) {
      console.log(`\n2.${results.length - 1}. Testing ${test.name}...`);
      console.log(`   Path: ${test.path}`);

      try {
        // Test directory access
        const stats = await fs.stat(test.path);
        console.log(`   ✓ Directory exists (${stats.isDirectory() ? "directory" : "file"})`);

        // Try to list directory contents
        const entries = await fs.readdir(test.path);
        console.log(`   ✓ Can read directory (${entries.length} entries)`);

        results.push({
          name: test.name,
          success: true,
          details: `Accessible, ${entries.length} entries found`
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`   ✗ Failed: ${errorMsg}`);
        results.push({
          name: test.name,
          success: false,
          error: errorMsg
        });
      }
    }

    // 3. Test using wsl command as fallback
    console.log(`\n2.${results.length - 1}. Testing WSL command access...`);
    const wslInternalPath = `/home/${username}/.claude.json`;
    console.log(`   Using: wsl cat "${wslInternalPath}"`);

    try {
      const { stdout } = await execAsync(`wsl cat "${wslInternalPath}"`, { timeout: 5000 });
      if (stdout.trim().length > 0) {
        console.log(`   ✓ WSL command works, found ${stdout.length} bytes`);
        results.push({
          name: "WSL Command Access",
          success: true,
          details: `File exists and readable (${stdout.length} bytes)`
        });
      } else {
        console.log(`   ✗ File is empty or doesn't exist`);
        results.push({
          name: "WSL Command Access",
          success: false,
          error: "File is empty or doesn't exist"
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ✗ Failed: ${errorMsg}`);
      results.push({
        name: "WSL Command Access",
        success: false,
        error: errorMsg
      });
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`   ✗ Failed to detect WSL: ${errorMsg}`);
    results.push({
      name: "WSL Detection",
      success: false,
      error: errorMsg
    });
  }

  printResults();
}

function printResults(): void {
  console.log("\n=== Test Results ===");
  let successCount = 0;

  results.forEach((result) => {
    const status = result.success ? "✓" : "✗";
    const details = result.details ? ` (${result.details})` : "";
    const error = result.error ? ` - ${result.error}` : "";
    console.log(`${status} ${result.name}${details}${error}`);
    if (result.success) successCount++;
  });

  console.log(`\nSummary: ${successCount}/${results.length} tests passed`);
}

testWslAccess().catch((error) => {
  console.error("Test failed with unexpected error:", error);
  process.exit(1);
});
