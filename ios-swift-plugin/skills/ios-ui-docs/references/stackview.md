# UIStackView Reference

## Basic Setup

```swift
let stackView = UIStackView(arrangedSubviews: [view1, view2, view3])
stackView.axis = .vertical
stackView.spacing = 16
stackView.alignment = .fill
stackView.distribution = .fill
stackView.translatesAutoresizingMaskIntoConstraints = false
```

## Axis

```swift
stackView.axis = .vertical    // Top to bottom
stackView.axis = .horizontal  // Leading to trailing
```

## Distribution

| Distribution | Behavior |
|--------------|----------|
| `.fill` | Views fill available space (respects priorities) |
| `.fillEqually` | All views same size |
| `.fillProportionally` | Size based on intrinsic content |
| `.equalSpacing` | Equal spacing between views |
| `.equalCentering` | Equal distance between centers |

```swift
// Equal size views
stackView.distribution = .fillEqually

// Equal spacing
stackView.distribution = .equalSpacing
```

## Alignment

### Vertical Stack

| Alignment | Behavior |
|-----------|----------|
| `.fill` | Views fill width |
| `.leading` | Align to leading edge |
| `.trailing` | Align to trailing edge |
| `.center` | Center horizontally |

### Horizontal Stack

| Alignment | Behavior |
|-----------|----------|
| `.fill` | Views fill height |
| `.top` | Align to top |
| `.bottom` | Align to bottom |
| `.center` | Center vertically |
| `.firstBaseline` | Align text baselines (top) |
| `.lastBaseline` | Align text baselines (bottom) |

## Spacing

```swift
// Uniform spacing
stackView.spacing = 16

// Custom spacing after specific view (iOS 11+)
stackView.setCustomSpacing(32, after: headerView)
```

## Layout Margins

```swift
stackView.isLayoutMarginsRelativeArrangement = true
stackView.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)

// Or directional
stackView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16)
```

## Adding/Removing Views

```swift
// Add
stackView.addArrangedSubview(newView)
stackView.insertArrangedSubview(newView, at: 0)

// Remove (keeps in view hierarchy)
stackView.removeArrangedSubview(view)

// Remove completely
view.removeFromSuperview()

// Hide (preserves space: false, removes space: true)
view.isHidden = true  // Removes from layout
```

## Nested Stacks Pattern

```swift
// Horizontal row with label and value
func createRow(label: String, value: String) -> UIStackView {
    let labelView = UILabel()
    labelView.text = label

    let valueView = UILabel()
    valueView.text = value
    valueView.textAlignment = .right

    let row = UIStackView(arrangedSubviews: [labelView, valueView])
    row.axis = .horizontal
    row.distribution = .fill

    // Label hugs content, value expands
    labelView.setContentHuggingPriority(.defaultHigh, for: .horizontal)

    return row
}

// Vertical container
let container = UIStackView()
container.axis = .vertical
container.spacing = 8
container.addArrangedSubview(createRow(label: "Name", value: "John"))
container.addArrangedSubview(createRow(label: "Email", value: "john@example.com"))
```

## Animation

```swift
UIView.animate(withDuration: 0.3) {
    self.detailsView.isHidden = !self.detailsView.isHidden
    self.stackView.layoutIfNeeded()
}
```

## Common Patterns

### Form Layout

```swift
let form = UIStackView()
form.axis = .vertical
form.spacing = 16
form.addArrangedSubview(usernameField)
form.addArrangedSubview(passwordField)
form.addArrangedSubview(loginButton)
```

### Card with Content

```swift
let card = UIStackView()
card.axis = .vertical
card.spacing = 12
card.isLayoutMarginsRelativeArrangement = true
card.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
card.backgroundColor = .secondarySystemBackground
card.layer.cornerRadius = 12
```

### Toolbar

```swift
let toolbar = UIStackView()
toolbar.axis = .horizontal
toolbar.distribution = .equalSpacing
toolbar.addArrangedSubview(backButton)
toolbar.addArrangedSubview(titleLabel)
toolbar.addArrangedSubview(menuButton)
```

## Performance Tips

| Issue | Solution |
|-------|----------|
| Complex nested stacks | Consider compositional layout |
| Frequent updates | Batch changes in animation block |
| Many subviews | Use table/collection view instead |
| Layout thrashing | Cache stack configurations |
