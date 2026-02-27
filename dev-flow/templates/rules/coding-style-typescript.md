---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Coding Style

- Enable strict mode in tsconfig
- Prefer interface over type for object shapes (extendable)
- Use type for unions, intersections, and mapped types
- Avoid `any` — use `unknown` and narrow with type guards
- Prefer `const` assertions for literal types
- Use discriminated unions over optional fields
- Barrel exports (index.ts) for module public API
