---
name: swift-audit
description: Scan Swift files for concurrency violations
argument-hint: [path]
allowed-tools: [Bash, Read, Grep, Glob]
---

# Swift Concurrency Audit

Scan the specified path (or current directory) for Swift concurrency violations.

## Target

Path to scan: $1 (default: current directory if not specified)

## Audit Process

1. **Find Swift files**: Use Glob to find all `.swift` files in the target path

2. **Run ConcurrencyGuard**: If the tool exists, execute:
   ```
   ${CLAUDE_PLUGIN_ROOT}/tools/ConcurrencyGuard/.build/release/ConcurrencyGuard [files]
   ```

3. **Fallback pattern check**: If ConcurrencyGuard not built, use Grep to detect:
   - `Task.detached` → CC-CONC-001: Prefer structured concurrency
   - `Task\s*\{` in `init` → CC-CONC-002: Avoid Task in initializers
   - `AsyncStream` without `onTermination` → CC-CONC-004: Missing cleanup
   - Multiple `Task\s*\{` in single function → CC-CONC-005: Task explosion risk
   - `for await.*\.background` → CC-CONC-008: Wrong priority

## Output Format

Report findings as:

| File:Line | Code | Issue | Severity |
|-----------|------|-------|----------|
| path/file.swift:42 | CC-CONC-001 | Task.detached usage | High |

## Remediation

For each violation, provide:
1. The specific line of code
2. Why it's problematic
3. Recommended fix with code example

Reference the `swift-concurrency` skill for detailed patterns.
