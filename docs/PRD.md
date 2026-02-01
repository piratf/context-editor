# 产品方案设计文档: Context Editor (VS Code Extension)

## 1. 产品定位与核心价值

Context Editor 是一款专为 Claude Code 打造的集成配置管理插件。它通过自动识别全局项目索引，将散落在磁盘各处的 CLAUDE.md、settings.json 及 MCP 配置聚合为直观的树状层级，实现"上帝视角"下的 AI 指令控制。

## 2. 核心特性 (Core Features)

### A. 全局项目自动化发现
- **索引解析**：实时监控 `$HOME/.claude.json`，自动提取所有已注册的 Claude 项目路径。
- **跨域展示**：在侧边栏统一展示所有项目，无需将它们手动加入 VS Code 工作区即可进行配置编辑。

### B. 指令层级可视化编辑器 (The Context Tree)
- **继承链映射**：自动扫描并展示从 Global (~) -> Project Root -> Sub-folder 的所有 CLAUDE.md 文件。
- **优先级审计**：通过 UI 视觉区分（如颜色深浅），提示开发者哪些规则正在生效，哪些被下层配置覆盖。
- **多维编辑**：支持 side-by-side 编辑不同层级的指令文件，确保逻辑一致性。

### C. MCP 与 安全控制台
- **可视化 MCP 注册表**：将 `.claude/settings.json` 中的 MCP 服务器列表转化为带开关的 UI 面板。
- **权限预检**：图形化管理 `permissions` 字段，一键阻止 AI 访问敏感的 `.env` 或 `.git` 目录。

## 3. 技术栈 (Technical Stack)

- **核心框架**: VS Code Extension API
- **开发语言**: TypeScript (严格模式)
- **配置解析**: 原生 fs/promises, JSON 解析
- **开源协议**: MPL 2.0

## 4. 项目架构 (Architecture)

### A. 目录结构

```
context-editor/
├── src/
│   ├── extension.ts              # 扩展入口点，注册视图和命令
│   ├── views/
│   │   ├── globalProvider.ts     # Global Persona 视图提供者
│   │   └── projectProvider.ts    # Project Registry 视图提供者
│   ├── services/
│   │   └── claudeConfigReader.ts # Claude 配置文件读取器
│   ├── types/
│   │   └── claudeConfig.ts       # TypeScript 类型定义
│   └── test/                     # 测试文件
├── package.json                  # 扩展清单
├── tsconfig.json                 # TypeScript 配置
├── eslint.config.mjs             # ESLint 配置
└── .vscode/
    ├── launch.json               # 调试配置
    └── settings.json             # VS Code 设置
```

### B. 双视图架构

#### Global Persona (contextEditorGlobal)
- **功能**：显示全局 Claude 配置
- **内容**：
  - `~/.claude.json` - 全局配置文件
  - `~/.claude/` - 目录树结构
- **TreeDataProvider**: `GlobalProvider`

#### Project Registry (contextEditorProjects)
- **功能**：显示已注册的项目
- **内容**：
  - 所有从 `~/.claude.json` 解析的项目
  - 每个项目的 CLAUDE.md 和配置文件
- **TreeDataProvider**: `ProjectProvider`

### C. 核心模块说明

#### GlobalProvider
```typescript
class GlobalProvider implements vscode.TreeDataProvider<GlobalTreeNode>
```
- 读取 `~/.claude.json` 文件
- 递归扫描 `~/.claude/` 目录
- 支持点击打开文件

#### ProjectProvider
```typescript
class ProjectProvider implements vscode.TreeDataProvider<TreeNode>
```
- 解析 `~/.claude.json` 中的项目
- 检查每个项目的 CLAUDE.md 和配置文件
- 支持多种配置格式

#### ClaudeConfigReader
```typescript
class ClaudeConfigReader
```
- 读取 `~/.claude.json` 配置
- 支持多种项目格式
- 缓存配置以提高性能

## 5. 静态检查方案 (Static Analysis)

### A. ESLint 配置
- 使用 `typescript-eslint` 严格规则
- 启用 `no-unsafe-*` 规则
- 强制类型检查

### B. TypeScript 严格模式
- `strict: true` - 启用所有严格类型检查
- `noUncheckedIndexedAccess: true` - 索引访问严格检查
- 自定义类型定义确保类型安全

### C. Git Hooks
- **pre-commit**: lint-staged (ESLint + Prettier)
- **pre-push**: 运行测试 (可跳过: `SKIP_TESTS=1 git push`)

## 6. 调试指南 (Debugging Guide)

### A. 开发环境启动

1. **F5 启动**
   - 在 VS Code 中按 F5 启动 Extension Development Host
   - 新窗口会自动加载扩展

2. **命令行启动**
   ```bash
   # 启用扩展调试
   code --inspect-extensions=9222 --new-window .

   # 启动扩展开发主机
   code --new-window --extensionDevelopmentPath=$(pwd) .
   ```

### B. 验证扩展状态

```bash
# 1. 检查扩展安装
code --list-extensions | grep context-editor

# 2. 查看扩展日志
find ~/.vscode-server/data/logs -name "*Context Editor.log"

# 3. 检查进程状态
ps aux | grep extensionHost

# 4. 验证视图配置
cat ~/.vscode-server/extensions/piratf.context-editor*/package.json | grep -A 20 views
```

### C. 常见问题排查

| 问题 | 原因 | 解决 |
|------|------|------|
| 扩展未激活 | activationEvents 配置错误 | 检查 package.json |
| 视图不显示 | 视图 ID 不匹配 | 确保 package.json 和 extension.ts 一致 |
| "no data provider" | TreeDataProvider 未注册 | 检查 registerTreeDataProvider 调用 |
| WSL2 测试失败 | 缺少 GUI 库 | 使用 SKIP_TESTS=1 git push |

