# 04 — Replacement Implementation

**Report:** Safe rejected-chapter replacement implementation details
**Date:** 2026-06-07

---

## New Module: `src/lib/safeChapterReplace.js`

### Purpose

Provides a safe mechanism for replacing hard-failed chapter content. The existing save paths (`handleSaveChapter`, `handleSaveExportChapter`) do not clear all stale content fields. This module does.

### API

```javascript
import { safeReplaceChapterContent, verifySafeReplacement } from '@/lib/safeChapterReplace';

// Replace a chapter's content safely
const result = await safeReplaceChapterContent(chapter, repairedText, {
  projectId: project.id,
  projectType: 'fiction',
  saveFn: (id, payload) => base44.entities.Chapter.update(id, payload),
  stage: 'manual-replacement',
});

// Verify the replacement took effect
const verify = verifySafeReplacement(resolvedContent, chapter, {
  projectType: 'fiction',
});
```

### Workflow

```
safeReplaceChapterContent(chapter, repairedText, options)
  │
  ├─ 1. Validate inputs (chapter.id, text length >= 100, saveFn present)
  │     └─ FAIL → return { ok: false, reason: '...' }
  │
  ├─ 2. Run safety gate on replacement text
  │     ├─ runManuscriptSafetyGate(repairedText, { stage: 'manual-replacement' })
  │     └─ FAIL → return { ok: false, gate: {...}, reason: '...' }
  │                (do NOT save contaminated replacement)
  │
  ├─ 3. Prepare content fields
  │     └─ prepareChapterContent(repairedText, projectId, chapterId, chapter)
  │        ├─ If < 10KB → inline in content_md
  │        └─ If >= 10KB → upload to GitHub → content_md_url
  │
  ├─ 4. Build full replacement payload
  │     ├─ Clear ALL stale fields (15+ fields)
  │     ├─ Set new content fields from prepareChapterContent
  │     ├─ Update metadata (word_count, status, timestamps)
  │     └─ Stamp with version + gate results
  │
  ├─ 5. Save via provided saveFn
  │     └─ FAIL → return { ok: false, reason: 'Save failed: ...' }
  │
  └─ 6. Return structured result
        └─ { ok: true, chapterId, wordCount, gate: {...}, ... }
```

---

## Stale Fields Cleared

The following fields are explicitly set to `''` (empty string) during safe replacement to prevent any stale contaminated text from persisting:

| # | Field | Purpose | Why Clear |
|---|-------|---------|-----------|
| 1 | `content` | Legacy content field | May contain old contaminated text |
| 2 | `draft` | Draft text | Never cleared by existing save paths |
| 3 | `body` | Body text | Never cleared by existing save paths |
| 4 | `prose` | Prose text | Never cleared by existing save paths |
| 5 | `finalText` | Final text marker | Never cleared |
| 6 | `cleanedText` | Cleaned text marker | Never cleared |
| 7 | `chapter_text` | Alternative text field | Never cleared |
| 8 | `markdown` | Markdown text | Never cleared |
| 9 | `content_html` | Rich HTML content | Cleared by `clearRichContentFields()` too |
| 10 | `content_html_url` | Rich HTML URL | Cleared by `clearRichContentFields()` too |
| 11 | `content_delta` | Quill delta | Cleared by `clearRichContentFields()` too |
| 12 | `content_delta_url` | Quill delta URL | Cleared by `clearRichContentFields()` too |
| 13 | `__polishedContent` | Transient polish marker | May contain stale polished contamination |
| 14 | `__polishSavedContent` | Polish save marker | May reference old text |
| 15 | `__polishExportContent` | Polish export marker | May reference old text |

Additionally cleared:
- `content_md_upload_failed` → `false`
- `content_md_preview_only` → `false`
- `content_md_preserved_existing_url` → `false`
- `content_format` → `'markdown_v1'`

---

## ProjectStudio.jsx Integration

### New Import (line 76)

```javascript
import { safeReplaceChapterContent, verifySafeReplacement } from '@/lib/safeChapterReplace';
```

### New Handler: `handleSafeReplaceRejectedChapter` (after line 2451)

This handler:

1. Calls `safeReplaceChapterContent()` with the project's save function
2. If replacement succeeds:
   - Updates editor state (`setChapterDraft`)
   - Invalidates React Query cache (`refreshAll()`)
   - Verifies the replacement by re-resolving content
   - Shows success toast with gate results
3. If replacement fails:
   - Shows error toast with reason
   - Does NOT modify any state

### Window Global: `window.__UBS_SAFE_REPLACE`

Exposed via `useEffect` for browser console use:

```javascript
// Usage from browser console:
const result = await window.__UBS_SAFE_REPLACE(2, repairedText);
// result.ok → true if replacement succeeded
```

---

## Why This Approach (Option B)

The user specified two options:

| Option | Approach | Chosen? | Why |
|--------|----------|---------|-----|
| A | Auto-regenerate rejected chapters via LLM | ❌ | LLM may reproduce contamination from project context |
| **B** | **Manual replacement with safety gate** | **✅** | **Deterministic, safe, verifiable** |

Option B was chosen because:
- The contamination source is the project context/prompt, not random LLM noise
- Re-running the LLM with the same project context may reproduce contamination
- A human-verified replacement text (or externally generated clean text) is the safest fix
- The safety gate prevents accidentally replacing with new contaminated text

---

## Files Modified

| File | Change | Why |
|------|--------|-----|
| `src/lib/safeChapterReplace.js` | **NEW** | Core safe replacement module |
| `src/pages/ProjectStudio.jsx` | Add import + handler + window global | UI integration |
| `tests/safeChapterReplace.test.mjs` | **NEW** | 68-assertion test suite |
