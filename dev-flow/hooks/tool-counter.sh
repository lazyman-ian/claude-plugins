#!/bin/bash
###
# Tool Counter Hook - PostToolUse
# 记录工具使用统计，供 statusline 显示
###

set -o pipefail

input=$(cat)

# Safety: exit cleanly if stdin is empty or not JSON
if [[ -z "$input" ]]; then echo '{"result":"continue"}'; exit 0; fi

tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

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
    stats='{"read":0,"edit":0,"write":0,"bash":0,"grep":0,"glob":0}'
fi

# Ensure all keys exist in case stats_file predates schema expansion
stats=$(echo "$stats" | jq '. + {"write":((.write//0)),"glob":((.glob//0))}' 2>/dev/null) || stats='{"read":0,"edit":0,"write":0,"bash":0,"grep":0,"glob":0}'

# 更新对应工具的计数
case "$tool_name" in
    "Read") stats=$(echo "$stats" | jq '.read += 1') ;;
    "Edit") stats=$(echo "$stats" | jq '.edit += 1') ;;
    "Write") stats=$(echo "$stats" | jq '.write += 1') ;;
    "Bash") stats=$(echo "$stats" | jq '.bash += 1') ;;
    "Grep") stats=$(echo "$stats" | jq '.grep += 1') ;;
    "Glob") stats=$(echo "$stats" | jq '.glob += 1') ;;
esac

# Atomic write: prevents partial-write on concurrent async executions
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
echo "$stats" > "$tmp" && mv "$tmp" "$stats_file"
echo '{"result": "continue"}'
