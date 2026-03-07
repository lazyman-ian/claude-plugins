---
type: pattern
priority: critical
platform: all
tags: [agentic-engineering, ralph-loop, harness, context-engineering]
created: 2026-03-08
access_count: 0
---

# Agentic Engineering Principles

## Design Axiom

> Don't trust the context window, only trust the file system.

## Nested Loop Model

```
Meta Loop (days)     ← self-improvement
  Outer Loop (hours) ← work orchestration
    Inner Loop (min) ← single-task execution (Ralph Loop)
      Tool Loop (s)  ← LLM token prediction
```

## 7 Core Principles

1. **State externalization**: Progress in files + git, not context
2. **Context = temp workspace**: Not storage. 60%+ → quality degrades
3. **Environment > Prompt**: Hooks enforce, rules suggest. Tests > prompts
4. **Continue until environment stops**: Not until uncertain
5. **Verify = only completion signal**: exit 0, not agent opinion
6. **Fresh context per task**: Deliberate rotation > long pollution
7. **Human specifies WHAT; agents handle HOW**: Precise goals, autonomous execution

## Three-Layer Decision Architecture

- L1: Environment auto-judgment (verify, scope) — zero cost
- L2: Decision Agent (fork, Sonnet) — low cost
- L3: Human (PR review, security escalation) — rare

## Ralph Loop Pattern

```
while tasks_remain:
  fresh_context()
  state = read_state()      # files + git
  task = pick_next(state)
  execute(task)
  verify(task)
  save_state()
  commit()
```

Key insight: Context pollution is inevitable. Don't fight it — rotate.
Gutter signals: same command fails 3x, file thrashing, loop without progress.

## Context Budget

- < 60%: safe
- 60-80%: finish current task, prepare rotation
- > 80%: immediate save + rotate

## Human Touchpoints (Only 2)

1. INPUT: Precise goal + acceptance criteria
2. OUTPUT: PR Review

Everything between is agent-autonomous.

## Sources

- Anthropic: Effective Harnesses for Long-Running Agents
- ghuntley: Ralph Loop / Weaving Loom
- OpenAI: Symphony
- Martin Fowler: Harness Engineering, Context Engineering
- sysLS: World-Class Agentic Engineer
