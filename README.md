<p align="center">
  <img src="resources/icon.png" width="120" alt="Context Editor Icon">
</p>

<h1 align="center">Context Editor</h1>

<p align="center">
  <img src="https://img.shields.io/visual-studio-marketplace/v/piratf.context-editor?style=flat-square&logo=visual-studio-code" alt="Version">
  <img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License">
  <img src="https://img.shields.io/badge/VS%20Code-1.96.0%2B-blue?style=flat-square&logo=visual-studio-code" alt="VS Code Version">
  <img src="https://img.shields.io/badge/Status-MVP-orange?style=flat-square&logo=starship" alt="Status: MVP">
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87">简体中文</a>
</p>

---

<h2 id="english">English</h2>

<p align="center">
  <strong>A visual configuration manager designed for Claude Code</strong>
</p>

<p align="center">
  Manage your CLAUDE.md instruction trees, MCP server configurations, and global project settings in a unified VS Code sidebar
</p>

> [!WARNING]
> **This version is MVP (Minimum Viable Product)**
>
> You can now edit all your CLAUDE.md files in one place! More features are under development.

## ✨ Key Features

* 🌳 **Unified Single View** - Streamlined sidebar combining global configuration and project registry in one place
* 🔍 **Auto Discovery** - Automatically parses project configurations from `~/.claude.json`
* 🖥️ **Multi-Environment Support** - Switch between Windows, WSL, macOS, and Linux environments
  * Manage configurations across multiple environments in one VS Code window
  * Automatic path conversion (e.g., `\\wsl.localhost\Ubuntu\home\...` ↔ `C:\Users\...`)
  * Dynamic environment indicator in view title (e.g., "⚡ Windows", "⚡ WSL (Ubuntu)")
* 🔄 **Real-time Refresh** - One-click refresh to apply changes instantly
* 📂 **Direct File Access** - Double-click to open any configuration file in the editor
* 🛠️ **Debug Friendly** - Built-in Debug Output panel for troubleshooting
* 🎨 **Native Experience** - Seamlessly integrates with VS Code's native interface

## 📸 Interface Preview

### Unified Single View

The extension provides a unified sidebar view with two main sections:

> **Global Configuration**
> Displays `~/.claude.json` file and `~/.claude/` directory tree structure

> **Projects**
> Shows all registered Claude Code projects and their Claude configuration files

The view title dynamically shows the current environment (e.g., "⚡ Windows", "⚡ WSL (Ubuntu)") and provides a toolbar button for quick environment switching.

<details>
<summary><b>📁 Tree View Structure Example</b></summary>

```
Context Editor: ⚡ Windows
├── > Global Configuration
│   ├── ~/.claude.json
│   └── > ~/.claude
│       ├── settings.json
│       └── skills/
└── > Projects
    ├── project-alpha
    │   └── > .claude
    │       └── settings.json
    ├── project-beta
    │   ├── CLAUDE.md
    │   └── > .claude
    │       └── context.json
    └── project-gamma
        └── CLAUDE.md
```

> **Note:** Directories (collapsible nodes) display without icons to maintain proper indentation. Files (leaf nodes) display with appropriate icons.

</details>

## 📦 Installation & Usage

### Option 1: Install from VS Code Marketplace

