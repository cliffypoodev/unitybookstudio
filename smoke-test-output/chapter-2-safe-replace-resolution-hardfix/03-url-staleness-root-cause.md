# 03 — URL Staleness Root Cause

**Date:** 2026-06-07
**File:** `src/lib/chapterStorage.js`
**Function:** `resolveChapterContent()` (L461-562)

---

## The Staleness Detection System

### How It Works

`contentLooksStaleAgainstMetadata()` (L89-150) compares fetched URL content against saved metadata:

| Check | Threshold | Logic |
|-------|-----------|-------|
| Char count | ±3% | `abs(actual - expected) / expected > 0.03` |
| Word count | ±3% | `abs(actual - expected) / expected > 0.03` |
| Start preview | First 160 chars | `!normalized.includes(previewStart)` |
| End preview | Last 160 chars | `!normalized.includes(previewEnd)` |

The metadata fields compared against:

```javascript
polish_saved_word_count   // Set by safe replacement
polish_saved_char_count   // Set by safe replacement
polish_saved_preview_start // First 200 chars of clean text
polish_saved_preview_end   // Last 200 chars of clean text
```

### Detection Worked Correctly

When safe replacement saved Chapter 2:
- **Metadata:** `char_count: 24000`, `word_count: 4200`, previews matched clean text
- **Stale URL returned:** `char_count: ~18000` (old poisoned content)
- **Char ratio:** `|18000 - 24000| / 24000 = 0.25` → far exceeds 0.03 threshold
- **Result:** `contentLooksStaleAgainstMetadata() → true` ✅ Correctly detected

---

## The Bug: Return Stale Anyway

### Code Path (L520-547)

```javascript
if (looksLikeUsableContent(fetched)) {
  const stale = contentLooksStaleAgainstMetadata(fetched, chapter);

  if (!stale) {
    // URL content is fresh → return it
    return fetched;
  }

  // URL content IS stale...
  if (looksLikeUsableContent(inline)) {
    // Inline fallback exists → use it instead
    return inline;
  }

  // ⚠️ BUG: No inline fallback → returns stale content anyway
  console.warn('URL content looked stale, but no inline fallback exists.');
  return fetched;  // ← POISONED CONTENT RETURNED
}
```

### Why No Inline Fallback Existed

1. Safe replacement called `prepareChapterContent()` for ~24KB text
2. Text exceeded `MAX_INLINE_SIZE` (10,000 chars) → uploaded to GitHub
3. `content_md` was set to `''` (empty string)
4. All other inline fields (`content`, `prose`, `body`, etc.) were cleared by `buildStaleFieldClearPayload()`
5. `looksLikeUsableContent(inline)` → `false` (empty string)

### The Dilemma

The resolver faced two bad options:
- Return stale content (poisoned) → export produces contaminated DOCX
- Return empty string → chapter appears missing in export

It chose to return stale content with a console warning, reasoning that *some* content is better than *no* content.

---

## Root Cause Chain

```
┌─────────────────────────────────────────────────────────┐
│ 1. Safe replacement saves ~24KB text                     │
│    → prepareChapterContent() uploads to GitHub           │
│    → Sets content_md: '' (text > 10KB inline limit)      │
├─────────────────────────────────────────────────────────┤
│ 2. On page reload, transient fields are lost             │
│    → __polishedContent = undefined                       │
│    → __polishSavedContent = undefined                    │
│    → No __safeReplacedContent field existed               │
├─────────────────────────────────────────────────────────┤
│ 3. Resolver falls through to URL fetch                   │
│    → GitHub/CDN returns stale content from old URL        │
│    → Metadata mismatch detected                          │
├─────────────────────────────────────────────────────────┤
│ 4. No inline fallback available                          │
│    → content_md is '' (cleared in step 1)                │
│    → All legacy fields cleared by staleClear payload     │
├─────────────────────────────────────────────────────────┤
│ 5. Resolver returns stale content with warning           │
│    → Export runs safety gate on poisoned content          │
│    → REJECT_REGENERATE                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Fixes Applied

### Fix 1: Priority Transient Field (chapterStorage.js L471-477)

Added `__safeReplacedContent` as the **first** field checked in the transient priority chain:

```javascript
const transientPolished = normalizeText(
  chapter.__safeReplacedContent ||    // ← NEW: Priority 1
    chapter.__polishedContent ||
    chapter.__polishSavedContent ||
    chapter.__polishExportContent ||
    ''
);
```

**Effect:** Within the same session, safe replacement content is always resolved first. The URL path is never reached.

### Fix 2: Stale Content Tagging (chapterStorage.js L543-546)

When stale URL content is returned with no inline fallback, the resolver now **tags the chapter**:

```javascript
chapter.__staleContentResolution = true;
chapter.__staleContentWarning = `${label}: URL content looked stale (metadata mismatch), no inline fallback exists.`;
return fetched;
```

**Effect:** Downstream consumers (export) can detect and block stale content instead of silently using it.

### Fix 3: Transient Content Assignment (safeChapterReplace.js L228-241)

After saving, safe replacement now sets:

```javascript
chapter.__safeReplacedContent = repairedText;
chapter.__staleContentResolution = false;
chapter.__staleContentWarning = '';
chapter.content_md = repairedText;
```

**Effect:** Immediate in-session resolution uses clean text. Stale flags from prior resolves are cleared.

### Fix 4: Export Stale Content Block (ExportTab.jsx L763-785)

Pre-export check before the safety gate:

```javascript
const staleChapters = cleaned.filter(ch => ch?.__staleContentResolution === true);
if (staleChapters.length > 0) {
  throw new Error('STALE_CONTENT_BLOCK: ...');
}
```

**Effect:** Export fails fast with a clear error message instead of producing a DOCX with poisoned content.
