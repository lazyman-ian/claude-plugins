---
plan_version: "2.0"
status: completed
created: 2026-02-28
phases:
  - id: 1
    name: "Simplify Architecture — Delete Dead Code"
    complexity: high
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/mcp-server/src/continuity/instincts.ts"
      - "dev-flow/mcp-server/src/continuity/instincts.test.ts"
      - "dev-flow/mcp-server/src/continuity/embeddings.ts"
      - "dev-flow/mcp-server/src/continuity/product-brain.ts"
      - "dev-flow/mcp-server/src/continuity/product-brain.test.ts"
      - "dev-flow/mcp-server/src/continuity/index.ts"
      - "dev-flow/mcp-server/src/index.ts"
      - "dev-flow/hooks/scripts/observe-batch.sh"
      - "dev-flow/hooks/hooks.json"
      - "dev-flow/commands/evolve.md"
    verify: ["npm run --prefix dev-flow/mcp-server build && npm test --prefix dev-flow/mcp-server"]
  - id: 2
    name: "Smart PreCompact — 3-Layer Working State Save"
    complexity: high
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "dev-flow/hooks/scripts/pre-compact.sh"
      - "dev-flow/hooks/dist/pre-compact-continuity.mjs"
      - "dev-flow/mcp-server/src/continuity/ledger.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build && bash dev-flow/hooks/scripts/tests/test-pre-compact.sh"]
  - id: 3
    name: "Phase Checkpoint — Auto-Save on Task/Phase Complete"
    complexity: medium
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "dev-flow/hooks/hooks.json"
      - "dev-flow/hooks/scripts/task-checkpoint.sh"
    verify: ["bash dev-flow/hooks/scripts/tests/test-task-checkpoint.sh"]
  - id: 4
    name: "Post-Compact Recovery — SessionStart Loads Checkpoint"
    complexity: low
    model: sonnet
    parallelizable: false
    depends_on: [2]
    target_files:
      - "dev-flow/hooks/scripts/session-start-continuity.sh"
      - "dev-flow/mcp-server/src/continuity/ledger.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 5
    name: "LLM Extract — Haiku-Powered Knowledge Extraction"
    complexity: high
    model: sonnet
    parallelizable: true
    depends_on: [1]
    target_files:
      - "dev-flow/hooks/scripts/session-summary.sh"
      - "dev-flow/mcp-server/src/continuity/memory.ts"
    verify: ["bash dev-flow/hooks/scripts/tests/test-session-summary.sh && npm test --prefix dev-flow/mcp-server -- --testPathPattern=memory"]
  - id: 6
    name: "Smart Dedup — FTS5-First + Optional LLM Escalation"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [5]
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/mcp-server/src/continuity/memory.test.ts"
    verify: ["npm test --prefix dev-flow/mcp-server -- --testPathPattern=memory"]
  - id: 7
    name: "Bundle & E2E Smoke Test"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: [4, 5, 6]
    target_files:
      - "dev-flow/scripts/mcp-server.cjs"
      - "dev-flow/hooks/scripts/tests/e2e-smoke.sh"
    verify: ["npm run --prefix dev-flow/mcp-server bundle && bash dev-flow/hooks/scripts/tests/e2e-smoke.sh"]
key_decisions:
  storage: "Obsidian Vault (md) + SQLite FTS5 (index only). No ChromaDB."
  extraction: "Haiku LLM Extract on Stop hook (~$0.005/session)"
  dedup: "FTS5 BM25 + token overlap (70-80% cases, $0) → LLM escalation (20-30%, ~$0.001)"
  continuity: "Smart PreCompact (transcript + filesystem + Auto Memory MEMORY.md) + Phase Checkpoint + Streaming Ledger"
  auto_memory: "PreCompact writes COMPACT-STATE to MEMORY.md, survives compaction"
  tier_system: "Collapse 4-tier to 2 modes: off (0) and on (1)"
---

# Memory & Continuity System Redesign

## Overview

重新设计 dev-flow 的 memory 和 continuity 系统。基于对 95% 自动生成数据为垃圾的审计结论，以及 Mem0/Letta/claude-mem/GitHub Copilot Memory 等项目的研究，实现两个维度的改进：

1. **Knowledge Layer**: LLM 增强的知识提取 + Mem0 风格去重
2. **Continuity Layer**: Smart PreCompact + Phase Checkpoint + Streaming Ledger

核心理念：**Simple filesystem beats specialized memory** (Letta benchmark: 74% vs 68.5%)

## Current State Analysis

### 问题清单

| 组件 | 问题 | 数据 |
|------|------|------|
| 4-Tier System | 过度工程，Tier 2-3 从未真正工作 | ChromaDB 从未安装 |
| Regex Scanners | 95% 输出为垃圾 | 44/44 pattern-decision 无价值 |
| Observations | 纯活动日志，无知识价值 | 100% 清理 |
| Instincts | 依赖 Observations，无输入源 | 永远为空 |
| Product Brain | 从未被使用 | 0 entries |
| PreCompact | 只更新 ledger 时间戳 + 调用不存在的 mjs (实际有 `transcript_path` 可用) | 关键信息丢失 ~30% |
| Session Summary | 有效但无法提取结构化知识 | Stop hook 正常工作 |

### 有价值的组件

| 组件 | 价值 | 保留? |
|------|------|-------|
| Session Summaries | 跨 session 上下文恢复 | ✅ Keep |
| `dev_memory save` | 手动保存高质量知识 | ✅ Keep |
| MEMORY.md sync | Auto Memory 集成 | ✅ Keep |
| FTS5 index | 快速全文搜索 | ✅ Keep |
| Obsidian Vault | 手写知识 (6 files) | ✅ Keep |
| Context Injector | SessionStart 注入 | ✅ Keep + Enhance |

## Desired End State

```
Session Stop → Haiku Extract (知识点) → Mem0 Compare (去重) → Obsidian Vault + FTS5
                                                                         ↓
PreCompact → Transcript Parse ──→ systemMessage (立即注入)          SessionStart →
           → Filesystem State ──→ .compact-checkpoint.md (SessionStart 恢复)  Context Inject
           → Auto Memory ──────→ MEMORY.md COMPACT-STATE (跨 compaction 持久)
                                                                         ↑
Phase Checkpoint (TaskCompleted) → Ledger Auto-Update ───────────────────┘
```

**验证标准**:
- `npm test --prefix dev-flow/mcp-server` 通过
- `npm run --prefix dev-flow/mcp-server bundle` 成功
- Session summary 正常生成 (手动 Stop hook 测试)
- Memory 入口数减少但质量提高 (人工检查)

### Key Discoveries:
- `memory.ts:100-221` — DB schema 有 6 个表，其中 observations/reasoning/knowledge 已证明低价值
- `context-injector.ts:19` — 总 budget 2500 chars，结构合理，保留
- `pre-compact.sh` — 只更新 ledger 时间戳 + 调用 `dist/pre-compact-continuity.mjs` (有 `parseTranscript()` 但未被正确使用)
- PreCompact 输入: `transcript_path` (对话 JSONL), `session_id`, `trigger` (auto|manual), `custom_instructions`
- `hooks.json` — 15 hooks across 6 types，PostToolUse 有 observe-batch（Tier 3，已废弃）
- `session-summary.sh` — 已修复 dedup (stable SUMMARY_ID + INSERT OR REPLACE)
- `instincts.ts` — 依赖 observations 表，已证明无有效输入
- `embeddings.ts` — ChromaDB 封装，从未安装过

### Key Decisions (from Brainstorm):
- **Storage**: Obsidian Vault (md files) + SQLite FTS5 (index only)
- **Delete**: ChromaDB, Observations, Instincts, Product Brain, 4-Tier 系统
- **Tier 简化**: 4-tier → 2 modes (off=0, on=1)
- **LLM Extract**: Haiku ~$0.005/session，从 session transcript 提取结构化知识
- **Mem0 Compare**: Haiku ~$0.003/call，与现有知识对比决定 ADD/UPDATE/DELETE/NOOP
- **Continuity**: Smart PreCompact (transcript + filesystem + Auto Memory) + Phase Checkpoint + Streaming Ledger
- **Auto Memory**: PreCompact → MEMORY.md `<!-- COMPACT-STATE -->` 区域，跨 compaction 持久可见

## What We're NOT Doing

- ❌ Vector DB / Embeddings — 简单 FTS5 已足够 (Letta benchmark)
- ❌ 实时 observation capture — 已证明产出垃圾
- ❌ 复杂的 tier 配置 — 2 modes 足够
- ❌ 新增 MCP tools — 复用现有 `dev_memory` 接口
- ❌ 修改 Obsidian Vault 格式 — 已在上次 session 格式化完毕
- ❌ UI/前端 — 纯后端 + hooks 改动

## Implementation Approach

**策略**: 先删后建。Phase 1 清理死代码减少 ~400 行，再逐步添加新功能。

