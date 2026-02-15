import { ConfigurationStore } from "./configurationStore";
import vscode from "vscode";

/**
 * VS Code configuration store implementation
 * Supports nested object storage
 */
export class VsCodeConfigurationStore implements ConfigurationStore {
  get<T = unknown>(key: string): T | undefined {
    const parts = key.split(".");
    const scope = parts[0];
    const section = parts.slice(1).join(".");

    const config = vscode.workspace.getConfiguration(scope);
    return config.get<T>(section);
  }

  async set(key: string, value: unknown): Promise<void> {
    const parts = key.split(".");
    const scope = parts[0];
    const section = parts.slice(1).join(".");

    const config = vscode.workspace.getConfiguration(scope);
    await config.update(section, value, vscode.ConfigurationTarget.Global);
  }
}
