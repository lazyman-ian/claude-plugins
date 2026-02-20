---
name: context-handoff
description: >-
  Automates context preservation before /clear by summarizing state, updating ledgers,
  creating tasks for remaining work, and writing handoff documents. This skill should be
  used when approaching context limits, preparing for session end, or handing off work
  to the next conversation.
  Triggers on "save context", "handoff", "prepare for clear", "context handoff",
  "session end", "wrap up session", "保存上下文", "准备清空", "交接上下文", "会话交接".
  Do NOT use for regular task tracking — use TaskCreate directly instead.
model: sonnet
memory: project
allowed-tools: [Read, Glob, Grep, Bash, TaskCreate, TaskList, mcp__plugin_dev-flow_dev-flow__dev_ledger, mcp__plugin_dev-flow_dev-flow__dev_handoff, mcp__plugin_dev-flow_dev-flow__dev_memory, mcp__plugin_dev-flow_dev-flow__dev_status]
---

# Context Handoff - Session Preservation Workflow

Preserves session state before `/clear` or session end, ensuring zero knowledge loss across conversations.

## When to Use

| Signal | Action |
|--------|--------|
| Context > 70% (StatusLine yellow/red) | Run handoff proactively |
| User says "wrap up" / "save context" | Full handoff workflow |
| Switching to unrelated task | Capture current state first |
| Before `/clear` | Always run handoff |
| Session naturally ending | Summarize + create tasks |

## Workflow

### Step 1: Assess Current State

```
dev_status()              → phase, errors, next action
git diff --stat           → uncommitted changes
git log --oneline -5      → recent commits this session
TaskList()                → in-progress tasks
```

### Step 2: Summarize Session

Capture what happened in this conversation:
- Key decisions made (and why)
- Problems encountered and solutions found
- Discoveries or issues noticed (not yet addressed)
- Files modified and their purpose

### Step 3: Update Ledger

```
dev_ledger(action="status")    → check if active ledger exists
dev_ledger(action="update")    → update State section
```

Ledger State format:
```markdown
- Done: [x] Phase 1 (verified: `make check` pass)
- Now: [->] Phase 2 — paused at Step 3 (context limit)
- Next: [ ] Phase 3
```

Mark current progress with `UNCONFIRMED:` if uncertain about completeness.

### Step 4: Create Tasks for Remaining Work

For each incomplete item:
```
TaskCreate({
  subject: "Continue: [specific remaining work]",
  description: "Context: [what was done] | Next: [what remains] | Files: [working set]",
  activeForm: "Pending from previous session"
})
```

Only create tasks for actionable items, not vague TODOs.

### Step 5: Write Handoff Document

```
dev_handoff(action="write", handoff={
  version: "2.0",
  agent_id: "session-handoff",
  task_id: "[current task or branch]",
  status: "paused",
  summary: "[1-2 sentence session summary]",
  changes_made: ["file1:lines", "file2:lines"],
  decisions: { "key-decision": "rationale" },
  verification: ["what passed", "what not yet verified"],
  for_next_agent: "Start by [specific next step]",
  open_questions: ["unresolved items"]
})
```

### Step 6: Save Novel Knowledge

If the session produced reusable insights:
```
dev_memory(action="save", text="[insight]", tags="pitfall|pattern|decision")
```

Skip this step if no novel findings — avoid noise in the knowledge base.

### Step 7: Output Summary

Present a compact summary for the user:

```markdown
## Session Handoff Summary

**Branch**: feature/xyz
**Phase**: DEVELOPING (paused at Step 3)
**Changes**: 4 files modified, 2 committed, 2 uncommitted

### Completed
- [x] Implemented auth service
- [x] Added unit tests

### Remaining (tasks created)
- [ ] TASK-1: Integration tests
- [ ] TASK-2: Update API docs

### Next Session Start
> Read ledger → TaskList → continue from Phase 2 Step 3

Ready for /clear.
```

## End-of-Conversation Checklist

Before confirming handoff complete:

- [ ] Key findings summarized (not lost in context)
- [ ] Incomplete items have TaskCreate entries
- [ ] Discovered issues recorded (tasks or ledger Open Questions)
- [ ] Ledger updated with verification status
- [ ] Uncommitted changes either committed or noted
- [ ] Working set files listed for next session

## Auto-Trigger Hint

StatusLine displays context percentage. Thresholds:
- **70%+**: Consider running `/dev-flow:context-handoff`
- **85%+**: Run handoff immediately, then `/clear`

The Stop hook may remind you, but proactive handoff preserves more context than reactive cleanup.
