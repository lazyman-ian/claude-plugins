---
name: token-analyzer
description: Analyzes token usage patterns and suggests optimization strategies for Claude Code sessions. This skill should be used when the session feels slow, response quality degrades, or the user wants to understand token consumption distribution and reduce context bloat. Key capabilities include context percentage analysis, tool usage profiling, and actionable optimization recommendations. Triggers on "analyze tokens", "token usage", "optimize context", "context too large", "session slow", "token budget", "分析 token", "token 优化", "上下文优化", "会话变慢", "token 消耗".
model: haiku
memory: user
allowed-tools: [Bash, Read, Grep]
---

# Token Analyzer

分析 token 使用模式，提供优化建议。

## When to Use

- 会话变慢或响应质量下降
- 想了解 token 消耗分布
- 优化 prompt 或工具使用

## Analysis Process

### 1. 获取当前状态

检查 StatusLine 或 session 信息:
- 当前 context 使用百分比
- 总 token 数

### 2. 分析模式

| 模式 | 症状 | 优化建议 |
|------|------|---------|
| 工具滥用 | Bash 调用 >10 次 | 改用 Glob/Read/Grep |
| 循环搜索 | 同一工具 >8 次/10 调用 | 使用 Task(Explore) |
| 大文件读取 | 单次 Read >500 行 | 使用 limit 参数 |
| 冗余输出 | git log/diff 完整输出 | 使用 --stat/--oneline |

### 3. 优化建议表

| 场景 | 当前 | 优化后 | 节省 |
|------|------|--------|------|
| ls 目录 | Bash(ls) | Glob | ~50 tokens |
| 读取文件 | Bash(cat) | Read | ~30 tokens |
| 搜索内容 | Bash(grep) | Grep | ~40 tokens |
| Git 日志 | git log | git log --oneline -5 | ~200 tokens |

### 4. 输出格式

```markdown
## Token 分析报告

| 指标 | 值 |
|------|-----|
| 当前使用 | XX% |
| 预估剩余 | XX 轮对话 |
| 主要消耗 | [工具/文件读取/输出] |

### 优化建议

1. [具体建议 1]
2. [具体建议 2]

### 建议操作

- [ ] 完成当前任务后 `/clear`
- [ ] 使用 ledger 记录进度
```

## Token Budget 参考

| 区域 | 预算 | 说明 |
|------|------|------|
| 安全区 | <30K | 自由使用 |
| 警告区 | 30-60K | 性能开始下降 |
| 危险区 | >60K | 立即行动 |

## 快速命令

```bash
# 查看 StatusLine（如已配置）
# 格式: {tokens}K {pct}%
```
