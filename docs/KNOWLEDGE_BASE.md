# FastCode 项目知识库

本文档汇总了 FastCode 项目开发过程中的关键技术经验、架构设计和最佳实践。

## 📚 目录

1. [主题系统开发](#1-主题系统开发)
2. [文档生成系统](#2-文档生成系统)
3. [本地AI集成](#3-本地ai集成)
4. [UI定制与布局](#4-ui定制与布局)
5. [开发环境配置](#5-开发环境配置)
6. [项目架构理解](#6-项目架构理解)

---

## 1. 主题系统开发

### 1.1 双主题系统架构

OpenCode 采用**双主题系统**设计：

| 系统 | 用途 | 位置 | 文件格式 |
|------|------|------|----------|
| **TUI主题** | 终端用户界面 | `packages/opencode/src/cli/cmd/tui/context/theme/` | JSON (dark/light变体) |
| **UI主题** | 图形用户界面(设置页) | `packages/ui/src/theme/themes/` | JSON (DesktopTheme格式) |

### 1.2 TUI主题格式规范

TUI主题必须包含完整的主题属性：

```json
{
  "$schema": "https://opencode.ai/theme.json",
  "defs": {
    // 定义颜色变量
    "primary-color": "#4ec9b0"
  },
  "theme": {
    // 必需属性 (dark/light变体)
    "primary": { "dark": "primary-color", "light": "primary-color" },
    "secondary": { "dark": "...", "light": "..." },
    "accent": { "dark": "...", "light": "..." },
    "error": { "dark": "...", "light": "..." },
    "warning": { "dark": "...", "light": "..." },
    "success": { "dark": "...", "light": "..." },
    "info": { "dark": "...", "light": "..." },
    "text": { "dark": "...", "light": "..." },
    "textMuted": { "dark": "...", "light": "..." },
    "selectedListItemText": { "dark": "...", "light": "..." },
    "background": { "dark": "...", "light": "..." },
    "backgroundPanel": { "dark": "...", "light": "..." },
    "backgroundElement": { "dark": "...", "light": "..." },
    "backgroundMenu": { "dark": "...", "light": "..." },
    "border": { "dark": "...", "light": "..." },
    "borderActive": { "dark": "...", "light": "..." },
    "borderSubtle": { "dark": "...", "light": "..." },
    // ... 更多必需属性
  }
}
```

### 1.3 主题注册流程

1. **创建主题文件**: 在对应目录创建JSON文件
2. **导入主题**: 在 `theme.tsx` 或 `default-themes.ts` 中导入
3. **注册到DEFAULT_THEMES**: 添加到主题映射对象
4. **验证构建**: 运行 `npm run typecheck` 确保无类型错误

### 1.4 常见错误与解决

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `Could not resolve` | 导入路径错误 | 使用相对路径 `./theme/xxx.json` |
| `Type '...' is not assignable to type 'ThemeJson'` | 缺少必需属性 | 补全所有必需的主题属性 |
| 主题不显示在设置中 | 未在UI包注册 | 同时在TUI和UI包中注册 |

---

## 2. 文档生成系统

### 2.1 架构演进

文档生成系统经历了三个阶段的优化：

```
阶段1: CLI模式 → 阶段2: Daemon模式 → 阶段3: 多线程+分章节生成
```

### 2.2 Daemon模式设计

**核心优势**: 避免重复加载Python库，提升响应速度

```python
# 关键实现点
class ThreadLocalStdout:
    """线程安全的stdout管理"""
    def __init__(self):
        self._local = threading.local()
    
    def write(self, data):
        if hasattr(self._local, 'buffer'):
            self._local.buffer.append(data)

# Flask + Waitress配置
serve(app, host='0.0.0.0', port=port, threads=8)  # 8线程并发
```

### 2.3 性能优化策略

| 优化点 | 实现方式 | 效果 |
|--------|----------|------|
| 常驻服务 | Python Daemon模式 | 从秒级降至毫秒级 |
| 多线程 | Waitress 8线程配置 | 支持并发文档生成 |
| 分章节生成 | 按章节拆分为独立Markdown | 提高内容质量和生成速度 |
| 图生成 | 强制使用Graphviz/Matplotlib | 避免ASCII艺术图 |

### 2.4 文档生成规范

**严禁使用**: ASCII字符画、简单文本图表

**强制使用**: 
- Graphviz (实体关系图、流程图)
- Matplotlib (时序图、甘特图)
- Mermaid (逻辑图)

---

## 3. 本地AI集成

### 3.1 集成架构

```
用户请求 → OpenCode → 本地AI引擎(Qwen/Ollama) → 返回结果
                ↓
          自动检测本地服务
```

### 3.2 关键配置

**TLS证书验证处理**:
```typescript
// 本地开发环境禁用证书验证
fetch(url, {
  tls: { rejectUnauthorized: false }
})
```

**服务发现机制**:
- 自动检测端口 (默认 11434 for Ollama)
- 健康检查端点 `/api/health`
- 模型列表自动获取

### 3.3 Provider实现模式

```typescript
interface LocalProvider {
  name: string
  baseUrl: string
  models: () => Promise<Model[]>
  chat: (messages: Message[]) => AsyncIterable<string>
}
```

---

## 4. UI定制与布局

### 4.1 三分式布局设计

**改造目标**: 移除传统IDE的Activity Bar，整合到侧边栏

```
改造前: [Activity Bar] [Sidebar] [Editor] [Panel]
改造后: [Sidebar (集成)] [Editor] [File Tree]
```

### 4.2 核心组件结构

```
SidebarPanel
├── 顶部: ProjectSwitcher (下拉菜单)
├── 中部: SessionList + Workspace
└── 底部: Toolbar (设置/帮助)
```

### 4.3 代码隔离最佳实践

**推荐做法**:
- ✅ 提取组件到独立文件 `components/custom/SidebarPanel.tsx`
- ✅ 使用Wrapper组件包裹原生组件
- ✅ 新增样式文件 `styles/custom.css`
- ❌ 直接修改核心组件源码
- ❌ 在原有文件中添加大量代码

### 4.4 冲突最小化策略

| 修改类型 | 推荐方式 | 冲突风险 |
|----------|----------|----------|
| UI组件 | 新增独立文件 + 引用 | 低 |
| 样式 | 新建CSS文件 + 入口引入 | 低 |
| 布局 | Wrapper组件模式 | 中 |
| 核心逻辑 | Hook封装 | 中 |
| 配置文件 | 谨慎合并 | 高 |

---

## 5. 开发环境配置

### 5.1 网络连接问题

**问题**: `localhost` 优先解析为IPv6 `::1`，而后端监听IPv4 `127.0.0.1`

**解决方案**:
```typescript
// vite.config.ts
server: {
  proxy: {
    "/global": { target: "http://127.0.0.1:4096", changeOrigin: true },
    "/project": { target: "http://127.0.0.1:4096", changeOrigin: true },
    // ... 其他路径
  }
}

// app.tsx
if (import.meta.env.DEV)
  return window.location.origin  // 走Vite代理
```

### 5.2 开发脚本

```bash
# 启动后端服务
bun dev -- serve

# 启动前端开发服务器
bun dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

---

## 6. 项目架构理解

### 6.1 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | SolidJS + Tailwind | 响应式UI |
| 后端 | Bun + TypeScript | API服务 |
| 桌面 | Tauri (Rust) | 跨平台桌面应用 |
| 终端 | OpenTUI | 终端用户界面 |

### 6.2 包结构

```
packages/
├── opencode/      # 核心CLI和TUI
├── app/           # Web应用前端
├── ui/            # UI组件库
├── desktop/       # Tauri桌面应用
└── sdk/           # JavaScript SDK
```

### 6.3 数据流

```
User Input → TUI/App → SDK → Backend → AI Provider
                ↓
           State Management (SolidJS Store)
```

---

## 7. 最佳实践总结

### 7.1 代码风格

- 使用单字母变量名（如果清晰）
- 优先使用 `const` 和函数式编程
- 避免不必要的解构
- 使用Bun API (如 `Bun.file()`)

### 7.2 错误处理

- 避免过度使用 try/catch
- 使用早期返回替代嵌套if
- 类型安全优先于any

### 7.3 性能优化

- 使用daemon模式避免重复初始化
- 多线程处理并发任务
- 延迟加载非关键资源

### 7.4 文档规范

- 所有技术决策必须记录到 `/docs`
- 代码注释使用中文
- 保持文档与代码同步更新

---

## 8. 快速参考

### 8.1 常用命令

```bash
# 开发
bun dev                    # 启动开发服务器
bun dev -- serve          # 仅启动后端

# 构建
npm run build             # 构建所有包
npm run typecheck         # 类型检查

# 主题开发
# 修改后需重启开发服务器才能生效
```

### 8.2 关键文件位置

| 用途 | 文件路径 |
|------|----------|
| TUI主题 | `packages/opencode/src/cli/cmd/tui/context/theme/*.json` |
| UI主题 | `packages/ui/src/theme/themes/*.json` |
| 布局组件 | `packages/app/src/pages/layout.tsx` |
| 设置页面 | `packages/app/src/components/settings-general.tsx` |
| Vite配置 | `packages/app/vite.config.ts` |

---

*最后更新: 2026-02-06*
*维护者: FastCode Team*
