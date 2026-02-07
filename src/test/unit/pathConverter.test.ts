/**
 * Unit tests for PathConverter layer
 * Tests WSL ↔ Windows path conversion
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  PathConverterFactory,
  PathConverterUtils,
} from '../../services/pathConverter.js';

describe('PathConverter', () => {
  describe('WslToWindowsPathConverter', () => {
    describe('使用新格式 (\\wsl.localhost)', () => {
      const converter = PathConverterFactory.createWslToWindowsConverter('Ubuntu', false);

      it('should convert home directory paths', () => {
        const result = converter.convert('/home/user/project');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project');
      });

      it('should convert root paths', () => {
        const result = converter.convert('/');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\');
      });

      it('should convert /mnt/c paths', () => {
        const result = converter.convert('/mnt/c/Users/user');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\mnt\\c\\Users\\user');
      });

      it('should handle paths with special characters', () => {
        const result = converter.convert('/home/user/my project');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\my project');
      });

      it('should handle paths with spaces', () => {
        const result = converter.convert('/home/user/my folder/test');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\my folder\\test');
      });

      it('should return non-absolute paths as-is', () => {
        const result = converter.convert('relative/path');
        assert.strictEqual(result, 'relative/path');
      });

      it('should handle empty path', () => {
        const result = converter.convert('');
        assert.strictEqual(result, '');
      });

      it('should get correct UNC prefix', () => {
        assert.strictEqual(converter.getUncPrefix(), '\\\\wsl.localhost\\Ubuntu');
      });
    });

    describe('使用旧格式 (\\wsl$)', () => {
      const converter = PathConverterFactory.createWslToWindowsConverter('Ubuntu-20.04', true);

      it('should convert home directory paths using legacy format', () => {
        const result = converter.convert('/home/user/project');
        assert.strictEqual(result, '\\\\wsl$\\Ubuntu-20.04\\home\\user\\project');
      });

      it('should get correct legacy UNC prefix', () => {
        assert.strictEqual(converter.getUncPrefix(), '\\\\wsl$\\Ubuntu-20.04');
      });
    });

    describe('不同发行版', () => {
      it('should handle Ubuntu distro', () => {
        const converter = PathConverterFactory.createWslToWindowsConverter('Ubuntu');
        assert.strictEqual(converter.convert('/home/test'), '\\\\wsl.localhost\\Ubuntu\\home\\test');
      });

      it('should handle Debian distro', () => {
        const converter = PathConverterFactory.createWslToWindowsConverter('Debian');
        assert.strictEqual(converter.convert('/home/test'), '\\\\wsl.localhost\\Debian\\home\\test');
      });

      it('should handle distro with hyphen in name', () => {
        const converter = PathConverterFactory.createWslToWindowsConverter('Ubuntu-22.04');
        assert.strictEqual(converter.convert('/home/test'), '\\\\wsl.localhost\\Ubuntu-22.04\\home\\test');
      });
    });

    describe('路径规范化', () => {
      const converter = PathConverterFactory.createWslToWindowsConverter('Ubuntu');

      it('should normalize mixed slashes', () => {
        const result = converter.convert('/home/user\\project');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\project');
      });

      it('should handle trailing slashes', () => {
        const result = converter.convert('/home/user/');
        assert.strictEqual(result, '\\\\wsl.localhost\\Ubuntu\\home\\user\\');
      });
    });
  });

  describe('WindowsToWslPathConverter', () => {
    const converter = PathConverterFactory.createWindowsToWslConverter();

    describe('Windows 驱动器路径转换', () => {
      it('should convert C: drive paths', () => {
        const result = converter.convert('C:\\Users\\user\\project');
        assert.strictEqual(result, '/mnt/c/Users/user/project');
      });

      it('should convert D: drive paths', () => {
        const result = converter.convert('D:\\data\\files');
        assert.strictEqual(result, '/mnt/d/data/files');
      });

      it('should handle drive letter case', () => {
        const result1 = converter.convert('C:\\test');
        const result2 = converter.convert('c:\\test');
        assert.strictEqual(result1, '/mnt/c/test');
        assert.strictEqual(result2, '/mnt/c/test');
      });

      it('should handle root drive paths', () => {
        const result = converter.convert('C:\\');
        assert.strictEqual(result, '/mnt/c/');
      });
    });

    describe('WSL UNC 路径反向转换', () => {
      it('should convert new format UNC paths', () => {
        const result = converter.convert('\\\\wsl.localhost\\Ubuntu\\home\\user\\project');
        assert.strictEqual(result, '/home/user/project');
      });

      it('should convert legacy format UNC paths', () => {
        const result = converter.convert('\\\\wsl$\\Ubuntu\\home\\user\\project');
        assert.strictEqual(result, '/home/user/project');
      });

      it('should handle UNC paths with special characters', () => {
        const result = converter.convert('\\\\wsl.localhost\\Ubuntu\\home\\user\\my project');
        assert.strictEqual(result, '/home/user/my project');
      });

      it('should handle UNC root paths', () => {
        const result = converter.convert('\\\\wsl.localhost\\Ubuntu\\');
        assert.strictEqual(result, '/');
      });
    });

    describe('WSL UNC 路径检测', () => {
      it('should detect new format UNC paths', () => {
        assert.ok(converter.isWslUncPath('\\\\wsl.localhost\\Ubuntu\\home'));
      });

      it('should detect legacy format UNC paths', () => {
        assert.ok(converter.isWslUncPath('\\\\wsl$\\Ubuntu\\home'));
      });

      it('should not detect regular Windows paths as WSL', () => {
        assert.ok(!converter.isWslUncPath('C:\\Users\\user'));
        assert.ok(!converter.isWslUncPath('\\\\server\\share'));
      });

      it('should be case insensitive for wsl prefix', () => {
        assert.ok(converter.isWslUncPath('\\\\WSL$\\Ubuntu\\home'));
        assert.ok(converter.isWslUncPath('\\\\WSL.LOCALHOST\\Ubuntu\\home'));
      });
    });

    describe('提取发行版名称', () => {
      it('should extract distro from new format UNC', () => {
        assert.strictEqual(converter.extractDistro('\\\\wsl.localhost\\Ubuntu\\home'), 'Ubuntu');
      });

      it('should extract distro from legacy format UNC', () => {
        assert.strictEqual(converter.extractDistro('\\\\wsl$\\Debian\\home'), 'Debian');
      });

      it('should extract distro with hyphen', () => {
        assert.strictEqual(converter.extractDistro('\\\\wsl.localhost\\Ubuntu-22.04\\home'), 'Ubuntu-22.04');
      });

      it('should return undefined for non-UNC paths', () => {
        assert.strictEqual(converter.extractDistro('C:\\Users\\user'), undefined);
        assert.strictEqual(converter.extractDistro('/home/user'), undefined);
      });
    });

    describe('边界情况', () => {
      it('should return non-matching paths as-is', () => {
        const result = converter.convert('/home/user/project');
        assert.strictEqual(result, '/home/user/project');
      });

      it('should handle empty string', () => {
        const result = converter.convert('');
        assert.strictEqual(result, '');
      });

      it('should handle relative Windows paths', () => {
        const result = converter.convert('relative\\path');
        assert.strictEqual(result, 'relative\\path');
      });
    });
  });

  describe('PathConverterUtils', () => {
    describe('normalizeForPlatform', () => {
      it('should normalize to Windows backslashes', () => {
        const result = PathConverterUtils.normalizeForPlatform('/home/user/project', 'win32');
        assert.strictEqual(result, '\\home\\user\\project');
      });

      it('should normalize to Unix forward slashes', () => {
        const result = PathConverterUtils.normalizeForPlatform('C:\\Users\\user', 'linux');
        assert.strictEqual(result, 'C:/Users/user');
      });

      it('should normalize to forward slashes on macOS', () => {
        const result = PathConverterUtils.normalizeForPlatform('C:\\Users\\user', 'darwin');
        assert.strictEqual(result, 'C:/Users/user');
      });
    });

    describe('isAbsolutePath', () => {
      it('should detect Windows absolute paths with drive letter', () => {
        assert.ok(PathConverterUtils.isAbsolutePath('C:\\Users\\user'));
        assert.ok(PathConverterUtils.isAbsolutePath('D:\\data\\files'));
      });

      it('should detect UNC paths', () => {
        assert.ok(PathConverterUtils.isAbsolutePath('\\\\server\\share'));
        assert.ok(PathConverterUtils.isAbsolutePath('\\\\wsl.localhost\\Ubuntu\\home'));
      });

      it('should detect Unix absolute paths', () => {
        assert.ok(PathConverterUtils.isAbsolutePath('/home/user'));
        assert.ok(PathConverterUtils.isAbsolutePath('/'));
      });

      it('should not detect relative paths', () => {
        assert.ok(!PathConverterUtils.isAbsolutePath('relative/path'));
        assert.ok(!PathConverterUtils.isAbsolutePath('.'));
        assert.ok(!PathConverterUtils.isAbsolutePath('..'));
      });
    });

    describe('join', () => {
      it('should join path segments', () => {
        const result = PathConverterUtils.join('home', 'user', 'project');
        assert.ok(result.includes('home'));
        assert.ok(result.includes('user'));
        assert.ok(result.includes('project'));
      });

      it('should handle absolute paths', () => {
        const result = PathConverterUtils.join('/home', 'user');
        assert.ok(result.startsWith('/'));
      });
    });
  });

  describe('双向转换测试', () => {
    describe('WSL → Windows → WSL', () => {
      const toWin = PathConverterFactory.createWslToWindowsConverter('Ubuntu');
      const toWsl = PathConverterFactory.createWindowsToWslConverter();

      it('should preserve home paths', () => {
        const original = '/home/user/project';
        const windows = toWin.convert(original);
        const restored = toWsl.convert(windows);
        assert.strictEqual(restored, original);
      });

      it('should preserve /mnt paths', () => {
        const original = '/mnt/c/Users/user';
        const windows = toWin.convert(original);
        const restored = toWsl.convert(windows);
        assert.strictEqual(restored, original);
      });
    });

    describe('Windows → WSL → Windows', () => {
      const toWsl = PathConverterFactory.createWindowsToWslConverter();

      it('should preserve C: drive paths', () => {
        const original = 'C:\\Users\\user\\project';
        const wsl = toWsl.convert(original);
        // Note: Reverse conversion from WSL to Windows requires different converter
        // This test verifies the WSL format is correct
        assert.strictEqual(wsl, '/mnt/c/Users/user/project');
      });
    });
  });
});

// Export to satisfy ESLint
export {};