依赖图:
```
Phase 1 (Delete) ──→ Phase 2 (PreCompact) ──→ Phase 4 (Recovery, ~10 行代码)
       │
       ├──→ Phase 3 (Checkpoint)
       │
       └──→ Phase 5 (LLM Extract) ──→ Phase 6 (Smart Dedup)
                                              │
                                              └──→ Phase 7 (Bundle + E2E)
```

Phase 2+3+5 可并行。Phase 4 很小 (仅 ~10 行追加到 session-start-continuity.sh)。

---

## Phase 1: Simplify Architecture — Delete Dead Code

### Overview
删除已证明无价值的组件：Instincts, Observations, Embeddings/ChromaDB, Product Brain。简化 4-tier 为 2-mode。减少 ~400 行代码和 5 个源文件。

### Changes Required:

#### 1. Delete files (6 files)
- `dev-flow/mcp-server/src/continuity/instincts.ts` — 完整删除
- `dev-flow/mcp-server/src/continuity/instincts.test.ts` — 完整删除
- `dev-flow/mcp-server/src/continuity/embeddings.ts` — 完整删除
- `dev-flow/mcp-server/src/continuity/product-brain.ts` — 完整删除
- `dev-flow/mcp-server/src/continuity/product-brain.test.ts` — 完整删除
- `dev-flow/hooks/scripts/observe-batch.sh` — 完整删除

#### 2. Fix barrel export — continuity/index.ts
**File**: `dev-flow/mcp-server/src/continuity/index.ts:12`
**Changes**: Remove `export * from './embeddings'` (会导致 import 失败)

#### 3. Simplify memory.ts
**File**: `dev-flow/mcp-server/src/continuity/memory.ts`
**Changes**:
- Remove `import { getSemanticSearch } from './embeddings'` (line 12)
- Remove ChromaDB references in `memorySave()` (line 790-798)
- Remove `memorySearchAsync()` entirely (line 835-878), replace callers with `memorySearch()`
- Simplify `getMemoryConfig()`: remove `chromadb`, `periodicCapture`, `captureInterval`
- Remove `observations` table from DB schema (line 188-220)
- Simplify tier: `tier >= 1` = session summaries ON, that's it

```typescript
// Before
function getMemoryConfig(): { tier: number; sessionSummary: boolean; chromadb: boolean; periodicCapture: boolean; captureInterval: number }

// After
function getMemoryConfig(): { tier: number; sessionSummary: boolean }
```

#### 4. Clean up index.ts — remove tool handlers
**File**: `dev-flow/mcp-server/src/index.ts`
**Changes**:
- Remove `import` for instincts (line 23), product-brain (line 24)
- Remove `dev_instinct` tool definition + handler (line 267, 318, 539-543)
- Remove `dev_product` tool definition + handler
- Keep `dev_memory` tool handler (enhanced in Phase 5-6)

#### 5. Remove observation hooks
**File**: `dev-flow/hooks/hooks.json`
**Changes**: Remove PostToolUse entry referencing `observe-batch.sh` (line 156-164)

#### 6. Archive evolve command
**File**: `dev-flow/commands/evolve.md`
**Changes**: 删除或标记 deprecated（84 lines 专用于 instincts evolution，无 instincts 后无意义）

#### 7. Clean tool-counter.sh
**File**: `dev-flow/hooks/scripts/tool-counter.sh`
**Changes**: Remove periodic observation capture logic (Tier 3 references)

### Success Criteria:

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` succeeds (TypeScript 编译无 import 错误)
- [ ] `npm test --prefix dev-flow/mcp-server` passes (删除了 instincts.test.ts + product-brain.test.ts)
- [ ] `grep -r 'embeddings\|instincts\|product-brain' dev-flow/mcp-server/src/ --include='*.ts' | grep -v node_modules` 无结果

#### Manual Verification:
- [ ] `dev_memory(action="status")` 返回有效输出
- [ ] `dev_memory(action="save", text="test")` 仍然工作
- [ ] `dev_memory(action="search", query="test")` 仍然工作

---

## Phase 2: Smart PreCompact — Save Working State Before Compaction

### Overview
升级 PreCompact hook，在 compaction 前通过三层数据源保存工作状态，写入三个目标确保上下文连续性。

> **研究发现**: PreCompact hook 输入字段比之前认为的更丰富：
> ```json
> {
>   "session_id": "abc123",
>   "transcript_path": "/path/to/session.jsonl",    // 完整对话记录!
>   "cwd": "/project/dir",
>   "trigger": "auto|manual",                        // 不是 compaction_type
>   "custom_instructions": "用户 /compact 时输入的文字",
>   "hook_event_name": "PreCompact"
> }
> ```
>
> **关键**: `transcript_path` 指向完整对话 JSONL 文件，现有 `dist/pre-compact-continuity.mjs` 已有 `parseTranscript()` 逻辑。

### 设计: 三层数据源 → 三个输出目标

**数据源**:
| 来源 | 获取方式 | 信息 |
|------|---------|------|
| **Transcript** | `parseTranscript(transcript_path)` | Task state, recent tool calls, modified files, errors, last assistant message |
| **Filesystem** | git commands + file reads | Uncommitted changes, staged changes, recent commits, ledger state |
| **Custom instructions** | `input.custom_instructions` | 用户通过 `/compact <text>` 传递的上下文提示 |

**输出目标**:
| 目标 | 作用 | 持久性 |
|------|------|--------|
| **`systemMessage`** | 紧接 compaction 后注入 Claude context | 单次 (compaction 后立即可见) |
| **`.compact-checkpoint.md`** | SessionStart 恢复用 | 文件 (< 1 hour 有效) |
| **MEMORY.md `<!-- COMPACT-STATE -->`** | Auto Memory 持久保存 | 每次对话加载 (直到下次覆盖) |

> **为什么需要三个?**
> - `systemMessage`: compaction 后 Claude 立刻能看到上下文摘要
> - checkpoint: 结构化数据，SessionStart 可以用于精确恢复 (如注入 ledger state)
> - MEMORY.md: **最关键** — Auto Memory 在 compaction 后的每个 turn 都自动加载，是唯一保证跨 compaction 持续存在的通道

### Changes Required:

#### 1. Rewrite pre-compact.sh — 三层采集 + 三层输出
**File**: `dev-flow/hooks/scripts/pre-compact.sh`
**Changes**: 完全重写

```bash
#!/bin/bash
set -o pipefail

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "auto"' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
CUSTOM_INST=$(echo "$INPUT" | jq -r '.custom_instructions // empty' 2>/dev/null)

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LEDGER_DIR="$project_dir/thoughts/ledgers"

# --- Layer 1: Filesystem state ---
BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null || echo "detached")
GIT_DIFF=$(git -C "$project_dir" diff --stat 2>/dev/null | tail -10)
GIT_STAGED=$(git -C "$project_dir" diff --cached --stat 2>/dev/null | tail -5)
RECENT_COMMITS=$(git -C "$project_dir" log --oneline -5 2>/dev/null)

LEDGER_STATE=""
OPEN_QUESTIONS=""
if [[ -d "$LEDGER_DIR" ]]; then
  ACTIVE_LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
  if [[ -n "$ACTIVE_LEDGER" && -f "$ACTIVE_LEDGER" ]]; then
    LEDGER_STATE=$(grep -A 20 '## State' "$ACTIVE_LEDGER" 2>/dev/null | head -20)
    OPEN_QUESTIONS=$(grep -A 10 '## Open Questions' "$ACTIVE_LEDGER" 2>/dev/null | head -10)
    # Update ledger timestamp
    /usr/bin/sed -i '' "s/^Updated: .*/Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")/" "$ACTIVE_LEDGER" 2>/dev/null || true
  fi
fi

# --- Layer 2: Transcript state (via Node.js for large JSONL) ---
TASK_STATE=""
RECENT_ACTIONS=""
LAST_CONTEXT=""
MODIFIED_FILES=""
if [[ -n "$TRANSCRIPT_PATH" && -f "$TRANSCRIPT_PATH" ]]; then
  # Use inline Node.js for fast JSONL parsing (jq too slow for 100MB+ files)
  TRANSCRIPT_JSON=$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync(process.argv[1], 'utf-8').split('\n').filter(l => l.trim());
    const result = { tasks: [], tools: [], files: new Set(), lastMsg: '' };
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        // Last assistant message
        if ((e.role === 'assistant' || e.type === 'assistant') && typeof e.content === 'string')
          result.lastMsg = e.content;
        // Task state (TodoWrite/TaskCreate/TaskUpdate)
        const tn = e.tool_name || e.name || '';
        if (tn.includes('Todo') || tn.includes('Task')) {
          const inp = e.tool_input || {};
          if (inp.subject || inp.todos) result.tasks.push(inp);
        }
        // Modified files
        if (['Edit','Write'].some(t => tn.includes(t))) {
          const fp = (e.tool_input || {}).file_path;
          if (fp) result.files.add(fp.replace(process.argv[2] + '/', ''));
        }
        // Recent tool calls
        if (tn) result.tools.push(tn);
      } catch {}
    }
    console.log(JSON.stringify({
      lastMsg: result.lastMsg.slice(-400),
      files: [...result.files].slice(-10),
      recentTools: result.tools.slice(-8),
      taskCount: result.tasks.length
    }));
  " "$TRANSCRIPT_PATH" "$project_dir" 2>/dev/null || echo "")

  if [[ -n "$TRANSCRIPT_JSON" ]]; then
    LAST_CONTEXT=$(echo "$TRANSCRIPT_JSON" | jq -r '.lastMsg // empty' 2>/dev/null)
    MODIFIED_FILES=$(echo "$TRANSCRIPT_JSON" | jq -r '.files | join(", ")' 2>/dev/null)
    RECENT_ACTIONS=$(echo "$TRANSCRIPT_JSON" | jq -r '.recentTools | join(" → ")' 2>/dev/null)
  fi
