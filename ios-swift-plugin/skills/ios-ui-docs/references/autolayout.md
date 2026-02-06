# Auto Layout Reference

## Programmatic Constraints

### Basic Pattern

```swift
let view = UIView()
view.translatesAutoresizingMaskIntoConstraints = false
parentView.addSubview(view)

NSLayoutConstraint.activate([
    view.topAnchor.constraint(equalTo: parentView.topAnchor, constant: 16),
    view.leadingAnchor.constraint(equalTo: parentView.leadingAnchor, constant: 16),
    view.trailingAnchor.constraint(equalTo: parentView.trailingAnchor, constant: -16),
    view.bottomAnchor.constraint(equalTo: parentView.bottomAnchor, constant: -16)
])
```

### Safe Area

```swift
NSLayoutConstraint.activate([
    view.topAnchor.constraint(equalTo: parentView.safeAreaLayoutGuide.topAnchor),
    view.leadingAnchor.constraint(equalTo: parentView.safeAreaLayoutGuide.leadingAnchor),
    view.trailingAnchor.constraint(equalTo: parentView.safeAreaLayoutGuide.trailingAnchor),
    view.bottomAnchor.constraint(equalTo: parentView.safeAreaLayoutGuide.bottomAnchor)
])
```

### Size Constraints

```swift
// Fixed size
view.widthAnchor.constraint(equalToConstant: 100),
view.heightAnchor.constraint(equalToConstant: 50),

// Aspect ratio
view.heightAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.75),

// Min/Max
view.widthAnchor.constraint(greaterThanOrEqualToConstant: 100),
view.widthAnchor.constraint(lessThanOrEqualToConstant: 300),
```

### Centering

```swift
view.centerXAnchor.constraint(equalTo: parentView.centerXAnchor),
view.centerYAnchor.constraint(equalTo: parentView.centerYAnchor),
```

## Constraint Priority

```swift
let widthConstraint = view.widthAnchor.constraint(equalToConstant: 200)
widthConstraint.priority = .defaultHigh  // 750

let minWidthConstraint = view.widthAnchor.constraint(greaterThanOrEqualToConstant: 100)
minWidthConstraint.priority = .required  // 1000

NSLayoutConstraint.activate([widthConstraint, minWidthConstraint])
```

### Priority Values

| Priority | Value | Use Case |
|----------|-------|----------|
| `.required` | 1000 | Must satisfy |
| `.defaultHigh` | 750 | Preferred |
| `.defaultLow` | 250 | Optional |
| `.fittingSizeLevel` | 50 | Intrinsic content |

## Content Hugging & Compression Resistance

```swift
// Content Hugging: Resist growing
label.setContentHuggingPriority(.defaultHigh, for: .horizontal)

// Compression Resistance: Resist shrinking
label.setContentCompressionResistancePriority(.required, for: .horizontal)
```

### Common Patterns

| Scenario | Solution |
|----------|----------|
| Label truncating | Increase compression resistance |
| View expanding unnecessarily | Increase content hugging |
| Two labels, one should truncate | Lower priority for truncating one |

## Dynamic Constraints

```swift
private var widthConstraint: NSLayoutConstraint?

func updateWidth(_ width: CGFloat) {
    widthConstraint?.isActive = false
    widthConstraint = view.widthAnchor.constraint(equalToConstant: width)
    widthConstraint?.isActive = true
}
```

### Animating Constraint Changes

```swift
widthConstraint?.constant = 200
UIView.animate(withDuration: 0.3) {
    self.view.layoutIfNeeded()
}
```

## Layout Margins

```swift
// Use layout margins guide
view.leadingAnchor.constraint(equalTo: parentView.layoutMarginsGuide.leadingAnchor)

// Custom margins
parentView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 20, leading: 20, bottom: 20, trailing: 20)
```

## Debugging

### Identify Ambiguous Layout

```swift
// In lldb
po view.hasAmbiguousLayout
po view.exerciseAmbiguityInLayout()
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Missing constraint | Add missing anchor |
| Conflicting constraints | Lower priority or remove |
| Ambiguous layout | Add width/height constraint |
| `translatesAutoresizingMaskIntoConstraints` | Set to `false` |

## Best Practices

1. Always set `translatesAutoresizingMaskIntoConstraints = false`
2. Use `NSLayoutConstraint.activate()` for batch activation
3. Store references to constraints you'll modify
4. Use layout guides for safe area and margins
5. Set appropriate priorities for flexible layouts
