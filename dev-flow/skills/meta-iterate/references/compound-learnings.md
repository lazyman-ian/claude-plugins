# Compound Learnings Process

Transform ephemeral session learnings into permanent, compounding capabilities (skills, rules, hooks, agents).

## When to Use

- "What should I learn from recent sessions?"
- "Improve my setup based on recent work"
- "Turn learnings into skills/rules"
- "What patterns should become permanent?"
- "Compound my learnings"

## Process

### Step 1: Gather Learnings

```bash
# List learnings (most recent first)
ls -t $CLAUDE_PROJECT_DIR/.claude/cache/learnings/*.md | head -20

# Count total
ls $CLAUDE_PROJECT_DIR/.claude/cache/learnings/*.md | wc -l
```

Read the most recent 5-10 files (or specify a date range).

### Step 2: Extract Patterns

For each learnings file, extract from these sections:

| Section Header | What to Extract |
|----------------|-----------------|
| `## Patterns` | Direct candidates for rules |
| `**Takeaway:**` | Decision heuristics |
| `## What Worked` | Success patterns |
| `## What Failed` | Anti-patterns (invert to rules) |
| `## Key Decisions` | Design principles |

Build a frequency table:

```markdown
| Pattern | Sessions | Category |
|---------|----------|----------|
| "Check artifacts before editing" | abc, def, ghi | debugging |
| "Pass IDs explicitly" | abc, def, ghi, jkl | reliability |
```

### Step 3: Consolidate Similar Patterns

Before counting, merge patterns expressing the same principle:

**Example consolidation:**
- "Artifact-first debugging"
- "Verify hook output by inspecting files"
- "Filesystem-first debugging"
→ All express: **"Observe outputs before editing code"**

Use the most general formulation.

### Step 4: Detect Meta-Patterns

If >50% of patterns relate to one topic (e.g., "hooks", "tracing", "async"):
→ That topic may need a **dedicated skill** rather than multiple rules
→ One skill compounds better than five rules

Ask: *"Is there a skill that would make all these rules unnecessary?"*

### Step 5: Categorize (Decision Tree)

```
Is it a sequence of commands/steps?
  → YES → SKILL (executable > declarative)
  → NO ↓

Should it run automatically on an event?
  → YES → HOOK (automatic > manual)
  → NO ↓

Is it "when X, do Y" or "never do X"?
  → YES → RULE
  → NO ↓

Does it enhance an existing agent workflow?
  → YES → AGENT UPDATE
  → NO → Skip (not worth capturing)
```

| Pattern | Type | Why |
|---------|------|-----|
| "Run linting before commit" | Hook (PreToolUse) | Automatic gate |
| "Extract learnings on session end" | Hook (SessionEnd) | Automatic trigger |
| "Debug hooks step by step" | Skill | Manual sequence |
| "Always pass IDs explicitly" | Rule | Heuristic |

### Step 6: Apply Signal Thresholds

| Occurrences | Action |
|-------------|--------|
| 1 | Note but skip (unless critical failure) |
| 2 | Consider - present to user |
| 3+ | Strong signal - recommend creation |
| 4+ | Definitely create |

### Step 7: Propose Artifacts

Present each proposal:

```markdown
## Pattern: [Generalized Name]

**Signal:** [N] sessions ([list session IDs])
**Category:** [debugging / reliability / workflow]
**Artifact Type:** Rule / Skill / Hook / Agent Update
**Rationale:** [Why this artifact type]

**Draft Content:**
[Actual content that would be written]

**File:** `.claude/rules/[name].md` or `.claude/skills/[name]/SKILL.md`
```

### Step 8: Create Approved Artifacts

#### For Rules:
```bash
cat > ~/.claude/rules/<name>.md << 'EOF'
# Rule Name

[Context: why this rule exists]

## Pattern
[The reusable principle]

## DO / DON'T
[Concrete guidance]
EOF
```

#### For Skills:
Create `~/.claude/skills/<name>/SKILL.md` with frontmatter, instructions, examples.

#### For Hooks:
Create shell wrapper + handler, register in settings.json.

#### For Agent Updates:
Edit existing agent to add learned capability.

### Step 9: Summary Report

```markdown
## Compounding Complete

**Learnings Analyzed:** [N] sessions
**Patterns Found:** [M]
**Artifacts Created:** [K]

### Created:
- Rule: `explicit-identity.md`
- Skill: `debug-hooks`

### Skipped (insufficient signal):
- "Pattern X" (1 occurrence)
```

## Quality Checks

Before creating any artifact:

1. **Is it general enough?** Would it apply in other projects?
2. **Is it specific enough?** Does it give concrete guidance?
3. **Does it already exist?** Check existing rules/skills first
4. **Is it the right type?** Sequences → skills, heuristics → rules
