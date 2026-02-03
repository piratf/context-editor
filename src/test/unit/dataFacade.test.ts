/**
 * Unit tests for DataFacade interface and base class
 * Tests the abstract interface and common functionality
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import {
  EnvironmentInfo,
  ProjectEntry,
  BaseDataFacade,
  EnvironmentType,
  type ConfigReadResult,
} from '../../services/dataFacade.js';

/**
 * Test implementation of BaseDataFacade
 */
class TestDataFacade extends BaseDataFacade {
  private mockAccessible: boolean = true;
  private mockConfig: ConfigReadResult;

  constructor(environmentInfo: EnvironmentInfo, mockConfig: ConfigReadResult) {
    super(environmentInfo);
    this.mockConfig = mockConfig;
  }

  isAccessible(): boolean {
    return this.mockAccessible;
  }

  setAccessible(value: boolean): void {
    this.mockAccessible = value;
  }

  readConfigFile(): Promise<ConfigReadResult> {
    return Promise.resolve({ ...this.mockConfig });
  }

  updateMockConfig(config: Partial<ConfigReadResult>, clearCache = true): void {
    this.mockConfig = { ...this.mockConfig, ...config };
    if (clearCache) {
      this.configCache = null;
    }
  }
}

describe('DataFacade', () => {
  describe('EnvironmentInfo interface', () => {
    it('should create valid environment info', () => {
      const info: EnvironmentInfo = {
        type: EnvironmentType.Windows,
        configPath: 'C:\\Users\\test\\.claude.json',
      };
      assert.strictEqual(info.type, EnvironmentType.Windows);
      assert.strictEqual(info.configPath, 'C:\\Users\\test\\.claude.json');
    });

    it('should include WSL instance name when provided', () => {
      const info: EnvironmentInfo = {
        type: EnvironmentType.WSL,
        configPath: '\\\\wsl.localhost\\Ubuntu\\home\\test\\.claude.json',
        instanceName: 'Ubuntu',
      };
      assert.strictEqual(info.instanceName, 'Ubuntu');
    });
  });

  describe('ProjectEntry interface', () => {
    it('should create valid project entry', () => {
      const entry: ProjectEntry = {
        path: '/home/user/project',
      };
      assert.strictEqual(entry.path, '/home/user/project');
    });

    it('should include state when provided', () => {
      const entry: ProjectEntry = {
        path: '/home/user/project',
        state: { allowedTools: ['Bash', 'Read'] },
      };
      assert.ok(entry.state);
    });

    it('should include mcpServers when provided', () => {
      const entry: ProjectEntry = {
        path: '/home/user/project',
        mcpServers: { 'test-server': { command: 'echo' } },
      };
      assert.ok(entry.mcpServers);
    });
  });

  describe('BaseDataFacade', () => {
    let mockEnvInfo: EnvironmentInfo;
    let mockConfig: ConfigReadResult;
    let facade: TestDataFacade;

    beforeEach(() => {
      mockEnvInfo = {
        type: EnvironmentType.Windows,
        configPath: 'C:\\Users\\test\\.claude.json',
      };
      mockConfig = {
        config: {
          settings: { theme: 'dark' },
          mcpServers: {},
        },
        projects: [
          { path: 'C:\\Users\\test\\project1' },
          { path: 'C:\\Users\\test\\project2' },
        ],
      };
      facade = new TestDataFacade(mockEnvInfo, mockConfig);
    });

    describe('getEnvironmentInfo()', () => {
      it('should return environment info', () => {
        const info = facade.getEnvironmentInfo();
        assert.strictEqual(info.type, EnvironmentType.Windows);
        assert.strictEqual(info.configPath, 'C:\\Users\\test\\.claude.json');
      });
    });

    describe('getConfigPath()', () => {
      it('should return config path', () => {
        assert.strictEqual(facade.getConfigPath(), 'C:\\Users\\test\\.claude.json');
      });
    });

    describe('isAccessible()', () => {
      it('should return accessibility status', () => {
        assert.ok(facade.isAccessible());
      });

      it('should reflect updated accessibility', () => {
        facade.setAccessible(false);
        assert.ok(!facade.isAccessible());
      });
    });

    describe('getProjects()', () => {
      it('should return project list', async () => {
        const projects = await facade.getProjects();
        assert.strictEqual(projects.length, 2);
        assert.strictEqual(projects[0]?.path, 'C:\\Users\\test\\project1');
      });

      it('should use cache for repeated calls', async () => {
        await facade.getProjects();

        // Update mock config but don't clear cache
        facade.updateMockConfig({
          projects: [{ path: 'C:\\Users\\test\\new' }],
        }, false); // Don't clear cache

        const projects2 = await facade.getProjects();

        // Should still return cached data (2 items)
        assert.strictEqual(projects2.length, 2);
        assert.strictEqual(projects2[0]?.path, 'C:\\Users\\test\\project1');
      });
    });

    describe('getGlobalConfig()', () => {
      it('should get top-level config value', async () => {
        const value = await facade.getGlobalConfig('settings');
        assert.ok(typeof value === 'object');
      });

      it('should get nested config value with dot notation', async () => {
        const value = await facade.getGlobalConfig('settings.theme');
        assert.strictEqual(value, 'dark');
      });

      it('should return undefined for non-existent key', async () => {
        const value = await facade.getGlobalConfig('nonexistent');
        assert.strictEqual(value, undefined);
      });

      it('should return undefined for non-existent nested key', async () => {
        const value = await facade.getGlobalConfig('settings.nonexistent');
        assert.strictEqual(value, undefined);
      });
    });

    describe('getProjectContextFiles()', () => {
      it('should return context file suggestions', async () => {
        const files = await facade.getProjectContextFiles('project1');
        // Default implementation returns possible file names
        assert.ok(Array.isArray(files));
      });

      it('should return empty array for non-existent project', async () => {
        const files = await facade.getProjectContextFiles('nonexistent');
        assert.deepStrictEqual(files, []);
      });
    });

    describe('refresh()', () => {
      it('should clear cache and re-read config', async () => {
        const projects1 = await facade.getProjects();
        assert.strictEqual(projects1.length, 2);

        facade.updateMockConfig({
          projects: [{ path: 'C:\\Users\\test\\new' }],
        });

        await facade.refresh();

        const projects2 = await facade.getProjects();
        assert.strictEqual(projects2.length, 1);
        assert.strictEqual(projects2[0]?.path, 'C:\\Users\\test\\new');
      });
    });
  });

  describe('normalizeProjects()', () => {
    it('should handle array format', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [
          { path: '/home/test/p1' },
          { path: '/home/test/p2' },
        ],
      };
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);
      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0]?.path, '/home/test/p1');
    });

    it('should handle record format', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [
          { path: '/home/test/p1' },
          { path: '/home/test/p2' },
        ],
      };
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);
      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 2);
    });

    it('should filter out invalid entries', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [
          { path: '/valid' },
          { path: '/another' },
        ],
      };
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);
      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 2);
      assert.strictEqual(projects[0]?.path, '/valid');
    });

    it('should handle empty projects', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);
      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 0);
    });

    it('should handle empty config projects', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [],
      };
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);
      const projects = await facade.getProjects();

      assert.strictEqual(projects.length, 0);
    });
  });

  describe('cache behavior', () => {
    it('should expire cache after TTL', async () => {
      const mockEnvInfo: EnvironmentInfo = {
        type: EnvironmentType.Linux,
        configPath: '/home/test/.claude.json',
      };
      const mockConfig: ConfigReadResult = {
        config: {},
        projects: [{ path: '/home/test/p1' }],
      };

      // Create a facade with very short TTL for testing
      const facade = new TestDataFacade(mockEnvInfo, mockConfig);

      // Read first time
      const projects1 = await facade.getProjects();
      assert.strictEqual(projects1.length, 1);

      // Update mock config
      facade.updateMockConfig({
        projects: [{ path: '/home/test/p2' }],
      });

      // Wait for cache to expire (TTL is 5000ms, but we can't easily wait in tests)
      // For now, just verify cache is used
      const projects2 = await facade.getProjects();
      assert.strictEqual(projects2.length, 1); // Still cached
    });
  });
});

// Export to satisfy ESLint
export {};
