# 04 — Content Resolution After Replacement

**Date:** 2026-06-07
**Verdict:** ✅ Export resolves repaired text from content_md

---

## Resolution Priority Chain (resolveChapterContent)

| Priority | Field | Value | Resolves? |
|----------|-------|-------|-----------|
| 1 | `__polishedContent` | (empty) | — |
| 2 | `content_md` | 23627 chars | ✅ YES |
| 3 | `content_md_url` | (empty) | — |
| 4 | `content` | (empty) | — |

**Content resolves from:** `content_md`

---

## Field-by-Field Status After Replacement

| Field | Old Bad Content? | Repaired Content? | Empty/Cleared? | Used By Export? | Status |
|-------|-----------------|-------------------|----------------|-----------------|--------|
| `content_md` | ✅ No | ✅ Yes | — | ✅ | ✅ REPAIRED |
| `content_md_url` | ✅ No | — | ✅ Yes | ✅ | CLEARED |
| `content` | ✅ No | — | ✅ Yes | — | CLEARED |
| `draft` | ✅ No | — | ✅ Yes | — | CLEARED |
| `body` | ✅ No | — | ✅ Yes | — | CLEARED |
| `prose` | ✅ No | — | ✅ Yes | — | CLEARED |
| `content_html` | ✅ No | — | ✅ Yes | — | CLEARED |
| `content_delta` | ✅ No | — | ✅ Yes | — | CLEARED |
| `__polishedContent` | ✅ No | — | ✅ Yes | — | CLEARED |
| `resolvedExport` | ✅ No | ✅ Yes | — | ✅ | ✅ REPAIRED |

---

## Canary Search in Resolved Export Text

| Canary | Found in Resolved Text? |
|--------|------------------------|
| "The opening is sharp, highly polished" | ✅ Absent |
| "You have successfully executed" | ✅ Absent |
| "The current trajectory is working exactly as planned" | ✅ Absent |
| "Next Move" | ✅ Absent |
| "Action Plan" | ✅ Absent |
| "Unity Supported Living" | ✅ Absent |
| "Unity Supported Living Services" | ✅ Absent |
| "Unity Media" | ✅ Absent |
| "Unity Media Solutions" | ✅ Absent |
| "care documentation" | ✅ Absent |
| "compliance documentation" | ✅ Absent |
| "You was" | ✅ Absent |
| "Was was" | ✅ Absent |

> [!TIP]
> All canaries are absent from the resolved export text. The repaired Chapter 2 will be used by export.