1. Open VS Code Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`)
2. Search for `Context Editor`
3. Click **Install**

### Option 2: Manual Installation

1. Download the latest [`.vsix` file](https://github.com/piratf/context-editor/releases)
2. In VS Code Extensions panel, click "..." → "Install from VSIX..."
3. Select the downloaded `.vsix` file

### Getting Started

1. **Activate Extension** - Extension auto-activates on VS Code startup
2. **Open View** - Click the **Context Editor** icon (home icon) in the activity bar
3. **Browse Configuration** - View unified sidebar with two main sections:
    - **Global Configuration**: Global config files and ~/.claude/ directory
    - **Projects**: All registered Claude projects
4. **Switch Environments** - Click the environment indicator (e.g., "⚡ Windows") in the view title or toolbar to switch environments
5. **Open Files** - Double-click any file to open it in the editor

### Available Commands

| Command | Shortcut | Description |
|:---|:---|:---|
| `Context Editor: Switch Environment` | Click status bar item `⚡ <Environment>` or toolbar button | Switch between available environments (Windows, WSL, macOS, Linux) |
| `Context Editor: Refresh` | Click refresh icon in view title | Refresh configuration view and re-discover environments |
| `Context Editor: Show Debug Output` | Command Palette (`Ctrl+Shift+P`) | Show debug output panel |

## ⚙️ Extension Settings

No additional configuration required. The extension works out of the box.

It automatically reads the following Claude Code configuration files:

```bash
~/.claude.json          # Claude Code main configuration file
~/.claude/              # Global configuration directory
~/.claude/settings.json # Global settings
```

<details>
<summary><b>📋 Supported Project Registration Formats</b></summary>

The extension automatically recognizes two project registration formats in `~/.claude.json`:

**Array Format**
```json
{
  "projects": [
    {"path": "/path/to/project1"},
    {"path": "/path/to/project2"}
  ]
}
```

**Record Format**
```json
{
  "projects": {
    "project1": {"path": "/path/to/project1"},
    "project2": {"path": "/path/to/project2"}
  }
}
```

</details>

## 🚧 Known Limitations

> [!NOTE]
> This extension is currently in **MVP stage**. The following features are under development:

- [ ] MCP server configuration visualization
- [ ] Permission management UI
- [ ] Instruction inheritance chain visualization
- [ ] Built-in configuration file editor
- [ ] JSON Schema validation integration
- [ ] Configuration search and filtering

If you have feature suggestions or encounter bugs, please submit an [Issue](https://github.com/piratf/context-editor/issues).

## 🛠️ Development

### Tech Stack

- **TypeScript** - Strict mode with full type safety
- **VS Code Extension API** - Native extension development
- **ESLint + Prettier** - Code quality assurance
- **Mocha** - Unit and integration testing
- **Husky + lint-staged** - Git Hooks automation

### Development Setup

```bash
# Clone repository
git clone https://github.com/piratf/context-editor.git
cd context-editor

# Install dependencies
npm install

# Compile project
npm run compile

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run lint:fix

# Watch mode compilation
npm run watch
```

### Git Hooks

- **pre-commit**: Automatically runs ESLint and Prettier
- **pre-push**: Automatically runs tests (can be skipped with `SKIP_TESTS=1 git push`)

### Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## 📂 Project Structure

```
context-editor/
├── src/
│   ├── extension.ts              # Extension entry point
│   ├── services/
│   │   ├── configSearch.ts       # Discovers all Claude environments
│   │   ├── environmentManager.ts # Manages current environment
│   │   ├── dataFacade.ts         # Data interface for environments
│   │   ├── nativeDataFacade.ts   # Native environment implementation
│   │   ├── windowsToWslDataFacade.ts
│   │   ├── wslToWindowsDataFacade.ts
│   │   ├── claudeConfigReader.ts # Claude config reader
│   │   ├── environmentDetector.ts # Detects OS and WSL
│   │   └── ...
│   ├── views/
│   │   ├── unifiedProvider.ts    # Unified single view provider
│   │   └── baseProvider.ts       # Base class for tree providers
│   └── types/
│       ├── treeNode.ts           # Tree node types and factory
│       ├── nodeClasses.ts        # Node classes with getChildren() logic
│       └── claudeConfig.ts       # Claude config type definitions
├── resources/
│   ├── icon.png                  # Extension icon
│   └── activity-bar-icon.svg     # Activity bar icon
├── docs/
│   └── ...
├── .github/workflows/
│   └── ci.yml                    # CI configuration
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

## 📄 License

This project is licensed under [MPL-2.0](LICENSE).