fi

# --- Output 1: Compact Checkpoint (file) ---
if [[ -d "$LEDGER_DIR" ]]; then
  CHECKPOINT="$LEDGER_DIR/.compact-checkpoint.md"
  cat > "$CHECKPOINT" << HEREDOC
# Compact Checkpoint
**Branch**: ${BRANCH}
**Time**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Trigger**: ${TRIGGER}
${CUSTOM_INST:+**User note**: ${CUSTOM_INST}}

## Uncommitted Changes
${GIT_DIFF:-No uncommitted changes}

## Staged Changes
${GIT_STAGED:-Nothing staged}

## Recent Commits
${RECENT_COMMITS:-No recent commits}

## Active Ledger State
${LEDGER_STATE:-No active ledger}

## Open Questions
${OPEN_QUESTIONS:-None}

## Files Modified This Session
${MODIFIED_FILES:-Unknown (no transcript)}

## Last Context
${LAST_CONTEXT:+$(echo "$LAST_CONTEXT" | head -c 300)}
HEREDOC
fi

# --- Output 2: Auto Memory MEMORY.md update ---
ENCODED_PATH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$ENCODED_PATH/memory"
MEMORY_MD="$MEMORY_DIR/MEMORY.md"

if [[ -f "$MEMORY_MD" ]]; then
  # Build working state block (concise, < 10 lines)
  STATE_BLOCK="## Working State (auto-saved before compact)
- Branch: ${BRANCH}
- Modified: ${MODIFIED_FILES:-unknown}
- Ledger: $(echo "$LEDGER_STATE" | grep -oP '(?:Now|→).*' | head -1 || echo 'none')
${OPEN_QUESTIONS:+- Open: $(echo "$OPEN_QUESTIONS" | head -2 | tr '\n' '; ')}
<!-- AUTO-UPDATED by pre-compact.sh -->"

  if grep -q '<!-- COMPACT-STATE-START -->' "$MEMORY_MD" 2>/dev/null; then
    # Replace between markers
    awk -v block="$STATE_BLOCK" '
      /<!-- COMPACT-STATE-START -->/ { print "<!-- COMPACT-STATE-START -->"; print block; skip=1; next }
      /<!-- COMPACT-STATE-END -->/ { skip=0; print; next }
      !skip { print }
    ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
  else
    # Insert before LAST-SESSION if exists, else append
    if grep -q '<!-- LAST-SESSION-START -->' "$MEMORY_MD" 2>/dev/null; then
      /usr/bin/sed -i '' "/<!-- LAST-SESSION-START -->/i\\
<!-- COMPACT-STATE-START -->\\
${STATE_BLOCK}\\
<!-- COMPACT-STATE-END -->\\
" "$MEMORY_MD" 2>/dev/null
    else
      printf '\n<!-- COMPACT-STATE-START -->\n%s\n<!-- COMPACT-STATE-END -->\n' "$STATE_BLOCK" >> "$MEMORY_MD" 2>/dev/null
    fi
  fi
fi

# --- Output 3: systemMessage (immediate injection) ---
BRIEF="Branch: ${BRANCH}"
[[ -n "$MODIFIED_FILES" ]] && BRIEF="$BRIEF | Files: $(echo "$MODIFIED_FILES" | head -c 80)"
[[ -n "$LEDGER_STATE" ]] && BRIEF="$BRIEF | $(echo "$LEDGER_STATE" | grep -oE '(Now|→).*' | head -1)"

# Escape for JSON
BRIEF_ESC=$(echo "$BRIEF" | /usr/bin/sed 's/"/\\"/g' | tr '\n' ' ' | head -c 200)

echo "{\"continue\":true,\"systemMessage\":\"[PreCompact] Working state saved. ${BRIEF_ESC}\"}"
```

#### 2. Enhance ledger.ts — add compact recovery
**File**: `dev-flow/mcp-server/src/continuity/ledger.ts`

```typescript
/**
 * Load the most recent compact checkpoint.
 * Called by SessionStart to restore context after compaction.
 */
export function loadCompactCheckpoint(): string | null {
  const cwd = getCwd();
  const checkpointPath = join(cwd, LEDGERS_DIR, '.compact-checkpoint.md');
  if (!existsSync(checkpointPath)) return null;
  const content = readFileSync(checkpointPath, 'utf-8');

  // Only return if recent (< 1 hour)
  try {
    const stat = statSync(checkpointPath);
    if (Date.now() - stat.mtime.getTime() > 3600_000) return null;
  } catch { return null; }

  return content;
}
```

#### 3. Remove legacy Node.js handler
**Delete**: `dev-flow/hooks/dist/pre-compact-continuity.mjs`
**Reason**: 逻辑已内联到 `pre-compact.sh` 中的 Node.js snippet (只保留 transcript parsing 核心逻辑，不再需要完整的 handoff 生成)

> 旧的 `pre-compact-continuity.mjs` 做了太多事（handoff 文件、ledger 追加、session summary），
> 现在拆分为：transcript parsing (inline Node.js) + checkpoint (bash) + MEMORY.md (bash)

#### 4. Create test script
**File**: `dev-flow/hooks/scripts/tests/test-pre-compact.sh`

```bash
#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Setup temp project
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/thoughts/ledgers"
printf "# Ledger\n## State\n- Now: [→] Phase 2 (implementing auth)\n## Open Questions\n- Which auth provider?" > "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md"
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Setup minimal MEMORY.md
ENCODED=$(echo "$TMPDIR" | /usr/bin/sed 's|/|-|g')
MEMORY_DIR="$HOME/.claude/projects/$ENCODED/memory"
mkdir -p "$MEMORY_DIR"
echo "# Memory\n\n## Key Patterns\n- Test" > "$MEMORY_DIR/MEMORY.md"

