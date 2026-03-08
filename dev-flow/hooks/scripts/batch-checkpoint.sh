#!/bin/bash
###
# Batch Checkpoint - TaskCompleted
#
# Maintains a counter; when it hits the interval derived from plan task count,
# exit 2 to prompt coherence review.
# Intervals: <=6 tasks → every 3 | 7-12 → every 4 | 13+ → every 5
###

set -o pipefail

INPUT=$(cat)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // empty' 2>/dev/null || echo "")

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PLANS_DIR="$project_dir/thoughts/shared/plans"

[[ ! -d "$PLANS_DIR" ]] && { echo '{"continue":true}'; exit 0; }

# Find active plan
ACTIVE_PLAN=""
while IFS= read -r plan_file; do
  status=$(grep -m1 '^status:' "$plan_file" 2>/dev/null | /usr/bin/sed 's/status:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
  if [[ "$status" != "completed" && "$status" != "cancelled" ]]; then
    ACTIVE_PLAN="$plan_file"
    break
  fi
done < <(ls -t "$PLANS_DIR"/*.md 2>/dev/null)

[[ -z "$ACTIVE_PLAN" ]] && { echo '{"continue":true}'; exit 0; }

# Count tasks in active plan (lines with 'id:' under tasks: block)
TASK_COUNT=$(grep -cE '^\s+- id:' "$ACTIVE_PLAN" 2>/dev/null || echo "")
TASK_COUNT=$(echo "$TASK_COUNT" | tr -d '[:space:]')
[[ ! "$TASK_COUNT" =~ ^[0-9]+$ ]] && TASK_COUNT=0

# Determine interval
if (( TASK_COUNT <= 6 )); then
  INTERVAL=3
elif (( TASK_COUNT <= 12 )); then
  INTERVAL=4
else
  INTERVAL=5
fi

# Counter file: keyed by branch name hash (separate counters per pipeline/branch)
CURRENT_BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null)
if [[ -n "$CURRENT_BRANCH" ]]; then
  BRANCH_HASH=$(echo "$CURRENT_BRANCH" | (shasum 2>/dev/null || sha1sum) | cut -c1-12)
else
  # Detached HEAD: fall back to dir hash
  BRANCH_HASH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g' | tail -c 32)
fi
COUNTER_FILE="/tmp/claude-batch-checkpoint-${BRANCH_HASH}.txt"

# Read counter; detect plan change and reset if needed
COUNT=0
if [[ -f "$COUNTER_FILE" ]]; then
  STORED_BRANCH=$(sed -n '1p' "$COUNTER_FILE" 2>/dev/null || echo "")
  STORED_PLAN=$(sed -n '2p' "$COUNTER_FILE" 2>/dev/null || echo "")
  STORED_COUNT=$(sed -n '3p' "$COUNTER_FILE" 2>/dev/null || echo "0")

  if [[ "$STORED_BRANCH" == "$CURRENT_BRANCH" && "$STORED_PLAN" == "$ACTIVE_PLAN" ]]; then
    COUNT=$STORED_COUNT
  fi
  # If branch or plan changed, COUNT stays 0 (reset)
fi
COUNT=$((COUNT + 1))

# Atomic write: tmp then mv
COUNTER_TMP="${COUNTER_FILE}.tmp"
if (( COUNT >= INTERVAL )); then
  printf '%s\n%s\n%s\n' "$CURRENT_BRANCH" "$ACTIVE_PLAN" "0" > "$COUNTER_TMP" && mv "$COUNTER_TMP" "$COUNTER_FILE"
  echo "Batch checkpoint: review coherence of last ${INTERVAL} tasks before continuing" >&2
  exit 2
else
  printf '%s\n%s\n%s\n' "$CURRENT_BRANCH" "$ACTIVE_PLAN" "$COUNT" > "$COUNTER_TMP" && mv "$COUNTER_TMP" "$COUNTER_FILE"
  echo '{"continue":true}'
  exit 0
fi
