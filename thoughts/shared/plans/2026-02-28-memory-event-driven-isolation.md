---
plan_version: "2.1"
status: completed
created: 2026-02-28
refined: 2026-02-28
phases:
  - id: 1
    name: "Remove global Vault writes"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files:
      - "dev-flow/hooks/scripts/session-summary.sh"
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["npm test --prefix dev-flow/mcp-server", "grep -r 'writeKnowledgeEntry\\|ensureKnowledgeDirs' dev-flow/mcp-server/src/ && exit 1 || true"]
  - id: 2
    name: "Migrate reads from files to SQLite"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [1]
    target_files:
      - "dev-flow/mcp-server/src/continuity/context-injector.ts"
      - "dev-flow/hooks/scripts/session-start-continuity.sh"
    verify: ["npm test --prefix dev-flow/mcp-server", "grep 'getKnowledgeDir' dev-flow/mcp-server/src/continuity/context-injector.ts && exit 1 || true"]
  - id: 3
    name: "MEMORY.md layered auto-trim"
    complexity: low
    model: sonnet
    parallelizable: true
    depends_on: []
    target_files:
      - "dev-flow/hooks/scripts/session-summary.sh"
    verify: ["bash dev-flow/hooks/scripts/tests/test-session-summary.sh"]
  - id: 4
    name: "Bundle, test, fix bugs, cleanup"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [2, 3]
    target_files:
      - "dev-flow/scripts/mcp-server.cjs"
      - "dev-flow/mcp-server/src/continuity/memory.test.ts"
      - "dev-flow/mcp-server/src/index.ts"
    verify: ["npm test --prefix dev-flow/mcp-server", "npm run --prefix dev-flow/mcp-server bundle"]
key_decisions:
  cross_project_isolation: "Remove global ~/.claude/knowledge/ writes. SQLite per-project DB is the single source of truth."
  memory_md_layering: "Priority-based sections with line budgets. Section-aware awk trim (skip P0 headers)."
  prompt_knowledge_fix: "IFS='|||' bug → TAB separator + cut -f (GNU Bash Manual: IFS is char set, not string)"
  sql_injection_prevention: "Use single-quote escaping for shell-invoked sqlite3 (no parameterized queries available in CLI mode)"
  fts5_temporal_decay: "BM25 rank is negative (sqlite.org/fts5.html). Multiply by decay(0-1) moves old entries toward 0. ORDER BY ASC correct."
verified_decisions:
  additionalContext_support: "CONFIRMED — code.claude.com/docs/en/hooks: UserPromptSubmit supports additionalContext in hookSpecificOutput JSON"
  julianday_builtin: "CONFIRMED — sqlite.org/lang_datefunc.html: julianday() is 1 of 7 built-in date functions, returns REAL"
  ifs_triple_pipe_bug: "CONFIRMED — GNU Bash Manual Word-Splitting + mywiki.wooledge.org/IFS: IFS is character set, |||=|"
  fts5_rank_arithmetic: "CONFIRMED — sqlite.org/fts5.html: rank is hidden REAL column, usable in expressions; loses sort optimization but OK for <1K rows"
  hook_first_message_bug: "KNOWN — github.com/anthropics/claude-code/issues/17550: JSON hookSpecificOutput errors on 1st message. Workaround: fallback to plain stdout"
---

# Memory Event-Driven + Project Isolation Plan

## Overview

解决推文 @karry_viber 指出的 3 个问题 + 跨项目知识污染：

| 推文问题 | 解决方案 | Phase |
|---------|---------|-------|
| 1. Prompt-driven（Claude 自行决定写什么） | UserPromptSubmit hook 事件驱动检索 + Stop hook 事件驱动写入 | 已实现 (unstaged) |
| 2. 200行上限 + 无优先级/过期 | Temporal decay + TTL pruning + MEMORY.md 分层裁剪 | 改进2 已实现 + **Phase 3** |
| 3. Topic files 不自动加载 | 全局文件 → SQLite，通过 hooks 自动注入 | **Phase 1-2** |
| 4. 跨项目知识污染 | 删除全局 Vault 写入，项目内 DB 隔离 | **Phase 1-2** |

## Current State Analysis

