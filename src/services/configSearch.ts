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
import type { IDataFacade } from "./dataFacade.js";

/**
 * Data facade with metadata
 */
export interface FacadeWithInfo {
  /** The data facade instance */
  facade: IDataFacade;
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
  private discoverPromise: Promise<IDataFacade[]> | null = null;

  constructor() {
    super();
    this.environment = getEnvironment();
  }

  /**
   * Discover all environments and create data facades
   * This method caches the result and returns the cached list on subsequent calls.
   * @returns Promise resolving to array of accessible data facades
   */
  async discoverAll(): Promise<IDataFacade[]> {
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
  async refresh(): Promise<IDataFacade[]> {
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
  getAllFacades(): IDataFacade[] {
    return Array.from(this.facades.values()).map((f) => f.facade);
  }

  /**
   * Get accessible facades only
   * @returns Array of accessible facade instances
   */
  getAccessibleFacades(): IDataFacade[] {
    return Array.from(this.facades.values())
      .filter((f) => f.accessible)
      .map((f) => f.facade);
  }

  /**
   * Get facade by ID
   * @param id - Facade identifier (format: "native", "wsl:<distro>", "windows")
   * @returns Facade instance or undefined
   */
  getFacadeById(id: string): IDataFacade | undefined {
    const info = this.facades.get(id);
    return info?.facade;
  }

  /**
   * Perform the actual environment discovery
   */
  private async performDiscovery(): Promise<IDataFacade[]> {
    const facades: IDataFacade[] = [];

    // Always create native facade for current environment
    const nativeFacade = this.createNativeFacade();
    facades.push(nativeFacade);
    this.facades.set("native", {
      facade: nativeFacade,
      accessible: true,
      discoveredAt: Date.now(),
    });

    // Discover additional environments based on current platform
    if (this.environment.isWindows()) {
      // Windows: Discover WSL instances
      const wslFacades = await this.discoverWslFromWindows();
      facades.push(...wslFacades);
    } else if (this.environment.isWSL()) {
      // WSL: Discover Windows users
      const windowsFacades = await this.discoverWindowsFromWsl();
      facades.push(...windowsFacades);
    }
    // macOS/Linux: Only native facade

    return facades;
  }

  /**
   * Create native facade for current environment
   */
  private createNativeFacade(): IDataFacade {
    return new NativeDataFacade();
  }

  /**
   * Discover WSL instances from Windows
   * Tries \\wsl.localhost first, falls back to \\wsl$
   */
  private async discoverWslFromWindows(): Promise<IDataFacade[]> {
    const facades: IDataFacade[] = [];

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
   * Discover Windows users from WSL
   * Changed from returning single facade to array of facades
   */
  private async discoverWindowsFromWsl(): Promise<IDataFacade[]> {
    const facades: IDataFacade[] = [];

    const discoveredFacades = await WslToWindowsDataFacadeFactory.createAll();

    for (const facade of discoveredFacades) {
      const username = facade.getWindowsUsername();
      const id = `windows:${username}`;

      facades.push(facade);
      this.facades.set(id, {
        facade,
        accessible: true,
        discoveredAt: Date.now(),
      });

      this.debugLog(`Discovered Windows user: ${username}`);
    }

    return facades;
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
  override on(eventName: "dataFacadesChanged", listener: (facades: IDataFacade[]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * Event: dataFacadesChanged
   * Emitted when the list of discovered facades changes
   */
  override once(eventName: "dataFacadesChanged", listener: (facades: IDataFacade[]) => void): this {
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
export type DataFacadesChangedListener = (facades: IDataFacade[]) => void;
