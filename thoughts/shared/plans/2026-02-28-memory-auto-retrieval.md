---
title: Memory Auto-Retrieval & Temporal Decay
version: 2.0
status: approved
created: 2026-02-28
depends_on: 2026-02-28-memory-continuity-redesign
---

# Memory Auto-Retrieval & Temporal Decay

Based on brainstorm analysis of @karry_viber's criticisms and OpenClaw research.

## Problem

1. **Topic files don't auto-load** — `~/.claude/knowledge/` entries only surface when agent explicitly calls `dev_memory search`
2. **No temporal decay** — old knowledge ranks same as recent; stale entries never expire
3. **No per-prompt relevance** — SessionStart injects once; mid-session topic shifts get no knowledge

## Solution: 3 Phases

### Phase 1: UserPromptSubmit Auto-Retrieval Hook
**Files**: `hooks/scripts/prompt-knowledge.sh`, `hooks/hooks.json`
- New UserPromptSubmit hook extracts keywords from user prompt
- FTS5 query against knowledge + session_summaries tables
- Injects top-3 results into `additionalContext` (budget: 600 chars)
- Frequency guard: skip if last injection < 3 prompts ago
- Cost: $0, latency: <50ms

### Phase 2: Temporal Decay in Knowledge Table
**Files**: `mcp-server/src/continuity/memory.ts`
- Add `access_count INTEGER DEFAULT 0` and `last_accessed TEXT` columns
- FTS5 queries apply decay: `rank * (1 / (1 + days_since_access/30))` scoring
- Touch `last_accessed` on every retrieval (prompt hook + manual search)
- memorySearch returns decay-weighted results

### Phase 3: TTL Pruning + Lazy Consolidation
**Files**: `hooks/scripts/session-start-continuity.sh`, `mcp-server/src/continuity/memory.ts`
- SessionStart: prune knowledge entries with `access_count = 0` and `created_at > 90 days`
- Frequency guard: max once per 7 days
- Export `memoryPrune()` function for manual use via `dev_memory prune`

## Verification

```bash
# Phase 1: Hook test
echo '{"prompt":"SwiftUI navigation","session_id":"test"}' | hooks/scripts/prompt-knowledge.sh

# Phase 2: Unit test
npm test --prefix mcp-server -- --grep "temporal decay"

# Phase 3: Prune test
npm test --prefix mcp-server -- --grep "prune"
```

## Dependencies

- Phase 2 depends on Phase 1 (shared FTS5 query pattern)
- Phase 3 depends on Phase 2 (uses access_count column)
