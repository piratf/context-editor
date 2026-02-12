/**
 * EnvironmentManagerService - Pure environment management service interface and implementation
 *
 * This module provides:
 * - IEnvironmentInfo: Environment information interface
 * - IProjectEntry: Project entry interface
 * - IDataFacade: Data facade interface (simplified)
 * - IEnvironmentManagerService: Pure environment manager interface without vscode dependency
 * - EnvironmentManagerService: Implementation with event support
 *
 * Architecture:
 * - Service layer: Contains environment management logic
 * - No vscode imports in the interface
 * - Can be fully unit tested without VS Code environment
 */

/**
 * Environment change event data
 */
export interface EnvironmentChangeEvent {
  readonly previousFacade: IDataFacade | null;
  readonly currentFacade: IDataFacade;
  readonly environmentName: string;
}

/**
 * Environment information interface
 */
export interface IEnvironmentInfo {
  readonly type: string;
  readonly configPath: string;
  readonly instanceName?: string;
}

/**
 * Project entry interface
 */
export interface IProjectEntry {
  readonly path: string;
  readonly state?: unknown;
  readonly mcpServers?: unknown;
}

/**
 * Data facade interface (simplified for service layer)
 */
export interface IDataFacade {
  getEnvironmentInfo(): IEnvironmentInfo;
  getProjects(): Promise<readonly IProjectEntry[]>;
  getGlobalConfig(key: string): Promise<unknown>;
  refresh(): Promise<void>;
  isAccessible(): boolean;
  getConfigPath(): string;
}

/**
 * Quick pick item interface
 */
export interface IQuickPickItem<T = unknown> {
  readonly label: string;
  readonly description: string;
  readonly data: T;
}

/**
 * User interaction interface
 */
export interface IUserInteraction {
  showInformationMessage(message: string): Promise<void>;
  showQuickPick(
    items: readonly IQuickPickItem[],
    options: { title: string; placeHolder: string }
  ): Promise<IQuickPickItem | undefined>;
  writeText(text: string): Promise<void>;
  onEnvironmentChanged?(callback: (event: EnvironmentChangeEvent) => void): void;
}

/**
 * Pure environment manager service interface
 *
 * This interface defines environment management operations without any dependency on VS Code.
 */
export interface IEnvironmentManagerService {
  /**
   * Get the currently selected facade
   */
  getCurrentFacade(): IDataFacade | null;

  /**
   * Get the current environment name for display
   */
  getCurrentEnvironmentName(): string;

  /**
   * Get all available facades
   */
  getAllFacades(): readonly IDataFacade[];

  /**
   * Set the current facade by index
   */
  setFacadeByIndex(index: number): boolean;

  /**
   * Set the current facade directly
   */
  setFacade(facade: IDataFacade): void;

  /**
   * Subscribe to environment change events
   */
  onEnvironmentChanged(callback: (event: EnvironmentChangeEvent) => void): void;

  /**
   * Show quick pick to switch environment
   */
  showEnvironmentQuickPick(): Promise<number>;
}

/**
 * Environment manager service implementation
 *
 * This implementation manages environment switching with event support.
 */
export class EnvironmentManagerService implements IEnvironmentManagerService {
  private facades: readonly IDataFacade[];
  private currentFacade: IDataFacade | null;
  private userInteraction: IUserInteraction;
  private listeners: ((event: EnvironmentChangeEvent) => void)[] = [];

  constructor(
    facades: readonly IDataFacade[],
    userInteraction: IUserInteraction & {
      onEnvironmentChanged(callback: (event: EnvironmentChangeEvent) => void): void;
    }
  ) {
    this.facades = facades;
    this.userInteraction = userInteraction;
    this.currentFacade = null;

    // Select default environment (native facade)
    this.selectDefaultEnvironment();

    // Subscribe to external events if provided
    if ("onEnvironmentChanged" in userInteraction) {
      userInteraction.onEnvironmentChanged((event: EnvironmentChangeEvent) => {
        this.notifyListeners(event);
      });
    }
  }

  /**
   * Select the default environment (native facade)
   */
  private selectDefaultEnvironment(): void {
    if (this.facades.length === 0) {
      this.currentFacade = null;
      return;
    }

    // Find native facade (current environment) or use first available
    const nativeFacade =
      this.facades.find((f) => {
        const info = f.getEnvironmentInfo();
        // Native facade has instanceName same as its type or no instanceName for native
        return (info.instanceName ?? "") === "";
      }) ?? this.facades[0];

    this.currentFacade = nativeFacade;
  }

  /**
   * Get the currently selected facade
   */
  getCurrentFacade(): IDataFacade | null {
    return this.currentFacade;
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
   * Get all available facades
   */
  getAllFacades(): readonly IDataFacade[] {
    return this.facades;
  }

  /**
   * Set the current facade by index
   */
  setFacadeByIndex(index: number): boolean {
    if (index < 0 || index >= this.facades.length) {
      return false;
    }

    const previousFacade = this.currentFacade;
    this.currentFacade = this.facades[index];

    const info = this.currentFacade.getEnvironmentInfo();
    const environmentName = this.getEnvironmentDisplayName(info.type, info.instanceName);

    this.notifyListeners({
      previousFacade,
      currentFacade: this.currentFacade,
      environmentName,
    });

    return true;
  }

  /**
   * Set the current facade directly
   */
  setFacade(facade: IDataFacade): void {
    const previousFacade = this.currentFacade;
    this.currentFacade = facade;

    const info = facade.getEnvironmentInfo();
    const environmentName = this.getEnvironmentDisplayName(info.type, info.instanceName);

    this.notifyListeners({
      previousFacade,
      currentFacade: facade,
      environmentName,
    });
  }

  /**
   * Subscribe to environment change events
   */
  onEnvironmentChanged(callback: (event: EnvironmentChangeEvent) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Show quick pick to switch environment
   */
  async showEnvironmentQuickPick(): Promise<number> {
    const facades = this.getAllFacades();

    if (facades.length === 0) {
      await this.userInteraction.showInformationMessage("No environments found.");
      return -1;
    }

    const items: IQuickPickItem<number>[] = facades.map((facade, index) => {
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
      const index = selected.data as number;
      this.setFacadeByIndex(index);
      await this.userInteraction.writeText(selected.label);
      return index;
    }

    return -1;
  }

  /**
   * Get display name for an environment
   */
  private getEnvironmentDisplayName(envType: string, instanceName?: string): string {
    switch (envType) {
      case "windows":
        return "Windows";
      case "wsl":
        return instanceName !== undefined && instanceName !== "" ? `WSL (${instanceName})` : "WSL";
      case "macos":
        return "macOS";
      case "linux":
        return "Linux";
      default:
        return "Unknown";
    }
  }

  /**
   * Notify all listeners of environment change
   */
  private notifyListeners(event: EnvironmentChangeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
