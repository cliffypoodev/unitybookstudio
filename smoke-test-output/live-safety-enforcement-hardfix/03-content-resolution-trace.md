# 03 — Content Resolution Trace

**Report:** How Chapter 2's contaminated content reached the DOCX export
**Date:** 2026-06-07

---

## Content Resolution Priority Order

`buildResolvedExportChapters()` resolves each chapter's content in this order:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 | `editorValue` | Currently open editor content (only for selected chapter) |
| 2 | `chapter.content_md` | Saved markdown content in DB |
| 3 | `chapter.content_md_url` | URL to content in cloud storage |
| 4 | `chapter.content` | Legacy content field |
| 5 | `''` | Empty string fallback |

---

## Chapter 2 Content Field Scan

| Field | Contains Bad Text? | Used By Export? | Evidence |
|-------|-------------------|-----------------|----------|
| `editorValue` | Unknown | Only if Ch.2 was selected/open | N/A — depends on UI state |
| `content_md` | **YES** | **YES** — primary source | "The opening is sharp, highly polished" at index 25653 |
| `content_md_url` | **Likely YES** | Fallback if content_md empty | Same content saved to storage |
| `content` | Unknown | Legacy fallback | Rarely used |

---

## 6 Questions Answered

| # | Question | Answer |
|---|----------|--------|
| 1 | Which field contains the contaminated text? | **`content_md`** — saved to DB during draft phase before safety gates existed |
| 2 | Which field does export use? | **`content_md`** (primary) or `content_md_url` (fallback) |
| 3 | Did polish skip/reject but export still use old content? | **YES** — polish quarantine prevents polish transforms from running on rejected chapters, but it does NOT delete/replace their DB content. Export reads the same stale DB content. |
| 4 | Did the editor show clean content while export used stale content? | **POSSIBLE** but unlikely. The editor shows whatever's loaded. The contaminated content would be visible in the editor too. |
| 5 | Did `__polishedContent` expire and fallback to contaminated `content_md_url`? | **NOT APPLICABLE** — `__polishedContent` is a transient in-memory field, not persisted. Export does not use it. |
| 6 | Did save/read-back verification miss this because the contaminated text was already saved? | **YES** — the post-draft gate was added after the contaminated content was already saved to the database. The gate only checks NEW drafts, not existing DB content. |

---

## Root Cause

```
Timeline:
1. User ran Draft All → Chapter 2 generated with process leaks + contamination
2. draftChapter() saved contaminated content to DB (no safety gate existed yet)
3. Safety gates added to code
4. User ran Export → export reads contaminated content from DB
5. Safety gate in buildResolvedExportChapters() detected it
6. Safety gate threw error → catch block FELL THROUGH → export proceeded with orderedWithEdits
7. buildDocxDocument() produced contaminated DOCX
```

> [!IMPORTANT]
> The fix does NOT clean the DB content. It **blocks export** of contaminated content. The user must regenerate Chapter 2 to replace the contaminated DB content with clean content.
