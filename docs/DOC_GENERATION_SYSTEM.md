# 文档生成系统技术文档

本文档详细记录了 OpenCode 文档生成系统的架构设计、性能优化策略和最佳实践。

## 📋 目录

1. [系统架构演进](#1-系统架构演进)
2. [Daemon模式设计](#2-daemon模式设计)
3. [性能优化策略](#3-性能优化策略)
4. [图表生成规范](#4-图表生成规范)
5. [多线程并发处理](#5-多线程并发处理)
6. [错误处理与调试](#6-错误处理与调试)

---

## 1. 系统架构演进

### 1.1 三个阶段的发展

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│  阶段1: CLI  │ →  │  阶段2: Daemon │ →  │  阶段3: 多线程+分章节   │
│  模式        │    │  模式          │    │  生成               │
└─────────────┘    └─────────────┘    └─────────────────────┘
     │                   │                     │
     ▼                   ▼                     ▼
• 每次执行加载库    • 常驻内存服务       • 分章节并行生成
• 响应慢(秒级)     • 毫秒级响应        • 统一合并为Word
• 资源重复加载     • 库只加载一次      • 支持复杂图表
```

### 1.2 架构对比

| 特性 | CLI模式 | Daemon模式 | 多线程模式 |
|------|---------|------------|------------|
| 启动时间 | 2-5秒 | <100ms | <100ms |
| 内存占用 | 低(临时) | 中等(常驻) | 中等(常驻) |
| 并发能力 | 无 | 有限 | 8线程 |
| 适用场景 | 单次生成 | 频繁生成 | 复杂文档 |

---

## 2. Daemon模式设计

### 2.1 核心优势

**问题**: CLI模式下每次执行都需要重新加载Python库（如python-docx、reportlab、matplotlib），导致响应时间过长。

**解决方案**: 将服务转换为常驻Daemon模式，库只加载一次，后续请求直接处理。

### 2.2 技术实现

```python
# main.py - Flask + Waitress架构
from flask import Flask
from waitress import serve
import threading

app = Flask(__name__)

# 线程安全的stdout管理
class ThreadLocalStdout:
    def __init__(self):
        self._local = threading.local()
    
    def write(self, data):
        if hasattr(self._local, 'buffer'):
            self._local.buffer.append(data)

# 8线程并发配置
serve(app, host='0.0.0.0', port=port, threads=8)
```

### 2.3 启动流程

```python
async function ensureDaemon() {
  // 1. 检查服务是否已启动
  if (await isHealthy()) return
  
  // 2. 启动Daemon进程
  const proc = Bun.spawn(["python3", "main.py", "--daemon"], {
    detached: true,
    unref: true  # 允许独立于父进程运行
  })
  
  // 3. 等待服务就绪(重试机制)
  for (let i = 0; i < 30; i++) {
    if (await isHealthy()) break
    await delay(100)
  }
}
```

---

## 3. 性能优化策略

### 3.1 优化措施汇总

| 优化点 | 实现方式 | 效果 |
|--------|----------|------|
| **常驻服务** | Python Daemon模式 | 启动时间从秒级降至毫秒级 |
| **多线程** | Waitress 8线程配置 | 支持并发文档生成 |
| **分章节生成** | 按章节拆分为独立Markdown | 提高内容质量和生成速度 |
| **图生成** | 强制使用Graphviz/Matplotlib | 避免ASCII艺术图 |
| **TLS优化** | 禁用本地证书验证 | 避免连接错误 |

### 3.2 分章节生成策略

**思路**: 技术文档通常包含多个章节，一次性生成过大文档容易超时或内存溢出。

**实现**:
1. 在临时目录创建章节子目录
2. 每个章节独立生成Markdown文件
3. 并行生成所有章节(多线程)
4. 统一合并为最终Word文档

```python
# 章节结构示例
temp_docs/
├── 01_概述/
│   ├── 01_项目背景.md
│   ├── 02_目标范围.md
│   └── 03_术语定义.md
├── 02_架构设计/
│   ├── 01_系统架构.md
│   ├── 02_技术选型.md
│   └── 03_部署方案.md
└── ...
```

---

## 4. 图表生成规范

### 4.1 严禁使用的图表类型

❌ **ASCII字符画** - 不专业，无法调整样式
❌ **简单文本表格** - 缺乏视觉吸引力
❌ **Mermaid(基础版)** - 在某些导出格式中渲染不佳

### 4.2 推荐的图表工具

| 图表类型 | 推荐工具 | 适用场景 |
|----------|----------|----------|
| **实体关系图** | Graphviz | 数据库设计、系统架构 |
| **流程图** | Graphviz | 业务流程、算法流程 |
| **时序图** | Matplotlib | 系统交互、API调用 |
| **甘特图** | Matplotlib | 项目进度、时间管理 |
| **逻辑图** | Matplotlib | 概念关系、思维导图 |

### 4.3 Graphviz示例

```python
import graphviz

dot = graphviz.Digraph(comment='LIMS系统ER图')
dot.attr(rankdir='TB', size='10,8', dpi='150')
dot.attr('node', shape='box', style='rounded,filled', 
         fillcolor='#e8f4f8', fontname='SimHei')

# 添加实体
dot.node('task', '任务\n---\n任务ID\n任务名称\n创建时间')
dot.node('point', '监测点位\n---\n点位ID\n点位名称\n坐标')
dot.node('sample', '样品\n---\n样品ID\n样品类型\n采集时间')

# 添加关系
dot.edge('task', 'point', label='包含', color='#4ec9b0')
dot.edge('point', 'sample', label='采集', color='#4ec9b0')

dot.render('lims_er', format='png', cleanup=True)
```

### 4.4 中文字体支持

```python
import matplotlib.pyplot as plt
from matplotlib import font_manager

# 注册中文字体
font_paths = [
    '/System/Library/Fonts/PingFang.ttc',  # macOS
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',  # Linux
]

for font_path in font_paths:
    if os.path.exists(font_path):
        font_manager.fontManager.addfont(font_path)

plt.rcParams['font.family'] = ['PingFang SC', 'SimHei', 'sans-serif']
plt.rcParams['axes.unicode_minus'] = False
```

---

## 5. 多线程并发处理

### 5.1 线程安全考虑

```python
# 线程本地存储
_thread_locals = threading.local()

def get_thread_buffer():
    if not hasattr(_thread_locals, 'buffer'):
        _thread_locals.buffer = []
    return _thread_locals.buffer

# 线程锁(用于共享资源)
_file_lock = threading.Lock()

def write_to_file(filename, content):
    with _file_lock:
        with open(filename, 'w') as f:
            f.write(content)
```

### 5.2 Waitress配置

```python
from waitress import serve

# 生产环境配置
serve(
    app,
    host='0.0.0.0',
    port=8765,
    threads=8,              # 8个线程处理并发
    connection_limit=100,    # 最大连接数
    channel_timeout=300,     # 通道超时(秒)
    cleanup_interval=10      # 清理间隔(秒)
)
```

---

## 6. 错误处理与调试

### 6.1 常见错误及解决方案

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `Connection refused` | Daemon未启动 | 检查服务状态，自动重启 |
| `TLS certificate verify failed` | 本地证书问题 | 禁用证书验证 |
| `Font not found` | 中文字体缺失 | 安装系统字体或指定备用字体 |
| `Memory error` | 文档过大 | 分章节生成，流式写入 |
| `Timeout` | 生成时间过长 | 增加超时时间或优化生成逻辑 |

### 6.2 TLS证书处理

```typescript
// 本地开发环境禁用证书验证
const response = await fetch('https://localhost:8765/health', {
  tls: { rejectUnauthorized: false }
})
```

### 6.3 调试技巧

```python
# 添加详细日志
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('doc_gen.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
logger.debug(f"生成图表: {chart_type}")
```

---

## 7. 最佳实践

### 7.1 文档生成流程

1. **需求分析** - 明确文档类型、章节结构、图表需求
2. **模板准备** - 准备Markdown模板和样式配置
3. **分章节生成** - 并行生成各章节内容
4. **图表生成** - 使用专业工具生成高质量图表
5. **合并导出** - 统一合并为Word/PDF格式
6. **质量检查** - 验证内容完整性、格式正确性

### 7.2 性能监控

```python
import time

def monitor_performance(func):
    def wrapper(*args, **kwargs):
        start = time.time()
        result = func(*args, **kwargs)
        elapsed = time.time() - start
        logger.info(f"{func.__name__} 耗时: {elapsed:.2f}s")
        return result
    return wrapper

@monitor_performance
def generate_document(chapters):
    # 文档生成逻辑
    pass
```

### 7.3 代码规范

- ✅ 使用类型注解提高代码可读性
- ✅ 添加详细的函数文档字符串
- ✅ 异常处理要具体，不要裸except
- ✅ 资源使用完毕后及时释放
- ✅ 日志记录要包含上下文信息

---

## 8. 快速参考

### 8.1 启动命令

```bash
# 启动Daemon服务
python3 main.py --daemon --port 8765

# 生成文档
curl -X POST http://localhost:8765/generate \
  -H "Content-Type: application/json" \
  -d '{"type": "word", "content": "..."}'
```

### 8.2 关键文件

| 文件 | 用途 |
|------|------|
| `main.py` | Daemon服务主入口 |
| `doc_generator.py` | 文档生成核心逻辑 |
| `chart_generator.py` | 图表生成工具 |
| `templates/` | Markdown模板目录 |

---

*最后更新: 2026-02-06*
*维护者: FastCode Team*