# Test 1: Basic PreCompact with trigger=auto
echo -n "Test 1: Basic auto compact... "
OUTPUT=$(echo "{\"trigger\":\"auto\",\"session_id\":\"test-123\",\"cwd\":\"$TMPDIR\"}" | \
  CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: no continue:true"; exit 1; }

CHECKPOINT="$TMPDIR/thoughts/ledgers/.compact-checkpoint.md"
[[ -f "$CHECKPOINT" ]] || { echo "FAIL: checkpoint not created"; exit 1; }
grep -q "Phase 2" "$CHECKPOINT" || { echo "FAIL: missing ledger state"; exit 1; }
grep -q "## Uncommitted Changes" "$CHECKPOINT" || { echo "FAIL: missing git state"; exit 1; }
echo "PASS"

# Test 2: MEMORY.md gets COMPACT-STATE markers
echo -n "Test 2: MEMORY.md updated... "
grep -q "COMPACT-STATE-START" "$MEMORY_DIR/MEMORY.md" || { echo "FAIL: no markers"; exit 1; }
grep -q "Working State" "$MEMORY_DIR/MEMORY.md" || { echo "FAIL: no working state"; exit 1; }
echo "PASS"

# Test 3: systemMessage contains branch info
echo -n "Test 3: systemMessage... "
echo "$OUTPUT" | jq -r '.systemMessage' | grep -q "Branch:" || { echo "FAIL: no branch in systemMessage"; exit 1; }
echo "PASS"

# Test 4: Custom instructions preserved
echo -n "Test 4: Custom instructions... "
OUTPUT2=$(echo "{\"trigger\":\"manual\",\"custom_instructions\":\"Focus on auth module\",\"cwd\":\"$TMPDIR\"}" | \
  CLAUDE_PROJECT_DIR="$TMPDIR" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
grep -q "Focus on auth module" "$TMPDIR/thoughts/ledgers/.compact-checkpoint.md" || { echo "FAIL: custom_instructions not saved"; exit 1; }
echo "PASS"

# Test 5: No ledger dir (graceful exit)
echo -n "Test 5: No ledger dir... "
OUTPUT3=$(echo '{"trigger":"auto"}' | CLAUDE_PROJECT_DIR="/tmp/nonexistent-$$" bash "$SCRIPT_DIR/pre-compact.sh" 2>/dev/null)
echo "$OUTPUT3" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL"; exit 1; }
echo "PASS"

echo ""
echo "ALL TESTS PASSED"
```

### Success Criteria:

#### Automated Verification:
- [ ] `bash dev-flow/hooks/scripts/tests/test-pre-compact.sh` — ALL TESTS PASSED (5 tests)
- [ ] `npm run --prefix dev-flow/mcp-server build` succeeds (ledger.ts compiles)
- [ ] Hook outputs valid JSON `{"continue":true,"systemMessage":"..."}` in all paths

#### Manual Verification:
- [ ] Trigger compaction (context > 70%) → checkpoint at `thoughts/ledgers/.compact-checkpoint.md`
- [ ] Compaction 后 Claude 立刻看到 `[PreCompact] Working state saved. Branch: ...`
- [ ] MEMORY.md 有 `<!-- COMPACT-STATE-START -->` 标记，含 branch + modified files + ledger state
- [ ] 有 `transcript_path` 时，checkpoint 包含 modified files 和 last context
- [ ] 无 `transcript_path` 时，降级为 filesystem-only (仍生成 checkpoint)
- [ ] `/compact "focus on auth"` → checkpoint 包含 "Focus on auth" user note

---

## Phase 3: Phase Checkpoint — Auto-Save on Task/Phase Complete

### Overview
利用 `TaskCompleted` hook，在每个 task 标记完成时自动更新 ledger 的 State。零人工操作。

> **研究确认** (code.claude.com/docs/en/hooks):
> TaskCompleted 输入 = 公共字段 + 事件专属字段：
> ```json
> {
>   "session_id": "abc123",
>   "transcript_path": "/path/to/session.jsonl",
>   "cwd": "/project/dir",
>   "permission_mode": "default",
>   "hook_event_name": "TaskCompleted",
>   "task_id": "task-001",
>   "task_subject": "Implement user authentication",
>   "task_description": "Add login and signup endpoints",
>   "teammate_name": "implementer",
>   "team_name": "my-project"
> }
> ```
>
> 决策控制: **Exit code only**。Exit 0 = 允许完成。Exit 2 = 阻止完成 (stderr 反馈给 Claude)。
> 不支持 JSON `decision` 字段。`systemMessage` 理论上可用但实际走 exit code。

### Changes Required:

#### 1. Create task-checkpoint.sh
**File**: `dev-flow/hooks/scripts/task-checkpoint.sh`

```bash
#!/bin/bash
set -o pipefail

INPUT=$(cat)
# TaskCompleted hook provides: task_id, task_subject, task_description, teammate_name
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // empty' 2>/dev/null)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // empty' 2>/dev/null)

# Graceful exit for empty input
[[ -z "$TASK_SUBJECT" ]] && { echo '{"continue":true}'; exit 0; }

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LEDGER_DIR="$project_dir/thoughts/ledgers"

[[ ! -d "$LEDGER_DIR" ]] && { echo '{"continue":true}'; exit 0; }

# Find active ledger (most recent CONTINUITY_CLAUDE-*.md)
LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
[[ -z "$LEDGER" || ! -f "$LEDGER" ]] && { echo '{"continue":true}'; exit 0; }

# Escape special characters for sed
SAFE_SUBJECT=$(echo "$TASK_SUBJECT" | /usr/bin/sed 's/[&/\]/\\&/g' | head -c 80)
TIMESTAMP=$(date -u +"%H:%M")

# Update State section: append completed task
if grep -q "## State" "$LEDGER" 2>/dev/null; then
  /usr/bin/sed -i '' "/## State/a\\
- Done: [x] ${SAFE_SUBJECT} (${TIMESTAMP})\\
" "$LEDGER" 2>/dev/null || true
fi

echo '{"continue":true}'
```

#### 2. Register in hooks.json
**File**: `dev-flow/hooks/hooks.json`

```json
"TaskCompleted": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/task-checkpoint.sh",
        "timeout": 5,
        "statusMessage": "Checkpointing task..."
      }
    ]
  }
]
```

#### 3. Create test script
**File**: `dev-flow/hooks/scripts/tests/test-task-checkpoint.sh`

```bash
#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Setup
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/thoughts/ledgers"
cat > "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md" << 'EOF'
# Task Ledger
## State
- Now: [→] Phase 1
## Open Questions
EOF
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Test 1: Valid TaskCompleted input
CLAUDE_PROJECT_DIR="$TMPDIR" echo '{"task_id":"1","task_subject":"Implement auth module"}' | bash "$SCRIPT_DIR/task-checkpoint.sh"
grep -q "Implement auth module" "$TMPDIR/thoughts/ledgers/CONTINUITY_CLAUDE-test.md" || { echo "FAIL: task not recorded in ledger"; exit 1; }
echo "PASS: Test 1 - task recorded in ledger State"

# Test 2: Empty input (graceful exit)
OUTPUT=$(echo '{}' | bash "$SCRIPT_DIR/task-checkpoint.sh")
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL: no continue:true"; exit 1; }
echo "PASS: Test 2 - empty input handled gracefully"

# Test 3: No ledger dir (graceful exit)
CLAUDE_PROJECT_DIR="/tmp/nonexistent-$$" echo '{"task_id":"1","task_subject":"test"}' | bash "$SCRIPT_DIR/task-checkpoint.sh"
echo "PASS: Test 3 - missing ledger dir handled"

echo "ALL TESTS PASSED"
```

### Success Criteria:

#### Automated Verification:
- [ ] `bash dev-flow/hooks/scripts/tests/test-task-checkpoint.sh` — ALL TESTS PASSED
- [ ] Hook outputs valid JSON `{"continue":true}` in all paths
- [ ] Hook exits 0 with all input variants (valid, empty, missing fields)

#### Manual Verification:
- [ ] 创建 task → complete task → 检查 ledger `## State` 新增 `Done: [x]` 行
- [ ] 无 ledger 时不报错，session 正常继续

---

## Phase 4: Post-Compact Recovery — SessionStart 加载 Checkpoint

### Overview
让 SessionStart 在 compaction 后自动恢复工作上下文。加载 Phase 2 生成的 `.compact-checkpoint.md` 并注入。

> **研究发现**: `dev-workflow.sh` 已自动记录 commit/PR 到 ledger。
> 原 Phase 4 "Streaming Ledger" 的 commit/PR 自动更新**已实现**。
> Phase 3 的 TaskCompleted 补齐了 task 完成记录。
> 本 Phase 聚焦于 compaction 后的上下文恢复（之前缺失的部分）。

### 已存在的 Ledger 自动更新

| 事件 | 脚本 | 状态 |
|------|------|------|
| Commit | `dev-workflow.sh` → `generate-reasoning.sh` | ✅ 已实现 |
| PR create | `dev-workflow.sh` → `ledger-manager.sh` | ✅ 已实现 |
| Task complete | `task-checkpoint.sh` (Phase 3) | 🆕 Phase 3 新增 |
| Compaction | `pre-compact.sh` (Phase 2) | 🆕 Phase 2 已重写 |
| **Compact recovery** | `session-start-continuity.sh` | ❌ **本 Phase 补齐** |

### Changes Required:

#### 1. Enhance session-start-continuity.sh — 加载 compact checkpoint
**File**: `dev-flow/hooks/scripts/session-start-continuity.sh`
**Changes**: 在现有 ledger 加载逻辑之后，检查并加载 compact checkpoint

```bash
# --- NEW: Load compact checkpoint if exists (Phase 4) ---
CHECKPOINT="$project_dir/thoughts/ledgers/.compact-checkpoint.md"
if [[ -f "$CHECKPOINT" ]]; then
  # Only load if recent (< 1 hour)
  CHECKPOINT_AGE=$(( $(date +%s) - $(stat -f%m "$CHECKPOINT" 2>/dev/null || echo "0") ))
  if [[ "$CHECKPOINT_AGE" -lt 3600 ]]; then
    CHECKPOINT_CONTENT=$(cat "$CHECKPOINT" | head -40)
    INJECT_LINES+=("📋 **Compact checkpoint loaded** ($(( CHECKPOINT_AGE / 60 )) min ago):")
    INJECT_LINES+=("$CHECKPOINT_CONTENT")
  fi
fi
```

> **注意**: `session-start-continuity.sh` 已有 `INJECT_LINES` 数组模式，追加即可。
> 不需要新文件或大改。约 10 行代码。

#### 2. Clean up COMPACT-STATE from MEMORY.md on SessionStart
**File**: `dev-flow/hooks/scripts/session-start-continuity.sh` (或 `memory-sync.sh`)
**Changes**: Session 启动时，如果 compact checkpoint 已过期(>1h)，清除 MEMORY.md 中的 COMPACT-STATE 区域

