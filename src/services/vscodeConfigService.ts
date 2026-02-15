import type { ConfigurationStore } from "../adapters/configurationStore";
import {
  CategoriesExportConfig,
  CONFIG_KEYS,
  ConfigService,
  DEFAULT_EXPORT_STATE,
  ExportState,
  GitExportConfig,
} from "./configService";

/**
 * VS Code configuration service implementation
 */
export class VsCodeConfigService implements ConfigService {
  constructor(private readonly store: ConfigurationStore) {}

  getExportState(): ExportState {
    const git = this.store.get<GitExportConfig>(CONFIG_KEYS.GIT);
    const categories = this.store.get<CategoriesExportConfig>(CONFIG_KEYS.CATEGORIES);

    return {
      git: git ?? DEFAULT_EXPORT_STATE.git,
      categories: categories ?? DEFAULT_EXPORT_STATE.categories,
    };
  }

  async setExportState(state: ExportState): Promise<void> {
    await this.store.set(CONFIG_KEYS.GIT, state.git);
    await this.store.set(CONFIG_KEYS.CATEGORIES, state.categories);
  }
}
