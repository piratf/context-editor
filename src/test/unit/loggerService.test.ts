/**
 * Unit tests for LoggerService
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { VsCodeLoggerService, type ILoggerService } from "../../services/loggerService.js";

void describe("VsCodeLoggerService", () => {
  const COMPONENT_NAME = "TestComponent";
  let mockOutputChannel: { appendLine: (value: string) => void };
  let loggerService: ILoggerService;

  beforeEach(() => {
    const calls: string[] = [];
    mockOutputChannel = {
      appendLine: (value: string) => {
        calls.push(value);
      },
    };
    loggerService = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel);
  });

  void describe("debug", () => {
    void it("should log debug message with details", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.debug("Test message", { key: "value" });

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[0], /Test message/);
      assert.match(calls[0], /key="value"/);
    });

    void it("should log debug message without details", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.debug("Test message");

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[0], /Test message/);
    });
  });

  void describe("info", () => {
    void it("should log info message with details", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.info("Info message", { key: "value" });

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[INFO\]/);
      assert.match(calls[0], /Info message/);
    });
  });

  void describe("warn", () => {
    void it("should log warning message", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.warn("Warning message");

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[WARN\]/);
      assert.match(calls[0], /Warning message/);
    });
  });

  void describe("error", () => {
    void it("should log error message with Error object", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };
      const testError = new Error("Test error");

      loggerService.error("Error message", testError);

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[ERROR\]/);
      assert.match(calls[0], /Error message/);
      assert.match(calls[0], /Test error/);
    });

    void it("should log error message without Error object", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.error("Error message");

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[ERROR\]/);
      assert.match(calls[0], /Error message/);
    });
  });

  void describe("logEntry", () => {
    void it("should log method entry", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.logEntry("testMethod", { arg1: "value1" });

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[0], /testMethod\(\)/);
    });
  });

  void describe("logExit", () => {
    void it("should log method exit", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.logExit("testMethod", { result: "success" });

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[0], /testMethod\(\) completed/);
    });
  });

  void describe("logChildrenRetrieved", () => {
    void it("should log children retrieved", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      loggerService.logChildrenRetrieved("ParentNode", 5);

      assert.ok(calls.length > 0);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[0], /Retrieved children for "ParentNode"/);
      assert.match(calls[0], /count=5/);
    });
  });
});
