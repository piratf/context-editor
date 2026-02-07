/**
 * Environment State Manager
 * Manages the currently active environment and provides change notifications.
 */

import * as vscode from "vscode";
import type { Environment } from "./environmentDetector.js";

/**
 * Manages the global state for the currently active environment.
 * All views subscribe to this manager to update their content when the environment changes.
 */
export class EnvironmentStateManager {
  private _currentEnvironment: Environment;
  private readonly _onDidChangeEnvironment = new vscode.EventEmitter<Environment>();

  /**
   * Event fired when the current environment changes.
   */
  readonly onDidChangeEnvironment = this._onDidChangeEnvironment.event;

  constructor(initialEnvironment: Environment) {
    this._currentEnvironment = initialEnvironment;
  }

  /**
   * Get the currently active environment.
   */
  get currentEnvironment(): Environment {
    return this._currentEnvironment;
  }

  /**
   * Switch to a different environment.
   * Fires the onDidChangeEnvironment event to notify all subscribers.
   */
  async switchEnvironment(environment: Environment): Promise<void> {
    if (this._currentEnvironment.id === environment.id) {
      return; // No change needed
    }

    this._currentEnvironment = environment;

    // Update VS Code context for UI conditional display
    await vscode.commands.executeCommand(
      "setContext",
      "contextEditor.currentEnv",
      environment.id
    );

    // Fire event to notify all providers to refresh
    this._onDidChangeEnvironment.fire(environment);
  }

  /**
   * Get a short label for the environment (for Activity Badge display).
   */
  getEnvironmentBadge(): string {
    switch (this._currentEnvironment.id) {
      case "windows":
        return "WIN";
      case "wsl":
        return "WSL";
      case "primary":
        return this.getPlatformBadge();
      default:
        return "ENV";
    }
  }

  /**
   * Get platform badge for primary environment.
   */
  private getPlatformBadge(): string {
    switch (this._currentEnvironment.type) {
      case "mac":
        return "MAC";
      case "windows":
        return "WIN";
      case "wsl":
        return "WSL";
      case "linux":
        return "LINUX";
      default:
        return "ENV";
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    this._onDidChangeEnvironment.dispose();
  }
}
