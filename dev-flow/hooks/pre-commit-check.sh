#!/bin/bash
# pre-commit-check.sh - Quick checks before git commit
# Triggered by PreToolUse(Bash) for git commit commands

set -o pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Only process git commit commands
if [[ ! "$COMMAND" =~ git[[:space:]]+commit ]]; then
    echo '{}'
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
WARNINGS=""

# =============================================================================
# Quick Checks (< 1 second total)
# =============================================================================

# 1. Check for duplicate files in staged changes
STAGED_FILES=$(git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null | xargs -I{} basename {} 2>/dev/null | sort | uniq -d)
if [[ -n "$STAGED_FILES" ]]; then
    WARNINGS="$WARNINGS\n⚠️ Duplicate filenames staged: $STAGED_FILES"
fi

# 2. Check for new files in libs/ that might need verification
NEW_LIB_FILES=$(git -C "$PROJECT_DIR" diff --cached --name-only --diff-filter=A 2>/dev/null | grep "^libs/" | head -3)
if [[ -n "$NEW_LIB_FILES" ]]; then
    WARNINGS="$WARNINGS\n💡 New lib files - verify they are imported somewhere"
fi

# 3. Check for multiple repository calls in staged service files
STAGED_SERVICES=$(git -C "$PROJECT_DIR" diff --cached --name-only 2>/dev/null | grep -E "\.service\.ts$" | head -1)
if [[ -n "$STAGED_SERVICES" ]]; then
    REPO_CALLS=$(git -C "$PROJECT_DIR" diff --cached -- "$STAGED_SERVICES" 2>/dev/null | grep -c "repository\." || echo "0")
    if [[ "$REPO_CALLS" -gt 3 ]]; then
        WARNINGS="$WARNINGS\n⚠️ $STAGED_SERVICES: $REPO_CALLS repository calls - consider batching"
    fi
fi

# 4. Check for ID generation without passing to downstream
STAGED_DIFF=$(git -C "$PROJECT_DIR" diff --cached 2>/dev/null)
if echo "$STAGED_DIFF" | grep -q "randomUUID\|generateId\|uuid()" 2>/dev/null; then
    ID_GEN_COUNT=$(echo "$STAGED_DIFF" | grep -c "randomUUID\|generateId\|uuid()" || echo "0")
    if [[ "$ID_GEN_COUNT" -gt 1 ]]; then
        WARNINGS="$WARNINGS\n💡 Multiple ID generations detected ($ID_GEN_COUNT) - verify they flow correctly"
    fi
fi

# =============================================================================
# 5. Knowledge-aware pitfall check (FTS5 query)
# =============================================================================
DB_PATH="$PROJECT_DIR/.claude/cache/artifact-index/context.db"
if [[ -f "$DB_PATH" ]]; then
    # Extract keywords from added lines only (not deleted)
    ADDED_LINES=$(git -C "$PROJECT_DIR" diff --cached -U0 2>/dev/null | grep '^+' | grep -v '^+++' | head -100)
    KW=$(echo "$ADDED_LINES" | grep -oE '[a-zA-Z]{4,}' | sort -u | tr '\n' ' ' | head -c 200)

    if [[ -n "$KW" ]]; then
        FTS=$(echo "$KW" | /usr/bin/sed "s/'/''/g" | /usr/bin/sed 's/ / OR /g')
        HITS=$(sqlite3 -separator '|||' "$DB_PATH" \
            "SELECT k.title, substr(k.problem, 1, 120) FROM knowledge k
             JOIN knowledge_fts f ON k.rowid = f.rowid
             WHERE knowledge_fts MATCH '${FTS}' AND k.type = 'pitfall'
             ORDER BY rank LIMIT 3;" 2>/dev/null || true)

        if [[ -n "$HITS" ]]; then
            WARNINGS="$WARNINGS\n⚠️ Knowledge pitfalls matched:"
            while IFS='|||' read -r title problem; do
                [[ -n "$title" ]] && WARNINGS="$WARNINGS\n  - $title: $problem"
            done <<< "$HITS"
        fi
    fi
fi

# =============================================================================
# Output
# =============================================================================
if [[ -n "$WARNINGS" ]]; then
    # Return warnings but don't block
    jq -n --arg warn "$WARNINGS" '{
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "additionalContext": ("🔍 Pre-commit Check:" + $warn + "\n\nRun /dev-flow:self-check for deep analysis, or proceed with commit.")
        }
    }'
else
    echo '{}'
fi
