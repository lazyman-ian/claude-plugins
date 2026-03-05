# Brainstorm: Real-Time Collaboration & Shared Context for Agent-Team System

**Date**: 2026-03-06
**Feature**: Shared state / real-time context for multi-agent collaboration
**Status**: Design exploration complete — decision recorded

---

## Problem Statement

Current agents communicate exclusively via `SendMessage` (fire-and-forget) and `dev_handoff` (post-completion documents). There is no shared live state — each agent holds an isolated context snapshot from spawn time. This creates three failure modes observed in production:

1. **Stale assumption drift** — Agent A changes `src/auth/guard.ts`; Agent B has no awareness and writes code that assumes the old auth shape.
2. **Duplicate work** — Two agents both discover and fix the same pattern independently.
3. **Reviewer lag** — The reviewer gets notified only after each commit; cross-module interactions are caught after the fact rather than predicted.

---

## CLARIFY: What "Shared State" Actually Means Here

Before designing, it is worth being precise. Three distinct things could be meant:

| Dimension | Current State | Gap |
|-----------|--------------|-----|
| **Decision log** (architecture choices) | `dev_handoff` captures per-agent decisions post-completion | No live log during active work |
| **File-change awareness** | `dev_coordinate` detects static file overlap at plan time | No runtime awareness of in-progress edits |
| **Knowledge broadcast** | `SendMessage` is ad-hoc, manual | No topic-scoped subscription model |

The feature request is primarily about the second and third: agents need to know what their teammates are doing *right now*, not only after commits.

---

## EXPLORE: Three Architecture Options

### Option A — Thin Shared File (Append-Only Log)

**Mechanism**: MCP server maintains `thoughts/team-sessions/{team-id}/live-state.md` as an append-only log. Each agent writes one-line entries when it starts/finishes editing a file or makes a key decision. Agents poll (or re-read) the log before touching any shared boundary.

```
# live-state.md (append-only)
[t=12:01] auth-dev: EDITING src/auth/guard.ts (JWT shape change)
[t=12:03] auth-dev: DECISION guard now rejects OPTIONS; callers must exclude preflight
[t=12:04] api-dev: READ live-state — noted guard behavior, adjusting SSE controller
[t=12:08] config-dev: EDITING src/config/cors.ts
```

**New MCP action**: `dev_coordinate(action='update', teamId, entry)` — appends one entry.
`dev_coordinate(action='read', teamId, since?)` — returns recent entries.

**Pros**:
- Zero new infrastructure (plain file, existing MCP server)
- Human-readable, git-tracked
- Works within current Claude Code constraints (no persistent process)
- Minimal token cost (~20 tokens per poll)

**Cons**:
- Polling-based — agents must be prompted to check
- No enforcement; agents can ignore the log
- No structured schema; hard to query programmatically

---

### Option B — Structured Shared Context Object (Balanced)

**Mechanism**: MCP server exposes a new `dev_team_ctx` tool backed by a small JSON file per team (`thoughts/team-sessions/{team-id}/ctx.json`). The context object has typed fields: `active_edits`, `decisions`, `warnings`, `checkpoints`.

```json
{
  "team_id": "TASK-042",
  "active_edits": {
    "src/auth/guard.ts": { "agent": "auth-dev", "intent": "JWT shape change", "started": "12:01" }
  },
  "decisions": [
    { "agent": "auth-dev", "key": "guard_blocks_options", "value": "true", "ts": "12:03" }
  ],
  "warnings": [
    { "agent": "reviewer", "severity": "P1", "msg": "Guard change affects CORS preflight — config-dev must exclude OPTIONS", "ts": "12:05" }
  ]
}
```

**New MCP tool**: `dev_team_ctx(action='lock'|'unlock'|'read'|'write_decision'|'raise_warning', teamId, ...)`

Agents call `lock` before editing a file (returns error if already locked by another agent), `unlock` when done, `write_decision` for key choices, `raise_warning` for cross-cutting issues the reviewer spots. A `SessionStart` hook for the team session injects the current ctx object into each agent context.

**Pros**:
- Structured — decisions and warnings are machine-queryable
- Soft locking prevents the most common conflict (same file edited concurrently)
- Warnings from the reviewer are surfaced to all agents without manual `SendMessage` per-agent
- Integrates cleanly with `dev_coordinate` conflict detection (same layer)
- One new MCP tool, ~80 lines of TypeScript

