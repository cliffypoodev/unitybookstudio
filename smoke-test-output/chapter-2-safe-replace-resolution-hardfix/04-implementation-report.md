# 04 — Implementation Report

**Date:** 2026-06-07
**Files Modified:** 3 source files + 1 new test file
**Build:** exit 0

---

## Change 1: Resolver Priority — `__safeReplacedContent`

**File:** `src/lib/chapterStorage.js`
**Lines:** 470-477
**Purpose:** Add `__safeReplacedContent` as priority-1 transient field in the resolver chain

### Before

```javascript
  /*
   * CRITICAL EXPORT FIX:
   * The fixer mutates the current chapter object with __polishedContent after saving.
   * If export runs in the same session, this should beat URL fetches.
   */
  const transientPolished = normalizeText(
    chapter.__polishedContent ||
      chapter.__polishSavedContent ||
      chapter.__polishExportContent ||
      ''
  );
```

### After

```javascript
  /*
   * CRITICAL EXPORT FIX:
   * The fixer mutates the current chapter object with __polishedContent after saving.
   * If export runs in the same session, this should beat URL fetches.
   * __safeReplacedContent is set by safeChapterReplace.js after a successful replacement.
   */
  const transientPolished = normalizeText(
    chapter.__safeReplacedContent ||
      chapter.__polishedContent ||
      chapter.__polishSavedContent ||
      chapter.__polishExportContent ||
      ''
  );
```

### Why

Safe replacement sets `__safeReplacedContent` on the chapter object after saving. By checking this field first, the resolver returns clean replacement text immediately within the same session, bypassing the stale URL path entirely.

---

## Change 2: Stale Content Tagging

**File:** `src/lib/chapterStorage.js`
**Lines:** 541-547
**Purpose:** Tag chapters with stale content resolution flags instead of silently returning stale content

### Before

```javascript
      console.warn('[RESOLVE]', label, '— URL content looked stale, but no inline fallback exists.');
      return fetched;
```

### After

```javascript
      console.warn('[RESOLVE]', label, '— URL content looked stale, but no inline fallback exists. Returning stale content with warning tag.');
      // Tag the chapter object so callers (export) can detect stale resolution
      chapter.__staleContentResolution = true;
      chapter.__staleContentWarning = `${label}: URL content looked stale (metadata mismatch), no inline fallback exists. Content may be outdated.`;
      return fetched;
```

### Why

The resolver still returns the stale content (returning empty would be worse), but now tags the chapter object with `__staleContentResolution = true`. Export can detect this flag and block with a clear error message rather than producing a contaminated DOCX.

---

## Change 3: Safe Replacement Transient Content + Flag Clearing

**File:** `src/lib/safeChapterReplace.js`
**Lines:** 228-241 (after the save at L227)
**Purpose:** Set transient content for immediate resolver use and clear stale flags

### Before

*(No code existed here. The function returned the result immediately after saving.)*

### After

```javascript
  // ── STEP 4b: Set transient content on chapter object ──
  // This ensures resolveChapterContent() uses the clean replacement text
  // even if the URL upload is stale or the proxy fetch fails.
  // The resolver checks __safeReplacedContent as priority #1.
  if (chapter && typeof chapter === 'object') {
    chapter.__safeReplacedContent = repairedText;
    // Clear any stale-resolution flags from prior resolves
    chapter.__staleContentResolution = false;
    chapter.__staleContentWarning = '';
    // Also set content_md for immediate in-session use (may exceed DB limit
    // but the in-memory object can hold it)
    chapter.content_md = repairedText;
    console.log(`[SAFE-REPLACE] Ch.${chapterNum} — set __safeReplacedContent on chapter object (${repairedText.length} chars)`);
  }
```

### Why

