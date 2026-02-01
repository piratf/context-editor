/**
 * Claude Code configuration file type definitions.
 * Based on: https://code.claude.com/docs/en/settings
 */

/**
 * Represents a permission rule for tool access control.
 * Format: "Tool" or "Tool(specifier)"
 * Examples: "Bash", "Read(./.env)", "WebFetch(domain:example.com)"
 */
export type PermissionRule = string;

/**
 * Permission settings controlling tool access.
 */
export interface Permissions {
  /**
   * Array of permission rules to allow tool use.
   */
  readonly allow?: readonly PermissionRule[];

  /**
   * Array of permission rules to ask for confirmation upon tool use.
   */
  readonly ask?: readonly PermissionRule[];

  /**
   * Array of permission rules to deny tool use.
   * Deny rules take precedence over allow rules.
   */
  readonly deny?: readonly PermissionRule[];

  /**
   * Additional working directories that Claude has access to.
   */
  readonly additionalDirectories?: readonly string[];

  /**
   * Default permission mode when opening Claude Code.
   */
  readonly defaultMode?: "acceptEdits" | "bypassPermissions" | "ask";

  /**
   * Control whether bypassPermissions mode can be activated.
   */
  readonly disableBypassPermissionsMode?: "disable";
}

/**
 * Network restrictions for sandbox.
 */
export interface SandboxNetwork {
  /**
   * Unix socket paths accessible in sandbox.
   */
  readonly allowUnixSockets?: readonly string[];

  /**
   * Allow all Unix socket connections in sandbox.
   */
  readonly allowAllUnixSockets?: boolean;

  /**
   * Allow binding to localhost ports (macOS only).
   */
  readonly allowLocalBinding?: boolean;

  /**
   * Array of domains to allow for outbound network traffic.
   * Supports wildcards (e.g., "*.example.com").
   */
  readonly allowedDomains?: readonly string[];

  /**
   * HTTP proxy port.
   */
  readonly httpProxyPort?: number;

  /**
   * SOCKS5 proxy port.
   */
  readonly socksProxyPort?: number;
}

/**
 * Sandbox settings for bash command isolation.
 */
export interface Sandbox {
  /**
   * Enable bash sandboxing (macOS, Linux, and WSL2).
   */
  readonly enabled?: boolean;

  /**
   * Auto-approve bash commands when sandboxed.
   */
  readonly autoAllowBashIfSandboxed?: boolean;

  /**
   * Commands that should run outside of the sandbox.
   */
  readonly excludedCommands?: readonly string[];

  /**
   * Allow commands to run outside the sandbox via dangerouslyDisableSandbox.
   */
  readonly allowUnsandboxedCommands?: boolean;

  /**
   * Enable weaker sandbox for unprivileged Docker environments.
   * Reduces security.
   */
  readonly enableWeakerNestedSandbox?: boolean;

  /**
   * Network restrictions.
   */
  readonly network?: SandboxNetwork;
}

/**
 * Attribution settings for git commits and pull requests.
 */
export interface Attribution {
  /**
   * Attribution for git commits, including any trailers.
   * Empty string hides commit attribution.
   */
  readonly commit?: string;

  /**
   * Attribution for pull request descriptions.
   * Empty string hides pull request attribution.
   */
  readonly pr?: string;
}

/**
 * Custom file suggestion configuration.
 */
export interface FileSuggestion {
  /**
   * Type of file suggestion (currently only "command" is supported).
   */
  readonly type: "command";

  /**
   * Path to command script for file autocomplete.
   */
  readonly command: string;
}

/**
 * Custom status line configuration.
 */
export interface StatusLine {
  /**
   * Type of status line (currently only "command" is supported).
   */
  readonly type: "command";

  /**
   * Path to command script for status line display.
   */
  readonly command: string;
}

/**
 * Spinner customization settings.
 */
export interface SpinnerSettings {
  /**
   * Mode: "replace" to use only your verbs, "append" to add to defaults.
   */
  readonly mode?: "replace" | "append";

  /**
   * Custom action verbs to display in the spinner.
   */
  readonly verbs?: readonly string[];
}

