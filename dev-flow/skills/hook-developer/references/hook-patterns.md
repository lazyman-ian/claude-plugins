# Hook Patterns by Type

Detailed implementation patterns for each of the 14 Claude Code hook types.

## PreToolUse

Runs before a tool executes. Can block or modify the action.

### Matcher Syntax

```json
"matcher": "Bash(rm *)"           // Match tool + arguments
"matcher": "Write|Edit"           // Multiple tools
"matcher": "Bash(*git commit*)"   // Wildcard (catches chained commands)
"matcher": "mcp__server__tool"    // MCP tools
"matcher": "*"                    // All tools
```

**Caveat**: `Bash(git commit*)` matches commands STARTING with `git commit`.
Use `Bash(*git commit*)` to catch `git add && git commit`.

### Blocking Pattern

```bash
command=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if [[ "$command" == *"--force"* ]]; then
    echo "Blocked: force push detected" >&2
    exit 2
fi

echo '{"result": "continue"}'
```

### Input Modification Pattern

```bash
# Rewrite command before execution
echo '{"updatedInput": {"command": "echo safe-command"}}'
```

### Auto-Approve Pattern (PermissionRequest-like)

```bash
echo '{"decision": "allow", "reason": "Auto-allowed: read-only operation"}'
```

## PostToolUse

Runs after a tool completes. Cannot fully block (action already happened).

### Auto-Format Pattern

```json
{
  "matcher": "Write|Edit",
  "hooks": [{
    "type": "command",
    "command": "prettier --write \"$CLAUDE_TOOL_INPUT_FILE_PATH\""
  }]
}
```

### Tool Counter Pattern

```bash
tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
counter_file="/tmp/claude-tool-counter-$$"

count=$(cat "$counter_file" 2>/dev/null || echo "0")
count=$((count + 1))
echo "$count" > "$counter_file"

if [[ "$count" -gt 50 ]]; then
    echo '{"result": "continue", "message": "Tool usage high: '"$count"' calls this session"}'
    exit 0
fi

echo '{"result": "continue"}'
```

### Async Pattern

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "command",
    "command": "hooks/slow-analysis.sh",
    "async": true
  }]
}
```

Result delivered on next turn instead of blocking.

## PostToolUseFailure

Runs when a tool execution fails. Cannot block. Useful for tracking and feedback.

```bash
tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
error=$(echo "$input" | jq -r '.error // empty' 2>/dev/null || echo "")

echo '{"result": "continue", "message": "Tool '"$tool_name"' failed: '"$error"'"}'
```

## SessionStart

Runs when a session begins. Cannot block. Output becomes context for Claude.

### Context Injection

```bash
# Git status + active tasks
git_status=$(git status --short 2>/dev/null || echo "")
active_ledger=$(ls thoughts/ledgers/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)

echo "Git: $git_status"
if [[ -n "$active_ledger" ]]; then
    echo "Active ledger: $active_ledger"
