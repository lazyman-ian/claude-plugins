#!/bin/bash
###
# Intent Router - UserPromptSubmit
#
# Fast keyword classification (~50ms) to inject relevant context.
# Falls through for unclassified messages (no blocking).
###

set -o pipefail

INPUT=$(cat)
USER_PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null || echo "")

[[ -z "$USER_PROMPT" ]] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONTEXT=""

# Lowercase for matching
LOWER=$(echo "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')

# --- Category: Implementation ---
if echo "$LOWER" | grep -qE '(implement|build|create|add|新增|实现|添加|修改).*(feature|module|component|function|功能|模块)'; then
  # Inject active plan summary if exists
  PLANS_DIR="$PROJECT_DIR/thoughts/shared/plans"
  if [[ -d "$PLANS_DIR" ]]; then
    ACTIVE_PLAN=$(ls -t "$PLANS_DIR"/*.md 2>/dev/null | head -1)
    if [[ -n "$ACTIVE_PLAN" ]]; then
      PLAN_NAME=$(basename "$ACTIVE_PLAN")
      PLAN_STATUS=$(grep -m1 '^status:' "$ACTIVE_PLAN" 2>/dev/null | /usr/bin/sed 's/status:[[:space:]]*//' | tr -d '"' || echo "unknown")
      CONTEXT="[intent:implementation] Active plan: $PLAN_NAME (status: $PLAN_STATUS). Consider /dev implement-plan if plan exists."
    fi
  fi
  # Also check ledger
  LEDGER_DIR="$PROJECT_DIR/thoughts/ledgers"
  if [[ -d "$LEDGER_DIR" ]] && [[ -z "$CONTEXT" ]]; then
    ACTIVE_LEDGER=$(ls -t "$LEDGER_DIR"/TASK-*.md 2>/dev/null | head -1)
    if [[ -n "$ACTIVE_LEDGER" ]]; then
      CONTEXT="[intent:implementation] Active ledger: $(basename "$ACTIVE_LEDGER"). Check ledger state before starting."
    fi
  fi

# --- Category: Debugging ---
elif echo "$LOWER" | grep -qE '(fix|debug|crash|error|bug|修复|调试|报错|崩溃|失败)'; then
  RECENT=$(git -C "$PROJECT_DIR" log --oneline -5 2>/dev/null || echo "")
  if [[ -n "$RECENT" ]]; then
    CONTEXT="[intent:debugging] Recent commits: $RECENT"
  fi

# --- Category: Research ---
elif echo "$LOWER" | grep -qE '(how|why|what|explain|research|understand|了解|研究|解释|为什么|怎么)'; then
  CONTEXT="[intent:research] Consider dev_memory(action='query') for past patterns, or /research for external docs."

# --- Category: Planning ---
elif echo "$LOWER" | grep -qE '(plan|design|architect|brainstorm|规划|设计|方案|计划)'; then
  PLANS_DIR="$PROJECT_DIR/thoughts/shared/plans"
  PLAN_COUNT=0
  if [[ -d "$PLANS_DIR" ]]; then
    PLAN_COUNT=$(ls "$PLANS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
  fi
  CONTEXT="[intent:planning] $PLAN_COUNT existing plan(s) in thoughts/shared/plans/. Use /dev create-plan or /dev brainstorm."

# --- Category: Commit/PR workflow ---
elif echo "$LOWER" | grep -qE '(/dev|/commit|/pr|commit|提交|合并)'; then
  : # No injection needed, /dev commands handle themselves
fi

# Output
if [[ -n "$CONTEXT" ]]; then
  jq -n --arg ctx "$CONTEXT" '{
    "hookSpecificOutput": {
      "hookEventName": "UserPromptSubmit",
      "additionalContext": $ctx
    }
  }'
else
  echo '{}'
fi

exit 0
