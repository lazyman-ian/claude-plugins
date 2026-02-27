---
paths:
  - "**/*.swift"
---

# Swift Coding Style

- guard-let for early return, if-let for conditional binding
- Use trailing closure syntax for single-closure parameters
- Prefer value types (struct) over reference types (class) when possible
- Mark classes as final by default
- Use access control explicitly (private, internal, public)
- Prefer @MainActor over DispatchQueue.main
- Use async/await over completion handlers for new code