**已实现（未提交的 unstaged changes）**:
- 改进 1: `prompt-knowledge.sh` — UserPromptSubmit 事件驱动检索（IFS bug 已修复）
- 改进 2: `memory.ts` — temporal decay + TTL pruning（access_count, last_accessed, memoryPrune）
- 改进 3: `session-start-continuity.sh` — weekly prune on SessionStart
- 改进 2 补充: `index.ts` — `dev_memory(action="prune")` MCP 工具

**待实现**:
- 改进 4: 跨项目隔离 — 删除全局 `~/.claude/knowledge/` 写入，所有读取迁移到 SQLite
- 改进 5: MEMORY.md 分层 — 优先级标记 + 按优先级自动裁剪

**污染路径**:
```
session-summary.sh:216 → ~/.claude/knowledge/platforms/{ios,android}/  (全局写入)
memory.ts writeKnowledgeEntry() → ~/.claude/knowledge/{patterns,discoveries}/  (全局写入)
context-injector.ts loadPlatformPitfalls() → ~/.claude/knowledge/...  (全局读取)
context-injector.ts loadRecentDiscoveries() → ~/.claude/knowledge/discoveries/  (全局读取)
session-start-continuity.sh:207 → ~/.claude/knowledge/...  (全局读取)
```

## Desired End State

```
知识写入:
  session-summary.sh → SQLite INSERT only (项目内 DB)
  memory.ts memorySave/consolidate → SQLite INSERT only
  ~/.claude/knowledge/ → 用户手动维护（不自动写入）

知识读取:
  UserPromptSubmit → prompt-knowledge.sh → 项目 SQLite FTS5 → additionalContext
  SessionStart → context-injector.ts → 项目 SQLite → MEMORY.md sync
  session-start-continuity.sh → 项目 SQLite（不读全局文件）

MEMORY.md 结构:
  P0 核心 (不裁剪)    ← Key Patterns, Architecture, Lessons
  P1 参考 (可裁剪)    ← Plugin Versions, 等
  P2 近期 (自动替换)  ← Last Session
  P3 临时 (自动清理)  ← Working State (compact)

过期机制:
  temporal decay: rank * 1/(1 + days/30)
  TTL pruning: access_count=0 AND >90 days → DELETE (weekly on SessionStart)
```

### Key Discoveries (Verified):

| 发现 | 验证来源 | 状态 |
|------|---------|------|
| `IFS='|||'` 按单个 `\|` 分割 | GNU Bash Manual §3.5.7 Word Splitting; mywiki.wooledge.org/IFS | ✅ 已修复为 TAB + cut |
| `additionalContext` 在 UserPromptSubmit 中支持 | code.claude.com/docs/en/hooks: "String added to Claude's context" | ✅ 官方确认 |
| JSON hookSpecificOutput 首条消息 bug | github.com/anthropics/claude-code/issues/17550 (closed NOT_PLANNED) | ⚠️ 需 fallback |
| FTS5 `rank` 是负数 (BM25) | sqlite.org/fts5.html: "bm25() with no arguments" | ✅ 当前实现正确 |
| `julianday()` 内置 | sqlite.org/lang_datefunc.html: 7 built-in date functions | ✅ 确认 |
| `rank * decay` 失去排序优化 | sqlite.org/fts5.html: custom ORDER BY forces per-row eval | ✅ <1K 行可接受 |
| 项目内 SQLite DB 天然隔离 | `.claude/cache/artifact-index/context.db` 在项目目录内 | ✅ 确认 |
| knowledge 表有 `source_project` 列 | 冗余但无害 — DB 本身已隔离 | ✅ 确认 |

## What We're NOT Doing

- 不删除 `~/.claude/knowledge/` 目录已有文件（用户可能手动维护）
- 不改变 knowledge 表 schema（access_count/last_accessed 已够用）
- 不改变 UserPromptSubmit 频率策略（1/3 已验证合理）
- 不做跨项目知识共享机制（当前无需求）
- 不改 MEMORY.md 的 P0 区域（人工维护，不自动触碰）

---

## Phase 1: Remove global Vault writes

### Overview
删除两处自动写入全局 `~/.claude/knowledge/` 的逻辑，只保留 SQLite 写入。

### Changes Required:

#### 1. session-summary.sh — 删除全局 Vault 写入
**File**: `dev-flow/hooks/scripts/session-summary.sh:210-256`
**Changes**: 移除整个 knowledge file writing 块（KNOWLEDGE_DIR, mkdir, echo to file），保留 SQLite INSERT