### D. 调试端口 Inspector 能力

Extension Host 通过 Chrome DevTools Protocol 暴露强大的调试接口。

#### HTTP 端点

| 端点 | 返回信息 |
|------|----------|
| `/json` | 进程信息、WebSocket URL、DevTools URL |
| `/json/version` | Node.js 版本、协议版本 |
| `/json/protocol` | 完整协议 (90KB+) |

#### 12 个调试域

| 域 | 功能 | 主要命令 |
|---|------|----------|
| **Runtime** | 运行时操作 | `evaluate`, `getProperties`, `globalLexicalScopeNames` |
| **Debugger** | 断点调试 | `setBreakpoint`, `stepInto/Over/Out`, `getScriptSource` |
| **HeapProfiler** | 内存分析 | `takeHeapSnapshot`, `collectGarbage`, `getHeapSnapshot` |
| **Profiler** | CPU 性能 | `start`, `stop`, `getProfilerReport` |
| **Console** | 控制台 | `enable`, `disable`, `clearMessages` |
| **Network** | 网络监控 | `getResponseBody` |
| **NodeRuntime** | Node.js 特定 | `awaitPromise`, `notifyWhenWaitingForDebugger` |
| **NodeWorker** | Worker 管理 | `sendMessageToWorker`, `enable`, `detach` |
| **NodeTracing** | 追踪 | `getCategories`, `start`, `stop` |
| **Target** | 目标管理 | `getTargets`, `createTarget`, `closeTarget` |
| **IO** | 文件系统 | `read`, `resolveBlob` |
| **Schema** | 类型定义 | `getDomains` |

#### 可获取的信息

1. **进程信息**: PID、Node.js 版本、启动参数、环境变量
2. **代码信息**: 所有脚本列表、源代码、函数列表、作用域链
3. **运行时状态**: 变量值、对象属性、内存使用、调用栈
4. **调试功能**: 设置断点、单步执行、表达式求值
5. **性能数据**: CPU profile、堆快照、内存统计
6. **扩展信息**: 已注册扩展、命令、视图配置
7. **网络监控**: 请求/响应数据
8. **控制台**: 所有日志输出

#### WebSocket 调用示例

```javascript
// 获取所有已加载脚本
{"id":1,"method":"Debugger.getScriptSources"}

// 执行表达式获取环境变量
{"id":2,"method":"Runtime.evaluate","params":{"expression":"process.env"}}

// 获取内存使用
{"id":3,"method":"Runtime.evaluate","params":{"expression":"process.memoryUsage()"}}

// 获取堆快照
{"id":4,"method":"HeapProfiler.takeHeapSnapshot"}

// 设置断点
{"id":5,"method":"Debugger.setBreakpointByUrl","params":{"lineNumber":10}}

// 获取调用栈
{"id":6,"method":"Debugger.getStackTrace"}
```

#### 使用 Chrome DevTools

1. 访问 `chrome://inspect`
2. 添加 `127.0.0.1:9223` 作为目标
3. 在 "Remote Target" 中找到 "node.js instance"
4. 点击 "inspect" 打开 DevTools

#### 快速检查命令

```bash
# 检查 inspector 状态
curl http://127.0.0.1:9223/json/version
curl http://127.0.0.1:9223/json

# 获取进程信息
curl http://127.0.0.1:9223/json | jq '.[0] | {title, type}'
```

### E. 使用调试 Skill

项目包含 `vscode-extension-debug` skill，包含：
- 完整的调试命令和问题排查指南
- 调试端口 Inspector 能力详细说明
- Chrome DevTools 连接步骤
- WebSocket 调用示例

## 7. 开发进展 (Development Progress)

### 已完成 (Completed)

- [x] 项目初始化 (TypeScript + ESLint + 测试)
- [x] 基础类型定义 (ClaudeConfig 接口)
- [x] ClaudeConfigReader (支持多种配置格式)
- [x] ProjectProvider (项目注册视图)
- [x] GlobalProvider (全局配置视图)
- [x] 双视图 UI 实现
- [x] 文件打开功能
- [x] 刷新命令
- [x] Debug Output 面板
- [x] 测试基础设施
- [x] Git Hooks 配置
- [x] GitHub Actions CI

### 最新提交 (Latest Commits)

```
e7ac997 feat: implement dual-panel UI for Context Editor
9b9927d fix: revert package.json to single view for critical bug fix
a92266b fix: improve project discovery and add debug output
8b4b643 feat: configure pre-commit and pre-push hooks
365c9eb feat: add VS Code extension test infrastructure
```

### 待实现 (Pending)

- [ ] MCP 服务器配置可视化
- [ ] 权限管理 UI
- [ ] 指令继承链可视化
- [ ] 配置文件编辑器
- [ ] JSON Schema 校验集成

## 8. SEO 推广与仓库配置

- **GitHub Description**: Dedicated visual editor for Claude Code. Orchestrate nested CLAUDE.md trees, MCP servers, and global project settings in a unified VS Code sidebar.
- **License**: MPL-2.0
- **Topics**: claude-code, mcp-protocol, instruction-hierarchy, vscode-extension, anthropic
- **Repository**: https://github.com/piratf/context-editor

## 9. 更新日志 (Changelog)

### Version 0.0.1 (当前)

**新增功能**:
- 双视图 UI (Global Persona + Project Registry)
- 自动发现 Claude 项目
- 配置文件树形展示
- 点击打开文件功能
- Debug Output 面板

**技术实现**:
- TypeScript 严格模式
- ESLint 静态检查
- Git Hooks 自动化
- GitHub Actions CI

---

**文档版本**: v2.0
**最后更新**: 2025-02-01
**维护者**: piratf
