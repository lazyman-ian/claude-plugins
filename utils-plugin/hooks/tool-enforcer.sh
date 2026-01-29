#!/bin/bash
###
# Tool Enforcer Hook - PreToolUse(Bash)
#
# Detects Bash commands that should use native tools instead
# Based on command-tools.md decision tree
###

set -e

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

# Only process Bash tool
if [ "$tool" != "Bash" ]; then
    echo '{"result": "continue"}'
    exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // ""')
suggestions=()

# Check for ls (should use Glob)
if [[ "$command" =~ ^[[:space:]]*(ls|/bin/ls)[[:space:]] ]]; then
    suggestions+=("💡 \`ls\` → 使用 \`Glob\` 工具更高效")
fi

# Check for find (should use Glob)
if [[ "$command" =~ ^[[:space:]]*(find|/usr/bin/find)[[:space:]] ]]; then
    suggestions+=("💡 \`find\` → 使用 \`Glob\` 工具更高效")
fi

# Check for cat/head/tail (should use Read)
if [[ "$command" =~ ^[[:space:]]*(cat|head|tail|/bin/cat)[[:space:]] ]]; then
    suggestions+=("💡 \`cat/head/tail\` → 使用 \`Read\` 工具更高效")
fi

# Check for grep/rg (should use Grep)
if [[ "$command" =~ ^[[:space:]]*(grep|rg|/usr/bin/grep)[[:space:]] ]]; then
    suggestions+=("💡 \`grep\` → 使用 \`Grep\` 工具更高效")
fi

# Output suggestions if any
if [ ${#suggestions[@]} -gt 0 ]; then
    message="## Tool Enforcer\n\n"
    for s in "${suggestions[@]}"; do
        message+="$s\n"
    done
    message+="\n参考: command-tools.md 决策树"

    echo "{\"result\": \"continue\", \"message\": \"$message\"}"
else
    echo '{"result": "continue"}'
fi
