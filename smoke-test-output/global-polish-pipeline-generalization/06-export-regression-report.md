# Export Regression Report

## Existing Test Suites — Post-Generalization

| Suite | Before | After | Delta |
|---|---|---|---|
| aiSlopReduction.test.mjs | 24/24 | 24/24 | 0 |
| exportResolvedDialogueEnforcement.test.mjs | 60/60 | 60/60 | 0 |
| dialogueMechanicsRepair.test.mjs | 23/23 | 23/23 | 0 |
| safeChapterReplace.test.mjs | 67/67 | 67/67 | 0 (was 65/67 before proper-noun fix) |
| prosePolisherDialogueSlopRegression.mjs | 38/38 | 38/38 | 0 |
| liveExportSafetyRegression.mjs | 25/25 | 25/25 | 0 |
| prosePolisherQualityGate.test.mjs | 15/15 | 15/15 | 0 |
| manuscriptSafetyGate.test.mjs | 33/33 | 33/33 | 0 |
| llmProsePolisher.test.mjs | 13/13 | 13/13 | 0 |
| **TOTAL existing** | **298/298** | **298/298** | **0 regressions** |

## New Suite

| Suite | Result |
|---|---|
| globalPolishPipelineRegression.test.mjs | **66/66** ✅ |

## Grand Total: 364/364 ✅

## Export Path Checks

| Check | Status |
|---|---|
| Stale URL blocker | ✅ Still works |
| Safe chapter replacement | ✅ Still works |
| Export source trace | ✅ Still works |
| window.__UBS_LAST_EXPORT_SURFACE_REPORT | ✅ No project dependency |
| Pre-export dialogue repair | ✅ Now uses generic speaker matching |
| Export safety gate closeTagRx | ✅ No DET names |
