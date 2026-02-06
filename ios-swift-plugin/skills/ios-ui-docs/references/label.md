# UILabel Best Practices

> Last updated: 2025-01 | iOS 15+

## 基础设置

```swift
let label = UILabel()
label.text = "Hello"
label.font = .systemFont(ofSize: 16, weight: .regular)
label.textColor = .label
label.textAlignment = .left
label.numberOfLines = 0  // 多行
```

## 自定义字体

```swift
// 系统字体
label.font = .systemFont(ofSize: 16, weight: .medium)
label.font = .boldSystemFont(ofSize: 16)

// 自定义字体
label.font = UIFont(name: "Poppins-Medium", size: 16)

// 扩展方式
label.font = .poppinsFont(ofSize: 16, weight: .medium)
```

## 富文本

```swift
let attributedString = NSMutableAttributedString(string: "Hello World")

// 部分样式
attributedString.addAttribute(.foregroundColor, value: UIColor.red, range: NSRange(location: 0, length: 5))
attributedString.addAttribute(.font, value: UIFont.boldSystemFont(ofSize: 16), range: NSRange(location: 0, length: 5))

label.attributedText = attributedString
```

## 行间距

```swift
let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.lineSpacing = 4

let attributedString = NSAttributedString(
    string: "Multi-line text",
    attributes: [.paragraphStyle: paragraphStyle]
)
label.attributedText = attributedString
```

## 自动调整字体大小

```swift
label.adjustsFontSizeToFitWidth = true
label.minimumScaleFactor = 0.5
```

## Dynamic Type 支持

```swift
label.font = UIFont.preferredFont(forTextStyle: .body)
label.adjustsFontForContentSizeCategory = true
```

---

> 📝 **Note**: 如需更多详细信息，使用 `apple-docs` MCP 查询并更新此文件。
