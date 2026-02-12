# API Implementation Plan Template

Use this template when planning NestJS/Fastify API endpoints. Include relevant checklists in the plan's success criteria.

## File Generation Pattern

| File | Pattern |
|------|---------|
| `controller.ts` | Route handlers, DTOs, decorators |
| `service.ts` | Business logic, external calls |
| `*.dto.ts` | Request/response validation |
| `*.guard.ts` | Auth guards (if needed) |
| `*.spec.ts` | Unit tests for each file |

## Plan Section Template

```markdown
### Phase N: Implement {endpoint-name} API

**Files:**
- `src/{module}/{module}.controller.ts` — Route handler
- `src/{module}/{module}.service.ts` — Business logic
- `src/{module}/dto/{action}.dto.ts` — Request/response DTOs
- `src/{module}/{module}.controller.spec.ts` — Tests

**Steps:**
1. Read 1-2 existing controllers to match project style
2. Create DTOs with class-validator decorators
3. Implement service with error handling
4. Create controller with correct HTTP method decorators
5. Write unit tests (controller + service)
6. Apply checklist (see below)

**Verify:** `npm test -- --testPathPattern={module}`
```

## Checklists (include in success criteria)

### Basic API Endpoint

- [ ] Controller uses correct HTTP method decorators
- [ ] DTOs have class-validator decorators
- [ ] Service injected via constructor
- [ ] Error responses use NestJS exceptions (HttpException, NotFoundException, etc.)
- [ ] Unit tests for controller + service
- [ ] Global prefix matches deployment path

### SSE + CORS (Fastify)

> Source: realagent-services CORS incident (3 PRs to fix what should have been 1)

#### AuthGuard + CORS Interaction
- [ ] AuthGuard bypasses OPTIONS requests (`if (req.method === 'OPTIONS') return true`)
- [ ] Reason: NestJS Guards execute BEFORE Fastify CORS plugin

#### reply.hijack() + Headers
- [ ] Headers flushed to raw socket BEFORE `reply.hijack()`
  ```typescript
  const headers = reply.getHeaders();
  reply.raw.writeHead(200, headers);
  reply.hijack();
  ```
- [ ] Reason: `hijack()` tells Fastify to stop managing response — all plugin headers lost

#### CORS Configuration
- [ ] `origin` configured via environment variable (NOT hardcoded `true`)
- [ ] Custom headers added to `allowedHeaders`: `traceparent`, `x-idempotency-key`
- [ ] `exposedHeaders` set for headers frontend needs to read
- [ ] `maxAge` set for preflight caching (e.g., `86400`)
- [ ] `credentials: true` if using cookies/auth

#### SSE Response
- [ ] Content-Type: `text/event-stream`
- [ ] Heartbeat interval configured (e.g., 15s)
- [ ] Client disconnect handler (cleanup resources)
- [ ] Timeout handling (TTFT, idle, hard)

### Auth Guard

- [ ] Bearer token extraction from Authorization header
- [ ] OPTIONS bypass for CORS preflight
- [ ] Token validation against auth provider
- [ ] Proper error codes: 401 (missing/invalid), 403 (insufficient permissions)
- [ ] Guard registered globally or per-controller (not both)
- [ ] Test: valid token, invalid token, missing token, OPTIONS request

### Production Deploy

- [ ] Global prefix matches K8s/nginx routing
- [ ] Health check endpoint excluded from prefix
- [ ] Environment variables documented
- [ ] CORS_ORIGIN set to production domains
- [ ] Rate limiting configured
- [ ] Request/response logging
