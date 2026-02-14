import { ServiceTokens } from "../di/tokens";
import { DIContainer } from "../di/container";
import vscode from "vscode";

export function registerExportCommand(
  context: vscode.ExtensionContext,
  container: DIContainer
): void {
  const exportCommand = vscode.commands.registerCommand("contextEditor.export", async () => {
    const scanner = container.get(ServiceTokens.ExportScannerService);
    const webView = container.get(ServiceTokens.ExportWebViewProvider);
    const userInteraction = container.get(ServiceTokens.UserInteraction);

    const plan = await scanner.scan();
    if (plan.totalCount === 0) {
      userInteraction.showInfo("No items found to export");
      return;
    }

    webView.show(plan);
  });
  context.subscriptions.push(exportCommand);
}
