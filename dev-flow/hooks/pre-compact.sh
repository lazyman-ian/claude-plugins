#!/bin/bash
# Relaxed: -e can cause issues with git commands in non-git dirs
set -o pipefail

# Update active ledger timestamp before compaction
project_dir="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$project_dir" ]]; then
    project_dir=$(git rev-parse --show-toplevel 2>/dev/null) || project_dir=$(pwd)
fi
if [[ -d "$project_dir/thoughts/ledgers" ]]; then
    current_branch=$(git -C "$project_dir" branch --show-current 2>/dev/null || true)
    if [[ "$current_branch" =~ TASK-([0-9]+) ]]; then
        task_id="TASK-${BASH_REMATCH[1]}"
        task_ledger=$(find "$project_dir/thoughts/ledgers" -maxdepth 1 -name "${task_id}-*.md" 2>/dev/null | head -1)

        if [[ -n "$task_ledger" && -f "$task_ledger" ]]; then
            # Update timestamp to mark last activity before compaction
            sed -i '' "s/^Updated: .*/Updated: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")/" "$task_ledger" 2>/dev/null || true

            # Add compaction note if not already present today
            today=$(date +"%Y-%m-%d")
            if ! grep -q "### $today" "$task_ledger" 2>/dev/null; then
                echo -e "\n### $today\n- 🔄 Context compaction" >> "$task_ledger"
            elif ! grep -q "🔄 Context compaction" "$task_ledger" 2>/dev/null; then
                sed -i '' "/^### $today/a\\
- 🔄 Context compaction\\
" "$task_ledger" 2>/dev/null || true
            fi
        fi
    fi
fi

# Run main continuity handler (self-contained)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cat | node "$SCRIPT_DIR/dist/pre-compact-continuity.mjs"
