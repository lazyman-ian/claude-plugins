#!/bin/bash
###
# Tool Counter Hook - PostToolUse
# 记录工具使用统计，供 statusline 显示
###

set -e

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# 只处理我们关心的工具
case "$tool_name" in
    "Read"|"Edit"|"Write"|"Bash"|"Grep"|"Glob") ;;
    *) echo '{"result": "continue"}'; exit 0 ;;
esac

state_dir="$HOME/.claude/state/dev-flow"
mkdir -p "$state_dir"
stats_file="$state_dir/tool_stats.json"

# 读取或初始化
if [ -f "$stats_file" ]; then
    stats=$(cat "$stats_file" 2>/dev/null || echo '{}')
else
    stats='{"read":0,"edit":0,"bash":0,"grep":0}'
fi

# 更新对应工具的计数
case "$tool_name" in
    "Read") stats=$(echo "$stats" | jq '.read += 1') ;;
    "Edit"|"Write") stats=$(echo "$stats" | jq '.edit += 1') ;;
    "Bash") stats=$(echo "$stats" | jq '.bash += 1') ;;
    "Grep"|"Glob") stats=$(echo "$stats" | jq '.grep += 1') ;;
esac

echo "$stats" > "$stats_file"
echo '{"result": "continue"}'
