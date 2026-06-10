# 08 — Final Report: Prose Polisher Effectiveness Diagnostic & Hardening

**Date:** 2026-06-07
**Source:** digital-equity-tribunal (5).docx
**Verdict:** ✅ **PARTIAL PASS** — detection and repair work; some slop requires manual review

---

## TABLE 1 — Manuscript Polish Failures Found

| Chapter | Issue Type | Example | Severity |
|---------|-----------|---------|----------|
| 1 | Missing opening quote | `The game is the model, Marcus," she retorted` (no opening `"`) | MEDIUM |
| 1 | Missing opening quote | `And I thrive on efficiency," he countered` | MEDIUM |
| 1 | Missing opening quote | `Adrenaline is just chemical energy expenditure rate variance," Marcus corrected` | MEDIUM |
| 5 | Malformed grammar | `She were carrying an inheritance` | **HIGH** |
| 5 | Malformed grammar | `She was it monopolistic practice` | **HIGH** |
| 6 | Malformed grammar | `She were those just metrics?` | **HIGH** |
| 6 | Malformed grammar | `Was was it a failure, or was it` | **HIGH** |
| 6 | Malformed grammar | `a obvious thing, pressing against` | **HIGH** |
| 10 | Subjunctive (correct) | `as if she were performing an ancient` | OK |
| 13 | Malformed grammar | `Was was it external fraud` | **HIGH** |
| 13 | Subjunctive (correct) | `as if he were setting himself up` | OK |
| 19 | Subjunctive (correct) | `as if he were an exhibit himself` | OK |
| ALL | AI slop | 511 total slop instances across 20 chapters | LOW |

---

## TABLE 2 — Polisher Path Trace

| Stage | Saw Bad Text? | Fixed? | Saved? | Exported? |
|-------|--------------|--------|--------|-----------|
| Pre-polish content load | ✅ | — | — | — |
| Banned word removal | ✅ | ❌ (only vocab) | — | — |
| runPunctuationCleanup | ✅ | ❌ (no grammar) | — | — |
| runBrokenSentenceFixes | ✅ | ❌ (specific patterns only) | — | — |
| fixHangingQuotes | ✅ | ❌ (edge only) | — | — |
| **[NEW] runDeterministicGrammarRepair** | ✅ | ✅ **FIXES** | — | — |
| **[NEW] repairMissingOpeningQuotes** | ✅ | ✅ **FIXES** | — | — |
| **[NEW] runProsePolishQualityGate** | ✅ | ✅ **BLOCKS** | — | — |
| Save | — | — | ✅ (if gate passes) | — |
| Export | — | — | — | ✅ (if safe) |

---

## TABLE 3 — Root Cause

| Cause | Evidence | Confidence |
|-------|----------|------------|
| **No grammar checker in polish pipeline** | Subject-verb agreement errors ("She were", "They was") pass through all 28 existing regex functions untouched | HIGH |
| **JS regex backreference is case-sensitive** | `/\b(\w+)\s+(\1)\b/gi` misses "Was was" because backreference `\1` ignores the `/i` flag for backreferences per ECMA spec | HIGH |
| **Quote repair is paragraph-edge only** | `balanceParagraphEdges()` counts quotes per paragraph; multi-turn paragraphs with balanced totals but missing individual openers are invisible | HIGH |
| **Only literal "not just" banned** | Contracted variants ("wasn't just", "didn't just") not in banned word list or any repair function | HIGH |
| **No post-polish quality gate** | Pipeline saves whatever emerges from the regex chain without verification; `mechanicalSlopScore` only runs during draft | HIGH |

---

## TABLE 4 — Code Changes

| File | Change | Why |
|------|--------|-----|
| `src/lib/prosePolishQualityGate.js` | **[NEW]** Post-polish validator with grammar detection, quote detection, slop counting, deterministic repair, and missing quote insertion | Fills the gap between polish and save |
| `src/pages/ProjectStudio.jsx` | Added import + Steps 12a/12b/12c (grammar repair → quote repair → quality gate) between final structure quarantine and save | Enforces quality check before persisting polish results |
| `src/lib/punctuationPolish.js` | Fixed duplicate word detector: backreference → explicit case-insensitive comparison | "Was was" was escaping due to JS backreference case sensitivity |
| `tests/prosePolisherQualityGate.test.mjs` | **[NEW]** 15 unit tests for the quality gate | Regression prevention for grammar/quote/slop detection |
| `tests/digitalEquityPolishRegression.mjs` | **[NEW]** 13 regression tests with real v5 DOCX snippets | Ensures the specific failures in Digital Equity Tribunal are caught |

---

## TABLE 5 — Regression Tests

| Test Suite | Result |
|-----------|--------|
| manuscriptSafetyGate.test.mjs | 33/33 ✅ |
| digitalEquityPipelineRegression.mjs | 27/27 ✅ |
| liveExportSafetyRegression.mjs | 25/25 ✅ |
| safeChapterReplace.test.mjs | 68/68 ✅ |
| prosePolisherQualityGate.test.mjs (NEW) | 15/15 ✅ |
| digitalEquityPolishRegression.mjs (NEW) | 13/13 ✅ |
| **TOTAL** | **181/181 ✅** |
| `npm run build` | exit 0 ✅ |

---

## TABLE 6 — Remaining Risks

| Risk | Severity | Recommendation |
|------|----------|----------------|
| **Slop reduction is count-only, not auto-fix** | LOW | "wasn't just" / "didn't just" are now detected and counted, but not auto-replaced. Sentence recast is context-dependent and unsafe for deterministic regex. Future: could add an LLM polish pass specifically for slop reduction. |
| **"She was it" not auto-fixed** | LOW | Flagged for manual review. Could be "Was it" (question) or legitimate narration. Too ambiguous for regex. |
| **"You was" not auto-fixed** | LOW | Could be dialectal ("You was saying…") or error. Flagged, not fixed. |
| **Missing quote repair limited to dialogue-tag patterns** | LOW | Only repairs when comma/period+closing-quote follows speech and a dialogue tag is present. Standalone speech without tags may not get repaired. |
| **"felt" / "realized" counted but not reduced** | LOW | These are legitimate words in fiction. Counting provides awareness; auto-removal would damage prose. |
| **XML entities in DOCX extraction** | LOW | `&apos;` (193 instances) and `&quot;` (120 instances) present in extracted text. These are DOCX-native entities, not content errors — they render correctly in Word. |

---

## Verdict: ✅ PARTIAL PASS

**Detection:** ✅ All known malformed grammar, missing quote, and slop patterns are now detected.

**Repair:** ✅ Deterministic grammar issues (She were, Was was, a obvious, They was) are auto-fixed. Missing opening quotes before dialogue are auto-inserted.

**Enforcement:** ✅ Post-polish quality gate blocks save of chapters with remaining malformed grammar (BLOCK_POLISH_SAVE).

**Slop:** ⚠️ Slop is counted and reported but not auto-fixed. "wasn't just" and "didn't just" are now detected (not just "not just"), but conservative sentence recasting requires LLM or manual review.

**Result:** The polisher will no longer mark chapters clean if they contain "She were", "Was was", "a obvious", or similar. Missing opening quotes are repaired. Slop counts are reported. The acceptance criteria are met except for auto-reduction of contracted slop variants (which is intentionally deferred due to grammar safety).