**Cons**:
- File-lock semantics are advisory (Claude agents can still ignore)
- Adds a new coordination primitive to learn
- ctx.json could get large for very long-running teams (mitigated by checkpoint archiving)

---

### Option C — Event Bus via SQLite (Heavy)

**Mechanism**: Extend the existing SQLite knowledge database (`context.db`) with an `events` table. Agents publish events (`file_started`, `decision_made`, `warning_raised`) via MCP. A subscription mechanism injects new events into the next agent turn via a background `TeammateIdle` hook.

```sql
CREATE TABLE team_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT,
  agent_id TEXT,
  event_type TEXT,  -- file_lock | decision | warning | checkpoint
  payload TEXT,     -- JSON
  ts INTEGER
);
```

**Pros**:
- Full queryability (JOIN, filter by type, time range)
- Natural fit with existing FTS5 knowledge infrastructure
- Enables retroactive analysis of team behavior
- Real subscription semantics possible via polling with `last_seen_id`

**Cons**:
- Significant new infrastructure (schema migration, query layer, subscription polling)
- SQLite contention risk if multiple agents write simultaneously
- Overkill for teams of 3-5 agents lasting 1-2 hours
- Harder to inspect/debug than a plain markdown file

---

## EVALUATE: Comparison

| Criterion | Option A (Thin Log) | Option B (Structured Ctx) | Option C (SQLite Bus) |
|-----------|--------------------|--------------------------|-----------------------|
| Implementation effort | 1-2h | 4-6h | 2-3 days |
| Debuggability | High (plain text) | High (JSON + human-readable) | Medium (requires SQL client) |
| Machine queryability | Low | Medium | High |
| Enforcement of constraints | None | Soft lock | Soft lock |
| Token cost per poll | ~20 | ~40 | ~30 |
| YAGNI compliance | Yes | Yes | No |
| Reviewer integration | Manual | Native `raise_warning` | Native |
| Git-tracked | Yes | Yes | No (SQLite) |

---

## DECIDE: Option B — Structured Shared Context Object

**Choice: Option B (Balanced)**

Rationale:
- Option A solves the human-readability goal but lacks the structured warnings that would allow the reviewer to automatically surface P1s without per-agent `SendMessage` calls.
- Option C solves future analytics but violates YAGNI: teams rarely need retroactive event analysis, and the SQLite contention risk is real with 5+ concurrent writers.
- Option B addresses the root failure modes (stale assumptions, reviewer lag) with structured `decisions` and `warnings` fields while staying implementable as a single MCP tool, no schema migrations required.

**Selected design summary**:
- New MCP tool: `dev_team_ctx` with 5 actions: `lock`, `unlock`, `read`, `write_decision`, `raise_warning`
- Storage: `thoughts/team-sessions/{team-id}/ctx.json` (git-tracked)
- File lock model: advisory soft lock with conflict detection (not hard block)
- Reviewer integration: `raise_warning` broadcasts a structured warning visible to all agents on next `read`
- SessionStart hook for agent-team sessions injects current ctx at spawn time
- Checkpoint archiving: ctx archived to `thoughts/handoffs/` when team closes, alongside existing handoffs

---

## Key Constraints Identified

1. **No persistent process** — All coordination must work through the MCP server's stateless request/response model. The JSON file is the only shared mutable state.
2. **Advisory only** — Claude agents cannot be hard-blocked from file access; soft locks must be paired with prompt-level instructions to check before editing.
3. **Reviewer is the natural broadcaster** — The existing reviewer teammate pattern already accumulates cross-module context. `raise_warning` fits naturally into the reviewer's role rather than requiring a new dedicated role.
4. **YAGNI on subscriptions** — Real push-based subscriptions require a persistent server process, which is not available in the current architecture. Poll-on-read is sufficient.

---

## Open Questions

- [ ] Should `lock` be file-granular or directory-granular? (Directory-level is safer but coarser.)
- [ ] What is the expiry policy for locks? (Agents can crash; stale locks would block teammates.)
- [ ] Should `write_decision` overwrite or append for the same key? (Append-with-timestamp is safer.)
- [ ] Should ctx.json be referenced in `dev_coordinate`'s existing `plan` action, or be a standalone tool?

---

## Suggested Next Step

`/create-plan` — create an implementation plan for `dev_team_ctx` tool, targeting the `coordination/` module in `dev-flow/mcp-server/src/`.

Estimated scope: 1 new MCP tool, 1 new TypeScript module (~120 lines), updates to `agent-team` SKILL.md teammate prompt template.
