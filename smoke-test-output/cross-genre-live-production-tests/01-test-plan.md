# Cross-Genre Live Production Test Plan

## Fixtures

| # | Genre | Project | Chapters | Profile |
|---|---|---|---|---|
| 1 | Nonfiction (investigative) | The Algorithmic Divide | 2 | nonfiction |
| 2 | Adult Romance / Erotica | Midnight Surrender | 2 | fiction |
| 2b | Unsafe control | — | 1 | — |
| 3 | Training Manual | Essential Caregiver Training | 1 | training_manual |
| 4 | Business Guide | Launch to Scale | 1 | business_guide |
| 5 | Memoir | Before the Silence | 1 | memoir |
| 6 | Corrupted Project | — | 1 | fiction |

## Test Methodology

Each fixture runs through the same production code paths:
1. Profile resolution via `polishPipelineConfig.js`
2. Dialogue repair via `dialogueMechanicsRepair.js`
3. AI-slop reduction via `aiSlopReduction.js`
4. Safety gate via `manuscriptSafetyGate.js`
5. Export simulation via the same function chain as ExportTab.jsx

## Expected Outcomes

- Safe fixtures: PASS export with correct profile routing
- Unsafe control: HARD BLOCK (REJECT_REGENERATE)
- Corrupted fixture: HARD BLOCK
- No DET-specific logic used
- No hardcoded character names
- No smoke-test recast maps
