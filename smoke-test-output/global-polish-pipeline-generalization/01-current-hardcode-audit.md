# Current Hardcode Audit

## Production Runtime Files Audited

| File | Hardcoded Item | Before | After | Action |
|---|---|---|---|---|
| aiSlopReduction.js | Mira, Elena, Marcus, Kai, Zara, Aether, Julian in felt regex | ✅ Found | ✅ Removed | Replaced with generic [A-Z][a-z]{1,15} |
| dialogueMechanicsRepair.js | SPEAKER_NAMES: Aether, Marcus, Elena, Zara, Kai, Mira, Julian | ✅ Found | ✅ Removed | Replaced with generic speaker types |
| llmSentenceRecast.js | All DET names in 3 regex patterns | ✅ Found | ✅ Removed | Replaced with generic [A-Z][a-z]{1,15} |
| prosePolishQualityGate.js | "Aether were" grammar check | ✅ Found | ✅ Generalized | Generic proper-noun + were |
| prosePolishQualityGate.js | DET names in closeTagRx (2 patterns) | ✅ Found | ✅ Removed | Kept only generic catch-all |
| exportSafetyGate.js | DET names in closeTagRx (2 patterns) | ✅ Found | ✅ Removed | Kept only generic catch-all |
| manuscriptSafetyGate.js | "Aether were" malformed check | ✅ Found | ✅ Generalized | Generic proper-noun + were |
| manuscriptSafetyGate.js | DET names in anti-contamination prompt | ✅ Found | ✅ Generalized | Generic description |
| llmProsePolisher.js | Unity contamination regex (runtime) | ⚠️ Still present | ⚠️ Acceptable | These are universal contamination patterns, not project-specific |
| polishPipelineConfig.js | (New file) | — | ✅ Created | Generic project-agnostic config |

## Post-Refactor Verification

| Pattern | Matches in Production Runtime |
|---|---|
| Mira | **0** ✅ |
| Marcus | **0** ✅ |
| Elena | **0** ✅ |
| Aether | **0** ✅ |
| Julian | **0** ✅ |
| Priya | **0** ✅ |
| Darius | **0** ✅ |
| Ravi | **0** ✅ |
| NexusStream | **0** ✅ |
| Brennan | **0** ✅ |
| Digital Equity | **0** ✅ |

## Remaining Acceptable References

- `Unity Supported Living` in manuscriptSafetyGate.js: These are **cross-project contamination canaries**, not DET-specific. They detect real-world business entity leakage and protect ALL projects.
- `Chapter 1` / `Chapter 2` in ProjectStudio.jsx and ExportTab.jsx: These are **manuscript-specific collision guards** for the DET anthology; they only fire for that specific project and do not affect other projects.
