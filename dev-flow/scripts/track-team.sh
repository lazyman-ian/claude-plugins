#!/bin/bash
###
# track-team.sh - 维护 session → team 映射
#
# 用法:
#   track-team.sh create  # TeamCreate 后调用
#   track-team.sh delete  # TeamDelete 后调用
###

set -o pipefail

input=$(cat)
action=${1:-}

STATE_DIR="${HOME}/.claude/state/dev-flow"
MAPPING_FILE="${STATE_DIR}/session_teams.json"

mkdir -p "$STATE_DIR"

# 初始化映射文件
if [ ! -f "$MAPPING_FILE" ]; then
    echo '{}' > "$MAPPING_FILE"
fi

# 解析输入
session_id=$(echo "$input" | jq -r '.session_id // empty' 2>/dev/null)
team_name=$(echo "$input" | jq -r '.tool_input.team_name // .tool_output.team_name // empty' 2>/dev/null)

case "$action" in
    create)
        # TeamCreate: 记录 session → team 映射
        if [ -n "$session_id" ] && [ -n "$team_name" ]; then
            jq --arg sid "$session_id" --arg tn "$team_name" \
                '. + {($sid): $tn}' "$MAPPING_FILE" > "${MAPPING_FILE}.tmp" 2>/dev/null \
                && mv "${MAPPING_FILE}.tmp" "$MAPPING_FILE"
        fi
        ;;

    delete)
        # TeamDelete: 清除映射
        if [ -n "$session_id" ]; then
            jq --arg sid "$session_id" \
                'del(.[$sid])' "$MAPPING_FILE" > "${MAPPING_FILE}.tmp" 2>/dev/null \
                && mv "${MAPPING_FILE}.tmp" "$MAPPING_FILE"
        fi
        ;;

    cleanup)
        # 清理不存在的 team
        teams_dir="${HOME}/.claude/teams"
        if [ ! -d "$teams_dir" ]; then
            echo '{}' > "$MAPPING_FILE"
            exit 0
        fi

        jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$MAPPING_FILE" 2>/dev/null | while IFS=$'\t' read -r sid tname; do
            if [ ! -d "$teams_dir/$tname" ]; then
                jq --arg sid "$sid" 'del(.[$sid])' "$MAPPING_FILE" > "${MAPPING_FILE}.tmp" \
                    && mv "${MAPPING_FILE}.tmp" "$MAPPING_FILE"
            fi
        done
        ;;

    *)
        # 未知操作，静默退出
        exit 0
        ;;
esac

# 输出原始输入（透传）
echo "$input"
