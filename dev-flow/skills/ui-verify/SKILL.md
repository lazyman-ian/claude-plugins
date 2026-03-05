---
name: ui-verify
description: >-
  Verifies UI implementation accuracy against Figma designs using numerical measurement,
  not visual guessing. Extracts structured specs from Figma MCP (get_design_context),
  measures actual rendered CSS values via Playwright MCP (page.evaluate + getComputedStyle),
  computes pixel deltas, and auto-corrects discrepancies. This is the quality gate for
  design fidelity — use it after implementing any UI from a Figma design.
  Triggers on "verify ui", "check design", "ui verify", "design match", "pixel check",
  "measure ui", "compare with figma", "design fidelity", "UI还原验证", "设计还原检查",
  "对比Figma", "测量UI", "像素对比".
  Do NOT use for build/lint/test verification — use "verify" skill instead.
  Do NOT use for generating code from Figma — use "figma-to-code" skill instead.
model: opus
context: fork
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
  - mcp__figma__get_design_context
  - mcp__figma__get_screenshot
  - mcp__figma__get_metadata
  - mcp__plugin_playwright_playwright__browser_navigate
  - mcp__plugin_playwright_playwright__browser_evaluate
  - mcp__plugin_playwright_playwright__browser_resize
  - mcp__plugin_playwright_playwright__browser_take_screenshot
  - mcp__plugin_playwright_playwright__browser_wait_for
  - mcp__plugin_playwright_playwright__browser_snapshot
  - mcp__plugin_playwright_playwright__browser_close
  - mcp__plugin_dev-flow_dev-flow__dev_config
---

# UI Verify — Measurement-Driven Design Fidelity

Verify UI implementations match Figma designs by **measuring actual rendered values**, not eyeballing screenshots. The core insight: spatial reasoning through visual comparison is unreliable for AI — numerical delta comparison is deterministic and precise.

## When to Use

- After `figma-to-code` generates UI code, as the verification step
- After manual UI implementation from a Figma design
- When user says "this doesn't match the design" and provides a Figma URL
- Inside `implement-plan` for phases with `ui-task` type and Figma references

## Input

One of:
- Figma URL + live page URL
- Figma URL + component file path (will use dev server)
- Just a live page URL (if Figma specs were already extracted in current session)

## Three-Step Loop

The workflow is a mechanical, measurement-driven correction process that removes aesthetic judgment:

```
EXTRACT specs → MEASURE rendered → COMPARE deltas → FIX → re-MEASURE
```

### Step 1: Extract Specs from Figma

Use `get_design_context` (not `get_screenshot`) to obtain structured data:

```
get_design_context(fileKey, nodeId)
→ Returns: layout structure, spacing, typography, colors, component hierarchy
```

Parse the response into a **spec object** — a flat list of measurable properties:

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
    },
    ".feature-icon-wrap": {
      "width": "44px",
      "height": "44px",
      "border-radius": "50%"
    }
  }
}
```

If `get_design_context` returns Code Connect mappings or design annotations, use those as additional context for which existing components to reuse.

**Large designs**: `get_design_context` may return sparse metadata with a message "design was too large". In this case, call `get_design_context` on sublayer node IDs to get detailed specs. The top-level response includes child frame IDs you can drill into.

**Coordinate-derived specs**: Figma returns absolute x/y/width/height, not CSS properties. You need to compute CSS values from coordinates:
- `gap` = child2.x - (child1.x + child1.width) for horizontal siblings
- `padding-left` = first-child.x - parent.x
- `font-size`, `color`, etc. are not in coordinate data — query sublayer `get_design_context` or use `get_screenshot` for those

**Fallback**: If Figma MCP returns insufficient structured data (e.g., design file lacks Auto Layout or Variables), fall back to `get_screenshot` + manual spec extraction from the image. Note this is less reliable — flag it to the user.

### Step 2: Measure Rendered Values

Navigate to the page with Playwright MCP, then use `browser_evaluate` to extract computed styles:

```javascript
// Pass this to browser_evaluate
(() => {
  const specs = {
    '.hero-title': ['fontSize', 'lineHeight', 'fontWeight', 'color'],
    '.layout': ['gap', 'paddingTop', 'paddingLeft'],
    '.feature-icon-wrap': ['width', 'height', 'borderRadius'],
  }
  const results = {}
  for (const [selector, props] of Object.entries(specs)) {
    const el = document.querySelector(selector)
    if (!el) { results[selector] = { error: 'not found' }; continue }
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    results[selector] = {}
    for (const prop of props) {
      results[selector][prop] = cs[prop]
    }
    results[selector]._rect = {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      x: Math.round(rect.x),
      y: Math.round(rect.y)
    }
  }
  return results
})()
```

**Viewport**: Always set `browser_resize(1440, 900)` first for desktop, or the appropriate breakpoint. Measurement without consistent viewport is meaningless.

**Wait**: Use `browser_wait_for` to ensure fonts and images are loaded before measuring. Font loading can shift layout metrics significantly.

**`gap` property pitfall**: `getComputedStyle().gap` often returns `"normal"` for flex containers even when `gap` is explicitly set in CSS. Always measure visual gap via bounding rects as fallback:
```javascript
const visualGap = child2.getBoundingClientRect().left - child1.getBoundingClientRect().right
```
This is more reliable than `getComputedStyle` for spatial properties.

### Step 2b: Verify Icon Identity

`getComputedStyle` cannot tell you *which* icon is rendered — only its size and color. For pages with icons (FontAwesome, Material Icons, etc.), add a separate icon verification pass:

```javascript
// Pass this to browser_evaluate
(() => {
  const iconSelectors = document.querySelectorAll('.feature-icon, [data-icon]')
  return Array.from(iconSelectors).map(el => {
    const svg = el.tagName === 'svg' ? el : el.querySelector('svg')
    if (!svg) return { selector: el.className, error: 'no svg found' }
    return {
      selector: el.closest('[class]')?.className || '',
      icon: svg.getAttribute('data-icon'),
      prefix: svg.getAttribute('data-prefix'),
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
    }
  })
})()
```

Compare the `data-icon` values against Figma's icon component names. Figma names like `clock-rotate-left-sharp-solid 1` map to FontAwesome `clock-rotate-left` (strip variant suffix + trailing number).

**Why this matters**: Icon mismatches are invisible to CSS measurement — a `chart-line-up` (line chart) and `chart-mixed` (bar+line chart) have identical computed styles but look completely different.

### Step 3: Compare and Report Deltas

Produce a delta report — the diff between spec and actual:

```
UI Verification Report
======================
Page: http://localhost:8200/user/join
Viewport: 1440x900

