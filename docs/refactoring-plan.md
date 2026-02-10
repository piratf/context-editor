# Context Editor 架构重构方案

## 目标

实现业务逻辑与 VS Code 模块的完全解耦，使核心业务逻辑可以在无 VS Code 环境下进行单元测试。

## 当前架构问题

### 问题 1: NodeBase 强依赖 vscode.TreeItem

```typescript
// 当前实现 - types/nodeClasses.ts
export abstract class NodeBase extends vscode.TreeItem {
  abstract getChildren(): Promise<NodeBase[]>;

  async delete(): Promise<void> {
    // 业务逻辑在 Node 中
    const deleter = new VsCodeFileDeleter();
    const dialog = new VsCodeDialogService();
    // ...
  }
}
```

**问题：**
- NodeBase 继承 `vscode.TreeItem`，无法脱离 VS Code 环境测试
- 业务逻辑（如 `delete()`）混在 Node 类中
- 单元测试必须依赖 VS Code 测试环境

### 问题 2: Service 层仍有 UI 依赖

```typescript
// services/environmentManager.ts
async showEnvironmentQuickPick(): Promise<void> {
  await vscode.window.showQuickPick(items, {...});  // UI 依赖
}
```

### 问题 3: 命令处理依赖 Node 方法

```typescript
// commands/contextMenu.ts
export async function deleteNode(node: unknown): Promise<void> {
  if (isDeletable(node)) {
    await node.delete();  // 直接调用 Node 方法
  }
}
```

## 架构对比

### 重构前的旧架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Extension Layer                               │
│                         extension.ts                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                           Command Layer                                 │
│                    commands/contextMenu.ts                              │
│  - copyName, copyPath, deleteNode, openVscode                          │
│  - 直接调用 node.copyName(), node.delete() 等接口方法                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          View Layer                                     │
│  views/baseProvider.ts - Abstract base                                 │
│  views/unifiedProvider.ts - Unified tree provider                      │
│  getTreeItem() → 返回 NodeBase (extends vscode.TreeItem)               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                    Node Classes (强耦合 vscode)                         │
│  types/nodeClasses.ts                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ NodeBase extends vscode.TreeItem                                │   │
│  │   ├─ getChildren(): Promise<NodeBase[]>                         │   │
│  │   ├─ getDisplayName(): string  (ICopyable)                      │   │
│  │   ├─ getAccessiblePath(): string (ICopyable)                    │   │
│  │   ├─ canDelete(): boolean (IDeletable)                          │   │
│  │   ├─ delete(): Promise<void> (IDeletable)                       │   │
│  │   └─ openInNewWindow(): Promise<void> (IOpenableInVscode)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐    │
│  │ DirectoryNode    │  │ FileNode         │  │ ClaudeJsonNode  │    │
│  │ + getChildren()  │  │ (无额外方法)      │  │ (无额外方法)     │    │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Menu Interfaces                                  │
│  types/menuInterfaces.ts                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ interface ICopyable { getDisplayName(), getAccessiblePath() }   │   │
│  │ interface IDeletable { canDelete(), delete() }                  │   │
│  │ interface IOpenableInVscode { getDirectoryPath(),               │   │
│  │                              openInNewWindow() }                 │   │
│  │                                                                 │   │
│  │ 类型守卫: isCopyable(), isDeletable(), isOpenableInVscode()     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Data Types (依赖 vscode)                           │
│  types/treeNode.ts                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ interface TreeNode {                                            │   │
│  │   type: NodeType;                                               │   │
│  │   label: string | vscode.TreeItemLabel;  ← 依赖 vscode          │   │
│  │   iconPath: vscode.ThemeIcon;           ← 依赖 vscode          │   │
│  │   ...                                                             │   │
│  │ }                                                                │   │
│  │                                                                 │   │
│  │ TreeNodeFactory.createDirectory() → new DirectoryNode(...)     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

