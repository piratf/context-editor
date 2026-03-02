/**
 * Unit tests for NativeDataFacade
 * Tests accessing the current environment's configuration
 */

/* eslint-disable @typescript-eslint/no-floating-promises */

import * as assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { NativeDataFacade, NativeDataFacadeFactory } from "../../services/nativeDataFacade.js";

describe("NativeDataFacade", () => {
  beforeEach(() => {
    // Set home directory for testing
    process.env.HOME = "/home/testuser";
  });

  describe("constructor and initialization", () => {
    it("should create facade instance", () => {
      const facade = new NativeDataFacade();
      assert.ok(facade instanceof NativeDataFacade);
    });

    it("should have valid environment info", () => {
      const facade = new NativeDataFacade();
      const info = facade.getEnvironmentInfo();
      // EnvironmentType and homePath are always defined
      assert.strictEqual(typeof info.type, "string");
      assert.strictEqual(typeof info.homePath, "string");
      assert.ok(info.type.length > 0);
      assert.ok(info.homePath.length > 0);
    });
  });

  describe("NativeDataFacadeFactory", () => {
    it("should create NativeDataFacade instance", () => {
      const facade = NativeDataFacadeFactory.create();
      assert.ok(facade instanceof NativeDataFacade);
    });
  });
});

// Export to satisfy ESLint
export {};