1. `__safeReplacedContent` = clean text ensures the resolver returns it as priority 1
2. Clearing `__staleContentResolution` prevents false positives if the chapter was previously flagged stale
3. Setting `content_md` = clean text provides an in-memory fallback (the in-memory object can hold > 10KB even though the DB field can't)

---

## Change 4: Pre-Export Stale Content Check

**File:** `src/components/publishing/ExportTab.jsx`
**Lines:** 763-785 (inside `buildResolvedExportChapters`)
**Purpose:** Block export if any chapter was resolved from stale URL content

### Before

*(Export went directly from `applyFinalExportCleanup()` to the safety gate.)*

### After

```javascript
      // ── PRE-EXPORT STALE CONTENT CHECK ──
      // If any chapter was resolved from a stale URL with no inline fallback,
      // the resolver tags it with __staleContentResolution. Block export here
      // with a clear message so the user knows to re-save or safe-replace.
      const staleChapters = cleaned.filter(ch => ch?.__staleContentResolution === true);
      if (staleChapters.length > 0) {
        const staleList = staleChapters
          .map(ch => `  Ch.${ch.chapter_number || '?'} (${ch.title || 'untitled'}): ${ch.__staleContentWarning || 'stale URL content, no inline fallback'}`)
          .join('\n');
        const staleMsg = `STALE CONTENT RESOLUTION FAILURE:\n${staleChapters.length} chapter(s) resolved from stale URL content with no inline fallback.\n${staleList}\n\nFix: Re-save or safe-replace the affected chapter(s) to create a clean content source.`;
        console.error('[EXPORT] ' + staleMsg);

        if (!(typeof window !== 'undefined' && window.ALLOW_UNSAFE_EXPORT === true)) {
          const err = new Error('STALE_CONTENT_BLOCK: ' + staleMsg);
          err.isSafetyGateBlock = true;
          err.isStaleContentBlock = true;
          err.staleChapters = staleChapters.map(ch => ch.chapter_number);
          throw err;
        } else {
          console.warn('[EXPORT] ⚠️ ALLOW_UNSAFE_EXPORT override active. Proceeding despite stale content.');
          window.ALLOW_UNSAFE_EXPORT = false;
        }
      }
```

### Why

This check runs **before** the safety gate. If the resolver tagged any chapter with `__staleContentResolution`, export throws `STALE_CONTENT_BLOCK` with a descriptive error listing the affected chapters. This prevents the scenario where stale poisoned content passes through to DOCX generation.

---

## Change 5: Regression Tests

**File:** `tests/chapter2SafeReplaceResolutionRegression.mjs` (NEW)
**Lines:** 385 lines, 22 tests
**Purpose:** Comprehensive regression coverage for the Chapter 2 safe replacement resolution chain

### Test Groups

| Group | Tests | Coverage |
|-------|-------|----------|
| Poisoned text detection | 1–3 | All 9 canaries present; safety gate rejects; export blocks |
| Clean text verification | 4–7 | No canaries; fiction markers present; gate passes; export passes |
| Stale content resolution | 8–9 | Stale tagging behavior; stale chapter detection in export array |
| Safe replacement simulation | 10–12 | Full workflow; resolver priority; URL path skipped |
| Stale field clearing | 13–14 | All stale fields cleared; metadata previews match |
| Mixed-chapter export | 15–16 | 20-chapter export passes with clean Ch.2; blocks with poisoned |
| End-to-end cycle | 17–22 | Full poisoned → replace → export; no contamination; stale check |

---

## Summary of Files Changed

| File | Change Type | Lines Modified |
|------|------------|----------------|
| `src/lib/chapterStorage.js` | Modified | L470-477 (resolver priority), L541-547 (stale tagging) |
| `src/lib/safeChapterReplace.js` | Modified | After L227 (transient content + flag clearing) |
| `src/components/publishing/ExportTab.jsx` | Modified | L763-785 (pre-export stale check) |
| `tests/chapter2SafeReplaceResolutionRegression.mjs` | New | 385 lines, 22 tests |
