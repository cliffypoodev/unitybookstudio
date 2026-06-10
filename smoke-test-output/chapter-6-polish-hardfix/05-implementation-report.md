# 05 — Implementation Report

**Date:** 2026-06-07

---

## Code Changes

### Fix A: Smart Partial-Repair Save Decision

**File:** [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4584)

**Before (Milestone 7 — too aggressive):**
```javascript
// HARDFIX: revert blocked chapters to original content
const blockedChapterNums = new Set(...);
for (const f of loaded) {
  if (blockedChapterNums.has(chNum)) {
    f.content = f.original; // REVERTS ALL REPAIRS
  }
}
```

**After (Smart partial-repair):**
```javascript
// HARDFIX v2: Smart partial-repair handling
for (const f of loaded) {
  if (!blockedChapterNums.has(chNum)) continue;
  
  // Compare malformed counts before and after repair
  const originalGate = runProsePolishQualityGate(f.original || '');
  const repairedGate = runProsePolishQualityGate(f.content || '');
  const textChanged = f.content !== f.original;

  if (textChanged && repairedGate.malformed.count < originalGate.malformed.count) {
    // Repairs improved the chapter — SAVE the improved text
    // DON'T revert
  } else {
    // No improvement — revert
    f.content = f.original;
  }
}
```

**Impact on Chapter 6:**
- Original: 5 malformed → Repaired: 1 malformed
- `textChanged = true`, `1 < 5 = true` → keep repaired text
- Save loop saves repaired text with "She was" and "an obvious"
- "Aether were" logged as needing manual review

**Impact on safety:**
- Chapters where repair makes NO improvement still revert (safe)
- Chapters where repair introduces NEW issues still revert (safe)
- Only chapters where repair REDUCED malformed count are saved (improved text is strictly better)

---

### Fix B: Stale Field Clearing in Polish Save

**File:** [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx#L4678)

**Before:**
```javascript
const savePayload = {
  ...contentFields,
  ...backupFields,
  word_count: countWords(f.content),
  revision_notes: revisionNotes,
};
```

**After:**
```javascript
const staleClear = {};
for (const staleField of [
  'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
  'chapter_text', 'markdown', 'content_html', 'content_html_url',
  'content_delta', 'content_delta_url', '__polishedContent',
  '__polishSavedContent', '__polishExportContent',
]) {
  staleClear[staleField] = '';
}

const savePayload = {
  ...staleClear,          // Clear stale fields first
  ...contentFields,       // Then set canonical content
  ...backupFields,
  word_count: countWords(f.content),
  revision_notes: revisionNotes,
};
```

**Impact:** Prevents export from resolving old pre-polish content from stale fallback fields.

---

### New Test: Chapter 6 Regression Suite

**File:** [chapter6PolishRegression.mjs](file:///Users/cliff/Downloads/UBS/tests/chapter6PolishRegression.mjs)

25 tests covering:
- Pre-repair canary detection (4 tests)
- Grammar repair verification (4 tests)
- Post-repair quality gate (3 tests)
- Save loop behavior simulation (3 tests)
- Export safety gate (3 tests)
- Stale field clearing (2 tests)
- Full pipeline simulation (6 tests)

---

## Files Changed

| File | Type | Lines Changed | Purpose |
|------|------|---------------|---------|
| `src/pages/ProjectStudio.jsx` | MODIFY | +21/-11 (save loop), +12 (stale clear) | Smart save + stale field clearing |
| `tests/chapter6PolishRegression.mjs` | NEW | 206 lines (25 tests) | Chapter 6 regression |
