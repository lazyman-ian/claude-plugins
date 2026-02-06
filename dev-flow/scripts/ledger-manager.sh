#!/bin/bash
# ledger-manager.sh - Manage continuity ledgers for dev workflow

set -euo pipefail

LEDGERS_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/thoughts/ledgers"
ARCHIVE_DIR="$LEDGERS_DIR/archive"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage
usage() {
    cat <<EOF
Usage: $0 COMMAND [ARGS]

Commands:
  create TASK-XXX BRANCH_NAME     Create a new ledger
  update HASH MESSAGE             Update ledger after commit
  add-pr PR_URL                   Add PR link to ledger
  archive                         Archive completed ledger
  status                          Show active ledger status
  list                            List all ledgers
  current                         Get current ledger path
  summary                         One-line summary for SessionStart
  stats                           Show completion statistics
  search KEYWORD                  Search ledgers (active + archived)
  check-pr                        Check if PR is merged (suggest archive)
  time                            Show task duration and timing
  report [weekly|daily]           Generate work report from ledgers

Examples:
  $0 create TASK-945 feature/TASK-945-add-recaptcha
  $0 update abc123 "feat(auth): add reCAPTCHA"
  $0 add-pr https://github.com/org/repo/pull/123
  $0 archive
  $0 search "reCAPTCHA"
  $0 stats
  $0 time
  $0 report weekly
EOF
    exit 1
}

# Get current branch
get_current_branch() {
    git branch --show-current 2>/dev/null || echo "master"
}

# Extract TASK number from branch name
get_task_from_branch() {
    local branch="$1"
    if [[ "$branch" =~ TASK-([0-9]+) ]]; then
        echo "TASK-${BASH_REMATCH[1]}"
    fi
}

# Find active ledger (based on current branch)
find_active_ledger() {
    local branch=$(get_current_branch)
    local task=$(get_task_from_branch "$branch")

    if [[ -z "$task" ]]; then
        return 1
    fi

    # Find ledger file
    local ledger=$(find "$LEDGERS_DIR" -maxdepth 1 -name "${task}-*.md" 2>/dev/null | head -1)

    if [[ -n "$ledger" ]]; then
        echo "$ledger"
        return 0
    fi

    return 1
}

