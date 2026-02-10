/**
 * VS Code API Adapter
 *
 * This module encapsulates all VS Code API dependencies.
 * It provides interfaces and implementations that can be mocked for testing.
 *
 * Design principles:
 * - All VS Code API calls are centralized here
 * - Core business logic depends only on interfaces
 * - Tests can mock these interfaces without VS Code environment
 */

import * as vscode from "vscode";

/**
 * Simple URI interface for operations
 * Only includes properties we actually use
 */
export interface SimpleUri {
  path: string;
}

/**
 * VS Code Uri adapter
 * Wraps vscode.Uri to provide SimpleUri interface
 */
export class VsCodeUriAdapter implements SimpleUri {
  constructor(private readonly uri: vscode.Uri) {}

  get path(): string {
    return this.uri.fsPath;
  }
}

/**
 * File delete options
 */
export interface DeleteOptions {
  recursive: boolean;
  useTrash: boolean;
}

/**
 * File deleter interface
 */
export interface FileDeleter {
  delete(uri: SimpleUri, options: DeleteOptions): Promise<void>;
}

/**
 * VS Code file deleter implementation
 */
export class VsCodeFileDeleter implements FileDeleter {
  async delete(uri: SimpleUri, options: DeleteOptions): Promise<void> {
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.delete(vscodeUri, options);
  }
}

/**
 * Message options for dialogs
 */
export interface MessageOptions {
  modal?: boolean;
}

/**
 * Dialog service interface
 */
export interface DialogService {
  showWarningMessage(
    message: string,
    options: MessageOptions,
    ...items: string[]
  ): Thenable<string | undefined>;
}

/**
 * VS Code dialog service implementation
 */
export class VsCodeDialogService implements DialogService {
  showWarningMessage(
    message: string,
    options: MessageOptions,
    ...items: string[]
  ): Thenable<string | undefined> {
    return vscode.window.showWarningMessage(message, options, ...items);
  }
}
