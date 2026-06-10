# 05 — Implementation Report

> **Report Date:** 2026-06-07  
> **Fix Type:** SAFETY-GATE RECOVERY path for stale URL resolution  
> **Files Modified:** 4 (2 modified, 2 new)

---

## Summary of Changes

| File | Change Type | Purpose |
|------|------------|---------|
| `chapterStorage.js` (L543-576) | Modified | Added SAFETY-GATE RECOVERY path in resolver |
| `ExportTab.jsx` (L786-797) | Modified | Added metadata refresh logging |
| `safeChapterResave.js` | New file | Safe resave utility for metadata repair |
| `tests/staleUrlResolutionRegression.mjs` | New file | 20 regression tests |

---

## 1. chapterStorage.js — Safety-Gate Recovery Path

**Location:** Lines 543–576

### Before (Blocked Path)

```javascript
// When URL content is stale and no inline fallback exists:
if (isStale && !hasInlineFallback) {
  chapter.__staleContentResolution = true;
  // Export BLOCKED — no recovery path
  return { content: null, blocked: true, reason: 'STALE_CONTENT_BLOCK' };
}
```

**Behavior:** Any stale URL content without an inline fallback was unconditionally blocked. No distinction was made between genuinely contaminated content and valid content with outdated metadata.

### After (Safety-Gate Recovery)

```javascript
// SAFETY-GATE RECOVERY: When URL content is stale but no inline fallback exists,
// run the safety gate to determine if content is actually valid.
if (isStale && !hasInlineFallback) {
  const gateResult = manuscriptSafetyGate(fetchedContent, {
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    expectedProtagonist: chapter.protagonist
  });

  if (gateResult.passes) {
    // Content is valid — metadata is the problem, not the content
    chapter.__needsMetadataRefresh = true;
    // NOT setting __staleContentResolution — export proceeds
    return { content: fetchedContent, blocked: false, reason: 'SAFETY_GATE_RECOVERY' };
  } else {
    // Content genuinely contaminated — block export
    chapter.__staleContentResolution = true;
    return { content: null, blocked: true, reason: 'STALE_CONTENT_BLOCK' };
  }
}
```

**Behavior:** 
- Stale content with no inline fallback now gets a second chance via `manuscriptSafetyGate()`
- If gate **passes**: content accepted, tagged `__needsMetadataRefresh=true`, export proceeds
- If gate **fails**: content blocked as before with `__staleContentResolution=true`

### Design Rationale

The safety gate already exists as a validated mechanism for detecting contaminated content. By running it on stale URL content, we can distinguish between:
- **Classification A** (metadata mismatch) — gate passes → accept content
- **Classification B/C** (genuine contamination) — gate fails → block content

This preserves the safety guarantee while unblocking valid content.

---

## 2. ExportTab.jsx — Metadata Refresh Logging

**Location:** Lines 786–797

### Before

```jsx
// No handling for __needsMetadataRefresh — tag did not exist
```

### After

```jsx
// METADATA REFRESH LOGGING: Log chapters that passed safety gate
// but need metadata refresh. These are warnings, not blocks.
if (chapter.__needsMetadataRefresh) {
  warnings.push({
    chapter: chapter.number,
    title: chapter.title,
    type: 'METADATA_REFRESH_NEEDED',
    message: `Ch.${chapter.number} "${chapter.title}" — URL content accepted via safety gate. ` +
             `Metadata needs refresh to match current URL content. ` +
             `Use safeChapterResave() to repair.`
  });
  // WARNING ONLY — does NOT block export
}
```

**Behavior:**
- Chapters tagged `__needsMetadataRefresh` generate a warning in the export log
- The warning includes the chapter number, title, and a recommended action
- **Export is NOT blocked** — this is informational only

---

## 3. safeChapterResave.js — New Utility

**Purpose:** Safe resave utility for repairing stale metadata without changing content.

### Workflow

```
safeChapterResave(chapter)
  1. Fetch current URL content
  2. Run manuscriptSafetyGate() — validate content is clean
  3. If gate FAILS → abort, return error
  4. Compute fresh metadata from fetched content:
     - word_count
     - char_count
     - preview_start
     - preview_end
  5. Re-save chapter with:
     - Same content (no changes)
     - Refreshed metadata (matching actual content)
  6. Set transient inline fallback (safety net)
  7. Return success with metadata diff
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Gate check before resave | Prevents resaving contaminated content |
| Content unchanged | We're fixing metadata, not content |
| Transient fallback set | Safety net in case of downstream issues |
| Metadata diff returned | Audit trail of what changed |

### Usage

```javascript
const result = await safeChapterResave(chapter12);
// result: {
//   success: true,
//   metadataDiff: {
//     word_count: { before: 3421, after: 3287 },
//     char_count: { before: 19845, after: 19102 },
//     preview_start: { before: '...', after: '...' }
//   }
// }
```

---

## 4. tests/staleUrlResolutionRegression.mjs — 20 New Tests

### Test Suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| Safety-Gate Recovery | 5 | Gate pass/fail paths, content acceptance/rejection |
| Metadata Refresh Tagging | 4 | `__needsMetadataRefresh` set/unset correctly |
| Stale vs Refresh Distinction | 3 | `__staleContentResolution` vs `__needsMetadataRefresh` |
| Export Behavior | 4 | Export proceeds/blocks based on tags |
| End-to-End Resolution | 4 | Full flow from stale detection to export |
| **Total** | **20** | |

### Key Test Cases

```
✅ stale URL + no fallback + gate PASS → __needsMetadataRefresh=true
✅ stale URL + no fallback + gate FAIL → __staleContentResolution=true
✅ __needsMetadataRefresh chapter → export proceeds
✅ __staleContentResolution chapter → export blocks
✅ gate PASS content has correct protagonist
✅ gate FAIL content has process leaks
✅ safeChapterResave updates metadata without changing content
✅ safeChapterResave aborts on gate failure
✅ ExportTab logs WARNING for metadata refresh chapters
✅ ExportTab does NOT block for metadata refresh chapters
```

---

## Test Results

```
12 suites, 295 tests total (20 new + 275 existing)
All tests PASS
Build: exit 0
```

> [!NOTE]
> All 275 existing tests continue to pass, confirming the fix does not regress any prior behavior. The 20 new tests specifically validate the safety-gate recovery path and metadata refresh flow.
