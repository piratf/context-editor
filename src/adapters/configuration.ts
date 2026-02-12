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
  /** .gitignore 文件内容 */
  gitignoreContent: string;
}

/**
 * VS Code configuration service implementation
 *
 * IMPORTANT: Holds a getConfiguration function to fetch fresh config on each read.
 * This ensures we always read the latest values after updates.
 */
export class VsCodeConfigurationService implements ConfigurationService {
  private readonly getConfiguration: () => WorkspaceConfiguration;

  constructor(getConfiguration: () => WorkspaceConfiguration | Promise<WorkspaceConfiguration>) {
    // Handle both sync and async getConfiguration functions
    this.getConfiguration = () => {
      const result = getConfiguration();
      if (result instanceof Promise) {
        throw new Error("Async getConfiguration not supported in VsCodeConfigurationService");
      }
      return result;
    };
  }

  private getWsConfig(): WorkspaceConfiguration {
    return this.getConfiguration();
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  getConfig<T>(section: string): T | undefined;

  getConfig<T>(section: string, defaultValue: T): T;

  getConfig<T>(section: string, defaultValue?: T): T | undefined {
    const config = this.getWsConfig();
    if (arguments.length === 1) {
      return config.get<T>(section);
    }
    return config.get<T>(section, defaultValue as T);
  }

  updateConfig(
    section: string,
    value: unknown,
    target: ConfigurationTarget = ConfigurationTarget.Global
  ): Thenable<void> {
    const config = this.getWsConfig();
    return config.update(section, value, target);
  }

  getExportConfig(): ExportConfigData {
    return {
      directory: this.getConfig<string>("export.directory", ""),
      filters: this.getConfig<string[]>("export.filters", []),
      createGitignore: this.getConfig<boolean>("export.createGitignore", true),
      gitignoreContent: this.getConfig<string>(
        "export.gitignoreContent",
        "# Ignore Claude local settings\nsettings.local.yaml\n"
      ),
    };
  }
}

/**
 * Create a VS Code configuration service from vscode.workspace.getConfiguration
 *
 * @param getConfiguration - VS Code getConfiguration function (can be async)
 * @returns Configuration service instance
 *
 * NOTE: The getConfiguration function is stored so that config is fetched fresh
 * on each read. This ensures we always get the latest values after updates.
 */
export function createConfigurationService(
  getConfiguration: () => WorkspaceConfiguration | Promise<WorkspaceConfiguration>
): ConfigurationService | Promise<ConfigurationService> {
  // Pass the getConfiguration function directly to VsCodeConfigurationService
  // It will be called on each config read to get fresh values
  return new VsCodeConfigurationService(getConfiguration);
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
      directory: this.getConfig<string>("export.directory", ""),
      filters: this.getConfig<string[]>("export.filters", []),
      createGitignore: this.getConfig<boolean>("export.createGitignore", true),
      gitignoreContent: this.getConfig<string>(
        "export.gitignoreContent",
        "# Ignore Claude local settings\nsettings.local.yaml\n"
      ),
    };
  }
}
