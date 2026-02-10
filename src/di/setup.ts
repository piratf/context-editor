/**
 * DI Container Setup
 *
 * Creates and configures the dependency injection container with all services.
 * Called once during extension activation.
 */

import * as path from "node:path";
import { SimpleDIContainer } from "./container.js";
import { ServiceTokens } from "./tokens.js";
import {
  VsCodeClipboardService,
  VsCodeFolderOpener,
} from "../adapters/ui.js";
import {
  VsCodeFileDeleter,
  VsCodeDialogService,
} from "../adapters/vscode.js";
import { CopyService } from "../services/copyService.js";
import { DeleteService } from "../services/deleteService.js";
import { OpenVscodeService } from "../services/openVscodeService.js";
import { NodeService } from "../services/nodeService.js";
import type { FileSystem } from "../services/nodeService.js";

/**
 * Create and configure the dependency injection container
 *
 * All services are registered as singletons since:
 * - Adapters wrap VS Code APIs (should be single instances)
 * - Services are stateless (only hold dependencies, no runtime state)
 * - Commands capture services via closure at registration time
 *
 * @returns Configured DI container instance
 */
export function createContainer(): SimpleDIContainer {
  const container = new SimpleDIContainer();

  // Register singleton Adapters (VS Code API wrappers)
  container.registerSingleton(
    ServiceTokens.ClipboardService,
    () => new VsCodeClipboardService()
  );

  container.registerSingleton(
    ServiceTokens.FileDeleter,
    () => new VsCodeFileDeleter()
  );

  container.registerSingleton(
    ServiceTokens.DialogService,
    () => new VsCodeDialogService()
  );

  container.registerSingleton(
    ServiceTokens.FolderOpener,
    () => new VsCodeFolderOpener()
  );

  // Register singleton Services (stateless business logic)
  container.registerSingleton(ServiceTokens.CopyService, () => {
    const clipboard = container.get(ServiceTokens.ClipboardService);
    return new CopyService(clipboard);
  });

  container.registerSingleton(ServiceTokens.DeleteService, () => {
    const fileDeleter = container.get(ServiceTokens.FileDeleter);
    const dialog = container.get(ServiceTokens.DialogService);
    return new DeleteService(fileDeleter, dialog);
  });

  container.registerSingleton(ServiceTokens.OpenVscodeService, () => {
    const folderOpener = container.get(ServiceTokens.FolderOpener);
    return new OpenVscodeService(folderOpener);
  });

  container.registerSingleton(ServiceTokens.NodeService, () => {
    const fileSystem: FileSystem = {
      pathSep: path.sep,
      readDirectory: async (dirPath: string) => {
        const fs = await import("node:fs/promises");
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((entry) => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
        }));
      },
    };
    return new NodeService(fileSystem, {});
  });

  return container;
}