删除的代码块:
- `KNOWLEDGE_DIR="$HOME/.claude/knowledge"` (line 216)
- `case "$KP_TYPE" in ... esac` (line 223-228) — 目录路径选择
- `mkdir -p "$KP_DIR"` (line 229)
- `SAFE_TITLE=...` 到 `fi` (line 231-246) — 文件创建逻辑

保留的代码:
- `KNOWLEDGE=...` / `NUM_POINTS=...` (line 212-213) — 解析 JSON
- `KP_TYPE/TITLE/CONTENT/PLATFORM` 提取 (line 218-221) — SQLite 需要
- `sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO knowledge..."` (line 250-252)

#### 2. memory.ts — 删除 writeKnowledgeEntry + ensureKnowledgeDirs
**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

| 函数 | 行动 |
|------|------|
| `ensureKnowledgeDirs()` (line 66-71) | 删除 |
| `writeKnowledgeEntry()` (line 485-528) | 删除 |
| `memoryConsolidate()` — `writeKnowledgeEntry(entry)` 调用 | 删除，保留 `dbInsertKnowledge(entry)` |
| `memoryConsolidate()` — 重复检查 `pitfallsPath` (line 556-559) | 改为 SQLite 查 `smartDedup()` |
| `memorySave()` — `writeKnowledgeEntry` 调用（如有） | 删除 |
| `memoryStatus()` (line 622-659) | 从文件系统计数 → SQLite `SELECT COUNT(*) GROUP BY type` |

### Success Criteria:
#### Automated Verification:
- [ ] `npm test --prefix dev-flow/mcp-server` passes
- [ ] `grep 'writeKnowledgeEntry\|ensureKnowledgeDirs' dev-flow/mcp-server/src/` — 无结果
- [ ] `grep 'KNOWLEDGE_DIR.*\.claude/knowledge' dev-flow/hooks/scripts/session-summary.sh` — 无结果

---

## Phase 2: Migrate reads from files to SQLite

### Overview
将 context-injector.ts 和 session-start-continuity.sh 中读取全局文件的逻辑改为项目内 SQLite 查询。

### Changes Required:

#### 1. context-injector.ts — 重写知识加载函数
**File**: `dev-flow/mcp-server/src/continuity/context-injector.ts`

**`loadPlatformPitfalls()`** (line 94-105):
```typescript
// BEFORE: reads ~/.claude/knowledge/platforms/{platform}/pitfalls.md
// AFTER: queries project SQLite
// REF: sqlite.org/lang_datefunc.html (julianday), sqlite.org/fts5.html (rank)
function loadPlatformPitfalls(platform: string, maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';
  // NOTE: sqlite3 CLI doesn't support parameterized queries.
  // Escape single quotes by doubling them (standard SQL escaping).
  const safePlatform = platform.replace(/'/g, "''");
  const sql = `SELECT title, substr(problem,1,100) FROM knowledge
    WHERE type='pitfall' AND platform='${safePlatform}'
    ORDER BY created_at DESC LIMIT 5;`;
  try {
    // Use TAB separator (not | which can appear in content)
    const result = execSync(`sqlite3 -separator $'\\t' "${dbPath}" "${sql}"`, {
      encoding: 'utf-8', timeout: 3000,
    }).trim();
    if (!result) return '';
    let output = '';
    for (const line of result.split('\n')) {
      const sep = line.indexOf('\t');
      const title = line.slice(0, sep);
      const problem = line.slice(sep + 1);
      const entry = `### ${title}\n${problem}\n`;
      if (output.length + entry.length > maxChars) break;
      output += entry;
    }
    return output;
  } catch { return ''; }
}
```

**`loadRecentDiscoveries()`** (line 134-163):
```typescript
// BEFORE: reads ~/.claude/knowledge/discoveries/ directory (7 day mtime)
// AFTER: queries SQLite for recent entries (any type, 7 days)
// REF: sqlite.org/lang_datefunc.html — julianday('now') returns REAL, arithmetic confirmed
function loadRecentDiscoveries(maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';
  const sql = `SELECT type, title, substr(problem,1,80) FROM knowledge
    WHERE julianday('now') - julianday(created_at) <= 7
    ORDER BY created_at DESC LIMIT 3;`;
  // ... same sqlite3 -separator $'\\t' pattern ...
}
```

**删除**: `getKnowledgeDir()` 函数 (line 39-41)，`pitfallsToBullets()` 函数 (line 287-301)

**`syncToMemoryMd()`**: 更新 section 1 (`loadPlatformPitfalls`) 和 section 3 (`loadRecentDiscoveries`) 的调用 — 输出格式可能变化，需调整 `pitfallsToBullets` 或内联格式化。

#### 2. session-start-continuity.sh — 删除全局文件读取
**File**: `dev-flow/hooks/scripts/session-start-continuity.sh:205-270`

移除整个 `~/.claude/knowledge/` 读取块:
- `KNOWLEDGE_DIR="${HOME}/.claude/knowledge"` (line 207)
- `PITFALLS_FILE="$KNOWLEDGE_DIR/platforms/$PLATFORM/pitfalls.md"` (line 225)
- `DISCOVERIES_DIR="$KNOWLEDGE_DIR/discoveries"` (line 257)

如保留 fallback，改为 SQLite 查询:
```bash
DB_PATH="$PROJECT_DIR/.claude/cache/artifact-index/context.db"
if [[ -f "$DB_PATH" ]]; then
  PITFALLS=$(sqlite3 "$DB_PATH" "SELECT '[' || type || '] ' || title || ': ' || substr(problem,1,80) FROM knowledge WHERE type='pitfall' AND platform='$PLATFORM' ORDER BY created_at DESC LIMIT 3;" 2>/dev/null)
  DISCOVERIES=$(sqlite3 "$DB_PATH" "SELECT '[' || type || '] ' || title || ': ' || substr(problem,1,80) FROM knowledge WHERE julianday('now') - julianday(created_at) <= 7 ORDER BY created_at DESC LIMIT 3;" 2>/dev/null)
