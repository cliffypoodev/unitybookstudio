# 01 — Cover UI Current State

**Report Date:** 2026-06-09  
**Component:** `src/components/cover/CoverArtGenerator.jsx`  
**Lines:** 2,474  

---

## Component Architecture

The `CoverArtGenerator.jsx` component (2,474 lines) is the central Cover Tab UI. It orchestrates the full cover art generation workflow from direction selection through gallery display.

### Core Workflow

1. **Direction Selection** — User selects generation method:
   - **Generate** — AI-powered cover art via ComfyUI (Flux / PonyXL pipelines)
   - **Make For Me** — Direction-based guided generation using project metadata
   - **Upload** — Manual image upload from local filesystem

2. **Art Style / Color Mood Chips** — Visual selector chips for:
   - Art style presets (painterly, photorealistic, illustrated, minimalist, etc.)
   - Color mood presets (warm, cool, dark, vibrant, etc.)
   - These feed into the prompt builder as `stylePreset` and `palette` overrides

3. **Advanced Local Generation Panel** — ComfyUI-powered panel with:
   - Model selector (Flux / PonyXL)
   - Genre template selector (10 genre presets)
   - Size preset selector (ebook, paperback, square, poster, custom)
   - Typography mode selector (image-only, reference, composite-later)
   - Prompt / negative prompt text areas
   - Lighting, palette, seed, steps, guidance fields
   - ComfyUI URL config + test connection button
   - Generate button

4. **Gallery Integration** — Generated images are:
   - Displayed in a gallery grid (`CoverArtGalleryGrid.jsx`, 53 lines)
   - Stored with full generation metadata (model, seed, prompt, dimensions)
   - Selectable as project cover

### Supporting Lib Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| `comfyuiClient.js` | 350 | ComfyUI API client (queue, poll, fetch) |
| `coverComfyWorkflows.js` | 376 | Workflow builders (Flux, PonyXL node graphs) |
| `coverPromptBuilder.js` | 299 | Kittl 3-line prompt builder + routing |
| `coverGenreTemplates.js` | 253 | 10 genre cover templates |
| `coverSafety.js` | 149 | Safety constraints + negative sanitization |

### Data Flow

```
Project Metadata
    ↓
Genre Template → Prompt Builder → Positive/Negative
    ↓                                    ↓
Size Preset → Dimensions          Workflow Builder
    ↓                                    ↓
Typography Mode                  ComfyUI API Format
    ↓                                    ↓
Model Selection → Pipeline     comfyuiClient.js
    ↓                                    ↓
Advanced Settings              Queue → Poll → Fetch
    ↓                                    ↓
Generate Button  ──────────→   Gallery Display
```

## Status

✅ All lib modules implemented and production-wired  
✅ Component renders with full Advanced Local Generation panel  
✅ Gallery integration operational  
✅ 5 test files covering data/logic layer  
