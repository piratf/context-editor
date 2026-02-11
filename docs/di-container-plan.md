# 依赖注入容器实现计划

## 当前问题分析

```typescript
// contextMenu.ts - 每次命令执行都创建新实例
export async function copyName(node: unknown): Promise<void> {
  const clipboardService = new VsCodeClipboardService();  // 重复创建
  const copyService = CopyServiceFactory.create(clipboardService);
  // ...
}

export async function deleteNode(node: unknown): Promise<void> {
  const fileDeleter = new VsCodeFileDeleter();  // 重复创建
  const dialogService = new VsCodeDialogService();  // 重复创建
  const deleteService = DeleteServiceFactory.create(fileDeleter, dialogService);
  // ...
}
```

**问题**：
- Adapter 实例无法复用
- Service 实例无法共享
- 无法注入 mock 进行测试
- 命令之间无法共享状态

## 解决方案设计

### 1. 容器接口定义

```typescript
// src/di/container.ts

/**
 * 依赖注入容器
 *
 * 负责创建和共享服务实例的生命周期管理
 */
export interface DIContainer {
  /**
   * 获取或创建服务实例
   * @param token - 服务标识符
   */
  get<T>(token: ServiceToken<T>): T;

  /**
   * 注册单例服务
   * @param token - 服务标识符
   * @param factory - 创建工厂
   */
  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void;

  /**
   * 注册瞬态服务（每次获取创建新实例）
   */
  registerTransient<T>(token: ServiceToken<T>, factory: () => T): void;
}

/**
 * 服务标识符 - 使用 Symbol 作为类型安全的键
 */
export class ServiceToken<T> {
  constructor(public readonly description: string) {}
}
```

### 2. 容器实现

```typescript
// src/di/container.ts

export class SimpleDIContainer implements DIContainer {
  private singletons = new Map<ServiceToken<unknown>, unknown>();
  private transientFactories = new Map<ServiceToken<unknown>, () => unknown>();

  get<T>(token: ServiceToken<T>): T {
    // 优先返回单例
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    // 创建瞬态实例
    const factory = this.transientFactories.get(token);
    if (factory) {
      return factory() as T;
    }

    throw new Error(`Service not registered: ${token.description}`);
  }

  registerSingleton<T>(token: ServiceToken<T>, factory: () => T): void {
    const instance = factory();
    this.singletons.set(token, instance);
  }

  registerTransient<T>(token: ServiceToken<T>, factory: () => T): void {
    this.transientFactories.set(token, factory);
  }
}
```

### 3. 服务令牌定义

```typescript
// src/di/tokens.ts

import { ServiceToken } from "./container.js";

/**
 * 所有服务令牌的集中定义
 *
 * 使用 Symbol 确保类型安全和唯一性
 */
export const ServiceTokens = {
  // Adapters (单例 - VS Code API 包装器)
  ClipboardService: new ServiceToken<VsCodeClipboardService>("ClipboardService"),
  FileDeleter: new ServiceToken<VsCodeFileDeleter>("FileDeleter"),
  DialogService: new ServiceToken<VsCodeDialogService>("DialogService"),
  FolderOpener: new ServiceToken<VsCodeFolderOpener>("FolderOpener"),

  // Services (瞬态 - 每次获取创建新实例)
  CopyService: new ServiceToken<CopyService>("CopyService"),
  DeleteService: new ServiceToken<DeleteService>("DeleteService"),
  OpenVscodeService: new ServiceToken<OpenVscodeService>("OpenVscodeService"),
  NodeService: new ServiceToken<NodeService>("NodeService"),
} as const;
```

### 4. 容器初始化

