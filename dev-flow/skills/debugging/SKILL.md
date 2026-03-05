---
name: debugging
description: Debugs failures and investigates crashes using a 4-phase systematic approach (observe, hypothesize, test, fix) with optional subagent-driven parallel exploration. This skill should be used when the user encounters crashes, unexpected behavior, test failures, or production bugs that need root cause analysis. Triggers on "debug", "troubleshoot", "investigate crash", "fix bug", "diagnose issue", "root cause", "调试", "排查", "修复bug", "排查问题", "崩溃分析", "定位原因", "错误分析", "Bug定位". Do NOT use for pre-commit linting or code quality checks — use "self-check" instead.
model: opus
memory: project
context: fork
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, Task, TaskCreate, TaskUpdate, TaskList, AskUserQuestion]
---

# Debugging - Systematic Root Cause Analysis

Debug issues using 4-phase systematic approach with optional subagent-driven parallel exploration.

## When to Use

- "debug this crash"
- "troubleshoot login failure"
- "diagnose performance issue"
- "排查为什么功能不工作"
- "修复这个 bug"

## Process

Debug systematically. Use tools for evidence, not assumptions.

### Integration Points

- **Before**: `dev_memory(action="query", query="<error-keyword> <platform>")` for historical patterns
- **Verify fix**: `dev_config()` → get verify command → run → exit code 0 required (VDD iron law)
- **Save pitfall**: `dev_memory(action="save", title="...", text="Root cause: ... Fix: ...", tags="pitfall,<platform>")` if root cause is non-obvious
- **Complex issues**: Spawn parallel subagents with different hypotheses

### Verification (mandatory)

Fix is complete ONLY when verify command exits 0. "Should work" / "Looks correct" are not acceptable.

### Output

Document findings in `thoughts/debugging/DEBUG-<issue>-<date>.md`.
