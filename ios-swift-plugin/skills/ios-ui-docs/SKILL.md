---
name: ios-ui-docs
description: Provides iOS UIKit best practices, official documentation, and implementation patterns for UIKit components. This skill should be used when working with UIButton, UILabel, UITableView, UICollectionView, UIStackView, Auto Layout, or any UIKit-based UI component. Key capabilities include component reference lookup, diffable data source patterns, and compositional layout guidance. Triggers on "UIKit", "UIButton", "UILabel", "UITableView", "UICollectionView", "UIStackView", "Auto Layout", "UIViewController", "UINavigationController", "按钮", "布局", "列表", "UI 最佳实践", "iOS 组件". Do NOT use for SwiftUI views or patterns — use swiftui-expert instead. Do NOT use for general API search — use ios-api-helper instead.
allowed-tools: [mcp__apple-docs__choose_technology, mcp__apple-docs__search_symbols, mcp__apple-docs__get_documentation, Read, Write, Edit]
---

# iOS UI Documentation & Best Practices

## Available References

| Component | Reference | Status |
|-----------|-----------|--------|
| UIButton | `references/button.md` | ✅ Complete |
| UILabel | `references/label.md` | ✅ Complete |
| UITableView | `references/tableview.md` | ✅ Complete |
| UICollectionView | `references/collectionview.md` | ✅ Complete |
| Auto Layout | `references/autolayout.md` | ✅ Complete |
| UIStackView | `references/stackview.md` | ✅ Complete |

## Instructions

### 1. Check Reference First

Load the relevant reference file based on user's question.

### 2. If Reference Missing or Outdated

Query official documentation:

```
choose_technology { "name": "UIKit" }
search_symbols { "query": "UIButton configuration" }
get_documentation { "path": "/documentation/uikit/uibutton" }
```

### 3. Update Reference

After querying, update the reference file with new best practices:

```bash
Edit references/<component>.md
```

## Quick Lookup Commands

| Need | Command |
|------|---------|
| Search symbol | `search_symbols { "query": "keyword" }` |
| Get docs | `get_documentation { "path": "SymbolName" }` |
| Full class | `get_documentation { "path": "/documentation/uikit/uibutton" }` |

## When to Query API

- Reference marked as ⏳ TODO
- User asks about iOS 17+ new features
- Need specific method signature
- Uncertain about deprecation status