.hero-title
  font-size:   spec 37px  → actual 37px  ✅
  line-height: spec 47px  → actual 47px  ✅
  color:       spec #000  → actual #000  ✅

.layout
  gap:         spec 103px → actual 40px  ❌ delta: -63px
  padding-left: spec 71px → actual 70px  ⚠️ delta: -1px

.feature-icon-wrap
  width:       spec 44px  → actual 50px  ❌ delta: +6px

Icons:
  .feature-icon[0]: spec clock-rotate-left → actual clock-rotate-left  ✅
  .feature-icon[2]: spec chart-mixed       → actual chart-line-up      ❌ wrong icon

Summary: 3 ✅ passed, 2 ❌ failed, 1 ⚠️ close (≤2px), 1 ❌ icon mismatch
```

**Thresholds**:
- `delta == 0` → ✅ pass
- `|delta| <= 2px` → ⚠️ close (acceptable, note but don't fix)
- `|delta| > 2px` → ❌ fail (must fix)

For colors, compare as hex (case-insensitive). `rgb()` values from `getComputedStyle` need conversion.

**Intentional deviations**: Some spec mismatches are deliberate (e.g., user adjusted icon size from 50px to 44px during iteration). When reporting ❌ failures, check with the user before auto-fixing — the deviation may be intentional. Mark as `❌ (intentional)` if user confirms.

### Step 4: Auto-Correct Failures

For each ❌ failure:
1. Locate the CSS rule in the source file
2. Apply the spec value directly (no guessing)
3. Re-measure to confirm the fix

```
Fix applied: .layout { gap: 40px → 103px }
Re-measure: gap = 103px ✅
```

Stop after all deltas are ✅ or ⚠️.

### Step 5: Screenshot Confirmation

After all deltas pass, take a final screenshot for the user to visually confirm the overall result:

```
browser_take_screenshot()
→ "All measurements pass. Here's the final render for visual confirmation."
```

This screenshot is for human sign-off only — not for the AI to evaluate design match.

## Common Pitfalls

See `references/pitfalls.md` for detailed solutions. Key ones:

| Pitfall | Solution |
|---------|----------|
| Font not loaded when measuring | `browser_wait_for` with font-loading check |
| `getComputedStyle` returns `rgb()` not hex | Convert before comparing |
| Viewport not set | Always `browser_resize` first |
| Element not visible (v-show, opacity) | Check visibility before measuring |
| Dynamic content shifts layout | Wait for hydration / data load |
| Icon identity invisible to CSS | Read `svg[data-icon]` attribute (Step 2b) |
| Image/asset content not verifiable by CSS | Check `img.src` or `background-image` URL |

## Integration with Other Skills

| Trigger | Flow |
|---------|------|
| After `figma-to-code` | `figma-to-code` → `ui-verify` (manual trigger) |
| Inside `implement-plan` | Phase with `ui-task` + `figma` field → auto-invoke after code generation |
| Standalone | User provides Figma URL + page URL |

## Output

The skill outputs:
1. **Delta report** (structured text) — pass/fail for each measured property
2. **Fix list** — CSS changes applied with before/after values
3. **Final screenshot** — for human visual confirmation
