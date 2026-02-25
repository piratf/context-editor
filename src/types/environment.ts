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
