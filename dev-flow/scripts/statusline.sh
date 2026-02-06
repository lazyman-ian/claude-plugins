#!/bin/bash
###
# Dev-Flow StatusLine - 多行实验版
# 尝试复刻 Claude HUD 的多行展示效果
#
# 安装: 在 ~/.claude/settings.json 中添加:
#   "statusLine": {
#     "type": "command",
#     "command": "~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
#     "padding": 0
#   }
###

set -e

# 读取 Claude Code 输入
input=$(cat)
STATE_DIR="${HOME}/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"

# ========== 颜色定义 ==========
RESET="\033[0m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
MAGENTA="\033[35m"
BLUE="\033[34m"
GRAY="\033[90m"

# ========== 第1行：主状态行 ==========

# Context 可视化
CONTEXT_PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
generate_context_bar() {
    local pct=${1%.*}
    local filled=$((pct / 10))
    local empty=$((10 - filled))
    local color=""

    if [ "$pct" -lt 50 ]; then color="$GREEN"
    elif [ "$pct" -lt 80 ]; then color="$YELLOW"
    else color="$RED"; fi

    local bar=""
    for ((i=0; i<filled; i++)); do bar="${bar}█"; done
    for ((i=0; i<empty; i++)); do bar="${bar}░"; done

    echo -e "${color}${bar}${RESET}"
}

CONTEXT_BAR=$(generate_context_bar "$CONTEXT_PCT")

# 工作流阶段
get_phase() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo -e "${GRAY}○ IDLE${RESET}"
        return
    fi

    local has_changes=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$has_changes" != "0" ]; then
        echo -e "${YELLOW}● DEV${RESET}"
        return
    fi

    local ahead=$(git rev-list --count HEAD...@{upstream} 2>/dev/null || echo 0)
    if [ "$ahead" != "0" ]; then
        echo -e "${CYAN}↑ PUSH${RESET}"
        return
    fi

    local pr_state=$(gh pr view --json state -q '.state' 2>/dev/null || echo "NONE")
    case "$pr_state" in
        "OPEN") echo -e "${MAGENTA}🔍 PR${RESET}" ;;
        "MERGED") echo -e "${GREEN}✓ MERGED${RESET}" ;;
        *) echo -e "${GRAY}⏸ WAIT${RESET}" ;;
    esac
}

PHASE=$(get_phase)

# Git 信息（分支 + ahead/behind + 文件统计）
get_git_info() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        return
    fi

    local branch=$(git branch --show-current 2>/dev/null || echo "")
    [ -z "$branch" ] && return
    [ ${#branch} -gt 15 ] && branch="${branch:0:12}..."

    local result="${CYAN}${branch}${RESET}"

    # ahead/behind
    if git rev-parse --abbrev-ref '@{upstream}' > /dev/null 2>&1; then
        local counts=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo -e "0\t0")
        local ahead=$(echo "$counts" | cut -f1)
        local behind=$(echo "$counts" | cut -f2)
        if [ "$ahead" != "0" ] || [ "$behind" != "0" ]; then
            result="${result} ${GRAY}|${RESET} ↑${ahead}↓${behind}"
        fi
    fi

    # 文件统计
    local porcelain=$(git status --porcelain 2>/dev/null || echo "")
    if [ -n "$porcelain" ]; then
        local modified=$(echo "$porcelain" | grep -c '^[ M]M' || echo 0)
        local added=$(echo "$porcelain" | grep -c '^[ M]?[AM]' || echo 0)
        local deleted=$(echo "$porcelain" | grep -c '^[ M]?[D]' || echo 0)

        local stats=""
        [ "$modified" != "0" ] && stats="${stats}${YELLOW}!${modified}M${RESET}"
        [ "$added" != "0" ] && stats="${stats}${GREEN}+${added}A${RESET}"
        [ "$deleted" != "0" ] && stats="${stats}${RED}✘${deleted}D${RESET}"
        [ -n "$stats" ] && result="${result} ${GRAY}|${RESET} ${stats}"
    fi

    echo "$result"
}

GIT_INFO=$(get_git_info)

