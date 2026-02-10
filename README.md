<p align="center">
  <img src="resources/icon.png" width="120" alt="Context Editor Icon">
</p>

<h1 align="center">Context Editor</h1>

<p align="center">
  <img src="https://img.shields.io/vscode-marketplace/v/piratf.context-editor?style=flat-square&logo=visual-studio-code" alt="Version">
  <img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License">
  <img src="https://img.shields.io/badge/VS%20Code-1.96.0%2B-blue?style=flat-square&logo=visual-studio-code" alt="VS Code Version">
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

## ✨ Key Features

* 🌳 **Unified Configuration Management** - Manage your user scope (`~/.claude`) and all project Claude configurations in one single interface
* 🔍 **Auto Discovery** - Automatically parses project configurations from `~/.claude.json`
* 🖥️ **Multi-Platform Support** - Works on Windows, WSL, macOS, and Linux. Windows users can seamlessly access both native and WSL environment configurations
* ⚡ **Quick Actions** - Right-click menu for copy, delete, create file/folder, and open in new window
* 🎨 **Native Experience** - Seamlessly integrates with VS Code's native interface

## 📸 Interface Preview

### Unified Configuration Management

The extension provides a unified sidebar to manage all your Claude configurations:

> **Global Configuration**
> Displays `~/.claude.json` file and `~/.claude/` directory tree structure

> **Projects**
> Shows all registered Claude Code projects and their Claude configuration files

The view title dynamically shows the current environment (e.g., "⚡ Windows", "⚡ WSL (Ubuntu)") and provides a toolbar button for quick environment switching.

### Context Menu

Right-click on any item in the tree view to access quick actions:

| Menu Item | Description |
|:---|:---|
| **Copy Name** | Copy the item name to clipboard |
| **Copy Path** | Copy the full file/directory path |
| **Delete** | Delete the selected file or directory |
| **Open in New Window** | Open a directory in a new VS Code window |
| **Create File** | Create a new file in the selected directory |
| **Create Folder** | Create a new folder in the selected directory |

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

## ✨ 核心特性

* 🌳 **统一配置管理** - 在一个界面中直接管理 user scope（`~/.claude`）和所有项目的 Claude 配置
* 🔍 **自动发现** - 自动解析 `~/.claude.json` 中的项目配置
* 🖥️ **多平台支持** - 支持 Windows、WSL、macOS、Linux。Windows 用户可无缝访问本机和 WSL 环境配置
* ⚡ **快捷操作** - 右键菜单支持复制、删除、创建文件/文件夹、在新窗口中打开
* 🎨 **原生体验** - 完美集成 VS Code 原生界面风格

## 📸 界面预览

### 统一配置管理

扩展提供统一的侧边栏，管理所有 Claude 配置：

> **Global Configuration（全局配置）**
> 显示 `~/.claude.json` 文件和 `~/.claude/` 目录树结构

> **Projects（项目列表）**
> 展示所有已注册的 Claude Code 项目及其 Claude 配置文件

视图标题动态显示当前环境（如 "⚡ Windows"、"⚡ WSL (Ubuntu)"），并提供工具栏按钮用于快速切换环境。

### 右键菜单

在树视图中右键点击任意项目即可访问快捷操作：

| 菜单项 | 说明 |
|:---|:---|
| **复制名称** | 复制项目名称到剪贴板 |
| **复制路径** | 复制完整的文件/目录路径 |
| **删除** | 删除选中的文件或目录 |
| **在新窗口中打开** | 在新 VS Code 窗口中打开目录 |
| **创建文件** | 在选中目录中创建新文件 |
| **创建文件夹** | 在选中目录中创建新文件夹 |

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
