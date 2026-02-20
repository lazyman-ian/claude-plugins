---
name: figma-to-code
description: >-
  Converts Figma designs to platform-specific code by extracting design tokens, component
  specs, and assets from Figma files using the Framelink MCP. This skill should be used when
  implementing UI from Figma designs, extracting design tokens, or converting design specs
  to SwiftUI, Compose, or React components.
  Triggers on "implement from figma", "figma to code", "convert figma", "build from design",
  "figma design", "extract from figma", "Figma转代码", "按Figma实现", "设计稿转代码".
  Do NOT use for creating designs — only converting existing Figma designs to code.
model: sonnet
context: fork
memory: project
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, mcp__Framelink_MCP_for_Figma__get_figma_data, mcp__Framelink_MCP_for_Figma__download_figma_images, mcp__plugin_dev-flow_dev-flow__dev_config, mcp__plugin_dev-flow_dev-flow__dev_memory]
---

# Figma to Code

Convert Figma designs into platform-specific UI code with design tokens and assets.

## When to Use

- Implementing UI screens/components from a Figma design file
- Extracting design tokens (colors, spacing, typography, shadows) into code
- Exporting image/icon assets from Figma for a project
- Converting a Figma component to SwiftUI, Jetpack Compose, or React

## Input

User provides a Figma URL in one of these formats:

```
https://www.figma.com/design/<fileKey>/<name>
https://www.figma.com/design/<fileKey>/<name>?node-id=<nodeId>
https://www.figma.com/file/<fileKey>/...
```

## Workflow

### Step 1: Parse Figma URL

Extract `fileKey` and optional `nodeId` from the URL.

```
URL: https://www.figma.com/design/ABC123/MyApp?node-id=1234:5678
  → fileKey: ABC123
  → nodeId:  1234:5678 (convert hyphen to colon if needed)
```

If no `node-id` param, fetch the full file and ask user to specify a frame/component.

### Step 2: Fetch Design Data

```
get_figma_data(fileKey, nodeId?)
```

Parse the response for: layout structure, fills, text styles, effects, component info.

### Step 3: Detect Target Platform

```
dev_config() → platform (ios | android | web | monorepo)
```

If monorepo or ambiguous, ask user which platform to target.

### Step 4: Extract Design Tokens

From the Figma node tree, extract:

| Token | Figma Source | Example |
|-------|-------------|---------|
| Colors | `fills[].color` (RGBA) | `#3B82F6`, `rgba(59,130,246,1)` |
| Spacing | `paddingLeft/Right/Top/Bottom`, `itemSpacing` | `16`, `8`, `24` |
| Typography | `style.fontSize`, `fontFamily`, `fontWeight`, `lineHeight` | `SF Pro 17/22 semibold` |
| Corner radius | `cornerRadius` | `12` |
| Shadows | `effects[].type == DROP_SHADOW` | `offset(0,4) blur(8) #00000026` |
| Border | `strokes[]`, `strokeWeight` | `1px solid #E5E7EB` |

### Step 5: Download Assets

For image fills and vector icons:

```
download_figma_images(fileKey, nodes=[
  { nodeId: "1234:5678", fileName: "icon-home.svg" },        // vectors → SVG
  { nodeId: "2345:6789", fileName: "hero-image.png",         // rasters → PNG
    imageRef: "abc123..." }
], localPath: "{project_assets_dir}")
```

**Rules**:
- Vector/icon nodes → SVG
- Photo/raster fills (has `imageRef`) → PNG at 2x scale
- Name files with kebab-case matching the Figma layer name

### Step 6: Generate Platform Code

See `references/platform-mapping.md` for detailed property mapping.

| Platform | Output |
|----------|--------|
| **iOS** | SwiftUI `View` structs + `Color`/`Font` extensions in a theme file |
| **Android** | `@Composable` functions + `Color`/`Typography` in theme values |
| **Web** | React functional components + CSS variables / Tailwind classes |

**Generation order**:
1. Design tokens (theme/constants file)
2. Reusable sub-components (bottom-up)
3. Main screen/view (composing sub-components)

### Step 7: Review

After generating code:
1. Verify all visible Figma layers have corresponding code
2. Check color values match exactly (hex comparison)
3. Confirm spacing/sizing values are not approximated
4. Validate asset files exist at expected paths

## Asset Handling

| Figma Node Type | Export Format | Scale |
|-----------------|---------------|-------|
| Vector (icon, logo) | SVG | 1x |
| Image fill (`imageRef`) | PNG | 2x |
| Complex illustration | PNG | 2x |

Asset destination per platform:

| Platform | Directory |
|----------|-----------|
| iOS | `Assets.xcassets/` or project images dir |
| Android | `res/drawable-xxhdpi/` |
| Web | `public/images/` or `src/assets/` |

## Memory Integration

```
dev_memory(action:'query', query:'{platform} figma ui patterns')
```

After generating code, save novel patterns:
```
dev_memory(action:'save', text:'...', tags:'figma,{platform},ui')
```
