---
name: skill-stocktake
description: >-
  Audits all skills across installed plugins for quality, overlap, freshness, and actionability.
  Produces a report with Keep/Improve/Update/Retire/Merge recommendations per skill.
  This skill should be used when the user wants to review all installed skills, audit skill quality, or get improvement recommendations.
  Triggers on "stocktake", "skill audit", "audit skills", "技能审计", "技能盘点", "检查技能质量", "Skill质量", "批量审查".
  Do NOT use for individual skill review (use plugin-dev:skill-reviewer).
allowed-tools: [Read, Glob, Grep, Bash]
model: sonnet
---

# Skill Stocktake - Cross-Plugin Quality Audit

Audit all installed plugin skills and produce actionable recommendations.

## Modes

| Mode | Scope | When to Use |
|------|-------|-------------|
| Quick Scan | Skills changed since last stocktake | After adding or editing skills |
| Full Stocktake | All skills across all plugins | Periodic review, before releases |

**Default**: Quick Scan. User can request "full stocktake" explicitly.

```
/dev-flow:skill-stocktake           # Quick scan (changed skills only)
/dev-flow:skill-stocktake --full    # Full audit of all skills
```

## Step 1: Discover Skills

```bash
# Find all SKILL.md files across plugin directories
find . -name "SKILL.md" -path "*/skills/*" | sort
```

For Quick Scan, filter to skills modified since last audit:
```bash
git diff --name-only HEAD~10 | grep "SKILL.md"
```

## Step 2: Load Quality Criteria

For each skill, extract from SKILL.md frontmatter and content:
- `name`, `description` (length, keywords present?)
- `allowed-tools` (count, scope)
- `model` (appropriate for complexity?)
- `user-invocable` (set correctly?)
- Line count of SKILL.md
- List of referenced files in `references/`

## Step 3: Score Each Skill

Score each skill on 6 dimensions (1-5 each). See `references/quality-criteria.md` for rubric.

| Dimension | Weight | Check |
|-----------|--------|-------|
| Trigger Clarity | High | Keywords cover EN + ZH? Negative triggers where needed? |
| Content Overlap | High | Description similarity with other skills > 60%? |
| Actionability | Medium | Are instructions specific or vague? |
| Technical Freshness | Medium | References deprecated APIs or patterns? |
| Line Count Compliance | Low | SKILL.md < 500 lines? |
| Tool Scope | Low | allowed-tools minimal and necessary? |

**Composite score** = weighted average (round to 1 decimal).

## Step 4: Detect Merge Candidates

Compare description text across skills within the same plugin:

```
For each pair of skills:
  Overlap score = shared keywords / total unique keywords
  Flag if overlap > 60%
```

Output: "Consider merging: skill-a + skill-b (70% description overlap)"

## Step 5: Detect Stale Content

Scan skill body and references for staleness signals:

| Signal | Flag |
|--------|------|
| API/library name in description with no version | Check if current |
| References to pre-2024 framework patterns | Flag for review |
| Dead links in WebFetch-style references | Flag |
| Deprecated APIs (e.g., `UITableView` in SwiftUI skills) | Flag |

## Step 6: Generate Report

Output a table sorted by composite score (ascending = worst first).

```
Skill Stocktake Report
Mode: [Quick/Full] | Date: [YYYY-MM-DD] | Skills audited: N

| Skill | Plugin | Score | Overlap | Fresh | Lines | Recommendation |
|-------|--------|-------|---------|-------|-------|----------------|
| ...   | ...    | 3.2   | 45%     | Yes   | 320   | Improve        |
```

**Recommendations**:

| Label | Criteria |
|-------|---------|
| Keep | Score >= 4.0, no overlap, no staleness |
| Improve | Score 3.0-3.9, fixable issues |
| Update | Stale content detected, otherwise good |
| Merge | Overlap > 60% with another skill |
| Retire | Score < 2.5 OR superseded AND overlap > 80% |

## Step 7: Action Items

After the table, list concrete actions:

```
Action Items (prioritized):
1. [Retire] skill-name: superseded by newer-skill (85% overlap)
2. [Merge] skill-a + skill-b: 70% description overlap
3. [Update] skill-c: references deprecated API X
4. [Improve] skill-d: missing Chinese trigger keywords
```

Offer to execute any action item immediately.

## Quick Reference

Load `references/quality-criteria.md` when detailed scoring guidance is needed for a
specific dimension.
