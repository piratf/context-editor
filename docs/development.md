# Development

## Tech Stack

- **TypeScript** - Strict mode with full type safety
- **VS Code Extension API** - Native extension development
- **ESLint + Prettier** - Code quality assurance
- **Mocha** - Unit and integration testing
- **Husky + lint-staged** - Git Hooks automation

## Development Setup

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

## Git Hooks

- **pre-commit**: Automatically runs ESLint and Prettier
- **pre-push**: Automatically runs tests (can be skipped with `SKIP_TESTS=1 git push`)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

---

# 开发

## 技术栈

- **TypeScript** - 严格模式，完整类型安全
- **VS Code Extension API** - 原生扩展开发
- **ESLint + Prettier** - 代码质量保障
- **Mocha** - 单元测试和集成测试
- **Husky + lint-staged** - Git Hooks 自动化

## 开发环境设置

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

## Git Hooks

- **pre-commit**：自动运行 ESLint 和 Prettier
- **pre-push**：自动运行测试（可通过 `SKIP_TESTS=1 git push` 跳过）

## 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'feat: add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 创建 Pull Request
