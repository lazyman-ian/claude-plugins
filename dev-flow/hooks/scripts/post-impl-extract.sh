#!/usr/bin/env bash
set -o pipefail

# Post-implementation product knowledge extraction
# Triggered after commits to extract domain knowledge

input=$(cat)
if [ -z "$input" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Only trigger on successful commit-related operations
tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
if [ "$tool_name" != "Bash" ]; then
  echo '{"continue": true}'
  exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
# Check if this was a git commit (from dev_commit flow)
case "$command" in
  *"DEV_FLOW_COMMIT"*"git commit"*) ;;
  *) echo '{"continue": true}'; exit 0 ;;
esac

# Signal that product extraction should run
# This hook outputs a reminder to save domain knowledge
echo '{"continue": true, "reason": "Post-commit: consider saving domain knowledge via dev_memory(save)."}'
exit 0
