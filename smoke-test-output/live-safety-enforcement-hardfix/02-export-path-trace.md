# 02 — Export Path Trace

**Report:** Tracing the actual export path that created `digital-equity-tribunal (4).docx`
**Date:** 2026-06-07

---

## Export Path Sequence

```
User clicks Export → DOCX
  → handleExport(format='docx')
    → buildResolvedExportChapters({ chapters, ... })
      → resolves each chapter's content via resolveChapterContent()
      → applyFinalExportCleanup(resolved, project)
      → runPreExportSafetyGate(cleaned, { project })    ← GATE HERE
      → if blocked: throw tagged error
    ← catch block receives error
      → OLD: fell through to orderedWithEdits    ← ROOT CAUSE 1
      → NEW: checks isSafetyGateBlock, returns (HARD STOP)
    → buildDocxDocument(project, exportChapters, settings, dim)
    → Packer.toBlob(doc)
    → downloadBlob(blob, filename)
```

---

## 10 Questions Answered

| # | Question | Answer |
|---|----------|--------|
| 1 | Is `runManuscriptSafetyGate()` called during actual export? | **YES** — via `runPreExportSafetyGate()` in `buildResolvedExportChapters()` (line 767) |
| 2 | Is it called before or after final export cleanup? | **AFTER** — `applyFinalExportCleanup()` runs first (line 761), then the gate scans cleaned content |
| 3 | Does it receive the full resolved chapter body? | **YES** — scans `ch.content_md` on cleaned chapters |
| 4 | Does it receive stale/empty/trimmed content? | **NO** — receives the full resolved content. Content is stale only in the DB sense (pre-gate) |
| 5 | Is the result ignored? | **WAS YES** (catch-block bypass). **NOW NO** (tagged error → hard stop) |
| 6 | Is `window.confirm` allowing a hard fail to continue? | **WAS YES**. **NOW REMOVED** — replaced with hard block |
| 7 | Was an override clicked? | **LIKELY** — either clicked OK on confirm, or the catch-block bypass made it moot |
| 8 | Is export using a different code path than modified? | **NO** — only one DOCX export path (line 984–988) |
| 9 | Is ExportTab.jsx code hot-reloaded in the running app? | **UNKNOWN** — if the user ran the app without rebuilding after code changes, the old code would still be active |
| 10 | Is there a second DOCX export path? | **NO** — `buildDocxDocument` is called in exactly one place (line 985) |

---

## Root Causes

### Root Cause 1 (CRITICAL): Catch-block fallthrough

**Before (VULNERABLE):**
```javascript
} catch (err) {
  console.error('[EXPORT] Final export snapshot failed:', err);
  exportChapters = (orderedWithEdits || []).filter(Boolean); // ← BYPASS
}
```

When `buildResolvedExportChapters()` threw because the safety gate blocked, the catch block assigned `orderedWithEdits` directly — **completely bypassing the gate**.

**After (FIXED):**
```javascript
} catch (err) {
  if (err?.isSafetyGateBlock) {
    alert(formatExportSafetyFailure(report));
    return; // HARD STOP — do not produce DOCX
  }
  // Only non-safety errors fall through
  exportChapters = (orderedWithEdits || []).filter(Boolean);
}
```

### Root Cause 2 (CRITICAL): window.confirm

**Before:** `window.confirm('Export anyway?')` — one click to bypass.
**After:** Hard block with `alert()` + `return`. Override only via `window.ALLOW_UNSAFE_EXPORT = true` in console.

### Root Cause 3 (MODERATE): Stale DB content

Chapter 2 was saved before gates existed. The post-draft gate only checks new drafts. The pre-export gate now catches it regardless of when content was saved.
