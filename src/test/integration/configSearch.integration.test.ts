/**
 * Integration tests for ConfigSearch layer.
 * Tests environment discovery and facade management in real environment.
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { ConfigSearch, ConfigSearchFactory } from '../../services/configSearch.js';

describe('ConfigSearch Integration Tests', () => {
  let search: ConfigSearch;

  it('should discover at least native environment', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    const facades = search.getAllFacades();
    assert.ok(facades.length >= 1, 'Should have at least native facade');

    // Verify native facade exists (id is 'native')
    const facadesWithIds = facades.map((f) => ({ facade: f, info: f.getEnvironmentInfo() }));
    const nativeFacade = facadesWithIds.find((fi) => fi.info.configPath.includes('.claude.json'));
    assert.ok(nativeFacade !== undefined, 'Native facade should exist');
  });

  it('should get environment info from native facade', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    const facades = search.getAllFacades();
    assert.ok(facades.length >= 1, 'Should have at least one facade');

    const info = facades[0].getEnvironmentInfo();
    assert.ok(info, 'Should get environment info');
    assert.ok(info.type === 'windows' || info.type === 'wsl' || info.type === 'macos' || info.type === 'linux');
    assert.ok(typeof info.configPath === 'string');
    assert.ok(info.configPath.includes('.claude.json'), 'Config path should point to .claude.json');
  });

  it('should get projects from native facade', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    const facades = search.getAllFacades();
    assert.ok(facades.length >= 1, 'Should have at least one facade');

    const projects = await facades[0].getProjects();
    assert.ok(Array.isArray(projects), 'Projects should be an array');
  });

  it('should emit events on discovery', async () => {
    search = new ConfigSearch();

    let eventFired = false;
    search.on('dataFacadesChanged', () => {
      eventFired = true;
    });

    await search.discoverAll();
    assert.ok(eventFired, 'Event should be fired after discovery');
  });

  it('should emit events on refresh', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    let eventCount = 0;
    search.on('dataFacadesChanged', () => {
      eventCount++;
    });

    await search.refresh();
    assert.strictEqual(eventCount, 1, 'Event should be fired on refresh');
  });

  it('should have consistent facade info', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    const facades = search.getAllFacades();
    for (const facade of facades) {
      const info = facade.getEnvironmentInfo();
      assert.ok(info.type, 'Environment type should be defined');
      assert.ok(typeof info.configPath === 'string', 'Config path should be a string');
      assert.ok(info.configPath.length > 0, 'Config path should not be empty');
    }
  });

  it('should handle cross-platform path resolution', async () => {
    search = await ConfigSearchFactory.createAndDiscover();

    const facades = search.getAllFacades();
    for (const facade of facades) {
      const info = facade.getEnvironmentInfo();
      // All config paths should be absolute
      assert.ok(
        info.configPath.startsWith('/') || info.configPath.includes(':') || info.configPath.startsWith('\\\\'),
        'Config path should be absolute'
      );
      assert.ok(info.configPath.includes('.claude.json'), 'Config path should point to .claude.json');
    }
  });
});
