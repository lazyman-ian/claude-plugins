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

# === Check project setup ===
INIT_WARNING=""
if [[ ! -f "$PROJECT_DIR/.dev-flow.json" ]]; then
    INIT_WARNING="⚠️ No .dev-flow.json found. Run /dev-flow:init to set up."
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

# Knowledge pruning is now explicit via dev_memory(prune)

# Run main continuity handler (self-contained)
if [[ ! -f "$SCRIPT_DIR/dist/session-start-continuity.mjs" ]]; then
    echo '{"result": "continue"}'
    exit 0
fi
OUTPUT=$(echo "$INPUT" | node "$SCRIPT_DIR/dist/session-start-continuity.mjs")

# Clear tool stats on new session start
STATE_DIR="${HOME}/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"
echo '{"read":0,"edit":0,"bash":0,"grep":0}' > "$STATE_DIR/tool_stats.json"

# Initialize branch-scoped review session log
REVIEW_DIR="$PROJECT_DIR/.git/claude"
mkdir -p "$REVIEW_DIR" 2>/dev/null || true
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "detached")
SAFE_BRANCH=$(echo "$BRANCH" | /usr/bin/sed 's/\//-/g')
REVIEW_LOG="$REVIEW_DIR/review-session-${SAFE_BRANCH}.md"
# Fresh log per session (same branch, new session = reset)
printf "# Review Session: %s\n\nBranch: %s\nCreated: %s\n\n" "$BRANCH" "$BRANCH" "$(date '+%Y-%m-%d %H:%M')" > "$REVIEW_LOG"
# Cleanup: delete review logs older than 7 days (stale branches)
/usr/bin/find "$REVIEW_DIR" -name "review-session-*.md" -mtime +7 -delete 2>/dev/null || true

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

    # Check for in-progress tasks in ledger (extract [→] items)
    TASK_RECOVERY=""
    LEDGER_DIR="$PROJECT_DIR/thoughts/ledgers"
    if [[ -d "$LEDGER_DIR" ]]; then
        LATEST_LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
        if [[ -n "$LATEST_LEDGER" ]]; then
            IN_PROGRESS=$(grep -E '^\s*-\s*\[→\]' "$LATEST_LEDGER" 2>/dev/null || true | /usr/bin/sed 's/^[[:space:]]*- \[→\] //' | head -3)
            PENDING=$(grep -cE '^\s*-\s*\[ \]' "$LATEST_LEDGER" 2>/dev/null || echo "0")
            if [[ -n "$IN_PROGRESS" ]]; then
                TASK_RECOVERY="⚡ Unfinished: $(echo "$IN_PROGRESS" | head -1)"
                if [[ "$PENDING" -gt 0 ]]; then
                    TASK_RECOVERY="$TASK_RECOVERY (+${PENDING} pending)"
                fi
            fi
        fi
    fi

    # Check for resume directive (written by context-handoff skill)
    RESUME_DIRECTIVE=""
    RESUME_FILE="$PROJECT_DIR/thoughts/ledgers/.resume-directive.md"
    if [[ -f "$RESUME_FILE" ]]; then
        RESUME_DIRECTIVE=$(head -5 "$RESUME_FILE" 2>/dev/null | tr '\n' ' ' | /usr/bin/sed 's/[[:space:]]\+/ /g')
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

    # Prepend task recovery (most important info first)
    if [[ -n "$TASK_RECOVERY" ]]; then
        NEW_MSG="$TASK_RECOVERY\n$NEW_MSG"
    fi

    # Prepend resume directive (higher priority than task recovery)
    if [[ -n "$RESUME_DIRECTIVE" ]]; then
        NEW_MSG="$RESUME_DIRECTIVE\n$NEW_MSG"
    fi

    # Prepend init warning (highest priority)
    if [[ -n "$INIT_WARNING" ]]; then
        NEW_MSG="$INIT_WARNING\n$NEW_MSG"
    fi

    OUTPUT=$(echo "$OUTPUT" | jq --arg tip "$NEW_MSG" '.message = $tip | .systemMessage = $tip')
fi