```bash
# --- Clean stale compact state from MEMORY.md ---
ENCODED_PATH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g')
MEMORY_MD="$HOME/.claude/projects/$ENCODED_PATH/memory/MEMORY.md"
if [[ -f "$MEMORY_MD" ]] && grep -q 'COMPACT-STATE-START' "$MEMORY_MD" 2>/dev/null; then
  if [[ ! -f "$CHECKPOINT" ]] || [[ "$CHECKPOINT_AGE" -ge 3600 ]]; then
    # Remove stale COMPACT-STATE section
    awk '
      /<!-- COMPACT-STATE-START -->/ { skip=1; next }
      /<!-- COMPACT-STATE-END -->/ { skip=0; next }
      !skip { print }
    ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
  fi
fi
```

#### 3. Add loadCompactCheckpoint() to ledger.ts (for MCP tool access)
**File**: `dev-flow/mcp-server/src/continuity/ledger.ts`

```typescript
/**
 * Load compact checkpoint for MCP tool queries.
 * Returns null if not found or stale (> 1 hour).
 */
export function loadCompactCheckpoint(): string | null {
  const cwd = getCwd();
  const checkpointPath = join(cwd, LEDGERS_DIR, '.compact-checkpoint.md');
  if (!existsSync(checkpointPath)) return null;

  try {
    const stat = statSync(checkpointPath);
    if (Date.now() - stat.mtime.getTime() > 3600_000) return null;
  } catch { return null; }

  return readFileSync(checkpointPath, 'utf-8');
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` succeeds
- [ ] `npm test --prefix dev-flow/mcp-server` passes

#### Manual Verification:
- [ ] Compact → new turn → 看到 "📋 Compact checkpoint loaded (X min ago)"
- [ ] Compact → 等 >1h → SessionStart 不注入 checkpoint，清除 MEMORY.md COMPACT-STATE
- [ ] 无 checkpoint 时 SessionStart 正常工作 (不报错)

---

## Phase 5: LLM Extract — Haiku-Powered Knowledge Extraction

### Overview
升级 session-summary.sh 的 Stop hook，在生成 summary 的同时提取结构化知识点。利用已有的 Haiku API 调用，增加知识提取 prompt。成本 ~$0.005/session。

> **研究确认** (code.claude.com/docs/en/hooks):
> Stop hook 输入字段 (7 个):
> ```json
> {
>   "session_id": "abc123",
>   "transcript_path": "/path/to/session.jsonl",
>   "cwd": "/project/dir",
>   "permission_mode": "default",
>   "hook_event_name": "Stop",
>   "stop_hook_active": true,
>   "last_assistant_message": "I've completed the refactoring..."
> }
> ```
>
> **BUG 发现**: `stop_hook_transcript` 字段**不存在**！
> session-summary.sh 第 14 行 `TRANSCRIPT=$(echo "$INPUT" | jq -r '.stop_hook_transcript // empty')` 永远为空。
> 正确的做法: 用 `last_assistant_message` (v2.1.47+) 或解析 `transcript_path` JSONL 文件。
>
> **安全**: `stop_hook_active` = true 时表示已在 Stop hook 续行中，需防止无限循环。

### Changes Required:

#### 1. Fix bugs + enhance session-summary.sh
**File**: `dev-flow/hooks/scripts/session-summary.sh`

**修复项**:
| 行 | Bug | 修复 |
|----|-----|------|
| 14 | `stop_hook_transcript` 不存在 | 删除，仅用 `last_assistant_message` + `transcript_path` |
| 86 | `max_tokens: 300` 不够 | 改为 `600` (含 knowledge_points) |
| — | 无 `stop_hook_active` 保护 | 加 guard 防止循环 |

**新增 `knowledge_points` 提取**:

```bash
# Fix: Remove non-existent field, use correct fields
LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty' 2>/dev/null)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)

# Guard: prevent infinite loop if Stop hook causes continuation
if [ "$STOP_ACTIVE" = "true" ]; then
  echo '{"continue":true}'
  exit 0
fi

# Build excerpt: prefer last_assistant_message, fallback to transcript_path
EXCERPT=""
if [ -n "$LAST_MSG" ]; then
  EXCERPT="${LAST_MSG: -3000}"
elif [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  # Read last 3000 chars of transcript JSONL
  EXCERPT=$(tail -c 4000 "$TRANSCRIPT_PATH" 2>/dev/null)
fi

# Enhanced prompt with knowledge extraction
PROMPT="Analyze this Claude Code session. Return ONLY valid JSON:
{
  \"request\": \"what the user asked for (1 sentence)\",
  \"completed\": \"what was accomplished (1 sentence)\",
  \"next_steps\": \"what should happen next (1 sentence)\",
  \"knowledge_points\": [
    {
      \"type\": \"pitfall|pattern|decision\",
      \"title\": \"concise title\",
      \"content\": \"problem + solution in 1-2 sentences\",
      \"platform\": \"ios|android|web|general\"
    }
  ]
}

Rules for knowledge_points:
- Only genuine insights worth remembering (bugs, workarounds, architecture decisions, API quirks)
- Skip routine operations. Return [] if nothing notable. Max 3.

Project: ${PROJECT}
Git changes: ${GIT_CHANGES}
Commits: ${RECENT_COMMITS}
Session: ${EXCERPT}"
```

**写入 knowledge_points 到 SQLite + Obsidian Vault**:

```bash
KNOWLEDGE=$(echo "$SUMMARY_TEXT" | jq -c '.knowledge_points // []' 2>/dev/null)
NUM_POINTS=$(echo "$KNOWLEDGE" | jq 'length' 2>/dev/null || echo "0")

if [ "$NUM_POINTS" -gt 0 ]; then
  KNOWLEDGE_DIR="$HOME/.claude/knowledge"
  for i in $(seq 0 $((NUM_POINTS - 1))); do
    KP_TYPE=$(echo "$KNOWLEDGE" | jq -r ".[$i].type" 2>/dev/null)
    KP_TITLE=$(echo "$KNOWLEDGE" | jq -r ".[$i].title" 2>/dev/null)
    KP_CONTENT=$(echo "$KNOWLEDGE" | jq -r ".[$i].content" 2>/dev/null)
    KP_PLATFORM=$(echo "$KNOWLEDGE" | jq -r ".[$i].platform // \"general\"" 2>/dev/null)

    # Map type to Obsidian subdirectory
    case "$KP_TYPE" in
      pitfall)  KP_DIR="$KNOWLEDGE_DIR/platforms/${KP_PLATFORM}" ;;
      pattern)  KP_DIR="$KNOWLEDGE_DIR/patterns" ;;
      decision) KP_DIR="$KNOWLEDGE_DIR/discoveries" ;;
      *)        KP_DIR="$KNOWLEDGE_DIR/discoveries" ;;
    esac
    mkdir -p "$KP_DIR" 2>/dev/null

    # Obsidian Vault file (if not exists)
    SAFE_TITLE=$(echo "$KP_TITLE" | /usr/bin/sed 's/[^a-zA-Z0-9 _-]//g' | head -c 60)
    KP_FILE="$KP_DIR/${SAFE_TITLE}.md"
    if [ ! -f "$KP_FILE" ]; then
      cat > "$KP_FILE" << KPEOF
---
type: ${KP_TYPE}
platform: ${KP_PLATFORM}
tags: [auto-extracted]
created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
---

# ${KP_TITLE}

## Problem
${KP_CONTENT}

## Solution
(Auto-extracted — review and enhance)
KPEOF
    fi

    # SQLite FTS5
    sqlite3 "$DB_PATH" "INSERT OR IGNORE INTO knowledge (id, type, title, content, platform, source, created_at, created_at_epoch)
      VALUES ('kp-$(date +%s)-$i', '$(esc "$KP_TYPE")', '$(esc "$KP_TITLE")', '$(esc "$KP_CONTENT")', '$(esc "$KP_PLATFORM")', 'auto-extract', '${NOW}', ${EPOCH});" 2>/dev/null
  done
fi
```

#### 2. Simplify memoryExtract() in memory.ts
**File**: `dev-flow/mcp-server/src/continuity/memory.ts`
**Changes**: 删除 regex scanner，`memoryExtract()` 仅从 `session_summaries.learned` 中提取 (批量补录)

```typescript
/**
 * Extract knowledge from recent session summaries (batch).
 * Called via dev_memory(action="extract") for retrospective processing.
 * Primary extraction already happens in session-summary.sh Stop hook.
 */
export function memoryExtract(): ConsolidationResult {
  const db = getDatabase();
  // Find summaries with non-empty 'learned' that don't have corresponding knowledge entries
  const unprocessed = db.prepare(`
    SELECT id, learned, project FROM session_summaries
    WHERE learned IS NOT NULL AND learned != ''
    AND id NOT IN (SELECT source FROM knowledge WHERE source LIKE 'summary-%')
    ORDER BY created_at_epoch DESC LIMIT 10
  `).all();

  if (unprocessed.length === 0) return { entries: 0, message: 'No new summaries to process' };

  // For each unprocessed summary, write to knowledge table
  let added = 0;
  for (const s of unprocessed) {
    db.prepare(`INSERT OR IGNORE INTO knowledge (id, type, title, content, platform, source, created_at, created_at_epoch)
      VALUES (?, 'discovery', ?, ?, 'general', ?, datetime('now'), unixepoch())`
    ).run(`summary-${s.id}`, `Session insight`, s.learned, `summary-${s.id}`);
    added++;
  }

  return { entries: added, message: `Extracted ${added} entries from session summaries` };
}
```

