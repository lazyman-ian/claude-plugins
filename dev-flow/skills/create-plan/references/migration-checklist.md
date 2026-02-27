# Migration Checklist

Reference for migration-type plans (framework upgrades, API version bumps, platform transitions).

## When to Use

Plan description contains: "migrate", "upgrade", "迁移", "升级", "transition", "modernize"

## 1. Migration Assessment

### Scope Analysis

- [ ] Identify all affected files (`Grep` for deprecated APIs/patterns)
- [ ] Count: files, lines, components impacted
- [ ] Map dependency graph of affected modules
- [ ] Identify shared code vs isolated code

### Complexity Factors

| Factor | Low | Medium | High |
|--------|-----|--------|------|
| Files affected | < 10 | 10-50 | > 50 |
| API changes | Additive only | Rename/signature | Semantic change |
| Data model | No change | Schema migration | Format change |
| Dependencies | 0-1 updated | 2-5 updated | > 5 or major bumps |
| Test coverage | > 80% | 50-80% | < 50% |

### Platform-Specific Checks

**iOS/Swift**:
- [ ] Minimum deployment target change?
- [ ] Deprecated UIKit/SwiftUI APIs? (`@available`, `#unavailable`)
- [ ] Swift language version bump? (concurrency, macros)
- [ ] CocoaPods/SPM dependency compatibility?
- [ ] Xcode version requirement?

**Android/Kotlin**:
- [ ] compileSdk / targetSdk bump?
- [ ] Deprecated Android APIs? (`@Deprecated`, `Build.VERSION_CODES`)
- [ ] Kotlin version bump? (K2 compiler, coroutines)
- [ ] Gradle plugin compatibility?

**Web/Node**:
- [ ] Node.js version requirement?
- [ ] Breaking dependency changes? (`npm outdated`)
- [ ] Build tool migration? (webpack → vite, etc.)

## 2. Risk Assessment

### Risk Categories

| Risk | Detection | Mitigation |
|------|-----------|------------|
| **Breaking API** | Grep for deprecated symbols | Adapter/shim layer |
| **Data loss** | Schema diff analysis | Migration script + rollback |
| **Performance regression** | Benchmark before/after | Performance budget gate |
| **Silent behavior change** | Test coverage gap analysis | Add tests BEFORE migration |
| **Dependency conflict** | Version resolution check | Lock file analysis |

### Risk Level → Strategy

| Risk | Strategy |
|------|----------|
| Low (additive) | Big bang — migrate all at once |
| Medium (renames) | Phased — module by module |
| High (semantic) | Strangler fig — gradual replacement with compatibility layer |

## 3. Migration Plan Structure

### Phase Template

```yaml
phases:
  - id: 0
    name: "Preparation"
    tasks:
      - Add tests for current behavior (safety net)
      - Create compatibility shims if needed
      - Document rollback procedure
    verify: ["make check"]

  - id: 1
    name: "Core Migration"
    tasks:
      - Update dependencies/SDK versions
      - Apply automated fixes (deprecation warnings)
      - Manual fixes for breaking changes
    verify: ["make check", "build succeeds"]

  - id: 2
    name: "Cleanup"
    tasks:
      - Remove compatibility shims
      - Remove deprecated code paths
      - Update documentation
    verify: ["make check", "no deprecation warnings"]
```

### Key Principles

1. **Test before migrate** — add tests for current behavior first
2. **One change at a time** — don't mix migration with feature work
3. **Verify each phase** — build + test must pass before next phase
4. **Rollback plan** — every phase must be independently revertable
5. **Feature flags** — for user-facing changes, use gradual rollout

## 4. Verification Gates

| Gate | Command | Criteria |
|------|---------|----------|
| Build | `dev_config → check` | Exit 0 |
| Tests | `dev_config → test` | All pass |
| Deprecations | `Grep("deprecated\|@available")` | Count ≤ before |
| Performance | Benchmark comparison | No regression > 10% |
