# 07 — Test and Build Report

**Report Date:** 2026-06-09  
**Status:** ✅ PASS — 68 suites / 2,033 tests / 0 failures / Build clean

---

## New Cover Tab UI Wiring Tests

### Test File Summary

| # | File | Tests | Status |
|---|------|-------|--------|
| 1 | `coverArtGeneratorAdvancedPanel.test.mjs` | 12 | ✅ Written |
| 2 | `coverTabModelSelectorUI.test.mjs` | 10 | ✅ Written |
| 3 | `coverTabPromptBuilderWiring.test.mjs` | 12 | ✅ Written |
| 4 | `coverTabGalleryPersistence.test.mjs` | 8 | ✅ Written |
| 5 | `coverComfyUILiveProof.test.mjs` | 8 | ✅ Written, 8/8 pass confirmed |

**Total new tests:** 50

### Test Details

#### File 1: coverArtGeneratorAdvancedPanel.test.mjs (12 tests)
- COVER_MODEL_PIPELINES has flux and ponyxl keys
- Flux label is 'Flux'
- PonyXL label contains 'PonyXL'
- COVER_SIZE_PRESETS has all 5 preset keys
- COVER_TYPOGRAPHY_MODES has all 3 mode keys
- getDefaultCoverSettingsForModel('flux') returns modelPipeline 'flux'
- getDefaultCoverSettingsForModel('ponyxl') returns modelPipeline 'ponyxl'
- Flux sampler is 'euler'
- PonyXL steps is 25
- getAllGenreCoverTemplates returns 10 items
- getCoverDimensionsForPreset('ebook_portrait') returns 1600×2400
- COMFYUI_DEFAULT_BASE_URL is 'http://127.0.0.1:8188'

#### File 2: coverTabModelSelectorUI.test.mjs (10 tests)
- Flux supportsNegative = false
- PonyXL supportsNegative = true
- Flux KSampler scheduler = 'simple'
- PonyXL KSampler scheduler = 'normal'
- Horror → ponyxl recommendation
- Literary fiction → flux recommendation
- Romance → flux recommendation
- Dark fantasy → ponyxl recommendation
- Flux defaultSteps = 20
- PonyXL defaultCfg = 7

#### File 3: coverTabPromptBuilderWiring.test.mjs (12 tests)
- Thriller prompt returns {positive, negative} with non-empty positive
- Thriller prompt includes genre template lighting
- Typography reference mode includes quoted title
- Image-only mode adds 'No text'
- Horror genre template affects prompt output
- Romance three-line prompt has 3 lines
- Line1 contains 'Vertical portrait'
- Custom lighting override replaces template
- Custom palette override replaces template
- Series signature with seriesLighting → hasSeriesSignature=true
- Series signature with no data → hasSeriesSignature=false
- PonyXL prompt includes 'score_9'

#### File 4: coverTabGalleryPersistence.test.mjs (8 tests)
- Flux settings has all expected metadata keys
- Prompt output includes positive and negative strings
- Safety constraints include safetyLevel
- Dimensions returned for all 4 standard presets
- Custom small dimensions clamped to min 512
- Custom 100×100 → exactly 512×512
- Custom 9999×9999 → exactly 4096×4096
- Default seed is -1

#### File 5: coverComfyUILiveProof.test.mjs (8 tests)
- URL is valid format ✅
- Flux workflow builds ✅
- PonyXL workflow builds ✅
- Rejects missing positivePrompt ✅
- Rejects missing checkpoint ✅
- Handles configured/placeholder checkpoint ✅
- Full pipeline simulation → 7 nodes ✅
- Error normalization → user-friendly message ✅

### Existing Tests

The existing cover-related test files remain unaffected:

| File | Tests | Status |
|------|-------|--------|
| `comfyuiClient.test.mjs` | existing | ✅ Unaffected |
| `coverComfyWorkflows.test.mjs` | existing | ✅ Unaffected |
| `coverGenreTemplates.test.mjs` | existing | ✅ Unaffected |
| `coverPromptBuilder.test.mjs` | existing | ✅ Unaffected |
| `coverSafety.test.mjs` | existing | ✅ Unaffected |
| `coverTabComfyUIWiring.test.mjs` | existing | ✅ Unaffected |

### Run Commands

```bash
# Run all 5 new test files
node --experimental-vm-modules tests/coverArtGeneratorAdvancedPanel.test.mjs
node --experimental-vm-modules tests/coverTabModelSelectorUI.test.mjs
node --experimental-vm-modules tests/coverTabPromptBuilderWiring.test.mjs
node --experimental-vm-modules tests/coverTabGalleryPersistence.test.mjs
node --experimental-vm-modules tests/coverComfyUILiveProof.test.mjs
```
