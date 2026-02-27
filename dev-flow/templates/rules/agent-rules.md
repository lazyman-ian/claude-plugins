---
# No paths: — applies globally
---

# Agent Rules

## Orchestration
- Use subagents for tasks modifying ≥3 files
- Use Agent Teams for 3+ parallelizable phases
- Sonnet for implementation, Opus for architecture/review

## Communication
- SendMessage for teammate coordination
- TaskUpdate for status tracking
- Never implement tasks assigned to others

## Quality Gates
- Self-review before reporting done
- Verify command must pass before commit
- P0/P1 review findings block commit

## Context Management
- Fresh subagent per task (context isolation)
- Shutdown idle teammates (>30min)
- Re-spawn at 80% context usage
