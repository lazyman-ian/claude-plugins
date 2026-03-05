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

# Search First - Research Before Code

Enforce a research-before-implementation gate to prevent reinventing the wheel and missing
known pitfalls.

## When to Trigger

Claude should activate this skill when detecting:

| Signal | Example |
|--------|---------|
| Unfamiliar API | "I need to integrate Stripe webhooks" |
| New framework feature | "Add SwiftUI animations" |
| Complex algorithm | "Implement rate limiting" |
| Explicit request | "search first", "先研究再写" |
| Working in unfamiliar directory | First time touching a module |

**Complexity threshold**: Apply when the task requires >= 2 files AND involves an API or
pattern not already visible in the current session context.

**Skip if**: The implementation pattern was already discussed or searched in this session.

## 4-Step Research Workflow

```
CODEBASE SEARCH → DOCUMENTATION → PITFALL CHECK → DECISION POINT
```

### Step 1: Codebase Search

Find existing implementations before looking externally.

```
Grep for: class names, function names, import patterns related to the concept
Glob for: files by naming convention (e.g., *Service.ts, *Repository.swift)
```

Questions to answer:
- Does this already exist in the codebase?
- What pattern does the project use for this type of code?
- Are there similar implementations to follow?

**Output**: List of relevant files with file:line references. "Already exists" = stop here.

### Step 2: Documentation Lookup

Search official documentation for the specific API or framework feature.

```
WebSearch: "[framework/library] [feature] [year] official docs"
WebFetch: Official API reference page
```

Focus on:
- API signature (not a tutorial, the actual method signatures)
- Version-specific behavior (does project version match docs version?)
- Deprecated alternatives to avoid

**Output**: Confirmed API usage pattern with version compatibility note.

### Step 3: Pitfall Check

Query project memory for known issues.

```
dev_memory(action="query", query="<technology> <feature> pitfall")
dev_memory(action="query", query="<technology> <feature> error")
```

Also check:
- CLAUDE.md "Known Pitfalls" section
- Recent git log for related commits with fix messages

**Output**: List of pitfalls to avoid, or "no known pitfalls".

### Step 4: Decision Point

Present findings before writing any code.

```
Research Summary:
- Existing: [found X in file:line] OR [not found]
- Pattern: [how project does this type of thing]
- API: [correct method signature]
- Pitfalls: [list] OR [none known]

Recommendation: [specific approach with rationale]
Proceed? [wait for confirmation on complex/unfamiliar findings]
```

**When to wait for confirmation**:
- Found conflicting patterns in codebase
- API version mismatch detected
- Known pitfalls are non-trivial
- "Existing implementation" found that might be reusable

**When to proceed immediately**:
- Pattern is clear and consistent
- No pitfalls found
- API usage is straightforward

## Decision Matrix

| Familiarity | Pitfalls Found | Conflicting Patterns | Action |
|-------------|---------------|---------------------|--------|
| High | No | No | Proceed silently |
| High | Yes | No | Show pitfalls, then proceed |
| Low | No | No | Show research summary, proceed |
| Low | Yes | Any | Wait for confirmation |
| Any | Any | Yes | Wait for confirmation |

## Output Format

```
Search-First: [concept]

Codebase: [found/not found] - [file:line if found]
Pattern: [how project implements this type of thing]
API: [correct usage]
Pitfalls: [list or "none"]

Recommendation: [approach]
```

Keep the output compact. The goal is to unblock implementation, not create a research document.
