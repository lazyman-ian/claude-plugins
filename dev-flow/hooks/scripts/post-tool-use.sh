#!/bin/bash
###
# PostToolUse Hook - Bypass Detection (BLOCKING)
#
# Loop detection → utils/loop-detection.sh
# Alias detection → utils/alias-conflict-detector.sh
###

set -o pipefail

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

if [[ "$tool_name" != "Bash" ]]; then
    echo '{"result":"continue"}'
    exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Block --no-verify bypass
if [[ "$command" =~ --no-verify ]]; then
    echo '{"result":"block","reason":"❌ --no-verify 不允许。修复问题后正常提交。"}'
    exit 0
fi

# Warn on force push
if [[ "$command" =~ --force ]] && [[ "$command" =~ git\ push ]]; then
    echo '{"result":"continue","message":"⚠️ git push --force 检测到，建议 --force-with-lease"}'
    exit 0
fi

echo '{"result":"continue"}'
