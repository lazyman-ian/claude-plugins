#!/bin/bash
###
# Agent Tracker Hook - SubagentStop
# 追踪子 Agent 运行状态
###

set -e

input=$(cat)
state_dir="$HOME/.claude/state/dev-flow"
mkdir -p "$state_dir"
agent_file="$state_dir/agents.json"

# 初始化
if [ ! -f "$agent_file" ]; then
    echo '{"active":[],"history":[]}' > "$agent_file"
fi

# 检查是否是 SubagentStop 事件
hook_name=$(echo "$input" | jq -r '.hook_name // empty')

if [ "$hook_name" = "SubagentStop" ]; then
    # Agent 完成，从 active 列表移除
    agent_id=$(echo "$input" | jq -r '.agent_id // empty')
    if [ -n "$agent_id" ]; then
        tmp=$(mktemp)
        jq --arg id "$agent_id" '.active = [.active[] | select(.id != $id)]' "$agent_file" > "$tmp" && mv "$tmp" "$agent_file"
    fi
else
    # Task 启动时记录 Agent（通过 metadata）
    # 这里需要其他方式检测 Agent 启动
    :
fi

echo '{"result": "continue"}'
