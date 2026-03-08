#!/usr/bin/env bash
# docs-lint.sh: Warn when CLAUDE.md exceeds 200 lines
# PostToolUse Edit|Write — lightweight line count check

set -o pipefail

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

file_path=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || echo "")
case "$file_path" in
  *CLAUDE.md|*docs/*) ;; # continue with lint
  *) echo '{"continue": true}'; exit 0 ;; # early exit for non-doc files
esac
FILE_PATH="$file_path"
[[ ! -f "$FILE_PATH" ]] && exit 0

LINES=$(wc -l < "$FILE_PATH" | tr -d ' ')
if [[ "$LINES" -gt 200 ]]; then
    echo "CLAUDE.md is $LINES lines (recommended: ≤200). Move verbose sections to docs/ files and use @imports." >&2
fi

exit 0
