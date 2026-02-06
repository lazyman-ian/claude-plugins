---
description: Check Claude Code releases and optimize configuration for new features
---

# /config-optimize - Configuration Optimization

Check Claude Code releases and optimize your configuration.

## Usage

```bash
/config-optimize          # Full workflow
/config-optimize check    # Only check (no changes)
/config-optimize apply    # Apply pending optimizations
```

## Auto Execute

1. **Get version info**:
   ```bash
   claude --version
   cat ~/.claude/config-optimize-state.json 2>/dev/null
   ```

2. **Fetch release notes**:
   ```
   WebFetch("https://github.com/anthropics/claude-code/releases",
            "Extract features for versions above {last_version}")
   ```

3. **Analyze current config**:
   - Read `~/.claude/settings.json`
   - Scan `~/.claude/hooks/`
   - Scan `~/.claude/rules/`
   - Check enabled plugins

4. **Generate proposals**:
   - Compare new features vs current config
   - Output to `thoughts/config-optimizations/CHECK-YYYY-MM-DD.md`

5. **Apply (with approval)**:
   - Present proposals to user
   - Apply selected changes
   - Update checkpoint

## Quick Reference

| New Feature | Config Location |
|-------------|-----------------|
| Hook timeout | `settings.json` hooks.*.timeout |
| Env vars | `settings.json` env.* |
| New hook types | `settings.json` hooks.* |
| Skills/Commands | `commands/*.md` |
| Rules | `~/.claude/rules/*.md` |

## Output

```
## Config Optimization Report - 2026-01-11

### Current Version: 2.1.3
### Last Checked: 2.1.0

### New Features Available:
1. [Feature] - [How to enable]
2. [Feature] - [How to enable]

### Recommendations:
- [x] Already using: [feature]
- [ ] Can enable: [feature]
- [ ] Consider: [feature]
```
