# 02 — Rewrite Save Trace

**Report:** What happens when Rewrite runs on Chapter 2
**Date:** 2026-06-07

---

## Rewrite Flow: `draftChapter()` in ProjectStudio.jsx

When "Rewrite" runs on Chapter 2, it follows this path:

```
handleRewriteAll() or single chapter rewrite
  → draftChapter(chapter, shouldRefresh, modelOverride, onProgress, options)
    → generateSceneBeats(chapter)         — generates new beats
    → generateChapterByScenes(...)        — LLM generates new prose
    → cleanGeneratedProse(...)            — clean artifacts
    → POST-DRAFT SAFETY GATE             — runManuscriptSafetyGate()
    → IF gate.ok:
        → prepareChapterContent(...)      — prepare for DB
        → Chapter.update(...)             — save to DB
        → setChapterDraft(content)        — update editor
    → IF !gate.ok:
        → BLOCK SAVE                      — do NOT save
        → report failure                  — return { safetyGateFailed: true }
```

---

## Analysis: What happens with Chapter 2

### Scenario A: New LLM output passes safety gate

| Step | What Happens | Status |
|------|-------------|--------|
| 1 | LLM generates new prose | ✅ |
| 2 | Safety gate checks new text | ✅ PASS |
| 3 | `prepareChapterContent` prepares fields | ✅ |
| 4 | `clearRichContentFields()` clears HTML/delta | ✅ |
| 5 | `Chapter.update()` saves to DB | ✅ |
| 6 | `content_md_url` gets NEW upload URL | ✅ |
| 7 | Old contaminated URL superseded | ✅ |
| 8 | Legacy fields (`content`, `draft`, `body`) | ❌ NOT CLEARED |

### Scenario B: New LLM output ALSO fails safety gate (likely scenario)

| Step | What Happens | Status |
|------|-------------|--------|
| 1 | LLM generates new prose | ✅ |
| 2 | Safety gate checks new text | ❌ FAIL |
| 3 | `draftChapter()` returns `{ safetyGateFailed: true }` | ✅ |
| 4 | **No save occurs** | ✅ Correct — don't save bad text |
| 5 | Old contaminated `content_md` / `content_md_url` **PERSISTS** | ❌ STALE |
| 6 | Export still resolves contaminated content | ❌ PROBLEM |
| 7 | User sees no change in editor | ❌ CONFUSING |

---

## Key Questions Answered

| Question | Answer |
|----------|--------|
| 1. Does the rewrite generator produce new Chapter 2 text? | ✅ YES — LLM generates new text from beats |
| 2. Does the post-draft safety gate reject the new output? | ⚠️ POSSIBLY — if LLM reproduces similar contamination (likely given same project context) |
| 3. If rejected, does the app preserve the old contaminated chapter? | ✅ YES — this is the correct behavior (don't save bad text) |
| 4. Does the app save the new rewritten text anywhere? | ❌ NO — if gate fails, nothing is saved |
| 5. Does it clear old `content_md_url` / `content_md`? | ❌ NO — old contaminated fields persist |
| 6. Does the UI still show the old contaminated version after rewrite? | ✅ YES — editor shows old text |
| 7. Does export still resolve old content? | ✅ YES — `resolveChapterContent()` returns contaminated text |

---

## Root Cause

> [!CAUTION]
> The "reject and don't save" behavior is correct for preventing NEW contamination from being saved. But it creates a deadlock: the old contaminated content persists, and there is no path to replace it. The rewrite either produces clean text (unlikely if the project context itself triggers the LLM's contamination pattern) or produces contaminated text and the old contaminated version remains.

---

## What's Missing

There is no "replace contaminated content with known-good text" path. The existing flows are:

| Path | Can Replace Bad Content? | Why Not |
|------|-------------------------|---------|
| Rewrite (draftChapter) | ⚠️ Only if LLM output passes gate | LLM may reproduce contamination |
| Polish (handleManuscriptPolish) | ❌ NO — quarantines but doesn't replace | By design: polish transforms, doesn't regenerate |
| Manual Edit + Save (handleSaveChapter) | ⚠️ Partial — saves but doesn't clear stale fields | Doesn't clear `content_md_url`, legacy fields |
| Export Edit + Save (handleSaveExportChapter) | ⚠️ Partial — same problem | Same |
| **NEW: safeReplaceChapterContent()** | ✅ YES | Clears ALL stale fields, runs gate, verifies |

---

## Recommendation

The missing feature is `safeReplaceChapterContent()` — now implemented in `src/lib/safeChapterReplace.js`. This function:

1. Accepts known-good replacement text
2. Runs safety gate before save
3. Clears ALL stale content fields (15+ fields)
4. Saves through the canonical `Chapter.update()` path
5. Supports post-save read-back verification

The UI toast after a failed rewrite should say:

> "Chapter 2 rewrite failed safety gate. Old contaminated content remains and must be regenerated or manually replaced. Use `window.__UBS_SAFE_REPLACE(2, repairedText)` in browser console."
