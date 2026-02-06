# 本地AI插件配置指南

本文档说明如何使用重构后的本地AI插件系统。

## 🎯 架构变化

### 重构前 (硬编码)
```typescript
// provider.ts 中硬编码
baseURL: "http://127.0.0.1:8088/v1"
```

**问题**: 
- 直接修改核心文件
- 同步上游时冲突风险高
- 配置不灵活

### 重构后 (插件化)
```typescript
// 通过插件动态加载
// 配置通过环境变量
QWEN_LOCAL_URL=http://127.0.0.1:8088/v1
```

**优势**:
- ✅ 不修改核心文件
- ✅ 同步上游无冲突
- ✅ 配置灵活
- ✅ 可扩展更多本地模型

---

## ⚙️ 配置方式

### 方式1: 环境变量 (推荐)

```bash
# 启用本地AI
export ENABLE_LOCAL_AI=true

# 配置本地Qwen服务地址
export QWEN_LOCAL_URL=http://127.0.0.1:8088/v1

# 优先使用本地AI (零成本)
export PRIORITIZE_LOCAL_AI=true
```

### 方式2: 配置文件

在 `~/.opencode/config.json` 中添加:

```json
{
  "provider": {
    "qwen-local": {
      "options": {
        "baseURL": "http://127.0.0.1:8088/v1"
      }
    }
  }
}
```

### 方式3: 启动时指定

```bash
# 启动OpenCode时指定
ENABLE_LOCAL_AI=true PRIORITIZE_LOCAL_AI=true opencode
```

---

## 🔧 支持的本地模型

### Qwen (通义千问)

**默认配置**:
- 模型ID: `qwen2.5-0.5b-instruct`
- 服务地址: `http://127.0.0.1:8088/v1`
- 上下文长度: 4096
- 成本: 免费 (本地运行)

**启动本地服务**:
```bash
# 使用Ollama
ollama run qwen2.5:0.5b

# 或使用自定义服务
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --port 8088
```

---

## 🚀 使用场景

### 场景1: 完全离线开发

```bash
# 设置环境变量
export ENABLE_LOCAL_AI=true
export PRIORITIZE_LOCAL_AI=true

# 启动OpenCode
opencode

# 所有AI请求将使用本地模型
```

### 场景2: 混合模式

```bash
# 启用本地AI，但不优先使用
export ENABLE_LOCAL_AI=true
# 不设置 PRIORITIZE_LOCAL_AI

# 启动OpenCode
opencode

# 本地AI作为备选，优先使用云端模型
```

### 场景3: 特定项目使用本地AI

```bash
# 在项目目录创建 .env 文件
cat > .env << EOF
ENABLE_LOCAL_AI=true
PRIORITIZE_LOCAL_AI=true
EOF

# 在该项目目录启动OpenCode
cd /path/to/project
opencode
```

---

## 📝 扩展更多本地模型

要添加新的本地模型支持，编辑:

`packages/opencode/src/plugin/local-ai.ts`

```typescript
// 添加新的模型配置
const OLLAMA_CONFIG: LocalProviderConfig = {
  id: "ollama-local",
  name: "Ollama (Local)",
  baseURL: Env.get("OLLAMA_URL") || "http://127.0.0.1:11434/v1",
  models: {
    "llama3.2": {
      id: "llama3.2",
      name: "Llama 3.2",
      // ... 其他配置
    },
  },
}

// 在 getLocalProviderDefinitions 中添加
export function getLocalProviderDefinitions(): Record<string, any> {
  const definitions: Record<string, any> = {}
  
  if (Env.get("ENABLE_LOCAL_AI") === "true") {
    definitions["qwen-local"] = createLocalProvider(QWEN_LOCAL_CONFIG)
    definitions["ollama-local"] = createLocalProvider(OLLAMA_CONFIG) // 新增
  }
  
  return definitions
}
```

---

## 🐛 故障排查

### 问题1: 本地AI未生效

**检查**:
```bash
# 1. 检查环境变量
echo $ENABLE_LOCAL_AI
echo $QWEN_LOCAL_URL

# 2. 检查服务是否运行
curl http://127.0.0.1:8088/v1/models

# 3. 查看日志
opencode --log-level debug
```

### 问题2: 模型选择未优先使用本地AI

**检查**:
```bash
# 确认设置了优先级
export PRIORITIZE_LOCAL_AI=true

# 检查配置是否生效
opencode config get
```

### 问题3: 连接被拒绝

**解决**:
```bash
# 检查服务端口
lsof -i :8088

# 或检查防火墙
sudo ufw status

# 使用正确的地址
export QWEN_LOCAL_URL=http://localhost:8088/v1
```

---

## 🔒 安全注意事项

1. **本地服务**: 确保本地AI服务仅监听localhost，不要暴露到公网
2. **TLS验证**: 本地开发环境已禁用TLS验证，生产环境请启用
3. **API密钥**: 本地模型通常不需要API密钥，但请勿在配置中硬编码敏感信息

---

## 📊 性能对比

| 模型 | 延迟 | 成本 | 质量 | 适用场景 |
|------|------|------|------|----------|
| qwen2.5-0.5b (本地) | 低 | 免费 | 中等 | 代码补全、简单问答 |
| GPT-4 (云端) | 高 | 收费 | 高 | 复杂推理、代码生成 |
| Claude (云端) | 高 | 收费 | 高 | 长文本处理、分析 |

**建议**:
- 开发阶段: 使用本地AI降低成本
- 生产环境: 根据任务复杂度选择模型

---

## 🔄 与上游同步

重构后的本地AI插件系统与上游同步时:

- ✅ **无冲突**: provider.ts 不再包含硬编码
- ✅ **可扩展**: 通过插件机制添加新模型
- ✅ **可配置**: 所有配置通过环境变量

**同步命令**:
```bash
git fetch upstream
git rebase upstream/main
# 预期无冲突
```

---

**最后更新**: 2026-02-06  
**维护者**: FastCode Team
