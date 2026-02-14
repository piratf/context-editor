/**
 * Export WebView Provider
 *
 * Manages the WebView panel for export functionality.
 * Depends only on WebViewPanel interface, not directly on VS Code API.
 */

import type { ExportPlan, ExportCategory, ExportItem } from "../types/exportPlan";
import type { WebViewPanel, WebViewMessage } from "../adapters/vscode";
import type { ILoggerService } from "./loggerService";
import type { UserInteraction } from "../adapters/ui";

/**
 * Export options from user selection
 */
export interface ExportOptions {
  readonly toGitRepo: boolean;
  readonly targetPath: string;
}

/**
 * Export request with plan and options
 */
export interface ExportRequest {
  readonly plan: ExportPlan;
  readonly options: ExportOptions;
}

/**
 * Export WebView Provider
 *
 * Manages the lifecycle of the export WebView panel.
 * Uses WebViewPanel interface to maintain testability.
 */
export class ExportWebViewProvider {
  private currentPlan: ExportPlan | null = null;

  constructor(
    private readonly webViewPanel: WebViewPanel,
    private readonly logger: ILoggerService,
    private readonly userInteraction: UserInteraction
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

    this.currentPlan = plan;
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
        this.handleExport(message.data as ExportOptions);
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
  private handleExport(options: ExportOptions): void {
    this.logger.debug("Export requested", { options });

    if (!this.currentPlan) {
      this.userInteraction.showInfo("No export plan available");
      return;
    }

    if (options.toGitRepo && (!options.targetPath || options.targetPath.trim().length === 0)) {
      this.userInteraction.showInfo("Please enter a valid git repository path");
      return;
    }

    // Create export request with plan and options
    const request: ExportRequest = {
      plan: this.currentPlan,
      options,
    };

    // TODO: Implement actual export logic with request
    // For now, just log and show success message
    this.logger.debug("Export request", {
      itemCount: request.plan.totalCount,
      toGitRepo: request.options.toGitRepo,
      targetPath: request.options.targetPath,
    });

    this.webViewPanel.postMessage({
      type: "success",
      data: options.toGitRepo
        ? `Export to git repository: ${options.targetPath}`
        : "Export completed",
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
        (category: ExportCategory, index: number) => `
        <div class="category" data-category-id="${category.id}">
          <div class="category-header">
            <span class="category-title">${category.name}</span>
            <span class="category-count">${String(category.items.length)}</span>
          </div>
          <div class="items-grid">
            ${category.items
              .map(
                (item: ExportItem) => `
              <div class="item" data-item-id="${item.id}" title="${item.sourcePath}">
                <span class="item-name">${item.name}</span>
              </div>
            `
              )
              .join("")}
          </div>
          ${index < plan.categories.length - 1 ? '<div class="category-divider"></div>' : ""}
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
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      min-height: 100vh;
    }

    #app {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    /* Header Section */
    .header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }

    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .header-subtitle {
      margin-top: 4px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    /* Main Content */
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    /* Category Section */
    .category {
      margin-bottom: 8px;
    }

    .category-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      margin-bottom: 8px;
    }

    .category-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .category-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-widget-background);
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* Items Grid - Compact layout */
    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 6px;
      padding-left: 12px;
    }

    .item {
      display: flex;
      align-items: center;
      padding: 6px 10px;
      background-color: var(--vscode-widget-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 3px;
      cursor: default;
      transition: background-color 0.1s;
    }

    .item:hover {
      background-color: var(--vscode-widget-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }

    .item-name {
      font-size: 12px;
      color: var(--vscode-foreground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Category Divider */
    .category-divider {
      height: 1px;
      background-color: var(--vscode-panel-border);
      margin: 16px 0 16px 12px;
    }

    /* Footer Input Area */
    .footer {
      padding: 16px 20px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }

    .input-group {
      margin-bottom: 12px;
    }

    .input-group label {
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .input-wrapper {
      display: flex;
      gap: 8px;
    }

    input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border);
      border-radius: 3px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      font-family: var(--vscode-font-family);
      font-size: 12px;
    }

    input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    input:disabled {
      background-color: var(--vscode-input-inactiveBackground);
      color: var(--vscode-input-inactiveForeground);
      cursor: not-allowed;
      opacity: 0.6;
    }

    input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    /* Button Group */
    .button-group {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    button {
      padding: 8px 16px;
      cursor: pointer;
      border: none;
      border-radius: 3px;
      font-family: var(--vscode-font-family);
      font-size: 12px;
      font-weight: 500;
      transition: background-color 0.1s;
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

    .confirm:disabled {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      cursor: not-allowed;
      opacity: 0.5;
    }

    /* Checkbox Group */
    .checkbox-group {
      margin-bottom: 16px;
      text-align: left;
    }

    .checkbox-item {
      gap: 8px;
    }

    .checkbox-item input[type="checkbox"] {
      margin: 0;
      cursor: pointer;
      flex-shrink: 0;
    }

    .checkbox-item label {
      display: inline;
      margin: 0;
      font-size: 13px;
      cursor: pointer;
      user-select: none;
      color: var(--vscode-foreground);
    }

    .input-indented {
      margin-left: 20px;
    }

    /* Scrollbar Styling */
    .main-content::-webkit-scrollbar {
      width: 10px;
    }

    .main-content::-webkit-scrollbar-track {
      background: var(--vscode-editorBackground);
    }

    .main-content::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 5px;
    }

    .main-content::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div id="app">
    <header class="header">
      <h1>Export Claude Resources</h1>
      <div class="header-subtitle">${String(plan.totalCount)} items ready to export</div>
    </header>

    <main class="main-content">
      ${categoriesHtml}
    </main>

    <footer class="footer">
      <div class="checkbox-group">
        <div class="checkbox-item">
          <input type="checkbox" id="export-git" checked />
          <label for="export-git">Export to git repository</label>
        </div>
      </div>

      <div class="input-group input-indented" id="input-group">
        <label for="target-path">Repository Path</label>
        <div class="input-wrapper">
          <input
            id="target-path"
            type="text"
            placeholder="Enter a valid git repository path"
          />
        </div>
      </div>

      <div class="button-group">
        <button class="cancel" id="cancel-btn">Cancel</button>
        <button class="confirm" id="export-btn">Export</button>
      </div>
    </footer>
  </div>

  <script>
    (function() {
      const vscode = acquireVsCodeApi();
      const exportBtn = document.getElementById('export-btn');
      const cancelBtn = document.getElementById('cancel-btn');
      const targetPathInput = document.getElementById('target-path');
      const exportGitCheckbox = document.getElementById('export-git');

      function updateExportButtonState() {
        const anyChecked = exportGitCheckbox.checked;
        exportBtn.disabled = !anyChecked;
        // Enable/disable input based on checkbox state
        targetPathInput.disabled = !exportGitCheckbox.checked;
      }

      exportBtn.addEventListener('click', function() {
        vscode.postMessage({
          type: 'export',
          data: {
            toGitRepo: exportGitCheckbox.checked,
            targetPath: targetPathInput.value
          }
        });
      });

      cancelBtn.addEventListener('click', function() {
        vscode.postMessage({ type: 'close' });
      });

      // Update button and input state when checkbox changes
      exportGitCheckbox.addEventListener('change', updateExportButtonState);

      // Allow Enter key to trigger export
      targetPathInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !exportBtn.disabled) {
          exportBtn.click();
        }
      });

      // Initialize states
      updateExportButtonState();
    })();
  </script>
</body>
</html>`;
  }
}
