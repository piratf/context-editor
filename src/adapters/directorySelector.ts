/**
 * Directory Selector Adapter
 *
 * Provides interface-based access to VS Code directory selection dialogs.
 * Enables testing with mock implementations.
 */

import type * as vscode from "vscode";
import * as os from "node:os";

/**
 * Directory selector options
 */
export interface DirectorySelectorOptions {
  /** Title for the dialog */
  title: string;
  /** Can select files */
  canSelectFiles?: boolean;
  /** Can select folders */
  canSelectFolders?: boolean;
  /** Can select many */
  canSelectMany?: boolean;
  /** Open label */
  openLabel?: string;
}

/**
 * Selected directory URI
 */
export interface SelectedUri {
  /** File system path */
  path: string;
  /** Optional scheme (e.g., "file") */
  scheme?: string;
}

/**
 * Directory selector interface
 */
export interface DirectorySelector {
  /**
   * Show directory selection dialog
   *
   * @param options - Dialog options
   * @returns Selected URI or undefined if cancelled
   */
  selectDirectory(options: DirectorySelectorOptions): Promise<SelectedUri | undefined>;
}

/**
 * VS Code directory selector implementation
 */
export class VsCodeDirectorySelector implements DirectorySelector {
  async selectDirectory(options: DirectorySelectorOptions): Promise<SelectedUri | undefined> {
    const uri = await this.showOpenDialog(options);
    if (!uri) {
      return undefined;
    }
    return { path: uri.fsPath, scheme: uri.scheme };
  }

  private showOpenDialog(options: DirectorySelectorOptions): Promise<vscode.Uri | undefined> {
    return new Promise((resolve) => {
      const voidResult = import("vscode").then((vscode) => {
        const dialogOptions: vscode.OpenDialogOptions = {
          title: options.title,
          canSelectFiles: options.canSelectFiles ?? false,
          canSelectFolders: options.canSelectFolders ?? true,
          canSelectMany: options.canSelectMany ?? false,
          defaultUri: vscode.Uri.file(os.homedir()),
        };
        if (options.openLabel !== undefined) {
          dialogOptions.openLabel = options.openLabel;
        }
        return vscode.window.showOpenDialog(dialogOptions);
      });
      void voidResult.then((uris) => {
        if (uris && uris.length > 0) {
          resolve(uris[0]);
        } else {
          resolve(undefined);
        }
      });
    });
  }
}

/**
 * Mock directory selector for testing
 */
export class MockDirectorySelector implements DirectorySelector {
  private selectedPath: SelectedUri | undefined;
  private shouldCancel = false;

  setMockPath(path: string | undefined): void {
    if (path !== undefined && path !== "") {
      this.selectedPath = { path };
      this.shouldCancel = false;
    } else {
      this.selectedPath = undefined;
      this.shouldCancel = true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async selectDirectory(): Promise<SelectedUri | undefined> {
    if (this.shouldCancel) {
      return undefined;
    }
    return this.selectedPath;
  }
}
