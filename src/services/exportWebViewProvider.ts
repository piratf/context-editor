/**
 * Export WebView Provider
 *
 * Manages the WebView panel for export functionality.
 * Depends only on WebViewPanel interface, not directly on VS Code API.
 */

import type { ExportPlan, ExportCategory, ExportItem } from "../types/exportPlan";
import type { WebViewPanel, WebViewMessage } from "../adapters/vscode";
import type { ILoggerService } from "./loggerService";

/**
 * Export WebView Provider
 *
 * Manages the lifecycle of the export WebView panel.
 * Uses WebViewPanel interface to maintain testability.
 */
export class ExportWebViewProvider {
  constructor(
    private readonly webViewPanel: WebViewPanel,
    private readonly logger: ILoggerService
  ) {
    // Register message handler from webview
    this.webViewPanel.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Show export WebView with plan data
   */
  show(plan: ExportPlan): void {
    this.logger.debug("Showing export WebView", {
      itemCount: plan.totalCount,
      categories: plan.categories.map((c) => c.name).join(", "),
    });

    const html = this.generateHtml(plan);
    this.webViewPanel.show(
      {
        viewType: "contextEditor.export",
        title: "Export Claude Resources",
        column: 2, // ViewColumn.Beside
      },
      html
    );
  }

  /**
   * Close and dispose the WebView panel
   */
  dispose(): void {
    this.logger.debug("Disposing export WebView");
    this.webViewPanel.dispose();
  }

  /**
   * Handle messages from the WebView
   */
  private handleMessage(message: WebViewMessage): void {
    this.logger.debug("Received message from WebView", { type: message.type });

    switch (message.type) {
      case "export":
        this.handleExport(message.data as string);
        break;
      case "close":
        this.dispose();
        break;
      case "error":
        this.logger.error("WebView error", new Error(String(message.data)));
        break;
    }
  }

  /**
   * Handle export action from WebView
   */
  private handleExport(targetPath: string): void {
    this.logger.debug("Export requested", { targetPath });

    if (!targetPath || targetPath.trim().length === 0) {
      this.webViewPanel.postMessage({
        type: "error",
        data: "Please enter a target path",
      });
      return;
    }

    // TODO: Implement actual export logic
    // For now, just log and show success message
    this.webViewPanel.postMessage({
      type: "success",
      data: `Export would proceed to: ${targetPath}`,
    });

    // Close panel after export
    this.dispose();
  }

  /**
   * Generate HTML content for the WebView
   */
  private generateHtml(plan: ExportPlan): string {
    const categoriesHtml = plan.categories
      .map(
        (category: ExportCategory) => `
        <div class="category" data-category-id="${category.id}">
          <div class="category-title">${category.name}</div>
          ${category.items
            .map(
              (item: ExportItem) => `
            <div class="item" data-item-id="${item.id}">
              <div class="item-name">${item.name}</div>
            </div>
          `
            )
            .join("")}
        </div>
      `
      )
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export Claude Resources</title>
  <style>
    body {
      padding: 20px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    .category {
      margin-bottom: 24px;
    }
    .category-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }
    .item {
      padding: 8px 12px;
      margin: 4px 0;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      background-color: var(--vscode-editor-background);
    }
    .item-name {
      font-size: 14px;
      color: var(--vscode-foreground);
    }
    .input-area {
      margin-top: 24px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      box-sizing: border-box;
    }
    input:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    .button-group {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      justify-content: flex-end;
    }
    button {
      padding: 8px 16px;
      cursor: pointer;
      border: none;
      border-radius: 4px;
      font-family: var(--vscode-font-family);
      font-size: 13px;
    }
    .cancel {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .cancel:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .confirm {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .confirm:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <div id="app">
    ${categoriesHtml}
    <div class="input-area">
      <label for="target-path">Export Destination</label>
      <input
        id="target-path"
        type="text"
        placeholder="Enter target directory path"
      />
    </div>
    <div class="button-group">
      <button class="cancel" id="cancel-btn">Cancel</button>
      <button class="confirm" id="export-btn">Export</button>
    </div>
  </div>
  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const exportBtn = document.getElementById('export-btn');
      const cancelBtn = document.getElementById('cancel-btn');
      const targetPathInput = document.getElementById('target-path');

      exportBtn.addEventListener('click', function() {
        vscode.postMessage({
          type: 'export',
          data: targetPathInput.value
        });
      });

      cancelBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'close' });
      });
    })();
  </script>
</body>
</html>`;
  }
}
