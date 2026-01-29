---
description: Quick session summary for handoff or conversation switch
---

# Session Summary

快速总结当前会话，用于交接或切换对话。

## Instructions

生成简洁的会话总结，包含:

### 1. 完成的工作

列出本次会话完成的主要任务（1-3 项）

### 2. 当前状态

- 正在进行的任务
- 遇到的阻塞（如有）

### 3. 下一步

- 待完成的任务
- 建议的下一步操作

### 4. 关键发现

- 本次会话发现但未处理的问题
- 需要记录到 ledger 或 CLAUDE.md 的内容

## Output Format

```markdown
## 会话总结 - [日期]

### 完成
- [x] 任务 1
- [x] 任务 2

### 当前状态
[描述当前进度]

### 下一步
- [ ] 待办 1
- [ ] 待办 2

### 发现
- [发现 1]（建议记录到 [位置]）
```

## Usage

```bash
/summary           # 生成总结
/summary --ledger  # 同时更新 ledger
```
