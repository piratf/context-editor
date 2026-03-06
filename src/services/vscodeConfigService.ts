import type { ConfigurationStore } from "../adapters/configurationStore";
import {
  CategoriesExportConfig,
  CONFIG_KEYS,
  ConfigService,
  DEFAULT_EXPORT_STATE,
  ExportState,
  ExportToDirectoryConfig,
} from "./configService";

/**
 * VS Code configuration service implementation
 */
export class VsCodeConfigService implements ConfigService {
  constructor(private readonly store: ConfigurationStore) {}

  getExportState(): ExportState {
    const git = this.store.get<ExportToDirectoryConfig>(CONFIG_KEYS.DIRECTORY);
    const categories = this.store.get<CategoriesExportConfig>(CONFIG_KEYS.CATEGORIES);

    return {
      directory: git ?? DEFAULT_EXPORT_STATE.directory,
      categories: categories ?? DEFAULT_EXPORT_STATE.categories,
    };
  }

  async setExportState(state: ExportState): Promise<void> {
    await this.store.set(CONFIG_KEYS.DIRECTORY, state.directory);
    await this.store.set(CONFIG_KEYS.CATEGORIES, state.categories);
  }

  getExportSelectedNodes(): string[] {
    return this.store.get<string[]>(CONFIG_KEYS.SELECTED_NODES) ?? [];
  }

  async setExportSelectedNodes(nodeIds: string[]): Promise<void> {
    await this.store.set(CONFIG_KEYS.SELECTED_NODES, nodeIds);
  }

  getExportExpandedNodes(): string[] {
    return this.store.get<string[]>(CONFIG_KEYS.EXPANDED_NODES) ?? [];
  }

  async setExportExpandedNodes(nodeIds: string[]): Promise<void> {
    await this.store.set(CONFIG_KEYS.EXPANDED_NODES, nodeIds);
  }
}