fi
```

### Success Criteria:
#### Automated Verification:
- [ ] `npm test --prefix dev-flow/mcp-server` passes
- [ ] `grep 'getKnowledgeDir' dev-flow/mcp-server/src/continuity/context-injector.ts` — 无结果
- [ ] `grep '\.claude/knowledge' dev-flow/hooks/scripts/session-start-continuity.sh` — 只在注释中
- [ ] `grep -r '\.claude/knowledge' dev-flow/` — 只在注释或文档中

---

## Phase 3: MEMORY.md layered auto-trim

### Overview
为 MEMORY.md 定义优先级分层结构，当文件接近 200 行时按优先级从低到高裁剪。

### Design

**优先级层次**:
```
P0: 核心 (永不自动裁剪)
  # Memory - project-name
  ## Key Patterns
  ## Architecture Decisions
  ## Lessons Learned

P1: 参考 (超限时裁剪到 header + 5 行)
  ## Plugin Versions  ← 表格可裁剪

P2: 近期 (每次 session 自动替换)
  <!-- LAST-SESSION-START -->
  ## Last Session
  <!-- LAST-SESSION-END -->

P3: 临时 (1小时后自动清理，已实现)
  <!-- COMPACT-STATE-START -->
  ## Working State
  <!-- COMPACT-STATE-END -->
```

**裁剪规则**: 在 `session-summary.sh` 写完 Last Session 后：
1. 计算总行数
2. 如果 > 160: 裁剪 P1 区域（保留 header + 5 行）
3. 如果仍 > 180: 裁剪 P2 到最小（1 行 next_steps）
4. 如果仍 > 200: 删除 P3 (COMPACT-STATE)

### Changes Required:

#### 1. session-summary.sh — 分层裁剪逻辑
**File**: `dev-flow/hooks/scripts/session-summary.sh:289-300`

替换现有的简单截断逻辑:
```bash
# BEFORE (line 291-300): naive truncation of Last Session to 1 line
# AFTER: section-aware priority-based trimming
# DESIGN: P0 sections are identified by header names, not by table syntax

LINE_COUNT=$(wc -l < "$MEMORY_MD" 2>/dev/null | tr -d ' ')

# P0 headers (never trim content under these sections)
# "Key Patterns", "Architecture Decisions", "Lessons Learned"
# P1 headers: everything else not in P0/P2/P3

