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
 * WebView panel options
 */
export interface WebViewPanelOptions {
  readonly viewType: string;
  readonly title: string;
  readonly column?: number;
  readonly enableScripts?: boolean;
  readonly localResourceRoots?: readonly vscode.Uri[];
}

/**
 * Message from or to webview
 */
export interface WebViewMessage {
  readonly type: string;
  readonly data?: unknown;
}

/**
 * WebView panel interface
 *
 * Abstracts VS Code WebView API for testability.
 * Services depend on this interface, not directly on vscode.window.
 */
export interface WebViewPanel {
  /**
   * Show or reveal the webview panel with content
   * @param options - Panel creation options
   * @param html - HTML content to display in the webview
   */
  show(options: WebViewPanelOptions, html: string): void;

  /**
   * Post a message to the webview
   * @param message - Message to send
   */
  postMessage(message: WebViewMessage): void;

  /**
   * Close and dispose the panel
   */
  dispose(): void;

  /**
   * Register message handler from webview
   * @param handler - Callback when webview sends a message
   */
  onDidReceiveMessage(handler: (message: WebViewMessage) => void): void;
}

/**
 * VS Code WebView panel implementation
 */
export class VsCodeWebViewPanel implements WebViewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private messageHandlers: Array<(message: WebViewMessage) => void> = [];

  constructor(private readonly extensionContext: vscode.ExtensionContext) {}

  show(options: WebViewPanelOptions, html: string): void {
    if (this.panel) {
      this.panel.reveal(options.column);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        options.viewType,
        options.title,
        options.column ?? vscode.ViewColumn.Beside,
        {
          enableScripts: options.enableScripts ?? true,
          localResourceRoots: options.localResourceRoots ?? [
            vscode.Uri.joinPath(this.extensionContext.extensionUri, "out"),
          ],
          retainContextWhenHidden: false,
        }
      );

      // Setup dispose handler
      this.panel.onDidDispose(() => {
        this.panel = null;
        this.messageHandlers = [];
      });

      // Register message handlers from previously registered callbacks
      // This ensures handlers registered before panel creation are still active
      this.panel.webview.onDidReceiveMessage(
        (data: unknown) => {
          const dataRecord = data as Record<string, unknown>;
          const messageType = dataRecord.type;
          const message: WebViewMessage = {
            type: typeof messageType === "string" ? messageType : String(messageType),
            data: dataRecord.data,
          };
          for (const h of this.messageHandlers) {
            h(message);
          }
        },
        null,
        this.extensionContext.subscriptions
      );
    }

    // Set HTML content for the webview
    this.panel.webview.html = html;
  }

  postMessage(message: WebViewMessage): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
      this.messageHandlers = [];
    }
  }

  onDidReceiveMessage(handler: (message: WebViewMessage) => void): void {
    this.messageHandlers.push(handler);

    if (this.panel) {
      this.panel.webview.onDidReceiveMessage(
        (data: unknown) => {
          const dataRecord = data as Record<string, unknown>;
          const messageType = dataRecord.type;
          const message: WebViewMessage = {
            type: typeof messageType === "string" ? messageType : String(messageType),
            data: dataRecord.data,
          };
          for (const h of this.messageHandlers) {
            h(message);
          }
        },
        null,
        this.extensionContext.subscriptions
      );
    }
  }
}
