#!/bin/bash
###
# TaskCompleted Quality Gate
#
# Prevents task completion when verification hasn't passed.
# Only enforces for agent team tasks (team_name present).
#
# Exit 0 = allow completion
# Exit 2 = block completion (stderr sent as feedback)
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
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    uncommitted=$(git diff --stat 2>/dev/null | tail -1)
    echo "Uncommitted changes detected ($uncommitted). Commit with /dev commit before marking task complete: $task_subject" >&2
    exit 2
fi

# --- Check 2: Verify command (if Makefile exists) ---
if [[ -f "Makefile" ]]; then
    if grep -q "^check:" Makefile 2>/dev/null; then
        check_output=$(make check 2>&1)
        check_exit=$?
        if [[ $check_exit -ne 0 ]]; then
            echo "Verification failed (make check). Fix issues before completing: $task_subject" >&2
            echo "$check_output" | tail -5 >&2
            exit 2
        fi
    fi
fi

# --- All checks passed ---
if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] PASS task=$task_id" >> "$LOG_FILE"
fi

exit 0
