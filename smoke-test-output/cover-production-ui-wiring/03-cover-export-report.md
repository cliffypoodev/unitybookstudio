# 03 — Cover Export Report

**Date:** 2026-06-09
**Module:** `src/lib/coverExport.js` (268 lines)

---

## Export Presets (6)

| Preset ID | Label | Width × Height | DPI | Ratio | Description |
|-----------|-------|----------------|-----|-------|-------------|
| `ebook` | eBook Cover | 1600 × 2560 | 300 | 5:8 | Amazon KDP eBook recommended minimum |
| `paperback_6x9` | 6×9 Paperback Front | 1890 × 2775 | 300 | 2:3 | 6×9" at 300 DPI with 0.125" bleed |
| `paperback_5x8` | 5×8 Paperback Front | 1563 × 2500 | 300 | 5:8 | 5×8" at 300 DPI with 0.125" bleed |
| `square_promo` | Square Promo | 2000 × 2000 | 300 | 1:1 | Social media square promo |
| `vertical_promo` | Vertical Promo | 1080 × 1920 | 72 | 9:16 | Instagram / TikTok vertical promo |
| `custom` | Custom | user-defined | 300 | custom | Clamped to 512–6000 px per axis |

---

## Supported Formats

| Format | MIME Type | Quality | Notes |
|--------|-----------|---------|-------|
| **PNG** | `image/png` | lossless | Default export format |
| **JPG** | `image/jpeg` | 0.92 default (configurable 0.1–1.0) | Smaller file size |

---

## Full Export Pipeline

```
1. SELECT PRESET
   └── getCoverExportDimensions(preset, customDims)
       → { width, height, dpi }

2. RESIZE + COMPOSITE
   └── renderCoverCompositeToCanvas(backgroundImage, typographySettings, { width, height, showGuides })
       a. Create canvas at target dimensions
       b. Draw background image (scaled to fill)
       c. Render safe margin guides (if showGuides)
       d. Build typography overlay layers
       e. Render each text layer (word wrap, spacing, shadow, glow)
       → HTMLCanvasElement

3. EXPORT TO BLOB
   ├── exportCompositeCoverPNG(canvas) → Blob (image/png)
   └── exportCompositeCoverJPG(canvas, quality) → Blob (image/jpeg)

4. BUILD METADATA
   └── buildCoverExportMetadata(project, coverAsset, typographySettings)
       → { title, author, genre, subgenre, projectId, exportedAt,
            preset, width, height, modelPipeline, seed, checkpoint,
            hasTypography, typographyFontId, format }

5. BUILD FILENAME
   └── buildExportFilename(project, preset, format)
       → "sanitized-title-preset-label-timestamp.png"

6. DOWNLOAD
   └── downloadCoverImage(blob, filename)
       a. URL.createObjectURL(blob)
       b. Create <a download="..."> element
       c. Programmatic click
       d. Cleanup (revokeObjectURL after 1s)
```

---

## Metadata Fields

The export metadata object captures the full provenance of the exported cover:

| Field | Source | Example |
|-------|--------|---------|
| `title` | `project.title` | "The Dark Tower" |
| `author` | `project.author_name` | "Stephen King" |
| `genre` | `project.genre` | "fantasy" |
| `subgenre` | `project.subgenre` | "dark-fantasy" |
| `projectId` | `project.id` | "abc-123" |
| `exportedAt` | auto | "2026-06-09T18:12:00.000Z" |
| `preset` | selected preset | "ebook" |
| `width` | from preset | 1600 |
| `height` | from preset | 2560 |
| `modelPipeline` | cover asset | "flux" |
| `seed` | cover asset | 42 |
| `checkpoint` | cover asset | "ponyDiffusionV6XL" |
| `hasTypography` | computed | true |
| `typographyFontId` | typography settings | "garamond" |
| `format` | selected format | "png" |

---

## Safe Filenames

`buildExportFilename()` sanitizes filenames:

1. Title → lowercase
2. Non-alphanumeric characters → hyphens
3. Leading/trailing hyphens stripped
4. Truncated to 40 characters
5. Preset label → lowercase, hyphenated
6. Appended with timestamp and extension

**Example:** `"The Dark Tower!"` → `the-dark-tower-ebook-cover-1717955520000.png`

---

## Validation

`validateCoverExportSettings()` checks:

- ✅ At least one image source (`imageUrl`, `canvas`, or `blob`)
- ✅ Custom dimensions ≥ 512 px
- ✅ Format is `png`, `jpg`, or `jpeg`
- ✅ Quality between 0.1 and 1.0

---

## Convenience Pipelines

Two top-level async functions wrap the full pipeline:

| Function | Output |
|----------|--------|
| `exportFrontCoverPNG({ project, backgroundImage, typographySettings, preset, showGuides })` | `{ blob, filename, metadata }` |
| `exportFrontCoverJPG({ project, backgroundImage, typographySettings, preset, quality, showGuides })` | `{ blob, filename, metadata }` |

Both dynamically import `coverTypographyComposer.js` for canvas rendering.

---

## Follow-Up

> **PDF export** is noted as a planned follow-up feature. The current implementation covers PNG and JPG only.
