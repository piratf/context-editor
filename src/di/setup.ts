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
  VsCodeUserInteraction,
} from "../adapters/ui.js";
import {
  VsCodeFileDeleter,
  VsCodeDialogService,
} from "../adapters/vscode.js";
import { CopyService } from "../services/copyService.js";
import { DeleteService } from "../services/deleteService.js";
import { OpenVscodeService } from "../services/openVscodeService.js";
import { NodeService } from "../services/nodeService.js";
import { ContextMenuRegistry } from "../adapters/contextMenuRegistry.js";
import { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { FileSystem } from "../services/nodeService.js";
import { ProjectClaudeFileFilter } from "../types/fileFilter.js";

/**
 * Create and configure the dependency injection container
 *
 * All services are registered as singletons since:
 * - Adapters wrap VS Code APIs (should be single instances)
 * - Services are stateless (only hold dependencies, no runtime state)
 * - Commands capture services via closure at registration time
 *
 * Service configuration is centralized here - all options are set during registration.
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

  container.registerSingleton(
    ServiceTokens.UserInteraction,
    () => new VsCodeUserInteraction()
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

  // Register NodeService with configuration
  // Using ProjectClaudeFileFilter for filtering Claude project files
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

    // Configuration: use ProjectClaudeFileFilter
    const filter = new ProjectClaudeFileFilter();

    return new NodeService(fileSystem, { filter });
  });

  // Register ContextMenuRegistry (depends on container for accessing services)
  // Must be registered after all services it depends on
  container.registerSingleton(ServiceTokens.ContextMenuRegistry, () => {
    return new ContextMenuRegistry(container);
  });

  // Register TreeItemFactory (depends on ContextMenuRegistry)
  container.registerSingleton(ServiceTokens.TreeItemFactory, () => {
    const menuRegistry = container.get(ServiceTokens.ContextMenuRegistry);
    return new TreeItemFactory(menuRegistry);
  });

  // Initialize all singleton services immediately
  // This detects circular dependencies and ensures all services are ready
  container.initializeSingletons();

  return container;
}
