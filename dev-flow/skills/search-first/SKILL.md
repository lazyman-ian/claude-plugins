---
name: search-first
description: >-
  Enforces research-before-code workflow by searching existing implementations, documentation,
  and known pitfalls before writing any code. Use when working with unfamiliar APIs, new framework
  integrations, or complex algorithms. Triggers on "research first", "search before coding",
  "先研究再写", "查找现有实现", "search first", "先搜索", "研究优先", "避免重复造轮子".
  Do NOT use for general code search (use utils:search-code).
  Do NOT use for external research (use research:research-agent).
allowed-tools: [Read, Glob, Grep, WebSearch, WebFetch]
user-invocable: false
---

# Search First

Before implementing unfamiliar APIs or patterns, search first:

1. **Codebase**: `Grep`/`Glob` for existing implementations — if found, stop and reuse
2. **Pitfalls**: `dev_memory(action="query", query="<keywords> pitfalls")`
3. **Docs**: If not found in codebase, `WebSearch` official docs for API signatures
4. **Present summary** — wait for confirmation if conflicting patterns or non-trivial pitfalls found

Skip if the pattern was already searched or discussed in this session.
