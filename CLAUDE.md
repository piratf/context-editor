# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Editor is a VS Code extension that provides a visual interface for managing Claude Code configurations across multiple environments (Windows, WSL, macOS, Linux). It displays hierarchical tree views of global configs (`~/.claude.json`, `~/.claude/`) and registered projects from each environment.

## Architecture

### Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Extension Layer                                    │
│  extension.ts - Entry point, lifecycle, DI initialization                    │
│              - activate(), deactivate()                                      │
│              - registerViews(), registerCommands()                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
┌───────────────────────────────────────────┐   ┌───────────────────────────────────────────┐
│            DI Container                   │   │          Command Layer                   │
│  di/container.ts - SimpleDIContainer      │   │  commands/menuCommands.ts -             │
│  di/tokens.ts - ServiceTokens             │   │    - copyNameCommand                    │
│  di/setup.ts - setupDI()                  │   │    - copyPathCommand                    │
│  - Service registration & resolution       │   │    - deleteCommand                     │
│  - Singleton lifecycle                    │   │    - openVscodeCommand                  │
│  - Circular dependency detection          │   │    - createFileCommand                  │
└───────────────────────────────────────────┘   │    - createFolderCommand                │
                                                 │  commands/contextMenu.ts -              │
                                                 │    - ContextMenuCommand interface       │
                                                 └───────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┬───────────────┐
    │               │               │               │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                              View Layer                                                │
│  views/baseProvider.ts - Abstract TreeDataProvider base class                          │
│    - Template Method pattern                                                           │
│    - Common TreeDataProvider boilerplate                                               │
│  views/unifiedProvider.ts - Unified tree view implementation                           │
│    - Single view with two root nodes:                                                  │
│      1. Global Configuration (~/.claude.json, ~/.claude/)                             │
│      2. Projects (registered projects)                                                │
│    - Delegates to NodeService for children                                            │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                            Adapter Layer                                               │
│  adapters/contextMenuRegistry.ts - Command registry                                    │
│    - buildContextValue(node) - Dynamic context value generation                       │
│    - registerCommands(context) - VS Code command registration                         │
│  adapters/treeItemFactory.ts - NodeData → vscode.TreeItem conversion                   │
│    - Icon mapping, tooltip handling                                                    │
│  adapters/ui.ts - UserInteraction interface                                            │
│    - UserInteraction, ClipboardService, VsCodeFolderOpener                             │
│  adapters/vscode.ts - VS Code API interfaces                                           │
│    - FileDeleter, FileCreator, DialogService, InputService                             │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                           Service Layer                                                │
│  Pure business logic. No `vscode` dependency in this layer.                                                                                       │
│  Environment Discovery & Management:                                                    │
│  services/configSearch.ts - Environment discovery                                      │
│    - Auto-discovers WSL from Windows, Windows from WSL                                 │
│    - Emits events when facade list changes                                             │
│  services/environmentManagerService.ts - Environment selection                         │
│    - Manages current environment, quick pick UI                                        │
│  services/environmentDetector.ts - Platform detection                                  │
│  services/environment.ts - Environment utilities                                       │
│                                                                                         │
│  Data Access (Facade Pattern):                                                         │
│  services/dataFacade.ts - BaseDataFacade interface                                     │
│  services/nativeDataFacade.ts - Native environment facade                              │
│  services/windowsToWslDataFacade.ts - Windows → WSL facade                             │
│  services/wslToWindowsDataFacade.ts - WSL → Windows facade                             │
│                                                                                         │
│  Business Logic:                                                                       │
│  services/nodeService.ts - Tree node operations                                        │
│    - Directory traversal, file filtering, node type dispatch                           │
│  services/claudeCodeRootNodeService.ts - Root node management                          │
│    - Creates "Global Configuration" and "Projects" nodes                               │
│  services/rootNodeService.ts - Root node interface                                     │
│                                                                                         │
│  Operations:                                                                           │
│  services/copyService.ts - Copy name/path operations                                  │
│  services/deleteService.ts - Delete operations with confirmation                       │
│  services/fileCreationService.ts - File/folder creation                                │
│  services/openVscodeService.ts - Open directory in new window                         │
│                                                                                         │
│  Utilities:                                                                            │
│  services/pathConverter.ts - Path conversion (WSL ↔ Windows)                          │
│  services/loggerService.ts - Logging abstraction                                       │
└───┬───────────────────────────────────────────────────────────────────────────────────┘
    │
    │ uses
    │
┌───▼─────────────────────────────────────────────────────────────────────────────────────┐
│                           Type Layer                                                  │
│  types/nodeData.ts - NodeData interface, NodeType enum, NodeDataFactory               │
│    - Pure data interfaces (NO vscode dependency)                                       │
│    - Runtime type markers for efficient checking                                      │
│    - Type guards (NodeTypeGuard)                                                       │
│  types/contextMenu.ts - ContextMenuCommand interface, ContextKeys constants           │
│  types/claudeConfig.ts - Claude configuration type definitions                         │
│    - ClaudeGlobalConfig, ProjectEntry, McpServers, etc.                               │
│  types/fileFilter.ts - FileFilter interfaces and implementations                      │
│    - ClaudeCodeFileFilter, ProjectClaudeFileFilter                                     │
│    - Composable filters (AndFilter, OrFilter, NotFilter)                              │
└─────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Utilities Layer                                             │
│  utils/logger.ts - Structured logging with levels                                     │
│    - DEBUG, INFO, WARN, ERROR                                                         │
│    - Component-based organization                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

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

## MUST FOLLOW
- **禁止使用 Any 类型**
- **禁止跳过测试或忽略 lint 规则，必须修复所有测试和 lint 问题**

###  BD 任务拆分方案

使用 bd create 拆分重构任务，每个 issue 按照以下流程执行：

- 每个 Issue 的执行流程（TDD 方式）
```
    1. 创建 issue
    bd create --title="..." --description="..." --type=feat|refactor --priority=2
    
    # 2. 标记为进行中
    bd update <id> --status=in_progress
    
    # 3. 【关键】设计测试用例并编写测试代码
    # - 根据需求分析测试场景
    # - 编写/更新测试代码（此时测试会失败 - Red）
    # - 运行测试验证失败：npm test
    
    # 4. 【关键】实现代码让测试通过
    # - 编写最小实现代码
    # - 运行测试验证通过：npm test
    
    # 5. Lint（测试通过后）
    npm run lint
    # 如有错误，运行：
    npm run lint:fix
    
    # 6. 再次确认测试通过
    npm test
    
    # 7. 提交
    git add <files>
    git commit -m "..."
    bd sync
    
    # 8. 关闭 issue
    bd close <id>
    
    # 9. 继续下一个 issue
```