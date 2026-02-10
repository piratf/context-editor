/**
 * Service Tokens for Dependency Injection Container
 *
 * Centralized definition of all service identifiers using type-safe tokens.
 * Each token represents a service that can be retrieved from the DI container.
 */

import { ServiceToken } from "./container.js";
import type { VsCodeClipboardService, VsCodeFolderOpener } from "../adapters/ui.js";
import type { VsCodeFileDeleter, VsCodeDialogService } from "../adapters/vscode.js";
import type { CopyService } from "../services/copyService.js";
import type { DeleteService } from "../services/deleteService.js";
import type { OpenVscodeService } from "../services/openVscodeService.js";
import type { NodeService } from "../services/nodeService.js";

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

  // Services (transient - business logic)
  CopyService: new ServiceToken<CopyService>("CopyService"),
  DeleteService: new ServiceToken<DeleteService>("DeleteService"),
  OpenVscodeService: new ServiceToken<OpenVscodeService>("OpenVscodeService"),
  NodeService: new ServiceToken<NodeService>("NodeService"),
} as const;
