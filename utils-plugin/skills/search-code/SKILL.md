---
name: search-code
description: Provides unified code search for files, content, symbols, and patterns with automatic tool selection. This skill should be used when the user needs to find files by name, search content by pattern, locate symbol definitions, or trace usage across the codebase. Key capabilities include Glob-based file search, Grep-based content search, and AST-based symbol lookup with smart tool routing. Triggers on "find", "search", "where is", "look for", "grep", "symbol", "definition", "usage", "查找", "搜索", "哪里用了", "在哪定义", "查找符号", "搜索代码", "查找文件", "代码搜索", "符号查找", "全局搜索". Do NOT use for structural codebase exploration or architecture overview — use rp-explorer instead.
model: haiku
allowed-tools: [Glob, Grep, Bash, Read]
---

# search-code - 统一代码搜索

智能代码搜索，自动选择最优工具。

## When to Use

- `/search-code "pattern"` - 搜索内容
- `/search-code --file "*.swift"` - 搜索文件名
- `/search-code --symbol "ClassName"` - 搜索符号定义
- `/search-code --usage "functionName"` - 搜索使用位置

## Usage

```
/search-code PATTERN           内容搜索 (默认)
/search-code --file PATTERN    文件名搜索
/search-code --symbol NAME     符号定义搜索
/search-code --usage NAME      使用位置搜索
/search-code --type TYPE       按文件类型过滤 (swift/kt/ts/py)
```

## 搜索类型决策

| 用户意图 | 类型 | 工具 |
|---------|------|------|
| "查找 XXX 文件" | `--file` | Glob |
| "搜索 XXX 内容" | 默认 | Grep |
| "XXX 在哪定义" | `--symbol` | Grep + 正则 |
| "哪里用了 XXX" | `--usage` | Grep |

## 符号定义正则

| 语言 | 模式 |
|------|------|
| Swift | `(class\|struct\|enum\|protocol)\s+NAME` |
| Kotlin | `(class\|object\|interface)\s+NAME` |
| TypeScript | `(class\|interface\|type\|function)\s+NAME` |

## 平台感知

| 平台 | 检测 | 默认类型 |
|------|------|---------|
| iOS | Podfile / *.xcodeproj | *.swift, *.m |
| Android | build.gradle | *.kt, *.java |
| Web | package.json | *.ts, *.tsx |

## 输出格式

**紧凑模式** (≤10 结果):
```
📁 path/File.swift:42
    context...
    >>> matched line <<<
    context...
```

**文件列表模式** (>10 结果):
```
找到 25 处匹配:
📁 path/File.swift (3 matches)
📁 path/Another.swift (2 matches)
```

## Token 优化

| 场景 | 策略 |
|------|------|
| 结果 >20 | 只显示文件列表 + 计数 |
| 结果 >50 | 提示缩小搜索范围 |

## 示例

```bash
/search-code "API_KEY"
/search-code --file "ViewController"
/search-code --symbol "UserManager"
/search-code --usage "NetworkService"
```
