# Context Menu Architecture Design

## Overview

This document defines the context menu architecture for the Context Editor VS Code extension. The design provides a hierarchical context system for tree nodes with appropriate menu items for each node type.

## Context Value Hierarchy

### Root Node Contexts
- `global` - Global Configuration root node
- `projects` - Projects root node

### Directory Node Contexts
- `directory` - Regular directory
- `claudeDirectory` - `.claude` directory
- `project` - Project root directory

### File Node Contexts
- `file` - Regular file
- `claudeFile` - File inside `.claude` directory
- `claudeJson` - `.claude.json` configuration file

### Special Contexts
- `empty` - Empty node (no files/directories)
- `error` - Error node

## Command Definitions

### File Operations

#### Copy Name
- **ID**: `contextEditor.copyName`
- **Title**: `Copy Name`
- **Description**: Copy the file/directory name to clipboard
- **Contexts**: All file and directory nodes
- **Icon**: `$(copy)`

#### Copy Path
- **ID**: `contextEditor.copyPath`
- **Title**: `Copy Path`
- **Description**: Copy the full file/directory path to clipboard
- **Contexts**: All file and directory nodes
- **Icon**: `$(copy)`

#### Copy
- **ID**: `contextEditor.copyFile`
- **Title**: `Copy`
- **Description**: Copy file/directory to clipboard (for paste operation)
- **Contexts**: All file and directory nodes
- **Icon**: `$(clippy)`

#### Cut
- **ID**: `contextEditor.cutFile`
- **Title**: `Cut`
- **Description**: Cut file/directory to clipboard (for move operation)
- **Contexts**: All file and directory nodes
- **Icon**: `$(scissors)`

#### Paste
- **ID**: `contextEditor.pasteFile`
- **Title**: `Paste`
- **Description**: Paste copied/cut file/directory
- **Contexts**: Directory nodes only
- **Icon**: `$(clipboard)`

#### Delete
- **ID**: `contextEditor.deleteFile`
- **Title**: `Delete`
- **Description**: Delete file/directory
- **Contexts**: All file and directory nodes
- **Icon**: `$(trash)`

### Directory-Specific Operations

#### Open in New Window
- **ID**: `contextEditor.openInNewWindow`
- **Title**: `Open in New Window`
- **Description**: Open directory in a new VS Code window
- **Contexts**: Directory nodes only
- **Icon**: `$(empty-window)`

#### Create New File
- **ID**: `contextEditor.createNewFile`
- **Title**: `Create New File`
- **Description**: Create a new file in this directory
- **Contexts**: Directory nodes only
- **Icon**: `$(new-file)`

## Context Menu Structure

### File Menu (file, claudeFile, claudeJson)
```
Copy Name        (contextEditor.copyName)
Copy Path        (contextEditor.copyPath)
---              (separator)
Copy             (contextEditor.copyFile)
Cut              (contextEditor.cutFile)
---              (separator)
Delete           (contextEditor.deleteFile)
```

### Directory Menu (directory)
```
Copy Name        (contextEditor.copyName)
Copy Path        (contextEditor.copyPath)
---              (separator)
Copy             (contextEditor.copyFile)
Cut              (contextEditor.cutFile)
Paste            (contextEditor.pasteFile)
---              (separator)
Delete           (contextEditor.deleteFile)
---              (separator)
Open in New Window (contextEditor.openInNewWindow)
Create New File  (contextEditor.createNewFile)
```

### Claude Directory Menu (claudeDirectory)
```
Copy Name        (contextEditor.copyName)
Copy Path        (contextEditor.copyPath)
---              (separator)
Copy             (contextEditor.copyFile)
Cut              (contextEditor.cutFile)
Paste            (contextEditor.pasteFile)
---              (separator)
Delete           (contextEditor.deleteFile)
---              (separator)
Create New File  (contextEditor.createNewFile)
```

### Project Menu (project)
```
Copy Name        (contextEditor.copyName)
Copy Path        (contextEditor.copyPath)
---              (separator)
Open in New Window (contextEditor.openInNewWindow)
Create New File  (contextEditor.createNewFile)
```

## Multi-Select Context Menu

When multiple nodes are selected:
- Copy Names - Copy all selected names (one per line)
- Copy Paths - Copy all selected paths (one per line)
- Delete - Delete all selected items
- Copy - Copy all selected items
- Cut - Cut all selected items

## Implementation Architecture

### 1. Command Registration (extension.ts)

```typescript
// Register all context menu commands
const copyNameCommand = vscode.commands.registerCommand(
  "contextEditor.copyName",
  async (node: TreeNode) => {
    // Implementation
  }
);
```

### 2. Package.json Contribution

```json
{
  "contributes": {
    "commands": [
      {
        "command": "contextEditor.copyName",
        "title": "Copy Name",
        "icon": "$(copy)"
      }
      // ... other commands
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "contextEditor.copyName",
          "when": "view == contextEditorUnified && viewItem == file",
          "group": "copy@1"
        },
        {
          "command": "contextEditor.copyName",
          "when": "view == contextEditorUnified && viewItem == directory",
          "group": "copy@1"
        }
        // ... other menu items
      ]
    }
  }
}
```

### 3. Command Handler Module (commands/)

Create a new module `src/commands/` with:
- `clipboardCommands.ts` - Copy Name, Copy Path, Copy, Cut, Paste
- `fileCommands.ts` - Delete, Create New File
- `directoryCommands.ts` - Open in New Window

### 4. Clipboard Management

Create `src/utils/clipboard.ts` for:
- Storing copied/cut items
- Handling paste operations
- Managing clipboard state

### 5. File Operations

Create `src/utils/fileOperations.ts` for:
- Safe delete with confirmation
- File/directory copying
- File/directory moving
- New file creation

## VS Code API Integration

### TreeItem Context Values

The `contextValue` property of TreeItem determines which menu items appear:

```typescript
// In TreeNode creation
contextValue: "file"           // Regular file
contextValue: "claudeFile"     // File in .claude
contextValue: "claudeJson"     // .claude.json
contextValue: "directory"      // Regular directory
contextValue: "claudeDirectory" // .claude directory
contextValue: "project"        // Project root
```

### When Clause Syntax

```javascript
// Single context
"view == contextEditorUnified && viewItem == file"

// Multiple contexts
"view == contextEditorUnified && viewItem =~ /^(file|claudeFile)$/"
```

## Multi-Select Support

### Tree View Configuration

```json
{
  "id": "contextEditorUnified",
  "name": "Context",
  "title": "Context",
  "canSelectMany": true
}
```

### Multi-Select Commands

Commands receive an array of selected nodes:

```typescript
vscode.commands.registerCommand(
  "contextEditor.copyPaths",
  async (nodes: TreeNode[]) => {
    const paths = nodes.map(n => n.path).join("\n");
    await vscode.env.clipboard.writeText(paths);
  }
);
```

## Error Handling

1. **File Not Found**: Show error notification
2. **Permission Denied**: Show error with suggestion
3. **Delete Confirmation**: Show confirmation dialog for destructive operations
4. **Paste Conflicts**: Prompt for overwrite/skip/rename

## Future Enhancements

1. **Rename** - Add rename command (F2 support)
2. **Duplicate** - Quick duplicate file/directory
3. **Create Directory** - Add new directory creation
4. **Search in Files** - Search/filter files within selected directory
5. **Git Operations** - Add git context commands for tracked files
