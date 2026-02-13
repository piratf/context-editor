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
import type { ContextMenuRegistry } from "../adapters/contextMenuRegistry.js";
import type { TreeItemFactory } from "../adapters/treeItemFactory.js";
import type { ILoggerService } from "../services/loggerService.js";
import type { IEnvironmentManagerService } from "../services/environmentManagerService.js";
import type { ClaudeCodeRootNodeService } from "../services/claudeCodeRootNodeService.js";

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

  // Services (transient - business logic)
  CopyService: new ServiceToken<CopyService>("CopyService"),
  DeleteService: new ServiceToken<DeleteService>("DeleteService"),
  OpenVscodeService: new ServiceToken<OpenVscodeService>("OpenVscodeService"),
  NodeService: new ServiceToken<NodeService>("NodeService"),
  FileCreationService: new ServiceToken<FileCreationService>("FileCreationService"),
  LoggerService: new ServiceToken<ILoggerService>("LoggerService"),
  EnvironmentManagerService: new ServiceToken<IEnvironmentManagerService>(
    "EnvironmentManagerService"
  ),
  ClaudeCodeRootNodeService: new ServiceToken<ClaudeCodeRootNodeService>(
    "ClaudeCodeRootNodeService"
  ),

  // Menu and Factory
  ContextMenuRegistry: new ServiceToken<ContextMenuRegistry>("ContextMenuRegistry"),
  TreeItemFactory: new ServiceToken<TreeItemFactory>("TreeItemFactory"),
} as const;
