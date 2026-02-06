#!/bin/bash
# ConcurrencyGuard PreToolUse Hook
# Blocks edits that introduce Swift concurrency anti-patterns

set -o pipefail

# Read input from stdin
input=$(cat)

# Extract tool info
tool_name=$(echo "$input" | jq -r '.tool_name // ""' 2>/dev/null || echo "")
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")

# Only check Swift files (early exit before parsing content)
if [[ ! "$file_path" =~ \.swift$ ]]; then
    echo '{"decision": "allow"}'
    exit 0
fi

new_content=$(echo "$input" | jq -r '.tool_input.content // .tool_input.new_string // ""' 2>/dev/null || echo "")

# Check if ConcurrencyGuard binary exists
GUARD_BIN="${CLAUDE_PLUGIN_ROOT:-}/tools/ConcurrencyGuard/.build/release/ConcurrencyGuard"

if [[ -x "$GUARD_BIN" ]]; then
    # Use SwiftSyntax-based analyzer
    result=$("$GUARD_BIN" --stdin <<< "$new_content" 2>&1 || true)

    if echo "$result" | grep -q "VIOLATION"; then
        echo "{\"decision\": \"deny\", \"reason\": \"Concurrency violation detected: $result\"}" >&2
        exit 2
    fi
else
    # Fallback to grep-based detection
    violations=""

    # CC-CONC-001: Task.detached
    if echo "$new_content" | grep -q "Task\.detached" 2>/dev/null || false; then
        violations="${violations}CC-CONC-001: Task.detached usage (prefer structured concurrency); "
    fi

    # CC-CONC-002: Task{} in init
    if echo "$new_content" | grep -E "init\s*\([^)]*\)\s*\{[^}]*Task\s*\{" > /dev/null 2>&1 || false; then
        violations="${violations}CC-CONC-002: Task in initializer (causes side effects); "
    fi

    # CC-CONC-003: Task in body/layoutSubviews (simplified check)
    if echo "$new_content" | grep -E "(var body|func layoutSubviews)[^}]*Task\s*\{" > /dev/null 2>&1 || false; then
        violations="${violations}CC-CONC-003: Task in render path (blocks UI); "
    fi

    # CC-CONC-008: .background with for await
    if echo "$new_content" | grep -E "\.background.*for await|for await.*\.background" > /dev/null 2>&1 || false; then
        violations="${violations}CC-CONC-008: Background priority with for await (priority inversion); "
    fi

    if [[ -n "$violations" ]]; then
        echo "{\"decision\": \"deny\", \"reason\": \"$violations\"}" >&2
        exit 2
    fi
fi

# All checks passed
echo '{"decision": "allow"}'
exit 0
