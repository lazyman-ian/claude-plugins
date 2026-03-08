---
name: figma-to-code
description: >-
  Converts Figma designs to platform-specific code by extracting design tokens, component
  specs, and assets from Figma files using the official Figma MCP. This skill should be used when
  implementing UI from Figma designs, extracting design tokens, or converting design specs
  to SwiftUI, Compose, or React components.
  Triggers on "implement from figma", "figma to code", "convert figma", "build from design",
  "figma design", "extract from figma", "Figma转代码", "按Figma实现", "设计稿转代码",
  "设计稿转码", "UI实现", "设计还原".
  Do NOT use for creating designs — only converting existing Figma designs to code.
model: sonnet
context: fork
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__figma__get_design_context
  - mcp__figma__get_screenshot
  - mcp__figma__get_metadata
  - mcp__figma__get_variable_defs
  - mcp__plugin_dev-flow_dev-flow__dev_config
  - mcp__plugin_dev-flow_dev-flow__dev_memory
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
URL: https://www.figma.com/design/ABC123/MyApp?node-id=1234-5678
  → fileKey: ABC123
  → nodeId:  1234:5678 (convert "-" to ":" in nodeId)
```

Branch URLs: `figma.com/design/:fileKey/branch/:branchKey/:name` → use `branchKey` as fileKey.

If no `node-id` param, use `get_metadata(fileKey)` to list top-level frames, then ask user to specify.

### Step 2: Fetch Design Data

Use `get_design_context` as the primary tool — it returns code, a screenshot, and contextual hints:

```
get_design_context(fileKey, nodeId)
→ Returns: code (React+Tailwind reference), screenshot, layout structure, design annotations
```

**Interpret the response** based on what the user's Figma setup provides:

| Response Contains | Action |
|-------------------|--------|
| Code Connect snippets | Use the mapped codebase component directly |
| Component documentation links | Follow them for usage context |
| Design annotations | Follow designer notes and constraints |
| Design tokens as CSS variables | Map to the project's token system |
| Raw hex colors / absolute positioning | Design is loosely structured; use screenshot as supplement |

**Large designs**: `get_design_context` may return sparse metadata with "design was too large". Call `get_design_context` on sublayer node IDs to get detailed specs — the top-level response includes child frame IDs to drill into.

**Coordinate-derived specs**: Figma returns absolute x/y/width/height, not CSS properties. Compute CSS values:
- `gap` = child2.x - (child1.x + child1.width) for horizontal siblings
- `padding-left` = first-child.x - parent.x
- `font-size`, `color` etc. come from text node properties, not coordinates

**Supplement with variables**: If the design uses Figma Variables (design tokens), fetch them:
```
get_variable_defs(fileKey)
→ Returns: color tokens, spacing tokens, typography scales
```

### Step 3: Detect Target Platform

```
dev_config() → platform (ios | android | web | monorepo)
```

If monorepo or ambiguous, ask user which platform to target.

### Step 4: Extract Design Tokens

From the `get_design_context` response, extract into a **spec object** (aligned with `ui-verify` format):

```json
{
  "selectors": {
    ".hero-title": {
      "font-size": "37px",
      "line-height": "47px",
      "font-weight": "600",
      "color": "#000000"
    },
    ".layout": {
      "gap": "103px",
      "padding": "40px 71px"
    }
  }
}
```

Map to platform tokens:

| Token | Figma Source | iOS | Android | Web |
|-------|-------------|-----|---------|-----|
| Colors | fills, CSS variables | `Color` ext | `Color()` | CSS var / hex |
| Spacing | padding, gap, itemSpacing | CGFloat const | `dp` | px / rem |
| Typography | fontSize, fontFamily, fontWeight | `Font` ext | `Typography` | CSS classes |
| Corner radius | borderRadius | `.cornerRadius()` | `RoundedCornerShape` | `border-radius` |
| Shadows | effects (DROP_SHADOW) | `.shadow()` | `elevation` | `box-shadow` |

### Step 5: Handle Assets

For image fills and vector icons, use `get_screenshot` to capture specific nodes:

```
get_screenshot(fileKey, nodeId, format="png", scale=2)
→ Captures the node as a raster image at specified scale
```

**Rules**:
- Photo/raster content → `get_screenshot` at 2x scale, save as PNG
- Vector icons → prefer using icon library names (FontAwesome, SF Symbols, Material Icons) identified from Figma layer names, rather than exporting rasters
- Name files with kebab-case matching the Figma layer name

**Icon identification**: Figma icon layer names often encode the icon library reference (e.g., `clock-rotate-left-sharp-solid 1` → FontAwesome `clock-rotate-left`). Strip variant suffixes and trailing numbers to get the icon identifier.

Asset destination per platform:

| Platform | Directory |
|----------|-----------|
| iOS | `Assets.xcassets/` or project images dir |
| Android | `res/drawable-xxhdpi/` |
| Web | `public/images/` or `src/assets/` |

### Step 6: Generate Platform Code

The code from `get_design_context` is React+Tailwind — treat it as a **reference**, not final code. Always adapt to the target project's stack, components, and conventions.

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

**Reuse check**: Before generating new components, search the project for existing components that match the design intent. Reuse what exists.

### Step 7: UI Verification

After generating code, invoke `ui-verify` skill for measurement-driven design fidelity check:

```
Skill("ui-verify")
→ Input: Figma URL (from Step 1) + live page URL (dev server)
→ Extracts specs from Figma, measures rendered CSS, computes deltas, auto-corrects
```

If no dev server is available, fall back to manual review:
1. Verify all visible Figma layers have corresponding code
2. Check color values match exactly (hex comparison)
3. Confirm spacing/sizing values are not approximated
4. Validate asset files exist at expected paths

## Memory Integration

```
dev_memory(action:'query', query:'{platform} figma ui patterns')
```

After generating code, save novel patterns:
```
dev_memory(action:'save', text:'...', tags:'figma,{platform},ui')
```
