# Code Quality Checklist

## Error Handling

### Anti-patterns
- Swallowed exceptions: empty catch blocks or catch-and-log-only
- Overly broad catch: catching base `Exception`/`Error`
- Error info leakage: stack traces exposed to users
- Missing error handling around I/O, network, parsing
- Async gaps: unhandled promise rejections, missing `.catch()`, no error boundary

### Check
- [ ] Errors caught at appropriate boundaries
- [ ] Error messages user-friendly (no internals)
- [ ] Errors logged with context for debugging
- [ ] Async errors properly propagated
- [ ] Fallback behavior defined for recoverable errors

## Performance

### Database & I/O
- [ ] No N+1 queries (loop making query per item)
- [ ] No SELECT * when few columns needed
- [ ] Pagination for large datasets
- [ ] Indexes exist for query columns

### Caching
- [ ] Expensive operations cached with TTL
- [ ] Cache invalidation strategy defined
- [ ] No user-specific data cached globally

### Memory
- [ ] No unbounded collections (arrays/maps growing without limit)
- [ ] Streaming for large files (not loading entirely)
- [ ] No string concatenation in loops

## Boundary Conditions

### Null/Undefined
- [ ] Properties not accessed on potentially null objects
- [ ] `0` and `""` handled correctly (not falsy-trapped)
- [ ] Consistent null vs undefined convention

### Collections
- [ ] Empty array/object handled
- [ ] First/last element access has length check
- [ ] Pagination handles empty pages

### Numeric
- [ ] Division by zero checked
- [ ] Integer overflow for large numbers
- [ ] No floating-point equality comparison
- [ ] Off-by-one in loops, slicing, pagination

## Cross-Cutting Concerns

### Guard/Middleware Ordering
- [ ] Auth guards don't block CORS preflight (OPTIONS)
- [ ] Middleware execution order verified for framework
- [ ] Global filters don't swallow domain exceptions

### SSE/Streaming
- [ ] Headers flushed before response hijacking
- [ ] Client disconnect cleanup (resource release)
- [ ] Heartbeat configured to prevent timeout
- [ ] Timeout handling (TTFT, idle, hard)

### Configuration
- [ ] Environment-specific values via env vars (not hardcoded)
- [ ] Secrets not in config files
- [ ] Defaults safe for development, explicit for production
