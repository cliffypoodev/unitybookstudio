# 04 — Save/Export Content Resolution Trace

**Date:** 2026-06-07

---

## Question: Were bad strings fixed but not saved, or saved but export used stale content?

**Answer: They were saved because the save loop ignored the quality gate's BLOCK_POLISH_SAVE action.**

---

## Content Flow Through Pipeline

```
Pre-polish text (loaded from DB)
      │
      ▼
LLM Polish (Step 1d)
      │ If LLM failed/returned bad → keeps original
      │ If LLM succeeded → replaces f.content
      ▼
Deterministic Cleanup (Steps 2-11)
      │ Banned words, punctuation, etc.
      ▼
Grammar Repair (Step 12a)
      │ "She were" → "She was", "Was was" → "Was", etc.
      ▼
Quote Repair (Step 12b)
      │ Inserts missing opening quotes
      ▼
Quality Gate (Step 12c)
      │ Checks: malformed, quote issues, slop
      │
  ╔═══╧═══╗
  ║ BLOCK? ║──── YES ──→ toast.error() BUT SAVE CONTINUED ← BUG
  ╚═══╤═══╝
      │ (ALL chapters continued to save)
      ▼
Save (Step 13)
      │ prepareChapterContent() → may upload as file
      │ Saves to DB via base44.entities.Chapter.update()
      ▼
Export reads from DB
      │ Resolves content_md or content_md_url
      ▼
Export Safety Gate
      │ Checks process leaks, contamination, malformed
      │ (BUT did NOT have She were, a obvious, etc. patterns before fix)
      ▼
DOCX generated
```

---

## Chapter 1 Trace

| Stage | Contains `The game is the model, Marcus,"` | Contains `And I thrive on efficiency,"` |
|-------|---------------------------------------------|------------------------------------------|
| Pre-polish loaded | ✅ Present | ✅ Present |
| After LLM polish | Unknown (likely fallback) | Unknown (likely fallback) |
| After deterministic cleanup | ✅ Present (no rule) | ✅ Present (no rule) |
| After quote repair | ❌ **Fixed** (opening quote inserted) | ❌ **Fixed** |
| Quality gate result | `MANUAL_REVIEW` (quoteIssues=5, but malformed=0) | — |
| **Save allowed?** | **YES ← BUG** (quality gate didn't block for quotes) | — |
| DB content | Contains repaired text | Contains repaired text |
| Export resolved | Uses DB content | Uses DB content |
| DOCX output | **Shows pre-repair text** | **Shows pre-repair text** |

**Wait — contradiction.** The quote repair ran and fixed the issue, but the DOCX still shows the bad text. This means:

1. Quote repair ran on `f.content` in memory
2. `f.content` was updated with fixed text
3. Save wrote the fixed text to DB
4. But `f.original` was also the pre-polish loaded text
5. **The DOCX was NOT generated from the polished save — it was exported from the DB state BEFORE this polish run.**

**Alternative explanation:** The DOCX was exported from a previous run before the quote repair code was added.

---

## Chapter 5 Trace

| Stage | Contains `She were carrying` | Contains `She was it monopolistic` |
|-------|------------------------------|-------------------------------------|
| Pre-polish loaded | ✅ Present | ✅ Present |
| After grammar repair | ❌ Fixed → `She was carrying` | ✅ **Still present** (no repair rule) |
| Quality gate | `BLOCK_POLISH_SAVE` (malformed=2) | — |
| **Save allowed?** | **YES ← BUG** (save ignored block) | — |
| DB content | Contains partially-repaired text | — |
| DOCX output | Shows `She were carrying` | Shows `She was it monopolistic` |

**The DOCX shows the ORIGINAL pre-repair text**, which confirms the DOCX was exported before this polish run completed, OR the polish run's save was overwritten by a subsequent operation.

---

## Key Finding: Stale Content Fields

The `prepareChapterContent()` function may write content as:
- `content_md` (inline, < 10KB)
- `content_md_url` (uploaded file, ≥ 10KB)

Export resolves in priority order:
1. `content_md_url` (if present)
2. `content_md`

If polish saves to `content_md` but an older `content_md_url` still exists, export reads the OLD file.

**Fix B addresses this:** The save loop at Step 13 should clear stale fields just like `safeReplaceChapterContent()` does. However, this is NOT implemented yet in the standard polish save path — only in the manual chapter replacement path.

---

## Recommendation

The polish save path (Step 13) should use a shared `clearStaleChapterContentFields()` utility to prevent old `content_md_url`, `content`, `draft`, `body`, etc. from overriding polished content during export.
