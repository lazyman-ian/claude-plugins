#!/bin/bash
###
# Scope Drift Check - PostToolUse(Edit|Write)
#
# Warns when modified file is not in any phase's target_files or task's files
# in the active plan. exit 0 always (warn, not block).
###

set -o pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

[[ -z "$FILE_PATH" ]] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || pwd)}"
PLANS_DIR="$project_dir/thoughts/shared/plans"
[[ ! -d "$PLANS_DIR" ]] && exit 0

# Cache file: keyed by project dir hash
DIR_HASH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g' | tail -c 32)
CACHE_FILE="/tmp/claude-scope-targets-${DIR_HASH}.txt"

# Build cache on first invocation
if [[ ! -f "$CACHE_FILE" ]]; then
  # Find active plan (status != completed)
  ACTIVE_PLAN=""
  while IFS= read -r plan_file; do
    status=$(grep -m1 '^status:' "$plan_file" 2>/dev/null | /usr/bin/sed 's/status:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
    if [[ "$status" != "completed" && "$status" != "cancelled" ]]; then
      ACTIVE_PLAN="$plan_file"
      break
    fi
  done < <(ls -t "$PLANS_DIR"/*.md 2>/dev/null)

  if [[ -z "$ACTIVE_PLAN" ]]; then
    echo "" > "$CACHE_FILE"
    exit 0
  fi

  # Extract all target_files and files entries
  grep -E '^\s+-\s+"[^"]+"' "$ACTIVE_PLAN" 2>/dev/null \
    | /usr/bin/sed 's/.*"\(.*\)".*/\1/' \
    > "$CACHE_FILE"
fi

[[ ! -s "$CACHE_FILE" ]] && exit 0

# Normalize file path relative to project dir
REL_PATH="${FILE_PATH#$project_dir/}"

# Check if file matches any pattern in cache
while IFS= read -r pattern; do
  [[ -z "$pattern" ]] && continue
  # Use case glob matching
  # shellcheck disable=SC2254
  case "$REL_PATH" in
    $pattern) exit 0 ;;
  esac
  # Exact match
  [[ "$REL_PATH" == "$pattern" ]] && exit 0
done < "$CACHE_FILE"

echo "{\"continue\":true,\"message\":\"[scope-drift] '$REL_PATH' not in active plan target_files. Verify this change is intentional.\"}"
exit 0
