/**
 * Directory picker options
 */
export interface DirectoryPickerOptions {
  readonly title?: string;
  readonly canSelectFolders?: boolean;
  readonly canSelectFiles?: boolean;
  readonly canSelectMany?: boolean;
  readonly openLabel?: string;
  readonly defaultPath?: string;
}

/**
 * Directory picker interface
 *
 * Provides directory selection functionality.
 * Service layer interface - implementations in adapters.
 */

export interface DirectoryPicker {
  /**
   * Show directory picker dialog
   * @param options - Picker options
   * @returns Selected directory path, or undefined if cancelled
   */
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<string | undefined>;
}
