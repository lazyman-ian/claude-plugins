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

# Run main continuity handler (self-contained)
OUTPUT=$(echo "$INPUT" | node "$SCRIPT_DIR/dist/session-start-continuity.mjs")

# Branch change detection
# Clear tool stats on new session start
STATE_DIR="${HOME}/.claude/state/dev-flow"
mkdir -p "$STATE_DIR"
echo '{"read":0,"edit":0,"bash":0,"grep":0}' > "$STATE_DIR/tool_stats.json"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
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
