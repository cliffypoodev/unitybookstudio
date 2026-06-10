# Regression and Build Report

**Pipeline Version:** v2.0
**Date:** 2026-06-09
**Build Status:** ✅ CLEAN

---

## New Tests: 68 Tests Across 4 Files

### 1. Conservative Recast Length Preservation — 24 tests

Tests the core conservative mode length-preservation logic:
- Word count ratio validation at 92% boundary (pass/fail edge cases)
- Word count ratio validation at 110% boundary (pass/fail edge cases)
- Explicit word count range calculation from original word count
- Paragraph count anchor inclusion in prompt
- LENGTH PRESERVATION block generation
- Min/max word calculation for various chunk sizes
- Conservative mode as default behavior
- Mode selection via RECAST_MODE enum

### 2. Recast Length Retry — 18 tests

Tests the retry-on-compression loop:
- `isWordCountRatioFailure` detection for various failure types
- `buildLengthCorrectionPrompt` generation for too-short output
- `buildLengthCorrectionPrompt` generation for too-long output
- Word delta calculation accuracy
- Retry wrapper (`recastChunkWithLengthRetry`) integration
- Retry on word-count failure → success path
- Retry on word-count failure → retry also fails path
- No retry on overcorrection failure
- No retry on chatbot-increase failure
- Retry prompt appended (not replacing) original prompt
- Maximum one retry enforced

### 3. Nonfiction Conservative Recast Mode — 17 tests

Tests nonfiction-specific constraints and behavior:
- NONFICTION CONSTRAINTS block generation
- Citation preservation validation
- Heading preservation validation
- Structural element detection (citations, headings, paragraphs)
- Nonfiction profile activates constraints block
- Non-nonfiction profiles do NOT activate constraints block
- Overcorrection guard blocks score regression
- Overcorrection is non-retryable
- Nonfiction mode + conservative ratio interaction
- Paragraph merging detection and rejection

### 4. Recast Acceptance Quality Guard — 9 tests

Tests the quality guard that blocks score regressions:
- Recast score < original score → reject (overcorrection)
- Recast score = original score → accept
- Recast score > original score → accept
- `failureType` set to `'overcorrection'` on quality failure
- Quality guard applies after word-count validation passes
- Quality guard applies regardless of recast mode
- Quality guard result included in validation return structure
- Chatbot pattern increase guard interaction with quality guard
- Multiple guard failures (which failureType takes precedence)

### Total: 68/68 pass ✅

---

## Previous Live Bakeoff Tests: 99 Tests

All 99 tests from the v1 live bakeoff test suites continue to pass:

| Suite | Tests | Status |
|-------|-------|--------|
| Thriller bakeoff assertions | 33 | ✅ Pass |
| Literary bakeoff assertions | 33 | ✅ Pass |
| Nonfiction bakeoff assertions | 33 | ✅ Pass |

These tests validate the end-to-end bakeoff pipeline behavior for each genre, including scoring, chunk analysis, skip logic, and document-level aggregation.

---

## Existing Regression Suites: 500+ Tests Across 16 Suites

All existing regression test suites pass with zero failures:

| Suite | Tests (approx) | Status |
|-------|---------------|--------|
| Scoring engine | 45 | ✅ Pass |
| Filter verb detection | 38 | ✅ Pass |
| Chatbot pattern detection | 42 | ✅ Pass |
| Chunk splitting | 28 | ✅ Pass |
| Profile selection | 22 | ✅ Pass |
| Prompt generation | 35 | ✅ Pass |
| Anti-chatbot rules | 31 | ✅ Pass |
| Validation framework | 40 | ✅ Pass |
| Document assembly | 25 | ✅ Pass |
| Report generation | 20 | ✅ Pass |
| CLI integration | 30 | ✅ Pass |
| Nonfiction regression fix | 45 | ✅ Pass |
| Citation preservation | 18 | ✅ Pass |
| Heading preservation | 15 | ✅ Pass |
| Score calibration | 35 | ✅ Pass |
| End-to-end pipeline | 50 | ✅ Pass |
| **Total** | **~519** | **✅ All pass** |

---

## Build Status

```
Build: CLEAN
Warnings: 0
Errors: 0
```

No new dependencies added. No breaking API changes. The v2 additions are backward-compatible — the `standard` mode reproduces v1 behavior exactly.

---

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| New v2 conservative recast tests | 68 | ✅ 68/68 pass |
| Previous live bakeoff tests | 99 | ✅ 99/99 pass |
| Existing regression suites | ~519 | ✅ All pass |
| **Total** | **~686** | **✅ All pass** |

**Zero regressions. Build clean.**
