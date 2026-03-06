import { ServiceTokens } from "../di/tokens";
import { DIContainer } from "../di/container";
import vscode from "vscode";
import { ExportTreeScanner } from "../services/exportTreeScanner.js";

export function registerExportCommand(
  context: vscode.ExtensionContext,
  container: DIContainer
): void {
  const exportCommand = vscode.commands.registerCommand("contextEditor.export", async () => {
    const webView = container.get(ServiceTokens.ExportWebViewProvider);
    const unifiedProvider = container.get(ServiceTokens.UnifiedProvider);
    const logger = container.get(ServiceTokens.LoggerService);
    const configService = container.get(ServiceTokens.ConfigService);

    // Get saved state from configuration
    const savedSelectedIds = configService.getExportSelectedNodes();
    const savedExpandedIds = configService.getExportExpandedNodes();

    // Create tree scanner
    const treeScanner = new ExportTreeScanner(
      unifiedProvider,
      logger,
      savedSelectedIds,
      savedExpandedIds
    );

    // Scan the tree
    const plan = await treeScanner.scan();

    // Show the webview
    webView.show(plan);
  });
  context.subscriptions.push(exportCommand);
}
