#!/usr/bin/env bash
set -o pipefail

# Memory Sync - SessionStart hook
# Bidirectional sync: MEMORY.md <-> SQLite knowledge table
# Detects human edits to MEMORY.md since last session and sets a flag for
# context-injector.ts to pick up on next dev_memory call.

input=$(cat)
if [ -z "$input" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Skip for subagents — only main session needs to sync
agent_type=$(echo "$input" | jq -r '.agent_type // "main"' 2>/dev/null || echo "main")
if [[ "$agent_type" != "main" && "$agent_type" != "unknown" ]]; then
  echo '{"continue": true}'
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Encode project dir path for Auto Memory directory (replace / with -)
encoded_path=$(echo "$project_dir" | /usr/bin/sed 's|/|-|g')
memory_dir="$HOME/.claude/projects/$encoded_path/memory"
memory_md="$memory_dir/MEMORY.md"

# If no MEMORY.md, nothing to sync
if [ ! -f "$memory_md" ]; then
  echo '{"continue": true}'
  exit 0
fi

db_path="$project_dir/.claude/cache/artifact-index/context.db"

# If no SQLite DB, nothing to sync FROM
if [ ! -f "$db_path" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Check if MEMORY.md was manually edited since last sync
# Compare mtime of MEMORY.md vs a sync marker file
sync_marker="$project_dir/.claude/cache/.memory-sync-marker"

if [ -f "$sync_marker" ] && [ "$memory_md" -nt "$sync_marker" ]; then
  # MEMORY.md was edited after last sync — flag it for context-injector.ts
  # Write a flag file that context-injector picks up on next dev_memory call
  flag_file="$project_dir/.claude/cache/.memory-human-edited"
  mkdir -p "$(dirname "$flag_file")"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$flag_file" 2>/dev/null
fi

# Touch sync marker to record this sync time
mkdir -p "$(dirname "$sync_marker")"
touch "$sync_marker"

# Write knowledge injection filter: only critical priority at session start
# session-start-continuity.sh reads this policy via SQL WHERE priority='critical'
filter_file="$project_dir/.claude/cache/.knowledge-filter.json"
mkdir -p "$(dirname "$filter_file")"
echo '{"inject_priority":"critical"}' > "$filter_file" 2>/dev/null || true

echo '{"continue": true}'
exit 0
