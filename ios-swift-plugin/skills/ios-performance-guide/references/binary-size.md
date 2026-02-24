# Binary Size Optimization

Smaller apps have higher download conversion rates. App Store limits: 200MB cellular download.

## Analysis Tools

| Tool | Purpose |
|------|---------|
| Xcode Build Report | Per-target size breakdown |
| App Thinning Size Report | Per-device variant sizes |
| `bloaty` / Emerge Tools | Symbol-level size attribution |
| `nm -size-sort` | Largest symbols in binary |
| App Store Connect API | Actual download/install sizes |

**Generate App Thinning report:**
Product → Archive → Distribute App → Ad Hoc → check "App Thinning" → export.

## Optimization Strategies

### 1. Asset Catalog Optimization

| Technique | Savings |
|-----------|---------|
| Remove unused images (Xcode "Unused Assets" or `FengNiao`) | 5-30% assets |
| Use SF Symbols instead of custom icons | Eliminates icon assets |
| Single-scale PDF vector instead of 1x/2x/3x PNG | ~66% per asset |
| WebP/HEIF instead of PNG for photos | 30-50% per image |
| Asset Catalog compression (Xcode default) | Automatic |
| On-Demand Resources (ODR) for rarely-used assets | Moves out of initial download |

### 2. Code Size Reduction

| Technique | Impact |
|-----------|--------|
| Swift: `-Osize` optimization level | 5-15% code section |
| Strip Swift symbols (Release default) | Removes debug metadata |
| Dead code stripping (`-dead_strip` linker flag) | Removes unused functions |
| Reduce generic specialization (`-Onone` for rarely-used generics) | Fewer monomorphized copies |
| Remove unused ObjC classes | Audit with `SMCheckProject` or runtime check |
| `ASSETCATALOG_COMPILER_OPTIMIZATION = space` | Optimize catalog for size |

### 3. Dependency Audit

```
Rule: Every dependency adds binary size. Audit quarterly.
```

| Action | Check |
|--------|-------|
| Replace heavy SDK with system framework | RxSwift (2MB+) → Combine (0 bytes) |
| Remove unused features of SDKs | Firebase: only import needed modules |
| Prefer SPM over CocoaPods | SPM allows finer-grained imports |
| Static vs dynamic doesn't change total size | But static = faster launch |

### 4. On-Demand Resources (ODR)

Move infrequently-used content out of initial download:

```swift
let request = NSBundleResourceRequest(tags: ["level-pack-5"])
try await request.beginAccessingResources()
// Use resources...
request.endAccessingResources()
```

Suitable for: tutorial assets, localized content, game levels, large media.

### 5. Swift Metadata

Swift includes type metadata for runtime reflection. Minimize:

- Avoid deeply nested generic types
- Use `@_optimize(size)` on large generic functions (internal only)
- Fewer public protocols with associated types = less metadata

## Monitoring

### Per-release Tracking

```bash
# In CI: track binary size delta
CURRENT=$(stat -f%z build/MyApp.app/MyApp)
PREVIOUS=$(cat .metrics/binary_size)
DELTA=$((CURRENT - PREVIOUS))
if [ $DELTA -gt 500000 ]; then
    echo "WARNING: Binary grew by $(($DELTA / 1024))KB"
fi
echo $CURRENT > .metrics/binary_size
```

### App Store Connect API

Track actual thinned download sizes across device variants programmatically.

## Quick Wins Checklist

- [ ] Run Xcode "Unused Assets" analysis
- [ ] Enable `-Osize` for Release builds
- [ ] Verify dead code stripping is ON
- [ ] Check `ASSETCATALOG_COMPILER_OPTIMIZATION = space`
- [ ] Audit third-party dependencies for unused imports
- [ ] Replace custom icons with SF Symbols where possible
- [ ] Move tutorial/onboarding assets to ODR
- [ ] Generate App Thinning report and review per-device sizes

## Sources

- [Apple: Reducing your app's download size](https://developer.apple.com/documentation/xcode/reducing-your-app-s-download-size)
- 戴铭: GMTC iOS 瘦身实践
- 戴铭: SMCheckProject 无用类检测
