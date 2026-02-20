# Platform Mapping Reference

Detailed mapping from Figma design properties to platform-specific code.

## Layout: Auto Layout

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| `layoutMode: HORIZONTAL` | `HStack(spacing:)` | `Row(horizontalArrangement)` | `display: flex; flex-direction: row` |
| `layoutMode: VERTICAL` | `VStack(spacing:)` | `Column(verticalArrangement)` | `display: flex; flex-direction: column` |
| `layoutWrap: WRAP` | `LazyVGrid` / custom `FlowLayout` | `FlowRow` | `flex-wrap: wrap` |
| `itemSpacing` | `spacing:` param | `Arrangement.spacedBy()` | `gap:` |
| `paddingLeft/Right/Top/Bottom` | `.padding(EdgeInsets(...))` | `Modifier.padding(start, top, end, bottom)` | `padding: top right bottom left` |
| `primaryAxisAlignItems: CENTER` | `HStack(alignment:)` or `.frame(alignment:)` | `horizontalAlignment` / `verticalAlignment` | `justify-content: center` |
| `counterAxisAlignItems: CENTER` | alignment param on Stack | cross-axis alignment | `align-items: center` |
| `layoutGrow: 1` | `.frame(maxWidth: .infinity)` | `Modifier.weight(1f)` | `flex: 1` |
| `layoutAlign: STRETCH` | `.frame(maxWidth: .infinity)` | `Modifier.fillMaxWidth()` | `align-self: stretch` |

## Fills and Colors

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| Solid fill `{r,g,b,a}` | `Color(red:green:blue:opacity:)` | `Color(0xAARRGGBB)` | `#RRGGBB` / `rgba()` |
| Linear gradient | `LinearGradient(colors:startPoint:endPoint:)` | `Brush.linearGradient(colors, start, end)` | `linear-gradient(deg, colors)` |
| Radial gradient | `RadialGradient(colors:center:)` | `Brush.radialGradient(colors, center)` | `radial-gradient(colors)` |
| Image fill | `Image().resizable()` | `Image(painter).fillMaxSize()` | `background-image: url()` |
| Opacity | `.opacity()` | `Modifier.alpha()` | `opacity:` |

### Color Conversion

Figma colors are `{r, g, b, a}` floats (0-1). Convert:

```
Figma {r: 0.231, g: 0.510, b: 0.965, a: 1}
  → hex: #3B82F6
  → SwiftUI: Color(red: 0.231, green: 0.510, blue: 0.965)
  → Compose: Color(0xFF3B82F6)
  → CSS: #3B82F6
```

## Typography

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| `fontSize` | `.font(.system(size:))` | `fontSize = N.sp` | `font-size: Npx` |
| `fontFamily` | `.font(.custom("Name", size:))` | `FontFamily(Font(...))` | `font-family: "Name"` |
| `fontWeight` (400/700) | `.fontWeight(.regular/.bold)` | `FontWeight.Normal/Bold` | `font-weight: 400/700` |
| `lineHeightPx` | `.lineSpacing()` | `lineHeight = N.sp` | `line-height: Npx` |
| `letterSpacing` | `.tracking()` | `letterSpacing = N.sp` | `letter-spacing: Npx` |
| `textAlignHorizontal` | `.multilineTextAlignment()` | `textAlign = TextAlign.X` | `text-align:` |
| `textDecoration: UNDERLINE` | `.underline()` | `textDecoration = Underline` | `text-decoration: underline` |
| `textCase: UPPER` | `.textCase(.uppercase)` | `text.uppercase()` | `text-transform: uppercase` |

## Effects (Shadows, Blur)

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| `DROP_SHADOW{color,offset,radius}` | `.shadow(color:radius:x:y:)` | `Modifier.shadow(elevation, shape, color)` | `box-shadow: Xpx Ypx Rpx color` |
| `INNER_SHADOW` | Custom overlay | Custom `drawBehind` | `box-shadow: inset ...` |
| `LAYER_BLUR{radius}` | `.blur(radius:)` | `Modifier.blur(radius)` | `filter: blur(Rpx)` |
| `BACKGROUND_BLUR` | `.background(.ultraThinMaterial)` | N/A (custom) | `backdrop-filter: blur(Rpx)` |

## Corner Radius

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| `cornerRadius` (uniform) | `.clipShape(RoundedRectangle(cornerRadius:))` | `Modifier.clip(RoundedCornerShape(N.dp))` | `border-radius: Npx` |
| Per-corner radius | `UnevenRoundedRectangle(topLeading:...)` | `RoundedCornerShape(tl, tr, br, bl)` | `border-radius: TL TR BR BL` |
| Fully round (pill) | `.clipShape(Capsule())` | `CircleShape` or `RoundedCornerShape(50)` | `border-radius: 9999px` |

## Strokes and Borders

| Figma Property | SwiftUI | Compose | React/CSS |
|---------------|---------|---------|-----------|
| `strokes[0].color` + `strokeWeight` | `.overlay(RoundedRectangle().stroke())` | `Modifier.border(width, color, shape)` | `border: Wpx solid color` |
| `strokeAlign: INSIDE` | `.overlay(...)` (default) | `Modifier.border(...)` (default) | `box-sizing: border-box` |
| `strokeAlign: OUTSIDE` | Expand frame + overlay | Expand + border | `outline: Wpx solid color` |
| Dashed stroke | `.stroke(style: StrokeStyle(dash:))` | `PathEffect.dashPathEffect()` | `border-style: dashed` |

## Components and Variants

| Figma Concept | SwiftUI | Compose | React |
|--------------|---------|---------|-------|
| Component | `struct XView: View` | `@Composable fun X()` | `function X(): JSX.Element` |
| Instance | `XView(prop: value)` | `X(prop = value)` | `<X prop={value} />` |
| Variant property | `enum` + switch/if | `enum` + when | prop + conditional render |
| Boolean variant (e.g. `isActive`) | `@State var isActive` / param | `isActive: Boolean` param | `isActive: boolean` prop |
| Text override | `String` parameter | `String` parameter | `string` prop / `children` |
| Nested instance swap | Generic `View` param or `@ViewBuilder` | `@Composable () -> Unit` slot | `ReactNode` children/slot prop |

## Constraints and Responsiveness

| Figma Constraint | SwiftUI | Compose | React/CSS |
|-----------------|---------|---------|-----------|
| `LEFT_RIGHT` (stretch) | `.frame(maxWidth: .infinity)` | `Modifier.fillMaxWidth()` | `width: 100%` |
| `TOP_BOTTOM` (stretch) | `.frame(maxHeight: .infinity)` | `Modifier.fillMaxHeight()` | `height: 100%` |
| `SCALE` | `GeometryReader` proportional | `BoxWithConstraints` | `width: N%; height: N%` |
| Fixed size | `.frame(width:height:)` | `Modifier.size(W.dp, H.dp)` | `width: Wpx; height: Hpx` |
| `MIN_WIDTH` / `MAX_WIDTH` | `.frame(minWidth:maxWidth:)` | `Modifier.widthIn(min, max)` | `min-width; max-width` |
