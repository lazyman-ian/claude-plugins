---
name: plugin-release
description: >-
  Automates plugin version upgrades across all manifest files, changelogs, and badges.
  This skill should be used when bumping plugin versions, publishing releases, or checking
  manifest consistency across plugin.json, marketplace.json, and README files.
  Triggers on "release plugin", "bump version", "publish plugin", "update marketplace",
  "plugin version", "check versions", "发布插件", "插件版本升级", "版本一致性检查".
  Do NOT use for git tag releases — use "dev" skill with /dev release instead.
model: sonnet
memory: project
allowed-tools: [Read, Edit, Glob, Grep, Bash, mcp__plugin_dev-flow_dev-flow__dev_version, mcp__plugin_dev-flow_dev-flow__dev_config]
---

# plugin-release - Plugin Version Upgrade Automation

Automates the 4-file version update pattern for this plugin monorepo.

## When to Use

| Scenario | Action |
|----------|--------|
| Version bump | Update all manifest files + badge |
| Pre-release audit | Check consistency without changing |
| Post-release verify | Confirm all files match |

## Files to Update (per plugin)

Every version bump touches up to 4 files:

| # | File | Field |
|---|------|-------|
| 1 | `<plugin>/.claude-plugin/plugin.json` | `"version"` |
| 2 | `.claude-plugin/marketplace.json` (root) | `"version"` in plugins array |
| 3 | `<plugin>/.claude-plugin/marketplace.json` | `"version"` (if exists) |
| 4 | `<plugin>/README.md` | Badge `version-X.Y.Z-blue` |

Not all plugins have files 3 and 4. See `references/version-checklist.md` for per-plugin details.

## Workflow

### Step 1: Identify Plugin

Detect from user input or current working directory. Valid plugins:

| Plugin | Directory |
|--------|-----------|
| dev-flow | `dev-flow/` |
| ios-swift-plugin | `ios-swift-plugin/` |
| utils | `utils-plugin/` |
| research | `research-plugin/` |

### Step 2: Read Current Versions

Read all manifest files and extract current version from each.

### Step 3: Show Version Diff

Display table of current vs new version per file:

```
| File                              | Current | New   |
|-----------------------------------|---------|-------|
| dev-flow/.claude-plugin/plugin.json | 5.0.0   | 5.1.0 |
| .claude-plugin/marketplace.json     | 5.0.0   | 5.1.0 |
| dev-flow/.claude-plugin/marketplace.json | 5.0.0 | 5.1.0 |
| dev-flow/README.md (badge)          | 5.0.0   | 5.1.0 |
```

### Step 4: Apply Version

Use `Edit` to update each file. For badges, replace `version-OLD-blue` with `version-NEW-blue`.

### Step 5: Verify Consistency

```bash
grep -rn '"version".*"X.Y.Z"' <plugin>/.claude-plugin/ .claude-plugin/marketplace.json
grep -n 'version-X.Y.Z' <plugin>/README.md
```

All files must show the new version. Zero mismatches = success.

### Step 6: Generate Changelog (optional)

```bash
git log --oneline $(git describe --tags --abbrev=0)..HEAD -- <plugin>/
```

## Consistency Check (Audit Mode)

Run without changing versions to detect stale files:

1. Read version from `<plugin>/.claude-plugin/plugin.json` (source of truth)
2. Compare against all other files
3. Report mismatches

## Known Pitfalls

- **Stale marketplace.json**: Root and local marketplace.json files frequently go stale during manual version bumps (documented bug from v3.11.1). This skill exists to prevent that.
- **utils/research lack local marketplace.json**: Only `dev-flow` and `ios-swift-plugin` have `<plugin>/.claude-plugin/marketplace.json`. Do not create one for utils/research.
- **Badge format**: shields.io badges use `-` as separator: `version-5.0.0-blue.svg`. Dots in version are literal, not encoded.
- **Description drift**: Root marketplace.json `description` field may also need updating alongside version bumps if the plugin's scope changed.

## Reference

Detailed per-plugin file paths and verification commands: `references/version-checklist.md`
