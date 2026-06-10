# 03 — Polish Quarantine Trace

**Report:** What happens when Polish runs with contaminated Chapter 2
**Date:** 2026-06-07

---

## Polish Flow: `handleManuscriptPolish()` in ProjectStudio.jsx

```
handleManuscriptPolish()
  → Load all chapters from DB
  → FOR each chapter:
      → resolveChapterContent(chapter)     — get text from content_md / URL
      → runManuscriptSafetyGate(text, { stage: 'pre-polish' })
      → IF gate.ok:
          → Add to `safeLoaded` array        — eligible for polish
      → IF !gate.ok:
          → Add to `safetyRejected` array    — quarantined
          → Log rejection reason
  → Polish transforms run ONLY on `safeLoaded` chapters
  → Toast reports rejected chapters
  → Rejected chapters keep their original content (unchanged)
```

---

## Simulation Results (from step2-polish-quarantine-simulation.mjs)

| Chapter | Gate OK | Action | Process Leaks | Contamination | Malformed |
|---------|---------|--------|---------------|---------------|-----------|
| Ch.1 | ✅ | WARN_ONLY | 0 | 1 | 0 |
| **Ch.2** | **🚫** | **REJECT_REGENERATE** | **8** | **8** | **1** |
| Ch.3 | ✅ | WARN_ONLY | 0 | 1 | 0 |
| Ch.4–5 | ✅ | PASS | 0 | 0 | 0 |
| Ch.6–7 | ✅ | WARN_ONLY | 0 | 0 | 1 |
| Ch.8 | ✅ | WARN_ONLY | 0 | 3 | 0 |
| Ch.9–12 | ✅ | PASS | 0 | 0 | 0 |
| Ch.13 | ✅ | WARN_ONLY | 0 | 2 | 0 |
| Ch.14–20 | ✅ | PASS | 0 | 0 | 0 |

**Result:** 1 chapter rejected, 19 eligible for polish.

---

## Behavior Verification

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Chapter 2 rejected by pre-polish gate | YES | YES — `REJECT_REGENERATE` | ✅ |
| Polish transforms skip Ch.2 | YES | YES — not in `safeLoaded` | ✅ |
| Polish does not claim Ch.2 was fixed | YES | YES — reports rejection | ✅ |
| Clean chapters polish normally | YES | YES — 19/20 eligible | ✅ |
| Rejection toast displayed | YES | YES — "Ch.2 rejected" | ✅ |

---

## What Polish Does NOT Do

| Missing Feature | Current Behavior | Impact |
|----------------|-----------------|--------|
| Replace contaminated content | Skips Ch.2 entirely | Old text persists |
| Mark Ch.2 as needing replacement | Reports in toast only (transient) | User may not remember |
| Offer "Replace Now" action | No UI action available | User stuck |
| Clear stale content fields | Does not modify Ch.2 at all | Fields remain contaminated |

---

## Conclusion

> [!IMPORTANT]
> Polish quarantine works correctly — it does NOT polish contaminated chapters and does NOT claim they were fixed. This is NOT a polish bug. The missing feature is a safe replacement path, which is now implemented in `safeChapterReplace.js`.

Polish behavior is CORRECT and COMPLETE. No changes needed.
