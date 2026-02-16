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
   * Initialize the webview panel (create if not exists)
   * This ensures the panel is ready before generating HTML content
   */
  init(): void;

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

  /**
   * Convert a local file URI to a webview URI
   * @param uri - Local file URI to convert
   * @returns Webview-ready URI string
   */
  asWebviewUri(uri: vscode.Uri): string;

  /**
   * Get the extension URI
   * @returns Extension URI
   */
  getExtensionUri(): vscode.Uri;
}

/**
 * VS Code WebView panel implementation
 *
 * Uses delayed registration pattern:
 * - Handlers are stored immediately when registered
 * - Actual webview registration happens in show() (single registration point)
 * - This ensures timing-independent handler registration
 */
export class VsCodeWebViewPanel implements WebViewPanel {
  private panel: vscode.WebviewPanel | null = null;
  private messageHandlers: Array<(message: WebViewMessage) => void> = [];
  private isHandlerRegistered = false;

  constructor(private readonly extensionContext: vscode.ExtensionContext) {}

  /**
   * Register a message handler
   * Handler is stored immediately, actual registration happens when panel is shown
   */
  onDidReceiveMessage(handler: (message: WebViewMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Initialize the webview panel (create if not exists)
   * This ensures the panel is ready before generating HTML content
   */
  init(): void {
    if (this.panel) {
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "contextEditor.export.init",
      "Export Claude Resources",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionContext.extensionUri, "webviews")],
        retainContextWhenHidden: false,
      }
    );

    this.panel.onDidDispose((): void => {
      this.panel = null;
      this.isHandlerRegistered = false;
    });

    this.registerHandlers();
  }

  /**
   * Register all stored handlers to the webview
   * This is the single registration point for all handlers
   */
  private registerHandlers(): void {
    if (!this.panel || this.isHandlerRegistered) {
      return;
    }

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

    this.isHandlerRegistered = true;
  }

  show(options: WebViewPanelOptions, html: string): void {
    if (this.panel) {
      this.panel.reveal(options.column);
      // Set HTML content for the webview
      this.panel.webview.html = html;
    }
  }

  postMessage(message: WebViewMessage): void {
    if (this.panel) {
      this.panel.webview.postMessage(message);
    }
  }

  getExtensionUri(): vscode.Uri {
    return this.extensionContext.extensionUri;
  }

  asWebviewUri(uri: vscode.Uri): string {
    if (!this.panel) {
      throw new Error("WebView panel is not initialized");
    }
    return this.panel.webview.asWebviewUri(uri).toString();
  }

  dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
      this.isHandlerRegistered = false;
      // Keep handlers for reuse
    }
  }
}