```typescript
// src/di/setup.ts

import { SimpleDIContainer } from "./container.js";
import { ServiceTokens } from "./tokens.js";
import {
  VsCodeClipboardService,
  VsCodeFileDeleter,
  VsCodeDialogService,
  VsCodeFolderOpener,
} from "../adapters/ui.js";
import { VsCodeFileDeleter as VsCodeFileDeleterAdapter } from "../adapters/vscode.js";
import { CopyService } from "../services/copyService.js";
import { DeleteService } from "../services/deleteService.js";
import { OpenVscodeService } from "../services/openVscodeService.js";
import { NodeService } from "../services/nodeService.js";

/**
 * 创建并配置依赖注入容器
 *
 * 在 extension.ts 激活时调用一次
 */
export function createContainer(): SimpleDIContainer {
  const container = new SimpleDIContainer();

  // 注册单例 Adapters (VS Code API 包装器)
  container.registerSingleton(
    ServiceTokens.ClipboardService,
    () => new VsCodeClipboardService()
  );

  container.registerSingleton(
    ServiceTokens.FileDeleter,
    () => new VsCodeFileDeleterAdapter()
  );

  container.registerSingleton(
    ServiceTokens.DialogService,
    () => new VsCodeDialogService()
  );

  container.registerSingleton(
    ServiceTokens.FolderOpener,
    () => new VsCodeFolderOpener()
  );

  // 注册瞬态 Services (业务逻辑)
  container.registerTransient(ServiceTokens.CopyService, () => {
    const clipboard = container.get(ServiceTokens.ClipboardService);
    return new CopyService(clipboard);
  });

  container.registerTransient(ServiceTokens.DeleteService, () => {
    const fileDeleter = container.get(ServiceTokens.FileDeleter);
    const dialog = container.get(ServiceTokens.DialogService);
    return new DeleteService(fileDeleter, dialog);
  });

  container.registerTransient(ServiceTokens.OpenVscodeService, () => {
    const folderOpener = container.get(ServiceTokens.FolderOpener);
    return new OpenVscodeService(folderOpener);
  });

  container.registerTransient(ServiceTokens.NodeService, () => {
    return new NodeService();
  });

  return container;
}
```

### 5. 命令处理器更新

```typescript
// src/commands/contextMenu.ts

export async function copyName(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot copy name", "Selected item does not support copying names.");
    return;
  }

  // 从容器获取服务
  const copyService = container.get(ServiceTokens.CopyService);
  const result = await copyService.copyName(data);
  // ...
}

export async function deleteNode(node: unknown): Promise<void> {
  const data = extractNodeData(node);
  if (!data) {
    showErrorMessage("Cannot delete", "Selected item does not support deletion.");
    return;
  }

  // 从容器获取服务（自动注入依赖）
  const deleteService = container.get(ServiceTokens.DeleteService);

  if (!deleteService.canDelete(data)) {
    showErrorMessage("Cannot delete", "This item cannot be deleted.");
    return;
  }
  // ...
}
```

### 6. Extension 集成

```typescript
// src/extension.ts

import { createContainer } from "./di/setup.js";
import { SimpleDIContainer } from "./di/container.js";

// 全局容器实例
let container: SimpleDIContainer;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // ... 现有初始化代码 ...

  // 创建 DI 容器
  container = createContainer();

  // 注册命令（传递容器）
  registerContextMenuCommands(context, container);
}

// src/commands/contextMenu.ts
let container: SimpleDIContainer;

export function registerContextMenuCommands(
  context: vscode.ExtensionContext,
  diContainer: SimpleDIContainer
): void {
  container = diContainer;

  // 注册命令...
}
```

## 架构图对比

```
┌─────────────────────────────────────────────────────────────────┐
│                         当前架构                                  │
├─────────────────────────────────────────────────────────────────┤
│  Command ──> new VsCodeClipboardService() ──> new CopyService() │
│  Command ──> new VsCodeFileDeleter() ──> new DeleteService()    │
│  Command ──> new VsCodeFolderOpener() ──> new OpenVscodeService()│
│                                                                  │
│  问题: 每次创建新实例，无法共享，无法注入测试                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         DI 容器架构                              │
├─────────────────────────────────────────────────────────────────┤
│                     SimpleDIContainer                            │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Singletons      │    │ Transients      │                     │
│  │ (Adapters)      │    │ (Services)      │                     │
│  ├─────────────────┤    ├─────────────────┤                     │
│  │ ClipboardService│───>│ CopyService     │                     │
│  │ FileDeleter     │───>│ DeleteService   │                     │
│  │ DialogService   │───>│ OpenVscodeService│                    │
│  │ FolderOpener    │    │                 │                     │
│  └─────────────────┘    └─────────────────┘                     │
│         ▼                                                       │
│    container.get(ServiceTokens.XXX)                             │
│         ▼                                                       │
│  Commands (共享实例)                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 实现步骤

1. **创建容器模块** `src/di/container.ts`
2. **定义服务令牌** `src/di/tokens.ts`
3. **实现容器设置** `src/di/setup.ts`
4. **更新命令处理器** 使用 `container.get()`
5. **集成到 extension.ts** 在激活时创建容器
6. **编写单元测试** 验证容器行为

## 测试支持

```typescript
// 测试中可以注入 mock
const testContainer = new SimpleDIContainer();
testContainer.registerSingleton(
  ServiceTokens.ClipboardService,
  () => new MockClipboardService()
);
testContainer.registerTransient(
  ServiceTokens.CopyService,
  () => new CopyService(testContainer.get(ServiceTokens.ClipboardService))
);
```

## 收益分析

| 方面 | 当前 | DI 容器 |
|------|------|---------|
| Adapter 复用 | ❌ 每次创建 | ✅ 单例共享 |
| Service 共享 | ❌ 无法共享 | ✅ 可选单例 |
| 测试注入 | ❌ 无法 mock | ✅ 容器替换 |
| 状态管理 | ❌ 无状态共享 | ✅ 可选状态服务 |
| 生命周期 | ❌ 无管理 | ✅ 单例/瞬态 |

## VS Code 扩展特定考虑

### 生命周期集成

根据 VS Code 官方文档，扩展需要正确管理资源生命周期：

```typescript
// extension.ts
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // 1. 创建 DI 容器
  container = createContainer();

  // 2. 注册命令（使用 context.subscriptions 管理清理）
  registerContextMenuCommands(context, container);

  // 3. 容器本身可以作为可释放资源注册
  // 如果需要清理逻辑
  context.subscriptions.push({
    dispose: () => {
      // 容器清理逻辑（如果需要）
      container.dispose?.();
    }
  });
}

