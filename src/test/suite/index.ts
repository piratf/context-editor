/**
 * VS Code Extension Test Suite
 * Main entry point for integration tests.
 */

import * as path from "node:path";
import { glob } from "glob";

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = await import("mocha");

  const m = new mocha.default({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, "..");

  const files = await glob("**/**.test.js", { cwd: testsRoot });

  // Add files to the test suite
  for (const f of files) {
    m.addFile(path.resolve(testsRoot, f));
  }

  await new Promise<void>((resolve, reject) => {
    try {
      // Run the mocha test
      m.run((failures: number) => {
        if (failures > 0) {
          reject(new Error(`${String(failures)} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
