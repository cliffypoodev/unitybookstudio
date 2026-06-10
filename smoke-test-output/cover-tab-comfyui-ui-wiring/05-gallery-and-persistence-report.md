# 05 — Gallery and Persistence Report

**Report Date:** 2026-06-09  
**Status:** ✅ WIRED

---

## Generated Image Metadata Shape

Each generated cover image carries full metadata for reproducibility and gallery display.

### Settings Metadata (from `getDefaultCoverSettingsForModel`)

```javascript
{
  modelPipeline: 'flux',          // 'flux' or 'ponyxl'
  checkpoint: 'flux1-schnell-fp8.safetensors',
  steps: 20,                       // 20 (flux) or 25 (ponyxl)
  cfg: null,                       // null (flux) or number (ponyxl)
  guidance: 3.5,                   // number (flux) or null (ponyxl)
  sampler: 'euler',                // always euler
  scheduler: 'simple',            // 'simple' (flux) or 'normal' (ponyxl)
  supportsNegative: false,         // false (flux) or true (ponyxl)
  sizePreset: 'ebook_portrait',   // current size preset key
  seed: -1,                        // -1 = random, else fixed seed
}
```

### Prompt Metadata (from `buildCoverPrompt`)

```javascript
{
  positive: '...',   // Full positive prompt string
  negative: '...',   // Full negative prompt string (may be empty for Flux)
}
```

### Safety Metadata (from `buildCoverSafetyConstraints`)

```javascript
{
  isChildSafe: false,
  isAdultOnly: false,
  mandatoryNegatives: ['nsfw', 'explicit', 'nudity'],
  blockedTerms: [],
  safetyLevel: 'standard',  // 'children' | 'standard' | 'professional' | 'adult'
}
```

### Dimension Metadata (from `getCoverDimensionsForPreset`)

| Preset | Width | Height |
|--------|-------|--------|
| ebook_portrait | 1600 | 2400 |
| paperback_6x9_front | 1800 | 2700 |
| square_promo | 1024 | 1024 |
| vertical_poster | 1080 | 1920 |
| custom (clamped) | 512–4096 | 512–4096 |

### Dimension Clamping Rules

- Minimum: 512px (both axes)
- Maximum: 4096px (both axes)
- Custom `{width: 100, height: 100}` → clamped to `{width: 512, height: 512}`
- Custom `{width: 9999, height: 9999}` → clamped to `{width: 4096, height: 4096}`

## Gallery Save Flow

```
generateCoverWithComfyUI() completes
    ↓
Returns { dataUrl, filename, metadata: { promptId, imageCount, allImages } }
    ↓
UI creates gallery entry with:
    - dataUrl (base64 image)
    - generation settings (model, seed, steps, etc.)
    - prompt text (positive + negative)
    - dimensions (width × height)
    - timestamp
    - workflow metadata
    ↓
Gallery grid displays images via CoverArtGalleryGrid.jsx (53 lines)
    ↓
User can select image → save to project as cover
```

### Seed Behavior

- Default seed: `-1` (random — each generation uses `Math.floor(Math.random() * 2**32)`)
- Fixed seed: any positive integer → reproducible generation
- Seed is stored in metadata for reproduction

## Test Coverage

- `coverTabGalleryPersistence.test.mjs` — 8 tests covering:
  - Settings metadata shape (7 required keys)
  - Prompt output shape (positive + negative strings)
  - Safety constraints (safetyLevel key)
  - Dimension presets (all 4 standard presets)
  - Custom dimension clamping (min 512, max 4096)
  - Default seed (-1)
