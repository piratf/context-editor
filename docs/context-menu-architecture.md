# Context Menu Architecture Design

## Overview

This document describes the interface-based context menu system for Context Editor. The design uses OOP principles where each menu command defines an interface, and node classes implement these interfaces to indicate menu support.

## Core Principles

1. **Interface over Enumeration**: Menu support is determined by interface implementation, not enum matching
2. **Type Safety**: TypeScript's type system ensures all required methods are implemented
3. **Runtime Compatibility**: VS Code's `when` clauses require string matching for menu visibility
4. **Separation of Concerns**: Menu logic is separated from node logic through well-defined interfaces

## Architecture

### Command Interfaces

Each menu command defines an interface that specifies the required capabilities:

```typescript
/**
 * Interface for nodes that can have their name or path copied
 * Provides a file-system accessible path
 */
interface ICopyable {
  /** Get the accessible file system path for copying */
  getAccessiblePath(): string;

  /** Get the display name (file/directory name) */
  getDisplayName(): string;
}

/**
 * Interface for nodes that can be deleted
 * Provides deletion capability with safety checks
 */
interface IDeletable {
  /** Delete the file/directory this node represents */
  delete(): Promise<void>;

  /** Check if deletion is safe (e.g., not a system directory) */
  canDelete(): boolean;
}

/**
 * Interface for directory nodes that can be opened in new VS Code window
 */
interface IOpenableInVscode {
  /** Open this directory in a new VS Code window */
  openInNewWindow(): Promise<void>;

  /** Get the directory path for opening */
  getDirectoryPath(): string;
}
```

### Node Class Implementation

Node classes implement interfaces to indicate menu support:

```typescript
// FileNode implements ICopyable and IDeletable
class FileNode extends NodeBase implements ICopyable, IDeletable {
  getAccessiblePath(): string {
    return this.path!;
  }

  getDisplayName(): string {
    return this.label;
  }

  canDelete(): boolean {
    // Add safety checks
    return true;
  }

  async delete(): Promise<void> {
    await vscode.workspace.fs.delete(vscode.Uri.file(this.path!));
  }
}

// DirectoryNode implements ICopyable, IDeletable, and IOpenableInVscode
class DirectoryNode extends NodeBase implements ICopyable, IDeletable, IOpenableInVscode {
  getAccessiblePath(): string {
    return this.path!;
  }

  getDisplayName(): string {
    return this.label;
  }

  getDirectoryPath(): string {
    return this.path!;
  }

  async openInNewWindow(): Promise<void> {
    await vscode.commands.executeCommand(
      'vscode.openFolder',
      vscode.Uri.file(this.path!),
      { forceNewWindow: true }
    );
  }

  canDelete(): boolean {
    // Don't allow deleting root directories
    return !this.isRoot();
  }

  async delete(): Promise<void> {
    await vscode.workspace.fs.delete(
      vscode.Uri.file(this.path!),
      { recursive: true, useTrash: true }
    );
  }
}

// ClaudeJsonNode implements ICopyable and IDeletable
class ClaudeJsonNode extends NodeBase implements ICopyable, IDeletable {
  // Similar implementation to FileNode
}
```

### Context Value Mapping

Since VS Code's `when` clauses only support string matching, we map interfaces to `contextValue` strings:

```typescript
/**
 * Context value markers for interface implementation
 * These are set on TreeNode.contextValue for VS Code menu filtering
 */
const CONTEXT_MARKERS = {
  COPYABLE: 'copyable',
  DELETABLE: 'deletable',
  OPENABLE_IN_VSCODE: 'openableInVscode',
} as const;

/**
 * Build contextValue string from implemented interfaces
 * Multiple interfaces are combined with '+' separator
 *
 * Examples:
 * - "directory+copyable+deletable+openableInVscode"
 * - "file+copyable+deletable"
 * - "claudeJson+copyable+deletable"
 */
function buildContextValue(baseType: string, interfaces: string[]): string {
  const parts = [baseType, ...interfaces].filter(Boolean);
  return parts.join('+');
}
```

### Menu Configuration

