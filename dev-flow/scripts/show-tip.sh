#!/bin/bash
# show-tip.sh - Display a weighted random tip from tips.json
# Usage: show-tip.sh [category]
# If category provided, filter tips by category

# Cascading lookup: plugin config first, then user's global config
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_TIPS="$SCRIPT_DIR/../config/tips.json"
USER_TIPS="$HOME/.claude/config/tips.json"

if [[ -f "$PLUGIN_TIPS" ]]; then
    TIPS_FILE="$PLUGIN_TIPS"
elif [[ -f "$USER_TIPS" ]]; then
    TIPS_FILE="$USER_TIPS"
else
    # Default tips when no config file exists
    TIPS=(
        "/dev commit - 提交代码 (无归属, 自动 reasoning)"
        "/dev pr - 创建 PR (自动推送, 模板描述)"
        "/dev - 查看状态和下一步建议"
        "/dev release - 发布版本 (自动 changelog)"
    )
    echo "💡 ${TIPS[$((RANDOM % ${#TIPS[@]}))]}"
    exit 0
fi

# Get category filter if provided
CATEGORY="$1"

# Build jq filter
if [[ -n "$CATEGORY" ]]; then
    JQ_FILTER=".tips | map(select(.category == \"$CATEGORY\"))"
else
    JQ_FILTER=".tips"
fi

# Get tips with weights, expand by weight, pick random
TIP=$(jq -r "$JQ_FILTER | map(. as \$t | range(.weight) | \$t) | .[$(( RANDOM % $(jq "$JQ_FILTER | map(range(.weight)) | length" "$TIPS_FILE") ))].tip" "$TIPS_FILE" 2>/dev/null)

if [[ -n "$TIP" && "$TIP" != "null" ]]; then
    echo "💡 $TIP"
else
    echo "💡 /dev commit - 提交代码 (无归属, 自动 reasoning)"
fi
