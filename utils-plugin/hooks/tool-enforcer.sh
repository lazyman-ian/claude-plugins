#!/bin/bash
###
# Tool Enforcer Hook - PreToolUse(Bash)
#
# Blocks Bash commands that should use native tools instead.
# Based on command-tools.md decision tree.
#
# Exit 2 = block action (stderr shown as error)
# Exit 0 = allow
###

set -o pipefail

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty' 2>/dev/null || echo "")

if [ "$tool" != "Bash" ]; then
    exit 0
fi

command=$(echo "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# Allow piped commands (e.g., `git log | head`) - these are legitimate Bash usage
if [[ "$command" == *"|"* ]]; then
    exit 0
fi

# Check for standalone file operation commands (block)
# ls → Glob
if [[ "$command" =~ ^[[:space:]]*(ls|/bin/ls)([[:space:]]|$) ]]; then
    echo "Use Glob tool instead of ls. Example: Glob(\"pattern/*\")" >&2
    exit 2
fi

# find → Glob
if [[ "$command" =~ ^[[:space:]]*(find|/usr/bin/find)[[:space:]] ]]; then
    echo "Use Glob tool instead of find. Example: Glob(\"**/*.ts\")" >&2
    exit 2
fi

# cat/head/tail → Read
if [[ "$command" =~ ^[[:space:]]*(cat|head|tail|/bin/cat)([[:space:]]|$) ]]; then
    echo "Use Read tool instead of cat/head/tail. Example: Read(\"file.ts\", limit=20)" >&2
    exit 2
fi

# grep/rg → Grep
if [[ "$command" =~ ^[[:space:]]*(grep|rg|/usr/bin/grep)[[:space:]] ]]; then
    echo "Use Grep tool instead of grep/rg. Example: Grep(\"pattern\", path=\"src/\")" >&2
    exit 2
fi

exit 0
