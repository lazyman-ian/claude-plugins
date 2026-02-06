# iOS Widget Developer

Expert guidance for iOS WidgetKit development with comprehensive best practices.

## Installation

This skill is already installed at `~/.claude/skills/ios-widget-developer/`

## Usage

The skill will automatically activate when you ask about widget-related topics:

### English Triggers

- "create a widget"
- "implement widget"
- "timeline provider"
- "Live Activity"
- "widget refresh"
- "app intent widget"
- "dynamic island"

### Chinese Triggers

- "创建小组件"
- "实时活动"
- "桌面组件开发"
- "widget 开发"

### Manual Invocation

```bash
/ios-widget-developer
```

## What's Included

### Main Guide (SKILL.md)

- Widget structure basics
- Timeline Provider patterns
- Size classes handling
- App Intent integration (iOS 16+)
- Live Activities (iOS 16.1+)
- Data sharing via App Groups
- Performance best practices
- Debugging techniques

### References

1. **references/timeline.md** - Advanced timeline patterns
   - Fixed interval updates
   - Time-specific updates
   - Event-based updates
   - Background URL sessions
   - Conditional timelines
   - Intent configuration
   - Error handling
   - Memory optimization

2. **references/live-activity.md** - Live Activities deep dive
   - Activity attributes structure
   - Starting/updating/ending activities
   - Push notification integration
   - Dynamic Island configuration
   - Activity management
   - Best practices
   - Testing patterns

### Examples

1. **examples/basic-widget.swift** - Complete basic widget
   - WeatherWidget with all size classes
   - Timeline provider implementation
   - SwiftUI views for each size
   - Preview support

2. **examples/live-activity-example.swift** - Live Activity example
   - Pizza delivery tracking
   - Activity manager pattern
   - Dynamic Island UI
   - Lock screen views
   - Progress tracking

## Quick Start

### Create a Basic Widget

```
Ask: "Help me create a weather widget with small, medium, and large sizes"
```

### Add Live Activity

```
Ask: "Implement a Live Activity for delivery tracking"
```

### Debug Widget Issues

```
Ask: "My widget isn't updating, how do I debug this?"
```

## Features

- ✅ WidgetKit fundamentals
- ✅ Timeline Provider patterns
- ✅ All widget sizes (small, medium, large, extra large)
- ✅ App Intent integration for interactive widgets (iOS 16+)
- ✅ Live Activities with Dynamic Island (iOS 16.1+)
- ✅ Data sharing via App Groups
- ✅ Background refresh strategies
- ✅ Performance optimization
- ✅ Debugging workflows
- ✅ Complete code examples
- ✅ Chinese language support

## Tools Available

- Read, Write, Edit - File operations
- Glob, Grep - Code search
- Bash - Terminal commands
- mcp__apple-docs__* - Apple documentation lookup

## Tips

1. **Progressive Loading**: The skill loads only what you need
   - Main guide loads automatically
   - Reference files load on demand
   - Examples load when requested

2. **Best Practices First**: The skill prioritizes current best practices
   - iOS 16+ features (App Intents)
   - iOS 16.1+ features (Live Activities)
   - SwiftUI-first approach

3. **Complete Examples**: All examples are production-ready
   - Error handling included
   - Memory optimization considered
   - Testing patterns included

## Related Skills

- `/ios-build-test` - Build and test iOS projects
- `/ios-ui-docs` - UIKit documentation
- `/swiftui-ui-patterns` - SwiftUI component patterns
- `/ios-debugger-agent` - iOS simulator debugging

## Resources

- [WidgetKit Documentation](https://developer.apple.com/documentation/widgetkit)
- [Live Activities Documentation](https://developer.apple.com/documentation/activitykit)
- [App Intents Documentation](https://developer.apple.com/documentation/appintents)

## Contributing

To improve this skill:

1. Edit `SKILL.md` for main content (keep < 500 lines)
2. Add to `references/` for detailed documentation
3. Add to `examples/` for complete code samples
4. Update triggers in `~/.claude/skills/skill-rules.json`

## Version

1.0.0 - Initial release (January 2026)

## Author

Created by Claude Code users for the community
