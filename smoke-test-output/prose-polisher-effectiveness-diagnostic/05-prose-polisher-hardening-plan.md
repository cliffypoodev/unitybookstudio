# 05 — Prose Polisher Hardening Plan

**Date:** 2026-06-07

---

## Root Causes

1. **No grammar checker** — subject-verb agreement errors pass through unchecked
2. **Case-sensitive backreference bug** — duplicate word detector misses "Was was"
3. **No mid-paragraph quote repair** — missing openers between speech turns invisible
4. **Incomplete slop banning** — only "not just" banned, not "wasn't just" etc.
5. **No post-polish quality gate** — bad text saved without verification

---

## Proposed Changes

### [NEW] `src/lib/prosePolishQualityGate.js`

A post-polish validator that returns structured results. Three exported functions:

#### `runProsePolishQualityGate(text, options)`
- Detects malformed grammar (She were, Was was, a obvious, etc.)
- Detects missing opening quotes mid-paragraph
- Counts AI slop patterns (not just, wasn't just, felt, realized, etc.)
- Returns `{ ok, malformed, quoteIssues, slopCounts, recommendedAction }`
- Actions: PASS / REPAIR_AGAIN / MANUAL_REVIEW / BLOCK_POLISH_SAVE

#### `runDeterministicGrammarRepair(text)`
- Fixes "She were" → "She was" (unless subjunctive: "as if she were")
- Fixes "He were" → "He was" (unless subjunctive)
- Fixes "They was" → "They were"
- Fixes "Was was" → "Was" (duplicate auxiliary)
- Fixes "a obvious" → "an obvious" (article agreement)
- Flags but doesn't auto-fix: "You was", "She was it"
- Returns `{ text, repairs: [...] }`

#### `repairMissingOpeningQuotes(text)`
- Detects dialogue turns that have closing quote but no opening quote
- Inserts opening quote at speech start
- Only repairs when dialogue tag follows (she said, he retorted, etc.)
- Returns `{ text, repairs: [...] }`

### [MODIFY] `src/pages/ProjectStudio.jsx`

Wire `runProsePolishQualityGate` and `runDeterministicGrammarRepair` into the polish pipeline at L4430 (after all regex passes, before save):

```javascript
// After all polish steps, before save:
import { runProsePolishQualityGate, runDeterministicGrammarRepair, repairMissingOpeningQuotes } from '../lib/prosePolishQualityGate.js';

// Step 12a: Grammar repair
for (const f of loaded) {
  const grammarResult = runDeterministicGrammarRepair(f.content);
  if (grammarResult.repairs.length > 0) {
    f.content = grammarResult.text;
    // Log repairs
  }
}

// Step 12b: Quote repair (mid-paragraph)
for (const f of loaded) {
  const quoteResult = repairMissingOpeningQuotes(f.content);
  if (quoteResult.repairs.length > 0) {
    f.content = quoteResult.text;
  }
}

// Step 12c: Post-polish quality gate
for (const f of loaded) {
  const gate = runProsePolishQualityGate(f.content, {
    chapterNumber: f.chapter?.chapter_number,
    stage: 'post-polish'
  });
  if (!gate.ok) {
    // Report failure, skip save for this chapter
    toast.error(`Ch.${f.chapter?.chapter_number}: polish quality gate FAIL — ${gate.recommendedAction}`);
  }
}
```

### [MODIFY] `src/lib/punctuationPolish.js`

Fix the case-sensitive backreference bug at line 174:

```javascript
// Before (buggy):
f.content = f.content.replace(
  /\b(\w{2,})\s+(\1)\b/gi,
  (match, word1, word2) => { ... }
);

// After (fixed):
f.content = f.content.replace(
  /\b(\w{2,})\s+(\w{2,})\b/gi,
  (match, word1, word2) => {
    if (word1.toLowerCase() !== word2.toLowerCase()) return match;
    if (SKIP_DOUBLES.has(word1.toLowerCase())) return match;
    punctFixed++;
    return word1;
  }
);
```

---

## Test Plan

### New test suites:
- `tests/prosePolisherQualityGate.test.mjs` — unit tests for the gate
- `tests/digitalEquityPolishRegression.mjs` — regression with real v5 snippets

### Existing suites (must still pass):
- `tests/manuscriptSafetyGate.test.mjs` — 33/33
- `tests/digitalEquityPipelineRegression.mjs` — 27/27
- `tests/liveExportSafetyRegression.mjs` — 25/25
- `tests/safeChapterReplace.test.mjs` — 68/68

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Grammar repair damages correct subjunctive | Subjunctive exception for "as if/as though/if he/she were" |
| Quote repair inserts opener in wrong position | Only repairs when dialogue tag follows (she said, etc.) |
| False positive on "He were" when subjunctive | Check 20-char lookback for "as if" / "as though" / "if" |
| Slop counts too strict | Slop is informational only — no auto-removal, just counting |
| Breaking existing polish pipeline | New code is additive — existing functions unchanged |
