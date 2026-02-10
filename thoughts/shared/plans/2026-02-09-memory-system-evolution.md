---
plan_version: "2.0"
status: completed
created: 2026-02-09
phases:
  - id: 1
    name: "Tier 0: Zero-Cost Architecture"
    complexity: medium
    model: sonnet
    parallelizable: false
    depends_on: []
    target_files:
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/mcp-server/src/index.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 2
    name: "Tier 1: Haiku Session Summary"
    complexity: high
    model: opus
    parallelizable: false
    depends_on: [1]
    target_files:
      - "dev-flow/hooks/hooks.json"
      - "dev-flow/hooks/session-summary.sh"
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/mcp-server/src/continuity/context-injector.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 3
    name: "Tier 2: ChromaDB Semantic Search"
    complexity: high
    model: opus
    parallelizable: false
    depends_on: [2]
    target_files:
      - "dev-flow/mcp-server/src/continuity/embeddings.ts"
      - "dev-flow/mcp-server/src/continuity/memory.ts"
      - "dev-flow/.mcp.json"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
  - id: 4
    name: "Tier 3: Periodic Observation Capture"
    complexity: high
    model: opus
    parallelizable: false
    depends_on: [2]
    target_files:
      - "dev-flow/hooks/hooks.json"
      - "dev-flow/hooks/observe-batch.sh"
      - "dev-flow/mcp-server/src/continuity/observer.ts"
    verify: ["npm run --prefix dev-flow/mcp-server build"]
key_decisions:
  progressive_tiers: "Each tier is independently deployable and opt-in via .dev-flow.json config"
  chromadb_justification: "Dramatically improves 'how did we solve similar problems' use case. FTS5 porter stemmer gets 80% quality, ChromaDB gets 95%+ for conceptual matching"
  haiku_for_summary: "Best cost/quality ratio: $0.41/month for semantic session summaries"
  no_worker_process: "Unlike claude-mem, we avoid persistent worker. Use direct API calls in hooks"
---

# Memory System Evolution — Progressive Enhancement Plan

## Overview

将 dev-flow 的 memory 系统从"零成本关键词搜索"渐进式演进到"语义搜索 + 自动总结 + 向量检索"。每个 Tier 独立可用，通过 `.dev-flow.json` 配置启用/禁用。

**核心原则**：渐进式加载 — 低 Tier 始终可用，高 Tier 按需启用。

## Current State Analysis

| 能力 | 当前状态 | 目标 |
|------|---------|------|
| 数据采集 | 仅 commit/handoff/ledger | + session summary + ad-hoc + periodic observations |
| 搜索 | FTS5 关键词 | + 向量语义搜索 |
| 注入 | SessionStart (500 token budget) | + 上次 session 摘要 + 渐进式上下文 |
| 上下文占用 | 全量返回 | 3-layer 分层 (index → timeline → detail) |
| 工具 | `dev_memory(query/consolidate/list/status/extract)` | + save, timeline, get_entries |

## Key Discoveries

- claude-mem 的 3-layer search 节省 10x token（`mcp-server.ts:157-261`）
- claude-mem 每个 observation 经 LLM 分类，成本极高，dev-flow 应避免全量 LLM 处理
- FTS5 porter tokenizer 已在用（`memory.ts:114`），但缺少 synonym expansion
- 当前 `dev_memory(query)` 直接返回完整 knowledge entry，无分层
- SessionStart 已有 knowledge injection（`context-injector.ts:170`），可扩展注入 session summary

## What We're NOT Doing

- 不引入持久 worker 进程（claude-mem 的 Bun HTTP server 模式）
- 不对所有 tool use 做 LLM 分类（claude-mem 的 PostToolUse * 模式）
- 不替换现有 FTS5（ChromaDB 是补充，不是替代）
- 不改变现有 knowledge 文件结构（`~/.claude/knowledge/`）

## Implementation Approach

```
Tier 0 (0 tokens)   → 架构改进：save_memory, 3-layer search, better FTS5
Tier 1 (~1.8K/sess) → Haiku session summary + SessionStart 注入
Tier 2 (~4.3K/sess) → ChromaDB 向量搜索 + hybrid 检索
Tier 3 (~15K/sess)  → Periodic observation capture (opt-in)
```

每个 Tier 通过 `.dev-flow.json` 配置：

