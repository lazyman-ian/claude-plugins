#!/bin/bash
# generate-reasoning.sh - Generate reasoning documentation for a commit
# Called by dev-workflow.sh PostToolUse hook after git commit

set -euo pipefail

COMMIT_HASH="${1:-}"
COMMIT_MSG="${2:-}"

if [[ -z "$COMMIT_HASH" || -z "$COMMIT_MSG" ]]; then
    echo "Usage: $0 <commit_hash> <commit_message>" >&2
    exit 1
fi

# Get project directory
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
REASONING_DIR="$PROJECT_DIR/.git/claude/commits/${COMMIT_HASH}"

# Create reasoning directory
mkdir -p "$REASONING_DIR"

# Get commit details
SHORT_HASH="${COMMIT_HASH:0:7}"
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "unknown")
FILES_CHANGED=$(git -C "$PROJECT_DIR" diff-tree --no-commit-id --name-only -r "$COMMIT_HASH" 2>/dev/null || echo "")
AUTHOR=$(git -C "$PROJECT_DIR" log -1 --format="%an" "$COMMIT_HASH" 2>/dev/null || echo "unknown")
DATE=$(git -C "$PROJECT_DIR" log -1 --format="%ci" "$COMMIT_HASH" 2>/dev/null || date -Iseconds)

# Generate reasoning document
cat > "$REASONING_DIR/reasoning.md" << EOF
# Commit: $SHORT_HASH

## Branch
$BRANCH

## What was committed
$COMMIT_MSG

## Metadata
- **Author**: $AUTHOR
- **Date**: $DATE
- **Full Hash**: $COMMIT_HASH

## Files changed
$(echo "$FILES_CHANGED" | sed 's/^/- /')

## Context
(Auto-generated - see ledger for task context if available)

## Key Decisions
(To be filled in by reasoning-generator agent if invoked)
EOF

echo "Reasoning saved to: $REASONING_DIR/reasoning.md"
