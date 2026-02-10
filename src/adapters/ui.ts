/**
 * UI Interaction Adapters
 *
 * Abstracts VS Code UI operations for testability.
 * Services depend on these interfaces rather than directly on vscode API.
 *
 * Architecture:
 * - Interface-based dependency injection
 * - VS Code implementations in adapters
 * - Services can be tested with mock implementations
 */

import * as vscode from "vscode";

/**
 * Quick pick item data
 */
export interface QuickPickItem<T = unknown> {
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly picked?: boolean;
  readonly alwaysShow?: boolean;
  /** Arbitrary data attached to the item */
  readonly data?: T;
}

/**
 * Message options for dialogs
 */
export interface MessageOptions {
  readonly modal?: boolean;
}

/**
 * User interaction interface
 *
 * Abstracts all UI interactions for testability.
 * Services depend on this interface, not directly on vscode.window.
 */
export interface UserInteraction {
  /**
   * Show a quick pick menu to the user
   * @param items - Array of quick pick items
   * @param options - Quick pick options
   * @returns Selected item or undefined if cancelled
   */
  showQuickPick<T = unknown>(
    items: QuickPickItem<T>[],
    options?: {
      readonly title?: string;
      readonly placeHolder?: string;
      readonly canPickMany?: boolean;
    }
  ): Promise<QuickPickItem<T> | undefined>;

  /**
   * Show an information message
   * @param message - Message to display
   */
  showInformationMessage(message: string): Promise<void>;

  /**
   * Show a warning message with optional buttons
   * @param message - Message to display
   * @param options - Message options
   * @param buttons - Button labels
   * @returns Clicked button or undefined if dismissed
   */
  showWarningMessage(
    message: string,
    options: MessageOptions,
    ...buttons: string[]
  ): Promise<string | undefined>;

  /**
   * Show an error message
   * @param message - Message to display
   */
  showErrorMessage(message: string): Promise<void>;

  /**
   * Write text to clipboard
   * @param text - Text to write
   */
  writeText(text: string): Promise<void>;
}

/**
 * VS Code implementation of UserInteraction
 */
export class VsCodeUserInteraction implements UserInteraction {
  async showQuickPick<T = unknown>(
    items: QuickPickItem<T>[],
    options?: {
      readonly title?: string;
      readonly placeHolder?: string;
      readonly canPickMany?: boolean;
    }
  ): Promise<QuickPickItem<T> | undefined> {
    const vscodeItems: vscode.QuickPickItem[] = items.map((item) => ({
      label: item.label,
      description: item.description ?? "",
      detail: item.detail ?? "",
      picked: item.picked ?? false,
      alwaysShow: item.alwaysShow ?? false,
    }));

    const quickPickOptions: vscode.QuickPickOptions = {};
    if (options?.title !== undefined) {
      quickPickOptions.title = options.title;
    }
    if (options?.placeHolder !== undefined) {
      quickPickOptions.placeHolder = options.placeHolder;
    }
    if (options?.canPickMany !== undefined) {
      quickPickOptions.canPickMany = options.canPickMany;
    }

    const selected = await vscode.window.showQuickPick(vscodeItems, quickPickOptions);

    if (!selected) {
      return undefined;
    }

    // Find and return original item with data
    return items.find((item) => item.label === selected.label);
  }

  async showInformationMessage(message: string): Promise<void> {
    await vscode.window.showInformationMessage(message);
  }

  async showWarningMessage(
    message: string,
    options: MessageOptions,
    ...buttons: string[]
  ): Promise<string | undefined> {
    return vscode.window.showWarningMessage(message, options, ...buttons);
  }

  async showErrorMessage(message: string): Promise<void> {
    await vscode.window.showErrorMessage(message);
  }

  async writeText(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
  }
}

/**
 * Clipboard service interface
 *
 * Separate interface for clipboard operations
 */
export interface ClipboardService {
  writeText(text: string): Promise<void>;
}

/**
 * VS Code clipboard service implementation
 */
export class VsCodeClipboardService implements ClipboardService {
  async writeText(text: string): Promise<void> {
    await vscode.env.clipboard.writeText(text);
  }
}

/**
 * VS Code opener interface
 *
 * Abstracts VS Code API for opening folders in new windows
 */
export interface VsCodeOpener {
  openFolderInNewWindow(folderPath: string): Promise<void>;
}

/**
 * VS Code opener implementation
 */
export class VsCodeFolderOpener implements VsCodeOpener {
  async openFolderInNewWindow(folderPath: string): Promise<void> {
    const uri = vscode.Uri.file(folderPath);
    await vscode.commands.executeCommand("vscode.openFolder", uri, {
      forceNewWindow: true,
    });
  }
}
