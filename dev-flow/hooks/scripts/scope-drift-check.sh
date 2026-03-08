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

# Cache file: keyed by branch name hash
CURRENT_BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null)
if [[ -n "$CURRENT_BRANCH" ]]; then
  BRANCH_HASH=$(echo "$CURRENT_BRANCH" | (shasum 2>/dev/null || sha1sum) | cut -c1-12)
else
  # Detached HEAD: fall back to dir hash
  BRANCH_HASH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g' | tail -c 32)
fi
CACHE_FILE="/tmp/claude-scope-targets-${BRANCH_HASH}.txt"

# Find active plan (status != completed)
_find_active_plan() {
  local found=""
  while IFS= read -r plan_file; do
    local status
    status=$(grep -m1 '^status:' "$plan_file" 2>/dev/null | /usr/bin/sed 's/status:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
    if [[ "$status" != "completed" && "$status" != "cancelled" ]]; then
      found="$plan_file"
      break
    fi
  done < <(ls -t "$PLANS_DIR"/*.md 2>/dev/null)
  echo "$found"
}

# Check if cache is valid (branch matches, plan path matches, mtime matches)
CACHE_VALID=false
if [[ -f "$CACHE_FILE" ]]; then
  CACHE_HEADER=$(head -1 "$CACHE_FILE" 2>/dev/null || echo "")
  # Header format: branch|plan_path|plan_mtime
  CACHED_BRANCH=$(echo "$CACHE_HEADER" | cut -d'|' -f1)
  CACHED_PLAN=$(echo "$CACHE_HEADER" | cut -d'|' -f2)
  CACHED_MTIME=$(echo "$CACHE_HEADER" | cut -d'|' -f3)

  if [[ "$CACHED_BRANCH" == "$CURRENT_BRANCH" && -n "$CACHED_PLAN" && -f "$CACHED_PLAN" ]]; then
    CURRENT_MTIME=$(stat -f%m "$CACHED_PLAN" 2>/dev/null || stat -c%Y "$CACHED_PLAN" 2>/dev/null || echo "0")
    if [[ "$CURRENT_MTIME" == "$CACHED_MTIME" ]]; then
      CACHE_VALID=true
    fi
  fi
fi

# Build cache when invalid
if [[ "$CACHE_VALID" != "true" ]]; then
  ACTIVE_PLAN=$(_find_active_plan)

  if [[ -z "$ACTIVE_PLAN" ]]; then
    # Write empty cache with metadata so we don't re-scan on every invocation
    printf '%s||0\n' "$CURRENT_BRANCH" > "$CACHE_FILE"
    exit 0
  fi

  PLAN_MTIME=$(stat -f%m "$ACTIVE_PLAN" 2>/dev/null || stat -c%Y "$ACTIVE_PLAN" 2>/dev/null || echo "0")

  # Write header metadata line
  printf '%s|%s|%s\n' "$CURRENT_BRANCH" "$ACTIVE_PLAN" "$PLAN_MTIME" > "$CACHE_FILE"

  # Extract all target_files and files entries (quoted: "file.ts")
  grep -E '^\s+-\s+"[^"]+"' "$ACTIVE_PLAN" 2>/dev/null \
    | /usr/bin/sed 's/.*"\(.*\)".*/\1/' \
    >> "$CACHE_FILE"

  # Also extract unquoted entries: - file.ts
  grep -E '^\s+-\s+[^\s"]+' "$ACTIVE_PLAN" 2>/dev/null \
    | /usr/bin/sed 's/^\s*-\s*//' \
    | grep -v '^"' \
    >> "$CACHE_FILE"
fi

# Normalize file path relative to project dir
REL_PATH="${FILE_PATH#$project_dir/}"

# Check if file matches any pattern in cache (skip header line)
FIRST_LINE=true
while IFS= read -r pattern; do
  # Skip header metadata line
  if [[ "$FIRST_LINE" == "true" ]]; then
    FIRST_LINE=false
    continue
  fi
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
