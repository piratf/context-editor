/**
 * Unit tests for ClaudeCodeRootNodeService
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ClaudeCodeRootNodeService } from "../../services/claudeCodeRootNodeService.js";
import type {
  IEnvironmentManagerService,
  IDataFacade,
  IEnvironmentInfo,
} from "../../services/environmentManagerService.js";
import type { ILoggerService } from "../../services/loggerService.js";
import { NodeType, NodeDataFactory } from "../../types/nodeData.js";

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

// Mock logger
let mockLogCalls: string[] = [];
const mockLogger: ILoggerService = {
  debug: (message: string) => {
    mockLogCalls.push(`[DEBUG] ${message}`);
  },
  info: (message: string) => {
    mockLogCalls.push(`[INFO] ${message}`);
  },
  warn: (message: string) => {
    mockLogCalls.push(`[WARN] ${message}`);
  },
  error: (message: string) => {
    mockLogCalls.push(`[ERROR] ${message}`);
  },
  logEntry: (methodName: string) => {
    mockLogCalls.push(`[ENTRY] ${methodName}`);
  },
  logExit: (methodName: string) => {
    mockLogCalls.push(`[EXIT] ${methodName}`);
  },
  logChildrenRetrieved: (parentLabel: string, count: number) => {
    mockLogCalls.push(`[CHILDREN] parent=${parentLabel} count=${String(count)}`);
  },
};

void describe("ClaudeCodeRootNodeService", () => {
  let mockFacades: IDataFacade[];
  let mockEnvironmentManager: IEnvironmentManagerService;
  let service: ClaudeCodeRootNodeService;

  beforeEach(() => {
    mockFacades = [
      createMockFacade({ type: "windows", configPath: "C:\\\\.claude.json" }),
      createMockFacade({
        type: "wsl",
        configPath: "\\\\wsl\\.Ubuntu\\\\.claude.json",
        instanceName: "Ubuntu",
      }),
    ];

    mockEnvironmentManager = {
      getCurrentFacade: () => mockFacades[0],
      getCurrentEnvironmentName: () => "Windows",
      getAllFacades: () => mockFacades,
      setFacadeByIndex: () => false,
      setFacade: () => {},
      onEnvironmentChanged: () => {},
      showEnvironmentQuickPick: () => Promise.resolve(-1),
    } as unknown as typeof mockEnvironmentManager & { onEnvironmentChanged: never };

    mockLogCalls = [];
    service = new ClaudeCodeRootNodeService(mockEnvironmentManager, mockLogger);
  });

  void describe("createRootNodes", () => {
    void it("should return two root nodes when facade exists", () => {
      const nodes = service.createRootNodes();

      assert.strictEqual(nodes.length, 2);
      assert.strictEqual(nodes[0].label, "Global Configuration");
      assert.strictEqual(nodes[1].label, "Projects");
    });

    void it("should return no environment node when no facade", () => {
      mockEnvironmentManager.getCurrentFacade = () => null;
      const nodes = service.createRootNodes();

      assert.strictEqual(nodes.length, 1);
      assert.strictEqual(nodes[0].label, "No environment selected");
    });
  });

  void describe("getRootNodeChildren", () => {
    void it("should return children for Global Configuration node", () => {
      const rootNode = NodeDataFactory.createVirtualNode("Global Configuration");
      const modifiedNode = { ...rootNode, type: NodeType.USER_ROOT };
      const children = service.getRootNodeChildren(modifiedNode);

      // Wait for promise to resolve
      return children.then((children) => {
        assert.ok(Array.isArray(children));
      });
    });

    void it("should return children for Projects node", () => {
      const rootNode = NodeDataFactory.createVirtualNode("Projects");
      const modifiedNode = { ...rootNode, type: NodeType.PROJECTS_ROOT };
      const children = service.getRootNodeChildren(modifiedNode);

      // Wait for promise to resolve
      return children.then((children) => {
        assert.ok(Array.isArray(children));
      });
    });
  });
});