# Step 1: trim P1 sections — trim tables to header+5 rows, but SKIP P0 sections
if [ "$LINE_COUNT" -gt 160 ]; then
  # Track which section we're in by ## header.
  # P0 sections: skip trimming. P1 sections: trim tables.
  awk '
    /^## Key Patterns/    { p0=1 }
    /^## Architecture/    { p0=1 }
    /^## Lessons/         { p0=1 }
    /^## / && !/Key Patterns|Architecture|Lessons/ { p0=0; table=0 }
    /^\|/ && !p0 { table++; if (table > 7) next }
    !/^\|/ { table=0 }
    { print }
  ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" && mv "${MEMORY_MD}.tmp" "$MEMORY_MD"
  LINE_COUNT=$(wc -l < "$MEMORY_MD" | tr -d ' ')
fi

# Step 2: trim P2 (Last Session → minimal 1-line)
if [ "$LINE_COUNT" -gt 180 ]; then
  MINIMAL_BLOCK="## Last Session\n- Next: $(echo "$NEXT_STEPS" | head -1)"
  awk -v block="$MINIMAL_BLOCK" '
    /<!-- LAST-SESSION-START -->/{found=1; print; printf "%s\n", block; next}
    /<!-- LAST-SESSION-END -->/{found=0}
    !found
  ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" && mv "${MEMORY_MD}.tmp" "$MEMORY_MD"
  LINE_COUNT=$(wc -l < "$MEMORY_MD" | tr -d ' ')
fi

# Step 3: remove P3 (COMPACT-STATE) if still over
if [ "$LINE_COUNT" -gt 200 ]; then
  awk '
    /<!-- COMPACT-STATE-START -->/{skip=1; next}
    /<!-- COMPACT-STATE-END -->/{skip=0; next}
    !skip
  ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" && mv "${MEMORY_MD}.tmp" "$MEMORY_MD"
fi
```

### Success Criteria:
#### Automated Verification:
- [ ] `bash dev-flow/hooks/scripts/tests/test-session-summary.sh` passes
- [ ] 测试：200+ 行的 MEMORY.md 经过裁剪后 ≤ 200 行
- [ ] 测试：P0 区域（Key Patterns, Lessons）裁剪后完整保留

---

## Phase 4: Bundle, test, fix bugs, cleanup

### Overview
修复已知 bug、Bundle MCP server、运行全量测试、确保所有改动一起工作。

### Changes Required:

#### 1. Fix: `prune` action 加入 schema enum (BUG)
**File**: `dev-flow/mcp-server/src/index.ts:271`
**问题**: `dev_memory` tool schema 的 action enum 缺少 `prune`。Handler 已实现（line 1161-1164），但 MCP 客户端看不到此选项。
```typescript
// BEFORE:
enum: ['consolidate', 'status', 'query', 'list', 'extract', 'save', 'search', 'get']
// AFTER:
enum: ['consolidate', 'status', 'query', 'list', 'extract', 'save', 'search', 'get', 'prune']
```

#### 2. Fix: `prompt-knowledge.sh` 首条消息 fallback
**File**: `dev-flow/hooks/scripts/prompt-knowledge.sh:134-135`
**问题**: GitHub #17550 — JSON `hookSpecificOutput` 格式在 session 首条消息时报错（closed NOT_PLANNED）。
**修正**: 最后一行 `jq` 输出已有 `|| echo '{"continue":true}'` fallback，足够安全。
添加注释说明此已知行为即可。

#### 3. Bundle MCP server
```bash
npm run --prefix dev-flow/mcp-server bundle
```

#### 4. 补充测试
**File**: `dev-flow/mcp-server/src/continuity/memory.test.ts`
- 添加 `memoryStatus()` 测试（验证从 SQLite `SELECT COUNT(*) GROUP BY type` 统计）
- 验证 `memoryConsolidate()` 不写全局文件（mock `writeFileSync`，断言未调用）
- 验证 `loadPlatformPitfalls()` 从 SQLite 返回结果（Phase 2 引入的新函数）

#### 5. E2E smoke test
```bash
bash dev-flow/hooks/scripts/tests/e2e-smoke.sh
```

#### 6. 清理
- 移除 `memory.ts` 中未使用的 import（`mkdirSync` 如果全局写入已移除）
- 确认 `getKnowledgeDir()` 在所有 TS 文件中已移除
- 更新 `dev-flow/CLAUDE.md` "Knowledge System" 描述：
  - 移除 `~/.claude/knowledge/{platforms,patterns,discoveries}/` 引用
  - 改为 "SQLite per-project DB is single source of truth"

### Success Criteria:
#### Automated Verification:
- [ ] `npm test --prefix dev-flow/mcp-server` — 全部通过
- [ ] `grep -r 'getKnowledgeDir\|ensureKnowledgeDirs' dev-flow/mcp-server/src/` — 无结果
- [ ] `grep -r '\.claude/knowledge' dev-flow/hooks/scripts/` — 无结果（除注释）
- [ ] `npm run --prefix dev-flow/mcp-server bundle` — 成功
- [ ] `grep 'prune' dev-flow/mcp-server/src/index.ts | grep enum` — 存在

---

## Testing Strategy

### Unit Tests:
- `memoryStatus()` 从 SQLite 统计 → 返回正确计数
- `memoryConsolidate()` 只写 SQLite → 不创建全局文件
- `memoryPrune()` dry-run 和实际删除
- `loadPlatformPitfalls()` 从 SQLite → 返回格式化 pitfalls
- `loadRecentDiscoveries()` 从 SQLite → 返回 7 天内条目

### Integration Tests:
- `prompt-knowledge.sh` 端到端：prompt → keywords → FTS → additionalContext
- `session-summary.sh` 端到端：excerpt → Haiku → SQLite (无全局文件)
- MEMORY.md auto-trim：200+ 行 → 裁剪后 ≤ 200 行，P0 完整

### Manual Testing Steps:
1. 运行完整 session: 启动 → 工作 → 退出，验证 `~/.claude/knowledge/` 无新文件
2. 跨项目验证: 在项目 A 工作后切到项目 B，验证 B 的 SessionStart 不注入 A 的知识
3. MEMORY.md 验证: 人工在 MEMORY.md 加内容到 170+ 行，运行 session 退出，验证裁剪行为

## Dependency Graph

```
Phase 1 (删除全局写) ──→ Phase 2 (迁移读取) ──→ Phase 4 (bundle+test)
                                                    ↑
