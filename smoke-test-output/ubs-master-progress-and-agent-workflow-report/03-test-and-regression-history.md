# UBS Test and Regression History

## Current Pipeline: `npm run test:polish-pipeline`

### Results: 1,241 passed, 0 failed — Build clean

| # | Suite File | Assertions | Purpose | Result |
|---|---|---|---|---|
| 1 | `productionWiringSmoke.test.mjs` | 143 | Module loading, function exports, pipeline connectivity | ✅ |
| 2 | `globalPolishPipelineRegression.test.mjs` | 66 | Profile routing, slop budgets, safety thresholds per genre | ✅ |
| 3 | `aiSlopReduction.test.mjs` | 24 | AI cliché detection/removal, budget compliance | ✅ |
| 4 | `exportResolvedDialogueEnforcement.test.mjs` | 60 | Export-path dialogue repair, safety gate integration | ✅ |
| 5 | `dialogueMechanicsRepair.test.mjs` | 23 | Missing quote detection, paragraph-start repair | ✅ |
| 6 | `midParagraphDialogueAutofix.test.mjs` | 63 | Mid-paragraph quote repair, classification, safety | ✅ |
| 7 | `fullAuthorWorkflowRegression.test.mjs` | 176 | End-to-end: draft→polish→replace→export→reload→re-export | ✅ |
| 8 | `researchAgentBehaviorRegression.test.mjs` | 69 | Genre-aware research routing, plausibility vs deep research | ✅ |
| 9 | `safeChapterReplace.test.mjs` | 67 | Safe replacement, verification, corrupted text rejection | ✅ |
| 10 | `prosePolisherDialogueSlopRegression.mjs` | 38 | Dialogue + slop combined pipeline regression | ✅ |
| 11 | `liveExportSafetyRegression.mjs` | 25 | Mixed manuscript safety, contamination blocking | ✅ |
| 12 | `prosePolisherQualityGate.test.mjs` | 15 | Post-polish quality scoring, pass/fail thresholds | ✅ |
| 13 | `manuscriptSafetyGate.test.mjs` | 33 | Process leak, contamination, malformed grammar detection | ✅ |
| 14 | `llmProsePolisher.test.mjs` | 13 | LLM prose polish orchestration, deterministic fallback | ✅ |
| 15 | `styleControlsEffectiveness.test.mjs` | 271 | Beat style, author voice, genre prompt verification | ✅ |
| 16 | `referenceIntegrityGate.test.mjs` | 155 | Citation crosscheck, formatting, suspicious refs, claims | ✅ |
| | **TOTAL** | **1,241** | | **✅** |

### Legacy/Standalone Tests (Not in Pipeline)

| File | Purpose |
|---|---|
| `chapter2SafeReplaceResolutionRegression.mjs` | Ch.2 safe replace (legacy) |
| `chapter6PolishRegression.mjs` | Ch.6 polish (legacy) |
| `digitalEquityPipelineRegression.mjs` | Project-specific pipeline |
| `digitalEquityPolishRegression.mjs` | Project-specific polish |
| `exactFinalLine.test.mjs` | Final line preservation |
| `finalPolishEnforcementRegression.mjs` | Final polish enforcement |
| `polishPipelineIntegration.test.mjs` | Pipeline integration |
| `staleUrlResolutionRegression.mjs` | Stale URL resolution |
