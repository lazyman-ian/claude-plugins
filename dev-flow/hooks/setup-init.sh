#!/bin/bash
# setup-init.sh - Setup Hook for project initialization and maintenance
# Claude Code v2.1.10+
#
# Installation:
#   cp hooks/setup-init.sh ~/.claude/hooks/
#   chmod +x ~/.claude/hooks/setup-init.sh
#
# Add to ~/.claude/settings.json:
#   "hooks": {
#     "Setup": [{
#       "matcher": "init|maintenance",
#       "hooks": [{
#         "type": "command",
#         "command": "$HOME/.claude/hooks/setup-init.sh",
#         "timeout": 30
#       }]
#     }]
#   }

set -euo pipefail

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "init"')
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

case "$TRIGGER" in
  init)
    # Initialize dev-flow directory structure
    mkdir -p "$PROJECT_DIR/thoughts/ledgers"
    mkdir -p "$PROJECT_DIR/thoughts/handoffs"
    mkdir -p "$PROJECT_DIR/thoughts/plans"
    mkdir -p "$PROJECT_DIR/thoughts/shared/plans"

    # Create .gitignore if needed
    if [[ ! -f "$PROJECT_DIR/thoughts/.gitignore" ]]; then
      cat > "$PROJECT_DIR/thoughts/.gitignore" << 'EOF'
# Dev-flow cache
*.local.md
.DS_Store
EOF
    fi

    echo "✅ dev-flow initialized"
    echo "  📁 thoughts/ledgers, handoffs, plans created"
    ;;

  maintenance)
    # Clean old cache files
    cleaned=0

    # Clean old cache in ~/.claude/cache (>7 days)
    if [[ -d "$HOME/.claude/cache" ]]; then
      count=$(find "$HOME/.claude/cache" -type f -mtime +7 2>/dev/null | wc -l | xargs)
      if [[ $count -gt 0 ]]; then
        find "$HOME/.claude/cache" -type f -mtime +7 -delete 2>/dev/null || true
        cleaned=$((cleaned + count))
      fi
    fi

    # Clean old transcripts (>30 days)
    if [[ -d "$HOME/.claude/projects" ]]; then
      count=$(find "$HOME/.claude/projects" -name "*.jsonl" -mtime +30 2>/dev/null | wc -l | xargs)
      if [[ $count -gt 0 ]]; then
        find "$HOME/.claude/projects" -name "*.jsonl" -mtime +30 -delete 2>/dev/null || true
        cleaned=$((cleaned + count))
      fi
    fi

    # Clean old tool history (keep last 500 lines)
    if [[ -f "$HOME/.claude/state/tool_history.log" ]]; then
      line_count=$(wc -l < "$HOME/.claude/state/tool_history.log" 2>/dev/null || echo 0)
      if [[ $line_count -gt 1000 ]]; then
        tail -500 "$HOME/.claude/state/tool_history.log" > "$HOME/.claude/state/tool_history.log.tmp"
        mv "$HOME/.claude/state/tool_history.log.tmp" "$HOME/.claude/state/tool_history.log"
        cleaned=$((cleaned + 1))
      fi
    fi

    echo "✅ Maintenance complete"
    echo "  🧹 Cleaned $cleaned files/entries"
    ;;

  *)
    echo "❌ Unknown trigger: $TRIGGER"
    echo "   Supported: init, maintenance"
    exit 1
    ;;
esac
