# OpenCode 桌面应用开发与部署指南

本文档详细介绍 OpenCode 桌面应用的开发环境配置、测试、生产部署和打包发布流程。

## 📚 目录

1. [架构概述](#1-架构概述)
2. [开发环境配置](#2-开发环境配置)
3. [开发模式启动](#3-开发模式启动)
4. [测试环境](#4-测试环境)
5. [生产环境部署](#5-生产环境部署)
6. [打包与发布](#6-打包与发布)
7. [故障排查](#7-故障排查)

---

## 1. 架构概述

### 1.1 技术栈

OpenCode 桌面应用基于 **Tauri** 框架构建：

```
┌─────────────────────────────────────────┐
│           前端 (Frontend)                │
│  ┌─────────────────────────────────┐   │
│  │  SolidJS + TypeScript           │   │
│  │  Tailwind CSS                   │   │
│  │  Vite (构建工具)                 │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                   │
                   │ Tauri Bridge
                   ▼
┌─────────────────────────────────────────┐
│           后端 (Backend)                 │
│  ┌─────────────────────────────────┐   │
│  │  Rust (Tauri Core)              │   │
│  │  - 系统API调用                   │   │
│  │  - 文件系统访问                  │   │
│  │  - 原生窗口管理                  │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│        Sidecar (OpenCode CLI)           │
│  ┌─────────────────────────────────┐   │
│  │  Bun + TypeScript               │   │
│  │  - AI 模型调用                   │   │
│  │  - 文件处理                      │   │
│  │  - 终端集成                      │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 1.2 项目结构

```
packages/desktop/
├── src/                    # 前端源代码
│   ├── components/         # React/Solid 组件
│   ├── pages/             # 页面组件
│   ├── context/           # 状态管理
│   └── ...
├── src-tauri/             # Tauri (Rust) 代码
│   ├── src/               # Rust 源代码
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
├── scripts/               # 构建脚本
│   ├── predev.ts          # 开发前准备
│   ├── build.ts           # 构建脚本
│   └── utils.ts           # 工具函数
└── package.json           # npm 配置
```

---

## 2. 开发环境配置

### 2.1 系统要求

| 组件 | 版本要求 | 说明 |
|------|----------|------|
| macOS | 11.0+ | Big Sur 或更高版本 |
| Node.js | 18.x+ | 推荐使用 20.x |
| Bun | 1.1.0+ | 核心运行时 |
| Rust | 1.70+ | Tauri 编译需要 |
| Xcode | 14.0+ | macOS 开发工具 |

### 2.2 安装依赖

```bash
# 1. 进入桌面应用目录
cd /Users/xinjiayu/sagoo/sagoo-code/fastcode/packages/desktop

# 2. 安装 Node 依赖
bun install

# 3. 安装 Rust 依赖 (Tauri)
cd src-tauri
cargo fetch
cd ..

# 4. 验证安装
bun --version
cargo --version
rustc --version
```

### 2.3 环境变量配置

#### 必需的环境变量

```bash
# 设置 Rust 目标平台 (根据你的系统选择)

# macOS Apple Silicon (M1/M2/M3)
export RUST_TARGET=aarch64-apple-darwin

# macOS Intel
export RUST_TARGET=x86_64-apple-darwin

# Windows
export RUST_TARGET=x86_64-pc-windows-msvc

# Linux x64
export RUST_TARGET=x86_64-unknown-linux-gnu

# Linux ARM64
export RUST_TARGET=aarch64-unknown-linux-gnu
```

#### 添加到 shell 配置文件

```bash
# 编辑 ~/.zshrc 或 ~/.bashrc
echo 'export RUST_TARGET=aarch64-apple-darwin' >> ~/.zshrc
source ~/.zshrc
```

### 2.4 平台特定配置

#### macOS

```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 同意 Xcode 许可协议
sudo xcodebuild -license accept

# 安装 Rosetta 2 (Apple Silicon 需要)
softwareupdate --install-rosetta --agree-to-license
```

#### Windows

```powershell
# 安装 Visual Studio Build Tools
# 下载地址: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# 必需组件: "Desktop development with C++"

# 安装 WebView2 Runtime
# 通常已包含在 Windows 11 中
```

#### Linux

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.0-devel \
    openssl-devel \
    curl \
    wget \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

---

## 3. 开发模式启动

### 3.1 标准启动流程

```bash
# 1. 进入桌面应用目录
cd /Users/xinjiayu/sagoo/sagoo-code/fastcode/packages/desktop

# 2. 设置环境变量
export RUST_TARGET=aarch64-apple-darwin

# 3. 启动开发服务器
bun dev tauri
```

### 3.2 启动过程说明

```
启动流程:
1. predev.ts          - 准备开发环境
2. build.ts --single  - 构建 OpenCode CLI (sidecar)
3. vite tauri         - 启动 Vite + Tauri 开发服务器
   ├── Vite dev server (http://localhost:5173/)
   └── Tauri native window
```

### 3.3 开发服务器地址

| 服务 | 地址 | 说明 |
|------|------|------|
| Vite Dev Server | http://localhost:5173/ | 前端开发服务器 |
| HMR WebSocket | ws://localhost:5173/ | 热更新 |
| Tauri API | ipc://localhost | 原生 API |

### 3.4 常用开发命令

```bash
# 仅启动前端 (不启动 Tauri 窗口)
bun dev

# 启动桌面应用 (完整模式)
bun dev tauri

# 带调试信息启动
DEBUG=1 bun dev tauri

# 指定特定目标平台
RUST_TARGET=x86_64-apple-darwin bun dev tauri
```

---

## 4. 测试环境

### 4.1 单元测试

```bash
# 前端单元测试
cd packages/desktop
bun test

# 带覆盖率报告
bun test --coverage
```

### 4.2 E2E 测试

```bash
# 使用 Playwright 进行端到端测试
cd packages/desktop
bun run test:e2e

#  headed 模式 (显示浏览器窗口)
bun run test:e2e --headed
```

### 4.3 手动测试清单

#### 基础功能测试

- [ ] 应用正常启动
- [ ] 窗口显示正常
- [ ] 可以打开项目
- [ ] 文件树显示正确
- [ ] 编辑器可以编辑文件
- [ ] AI 聊天功能正常
- [ ] 设置页面可访问

#### 平台特定测试

**macOS**:
- [ ] 菜单栏显示正确
- [ ] 快捷键工作正常 (Cmd+C, Cmd+V 等)
- [ ] 窗口可以最小化/最大化
- [ ] Dock 图标正常

**Windows**:
- [ ] 系统托盘图标正常
- [ ] 窗口边框正确
- [ ] 高 DPI 显示正常

**Linux**:
- [ ] 系统托盘/指示器正常
- [ ] 窗口管理器集成正常

---

## 5. 生产环境部署

### 5.1 生产构建

```bash
# 1. 进入桌面应用目录
cd /Users/xinjiayu/sagoo/sagoo-code/fastcode/packages/desktop

# 2. 设置生产环境变量
export RUST_TARGET=aarch64-apple-darwin
export NODE_ENV=production

# 3. 执行生产构建
bun run build

# 4. 构建产物位于:
# src-tauri/target/release/bundle/
```

### 5.2 构建产物

| 平台 | 产物类型 | 路径 |
|------|----------|------|
| macOS | .app | src-tauri/target/release/bundle/macos/*.app |
| macOS | .dmg | src-tauri/target/release/bundle/dmg/*.dmg |
| Windows | .exe | src-tauri/target/release/bundle/nsis/*.exe |
| Windows | .msi | src-tauri/target/release/bundle/msi/*.msi |
| Linux | .AppImage | src-tauri/target/release/bundle/appimage/*.AppImage |
| Linux | .deb | src-tauri/target/release/bundle/deb/*.deb |

### 5.3 环境变量配置 (生产)

```bash
# 生产环境配置文件
# packages/desktop/.env.production

# API 配置
VITE_API_URL=https://api.opencode.ai
VITE_WS_URL=wss://api.opencode.ai

# 功能开关
VITE_ENABLE_TELEMETRY=true
VITE_ENABLE_UPDATER=true

# 日志级别
VITE_LOG_LEVEL=error
```

---

## 6. 打包与发布

### 6.1 自动打包脚本

```bash
#!/bin/bash
# scripts/build-release.sh

set -e

VERSION=$(cat package.json | grep version | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
echo "Building OpenCode Desktop v$VERSION"

# 清理旧构建
rm -rf src-tauri/target/release/bundle

# 设置环境
export RUST_TARGET=aarch64-apple-darwin
export NODE_ENV=production

# 构建
bun run build

# 签名 (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    codesign --deep --force --verify --verbose --sign "Developer ID" \
        "src-tauri/target/release/bundle/macos/OpenCode.app"
fi

echo "Build complete!"
echo "Artifacts:"
ls -la src-tauri/target/release/bundle/*/
```

### 6.2 代码签名 (macOS)

```bash
# 1. 安装证书到钥匙串
security import certificate.p12 -k ~/Library/Keychains/login.keychain-db

# 2. 签名应用
codesign --deep --force --verify --verbose --sign "Developer ID Application: Your Name" \
    src-tauri/target/release/bundle/macos/OpenCode.app

# 3. 公证 (Notarization)
xcrun altool --notarize-app \
    --primary-bundle-id "ai.opencode.desktop" \
    --username "your@email.com" \
    --password "@keychain:AC_PASSWORD" \
    --file src-tauri/target/release/bundle/dmg/OpenCode_${VERSION}_x64.dmg
```

### 6.3 代码签名 (Windows)

```powershell
# 使用 signtool (Windows SDK)
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 OpenCode.exe
```

### 6.4 自动更新配置

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.opencode.ai/{{target}}/{{arch}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

### 6.5 发布到 GitHub Releases

```bash
#!/bin/bash
# scripts/release.sh

VERSION=$1

# 创建 Release
gh release create v$VERSION \
    --title "OpenCode Desktop v$VERSION" \
    --notes-file CHANGELOG.md

# 上传构建产物
gh release upload v$VERSION \
    src-tauri/target/release/bundle/dmg/*.dmg \
    src-tauri/target/release/bundle/macos/*.app.tar.gz

echo "Released v$VERSION"
```

---

## 7. 故障排查

### 7.1 常见问题

#### 问题 1: RUST_TARGET not set

**错误信息**:
```
error: RUST_TARGET not set
```

**解决方案**:
```bash
export RUST_TARGET=aarch64-apple-darwin
bun dev tauri
```

#### 问题 2: Sidecar 未找到

**错误信息**:
```
Error: Sidecar binary not found
```

**解决方案**:
```bash
# 重新构建 sidecar
cd packages/opencode
bun run build

# 复制到正确位置
cp dist/opencode-darwin-arm64/bin/opencode ../desktop/src-tauri/sidecars/
```

#### 问题 3: 端口被占用

**错误信息**:
```
Error: Port 5173 is already in use
```

**解决方案**:
```bash
# 查找并关闭占用端口的进程
lsof -ti:5173 | xargs kill -9

# 或使用其他端口
bun dev --port 3000
```

#### 问题 4: Rust 编译错误

**错误信息**:
```
error: linking with `cc` failed
```

**解决方案**:
```bash
# macOS: 安装/更新 Xcode 命令行工具
xcode-select --install

# 清理并重新构建
cd src-tauri
cargo clean
cargo build --release
```

### 7.2 调试技巧

#### 启用详细日志

```bash
# Rust 端日志
RUST_LOG=debug bun dev tauri

# WebView 日志
DEBUG=1 bun dev tauri
```

#### 检查 Sidecar 运行状态

```bash
# 查看 sidecar 进程
ps aux | grep opencode-cli

# 检查 sidecar 日志
tail -f ~/Library/Logs/OpenCode/sidecar.log
```

#### WebView 开发者工具

```bash
# 在应用中打开 DevTools
# macOS: Cmd + Option + I
# Windows/Linux: Ctrl + Shift + I
```

### 7.3 性能优化

#### 构建优化

```bash
# 使用 release 模式 (已优化)
bun run build

# 启用 LTO (Link Time Optimization)
# 在 src-tauri/Cargo.toml 中添加:
[profile.release]
lto = true
opt-level = 3
```

#### 包大小优化

```bash
# 分析包大小
cd src-tauri
cargo bloat --release

# UPX 压缩 (可选)
upx --best src-tauri/target/release/opencode
```

---

## 8. 最佳实践

### 8.1 开发流程

1. **功能开发** - 在 `src/` 中修改前端代码
2. **本地测试** - 使用 `bun dev tauri` 启动测试
3. **构建验证** - 运行 `bun run build` 确保生产构建成功
4. **代码提交** - 提交到版本控制
5. **CI/CD** - 自动化构建和测试

### 8.2 安全建议

- ✅ 使用环境变量存储敏感信息
- ✅ 启用代码签名
- ✅ 定期更新依赖
- ✅ 使用 Content Security Policy
- ❌ 不要将密钥硬编码到代码中
- ❌ 不要禁用 WebView 安全特性

### 8.3 性能监控

```javascript
// 在应用中集成性能监控
import { invoke } from '@tauri-apps/api/core'

// 记录性能指标
const measurePerformance = async () => {
  const start = performance.now()
  await invoke('some_native_function')
  const duration = performance.now() - start
  
  console.log(`Native call took ${duration}ms`)
}
```

---

**文档维护**: FastCode Team  
**最后更新**: 2026-02-06  
**版本**: v1.0