```json
{
  "memory": {
    "tier": 2,
    "sessionSummary": true,
    "chromadb": true,
    "periodicCapture": false
  }
}
```

## Cost Analysis

| Tier | Tokens/Session | USD/Month (600 sess) | Quality vs Current | ROI |
|------|---------------|---------------------|-------------------|-----|
| 0 | 0 | $0.00 | +50% (architecture) | Infinite |
| 1 | 1,750 | $0.41 | +80% (semantic summary) | High |
| 2 | +2,500 | +$0.15 | +95% (vector search) | High |
| 3 | +10.5K-17.5K | +$2.48-4.12 | +100% (full capture) | Medium |

---

## Phase 1: Tier 0 — Zero-Cost Architecture (0 tokens)

### Overview

纯架构改进，不引入 LLM 调用。实现 save_memory、3-layer search pattern、FTS5 增强。

### Changes Required

#### 1. `dev_memory` 新增 actions

**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

新增 3 个 action：

```typescript
// action: 'save' — Ad-hoc memory storage
export function memorySave(text: string, title?: string, tags?: string[], type?: string): { id: string; message: string } {
  ensureDbSchema();
  const project = getProjectName();
  const platform = detectCurrentPlatform();
  const autoTitle = title || text.slice(0, 60).replace(/\n/g, ' ');
  const entry: KnowledgeEntry = {
    id: generateId(type || 'discovery', autoTitle),
    type: (type as any) || 'decision',
    platform,
    title: autoTitle,
    problem: text,
    solution: tags?.join(', ') || '',
    sourceProject: project,
    sourceSession: 'manual',
    createdAt: new Date().toISOString(),
    filePath: '',
  };
  writeKnowledgeEntry(entry);
  dbInsertKnowledge(entry);
  return { id: entry.id, message: `Saved: ${autoTitle}` };
}

// action: 'search' — 3-layer: returns index only (IDs + titles)
export function memorySearch(query: string, limit?: number, type?: string): Array<{
  id: string; type: string; title: string; platform: string; createdAt: string;
}> {
  ensureDbSchema();
  // Return lightweight index: id + title + type + date
  // ~50 tokens per result instead of ~300 tokens for full entry
}

// action: 'get' — Fetch full details for specific IDs
export function memoryGet(ids: string[]): KnowledgeEntry[] {
  ensureDbSchema();
  // Fetch full entries by IDs — only after user has filtered via search
}
```

#### 2. FTS5 增强

**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

在 `ensureDbSchema()` 中增加 synonym expansion table：

```sql
-- Synonym table for FTS5 query expansion
CREATE TABLE IF NOT EXISTS synonyms (
  term TEXT PRIMARY KEY,
  expansions TEXT NOT NULL  -- JSON array
);

-- Pre-populate common synonyms
INSERT OR IGNORE INTO synonyms VALUES
  ('concurrency', '["thread","race condition","async","await","actor","sendable"]'),
  ('auth', '["authentication","authorization","jwt","token","login","session"]'),
  ('crash', '["crash","fatal","exception","abort","signal"]'),
  ('performance', '["performance","slow","latency","memory leak","cpu","optimize"]');
```

查询时自动展开：
```typescript
function expandQuery(query: string): string {
  // Look up synonyms table, expand "auth" → "auth OR authentication OR jwt OR token"
  const terms = query.split(/\s+/);
  const expanded = terms.map(term => {
    const synonyms = lookupSynonyms(term);
    return synonyms ? `(${term} OR ${synonyms.join(' OR ')})` : term;
  });
  return expanded.join(' ');
}
```

#### 3. MCP Tool Schema 更新

**File**: `dev-flow/mcp-server/src/index.ts`

更新 `dev_memory` tool 的 action enum：

```
actions: consolidate | status | query | list | extract | save | search | get
```

新增参数：
- `save`: `text` (required), `title`, `tags[]`, `type`
- `search`: `query`, `limit`, `type` — returns index only
- `get`: `ids[]` — returns full entries

### Success Criteria

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] `dev_memory(action:'save', text:'test')` creates entry in DB + file
- [ ] `dev_memory(action:'search', query:'test')` returns lightweight index
- [ ] `dev_memory(action:'get', ids:['...'])` returns full entries
- [ ] FTS5 synonym expansion: `query='auth'` matches entries containing 'jwt'

