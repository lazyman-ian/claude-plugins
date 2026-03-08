#!/usr/bin/env bash
# Auto-pipeline state file helper — sourced by other hooks/scripts
# State file: .claude/cache/.auto-pipeline-{task_id}.json

set -o pipefail

auto_state_init() {
  local project_dir="$1" task_id="$2" source_text="$3"
  local cache_dir="$project_dir/.claude/cache"
  local state_file="$cache_dir/.auto-pipeline-${task_id}.json"

  mkdir -p "$cache_dir"

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  cat > "$state_file" <<EOF
{
  "auto": true,
  "task_id": "${task_id}",
  "current_stage": "spec",
  "created_at": "${now}",
  "spec_path": "",
  "plan_path": "",
  "source_text": $(echo "$source_text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')
}
EOF

  echo "$state_file"
}

auto_state_read() {
  local project_dir="$1" task_id="${2:-}"
  local cache_dir="$project_dir/.claude/cache"

  if [[ -n "$task_id" ]]; then
    local state_file="$cache_dir/.auto-pipeline-${task_id}.json"
    if [[ -f "$state_file" ]]; then
      cat "$state_file"
      return 0
    fi
    return 1
  fi

  # No task_id: find newest active state file
  local newest=""
  local newest_time=0
  for f in "$cache_dir"/.auto-pipeline-*.json; do
    [[ -f "$f" ]] || continue
    [[ "$f" == *.done.json ]] && continue
    local mtime
    mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
    if (( mtime > newest_time )); then
      newest="$f"
      newest_time=$mtime
    fi
  done

  if [[ -n "$newest" ]]; then
    cat "$newest"
    return 0
  fi
  return 1
}

auto_state_advance() {
  local project_dir="$1" task_id="$2" stage="$3"
  local cache_dir="$project_dir/.claude/cache"
  local state_file="$cache_dir/.auto-pipeline-${task_id}.json"

  [[ -f "$state_file" ]] || return 1

  local tmp_file="${state_file}.tmp"
  jq --arg stage "$stage" '.current_stage = $stage' "$state_file" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$state_file"

  if [[ "$stage" == "done" ]]; then
    auto_state_cleanup "$project_dir" "$task_id"
  fi
}

auto_state_cleanup() {
  local project_dir="$1" task_id="$2"
  local cache_dir="$project_dir/.claude/cache"
  local state_file="$cache_dir/.auto-pipeline-${task_id}.json"
  local done_file="$cache_dir/.auto-pipeline-${task_id}.done.json"

  if [[ -f "$state_file" ]]; then
    jq '.current_stage = "done"' "$state_file" > "$done_file" 2>/dev/null && rm -f "$state_file"
  fi
}
