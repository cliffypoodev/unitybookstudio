# 06 — Regression & Build Report

**Pipeline**: ANTI-CHATBOT-RECAST-PIPELINE v5.0  
**Date**: 2026-06-09

---

## Summary

| Metric | Value | Status |
|---|---|---|
| Recast test suites | 22 | ✅ |
| Recast tests | 479 | ✅ |
| Recast failures | **0** | ✅ |
| Safety gate tests | 364 | ✅ |
| Safety gate failures | **0** | ✅ |
| New test files | 4 | ✅ |
| New tests | 72 | ✅ |
| Build | Clean | ✅ |

---

## Recast Test Suites — 22 Suites / 479 Tests / 0 Failures

All 22 existing recast suites pass with the v5.0 pipeline version. No existing tests were broken by v5.0 changes.

```
22 suites   479 tests   0 failures   0 pending
```

Non-nonfiction profiles continue to use the unchanged v4 chunk pipeline path. The `skipNonfictionCleanup` option preserves backward compatibility for any caller that needs the pre-v5 behavior.

---

## New Test Files — 4 Files / 72 Tests

| # | File | Tests | Purpose |
|---|---|---|---|
| 1 | Nonfiction deterministic cleanup tests | 25 | Essay-bot removal, filter verb reduction, not-just simplification, weak opening fixes, citation safety, bibliography safety |
| 2 | Micro-recast unit splitting and eligibility tests | 20 | Paragraph classification, heading detection, list detection, citation-heavy detection, short unit detection, eligibility threshold |
| 3 | Micro-recast prompt building and validation tests | 15 | Prompt template generation, word count bounds, citation instruction inclusion, validation gate behavior |
| 4 | Pipeline integration and backward compatibility tests | 12 | Nonfiction path activation, non-nonfiction path unchanged, skipNonfictionCleanup option, version string verification |
| | **Total** | **72** | |

---

## Safety Gate Tests — 364 Tests / 0 Failures

| Suite | Tests | Failures | Status |
|---|---|---|---|
| referenceIntegrityGate | 155 | 0 | ✅ PASS |
| fullAuthorWorkflowRegression | 176 | 0 | ✅ PASS |
| manuscriptSafetyGate | 33 | 0 | ✅ PASS |
| **Total** | **364** | **0** | ✅ **ALL PASS** |

### referenceIntegrityGate (155 tests)
Validates that all reference-containing text is preserved through the pipeline. Tests cover:
- Citation parenthetical preservation
- Bibliography section protection
- Numbered reference `[N]` preservation
- Cross-reference link integrity
- Footnote/endnote stability

### fullAuthorWorkflowRegression (176 tests)
End-to-end regression tests covering the full author workflow:
- Multiple profile types (fiction, nonfiction, business_guide, etc.)
- Various text lengths and structures
- Edge cases (empty text, single paragraph, heading-only)
- Pipeline version compatibility
- Report structure validation

### manuscriptSafetyGate (33 tests)
High-level safety tests ensuring the pipeline never produces catastrophic output:
- No content deletion beyond safe thresholds
- No heading loss
- No citation loss
- No word count collapse
- Graceful error handling

---

## Regression Analysis

| Check | Result |
|---|---|
| Existing tests broken by v5.0 | **0** |
| Non-nonfiction profiles affected | **None** (unchanged v4 path) |
| Backward compatibility | ✅ `skipNonfictionCleanup` option available |
| API surface changes | None (additive exports only) |
| Import compatibility | ✅ All existing imports work |

The v5.0 changes are **strictly additive**:
- New module: `nonfictionAntiChatbotCleanup.js` (11 new exports)
- Modified module: `antiChatbotRecastPipeline.js` (new nonfiction path, version bump)
- No existing function signatures changed
- No existing behavior modified for non-nonfiction profiles

---

## Build Status

| Check | Status |
|---|---|
| Build | ✅ Clean |
| Lint errors | 0 |
| Type errors | 0 |
| Import resolution failures | 0 |
| Module exports verified | 11 named exports from `nonfictionAntiChatbotCleanup.js` |

### Verified Exports

```javascript
export {
  detectNonfictionWeaknesses,
  reduceEssayBotTransitions,
  reduceNonfictionFilterVerbs,
  reduceNotJustConstructions,
  strengthenNonfictionParagraphOpenings,
  preserveNonfictionStructure,
  runNonfictionDeterministicCleanup,
  splitNonfictionIntoMicroRecastUnits,
  shouldMicroRecastNonfictionUnit,
  buildNonfictionMicroRecastPrompt,
  runNonfictionMicroRecastPipeline,
};
```

---

## Test Coverage Summary

| Area | Tests | Status |
|---|---|---|
| Recast pipeline (all suites) | 479 | ✅ Full |
| Reference integrity | 155 | ✅ Full |
| Author workflow regression | 176 | ✅ Full |
| Manuscript safety | 33 | ✅ Full |
| Nonfiction-specific (new) | 72 | ✅ Full |
| **Grand Total** | **843+** | ✅ |

---

## Pipeline Version Verification

| Check | Value | Status |
|---|---|---|
| Pipeline version string | `ANTI-CHATBOT-RECAST-PIPELINE v5.0 — 2026-06-09` | ✅ |
| Version check test | PASS | ✅ |
| Backward compatibility test (`skipNonfictionCleanup`) | PASS | ✅ |
| Non-nonfiction profile routing test | PASS (uses v4 path) | ✅ |
