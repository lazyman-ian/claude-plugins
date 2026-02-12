# Brainstorm Guide — Detailed Reference

Detailed guidance for effective brainstorming sessions.

## Socratic Questioning in Depth

### Purpose Layer

Go beyond "what" to understand "why":

```
Surface: "We need a chat feature"
→ Why: "To improve user engagement"
→ Why: "Users are leaving for competitors with chat"
→ Core insight: "Retention problem, not feature problem"
```

**Questions:**
- What problem does this solve?
- Who specifically benefits?
- What happens if we don't build this?
- How do we measure success?

### Constraints Layer

Uncover hidden limitations:

```
Visible constraint: "We have 2 weeks"
→ Ask: "What's the deadline driver?"
→ Hidden constraint: "Demo for investor meeting"
→ Real requirement: "Working prototype, not production-ready"
```

**Questions:**
- What's the timeline and why?
- What tech stack must we use?
- What dependencies exist?
- What can't change?

### Users Layer

Understand who will actually use this:

```
Vague: "Users need authentication"
→ Ask: "What types of users?"
→ Specific: "Internal staff (SSO) vs external customers (email)"
→ Design impact: Two auth flows, not one
```

**Questions:**
- Who are the users?
- What are their technical skills?
- What devices/platforms?
- What's their context of use?

## Trade-off Evaluation

### Example: API Design

| Approach | REST | GraphQL | gRPC |
|----------|------|---------|------|
| **Complexity** | Low | Medium | High |
| **Flexibility** | Medium | High | Low |
| **Performance** | Medium | Medium | High |
| **Team familiarity** | High | Low | Low |
| **Tooling support** | Excellent | Good | Fair |
| **Time to implement** | 1 week | 3 weeks | 4 weeks |
| **Recommended** | ✅ MVP | Future | Enterprise |

### Evaluation Process

1. **List criteria**: What matters for this project?
2. **Weight criteria**: Not everything is equal
3. **Score approaches**: Rate each on criteria
4. **Calculate total**: Weighted sum
5. **Sanity check**: Does the winner feel right?

### When Numbers Lie

Quantitative scoring helps, but trust your gut if:
- Winner has one critical flaw (e.g., "breaks existing system")
- Team strongly opposes (adoption risk)
- Context changed mid-evaluation

## Decision Persistence

### Handoff Format

```typescript
dev_handoff(action='write', handoff={
  version: '2.0',
  agent_id: 'brainstorm',
  task_id: 'TASK-123',
  status: 'success',
  summary: 'Explored chat architecture, chose REST API approach',
  decisions: {
    'api-style': 'REST over GraphQL — team familiarity + 1-week timeline',
    'storage': 'MongoDB — existing stack, document model fits chat',
    'auth': 'JWT tokens — stateless, mobile-friendly'
  },
  for_next_agent: 'Create implementation plan for REST chat API with MongoDB',
  open_questions: [
    'Message retention policy?',
    'Rate limiting strategy?'
  ]
})
```

### What to Record

| Include | Why |
|---------|-----|
| **Decisions** | Key choices with rationale |
| **Rejected options** | Why they didn't fit |
| **Constraints** | What limited our choices |
| **Open questions** | What still needs answering |
| **For next agent** | Clear handoff instruction |

## Transition Protocol

### From Brainstorm to Plan

After design decisions are made:

1. **Persist via handoff** (as shown above)
2. **Summarize key decisions** (1-2 sentences each)
3. **Prompt user**: "Design decisions recorded. Ready for `/create-plan`?"
4. **Plan skill reads handoff** automatically (via task_id or latest handoff)

### Example Transition

```
Agent (brainstorm): Design decisions saved to handoff-20260213.md:
- REST API (team familiar, 1-week timeline)
- MongoDB storage (existing stack)
- JWT auth (stateless)

Open questions:
- Message retention policy
- Rate limiting

Ready to create implementation plan? Run /create-plan
```

User runs `/create-plan` → plan skill reads handoff → starts planning phase with design context.

## Anti-Patterns

### Pattern: Question Dumping

❌ **Wrong:**
```
Let me ask a few questions:
1. What's the timeline?
2. Who are the users?
3. What tech stack?
4. What's the budget?
5. What are the success metrics?

Please answer all of these.
```

✅ **Right:**
```
To clarify the timeline, which best describes your situation?
A) Urgent (< 1 week)
B) Normal (2-4 weeks)
C) Flexible (can wait)
```

### Pattern: Analysis Paralysis

❌ **Wrong:**
```
I've identified 7 possible approaches. Let me analyze each one in detail...
[3000 words later]
...so which do you prefer?
```

✅ **Right:**
```
I've narrowed it to 3 viable approaches:

| Approach | Complexity | Time | Risk |
|----------|-----------|------|------|
| REST API | Low | 1 week | Low |
| GraphQL | Medium | 3 weeks | Medium |
| gRPC | High | 4 weeks | High |

Given your 2-week timeline, REST is recommended. Agree?
```

### Pattern: YAGNI Violation

❌ **Wrong:**
```
Let's add:
- Multi-language support (might need it)
- Real-time sync (nice to have)
- Offline mode (users could want this)
- Plugin system (future-proof)
```

✅ **Right:**
```
Core MVP requirements (must-have):
- Basic chat messaging
- User authentication

Considered but deferred (YAGNI):
- Multi-language: No current need
- Real-time: Polling sufficient for MVP
- Offline: Out of scope
- Plugins: Premature abstraction
```

### Pattern: Decision Amnesia

❌ **Wrong:**
```
[After 30-minute discussion]
Great, we decided on REST API. Now let's move on...
[No record of decision]
```

✅ **Right:**
```
[After discussion]
Decision recorded via handoff:
- REST API chosen (team familiar, 1-week deadline)
- MongoDB for storage (existing stack)
- JWT auth (stateless)

Saved to handoff-20260213.md. Ready for /create-plan?
```

## Advanced Techniques

### Constraint Surfacing

Ask "What if...?" to reveal hidden constraints:

```
"What if this takes 3 months instead of 2 weeks?"
→ "Not acceptable, investor demo is locked in"
→ Constraint revealed: Demo-ready > Production-ready

"What if we use technology X instead of Y?"
→ "Team doesn't know X, would need training"
→ Constraint revealed: Team expertise matters
```

### Negative Space Exploration

Ask about what's NOT included:

```
"What features are explicitly out of scope?"
→ Forces clarity on boundaries
→ Prevents scope creep

"What won't change regardless of approach?"
→ Identifies true constraints
```

### Risk Probing

For each approach, ask:

```
"What's the worst case scenario?"
"What would make this fail?"
"What assumptions are we making?"
```

Risk-aware decisions are better decisions.

## Memory Integration

### Before Brainstorming

Query memory for similar past work:

```
dev_memory(action="query", query="chat architecture mongodb")
dev_memory(action="query", query="REST API design patterns")
```

### After Brainstorming

Save novel insights:

```
dev_memory(action="save",
  title="Chat Architecture: REST vs GraphQL Decision",
  text="For team with strong REST background and tight timeline,
        REST API preferred over GraphQL despite GraphQL's flexibility.
        Team learning curve + tooling setup outweighed benefits.",
  tags=["pattern", "api-design", "decision-rationale"])
```

## Summary

Effective brainstorming:
1. **One question at a time** — don't overwhelm
2. **Options over open-ended** — guide, don't interrogate
3. **Short segments** — verify understanding frequently
4. **YAGNI strict** — justify every feature
5. **Persist decisions** — don't discard context

Result: Clear, justified design decisions ready for planning phase.
