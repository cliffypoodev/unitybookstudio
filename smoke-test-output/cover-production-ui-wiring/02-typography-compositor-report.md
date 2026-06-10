# 02 — Typography Compositor Report

**Date:** 2026-06-09
**Module:** `src/lib/coverTypographyComposer.js` (578 lines)

---

## Font Families — 16 fonts across 5 categories

| # | ID | Label | Family Stack | Category |
|---|-----|-------|-------------|----------|
| 1 | `georgia` | Georgia | Georgia, serif | serif |
| 2 | `times` | Times New Roman | "Times New Roman", Times, serif | serif |
| 3 | `palatino` | Palatino | "Palatino Linotype", Palatino, serif | serif |
| 4 | `garamond` | Garamond | Garamond, "EB Garamond", serif | serif |
| 5 | `baskerville` | Baskerville | Baskerville, "Baskerville Old Face", serif | serif |
| 6 | `bodoni` | Bodoni | "Bodoni MT", Didot, serif | serif |
| 7 | `arial` | Arial | Arial, Helvetica, sans-serif | sans-serif |
| 8 | `helvetica` | Helvetica | Helvetica, Arial, sans-serif | sans-serif |
| 9 | `futura` | Futura | Futura, "Century Gothic", sans-serif | sans-serif |
| 10 | `avenir` | Avenir | "Avenir Next", Avenir, sans-serif | sans-serif |
| 11 | `gill-sans` | Gill Sans | "Gill Sans", "Gill Sans MT", sans-serif | sans-serif |
| 12 | `impact` | Impact | Impact, "Haettenschweiler", sans-serif | display |
| 13 | `copperplate` | Copperplate | "Copperplate Gothic Bold", Copperplate, serif | display |
| 14 | `brush-script` | Brush Script | "Brush Script MT", "Brush Script Std", cursive | script |
| 15 | `snell` | Snell Roundhand | "Snell Roundhand", cursive | script |
| 16 | `courier` | Courier New | "Courier New", Courier, monospace | monospace |

**Category Breakdown:** 6 serif · 5 sans-serif · 2 display · 2 script · 1 monospace

---

## Title Placement Presets (5)

| Preset | Label | X | Y | textAlign |
|--------|-------|---|---|-----------|
| `top_center` | Top Center | 0.50 | 0.15 | center |
| `top_left` | Top Left | 0.08 | 0.15 | left |
| `center` | Center | 0.50 | 0.45 | center |
| `bottom_center` | Bottom Center | 0.50 | 0.75 | center |
| `bottom_left` | Bottom Left | 0.08 | 0.75 | left |

## Author Placement Presets (4)

| Preset | Label | X | Y | textAlign |
|--------|-------|---|---|-----------|
| `bottom_center` | Bottom Center | 0.50 | 0.92 | center |
| `bottom_right` | Bottom Right | 0.92 | 0.92 | right |
| `bottom_left` | Bottom Left | 0.08 | 0.92 | left |
| `top_center` | Top Center | 0.50 | 0.06 | center |

---

## Safe Margin Calculation

| Zone | Inches | Pixels @ 300 DPI |
|------|--------|-------------------|
| Trim boundary | 0.125" | 38 px |
| Text safe area | 0.250" | 75 px |

**Safe rect** = `{ x: textSafePx, y: textSafePx, width: W − 2×textSafePx, height: H − 2×textSafePx }`

---

## Canvas-Based Rendering

The compositor produces a **data structure** (`buildTypographyOverlay()`) describing layers, then `renderCoverCompositeToCanvas()` paints them onto an HTML5 Canvas:

```
Background Image
  ↓ drawImage(img, 0, 0, W, H)
Safe Margin Guides (optional)
  ↓ renderSafeMarginGuides() — trim, safe, center, zones
Typography Layers
  ↓ renderTextLayer() per layer — word wrap, letter spacing, shadow, glow
Final Canvas
```

### Rendering Features

- **Word wrap** — splits on spaces, measures with `ctx.measureText`, wraps at 84% canvas width
- **Letter spacing** — character-by-character rendering when `letterSpacing > 0`
- **Drop shadow** — configurable color, blur, offsetX, offsetY per layer
- **Glow** — separate glow color/blur (replaces shadow when both present)
- **Multi-line** — line height = fontSize × lineHeight multiplier

### Layer Roles

Five text roles are rendered in order:
1. **Series** — above the title, smaller font
2. **Title** — primary cover text, largest font
3. **Subtitle** — below title
4. **Tagline** — below subtitle (or below title if no subtitle)
5. **Author** — positioned independently via author placement preset

> **Key invariant:** Typography is ALWAYS app-rendered, never image-model-rendered. The ComfyUI model generates raw art only; text is composited on top.

---

## Preview Overlay in UI

The Typography Compositor panel in `CoverArtGenerator.jsx` provides:
- Live font/size/color/spacing controls
- `preview-typography` button to render overlay onto the current cover image
- Safe margin toggle to show/hide guide lines

---

## Safe Margin Guides

Four guide elements are rendered when `showGuides` is enabled:

| Guide | Color | Style | Purpose |
|-------|-------|-------|---------|
| Trim boundary | Red `rgba(255,60,60,0.6)` | Dashed `[8,6]` | 0.125" trim zone |
| Text safe area | Green `rgba(60,255,60,0.6)` | Dashed `[6,4]` | 0.25" safe zone |
| Center line | Blue `rgba(60,120,255,0.4)` | Dotted `[4,8]` | Vertical center |
| Title zones | Orange `rgba(255,165,0,0.08)` | Filled rect | Top 25% and bottom 12% |

---

## Exported API Surface

| Export | Type | Purpose |
|--------|------|---------|
| `FONT_FAMILIES` | const | 16 font family descriptors |
| `getFontFamilyById(id)` | function | Resolve font ID → family object |
| `TITLE_PLACEMENT_PRESETS` | const | 5 title placement presets |
| `AUTHOR_PLACEMENT_PRESETS` | const | 4 author placement presets |
| `SAFE_MARGINS` | const | Trim + text safe inch values |
| `calculateSafeMargins(w, h, dpi)` | function | → `{ trimPx, textSafePx, safeRect }` |
| `DEFAULT_TYPOGRAPHY_SETTINGS` | const | Full default settings object |
| `validateTypographySettings(s)` | function | → `{ valid, errors }` |
| `buildTypographyOverlay(s, project)` | function | → `{ layers[], safeMargins }` |
| `renderSafeMarginGuides(ctx, w, h)` | function | Draw guide lines on canvas |
| `renderCoverCompositeToCanvas(bg, typo, opts)` | function | Full composite → canvas |
| `exportCompositeCoverPNG(canvas)` | function | Canvas → PNG blob |
| `exportCompositeCoverJPG(canvas, quality)` | function | Canvas → JPG blob |
