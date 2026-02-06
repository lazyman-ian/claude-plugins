# Simulator Workflow Guide

XcodeBuildMCP integration for simulator control.

## Core Workflow

```
1. Discover Simulator → 2. Set Defaults → 3. Build & Run → 4. Interact → 5. Capture Logs
```

## Step 1: Discover Booted Simulator

```
mcp__XcodeBuildMCP__list_sims
```

Response includes:
- `deviceId` (UDID)
- `name` (e.g., "iPhone 16 Pro")
- `state` (Booted/Shutdown)

## Step 2: Set Session Defaults

```
mcp__XcodeBuildMCP__session-set-defaults({
  projectPath: "/path/to/Project.xcodeproj",
  scheme: "MyApp",
  simulatorId: "<UDID from step 1>"
})
```

## Step 3: Build & Run

**Full build + run:**
```
mcp__XcodeBuildMCP__build_run_sim
```

**Launch existing app:**
```
mcp__XcodeBuildMCP__launch_app_sim({
  bundleId: "com.example.MyApp"
})
```

**Get bundle ID if unknown:**
```
mcp__XcodeBuildMCP__get_sim_app_path
mcp__XcodeBuildMCP__get_app_bundle_id({ appPath: "<path>" })
```

## Step 4: UI Interaction

### Describe UI First
```
mcp__XcodeBuildMCP__describe_ui
```

Returns accessibility tree with:
- Element types (Button, TextField, etc.)
- Labels and identifiers
- Coordinates

### Tap Element
```
mcp__XcodeBuildMCP__tap({ id: "loginButton" })
mcp__XcodeBuildMCP__tap({ label: "Sign In" })
mcp__XcodeBuildMCP__tap({ x: 200, y: 400 })  # Coordinates fallback
```

### Type Text
```
mcp__XcodeBuildMCP__type_text({ text: "username@example.com" })
```

### Gestures
```
mcp__XcodeBuildMCP__gesture({ type: "swipe", direction: "up" })
mcp__XcodeBuildMCP__gesture({ type: "scroll", direction: "down" })
```

### Screenshot
```
mcp__XcodeBuildMCP__screenshot
```

## Step 5: Log Capture

**Start capture:**
```
mcp__XcodeBuildMCP__start_sim_log_cap({ bundleId: "com.example.MyApp" })
```

**Stop and retrieve:**
```
mcp__XcodeBuildMCP__stop_sim_log_cap
```

## Common Issues

| Issue | Solution |
|-------|----------|
| No booted simulator | `xcrun simctl boot "iPhone 16 Pro"` |
| Build fails | Try `preferXcodebuild: true` in build call |
| UI not responding | Wait for app launch, call `describe_ui` first |
| Wrong simulator | Re-run `list_sims`, update `session-set-defaults` |

## Best Practices

1. Always `describe_ui` before tapping
2. Prefer `id` or `label` over coordinates
3. Use `screenshot` to verify UI state
4. Filter logs by bundle ID to reduce noise
5. Stop log capture when done to free resources
