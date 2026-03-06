/**
 * Export WebView Provider
 *
 * Manages the WebView panel for export functionality.
 * Depends only on WebViewPanel interface, not directly on VS Code API.
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import type { UserInteraction } from "../adapters/ui";
import type { VsCodeOpener } from "../adapters/ui.js";
import type { WebViewMessage, WebViewPanel } from "../adapters/vscode";
import type { TreeExportPlan } from "../types/exportPlan";
import { ExportOptions, ExportRequest } from "../types/exportRequest";
import type { ConfigService, ExportState } from "./configService.js";
import { DEFAULT_EXPORT_STATE } from "./configService.js";
import type { ExportService } from "./exportService.js";
import type { ILoggerService } from "./loggerService";
import type { DirectoryPicker } from "../adapters/directoryPicker";

/**
 * Export WebView Provider
 *
 * Manages the lifecycle of the export WebView panel.
 * Uses WebViewPanel interface to maintain testability.
 */
export class ExportWebViewProvider {
  private currentPlan: TreeExportPlan | null = null;
  private exportState: ExportState = DEFAULT_EXPORT_STATE;

  constructor(
    private readonly webViewPanel: WebViewPanel,
    private readonly logger: ILoggerService,
    private readonly userInteraction: UserInteraction,
    private readonly configService: ConfigService,
    private readonly exportService: ExportService,
    private readonly folderOpener: VsCodeOpener,
    private readonly directoryPicker: DirectoryPicker
  ) {
    // Register message handler from webview
    this.webViewPanel.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Show export WebView with plan data
   */
  show(plan: TreeExportPlan): void {
    this.logger.debug("Showing export WebView", {
      totalCount: plan.totalCount,
      selectedCount: plan.selectedCount,
    });

    this.currentPlan = plan;
    this.exportState = this.configService.getExportState();

    // Initialize the webview panel first to ensure it exists before generating HTML
    this.webViewPanel.init();

    const html = this.generateHtml();
    this.webViewPanel.show(
      {
        viewType: "contextEditor.export",
        title: "Export Claude Settings",
        column: 2, // ViewColumn.Beside
      },
      html
    );

    const isEmpty = plan.tree.children.length === 0;

    // Get saved state from config
    const savedSelectedIds = this.configService.getExportSelectedNodes();
    const savedExpandedIds = this.configService.getExportExpandedNodes();

    this.webViewPanel.postMessage({
      type: "init",
      data: {
        tree: plan.tree,
        isEmpty,
        selectedNodeIds: savedSelectedIds,
        expandedNodeIds: savedExpandedIds,
      },
    });
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
        void this.handleExport(message.data as ExportOptions & { selectedNodeIds: string[] });
        break;
      case "selectDirectory":
        void this.handleSelectDirectory(message.data as { currentPath?: string });
        break;
      case "stateChanged":
        void this.handleStateChanged(
          message.data as { selectedNodeIds: string[]; expandedNodeIds: string[] }
        );
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
   * Handle state changed from WebView
   */
  private async handleStateChanged(data: {
    selectedNodeIds: string[];
    expandedNodeIds: string[];
  }): Promise<void> {
    await this.configService.setExportSelectedNodes(data.selectedNodeIds);
    await this.configService.setExportExpandedNodes(data.expandedNodeIds);
  }

  /**
   * Handle export action from WebView
   */
  private async handleExport(
    options: ExportOptions & { selectedNodeIds: string[] }
  ): Promise<void> {
    this.logger.debug("Export requested", { options });

    if (!this.currentPlan) {
      this.userInteraction.showInfo("No export plan available");
      return;
    }

    if (options.toDirectory) {
      if (!fs.existsSync(options.toDirectory.targetPath)) {
        this.userInteraction.showInfo("Please enter a valid path");
        return;
      }
    }

    // Save state
    const stateToSave: ExportState = {
      directory: {
        enabled: options.toDirectory !== undefined,
        targetPath: options.toDirectory?.targetPath ?? "",
      },
      categories: this.exportState.categories,
    };
    void this.configService.setExportState(stateToSave);

    const request: ExportRequest = {
      plan: this.currentPlan,
      options,
    };

    this.logger.debug("Export request", {
      selectedCount: options.selectedNodeIds.length,
      targetPath: request.options.toDirectory?.targetPath,
    });

    try {
      const result = await this.exportService.export(request, (progress) => {
        this.webViewPanel.postMessage({ type: "progress", data: progress });
      });

      if (result.success) {
        this.webViewPanel.postMessage({
          type: "exportComplete",
          data: { exportedCount: result.exportedCount },
        });

        const targetPath = request.options.toDirectory?.targetPath;
        if (targetPath != null) {
          const action = await this.userInteraction.showInformationMessageWithActions(
            `Exported ${String(result.exportedCount)} items successfully`,
            "Open Folder"
          );
          if (action === "Open Folder") {
            await this.folderOpener.openFolderInNewWindow(targetPath);
          }
        } else {
          this.userInteraction.showInfo(
            `Exported ${String(result.exportedCount)} items successfully`
          );
        }
      } else {
        this.webViewPanel.postMessage({
          type: "exportComplete",
          data: { exportedCount: result.exportedCount, errors: result.errors.length },
        });
        this.userInteraction.showInfo(
          `Exported ${String(result.exportedCount)} items with ${String(result.errors.length)} errors`
        );
      }
    } catch (error) {
      this.webViewPanel.postMessage({
        type: "exportError",
        data: { message: error instanceof Error ? error.message : String(error) },
      });
      this.logger.error("Export failed", error as Error);
    }

    // Close panel after export
    this.dispose();
  }

  private async handleSelectDirectory(data?: { currentPath?: string }): Promise<void> {
    this.logger.debug("Directory selection requested", { currentPath: data?.currentPath });

    const options: {
      title: string;
      canSelectFolders: boolean;
      canSelectFiles: boolean;
      canSelectMany: boolean;
      openLabel: string;
      defaultPath?: string;
    } = {
      title: "Select Export Directory",
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select",
    };

    if (data?.currentPath !== undefined) {
      options.defaultPath = data.currentPath;
    }

    const path = await this.directoryPicker.showDirectoryPicker(options);

    if (path != null) {
      this.webViewPanel.postMessage({
        type: "directorySelected",
        data: { path },
      });
    }
  }

  /**
   * Generate HTML content for the WebView
   */
  private generateHtml(): string {
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
      .replace("${exportToDirectoryChecked}", this.exportState.directory.enabled ? "checked" : "")
      .replace("${targetPath}", this.exportState.directory.targetPath);
  }
}
