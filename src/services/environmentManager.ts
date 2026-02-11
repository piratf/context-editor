/**
 * EnvironmentManager - Manages the currently selected environment
 *
 * This service:
 * - Tracks the currently active data facade
 * - Provides environment switching functionality
 * - Notifies subscribers when environment changes
 * - Defaults to native facade (current environment)
 *
 * Architecture:
 * - Business logic completely decoupled from VS Code
 * - UI interactions injected via UserInteraction interface
 * - Can be unit tested with mock implementations
 */

import * as events from "node:events";
import type { ClaudeDataFacade } from "./dataFacade.js";
import type { ConfigSearch } from "./configSearch.js";
import type { UserInteraction, QuickPickItem } from "../adapters/ui.js";

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
  private userInteraction: UserInteraction;

  constructor(configSearch: ConfigSearch, userInteraction: UserInteraction) {
    super();
    this.configSearch = configSearch;
    this.userInteraction = userInteraction;

    // Default to native facade (first facade, which should be native)
    this.selectDefaultEnvironment();
  }

  /**
   * Select the default environment (native facade)
   */
  private selectDefaultEnvironment(): void {
    const facades = this.configSearch.getAllFacades();

    if (facades.length === 0) {
      this.currentFacade = null;
      return;
    }

    // Find native facade (current environment) or use first available
    const nativeFacade =
      facades.find((f) => {
        const info = f.getEnvironmentInfo();
        // Native facade has instanceName same as its type or no instanceName for native
        return (info.instanceName ?? "") === "";
      }) ?? facades[0];

    this.currentFacade = nativeFacade;
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
    this.currentFacade = facades[index];

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
   *
   * Uses injected UserInteraction for UI operations
   * Returns selected facade index or -1 if cancelled
   */
  async showEnvironmentQuickPick(): Promise<number> {
    const facades = this.getAllFacades();

    if (facades.length === 0) {
      await this.userInteraction.showInformationMessage("No environments found.");
      return -1;
    }

    const items: QuickPickItem<number>[] = facades.map((facade, index) => {
      const info = facade.getEnvironmentInfo();
      const displayName = this.getEnvironmentDisplayName(info.type, info.instanceName);
      const isCurrent = facade === this.currentFacade;

      return {
        label: displayName,
        description: isCurrent ? "$(check) Current" : "",
        data: index,
      };
    });

    const selected = await this.userInteraction.showQuickPick(items, {
      title: "Select Environment",
      placeHolder: "Choose an environment to display",
    });

    if (selected !== undefined && selected.data !== undefined) {
      this.setFacadeByIndex(selected.data);
      await this.userInteraction.writeText(selected.label);
      return selected.data;
    }

    return -1;
  }

  /**
   * Subscribe to environment change events
   */
  onEnvironmentChanged(listener: (event: EnvironmentChangeEvent) => void): void {
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
   * Preserves the current environment selection by matching environment info
   */
  updateConfigSearch(configSearch: ConfigSearch): void {
    // Save current environment info BEFORE updating configSearch
    let previousEnvInfo: { type: import("./dataFacade.js").EnvironmentType; instanceName: string | undefined } | null = null;

    if (this.currentFacade !== null) {
      const info = this.currentFacade.getEnvironmentInfo();
      previousEnvInfo = {
        type: info.type,
        instanceName: info.instanceName,
      };
    }

    this.configSearch = configSearch;

    // Try to restore the previous environment by matching environment info
    const facades = this.configSearch.getAllFacades();

    if (previousEnvInfo !== null) {
      // Find facade with matching environment info
      const matchingFacade = facades.find((f) => {
        const info = f.getEnvironmentInfo();
        return info.type === previousEnvInfo.type && info.instanceName === previousEnvInfo.instanceName;
      });

      if (matchingFacade !== undefined) {
        // Restore the matching facade (same environment, different object reference)
        this.currentFacade = matchingFacade;
        return;
      }
    }

    // If no match found or no previous environment, select default
    if (this.currentFacade === null || !facades.includes(this.currentFacade)) {
      this.selectDefaultEnvironment();
    }
  }
}

/**
 * Type guard for environment changed event
 */
export function isEnvironmentChangedEvent(event: unknown): event is EnvironmentChangeEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    "currentFacade" in event &&
    "environmentName" in event
  );
}
