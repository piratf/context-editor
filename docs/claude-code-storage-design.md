# Why Claude Code Feels So Stable: A Developer's Deep Dive into Its Local Storage Design

Claude Code has been everywhere lately. Developers are using it to ship features faster, automate workflows, and prototype agents that actually work in real projects. What's even more surprising is how many non-coders have jumped in too — building tools, wiring up tasks, and getting useful results with almost no setup. It's rare to see an AI coding tool spread this quickly across so many different skill levels.

What really stands out, though, is how _stable_ it feels. Claude Code remembers what happened across sessions, survives crashes without losing progress, and behaves more like a local development tool than a chat interface. That reliability comes from how it handles local storage.

Instead of treating your coding session as a temporary chat, Claude Code reads and writes real files, stores project state on disk, and records every step of the agent's work. Sessions can be resumed, inspected, or rolled back without guesswork, and each project stays cleanly isolated — avoiding the cross-contamination issues that many agent tools run into.

## Storage Architecture Overview

Claude Code stores all of its local data in a single place: your home directory. This keeps the system predictable and makes it easier to inspect, debug, or clean up when needed.

### Two Core Components

**1. Global configuration:** `~/.claude.json`

This file acts as an index rather than a data store. It records which projects you've worked on, what tools are attached to each project, and which prompts you recently used. Conversation data itself is not stored here.

```json
{
  "projects": {
    "/Users/xxx/my-project": {
      "mcpServers": {
        "jarvis-tasks": {
          "type": "stdio",
          "command": "python",
          "args": ["/path/to/run_mcp.py"]
        }
      }
    }
  },
  "recentPrompts": [
    "Fix the bug in auth module",
    "Add unit tests"
  ]
}
```

**2. Main data directory:** `~/.claude/`

The `~/.claude/` directory is where most of Claude Code's local state lives. Its structure reflects a few core design ideas: project isolation, immediate persistence, and safe recovery from mistakes.

```
~/.claude/
├── settings.json # Global settings (permissions, plugins, cleanup intervals)
├── settings.local.json # Local settings (machine-specific, not committed to Git)
├── history.jsonl # Command history
│
├── projects/ # 📁 Session data (organized by project, core directory)
│ └── -Users-xxx-project/ # Path-encoded project directory
│   ├── {session-id}.jsonl # Primary session data (JSONL format)
│   └── agent-{agentId}.jsonl # Sub-agent session data
│
├── session-env/ # Session environment variables
│ └── {session-id}/ # Isolated by session ID
│
├── skills/ # 📁 User-level skills (globally available)
│ └── mac-mail/
│     └── SKILL.md
│
├── plugins/ # 📁 Plugin management
│ ├── config.json # Global plugin configuration
│ ├── installed_plugins.json # List of installed plugins
│ ├── known_marketplaces.json # Marketplace source configuration
│ ├── cache/ # Plugin cache
│ └── marketplaces/
│     └── anthropic-agent-skills/
│       ├── .claude-plugin/
│       │   └── marketplace.json
│       └── skills/
│           ├── pdf/
│           ├── docx/
│           └── frontend-design/
│
├── todos/ # Task list storage
│ └── {session-id}-*.json # Session-linked task files
│
├── file-history/ # File edit history (stored by content hash)
│ └── {content-hash}/ # Hash-named backup directory
│
├── shell-snapshots/ # Shell state snapshots
├── plans/ # Plan Mode storage
├── local/ # Local tools / node_modules
│   └── claude # Claude CLI executable
│   └── node_modules/ # Local dependencies
│
├── statsig/ # Feature flag cache
├── telemetry/ # Telemetry data
└── debug/ # Debug logs
```

## Configuration System

Claude Code's configuration system is designed around a simple idea: keep the default behavior consistent across machines, but still let individual environments and projects customize what they need.

### Three-Layer Configuration Model

Claude Code loads configuration in the following order, from lowest priority to highest:

```
┌─────────────────────────────────────────┐
│ Project-level configuration              │ Highest priority
│ project/.claude/settings.json           │ Project-specific, overrides other configs
├─────────────────────────────────────────┤
│ Local configuration                      │ Machine-specific, not version-controlled
│ ~/.claude/settings.local.json           │ Overrides global configuration
├─────────────────────────────────────────┤
│ Global configuration                      │ Lowest priority
│ ~/.claude/settings.json                 │ Base default configuration
└─────────────────────────────────────────┘
```

### (1) Global Configuration: `~/.claude/settings.json`

The global configuration defines the default behavior for Claude Code across all projects.

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": ["Read(**)", "Bash(npm:*)"],
    "deny": ["Bash(rm -rf:*)"],
    "ask": ["Edit", "Write"]
  },
  "enabledPlugins": {
    "document-skills@anthropic-agent-skills": true
  },
  "cleanupPeriodDays": 30
}
```

### (2) Local Configuration: `~/.claude/settings.local.json`

The local configuration is specific to a single machine. It is not meant to be shared or checked into version control.

```json
{
  "permissions": {
    "allow": ["Bash(git:*)", "Bash(docker:*)"]
  },
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-xxx"
  }
}
```

### (3) Project-level Configuration: `project/.claude/settings.json`

Project-level configuration applies only to a single project and has the highest priority.

```json
{
  "permissions": {
    "allow": ["Bash(pytest:*)"]
  }
}
```

## Project Registration

Projects are registered in `~/.claude.json` under the `projects` key. The format supports:

**Array format:**
```json
{
  "projects": [
    { "path": "/path/to/project1" },
    { "path": "/path/to/project2" }
  ]
}
```

**Record format:**
```json
{
  "projects": {
    "project-1": { "path": "/path/to/project1" },
    "project-2": { "path": "/path/to/project2" }
  }
}
```

## Key Takeaways for Plugin Development

1. **Project Path Encoding**: Session directories use path-encoded names where `/`, spaces, and `~` are replaced with `-`.
   - Example: `/Users/bill/My Project` → `-Users-bill-My-Project`

2. **Configuration Priority**: Project settings > Local settings > Global settings

3. **Project Discovery**: Plugin should read `~/.claude.json` and parse the `projects` field to discover registered projects

4. **Supported Config Files**: Plugin should detect:
   - `CLAUDE.md` (project root)
   - `.claude/CLAUDE.md`
   - `.claude/settings.json`

5. **Error Handling**: Missing `~/.claude.json` or empty projects list should be handled gracefully
