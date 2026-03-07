#!/bin/bash
set -o pipefail

INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject // empty' 2>/dev/null || echo "")
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // empty' 2>/dev/null || echo "")

# Graceful exit for empty input
[[ -z "$TASK_SUBJECT" ]] && { echo '{"continue":true}'; exit 0; }

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LEDGER_DIR="$project_dir/thoughts/ledgers"

[[ ! -d "$LEDGER_DIR" ]] && { echo '{"continue":true}'; exit 0; }

# Find active ledger (most recent CONTINUITY_CLAUDE-*.md)
LEDGER=$(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null | head -1)
[[ -z "$LEDGER" || ! -f "$LEDGER" ]] && { echo '{"continue":true}'; exit 0; }

TIMESTAMP=$(date -u +"%H:%M")

# Extract gates from task_metadata.gates if present
GATES_JSON=$(echo "$INPUT" | jq -c '.task_metadata.gates // empty' 2>/dev/null || echo "")

if [[ -n "$GATES_JSON" && "$GATES_JSON" != "null" ]]; then
  # v2 structured write: build gate notation string from JSON array
  # Each gate object: {"gate":"verify","result":"pass"} or {"gate":"q","result":"pass","detail":"P2x1"}
  GATE_PARTS=$(echo "$GATES_JSON" | jq -r '.[] | "\(.gate):\(.result)" + (if .detail then "(\(.detail))" else "" end)' 2>/dev/null || echo "")
  GATE_LINE=$(echo "$GATE_PARTS" | tr '\n' ' ' | /usr/bin/sed 's/[[:space:]]*$//')

  # Extract retries if present
  RETRIES=$(echo "$INPUT" | jq -r '.task_metadata.retries // empty' 2>/dev/null || echo "")

  # Escape for sed
  SAFE_SUBJECT=$(echo "$TASK_SUBJECT" | /usr/bin/sed 's/[&/\]/\\&/g' | head -c 80)
  SAFE_ID=$(echo "$TASK_ID" | /usr/bin/sed 's/[&/\]/\\&/g' | head -c 40)
  SAFE_GATES=$(echo "$GATE_LINE" | /usr/bin/sed 's/[&/\]/\\&/g')

  ID_PREFIX=""
  [[ -n "$SAFE_ID" ]] && ID_PREFIX="${SAFE_ID}: "

  # Build the entry lines for sed append
  ENTRY_LINE="- [x] ${ID_PREFIX}${SAFE_SUBJECT} (${TIMESTAMP})"
  GATES_APPENDED="  gates: ${SAFE_GATES}"

  if grep -q "## State" "$LEDGER" 2>/dev/null; then
    /usr/bin/sed -i '' "/## State/a\\
${ENTRY_LINE}\\
${GATES_APPENDED}\\
" "$LEDGER" 2>/dev/null || true

    if [[ -n "$RETRIES" && "$RETRIES" != "null" ]]; then
      # Append retries line after gates line
      /usr/bin/sed -i '' "/${GATES_APPENDED}/a\\
  retries: ${RETRIES}\\
" "$LEDGER" 2>/dev/null || true
    fi
  fi
else
  # v1 fallback: simple append
  SAFE_SUBJECT=$(echo "$TASK_SUBJECT" | /usr/bin/sed 's/[&/\]/\\&/g' | head -c 80)

  if grep -q "## State" "$LEDGER" 2>/dev/null; then
    /usr/bin/sed -i '' "/## State/a\\
- Done: [x] ${SAFE_SUBJECT} (${TIMESTAMP})\\
" "$LEDGER" 2>/dev/null || true
  fi
fi

# Update timestamp
/usr/bin/sed -i '' "s/^Updated:.*$/Updated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")/" "$LEDGER" 2>/dev/null || true

echo '{"continue":true}'
