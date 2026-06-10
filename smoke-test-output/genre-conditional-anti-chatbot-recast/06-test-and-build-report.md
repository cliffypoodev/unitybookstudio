# Test and Build Report

## New Test Suites — 186 Tests, 0 Failures

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| `genreConditionalAntiChatbotRules` | 65 | 65 | 0 |
| `antiChatbotRecastPipeline` | 34 | 34 | 0 |
| `nonfictionAntiChatbotRegressionGuard` | 55 | 55 | 0 |
| `antiChatbotChunkProtection` | 17 | 17 | 0 |
| `antiChatbotRecastSafetyWiring` | 15 | 15 | 0 |
| **Total new** | **186** | **186** | **0** |

## Existing Regression Suites — 0 Regressions

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| `antiChatbotProseQuality` | 40 | 40 | 0 |
| `liveAntiChatbotBakeoff` | — | all | 0 |
| `liveOllamaAntiChatbotCompliance` | — | all | 0 |
| `globalPolishPipelineRegression` | 66 | 66 | 0 |
| `fullAuthorWorkflowRegression` | 176 | 176 | 0 |
| `manuscriptSafetyGate` | 33 | 33 | 0 |

## Build

```
npx vite build
```

**Result:** Clean — no errors, no warnings.
