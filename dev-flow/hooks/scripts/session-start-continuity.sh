#!/bin/bash
# Relaxed: -e can cause issues with git/jq commands
set -o pipefail

# Self-contained: use script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/registry.sh"

# Get session type from stdin (pass through)
INPUT=$(cat)
SESSION_TYPE=$(echo "$INPUT" | jq -r '.type // .source // "unknown"' 2>/dev/null || echo "unknown")
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // "main"' 2>/dev/null || echo "main")

# Skip heavy processing for subagents
if [[ "$AGENT_TYPE" != "main" && "$AGENT_TYPE" != "unknown" ]]; then
    echo '{"result": "continue"}'
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Ensure state/cache dirs exist
mkdir -p "$PROJECT_DIR/.claude/state/cache"

# === Check for active auto-pipeline state ===
AUTO_PIPELINE_CONTEXT=""
for _state_file in "$PROJECT_DIR/.claude/state/pipeline/"*.json; do
  [[ -f "$_state_file" ]] || continue
  [[ "$_state_file" == *.done.json ]] && continue
  _auto=$(jq -r '.auto // empty' "$_state_file" 2>/dev/null)
  if [[ "$_auto" == "true" ]]; then
    _stage=$(jq -r '.current_stage // empty' "$_state_file" 2>/dev/null)
    _task_id=$(jq -r '.task_id // empty' "$_state_file" 2>/dev/null)
    _plan_path=$(jq -r '.plan_path // empty' "$_state_file" 2>/dev/null)
    AUTO_PIPELINE_CONTEXT="[AUTO-PIPELINE] Task: ${_task_id}, Stage: ${_stage}\nPlan: ${_plan_path}\nProceed without confirmation — this is an autonomous pipeline."
    break
  fi
done

# === Check project setup ===
INIT_WARNING=""
if [[ ! -f "$PROJECT_DIR/.dev-flow.json" ]]; then
    INIT_WARNING="No .dev-flow.json found. Run /dev-flow:init to set up."
fi

# === Memory sync (absorbed from memory-sync.sh) ===
ENCODED_PATH=$(echo "$PROJECT_DIR" | /usr/bin/sed 's|/|-|g')
MEMORY_MD="$HOME/.claude/projects/$ENCODED_PATH/memory/MEMORY.md"
if [[ -f "$MEMORY_MD" ]]; then
    SYNC_MARKER="$PROJECT_DIR/.claude/state/memory-sync-marker"
    if [[ -f "$SYNC_MARKER" ]] && [[ "$MEMORY_MD" -nt "$SYNC_MARKER" ]]; then
        echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$PROJECT_DIR/.claude/state/memory-human-edited" 2>/dev/null
    fi
    touch "$SYNC_MARKER"
fi

# Daily cache cleanup (frequency-guarded)
_STAMP="$PROJECT_DIR/.claude/state/cache/cleanup-stamp.txt"
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

# Default output
OUTPUT='{"result":"continue"}'

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
if [[ ! -f "$REVIEW_LOG" ]]; then
  printf "# Review Session: %s\n\nBranch: %s\nCreated: %s\n\n" "$BRANCH" "$BRANCH" "$(date '+%Y-%m-%d %H:%M')" > "$REVIEW_LOG"
else
  REVIEW_LOG_SIZE=$(wc -c < "$REVIEW_LOG" 2>/dev/null || echo "0")
  if (( REVIEW_LOG_SIZE > 51200 )); then
    tail -c 20480 "$REVIEW_LOG" > "${REVIEW_LOG}.tmp" && mv "${REVIEW_LOG}.tmp" "$REVIEW_LOG"
  fi
  printf "\n---\n## Session: %s\n\n" "$(date '+%Y-%m-%d %H:%M')" >> "$REVIEW_LOG"
fi
/usr/bin/find "$REVIEW_DIR" -name "review-session-*.md" -mtime +7 -delete 2>/dev/null || true

# Branch change detection
BRANCH_CACHE="$PROJECT_DIR/.claude/state/cache/branch.txt"
CURRENT_BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "")
LAST_BRANCH=""
BRANCH_CHANGED=""

if [[ -f "$BRANCH_CACHE" ]]; then
    LAST_BRANCH=$(cat "$BRANCH_CACHE" 2>/dev/null || true)
fi

if [[ -n "$CURRENT_BRANCH" ]]; then
    echo "$CURRENT_BRANCH" > "$BRANCH_CACHE"

    if [[ -n "$LAST_BRANCH" && "$LAST_BRANCH" != "$CURRENT_BRANCH" ]]; then
        BRANCH_CHANGED="Branch changed: $LAST_BRANCH → $CURRENT_BRANCH"

        if [[ "$CURRENT_BRANCH" =~ TASK-([0-9]+) ]]; then
            TASK_ID="TASK-${BASH_REMATCH[1]}"
            TASK_LEDGER=$(/usr/bin/find "$PROJECT_DIR/thoughts/ledgers" -maxdepth 1 -name "${TASK_ID}-*.md" 2>/dev/null | head -1)
            if [[ -n "$TASK_LEDGER" ]]; then
                BRANCH_CHANGED="$BRANCH_CHANGED\nLedger: $(basename "$TASK_LEDGER")"
            else
                BRANCH_CHANGED="$BRANCH_CHANGED\nNo ledger found. Create with: /dev start"
            fi
        fi
    fi
fi

