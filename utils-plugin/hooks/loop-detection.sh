#!/bin/bash
###
# Loop Detection Hook - PostToolUse
#
# Detects when the same tool is being called repeatedly (>= 8 times in last 10 calls)
# Warns to prevent token waste from stuck loops
###

set -e

# Read input from stdin
input=$(cat)

# Extract tool name
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# Skip if no tool name
if [ -z "$tool_name" ]; then
    echo '{"result": "continue"}'
    exit 0
fi

# State file for tracking recent tool calls
state_dir="$HOME/.claude/state"
mkdir -p "$state_dir"
history_file="$state_dir/tool_history.log"

# Append current tool to history (timestamp:tool_name)
timestamp=$(date +%s)
echo "$timestamp:$tool_name" >> "$history_file"

# Keep only last 20 entries (analyze last 10, but keep buffer)
if [ -f "$history_file" ]; then
    tail -20 "$history_file" > "$history_file.tmp"
    mv "$history_file.tmp" "$history_file"
fi

# Analyze last 10 tool calls
recent_calls=$(tail -10 "$history_file" | cut -d':' -f2)
total_calls=$(echo "$recent_calls" | wc -l | tr -d ' ')

# Skip if less than 10 calls
if [ "$total_calls" -lt 10 ]; then
    echo '{"result": "continue"}'
    exit 0
fi

# Count occurrences of current tool in last 10 calls
count=$(echo "$recent_calls" | grep -c "^$tool_name$" || true)

# Threshold: 8 or more occurrences in last 10 calls
if [ "$count" -ge 8 ]; then
    # Generate warning message
    message="⚠️  循环检测警告

检测到工具 **$tool_name** 在最近 10 次调用中出现了 **$count 次**

这可能表示：
- 陷入搜索循环（反复 Grep/Read 同样内容）
- 重复尝试相同操作
- 工具选择不当

建议：
1. 尝试不同的方法或工具
2. 使用 /braintrust-analyze --detect-loops 查看完整模式
3. 考虑创建 skill 简化重复操作
4. 如需探索代码，使用 Task(Explore) 而非反复 Grep

Token 已消耗约 $((count * 500))+ tokens（粗略估算）"

    echo "{\"result\": \"continue\", \"message\": $(echo "$message" | jq -Rs .)}"
    exit 0
fi

# No loop detected
echo '{"result": "continue"}'
exit 0