#### Manual Verification:
- [ ] 3-layer search 输出 < 100 tokens per result (vs 当前 ~300)
- [ ] save_memory 的 entry 能被后续 search 找到

---

## Phase 2: Tier 1 — Haiku Session Summary (~1,750 tokens/session)

### Overview

Stop hook 结束时调用 Haiku 生成 session summary，写入 knowledge DB。SessionStart 注入上次 summary。

**成本**: $0.41/month (600 sessions)

### Changes Required

#### 1. Stop Hook — Session Summary

**File**: `dev-flow/hooks/hooks.json`

在 Stop hooks 中新增 summary 脚本：

```json
{
  "hooks": [{
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/hooks/session-summary.sh"
  }]
}
```

**File**: `dev-flow/hooks/session-summary.sh` (新建)

```bash
#!/bin/bash
set -o pipefail

# Read hook input from stdin
INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)

# Check tier config
TIER=$(jq -r '.memory.tier // 0' "$CWD/.dev-flow.json" 2>/dev/null || echo "0")
if [ "$TIER" -lt 1 ]; then
  echo '{"continue":true}'
  exit 0
fi

# Extract last 2000 chars of transcript (assistant messages only)
# ... (transcript parsing, similar to claude-mem's extractLastMessage)

# Call Haiku via Anthropic API
SUMMARY=$(curl -s https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d "{
    \"model\": \"claude-haiku-4-5-20251001\",
    \"max_tokens\": 300,
    \"messages\": [{
      \"role\": \"user\",
      \"content\": \"Summarize this Claude Code session in JSON: {request, investigated, learned, completed, next_steps}. Be concise (1-2 sentences per field).\n\nTranscript excerpt:\n$EXCERPT\"
    }]
  }" | jq -r '.content[0].text')

# Write to knowledge DB via MCP tool (dev_memory save)
# Or directly via sqlite3 CLI
```

**关键设计决策**：
- Hook 中直接调用 Anthropic API（不经 MCP server）避免循环依赖
- 需要 `ANTHROPIC_API_KEY` 环境变量
- 超时 10s，失败静默（不阻塞 session 结束）
- 仅在 `memory.tier >= 1` 时执行

#### 2. Session Summary DB Schema

**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

在 `ensureDbSchema()` 中新增：

```sql
CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project TEXT NOT NULL,
  request TEXT,
  investigated TEXT,
  learned TEXT,
  completed TEXT,
  next_steps TEXT,
  files_modified TEXT,  -- JSON array from git diff
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_project ON session_summaries(project);
CREATE INDEX IF NOT EXISTS idx_session_summaries_epoch ON session_summaries(created_at_epoch DESC);

-- FTS5 for session summaries
CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  request, investigated, learned, completed, next_steps,
  content=session_summaries, content_rowid=rowid,
  tokenize='porter unicode61'
);
```

#### 3. SessionStart 注入上次 Summary

**File**: `dev-flow/mcp-server/src/continuity/context-injector.ts`

在 `injectKnowledgeContext()` 中增加 session summary section：

```typescript
// Budget allocation update:
const BUDGET_TOTAL = 2500;     // from 2000 → 2500
const BUDGET_PITFALLS = 600;   // from 800 → 600 (make room)
const BUDGET_TASK = 500;       // from 600 → 500
const BUDGET_RECENT = 400;     // from 600 → 400
const BUDGET_LAST_SESSION = 500; // NEW

function loadLastSessionSummary(project: string, maxChars: number): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) return '';

  const sql = `SELECT request, completed, next_steps FROM session_summaries
    WHERE project = '${esc(project)}'
    ORDER BY created_at_epoch DESC LIMIT 1;`;

  // ... execute and format
  // Output: "### Last Session\n**Request**: ...\n**Completed**: ...\n**Next**: ..."
}
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] Stop hook generates summary and writes to DB
- [ ] SessionStart 注入包含 "Last Session" section
- [ ] Summary < 300 tokens

#### Manual Verification:
- [ ] Session 结束后，下次 SessionStart 能看到上次做了什么
- [ ] Haiku API 调用 < 3s latency
- [ ] 失败时静默退出，不影响 session

---

## Phase 3: Tier 2 — ChromaDB Semantic Search (~2,500 tokens/session)

### Overview

引入 ChromaDB 向量搜索，实现 hybrid 检索（FTS5 关键词 + ChromaDB 语义）。

**成本**: 额外 $0.15/month (Voyage embeddings) 或 $0 (local model)

**为什么需要 ChromaDB**：
- FTS5 只能匹配词面："concurrency issues" 找不到 "race condition"（即使有 synonym table 也只是手动维护的有限集）
- ChromaDB 向量搜索："concurrency" 自动关联到 "thread safety", "actor isolation", "data race"
- 对于 "上次怎么解决类似问题" 这个核心用例，语义搜索质量远高于关键词
- 用户已确认可接受 ChromaDB 依赖

### Changes Required

#### 1. ChromaDB 集成模块

**File**: `dev-flow/mcp-server/src/continuity/embeddings.ts` (新建)

```typescript
/**
 * Embeddings module — optional ChromaDB integration for semantic search
 *
 * Design:
 * - Lazy initialization: only start ChromaDB when first query/insert
 * - Graceful degradation: if ChromaDB unavailable, fall back to FTS5
 * - Embedding source: Voyage API or local model (configurable)
 *
 * Dependencies:
 * - chromadb (npm package, ~2MB)
 * - For Voyage API: VOYAGE_API_KEY env var
 * - For local: @xenova/transformers (optional)
 */

