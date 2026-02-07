/**
 * Config Search layer - Discovers and manages all accessible environments
 *
 * Responsibilities:
 * - Discover all available environments (Windows, WSL, macOS, Linux)
 * - Create data facades for each environment with .claude.json
 * - Manage the list of data facades
 * - Emit events when the facade list changes
 *
 * Discovery logic by platform:
 * - Windows: Native facade + discover WSL instances via UNC paths
 * - WSL: Native facade + check Windows config via /mnt/c/
 * - macOS/Linux: Native facade only
 *
 * Key features:
 * - Automatic WSL instance discovery
 * - Graceful fallback (\\wsl.localhost → \\wsl$)
 * - Silent skip for inaccessible instances (debug logging)
 */

import { EventEmitter } from "node:events";
import { getEnvironment } from "./environment.js";
import { NativeDataFacade } from "./nativeDataFacade.js";
import { WindowsToWslDataFacadeFactory } from "./windowsToWslDataFacade.js";
import { WslToWindowsDataFacadeFactory } from "./wslToWindowsDataFacade.js";
import type { ClaudeDataFacade } from "./dataFacade.js";

/**
 * Data facade with metadata
 */
export interface FacadeWithInfo {
  /** The data facade instance */
  facade: ClaudeDataFacade;
  /** Whether the facade is accessible */
  accessible: boolean;
  /** Timestamp when the facade was created */
  discoveredAt: number;
}

/**
 * Configuration search service
 * Discovers and manages data facades for all accessible environments
 */
export class ConfigSearch extends EventEmitter {
  private facades: Map<string, FacadeWithInfo> = new Map();
  private environment: ReturnType<typeof getEnvironment>;
  private discoverPromise: Promise<ClaudeDataFacade[]> | null = null;

  constructor() {
    super();
    this.environment = getEnvironment();
  }

  /**
   * Discover all environments and create data facades
   * This method caches the result and returns the cached list on subsequent calls.
   * @returns Promise resolving to array of accessible data facades
   */
  async discoverAll(): Promise<ClaudeDataFacade[]> {
    // Return cached result if available
    if (this.discoverPromise) {
      return this.discoverPromise;
    }

    this.discoverPromise = this.performDiscovery();
    const facades = await this.discoverPromise;

    // Emit change event
    this.emit("dataFacadesChanged", facades);

    return facades;
  }

  /**
   * Refresh the facade list
   * Clears cache and re-discovers all environments
   * @returns Promise resolving to array of accessible data facades
   */
  async refresh(): Promise<ClaudeDataFacade[]> {
    // Clear cache
    this.discoverPromise = null;

    // Re-discover
    const facades = await this.discoverAll();

    return facades;
  }

  /**
   * Get all currently discovered facades
   * @returns Array of facade instances
   */
  getAllFacades(): ClaudeDataFacade[] {
    return Array.from(this.facades.values()).map((f) => f.facade);
  }

  /**
   * Get accessible facades only
   * @returns Array of accessible facade instances
   */
  getAccessibleFacades(): ClaudeDataFacade[] {
    return Array.from(this.facades.values())
      .filter((f) => f.accessible)
      .map((f) => f.facade);
  }

  /**
   * Get facade by ID
   * @param id - Facade identifier (format: "native", "wsl:<distro>", "windows")
   * @returns Facade instance or undefined
   */
  getFacadeById(id: string): ClaudeDataFacade | undefined {
    const info = this.facades.get(id);
    return info?.facade;
  }

  /**
   * Perform the actual environment discovery
   */
  private async performDiscovery(): Promise<ClaudeDataFacade[]> {
    const facades: ClaudeDataFacade[] = [];

    // Always create native facade for current environment
    const nativeFacade = this.createNativeFacade();
    if (await this.isFacadeAccessible(nativeFacade)) {
      facades.push(nativeFacade);
      this.facades.set("native", {
        facade: nativeFacade,
        accessible: true,
        discoveredAt: Date.now(),
      });
    }

    // Discover additional environments based on current platform
    if (this.environment.isWindows()) {
      // Windows: Discover WSL instances
      const wslFacades = await this.discoverWslFromWindows();
      facades.push(...wslFacades);
    } else if (this.environment.isWSL()) {
      // WSL: Discover Windows
      const windowsFacade = await this.discoverWindowsFromWsl();
      if (windowsFacade) {
        facades.push(windowsFacade);
      }
    }
    // macOS/Linux: Only native facade

    return facades;
  }

  /**
   * Create native facade for current environment
   */
  private createNativeFacade(): ClaudeDataFacade {
    return new NativeDataFacade();
  }

  /**
   * Discover WSL instances from Windows
   * Tries \\wsl.localhost first, falls back to \\wsl$
   */
  private async discoverWslFromWindows(): Promise<ClaudeDataFacade[]> {
    const facades: ClaudeDataFacade[] = [];

    // Use WindowsToWslDataFacadeFactory to discover accessible WSL instances
    const discoveredFacades = await WindowsToWslDataFacadeFactory.createAll();

    for (const facade of discoveredFacades) {
      const distroName = facade.getDistroName();
      const id = `wsl:${distroName}`;

      facades.push(facade);
      this.facades.set(id, {
        facade,
        accessible: true,
        discoveredAt: Date.now(),
      });

      // Debug logging for discovered WSL instance
      this.debugLog(`Discovered WSL instance: ${distroName}`);
    }

    return facades;
  }

  /**
   * Discover Windows configuration from WSL
   */
  private async discoverWindowsFromWsl(): Promise<ClaudeDataFacade | null> {
    // Use WslToWindowsDataFacadeFactory to auto-detect Windows
    const facade = await WslToWindowsDataFacadeFactory.createAuto();

    if (facade) {
      this.facades.set("windows", {
        facade,
        accessible: true,
        discoveredAt: Date.now(),
      });
      this.debugLog("Discovered Windows environment from WSL");
      return facade;
    }

    return null;
  }

  /**
   * Check if a facade is accessible
   */
  private async isFacadeAccessible(facade: ClaudeDataFacade): Promise<boolean> {
    try {
      await facade.getProjects();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Debug logging helper
   */
  private debugLog(message: string): void {
    // Only log in debug mode
    if (process.env.DEBUG !== undefined && process.env.DEBUG !== "") {
      console.debug(`[ConfigSearch] ${message}`);
    }
  }

  /**
   * Event: dataFacadesChanged
   * Emitted when the list of discovered facades changes
   */
  override on(
    eventName: "dataFacadesChanged",
    listener: (facades: ClaudeDataFacade[]) => void
  ): this {
    return super.on(eventName, listener);
  }

  /**
   * Event: dataFacadesChanged
   * Emitted when the list of discovered facades changes
   */
  override once(
    eventName: "dataFacadesChanged",
    listener: (facades: ClaudeDataFacade[]) => void
  ): this {
    return super.once(eventName, listener);
  }

  /**
   * Remove a listener
   */
  override off(eventName: string, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }
}

/**
 * Factory for creating ConfigSearch instances
 */
export const ConfigSearchFactory = {
  /**
   * Create a ConfigSearch instance
   * @returns Configured ConfigSearch
   */
  create(): ConfigSearch {
    return new ConfigSearch();
  },

  /**
   * Create and perform initial discovery
   * @returns Promise resolving to ConfigSearch with discovered facades
   */
  async createAndDiscover(): Promise<ConfigSearch> {
    const search = this.create();
    await search.discoverAll();
    return search;
  },
} as const;

/**
 * Type definition for data facades changed event
 */
export type DataFacadesChangedListener = (facades: ClaudeDataFacade[]) => void;
