# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Editor is a VS Code extension that provides a visual interface for managing Claude Code configurations across multiple environments (Windows, WSL, macOS, Linux). It displays hierarchical tree views of global configs (`~/.claude.json`, `~/.claude/`) and registered projects from each environment.

## Development Commands

```bash
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

# Run in Extension Development Host
# Press F5 in VS Code
```

## Architecture

### Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Extension Layer                                │
│  extension.ts - Entry point, lifecycle, command registration                │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│            DI Container                   │   │          Command Layer                   │
│  di/container.ts, tokens.ts, setup.ts     │   │  commands/contextMenu.ts (MenuCommands)  │
│  - Service registration & resolution       │   │  commands/extension.ts (Extension cmds)   │
└───────────────────────────────────────────┘   └───────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┬───────────────┐
    │               │               │               │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                              View Layer                                                │
│  views/baseProvider.ts - Abstract TreeDataProvider base class                          │
│  views/unifiedProvider.ts - Unified tree view (Global + Projects)                      │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                            Adapter Layer                                               │
│  adapters/contextMenuRegistry.ts - Command registry, contextValue generation           │
│  adapters/treeItemFactory.ts - NodeData → vscode.TreeItem conversion                   │
│  adapters/vscode.ts - VS Code API interfaces (SimpleUri, FileDeleter, DialogService)   │
│  adapters/ui.ts - UserInteraction interface (showInfo, showError, showWarningMessage)  │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                           Service Layer                                                │
│  services/configSearch.ts - Environment discovery                                      │
│  services/environmentManager.ts - Environment selection                                │
│  services/dataFacade.ts - BaseDataFacade interface                                     │
│  services/nativeDataFacade.ts - Native environment facade                              │
│  services/windowsToWslDataFacade.ts - Windows → WSL facade                             │
│  services/wslToWindowsDataFacade.ts - WSL → Windows facade                             │
│  services/claudeConfigReader.ts - Config file parsing                                  │
│  services/fileAccessService.ts - File system operations                               │
│  services/pathConverter.ts - Path conversion utilities                                 │
│  services/environmentDetector.ts - Platform detection                                  │
│  services/copyService.ts - Copy name/path operations                                  │
│  services/deleteService.ts - Delete operations                                        │
│  services/nodeService.ts - Node children operations                                   │
│  services/openVscodeService.ts - Open directory in new window                         │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                            Type Layer                                                  │
│  types/nodeData.ts - NodeData interface, NodeType enum, NodeDataFactory               │
│  types/contextMenu.ts - ContextMenuCommand interface, ContextKeys constants           │
│  types/claudeConfig.ts - Claude configuration type definitions                         │
│  types/fileFilter.ts - FileFilter interfaces and implementations                      │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Context Menu System                                        │
│                                                                                      │
│  package.json (when clauses)                                                         │
│    │                                                                                  │
│    ├── "viewItem =~ /(^| )hasNameToCopy($| )/"  → Copy Name command                   │
│    ├── "viewItem =~ /(^| )hasCopyablePath($| )/" → Copy Path command                  │
│    ├── "viewItem =~ /(^| )canDelete($| )/"      → Delete command                     │
│    └── "viewItem =~ /(^| )canOpenInVscode($| )/" → Open VSCode command                │
│                                                                                      │
│  TreeItemFactory.createTreeItem(node)                                                │
│    │                                                                                  │
│    └── menuRegistry.buildContextValue(node)                                          │
│           │                                                                          │
│           └── For each command in ALL_COMMANDS:                                      │
│                  if command.canExecute(node, container):                              │
│                     keys.push(command.contextKey)                                     │
│                  return keys.join(" ")                                                │
│                                                                                      │
│  ContextMenuRegistry.registerCommands(context)                                       │
│    │                                                                                  │
│    └── Registers VS Code commands with execute() handlers                            │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Patterns

1. **Adapter Pattern** - VS Code APIs wrapped in interfaces for testability
2. **Facade Pattern** - One facade per environment, unified interface
3. **Strategy Pattern** - Pluggable file filters
4. **OOP Nodes** - Each node type knows how to load its children
5. **Interface-based Menus** - Nodes implement interfaces to enable menu items
6. **Dependency Injection** - Core logic depends on interfaces, not VS Code APIs
7. **Event-driven** - EventEmitter for environment/config changes

## Type System

All Claude configuration types are in `src/types/claudeConfig.ts`:
- `ClaudeConfig` - Main `~/.claude.json` structure
- `ClaudeSettings` - Settings.json contents
- `McpServers` - MCP server configurations
- `ContextTreeNode` - Tree view node types

## Testing

Tests are in `src/test/`:
- Unit tests for individual services
- Integration tests for facade behaviors
- Extension tests for VS Code integration

Git hooks run lint-staged (ESLint + Prettier) on pre-commit and tests on pre-push (skippable with `SKIP_TESTS=1`).

### Testing Best Practices

#### Core Principle 1: Dependency Injection

**Separate pure logic from VS Code API dependencies** to enable unit testing without VS Code environment.

