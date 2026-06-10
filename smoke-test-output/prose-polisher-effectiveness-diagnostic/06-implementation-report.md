# 06 — Implementation Report

**Date:** 2026-06-07

---

## Files Changed

### [NEW] `src/lib/prosePolishQualityGate.js` (330 lines)

Three exported functions:

1. **`runProsePolishQualityGate(text, options)`** — Post-polish validator
   - Detects 10 malformed grammar patterns with subjunctive exceptions
   - Detects missing opening quotes mid-paragraph
   - Counts 23 AI slop patterns
   - Returns structured result: `{ ok, malformed, quoteIssues, slopCounts, recommendedAction }`
   - Actions: `PASS` / `REPAIR_AGAIN` / `MANUAL_REVIEW` / `BLOCK_POLISH_SAVE`

2. **`runDeterministicGrammarRepair(text)`** — Auto-fixes safe grammar issues
   - "She were" → "She was" (unless subjunctive "as if she were")
   - "He were" → "He was" (unless subjunctive)
   - "They was" → "They were"
   - "Was was" → "Was"
   - "a obvious" → "an obvious"
   - "were was" → "was"
   - "was were" → "were"
   - Does NOT auto-fix ambiguous: "You was", "She was it", "He was it" (flag only)

3. **`repairMissingOpeningQuotes(text)`** — Inserts opening quotes
   - Detects `"\u201d SpeechText,\u201d she said` patterns (closing quote with no opener)
   - Inserts `\u201c` at the start of speech
   - Handles both curly and straight quotes

### [MODIFY] `src/pages/ProjectStudio.jsx`

- Added import for `prosePolishQualityGate.js` (L77)
- Added Step 12a: Deterministic grammar repair after all regex passes (L4452–4470)
- Added Step 12b: Missing opening quote repair (L4472–4490)
- Added Step 12c: Post-polish quality gate (L4492–4525)
  - BLOCK_POLISH_SAVE shows toast error and logs to console
  - `window.__UBS_LAST_POLISH_GATE` stores gate failures for debugging

### [MODIFY] `src/lib/punctuationPolish.js`

- Fixed case-sensitive backreference bug in duplicate word detector (L169–184)
- Changed from `\b(\w{2,})\s+(\1)\b` to `\b(\w{2,})\s+(\w{2,})\b` with explicit case-insensitive string comparison
- "Was was" is now correctly detected and collapsed to "Was"

### [NEW] `tests/prosePolisherQualityGate.test.mjs` (15 tests)

Unit tests covering:
- Malformed detection (She were, They was, Was was, a obvious, He were)
- Subjunctive exceptions (as if she/he were)
- Slop counting (wasn't just, didn't just, not just)
- Clean text pass-through
- Action determination (BLOCK_POLISH_SAVE, PASS)
- Quote issue detection
- Grammar repair idempotency

### [NEW] `tests/digitalEquityPolishRegression.mjs` (13 tests)

Regression tests using real v5 DOCX snippets:
- Ch5/6/13 malformed grammar
- Ch10/13/19 subjunctive exceptions
- Ch1 missing opening quote
- Post-gate action verification

---

## Architecture Decisions

1. **Grammar repair runs before quality gate.** This means the gate only flags residual issues that couldn't be auto-fixed. Chapters that CAN be repaired will pass.

2. **Subjunctive detection uses 20-char lookback.** Searching for "as if", "as though", or "if" before "he/she were" prevents false positives on correct English.

3. **Quality gate is informational on slop, blocking on malformed.** Slop counts above 50 trigger MANUAL_REVIEW (toast warning). Malformed grammar triggers BLOCK_POLISH_SAVE (toast error + console error).

4. **Duplicate word fix uses explicit comparison.** The original regex backreference `\1` was case-sensitive by JS spec. The fix uses two independent capture groups with `word1.toLowerCase() !== word2.toLowerCase()` comparison.

5. **Missing quote repair only acts on dialogue patterns.** Requires: closing quote + space + capitalized speech + comma/period + closing quote. This prevents false positives on narration.
