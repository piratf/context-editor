# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Context Editor is a VS Code extension that provides a visual interface for managing Claude Code configurations across multiple environments (Windows, WSL, macOS, Linux). It displays hierarchical tree views of global configs (`~/.claude.json`, `~/.claude/`) and registered projects from each environment.

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

## MUST FOLLOW
- **禁止使用 Any 类型**
- **禁止跳过测试或忽略 lint 规则，必须修复所有测试和 lint 问题**

###  BD 任务拆分方案

使用 bd create 拆分重构任务，每个 issue 按照以下流程执行：

- 每个 Issue 的执行流程（TDD 方式）
    # 1. 创建 issue
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