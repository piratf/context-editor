/**
 * Unit tests for WindowsToWslDataFacade
 * Tests accessing WSL configuration from Windows
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { WindowsToWslDataFacade, WindowsToWslDataFacadeFactory } from '../../services/windowsToWslDataFacade.js';
import { EnvironmentType } from '../../services/dataFacade.js';

describe('WindowsToWslDataFacade', () => {
  describe('构造函数', () => {
    it('should create facade for Ubuntu distro', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      assert.ok(facade instanceof WindowsToWslDataFacade);
      assert.strictEqual(facade.getDistroName(), 'Ubuntu');
    });

    it('should create facade for Debian distro', () => {
      const facade = new WindowsToWslDataFacade('Debian');
      assert.strictEqual(facade.getDistroName(), 'Debian');
    });

    it('should use new format by default', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      assert.ok(!facade.isUsingLegacyFormat());
    });

    it('should use legacy format when specified', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu', true);
      assert.ok(facade.isUsingLegacyFormat());
    });

    it('should have WSL environment type', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const info = facade.getEnvironmentInfo();
      assert.strictEqual(info.type, EnvironmentType.WSL);
    });

    it('should have instance name set to distro name', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu-22.04');
      const info = facade.getEnvironmentInfo();
      assert.strictEqual(info.instanceName, 'Ubuntu-22.04');
    });

    it('should have UNC config path with new format', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const path = facade.getConfigPath();
      assert.ok(path.includes('\\\\wsl.localhost\\Ubuntu'));
      assert.ok(path.includes('.claude.json'));
    });

    it('should have UNC config path with legacy format', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu', true);
      const path = facade.getConfigPath();
      assert.ok(path.includes('\\\\wsl$\\Ubuntu'));
      assert.ok(path.includes('.claude.json'));
    });
  });

  describe('路径转换', () => {
    it('should convert WSL paths to Windows UNC', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // The normalizeProjects method will convert paths
      // We test the conversion by checking that project paths are converted
      const wslPath = '/home/user/project';
      const expectedWindowsPath = '\\\\wsl.localhost\\Ubuntu\\home\\user\\project';

      // Access private method through test
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const converted = (facade as any).convertWslPathToWindows(wslPath);
      assert.strictEqual(converted, expectedWindowsPath);
    });

    it('should handle root path', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const convertedPath = (facade as any).convertWslPathToWindows('/');
      assert.ok(convertedPath.includes('\\\\wsl.localhost\\Ubuntu'));
    });

    it('should handle paths with special characters', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const wslPath = '/home/user/my project';
      const converted = (facade as any).convertWslPathToWindows(wslPath);
      assert.ok(converted.includes('my project'));
    });

    it('should preserve Windows UNC paths', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const uncPath = '\\\\wsl.localhost\\Ubuntu\\home\\user\\project';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const converted = (facade as any).convertWslPathToWindows(uncPath);
      assert.strictEqual(converted, uncPath);
    });

    it('should preserve relative paths', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const relativePath = 'relative/path';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const converted = (facade as any).convertWslPathToWindows(relativePath);
      assert.strictEqual(converted, relativePath);
    });
  });

  describe('isAccessible()', () => {
    it('should return true', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      assert.ok(facade.isAccessible());
    });
  });

  describe('parseConfig()私有方法', () => {
    it('should handle empty string', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).parseConfig('');
      assert.deepStrictEqual(result, {});
    });

    it('should handle invalid JSON', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).parseConfig('{ invalid json }');
      assert.deepStrictEqual(result, {});
    });

    it('should parse valid JSON', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const mockConfig = { settings: { theme: 'dark' } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).parseConfig(JSON.stringify(mockConfig));
      assert.strictEqual(result.settings?.theme, 'dark');
    });
  });

  describe('normalizeProjects()覆盖方法', () => {
    it('should convert project paths', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const projects = [
        { path: '/home/user/project1' },
        { path: '/home/user/project2' },
      ];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).normalizeProjects(projects);

      assert.strictEqual(result.length, 2);
      assert.ok(result[0]?.path.includes('\\\\wsl.localhost\\Ubuntu'));
      assert.ok(result[1]?.path.includes('project2'));
    });

    it('should handle empty projects', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).normalizeProjects(null);
      assert.deepStrictEqual(result, []);
    });

    it('should handle undefined projects', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (facade as any).normalizeProjects(undefined);
      assert.deepStrictEqual(result, []);
    });
  });

  describe('WindowsToWslDataFacadeFactory', () => {
    it('should create facade using factory', () => {
      const facade = WindowsToWslDataFacadeFactory.create('Ubuntu');
      assert.ok(facade instanceof WindowsToWslDataFacade);
      assert.strictEqual(facade.getDistroName(), 'Ubuntu');
    });

    it('should create facade with legacy format', () => {
      const facade = WindowsToWslDataFacadeFactory.create('Debian', true);
      assert.ok(facade.isUsingLegacyFormat());
    });

    it('should check facade accessibility', async () => {
      const facade = WindowsToWslDataFacadeFactory.create('Ubuntu');
      // In test environment, WSL is likely not accessible
      // Just verify the method doesn't throw
      const accessible = await WindowsToWslDataFacadeFactory.isFacadeAccessible(facade);
      assert.strictEqual(typeof accessible, 'boolean');
    });
  });

  describe('不同发行版', () => {
    it('should work with Ubuntu', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      assert.strictEqual(facade.getDistroName(), 'Ubuntu');
    });

    it('should work with Debian', () => {
      const facade = new WindowsToWslDataFacade('Debian');
      assert.strictEqual(facade.getDistroName(), 'Debian');
    });

    it('should work with distro names containing hyphens', () => {
      const facade = new WindowsToWslDataFacade('Ubuntu-22.04');
      assert.strictEqual(facade.getDistroName(), 'Ubuntu-22.04');
    });

    it('should work with openSUSE', () => {
      const facade = new WindowsToWslDataFacade('openSUSE');
      assert.strictEqual(facade.getDistroName(), 'openSUSE');
    });
  });

  describe('缓存行为', () => {
    it('should use cache by default', async () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      // First call will try to read (and likely fail if no WSL)
      await facade.getProjects();
      // Second call should use cache
      await facade.getProjects();
      // No assertion - just verify it doesn't throw
    });

    it('should clear cache on refresh', async () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      await facade.getProjects();
      await facade.refresh();
      // No assertion - just verify it doesn't throw
    });
  });

  describe('getGlobalConfig()', () => {
    it('should return undefined for non-existent config', async () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const value = await facade.getGlobalConfig('nonexistent');
      assert.strictEqual(value, undefined);
    });
  });

  describe('getProjectContextFiles()', () => {
    it('should return empty array for non-existent project', async () => {
      const facade = new WindowsToWslDataFacade('Ubuntu');
      const files = await facade.getProjectContextFiles('nonexistent');
      assert.deepStrictEqual(files, []);
    });
  });
});

// Export to satisfy ESLint
export {};
