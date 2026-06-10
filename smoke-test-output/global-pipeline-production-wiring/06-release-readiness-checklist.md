# Release Readiness Checklist

## Release Command

```bash
npm run test:polish-pipeline
```

## Command Sequence

```bash
node tests/productionWiringSmoke.test.mjs        # 143 tests: profile routing + project-type smoke
node tests/globalPolishPipelineRegression.test.mjs  # 66 tests: cross-project fixture regression
node tests/aiSlopReduction.test.mjs               # 24 tests: slop patterns + budgets
node tests/exportResolvedDialogueEnforcement.test.mjs # 60 tests: export-resolved dialogue repair
node tests/dialogueMechanicsRepair.test.mjs        # 23 tests: missing quote detection/repair
node tests/safeChapterReplace.test.mjs             # 67 tests: safe replacement + safety gate
node tests/prosePolisherDialogueSlopRegression.mjs # 38 tests: polish path regression
node tests/liveExportSafetyRegression.mjs          # 25 tests: export safety gate
node tests/prosePolisherQualityGate.test.mjs       # 15 tests: quality gate
node tests/manuscriptSafetyGate.test.mjs           # 33 tests: manuscript safety gate
node tests/llmProsePolisher.test.mjs               # 13 tests: LLM polisher
npm run build                                      # Vite production build
```

## Checklist

| Check | Command/File | Status |
|---|---|---|
| Production wiring smoke tests | productionWiringSmoke.test.mjs | ✅ 143/143 |
| Cross-project regression | globalPolishPipelineRegression.test.mjs | ✅ 66/66 |
| AI-slop reduction tests | aiSlopReduction.test.mjs | ✅ 24/24 |
| Export dialogue enforcement | exportResolvedDialogueEnforcement.test.mjs | ✅ 60/60 |
| Dialogue mechanics repair | dialogueMechanicsRepair.test.mjs | ✅ 23/23 |
| Safe chapter replace | safeChapterReplace.test.mjs | ✅ 67/67 |
| Polish path regression | prosePolisherDialogueSlopRegression.mjs | ✅ 38/38 |
| Export safety regression | liveExportSafetyRegression.mjs | ✅ 25/25 |
| Quality gate tests | prosePolisherQualityGate.test.mjs | ✅ 15/15 |
| Manuscript safety gate | manuscriptSafetyGate.test.mjs | ✅ 33/33 |
| LLM polisher tests | llmProsePolisher.test.mjs | ✅ 13/13 |
| Production build | npm run build | ✅ Clean |
| **TOTAL** | **12 suites** | **507/507 + build** ✅ |
