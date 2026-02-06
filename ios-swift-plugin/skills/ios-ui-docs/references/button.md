# UIButton Best Practices

> Last updated: 2025-01 | iOS 15+

## 推荐方式：UIButton.Configuration

### 基础配置

```swift
// 预置样式
var config = UIButton.Configuration.plain()    // 透明背景
var config = UIButton.Configuration.filled()   // 填充背景
var config = UIButton.Configuration.tinted()   // 淡色背景
var config = UIButton.Configuration.gray()     // 灰色背景

let button = UIButton(configuration: config)
```

### 自定义样式

```swift
var config = UIButton.Configuration.plain()

// 圆角
config.cornerStyle = .fixed
config.background.cornerRadius = 8

// 边框
config.background.strokeColor = .systemGray
config.background.strokeWidth = 1

// 内边距
config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)

// 图标
config.image = UIImage(systemName: "chevron.down")
config.imagePlacement = .trailing  // .leading, .top, .bottom
config.imagePadding = 8
```

### 状态管理 (核心)

```swift
button.configurationUpdateHandler = { button in
    var config = button.configuration
    let isSelected = button.isSelected

    // 背景
    config?.background.backgroundColor = isSelected ? .systemBlue : .clear
    config?.background.strokeWidth = isSelected ? 0 : 1

    // 前景色
    config?.baseForegroundColor = isSelected ? .white : .label

    // 标题 (动态)
    var attr = AttributeContainer()
    attr.font = .systemFont(ofSize: 14, weight: .medium)
    config?.attributedTitle = AttributedString("Title", attributes: attr)

    // 图标颜色
    config?.imageColorTransformer = UIConfigurationColorTransformer { _ in
        isSelected ? .white : .systemGray
    }

    button.configuration = config
}

// 切换状态
button.isSelected = true  // 自动触发 handler
button.setNeedsUpdateConfiguration()  // 手动触发
```

## 配置对照表

| Legacy API | Configuration API |
|------------|-------------------|
| `setTitle(_:for:)` | `config.title` / `config.attributedTitle` |
| `setTitleColor(_:for:)` | `config.baseForegroundColor` |
| `setImage(_:for:)` | `config.image` |
| `backgroundColor` | `config.background.backgroundColor` |
| `layer.cornerRadius` | `config.background.cornerRadius` |
| `layer.borderWidth` | `config.background.strokeWidth` |
| `layer.borderColor` | `config.background.strokeColor` |
| `contentEdgeInsets` | `config.contentInsets` |
| `imageEdgeInsets` | `config.imagePadding` + `imagePlacement` |

## 完整示例：选中态按钮

```swift
private lazy var sortButton: UIButton = {
    var config = UIButton.Configuration.plain()
    config.cornerStyle = .fixed
    config.background.cornerRadius = 8
    config.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10)
    config.imagePlacement = .trailing
    config.imagePadding = 8

    let button = UIButton(configuration: config)
    button.configurationUpdateHandler = { [weak self] button in
        var config = button.configuration
        let isSelected = button.isSelected

        if isSelected {
            config?.background.backgroundColor = .cyanStrong
            config?.background.strokeWidth = 0
            config?.baseForegroundColor = .white
        } else {
            config?.background.backgroundColor = .clear
            config?.background.strokeColor = .grayDark.withAlphaComponent(0.5)
            config?.background.strokeWidth = 1
            config?.baseForegroundColor = .customBlack
        }

        var titleAttr = AttributeContainer()
        titleAttr.font = .poppinsFont(ofSize: 14, weight: .medium)
        config?.attributedTitle = AttributedString(
            self?.currentTitle ?? "Select",
            attributes: titleAttr
        )

        let symbolConfig = UIImage.SymbolConfiguration(pointSize: 8, weight: .semibold)
        config?.image = UIImage(systemName: "chevron.down", withConfiguration: symbolConfig)
        config?.imageColorTransformer = UIConfigurationColorTransformer { _ in
            isSelected ? .white : .grayGray
        }

        button.configuration = config
    }

    return button
}()
```

## 注意事项

1. **configurationUpdateHandler 会频繁调用** - 避免重计算
2. **使用 isSelected 而非自定义状态变量** - 自动触发更新
3. **setNeedsUpdateConfiguration()** - 数据变化时手动触发
