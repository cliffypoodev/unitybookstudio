# 02 — Advanced Panel Implementation

**Report Date:** 2026-06-09  
**Status:** ✅ IMPLEMENTED

---

## Advanced Local Generation Panel

The Advanced Local Generation panel provides full control over ComfyUI-powered cover art generation. All controls map directly to lib module exports.

### Panel Controls

| Control | Lib Binding | Source Module |
|---------|-------------|---------------|
| Model Selector | `COVER_MODEL_PIPELINES` (flux / ponyxl) | `coverComfyWorkflows.js` |
| Genre Template | `getAllGenreCoverTemplates()` → 10 templates | `coverGenreTemplates.js` |
| Size Preset | `COVER_SIZE_PRESETS` (5 presets) | `coverComfyWorkflows.js` |
| Typography Mode | `COVER_TYPOGRAPHY_MODES` (3 modes) | `coverComfyWorkflows.js` |
| Positive Prompt | `buildCoverPrompt()` → `positive` | `coverPromptBuilder.js` |
| Negative Prompt | `buildCoverPrompt()` → `negative` | `coverPromptBuilder.js` |
| Lighting | `settings.lighting` override | `coverPromptBuilder.js` |
| Palette | `settings.palette` override | `coverPromptBuilder.js` |
| Seed | `settings.seed` (-1 = random) | `coverComfyWorkflows.js` |
| Steps | `pipeline.defaultSteps` (20/25) | `coverComfyWorkflows.js` |
| Guidance/CFG | `pipeline.defaultGuidance` / `defaultCfg` | `coverComfyWorkflows.js` |
| ComfyUI URL | `getComfyUIBaseUrl()` / `setComfyUIBaseUrl()` | `comfyuiClient.js` |
| Test Connection | `checkComfyUIStatus()` | `comfyuiClient.js` |
| Generate Button | `generateCoverWithComfyUI()` | `comfyuiClient.js` |

### Model Selector Behavior

When user selects a model:

1. `getDefaultCoverSettingsForModel(modelId)` is called
2. All panel fields update to pipeline defaults:
   - **Flux:** steps=20, guidance=3.5, sampler=euler, scheduler=simple, supportsNegative=false
   - **PonyXL:** steps=25, cfg=7, sampler=euler, scheduler=normal, supportsNegative=true
3. Negative prompt field visibility toggles based on `supportsNegative`
4. Prompt builder routes to `buildFluxCoverPrompt()` or `buildPonyXLCoverPrompt()`

### Genre Template Selector

- Displays 10 genre templates with labels
- On selection, auto-fills lighting, subject, palette, finish, composition
- Also sets recommended pipeline (e.g., horror → PonyXL, romance → Flux)
- User can override any individual field

### Size Preset Selector

| Preset | Width | Height | Ratio |
|--------|-------|--------|-------|
| eBook Portrait | 1600 | 2400 | 2:3 |
| Paperback 6×9 Front | 1800 | 2700 | 2:3 |
| Square Promo | 1024 | 1024 | 1:1 |
| Vertical Poster | 1080 | 1920 | 9:16 |
| Custom | user-defined | user-defined | custom |

Custom dimensions clamped to 512–4096 range.

### Typography Mode Selector

| Mode | Behavior |
|------|----------|
| Image Only | Adds "No text" to prompt, text terms to negative |
| Typography Reference | Includes quoted title in prompt for layout testing |
| Composite Later | Adds composition breathing room, no text in image |

### Generate Button Flow

```
User clicks Generate
    ↓
buildCoverPrompt(project, settings) → { positive, negative }
    ↓
validateCoverWorkflowOptions(options) → { valid, errors }
    ↓
buildCoverWorkflowForModel(pipeline, options) → workflow JSON
    ↓
generateCoverWithComfyUI({ workflow }) → queueComfyWorkflow → pollComfyJob → fetchComfyImage
    ↓
Gallery receives { dataUrl, filename, metadata }
```

## Test Coverage

- `coverArtGeneratorAdvancedPanel.test.mjs` — 12 tests covering panel data bindings
- `coverTabModelSelectorUI.test.mjs` — 10 tests covering model selection logic
