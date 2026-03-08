#!/bin/bash
###
# Plan Scope Check - PermissionRequest(Edit|Write)
#
# Approves file access if the target file is in the active plan's scope.
# Outputs: {"decision": "approve"} | {"decision": "ask"}
# NEVER outputs {"decision": "deny"}
###

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/registry.sh"

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

[[ -z "$FILE_PATH" ]] && echo '{"decision":"ask"}' && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || pwd)}"
PLANS_DIR="$project_dir/thoughts/plans"
CACHE_DIR="$project_dir/.claude/state/cache"
mkdir -p "$CACHE_DIR"

# Shared scope cache file
CURRENT_BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null)
SCOPE_CACHE_FILE="$CACHE_DIR/scope-targets.txt"

# Find the active plan path
ACTIVE_PLAN=""

# 1. Check auto-pipeline state files
STATE_DIR="$project_dir/.claude/state/pipeline"
if [[ -d "$STATE_DIR" ]]; then
  for state_file in "$STATE_DIR"/*.json; do
    [[ -f "$state_file" && "$state_file" != *.done.json ]] || continue
    plan_path=$(jq -r '.plan_path // empty' "$state_file" 2>/dev/null || echo "")
    if [[ -n "$plan_path" && -f "$plan_path" ]]; then
      ACTIVE_PLAN="$plan_path"
      break
    fi
  done
fi

# 2. Check registry for active ledger plan reference
if [[ -z "$ACTIVE_PLAN" ]]; then
  LEDGER_PATH=$(registry_resolve "$project_dir" 2>/dev/null || true)
  if [[ -n "$LEDGER_PATH" ]]; then
    if [[ ! "$LEDGER_PATH" = /* ]]; then
      LEDGER_PATH="$project_dir/$LEDGER_PATH"
    fi
    if [[ -f "$LEDGER_PATH" ]]; then
      plan_ref=$(grep -m1 'thoughts/plans/.*\.md\|thoughts/shared/plans/.*\.md' "$LEDGER_PATH" 2>/dev/null \
        | grep -oE 'thoughts/(shared/)?plans/[^[:space:]"'"'"']+\.md' | head -1)
      if [[ -n "$plan_ref" ]]; then
        candidate="$project_dir/$plan_ref"
        [[ -f "$candidate" ]] && ACTIVE_PLAN="$candidate"
      fi
    fi
  fi
fi

# 3. Fall back to newest in-progress plan
if [[ -z "$ACTIVE_PLAN" && -d "$PLANS_DIR" ]]; then
  while IFS= read -r plan_file; do
    status=$(grep -m1 '^status:' "$plan_file" 2>/dev/null | /usr/bin/sed 's/status:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
    if [[ "$status" != "completed" && "$status" != "cancelled" && -n "$status" ]]; then
      ACTIVE_PLAN="$plan_file"
      break
    fi
  done < <(ls -t "$PLANS_DIR"/*.md 2>/dev/null)
fi

# No active plan found — use default dialog
[[ -z "$ACTIVE_PLAN" ]] && echo '{"decision":"ask"}' && exit 0

# Check shared scope cache
TARGET_FILES=""
CACHE_VALID=false
if [[ -f "$SCOPE_CACHE_FILE" ]]; then
  CACHE_HEADER=$(head -1 "$SCOPE_CACHE_FILE" 2>/dev/null || echo "")
  CACHED_BRANCH=$(echo "$CACHE_HEADER" | cut -d'|' -f1)
  CACHED_PLAN=$(echo "$CACHE_HEADER" | cut -d'|' -f2)
  CACHED_MTIME=$(echo "$CACHE_HEADER" | cut -d'|' -f3)
  if [[ "$CACHED_BRANCH" == "$CURRENT_BRANCH" && "$CACHED_PLAN" == "$ACTIVE_PLAN" && -f "$CACHED_PLAN" ]]; then
    CURRENT_MTIME=$(stat -f%m "$CACHED_PLAN" 2>/dev/null || stat -c%Y "$CACHED_PLAN" 2>/dev/null || echo "0")
    if [[ "$CURRENT_MTIME" == "$CACHED_MTIME" ]]; then
      CACHE_VALID=true
      TARGET_FILES=$(tail -n +2 "$SCOPE_CACHE_FILE" 2>/dev/null | grep -v '^$' || echo "")
    fi
  fi
fi

if [[ "$CACHE_VALID" != "true" ]]; then
  # Extract target_files from the plan (quoted and unquoted YAML list items)
  # Matches:  - "path/to/file"  and  - path/to/file
  TARGET_FILES=$(grep -E '^\s+-\s+("?)[^"#]' "$ACTIVE_PLAN" 2>/dev/null \
    | /usr/bin/sed 's/.*-[[:space:]]*//' \
    | tr -d '"' \
    | tr -d "'" \
    | sed 's/[[:space:]].*//' \
    | grep -v '^$' || echo "")

  # Write shared scope cache
  PLAN_MTIME=$(stat -f%m "$ACTIVE_PLAN" 2>/dev/null || stat -c%Y "$ACTIVE_PLAN" 2>/dev/null || echo "0")
  {
    printf '%s|%s|%s\n' "$CURRENT_BRANCH" "$ACTIVE_PLAN" "$PLAN_MTIME"
    echo "$TARGET_FILES"
  } > "$SCOPE_CACHE_FILE" 2>/dev/null || true
fi

[[ -z "$TARGET_FILES" ]] && echo '{"decision":"ask"}' && exit 0

# Normalize requested file path relative to project dir
REL_PATH="${FILE_PATH#$project_dir/}"

# Check if file matches any target
while IFS= read -r pattern; do
  [[ -z "$pattern" ]] && continue
  # shellcheck disable=SC2254
  case "$REL_PATH" in
    $pattern)
      echo '{"decision":"approve","reason":"File in active plan scope"}'
      exit 0
      ;;
  esac
  [[ "$REL_PATH" == "$pattern" ]] && echo '{"decision":"approve","reason":"File in active plan scope"}' && exit 0
done <<< "$TARGET_FILES"

# File not in plan scope — use default dialog
echo '{"decision":"ask"}'
exit 0
