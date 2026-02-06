---
name: ios-api-helper
description: Searches Apple documentation and suggests iOS/SwiftUI best practices during implementation. This skill should be used when user asks "how to implement X in iOS", "what's the API for X", "SwiftUI way to do X", or needs iOS implementation guidance. Triggers on "iOS API", "how to implement", "SwiftUI pattern", "Apple docs", "what API", "UIKit way", "iOS最佳实践", "如何实现", "什么API", "怎么做".
allowed-tools: [mcp__apple-docs__*, mcp__sosumi__*, Read, Glob, Grep]
---

# iOS API Helper

Guided iOS API lookup and best practice suggestions using Apple documentation.

## When to Use

- User asks "how do I implement X in iOS?"
- User needs to find the right API for a feature
- User wants SwiftUI/UIKit best practices
- Implementing new iOS features

## MCP Tools

Two documentation sources available:

| Source | Best For | Tools |
|--------|----------|-------|
| **apple-docs** | Symbol/API 精准查询 | `choose_technology`, `search_symbols`, `get_documentation` |
| **sosumi** | 完整页面、HIG 指南 | `searchAppleDocumentation`, `fetchAppleDocumentation` |

## Workflow

### 1. Understand Intent

Clarify what the user wants to implement:
- UI component? → Check SwiftUI/UIKit options
- System feature? → Find relevant framework
- Data handling? → Core Data, SwiftData, etc.
- Design guidelines? → Use sosumi for HIG

### 2. Search Apple Docs

**Option A: apple-docs (Symbol lookup)**
```
# Set technology context
mcp__apple-docs__choose_technology(name="SwiftUI")

# Search for relevant symbols
mcp__apple-docs__search_symbols(query="Picker")

# Get detailed documentation
mcp__apple-docs__get_documentation(path="Picker")
```

**Option B: sosumi (Full page / HIG)**
```
# Search documentation
mcp__sosumi__searchAppleDocumentation(query="SwiftUI Picker")

# Fetch full page as Markdown
mcp__sosumi__fetchAppleDocumentation(path="/documentation/swiftui/picker")
```

### 3. Choose the Right Tool

| Need | Use |
|------|-----|
| API signature, parameters | apple-docs |
| Full tutorial/guide | sosumi |
| Human Interface Guidelines | sosumi |
| Quick symbol lookup | apple-docs |
| Code examples in context | sosumi |

### 4. Show Examples

Extract code examples from documentation and adapt to user's context.

### 5. Suggest Pattern

Based on project conventions (check `.claude/docs/styles.md` if exists):
- Recommend SwiftUI-native approach first
- Fall back to UIKit if needed
- Consider iOS version compatibility

### 6. Validate

- Check against project's minimum iOS version
- Verify API availability
- Suggest alternatives if needed

## Common Lookups

| User Request | Technology | Symbol | Tool |
|--------------|------------|--------|------|
| "dropdown picker" | SwiftUI | Picker, Menu | apple-docs |
| "list with sections" | SwiftUI | List, Section | apple-docs |
| "pull to refresh" | SwiftUI | refreshable | apple-docs |
| "search bar" | SwiftUI | searchable | apple-docs |
| "bottom sheet" | SwiftUI | sheet, presentationDetents | apple-docs |
| "navigation" | SwiftUI | NavigationStack | apple-docs |
| "async image" | SwiftUI | AsyncImage | apple-docs |
| "app storage" | SwiftUI | AppStorage | apple-docs |
| "button styles HIG" | HIG | - | sosumi |
| "typography guidelines" | HIG | - | sosumi |
| "color system" | HIG | - | sosumi |

## Integration

Works with:
- `swiftui-expert` - For architecture guidance
- `ios-build-test` - To verify implementation
- Project `.claude/docs/sdk/*.md` - For project-specific patterns

## Example Session

**User**: "I need to add a dropdown picker for sorting options"

**Skill**:
1. Search: `mcp__apple-docs__search_symbols(query="Picker menu")`
2. Find: `Picker` with `.menu` style
3. Show documentation excerpt
4. Provide code example:

```swift
@State private var selectedSort: SortOption = .newest

Picker("Sort by", selection: $selectedSort) {
    ForEach(SortOption.allCases) { option in
        Text(option.title).tag(option)
    }
}
.pickerStyle(.menu)
```

5. Ask: "Want me to implement this in [detected file]?"

**User**: "What does HIG say about button placement?"

**Skill**:
1. Search: `mcp__sosumi__searchAppleDocumentation(query="button placement guidelines")`
2. Fetch: `mcp__sosumi__fetchAppleDocumentation(path="/design/human-interface-guidelines/buttons")`
3. Summarize key guidelines

## Notes

- Always check iOS version requirements
- Prefer SwiftUI-native solutions over UIKit bridges
- Reference project conventions from `.claude/docs/` if available
- Use sosumi for HIG and design guidelines
- Use apple-docs for precise API documentation
