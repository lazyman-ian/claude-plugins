---
name: deslop
description: Remove AI-generated code slop (redundant comments, over-engineering, excessive error handling) from current branch. Use when user says "clean up code", "remove slop", "清理代码", "去除冗余".
model: haiku
allowed-tools: [Bash, Read, Glob, Grep, Edit]
---

# Deslop

移除当前分支中 AI 生成的冗余代码（slop）。

## 触发

- `/deslop` - 检查并清理当前分支
- `/deslop --dry-run` - 只报告不修改

## 流程

### Step 1: 获取 Diff

```bash
# 对比 main/develop 分支
git diff --name-only $(git merge-base HEAD develop)..HEAD
```

### Step 2: 检查每个文件

对每个修改的文件，识别并移除：

| Slop 类型 | 示例 | 动作 |
|----------|------|------|
| **冗余注释** | `// Get the user` 后跟 `getUser()` | 删除 |
| **过度防御** | 内部函数的 try/catch（上游已处理） | 删除 |
| **类型逃逸** | `as any`, `as! Type` | 修复类型或删除 |
| **风格不一致** | 与文件其他部分不同的命名/格式 | 统一 |
| **废话日志** | `print("start")`, `console.log("here")` | 删除 |

### Step 3: 保留项

**不要删除**：
- `// MARK:` 分区注释
- `// TODO:` / `// FIXME:`
- 复杂逻辑的解释性注释
- 公共 API 文档注释
- 项目规范要求的注释

### Step 4: 报告

完成后输出 1-3 句总结：

```
Removed 5 redundant comments and 2 unnecessary try/catch blocks from UserService.kt and AuthManager.kt.
```

## 判断标准

### 是 Slop

```kotlin
// ❌ 冗余 - 代码已自解释
// Check if user is null
if (user == null) return

// ❌ 过度防御 - 内部调用无需
try {
    internalValidatedMethod()
} catch (e: Exception) {
    // never happens
}
```

### 不是 Slop

```kotlin
// ✅ 解释复杂逻辑
// Use exponential backoff to avoid thundering herd
val delay = baseDelay * (2.0.pow(attempt))

// ✅ MARK 分区
// MARK: - Lifecycle

// ✅ TODO 待办
// TODO: Add caching when user count exceeds 1000
```

## 注意事项

- 先读文件理解上下文，再决定是否移除
- 对比文件其他部分的风格
- 不确定时保留（保守策略）
- 每个文件修改后运行 lint 确保不破坏代码
