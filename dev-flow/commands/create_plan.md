---
description: Create detailed implementation plans through interactive research and iteration
---

# /create_plan - Interactive Plan Creation

Create detailed implementation plans through research and iteration.

## Usage

```bash
# Interactive mode
/create_plan

# With ticket file
/create_plan thoughts/allison/tickets/eng_1234.md

# Deep analysis
/create_plan think deeply about thoughts/allison/tickets/eng_1234.md
```

## Process

1. **Context Gathering** - Read all mentioned files completely
2. **Research** - Spawn parallel agents to explore codebase
3. **Structure** - Propose plan outline, get feedback
4. **Write** - Create plan at `thoughts/shared/plans/YYYY-MM-DD-*.md`
5. **Iterate** - Refine until approved

## Output

Plan file with:
- Overview & Current State Analysis
- Implementation Phases with success criteria
- Testing Strategy
- Migration Notes
