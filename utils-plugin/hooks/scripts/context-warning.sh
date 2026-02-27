#!/bin/bash
###
# Context Warning Hook - Stop
#
# Warns when context usage exceeds 70% to encourage shorter conversations.
# Enhanced with tool call tracking and phase transition detection.
###

set -o pipefail

input=$(cat)

# Extract context info from stop event (安全解析 JSON)
context_used=$(echo "$input" | jq -r '.context_used // 0' 2>/dev/null || echo "0")
context_limit=$(echo "$input" | jq -r '.context_limit // 200000' 2>/dev/null || echo "200000")

# Calculate percentage
if [ "$context_limit" -gt 0 ]; then
    pct=$((context_used * 100 / context_limit))
else
    pct=0
fi

# --- Tool call tracking ---
stats_file="$HOME/.claude/state/dev-flow/tool_stats.json"
total_calls=0
phase_hint=""

if [ -f "$stats_file" ]; then
    stats=$(cat "$stats_file" 2>/dev/null || echo "{}")

    read_count=$(echo "$stats"  | jq -r '.read  // 0' 2>/dev/null || echo "0")
    edit_count=$(echo "$stats"  | jq -r '.edit  // 0' 2>/dev/null || echo "0")
    write_count=$(echo "$stats" | jq -r '.write // 0' 2>/dev/null || echo "0")
    bash_count=$(echo "$stats"  | jq -r '.bash  // 0' 2>/dev/null || echo "0")
    grep_count=$(echo "$stats"  | jq -r '.grep  // 0' 2>/dev/null || echo "0")
    glob_count=$(echo "$stats"  | jq -r '.glob  // 0' 2>/dev/null || echo "0")

    total_calls=$((read_count + edit_count + write_count + bash_count + grep_count + glob_count))

    # Detect predominant phase from tool ratio
    research_calls=$((read_count + grep_count + glob_count))
    impl_calls=$((edit_count + write_count))

    if [ "$total_calls" -gt 0 ]; then
        # Use integer arithmetic: multiply by 100 to get percentage
        research_pct=$((research_calls * 100 / total_calls))
        impl_pct=$((impl_calls * 100 / total_calls))

        if [ "$research_pct" -ge 60 ]; then
            phase_hint="research phase (Read/Grep dominant)"
        elif [ "$impl_pct" -ge 60 ]; then
            phase_hint="implementation phase (Edit/Write dominant)"
        else
            phase_hint="general phase (mixed tools)"
        fi
    fi
fi

# Build optional tool stats line for messages
tool_stats_line=""
if [ "$total_calls" -gt 0 ]; then
    tool_stats_line="
工具调用: ${total_calls} 次 | 阶段: ${phase_hint}"
fi

# Strategic compaction suggestion: high tool count + moderate context
compaction_hint=""
if [ "$total_calls" -gt 50 ] && [ "$pct" -ge 60 ]; then
    compaction_hint="
💡 **建议压缩**: ${total_calls} 次工具调用 + ${pct}% context — 适合 \`/compact\` 释放空间"
fi

# Warning thresholds
if [ "$pct" -ge 85 ]; then
    message="⚠️ **Context 危险** ($pct%)

建议立即:
1. 总结关键发现
2. 更新 ledger 或 TaskCreate
3. \`/clear\` 或开始新会话

当前: ${context_used}K / ${context_limit}K tokens${tool_stats_line}${compaction_hint}"

    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
elif [ "$pct" -ge 70 ]; then
    message="🟡 **Context 警告** ($pct%)

考虑:
- 完成当前子任务后开始新会话
- 使用 ledger 记录进度

当前: ${context_used}K / ${context_limit}K tokens${tool_stats_line}${compaction_hint}"

    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
elif [ -n "$compaction_hint" ]; then
    # Context below 70% but tool count is high — surface compaction hint only
    message="📊 **Tool Activity**${tool_stats_line}${compaction_hint}"
    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
else
    echo '{"result": "continue"}'
fi
