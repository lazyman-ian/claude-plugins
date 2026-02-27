# /dev evolve

Evolve high-confidence instincts into reusable skills, commands, or rules.

## Description

Convert project-specific patterns that have proven effective (confidence >= 0.8) into structured, reusable assets.

## Workflow

1. **Query** — List all instincts with confidence >= 0.8
   - Source: `dev_instinct(action: "list")` (returns instincts sorted by confidence DESC)
   - Filter: only display entries with `confidence >= 0.8`
   - Show: instinct name + confidence + domain + evidence count

2. **Classify** — For each instinct, suggest evolution target:
   - **Pattern Instinct** → `.claude/rules/pattern-*.md`
   - **Action Instinct** → `dev-flow/skills/new-skill/SKILL.md`
   - **Workflow Instinct** → `dev-flow/commands/new-command.md`
   - **Prevention Instinct** → `.claude/rules/anti-pattern-*.md`

3. **Select** — Interactive: user confirms which instincts to evolve
   - Show draft content for each selected instinct
   - Require confirmation before generating files

4. **Generate** — Create target file(s):
   - Use instinct content as seed
   - Add structure (frontmatter, sections, examples)
   - Add to appropriate `.claude/rules/` or `dev-flow/{skills,commands}/`

5. **Register** — Update registry:
   - `.claude/rules/` files auto-discovered
   - New skills: add to plugin.json
   - New commands: add to commands/ auto-discovery

## Example

```
$ /dev evolve

High-confidence instincts (>= 0.8):
1. [0.95] "Never run interactive CLI in hooks" (discovery in commit-guard)
   → Evolution: anti-pattern rule

2. [0.92] "Batch task updates instead of individual calls" (pattern)
   → Evolution: skill or rule

3. [0.88] "Use dev_memory before complex implementations" (workflow)
   → Evolution: command or skill documentation

Select instincts to evolve (enter 1,2,3 or 'all'):
> 1,3

Generating...
- Created: .claude/rules/anti-pattern-interactive-hooks.md
- Updated: dev-flow/skills/task-management/SKILL.md (added memory integration section)

Complete! Evolution summary saved to .dev-flow/evolution.log
```

## Target Directory Map

| Instinct Type | Target | Auto-register |
|---------------|--------|---------------|
| Pattern (action) | `dev-flow/skills/` | Via plugin.json |
| Pattern (rule) | `.claude/rules/` | Auto-discovered |
| Workflow | `dev-flow/commands/` | Auto-discovered |
| Prevention | `.claude/rules/anti-pattern-*.md` | Auto-discovered |

## Confidence Thresholds

- **>= 0.9** → Highly validated, safe to evolve immediately
- **0.8-0.89** → Confirm before evolution (may need refinement)
- **< 0.8** → Not ready, ask user to wait or validate further

## Output

- Evolved files created in correct locations
- Registry files updated (plugin.json if needed)
- Summary: `$ /dev ledger --show evolution`
- Reasoning: stored in `dev_memory` with `type: evolution`

## Integration

Works with:
- `dev_memory(consolidate)` — identify high-confidence instincts
- `dev_memory(save)` — record evolved patterns for future sessions
- Continuity ledger — track which instincts have been evolved
