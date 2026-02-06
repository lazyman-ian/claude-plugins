---
description: Analyze token usage patterns and get optimization suggestions
---

Analyze token usage for the current session.

## Instructions

1. **Get context info** from Claude Code internals (if available)

2. **Analyze patterns**:
   - Current context usage percentage
   - Tool usage breakdown
   - Potential optimizations

3. **Output format**:
   ```
   📊 Token Usage Analysis

   ## Current Session
     Context Usage: XX% [████████░░] (healthy/warning/critical)

   ## Tool Usage (This Session)
     Read:      XX
     Bash:      XX
     Edit:      XX
     Grep:      XX

   ## Optimization Suggestions
     ✅ Good token efficiency
     OR
     ⚠️ Consider using Glob instead of repeated Read
     ⚠️ Large file reads detected - use offset/limit

   ## Quick Actions
     /clear              - Reset context
     /dev-flow:ledger         - Check task progress
   ```

4. **Thresholds**:
   - < 50%: healthy (green)
   - 50-70%: warning (yellow)
   - > 70%: critical (red), suggest /clear

## Tips

- Use `dev_status` for quick checks (~30 tokens)
- Avoid reading large files without offset/limit
- Use Glob/Grep instead of Bash find/grep
