/**
 * Command Service - VS Code command execution adapter
 *
 * This service wraps VS Code's command execution API,
 * allowing command layer to execute commands without directly depending on vscode.
 *
 * Architecture:
 * - Service layer: Contains business logic for command execution
 * - Depends on VS Code API (lazy loaded via dynamic import)
 * - No other vscode imports - only command execution
 */

/**
 * Command Service interface
 * Abstracts VS Code command execution for testability
 */
export interface CommandService {
  /**
   * Execute a VS Code command
   * @param command - Command identifier
   * @param args - Command arguments
   * @returns Command result
   */
  executeCommand(command: string, ...args: unknown[]): Promise<unknown>;
}

/**
 * VS Code implementation of CommandService
 * Dynamically imports vscode to avoid direct dependency
 */
export class VsCodeCommandService implements CommandService {
  /**
   * Execute a VS Code command
   */
  async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    // Lazy import vscode to avoid direct dependency
    const vscode = await import("vscode");
    return vscode.commands.executeCommand(command, ...args);
  }
}
