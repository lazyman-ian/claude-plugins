#!/bin/bash
# dev-workflow-hooks.sh - Automate dev workflow actions
# Triggered by PostToolUse(Bash) to detect git/gh commands

# Relaxed strict mode: -e can cause issues with git commands in non-git dirs
set -o pipefail

INPUT=$(cat)

# Safe JSON parsing with fallbacks
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exitCode // 0' 2>/dev/null || echo "0")
OUTPUT=$(echo "$INPUT" | jq -r '.tool_response.output // ""' 2>/dev/null || echo "")

# Only process successful Bash commands
if [[ "$TOOL_NAME" != "Bash" ]] || [[ "$EXIT_CODE" != "0" ]]; then
    echo '{}'
    exit 0
fi

# Safe project dir detection
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$PROJECT_DIR" ]]; then
    PROJECT_DIR=$(git rev-parse --show-toplevel 2>/dev/null) || PROJECT_DIR=$(pwd)
fi
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Cascading lookup: plugin scripts first, then user's global scripts
if [[ -d "$PLUGIN_DIR/scripts" ]]; then
    SCRIPTS_DIR="$PLUGIN_DIR/scripts"
else
    SCRIPTS_DIR="$HOME/.claude/scripts"
fi

# Helper: Get current branch
get_branch() {
    git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo ""
}

# Helper: Extract TASK from branch
get_task() {
    local branch="$1"
    if [[ "$branch" =~ TASK-([0-9]+) ]]; then
        echo "TASK-${BASH_REMATCH[1]}"
    fi
}

# Helper: Check if ledger exists for current branch
has_ledger() {
    local branch=$(get_branch)
    local task=$(get_task "$branch")
    local ledger_dir="$PROJECT_DIR/thoughts/ledgers"

    # Early exit if no task or ledger dir doesn't exist
    if [[ -z "$task" ]] || [[ ! -d "$ledger_dir" ]]; then
        return 1
    fi

    local ledger=$(find "$ledger_dir" -maxdepth 1 -name "${task}-*.md" 2>/dev/null | head -1)
    [[ -n "$ledger" ]]
}

CONTEXT=""

# =============================================================================
# 1. git commit → Auto-generate reasoning
# =============================================================================
if [[ "$COMMAND" =~ git[[:space:]]+commit ]]; then
    # Extract commit hash from output
    COMMIT_HASH=$(echo "$OUTPUT" | grep -oE '\[[^]]+[[:space:]]([a-f0-9]{7,})' | grep -oE '[a-f0-9]{7,}' | head -1)

    if [[ -n "$COMMIT_HASH" ]]; then
        # Get full hash and message
        FULL_HASH=$(git -C "$PROJECT_DIR" rev-parse "$COMMIT_HASH" 2>/dev/null || echo "$COMMIT_HASH")
        COMMIT_MSG=$(git -C "$PROJECT_DIR" log -1 --format="%s" "$FULL_HASH" 2>/dev/null || echo "")

        if [[ -n "$FULL_HASH" && -n "$COMMIT_MSG" ]]; then
            # Generate reasoning (run in background to not block)
            if [[ -x "$SCRIPTS_DIR/generate-reasoning.sh" ]]; then
                "$SCRIPTS_DIR/generate-reasoning.sh" "$FULL_HASH" "$COMMIT_MSG" >/dev/null 2>&1 &
                CONTEXT="✅ Reasoning auto-generated for commit $COMMIT_HASH"
            fi

            # Update ledger if exists
            if has_ledger && [[ -x "$SCRIPTS_DIR/ledger-manager.sh" ]]; then
                "$SCRIPTS_DIR/ledger-manager.sh" update "$FULL_HASH" "$COMMIT_MSG" >/dev/null 2>&1 &
                CONTEXT="$CONTEXT\n📚 Ledger updated"
            fi
        fi
    fi
fi

# =============================================================================
# 2. gh pr create → Auto-record PR to ledger
# =============================================================================
if [[ "$COMMAND" =~ gh[[:space:]]+pr[[:space:]]+create ]]; then
    # Extract PR URL from output
    PR_URL=$(echo "$OUTPUT" | grep -oE 'https://github.com/[^[:space:]]+/pull/[0-9]+' | head -1)

    if [[ -n "$PR_URL" && -x "$SCRIPTS_DIR/ledger-manager.sh" ]]; then
        if has_ledger; then
            "$SCRIPTS_DIR/ledger-manager.sh" add-pr "$PR_URL" >/dev/null 2>&1 &
            CONTEXT="📚 PR recorded to ledger: $PR_URL"
        fi
    fi
fi

# =============================================================================
# 3. git checkout -b → Prompt to create ledger
# =============================================================================
if [[ "$COMMAND" =~ git[[:space:]]+checkout[[:space:]]+-b ]]; then
    BRANCH=$(get_branch)
    TASK=$(get_task "$BRANCH")

    if [[ -n "$TASK" ]]; then
        if ! has_ledger; then
            CONTEXT="💡 New branch created: $BRANCH\n   No ledger found for $TASK.\n   Create with: /dev start (or skip if not needed)"
        fi
    fi
fi

# =============================================================================
# 4. git push origin v* → Prompt to archive ledgers
# =============================================================================
if [[ "$COMMAND" =~ git[[:space:]]+push[[:space:]]+origin[[:space:]]+v[0-9] ]]; then
    # Extract version tag
    VERSION_TAG=$(echo "$COMMAND" | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' | head -1)

    if [[ -n "$VERSION_TAG" ]]; then
        # Check for active ledgers
        ACTIVE_LEDGERS=$(find "$PROJECT_DIR/thoughts/ledgers" -maxdepth 1 -name "TASK-*.md" 2>/dev/null | wc -l | tr -d ' ')

        if [[ "$ACTIVE_LEDGERS" -gt 0 ]]; then
            CONTEXT="🏷️ Release $VERSION_TAG pushed\n💡 $ACTIVE_LEDGERS active ledger(s) found.\n   Consider archiving completed tasks: /dev ledger archive TASK-XXX"
        fi
    fi
fi

# =============================================================================
# Output
# =============================================================================
if [[ -n "$CONTEXT" ]]; then
    # Use additionalContext to inject info to Claude
    jq -n --arg ctx "$CONTEXT" '{
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": $ctx
        }
    }'
else
    echo '{}'
fi