# Create new ledger
create_ledger() {
    local task="$1"
    local branch="$2"

    if [[ ! "$task" =~ ^TASK-[0-9]+ ]]; then
        echo -e "${RED}❌ Invalid TASK format: $task${NC}" >&2
        echo "   Expected: TASK-XXX" >&2
        return 1
    fi

    # Extract description from branch name
    local description=$(echo "$branch" | sed -E 's/^(feature|fix|refactor|perf|test|docs|hotfix)\/TASK-[0-9]+-//; s/-/ /g' | sed 's/\b\(.\)/\u\1/g')

    # Generate ledger filename
    local ledger_file="$LEDGERS_DIR/${task}-${description// /-}.md"

    # Check if already exists
    if [[ -f "$ledger_file" ]]; then
        echo -e "${YELLOW}⚠️  Ledger already exists: $ledger_file${NC}" >&2
        return 0
    fi

    # Ensure directory exists
    mkdir -p "$LEDGERS_DIR"

    # Create ledger from template
    cat > "$ledger_file" <<EOF
# Session: ${task}-${description// /-}
Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

## Goal
${description}

## Constraints
- 遵循项目规范
- 通过 make check 验证
- 完整的测试覆盖

## Key Decisions
<!-- 记录重要决策和理由 -->

## State
- Done:
  - [ ] 初始化项目结构
- Now:
  - [→] 开发功能
- Next:
  - [ ] 代码审查
  - [ ] 部署测试

## Open Questions
<!-- 待解决的问题 -->

## Working Set
- Branch: \`$branch\`
- Files:
  <!-- 相关文件列表 -->

## Development Notes
### $(date +"%Y-%m-%d")
- 🚀 Started: $task

EOF

    echo -e "${GREEN}✅ Created ledger: $ledger_file${NC}"
    echo -e "${BLUE}📝 Next: 编辑 ledger 添加具体任务${NC}"

    return 0
}

# Update ledger after commit
update_ledger() {
    local commit_hash="$1"
    local commit_message="$2"

    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger found${NC}" >&2
        return 0
    fi

    # Update timestamp
    sed -i '' "s/^Updated: .*/Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")/" "$ledger"

    # Add commit to development notes
    local today=$(date +"%Y-%m-%d")

    # Check if today's section exists
    if ! grep -q "^### $today" "$ledger"; then
        # Add new date section before the last line
        sed -i '' '$a\
### '"$today"'\
- 📝 Commit: `'"$commit_hash"'` - '"$commit_message"'\
' "$ledger"
    else
        # Add to existing date section
        sed -i '' "/^### $today/a\\
- 📝 Commit: \`$commit_hash\` - $commit_message\\
" "$ledger"
    fi

    # Smart checkbox matching - try to auto-complete matching tasks
    local matched_task=""
    matched_task=$(smart_checkbox_match "$ledger" "$commit_message")

    echo -e "${GREEN}✅ Updated ledger: $ledger${NC}"
    if [[ -n "$matched_task" ]]; then
        echo -e "${GREEN}✅ Auto-completed: $matched_task${NC}"
    else
        echo -e "${BLUE}💡 手动更新 State 中的 checkbox${NC}"
    fi
}

# Smart checkbox matching - find and mark matching tasks as done
smart_checkbox_match() {
    local ledger="$1"
    local commit_message="$2"

    # Extract keywords from commit message (remove type prefix)
    local keywords=$(echo "$commit_message" | sed -E 's/^(feat|fix|refactor|perf|chore|docs|test|ci)\([^)]*\):\s*//' | tr '[:upper:]' '[:lower:]')

    # Common keyword mappings
    local matched=""

    # Extract key terms from commit
    local terms=()
    if echo "$keywords" | grep -iq "add\|create\|implement"; then
        terms+=("创建" "添加" "实现" "add" "create" "implement")
    fi
    if echo "$keywords" | grep -iq "fix\|resolve\|bug"; then
        terms+=("修复" "解决" "fix" "bug")
    fi
    if echo "$keywords" | grep -iq "refactor\|restructure\|reorganize"; then
        terms+=("重构" "refactor" "restructure")
    fi
    if echo "$keywords" | grep -iq "test\|spec"; then
        terms+=("测试" "test" "spec")
    fi
    if echo "$keywords" | grep -iq "ui\|interface\|view\|button\|screen"; then
        terms+=("UI" "界面" "视图" "按钮" "ui" "interface" "view")
    fi
    if echo "$keywords" | grep -iq "api\|network\|request\|response"; then
        terms+=("API" "网络" "请求" "api" "network")
    fi
    if echo "$keywords" | grep -iq "auth\|login\|password\|token"; then
        terms+=("认证" "登录" "auth" "login")
    fi
    if echo "$keywords" | grep -iq "config\|setting\|option"; then
        terms+=("配置" "设置" "config" "setting")
    fi
    if echo "$keywords" | grep -iq "manager\|service\|handler"; then
        terms+=("Manager" "Service" "Handler" "manager" "service")
    fi
    if echo "$keywords" | grep -iq "recaptcha\|captcha"; then
        terms+=("reCAPTCHA" "Recaptcha" "captcha")
    fi
    if echo "$keywords" | grep -iq "sdk\|framework\|library"; then
        terms+=("SDK" "集成" "sdk" "framework")
    fi

    # Find pending checkboxes that match any term
    local pending_tasks=$(grep -n '^\s*- \[ \]' "$ledger" 2>/dev/null || true)
    local in_progress_tasks=$(grep -n '^\s*- \[→\]' "$ledger" 2>/dev/null || true)

    # Check in-progress tasks first (higher priority)
    for task_line in $in_progress_tasks; do
        local line_num=$(echo "$task_line" | cut -d: -f1)
        local task_text=$(echo "$task_line" | cut -d: -f2-)

        for term in "${terms[@]}"; do
            if echo "$task_text" | grep -iq "$term"; then
                # Found a match - mark as done
                sed -i '' "${line_num}s/\[→\]/[x]/" "$ledger"
                matched=$(echo "$task_text" | sed 's/.*\[→\] //')
                echo "$matched"
                return 0
            fi
        done

        # Also try matching specific words from commit
        local commit_words=$(echo "$keywords" | tr ' -' '\n' | grep -E '^.{3,}$')
        for word in $commit_words; do
            if echo "$task_text" | grep -iq "$word"; then
                sed -i '' "${line_num}s/\[→\]/[x]/" "$ledger"
                matched=$(echo "$task_text" | sed 's/.*\[→\] //')
                echo "$matched"
                return 0
            fi
        done
    done

    # Then check pending tasks
    for task_line in $pending_tasks; do
        local line_num=$(echo "$task_line" | cut -d: -f1)
        local task_text=$(echo "$task_line" | cut -d: -f2-)

        for term in "${terms[@]}"; do
            if echo "$task_text" | grep -iq "$term"; then
                # Found a match - mark as done
                sed -i '' "${line_num}s/\[ \]/[x]/" "$ledger"
                matched=$(echo "$task_text" | sed 's/.*\[ \] //')
                echo "$matched"
                return 0
            fi
        done
    done

    echo ""
}

# Add PR link to ledger
add_pr_link() {
    local pr_url="$1"

    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger found${NC}" >&2
        return 0
    fi

    # Update timestamp
    sed -i '' "s/^Updated: .*/Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")/" "$ledger"

    # Add PR link to Working Set
    if ! grep -q "^- PR:" "$ledger"; then
        # Add after Branch line
        sed -i '' "/^- Branch:/a\\
- PR: <$pr_url>\\
" "$ledger"
    else
        # Update existing PR line
        sed -i '' "s|^- PR: .*|- PR: <$pr_url>|" "$ledger"
    fi

    echo -e "${GREEN}✅ Added PR link to ledger${NC}"
}

# Archive completed ledger
archive_ledger() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger found${NC}" >&2
        return 0
    fi

    # Create archive directory
    mkdir -p "$ARCHIVE_DIR"

    # Move to archive
    local filename=$(basename "$ledger")
    mv "$ledger" "$ARCHIVE_DIR/$filename"

    echo -e "${GREEN}✅ Archived ledger: $ARCHIVE_DIR/$filename${NC}"
}

# Show ledger status
show_status() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger${NC}"
        return 0
    fi

    echo -e "${GREEN}📋 Active Ledger:${NC} $(basename "$ledger")"
    echo ""

    # Show Goal
    echo -e "${BLUE}## Goal${NC}"
    sed -n '/^## Goal/,/^## /p' "$ledger" | sed '1d;$d'
    echo ""

    # Show State
    echo -e "${BLUE}## State${NC}"
    sed -n '/^## State/,/^## /p' "$ledger" | sed '1d;$d' | grep -E '^\- (Done|Now|Next):|^  - \[' || true
    echo ""

    # Show Open Questions
    local questions=$(sed -n '/^## Open Questions/,/^## /p' "$ledger" | sed '1d;$d' | grep -v '^<!--' || true)
    if [[ -n "$questions" ]]; then
        echo -e "${YELLOW}## Open Questions${NC}"
        echo "$questions"
        echo ""
    fi
}

# List all ledgers
list_ledgers() {
    echo -e "${GREEN}📚 All Ledgers:${NC}"
    echo ""

    # Active ledgers
    local active=$(find "$LEDGERS_DIR" -maxdepth 1 -name "TASK-*.md" 2>/dev/null | sort)
    if [[ -n "$active" ]]; then
        echo -e "${BLUE}Active:${NC}"
        echo "$active" | while read -r file; do
            echo "  - $(basename "$file")"
        done
        echo ""
    fi

    # Archived ledgers
    if [[ -d "$ARCHIVE_DIR" ]]; then
        local archived=$(find "$ARCHIVE_DIR" -name "TASK-*.md" 2>/dev/null | sort)
        if [[ -n "$archived" ]]; then
            echo -e "${YELLOW}Archived:${NC}"
            echo "$archived" | while read -r file; do
                echo "  - $(basename "$file")"
            done
        fi
    fi
}

# Get current ledger path (for scripts)
get_current_ledger() {
    find_active_ledger || true
}

# One-line summary for SessionStart
show_summary() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        return 0
    fi

    local task=$(get_task_from_branch "$(get_current_branch)")
    local goal=$(sed -n '/^## Goal/,/^## /p' "$ledger" | sed '1d;$d' | tr '\n' ' ' | head -c 40)

    # Count checkboxes using grep -E for portable regex
    local done_count=$(grep -E '^\s*- \[x\]' "$ledger" 2>/dev/null | wc -l | xargs)
    local total_count=$(grep -E '^\s*- \[.\]' "$ledger" 2>/dev/null | wc -l | xargs)
    local current=$(grep -E '^\s*- \[→\]' "$ledger" 2>/dev/null | head -1 | sed 's/.*\[→\] //' | head -c 30 || true)

    # Ensure numbers are valid integers
    done_count=$((done_count + 0))
    total_count=$((total_count + 0))

    if [[ $total_count -gt 0 ]]; then
        echo "📋 ${task}: ${goal}... (${done_count}/${total_count})"
        if [[ -n "$current" ]]; then
            echo "   [→] ${current}..."
        fi
    else
        echo "📋 ${task}: ${goal}..."
    fi
}

# Show completion statistics
show_stats() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger${NC}"
        return 0
    fi

    local task=$(get_task_from_branch "$(get_current_branch)")

    # Count checkboxes using grep -E for portable regex
    local done_count=$(grep -E '^\s*- \[x\]' "$ledger" 2>/dev/null | wc -l | xargs)
    local now_count=$(grep -E '^\s*- \[→\]' "$ledger" 2>/dev/null | wc -l | xargs)
    local pending_count=$(grep -E '^\s*- \[ \]' "$ledger" 2>/dev/null | wc -l | xargs)

    # Ensure numbers are valid integers
    done_count=$((done_count + 0))
    now_count=$((now_count + 0))
    pending_count=$((pending_count + 0))

    local total_count=$((done_count + now_count + pending_count))

    echo -e "${GREEN}📊 $task Progress:${NC}"
    echo ""

    if [[ $total_count -gt 0 ]]; then
        local percent=$((done_count * 100 / total_count))
        echo "  Done:    ${done_count}/${total_count} (${percent}%)"
        echo "  Now:     ${now_count} task(s)"
        echo "  Pending: ${pending_count} task(s)"
        echo ""

        # Progress bar (20 chars wide)
        local filled=$((percent / 5))
        local empty=$((20 - filled))
        printf "  "
        for ((i=0; i<filled; i++)); do printf "█"; done
        for ((i=0; i<empty; i++)); do printf "░"; done
        echo " ${percent}%"
    else
        echo "  No tasks tracked in State section"
    fi

    # Show recent commits
    local commits=$(grep '📝 Commit:' "$ledger" 2>/dev/null | wc -l | xargs)
    commits=$((commits + 0))
    if [[ $commits -gt 0 ]]; then
        echo ""
        echo -e "  ${BLUE}📝 Commits: ${commits}${NC}"
    fi

    # Check for PR
    local pr_url=$(grep '^- PR:' "$ledger" 2>/dev/null | sed 's/.*<\(.*\)>.*/\1/' || true)
    if [[ -n "$pr_url" ]]; then
        echo -e "  ${BLUE}🔗 PR: ${pr_url}${NC}"
    fi
}

# Search ledgers (active + archived)
search_ledgers() {
    local keyword="$1"

    if [[ -z "$keyword" ]]; then
        echo -e "${RED}❌ Please provide a search keyword${NC}" >&2
        return 1
    fi

    echo -e "${GREEN}🔍 Search Results for \"$keyword\":${NC}"
    echo ""

    local found=0

    # Search active ledgers
    if [[ -d "$LEDGERS_DIR" ]]; then
        local active_results=$(grep -il "$keyword" "$LEDGERS_DIR"/TASK-*.md 2>/dev/null || true)
        if [[ -n "$active_results" ]]; then
            echo -e "${BLUE}Active:${NC}"
            echo "$active_results" | while read -r file; do
                local goal=$(sed -n '/^## Goal/,/^## /p' "$file" | sed '1d;$d' | tr '\n' ' ' | head -c 50)
                echo "  - $(basename "$file")"
                echo "    └─ $goal"
            done
            found=1
            echo ""
        fi
    fi

    # Search archived ledgers
    if [[ -d "$ARCHIVE_DIR" ]]; then
        local archive_results=$(grep -il "$keyword" "$ARCHIVE_DIR"/TASK-*.md 2>/dev/null || true)
        if [[ -n "$archive_results" ]]; then
            echo -e "${YELLOW}Archived:${NC}"
            echo "$archive_results" | while read -r file; do
                local updated=$(grep '^Updated:' "$file" | head -1 | sed 's/Updated: //' | cut -d'T' -f1)
                echo "  - $(basename "$file") ($updated)"
            done
            found=1
        fi
    fi

    if [[ $found -eq 0 ]]; then
        echo "  No ledgers found matching \"$keyword\""
    fi
}

# Check if PR is merged (suggest archive)
check_pr_status() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger${NC}"
        return 0
    fi

    local task=$(get_task_from_branch "$(get_current_branch)")
    local pr_url=$(grep '^- PR:' "$ledger" 2>/dev/null | sed 's/.*<\(.*\)>.*/\1/' || true)

    if [[ -z "$pr_url" ]]; then
        echo -e "${BLUE}ℹ️  No PR linked to this ledger${NC}"
        return 0
    fi

    # Extract PR number from URL
    local pr_number=$(echo "$pr_url" | grep -oE '[0-9]+$' || true)
    if [[ -z "$pr_number" ]]; then
        echo -e "${YELLOW}⚠️  Could not extract PR number from URL${NC}"
        return 0
    fi

    # Check PR status using gh
    if command -v gh &> /dev/null; then
        local pr_state=$(gh pr view "$pr_number" --json state -q .state 2>/dev/null || echo "UNKNOWN")

        case "$pr_state" in
            MERGED)
                echo -e "${GREEN}✅ PR #${pr_number} is MERGED${NC}"
                echo -e "${YELLOW}💡 Suggest: /dev ledger archive ${task}${NC}"
                ;;
            CLOSED)
                echo -e "${RED}❌ PR #${pr_number} is CLOSED (not merged)${NC}"
                ;;
            OPEN)
                echo -e "${BLUE}🔄 PR #${pr_number} is OPEN${NC}"
                ;;
            *)
                echo -e "${YELLOW}⚠️  Could not determine PR status${NC}"
                ;;
        esac
    else
        echo -e "${YELLOW}⚠️  gh CLI not available, cannot check PR status${NC}"
    fi
}

# Show task duration and timing
show_time() {
    local ledger=$(find_active_ledger)
    if [[ -z "$ledger" ]]; then
        echo -e "${YELLOW}⚠️  No active ledger${NC}"
        return 0
    fi

    local task=$(get_task_from_branch "$(get_current_branch)")

    # Get start date from ledger (first date in Development Notes)
    local start_date=$(grep -E '^### [0-9]{4}-[0-9]{2}-[0-9]{2}' "$ledger" 2>/dev/null | tail -1 | sed 's/### //')

    # Get last update timestamp
    local last_update=$(grep '^Updated:' "$ledger" | head -1 | sed 's/Updated: //' | cut -d'T' -f1)

    echo -e "${GREEN}⏱️  $task Time:${NC}"
    echo ""

    if [[ -n "$start_date" ]]; then
        echo "  Started:    $start_date"

        # Calculate duration
        local start_epoch=$(date -j -f "%Y-%m-%d" "$start_date" "+%s" 2>/dev/null || date -d "$start_date" "+%s" 2>/dev/null)
        local now_epoch=$(date "+%s")

        if [[ -n "$start_epoch" ]]; then
            local diff_seconds=$((now_epoch - start_epoch))
            local days=$((diff_seconds / 86400))
            local hours=$(( (diff_seconds % 86400) / 3600 ))

            if [[ $days -gt 0 ]]; then
                echo "  Duration:   ${days}d ${hours}h"
            else
                echo "  Duration:   ${hours}h"
            fi
        fi
    fi

    if [[ -n "$last_update" ]]; then
        echo "  Last Update: $last_update"
    fi

    # Count commits
    local commits=$(grep '📝 Commit:' "$ledger" 2>/dev/null | wc -l | xargs)
    commits=$((commits + 0))

    if [[ $commits -gt 0 ]]; then
        echo "  Commits:    $commits"

        # Calculate average time between commits
        if [[ -n "$start_date" && $commits -gt 1 ]]; then
            local now_epoch=$(date "+%s")
            local start_epoch=$(date -j -f "%Y-%m-%d" "$start_date" "+%s" 2>/dev/null || date -d "$start_date" "+%s" 2>/dev/null)
            if [[ -n "$start_epoch" ]]; then
                local total_hours=$(( (now_epoch - start_epoch) / 3600 ))
                local avg_hours=$((total_hours / commits))
                echo "  Avg/Commit: ${avg_hours}h"
            fi
        fi
    fi

    # Show completion status
    local done_count=$(grep -E '^\s*- \[x\]' "$ledger" 2>/dev/null | wc -l | xargs)
    local total_count=$(grep -E '^\s*- \[.\]' "$ledger" 2>/dev/null | wc -l | xargs)
    done_count=$((done_count + 0))
    total_count=$((total_count + 0))

    if [[ $total_count -gt 0 ]]; then
        local pct=$((done_count * 100 / total_count))
        echo ""
        echo "  Progress:   ${done_count}/${total_count} (${pct}%)"
    fi
}

# Generate work report from ledgers
generate_report() {
    local report_type="${1:-weekly}"
    local today=$(date +"%Y-%m-%d")
    local report_start=""

    case "$report_type" in
        daily)
            report_start="$today"
            echo -e "${GREEN}📊 Daily Report - $today${NC}"
            ;;
        weekly)
            # Get date 7 days ago
            report_start=$(date -v-7d +"%Y-%m-%d" 2>/dev/null || date -d "7 days ago" +"%Y-%m-%d" 2>/dev/null)
            echo -e "${GREEN}📊 Weekly Report - $report_start to $today${NC}"
            ;;
        *)
            echo -e "${RED}Unknown report type: $report_type${NC}" >&2
            echo "Usage: $0 report [weekly|daily]" >&2
            return 1
            ;;
    esac

    echo ""
    echo "═══════════════════════════════════════════════════"

    # Collect data from all active ledgers
    local total_commits=0
    local total_done=0
    local active_tasks=0
    local task_summaries=""

    # Process active ledgers
    for ledger in "$LEDGERS_DIR"/TASK-*.md; do
        [[ ! -f "$ledger" ]] && continue

        local task_name=$(basename "$ledger" .md)
        local goal=$(sed -n '/^## Goal/,/^## /p' "$ledger" | sed '1d;$d' | tr '\n' ' ' | head -c 50)

        # Count commits in period
        local commits_in_period=0
        while IFS= read -r line; do
            if [[ "$line" =~ ^###\ ([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
                local date="${BASH_REMATCH[1]}"
                if [[ ! "$date" < "$report_start" ]] && [[ ! "$date" > "$today" ]]; then
                    # Count commits under this date
                    commits_in_period=$((commits_in_period + 1))
                fi
            fi
        done < <(grep -E '^(### [0-9]|📝 Commit)' "$ledger" 2>/dev/null || true)

        # Actually count commits more accurately
        commits_in_period=$(grep '📝 Commit:' "$ledger" 2>/dev/null | wc -l | xargs)
        commits_in_period=$((commits_in_period + 0))

        # Count checkboxes
        local done=$(grep -E '^\s*- \[x\]' "$ledger" 2>/dev/null | wc -l | xargs)
        local total=$(grep -E '^\s*- \[.\]' "$ledger" 2>/dev/null | wc -l | xargs)
        done=$((done + 0))
        total=$((total + 0))

        total_commits=$((total_commits + commits_in_period))
        total_done=$((total_done + done))
        active_tasks=$((active_tasks + 1))

        # Build task summary
        if [[ $total -gt 0 ]]; then
            local pct=$((done * 100 / total))
            task_summaries+="  📋 $task_name\n"
            task_summaries+="     $goal\n"
            task_summaries+="     Progress: ${done}/${total} (${pct}%) | Commits: $commits_in_period\n\n"
        else
            task_summaries+="  📋 $task_name\n"
            task_summaries+="     $goal\n"
            task_summaries+="     Commits: $commits_in_period\n\n"
        fi
    done

    # Process archived ledgers (completed in period)
    local archived_count=0
    if [[ -d "$ARCHIVE_DIR" ]]; then
        for ledger in "$ARCHIVE_DIR"/TASK-*.md; do
            [[ ! -f "$ledger" ]] && continue

            local updated=$(grep '^Updated:' "$ledger" | head -1 | sed 's/Updated: //' | cut -d'T' -f1)
            if [[ -n "$updated" ]] && [[ ! "$updated" < "$report_start" ]] && [[ ! "$updated" > "$today" ]]; then
                archived_count=$((archived_count + 1))
                local task_name=$(basename "$ledger" .md)
                task_summaries+="  ✅ $task_name (Completed)\n"
            fi
        done
    fi

    echo ""
    echo -e "${BLUE}## Summary${NC}"
    echo "  Active Tasks:    $active_tasks"
    echo "  Completed Tasks: $archived_count"
    echo "  Total Commits:   $total_commits"
    echo "  Tasks Done:      $total_done items"
    echo ""

    echo -e "${BLUE}## Tasks${NC}"
    echo -e "$task_summaries"

    echo "═══════════════════════════════════════════════════"

    # Generate markdown version for copy
    echo ""
    echo -e "${YELLOW}📋 Markdown (copy-paste):${NC}"
    echo ""
    echo "## ${report_type^} Report ($report_start ~ $today)"
    echo ""
    echo "### Summary"
    echo "- Active Tasks: $active_tasks"
    echo "- Completed: $archived_count"
    echo "- Commits: $total_commits"
    echo ""
    echo "### Tasks"

    for ledger in "$LEDGERS_DIR"/TASK-*.md; do
        [[ ! -f "$ledger" ]] && continue
        local task_name=$(basename "$ledger" .md)
        local goal=$(sed -n '/^## Goal/,/^## /p' "$ledger" | sed '1d;$d' | tr '\n' ' ' | head -c 50)
        local done=$(grep -E '^\s*- \[x\]' "$ledger" 2>/dev/null | wc -l | xargs)
        local total=$(grep -E '^\s*- \[.\]' "$ledger" 2>/dev/null | wc -l | xargs)
        done=$((done + 0))
        total=$((total + 0))

        if [[ $total -gt 0 ]]; then
            local pct=$((done * 100 / total))
            echo "- **$task_name**: $goal... (${pct}%)"
        else
            echo "- **$task_name**: $goal..."
        fi
    done
}

# Main
main() {
    local command="${1:-}"

    if [[ -z "$command" ]]; then
        usage
    fi

    case "$command" in
        create)
            if [[ $# -lt 3 ]]; then
                echo "Usage: $0 create TASK-XXX BRANCH_NAME" >&2
                exit 1
            fi
            create_ledger "$2" "$3"
            ;;
        update)
            if [[ $# -lt 3 ]]; then
                echo "Usage: $0 update HASH MESSAGE" >&2
                exit 1
            fi
            update_ledger "$2" "$3"
            ;;
        add-pr)
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 add-pr PR_URL" >&2
                exit 1
            fi
            add_pr_link "$2"
            ;;
        archive)
            archive_ledger
            ;;
        status)
            show_status
            ;;
        list)
            list_ledgers
            ;;
        current)
            get_current_ledger
            ;;
        summary)
            show_summary
            ;;
        stats)
            show_stats
            ;;
        search)
            if [[ $# -lt 2 ]]; then
                echo "Usage: $0 search KEYWORD" >&2
                exit 1
            fi
            search_ledgers "$2"
            ;;
        check-pr)
            check_pr_status
            ;;
        time)
            show_time
            ;;
        report)
            generate_report "${2:-weekly}"
            ;;
        *)
            echo "Unknown command: $command" >&2
            usage
            ;;
    esac
}

main "$@"
