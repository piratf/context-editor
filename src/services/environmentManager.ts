/**
 * EnvironmentManager - Manages the currently selected environment
 *
 * This service:
 * - Tracks the currently active data facade
 * - Provides environment switching functionality
 * - Notifies subscribers when environment changes
 * - Defaults to native facade (current environment)
 */

import * as vscode from "vscode";
import * as events from "node:events";
import type { ClaudeDataFacade } from "./dataFacade.js";
import type { ConfigSearch } from "./configSearch.js";

/**
 * Environment selection event data
 */
export interface EnvironmentChangeEvent {
  readonly previousFacade: ClaudeDataFacade | null;
  readonly currentFacade: ClaudeDataFacade;
  readonly environmentName: string;
}

/**
 * Manages the currently selected environment facade
 */
export class EnvironmentManager extends events.EventEmitter {
  private configSearch: ConfigSearch;
  private currentFacade: ClaudeDataFacade | null = null;

  constructor(configSearch: ConfigSearch) {
    super();
    this.configSearch = configSearch;

    // Default to native facade (first facade, which should be native)
    this.selectDefaultEnvironment();
  }

  /**
   * Select the default environment (native facade)
   */
  private selectDefaultEnvironment(): void {
    const facades = this.configSearch.getAllFacades();

    // Find native facade (current environment) or use first available
    const nativeFacade = facades.find((f) => {
      const info = f.getEnvironmentInfo();
      // Native facade has instanceName same as its type or no instanceName for native
      return info.instanceName === undefined || info.instanceName === "";
    }) ?? facades[0] ?? null;

    if (nativeFacade) {
      this.currentFacade = nativeFacade;
    }
  }

  /**
   * Get the currently selected facade
   */
  getCurrentFacade(): ClaudeDataFacade | null {
    return this.currentFacade;
  }

  /**
   * Set the current facade by index
   */
  setFacadeByIndex(index: number): boolean {
    const facades = this.configSearch.getAllFacades();

    if (index < 0 || index >= facades.length) {
      return false;
    }

    const previousFacade = this.currentFacade;
    this.currentFacade = facades[index]!;

    const info = this.currentFacade.getEnvironmentInfo();
    const environmentName = this.getEnvironmentDisplayName(info.type, info.instanceName);

    this.emit("environmentChanged", {
      previousFacade,
      currentFacade: this.currentFacade,
      environmentName,
    } as EnvironmentChangeEvent);

    return true;
  }

  /**
   * Set the current facade directly
   */
  setFacade(facade: ClaudeDataFacade): void {
    const previousFacade = this.currentFacade;
    this.currentFacade = facade;

    const info = facade.getEnvironmentInfo();
    const environmentName = this.getEnvironmentDisplayName(info.type, info.instanceName);

    this.emit("environmentChanged", {
      previousFacade,
      currentFacade: facade,
      environmentName,
    } as EnvironmentChangeEvent);
  }

  /**
   * Get all available facades
   */
  getAllFacades(): ClaudeDataFacade[] {
    return this.configSearch.getAllFacades();
  }

  /**
   * Get display name for an environment
   */
  private getEnvironmentDisplayName(
    envType: import("./dataFacade.js").EnvironmentType,
    instanceName?: string
  ): string {
    switch (envType) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "windows":
        return "Windows";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "wsl":
        return instanceName !== undefined && instanceName !== "" ? `WSL (${instanceName})` : "WSL";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "macos":
        return "macOS";
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      case "linux":
        return "Linux";
      default:
        return "Unknown";
    }
  }

  /**
   * Show quick pick to switch environment
   */
  async showEnvironmentQuickPick(): Promise<void> {
    const facades = this.getAllFacades();

    if (facades.length === 0) {
      await vscode.window.showInformationMessage("No environments found.");
      return;
    }

    const items = facades.map((facade, index) => {
      const info = facade.getEnvironmentInfo();
      const displayName = this.getEnvironmentDisplayName(info.type, info.instanceName);
      const isCurrent = facade === this.currentFacade;

      return {
        label: displayName,
        description: isCurrent ? "$(check) Current" : "",
        index,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      title: "Select Environment",
      placeHolder: "Choose an environment to display",
    });

    if (selected && selected.index !== undefined) {
      this.setFacadeByIndex(selected.index);
      await vscode.env.clipboard.writeText(selected.label);
    }
  }

  /**
   * Subscribe to environment change events
   */
  onEnvironmentChanged(
    listener: (event: EnvironmentChangeEvent) => void
  ): void {
    this.on("environmentChanged", listener);
  }

  /**
   * Get the current environment name for display
   */
  getCurrentEnvironmentName(): string {
    if (!this.currentFacade) {
      return "No Environment";
    }

    const info = this.currentFacade.getEnvironmentInfo();
    return this.getEnvironmentDisplayName(info.type, info.instanceName);
  }

  /**
   * Update the config search (e.g., after refresh)
   */
  updateConfigSearch(configSearch: ConfigSearch): void {
    this.configSearch = configSearch;

    // If current facade is no longer available, select default
    const facades = this.configSearch.getAllFacades();
    if (!facades.includes(this.currentFacade!)) {
      this.selectDefaultEnvironment();
    }
  }
}

/**
 * Type guard for environment changed event
 */
export function isEnvironmentChangedEvent(
  event: unknown
): event is EnvironmentChangeEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "currentFacade" in event &&
    "environmentName" in event
  );
}
