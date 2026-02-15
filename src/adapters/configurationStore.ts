/**
 * Configuration store interface
 * Abstracts configuration storage for testability
 */
export interface ConfigurationStore {
  /**
   * Get a configuration value
   * @param key - Configuration key (e.g., "contextEditor.export.git")
   * @returns Value or undefined if not set
   */
  get<T = unknown>(key: string): T | undefined;

  /**
   * Set a configuration value
   * @param key - Configuration key
   * @param value - Value to set
   */
  set(key: string, value: unknown): Promise<void>;
}
