#!/bin/bash
###
# Quality Gate Check - TaskCompleted
#
# Requires .proof/{task_id}.json to exist with verdict=pass before task completes.
# exit 2 = block | exit 0 = allow
###

set -o pipefail

INPUT=$(cat)
TASK_ID=$(echo "$INPUT" | jq -r '.task_id // empty' 2>/dev/null || echo "")

[[ -z "$TASK_ID" ]] && { echo '{"continue":true}'; exit 0; }

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PROOF_FILE="$project_dir/.proof/${TASK_ID}.json"

if [[ ! -f "$PROOF_FILE" ]]; then
  echo "Quality gate: no proof manifest found for ${TASK_ID}. Run verify before completing." >&2
  exit 2
fi

VERDICT=$(jq -r '.verdict // empty' "$PROOF_FILE" 2>/dev/null || echo "")

if [[ "$VERDICT" != "pass" ]]; then
  echo "Quality gate: verify failed for ${TASK_ID}" >&2
  exit 2
fi

echo '{"continue":true}'
exit 0
