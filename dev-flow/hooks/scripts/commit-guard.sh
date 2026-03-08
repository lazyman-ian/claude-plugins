#!/bin/bash
###
# Commit Guard - PreToolUse(Bash(*git commit*))
#
# Blocks ALL raw git commit via Bash tool.
# Only dev_commit MCP tool can commit (via execSync, bypasses hooks).
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

# Block all git commit via Bash tool — use /dev commit instead
echo "Use /dev-flow:commit instead of raw git commit. It provides: auto-scope, review gate, reasoning. If MCP is unavailable, reconnect with /reload-plugins." >&2
exit 2
