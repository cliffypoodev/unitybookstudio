# 07 — Post-Fix Polish Regression

**Date:** 2026-06-07

---

## Test Results

### Suite 1: manuscriptSafetyGate.test.mjs
**Result:** 33/33 ✅

### Suite 2: digitalEquityPipelineRegression.mjs
**Result:** 27/27 ✅

### Suite 3: liveExportSafetyRegression.mjs
**Result:** 25/25 ✅

### Suite 4: safeChapterReplace.test.mjs
**Result:** 68/68 ✅

### Suite 5: prosePolisherQualityGate.test.mjs (NEW)
**Result:** 15/15 ✅

| # | Test | Result |
|---|------|--------|
| 1 | "She were carrying" detected as malformed | ✅ |
| 2 | "as if she were performing" NOT detected (subjunctive) | ✅ |
| 3 | "Was was it a failure?" detected and repaired | ✅ |
| 4 | "They was running" repaired to "They were running" | ✅ |
| 5 | "a obvious" repaired to "an obvious" | ✅ |
| 6 | Clean prose passes (ok=true, PASS) | ✅ |
| 7 | "wasn't just" counted as slop | ✅ |
| 8 | "didn't just" counted as slop | ✅ |
| 9 | "not just" counted as slop | ✅ |
| 10 | Slop-free text returns total=0 | ✅ |
| 11 | Multiple malformed → BLOCK_POLISH_SAVE | ✅ |
| 12 | Missing opening quote detected | ✅ |
| 13 | Grammar repair doesn't break clean text | ✅ |
| 14 | "He were an exhibit" detected (not subjunctive) | ✅ |
| 15 | "as if he were an exhibit" NOT detected (subjunctive) | ✅ |

### Suite 6: digitalEquityPolishRegression.mjs (NEW)
**Result:** 13/13 ✅

| # | Test | Result |
|---|------|--------|
| 1 | Ch5 "She were carrying" → malformed detected | ✅ |
| 2 | Ch5 "She was it monopolistic" → malformed detected | ✅ |
| 3 | Ch6 "She were those just" → malformed detected | ✅ |
| 4 | Ch6 "Was was it a failure" → detected and repaired | ✅ |
| 5 | Ch6 "a obvious thing" → detected and repaired | ✅ |
| 6 | Ch10 "as if she were performing" → NOT malformed | ✅ |
| 7 | Ch13 "as if he were setting" → NOT malformed | ✅ |
| 8 | Ch13 "Was was it external fraud" → detected and repaired | ✅ |
| 9 | Ch19 "as if he were an exhibit" → NOT malformed | ✅ |
| 10 | Malformed chapters → ok=false, BLOCK_POLISH_SAVE | ✅ |
| 11 | Clean chapters → ok=true, PASS | ✅ |
| 12 | Missing opening quote "The game is the model" → detected | ✅ |
| 13 | Missing opening quote "Adrenaline is just" → detected | ✅ |

---

## Totals

| Suite | Passed | Failed | Total |
|-------|--------|--------|-------|
| manuscriptSafetyGate | 33 | 0 | 33 |
| digitalEquityPipelineRegression | 27 | 0 | 27 |
| liveExportSafetyRegression | 25 | 0 | 25 |
| safeChapterReplace | 68 | 0 | 68 |
| prosePolisherQualityGate (NEW) | 15 | 0 | 15 |
| digitalEquityPolishRegression (NEW) | 13 | 0 | 13 |
| **TOTAL** | **181** | **0** | **181** |

### Build
- `npm run build` → exit 0 ✅
- `dist/` → 5.6 MB ✅

---

## Regression Verification

- ✅ Existing safety gate tests unaffected
- ✅ Export safety tests unaffected  
- ✅ Safe chapter replace tests unaffected
- ✅ New quality gate properly detects malformed grammar
- ✅ New quality gate correctly skips subjunctive constructions
- ✅ New quality gate detects slop variants
- ✅ New quality gate detects missing opening quotes
- ✅ Grammar repair auto-fixes deterministic patterns
- ✅ Grammar repair doesn't touch ambiguous cases
- ✅ Build compiles with all new imports
