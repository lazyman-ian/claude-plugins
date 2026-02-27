#!/bin/bash
###
# Commit Guard - PreToolUse(Bash(*git commit*))
#
# Blocks raw git commit, enforces /dev-flow:commit.
# /dev commit bypasses via DEV_FLOW_COMMIT=1 command prefix.
#
# Exit 2 = block | Exit 0 = allow
###

set -o pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only check commands containing "git commit"
if [[ ! "$COMMAND" =~ git[[:space:]]+commit ]]; then
    exit 0
fi

# Allow /dev commit flow (prefix in command string)
if [[ "$COMMAND" =~ DEV_FLOW_COMMIT=1 ]]; then
    exit 0
fi

# Block raw git commit
echo "Use /dev-flow:commit instead of raw git commit. It provides: auto-scope, review gate, reasoning." >&2
exit 2
