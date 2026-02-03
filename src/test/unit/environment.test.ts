/**
 * Unit tests for Environment layer
 * Tests environment detection, platform-agnostic operations, and singleton pattern
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { Environment, EnvironmentType, getEnvironment } from '../../services/environment.js';

describe('Environment', () => {
  // Reset singleton before each test
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (Environment as any).instance = null;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (Environment as any).instance = null;
  });

  describe('单例模式', () => {
    it('should return same instance across multiple getInstance calls', () => {
      const env1 = Environment.getInstance();
      const env2 = Environment.getInstance();
      const env3 = Environment.getInstance();
      assert.strictEqual(env1, env2);
      assert.strictEqual(env2, env3);
    });

    it('should return same instance via getEnvironment helper', () => {
      const env1 = getEnvironment();
      const env2 = getEnvironment();
      assert.strictEqual(env1, env2);
    });
  });

  describe('环境类型检测', () => {
    it('should detect environment type', () => {
      const env = Environment.getInstance();

      // Verify that type is one of the valid types
      const validTypes = [EnvironmentType.Windows, EnvironmentType.WSL, EnvironmentType.MacOS, EnvironmentType.Linux];
      assert.ok(validTypes.includes(env.type));
    });

    it('should detect Windows environment when on Windows', () => {
      const env = Environment.getInstance();
      if (process.platform === 'win32') {
        assert.strictEqual(env.type, EnvironmentType.Windows);
        assert.ok(env.isWindows());
        assert.ok(!env.isWSL());
        assert.ok(!env.isMacOS());
        assert.ok(!env.isLinux());
      }
    });

    it('should detect macOS environment when on macOS', () => {
      const env = Environment.getInstance();
      if (process.platform === 'darwin') {
        assert.strictEqual(env.type, EnvironmentType.MacOS);
        assert.ok(env.isMacOS());
        assert.ok(!env.isWindows());
        assert.ok(!env.isWSL());
        assert.ok(!env.isLinux());
      }
    });

    it('should detect WSL environment when on WSL', () => {
      const env = Environment.getInstance();
      if (process.platform === 'linux') {
        const isWsl = env.isWSL();
        // If on Linux, check WSL detection
        if (isWsl) {
          assert.strictEqual(env.type, EnvironmentType.WSL);
          assert.ok(!env.isLinux());
        } else {
          assert.strictEqual(env.type, EnvironmentType.Linux);
          assert.ok(env.isLinux());
        }
      }
    });
  });

  describe('Home 目录', () => {
    it('should return home directory', () => {
      const env = Environment.getInstance();
      assert.ok(typeof env.homeDir === 'string');
      assert.ok(env.homeDir.length > 0 || process.env.HOME === undefined && process.env.USERPROFILE === undefined);
    });

    it('should return correct home directory on Windows', () => {
      if (process.platform === 'win32') {
        const env = Environment.getInstance();
        assert.ok(env.homeDir.includes('Users') || env.homeDir.includes('user'));
      }
    });

    it('should return correct home directory on Unix', () => {
      if (process.platform !== 'win32') {
        const env = Environment.getInstance();
        // Unix systems typically have /home or /Users
        assert.ok(env.homeDir.startsWith('/'));
      }
    });
  });

  describe('平台无关接口', () => {
    describe('getConfigPath()', () => {
      it('should return path ending with .claude.json', () => {
        const env = Environment.getInstance();
        assert.ok(env.getConfigPath().endsWith('.claude.json'));
      });

      it('should return absolute path', () => {
        const env = Environment.getInstance();
        const configPath = env.getConfigPath();

        if (process.platform === 'win32') {
          // Windows: C:\Users\... or similar
          assert.ok(configPath.includes(':') || configPath.startsWith('\\'));
        } else {
          // Unix: /home/... or /Users/...
          assert.ok(configPath.startsWith('/'));
        }
      });

      it('should return config path under home directory', () => {
        const env = Environment.getInstance();
        const configPath = env.getConfigPath();
        const homeDir = env.homeDir;

        assert.ok(configPath.startsWith(homeDir) || configPath.toLowerCase().startsWith(homeDir.toLowerCase()));
      });
    });

    describe('joinPath()', () => {
      it('should join path segments correctly', () => {
        const env = Environment.getInstance();
        const result = env.joinPath('home', 'user', 'project');
        assert.ok(typeof result === 'string');
        assert.ok(result.includes('home'));
        assert.ok(result.includes('user'));
        assert.ok(result.includes('project'));
      });

      it('should use correct path separator for platform', () => {
        const env = Environment.getInstance();
        const result = env.joinPath('a', 'b', 'c');

        if (process.platform === 'win32') {
          assert.ok(result.includes('\\'));
        } else {
          assert.ok(result.includes('/'));
        }
      });
    });
  });

  describe('getInfo()', () => {
    it('should return complete environment info', () => {
      const env = Environment.getInstance();
      const info = env.getInfo();

      assert.strictEqual(typeof info.type, 'string');
      assert.strictEqual(typeof info.homeDir, 'string');
      assert.strictEqual(typeof info.configPath, 'string');
    });

    it('should return matching info with direct property access', () => {
      const env = Environment.getInstance();
      const info = env.getInfo();

      assert.strictEqual(info.type, env.type);
      assert.strictEqual(info.homeDir, env.homeDir);
      assert.strictEqual(info.configPath, env.getConfigPath());
    });
  });

  describe('只读属性', () => {
    it('should have working isXXX() methods', () => {
      const env = Environment.getInstance();
      assert.strictEqual(typeof env.isWindows, 'function');
      assert.strictEqual(typeof env.isWSL, 'function');
      assert.strictEqual(typeof env.isMacOS, 'function');
      assert.strictEqual(typeof env.isLinux, 'function');
    });

    it('should return valid type value', () => {
      const env = Environment.getInstance();
      assert.ok(Object.values(EnvironmentType).includes(env.type));
    });

    it('should return valid homeDir string', () => {
      const env = Environment.getInstance();
      assert.strictEqual(typeof env.homeDir, 'string');
    });
  });
});

// Export to satisfy ESLint
export {};
