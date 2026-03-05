#!/usr/bin/env bash
# docs-reminder.sh: Remind to update docs when new API/service files are added
# PostToolUse Write — triggers only on new file creation in api/routes/services dirs

set -o pipefail

INPUT=$(cat 2>/dev/null || echo "")
[[ -z "$INPUT" ]] && exit 0

TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
[[ "$TOOL" != "Write" ]] && exit 0

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
[[ -z "$FILE_PATH" ]] && exit 0

# Only trigger for new files in API/service directories
if echo "$FILE_PATH" | grep -qE '/(api|routes|services|endpoints|controllers)/[^/]+\.[a-z]+$'; then
    DOCS_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/docs"
    if [[ -f "$DOCS_DIR/toolbox.md" ]]; then
        echo "New API/service file created. Consider updating docs/toolbox.md with the new module." >&2
    fi
fi

exit 0
