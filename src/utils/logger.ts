/**
 * Unified debug logging utility for Context Editor.
 * Provides consistent formatting and structured logging across all providers.
 */

import * as vscode from "vscode";

/**
 * Log level for filtering debug output
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Priority of each log level for filtering (lower = more verbose)
 */
const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
} as const;

/**
 * Structured log entry
 */
interface LogEntry {
  readonly level: LogLevel;
  readonly component: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly details: Record<string, unknown> | undefined;
}

/**
 * Unified logger for Context Editor extension
 */
export class Logger {
  private readonly outputChannel: vscode.OutputChannel;
  private readonly componentName: string;
  private minLevel: LogLevel;

  constructor(
    outputChannel: vscode.OutputChannel,
    componentName: string,
    minLevel: LogLevel = LogLevel.INFO
  ) {
    this.outputChannel = outputChannel;
    this.componentName = componentName;
    this.minLevel = minLevel;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the current minimum log level
   */
  getLevel(): LogLevel {
    return this.minLevel;
  }

  /**
   * Log a debug message
   */
  debug(message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  /**
   * Log an info message
   */
  info(message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, details);
  }

  /**
   * Log a warning message
   */
  warn(message: string, details?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, details);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, details?: Record<string, unknown>): void {
    let errorDetails: Record<string, unknown> = {};
    if (error instanceof Error) {
      errorDetails = { error: error.message, stack: error.stack };
    }
    this.log(LogLevel.ERROR, message, { ...errorDetails, ...details });
  }

  /**
   * Internal log method that formats and writes to output channel
   */
  private log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
    // Filter logs based on minimum level
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      level,
      component: this.componentName,
      message,
      timestamp: new Date(),
      details,
    };

    const formatted = this.formatEntry(entry);
    this.outputChannel.appendLine(formatted);
  }

  /**
   * Format a log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    let output = `[${entry.component}] [${entry.level}] ${entry.message}`;

    if (entry.details !== undefined) {
      const detailStr = Object.entries(entry.details)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ");
      if (detailStr) {
        output += ` | ${detailStr}`;
      }
    }

    return output;
  }

  /**
   * Log entry into a method (for debugging)
   */
  logEntry(methodName: string, args?: Record<string, unknown>): void {
    const message = `${methodName}()`;
    this.debug(message, args);
  }

  /**
   * Log exit from a method
   */
  logExit(methodName: string, result?: Record<string, unknown>): void {
    const message = `${methodName}() completed`;
    this.debug(message, result);
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.outputChannel.show();
  }
}
