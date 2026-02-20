# Version Checklist

Per-plugin file paths and verification commands for this monorepo.

## Plugin File Map

### dev-flow

| # | File | Has Version |
|---|------|-------------|
| 1 | `dev-flow/.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| 2 | `.claude-plugin/marketplace.json` | plugins[name=dev-flow].version |
| 3 | `dev-flow/.claude-plugin/marketplace.json` | plugins[0].version |
| 4 | `dev-flow/README.md` | `version-X.Y.Z-blue.svg` badge |

### ios-swift-plugin

| # | File | Has Version |
|---|------|-------------|
| 1 | `ios-swift-plugin/.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| 2 | `.claude-plugin/marketplace.json` | plugins[name=ios-swift-plugin].version |
| 3 | `ios-swift-plugin/.claude-plugin/marketplace.json` | plugins[0].version |
| 4 | `ios-swift-plugin/README.md` | `version-X.Y.Z-blue.svg` badge |

### utils

| # | File | Has Version |
|---|------|-------------|
| 1 | `utils-plugin/.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| 2 | `.claude-plugin/marketplace.json` | plugins[name=utils].version |

No local marketplace.json. No README badge.

### research

| # | File | Has Version |
|---|------|-------------|
| 1 | `research-plugin/.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| 2 | `.claude-plugin/marketplace.json` | plugins[name=research].version |

No local marketplace.json. No README badge.

## Verification Commands

### Single Plugin

```bash
# Replace PLUGIN with: dev-flow, ios-swift-plugin, utils-plugin, research-plugin
# Replace NAME with: dev-flow, ios-swift-plugin, utils, research
# Replace VER with target version

# Check plugin.json
grep '"version"' PLUGIN/.claude-plugin/plugin.json

# Check root marketplace.json
grep -A1 '"NAME"' .claude-plugin/marketplace.json | grep version

# Check local marketplace.json (dev-flow, ios-swift-plugin only)
grep '"version"' PLUGIN/.claude-plugin/marketplace.json

# Check README badge (dev-flow, ios-swift-plugin only)
grep 'version-' PLUGIN/README.md
```

### Full Audit (All Plugins)

```bash
# Dump all versions at once
for p in dev-flow ios-swift-plugin utils-plugin research-plugin; do
  ver=$(grep '"version"' "$p/.claude-plugin/plugin.json" | head -1 | sed 's/.*"\([0-9.]*\)".*/\1/')
  echo "$p: $ver"
done

# Cross-check root marketplace.json
grep '"version"' .claude-plugin/marketplace.json
```

### Mismatch Detection

```bash
# For a specific plugin (e.g., dev-flow at version 5.0.0)
VER="5.0.0"
PLUGIN="dev-flow"

echo "=== Checking $PLUGIN for version $VER ==="
grep -c "\"$VER\"" "$PLUGIN/.claude-plugin/plugin.json" && echo "plugin.json: OK" || echo "plugin.json: MISMATCH"
grep "$PLUGIN" -A2 .claude-plugin/marketplace.json | grep -c "\"$VER\"" && echo "root marketplace: OK" || echo "root marketplace: MISMATCH"

# Only for plugins with local marketplace.json
[ -f "$PLUGIN/.claude-plugin/marketplace.json" ] && \
  grep -c "\"$VER\"" "$PLUGIN/.claude-plugin/marketplace.json" && echo "local marketplace: OK" || echo "local marketplace: MISMATCH or N/A"

# Only for plugins with README badge
grep -c "version-$VER" "$PLUGIN/README.md" 2>/dev/null && echo "README badge: OK" || echo "README badge: MISMATCH or N/A"
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Root marketplace.json stale | Forgot to update after plugin.json bump | Edit `.claude-plugin/marketplace.json` |
| Local marketplace.json stale | Same — discovered at v3.11.1 | Edit `<plugin>/.claude-plugin/marketplace.json` |
| Badge shows old version | README not updated | Edit badge URL in README.md |
| Description mismatch | plugin.json description updated but marketplace.json not | Sync description field across files |
| Wrong plugin name in grep | `utils` plugin uses `utils-plugin/` directory but `"name": "utils"` in JSON | Use directory name for paths, JSON name for grep |

## Edit Patterns

### plugin.json

```json
"version": "OLD" → "version": "NEW"
```

### marketplace.json (root and local)

```json
"version": "OLD" → "version": "NEW"
```

Note: Root marketplace.json has multiple plugins. Match by `"name"` field first, then update adjacent `"version"`.

### README badge

```
version-OLD-blue.svg → version-NEW-blue.svg
```

## CLAUDE.md Reference

From the project CLAUDE.md Version Upgrade Checklist:

> Update these files when bumping version:
> - `<plugin>/.claude-plugin/plugin.json`
> - `.claude-plugin/marketplace.json`
> - `<plugin>/.claude-plugin/marketplace.json` (if exists, was found stale at 3.11.1)
> - `<plugin>/README.md` (badge)
