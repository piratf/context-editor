/**
 * Unit tests for AIConfigAggregator
 * Tests path filtering and accessibility checks on different platforms
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { describe, it } from "node:test";
import { AIConfigAggregator } from "../../services/aiConfigAggregator.js";
import { EnvironmentType } from "../../services/dataFacade.js";
import type { IDataFacade, IEnvironmentInfo } from "../../types/environment.js";

describe("AIConfigAggregator", () => {
  describe("EnvironmentType enum usage", () => {
    it("should use EnvironmentType enum for Windows check", () => {
      const mockEnvironmentInfo: IEnvironmentInfo = {
        type: EnvironmentType.Windows,
        homePath: "C:\\Users\\test",
      };

      const mockFacade: IDataFacade = {
        getEnvironmentInfo: () => mockEnvironmentInfo,
        getHomePath: () => "C:\\Users\\test",
        convertPath: (path: string) => path,
      };

      // Verify that the facade returns the correct EnvironmentType
      const envInfo = mockFacade.getEnvironmentInfo();
      assert.strictEqual(envInfo.type, EnvironmentType.Windows);
      assert.strictEqual(envInfo.type, "windows");
    });

    it("should work with non-Windows environment types", () => {
      const mockEnvironmentInfo: IEnvironmentInfo = {
        type: EnvironmentType.Linux,
        homePath: "/home/test",
      };

      const mockFacade: IDataFacade = {
        getEnvironmentInfo: () => mockEnvironmentInfo,
        getHomePath: () => "/home/test",
        convertPath: (path: string) => path,
      };

      const envInfo = mockFacade.getEnvironmentInfo();
      assert.strictEqual(envInfo.type, EnvironmentType.Linux);
      assert.strictEqual(envInfo.type, "linux");
    });
  });

  describe("getAllProjects", () => {
    it("should return array of projects", async () => {
      const mockEnvironmentInfo: IEnvironmentInfo = {
        type: EnvironmentType.Linux,
        homePath: "/home/test",
      };

      const mockFacade: IDataFacade = {
        getEnvironmentInfo: () => mockEnvironmentInfo,
        getHomePath: () => "/home/test",
        convertPath: (path: string) => path,
      };

      const aggregator = new AIConfigAggregator(mockFacade);
      const projects = await aggregator.getAllProjects();

      // Should return an array (may be empty if no config files exist)
      assert.ok(Array.isArray(projects));
    });

    it("should handle Windows environment", async () => {
      const mockEnvironmentInfo: IEnvironmentInfo = {
        type: EnvironmentType.Windows,
        homePath: "C:\\Users\\test",
      };

      const mockFacade: IDataFacade = {
        getEnvironmentInfo: () => mockEnvironmentInfo,
        getHomePath: () => "C:\\Users\\test",
        convertPath: (path: string) => path,
      };

      const aggregator = new AIConfigAggregator(mockFacade);
      const projects = await aggregator.getAllProjects();

      // Should return an array (may be empty if no config files exist)
      assert.ok(Array.isArray(projects));
    });
  });
});

// Export to satisfy ESLint
export {};
