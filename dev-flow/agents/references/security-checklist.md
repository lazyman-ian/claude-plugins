# Security & Reliability Checklist

## Input/Output Safety
- [ ] No XSS via unsafe HTML injection, `dangerouslySetInnerHTML`, unescaped templates
- [ ] No injection (SQL/NoSQL/command/GraphQL) through string concatenation
- [ ] No SSRF with user-controlled URLs lacking allowlist
- [ ] No path traversal via unsanitized file paths (`../`)
- [ ] No prototype pollution from unsafe object merging (JS)

## Authentication & Authorization
- [ ] All endpoints have auth guards or explicit exclusion
- [ ] OPTIONS preflight requests bypass auth guards (CORS)
- [ ] No reliance on client-provided roles/flags/IDs
- [ ] Tenant/ownership validation on read/write operations
- [ ] Session management is secure (no fixation vulnerabilities)

## CORS & Headers (Fastify/Express)
- [ ] CORS origin configured via environment variable (NOT hardcoded `true` in production)
- [ ] Custom headers in `allowedHeaders` (traceparent, x-idempotency-key, etc.)
- [ ] `exposedHeaders` set for headers frontend needs
- [ ] `reply.hijack()` preceded by `reply.raw.writeHead()` to flush CORS headers
- [ ] Security headers present (CSP, X-Frame-Options, X-Content-Type-Options)

## Secrets & PII
- [ ] No API keys, tokens, credentials in code or config
- [ ] No secrets in git history
- [ ] No excessive PII logging
- [ ] Error messages don't expose internal details

## Race Conditions
- [ ] Shared state has proper synchronization
- [ ] No check-then-act without atomic operations
- [ ] Financial operations use transactions
- [ ] Counters use atomic increments
- [ ] Database operations use optimistic/pessimistic locking where needed

## Data Integrity
- [ ] Transactions wrap multi-step writes
- [ ] Idempotency for retryable operations
- [ ] Validation before persistence
- [ ] No partial writes leaving inconsistent state
