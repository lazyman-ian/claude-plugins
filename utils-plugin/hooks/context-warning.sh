#!/bin/bash
###
# Context Warning Hook - Stop
#
# Warns when context usage exceeds 70% to encourage shorter conversations
###

set -e

input=$(cat)

# Extract context info from stop event
context_used=$(echo "$input" | jq -r '.context_used // 0')
context_limit=$(echo "$input" | jq -r '.context_limit // 200000')

# Calculate percentage
if [ "$context_limit" -gt 0 ]; then
    pct=$((context_used * 100 / context_limit))
else
    pct=0
fi

# Warning thresholds
if [ "$pct" -ge 85 ]; then
    message="⚠️ **Context 危险** ($pct%)

建议立即:
1. 总结关键发现
2. 更新 ledger 或 TaskCreate
3. \`/clear\` 或开始新会话

当前: ${context_used}K / ${context_limit}K tokens"

    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
elif [ "$pct" -ge 70 ]; then
    message="🟡 **Context 警告** ($pct%)

考虑:
- 完成当前子任务后开始新会话
- 使用 ledger 记录进度

当前: ${context_used}K / ${context_limit}K tokens"

    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
else
    echo '{"result": "continue"}'
fi