❌ 问题：
• NodeBase 直接 extends vscode.TreeItem，无法单元测试
• 业务逻辑（delete, copy）耦合在 Node 类中
• TreeNode 接口依赖 vscode 类型
• 无法独立测试核心业务逻辑
```

### 重构后的新架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Extension Layer                               │
│                         extension.ts                                    │
│  - 创建 VsCodeUserInteraction                                          │
│  - 注入到 EnvironmentManager                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                          Command Layer                                  │
│                    commands/contextMenu.ts                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ copyName(node)                                                   │   │
│  │   → extractNodeData(node) → NodeData                            │   │
│  │   → CopyService.copyName(data)                                  │   │
│  │   → UI feedback                                                  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ deleteNode(node)                                                 │   │
│  │   → extractNodeData(node) → NodeData                            │   │
│  │   → DeleteService.execute(data)                                 │   │
│  │   → UI feedback                                                  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ openVscode(node) → 使用类型检查访问旧接口方法                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Service Layer (纯业务逻辑)                        │
│  services/deleteService.ts  │  services/copyService.ts  │              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ DeleteService.execute(data: NodeData) → DeleteResult            │   │
│  │   - 使用注入的 FileDeleter, DialogService                       │   │
│  │   - 纯业务逻辑，可独立测试                                       │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ CopyService.copyName(data: NodeData) → CopyResult               │   │
│  │   - 使用注入的 ClipboardService                                  │   │
│  │   - 纯业务逻辑，可独立测试                                       │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ NodeService.getChildren(data: DirectoryData)                    │   │
│  │   → GetChildrenResult                                           │   │
│  │   - 使用注入的 FileSystem                                        │   │
│  │   - 文件过滤业务逻辑                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Adapter Layer (VS Code 适配)                       │
│  adapters/ui.ts                   │  adapters/treeItemFactory.ts       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ UserInteraction 接口                                           │   │
│  │ VsCodeUserInteraction 实现                                     │   │
│  │ - showQuickPick<T>()                                           │   │
│  │ - showInformationMessage()                                      │   │
│  │ - showWarningMessage()                                          │   │
│  │ - writeText()                                                   │   │
│  │                                                                 │   │
│  │ FileDeleter 接口                                               │   │
│  │ VsCodeFileDeleter 实现                                          │   │
│  │                                                                 │   │
│  │ DialogService 接口                                             │   │
│  │ VsCodeDialogService 实现                                        │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ TreeItemFactory (NodeData → vscode.TreeItem)                    │   │
│  │ - createTreeItem(data: NodeData) → TreeItem                     │   │
│  │ - 添加菜单标记 (copyable, deletable, ...)                       │   │
│  │                                                                 │   │
│  │ CONTEXT_MARKERS = {                                            │   │
│  │   COPYABLE: "copyable",                                         │   │
│  │   DELETABLE: "deletable",                                       │   │
│  │   OPENABLE_IN_VSCODE: "openableInVscode"                        │   │
│  │ }                                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         View Layer                                     │
│  views/baseProvider.ts                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ export type TreeNode = NodeData  ✅ 纯数据类型                  │   │
│  │                                                                 │   │
│  │ getTreeItem(element: TreeNode) → vscode.TreeItem                │   │
│  │   → treeItemFactory.createTreeItem(element)                     │   │
│  │                                                                 │   │
│  │ getChildren(element?: TreeNode) → TreeNode[]                     │   │
│  │   → NodeService.getChildren(data) → NodeData[]                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  views/unifiedProvider.ts extends BaseProvider                        │
│  - loadRootNodes() → NodeData[]                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Pure Data Layer (无 vscode 依赖)                   │
│  types/nodeData.ts                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ export interface NodeData {                                     │   │
│  │   readonly id: string;                                          │   │
│  │   readonly type: NodeType;                                      │   │
│  │   readonly label: string;                                       │   │
│  │   readonly path?: string;                                       │   │
│  │   readonly collapsibleState: CollapsibleState;                  │   │
│  │   readonly iconId?: string;      ✅ 不再依赖 vscode             │   │
│  │   readonly contextValue?: string;                               │   │
│  │ }                                                                │   │
│  │                                                                 │   │
│  │ DirectoryData extends NodeData                                  │   │
│  │ FileData extends NodeData                                        │   │
│  │ ClaudeJsonData extends NodeData                                  │   │
│  │ ErrorDataNode extends NodeData                                   │   │
│  │                                                                 │   │
│  │ NodeDataFactory.createDirectory(...) → DirectoryData            │   │
│  │ NodeDataFactory.createFile(...) → FileData                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

✅ 优势：
• NodeData 完全无 vscode 依赖，可独立测试
• Service 层包含纯业务逻辑，通过依赖注入适配器
• Command 层只负责数据提取和 UI 反馈
• TreeItemFactory 负责数据 → UI 转换
• 职责清晰，易于测试和维护
```