/**
 * Main settings.json configuration structure.
 */
export interface ClaudeSettings {
  /**
   * Custom script to generate an auth value for API requests.
   */
  readonly apiKeyHelper?: string;

  /**
   * Sessions inactive longer than this period are deleted at startup.
   * Setting to 0 immediately deletes all sessions. Default: 30 days.
   */
  readonly cleanupPeriodDays?: number;

  /**
   * Announcements to display to users at startup.
   */
  readonly companyAnnouncements?: readonly string[];

  /**
   * Environment variables applied to every session.
   */
  readonly env?: Readonly<Record<string, string>>;

  /**
   * Git commit and PR attribution settings.
   */
  readonly attribution?: Attribution;

  /**
   * Deprecated: Use attribution instead.
   */
  readonly includeCoAuthoredBy?: boolean;

  /**
   * Permission control settings.
   */
  readonly permissions?: Permissions;

  /**
   * Custom commands to run at lifecycle events.
   */
  readonly hooks?: unknown;

  /**
   * Disable all hooks.
   */
  readonly disableAllHooks?: boolean;

  /**
   * Only allow managed hooks (managed settings only).
   */
  readonly allowManagedHooksOnly?: boolean;

  /**
   * Override the default model to use for Claude Code.
   */
  readonly model?: string;

  /**
   * Script to generate dynamic OpenTelemetry headers.
   */
  readonly otelHeadersHelper?: string;

  /**
   * Custom status line configuration.
   */
  readonly statusLine?: StatusLine;

  /**
   * Custom file autocomplete configuration.
   */
  readonly fileSuggestion?: FileSuggestion;

  /**
   * Control whether @ file picker respects .gitignore patterns. Default: true.
   */
  readonly respectGitignore?: boolean;

  /**
   * Configure an output style to adjust the system prompt.
   */
  readonly outputStyle?: string;

  /**
   * Restrict login method: "claudeai" or "console".
   */
  readonly forceLoginMethod?: "claudeai" | "console";

  /**
   * Specify organization UUID to auto-select during login.
   */
  readonly forceLoginOrgUUID?: string;

  /**
   * Auto-approve all MCP servers from .mcp.json files.
   */
  readonly enableAllProjectMcpServers?: boolean;

  /**
   * List of specific MCP servers from .mcp.json to approve.
   */
  readonly enabledMcpjsonServers?: readonly string[];

  /**
   * List of specific MCP servers from .mcp.json to reject.
   */
  readonly disabledMcpjsonServers?: readonly string[];

  /**
   * Allowlist of MCP servers users can configure (managed settings only).
   */
  readonly allowedMcpServers?: readonly { serverName: string }[];

  /**
   * Denylist of MCP servers (managed settings only).
   */
  readonly deniedMcpServers?: readonly { serverName: string }[];

  /**
   * Allowlist of plugin marketplaces (managed settings only).
   */
  readonly strictKnownMarketplaces?: readonly { source: string; repo: string }[];

  /**
   * Custom script that modifies the .aws directory.
   */
  readonly awsAuthRefresh?: string;

  /**
   * Custom script that outputs JSON with AWS credentials.
   */
  readonly awsCredentialExport?: string;

  /**
   * Enable extended thinking by default for all sessions.
   */
  readonly alwaysThinkingEnabled?: boolean;

  /**
   * Customize where plan files are stored. Relative to project root.
   */
  readonly plansDirectory?: string;

  /**
   * Show turn duration messages after responses. Default: true.
   */
  readonly showTurnDuration?: boolean;

  /**
   * Customize action verbs in spinner and turn duration messages.
   */
  readonly spinnerVerbs?: SpinnerSettings;

  /**
   * Claude's preferred response language.
   */
  readonly language?: string;

  /**
   * Release channel: "stable" or "latest" (default).
   */
  readonly autoUpdatesChannel?: "stable" | "latest";

  /**
   * Show tips in spinner while Claude is working. Default: true.
   */
  readonly spinnerTipsEnabled?: boolean;

