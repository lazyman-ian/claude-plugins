# Hook Testing Guide

How to test Claude Code hooks locally before deploying.

## Stdin Mock Patterns

Hooks receive JSON via stdin. Simulate this with echo pipe.

### PreToolUse Mock

```bash
echo '{
  "type": "pre_tool_use",
  "tool_name": "Bash",
  "tool_input": {
    "command": "git push --force"
  },
  "session_id": "test-session-001"
}' | hooks/my-hook.sh
```

### PostToolUse Mock

```bash
echo '{
  "type": "post_tool_use",
  "tool_name": "Write",
  "tool_input": {
    "file_path": "/tmp/test.ts",
    "content": "const x = 1;"
  },
  "tool_output": "File written successfully"
}' | hooks/my-hook.sh
```

### PermissionRequest Mock

```bash
echo '{
  "type": "permission_request",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test"
  }
}' | hooks/my-hook.sh
```

### Stop Hook Mock

```bash
echo '{
  "type": "stop",
  "last_assistant_message": "I have completed the implementation."
}' | hooks/my-hook.sh
```

### SessionStart Mock

```bash
echo '{
  "type": "session_start",
  "session_id": "test-session-001",
  "project_dir": "/Users/test/project"
}' | hooks/my-hook.sh
```

### SubagentStart Mock

```bash
echo '{
  "type": "subagent_start",
  "subagent_type": "general-purpose"
}' | hooks/my-hook.sh
```

### TaskCompleted Mock

```bash
echo '{
  "type": "task_completed",
  "task_subject": "Implement auth module",
  "task_id": "task-001"
}' | hooks/my-hook.sh
```

### Empty Input (Edge Case)

```bash
echo '' | hooks/my-hook.sh
echo '{}' | hooks/my-hook.sh
echo 'not-json' | hooks/my-hook.sh
```

All three should produce `{"result": "continue"}` and exit 0 if safety patterns are correct.

## Expected Output Formats

### Success (continue)

```json
{"result": "continue"}
```

### Success with message

```json
{"result": "continue", "message": "Info for Claude"}
```

### Block (PreToolUse, UserPromptSubmit)

Exit code 2 + stderr:
```
$ echo '...' | hooks/my-hook.sh; echo "exit: $?"
Blocked: dangerous command >&2
exit: 2
```

### Approve (PermissionRequest)

```json
{"decision": "approve", "reason": "Auto-approved: test command"}
```

### Modified Input (PreToolUse)

```json
{"updatedInput": {"command": "safer-command-here"}}
```

## Debugging with CLAUDE_HOOK_DEBUG

Enable verbose logging:

```bash
CLAUDE_HOOK_DEBUG=1 echo '{"tool_name":"Bash"}' | hooks/my-hook.sh
```

Check the log:

```bash
tail -f ~/.claude/hooks.log
```

Log format (from template):
```
14:32:05 [my-hook] tool=Bash session=test-001
```

### Custom Debug Logging

Add to your hook:

```bash
if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] custom_field=$custom_value" >> "$LOG_FILE"
fi
```

## Validation Checklist

Run these tests for every new hook:

```bash
HOOK=hooks/my-hook.sh

# 1. Empty input doesn't crash
echo '' | $HOOK && echo "PASS: empty input"

# 2. Empty JSON doesn't crash
echo '{}' | $HOOK && echo "PASS: empty JSON"

# 3. Invalid JSON doesn't crash
echo 'not-json' | $HOOK && echo "PASS: invalid JSON"

# 4. Missing fields don't crash
echo '{"tool_name":"Bash"}' | $HOOK && echo "PASS: partial fields"

# 5. Normal input produces expected output
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | $HOOK && echo "PASS: normal input"

# 6. Trigger condition works
echo '{"tool_name":"Bash","tool_input":{"command":"<trigger>"}}' | $HOOK; echo "exit: $?"
```

## Common Errors and Fixes

### jq parse error

**Symptom**: `parse error (at <stdin>:0)`

**Cause**: Empty stdin or non-JSON input.

**Fix**: Guard with validation before jq:
```bash
input=$(cat 2>/dev/null || echo '{}')
if ! echo "$input" | jq empty 2>/dev/null; then
    echo '{"result": "continue"}'
    exit 0
fi
```

### set -e causes silent exit

**Symptom**: Hook produces no output, exit code 1.

**Cause**: `set -e` makes any failed command (including jq on null) exit immediately.

**Fix**: Use `set -o pipefail` instead. Never use `set -e` or `set -eo pipefail`.

### Variable expansion in JSON

**Symptom**: Malformed JSON output.

**Cause**: Unescaped quotes or special characters in variables.

**Fix**: Use jq to build JSON safely:
```bash
# Bad: echo '{"message": "'"$msg"'"}'
# Good:
echo "{}" | jq --arg m "$msg" '{result: "continue", message: $m}'
```

### Hook not triggering

**Symptom**: Hook never runs.

**Cause**: Matcher doesn't match, or hooks.json structure wrong.

**Checklist**:
1. Verify hooks.json is wrapped in `"hooks"` object
2. Check matcher syntax: `"Bash(git*)"` vs `"Bash(*git*)"` (start vs contains)
3. Verify script is executable: `chmod +x hooks/my-hook.sh`
4. Check hook type matches hook event (e.g., `PreToolUse` not `preToolUse`)
5. Verify settings level (project vs user vs local)

### Permission denied

**Symptom**: `Permission denied` error.

**Fix**:
```bash
chmod +x hooks/my-hook.sh
```

### Alias interference

**Symptom**: Unexpected behavior from `cd`, `sed`, `curl`, `find` in hooks.

**Fix**: Use absolute paths or builtins:
```bash
builtin cd "$dir"           # cd only (shell builtin)
/usr/bin/sed 's/a/b/' file  # sed (external command)
/usr/bin/curl -s "$url"     # curl (external command)
/usr/bin/find . -name "*.sh" # find (external command)
```

### Stderr pollution

**Symptom**: Claude sees error messages mixed with hook output.

**Fix**: Redirect stderr for clean JSON output:
```bash
# During development, keep stderr for debugging
echo '{"tool_name":"Bash"}' | hooks/my-hook.sh

# In production, suppress stderr
echo '{"tool_name":"Bash"}' | hooks/my-hook.sh 2>/dev/null
```

## Integration Testing

After unit testing, verify in a live session:

1. Add hook to `hooks/hooks.json`
2. Start a new Claude Code session
3. Trigger the hook condition
4. Check `~/.claude/hooks.log` (with `CLAUDE_HOOK_DEBUG=1` in env)
5. Verify Claude's behavior matches expectations

## Performance Guidelines

| Guideline | Why |
|-----------|-----|
| Keep hooks under 1s execution | Timeout default is 60s, but slow hooks degrade UX |
| Avoid network calls in PreToolUse | Blocks tool execution |
| Use `async: true` for slow analysis | Doesn't block the workflow |
| Cache expensive computations | `/tmp/claude-hook-cache-*` pattern |
| Early exit for non-matching tools | Check tool_name before heavy parsing |