### 关键变化对比

| 方面 | 旧架构 | 新架构 |
|------|--------|--------|
| **数据表示** | TreeNode (依赖 vscode) | NodeData (纯数据) |
| **树节点类** | NodeBase extends TreeItem | 无，使用纯数据接口 |
| **业务逻辑** | 在 NodeBase 类中 | 在 Service 层 |
| **VS Code 耦合** | 强耦合（extends） | 通过 Adapter 解耦 |
| **可测试性** | 需要完整 VS Code 环境 | 可独立单元测试 |
| **菜单系统** | Interface 实现 | contextValue 字符串标记 |
| **命令处理** | 直接调用 node 方法 | 通过 Service 层 |

## 重构方案

### 方案 A: 分离数据模型和 UI 对象

将纯数据模型与 VS Code UI 对象完全分离，通过适配器层连接。

#### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Extension Layer                         │
│  - extension.ts (入口点，VS Code 生命周期)                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                       │
│  - TreeDataProvider (VS Code 接口适配)                      │
│  - TreeItemFactory (数据 → UI 转换)                         │
│  - CommandHandlers (命令处理，协调 Service 和 UI)            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                      │
│  - NodeService (节点操作业务逻辑)                            │
│  - DeleteService (删除业务逻辑)                              │
│  - CopyService (复制业务逻辑)                                │
│  - EnvironmentManager (环境管理，解耦 UI)                    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                          │
│  - NodeData (纯数据接口，无 vscode 依赖)                     │
│  - DirectoryData, FileData (具体数据类型)                   │
│  - EnvironmentInfo, ProjectEntry (领域数据)                  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                      │
│  - VS Code Adapters (FileDeleter, DialogService)           │
│  - File System Adapters                                     │
│  - UserInteraction Adapter (QuickPick, Message)             │
└─────────────────────────────────────────────────────────────┘
```

#### 核心设计

**1. 纯数据层 (Domain Layer)**

```typescript
// types/nodeData.ts - 完全无 vscode 依赖

export interface NodeData {
  readonly id: string;
  readonly type: NodeType;
  readonly label: string;
  readonly path?: string;
  readonly collapsibleState: CollapsibleState;
  readonly contextValue?: string;
}

export interface DirectoryData extends NodeData {
  readonly type: NodeType.DIRECTORY;
  readonly path: string;
}

export interface FileData extends NodeData {
  readonly type: NodeType.FILE;
  readonly path: string;
}
```

**2. 应用服务层 (Application Layer)**

```typescript
// services/nodeService.ts - 业务逻辑，无 vscode 依赖

export class NodeService {
  constructor(
    private readonly fileSystem: FileSystem,
    private readonly filter: SyncFileFilter
  ) {}

  async getChildren(node: DirectoryData): Promise<NodeData[]> {
    const entries = await this.fileSystem.readDirectory(node.path);
    return entries
      .filter(entry => this.filter.include(entry))
      .map(entry => this.createNodeData(entry));
  }

  private createNodeData(entry: FsEntry): NodeData {
    // 纯业务逻辑，返回纯数据
  }
}
```

**3. 适配器层 (Infrastructure Layer)**

```typescript
// adapters/treeItemFactory.ts - VS Code UI 适配

export class TreeItemFactory {
  createTreeItem(data: NodeData): vscode.TreeItem {
    const item = new vscode.TreeItem(data.label, this.toCollapsibleState(data.collapsibleState));
    item.id = data.id;
    item.contextValue = data.contextValue;
    if (data.path) item.tooltip = data.path;
    return item;
  }

