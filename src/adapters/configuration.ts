/**
 * Configuration Service Adapter
 *
 * Provides interface-based access to VS Code configuration.
 * Enables testing with mock implementations.
 */

/**
 * VS Code workspace configuration interface
 */
export interface WorkspaceConfiguration {
  /**
   * Get a configuration value
   *
   * @param section - Configuration section (e.g., "contextEditor.export.directory")
   * @returns Configuration value
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  get<T>(section: string): T | undefined;

  /**
   * Get a configuration value with default
   *
   * @param section - Configuration section
   * @param defaultValue - Default value if not found
   * @returns Configuration value or default
   */

  get<T>(section: string, defaultValue: T): T;

  /**
   * Update a configuration value
   *
   * @param section - Configuration section
   * @param value - New value
   * @param target - Configuration target (global or workspace)
   */
  update(section: string, value: unknown, target?: ConfigurationTarget): Thenable<void>;
}

/**
 * Configuration target (where to store the value)
 */
export enum ConfigurationTarget {
  /** Global configuration (user settings) */
  Global = 1,
  /** Workspace configuration */
  Workspace = 2,
  /** Workspace folder configuration */
  WorkspaceFolder = 3,
}

/**
 * Configuration service interface
 */
export interface ConfigurationService {
  /**
   * Get a configuration value
   *
   * @param section - Configuration section
   * @returns Configuration value
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getConfig<T>(section: string): T | undefined;

  /**
   * Get a configuration value with default
   *
   * @param section - Configuration section
   * @param defaultValue - Default value
   * @returns Configuration value or default
   */

  getConfig<T>(section: string, defaultValue: T): T;

  /**
   * Update a configuration value
   *
   * @param section - Configuration section
   * @param value - New value
   * @param target - Configuration target (default: global)
   */
  updateConfig(section: string, value: unknown, target?: ConfigurationTarget): Thenable<void>;

  /**
   * Get the full export configuration
   */
  getExportConfig(): ExportConfigData;
}

/**
 * Export configuration data from VS Code settings
 */
export interface ExportConfigData {
  /** Target directory path */
  directory: string;
  /** Filter patterns */
  filters: readonly string[];
  /** Whether to create .gitignore */
  createGitignore: boolean;
}

/**
 * VS Code configuration service implementation
 */
export class VsCodeConfigurationService implements ConfigurationService {
  constructor(private readonly config: WorkspaceConfiguration) {}

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getConfig<T>(section: string): T | undefined;

  getConfig<T>(section: string, defaultValue: T): T;

  getConfig<T>(section: string, defaultValue?: T): T | undefined {
    if (arguments.length === 1) {
      return this.config.get<T>(section);
    }
    return this.config.get<T>(section, defaultValue as T);
  }

  updateConfig(
    section: string,
    value: unknown,
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Thenable<void> {
    return this.config.update(section, value, target);
  }

  getExportConfig(): ExportConfigData {
    return {
      directory: this.getConfig<string>("contextEditor.export.directory", ""),
      filters: this.getConfig<string[]>("contextEditor.export.filters", []),
      createGitignore: this.getConfig<boolean>("contextEditor.export.createGitignore", true),
    };
  }
}

/**
 * Create a VS Code configuration service from vscode.workspace.getConfiguration
 *
 * @param getConfiguration - VS Code getConfiguration function (can be async)
 * @returns Configuration service instance
 */
export function createConfigurationService(
  getConfiguration: () => WorkspaceConfiguration | Promise<WorkspaceConfiguration>
): ConfigurationService | Promise<ConfigurationService> {
  const configOrPromise = getConfiguration();
  if (configOrPromise instanceof Promise) {
    return configOrPromise.then((c) => new VsCodeConfigurationService(c));
  }
  return new VsCodeConfigurationService(configOrPromise);
}

/**
 * Create a mock configuration service for testing
 */
export class MockConfigurationService implements ConfigurationService {
  private readonly data = new Map<string, unknown>();

  constructor(initialData?: Record<string, unknown>) {
    if (initialData) {
      for (const [key, value] of Object.entries(initialData)) {
        this.data.set(key, value);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getConfig<T>(section: string): T | undefined;

  getConfig<T>(section: string, defaultValue: T): T;

  getConfig<T>(section: string, defaultValue?: T): T | undefined {
    const value = this.data.get(section);
    if (value === undefined) {
      return defaultValue;
    }
    return value as T;
  }

  updateConfig(section: string, value: unknown): Thenable<void> {
    this.data.set(section, value);
    return Promise.resolve();
  }

  getExportConfig(): ExportConfigData {
    return {
      directory: this.getConfig<string>("contextEditor.export.directory", ""),
      filters: this.getConfig<string[]>("contextEditor.export.filters", []),
      createGitignore: this.getConfig<boolean>("contextEditor.export.createGitignore", true),
    };
  }
}
