---
name: prompt-optimizer
description: >-
  A/B tests and optimizes all prompt artifacts (skills, agents, commands, rules, hooks) by identifying
  and stripping model-native methodology while preserving integration-critical content. Scans artifact
  types, creates thin variants, runs parallel subagent comparisons, scores on 5 dimensions, and applies
  optimizations. This skill should be used after model upgrades, when prompt bloat is suspected, or when
  config-optimize detects model capability overlap. Triggers on "optimize prompts", "prompt A/B test",
  "thin prompt", "strip methodology", "prompt optimization", "精简prompt", "优化提示词", "AB测试",
  "精简skill", "精简agent", "优化技能", "prompt瘦身".
  Do NOT use for skill creation — use "skill-creator".
  Do NOT use for skill quality audit — use "skill-stocktake".
model: opus
context: fork
memory: project
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash, Task, TaskCreate, TaskUpdate, TaskList, AskUserQuestion]
---

# Prompt Optimizer - A/B Test All Prompt Artifacts

Strip model-native methodology from skills, agents, commands, rules, and hooks.

## Artifact Types

| Type | Path Pattern | A/B Testable | Optimization |
|------|-------------|--------------|-------------|
| **Skills** | `skills/*/SKILL.md` | Yes (subagent) | Strip methodology, keep tool routing |
| **Agents** | `agents/*.md` | Yes (subagent) | Strip process, keep gates/checklists |
| **Commands** | `commands/*.md` | Partial (manual) | Strip explanations, keep step flow |
| **Rules** | `.claude/rules/*.md`, `~/.claude/rules/*.md` | No (global context) | Dedup + strip obvious |
| **Hooks** | `hooks/hooks.json` scripts | No (code) | Only `type: "prompt"` hooks |

## Content Classification

Every line in a prompt artifact falls into one of 4 categories:

| Tag | Keep? | Examples |
|-----|-------|---------|
| `INTEGRATION` | Yes | MCP tool calls, file paths, allowed-tools, gate references, `dev_*` calls |
| `WORKFLOW` | Yes | Step sequences with tool dependencies, signal-based routing tables |
| `METHODOLOGY` | Strip | "Debug systematically", TDD explanation, "use guard clauses", generic best practices |
| `HARMFUL` | Strip | Rigid MUST/NEVER without rationale, fixed templates, micromanaged substeps |

## Workflow

```
SCAN → CLASSIFY → THIN → [A/B TEST] → SCORE → APPLY
```

### Phase 1: Scan

```bash
# Collect all prompt artifacts in target plugin
Glob("<plugin>/skills/*/SKILL.md")   # Skills
Glob("<plugin>/agents/*.md")          # Agents (exclude TEMPLATE.md, references/)
Glob("<plugin>/commands/*.md")        # Commands
```

For each artifact, compute **methodology ratio**:
- Lines with integration markers: tool names, `dev_*`, file paths, bash blocks with real commands
- Lines with methodology markers: imperative verbs without tools, generic advice, explanations
- Ratio = methodology_lines / total_body_lines

**Candidate threshold**: methodology ratio > 40% AND body > 40 lines.

Output scan table:

```
| Artifact | Type | Lines | Meth% | Candidate |
|----------|------|-------|-------|-----------|
| debugging/SKILL.md | skill | 170 | 65% | YES |
| plan-agent.md | agent | 95 | 55% | YES |
| commit.md | command | 193 | 20% | NO |
```

### Phase 2: Classify Per Artifact Type

#### Skills & Agents (A/B testable)
- Annotate every section with `[INTEGRATION]`, `[WORKFLOW]`, `[METHODOLOGY]`, `[HARMFUL]`
- Frontmatter: always keep
- Tool routing tables: keep
- "When to Use" sections: keep
- Process explanations without tools: strip
- Generic advice ("be thorough", "check edge cases"): strip

