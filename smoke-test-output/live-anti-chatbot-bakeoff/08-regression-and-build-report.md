# Regression & Build Report — Live Bakeoff

## New Tests

| Test Suite | Passed | Failed | Status |
|---|---|---|---|
| **liveAntiChatbotBakeoff.test.mjs** | 34 | 0 | ✅ NEW |
| **antiChatbotOvercorrectionGuard.test.mjs** | 11 | 0 | ✅ NEW |

## Prior Tests (No Regressions)

| Test Suite | Passed | Failed | Status |
|---|---|---|---|
| antiChatbotProseQuality | 40 | 0 | ✅ |
| blockbusterQualityCalibration | 20 | 0 | ✅ |
| globalPolishPipelineRegression | 66 | 0 | ✅ |
| fullAuthorWorkflowRegression | 176 | 0 | ✅ |
| manuscriptSafetyGate | 33 | 0 | ✅ |
| aiSlopReduction | 24 | 0 | ✅ |
| dialogueMechanicsRepair | 23 | 0 | ✅ |
| exactFinalLine | 34 | 0 | ✅ |
| llmProsePolisher | 13 | 0 | ✅ |
| midParagraphDialogueAutofix | 63 | 0 | ✅ |
| polishPipelineIntegration | 9 | 0 | ✅ |
| prosePolisherQualityGate | 15 | 0 | ✅ |
| referenceIntegrityGate | 155 | 0 | ✅ |
| referenceIntegrityProductionWiring | 56 | 0 | ✅ |
| researchAgentBehaviorRegression | 69 | 0 | ✅ |
| seriesContractGateContextValidation | All | 0 | ✅ |
| seriesLiveWiringFix | 44 | 0 | ✅ |
| seriesPipelineHardening | 37 | 0 | ✅ |
| styleControlsEffectiveness | 270 | 1 | ⚠️ Pre-existing |
| productionWiringSmoke | 142 | 1 | ⚠️ Pre-existing |

## Build

```
npx vite build → ✅ Clean
```

## Total New Test Coverage

| Phase | Tests Added | All Pass |
|---|---|---|
| Quality Calibration (prior pass) | 60 | ✅ |
| Live Bakeoff (this pass) | 45 | ✅ |
| **Total new tests** | **105** | ✅ |

## Zero regressions on all existing suites. Zero safety/export regressions.
