# 02 — Safe Replace Execution Trace

**Date:** 2026-06-07
**Module:** `safeChapterReplace.js`
**Resolver:** `chapterStorage.js` → `resolveChapterContent()`

---

## Pre-Fix Execution Flow

### Step 1: User Triggers Safe Replacement

```
safeReplaceChapterContent(chapter, repairedText, { projectId, saveFn })
```

- `repairedText` = ~24,000 chars (clean Chapter 2)
- Chapter 2 currently has poisoned content in `content_md_url`

### Step 2: Safety Gate Check

```
runManuscriptSafetyGate(repairedText, { stage: 'manual-replacement' })
→ ok: true, processLeaks: 0, contamination: 0, malformed: 0
```

Gate passes — replacement text is clean.

### Step 3: Prepare Content Fields

```
prepareChapterContent(repairedText, projectId, chapterId, chapter)
```

- `repairedText.length` = ~24,000 > `MAX_INLINE_SIZE` (10,000)
- Uploads to GitHub via `uploadViaGitHub()`
- Creates unique filename: `chapter-ch2-20260607...-abc123`
- Returns:

```javascript
{
  content_md: '',           // ← EMPTY because text > 10KB
  content_md_url: 'https://raw.githubusercontent.com/.../chapter-ch2-20260607...',
  content_md_upload_failed: false,
  content_md_word_count: 4200,
  content_md_char_count: 24000,
}
```

### Step 4: Clear Stale Fields & Save

```javascript
const staleClear = buildStaleFieldClearPayload();
// Clears: content, draft, body, prose, finalText, cleanedText, chapter_text,
//         markdown, content_html, content_delta, __polishedContent, etc.

const payload = { ...staleClear, ...contentFields, word_count, status: 'drafted', ... };
await saveFn(chapterId, payload);
```

Save succeeds. Database now has:
- `content_md: ''` (empty)
- `content_md_url: '<new URL>'` (new clean URL)
- All stale fields cleared

### Step 5: No Transient Content Set (PRE-FIX BUG)

**Pre-fix:** The function returned after saving. No transient field was set on the chapter object.

---

## Page Reload → Export Attempt

### Step 6: Fresh Page Load

- All transient fields are JavaScript runtime objects → **lost on reload**
- `chapter.__polishedContent` = `undefined`
- `chapter.__polishSavedContent` = `undefined`
- `chapter.__safeReplacedContent` = `undefined` (field didn't exist pre-fix)

### Step 7: Export Calls resolveChapterContent()

```
resolveChapterContent(chapter)
```

1. **Transient check:** `__polishedContent || __polishSavedContent || ...` → all empty → skip
2. **Inline check:** `content_md` → `''` (empty, was set to empty in Step 3) → skip
3. **URL fetch:** `content_md_url` → fetches via backend proxy

### Step 8: URL Returns Stale Content

- GitHub CDN still serves content from the **previous** URL
- OR: the new URL's content hasn't propagated yet
- Proxy fetch returns content → `looksLikeUsableContent()` = true

### Step 9: Staleness Detection (Correct)

```
contentLooksStaleAgainstMetadata(fetched, chapter)
```

- `chapter.polish_saved_char_count` = 24000 (from new save)
- `fetched.length` = ~18000 (from old poisoned URL)
- `charRatio` = |18000 - 24000| / 24000 = 0.25 > 0.03 → **STALE**

### Step 10: No Inline Fallback → Returns Stale Content (BUG)

```javascript
// chapterStorage.js L537-547 (pre-fix)
if (looksLikeUsableContent(inline)) {
  // inline is empty → NOT reached
}
// Falls through to:
console.warn('URL content looked stale, but no inline fallback exists.');
return fetched;  // ← RETURNS POISONED CONTENT
```

### Step 11: Export Safety Gate → REJECT

```
runManuscriptSafetyGate(poisonedContent, { stage: 'pre-export' })
→ ok: false, processLeaks: 8, contamination: 8, malformed: 2
→ REJECT_REGENERATE
```

---

## Post-Fix Execution Flow

### Same Steps 1-4, then:

### Step 5 (FIXED): Set Transient Content

```javascript
// safeChapterReplace.js L228-241
chapter.__safeReplacedContent = repairedText;
chapter.__staleContentResolution = false;
chapter.__staleContentWarning = '';
chapter.content_md = repairedText;
```

### Step 7 (FIXED): Resolver Finds Transient Content

```javascript
// chapterStorage.js L472-477
const transientPolished = normalizeText(
  chapter.__safeReplacedContent ||  // ← FOUND: clean replacement text
  chapter.__polishedContent ||
  ...
);
// looksLikeUsableContent(transientPolished) → true
// → Returns clean content immediately, URL path never reached
```

### After Page Reload (FIXED): Stale Content Blocked

Even if transient fields are lost on reload:

```javascript
// chapterStorage.js L543-547
chapter.__staleContentResolution = true;
chapter.__staleContentWarning = '...metadata mismatch...';
return fetched;  // Still returns stale, BUT:

// ExportTab.jsx L767
const staleChapters = cleaned.filter(ch => ch?.__staleContentResolution === true);
if (staleChapters.length > 0) {
  throw new Error('STALE_CONTENT_BLOCK: ...');  // ← Export blocked with clear message
}
```
