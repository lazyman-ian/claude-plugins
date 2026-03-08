---
name: search-first
description: >-
  Enforces research-before-code workflow by searching existing implementations, documentation,
  and known pitfalls before writing any code. Use when working with unfamiliar APIs, new framework
  integrations, or complex algorithms. Triggers on "research first", "search before coding",
  "先研究再写", "查找现有实现", "search first", "先搜索", "研究优先", "避免重复造轮子".
  Do NOT use for general code search (use utils:search-code).
  Do NOT use for external research (use research:research-agent).
allowed-tools: [Read, Glob, Grep, WebSearch, WebFetch, mcp__plugin_dev-flow_dev-flow__dev_memory]
user-invocable: false
---

# Search First

Before implementing unfamiliar APIs or patterns, search existing knowledge to avoid reinventing the wheel or hitting known pitfalls.

## Process

### 1. Codebase Search

Search for existing implementations matching the target pattern:

```
Grep: pattern keywords → existing code
Glob: file name patterns → similar modules
```

If a matching implementation exists, **stop and reuse** — adapt the existing pattern rather than writing new code.

### 2. Pitfall Check

Query the knowledge vault for known issues:

```
dev_memory(action="search", query="<keywords> pitfalls")
```

Surface any warnings, workarounds, or anti-patterns recorded from past sessions.

### 3. External Docs

If the pattern is not in the codebase, search official documentation:

```
WebSearch: "<framework> <API> official docs"
```

Focus on API signatures, required parameters, and common gotchas.

### 4. Summary

Present findings before proceeding:
- Existing implementations found (with file paths)
- Known pitfalls (with severity)
- API signatures and constraints from docs

If conflicting patterns or non-trivial pitfalls are found, wait for user confirmation before implementing.

## Skip Conditions

- Pattern was already searched or discussed in this session
- Implementation is trivial and well-known (e.g., standard library usage)
- User explicitly says to skip research