# Inject ledger info (registry-based)
ACTIVE_LEDGER_PATH=$(registry_resolve "$PROJECT_DIR" 2>/dev/null || true)
TASK_RECOVERY=""
if [[ -n "$ACTIVE_LEDGER_PATH" ]]; then
    if [[ ! "$ACTIVE_LEDGER_PATH" = /* ]]; then
        ACTIVE_LEDGER_PATH="$PROJECT_DIR/$ACTIVE_LEDGER_PATH"
    fi
    if [[ -f "$ACTIVE_LEDGER_PATH" ]]; then
        IN_PROGRESS=$(grep -E '^\s*-\s*\[→\]' "$ACTIVE_LEDGER_PATH" 2>/dev/null || true | /usr/bin/sed 's/^[[:space:]]*- \[→\] //' | head -3)
        PENDING=$(grep -cE '^\s*-\s*\[ \]' "$ACTIVE_LEDGER_PATH" 2>/dev/null || echo "0")
        if [[ -n "$IN_PROGRESS" ]]; then
            TASK_RECOVERY="Unfinished: $(echo "$IN_PROGRESS" | head -1)"
            if [[ "$PENDING" -gt 0 ]]; then
                TASK_RECOVERY="$TASK_RECOVERY (+${PENDING} pending)"
            fi
        fi
    fi
fi

# Build startup message
if [[ "$SESSION_TYPE" == "startup" ]]; then
    PLUGIN_SCRIPTS="$SCRIPT_DIR/../scripts"
    LEDGER_SUMMARY=""
    TIP=""
    if [[ -x "$PLUGIN_SCRIPTS/ledger-manager.sh" ]]; then
        LEDGER_SUMMARY=$("$PLUGIN_SCRIPTS/ledger-manager.sh" summary 2>/dev/null || true)
    fi
    if [[ -x "$PLUGIN_SCRIPTS/show-tip.sh" ]]; then
        TIP=$("$PLUGIN_SCRIPTS/show-tip.sh" 2>/dev/null || echo "/dev commit - commit code")
    fi

    RESUME_DIRECTIVE="$AUTO_PIPELINE_CONTEXT"

    # Check PR status for merged PRs
    PR_STATUS_MSG=""
    if [[ "$CURRENT_BRANCH" =~ TASK-([0-9]+) ]]; then
        TASK_ID="TASK-${BASH_REMATCH[1]}"
        TASK_LEDGER=$(/usr/bin/find "$PROJECT_DIR/thoughts/ledgers" -maxdepth 1 -name "${TASK_ID}-*.md" 2>/dev/null | head -1)

        if [[ -n "$TASK_LEDGER" ]]; then
            PR_URL=$(grep -oE 'https://github.com/[^[:space:])]+/pull/[0-9]+' "$TASK_LEDGER" 2>/dev/null | head -1)
            if [[ -n "$PR_URL" ]]; then
                PR_STATE=$(timeout 3 gh pr view "$PR_URL" --json state -q '.state' 2>/dev/null || echo "")
                if [[ "$PR_STATE" == "MERGED" ]]; then
                    PR_STATUS_MSG="PR merged! Consider: /dev ledger archive $TASK_ID"
                elif [[ "$PR_STATE" == "CLOSED" ]]; then
                    PR_STATUS_MSG="PR closed (not merged). Check: $PR_URL"
                fi
            fi
        fi
    fi

    # Assemble message (priority: init warning > resume > task recovery > ledger > tip > PR)
    NEW_MSG=""
    [[ -n "$INIT_WARNING" ]] && NEW_MSG="$INIT_WARNING\n"
    [[ -n "$RESUME_DIRECTIVE" ]] && NEW_MSG="${NEW_MSG}${RESUME_DIRECTIVE}\n"
    [[ -n "$TASK_RECOVERY" ]] && NEW_MSG="${NEW_MSG}${TASK_RECOVERY}\n"
    [[ -n "$LEDGER_SUMMARY" ]] && NEW_MSG="${NEW_MSG}${LEDGER_SUMMARY}\n"
    [[ -n "$TIP" ]] && NEW_MSG="${NEW_MSG}${TIP}\n"
    [[ -n "$PR_STATUS_MSG" ]] && NEW_MSG="${NEW_MSG}${PR_STATUS_MSG}\n"

    if [[ -n "$NEW_MSG" ]]; then
        OUTPUT=$(jq -n --arg msg "$NEW_MSG" '{"result":"continue","message":$msg,"systemMessage":$msg}')
    fi
fi

# Load compact checkpoint if recent (<1h)
CHECKPOINT="$PROJECT_DIR/.claude/state/checkpoint.md"
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

# Clean stale compact state from MEMORY.md
if [[ -f "$MEMORY_MD" ]] && grep -q 'COMPACT-STATE-START' "$MEMORY_MD" 2>/dev/null; then
    if [[ ! -f "$CHECKPOINT" ]] || [[ "${CHECKPOINT_AGE:-99999}" -ge 3600 ]]; then
        awk '
            /<!-- COMPACT-STATE-START -->/ { skip=1; next }
            /<!-- COMPACT-STATE-END -->/ { skip=0; next }
            !skip { print }
        ' "$MEMORY_MD" > "${MEMORY_MD}.tmp" 2>/dev/null && mv "${MEMORY_MD}.tmp" "$MEMORY_MD" 2>/dev/null
    fi
fi

# Add branch change notification
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