## 🔗 Related Links

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=piratf.context-editor)
- [GitHub Repository](https://github.com/piratf/context-editor)
- [Issue Tracker](https://github.com/piratf/context-editor/issues)
- [Claude Code Documentation](https://code.claude.com/docs/en/overview)

---

<h2 id="简体中文">简体中文</h2>

<p align="center">
  <strong>专为 Claude Code 打造的可视化配置管理器</strong>
</p>

<p align="center">
  在统一的 VS Code 侧边栏中管理你的 CLAUDE.md 指令树、MCP 服务器配置和全局项目设置
</p>

> [!WARNING]
> **当前版本为 MVP (最小可行性产品)**
>
> 可以在一个地方编辑所有 CLAUDE.md 了！更多功能正在开发中。

## ✨ 核心特性

* 🌳 **统一单视图** - 精简侧边栏设计，全局配置和项目注册合二为一
* 🔍 **自动发现** - 自动解析 `~/.claude.json` 中的项目配置
* 🖥️ **多环境支持** - 在 Windows、WSL、macOS、Linux 环境间自由切换
  * 一个 VS Code 窗口管理多个环境下的配置
  * 自动路径转换（如 `\\wsl.localhost\Ubuntu\home\...` ↔ `C:\Users\...`）
  * 视图标题动态显示当前环境（如 "⚡ Windows"、"⚡ WSL (Ubuntu)"）
* 🔄 **实时刷新** - 一键刷新配置视图，即时生效
* 📂 **文件直达** - 双击即可打开任意配置文件进行编辑
* 🛠️ **调试友好** - 内置 Debug Output 面板，方便问题排查
* 🎨 **原生体验** - 完美集成 VS Code 原生界面风格

## 📸 界面预览

### 统一单视图设计

扩展提供统一的侧边栏视图，包含两个主要部分：

> **Global Configuration（全局配置）**
> 显示 `~/.claude.json` 文件和 `~/.claude/` 目录树结构

> **Projects（项目列表）**
> 展示所有已注册的 Claude Code 项目及其 Claude 配置文件

视图标题动态显示当前环境（如 "⚡ Windows"、"⚡ WSL (Ubuntu)"），并提供工具栏按钮用于快速切换环境。

<details>
<summary><b>📁 树视图结构示例</b></summary>

```
Context Editor: ⚡ Windows
├── > Global Configuration
│   ├── ~/.claude.json
│   └── > ~/.claude
│       ├── settings.json
│       └── skills/
└── > Projects
    ├── project-alpha
    │   └── > .claude
    │       └── settings.json
    ├── project-beta
    │   ├── CLAUDE.md
    │   └── > .claude
    │       └── context.json
    └── project-gamma
        └── CLAUDE.md
```

> **注意**：目录（可展开节点）不显示图标以保持正确的缩进对齐。文件（叶子节点）显示相应的图标。

</details>

## 📦 安装与使用

### 方式一：从 VS Code Marketplace 安装

1. 打开 VS Code 扩展面板（`Ctrl+Shift+X` / `Cmd+Shift+X`）
2. 搜索 `Context Editor`
3. 点击 **安装**

### 方式二：手动安装

1. 从 [Releases](https://github.com/piratf/context-editor/releases) 下载最新的 `.vsix` 文件
2. 在 VS Code 扩展面板点击 "..." → "从 VSIX 安装..."
3. 选择下载的 `.vsix` 文件

### 使用步骤

1. **激活扩展** - 扩展会在 VS Code 启动时自动激活
2. **打开视图** - 点击活动栏中的 **Context Editor** 图标（首页图标）
3. **浏览配置** - 查看统一侧边栏，包含两个主要部分：
    - **Global Configuration**：全局配置文件和 ~/.claude/ 目录
    - **Projects**：所有已注册的 Claude Code 项目
4. **切换环境** - 点击视图标题中的环境指示器（如 "⚡ Windows"）或工具栏按钮切换环境
5. **打开文件** - 双击任意文件即可在编辑器中打开

### 可用命令

| 命令 | 快捷方式 | 说明 |
|:---|:---|:---|
| `Context Editor: Switch Environment` | 点击状态栏项 `⚡ <环境名>` 或工具栏按钮 | 在可用环境（Windows、WSL、macOS、Linux）之间切换 |
| `Context Editor: Refresh` | 点击视图标题栏刷新图标 | 刷新配置视图并重新发现环境 |
| `Context Editor: Show Debug Output` | 命令面板 (`Ctrl+Shift+P`) | 显示调试输出面板 |

## ⚙️ 扩展配置

目前本扩展无需额外配置，安装后即可使用。

扩展会自动读取以下 Claude Code 配置文件：

```bash
~/.claude.json          # Claude Code 主配置文件
~/.claude/              # 全局配置目录
~/.claude/settings.json # 全局设置
```

<details>
<summary><b>📋 支持的项目注册格式</b></summary>

扩展自动识别 `~/.claude.json` 中的两种项目注册格式：

**数组格式**
```json
{
  "projects": [
    {"path": "/path/to/project1"},
    {"path": "/path/to/project2"}
  ]
}
```

**记录格式**
```json
{
  "projects": {
    "project1": {"path": "/path/to/project1"},
    "project2": {"path": "/path/to/project2"}
  }
}
```

</details>

## 🚧 已知限制

> [!NOTE]
> 本扩展目前处于 **MVP 阶段**，以下功能正在开发中：

- [ ] MCP 服务器配置可视化
- [ ] 权限管理 UI
- [ ] 指令继承链可视化
- [ ] 内置配置文件编辑器
- [ ] JSON Schema 校验集成
- [ ] 配置搜索和过滤功能

如果你有功能建议或遇到 Bug，欢迎提交 [Issue](https://github.com/piratf/context-editor/issues)。

## 🛠️ 开发

### 技术栈

- **TypeScript** - 严格模式，完整类型安全
- **VS Code Extension API** - 原生扩展开发
- **ESLint + Prettier** - 代码质量保障
- **Mocha** - 单元测试和集成测试
- **Husky + lint-staged** - Git Hooks 自动化

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/piratf/context-editor.git
cd context-editor

# 安装依赖
npm install

# 编译项目
npm run compile

# 运行测试
npm test

# 代码检查
npm run lint

# 代码格式化
npm run lint:fix

# 监听模式编译
npm run watch
```

### Git Hooks

- **pre-commit**：自动运行 ESLint 和 Prettier
- **pre-push**：自动运行测试（可通过 `SKIP_TESTS=1 git push` 跳过）

### 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'feat: add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 创建 Pull Request

## 📂 项目结构

```
context-editor/
├── src/
│   ├── extension.ts              # 扩展入口点
│   ├── services/
│   │   ├── configSearch.ts       # 发现所有 Claude 环境
│   │   ├── environmentManager.ts # 管理当前环境
│   │   ├── dataFacade.ts         # 环境数据接口
│   │   ├── nativeDataFacade.ts   # 原生环境实现
│   │   ├── windowsToWslDataFacade.ts
│   │   ├── wslToWindowsDataFacade.ts
│   │   ├── claudeConfigReader.ts # Claude 配置读取器
│   │   ├── environmentDetector.ts # 检测操作系统和 WSL
│   │   └── ...
│   ├── views/
│   │   ├── unifiedProvider.ts    # 统一单视图提供器
│   │   └── baseProvider.ts       # 树视图提供器基类
│   └── types/
│       ├── treeNode.ts           # 树节点类型和工厂方法
│       ├── nodeClasses.ts        # 带有 getChildren() 的节点类
│       └── claudeConfig.ts       # Claude 配置类型定义
├── resources/
│   ├── icon.png                  # 扩展图标
│   └── activity-bar-icon.svg     # 活动栏图标
├── docs/
│   └── ...
├── .github/workflows/
│   └── ci.yml                    # CI 配置
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

## 📄 许可证

本项目采用 [MPL-2.0 许可证](LICENSE) 开源。

## 🔗 相关链接

- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=piratf.context-editor)
- [GitHub 仓库](https://github.com/piratf/context-editor)
- [问题反馈](https://github.com/piratf/context-editor/issues)
- [Claude Code 文档](https://code.claude.com/docs/zh-CN/overview)

---

<p align="center">Made with ❤️ by <a href="https://github.com/piratf">piratf</a></p>
