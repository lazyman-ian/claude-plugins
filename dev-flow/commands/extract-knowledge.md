---
description: Extract reusable knowledge from current project
---

# /dev-flow:extract-knowledge - Knowledge Extraction

Extract reusable knowledge from the current project into the cross-project knowledge base.

## Data Sources

| Source | Location | Content |
|--------|----------|---------|
| CLAUDE.md | Project root | "已知陷阱" / "Known Pitfalls" section |
| Ledgers | thoughts/ledgers/ | Resolved "Open Questions" |
| Commit Reasoning | .git/claude/commits/ | Decision records |

## Extraction Flow

### Step 1: Detect Platform

```bash
dev_config(format="json")
# → { "platform": "ios", ... }
```

### Step 2: Scan Sources

1. Read CLAUDE.md for pitfalls section
2. Read ledgers for resolved questions
3. Read recent commit reasoning files

### Step 3: Categorize Knowledge

| Type | Destination |
|------|-------------|
| Platform-specific bug | `~/.claude/knowledge/platforms/<platform>/pitfalls.md` |
| Cross-platform pattern | `~/.claude/knowledge/patterns/<pattern>.md` |
| Time-based discovery | `~/.claude/knowledge/discoveries/YYYY-MM-DD-<topic>.md` |

### Step 4: Write and Index

```bash
# Append to pitfalls
echo "### [Title]" >> ~/.claude/knowledge/platforms/ios/pitfalls.md
echo "**Source**: $(basename $PWD), $(date +%Y-%m-%d)" >> ...
echo "**Problem**: ..." >> ...
echo "**Solution**: ..." >> ...
```

## Output Format

```
📚 Knowledge Extraction Complete

Platform: ios
Extracted:
- 2 pitfalls → platforms/ios/pitfalls.md
- 1 pattern → patterns/async-error-handling.md
- 3 discoveries → discoveries/

Run `/knowledge` to view all knowledge.
```

## Examples

### Extract All
```bash
/dev-flow:extract-knowledge
```

### Extract Specific Type
```bash
/dev-flow:extract-knowledge --type pitfalls
/dev-flow:extract-knowledge --type patterns
/dev-flow:extract-knowledge --type discoveries
```

### Preview Only (No Write)
```bash
/dev-flow:extract-knowledge --dry-run
```

## Knowledge Format

### Pitfall Entry
```markdown
### [Short Title]
**Source**: project-name, YYYY-MM-DD
**Problem**: What went wrong
**Solution**: How to fix/avoid
```

### Pattern Entry
```markdown
# Pattern: [Name]
## Context
When to use this pattern
## Problem
What problem it solves
## Solution
The pattern implementation
## Examples
Code examples
```

### Discovery Entry
```markdown
# Discovery: [Topic]
Date: YYYY-MM-DD
Project: source-project

## What
What was discovered

## Why
Why it matters

## How to Apply
Steps to use this knowledge
```

## Auto-Loading

Extracted knowledge is automatically loaded at session start:
```
📚 ios pitfalls: 4 条
```