  private toCollapsibleState(state: CollapsibleState): vscode.TreeItemCollapsibleState {
    // 转换逻辑
  }
}
```

**4. UI 交互抽象**

```typescript
// adapters/ui.ts - UI 交互接口

export interface UserInteraction {
  showQuickPick(items: QuickPickItem[]): Promise<QuickPickItem | undefined>;
  showInformationMessage(message: string): Promise<void>;
  showWarningMessage(message: string, options: MessageOptions, ...buttons: string[]): Promise<string | undefined>;
}

// VS Code 实现
export class VsCodeUserInteraction implements UserInteraction {
  async showQuickPick(items: QuickPickItem[]): Promise<QuickPickItem | undefined> {
    return vscode.window.showQuickPick(items);
  }
  // ...
}
```

### 方案 B: UI 操作移至 Command Handler

将所有 UI 操作和业务协调逻辑移至 Command Handler，Service 层只处理纯业务逻辑。

#### 命令处理流程

```
User Action (右键菜单)
       │
       ▼
Command Handler (commands/deleteCommand.ts)
       │
       ├─→ 1. 获取 NodeData
       │
       ├─→ 2. 调用 DeleteService.execute(data)
       │        │
       │        ▼
       │   返回 DeleteResult (纯数据)
       │
       ├─→ 3. 根据结果更新 UI
       │    - 显示错误/成功消息
       │    - 刷新 TreeView
       │
       └─→ 4. 处理异常
```

#### 代码结构

```typescript
// commands/deleteCommand.ts
export class DeleteCommandHandler {
  constructor(
    private readonly deleteService: DeleteService,
    private readonly userInteraction: UserInteraction,
    private readonly treeViewProvider: TreeViewProvider
  ) {}

  async execute(node: unknown): Promise<void> {
    // 1. 验证和提取数据
    const data = this.extractNodeData(node);
    if (!data) return;

    // 2. 调用业务逻辑
    const result = await this.deleteService.execute(data);

    // 3. UI 反馈
    if (!result.success) {
      await this.handleFailure(result);
      return;
    }

    // 4. 刷新视图
    this.treeViewProvider.refresh();
  }
}

// services/deleteService.ts
export class DeleteService {
  constructor(
    private readonly fileDeleter: FileDeleter,
    private readonly dialogService: DialogService
  ) {}

  async execute(data: NodeData): Promise<DeleteResult> {
    // 纯业务逻辑，返回纯数据结果
    return await deleteWithTrashFallback(
      { path: data.path! },
      data.label,
      this.fileDeleter,
      this.dialogService
    );
  }
}
```

## 实施步骤

### Phase 1: 基础设施层

1. **创建纯数据接口** (`types/nodeData.ts`)
   - 定义 `NodeData` 基础接口
   - 定义 `DirectoryData`, `FileData` 等具体类型
   - 确保完全无 vscode 依赖

2. **创建 UI 交互抽象** (`adapters/ui.ts`)
   - 定义 `UserInteraction` 接口
   - 实现 `VsCodeUserInteraction` 适配器
   - 定义 `QuickPickItem`, `MessageOptions` 等数据类型

3. **创建 TreeItemFactory** (`adapters/treeItemFactory.ts`)
   - 实现 `NodeData → vscode.TreeItem` 转换
   - 处理图标、工具提示、上下文值等

### Phase 2: 应用服务层

4. **创建 NodeService** (`services/nodeService.ts`)
   - 从 `DirectoryNode` 提取子节点获取逻辑
   - 实现文件过滤逻辑
   - 依赖 `FileSystem` 和 `SyncFileFilter`

5. **创建 DeleteService** (`services/deleteService.ts`)
   - 从 `NodeBase.delete()` 提取删除逻辑
   - 使用现有的 `deleteWithTrashFallback`
   - 依赖 `FileDeleter` 和 `DialogService`

6. **创建 CopyService** (`services/copyService.ts`)
   - 从菜单命令提取复制逻辑
   - 依赖 `ClipboardService` (新建)

7. **重构 EnvironmentManager**
   - 注入 `UserInteraction` 接口
   - 移除直接 `vscode.window` 调用

### Phase 3: 表现层

8. **更新 Command Handlers** (`commands/`)
   - 重构 `deleteCommand` 使用 `DeleteService`
   - 重构 `copyCommand` 使用 `CopyService`
   - 重构 `openVscodeCommand`

9. **更新 TreeDataProvider** (`views/`)
   - `BaseProvider` 使用 `NodeService` 获取数据
   - 使用 `TreeItemFactory` 转换为 TreeItem
   - `UnifiedProvider` 适配新架构

### Phase 4: 测试和清理

10. **更新单元测试**
    - 为 Service 层添加纯单元测试
    - 为 Adapter 层添加 mock 测试
    - 保留集成测试验证端到端功能

11. **废弃旧的 NodeBase**
    - 标记为 `@deprecated`
    - 或完全移除（如果无外部依赖）

## 测试策略

### 单元测试 (无 VS Code 依赖)

```typescript
// test/unit/services/nodeService.test.ts

