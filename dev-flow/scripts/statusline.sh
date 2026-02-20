#!/bin/bash
###
# Dev-Flow StatusLine - 多行实验版
#
# 安装: 在 ~/.claude/settings.json 中添加:
#   "statusLine": {
#     "type": "command",
#     "command": "~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/statusline.sh",
#     "padding": 0
#   }
###

set -o pipefail

# ========== 参数解析 ==========
EXTRA_CMD=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --extra-cmd) EXTRA_CMD="$2"; shift 2 ;;
        *) shift ;;
    esac
done

input=$(cat)
STATE_DIR="${HOME}/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"

# ========== 配置系统 ==========
CONFIG_FILE="$STATE_DIR/statusline-config.json"
CFG_SHOW_RATE_LIMIT=true
CFG_SHOW_SPEED=true
CFG_SHOW_RUNNING_TOOL=true
CFG_SHOW_METRICS=true
CFG_SHOW_TASKS=true
CFG_SHOW_TEAM=true
CFG_SHOW_AGENTS=true
CFG_SHOW_SESSION=true
CFG_RATE_LIMIT_TTL=60
CFG_SPEED_WINDOW=3

if [ -f "$CONFIG_FILE" ]; then
    cfg_parsed=$(jq -r '[
        (if .showRateLimit == false then "false" else "true" end),
        (if .showSpeed == false then "false" else "true" end),
        (if .showRunningTool == false then "false" else "true" end),
        (if .showMetrics == false then "false" else "true" end),
        (if .showTasks == false then "false" else "true" end),
        (if .showTeam == false then "false" else "true" end),
        (if .showAgents == false then "false" else "true" end),
        (if .showSession == false then "false" else "true" end),
        (.rateLimitCacheTTL // 60),
        (.speedWindow // 3)
    ] | @tsv' "$CONFIG_FILE" 2>/dev/null) || true
    if [ -n "$cfg_parsed" ]; then
        CFG_SHOW_RATE_LIMIT=$(echo "$cfg_parsed" | cut -f1)
        CFG_SHOW_SPEED=$(echo "$cfg_parsed" | cut -f2)
        CFG_SHOW_RUNNING_TOOL=$(echo "$cfg_parsed" | cut -f3)
        CFG_SHOW_METRICS=$(echo "$cfg_parsed" | cut -f4)
        CFG_SHOW_TASKS=$(echo "$cfg_parsed" | cut -f5)
        CFG_SHOW_TEAM=$(echo "$cfg_parsed" | cut -f6)
        CFG_SHOW_AGENTS=$(echo "$cfg_parsed" | cut -f7)
        CFG_SHOW_SESSION=$(echo "$cfg_parsed" | cut -f8)
        CFG_RATE_LIMIT_TTL=$(echo "$cfg_parsed" | cut -f9)
        CFG_SPEED_WINDOW=$(echo "$cfg_parsed" | cut -f10)
    fi
fi

# ========== 颜色定义 ==========
RESET="\033[0m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
MAGENTA="\033[35m"
BLUE="\033[34m"
GRAY="\033[90m"
WHITE_BOLD="\033[1;37m"

# ========== 解析输入 JSON（单次 jq） ==========
parsed=$(echo "$input" | jq -r '[
  (.context_window.used_percentage // 0),
  (.cost.total_duration_ms // 0),
  (.cost.total_cost_usd // 0),
  (.model.display_name // ""),
  (.cost.total_lines_added // 0),
  (.cost.total_lines_removed // 0),
  (.agent.name // ""),
  (.context_window.current_usage.cache_read_input_tokens // 0),
  (.context_window.current_usage.input_tokens // 0),
  (.context_window.total_input_tokens // 0),
  (.context_window.total_output_tokens // 0),
  (.context_window.context_window_size // 200000),
  (.session_id // ""),
  (.transcript_path // "")
] | @tsv' 2>/dev/null || echo "0	0	0		0	0		0	0	0	0	200000		")

CONTEXT_PCT=$(echo "$parsed" | cut -f1)
DURATION_MS=$(echo "$parsed" | cut -f2)
COST_USD=$(echo "$parsed" | cut -f3)
MODEL_NAME=$(echo "$parsed" | cut -f4)
LINES_ADDED=$(echo "$parsed" | cut -f5)
LINES_REMOVED=$(echo "$parsed" | cut -f6)
AGENT_NAME=$(echo "$parsed" | cut -f7)
CACHE_READ=$(echo "$parsed" | cut -f8)
INPUT_TOKENS=$(echo "$parsed" | cut -f9)
TOTAL_INPUT=$(echo "$parsed" | cut -f10)
TOTAL_OUTPUT=$(echo "$parsed" | cut -f11)
CONTEXT_SIZE=$(echo "$parsed" | cut -f12)
SESSION_ID=$(echo "$parsed" | cut -f13)
TRANSCRIPT_PATH=$(echo "$parsed" | cut -f14)

# ========== Git 数据（单次采集） ==========
IS_GIT=false
GIT_PORCELAIN=""
GIT_BRANCH=""
GIT_AHEAD=0
GIT_BEHIND=0

if git rev-parse --git-dir > /dev/null 2>&1; then
    IS_GIT=true
    GIT_PORCELAIN=$(git status --porcelain 2>/dev/null || echo "")
    GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

    if git rev-parse --abbrev-ref '@{upstream}' > /dev/null 2>&1; then
        counts=$(git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0	0")
        GIT_AHEAD=$(echo "$counts" | cut -f1)
        GIT_BEHIND=$(echo "$counts" | cut -f2)
    fi
fi

# ========== 第1行：主状态行 ==========

# Context bar
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

# 模型标识 + extended context
get_model_badge() {
    local badge=""
    case "$MODEL_NAME" in
        Opus*)   badge="${MAGENTA}Opus${RESET}" ;;
        Sonnet*) badge="${BLUE}Son${RESET}" ;;
        Haiku*)  badge="${GREEN}Hai${RESET}" ;;
    esac
    [ -z "$badge" ] && return

    # extended context (> 200K)
    if [ "$CONTEXT_SIZE" -gt 200000 ] 2>/dev/null; then
        local size_k=$((CONTEXT_SIZE / 1000))
        badge="${badge}${GRAY}/${size_k}K${RESET}"
    fi

    echo -e "$badge"
}
MODEL_BADGE=$(get_model_badge)

# Agent 身份（作为 team 成员时）
get_agent_badge() {
    [ -z "$AGENT_NAME" ] && return
    echo -e "${CYAN}[${AGENT_NAME}]${RESET}"
}
AGENT_BADGE=$(get_agent_badge)

# 工作流阶段
get_phase() {
    if [ "$IS_GIT" != "true" ]; then
        echo -e "${GRAY}○ IDLE${RESET}"
        return
    fi

    if [ -n "$GIT_PORCELAIN" ]; then
        echo -e "${YELLOW}● DEV${RESET}"
        return
    fi

    if [ "$GIT_AHEAD" != "0" ]; then
        echo -e "${CYAN}↑ PUSH${RESET}"
        return
    fi

    # PR 状态：缓存 30s
    local cache_file="$STATE_DIR/pr_cache"
    local pr_state="NONE"
    if [ -f "$cache_file" ]; then
        local cache_age=$(( $(date +%s) - $(stat -f%m "$cache_file" 2>/dev/null || echo 0) ))
        if [ "$cache_age" -lt 30 ]; then
            pr_state=$(cat "$cache_file" 2>/dev/null || echo "NONE")
        fi
    fi

    if [ "$pr_state" = "NONE" ] && [ -f "$cache_file" ] && [ "$cache_age" -ge 30 ] || [ ! -f "$cache_file" ]; then
        pr_state=$(gh pr view --json state -q '.state' 2>/dev/null || echo "NONE")
        echo "$pr_state" > "$cache_file"
    fi

    case "$pr_state" in
        "OPEN") echo -e "${MAGENTA}◎ PR${RESET}" ;;
        "MERGED") echo -e "${GREEN}✓ MERGED${RESET}" ;;
        *) echo -e "${GRAY}⏸ WAIT${RESET}" ;;
    esac
}

PHASE=$(get_phase)

# Git 信息
get_git_info() {
    [ "$IS_GIT" != "true" ] && return
    [ -z "$GIT_BRANCH" ] && return

    local branch="$GIT_BRANCH"
    [ ${#branch} -gt 15 ] && branch="${branch:0:12}..."

    local result="${CYAN}${branch}${RESET}"

    if [ "$GIT_AHEAD" != "0" ] || [ "$GIT_BEHIND" != "0" ]; then
        result="${result} ${GRAY}|${RESET} ↑${GIT_AHEAD}↓${GIT_BEHIND}"
    fi

    if [ -n "$GIT_PORCELAIN" ]; then
        local modified=$(echo "$GIT_PORCELAIN" | grep -cE '^.M|^M' || true)
        local added=$(echo "$GIT_PORCELAIN" | grep -cE '^\?\?|^A' || true)
        local deleted=$(echo "$GIT_PORCELAIN" | grep -cE '^.D|^D' || true)

        local stats=""
        [ "$modified" != "0" ] && stats="${stats}${YELLOW}~${modified}${RESET} "
        [ "$added" != "0" ] && stats="${stats}${GREEN}+${added}${RESET} "
        [ "$deleted" != "0" ] && stats="${stats}${RED}-${deleted}${RESET} "
        [ -n "$stats" ] && result="${result} ${GRAY}|${RESET} ${stats% }"
    fi

    echo "$result"
}

GIT_INFO=$(get_git_info)

# 会话时长
format_duration() {
    local ms=$1
    local mins=$((ms / 60000))
    local hours=$((mins / 60))
    mins=$((mins % 60))
    [ $hours -gt 0 ] && echo "${hours}h${mins}m" || echo "${mins}m"
}
DURATION=$(format_duration "$DURATION_MS")

# 费用
format_cost() {
    local usd=$1
    [ "$usd" = "0" ] && return
    printf "\$%.2f" "$usd"
}
COST=$(format_cost "$COST_USD")

# Rate Limit (P0)
get_rate_limit() {
    [ "$CFG_SHOW_RATE_LIMIT" != "true" ] && return

    local cache_file="$STATE_DIR/usage_cache.json"
    local now=$(date +%s)
    local need_refresh=true

    # Check cache validity
    if [ -f "$cache_file" ]; then
        local cached
        cached=$(jq -r '[(.timestamp // 0), (.success // false), (.five_hour // -1), (.seven_day // -1), (.resets_at // "")] | @tsv' "$cache_file" 2>/dev/null) || true
        if [ -n "$cached" ]; then
            local cache_ts=$(echo "$cached" | cut -f1)
            local cache_ok=$(echo "$cached" | cut -f2)
            local cache_5h=$(echo "$cached" | cut -f3)
            local cache_7d=$(echo "$cached" | cut -f4)
            local cache_reset=$(echo "$cached" | cut -f5)
            local age=$(( now - cache_ts ))

            local ttl="$CFG_RATE_LIMIT_TTL"
            [ "$cache_ok" != "true" ] && ttl=15

            if [ "$age" -lt "$ttl" ] && [ "$cache_ok" = "true" ]; then
                need_refresh=false
                # Format from cache
                format_rate_limit "$cache_5h" "$cache_7d" "$cache_reset"
                return
            fi
        fi
    fi

    # Refresh from API
    local token
    token=$(security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | jq -r '.claudeAiOauth.accessToken // empty' 2>/dev/null) || true
    [ -z "$token" ] && return

    local response
    response=$(/usr/bin/curl -s --max-time 3 -H "Authorization: Bearer $token" "https://api.anthropic.com/api/oauth/usage" 2>/dev/null) || true
    [ -z "$response" ] && { echo "{\"timestamp\":$now,\"success\":false}" > "$cache_file"; return; }

    local api_parsed
    api_parsed=$(echo "$response" | jq -r '[
        (.five_hour.utilization // -1),
        (.seven_day.utilization // -1),
        (.five_hour.resets_at // "")
    ] | @tsv' 2>/dev/null) || { echo "{\"timestamp\":$now,\"success\":false}" > "$cache_file"; return; }

    local five_h=$(echo "$api_parsed" | cut -f1)
    local seven_d=$(echo "$api_parsed" | cut -f2)
    local resets_at=$(echo "$api_parsed" | cut -f3)
    [ "$five_h" = "-1" ] && { echo "{\"timestamp\":$now,\"success\":false}" > "$cache_file"; return; }

    # Convert utilization (0-1) to percentage
    local five_pct seven_pct
    five_pct=$(awk -v v="$five_h" 'BEGIN{printf "%.0f", v * 100}' 2>/dev/null) || five_pct=0
    seven_pct=$(awk -v v="$seven_d" 'BEGIN{printf "%.0f", v * 100}' 2>/dev/null) || seven_pct=0

    # Write cache
    echo "{\"timestamp\":$now,\"success\":true,\"five_hour\":$five_pct,\"seven_day\":$seven_pct,\"resets_at\":\"$resets_at\"}" > "$cache_file"

    format_rate_limit "$five_pct" "$seven_pct" "$resets_at"
}

format_rate_limit() {
    local five_pct=$1 seven_pct=$2 resets_at=$3

    [ "$five_pct" = "-1" ] && return

    local c5="$GREEN" c7="$GREEN"
    [ "$five_pct" -ge 50 ] 2>/dev/null && c5="$YELLOW"
    [ "$five_pct" -ge 80 ] 2>/dev/null && c5="$RED"
    [ "$seven_pct" -ge 50 ] 2>/dev/null && c7="$YELLOW"
    [ "$seven_pct" -ge 80 ] 2>/dev/null && c7="$RED"

    local result="${c5}5h:${five_pct}%${RESET} ${c7}7d:${seven_pct}%${RESET}"

    # Show reset time if at 100%
    if [ "$five_pct" -ge 100 ] 2>/dev/null && [ -n "$resets_at" ]; then
        local reset_epoch
        reset_epoch=$(date -jf "%Y-%m-%dT%H:%M:%S" "${resets_at%%.*}" +%s 2>/dev/null) || true
        if [ -n "$reset_epoch" ]; then
            local now_epoch=$(date +%s)
            local mins_left=$(( (reset_epoch - now_epoch) / 60 ))
            [ "$mins_left" -lt 0 ] && mins_left=0
            result="${c5}5h:${five_pct}%${RESET} ${RED}↻${mins_left}m${RESET} ${c7}7d:${seven_pct}%${RESET}"
        fi
    fi

    echo -e "$result"
}

RATE_LIMIT=$(get_rate_limit)

# 组装第1行
LINE1=""
[ -n "$MODEL_BADGE" ] && LINE1="${MODEL_BADGE} "
[ -n "$AGENT_BADGE" ] && LINE1="${LINE1}${AGENT_BADGE} "
LINE1="${LINE1}${CONTEXT_BAR} ${CONTEXT_PCT%.*}% ${GRAY}|${RESET} ${PHASE}"
[ -n "$GIT_INFO" ] && LINE1="${LINE1} ${GRAY}|${RESET} ${GIT_INFO}"
LINE1="${LINE1} ${GRAY}|${RESET} ${DURATION}"
[ -n "$COST" ] && LINE1="${LINE1} ${GRAY}${COST}${RESET}"
[ -n "$RATE_LIMIT" ] && LINE1="${LINE1} ${GRAY}|${RESET} ${RATE_LIMIT}"

# Output Speed tok/s (P0)
get_output_speed() {
    [ "$CFG_SHOW_SPEED" != "true" ] && return
    [ "$TOTAL_OUTPUT" = "0" ] && return

    local cache_file="$STATE_DIR/speed_cache.json"
    local now=$(date +%s)

    if [ -f "$cache_file" ]; then
        local prev
        prev=$(jq -r '[(.timestamp // 0), (.output_tokens // 0)] | @tsv' "$cache_file" 2>/dev/null) || true
        if [ -n "$prev" ]; then
            local prev_ts=$(echo "$prev" | cut -f1)
            local prev_tokens=$(echo "$prev" | cut -f2)
            local elapsed=$(( now - prev_ts ))

            if [ "$elapsed" -gt 0 ] && [ "$elapsed" -le "$CFG_SPEED_WINDOW" ]; then
                local delta=$(( TOTAL_OUTPUT - prev_tokens ))
                if [ "$delta" -gt 0 ]; then
                    local speed=$(( delta / elapsed ))
                    local color="$RED"
                    [ "$speed" -gt 10 ] 2>/dev/null && color="$YELLOW"
                    [ "$speed" -gt 30 ] 2>/dev/null && color="$GREEN"
                    # Update cache
                    echo "{\"timestamp\":$now,\"output_tokens\":$TOTAL_OUTPUT}" > "$cache_file"
                    echo -e "${color}⚡${speed} tok/s${RESET}"
                    return
                fi
            fi
        fi
    fi

    # First run or stale — write cache, no display
    echo "{\"timestamp\":$now,\"output_tokens\":$TOTAL_OUTPUT}" > "$cache_file"
}

OUTPUT_SPEED=$(get_output_speed)

# ========== 第2行：Session 生产力 + 工具统计 ==========
get_metrics_line() {
    local parts=""

    # Token 效率 (in/out)
    if [ "$TOTAL_INPUT" -gt 1000 ] 2>/dev/null; then
        local in_k=$((TOTAL_INPUT / 1000))
        local out_k=$((TOTAL_OUTPUT / 1000))
        parts="${GRAY}in:${RESET}${in_k}K ${GRAY}out:${RESET}${out_k}K"
    fi

    # 代码变更量
    if [ "$LINES_ADDED" != "0" ] || [ "$LINES_REMOVED" != "0" ]; then
        [ -n "$parts" ] && parts="${parts} ${GRAY}|${RESET} "
        parts="${parts}${GREEN}+${LINES_ADDED}${RESET} ${RED}-${LINES_REMOVED}${RESET}"
    fi

    # 缓存命中率
    if [ "$INPUT_TOKENS" != "0" ] && [ "$INPUT_TOKENS" -gt 1000 ]; then
        local cache_pct=$((CACHE_READ * 100 / (INPUT_TOKENS + CACHE_READ)))
        if [ "$cache_pct" -gt 0 ]; then
            [ -n "$parts" ] && parts="${parts} ${GRAY}|${RESET} "
            if [ "$cache_pct" -gt 70 ]; then
                parts="${parts}${GREEN}cache:${cache_pct}%${RESET}"
            else
                parts="${parts}${GRAY}cache:${cache_pct}%${RESET}"
            fi
        fi
    fi

    # 工具统计
    local stats_file="$STATE_DIR/tool_stats.json"
    if [ -s "$stats_file" ]; then
        local tool_parsed
        tool_parsed=$(jq -r '[.read // 0, .edit // 0, .bash // 0, .grep // 0] | @tsv' "$stats_file" 2>/dev/null) || true
        if [ -n "$tool_parsed" ]; then
            local r=$(echo "$tool_parsed" | cut -f1)
            local e=$(echo "$tool_parsed" | cut -f2)
            local b=$(echo "$tool_parsed" | cut -f3)
            local g=$(echo "$tool_parsed" | cut -f4)

            local tools=""
            [ "$r" != "0" ] && tools="${tools}${GREEN}R:${r}${RESET} "
            [ "$e" != "0" ] && tools="${tools}${YELLOW}E:${e}${RESET} "
            [ "$b" != "0" ] && tools="${tools}${BLUE}B:${b}${RESET} "
            [ "$g" != "0" ] && tools="${tools}${MAGENTA}G:${g}${RESET} "

            if [ -n "$tools" ]; then
                [ -n "$parts" ] && parts="${parts} ${GRAY}|${RESET} "
                parts="${parts}${tools% }"
            fi
        fi
    fi

    # Output speed
    if [ -n "$OUTPUT_SPEED" ]; then
        [ -n "$parts" ] && parts="${parts} ${GRAY}|${RESET} "
        parts="${parts}${OUTPUT_SPEED}"
    fi

    [ -n "$parts" ] && echo -e "\n${parts}"
}

METRICS_LINE=""
[ "$CFG_SHOW_METRICS" = "true" ] && METRICS_LINE=$(get_metrics_line)

# ========== Running Tool Indicator (P1) ==========
get_running_tool() {
    [ "$CFG_SHOW_RUNNING_TOOL" != "true" ] && return
    [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ] && return

    # Get last 100 lines, find last tool_use and check for matching tool_result
    local tail_data
    tail_data=$(tail -n 100 "$TRANSCRIPT_PATH" 2>/dev/null) || return
    [ -z "$tail_data" ] && return

    # Find last tool_use entry
    local last_tool_use
    last_tool_use=$(echo "$tail_data" | jq -r 'select(.type == "assistant") | .message.content[]? | select(.type == "tool_use") | "\(.id)\t\(.name)\t\(.input.file_path // .input.path // .input.command // .input.pattern // "")"' 2>/dev/null | tail -1) || return
    [ -z "$last_tool_use" ] && return

    local tool_id=$(echo "$last_tool_use" | cut -f1)
    local tool_name=$(echo "$last_tool_use" | cut -f2)
    local tool_arg=$(echo "$last_tool_use" | cut -f3)

    # Check if there's a matching tool_result
    local has_result
    has_result=$(echo "$tail_data" | jq -r --arg tid "$tool_id" 'select(.type == "tool_result") | select(.tool_use_id == $tid) | .tool_use_id' 2>/dev/null | head -1) || true

    # If result exists, tool is done — don't show
    [ -n "$has_result" ] && return

    # Truncate arg to 30 chars
    [ ${#tool_arg} -gt 30 ] && tool_arg="${tool_arg:0:27}..."

    local display="${YELLOW}◐${RESET} ${CYAN}${tool_name}${RESET}"
    [ -n "$tool_arg" ] && display="${display} ${GRAY}${tool_arg}${RESET}"
    echo -e "\n${display}"
}

RUNNING_TOOL=$(get_running_tool)

# ========== 第3行：任务进度 ==========
get_task_line() {
    local task_file="$STATE_DIR/tasks.json"
    [ ! -s "$task_file" ] && return

    local parsed
    parsed=$(jq -r '[.total // 0, .completed // 0, .in_progress // 0, .pending // 0] | @tsv' "$task_file" 2>/dev/null) || return
    [ -z "$parsed" ] && return
    local total=$(echo "$parsed" | cut -f1)
    [ "$total" = "0" ] && return

    local completed=$(echo "$parsed" | cut -f2)
    local in_progress=$(echo "$parsed" | cut -f3)
    local pending=$(echo "$parsed" | cut -f4)
    local pct=$((completed * 100 / total))

    echo -e "\n${GREEN}✓${RESET} ${completed}/${total} ${GRAY}(${pct}%)${RESET} ${YELLOW}→${in_progress}${RESET} ${GRAY}⏳${pending}${RESET}"
}

TASK_LINE=""
[ "$CFG_SHOW_TASKS" = "true" ] && TASK_LINE=$(get_task_line)

# ========== 第4行：Team 状态 ==========
get_team_line() {
    local teams_dir="${HOME}/.claude/teams"
    local mapping_file="${STATE_DIR}/session_teams.json"

    [ ! -d "$teams_dir" ] && return

    # 策略1: 精确 session 映射（优先）
    if [ -f "$mapping_file" ] && [ -n "$SESSION_ID" ]; then
        local team_name
        team_name=$(jq -r --arg sid "$SESSION_ID" '.[$sid] // empty' "$mapping_file" 2>/dev/null)

        if [ -n "$team_name" ]; then
            local config="$teams_dir/$team_name/config.json"
            if [ -f "$config" ]; then
                local team_parsed
                team_parsed=$(jq -r '
                    (.name // "team") as $name |
                    ((.members // []) | length) as $count |
                    [(.members // [])[] | .name] | join(",") |
                    "\($name)\t\($count)\t\(.)"
                ' "$config" 2>/dev/null) || return
                [ -z "$team_parsed" ] && return

                local tname=$(echo "$team_parsed" | cut -f1)
                local tcount=$(echo "$team_parsed" | cut -f2)
                local tnames=$(echo "$team_parsed" | cut -f3)
                [ "$tcount" = "0" ] && return

                [ ${#tnames} -gt 30 ] && tnames="${tnames:0:27}..."
                echo -e "\n${MAGENTA}⚡${RESET} ${WHITE_BOLD}${tname}${RESET} ${GRAY}(${tcount})${RESET} ${CYAN}${tnames}${RESET}"
                return
            fi
        fi
    fi

    # 策略2: 时间过滤（fallback）
    local cutoff=$(($(date +%s) - 300))
    local output=""

    for config in "$teams_dir"/*/config.json; do
        [ ! -f "$config" ] && continue

        local mtime=$(stat -f%m "$config" 2>/dev/null || echo 0)
        [ "$mtime" -lt "$cutoff" ] && continue

        local team_parsed
        team_parsed=$(jq -r '
            (.name // "team") as $name |
            ((.members // []) | length) as $count |
            [(.members // [])[] | .name] | join(",") |
            "\($name)\t\($count)\t\(.)"
        ' "$config" 2>/dev/null) || continue
        [ -z "$team_parsed" ] && continue

        local tname=$(echo "$team_parsed" | cut -f1)
        local tcount=$(echo "$team_parsed" | cut -f2)
        local tnames=$(echo "$team_parsed" | cut -f3)
        [ "$tcount" = "0" ] && continue

        [ ${#tnames} -gt 30 ] && tnames="${tnames:0:27}..."
        output="${output}\n${MAGENTA}⚡${RESET} ${WHITE_BOLD}${tname}${RESET} ${GRAY}(${tcount})${RESET} ${CYAN}${tnames}${RESET}"
    done

    [ -n "$output" ] && echo -e "$output"
}

TEAM_LINE=""
[ "$CFG_SHOW_TEAM" = "true" ] && TEAM_LINE=$(get_team_line)

# ========== 第5行：Agent 状态 ==========
get_agent_line() {
    local agent_file="$STATE_DIR/agents.json"
    [ ! -s "$agent_file" ] && return

    local lines
    lines=$(jq -r '(.active // [])[] | "\(.name)\t\(.task[:25])\t\(.duration)"' "$agent_file" 2>/dev/null) || return
    [ -z "$lines" ] && return

    local output=""
    while IFS=$'\t' read -r name task duration; do
        output="${output}\n${CYAN}▸ ${name}:${RESET} ${task} ${GRAY}(${duration}s)${RESET}"
    done <<< "$lines"

    [ -n "$output" ] && echo -e "$output"
}

AGENT_LINE=""
[ "$CFG_SHOW_AGENTS" = "true" ] && AGENT_LINE=$(get_agent_line)

# ========== Session 轮数 ==========
get_turn_count() {
    local sessions_dir="${HOME}/.claude/state/braintrust_sessions"
    [ ! -d "$sessions_dir" ] && return

    # 优先用 session_id 精确匹配，否则取最新文件
    local session_file=""
    if [ -n "$SESSION_ID" ] && [ -f "$sessions_dir/${SESSION_ID}.json" ]; then
        session_file="$sessions_dir/${SESSION_ID}.json"
    else
        session_file=$(ls -t "$sessions_dir"/*.json 2>/dev/null | head -1)
    fi
    [ -z "$session_file" ] || [ ! -f "$session_file" ] && return

    local turns
    turns=$(jq -r '.turn_count // 0' "$session_file" 2>/dev/null) || return
    [ "$turns" = "0" ] && return
    echo "$turns"
}

TURN_COUNT=$(get_turn_count)

# ========== 活跃 Ledger ==========
get_ledger_info() {
    local ledger_dir="thoughts/ledgers"
    [ ! -d "$ledger_dir" ] && return

    # 取最新修改的 ledger 文件
    local latest
    latest=$(ls -t "$ledger_dir"/*.md 2>/dev/null | head -1)
    [ -z "$latest" ] && return

    # 提取标题（第一行 # 后面的内容）
    local title
    title=$(head -1 "$latest" | sed -E 's/^#+ *//')
    [ -z "$title" ] && return

    # 提取当前阶段（查找 [→] 标记）
    local phase
    phase=$(grep -m1 '\[→\]' "$latest" 2>/dev/null | sed 's/.*\[→\] *//' | head -c 30)

    # 截断标题
    [ ${#title} -gt 25 ] && title="${title:0:22}..."

    if [ -n "$phase" ]; then
        echo "${title} ${GRAY}→ ${phase}${RESET}"
    else
        echo "$title"
    fi
}

LEDGER_INFO=$(get_ledger_info)

# ========== 组装 Session 信息行 ==========
get_session_line() {
    local parts=""

    # Session 轮数
    if [ -n "$TURN_COUNT" ]; then
        local color="$GRAY"
        [ "$TURN_COUNT" -gt 20 ] 2>/dev/null && color="$YELLOW"
        [ "$TURN_COUNT" -gt 40 ] 2>/dev/null && color="$RED"
        parts="${color}turn:${TURN_COUNT}${RESET}"
    fi

    # 活跃 Ledger
    if [ -n "$LEDGER_INFO" ]; then
        [ -n "$parts" ] && parts="${parts} ${GRAY}|${RESET} "
        parts="${parts}${CYAN}▶${RESET} ${LEDGER_INFO}"
    fi

    [ -n "$parts" ] && echo -e "\n${parts}"
}

SESSION_LINE=""
[ "$CFG_SHOW_SESSION" = "true" ] && SESSION_LINE=$(get_session_line)

# ========== Extra Command (P1) ==========
# SECURITY: $EXTRA_CMD is sourced from the user's own statusline config in
# ~/.claude/settings.json. It is a static, trusted string set by the machine owner.
# Do NOT accept this value from untrusted input (stdin, API, transcript, etc.).
get_extra_cmd() {
    [ -z "$EXTRA_CMD" ] && return

    local output
    if command -v gtimeout >/dev/null 2>&1; then
        output=$(gtimeout 3 bash -c "$EXTRA_CMD" 2>/dev/null | head -c 10240) || return
    else
        # macOS fallback: no timeout binary, use perl alarm
        output=$(perl -e '
            eval {
                local $SIG{ALRM} = sub { die "timeout" };
                alarm(3);
                my $r = `$ARGV[0] 2>/dev/null`;
                alarm(0);
                print $r;
            };
        ' "$EXTRA_CMD" 2>/dev/null | head -c 10240) || return
    fi
    [ -z "$output" ] && return

    local label
    label=$(echo "$output" | jq -r '.label // empty' 2>/dev/null) || return
    [ -z "$label" ] && return

    # Truncate to 50 chars
    [ ${#label} -gt 50 ] && label="${label:0:47}..."
    echo -e " ${GRAY}|${RESET} ${GRAY}${label}${RESET}"
}

EXTRA_OUTPUT=$(get_extra_cmd)

# ========== 输出 ==========
echo -e "${LINE1}${EXTRA_OUTPUT}${METRICS_LINE}${RUNNING_TOOL}${TASK_LINE}${SESSION_LINE}${TEAM_LINE}${AGENT_LINE}"