Package.json configuration uses `viewItem =~` pattern matching:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "contextEditor.copyName",
        "title": "Copy Name"
      },
      {
        "command": "contextEditor.copyPath",
        "title": "Copy Path"
      },
      {
        "command": "contextEditor.delete",
        "title": "Delete"
      },
      {
        "command": "contextEditor.openVscode",
        "title": "Open in New Window"
      }
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "contextEditor.copyName",
          "when": "view == contextEditorUnified && viewItem =~ /\\+copyable($|\\+)/",
          "group": "copy@1"
        },
        {
          "command": "contextEditor.copyPath",
          "when": "view == contextEditorUnified && viewItem =~ /\\+copyable($|\\+)/",
          "group": "copy@2"
        },
        {
          "command": "contextEditor.delete",
          "when": "view == contextEditorUnified && viewItem =~ /\\+deletable($|\\+)/",
          "group": "delete@1"
        },
        {
          "command": "contextEditor.openVscode",
          "when": "view == contextEditorUnified && viewItem =~ /\\+openableInVscode($|\\+)/",
          "group": "inline"
        }
      ]
    }
  }
}
```

### Type Guards

Type guards for runtime interface checking:

```typescript
/**
 * Type guard for ICopyable interface
 */
function isCopyable(node: unknown): node is ICopyable & { getAccessiblePath(): string } {
  return (
    typeof node === 'object' &&
    node !== null &&
    'getAccessiblePath' in node &&
    'getDisplayName' in node &&
    typeof (node as any).getAccessiblePath === 'function' &&
    typeof (node as any).getDisplayName === 'function'
  );
}

/**
 * Type guard for IDeletable interface
 */
function isDeletable(node: unknown): node is IDeletable {
  return (
    typeof node === 'object' &&
    node !== null &&
    'canDelete' in node &&
    'delete' in node &&
    typeof (node as any).canDelete === 'function' &&
    typeof (node as any).delete === 'function'
  );
}

/**
 * Type guard for IOpenableInVscode interface
 */
function isOpenableInVscode(node: unknown): node is IOpenableInVscode {
  return (
    typeof node === 'object' &&
    node !== null &&
    'getDirectoryPath' in node &&
    'openInNewWindow' in node &&
    typeof (node as any).getDirectoryPath === 'function' &&
    typeof (node as any).openInNewWindow === 'function'
  );
}
```

## File Structure

```
src/
├── types/
│   ├── treeNode.ts           # Existing TreeNode interface and types
│   ├── nodeClasses.ts        # Node classes with interface implementations
│   ├── menuInterfaces.ts     # Menu command interfaces (NEW)
│   └── menuConfig.ts         # Menu configuration and helpers (REFACTOR)
├── commands/
│   └── contextMenu.ts        # Context menu command handlers (NEW)
└── views/
    └── unifiedProvider.ts    # Updated to set proper context values
```

## Implementation Steps

1. **Define interfaces** in `src/types/menuInterfaces.ts`
   - ICopyable
   - IDeletable
   - IOpenableInVscode

2. **Update node classes** in `src/types/nodeClasses.ts`
   - Add interface implementations to FileNode, DirectoryNode, ClaudeJsonNode
   - Update toTreeNode() to build contextValue from implemented interfaces

3. **Create command handlers** in `src/commands/contextMenu.ts`
   - copyName handler
   - copyPath handler
   - delete handler
   - openVscode handler
   - Use type guards for runtime safety

4. **Update package.json**
   - Add command declarations
   - Add menu contributions with regex-based when clauses

5. **Update extension.ts**
   - Register context menu commands

6. **Write tests**
   - Unit tests for type guards
   - Unit tests for command handlers
   - Integration tests for menu visibility

## Testing Strategy

### Unit Tests
- Test interface implementation on each node class
- Test type guard functions with various node types
- Test command handlers with mock nodes

### Integration Tests
- Test menu visibility based on contextValue
- Test command execution through VS Code API
- Test error handling (e.g., deletion failure)

### Edge Cases
- Nodes without required interfaces
- Deletion of non-existent files
- Opening directories with special characters
- Multiple nodes selected (future: batch operations)

## Benefits

1. **Type Safety**: TypeScript ensures all required methods are implemented
2. **Extensibility**: New menu options只需定义新接口并让节点实现
3. **Maintainability**: Clear separation between menu logic and node logic
4. **Testability**: Interfaces can be mocked for testing
5. **Documentation**: Interfaces serve as living documentation of capabilities

## Future Extensions

- **Batch operations**: Interface for `IBatchable` nodes
- **Rename**: Interface for `IRenameable` nodes
- **Custom actions**: Plugins can define custom interfaces
- **Context-sensitive menus**: Different menus based on file content
