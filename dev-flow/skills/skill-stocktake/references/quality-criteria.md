# Quality Criteria - Skill Stocktake Scoring Rubric

Detailed scoring guide for each of the 6 quality dimensions. Score each 1-5.

## 1. Trigger Clarity (Weight: High)

Does the description reliably cause Claude to select this skill at the right moment?

| Score | Criteria |
|-------|---------|
| 5 | English + Chinese trigger keywords, negative triggers for ambiguous cases, clear "when to use" framing |
| 4 | English + Chinese keywords present, no negative triggers but scope is unambiguous |
| 3 | Only English keywords, or Chinese keywords missing for a skill likely used in Chinese context |
| 2 | Vague description ("helps with X"), no explicit trigger keywords |
| 1 | No trigger keywords, description is a title only |

**Examples**:

Good (5):
```
Triggers on "debug", "troubleshoot", "调试", "排查".
Do NOT use for pre-commit checks — use "self-check" instead.
```

Bad (1):
```
description: Helps with planning
```

**Check**: Does description contain at least 3 EN trigger phrases AND 3 ZH trigger phrases?
If skill is internal (`user-invocable: false`), ZH triggers are optional.

---

## 2. Content Overlap (Weight: High)

Are two skills doing the same job?

| Score | Criteria |
|-------|---------|
| 5 | Unique scope, no meaningful overlap with any other skill |
| 4 | Minor keyword overlap with 1 skill, but clearly differentiated by negative triggers |
| 3 | Moderate overlap (30-60%) with 1 skill, differentiation present but weak |
| 2 | High overlap (60-80%) with another skill, users would be confused which to use |
| 1 | Near-duplicate (> 80% overlap), should be merged or one retired |

**Detection method**:
Extract unique words from each description (exclude stop words). Compute:
```
overlap = |words_A ∩ words_B| / |words_A ∪ words_B|
```

**Flag threshold**: overlap > 0.60 → mark as Merge candidate.

---

## 3. Actionability (Weight: Medium)

Are the instructions specific enough for Claude to follow without ambiguity?

| Score | Criteria |
|-------|---------|
| 5 | Step-by-step process with concrete commands, examples, and output formats |
| 4 | Clear steps with most commands/examples provided |
| 3 | Steps defined but some are vague ("investigate the issue") |
| 2 | High-level guidance only, no concrete steps or examples |
| 1 | No instructions, skill is description-only |

**Signals for low actionability**:
- Steps like "look into X" without specifying what tools or queries to use
- No example output format shown
- No handling of edge cases or failure modes
- Instructions could apply to any skill (too generic)

**Signals for high actionability**:
- Specific Bash commands or MCP tool calls shown
- Concrete file paths, query strings, or search patterns
- Example input/output pair
- Decision criteria (if X then Y, else Z)

---

## 4. Technical Freshness (Weight: Medium)

Does the skill reference current APIs, patterns, and best practices?

| Score | Criteria |
|-------|---------|
| 5 | All APIs/patterns are current, version-aware, no deprecated references |
| 4 | Mostly current, one minor outdated reference that does not affect correctness |
| 3 | Some references are 1-2 years stale but still functional |
| 2 | References deprecated APIs (e.g., `completion handlers` in Swift async context) |
| 1 | References APIs that are removed or patterns that are actively harmful today |

**Staleness signals to check**:

| Pattern | Check |
|---------|-------|
| Swift: `completionHandler`, `DispatchQueue.main.async` in async context | Deprecated since Swift 5.5 |
| Android: `AsyncTask` | Removed in API 30 |
| React: class components, `componentWillMount` | Legacy since React 16.8 |
| Any `UITableView` in a skill focused on SwiftUI | Cross-contamination |
| npm package names without versions | May have breaking changes |
| References to "WWDC 2021/2022" without noting if pattern is still current | Time-bound |

**Note**: A reference to an older pattern is only stale if a better replacement exists AND
the skill does not acknowledge the trade-off.

---

## 5. Line Count Compliance (Weight: Low)

Is the SKILL.md file within the recommended size limit?

| Score | Criteria |
|-------|---------|
| 5 | <= 300 lines (lean, focused) |
| 4 | 301-400 lines (acceptable) |
| 3 | 401-500 lines (at limit, consider moving content to references/) |
| 2 | 501-600 lines (over limit, performance impact) |
| 1 | > 600 lines (significantly over limit, full context loaded each trigger) |

**Fix**: Move detailed content to `references/` directory. SKILL.md should contain:
- Process overview
- Quick reference tables
- Pointers to references files

---

## 6. Tool Scope (Weight: Low)

Does `allowed-tools` follow the principle of minimal necessary permissions?

| Score | Criteria |
|-------|---------|
| 5 | Minimal tools, exactly what the skill needs |
| 4 | One extra tool that is rarely used but not harmful |
| 3 | Two extra tools, or missing a clearly needed tool |
| 2 | Missing important tools OR has `Write`/`Edit`/`Bash` when skill is read-only |
| 1 | No `allowed-tools` field (inherits everything, triggers unnecessary permission prompts) |

**Reference patterns**:

| Skill Type | Recommended Tools |
|------------|-------------------|
| Read-only audit | `[Read, Glob, Grep]` |
| Research | `[WebSearch, WebFetch, Read, Glob, Grep]` |
| Implementation | `[Read, Edit, Write, Bash, Glob, Grep]` |
| Internal helper | `[Read, Glob, Grep]` (minimal) |
| Workflow with MCP | `[Bash, Read]` (MCP tools via Bash) |

**Flag**: Skills with `Edit` or `Write` in `allowed-tools` but whose description says "audit",
"analyze", or "report" are likely over-scoped.

---

## Composite Score Calculation

```
composite = (trigger * 0.25) + (overlap * 0.25) + (actionability * 0.20) +
            (freshness * 0.20) + (lines * 0.05) + (tools * 0.05)
```

| Composite | Recommendation |
|-----------|----------------|
| >= 4.0 | Keep |
| 3.0 - 3.9 | Improve |
| 2.5 - 2.9 | Improve (urgent) |
| < 2.5 | Retire or Merge |

**Override rules** (regardless of composite score):
- Overlap > 0.80 with another skill → Merge (regardless of score)
- References removed API → Update (score dimension 4 is 1) → Retire if no fix path
- Line count > 600 → Improve (must split before next release)
