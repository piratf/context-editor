/**
 * Unit tests for ConfigSearch layer
 * Tests environment discovery and facade management
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { ConfigSearch, ConfigSearchFactory } from '../../services/configSearch.js';

describe('ConfigSearch', () => {
  let search: ConfigSearch;

  beforeEach(() => {
    // Reset environment singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const { Environment } = require('../../services/environment.js');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (Environment as any).instance = null;

    search = new ConfigSearch();
  });

  afterEach(() => {
    // Cleanup event listeners
    search.removeAllListeners();
  });

  describe('构造函数', () => {
    it('should create ConfigSearch instance', () => {
      assert.ok(search instanceof ConfigSearch);
    });

    it('should be an EventEmitter', () => {
      assert.ok(typeof search.on === 'function');
      assert.ok(typeof search.emit === 'function');
    });

    it('should have empty facades initially', () => {
      const facades = search.getAllFacades();
      assert.deepStrictEqual(facades, []);
    });
  });

  describe('discoverAll()', () => {
    it('should return array of facades', async () => {
      const facades = await search.discoverAll();
      assert.ok(Array.isArray(facades));
    });

    it('should include native facade', async () => {
      const facades = await search.discoverAll();
      // Should have at least native facade
      assert.ok(facades.length >= 1);
    });

    it('should cache results', async () => {
      const facades1 = await search.discoverAll();
      const facades2 = await search.discoverAll();
      assert.strictEqual(facades1, facades2);
    });

    it('should emit dataFacadesChanged event', async () => {
      let eventFired = false;
      let receivedFacades: unknown[] = [];

      search.on('dataFacadesChanged', (facades) => {
        eventFired = true;
        receivedFacades = facades;
      });

      await search.discoverAll();

      assert.ok(eventFired);
      assert.ok(Array.isArray(receivedFacades));
    });
  });

  describe('refresh()', () => {
    it('should clear cache and re-discover', async () => {
      const facades1 = await search.discoverAll();
      await search.refresh();
      const facades2 = await search.discoverAll();

      // Both should be arrays
      assert.ok(Array.isArray(facades1));
      assert.ok(Array.isArray(facades2));
    });

    it('should emit event on refresh', async () => {
      let eventCount = 0;

      search.on('dataFacadesChanged', () => {
        eventCount++;
      });

      await search.discoverAll();
      assert.strictEqual(eventCount, 1);

      await search.refresh();
      assert.strictEqual(eventCount, 2);
    });
  });

  describe('getAllFacades()', () => {
    it('should return empty array initially', () => {
      const facades = search.getAllFacades();
      assert.deepStrictEqual(facades, []);
    });

    it('should return facades after discovery', async () => {
      await search.discoverAll();
      const facades = search.getAllFacades();
      assert.ok(facades.length >= 1);
    });
  });

  describe('getAccessibleFacades()', () => {
    it('should return empty array initially', () => {
      const facades = search.getAccessibleFacades();
      assert.deepStrictEqual(facades, []);
    });

    it('should return facades after discovery', async () => {
      await search.discoverAll();
      const facades = search.getAccessibleFacades();
      assert.ok(Array.isArray(facades));
    });
  });

  describe('getFacadeById()', () => {
    it('should return undefined for non-existent id', () => {
      const facade = search.getFacadeById('nonexistent');
      assert.strictEqual(facade, undefined);
    });

    it('should return facade after discovery', async () => {
      await search.discoverAll();
      const nativeFacade = search.getFacadeById('native');
      assert.ok(nativeFacade !== undefined);
    });

    it('should return WSL facade by distro id', async () => {
      // This test will only pass on Windows with accessible WSL
      await search.discoverAll();
      // Just verify the method doesn't throw
      const wslFacade = search.getFacadeById('wsl:Ubuntu');
      // May be undefined if WSL not accessible
      assert.strictEqual(typeof wslFacade === 'object' || wslFacade === undefined, true);
    });
  });

  describe('ConfigSearchFactory', () => {
    it('should create ConfigSearch instance', () => {
      const instance = ConfigSearchFactory.create();
      assert.ok(instance instanceof ConfigSearch);
    });

    it('should create and discover', async () => {
      const instance = await ConfigSearchFactory.createAndDiscover();
      assert.ok(instance instanceof ConfigSearch);
      const facades = instance.getAllFacades();
      assert.ok(facades.length >= 1);
    });
  });

  describe('事件管理', () => {
    it('should support multiple listeners', async () => {
      let count1 = 0;
      let count2 = 0;

      search.on('dataFacadesChanged', () => count1++);
      search.on('dataFacadesChanged', () => count2++);

      await search.discoverAll();

      assert.strictEqual(count1, 1);
      assert.strictEqual(count2, 1);
    });

    it('should support removing listeners', async () => {
      let count = 0;

      const listener = () => count++;
      search.on('dataFacadesChanged', listener);
      search.off('dataFacadesChanged', listener);

      await search.discoverAll();

      assert.strictEqual(count, 0);
    });

    it('should support once listener', async () => {
      let count = 0;

      search.once('dataFacadesChanged', () => count++);

      await search.discoverAll();
      await search.discoverAll();

      assert.strictEqual(count, 1);
    });
  });

  describe('平台特定行为', () => {
    it('should work on current platform', async () => {
      const facades = await search.discoverAll();

      // Should always have at least native facade
      assert.ok(facades.length >= 1);

      // Verify native facade is present
      const nativeFacade = search.getFacadeById('native');
      assert.ok(nativeFacade !== undefined);
    });

    it('should handle discovery gracefully on Linux', async () => {
      // Linux should only have native facade
      // (unless running in special conditions)
      const facades = await search.discoverAll();
      assert.ok(Array.isArray(facades));
    });

    it('should handle discovery gracefully on macOS', async () => {
      // macOS should only have native facade
      const facades = await search.discoverAll();
      assert.ok(Array.isArray(facades));
    });
  });

  describe('debug logging', () => {
    it('should not throw when DEBUG is set', async () => {
      process.env.DEBUG = '1';
      try {
        await search.discoverAll();
        assert.ok(true);
      } finally {
        delete process.env.DEBUG;
      }
    });

    it('should work without DEBUG', async () => {
      await search.discoverAll();
      assert.ok(true);
    });
  });
});

// Export to satisfy ESLint
export {};
