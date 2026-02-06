#!/bin/bash
# Swift Concurrency Check - PostToolUse Hook
# Checks edited Swift files for concurrency issues

set -eo pipefail

# Read input from stdin
input=$(cat)

# Extract tool info
tool_name=$(echo "$input" | jq -r '.tool_name // ""')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# Only check Swift files
if [[ ! "$file_path" =~ \.swift$ ]]; then
    exit 0
fi

# Check if file exists and is readable
if [[ ! -r "$file_path" ]]; then
    exit 0
fi

# Read file content
content=$(cat "$file_path" 2>/dev/null || true)

# Quick concurrency checks
issues=""

# Check for Task.detached
if echo "$content" | grep -q "Task\.detached" 2>/dev/null; then
    issues="${issues}- Task.detached usage detected (prefer structured concurrency)\n"
fi

# Check for Task in init
if echo "$content" | grep -E "init\s*\([^)]*\)\s*\{[^}]*Task\s*\{" > /dev/null 2>&1; then
    issues="${issues}- Task in initializer (may cause side effects)\n"
fi

# Check for @MainActor missing on UI-related types
if echo "$content" | grep -E "(struct|class)\s+.*View.*:" > /dev/null 2>&1; then
    if ! echo "$content" | grep -q "@MainActor" > /dev/null 2>&1; then
        issues="${issues}- SwiftUI View without @MainActor (may cause thread-safety issues)\n"
    fi
fi

# Output findings
if [[ -n "$issues" ]]; then
    echo "⚠️ Swift Concurrency Check: $file_path"
    echo -e "$issues"
fi

exit 0
