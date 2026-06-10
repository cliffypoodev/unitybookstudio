# 01 — Cover Production System Architecture

**Date:** 2026-06-09
**Scope:** Full cover production pipeline — lib modules, UI panels, and data flow

---

## Lib Modules (9 + 1 audit)

| # | Module | Purpose |
|---|--------|---------|
| 1 | `comfyuiClient.js` | HTTP client for ComfyUI server — queue prompts, poll status, fetch images |
| 2 | `coverComfyWorkflows.js` | ComfyUI workflow builders for Flux and PonyXL pipelines |
| 3 | `coverPromptBuilder.js` | Genre-aware prompt construction with quality tags and negative prompts |
| 4 | `coverGenreTemplates.js` | Per-genre style templates (fantasy, romance, sci-fi, thriller, etc.) |
| 5 | `coverSafety.js` | Content safety screening for prompts and generated images |
| 6 | `coverTypographyComposer.js` | Canvas-based title/author/subtitle text rendering and overlay |
| 7 | `coverExport.js` | Export presets (ebook, paperback, promo), metadata, and download |
| 8 | `coverVariationManager.js` | Create/duplicate/update/delete/select cover variations per project |
| 9 | `coverSeriesConsistency.js` | Extract/apply/validate series cover signatures for visual consistency |
| — | `uiWiringAudit.js` | Static analysis — scans JSX for buttons, handlers, and no-op detection |

---

## CoverArtGenerator.jsx — 6 Collapsible Panels

```
┌─────────────────────────────────────────┐
│  Cover Art Generator                    │
│                                         │
│  ▶ Direction-Based Workflow             │  ← existing: generate / make-for-me / upload
│  ▶ Advanced Local Generation            │  ← ComfyUI model/checkpoint/size controls
│  ▶ Typography Compositor                │  ← title/author text, font, placement, preview
│  ▶ Export Front Cover                   │  ← preset selector, PNG/JPG download
│  ▶ Cover Variations                     │  ← save/select/duplicate/delete variations
│  ▶ Series Consistency Lock              │  ← extract/apply/validate series signature
└─────────────────────────────────────────┘
```

---

## Data Flow

```
ComfyUI Server (port 8000)
  │
  ▼
comfyuiClient.js ──── queue prompt, poll, fetch image
  │
  ▼
coverComfyWorkflows.js ──── build Flux / PonyXL workflow JSON
  │
  ▼
coverPromptBuilder.js + coverGenreTemplates.js ──── compose prompt
  │
  ▼
coverSafety.js ──── screen prompt before send
  │
  ▼
[Generated Art — raw image from ComfyUI]
  │
  ▼
coverTypographyComposer.js ──── overlay title/author/subtitle/series/tagline
  │                              via HTML5 Canvas rendering
  │                              (typography is ALWAYS app-rendered, never model-rendered)
  ▼
[Composite Canvas — art + text layers]
  │
  ▼
coverExport.js ──── resize to preset → canvas.toBlob → download PNG/JPG
  │
  ▼
coverVariationManager.js ──── save as variation (localStorage per project)
  │
  ▼
coverSeriesConsistency.js ──── lock series signature for multi-book consistency
```

---

## Key Architectural Decisions

1. **Typography is app-rendered, never model-rendered.** The image model generates raw art; text is composited on top by the browser canvas. This ensures crisp, editable text with consistent font rendering.

2. **Variations are per-project.** Each variation stores the full generation snapshot (prompt, model, seed, typography, timestamp) so any cover state can be restored.

3. **Series consistency is signature-based.** A "signature" is extracted from the active cover and can be applied to new covers, enforcing matching lighting, palette, composition, model pipeline, and export preset.

4. **Static wiring audit.** `uiWiringAudit.js` provides regex-based static analysis of JSX source to verify that every button and interactive control has a real handler, not a no-op.

5. **Export presets match KDP standards.** All dimensions are at 300 DPI with 0.125" bleed factored in for print presets.
