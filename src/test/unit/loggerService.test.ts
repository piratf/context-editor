/**
 * Unit tests for LoggerService
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { VsCodeLoggerService, type ILoggerService, LogLevel } from "../../services/loggerService.js";

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
    loggerService = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.DEBUG);
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

  void describe("log level filtering", () => {
    void it("should show all logs when level is DEBUG", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      const debugLogger = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.DEBUG);
      debugLogger.debug("Debug message");
      debugLogger.info("Info message");
      debugLogger.warn("Warn message");
      debugLogger.error("Error message");

      assert.equal(calls.length, 4);
      assert.match(calls[0], /\[DEBUG\]/);
      assert.match(calls[1], /\[INFO\]/);
      assert.match(calls[2], /\[WARN\]/);
      assert.match(calls[3], /\[ERROR\]/);
    });

    void it("should filter DEBUG logs when level is INFO", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      const infoLogger = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.INFO);
      infoLogger.debug("Debug message");
      infoLogger.info("Info message");
      infoLogger.warn("Warn message");
      infoLogger.error("Error message");

      assert.equal(calls.length, 3);
      assert.match(calls[0], /\[INFO\]/);
      assert.match(calls[1], /\[WARN\]/);
      assert.match(calls[2], /\[ERROR\]/);
    });

    void it("should filter DEBUG and INFO logs when level is WARN", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      const warnLogger = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.WARN);
      warnLogger.debug("Debug message");
      warnLogger.info("Info message");
      warnLogger.warn("Warn message");
      warnLogger.error("Error message");

      assert.equal(calls.length, 2);
      assert.match(calls[0], /\[WARN\]/);
      assert.match(calls[1], /\[ERROR\]/);
    });

    void it("should only show ERROR logs when level is ERROR", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      const errorLogger = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.ERROR);
      errorLogger.debug("Debug message");
      errorLogger.info("Info message");
      errorLogger.warn("Warn message");
      errorLogger.error("Error message");

      assert.equal(calls.length, 1);
      assert.match(calls[0], /\[ERROR\]/);
    });

    void it("should allow changing log level dynamically", () => {
      const calls: string[] = [];
      mockOutputChannel.appendLine = (value: string) => {
        calls.push(value);
      };

      const logger = new VsCodeLoggerService(COMPONENT_NAME, mockOutputChannel, LogLevel.ERROR);
      assert.equal(logger.getLevel(), LogLevel.ERROR);

      logger.debug("Debug message");
      assert.equal(calls.length, 0);

      logger.setLevel(LogLevel.DEBUG);
      assert.equal(logger.getLevel(), LogLevel.DEBUG);

      logger.debug("Debug message");
      assert.equal(calls.length, 1);
      assert.match(calls[0], /\[DEBUG\]/);
    });
  });
});
