#!/bin/bash
# Relaxed: -e can cause issues with git/jq commands
set -o pipefail

# Self-contained: use script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Get session type from stdin (pass through)
INPUT=$(cat)
SESSION_TYPE=$(echo "$INPUT" | jq -r '.type // .source // "unknown"' 2>/dev/null || echo "unknown")
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"' 2>/dev/null || echo "main")  # v2.1.2+: main, subagent, etc.

# Skip heavy processing for subagents (v2.1.2 optimization)
if [[ "$AGENT_TYPE" != "main" && "$AGENT_TYPE" != "unknown" ]]; then
    echo '{"result": "continue"}'
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# === Auto-setup (idempotent, fast) ===
# Create .dev-flow.json if missing
if [[ ! -f "$PROJECT_DIR/.dev-flow.json" ]]; then
    _P="unknown" _F="echo 'Configure fix command'" _C="echo 'Configure check command'" _S="[]"
    if [[ -f "$PROJECT_DIR/Package.swift" ]] || ls "$PROJECT_DIR"/*.xcodeproj &>/dev/null; then
        _P="ios" _F="swiftlint --fix && swiftformat ." _C="swiftlint" _S='["ui","api","models","utils","tests"]'
    elif [[ -f "$PROJECT_DIR/build.gradle" || -f "$PROJECT_DIR/build.gradle.kts" ]]; then
        _P="android" _F="./gradlew ktlintFormat" _C="./gradlew ktlintCheck" _S='["ui","api","data","domain","utils"]'
    elif [[ -f "$PROJECT_DIR/package.json" ]]; then
        _P="node" _F="npm run lint:fix || npx eslint --fix ." _C="npm run lint || npx eslint ." _S='["api","components","utils","hooks","services"]'
    elif [[ -f "$PROJECT_DIR/pyproject.toml" || -f "$PROJECT_DIR/requirements.txt" ]]; then
        _P="python" _F="black . && ruff check --fix ." _C="ruff check . && mypy ." _S='["api","models","utils","tests"]'
    elif [[ -f "$PROJECT_DIR/go.mod" ]]; then
        _P="go" _F="gofmt -w . && golangci-lint run --fix" _C="golangci-lint run" _S='["cmd","pkg","internal","api"]'
    elif [[ -f "$PROJECT_DIR/Cargo.toml" ]]; then
        _P="rust" _F="cargo fmt && cargo clippy --fix --allow-dirty" _C="cargo clippy" _S='["src","lib","bin","tests"]'
    fi
    jq -n --arg p "$_P" --arg f "$_F" --arg c "$_C" --argjson s "$_S" \
        '{platform:$p,commands:{fix:$f,check:$c},scopes:$s,memory:{tier:0}}' > "$PROJECT_DIR/.dev-flow.json"
fi
# Create thoughts directories + gitignore
mkdir -p "$PROJECT_DIR/thoughts/ledgers" "$PROJECT_DIR/thoughts/handoffs" "$PROJECT_DIR/thoughts/plans" "$PROJECT_DIR/thoughts/shared/plans" 2>/dev/null || true
if [[ ! -f "$PROJECT_DIR/thoughts/.gitignore" ]]; then
    printf '*.local.md\n.DS_Store\n' > "$PROJECT_DIR/thoughts/.gitignore"
fi
# Daily cache cleanup (frequency-guarded)
_STAMP="/tmp/claude-cleanup-$(echo "$PROJECT_DIR" | md5 -q 2>/dev/null || echo "$PROJECT_DIR" | md5sum | cut -d' ' -f1).txt"
_NOW=$(date +%s)
_LAST=$(cat "$_STAMP" 2>/dev/null || echo "0")
if (( _NOW - _LAST > 86400 )); then
    /usr/bin/find "$HOME/.claude/cache" -type f -mtime +7 -delete 2>/dev/null || true
    /usr/bin/find "$HOME/.claude/projects" -name "*.jsonl" -mtime +30 -delete 2>/dev/null || true
    _TH="$HOME/.claude/state/tool_history.log"
    if [[ -f "$_TH" ]] && (( $(wc -l < "$_TH" 2>/dev/null || echo 0) > 1000 )); then
        tail -500 "$_TH" > "${_TH}.tmp" && mv "${_TH}.tmp" "$_TH"
    fi
    echo "$_NOW" > "$_STAMP"
fi

# Run main continuity handler (self-contained)
OUTPUT=$(echo "$INPUT" | node "$SCRIPT_DIR/dist/session-start-continuity.mjs")

# Clear tool stats on new session start
STATE_DIR="${HOME}/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"
echo '{"read":0,"edit":0,"bash":0,"grep":0}' > "$STATE_DIR/tool_stats.json"

# Branch change detection
# Cross-platform hash: md5 on macOS, md5sum on Linux
if command -v md5 &>/dev/null; then
    DIR_HASH=$(echo "$PROJECT_DIR" | md5 -q)
else
    DIR_HASH=$(echo "$PROJECT_DIR" | md5sum | cut -d' ' -f1)
fi
BRANCH_CACHE="/tmp/claude-last-branch-${DIR_HASH}.txt"
CURRENT_BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "")
LAST_BRANCH=""
BRANCH_CHANGED=""

if [[ -f "$BRANCH_CACHE" ]]; then
    LAST_BRANCH=$(cat "$BRANCH_CACHE" 2>/dev/null || true)
fi

if [[ -n "$CURRENT_BRANCH" ]]; then
    echo "$CURRENT_BRANCH" > "$BRANCH_CACHE"

    if [[ -n "$LAST_BRANCH" && "$LAST_BRANCH" != "$CURRENT_BRANCH" ]]; then
        BRANCH_CHANGED="🔀 Branch changed: $LAST_BRANCH → $CURRENT_BRANCH"

        # Check if new branch has a ledger
        if [[ "$CURRENT_BRANCH" =~ TASK-([0-9]+) ]]; then
            TASK_ID="TASK-${BASH_REMATCH[1]}"
            TASK_LEDGER=$(find "$PROJECT_DIR/thoughts/ledgers" -maxdepth 1 -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
            if [[ -n "$TASK_LEDGER" ]]; then
                BRANCH_CHANGED="$BRANCH_CHANGED\n📋 Ledger: $(basename "$TASK_LEDGER")"
            else
                BRANCH_CHANGED="$BRANCH_CHANGED\n💡 No ledger found. Create with: /dev start"
            fi
        fi
    fi
fi

# For startup, add ledger summary and tip to the message
if [[ "$SESSION_TYPE" == "startup" ]]; then
    # Get ledger summary (if exists) - cascading lookup
    PLUGIN_SCRIPTS="$SCRIPT_DIR/../scripts"
    if [[ -x "$PLUGIN_SCRIPTS/ledger-manager.sh" ]]; then
        LEDGER_SUMMARY=$("$PLUGIN_SCRIPTS/ledger-manager.sh" summary 2>/dev/null || true)
    else
        LEDGER_SUMMARY=$("$HOME/.claude/scripts/ledger-manager.sh" summary 2>/dev/null || true)
    fi

    # Get tip - cascading lookup
    if [[ -x "$PLUGIN_SCRIPTS/show-tip.sh" ]]; then
        TIP=$("$PLUGIN_SCRIPTS/show-tip.sh" 2>/dev/null || echo "💡 /dev commit - 提交代码")
    else
        TIP=$("$HOME/.claude/scripts/show-tip.sh" 2>/dev/null || echo "💡 /dev commit - 提交代码")
    fi

    # Check PR status for merged PRs (suggest archive)
    PR_STATUS_MSG=""
    if [[ "$CURRENT_BRANCH" =~ TASK-([0-9]+) ]]; then
        TASK_ID="TASK-${BASH_REMATCH[1]}"
        TASK_LEDGER=$(find "$PROJECT_DIR/thoughts/ledgers" -maxdepth 1 -name "${TASK_ID}-*.md" 2>/dev/null | head -1)

        if [[ -n "$TASK_LEDGER" ]]; then
            # Extract PR URL from ledger
            PR_URL=$(grep -oE 'https://github.com/[^[:space:])]+/pull/[0-9]+' "$TASK_LEDGER" 2>/dev/null | head -1)

            if [[ -n "$PR_URL" ]]; then
                # Check PR state (quick timeout to not block)
                PR_STATE=$(timeout 3 gh pr view "$PR_URL" --json state -q '.state' 2>/dev/null || echo "")

                if [[ "$PR_STATE" == "MERGED" ]]; then
                    PR_STATUS_MSG="✅ PR merged! Consider: /dev ledger archive $TASK_ID"
                elif [[ "$PR_STATE" == "CLOSED" ]]; then
                    PR_STATUS_MSG="⚠️ PR closed (not merged). Check: $PR_URL"
                fi
            fi
        fi
    fi

    CURRENT_MSG=$(echo "$OUTPUT" | jq -r '.message // ""')

    # Build new message
    if [[ -n "$LEDGER_SUMMARY" ]]; then
        if [[ -n "$CURRENT_MSG" ]]; then
            NEW_MSG="$CURRENT_MSG\n$LEDGER_SUMMARY\n$TIP"
        else
            NEW_MSG="$LEDGER_SUMMARY\n$TIP"
        fi
    else
        if [[ -n "$CURRENT_MSG" ]]; then
            NEW_MSG="$CURRENT_MSG | $TIP"
        else
            NEW_MSG="$TIP"
        fi
    fi

    # Append PR status if available
    if [[ -n "$PR_STATUS_MSG" ]]; then
        NEW_MSG="$NEW_MSG\n$PR_STATUS_MSG"
    fi

    OUTPUT=$(echo "$OUTPUT" | jq --arg tip "$NEW_MSG" '.message = $tip | .systemMessage = $tip')
fi

# Smart Knowledge Injection (Phase 3)
# Inject relevant knowledge from ~/.claude/knowledge/ into additionalContext
if [[ "$SESSION_TYPE" == "clear" || "$SESSION_TYPE" == "compact" ]]; then
    KNOWLEDGE_DIR="${HOME}/.claude/knowledge"
    KNOWLEDGE_CONTEXT=""

    # Detect platform (unified: .dev-flow.json > file-based)
    PLATFORM="general"
    DEV_FLOW_JSON="$PROJECT_DIR/.dev-flow.json"
    if [[ -f "$DEV_FLOW_JSON" ]]; then
        PLATFORM=$(jq -r '.platform // empty' "$DEV_FLOW_JSON" 2>/dev/null | tr '[:upper:]' '[:lower:]')
        [[ -z "$PLATFORM" ]] && PLATFORM="general"
    elif [[ -f "$PROJECT_DIR/Podfile" || -f "$PROJECT_DIR/Package.swift" ]]; then
        PLATFORM="ios"
    elif [[ -f "$PROJECT_DIR/build.gradle" || -f "$PROJECT_DIR/build.gradle.kts" ]]; then
        PLATFORM="android"
    elif [[ -f "$PROJECT_DIR/package.json" ]]; then
        PLATFORM="web"
    fi

    # 1. Platform pitfalls (max 800 chars)
    PITFALLS_FILE="$KNOWLEDGE_DIR/platforms/$PLATFORM/pitfalls.md"
    if [[ -f "$PITFALLS_FILE" ]]; then
        PITFALLS_CONTENT=$(head -c 800 "$PITFALLS_FILE" 2>/dev/null || true)
        if [[ -n "$PITFALLS_CONTENT" ]]; then
            PLATFORM_UPPER=$(echo "$PLATFORM" | tr '[:lower:]' '[:upper:]')
            KNOWLEDGE_CONTEXT="### ${PLATFORM_UPPER} Pitfalls\n${PITFALLS_CONTENT}"
        fi
    fi

    # 2. Task-related knowledge via FTS5 (max 600 chars)
    DB_PATH="$PROJECT_DIR/.claude/cache/artifact-index/context.db"
    if [[ -f "$DB_PATH" && -n "$CURRENT_BRANCH" ]]; then
        # Extract keywords from branch name
        BRANCH_KEYWORDS=$(echo "$CURRENT_BRANCH" | /usr/bin/sed 's/^feature\///' | /usr/bin/sed 's/^bugfix\///' | /usr/bin/sed 's/TASK-[0-9]*-*//' | tr '[-_/]' ' ' | tr -s ' ')
        if [[ -n "$BRANCH_KEYWORDS" ]]; then
            FTS_QUERY=$(echo "$BRANCH_KEYWORDS" | /usr/bin/sed 's/ / OR /g')
            FTS_RESULTS=$(sqlite3 -separator '|||' "$DB_PATH" \
                "SELECT k.type, k.title, substr(k.problem, 1, 80) FROM knowledge k JOIN knowledge_fts f ON k.rowid = f.rowid WHERE knowledge_fts MATCH '${FTS_QUERY}' ORDER BY rank LIMIT 3;" 2>/dev/null || true)
            if [[ -n "$FTS_RESULTS" ]]; then
                TASK_KNOWLEDGE=""
                while IFS= read -r line; do
                    IFS='|||' read -r ktype ktitle kproblem <<< "$line"
                    TASK_KNOWLEDGE="${TASK_KNOWLEDGE}\n- [${ktype}] ${ktitle}: ${kproblem}"
                done <<< "$FTS_RESULTS"
                if [[ -n "$TASK_KNOWLEDGE" ]]; then
                    KNOWLEDGE_CONTEXT="${KNOWLEDGE_CONTEXT}\n\n### Related Knowledge\nKeywords: ${BRANCH_KEYWORDS}\n${TASK_KNOWLEDGE}"
                fi
            fi
        fi
    fi

    # 3. Recent discoveries (7 days, max 600 chars)
    DISCOVERIES_DIR="$KNOWLEDGE_DIR/discoveries"
    if [[ -d "$DISCOVERIES_DIR" ]]; then
        SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d 2>/dev/null || true)
        if [[ -n "$SEVEN_DAYS_AGO" ]]; then
            RECENT_DISCOVERIES=""
            for f in $(ls -t "$DISCOVERIES_DIR"/*.md 2>/dev/null | head -3); do
                FILE_DATE=$(basename "$f" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)
                if [[ -n "$FILE_DATE" && "$FILE_DATE" > "$SEVEN_DAYS_AGO" ]]; then
                    TITLE=$(head -1 "$f" | /usr/bin/sed 's/^# Discovery: //')
                    RECENT_DISCOVERIES="${RECENT_DISCOVERIES}\n- ${TITLE}"
                fi
            done
            if [[ -n "$RECENT_DISCOVERIES" ]]; then
                KNOWLEDGE_CONTEXT="${KNOWLEDGE_CONTEXT}\n\n### Recent Discoveries${RECENT_DISCOVERIES}"
            fi
        fi
    fi

    # Append knowledge to additionalContext (budget: 2000 chars)
    if [[ -n "$KNOWLEDGE_CONTEXT" ]]; then
        KNOWLEDGE_HEADER="\n\n---\n\n## Relevant Knowledge\n"
        FULL_KNOWLEDGE="${KNOWLEDGE_HEADER}${KNOWLEDGE_CONTEXT}"
        # Truncate to 2000 chars
        FULL_KNOWLEDGE=$(echo -e "$FULL_KNOWLEDGE" | head -c 2000)

        EXISTING_CONTEXT=$(echo "$OUTPUT" | jq -r '.hookSpecificOutput.additionalContext // ""')
        if [[ -n "$EXISTING_CONTEXT" ]]; then
            NEW_CONTEXT="${EXISTING_CONTEXT}${FULL_KNOWLEDGE}"
        else
            NEW_CONTEXT="$FULL_KNOWLEDGE"
        fi
        OUTPUT=$(echo "$OUTPUT" | jq --arg ctx "$NEW_CONTEXT" '.hookSpecificOutput.additionalContext = $ctx | .hookSpecificOutput.hookEventName = "SessionStart"')
    fi
fi

# Add branch change notification (for any session type)
if [[ -n "$BRANCH_CHANGED" ]]; then
    CURRENT_MSG=$(echo "$OUTPUT" | jq -r '.message // ""')
    if [[ -n "$CURRENT_MSG" ]]; then
        NEW_MSG="$BRANCH_CHANGED\n\n$CURRENT_MSG"
    else
        NEW_MSG="$BRANCH_CHANGED"
    fi
    OUTPUT=$(echo "$OUTPUT" | jq --arg msg "$NEW_MSG" '.message = $msg | .systemMessage = $msg')
fi

echo "$OUTPUT"
