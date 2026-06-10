# Regression Lock Report

## Release Command

```bash
npm run test:polish-pipeline
```

## Included Suites

| Suite | File | Included? | Result | Tests | Status |
|---|---|---|---|---|---|
| Production Wiring Smoke | productionWiringSmoke.test.mjs | ✅ Yes | PASS | 143 | ✅ |
| Global Pipeline Regression | globalPolishPipelineRegression.test.mjs | ✅ Yes | PASS | 66 | ✅ |
| AI-Slop Reduction | aiSlopReduction.test.mjs | ✅ Yes | PASS | 24 | ✅ |
| Export-Resolved Dialogue | exportResolvedDialogueEnforcement.test.mjs | ✅ Yes | PASS | 60 | ✅ |
| Dialogue Mechanics | dialogueMechanicsRepair.test.mjs | ✅ Yes | PASS | 23 | ✅ |
| Safe Chapter Replace | safeChapterReplace.test.mjs | ✅ Yes | PASS | 67 | ✅ |
| Polish Path Regression | prosePolisherDialogueSlopRegression.mjs | ✅ Yes | PASS | 38 | ✅ |
| Export Safety Regression | liveExportSafetyRegression.mjs | ✅ Yes | PASS | 25 | ✅ |
| Quality Gate | prosePolisherQualityGate.test.mjs | ✅ Yes | PASS | 15 | ✅ |
| Manuscript Safety Gate | manuscriptSafetyGate.test.mjs | ✅ Yes | PASS | 33 | ✅ |
| LLM Prose Polisher | llmProsePolisher.test.mjs | ✅ Yes | PASS | 13 | ✅ |
| Production Build | `npm run build` (Vite) | ✅ Yes | PASS | — | ✅ |
| **TOTAL** | **12 suites** | **All included** | **ALL PASS** | **507** | **✅** |

## Lock Verification

| Check | Status |
|---|---|
| All 12 suites in `test:polish-pipeline` | ✅ Verified |
| Production wiring smoke tests first in command | ✅ |
| Build runs last (catches import errors) | ✅ |
| No skipped suites | ✅ |
| No disabled critical safety tests | ✅ |
| No unsafe override required | ✅ |
| No DET-specific tests skipped | ✅ |
| Cross-project fixtures tested (fiction, NF, training, business, memoir, unknown, corrupted) | ✅ |

## Acceptance: PASS ✅

The `npm run test:polish-pipeline` command:
1. Runs all 507 tests across 11 test suites
2. Builds the production bundle
3. Completes in ~10 seconds
4. Catches regressions in profile routing, dialogue repair, slop reduction, safety gates, export safety, chapter replacement, and build integrity
