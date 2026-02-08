#!/bin/bash
###
# TaskCompleted Quality Gate
#
# Prevents task completion when verification hasn't passed.
# Only enforces for agent team tasks (team_name present).
#
# Exit 0 = allow completion
# Exit 2 = block completion (stderr sent as feedback)
#
# Input (stdin JSON):
#   task_id, task_subject, task_description?, teammate_name?, team_name?
#
# Install: add to ~/.claude/settings.json (see docs/hooks-setup.md)
###

HOOK_NAME="task-completed-gate"
DEBUG=${CLAUDE_HOOK_DEBUG:-0}
LOG_FILE="$HOME/.claude/hooks.log"

# --- Read stdin ---
input=$(cat 2>/dev/null || echo '{}')

if [[ -z "$input" ]] || [[ "$input" == "{}" ]]; then
    exit 0
fi

if ! echo "$input" | jq empty 2>/dev/null; then
    exit 0
fi

# --- Parse fields ---
team_name=$(echo "$input" | jq -r '.team_name // empty' 2>/dev/null || echo "")
teammate_name=$(echo "$input" | jq -r '.teammate_name // empty' 2>/dev/null || echo "")
task_subject=$(echo "$input" | jq -r '.task_subject // empty' 2>/dev/null || echo "")
task_id=$(echo "$input" | jq -r '.task_id // empty' 2>/dev/null || echo "")

# --- Only enforce for agent team tasks ---
if [[ -z "$team_name" ]]; then
    exit 0
fi

if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] team=$team_name mate=$teammate_name task=$task_id subject=$task_subject" >> "$LOG_FILE"
fi

# --- Check 1: Uncommitted changes ---
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
    : # Clean working tree, OK
else
    uncommitted=$(git diff --stat 2>/dev/null | tail -1)
    echo "Uncommitted changes detected ($uncommitted). Commit with /dev commit before marking task complete: $task_subject" >&2
    exit 2
fi

# --- Check 2: Verify command (if Makefile exists) ---
if [[ -f "Makefile" ]]; then
    # Quick lint check only (not full build)
    if grep -q "^check:" Makefile 2>/dev/null; then
        if ! make check 2>&1 | tail -5 >&2; then
            echo "Verification failed (make check). Fix issues before completing: $task_subject" >&2
            exit 2
        fi
    fi
fi

# --- All checks passed ---
if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] PASS task=$task_id" >> "$LOG_FILE"
fi

exit 0