> **简化理由**: 主要知识提取在 Stop hook (Haiku) 中实时完成。
> `memoryExtract()` 仅作为批量补录工具，处理无 API key 时遗漏的 heuristic summaries。
> 不再需要复杂的 LLM 批处理逻辑。

#### 3. Create test script
**File**: `dev-flow/hooks/scripts/tests/test-session-summary.sh`

```bash
#!/bin/bash
set -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
mkdir -p "$TMPDIR/.claude/cache/artifact-index"
echo '{"memory":{"tier":1}}' > "$TMPDIR/.dev-flow.json"
git -C "$TMPDIR" init -q && git -C "$TMPDIR" commit --allow-empty -m "init" -q

# Test 1: Heuristic fallback (no API key)
echo -n "Test 1: Heuristic fallback... "
OUTPUT=$(echo "{\"cwd\":\"$TMPDIR\",\"session_id\":\"test-123\",\"last_assistant_message\":\"I completed the auth module\"}" | \
  ANTHROPIC_API_KEY="" DEV_FLOW_API_KEY="" bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

# Test 2: Tier 0 exits early
echo -n "Test 2: Tier 0 exits... "
echo '{"memory":{"tier":0}}' > "$TMPDIR/.dev-flow.json"
OUTPUT=$(echo "{\"cwd\":\"$TMPDIR\",\"session_id\":\"test-456\"}" | bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

# Test 3: stop_hook_active=true (loop guard)
echo -n "Test 3: Loop guard... "
echo '{"memory":{"tier":1}}' > "$TMPDIR/.dev-flow.json"
OUTPUT=$(echo "{\"cwd\":\"$TMPDIR\",\"session_id\":\"test-789\",\"stop_hook_active\":true}" | bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

# Test 4: Empty input
echo -n "Test 4: Empty input... "
OUTPUT=$(echo '{}' | bash "$SCRIPT_DIR/session-summary.sh" 2>/dev/null)
echo "$OUTPUT" | jq -e '.continue == true' > /dev/null || { echo "FAIL"; exit 1; }
echo "PASS"

echo ""
echo "ALL TESTS PASSED"
```

### Success Criteria:

#### Automated Verification:
- [ ] `bash dev-flow/hooks/scripts/tests/test-session-summary.sh` — ALL TESTS PASSED (4 tests)
- [ ] `npm test --prefix dev-flow/mcp-server -- --testPathPattern=memory` passes
- [ ] `stop_hook_active=true` 时立即退出 (防循环)
- [ ] Tier 0 config 时立即退出，不调用 API

#### Manual Verification:
- [ ] 有 API key: session stop → `sqlite3 .claude/cache/artifact-index/context.db "SELECT * FROM knowledge ORDER BY rowid DESC LIMIT 3"` 有 auto-extracted entries
- [ ] 有 API key: 检查 `~/.claude/knowledge/` 目录有新 .md 文件
- [ ] 无 API key: session stop → 仍正常生成 summary (heuristic)，无 knowledge extraction
- [ ] 日常无 bug session → `knowledge_points: []`，不产生垃圾文件

---

## Phase 6: Smart Dedup — FTS5-First + Optional LLM Escalation

### Overview
实现分层去重：FTS5 BM25 快速路径处理 70-80% 的去重判断，仅将模糊案例升级到 LLM。

> **研究发现** (sqlite.org/fts5.html + Mem0 架构分析):
>
> | 方法 | 能处理 | 不能处理 | 成本 |
> |------|--------|---------|------|
> | FTS5 BM25 | 词汇重复、共享关键词 | 语义等价 ("uses Swift" vs "iOS developer") |  $0 |
> | FTS5 + token overlap | 近义改写、共享词汇 | 完全不同词汇表达同一事实 | $0 |
> | LLM (Mem0 风格) | 所有，含上下文决策 | — | ~$0.003/call |
>
> **结论**: FTS5 + token overlap 可处理大部分去重，LLM 仅作为可选升级。
> 这意味着 **无 API key 也能去重**，不再是强制依赖。

### 去重决策流

```
新知识到来
    │
    ▼
[FTS5 BM25 查询: 提取关键词 → MATCH 查询]
    │
    ├── 无匹配 (0 results) ───────────────→ ADD (0 API calls)
    │
    ├── 强匹配 (BM25 score < -8.0)
    │       │
    │       ├── Token overlap > 0.7 ─────→ NOOP (0 API calls)
    │       │
    │       └── Token overlap 0.3-0.7 ──→ 有 API key? → LLM 决定
    │                                      无 API key? → ADD (保守)
    │
    └── 弱匹配 (score > -8.0) ───────────→ ADD (0 API calls)
```

### Changes Required:

#### 1. Add dedup functions to memory.ts
**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

```typescript
interface DedupResult {
  action: 'ADD' | 'UPDATE' | 'NOOP';
  targetId?: string;
  reason: string;
  method: 'fts5' | 'token-overlap' | 'llm';
}

/**
 * Extract key terms from text for FTS5 query.
 * Removes stop words, keeps nouns/verbs/adjectives.
 */
function extractKeyTerms(text: string): string[] {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been',
    'have','has','had','do','does','did','will','would','could','should',
    'and','or','but','in','on','at','to','for','of','with','by','from','as','it','this','that']);
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

/**
 * Calculate token overlap ratio between two texts.
 * Returns 0.0 (no overlap) to 1.0 (identical tokens).
 */
function tokenOverlap(textA: string, textB: string): number {
  const tokensA = new Set(extractKeyTerms(textA));
  const tokensB = new Set(extractKeyTerms(textB));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union; // Jaccard similarity
}

/**
 * FTS5-first dedup with optional LLM escalation.
 *
 * Layer 1: FTS5 BM25 query (always, $0)
 * Layer 2: Token overlap ratio (always, $0)
 * Layer 3: LLM compare (only ambiguous cases, ~$0.003)
 */
function smartDedup(
  newEntry: { type: string; title: string; content: string; platform: string },
  db: Database
): DedupResult {
  const keyTerms = extractKeyTerms(`${newEntry.title} ${newEntry.content}`);
  if (keyTerms.length === 0) {
    return { action: 'ADD', reason: 'No extractable terms', method: 'fts5' };
  }

  // Layer 1: FTS5 BM25 query
  const ftsQuery = keyTerms.slice(0, 8).join(' OR ');
  const candidates = db.prepare(`
    SELECT rowid, id, type, title, content, bm25(knowledge_fts) as score
    FROM knowledge_fts
    WHERE knowledge_fts MATCH ?
    ORDER BY bm25(knowledge_fts)
    LIMIT 5
  `).all(ftsQuery);

  if (candidates.length === 0) {
    return { action: 'ADD', reason: 'No FTS5 matches', method: 'fts5' };
  }

  // Layer 2: Token overlap on top candidates
  const newText = `${newEntry.title} ${newEntry.content}`;
  for (const candidate of candidates) {
    const existingText = `${candidate.title} ${candidate.content}`;
    const overlap = tokenOverlap(newText, existingText);

    if (overlap > 0.7) {
      return { action: 'NOOP', targetId: candidate.id, reason: `Token overlap ${(overlap*100).toFixed(0)}%`, method: 'token-overlap' };
    }

    if (overlap > 0.3) {
      // Layer 3: Ambiguous — try LLM if available
      const llmResult = llmCompare(newEntry, candidate);
      if (llmResult) return llmResult;
      // No API key → conservative ADD
      return { action: 'ADD', reason: `Overlap ${(overlap*100).toFixed(0)}%, no API key for disambiguation`, method: 'token-overlap' };
    }
  }

  return { action: 'ADD', reason: 'Low similarity to all candidates', method: 'fts5' };
}

/**
 * LLM comparison for ambiguous cases only.
 * Returns null if no API key or API failure (caller handles fallback).
 */
function llmCompare(
  newEntry: { type: string; title: string; content: string },
  existing: { id: string; type: string; title: string; content: string }
): DedupResult | null {
  const apiKey = process.env.DEV_FLOW_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.DEV_FLOW_API_URL || 'https://api.anthropic.com/v1/messages';
  const model = process.env.DEV_FLOW_MODEL || 'claude-haiku-4-5-20251001';
  const isAnthropic = apiUrl.includes('api.anthropic.com');

  const prompt = `Are these the same knowledge? Reply ONLY: SAME or DIFFERENT