# Smart Knowledge Injection (Phase 3)
# Inject relevant knowledge from per-project SQLite into additionalContext
if [[ "$SESSION_TYPE" == "clear" || "$SESSION_TYPE" == "compact" ]]; then
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

    # Query per-project SQLite for pitfalls and discoveries
    DB_PATH="$PROJECT_DIR/.claude/cache/artifact-index/context.db"
    # Sanitize PLATFORM for SQL (escape single quotes to prevent injection)
    SAFE_PLATFORM=$(echo "$PLATFORM" | /usr/bin/sed "s/'/''/g")
    if [[ -f "$DB_PATH" ]]; then
        # 1. Platform pitfalls from SQLite
        PITFALLS=$(sqlite3 "$DB_PATH" "SELECT '[' || type || '] ' || title || ': ' || substr(problem,1,80) FROM knowledge WHERE type='pitfall' AND platform='$SAFE_PLATFORM' AND priority='critical' ORDER BY created_at DESC LIMIT 3;" 2>/dev/null)
        if [[ -n "$PITFALLS" ]]; then
            PLATFORM_UPPER=$(echo "$PLATFORM" | tr '[:lower:]' '[:upper:]')
            KNOWLEDGE_CONTEXT="### ${PLATFORM_UPPER} Pitfalls\n${PITFALLS}"
        fi

        # 3. Recent discoveries (7 days) from SQLite
        DISCOVERIES=$(sqlite3 "$DB_PATH" "SELECT '[' || type || '] ' || title || ': ' || substr(problem,1,80) FROM knowledge WHERE julianday('now') - julianday(created_at) <= 7 AND priority='critical' ORDER BY created_at DESC LIMIT 3;" 2>/dev/null)
        if [[ -n "$DISCOVERIES" ]]; then
            KNOWLEDGE_CONTEXT="${KNOWLEDGE_CONTEXT}\n\n### Recent Discoveries\n${DISCOVERIES}"
        fi
    fi

    # 2. Task-related knowledge via FTS5 (max 600 chars)
    if [[ -f "$DB_PATH" && -n "$CURRENT_BRANCH" ]]; then
        # Extract keywords from branch name
        BRANCH_KEYWORDS=$(echo "$CURRENT_BRANCH" | /usr/bin/sed 's/^feature\///' | /usr/bin/sed 's/^bugfix\///' | /usr/bin/sed 's/TASK-[0-9]*-*//' | tr '[-_/]' ' ' | tr -s ' ')
        if [[ -n "$BRANCH_KEYWORDS" ]]; then
            FTS_QUERY=$(echo "$BRANCH_KEYWORDS" | /usr/bin/sed "s/'/''/g" | /usr/bin/sed 's/ / OR /g')
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

# --- Load compact checkpoint if exists (Phase 4) ---
CHECKPOINT="$PROJECT_DIR/thoughts/ledgers/.compact-checkpoint.md"
CHECKPOINT_AGE=99999
if [[ -f "$CHECKPOINT" ]]; then
    CHECKPOINT_MTIME=$(stat -f%m "$CHECKPOINT" 2>/dev/null || echo "0")
    CHECKPOINT_AGE=$(( $(date +%s) - CHECKPOINT_MTIME ))
    if [[ "$CHECKPOINT_AGE" -lt 3600 ]]; then
        CHECKPOINT_CONTENT=$(head -40 "$CHECKPOINT")
        CHECKPOINT_MSG="Compact checkpoint loaded ($(( CHECKPOINT_AGE / 60 )) min ago):\n${CHECKPOINT_CONTENT}"

        CURRENT_MSG=$(echo "$OUTPUT" | jq -r '.message // ""')
        if [[ -n "$CURRENT_MSG" ]]; then
            NEW_MSG="${CHECKPOINT_MSG}\n\n${CURRENT_MSG}"
        else
            NEW_MSG="$CHECKPOINT_MSG"
        fi
        OUTPUT=$(echo "$OUTPUT" | jq --arg msg "$NEW_MSG" '.message = $msg | .systemMessage = $msg')
    fi
fi

# --- Clean stale compact state from MEMORY.md ---
ENCODED_PATH=$(echo "$PROJECT_DIR" | /usr/bin/sed 's|/|-|g')
MEMORY_MD="$HOME/.claude/projects/$ENCODED_PATH/memory/MEMORY.md"
if [[ -f "$MEMORY_MD" ]] && grep -q 'COMPACT-STATE-START' "$MEMORY_MD" 2>/dev/null; then
    if [[ ! -f "$CHECKPOINT" ]] || [[ "$CHECKPOINT_AGE" -ge 3600 ]]; then
        # Remove stale COMPACT-STATE section
        awk '
            /<!-- COMPACT-STATE-START -->/ { skip=1; next }
            /<!-- COMPACT-STATE-END -->/ { skip=0; next }
            !skip { print }
        ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
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