Phase 3 (MEMORY.md 分层) ──────────────────────────┘
```

Phase 1 和 3 可并行（无文件冲突：1 改 memory.ts，3 改 session-summary.sh 的不同区域）。

## Technical Verification Summary

每个技术决策已通过文档验证：

| 决策 | 验证来源 | 结论 |
|------|---------|------|
| UserPromptSubmit `additionalContext` | [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks) | ✅ 官方支持，string 类型 |
| FTS5 `rank` 用于算术表达式 | [sqlite.org/fts5.html](https://sqlite.org/fts5.html) | ✅ 可行，rank 是 REAL hidden column |
| BM25 返回负数 | 同上 ("bm25() with no arguments") | ✅ 当前 ORDER BY ASC 正确 |
| `julianday()` 内置函数 | [sqlite.org/lang_datefunc.html](https://sqlite.org/lang_datefunc.html) | ✅ 7 个内置日期函数之一 |
| `IFS='|||'` = `IFS='|'` | [GNU Bash Manual §3.5.7](https://www.gnu.org/software/bash/manual/html_node/Word-Splitting.html); [wooledge.org/IFS](https://mywiki.wooledge.org/IFS) | ✅ IFS 是字符集非字符串 |
| TAB + `cut -f` 可靠 | POSIX `cut` 规范; TAB 是默认分隔符 | ✅ 已在 prompt-knowledge.sh 使用 |
| JSON hookSpecificOutput 首条消息 bug | [github.com/anthropics/claude-code#17550](https://github.com/anthropics/claude-code/issues/17550) | ⚠️ 已知问题，有 fallback |
| `rank * decay` 失去排序优化 | [sqlite.org/fts5.html](https://sqlite.org/fts5.html) (ORDER BY optimization) | ✅ <1K 行可接受 |
| sqlite3 CLI 无参数化查询 | SQLite CLI 文档 | ✅ 用 single-quote doubling 转义 |

## References

- 推文: @karry_viber/status/2027196520379171288
- OpenClaw 研究: 3-layer memory, hybrid search, temporal decay
- 前次 plan: `thoughts/shared/plans/2026-02-28-memory-continuity-redesign.md` (status: completed)
- SQLite FTS5: https://sqlite.org/fts5.html
- SQLite Date Functions: https://sqlite.org/lang_datefunc.html
- Claude Code Hooks: https://code.claude.com/docs/en/hooks
- GNU Bash IFS: https://www.gnu.org/software/bash/manual/html_node/Word-Splitting.html
- Hooks Bug #17550: https://github.com/anthropics/claude-code/issues/17550
