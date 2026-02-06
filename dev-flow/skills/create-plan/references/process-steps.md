# Process Steps Reference

Detailed process steps for implementation planning.

## Step 1: Context Gathering & Initial Analysis

### 1a. Read All Mentioned Files

**CRITICAL**: Read files FULLY without limit/offset parameters.

```bash
# Example: Read ticket file completely
Read("thoughts/allison/tickets/eng_1234.md")
```

Files to read:
- Ticket files (e.g., `thoughts/allison/tickets/eng_*.md`)
- Research documents
- Related implementation plans
- JSON/data files mentioned

**NEVER** read files partially. If a file is mentioned, read it completely.

### 1b. Spawn Initial Research Tasks

Before asking questions, spawn specialized agents in parallel:

| Agent | Purpose |
|-------|---------|
| **codebase-locator** | Find all files related to the ticket |
| **codebase-analyzer** | Understand current implementation |
| **thoughts-locator** | Find existing thoughts documents |
| **linear-ticket-reader** | Get Linear ticket details |

These agents will:
- Find relevant source files, configs, and tests
- Identify specific directories to focus on
- Trace data flow and key functions
- Return detailed file:line references

### 1c. Read Files from Research Tasks

After research completes:
- Read ALL files identified as relevant
- Read them FULLY into main context
- Ensures complete understanding before proceeding

### 1d. Analyze and Verify

- Cross-reference ticket requirements with code
- Identify discrepancies or misunderstandings
- Note assumptions needing verification
- Determine true scope based on codebase reality

### 1e. Present Understanding

```
Based on the ticket and my research, I understand we need to [summary].

I've found that:
- [Discovery with file:line reference]
- [Pattern or constraint discovered]
- [Potential complexity identified]

Questions my research couldn't answer:
- [Technical question requiring judgment]
- [Business logic clarification]
- [Design preference]
```

Only ask questions you genuinely cannot answer through code investigation.

---

## Step 2: Research & Discovery

### 2a. Handle Corrections

If user corrects a misunderstanding:
- DO NOT just accept the correction
- Spawn new research tasks to verify
- Read specific files/directories mentioned
- Only proceed once verified yourself

### 2b. Create Research Todo List

Use TodoWrite to track exploration tasks.

### 2c. Spawn Parallel Sub-Tasks

| Agent Type | Use For |
|------------|---------|
| **codebase-locator** | Find specific files |
| **codebase-analyzer** | Understand implementation details |
| **codebase-pattern-finder** | Find similar features to model |
| **thoughts-locator** | Find research/plans about this area |
| **thoughts-analyzer** | Extract key insights |
| **linear-searcher** | Find similar issues |

For external documentation:
- Use WebSearch directly for quick lookups
- Full validation happens via implement_plan's validation step
- Don't block planning on extensive research

### 2d. Wait for All Sub-Tasks

Wait for ALL sub-tasks before synthesizing.

### 2e. Present Findings

```
Based on my research:

**Current State:**
- [Discovery about existing code]
- [Pattern or convention to follow]

**Design Options:**
1. [Option A] - [pros/cons]
2. [Option B] - [pros/cons]

**Open Questions:**
- [Technical uncertainty]
- [Design decision needed]

Which approach aligns best?
```

---

## Step 3: Plan Structure Development

### 3a. Create Initial Outline

```
Here's my proposed plan structure:

## Overview
[1-2 sentence summary]

## Implementation Phases:
1. [Phase name] - [what it accomplishes]
2. [Phase name] - [what it accomplishes]
3. [Phase name] - [what it accomplishes]

Does this phasing make sense?
```

### 3b. Get Feedback

Get buy-in on structure before writing details.

---

## Step 4: Detailed Plan Writing

### 4a. Ensure Directory Exists

```bash
mkdir -p thoughts/shared/plans
```

### 4b. Create Plan File

Format: `YYYY-MM-DD-ENG-XXXX-description.md`

Examples:
- With ticket: `2025-01-08-ENG-1478-parent-child-tracking.md`
- Without: `2025-01-08-improve-error-handling.md`

### 4c. Use Plan Template

See `references/plan-template.md` for full template.

---

## Step 5: Review

### 5a. Present Draft Location

```
I've created the initial implementation plan at:
`thoughts/shared/plans/YYYY-MM-DD-description.md`

Please review:
- Are phases properly scoped?
- Are success criteria specific enough?
- Any technical details need adjustment?
- Missing edge cases?
```

### 5b. Iterate Based on Feedback

Be ready to:
- Add missing phases
- Adjust technical approach
- Clarify success criteria
- Add/remove scope items

### 5c. Continue Until Satisfied

Refine until user approves.
