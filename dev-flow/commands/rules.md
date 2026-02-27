---
description: List, install, and sync rule templates to project .claude/rules/
---

# /dev-flow:rules - Rule Management

Manage Claude Code rules distributed via dev-flow plugin.

## Usage

/dev-flow:rules list                    # List available rule templates
/dev-flow:rules install                 # Install matching rules for detected platform
/dev-flow:rules install --all           # Install all rules
/dev-flow:rules sync                    # Update installed rules from latest templates
/dev-flow:rules diff                    # Show differences between installed and template

## Workflow

### list
Show available templates from `dev-flow/templates/rules/`:
- Template name, description, applicable paths
- Mark which are already installed in `.claude/rules/`

### install
1. Detect project platform via `dev_config`
2. Select matching templates (e.g., iOS → coding-style + coding-style-swift + ios-pitfalls)
3. Copy to `.claude/rules/dev-flow/` (namespaced to avoid conflicts)
4. Always install: coding-style, testing, git-workflow, security, performance
5. Platform-specific: coding-style-{platform}, {platform}-pitfalls

### sync
Compare installed rules vs templates, update changed ones.

### diff
Show what changed between installed and template versions.

## Integration

`/dev init` calls `/dev rules install` automatically during project setup.
