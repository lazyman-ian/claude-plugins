---
paths:
  - "**/*.kt"
  - "**/*.kts"
---

# Kotlin Coding Style

- Use data class for DTOs and value objects
- Prefer val over var (immutability by default)
- Use sealed class/interface for restricted hierarchies
- Extension functions for utility operations
- Coroutines over callbacks for async operations
- Use scope functions appropriately: let (null check), apply (config), run (transform), also (side effect)
- Prefer expression body for single-expression functions
