---
name: api-implementer
description: Implement RESTful API endpoints in NestJS/Fastify projects with controller, service, DTO, guard, and tests. Includes SSE streaming, CORS, and auth guard checklists. This skill should be used when user says "implement API", "add endpoint", "create controller", "new API", "实现接口", "添加端点", "创建控制器", "新增API".
allowed-tools: [Read, Edit, Write, Bash, Glob, Grep, Task]
---

# API Implementer

Implements NestJS/Fastify API endpoints with production-ready patterns.

## Workflow

### Step 1: Analyze Existing Patterns

```
Glob("**/controllers/**") + Glob("**/services/**")
→ Read 1-2 existing controllers to match project style
```

### Step 2: Query Knowledge

```
dev_memory(action="query", query="nestjs fastify cors sse auth")
→ Load known pitfalls before implementation
```

### Step 3: Generate Files

| File | Pattern |
|------|---------|
| `controller.ts` | Route handlers, DTOs, decorators |
| `service.ts` | Business logic, external calls |
| `*.dto.ts` | Request/response validation |
| `*.guard.ts` | Auth guards (if needed) |
| `*.spec.ts` | Unit tests for each file |

### Step 4: Apply Checklists

Before marking complete, verify against relevant checklists from `references/checklists.md`.

## When to Apply Checklists

| Feature | Checklist |
|---------|-----------|
| Any new endpoint | Basic API checklist |
| SSE / streaming | SSE + CORS checklist |
| Auth required | Auth Guard checklist |
| Production deploy | Deploy checklist |

## References

- `references/checklists.md` — Production checklists for CORS, SSE, Auth, Deploy
