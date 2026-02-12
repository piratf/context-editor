/**
 * Unit tests for EnvironmentManagerService
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  EnvironmentManagerService,
  type IEnvironmentManagerService,
  type EnvironmentChangeEvent,
} from "../../services/environmentManagerService.js";
import type { IDataFacade, IEnvironmentInfo } from "../../services/environmentManagerService.js";

// Mock facade factory
function createMockFacade(info: IEnvironmentInfo): IDataFacade {
  return {
    getEnvironmentInfo: () => info,
    getProjects: () => Promise.resolve([]),
    getGlobalConfig: () => Promise.resolve({}),
    refresh: () => Promise.resolve(),
    isAccessible: () => true,
    getConfigPath: () => info.configPath,
  };
}

void describe("EnvironmentManagerService", () => {
  let mockFacades: IDataFacade[];
  let mockUserInteraction: {
    showInformationMessage: (msg: string) => Promise<void>;
    showQuickPick: (
      items: readonly { label: string; description: string; data: unknown }[],
      options: { title: string; placeHolder: string }
    ) => Promise<{ label: string; description: string; data: unknown } | undefined>;
    writeText: (text: string) => Promise<void>;
    onEnvironmentChanged: (cb: (event: EnvironmentChangeEvent) => void) => void;
  };
  let service: IEnvironmentManagerService;

  beforeEach(() => {
    mockFacades = [
      createMockFacade({ type: "windows", configPath: "C:\\\\.claude.json" }),
      createMockFacade({
        type: "wsl",
        configPath: "\\\\wsl\\.Ubuntu\\\\.claude.json",
        instanceName: "Ubuntu",
      }),
    ];

    mockUserInteraction = {
      showInformationMessage: () => Promise.resolve(),
      showQuickPick: () => Promise.resolve(undefined),
      writeText: () => Promise.resolve(),
      onEnvironmentChanged: () => {},
    };

    service = new EnvironmentManagerService(mockFacades, mockUserInteraction);
  });

  void describe("getCurrentFacade", () => {
    void it("should return first facade by default", () => {
      const facade = service.getCurrentFacade();
      assert.ok(facade !== null);
      assert.strictEqual(facade.getEnvironmentInfo().type, "windows");
    });

    void it("should return null when no facades available", () => {
      const emptyService = new EnvironmentManagerService([], mockUserInteraction);

      const facade = emptyService.getCurrentFacade();
      assert.strictEqual(facade, null);
    });
  });

  void describe("getCurrentEnvironmentName", () => {
    void it("should return Windows for windows facade", () => {
      const name = service.getCurrentEnvironmentName();
      assert.strictEqual(name, "Windows");
    });

    void it("should return WSL (Ubuntu) for wsl facade with instance", () => {
      // Set to WSL facade
      service.setFacadeByIndex(1);

      const name = service.getCurrentEnvironmentName();
      assert.strictEqual(name, "WSL (Ubuntu)");
    });
  });

  void describe("getAllFacades", () => {
    void it("should return all facades", () => {
      const facades = service.getAllFacades();
      assert.strictEqual(facades.length, 2);
    });
  });

  void describe("setFacadeByIndex", () => {
    void it("should set facade by index", () => {
      const result = service.setFacadeByIndex(1);
      assert.strictEqual(result, true);

      const facade = service.getCurrentFacade();
      assert.strictEqual(facade?.getEnvironmentInfo().type, "wsl");
    });

    void it("should return false for invalid index", () => {
      const result = service.setFacadeByIndex(10);
      assert.strictEqual(result, false);
    });
  });

  void describe("setFacade", () => {
    void it("should set facade directly", () => {
      const newFacade = createMockFacade({ type: "linux", configPath: "/home/.claude.json" });
      service.setFacade(newFacade);

      const facade = service.getCurrentFacade();
      assert.strictEqual(facade?.getEnvironmentInfo().type, "linux");
    });
  });
});
