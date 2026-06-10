# 05 — Hardfix Implementation

**Report:** All code changes for the live safety enforcement hardfix
**Date:** 2026-06-07

---

## File 1: `src/lib/exportSafetyGate.js` [NEW]

Extracted testable export safety gate module. No window.confirm — strict blocking by default.

**Exports:**
- `runPreExportSafetyGate(chapters, options)` — scans all chapters, returns structured report
- `formatExportSafetyFailure(report)` — user-visible failure text

**Key behaviors:**
- Logs every chapter with `[SAFETY-GATE]` structured format
- Stores report to `window.__UBS_LAST_SAFETY_REPORT`
- Returns `{ blocked, hardFailures, warnings, passed, summary, timestamp }`
- Override only via `window.ALLOW_UNSAFE_EXPORT = true` (checked in ExportTab.jsx)

---

## File 2: `src/components/publishing/ExportTab.jsx` [MODIFIED]

### Change 1: Import updated
```diff
-import { runManuscriptSafetyGate } from '@/lib/manuscriptSafetyGate';
-console.log('[EXPORT] ExportTab RECOVERY v44 loaded...');
+import { runPreExportSafetyGate, formatExportSafetyFailure } from '@/lib/exportSafetyGate';
+console.log('[EXPORT] ExportTab HARDFIX v45 loaded: strict safety gate blocking + no catch-block bypass');
```

### Change 2: Safety gate replaced (buildResolvedExportChapters)
```diff
-// window.confirm approach — too easy to bypass
-const userOverride = window.confirm('Export anyway?');
-if (!userOverride) throw new Error('Export blocked');
+// STRICT: hard block with tagged error
+const safetyReport = runPreExportSafetyGate(cleaned, { project, stage: 'pre-export' });
+if (safetyReport.blocked) {
+  if (window.ALLOW_UNSAFE_EXPORT === true) {
+    window.ALLOW_UNSAFE_EXPORT = false; // auto-reset
+  } else {
+    const err = new Error('SAFETY_GATE_BLOCK: ' + safetyReport.summary);
+    err.isSafetyGateBlock = true;
+    err.safetyReport = safetyReport;
+    throw err;
+  }
+}
```

### Change 3: Catch-block hardened (handleExport)
```diff
 } catch (err) {
+  if (err?.isSafetyGateBlock) {
+    console.error('[EXPORT] BLOCKED BY SAFETY GATE. Export aborted.');
+    alert(formatExportSafetyFailure(report));
+    return; // HARD STOP — do not produce DOCX
+  }
   console.error('[EXPORT] Final export snapshot failed:', err);
   exportChapters = (orderedWithEdits || []).filter(Boolean);
 }
```

---

## File 3: `src/pages/ProjectStudio.jsx` [MODIFIED]

### Change 1: Version bumped
```diff
-console.log('[PROJECTSTUDIO] v15.9 loaded...');
+console.log('[PROJECTSTUDIO] v16.0 loaded: HARDFIX — strict safety gate enforcement');
```

### Change 2: Logging helpers added (after imports)
- `logSafetyGateResult(stage, chapterNum, title, gate)` — structured console logging
- `storeSafetyReport(stage, chapters)` — `window.__UBS_LAST_SAFETY_REPORT` storage

### Change 3: Logging calls added to all 4 gate locations
- Post-draft fiction: `logSafetyGateResult('post-draft', ...)` + `storeSafetyReport()`
- Post-draft NF: `logSafetyGateResult('post-draft-nf', ...)`
- Pre-polish fiction: `logSafetyGateResult('pre-polish', ...)` + `storeSafetyReport()`
- Pre-polish NF: `logSafetyGateResult('pre-polish-nf', ...)`

---

## File 4: `tests/liveExportSafetyRegression.mjs` [NEW]

25 assertions testing the actual `exportSafetyGate` module:
1. Mixed manuscript (1 contaminated, 2 clean) → BLOCKED
2. All chapters contaminated → BLOCKED
3. All clean chapters → PASS
4. Failure report format verification
5. Short chapter skip (no false positive)
6. REAL extracted (4).docx Chapter 2 → BLOCKED

---

## Files NOT modified

| File | Reason |
|------|--------|
| `manuscriptSafetyGate.js` | Detection works correctly — no changes needed |
| `sceneWriter.js` | Defense-in-depth from previous fix still in place |
| `anthologyPolishChecks.js` | Contamination detector from previous fix still in place |
