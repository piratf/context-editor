/**
 * VS Code Directory Picker Implementation
 *
 * Adapter layer implementation of DirectoryPicker service.
 * Wraps vscode.window.showOpenDialog for directory selection.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import type { DirectoryPicker, DirectoryPickerOptions } from "./directoryPicker.js";

export class VsCodeDirectoryPicker implements DirectoryPicker {
  async showDirectoryPicker(options?: DirectoryPickerOptions): Promise<string | undefined> {
    // Build defaultUri if defaultPath is provided and exists as a directory
    let defaultUri: vscode.Uri | undefined;
    if (options?.defaultPath != null) {
      if (fs.existsSync(options.defaultPath) && fs.statSync(options.defaultPath).isDirectory()) {
        defaultUri = vscode.Uri.file(options.defaultPath);
      }
    }

    const dialogOptions: vscode.OpenDialogOptions = {
      canSelectFolders: options?.canSelectFolders ?? true,
      canSelectFiles: options?.canSelectFiles ?? false,
      canSelectMany: options?.canSelectMany ?? false,
      openLabel: options?.openLabel ?? "Select",
      title: options?.title ?? "Select Directory",
    };

    if (defaultUri !== undefined) {
      dialogOptions.defaultUri = defaultUri;
    }

    const uri = await vscode.window.showOpenDialog(dialogOptions);

    return uri?.[0]?.fsPath;
  }
}
