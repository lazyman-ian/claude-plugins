# Refactoring Catalog

Detailed patterns for common refactorings. Each includes when to apply, steps, and verification.

---

## Extract Function/Method

**When**: A code block does one identifiable thing within a larger function, or the same logic appears in multiple places.

**Steps**:
1. Identify the block to extract
2. Determine inputs (parameters) and outputs (return value)
3. Create new function with descriptive name
4. Replace original block with function call
5. Verify

**Verification**: Run tests. Confirm callers produce identical results. Check that no variables leak scope.

**Example**:
```
// Before
function processOrder(order) {
  // ... 20 lines calculating discount ...
  // ... 10 lines applying tax ...
}

// After
function processOrder(order) {
  const discount = calculateDiscount(order);
  const total = applyTax(order, discount);
}
```

---

## Extract Class/Module

**When**: A class/module handles multiple responsibilities. Signs: groups of fields/methods that change together independently of other groups.

**Steps**:
1. Identify the cohesive group of fields + methods
2. Create new class/module with those members
3. Update original to delegate to the new class
4. Verify
5. Update callers to use new class directly (if appropriate)
6. Verify again

**Verification**: All existing tests pass. New class can be tested independently.

---

## Split File

**When**: File exceeds ~300 lines with clearly distinct sections (e.g., types + utilities + business logic).

**Steps**:
1. Identify natural boundaries (marked by comments, blank lines, or topic shifts)
2. Create new files with clear names reflecting their content
3. Move one section at a time, updating imports
4. Verify after each move
5. Update the original file's exports/re-exports if needed

**Verification**: All imports resolve. No circular dependencies introduced. Tests pass.

**Pitfall**: Watch for file-scoped variables shared across sections. These need explicit exports or a shared module.

---

## Inline Function

**When**: A function's body is as clear as its name, or it's a trivial wrapper that adds indirection without value.

**Steps**:
1. Confirm function is not part of a public API
2. Find all callers
3. Replace each call with the function body
4. Verify after each replacement
5. Remove the function definition

**Verification**: Tests pass. No callers remain. No public API contract broken.

---

## Rename Symbol

**When**: Name doesn't convey purpose, or naming convention changed.

**Steps**:
1. Identify all usages (code, tests, comments, config, docs)
2. Rename in the definition file
3. Update all usages in the same module, verify
4. Expand to other modules one at a time, verify each

**Verification**: Build succeeds (catches type/import errors). Tests pass. Grep for old name returns zero matches.

**Pitfall**: String references (API endpoints, serialization keys, database columns) won't be caught by the compiler. Search strings explicitly.

---

## Move Function

**When**: A function is used more by another module than by its current host, or it doesn't belong conceptually.

**Steps**:
1. Identify the target module
2. Move function to target
3. Update imports in the source module (re-export if callers exist)
4. Verify
5. Update callers to import from new location
6. Verify
7. Remove re-export from source once all callers updated

**Verification**: No circular dependencies. All imports resolve. Tests pass.

---

## Replace Conditional with Polymorphism

**When**: A switch/if-else chain dispatches on type and the branches contain substantial logic.

**Steps**:
1. Identify the type discriminator and the branches
2. Create a base class/interface with the polymorphic method
3. Create one subclass/implementation per branch
4. Verify the new hierarchy compiles
5. Replace the conditional with a polymorphic call
6. Verify behavior matches for each type

**Verification**: Each branch tested independently. Original test cases still pass. Edge cases (null, unknown type) handled.

**Risk**: High. This changes the code's structure significantly. Ensure comprehensive test coverage before starting.

---

## Introduce Parameter Object

**When**: Three or more parameters are passed together repeatedly across multiple functions.

**Steps**:
1. Identify the parameter group
2. Create a data class/struct/interface for them
3. Update one function signature at a time
4. Update callers to construct the object
5. Verify after each function

**Verification**: Type checker confirms all callers updated. Tests pass. No parameter ordering bugs.

**Bonus**: Once grouped, you can move validation logic into the parameter object itself.