fi
```

All stdout becomes `additionalContext` injected into the session.

## SessionEnd

Runs when session ends. Cannot block. Use for cleanup.

```bash
# Save session metrics
echo "$(date +%Y-%m-%d) session ended" >> ~/.claude/session-log.txt
```

## Stop

Runs when Claude finishes responding. Can block (exit 2 = send feedback).

### Completion Verification

```bash
last_msg=$(echo "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null || echo "")

# Check if Claude claimed completion without verification
if echo "$last_msg" | grep -qi "should work\|looks correct\|I think"; then
    echo "Claims completion without verification evidence" >&2
    exit 2
fi

echo '{"result": "continue"}'
```

`last_assistant_message` (v2.1.47+) provides Claude's final response directly.

### Session Summary (Tier 1 Memory)

```bash
# Generate session summary for knowledge system
summary=$(echo "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null | head -c 500)
echo "$summary" > "/tmp/session-summary-$$.txt"
echo '{"result": "continue"}'
```

## UserPromptSubmit

Runs when user sends a message. Can block or inject context.

```bash
prompt=$(echo "$input" | jq -r '.prompt // empty' 2>/dev/null || echo "")

# Inject project context
echo '{"result": "continue", "message": "Project: iOS, branch: feature/auth"}'
```

## PermissionRequest

Runs when permission dialog appears. Can auto-approve or deny.

### Auto-Approve Pattern

```bash
tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
command=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Auto-approve test commands
if [[ "$tool_name" == "Bash" ]] && [[ "$command" == npm\ test* ]]; then
    echo '{"decision": "approve", "reason": "Auto-approved: test command"}'
    exit 0
fi

# Auto-deny destructive commands
if [[ "$command" == *"rm -rf /"* ]]; then
    echo '{"decision": "deny", "reason": "Blocked: destructive command"}'
    exit 0
fi

# Default: show permission dialog
echo '{"decision": "ask"}'
```

## SubagentStart

Runs when a subagent spawns. Cannot block. Injects context via stdout.

```bash
# Inject project-specific context for subagents
echo "Project conventions: Conventional Commits, TypeScript strict"
echo "Active branch: $(git branch --show-current 2>/dev/null)"
```

## SubagentStop

Runs when subagent finishes. Can block (exit 2 = send feedback to retry).

```bash
last_msg=$(echo "$input" | jq -r '.last_assistant_message // empty' 2>/dev/null || echo "")

if [[ -z "$last_msg" ]]; then
    echo "Subagent produced no output" >&2
    exit 2
fi

echo '{"result": "continue"}'
```

## PreCompact

Runs before context compaction. Cannot block.

### Transcript Backup

```bash
# Use matcher "auto|manual" to catch both compaction types
timestamp=$(date +%Y%m%d_%H%M%S)
backup_dir="$HOME/.claude/backups"
mkdir -p "$backup_dir"
echo '{"result": "continue", "message": "Transcript backed up"}'
```

**Matcher**: `"auto|manual"` for PreCompact hooks.

## Notification

Runs when a notification is sent. Cannot block.

```bash
notification=$(echo "$input" | jq -r '.message // empty' 2>/dev/null || echo "")
echo '{"result": "continue"}'
```

## TaskCompleted

Runs when a task is marked done. Can block (exit 2 = reject completion).

### Quality Gate

```bash
task_subject=$(echo "$input" | jq -r '.task_subject // empty' 2>/dev/null || echo "")

# Verify tests pass before allowing completion
if ! npm test 2>/dev/null; then
    echo "Tests must pass before task completion" >&2
    exit 2
fi

echo '{"result": "continue"}'
```

## TeammateIdle

Runs when a teammate becomes idle. Can block (exit 2 = assign more work).

```bash
teammate=$(echo "$input" | jq -r '.teammate_name // empty' 2>/dev/null || echo "")
echo '{"result": "continue", "message": "Teammate '"$teammate"' is idle — assign or release"}'
```

## Prompt and Agent Hook Types (v2.1.38+)

### type: "prompt"

LLM-evaluated hook. Claude evaluates the prompt and decides.

```json
{
  "matcher": "Bash",
  "hooks": [{
    "type": "prompt",
    "prompt": "Is this command safe to run? $ARGUMENTS",
    "timeout": 30
  }]
}
```

Supported: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, UserPromptSubmit, Stop, SubagentStop, TaskCompleted.

### type: "agent"

Multi-turn subagent with Read/Grep/Glob access (up to 50 turns).

```json
{
  "matcher": "*",
  "hooks": [{
    "type": "agent",
    "prompt": "Review the changed file for security issues. Check: $CLAUDE_TOOL_INPUT_FILE_PATH",
    "timeout": 120
  }]
}
```

Use for complex validation requiring file access and reasoning.

## Hook Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | number | 60000 | Max execution time (ms) |
| `statusMessage` | string | - | Custom spinner message |
| `async` | boolean | false | Background execution |
| `once` | boolean | false | Run once per session |

## Environment Variables

| Variable | Available In | Value |
|----------|-------------|-------|
| `CLAUDE_PROJECT_DIR` | All hooks | Project root path |
| `CLAUDE_TOOL_INPUT_FILE_PATH` | PostToolUse(Write\|Edit) | Modified file path |
| `CLAUDE_CODE_REMOTE` | All hooks | "true" if remote session |
| `CLAUDE_ENV_FILE` | All hooks | Environment file path |