A: [${newEntry.type}] ${newEntry.title}: ${newEntry.content}
B: [${existing.type}] ${existing.title}: ${existing.content}`;

  try {
    const authFlag = isAnthropic
      ? `-H "x-api-key: ${apiKey}" -H "anthropic-version: 2023-06-01"`
      : `-H "Authorization: Bearer ${apiKey}"`;

    const body = JSON.stringify({
      model, max_tokens: 10,
      messages: [{ role: 'user', content: prompt }]
    });

    const result = execSync(
      `/usr/bin/curl -s --max-time 5 "${apiUrl}" ${authFlag} -H "content-type: application/json" -d '${body.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', timeout: 8000 }
    );
    const text = (JSON.parse(result)?.content?.[0]?.text || '').trim().toUpperCase();

    if (text.includes('SAME')) {
      return { action: 'NOOP', targetId: existing.id, reason: 'LLM confirmed duplicate', method: 'llm' };
    }
    return { action: 'ADD', reason: 'LLM confirmed different', method: 'llm' };
  } catch {
    return null; // API failure → caller handles
  }
}
```

> **vs 原方案对比**:
> | 维度 | 原方案 (LLM-first) | 新方案 (FTS5-first) |
> |------|-------------------|-------------------|
> | API key 依赖 | 必需 (fallback 仅 title 匹配) | 可选 (FTS5 + token overlap 已覆盖 70-80%) |
> | 每次去重成本 | ~$0.003 | ~$0 (70-80%) / ~$0.001 (20-30%, max_tokens: 10) |
> | LLM prompt | 复杂 JSON (ADD/UPDATE/DELETE/NOOP) | 极简 SAME/DIFFERENT (10 tokens, 更可靠) |
> | 失败模式 | API 失败 → ADD 兜底 | FTS5 永不失败 + API 失败 → ADD 兜底 |

#### 2. Wire into memorySave()
**File**: `dev-flow/mcp-server/src/continuity/memory.ts`
**Changes**: `memorySave()` 调用 `smartDedup()` 前置

```typescript
function memorySave(text: string, title?: string, type?: string): SaveResult {
  // ... existing validation ...

  const dedupResult = smartDedup(
    { type: type || 'discovery', title: title || text.slice(0, 50), content: text, platform: 'general' },
    getDatabase()
  );

  if (dedupResult.action === 'NOOP') {
    return { saved: false, reason: `Duplicate: ${dedupResult.reason} (${dedupResult.method})` };
  }

  // ... existing write logic ...
}
```

#### 3. Unit tests
**File**: `dev-flow/mcp-server/src/continuity/memory.test.ts`

```typescript
describe('smartDedup', () => {
  // Uses in-memory SQLite for isolated testing

  it('returns ADD for completely new content (no FTS5 matches)', () => {
    const result = smartDedup(
      { type: 'pitfall', title: 'GraphQL N+1 problem', content: 'dataloader batching', platform: 'web' },
      testDb
    );
    expect(result.action).toBe('ADD');
    expect(result.method).toBe('fts5');
  });

  it('returns NOOP for high token overlap (>0.7)', () => {
    // Insert existing entry
    insertTestKnowledge(testDb, 'Swift async await concurrency issue with MainActor');
    const result = smartDedup(
      { type: 'pitfall', title: 'Swift async/await concurrency', content: 'MainActor issue with async', platform: 'ios' },
      testDb
    );
    expect(result.action).toBe('NOOP');
    expect(result.method).toBe('token-overlap');
  });

  it('returns ADD for low overlap even with some shared terms', () => {
    insertTestKnowledge(testDb, 'Swift protocol conformance checking');
    const result = smartDedup(
      { type: 'pattern', title: 'Swift error handling patterns', content: 'Result type and throwing functions', platform: 'ios' },
      testDb
    );
    expect(result.action).toBe('ADD');
  });
});