interface EmbeddingConfig {
  provider: 'voyage' | 'local' | 'none';
  collectionName: string;
}

export class SemanticSearch {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;

  async initialize(config: EmbeddingConfig): Promise<boolean> {
    // Lazy init — called on first search/insert
    // Returns false if ChromaDB not available → caller falls back to FTS5
  }

  async addEntry(id: string, text: string, metadata: Record<string, any>): Promise<void> {
    // Generate embedding + insert into collection
    // Called from memorySave, memoryConsolidate, session summary write
  }

  async search(query: string, limit: number = 10, filter?: Record<string, any>): Promise<Array<{
    id: string; distance: number; metadata: any;
  }>> {
    // Semantic search → return IDs + distances
    // Caller hydrates full entries from SQLite
  }
}
```

#### 2. Hybrid Search in dev_memory

**File**: `dev-flow/mcp-server/src/continuity/memory.ts`

更新 `memoryQuery` 和新 `memorySearch` 使用 hybrid 策略：

```typescript
export async function memorySearch(query: string, limit?: number, type?: string): Promise<SearchIndex[]> {
  const tier = getMemoryTier();

  if (tier >= 2 && semanticSearch.isAvailable()) {
    // Hybrid: ChromaDB semantic + FTS5 keyword
    const [semanticResults, ftsResults] = await Promise.all([
      semanticSearch.search(query, limit),
      dbQueryKnowledgeIndex(expandQuery(query), limit),
    ]);
    return mergeAndRank(semanticResults, ftsResults);
  }

  // Tier 0-1: FTS5 only
  return dbQueryKnowledgeIndex(expandQuery(query), limit);
}
```

#### 3. 写入时同步 ChromaDB

所有写入路径（consolidate, save, session summary）增加 ChromaDB sync：

```typescript
// In memorySave, memoryConsolidate, writeSessionSummary:
if (getMemoryTier() >= 2) {
  await semanticSearch.addEntry(entry.id, `${entry.title} ${entry.problem} ${entry.solution}`, {
    type: entry.type,
    platform: entry.platform,
    project: entry.sourceProject,
    created_at: entry.createdAt,
  });
}
```

### ChromaDB 部署方案

```
选项 A: In-process ChromaDB (推荐)
- npm install chromadb
- 使用 SQLite backend (chromadb 内置)
- DB 文件: .claude/cache/chroma/
- 零额外进程，零端口占用

选项 B: External ChromaDB server
- 适合已有 ChromaDB 的用户
- 配置: .dev-flow.json → memory.chromaUrl
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] `dev_memory(action:'search', query:'race condition')` 找到包含 "concurrency" 的 entries
- [ ] ChromaDB 不可用时自动 fallback 到 FTS5

#### Manual Verification:
- [ ] 语义搜索质量：概念匹配 > 关键词匹配
- [ ] 首次初始化 < 5s
- [ ] 搜索延迟 < 500ms

---

## Phase 4: Tier 3 — Periodic Observation Capture (~15K tokens/session, opt-in)

### Overview