import { strict as assert } from 'node:assert';
import { NodeService } from '../../services/nodeService.js';
import { MockFileSystem } from '../mocks/mockFileSystem.js';

suite('NodeService', () => {
  test('should return filtered children', async () => {
    const mockFs = new MockFileSystem({
      '/test': ['file.txt', '.git', 'node_modules']
    });
    const service = new NodeService(mockFs, new ClaudeCodeFileFilter());

    const children = await service.getChildren({
      type: NodeType.DIRECTORY,
      path: '/test',
      // ...
    });

    assert.equal(children.length, 1);  // 只有 file.txt
    assert.equal(children[0].label, 'file.txt');
  });
});
```

### 集成测试 (验证 VS Code 集成)

```typescript
// test/integration/treeView.integration.test.ts

import * as vscode from 'vscode';
import { UnifiedProvider } from '../../views/unifiedProvider.js';

suite('UnifiedProvider Integration', () => {
  test('should display tree view in VS Code', async () => {
    const provider = new UnifiedProvider(/* ... */);
    const treeItem = await provider.getTreeItem(rootNode);

    assert.equal(treeItem.label, 'Global Configuration');
    // 验证 VS Code TreeItem 属性
  });
});
```

## 文件结构

```
src/
├── types/
│   ├── nodeData.ts          # 纯数据接口 (新增)
│   ├── menuInterfaces.ts    # 菜单接口 (保留)
│   └── treeNode.ts          # TreeDataProvider 数据 (保留)
├── services/
│   ├── nodeService.ts       # 节点业务逻辑 (新增)
│   ├── deleteService.ts     # 删除业务逻辑 (新增)
│   ├── copyService.ts       # 复制业务逻辑 (新增)
│   ├── environmentManager.ts # 环境管理 (重构，注入 UI 接口)
│   └── ...                  # 其他服务 (保留)
├── adapters/
│   ├── vscode.ts            # VS Code API 适配器 (保留)
│   ├── ui.ts                # UI 交互适配器 (新增)
│   └── treeItemFactory.ts   # TreeItem 工厂 (新增)
├── commands/
│   ├── deleteCommand.ts     # 删除命令处理器 (重构)
│   ├── copyCommand.ts       # 复制命令处理器 (重构)
│   └── ...                  # 其他命令 (重构)
├── views/
│   ├── baseProvider.ts      # 基础 Provider (重构)
│   └── unifiedProvider.ts   # 统一 Provider (重构)
└── extension.ts             # 入口 (更新)
```

## 兼容性

- **向后兼容**: 保留现有 API，渐进式迁移
- **测试覆盖**: 确保所有现有测试通过
- **功能等价**: 新架构提供相同功能

## 收益

1. **可测试性**: 核心业务逻辑可在无 VS Code 环境下测试
2. **可维护性**: 职责分离清晰，代码易于理解和修改
3. **可扩展性**: 新增功能只需添加 Service 和 Command Handler
4. **性能**: 业务逻辑和 UI 分离，便于优化
