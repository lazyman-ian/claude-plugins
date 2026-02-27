#!/bin/bash
###
# Post-Edit Auto-Format Hook - PostToolUse(Edit|Write)
#
# Formats file based on extension after Edit/Write.
# Runs as async hook — timeout controlled by hooks.json.
###

set -o pipefail

input=$(cat)

# Safety: exit cleanly if stdin is empty or not JSON
if [[ -z "$input" ]]; then echo '{"result":"continue"}'; exit 0; fi

file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

# Early exit if no file path
[[ -z "$file_path" ]] && echo '{"result":"continue"}' && exit 0

# Extract extension
ext="${file_path##*.}"

# Dispatch formatter based on extension (best-effort, timeout via async hook)
case "$ext" in
    ts|tsx|js|jsx|json|css|html|md)
        if command -v prettier &>/dev/null; then
            prettier --write "$file_path" 2>/dev/null
        fi
        ;;
    swift)
        if command -v swiftformat &>/dev/null; then
            swiftformat "$file_path" 2>/dev/null
        fi
        ;;
    kt|kts)
        if command -v ktlint &>/dev/null; then
            ktlint -F "$file_path" 2>/dev/null
        fi
        ;;
    py)
        if command -v black &>/dev/null; then
            black -q "$file_path" 2>/dev/null
        fi
        ;;
esac

echo '{"result":"continue"}'