#### Commands
- Keep: step sequences with tool calls (`dev_commit`, `dev_config`, signal tables)
- Keep: option tables, output formats
- Strip: explanations of _why_ a step works, generic commit message rules models already know
- Strip: examples that restate the obvious

#### Rules
- Scan for **overlap with model training**: rules that restate common programming knowledge
- Scan for **inter-rule duplication**: same advice in multiple rule files
- Scan for **staleness**: rules about old versions/features no longer relevant
- Do NOT A/B test (rules affect global context) — report with recommendation instead

### Phase 3: Create Thin Variants

For A/B testable artifacts (skills, agents):
- Generate thin version keeping only `[INTEGRATION]` + `[WORKFLOW]` content
- Preserve frontmatter exactly
- Target: < 50% of original line count
- Save to `tests/skill-ab/prompts/<name>-thin.md`

For commands and rules:
- Generate optimized version inline (no separate file)
- Present diff to user for approval

### Phase 4: A/B Test (skills & agents only)

Per artifact, spawn 2 parallel subagents per test task:

```
Task(prompt="""
Follow ONLY these instructions for the task below:

<instructions>
{full_or_thin_content}
</instructions>

Task: {test_task_description}
Working directory: {project_root}
Save output to: tests/skill-ab/results/{name}/{variant}/
Read-only — do NOT modify production code.
""")
```

Test tasks: 2 per artifact (1 simple, 1 complex).
- Use existing tasks from `tests/skill-ab/tasks.md` if available
- Otherwise generate tasks exercising the artifact's core function

### Phase 5: Score

5-dimension evaluation:

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| **Correctness** | 30% | Right output, right conclusions |
| **Tool Usage** | 25% | Right MCP tools, correct parameters |
| **Efficiency** | 20% | Fewer unnecessary steps, less waste |
| **Scope Control** | 15% | Stayed within task boundary |
| **Output Quality** | 10% | Clear, actionable, well-structured |

Decision matrix:

| Result | Action |
|--------|--------|
| thin >= full (both tasks) | Apply thin |
| thin >= full (1 of 2) | Apply with caution note |
| full > thin (both tasks) | Keep full, tag "model-dependent" |

### Phase 6: Apply

1. Back up originals to `tests/skill-ab/backups/<name>-<date>.md`
2. Apply thin variants for A/B winners
3. Present command/rule diffs for user approval (AskUserQuestion)
4. Record results

## Results Format

Save to `tests/skill-ab/results/OPTIMIZE-<date>.md`:

```markdown
# Prompt Optimization — {date}

## Summary
| Type | Scanned | Candidates | Tested | Optimized | Lines Saved |
|------|---------|-----------|--------|-----------|-------------|
| Skills | 23 | 5 | 5 | 4 | -320 |
| Agents | 14 | 3 | 3 | 2 | -180 |
| Commands | 28 | 0 | — | — | — |
| Rules | 12 | 2 | — | 2 (manual) | -45 |

## Per-Artifact Details
[scan table + scores + decisions]
```

## Integration with config-optimize

`/config-optimize` Phase 8 auto-triggers when:
- Claude model major version changed
- Release notes mention capability expansion
- Last optimization > 30 days ago

```
Skill("dev-flow:prompt-optimizer", "--target <plugin-path>")
```

## Batch Mode

```bash
/prompt-optimizer                                    # All artifacts in current plugin
/prompt-optimizer --target dev-flow/skills/          # Only skills
/prompt-optimizer --target dev-flow/agents/          # Only agents
/prompt-optimizer --type rules                       # Only rules (scan + report)
/prompt-optimizer --scan-only                        # Report ratios, no testing
/prompt-optimizer --apply-all                        # Skip confirmation
```

## Boundaries

- Do NOT modify frontmatter (name, description, allowed-tools, model)
- Do NOT change step ordering in commands (workflow correctness)
- Do NOT remove MCP tool references, file paths, or gate logic
- Do NOT test artifacts with < 30 lines body
- Do NOT A/B test rules or hooks (global side effects)
- Always back up before applying
