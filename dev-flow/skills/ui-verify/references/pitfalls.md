# UI Verify Pitfalls

Common issues when measuring rendered UI against Figma specs and their solutions.

## Playwright Measurement Issues

### Font Loading Race Condition

**Problem**: `getComputedStyle` returns system font metrics before web fonts load, causing incorrect `fontSize`, `lineHeight`, and element dimensions.

**Solution**: Wait for fonts before measuring:
```javascript
await document.fonts.ready
```
Or check via `browser_evaluate`:
```javascript
document.fonts.check('16px "Poppins"') // returns true when loaded
```

### Color Format Mismatch

**Problem**: Figma gives hex (`#28A3B3`), `getComputedStyle` returns `rgb(40, 163, 179)`.

**Solution**: Convert rgb to hex before comparing:
```javascript
function rgbToHex(rgb) {
  const match = rgb.match(/\d+/g)
  if (!match) return rgb
  return '#' + match.slice(0, 3).map(n =>
    parseInt(n).toString(16).padStart(2, '0')
  ).join('')
}
```

For `rgba` with opacity < 1, compare both color and opacity separately.

### Viewport Not Set

**Problem**: Measurements at wrong viewport produce different layout (responsive breakpoints, flex wrap, sticky positioning).

**Solution**: Always set viewport first:
- Desktop: `browser_resize(1440, 900)` (standard)
- Tablet: `browser_resize(768, 1024)`
- Mobile: `browser_resize(375, 812)`

### Flex `gap` Returns "normal"

**Problem**: `getComputedStyle(flexContainer).gap` returns `"normal"` even when `gap: 103px` is explicitly set in CSS. This happens in multiple browsers for flex containers.

**Solution**: Always measure visual gap via bounding rects:
```javascript
const children = container.children;
const gap = children[1].getBoundingClientRect().left - children[0].getBoundingClientRect().right;
```
This is the authoritative measurement. If it matches the spec, the gap is correct regardless of what `getComputedStyle` reports.

### Large Figma Designs Return Sparse Metadata

**Problem**: `get_design_context` returns only element coordinates (x, y, width, height) without CSS properties like font-size, color, line-height when the design is too large.

**Solution**:
1. Call `get_design_context` on sublayer node IDs for detailed specs
2. Derive CSS values from coordinates: `gap = child2.x - (child1.x + child1.width)`
3. For typography/color, drill into specific text node IDs

### Sub-pixel Rendering

**Problem**: Browser renders 14.5px but reports 14px or 15px depending on rounding.

**Solution**: Use 2px tolerance threshold. Differences ≤ 2px are acceptable and should not trigger fixes.

## Figma MCP Issues

### Missing Structured Data

**Problem**: `get_design_context` returns limited data when Figma file lacks Auto Layout, Variables, or proper component structure.

**Solution**: Fall back to `get_screenshot` and extract specs manually. Warn the user that accuracy depends on Figma file quality. Suggest design team improvements:
- Use Auto Layout (maps to Flexbox/Grid)
- Use Figma Variables for tokens
- Name layers consistently

### Rate Limits

**Problem**: Figma MCP has API rate limits (varies by plan).

**Solution**: Cache the spec object in the conversation. Don't re-fetch Figma data for each measurement iteration — extract once, measure many times.

### Node ID Parsing

**Problem**: URL `node-id=40149-17649` uses hyphens, API needs colons `40149:17649`.

**Solution**: Always convert: `nodeId.replace(/-/g, ':')`

## CSS Measurement Specifics

### Gap vs Margin

**Problem**: `gap` property on flex/grid container vs `margin` on children produce visually identical spacing but measure differently.

**Solution**: Measure both the container `gap` and the child `marginTop`/`marginLeft`. If `gap` is `0px` or `normal`, check child margins.

### Computed vs Specified Values

**Problem**: `getComputedStyle` returns **computed** values, not authored values. `line-height: 1.5` becomes `line-height: 24px` (computed from font-size).

**Solution**: Compare in consistent units. Convert spec values to px if needed:
- `line-height: 1.5` with `font-size: 16px` → `24px`
- `padding: 2rem` → `32px` (assuming 16px root)

### Shorthand Properties

**Problem**: `getComputedStyle` doesn't return shorthand properties like `padding`, `margin`, `border`.

**Solution**: Always query longhand properties:
- `padding` → `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`
- `margin` → `marginTop`, `marginRight`, `marginBottom`, `marginLeft`
- `border` → `borderTopWidth`, `borderTopStyle`, `borderTopColor`

## Vue/React Specific

### v-show Elements

**Problem**: Elements hidden with `v-show` (`display: none`) still exist in DOM but have zero dimensions.

**Solution**: Check `display` property first. If `none`, skip measurement or trigger visibility first.

### Transition/Animation Interference

**Problem**: CSS transitions cause intermediate values during measurement.

**Solution**: Either:
1. Wait for transitions to complete (check `transitionend` event)
2. Temporarily disable transitions before measuring:
```javascript
document.body.style.setProperty('*', 'transition: none !important')
```

### Dynamic Content / API Data

**Problem**: Component renders skeleton/placeholder before data loads, metrics don't match final state.

**Solution**: Wait for actual content. Use `browser_wait_for` with a selector that only appears after data loads (e.g., a specific text element or class).

## Content Verification

### Icon Identity Not in Computed Styles

**Problem**: `getComputedStyle` returns icon `font-size`, `color`, `width`, `height` — but NOT which icon glyph is rendered. A `chart-line-up` (line chart) and `chart-mixed` (bar+line chart) have identical CSS properties but look completely different. This makes icon mismatches invisible to pure CSS measurement.

**Solution**: Read icon identity from DOM attributes, not computed styles:
```javascript
// FontAwesome SVG icons
svg.getAttribute('data-icon')   // → "chart-mixed"
svg.getAttribute('data-prefix') // → "fas"

// Material Icons
el.textContent  // → "trending_up"

// Icon font class
el.className    // → "icon-chart-mixed"
```

Compare against Figma's icon component names. Figma names like `clock-rotate-left-sharp-solid 1` map to `clock-rotate-left` (strip variant suffix and trailing number).

### Image/Asset Content

**Problem**: Similar to icons — `getComputedStyle` cannot verify that the correct image is displayed, only its dimensions.

**Solution**: Check `img.src` or `background-image` URL against expected asset paths. This is a content check, not a style check.
