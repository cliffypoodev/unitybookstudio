# 04 — Export File Verification Report

**Module:** Cover Production — Export Pipeline
**Date:** 2026-06-09
**Status:** ✅ PASS (data layer + source audit verified)

---

## Export Presets

**6 export presets** verified via `getCoverDimensionsForPreset()` and `getCoverExportDimensions()`:

| Preset | Width | Height | Aspect Ratio | Use Case |
|--------|-------|--------|--------------|----------|
| ebook | 1,600 | 2,400 | 2:3 | Digital eBook covers (Kindle, Kobo) |
| 6×9 | 1,890 | 2,775 | ~2:3 | Standard trade paperback |
| 5×8 | 1,563 | 2,500 | ~5:8 | Compact paperback |
| square | 2,000 | 2,000 | 1:1 | Social media / audiobook |
| vertical | 1,080 | 1,920 | 9:16 | Social media stories / reels |
| custom | User-defined | User-defined | Variable | Custom dimensions |

---

## Export Formats

| Format | Extension | Quality | Notes |
|--------|-----------|---------|-------|
| PNG | `.png` | Lossless | Default export format |
| JPG | `.jpg` | Configurable | Lossy compression for smaller files |

---

## Export Pipeline

```
renderCoverCompositeToCanvas(image, typographySettings, dimensions)
    → exportCompositeCoverPNG(canvas) / exportCompositeCoverJPG(canvas, quality)
    → downloadCoverImage(blob, filename)
```

### Pipeline Steps
1. **Render** — Composite cover image + typography layers onto HTML Canvas
2. **Export** — Convert canvas to PNG blob or JPG blob with quality setting
3. **Download** — Trigger browser download with sanitized filename

---

## Filename Sanitization

`buildExportFilename()` produces safe, slug-based filenames:

| Input | Output |
|-------|--------|
| Title: "The Glass Room", Preset: ebook | `the-glass-room_ebook_cover.png` |
| Title: "Crimson Vow!", Preset: 6x9 | `crimson-vow_6x9_cover.png` |

- ✅ Special characters removed
- ✅ Spaces converted to hyphens
- ✅ Lowercase normalization
- ✅ Preset name included in filename

---

## Export Metadata

`buildCoverExportMetadata()` returns:

| Field | Example Value |
|-------|---------------|
| title | "The Glass Room" |
| author | "Jane Doe" |
| preset | "ebook" |
| model | "flux" |
| seed | 42 |
| hasTypography | true |
| exportedAt | ISO timestamp |

---

## Guard Clauses

Export buttons are properly guarded:

```javascript
disabled={exporting || !variants?.length}
```

- ✅ Cannot export while another export is in progress
- ✅ Cannot export when no variations exist
- ✅ Loading spinner shown during export

---

## Source Audit — Export Controls (4)

| Control | ID | Handler | Status |
|---------|----|---------|--------|
| Export PNG | `export-cover-png` | `handleExportCover('png')` | ✅ REAL |
| Export JPG | `export-cover-jpg` | `handleExportCover('jpg')` | ✅ REAL |
| Export Preset Select | `export-preset-select` | Updates dimensions state | ✅ REAL |
| Quality Slider (JPG) | `export-quality-slider` | Updates quality state | ✅ REAL |

---

## Follow-ups

- **PDF export**: Noted as future work — not currently implemented
- **Canvas composite rendering**: Requires browser DOM — data layer proven

---

## Conclusion

The export pipeline is correctly implemented with 6 presets covering all major use cases, PNG/JPG format support, safe filename generation, comprehensive metadata, and proper guard clauses. All 4 export controls are wired to real handlers.
