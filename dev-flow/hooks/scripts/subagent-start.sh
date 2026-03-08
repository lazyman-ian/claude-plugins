#!/bin/bash
###
# SubagentStart Hook - Context Injection
#
# Injects project-specific context into every spawned subagent.
# Exit 0 with additionalContext to inject.
###

set -o pipefail

input=$(cat 2>/dev/null || echo '{}')

if [[ -z "$input" ]] || [[ "$input" == "{}" ]]; then
    exit 0
fi

agent_type=$(echo "$input" | jq -r '.agent_type // empty' 2>/dev/null || echo "")
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
context_parts=()

# 1. Inject platform info if .dev-flow.json exists
if [[ -f "$project_dir/.dev-flow.json" ]]; then
    platform=$(jq -r '.platform // empty' "$project_dir/.dev-flow.json" 2>/dev/null || echo "")
    if [[ -n "$platform" ]]; then
        context_parts+=("Platform: $platform")
    fi
fi

# 2. Inject current branch for git awareness
current_branch=$(git -C "$project_dir" branch --show-current 2>/dev/null || echo "")
if [[ -n "$current_branch" ]]; then
    context_parts+=("Branch: $current_branch")
fi

# 3. Inject active ledger summary for task-aware agents
if [[ "$current_branch" =~ TASK-([0-9]+) ]]; then
    task_id="TASK-${BASH_REMATCH[1]}"
    task_ledger=$(/usr/bin/find "$project_dir/thoughts/ledgers" -maxdepth 1 -name "${task_id}-*.md" 2>/dev/null | head -1)
    if [[ -n "$task_ledger" ]]; then
        # Extract goal line from ledger
        goal=$(grep -A1 "^## Goal" "$task_ledger" 2>/dev/null | tail -1 | head -c 200)
        if [[ -n "$goal" ]]; then
            context_parts+=("Task: $task_id — $goal")
        fi
    fi
fi

# Output context if we have any
if [[ ${#context_parts[@]} -gt 0 ]]; then
    context=$(printf '%s. ' "${context_parts[@]}")
    jq -n --arg ctx "$context" '{hookSpecificOutput: {hookEventName: "SubagentStart", additionalContext: $ctx}}'
else
    echo '{}'
fi

exit 0
