---
# No paths: — applies globally
---

# Performance Rules

## Context Budget
- Monitor StatusLine context percentage
- 70%: prepare compact
- 85%: immediate /clear
- Use Read with limit for large files
- Use Grep with head_limit for searches

## Token Efficiency
- git diff --stat over git diff
- git log --oneline -N over git log
- Build output: pipe to tail -N
- Batch tool calls in parallel when independent

## Agent Efficiency
- Haiku for simple validation tasks
- Sonnet for standard implementation
- Opus only for architecture and review
- Minimize subagent spawning for trivial tasks
