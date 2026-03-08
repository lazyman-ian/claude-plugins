#!/bin/bash
# Context Registry — branch→ledger mapping helpers
# Source this file: source "$(dirname "$0")/lib/registry.sh"

_REGISTRY_RELPATH=".claude/state/context.json"

# registry_path(project_dir) → stdout: full path to context.json
registry_path() {
  echo "${1}/${_REGISTRY_RELPATH}"
}

# registry_ensure_dir(project_dir) — create .claude/state/ if missing
registry_ensure_dir() {
  local dir="${1}/.claude/state"
  [[ -d "$dir" ]] || mkdir -p "$dir"
}

# registry_read(project_dir) → stdout: full JSON
registry_read() {
  local reg
  reg=$(registry_path "$1")
  if [[ -f "$reg" ]]; then
    cat "$reg"
  else
    echo '{"version":1,"branches":{}}'
  fi
}

# registry_lookup(project_dir [, branch]) → stdout: ledger path (or empty)
# If branch omitted, uses current git branch
registry_lookup() {
  local project_dir="$1"
  local branch="${2:-$(git -C "$project_dir" branch --show-current 2>/dev/null)}"
  [[ -z "$branch" ]] && return 1

  local reg
  reg=$(registry_path "$project_dir")
  [[ -f "$reg" ]] || return 1

  local ledger
  ledger=$(jq -r --arg b "$branch" '.branches[$b].ledger // empty' "$reg" 2>/dev/null)
  [[ -n "$ledger" ]] && echo "$ledger" && return 0
  return 1
}

# registry_write(project_dir, branch, ledger_path [, task_id]) — update registry
registry_write() {
  local project_dir="$1" branch="$2" ledger_path="$3" task_id="${4:-}"
  registry_ensure_dir "$project_dir"

  local reg_file
  reg_file=$(registry_path "$project_dir")
  local current
  current=$(registry_read "$project_dir")

  local tmp
  tmp=$(mktemp "${reg_file}.XXXXXX")

  local ok=0
  if [[ -n "$task_id" ]]; then
    echo "$current" | jq --arg b "$branch" --arg l "$ledger_path" --arg t "$task_id" \
      '.branches[$b] = {ledger: $l, task_id: $t}' > "$tmp" 2>/dev/null && ok=1
  else
    echo "$current" | jq --arg b "$branch" --arg l "$ledger_path" \
      '.branches[$b] = {ledger: $l}' > "$tmp" 2>/dev/null && ok=1
  fi

  if [[ "$ok" -eq 1 ]]; then
    mv "$tmp" "$reg_file"
  else
    rm -f "$tmp"
    return 1
  fi
}

# registry_remove(project_dir, branch) — remove branch entry
registry_remove() {
  local project_dir="$1" branch="$2"
  local reg_file
  reg_file=$(registry_path "$project_dir")
  [[ -f "$reg_file" ]] || return 0

  local current tmp
  current=$(registry_read "$project_dir")
  tmp=$(mktemp "${reg_file}.XXXXXX")
  if echo "$current" | jq --arg b "$branch" 'del(.branches[$b])' > "$tmp" 2>/dev/null; then
    mv "$tmp" "$reg_file"
  else
    rm -f "$tmp"
    return 1
  fi
}

# registry_fallback_scan(project_dir) → stdout: relative ledger path (most recent by mtime)
registry_fallback_scan() {
  local project_dir="$1"
  local ledger_dir="${project_dir}/thoughts/ledgers"
  [[ -d "$ledger_dir" ]] || return 1

  local latest
  latest=$(ls -t "$ledger_dir"/*.md 2>/dev/null | head -1)
  [[ -n "$latest" ]] && echo "thoughts/ledgers/$(basename "$latest")" && return 0
  return 1
}

# registry_resolve(project_dir [, branch]) → stdout: ledger path (registry or fallback)
registry_resolve() {
  local project_dir="$1"
  local branch="${2:-}"
  local ledger

  if [[ -n "$branch" ]]; then
    ledger=$(registry_lookup "$project_dir" "$branch")
  else
    ledger=$(registry_lookup "$project_dir")
  fi

  if [[ -n "$ledger" ]]; then
    echo "$ledger"
    return 0
  fi

  registry_fallback_scan "$project_dir"
}