每 N 次 tool 调用后，批量分类最近的活动为结构化 observation。仅在 `memory.tier >= 3` 时启用。

**成本**: $2.48-4.12/month — 适用于长 session 密集型开发者

### Changes Required

#### 1. PostToolUse Hook — Batch Observer

**File**: `dev-flow/hooks/hooks.json`

新增 PostToolUse hook（matcher: `*`，但内部检查 tier 和 counter）：

```json
{
  "matcher": "*",
  "hooks": [{
    "type": "command",
    "command": "${CLAUDE_PLUGIN_ROOT}/hooks/observe-batch.sh"
  }]
}
```

**File**: `dev-flow/hooks/observe-batch.sh` (新建)

```bash
#!/bin/bash
# Only trigger every 10 tool uses, only if tier >= 3
COUNTER_FILE="/tmp/devflow-observe-counter-$SESSION_ID"
COUNT=$(($(cat "$COUNTER_FILE" 2>/dev/null || echo 0) + 1))
echo "$COUNT" > "$COUNTER_FILE"

if [ "$COUNT" -lt 10 ]; then
  echo '{"continue":true}'
  exit 0
fi

# Reset counter
echo "0" > "$COUNTER_FILE"

# Collect last 10 tool uses from transcript
# ... extract tool_name + file paths + summarized outputs

# Call Haiku for batch classification
# Output: structured observations (type, title, concepts, files)
```

#### 2. Observation DB Schema

```sql
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  project TEXT NOT NULL,
  type TEXT NOT NULL,  -- decision, bugfix, feature, refactor, discovery
  title TEXT NOT NULL,
  concepts TEXT,       -- JSON array: ["auth", "jwt", "middleware"]
  files_modified TEXT, -- JSON array
  narrative TEXT,      -- Brief description of what happened
  prompt_number INTEGER,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL
);
```

### Success Criteria

#### Automated Verification:
- [ ] `npm run --prefix dev-flow/mcp-server build` passes
- [ ] Hook fires every 10 tool uses when tier=3
- [ ] Observations written to DB with structured fields

#### Manual Verification:
- [ ] 长 session (50+ tool uses) 产生 3-5 个 observations
- [ ] Observations 能被 search 和 timeline 找到
- [ ] 不启用 tier 3 时，hook < 10ms (counter check only)

---

## Configuration Schema

`.dev-flow.json` 新增 `memory` 字段：

```json
{
  "memory": {
    "tier": 1,                      // 0=arch only, 1=summary, 2=semantic, 3=full
    "sessionSummary": true,         // Tier 1+: Haiku summary on Stop
    "chromadb": false,              // Tier 2+: ChromaDB semantic search
    "chromaProvider": "voyage",     // "voyage" | "local" | "none"
    "periodicCapture": false,       // Tier 3+: Batch observation every N tools
    "captureInterval": 10,          // Tool uses between captures
    "synonymsPath": null            // Custom synonyms file (optional)
  }
}
```

默认 tier: 0（零成本，纯架构改进）

## Migration Notes

- Tier 0 对现有 knowledge 完全向后兼容
- 新增 `session_summaries` 和 `observations` 表，不修改现有 `knowledge` 表
- ChromaDB 数据可重建（从 SQLite knowledge 表同步）
- 所有 tier 支持降级：关闭配置即回退

## Testing Strategy

### Unit Tests:
- FTS5 synonym expansion 查询
- 3-layer search 输出格式 (index vs full)
- Session summary JSON 解析

### Integration Tests:
- Stop hook → Haiku API → DB write → SessionStart inject
- ChromaDB write → search → hydrate from SQLite

### Manual Testing:
1. 设置 tier=0 → 验证 save_memory + search + get 三步工作流
2. 设置 tier=1 → session 结束后检查 DB 有 summary → 新 session 有注入
3. 设置 tier=2 → "race condition" 搜索找到 "concurrency" entries
4. 设置 tier=3 → 50 次 tool use 后检查 observations

## References

- claude-mem source: `/tmp/claude-mem/` (cloned for analysis)
- claude-mem 3-layer search: `src/servers/mcp-server.ts:157-261`
- claude-mem observation model: `src/types/database.ts:64-77`
- dev-flow memory: `dev-flow/mcp-server/src/continuity/memory.ts`
- dev-flow context-injector: `dev-flow/mcp-server/src/continuity/context-injector.ts`
