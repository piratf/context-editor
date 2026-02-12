/**
 * LoggerService - Pure logging service interface and implementation
 *
 * This module provides:
 * - ILoggerService: Pure logging interface without vscode dependency
 * - VsCodeLoggerService: VS Code-specific implementation
 *
 * Architecture:
 * - Service layer: Contains logging logic
 * - No vscode imports in the interface
 * - Can be fully unit tested without VS Code environment
 */

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
 * Pure logger service interface
 *
 * This interface defines logging operations without any dependency on VS Code.
 * Implementations can use different output channels (VS Code, console, file, etc.).
 */
export interface ILoggerService {
  /**
   * Log a debug message
   */
  debug(message: string, details?: Record<string, unknown>): void;

  /**
   * Log an info message
   */
  info(message: string, details?: Record<string, unknown>): void;

  /**
   * Log a warning message
   */
  warn(message: string, details?: Record<string, unknown>): void;

  /**
   * Log an error message
   */
  error(message: string, error?: Error, details?: Record<string, unknown>): void;

  /**
   * Log entry into a method (for debugging)
   */
  logEntry(methodName: string, args?: Record<string, unknown>): void;

  /**
   * Log exit from a method
   */
  logExit(methodName: string, result?: Record<string, unknown>): void;

  /**
   * Log tree node children retrieval
   */
  logChildrenRetrieved(parentLabel: string, count: number): void;
}

/**
 * VS Code logger service implementation
 *
 * This implementation writes logs to a VS Code output channel.
 * The output channel is provided as a dependency for testability.
 */
export class VsCodeLoggerService implements ILoggerService {
  constructor(
    private readonly componentName: string,
    private readonly outputChannel: { appendLine(value: string): void }
  ) {}

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
   * Log tree node children retrieval
   */
  logChildrenRetrieved(parentLabel: string, count: number): void {
    this.debug(`Retrieved children for "${parentLabel}"`, { count });
  }

  /**
   * Internal log method that formats and writes to output channel
   */
  private log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
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
}
