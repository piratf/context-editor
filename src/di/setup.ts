/**
 * DI Container Setup
 *
 * Creates and configures dependency injection container with all services.
 * Called once during extension activation.
 */
import * as path from "node:path";
import type * as vscode from "vscode";
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
  VsCodeFileCreator,
  VsCodeInputService,
} from "../adapters/vscode.js";
import { createConfigurationService } from "../adapters/configuration.js";
import { VsCodeDirectorySelector } from "../adapters/directorySelector.js";
import { VsCodeFileSystemOperations } from "../adapters/fileSystem.js";
import { VsCodeProgressService } from "../adapters/progress.js";
import { VsCodeCommandService } from "../services/commandService.js";
import { CopyService } from "../services/copyService.js";
import { DeleteService } from "../services/deleteService.js";
import { OpenVscodeService } from "../services/openVscodeService.js";
import { NodeService } from "../services/nodeService.js";
import { FileCreationService } from "../services/fileCreationService.js";
import { FileAccessService } from "../services/fileAccessService.js";
import { ContextMenuRegistry } from "../adapters/contextMenuRegistry.js";
import { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { FileSystem } from "../services/nodeService.js";
import { ProjectClaudeFileFilter } from "../types/fileFilter.js";
import { ExportPathCalculator } from "../services/exportPathCalculator.js";
import { ExportScanner } from "../services/exportScanner.js";
import { FsExportExecutor } from "../services/exportExecutor.js";
import { ExportImportService } from "../services/exportImportService.js";

/**
 * Create and configure dependency injection container
 *
 * All services are registered as singletons since:
 * - Adapters wrap VS Code APIs (should be single instances)
 * - Services are stateless (only hold dependencies, no runtime state)
 * - Commands capture services via closure at registration time
 *
 * Service configuration is centralized here - all options are set during registration.
 *
 * @param vscodeModule - VS Code module (passed in to avoid require in ESM)
 * @returns Configured DI container instance
 */
export function createContainer(vscodeModule: typeof vscode): SimpleDIContainer {
  const container = new SimpleDIContainer();

  // Register singleton Adapters (VS Code API wrappers)
  container.registerSingleton(ServiceTokens.ClipboardService, () => new VsCodeClipboardService());

  container.registerSingleton(ServiceTokens.FileDeleter, () => new VsCodeFileDeleter());

  container.registerSingleton(ServiceTokens.DialogService, () => new VsCodeDialogService());

  container.registerSingleton(ServiceTokens.FolderOpener, () => new VsCodeFolderOpener());

  container.registerSingleton(ServiceTokens.UserInteraction, () => new VsCodeUserInteraction());

  container.registerSingleton(ServiceTokens.FileCreator, () => new VsCodeFileCreator());

  container.registerSingleton(ServiceTokens.InputService, () => new VsCodeInputService());

  // Register Export/Import adapters
  container.registerSingleton(ServiceTokens.ConfigurationService, () => {
    return createConfigurationService(() => {
      return vscodeModule.workspace.getConfiguration("contextEditor");
    });
  });

  container.registerSingleton(ServiceTokens.DirectorySelector, () => new VsCodeDirectorySelector());

  container.registerSingleton(
    ServiceTokens.FileSystemOperations,
    () => new VsCodeFileSystemOperations()
  );

  container.registerSingleton(ServiceTokens.ProgressService, () => new VsCodeProgressService());

  // Register cross-platform services
  container.registerSingleton(ServiceTokens.FileAccessService, () => new FileAccessService());

  container.registerSingleton(ServiceTokens.CommandService, () => new VsCodeCommandService());

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

  container.registerSingleton(ServiceTokens.FileCreationService, () => {
    const fileCreator = container.get(ServiceTokens.FileCreator);
    const inputService = container.get(ServiceTokens.InputService);
    return new FileCreationService(fileCreator, inputService);
  });

  // Register new export services
  container.registerSingleton(ServiceTokens.ExportPathCalculator, () => {
    return new ExportPathCalculator();
  });

  container.registerSingleton(ServiceTokens.ExportScanner, () => {
    const nodeService = container.get(ServiceTokens.NodeService);
    const pathCalculator = container.get(ServiceTokens.ExportPathCalculator);
    return new ExportScanner(nodeService, pathCalculator);
  });

  container.registerSingleton(ServiceTokens.ExportExecutor, () => {
    const fileAccess = container.get(ServiceTokens.FileAccessService);
    return new FsExportExecutor(fileAccess);
  });

  // Register ExportImportService (using new export components)
  container.registerSingleton(ServiceTokens.ExportImportService, () => {
    const fileAccessService = container.get(ServiceTokens.FileAccessService);
    const nodeService = container.get(ServiceTokens.NodeService);
    const configService = container.get(ServiceTokens.ConfigurationService);
    return new ExportImportService(fileAccessService, nodeService, configService);
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
