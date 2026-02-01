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
- **开发语言**: TypeScript
- **配置解析**: jsonc-parser (处理带注释的 JSON), fs-extra (增强型文件系统操作)
- **开源协议**: MPL 2.0 (保护核心源码，允许生态集成)

## 4. 静态检查方案 (Static Analysis)

为了保证插件在处理用户敏感路径和复杂 JSON 时的稳定性，必须配置以下检查方案：

### A. ESLint 配置
重点拦截潜在的路径拼接风险与异步文件操作错误：
- 使用 `eslint-plugin-node` 确保路径操作遵循跨平台规范。
- 强制要求对所有的 fs 异步操作进行 try-catch 包装，防止因权限不足导致插件崩溃。

### B. TypeScript 严格模式
- 开启 `strict: true`，确保在解析 `.claude.json` 这种动态数据源时，对 `undefined` 和 `null` 进行充分检查。
- 定义严格的 `ClaudeConfig` 接口模型，对不同版本的 Claude CLI 配置文件进行模式匹配。

### C. JSON Schema 校验
集成官方的 `.claude/settings.json` Schema，在用户通过插件编辑配置时，实时检测格式是否合法。

## 5. 调试指南 (Debugging Guide)

### A. 开发环境启动
1. 在 VS Code 中打开项目，按 **F5** 启动 Extension Development Host。
2. 插件会自动加载。此时可以在新窗口中观察侧边栏图标是否出现。

### B. 核心逻辑调试点
**全局索引解析**：
- 观察 Output 控制台输出的日志，确认 `os.homedir()` 路径获取是否正确。
- 断点检查 `projects` 数组是否能正确解析 `.claude.json` 中的键值对。

**虚拟文件树渲染**：
- 检查 `TreeDataProvider` 的 `getChildren` 方法，验证在非 Workspace 路径下的文件是否能被正确读取。

**文件打开逻辑**：
- 测试点击侧边栏节点时，`vscode.workspace.openTextDocument` 是否能跨磁盘路径呼起编辑器。

### C. 模拟环境测试
建议在测试机上手动创建一个 `.claude.json` 样板文件，包含 2-3 个不存在的路径和 1 个真实路径，测试插件的错误处理与容错能力。

## 6. SEO 推广与仓库配置

- **GitHub Description**: Dedicated visual editor for Claude Code. Orchestrate nested CLAUDE.md trees, MCP servers, and global project settings in a unified VS Code sidebar.
- **License**: MPL-2.0 (在 GitHub 创建时选定)
- **Topics**: claude-code, mcp-protocol, instruction-hierarchy, vscode-extension, anthropic

## 7. MVP 开发第一步 (Code Skeleton)

您的核心任务是实现 `ProjectProvider.ts`：
- 该类需要继承 `vscode.TreeDataProvider`
- 核心逻辑是读取 `~/.claude.json` 并将其 `projects` 字段转化为树形节点。
