# Rendering Performance

UIKit/Core Animation layer rendering optimization. For SwiftUI view body issues, see `swiftui-performance-audit` skill.

## Rendering Pipeline

```
CPU (Layout + Display) → GPU (Compositing + Rendering) → Frame Buffer → Screen
                  must complete within 16.67ms (60fps) or 8.33ms (120fps ProMotion)
```

## CPU Optimization

### Layout Pre-calculation

| Problem | Solution |
|---------|----------|
| Auto Layout in complex cells | Pre-calculate heights, cache results |
| Repeated `sizeThatFits` calls | Cache text sizes with NSCache |
| `systemLayoutSizeFitting` per cell | Use `estimatedRowHeight` + self-sizing |

```swift
// Cache cell heights
private var heightCache = NSCache<NSString, NSNumber>()

func tableView(_ tableView: UITableView, heightForRowAt indexPath: IndexPath) -> CGFloat {
    let key = "\(indexPath.section)-\(indexPath.row)" as NSString
    if let cached = heightCache.object(forKey: key) {
        return CGFloat(cached.floatValue)
    }
    let height = calculateHeight(for: indexPath)
    heightCache.setObject(NSNumber(value: Float(height)), forKey: key)
    return height
}
```

### Image Decoding

Images are decoded on the main thread by default when first displayed.

```swift
// Background decoding
func decodedImage(from data: Data, targetSize: CGSize) -> UIImage? {
    let options: [CFString: Any] = [
        kCGImageSourceThumbnailMaxPixelSize: max(targetSize.width, targetSize.height) * UIScreen.main.scale,
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true
    ]
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
          let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    else { return nil }
    return UIImage(cgImage: cgImage)
}
```

**Key:** Downsample to display size. A 4000x3000 photo displayed at 100x75 wastes 160x memory.

### Text Rendering

For complex text (mixed fonts, attributes, emoji):

```swift
// Async text calculation with TextKit/CoreText
Task.detached(priority: .userInitiated) {
    let attributedString = NSAttributedString(string: text, attributes: attrs)
    let framesetter = CTFramesetterCreateWithAttributedString(attributedString)
    let size = CTFramesetterSuggestFrameSizeWithConstraints(
        framesetter, CFRange(), nil, CGSize(width: maxWidth, height: .greatestFiniteMagnitude), nil
    )
    await MainActor.run {
        self.textHeight = size.height
    }
}
```

## GPU Optimization

### Offscreen Rendering

These CALayer properties trigger expensive offscreen render passes:

| Property | Triggers Offscreen | Alternative |
|----------|-------------------|-------------|
| `cornerRadius` + `masksToBounds` | YES | Pre-render rounded image |
| `shadow` (without shadowPath) | YES | Set `shadowPath` explicitly |
| `mask` | YES | Pre-composite masked image |
| `allowsGroupOpacity` + opacity < 1 | YES | Set `shouldRasterize = true` if static |
| `border` | Minor | Acceptable for simple cases |

```swift
// SLOW: Offscreen rendering every frame
imageView.layer.cornerRadius = 8
imageView.layer.masksToBounds = true

// FAST: Pre-render rounded corners
extension UIImage {
    func rounded(radius: CGFloat) -> UIImage {
        let rect = CGRect(origin: .zero, size: size)
        UIGraphicsBeginImageContextWithOptions(size, false, scale)
        UIBezierPath(roundedRect: rect, cornerRadius: radius).addClip()
        draw(in: rect)
        let result = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return result ?? self
    }
}
```

```swift
// SLOW: Shadow calculated every frame
view.layer.shadowColor = UIColor.black.cgColor
view.layer.shadowOffset = CGSize(width: 0, height: 2)
view.layer.shadowOpacity = 0.3

// FAST: Explicit shadow path
view.layer.shadowPath = UIBezierPath(roundedRect: view.bounds, cornerRadius: 8).cgPath
```

### Compositing

- Mark opaque views: `view.isOpaque = true`, `view.backgroundColor = .white`
- Reduce view hierarchy depth (flatten where possible)
- Use `shouldRasterize = true` for complex static subtrees (with `rasterizationScale`)
- Avoid blending: opaque backgrounds prevent alpha blending

## Lock Selection (Modern)

When protecting shared mutable state outside of Swift Concurrency:

| Mechanism | Use When | Notes |
|-----------|----------|-------|
| **Actor** | Swift async context | Preferred for new code |
| **os_unfair_lock** | Synchronous, low-level | Apple's replacement for OSSpinLock. Handles priority donation |
| **NSLock** | Simple synchronous locking | Safe, slightly slower than os_unfair_lock |
| **DispatchQueue (serial)** | Protecting resource access | Higher overhead but familiar API |
| ~~OSSpinLock~~ | **NEVER** | Priority inversion bug (ibireme, 2016) |
| ~~pthread_mutex~~ | Rarely needed | os_unfair_lock preferred on Apple platforms |

```swift
// Modern lock pattern
import os

private let lock = OSAllocatedUnfairLock(initialState: [String: Data]())

func cached(_ key: String) -> Data? {
    lock.withLock { $0[key] }
}

func cache(_ key: String, data: Data) {
    lock.withLock { $0[key] = data }
}
```

## Debugging Tools

| Tool | Purpose |
|------|---------|
| Color Blended Layers (Simulator) | Show blended (red) vs opaque (green) regions |
| Color Offscreen-Rendered (Simulator) | Highlight offscreen render passes (yellow) |
| Core Animation Instrument | GPU frame time breakdown |
| View Debugging (Xcode) | 3D view hierarchy inspection |
| `CADisplayLink` frame counter | Runtime FPS monitoring |

## Sources

- [ibireme: iOS 保持界面流畅的技巧](https://blog.ibireme.com/2015/11/12/smooth_user_interfaces_for_ios/)
- [ibireme: 不再安全的 OSSpinLock](https://blog.ibireme.com/2016/01/16/spinlock_is_unsafe_in_ios/)
- [Apple: Understanding and improving SwiftUI performance](https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance)
