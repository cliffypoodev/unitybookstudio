# 07 — Regression & Build Report

> **Report Generated:** 2026-06-08T22:18 CDT
> **Scope:** All test suites + production build
> **Result:** 68 passed, 0 failed · Build clean

---

## Test Suite Results

| Suite | File | Assertions | Result | Status |
|---|---|---|---|---|
| Violence Level Wiring | `violenceLevelWiring.test.mjs` | 23 | 23 passed, 0 failed | ✅ PASS |
| Story Architect Chat Wiring | `storyArchitectChatWiring.test.mjs` | 19 | 19 passed, 0 failed | ✅ PASS |
| Unity Contamination Regression | `unityContaminationSourceRegression.test.mjs` | 26 | 26 passed, 0 failed | ✅ PASS |
| Build | `npx vite build` | — | exit code 0 | ✅ PASS |
| **TOTAL** | | **68** | **68 passed, 0 failed** | **✅ PASS** |

---

## Suite Breakdown

### Violence Level Wiring (23 assertions)

Tests verify:
- `VIOLENCE_LEVELS` constant contains all 6 levels (0–5)
- `GENRE_DEFAULTS` include violence fields for all mapped genres
- `createInitialProjectSettings` includes `violence_level` defaulting to 0
- `applyGenreDefaults` sets `violence_level` from genre map
- `buildSetupConstraints` emits violence block when ≥ 1, suppresses at 0
- `buildProjectContextHeader` emits `VIOLENCE: X/5` when ≥ 1
- `buildViolenceCompact` emits per-scene block with correct label per level
- `buildViolenceBeatInstructions` produces fiction vs nonfiction instructions
- `getEffectiveContentSettings` enforces reading-level caps
- `SETUP_PROTECTED_FIELDS` in `modelRouting.js` includes `violence_level`

### Story Architect Chat Wiring (19 assertions)

Tests verify:
- `getActiveMode()` returns correct mode for each URL pattern
- `STORY_ARCHITECT_PROMPT` is used for Ideas/Foundation/Setup/Notebook contexts
- `CHAPTER_ASSISTANT_PROMPT` is used for Chapter/Editor/Studio contexts
- `BRAINSTORM_PROMPT` is used for other/home contexts
- `[USE_IDEA]` schema includes `violenceLevel` field
- `handleChatbotUseIdea` maps all 15+ blueprint fields correctly
- Intent detection identifies research, polish, and general intents
- Mode labels display correctly for each mode

### Unity Contamination Regression (26 assertions)

Tests verify:
- `anthologyCatalog.js` no longer contains "Unity Living"
- `bibliographyGenerator.js` `CAREGIVING_RE` is fiction-guarded
- `buildProjectContextHeader` contains contamination canary
- `manuscriptSafetyGate.js` detects all Unity terms at critical severity
- `pipelineValidator.js` blocks all Unity terms
- `llmProsePolisher.js` detects Unity terms
- No prompt template files contain Unity business terms
- Fiction projects mentioning "caregiver" are not classified as caregiving domain

---

## Build Status

| Metric | Value |
|---|---|
| Build tool | Vite |
| Command | `npx vite build` |
| Exit code | **0** |
| Errors | None |
| Warnings | None (production) |
| Status | **✅ CLEAN** |
