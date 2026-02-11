/**
 * Service Tokens for Dependency Injection Container
 *
 * Centralized definition of all service identifiers using type-safe tokens.
 * Each token represents a service that can be retrieved from the DI container.
 */

import { ServiceToken } from "./container.js";
import type {
  VsCodeClipboardService,
  VsCodeFolderOpener,
  UserInteraction,
} from "../adapters/ui.js";
import type {
  VsCodeFileDeleter,
  VsCodeDialogService,
  FileCreator,
  InputService,
} from "../adapters/vscode.js";
import type { CopyService } from "../services/copyService.js";
import type { DeleteService } from "../services/deleteService.js";
import type { OpenVscodeService } from "../services/openVscodeService.js";
import type { NodeService } from "../services/nodeService.js";
import type { FileCreationService } from "../services/fileCreationService.js";
import type { NodeCollector } from "../services/nodeCollector.js";
import type { BulkCopier } from "../services/bulkCopier.js";
import type { ExportImportService } from "../services/exportImportService.js";
import type { ContextMenuRegistry } from "../adapters/contextMenuRegistry.js";
import type { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { ConfigurationService } from "../adapters/configuration.js";
import type { DirectorySelector } from "../adapters/directorySelector.js";
import type { FileSystemOperations } from "../adapters/fileSystem.js";
import type { ProgressService } from "../adapters/progress.js";

/**
 * All service tokens for the DI container
 *
 * All services are registered as singletons (shared instances)
 */
export const ServiceTokens = {
  // Adapters (singleton - VS Code API wrappers)
  ClipboardService: new ServiceToken<VsCodeClipboardService>("ClipboardService"),
  FileDeleter: new ServiceToken<VsCodeFileDeleter>("FileDeleter"),
  DialogService: new ServiceToken<VsCodeDialogService>("DialogService"),
  FolderOpener: new ServiceToken<VsCodeFolderOpener>("FolderOpener"),
  UserInteraction: new ServiceToken<UserInteraction>("UserInteraction"),
  FileCreator: new ServiceToken<FileCreator>("FileCreator"),
  InputService: new ServiceToken<InputService>("InputService"),
  ConfigurationService: new ServiceToken<ConfigurationService>("ConfigurationService"),
  DirectorySelector: new ServiceToken<DirectorySelector>("DirectorySelector"),
  FileSystemOperations: new ServiceToken<FileSystemOperations>("FileSystemOperations"),
  ProgressService: new ServiceToken<ProgressService>("ProgressService"),

  // Services (transient - business logic)
  CopyService: new ServiceToken<CopyService>("CopyService"),
  DeleteService: new ServiceToken<DeleteService>("DeleteService"),
  OpenVscodeService: new ServiceToken<OpenVscodeService>("OpenVscodeService"),
  NodeService: new ServiceToken<NodeService>("NodeService"),
  FileCreationService: new ServiceToken<FileCreationService>("FileCreationService"),
  NodeCollector: new ServiceToken<NodeCollector>("NodeCollector"),
  BulkCopier: new ServiceToken<BulkCopier>("BulkCopier"),
  ExportImportService: new ServiceToken<ExportImportService>("ExportImportService"),

  // Menu and Factory
  ContextMenuRegistry: new ServiceToken<ContextMenuRegistry>("ContextMenuRegistry"),
  TreeItemFactory: new ServiceToken<TreeItemFactory>("TreeItemFactory"),
} as const;
