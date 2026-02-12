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

/**
 * File creation options
 */
export interface FileCreateOptions {
  overwrite: boolean;
  createParentDirectories: boolean;
}

/**
 * File creator interface
 */
export interface FileCreator {
  createFile(uri: SimpleUri, options: FileCreateOptions): Promise<void>;
  createDirectory(uri: SimpleUri): Promise<void>;
}

/**
 * VS Code file creator implementation
 */
export class VsCodeFileCreator implements FileCreator {
  async createFile(uri: SimpleUri, _options: FileCreateOptions): Promise<void> {
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.writeFile(vscodeUri, new Uint8Array());
  }

  async createDirectory(uri: SimpleUri): Promise<void> {
    const vscodeUri = vscode.Uri.file(uri.path);
    await vscode.workspace.fs.createDirectory(vscodeUri);
  }
}

/**
 * Input box options
 */
export interface InputBoxOptions {
  title: string;
  prompt: string;
  placeHolder: string;
  validateInput: (value: string) => string | undefined;
}

/**
 * Input service interface
 */
export interface InputService {
  showInputBox(options: InputBoxOptions): Thenable<string | undefined>;
}

/**
 * VS Code input service implementation
 */
export class VsCodeInputService implements InputService {
  showInputBox(options: InputBoxOptions): Thenable<string | undefined> {
    return vscode.window.showInputBox({
      title: options.title,
      prompt: options.prompt,
      placeHolder: options.placeHolder,
      validateInput: options.validateInput,
    });
  }
}

/**
 * Diff service interface
 */
export interface DiffService {
  /**
   * Open diff view to compare two files
   * @param leftPath - Left side file (existing)
   * @param rightPath - Right side file (config)
   * @param title - Diff view title
   */
  openDiff(leftPath: string, rightPath: string, title: string): Promise<void>;
}

/**
 * VS Code diff service implementation
 */
export class VsCodeDiffService implements DiffService {
  async openDiff(leftPath: string, rightPath: string, title: string): Promise<void> {
    const leftUri = vscode.Uri.file(leftPath);
    const rightUri = vscode.Uri.file(rightPath);
    await vscode.commands.executeCommand("vscode.diff", leftUri, rightUri, title);
  }
}
