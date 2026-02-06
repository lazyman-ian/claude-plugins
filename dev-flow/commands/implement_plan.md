---
description: Implement technical plans from thoughts/shared/plans with verification
---

# /implement_plan - Plan Implementation

Implement approved technical plans with verification.

## Usage

```bash
/implement_plan thoughts/shared/plans/YYYY-MM-DD-feature.md
```

## Execution Modes

| Mode | When to Use |
|------|-------------|
| **Direct** (default) | 1-3 tasks, quick implementations |
| **Agent Orchestration** | 4+ tasks, context preservation critical |

## Process

1. Read plan completely, check existing checkmarks
2. Read all referenced files
3. Implement each phase with TDD
4. Run success criteria, fix issues
5. Update plan checkboxes
6. Pause for manual verification

## Key Features

- **Compaction-resistant**: Handoffs persist on disk
- **Resumable**: Can resume agents by ID
- **TDD enforced**: Tests before implementation
