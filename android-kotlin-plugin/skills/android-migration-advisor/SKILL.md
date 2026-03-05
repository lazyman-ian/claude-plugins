---
name: android-migration-advisor
description: Advises on Android technology migration strategy, risk assessment, and phased execution plans. This skill should be used when evaluating whether to migrate technologies, planning migration timelines, assessing migration risks, or choosing between old and new Android approaches. Key capabilities include XML→Compose migration planning, Java→Kotlin conversion strategy, RxJava→Coroutines transition, Dagger→Hilt migration, and deprecated library replacement. Triggers on "migrate", "migration", "upgrade", "modernize", "XML to Compose", "Java to Kotlin", "RxJava to Coroutines", "Dagger to Hilt", "deprecated", "tech debt", "迁移", "升级", "现代化", "技术债务", "Compose迁移", "Kotlin迁移", "API升级", "版本迁移". Do NOT use for writing Compose code — use compose-expert instead. Do NOT use for scanning deprecated APIs without strategy — use migration-scanner agent instead.
memory: project
allowed-tools: [Read, Glob, Grep]
---

# Android Migration Advisor

Strategic guidance for Android technology migrations: evaluation, planning, risk assessment, and phased execution.

## When to Use
- Evaluating whether a migration is worth the investment
- Planning migration timeline and phases
- Assessing risks and dependencies
- Choosing between incremental vs big-bang approach

## Migration Decision Framework

### Step 1: Assess Current State
- Current tech stack and versions
- Team size and expertise
- Codebase size (LoC, module count)
- Test coverage
- CI/CD maturity

### Step 2: Evaluate Migration Value
| Factor | Score (1-5) |
|--------|-------------|
| Developer productivity gain | |
| Performance improvement | |
| Maintenance cost reduction | |
| Talent acquisition/retention | |
| Long-term support risk | |
| **Total (>15 = migrate)** | |

### Step 3: Risk Assessment
| Risk | Mitigation |
|------|-----------|
| Breaking existing features | Incremental migration + comprehensive tests |
| Team learning curve | Pair programming + training sprint |
| Timeline uncertainty | Phase-based with checkpoints |
| Third-party compatibility | Verify library support before starting |

## Major Migration Paths

### 1. XML → Jetpack Compose
**Recommendation**: Migrate for new code, retrofit high-churn screens

| Phase | Scope | Duration |
|-------|-------|----------|
| 1. Foundation | Theme, Design System in Compose | 2-4 weeks |
| 2. New Features | All new screens in Compose | Ongoing |
| 3. Component Library | Shared components as Composables | 4-8 weeks |
| 4. High-Churn Screens | Replace most-modified XML screens | 8-16 weeks |
| 5. Remaining (optional) | Low-churn screens if ROI positive | As needed |

Key decisions:
- Use ComposeView + ViewCompositionStrategy for interop
- Keep XML for stable, rarely-changed screens
- Material 3 theme from day 1

→ Details: `references/compose-migration.md`

### 2. Java → Kotlin
**Recommendation**: Convert actively-modified files, new code 100% Kotlin

| Phase | Scope | Duration |
|-------|-------|----------|
| 1. Setup | Kotlin gradle plugin, interop annotations | 1 week |
| 2. Utilities | Convert helper/util classes | 2-4 weeks |
| 3. Data Layer | Models, repositories, data sources | 4-8 weeks |
| 4. Business Logic | ViewModels, use cases | 4-8 weeks |
| 5. UI Layer | Activities, Fragments (if not migrating to Compose) | 8-16 weeks |

Key decisions:
- Use Android Studio's J2K converter + manual review
- Add `@JvmStatic`, `@JvmOverloads` for Java interop
- Nullable types at boundary (Java calling Kotlin)

→ Details: `references/kotlin-migration.md`

### 3. RxJava → Kotlin Coroutines/Flow
**Recommendation**: Migrate new code to Coroutines, retrofit when touching RxJava code

| RxJava | Kotlin Equivalent |
|--------|-------------------|
| `Observable` | `Flow` |
| `Single` | `suspend fun` |
| `Completable` | `suspend fun` (returns Unit) |
| `Maybe` | `suspend fun` returning nullable |
| `Subject` (behavior) | `MutableStateFlow` |
| `Subject` (publish) | `MutableSharedFlow` |
| `Flowable` | `Flow` with buffer |
| `Disposable` | `Job` (auto-cancelled with scope) |

| RxJava Operator | Coroutines/Flow |
|-----------------|-----------------|
| `.subscribeOn()` | `flowOn()` |
| `.observeOn()` | `flowOn()` / collect on right scope |
| `.map()` | `.map()` |
| `.flatMap()` | `.flatMapConcat()` / `.flatMapLatest()` |
| `.switchMap()` | `.flatMapLatest()` |
| `.debounce()` | `.debounce()` |
| `.distinctUntilChanged()` | `.distinctUntilChanged()` |
| `.zip()` | `combine()` or `zip()` |
| `.merge()` | `merge()` |
| `.combineLatest()` | `combine()` |

→ Details: `references/coroutines-migration.md`

### 4. Dependency Modernization
| Old | New | Priority |
|-----|-----|----------|
| Dagger | Hilt | High (simpler DI) |
| SharedPreferences | DataStore | Medium (async, type-safe) |
| kapt | KSP | High (2x faster builds) |
| LiveData | StateFlow | Medium (KMP-compatible) |
| Gson | kotlinx.serialization | Medium (Kotlin-native) |
| Retrofit + Gson | Retrofit + kotlinx.serialization (or Ktor) | Low |
| Glide/Picasso | Coil | Low (Kotlin-first, Compose-native) |
| Navigation (string routes) | Navigation (type-safe) | Medium |
| Accompanist | Built-in Compose APIs | High (deprecated) |

→ Details: `references/dependency-migration.md`

## Migration Anti-Patterns
| Anti-Pattern | Why Bad | Do Instead |
|-------------|---------|------------|
| Big-bang rewrite | High risk, long freeze | Incremental, screen-by-screen |
| Converting without tests | No safety net | Add tests first, then convert |
| Mixing old+new in same file | Confusing, hard to review | Clean boundaries per file |
| Migrating stable code | No ROI | Focus on high-churn areas |
| Ignoring interop | Runtime crashes | Test interop boundaries |

## Output Format
For each migration recommendation:
1. **Assessment**: Current state + target state
2. **ROI Analysis**: Benefits vs costs
3. **Phase Plan**: Ordered phases with duration estimates
4. **Risk Matrix**: Risks + mitigations
5. **Quick Wins**: Low-effort, high-impact items to start

## References
| Category | Reference |
|----------|-----------|
| **XML→Compose** | `references/compose-migration.md` |
| **Java→Kotlin** | `references/kotlin-migration.md` |
| **RxJava→Coroutines** | `references/coroutines-migration.md` |
| **Dependencies** | `references/dependency-migration.md` |