# 会话时长
DURATION_MS=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
format_duration() {
    local ms=$1
    local mins=$((ms / 60000))
    local hours=$((mins / 60))
    mins=$((mins % 60))
    [ $hours -gt 0 ] && echo "${hours}h${mins}m" || echo "${mins}m"
}
DURATION=$(format_duration "$DURATION_MS")

# 组装第1行
LINE1="${CONTEXT_BAR} ${CONTEXT_PCT%.*}% ${GRAY}|${RESET} ${PHASE}"
[ -n "$GIT_INFO" ] && LINE1="${LINE1} ${GRAY}|${RESET} ${GIT_INFO}"
LINE1="${LINE1} ${GRAY}|${RESET} ⏱️ ${DURATION}"

# ========== 第2行：工具活动统计 ==========
get_tool_line() {
    local stats_file="$STATE_DIR/tool_stats.json"
    [ ! -f "$stats_file" ] && return

    local stats=$(cat "$stats_file" 2>/dev/null || echo "{}")
    local output=""

    local read_count=$(echo "$stats" | jq -r '.read // 0')
    local edit_count=$(echo "$stats" | jq -r '.edit // 0')
    local bash_count=$(echo "$stats" | jq -r '.bash // 0')
    local grep_count=$(echo "$stats" | jq -r '.grep // 0')

    [ "$read_count" != "0" ] && output="${output}${GREEN}✓ Read ×${read_count}${RESET} ${GRAY}|${RESET} "
    [ "$edit_count" != "0" ] && output="${output}${YELLOW}✓ Edit ×${edit_count}${RESET} ${GRAY}|${RESET} "
    [ "$bash_count" != "0" ] && output="${output}${BLUE}✓ Bash ×${bash_count}${RESET} ${GRAY}|${RESET} "
    [ "$grep_count" != "0" ] && output="${output}${MAGENTA}✓ Grep ×${grep_count}${RESET} ${GRAY}|${RESET} "

    [ -n "$output" ] && echo -e "\n${output% ${GRAY}|${RESET} }"
}

TOOL_LINE=$(get_tool_line)

# ========== 第3行：任务进度 ==========
get_task_line() {
    local task_file="$STATE_DIR/tasks.json"
    [ ! -f "$task_file" ] && return

    local data=$(cat "$task_file" 2>/dev/null || echo "{}")
    local total=$(echo "$data" | jq -r '.total // 0')
    [ "$total" = "0" ] && return

    local completed=$(echo "$data" | jq -r '.completed // 0')
    local in_progress=$(echo "$data" | jq -r '.in_progress // 0')
    local pending=$(echo "$data" | jq -r '.pending // 0')

    local pct=$((completed * 100 / total))

    echo -e "\n${GREEN}✓${RESET} Tasks: ${completed}/${total} ${GRAY}(${pct}%)${RESET} ${GRAY}|${RESET} ${YELLOW}→ ${in_progress} active${RESET} ${GRAY}|${RESET} ${GRAY}⏳ ${pending} pending${RESET}"
}

TASK_LINE=$(get_task_line)

# ========== 第4行：Agent 状态 ==========
get_agent_line() {
    local agent_file="$STATE_DIR/agents.json"
    [ ! -f "$agent_file" ] && return

    local active=$(cat "$agent_file" 2>/dev/null | jq -r '.active // []')
    local count=$(echo "$active" | jq 'length')
    [ "$count" = "0" ] && return

    local output=""
    local i=0
    while [ $i -lt "$count" ]; do
        local name=$(echo "$active" | jq -r ".[$i].name")
        local task=$(echo "$active" | jq -r ".[$i].task")
        local duration=$(echo "$active" | jq -r ".[$i].duration")
        [ ${#task} -gt 25 ] && task="${task:0:22}..."
        output="${output}\n${CYAN}✓ ${name}:${RESET} ${task} ${GRAY}(${duration}s)${RESET}"
        i=$((i + 1))
    done

    [ -n "$output" ] && echo -e "$output"
}

AGENT_LINE=$(get_agent_line)

# ========== 输出多行结果 ==========
# 使用 \n 分隔各行
OUTPUT="${LINE1}${TOOL_LINE}${TASK_LINE}${AGENT_LINE}"

echo -e "$OUTPUT"
