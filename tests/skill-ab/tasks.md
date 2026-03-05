# A/B Test Tasks

## search-first

### Task S1 (Simple)
"Add SQLite FTS5 full-text search to the knowledge vault module. The vault is in `dev-flow/mcp-server/src/continuity/`. Research how FTS5 works and what existing patterns the codebase uses before implementing."

Expected: Agent should search codebase for existing SQLite usage, find memory.ts patterns, check dev_memory for pitfalls, then present findings.

### Task S2 (Complex)
"Integrate Notion API to fetch tasks from a Notion database. Check if the project already has Notion integration before starting."

Expected: Agent should find existing notion.ts in mcp-server/src/, understand the existing pattern, and avoid reimplementing.

## debugging

### Task D1 (Simple)
"The `dev_commit` MCP tool returns 'No staged changes' even when files are staged. Debug why."

Expected: Agent should check git status, look at the commit tool implementation in mcp-server/src/git/, trace the logic.

### Task D2 (Complex)
"Knowledge vault search returns stale results — entries saved yesterday don't appear in search. The vault uses SQLite FTS5. Debug the indexing pipeline."

Expected: Agent should trace the index flow in continuity/memory.ts, check if reindex is called after save, examine FTS5 triggers.

## brainstorm

### Task B1 (Simple)
"Brainstorm how to add a caching layer to the dev_memory MCP tool. It's currently hitting SQLite on every query. Explore options."

Expected: Agent should query codebase for existing caching patterns, present 2-3 options (in-memory LRU, TTL cache, SQLite WAL), ask user multiple-choice questions one at a time, persist decision via dev_handoff.

### Task B2 (Complex)
"Brainstorm the architecture for adding real-time collaboration support to the agent-team system. Currently agents communicate via SendMessage but there's no shared state. Explore design options for shared context."

Expected: Agent should explore codebase for existing coordination patterns, generate multiple approaches with trade-offs, evaluate systematically, ask focused questions, persist via handoff.

## plan-agent

### Task P1 (Simple)
"Create an implementation plan for adding a `dev_ping` MCP tool that returns server health status (uptime, version, active connections)."

Expected: Agent should research existing MCP tools in index.ts, identify patterns, write plan with phases to thoughts/shared/plans/, include success criteria.

### Task P2 (Complex)
"Create an implementation plan for migrating the knowledge vault from flat Markdown files to a hybrid Markdown + SQLite architecture with full-text search, temporal decay scoring, and quality gates."

Expected: Agent should deeply research existing vault code in continuity/, identify all integration points, create multi-phase plan with specific file changes and automated success criteria.

## test-generator

### Task T1 (Simple)
"Generate tests for the `detectPlatformSimple()` function in `dev-flow/mcp-server/src/detector.ts`."

Expected: Agent should read the function, find existing test patterns in mcp-server/tests/, write matching-style tests.

### Task T2 (Complex)
"Generate tests for the git workflow module (`dev-flow/mcp-server/src/git/workflow.ts`). Cover phase detection, status formatting, and edge cases."

Expected: Agent should understand the module, check existing test coverage, write comprehensive tests.