  /**
   * Enable terminal progress bar. Default: true.
   */
  readonly terminalProgressBarEnabled?: boolean;

  /**
   * Sandbox settings.
   */
  readonly sandbox?: Sandbox;
}

/**
 * MCP server environment configuration.
 */
export interface McpEnv {
  readonly [key: string]: string;
}

/**
 * MCP server configuration.
 */
export interface McpServer {
  /**
   * Environment variables for the MCP server.
   */
  readonly env?: McpEnv;

  /**
   * Command to run the MCP server.
   */
  readonly command?: string;

  /**
   * Arguments to pass to the MCP server command.
   */
  readonly args?: readonly string[];

  /**
   * URL for stdio-based MCP server connection.
   */
  readonly url?: string;
}

/**
 * MCP servers configuration.
 */
export type McpServers = Readonly<Record<string, McpServer>>;

/**
 * Project state entry in .claude.json.
 */
export interface ClaudeProjectState {
  /**
   * Allowed tools for this project.
   */
  readonly allowedTools?: readonly string[];

  /**
   * Trust settings for this project.
   */
  readonly trust?: unknown;
}

/**
 * User-scoped MCP server configuration in .claude.json.
 */
export interface ClaudeUserMcp {
  /**
   * User-scoped MCP servers.
   */
  readonly mcpServers?: McpServers;
}

/**
 * Per-project state entry in .claude.json.
 */
export interface ClaudeProjectEntry {
  /**
   * Absolute path to the project.
   */
  readonly path: string;

  /**
   * Project-specific state (allowed tools, trust settings).
   */
  readonly state?: ClaudeProjectState;

  /**
   * Per-project MCP servers configuration.
   */
  readonly mcpServers?: McpServers;
}

/**
 * Projects entry in .claude.json.
 * Can be a record of project path to config, or an array of project entries.
 */
export type ClaudeProjects = Readonly<Record<string, ClaudeProjectEntry>> | readonly ClaudeProjectEntry[];

/**
 * Main ~/.claude.json configuration structure.
 * This file contains user preferences, OAuth session, MCP server configurations,
 * per-project state, and various caches.
 */
export interface ClaudeConfig {
  /**
   * User settings preferences (theme, notification settings, editor mode).
   */
  readonly settings?: ClaudeSettings;

  /**
   * User-scoped MCP server configurations.
   */
  readonly mcpServers?: McpServers;

  /**
   * Registered projects and their configurations.
   * Keys are project identifiers, values contain path and state.
   */
  readonly projects?: ClaudeProjects;

  /**
   * OAuth session data.
   */
  readonly session?: unknown;

  /**
   * Various caches.
   */
  readonly cache?: unknown;
}

/**
 * Tree node types for the Context Editor tree view.
 */
export type TreeNodeType = "project" | "settings" | "claudeMd" | "mcpServers" | "mcpServer" | "folder";

/**
 * Tree item collapsible state.
 */
export type CollapsibleState = 0 | 1 | 2; // None, Collapsed, Expanded

/**
 * Base interface for tree nodes in the Context Editor view.
 */
export interface ContextTreeNode {
  /**
   * Display label for the node.
   */
  readonly label: string;

  /**
   * Node type identifier.
   */
  readonly type: TreeNodeType;

  /**
   * Absolute file system path (if applicable).
   */
  readonly path?: string;

  /**
   * Whether this node can be expanded to show children.
   */
  readonly collapsibleState?: CollapsibleState;

  /**
   * Icon identifier for the node.
   */
  readonly icon?: string;

  /**
   * Tooltip text on hover.
   */
  readonly tooltip?: string;

  /**
   * Context value for context menu contributions.
   */
  readonly contextValue?: string;
}

/**
 * Project tree node representing a registered Claude project.
 */
export interface ProjectTreeNode extends ContextTreeNode {
  readonly type: "project";
  readonly path: string;
}

/**
 * File tree node representing a configuration file.
 */
export interface FileTreeNode extends ContextTreeNode {
  readonly type: "settings" | "claudeMd" | "mcpServers";
  readonly path: string;
}
