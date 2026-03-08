#!/bin/bash
###
# Plan Scope Check - PermissionRequest(Edit|Write)
#
# Approves file access if the target file is in the active plan's scope.
# Outputs: {"decision": "approve"} | {"decision": "ask"}
# NEVER outputs {"decision": "deny"}
###

set -o pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

[[ -z "$FILE_PATH" ]] && echo '{"decision":"ask"}' && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || pwd)}"
PLANS_DIR="$project_dir/thoughts/shared/plans"
CACHE_DIR="$project_dir/.claude/cache"

# Compute branch hash (same as scope-drift-check.sh)
CURRENT_BRANCH=$(git -C "$project_dir" branch --show-current 2>/dev/null)
if [[ -n "$CURRENT_BRANCH" ]]; then
  BRANCH_HASH=$(echo "$CURRENT_BRANCH" | (shasum 2>/dev/null || sha1sum) | cut -c1-12)
else
  BRANCH_HASH=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g' | tail -c 32)
fi
SCOPE_CACHE_FILE="/tmp/claude-scope-targets-${BRANCH_HASH}.txt"

# Find the active plan path
ACTIVE_PLAN=""

# 1. Check auto-pipeline state file
if [[ -d "$CACHE_DIR" ]]; then
  for state_file in "$CACHE_DIR"/.auto-pipeline-*.json; do
    [[ -f "$state_file" && "$state_file" != *.done.json ]] || continue
    plan_path=$(jq -r '.plan_path // empty' "$state_file" 2>/dev/null || echo "")
    if [[ -n "$plan_path" && -f "$plan_path" ]]; then
      ACTIVE_PLAN="$plan_path"
      break
    fi
  done
fi

# 2. Check ledger for plan reference
if [[ -z "$ACTIVE_PLAN" ]]; then
  LEDGER_DIR="$project_dir/thoughts/ledgers"
  if [[ -d "$LEDGER_DIR" ]]; then
    while IFS= read -r ledger_file; do
      # Look for plan path references like thoughts/shared/plans/xxx.md
      plan_ref=$(grep -m1 'thoughts/shared/plans/.*\.md' "$ledger_file" 2>/dev/null | grep -oE 'thoughts/shared/plans/[^[:space:]"'"'"']+\.md' | head -1)
      if [[ -n "$plan_ref" ]]; then
        candidate="$project_dir/$plan_ref"
        if [[ -f "$candidate" ]]; then
          ACTIVE_PLAN="$candidate"
          break
        fi
      fi
    done < <(ls -t "$LEDGER_DIR"/CONTINUITY_CLAUDE-*.md 2>/dev/null)
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

# Check shared scope cache (also written/read by scope-drift-check.sh)
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

  # Write shared scope cache (compatible with scope-drift-check.sh format)
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
