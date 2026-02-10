# API Implementation Checklists

## Basic API Endpoint

- [ ] Controller uses correct HTTP method decorators
- [ ] DTOs have class-validator decorators
- [ ] Service injected via constructor
- [ ] Error responses use NestJS exceptions (HttpException, NotFoundException, etc.)
- [ ] Unit tests for controller + service
- [ ] Global prefix matches deployment path

## SSE + CORS (Fastify)

> Source: realagent-services CORS incident (3 PRs to fix what should have been 1)

### AuthGuard + CORS Interaction
- [ ] AuthGuard bypasses OPTIONS requests (`if (req.method === 'OPTIONS') return true`)
- [ ] Reason: NestJS Guards execute BEFORE Fastify CORS plugin

### reply.hijack() + Headers
- [ ] Headers flushed to raw socket BEFORE `reply.hijack()`
  ```typescript
  const headers = reply.getHeaders();
  reply.raw.writeHead(200, headers);
  reply.hijack();
  ```
- [ ] Reason: `hijack()` tells Fastify to stop managing response — all plugin headers lost

### CORS Configuration
- [ ] `origin` configured via environment variable (NOT hardcoded `true`)
  ```typescript
  origin: process.env.CORS_ORIGIN?.split(',') || true  // true = dev only
  ```
- [ ] Custom headers added to `allowedHeaders`: `traceparent`, `x-idempotency-key`
- [ ] `exposedHeaders` set for headers frontend needs to read
- [ ] `maxAge` set for preflight caching (e.g., `86400`)
- [ ] `credentials: true` if using cookies/auth

### SSE Response
- [ ] Content-Type: `text/event-stream`
- [ ] Heartbeat interval configured (e.g., 15s)
- [ ] Client disconnect handler (cleanup resources)
- [ ] Timeout handling (TTFT, idle, hard)

## Auth Guard

- [ ] Bearer token extraction from Authorization header
- [ ] OPTIONS bypass for CORS preflight
- [ ] Token validation against auth provider
- [ ] Proper error codes: 401 (missing/invalid), 403 (insufficient permissions)
- [ ] Guard registered globally or per-controller (not both)
- [ ] Test: valid token, invalid token, missing token, OPTIONS request

## Production Deploy

- [ ] Global prefix matches K8s/nginx routing (`app.setGlobalPrefix('service-name')`)
- [ ] Health check endpoint excluded from prefix
- [ ] Environment variables documented in DEPLOYMENT.md
- [ ] CORS_ORIGIN set to production domains
- [ ] Rate limiting configured
- [ ] Request/response logging
