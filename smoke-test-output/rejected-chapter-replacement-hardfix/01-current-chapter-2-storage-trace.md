# 01 — Current Chapter 2 Storage Trace

**Report:** Storage field analysis for Chapter 2: The Patron's Palette
**Date:** 2026-06-07
**Project:** Digital Equity Tribunal

---

## Storage Fields and Contamination Status

| Field | Contains Bad Text? | Used By Editor? | Used By Polish? | Used By Export? | Notes |
|-------|-------------------|-----------------|-----------------|-----------------|-------|
| `content_md` | ✅ YES — if resolved inline (< 10KB) | ✅ YES — loaded into editor | ✅ YES — loaded for polish scan | ✅ YES — primary export source | Contains full contaminated text inline OR is empty (URL-backed) |
| `content_md_url` | ✅ YES — if content is > 10KB | ✅ YES — fallback for editor | ✅ YES — fallback for polish scan | ✅ YES — fallback export source | Points to raw GitHub URL with contaminated content |
| `content` | ⚠️ POSSIBLY — legacy field | ❌ NO — not used by editor | ❌ NO | ❌ NO — but may pollute resolution | Legacy fallback field, may contain old content |
| `draft` | ⚠️ POSSIBLY — never cleared | ❌ NO | ❌ NO | ❌ NO | Never explicitly cleared on save |
| `body` | ⚠️ POSSIBLY — never cleared | ❌ NO | ❌ NO | ❌ NO | Never explicitly cleared on save |
| `prose` | ⚠️ POSSIBLY — never cleared | ❌ NO | ❌ NO | ❌ NO | Never explicitly cleared on save |
| `content_html` | ❌ NO — cleared by clearRichContentFields() | ❌ NO | ❌ NO | ❌ NO | Rich content field, cleared on draft save |
| `content_html_url` | ❌ NO — cleared by clearRichContentFields() | ❌ NO | ❌ NO | ❌ NO | Rich content URL, cleared on draft save |
| `content_delta` | ❌ NO — cleared by clearRichContentFields() | ❌ NO | ❌ NO | ❌ NO | Quill delta, cleared on draft save |
| `content_delta_url` | ❌ NO — cleared by clearRichContentFields() | ❌ NO | ❌ NO | ❌ NO | Quill delta URL, cleared on draft save |
| `__polishedContent` | ⚠️ POSSIBLY — transient in-memory | ❌ NO | ✅ YES — set during polish | ⚠️ MAYBE — if polish ran before export | Not persisted to DB, but lives in React state |
| `__polishSavedContent` | ⚠️ POSSIBLY — transient | ❌ NO | ❌ NO | ❌ NO | Polish save marker |
| Editor state (`chapterDraft`) | ✅ YES — if loaded | ✅ YES — is the editor | ❌ NO — polish loads from DB | ❌ NO — export resolves from DB | React state, not persisted |

---

## Content Resolution Priority (resolveChapterContent)

The function `resolveChapterContent()` in `chapterStorage.js` resolves chapter text in this priority order:

```
1. chapter.__polishedContent   → transient in-memory (highest priority)
2. chapter.content_md          → inline markdown (primary)
3. chapter.content_md_url      → GitHub-hosted markdown (large content)
4. chapter.content             → legacy fallback
5. ''                          → empty string
```

---

## Which field is feeding the export safety gate?

**Answer:** The export path resolves via `buildResolvedExportChapters()` in `ExportTab.jsx`, which calls `resolveChapterContent()` per chapter. For Chapter 2:

1. If `content_md_url` is set → fetches from GitHub → **gets contaminated text**
2. If `content_md` is set inline → **gets contaminated text**

The contaminated text then gets scanned by `runPreExportSafetyGate()`, which correctly blocks export.

**Root cause:** The Rewrite operation generates new text via `draftChapter()`, but if the post-draft safety gate rejects the new output (because LLM regenerated similar contaminated text), the old contaminated `content_md` / `content_md_url` persists. No save occurs, so the DB retains the contaminated version.

---

## Canary Phrases Found in Contaminated Chapter 2

| Canary | Found? | Field Source |
|--------|--------|-------------|
| "The opening is sharp, highly polished" | ✅ YES | content_md / content_md_url |
| "Action Plan:" | ✅ YES | content_md / content_md_url |
| "Unity Supported Living" | ✅ YES | content_md / content_md_url |
| "Unity Media" | ✅ YES | content_md / content_md_url |
| "You was" | ✅ YES | content_md / content_md_url |
| "Was was" | ✅ YES | content_md / content_md_url |

---

## Key Finding

> [!CAUTION]
> The existing save pipeline (`draftChapter` → `prepareChapterContent` → `Chapter.update`) does NOT clear legacy fields like `content`, `draft`, `body`, `prose`. Only `clearRichContentFields()` clears the HTML/delta fields. If contaminated text exists in any of these legacy fields, it could theoretically be resolved by `resolveChapterContent()` as a fallback, even after a successful rewrite saves new text to `content_md`.

The fix is `safeChapterReplace.js` → `safeReplaceChapterContent()` which clears **all** stale fields.
