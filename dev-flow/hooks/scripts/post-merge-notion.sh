#!/usr/bin/env bash
set -o pipefail

# Post-merge/push hook: suggest Notion status update
# Triggered by: Bash(git merge*), Bash(git push*) and chained variants

input=$(cat)
if [ -z "$input" ]; then
  echo '{"continue": true}'
  exit 0
fi

tool_name=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
tool_input=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

# Only process git merge/push commands
case "$tool_input" in
  *"git merge"*|*"git push"*) ;;
  *) echo '{"continue": true}'; exit 0 ;;
esac

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
config_file="$project_dir/.dev-flow.json"

# Check if Notion is configured
if [ ! -f "$config_file" ]; then
  echo '{"continue": true}'
  exit 0
fi

has_notion=$(jq -r '.notion.database_id // empty' "$config_file" 2>/dev/null || echo "")
if [ -z "$has_notion" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Find recent SPEC file for current branch
branch=$(git -C "$project_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$branch" ]; then
  echo '{"continue": true}'
  exit 0
fi

# Look for SPEC files with source_id in frontmatter
spec_dir="$project_dir/thoughts/shared/specs"
if [ -d "$spec_dir" ]; then
  latest_spec=$(/usr/bin/find "$spec_dir" -name "SPEC-*.md" -newer "$config_file" 2>/dev/null | head -1)
  if [ -n "$latest_spec" ]; then
    source_id=$(/usr/bin/sed -n 's/^source_id: *//p' "$latest_spec" 2>/dev/null | head -1)
    if [ -n "$source_id" ]; then
      jq -n --arg src "$source_id" '{"continue": true, "reason": ("Consider updating Notion task status (source: " + $src + ") after this merge/push.")}'
      exit 0
    fi
  fi
fi

echo '{"continue": true}'
exit 0
