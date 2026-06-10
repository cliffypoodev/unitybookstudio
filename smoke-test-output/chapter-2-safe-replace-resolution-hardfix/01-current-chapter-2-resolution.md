# 01 — Current Chapter 2 Resolution Trace

**Date:** 2026-06-07
**Status:** DIAGNOSED → FIXED
**Scope:** Chapter 2 ("The Patron's Palette") content field resolution during export

---

## Problem Statement

Chapter 2 export was blocked with `REJECT_REGENERATE`: 8 process leaks, 8 contamination, 2 malformed.

**Bad canaries found in resolved content:**

| # | Canary | Category |
|---|--------|----------|
| 1 | `The opening is sharp, highly polished` | Process leak |
| 2 | `Next Move:` | Process leak |
| 3 | `Action Plan:` | Process leak |
| 4 | `Unity Supported Living` | Contamination |
| 5 | `Unity Media` | Contamination |
| 6 | `care documentation` | Contamination |
| 7 | `compliance documentation` | Contamination |
| 8 | `You was` | Malformed |
| 9 | `Was was` | Malformed |

---

## Content Field Trace

The resolver (`resolveChapterContent()` in `chapterStorage.js`) checks fields in priority order:

| Priority | Field | Value at Export Time | Contains Poisoned? | Used by Export? |
|----------|-------|---------------------|-------------------|-----------------|
| 1 | `__safeReplacedContent` | *(not set — field did not exist pre-fix)* | N/A | No |
| 1 | `__polishedContent` | `''` (empty — transient, lost on reload) | No | No |
| 1 | `__polishSavedContent` | `''` (empty — transient, lost on reload) | No | No |
| 1 | `__polishExportContent` | `''` (empty — transient, lost on reload) | No | No |
| 2 | `content_md` | `''` (empty — content > 10KB, stored as URL) | No | No |
| 2 | `content` | `''` or poisoned legacy field | Yes | No (too short) |
| 3 | `content_md_url` | `https://raw.githubusercontent.com/...` (stale) | **YES** | **YES** ← |
| 4 | inline fallback | None available | N/A | N/A |

---

## Resolution Path (Pre-Fix)

```
resolveChapterContent(chapter)
  │
  ├─ Check transient fields → all empty (page was reloaded)
  │
  ├─ Check inline content_md → empty (content > 10KB MAX_INLINE_SIZE)
  │
  ├─ Fetch content_md_url via proxy
  │   └─ Returns content → looksLikeUsableContent = true
  │       └─ contentLooksStaleAgainstMetadata() = TRUE (mismatch detected)
  │           ├─ Check inline fallback → not usable
  │           └─ ⚠️ RETURNS STALE CONTENT ANYWAY (L541-547)
  │
  └─ Export receives poisoned content → safety gate → REJECT_REGENERATE
```

---

## Why content_md_url Contained Poisoned Content

1. Safe replacement uploaded **new clean content** to GitHub via `prepareChapterContent()`
2. GitHub created a **new file** with a **new unique URL** (unique filename per save)
3. The **new URL** was saved to the database as `content_md_url`
4. But `content_md` was set to `''` (content > 10KB)
5. On page reload, the old poisoned URL was still cached/served by GitHub CDN
6. The proxy fetch returned content from the **old URL** that was still live
7. `contentLooksStaleAgainstMetadata()` detected the mismatch (char count, word count, preview drift)
8. But the resolver had no inline fallback to use instead → returned stale content

---

## Key Finding

> The resolver correctly detected stale content but had no alternative content source.
> The safe replacement had set `content_md: ''` because the text exceeded the 10KB inline limit.
> With no inline fallback and no transient field, the resolver was forced to return the stale poisoned content.

**Root cause:** Safe replacement did not set any transient field that would survive the resolver's priority chain when inline content was empty.

---

## Post-Fix Resolution Path

```
resolveChapterContent(chapter)
  │
  ├─ Check __safeReplacedContent → FOUND (set by safeChapterReplace.js)
  │   └─ looksLikeUsableContent = true
  │       └─ ✅ RETURNS CLEAN CONTENT IMMEDIATELY
  │
  └─ URL path never reached
```
