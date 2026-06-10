# 03 — Test Results

## Existing Tests (Regression Check)

| Test Suite | Tests | Passed | Failed |
|------------|-------|--------|--------|
| seriesPipelineHardening.test.mjs | 37 | 37 | 0 |
| seriesLiveWiringFix.test.mjs | 44 | 44 | 0 |
| **Total** | **81** | **81** | **0** |

## Build Status

✅ `npx vite build` — clean, zero warnings, zero errors.

## New Test Coverage (seriesLiveWiringFix.test.mjs)

### Section 1: Fixed getSeriesContinuity Behavior (7 tests)
- ✅ True continuation prompt includes non-empty continuity block
- ✅ Dead character constraint appears in prompt
- ✅ Resolved thread constraint appears in prompt
- ✅ World state appears in prompt
- ✅ Last book ending appears in prompt
- ✅ Standalone sequel gets light world/voice context only
- ✅ Anthology volume does not inherit protagonist obligations

### Section 2: Volume Contract Block Wiring (5 tests)
- ✅ buildVolumeContractBlock is called for linked continuation
- ✅ Opening chapter includes entry contract emphasis
- ✅ Final chapter includes exit contract emphasis
- ✅ Mid chapter gets mid-volume guidance
- ✅ No contracts returns empty string

### Section 3: Post-Generation Series Contract Gate (3 tests)
- ✅ Dead character resurrection blocks true continuation
- ✅ Clean prose passes gate
- ✅ Non-series project is unaffected

### Section 4: Export Series Contract Gate (5 tests)
- ✅ Export safety gate is now async
- ✅ Export gate imports series contract gate
- ✅ Export gate stores series report
- ✅ Export gate includes seriesReport in returned report
- ✅ ExportTab.jsx awaits runPreExportSafetyGate

### Section 5: SceneWriter Wiring Verification (9 tests)
- ✅ sceneWriter imports buildVolumeContractBlock
- ✅ sceneWriter imports runSeriesContractGate
- ✅ getSeriesContinuity loads SeriesBible entity (not project)
- ✅ getSeriesContinuity handles flavor: standalone
- ✅ getSeriesContinuity handles flavor: anthology_volume
- ✅ getVolumeContractBlock exists and uses entry/exit contracts
- ✅ generateChapterSceneByScene includes volumeContractBlock in Promise.all
- ✅ generateSingleScene includes volumeContractBlock
- ✅ Post-generation series gate stores report on window

### Section 6: Stale Volume Bible Protection (3 tests)
- ✅ Stale when chapter edited after volume bible
- ✅ Fresh bible is not stale
- ✅ Missing volume bible is stale

### Section 7: Live Continuation Proof (5 tests)
- ✅ Book 2 prompt with Book 1 canon includes all constraints
- ✅ Violating text triggers dead character detection
- ✅ Clean continuation text passes
- ✅ Volume contract block for chapter 1 shows entry emphasis
- ✅ Volume contract block for chapter 20 shows exit emphasis

### Section 8: Non-Series Projects Unaffected (3 tests)
- ✅ Non-series project has no series_bible_id
- ✅ Contract block returns empty for non-series
- ✅ Continuity block returns empty for null bible

### Section 9: Build Verification (4 tests)
- ✅ sceneWriter.js exists
- ✅ exportSafetyGate.js exists
- ✅ seriesContractGate.js exists
- ✅ volumeBible.js exists
