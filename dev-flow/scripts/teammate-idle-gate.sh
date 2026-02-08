#!/bin/bash
###
# TeammateIdle Quality Gate
#
# Prevents teammate from going idle when there's unfinished work.
#
# Exit 0 = allow idle
# Exit 2 = block idle (stderr sent as feedback, teammate continues)
#
# Input (stdin JSON):
#   teammate_name, team_name + common fields
#
# Install: add to ~/.claude/settings.json (see docs/hooks-setup.md)
###

HOOK_NAME="teammate-idle-gate"
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
teammate_name=$(echo "$input" | jq -r '.teammate_name // empty' 2>/dev/null || echo "")
team_name=$(echo "$input" | jq -r '.team_name // empty' 2>/dev/null || echo "")

if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] team=$team_name mate=$teammate_name" >> "$LOG_FILE"
fi

# --- Check 1: Uncommitted changes ---
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    uncommitted=$(git diff --stat 2>/dev/null | tail -1)
    echo "You have uncommitted changes ($uncommitted). Commit with /dev commit or stash before going idle." >&2
    exit 2
fi

# --- Check 2: Staged but not committed ---
staged=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
if [[ "$staged" -gt 0 ]]; then
    echo "You have $staged staged files not committed. Run /dev commit before going idle." >&2
    exit 2
fi

# --- All checks passed ---
if [[ "$DEBUG" == "1" ]]; then
    echo "$(date +%H:%M:%S) [$HOOK_NAME] PASS mate=$teammate_name" >> "$LOG_FILE"
fi

exit 0
