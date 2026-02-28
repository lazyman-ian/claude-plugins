#!/bin/bash
set -o pipefail

INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // empty' 2>/dev/null)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // empty' 2>/dev/null)

# Graceful exit for empty input
[[ -z "$TASK_SUBJECT" ]] && { echo '{"continue":true}'; exit 0; }

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LEDGER_DIR="$project_dir/thoughts/ledgers"

[[ ! -d "$LEDGER_DIR" ]] && { echo '{"continue":true}'; exit 0; }

# Find active ledger (most recent CONTINUITY_CLAUDE-*.md)
LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
[[ -z "$LEDGER" || ! -f "$LEDGER" ]] && { echo '{"continue":true}'; exit 0; }

# Escape special characters for sed
SAFE_SUBJECT=$(echo "$TASK_SUBJECT" | /usr/bin/sed 's/[&/\]/\\&/g' | head -c 80)
TIMESTAMP=$(date -u +"%H:%M")

# Update State section: append completed task
if grep -q "## State" "$LEDGER" 2>/dev/null; then
  /usr/bin/sed -i '' "/## State/a\\
- Done: [x] ${SAFE_SUBJECT} (${TIMESTAMP})\\
" "$LEDGER" 2>/dev/null || true
fi

echo '{"continue":true}'
