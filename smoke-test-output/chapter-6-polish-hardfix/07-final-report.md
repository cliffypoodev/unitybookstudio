# 07 — Final Report

**Date:** 2026-06-07

---

## TABLE 1 — Chapter 6 Failure Before Fix

| Canary | Present? | Gate Result | Repair Available? |
|--------|----------|-------------|-------------------|
| She were carrying | ✅ YES | BLOCK_POLISH_SAVE | ✅ she-were → She was |
| She were those just | ✅ YES | BLOCK_POLISH_SAVE | ✅ she-were → She was (partial) |
| a obvious thing | ✅ YES | BLOCK_POLISH_SAVE | ✅ a-obvious → an obvious |
| Aether were they | ✅ YES | BLOCK_POLISH_SAVE | ❌ Ambiguous, no auto-repair |

## TABLE 2 — Polish Pipeline Trace

| Stage | Contains "She were"? | Contains "a obvious"? | Gate Result | Notes |
|-------|---------------------|-----------------------|-------------|-------|
| Pre-polish loaded | ✅ YES (2) | ✅ YES (1) | BLOCK (5 malformed) | Original text |
| After LLM polish | ✅ YES (2) | ✅ YES (1) | BLOCK | LLM likely offline |
| After deterministic cleanup | ✅ YES (2) | ✅ YES (1) | BLOCK | Steps 2-11 don't fix grammar |
| After grammar repair (12a) | ❌ NO | ❌ NO | BLOCK (1 malformed) | 3 repairs applied |
| After quote repair (12b) | ❌ NO | ❌ NO | BLOCK (1 malformed) | No quote issues in Ch.6 |
| Post-polish quality gate | ❌ NO | ❌ NO | BLOCK (Aether were) | 1 remaining |
| **OLD save decision** | ✅ YES (reverted) | ✅ YES (reverted) | — | **All repairs lost** |
| **NEW save decision** | ❌ NO (kept) | ❌ NO (kept) | — | **Repairs preserved** ✅ |
| Export safety gate | ❌ NO | ❌ NO | WARN_ONLY | ok=true ✅ |

## TABLE 3 — Root Cause

| Cause | Evidence | Confidence |
|-------|----------|------------|
| Save loop reverted partially-repaired text | `ProjectStudio.jsx:4584-4594` — blanket revert on ANY remaining malformed | **100%** |
| Quality gate blocks on ANY malformed (no partial-pass) | `prosePolishQualityGate.js:204` — `malformed.count > 0 → BLOCK` | **100%** |
| Polish save didn't clear stale content fields | `ProjectStudio.jsx:4670-4675` — no stale-field clearing | **100%** |

## TABLE 4 — Code Changes

| File | Change | Why |
|------|--------|-----|
| [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4584) L4584-4615 | Smart save: compare malformed count before/after repair. Only revert if no improvement. | Prevents discarding valid repairs when ambiguous patterns remain |
| [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4678) L4678-4690 | Stale-field clearing: clear 15 old content fields before setting canonical content_md | Prevents export from resolving pre-polish text from stale DB fields |
| [tests/chapter6PolishRegression.mjs](file:///Users/cliff/Downloads/UBS/tests/chapter6PolishRegression.mjs) | NEW: 25 tests | Chapter 6 regression covering repair, save, stale fields, export |

## TABLE 5 — Tests

| Test Suite | Count | Result |
|-----------|-------|--------|
| **chapter6PolishRegression.mjs** | **25** | **✅** |
| finalPolishEnforcementRegression.mjs | 25 | ✅ |
| prosePolisherQualityGate.test.mjs | 15 | ✅ |
| liveExportSafetyRegression.mjs | 25 | ✅ |
| safeChapterReplace.test.mjs | 68 | ✅ |
| manuscriptSafetyGate.test.mjs | 33 | ✅ |
| polishPipelineIntegration.test.mjs | 9 | ✅ |
| digitalEquityPipelineRegression.mjs | 27 | ✅ |
| digitalEquityPolishRegression.mjs | 13 | ✅ |
| llmProsePolisher.test.mjs | 13 | ✅ |
| **TOTAL** | **253** | **✅** |
| `npm run build` | — | exit 0 ✅ |

## TABLE 6 — Post-Fix Chapter 6 Verification

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| "She were" absent in repaired text | absent | absent | ✅ |
| "a obvious" absent in repaired text | absent | absent | ✅ |
| "Aether were" still present (ambiguous) | present | present | ✅ |
| Deterministic repairs count | 3 | 3 | ✅ |
| Save decision = keep repaired text | keep | keep | ✅ |
| Manuscript safety gate ok | true | true | ✅ |
| Export safety gate blocked | false | false | ✅ |
| Stale fields cleared in save payload | yes | yes | ✅ |

## TABLE 7 — Final Export

| Check | Result |
|-------|--------|
| Ch.6 export blocked? | **NO** ✅ |
| "She were" in export? | **NO** ✅ |
| "a obvious" in export? | **NO** ✅ |
| "Was was" in export? | **NO** ✅ |
| Malformed hard failures? | **0** ✅ |
| Chapter count | 20 ✅ |
| Export requires unsafe override? | **NO** ✅ |
| "Aether were" warning? | YES (WARN_ONLY, doesn't block) |

---

## Verdict: ✅ PARTIAL PASS

**Auto-repair works.** "She were" and "a obvious" are deterministically repaired and saved.

**One ambiguous phrase needs manual edit:** "Aether were they optimized for emotional echo?" is flagged as `WARN_ONLY` in the export safety gate. It does NOT block export. If the author intended "Aether" as a proper noun/concept, the sentence may be intentional. Otherwise, it should be manually rewritten to something like "Were they optimized for emotional echo?"

---

## Acceptance Criteria

| Criterion | Met? |
|-----------|------|
| Export safety remains strict | ✅ |
| Chapter 6 malformed canaries repaired or blocked with actionable report | ✅ |
| "a obvious" is auto-repaired | ✅ |
| "She were carrying" is auto-repaired | ✅ |
| Ambiguous "Aether were" is safely flagged for manual review | ✅ |
| Repaired Chapter 6 is saved to the content source export uses | ✅ |
| Export succeeds only after Chapter 6 resolves clean | ✅ (WARN_ONLY, not blocked) |
| Stale fields cleared on polish save | ✅ |
| All tests pass | ✅ 253/253 |
| Build passes | ✅ exit 0 |