export function deactivate() {
  // VS Code 卸载扩展时调用
  // 大多数情况不需要显式清理，因为 context.subscriptions 会处理
}
```

### 状态管理选择

VS Code 提供多种状态存储选项，DI 容器应与之配合：

| 状态类型 | VS Code API | DI 容器职责 |
|---------|-------------|-------------|
| 全局配置 | `context.globalState` | 提供 StateService 封装 |
| 工作区状态 | `context.workspaceState` | 提供 StateService 封装 |
| 秘密存储 | `context.secrets` | 提供 SecretService 封装 |
| 临时状态 | 容器内单例 | 有状态服务实例 |

```typescript
// 推荐模式：通过容器访问状态
export const ServiceTokens = {
  // ... 其他服务

  // 状态服务 - 封装 VS Code 状态 API
  GlobalStateService: new ServiceToken<GlobalStateService>("GlobalStateService"),
  WorkspaceStateService: new ServiceToken<WorkspaceStateService>("WorkspaceStateService"),
} as const;

// 在 setup.ts 中
export function createContainer(context: vscode.ExtensionContext): SimpleDIContainer {
  const container = new SimpleDIContainer();

  // 状态服务需要 context
  container.registerSingleton(
    ServiceTokens.GlobalStateService,
    () => new GlobalStateService(context.globalState)
  );

  return container;
}
```

### 资源清理模式

VS Code 推荐 `onDidDispose` 模式，DI 容器应支持：

```typescript
// 对于有清理需求的服务
interface Disposable {
  dispose(): void;
}

// 容器支持自动清理
class SimpleDIContainer implements DIContainer, Disposable {
  private singletons = new Map<ServiceToken<unknown>, unknown>();

  dispose(): void {
    // 清理所有单例
    for (const [token, instance] of this.singletons) {
      if (this.isDisposable(instance)) {
        instance.dispose();
      }
    }
    this.singletons.clear();
  }

  private isDisposable(obj: unknown): obj is Disposable {
    return typeof obj === 'object' && obj !== null && 'dispose' in obj;
  }
}
```

### 测试最佳实践

VS Code 扩展测试使用 `@vscode/test-electron`，DI 容器应支持测试场景：

```typescript
// 测试中的容器设置
import { createTestContainer } from "../di/testSetup.js";

describe("CopyService", () => {
  it("should copy name", async () => {
    // 创建测试容器，注入 mock
    const container = createTestContainer({
      clipboardService: new MockClipboardService(),
    });

    const copyService = container.get(ServiceTokens.CopyService);
    const result = await copyService.copyName(mockNodeData);

    assert.strictEqual(result.success, true);
  });
});
```

### 避免的反模式

根据 VS Code 文档：

❌ **不在命令中直接 `new` VS Code API 包装器**
```typescript
// 避免
export async function copyName(node: unknown) {
  const clipboard = new VsCodeClipboardService();  // 每次创建
  // ...
}
```

✅ **使用容器共享**
```typescript
// 推荐
export async function copyName(node: unknown) {
  const clipboard = container.get(ServiceTokens.ClipboardService);  // 单例
  const copyService = container.get(ServiceTokens.CopyService);
  // ...
}
```

❌ **不使用 `retainContextWhenHidden` 风格的状态管理**
- VS Code 警告：高内存开销
- 应使用轻量级的状态序列化

✅ **使用 `context.globalState/workspaceState` 持久化**
```typescript
// 轻量级状态管理
class StateService {
  constructor(private readonly state: vscode.Memento) {}

  get<T>(key: string): T | undefined {
    return this.state.get<T>(key);
  }

  async update(key: string, value: unknown): Promise<void> {
    await this.state.update(key, value);
  }
}
```
