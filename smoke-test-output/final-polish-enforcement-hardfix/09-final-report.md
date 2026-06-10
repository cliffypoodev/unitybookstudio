# 09 — Final Report: Polish Enforcement Hardfix

**Date:** 2026-06-07

---

## Verdict: ✅ PASS WITH MANUAL REVIEW

Hard failures are now detected AND blocked at save time. The quality gate, export safety gate, and deterministic repair all work correctly. Some garbled phrases (`She was it monopolistic`, `Aether were they`) require LLM or manual rewrite — they can't be auto-repaired but they ARE correctly blocked.

---

## TABLE 1 — DOCX6 Failure Scan

| Chapter | Issue | Example | Gate Expected | Actual Before Fix |
|---------|-------|---------|---------------|-------------------|
| Ch.1 | Missing opening quote | `The game is the model, Marcus,"` | BLOCK | MANUAL_REVIEW (no block) |
| Ch.1 | Missing opening quote | `And I thrive on efficiency,"` | BLOCK | MANUAL_REVIEW (no block) |
| Ch.5 | Verb agreement | `She were carrying` | BLOCK | BLOCK (but save continued) |
| Ch.5 | Garbled phrase | `She was it monopolistic` | BLOCK | BLOCK (but save continued) |
| Ch.6 | Garbled phrase | `She were those just metrics` | BLOCK | Not detected |
| Ch.6 | Garbled phrase | `Aether were they` | BLOCK | Not detected |
| Ch.6 | Article error | `a obvious thing` | BLOCK | BLOCK (but save continued) |
| Ch.7 | Doubled word | `Was was it a failure` | BLOCK | BLOCK (but save continued) |

## TABLE 2 — Runtime Polish Trace

| Chapter | LLM Called | Fallback | Gate Result | Saved (before fix) | Notes |
|---------|-----------|----------|-------------|---------------------|-------|
| Ch.1 | Unknown | Likely | REPAIR_AGAIN | YES ← BUG | quote-only failure not blocking |
| Ch.5 | Unknown | Likely | BLOCK_POLISH_SAVE | YES ← BUG | save loop ignored gate |
| Ch.6 | Unknown | Likely | BLOCK_POLISH_SAVE | YES ← BUG | save loop ignored gate |
| Ch.7 | Unknown | Likely | BLOCK_POLISH_SAVE | YES ← BUG | save loop ignored gate |
| Ch.9 | Unknown | Likely | MANUAL_REVIEW | YES | quote issues only, below threshold |

## TABLE 3 — Root Cause

| Cause | Evidence | Confidence |
|-------|----------|------------|
| Save loop ignored BLOCK_POLISH_SAVE | `ProjectStudio.jsx:4577-4604` — toast only, no chapter exclusion | 100% |
| Quality gate `REPAIR_AGAIN` for >3 quote issues not blocking | `prosePolishQualityGate.js:206` | 100% |
| Export safety gate missing verb-agreement patterns | `manuscriptSafetyGate.js:373-385` | 100% |
| Quality gate missing `Aether were`, `were those just` | `prosePolishQualityGate.js:26-88` | 100% |

## TABLE 4 — Code Changes

| File | Change | Why |
|------|--------|-----|
| `prosePolishQualityGate.js` | `quoteIssues > 3` → `BLOCK_POLISH_SAVE` | Quote-heavy chapters must be blocked |
| `prosePolishQualityGate.js` | Added `aether-were`, `were-those-just` patterns | Catch garbled text |
| `prosePolishQualityGate.js` | Added `rule` field to repair log | Debugging |
| `ProjectStudio.jsx` | Save loop reverts blocked chapters to original | **PRIMARY FIX** — stops bad content from saving |
| `manuscriptSafetyGate.js` | Added 7 malformed canaries (She were, a obvious, etc.) | Export safety catches verb agreement |
| `tests/finalPolishEnforcementRegression.mjs` | New (25 tests) | Regression coverage for all DOCX6 failures |
| `tests/safeChapterReplace.test.mjs` | Updated Test 12 expectations | Old chapters now correctly caught |

## TABLE 5 — Regression Tests

| Suite | Count | Result |
|-------|-------|--------|
| manuscriptSafetyGate.test.mjs | 33 | ✅ |
| digitalEquityPipelineRegression.mjs | 27 | ✅ |
| liveExportSafetyRegression.mjs | 25 | ✅ |
| safeChapterReplace.test.mjs | 68 | ✅ |
| prosePolisherQualityGate.test.mjs | 15 | ✅ |
| digitalEquityPolishRegression.mjs | 13 | ✅ |
| llmProsePolisher.test.mjs | 13 | ✅ |
| polishPipelineIntegration.test.mjs | 9 | ✅ |
| **finalPolishEnforcementRegression.mjs** | **25** | ✅ |
| **TOTAL** | **228** | **✅ 228/228** |
| `npm run build` | — | exit 0 ✅ |

## TABLE 6 — Target Chapter Post-Fix Results

| Chapter | Before Issues | After Fix: Detected? | After Fix: Blocked? | Auto-Repairable? | Status |
|---------|--------------|---------------------|---------------------|-------------------|--------|
| Ch.1 | 2 missing quotes, 63 slop | ✅ 5 quote issues detected | ✅ BLOCK_POLISH_SAVE | ✅ quote repair works | BLOCKED |
| Ch.5 | She were, She was it | ✅ 2 malformed detected | ✅ BLOCK_POLISH_SAVE | Partial (She were only) | BLOCKED |
| Ch.6 | She were, Aether were, a obvious | ✅ 4 malformed detected | ✅ BLOCK_POLISH_SAVE | Partial | BLOCKED |
| Ch.7 | Was was | ✅ 1 malformed detected | ✅ BLOCK_POLISH_SAVE | ✅ Was was → Was | BLOCKED |
| Ch.9 | 4 quote issues, 49 slop | ✅ 4 quote issues detected | ✅ BLOCK_POLISH_SAVE | ✅ quote repair works | BLOCKED |

## TABLE 7 — Remaining Risks

| Risk | Severity | Recommendation |
|------|----------|----------------|
| `She was it monopolistic` not auto-repairable | Medium | Requires LLM polish or manual edit. Gate correctly blocks save. |
| `Aether were they` not auto-repairable | Medium | Requires LLM or manual edit. Gate correctly blocks save. |
| Polish save path doesn't clear stale fields like safe replace | Low | Add `clearStaleChapterContentFields()` to standard polish save for belt-and-suspenders safety |
| Slop count >50 only gets MANUAL_REVIEW | Low | Consider adding slop threshold as save blocker in future |
| LLM polisher may not be running (Ollama offline) | Low | Graceful fallback to deterministic. Bad text blocked by gates. |

---

## Acceptance Criteria

| Criterion | Met? |
|-----------|------|
| (6).docx failures detected by gates | ✅ All 8 failures detected |
| Hard malformed/quote issues cannot save as "polished" | ✅ Save loop reverts blocked chapters |
| Export does not use old bad content | ✅ Export safety gate now catches verb-agreement failures |
| Target chapters 1, 5, 6, 7 are blocked after fixed polish | ✅ All blocked |
| Tests pass | ✅ 228/228 |
| Build passes | ✅ exit 0 |
