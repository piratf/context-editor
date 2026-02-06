# Context Editor

The specialized visual editor for Claude Code. Auto-discover, organize, and orchestrate your nested CLAUDE.md trees and MCP configurations in a unified hierarchy.

## Features

- **Multi-Environment Support** - Seamlessly work across Windows, WSL, macOS, and Linux environments
- **Global Configuration View** - Access `~/.claude.json` and `~/.claude/` directory from any environment
- **Projects View** - Browse all registered Claude projects with filtered file trees (`.claude/` and `CLAUDE.md` only)
- **Environment Switching** - Quick status bar button to switch between discovered environments
- **Smart Path Filtering** - Automatically filters out inaccessible cross-platform paths

## Commands

| Command | Description |
|---------|-------------|
| `Context Editor: Refresh` | Refresh all views and re-discover environments |
| `Context Editor: Switch Environment` | Switch between available environments |
| `Context Editor: Show Debug Output` | Show the debug output channel |

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## How It Works

Context Editor uses a facade pattern to abstract access to Claude configurations across different environments:

1. **ConfigSearch** - Discovers all accessible Claude environments (Windows + WSL, etc.)
2. **EnvironmentManager** - Manages the currently selected environment
3. **Data Facades** - Provide unified interfaces for reading configs, with automatic path conversion
4. **Tree View Providers** - Display hierarchical views of global configs and projects

## License

MPL-2.0
