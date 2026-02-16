/**
 * Export WebView Provider
 *
 * Manages the WebView panel for export functionality.
 * Depends only on WebViewPanel interface, not directly on VS Code API.
 */

import * as fs from "fs";
import * as path from "path";
import type { ExportPlan, ExportCategory, ExportItem } from "../types/exportPlan";
import type { WebViewPanel, WebViewMessage } from "../adapters/vscode";
import * as vscode from "vscode";
import type { ILoggerService } from "./loggerService";
import type { UserInteraction } from "../adapters/ui";
import type { ConfigService, ExportState } from "./configService.js";
import { DEFAULT_EXPORT_STATE } from "./configService.js";

export interface ExportToDirectoryOptions {
  readonly targetPath: string;
}

export interface ExportOptions {
  readonly toDirectory?: ExportToDirectoryOptions;
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
  private exportState: ExportState = DEFAULT_EXPORT_STATE;

  constructor(
    private readonly webViewPanel: WebViewPanel,
    private readonly logger: ILoggerService,
    private readonly userInteraction: UserInteraction,
    private readonly configService: ConfigService
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
    this.exportState = this.configService.getExportState();

    // Initialize the webview panel first to ensure it exists before generating HTML
    this.webViewPanel.init();

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

    if (options.toDirectory) {
      // if directory not exist
      if (!fs.existsSync(options.toDirectory.targetPath)) {
        this.userInteraction.showInfo("Please enter a valid path");
        return;
      }
    }

    const stateToSave: ExportState = {
      directory: {
        enabled: options.toDirectory !== undefined,
        targetPath: options.toDirectory?.targetPath ?? "",
      },
      categories: this.exportState.categories,
    };
    void this.configService.setExportState(stateToSave);

    // Create export request with plan and options
    const request: ExportRequest = {
      plan: this.currentPlan,
      options,
    };

    // TODO: Implement actual export logic with request
    // For now, just log and show success message
    this.logger.debug("Export request", {
      itemCount: request.plan.totalCount,
      gitRepo: request.options.toDirectory,
    });

    this.userInteraction.showInfo("Export completed successfully");
    // Close panel after export
    this.dispose();
  }

  /**
   * Generate HTML content for the WebView
   */
  private generateHtml(plan: ExportPlan): string {
    // Generate categories HTML
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

    // Get extension URI and create webview URIs
    const extensionUri = this.webViewPanel.getExtensionUri();
    const stylesUri = this.webViewPanel.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webviews", "export", "styles.css")
    );
    const scriptUri = this.webViewPanel.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, "webviews", "export", "script.js")
    );

    const templatePath = path.join(extensionUri.fsPath, "webviews", "export", "index.html");
    let htmlTemplate: string;
    try {
      htmlTemplate = fs.readFileSync(templatePath, "utf-8");
    } catch (error) {
      this.logger.error("Failed to read HTML template", error as Error);
      throw new Error(`Failed to read HTML template from ${templatePath}`);
    }

    // Replace placeholders in template
    return htmlTemplate
      .replace("${stylesUri}", stylesUri)
      .replace("${scriptUri}", scriptUri)
      .replace("${totalCount}", String(plan.totalCount))
      .replace("${categoriesHtml}", categoriesHtml)
      .replace("${exportToDirectoryChecked}", this.exportState.directory.enabled ? "checked" : "")
      .replace("${targetPath}", this.exportState.directory.targetPath);
  }
}