describe('tokenOverlap', () => {
  it('returns 1.0 for identical texts', () => {
    expect(tokenOverlap('hello world', 'hello world')).toBeCloseTo(1.0);
  });

  it('returns 0.0 for completely different texts', () => {
    expect(tokenOverlap('swift concurrency', 'python django')).toBeCloseTo(0.0);
  });

  it('handles empty strings', () => {
    expect(tokenOverlap('', 'hello')).toBe(0);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `npm test --prefix dev-flow/mcp-server -- --testPathPattern=memory` — dedup tests pass
- [ ] 无 API key 时: ADD/NOOP 正确判断 (FTS5 + token overlap)
- [ ] 高重叠 (>0.7) → NOOP，低重叠 → ADD，无需 API 调用
- [ ] `tokenOverlap()` 边界情况: 空字符串、相同文本、完全不同文本

#### Manual Verification:
- [ ] `dev_memory(action="save", text="Swift concurrency issue with MainActor")` → ADD
- [ ] 再次: `dev_memory(action="save", text="Swift async/await MainActor concurrency problem")` → NOOP (token overlap)
- [ ] 完全不同: `dev_memory(action="save", text="Python Django migration steps")` → ADD
- [ ] 有 API key + 模糊案例 → LLM 判定 SAME/DIFFERENT

---

## Phase 7: Bundle & E2E Smoke Test

### Overview
Bundle MCP server，创建 E2E smoke test 验证完整 pipeline。

### Changes Required:

#### 1. Bundle
```bash
npm run --prefix dev-flow/mcp-server bundle
```

#### 2. Create E2E smoke test
**File**: `dev-flow/hooks/scripts/tests/e2e-smoke.sh`

```bash
#!/bin/bash
set -o pipefail

echo "=== E2E Smoke Test ==="
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

# --- Test 1: Build succeeds ---
echo -n "Test 1: TypeScript build... "
npm run --prefix dev-flow/mcp-server build > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 2: Bundle succeeds ---
echo -n "Test 2: Bundle to CJS... "
npm run --prefix dev-flow/mcp-server bundle > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 3: Bundle file exists and is reasonable size ---
echo -n "Test 3: Bundle file valid... "
BUNDLE="dev-flow/scripts/mcp-server.cjs"
if [[ -f "$BUNDLE" ]] && [[ $(wc -c < "$BUNDLE") -gt 10000 ]]; then
  echo "PASS ($(wc -c < "$BUNDLE" | tr -d ' ') bytes)"
else
  echo "FAIL: bundle missing or too small"; FAIL=1
fi

# --- Test 4: No dead imports in bundle ---
echo -n "Test 4: No dead imports... "
if ! grep -q 'chromadb\|ChromaClient\|instincts\|product.brain' "$BUNDLE"; then
  echo "PASS"
else
  echo "FAIL: dead module references remain"; FAIL=1
fi

# --- Test 5: Unit tests pass ---
echo -n "Test 5: Unit tests... "
npm test --prefix dev-flow/mcp-server > /dev/null 2>&1 && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 6: All hook scripts exit 0 on empty input ---
echo -n "Test 6: Hook scripts sanity... "
HOOK_OK=1
for script in "$SCRIPT_DIR"/pre-compact.sh "$SCRIPT_DIR"/task-checkpoint.sh "$SCRIPT_DIR"/session-summary.sh; do
  [[ -f "$script" ]] || continue
  OUTPUT=$(echo '{}' | CLAUDE_PROJECT_DIR="/tmp" bash "$script" 2>/dev/null)
  echo "$OUTPUT" | jq -e '.continue == true' > /dev/null 2>&1 || { echo "FAIL: $(basename $script)"; HOOK_OK=0; break; }
done
[[ $HOOK_OK -eq 1 ]] && echo "PASS" || FAIL=1

# --- Test 7: No deleted module references in src ---
echo -n "Test 7: Clean imports... "
REFS=$(grep -r 'instincts\|embeddings\|product-brain' dev-flow/mcp-server/src/ --include='*.ts' -l 2>/dev/null | grep -v node_modules || true)
if [[ -z "$REFS" ]]; then
  echo "PASS"
else
  echo "FAIL: $REFS"; FAIL=1
fi

# --- Test 8: hooks.json is valid JSON ---
echo -n "Test 8: hooks.json valid... "
jq empty dev-flow/hooks/hooks.json 2>/dev/null && echo "PASS" || { echo "FAIL"; FAIL=1; }

# --- Test 9: No stop_hook_transcript references (bug fix) ---
echo -n "Test 9: No stop_hook_transcript... "
if ! grep -rq 'stop_hook_transcript' dev-flow/hooks/scripts/ 2>/dev/null; then
  echo "PASS"
else
  echo "FAIL: stop_hook_transcript reference found (non-existent field)"; FAIL=1
fi

# --- Test 10: session-summary.sh has stop_hook_active guard ---
echo -n "Test 10: Loop guard exists... "
if grep -q 'stop_hook_active' dev-flow/hooks/scripts/session-summary.sh 2>/dev/null; then
  echo "PASS"
else
  echo "FAIL: missing stop_hook_active guard"; FAIL=1
fi

# --- Summary ---
echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "=== ALL E2E TESTS PASSED (10/10) ==="
  exit 0
else
  echo "=== SOME TESTS FAILED ==="
  exit 1
fi
```

### Success Criteria:

#### Automated Verification:
- [ ] `bash dev-flow/hooks/scripts/tests/e2e-smoke.sh` — ALL E2E TESTS PASSED
- [ ] Bundle 无 chromadb/instincts/product-brain 引用
- [ ] 所有 hook 脚本对 empty input 返回 `{"continue":true}`

#### Manual Verification (end-to-end session test):
- [ ] **SessionStart**: 新 session → 检查 context 注入（pitfalls + last session）
- [ ] **Task flow**: `TaskCreate` → `TaskUpdate(completed)` → 检查 ledger State 更新
- [ ] **Compaction**: 触发 compact → 检查 `thoughts/ledgers/.compact-checkpoint.md` 存在
- [ ] **Session end**: `/exit` → 检查 `session_summaries` 表有新记录
- [ ] **Knowledge**: 有 API key 时检查 `knowledge` 表有新 LLM-extracted entries
- [ ] **Memory tools**: `dev_memory status` / `dev_memory save "test"` / `dev_memory search "test"` 正常工作

---

## Testing Strategy

### 三层验证体系

| Layer | 工具 | 何时运行 | 覆盖范围 |
|-------|------|---------|---------|
| **L1: Unit Tests** | vitest | 每个 Phase 完成后 | 函数级逻辑 |
| **L2: Hook Script Tests** | bash test scripts | 每个 Phase 完成后 | Hook I/O 正确性 |
| **L3: E2E Smoke** | e2e-smoke.sh | Phase 7 | 完整 pipeline |

### L1: Unit Tests (vitest)

| Test File | 测试项 | Phase |
|-----------|--------|-------|
| `memory.test.ts` | `smartDedup()` — ADD/NOOP via FTS5 + token overlap | 6 |
| `memory.test.ts` | `tokenOverlap()` — boundary cases (empty, identical, different) | 6 |
| `memory.test.ts` | `memorySearch()` — sync, no ChromaDB | 1 |
| `memory.test.ts` | `memorySave()` — with smartDedup gate | 6 |
| `memory.test.ts` | `memoryExtract()` — batch from session_summaries | 5 |
| `ledger.test.ts` | `loadCompactCheckpoint()` — fresh/stale/missing | 4 |

### L2: Hook Script Tests (bash)

| Test Script | 验证项 | Phase |
|-------------|--------|-------|
| `tests/test-pre-compact.sh` | Checkpoint 创建 + git state + ledger state 捕获 | 2 |
| `tests/test-task-checkpoint.sh` | Ledger State 更新 + 空输入处理 + 无 ledger 处理 | 3 |
| `tests/test-session-summary.sh` | Tier 0 退出 + 无 API key fallback + 空输入 | 5 |

**每个 test script 遵循 pattern**:
1. `mktemp -d` 创建隔离环境
2. `trap "rm -rf $TMPDIR" EXIT` 自动清理
3. 模拟最小 git repo + ledger
4. 喂入 JSON 输入，检查输出和副作用
5. 输出 PASS/FAIL per test case

### L3: E2E Smoke Test

`dev-flow/hooks/scripts/tests/e2e-smoke.sh` — 10 tests:
1. TypeScript build
2. Bundle succeeds
3. Bundle file valid
4. No dead imports (chromadb)
5. Unit tests pass
6. All hook scripts exit 0 on empty input
7. No deleted module references in src/
8. hooks.json valid JSON
9. No `stop_hook_transcript` references (non-existent field bug)
10. session-summary.sh has `stop_hook_active` loop guard

### Manual Testing Checklist (Phase 7 后)

在真实 Claude Code session 中执行：

```
[ ] 1. 启动新 session
    → StatusLine 显示正常
    → 无 hook error
    → 无 "stop_hook_transcript" 引用

[ ] 2. dev_memory(action="status")
    → 返回 totalEntries, byType, knowledgeDir
    → 无 chromadb/observations/instincts 字段

[ ] 3. dev_memory(action="save", text="Test knowledge entry", title="Test", type="pattern")
    → 返回 "Saved: Test"
    → sqlite3 检查 knowledge 表有新 entry

[ ] 4. dev_memory(action="save", text="Test knowledge entry about same topic", title="Test", type="pattern")  (重复)
    → 返回 NOOP + "Token overlap XX%" (FTS5 去重)
    → knowledge 表无新增

[ ] 5. dev_memory(action="search", query="test")
    → 返回 Test entry

[ ] 6. TaskCreate → TaskUpdate(completed)
    → 有 ledger: ## State 新增 Done 行
    → 无 ledger: 无报错

[ ] 7. 手动 /compact 或等待 context > 70%
    → thoughts/ledgers/.compact-checkpoint.md 存在
    → 包含 git state + ledger state + modified files (from transcript)
    → MEMORY.md 有 <!-- COMPACT-STATE-START --> 区域
    → Claude 下一个 turn 收到 "[PreCompact] Working state saved. Branch: ..."

[ ] 8. Compact 后继续对话
    → MEMORY.md Working State 区域可见
    → SessionStart 注入 "📋 Compact checkpoint loaded (X min ago)"

[ ] 9. /exit
    → session_summaries 表有新记录
    → 有 API key: knowledge 表可能有新 auto-extracted entries
    → MEMORY.md Last Session 区域更新
    → 无 "stop_hook_active" 循环 (正常退出)

[ ] 10. 新 session 启动 (>1h 后)
    → MEMORY.md 中 COMPACT-STATE 区域被清除 (stale cleanup)
    → Last Session 区域保留
```

### API Key 测试矩阵

| 场景 | Phase 5 (Extract) | Phase 6 (Dedup) | Phase 2 (PreCompact) | 预期 |
|------|----|----|----|----|
| 有 API key | Haiku 提取 knowledge_points | FTS5 快速 → LLM 升级 | transcript parse | 完整功能 |
| 无 API key | Heuristic fallback (git-based) | FTS5 + token overlap only | transcript parse | 降级但可用 |
| API 超时 | Heuristic fallback | FTS5 fast-path (不调 LLM) | transcript parse | 不崩溃 |
| 无效 API key | Heuristic fallback | FTS5 fast-path | transcript parse | 不崩溃 |

> **关键改进**: Phase 2 (PreCompact) 和 Phase 6 (Dedup) **完全不依赖 API key**。
> 只有 Phase 5 (LLM Extract) 在无 API key 时降级。

## Performance Considerations

| Operation | Cost | Latency |
|-----------|------|---------|
| Session Summary + Knowledge Extract (Haiku, same call) | ~$0.005 | ~2s |
| Smart Dedup: FTS5 fast-path (70-80% of cases) | $0 | ~10ms |
| Smart Dedup: LLM escalation (20-30%, max_tokens:10) | ~$0.001 | ~1s |
| PreCompact: transcript parse + checkpoint + MEMORY.md | $0 | ~1s |
| Phase checkpoint (TaskCompleted) | $0 | ~0.2s |
| Post-compact recovery (SessionStart) | $0 | ~0.5s |

**Total per session**: ~$0.005-$0.008 (vs previous Tier 3: ~$0.005 for garbage)
**无 API key**: $0 per session (heuristic summary + FTS5 dedup, 功能降级但不崩溃)

## Migration Notes

### Breaking Changes
- `dev_instinct` tool removed — 无外部依赖
- `dev_product` tool removed — 无外部依赖
- `observations` table deprecated — 不删表结构（向后兼容），只停止写入
- `memory.tier` config: values 2/3 treated as 1 (graceful degradation)

### Backward Compatibility
- `.dev-flow.json` with `"tier": 3` still works, treated as tier 1
- `dev_memory` API unchanged (save/search/query/get/list/status/consolidate)
- `memorySearchAsync()` removed, `memorySearch()` is sync fallback
- Existing knowledge entries preserved, new ones go through FTS5 dedup (then optional LLM)
- `session-summary.sh` 修复 `stop_hook_transcript` bug (之前永远为空，不影响功能但浪费了变量)

### Bug Fixes (发现于研究阶段)
| Bug | 位置 | 影响 | 修复 Phase |
|-----|------|------|-----------|
| `stop_hook_transcript` 不存在 | session-summary.sh:14 | EXCERPT 变量可能为空，降级到 heuristic | Phase 5 |
| 无 `stop_hook_active` 保护 | session-summary.sh | 若 Stop hook 导致续行，可能无限循环 | Phase 5 |
| `pre-compact-continuity.mjs` 调用失败 | pre-compact.sh:35 | dist/ 文件可能不存在，静默失败 | Phase 2 |
| `compaction_type` 字段名错误 | (plan 中) | 正确名为 `trigger` | Phase 2 |

## References

- Brainstorm #1: Knowledge layer architecture (Mem0, Letta, A-Mem research)
- Brainstorm #2: Continuity layer (Hopping Context Windows, LangGraph Durable Execution)
- Cleanup commit: `028f7d4` (garbage data cleanup, format fixes)
- Plan: `thoughts/shared/plans/2026-02-09-memory-system-evolution.md` (original plan, superseded)
