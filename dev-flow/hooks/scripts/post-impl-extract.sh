#!/usr/bin/env bash
set -o pipefail

# Post-implementation product knowledge extraction
# Triggered after dev_commit MCP tool to extract domain knowledge

input=$(cat)
if [ -z "$input" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Check if this was a successful commit (finalize returns "✅")
tool_output=$(echo "$input" | jq -r '.tool_output // empty' 2>/dev/null || echo "")
case "$tool_output" in
  *"✅"*) ;;
  *) echo '{"continue": true}'; exit 0 ;;
esac

# Signal that product extraction should run
echo '{"continue": true, "reason": "Post-commit: consider saving domain knowledge via dev_memory(save)."}'
exit 0