```typescript
// ❌ Avoid: Direct VS Code API usage in business logic
async function deleteFile(path: string): Promise<void> {
  const uri = vscode.Uri.file(path);
  await vscode.workspace.fs.delete(uri, { recursive: true });
}

// ✅ Preferred: Inject dependencies
interface FileDeleter {
  delete(uri: { path: string }, options: { recursive: boolean }): Promise<void>;
}

async function deleteFile(path: string, deleter: FileDeleter): Promise<void> {
  await deleter.delete({ path }, { recursive: true });
}

// Production code in extension.ts
import * as vscode from "vscode";
const vscodeDeleter: FileDeleter = {
  delete: (uri, options) => vscode.workspace.fs.delete(uri, options)
};
```

#### Test Execution

- Unit tests: `npm test` (uses `node --test`, fast)
- Integration/Extension tests: `npm run test:integration` (uses `@vscode/test-electron`)

#### Common Issues & Solutions

**Issue**: TreeView nodes missing right-click menus

**Cause**: TreeNode lacks `contextValue` markers

**Solution**: Add menu interface markers when creating nodes

```typescript
export const TreeNodeFactory = {
  createFile(label: string, path: string): TreeNode {
    return {
      type: NodeType.FILE,
      label,
      path,
      collapsibleState: 0,
      contextValue: "file+copyable+deletable"  // ← Required for menus
    };
  }
};
```

**Issue**: Cannot test async commands

**Solution**: Use `@vscode/test-electron` `executeCommand` API

```typescript
test("should execute command", async () => {
  await vscode.commands.executeCommand("contextEditor.refresh");
  // Verify command effects
});
```

### Test Structure

```
src/test/
├── unit/                      # Pure logic tests (no VS Code dependency)
│   ├── claudeConfigReader.test.ts
│   ├── contextMenu.test.ts
│   ├── dataFacade.test.ts
│   ├── deleteWithTrashFallback.test.ts  # Adapter function tests
│   ├── environment.test.ts
│   ├── environmentDetector.test.ts
│   ├── fileFilter.test.ts
│   ├── nativeDataFacade.test.ts
│   ├── nodeClasses.test.ts
│   ├── pathConverter.test.ts
│   ├── unifiedProvider.test.ts
│   ├── wslToWindowsDataFacade.test.ts
│   └── windowsToWslDataFacade.test.ts
└── integration/               # Integration tests (with VS Code API)
    └── (VS Code extension tests)
```

### Adapter Layer Testing

**Key Principle**: Core business logic depends only on interfaces, not VS Code APIs.

```typescript
// Example: deleteWithTrashFallback function
// NO vscode types - all dependencies injected via interfaces
export async function deleteWithTrashFallback(
  uri: SimpleUri,           // Interface, not vscode.Uri
  itemName: string,
  deleter: FileDeleter,     // Interface
  dialog: DialogService     // Interface
): Promise<DeleteResult>

// Test uses mock implementations
class MockFileDeleter implements FileDeleter {
  deleteCalls: SimpleUri[] = [];
  async delete(uri: SimpleUri, options: DeleteOptions): Promise<void> {
    this.deleteCalls.push(uri);
  }
}

class MockDialogService implements DialogService {
  response?: string;
  async showWarningMessage(...): Thenable<string | undefined> {
    return Promise.resolve(this.response);
  }
}
```

### Unit Test Examples

**deleteWithTrashFallback.test.ts**: Tests the adapter function with mocks
- Mock `FileDeleter` to verify delete calls
- Mock `DialogService` to test user interaction
- Test trash failure → permanent delete fallback
- Test user cancellation

**nodeClasses.test.ts**: Tests node class methods
- Test `DirectoryNode.getChildren()` file reading
- Test file filtering behavior
- Test menu interface methods (`getAccessiblePath()`, `canDelete()`)

**unifiedProvider.test.ts**: Tests provider with mock facades
- Mock `ClaudeDataFacade` for environment testing
- Test root node loading
- Test environment switching

**fileFilter.test.ts**: Tests filter combinators
- Test `AndFilter`, `OrFilter`, `NotFilter`
- Test `ClaudeCodeFileFilter` patterns

### Testing Constraints

- **禁止使用 Any 类型**
- **禁止跳过测试或忽略 lint 规则，必须修复所有测试和 lint 问题**

## Environment Detection

- `services/environment.ts` - Platform constants (Windows, WSL, macOS, Linux)
- `services/environmentDetector.ts` - Detects current OS and WSL status

Windows users get both Windows and WSL environments (if WSL is installed). WSL users get both WSL and Windows environments. macOS/Linux users only get native.

## Path Filtering

Windows facades filter out non-Windows-accessible paths:
- **Included**: `C:\`, `D:\`, UNC paths (`\\server\share`)
- **Filtered out**: `/home/`, `/root/`, `/mnt/c/` (WSL paths that appear in Windows config but are inaccessible)

This is handled by `isWindowsAccessiblePath()` and `shouldIncludeProjectPath()` in `BaseDataFacade`.

## Tree View resourceUri

Tree nodes do NOT set `resourceUri` to avoid triggering VS Code's Git integration:
- Prevents "potentially unsafe git repository" warnings for cross-platform paths
- Prevents "too many active changes" warnings
- File opening still works via the `command` property

## Debugging

Use the "Context Editor: Show Debug Output" command to view logs. The extension logs environment discovery, facade creation, project loading, and all data operations.

`UnifiedProvider` emits debug logs prefixed with `[UnifiedProvider]`.