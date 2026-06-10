# 04 — Safety Gate Runtime Logs

**Report:** Runtime logging added to all safety gate check points
**Date:** 2026-06-07

---

## Logging Infrastructure

Two helper functions added to `ProjectStudio.jsx`:

### `logSafetyGateResult(stage, chapterNum, title, gate)`
Logs a structured line for every safety gate scan:
```
[SAFETY-GATE] stage=pre-export chapter=2/The Patron's Palette ok=false action=REJECT_REGENERATE processLeaks=8 contamination=8 malformed=1
```

On failure, logs first 3 snippets:
```
[SAFETY-GATE:FAIL] chapter=2 phrase="The opening is sharp, highly polished" snippet="The opening is sharp, highly polished, and immediately establishes "
[SAFETY-GATE:FAIL] chapter=2 phrase="Next Move:" snippet="Next Move: Commit to the Bargain"
[SAFETY-GATE:FAIL] chapter=2 phrase="Action Plan:" snippet="Action Plan:"
```

### `storeSafetyReport(stage, chapters)`
Stores the full gate results to `window.__UBS_LAST_SAFETY_REPORT`:
```javascript
window.__UBS_LAST_SAFETY_REPORT = {
  stage: 'pre-export',
  timestamp: '2026-06-07T16:15:00.000Z',
  chapters: [
    { chapterNumber: 1, title: '...', ok: true, action: 'PASS', processLeaks: 0, contamination: 0, malformed: 0 },
    { chapterNumber: 2, title: '...', ok: false, action: 'REJECT_REGENERATE', processLeaks: 8, contamination: 8, malformed: 1, reasons: [...] },
  ]
}
```

---

## Gate Locations with Logging

| Location | Stage Tag | File | Line |
|----------|-----------|------|------|
| Post-draft fiction | `post-draft` | ProjectStudio.jsx | ~2896 |
| Post-draft nonfiction | `post-draft-nf` | ProjectStudio.jsx | ~2791 |
| Pre-polish fiction | `pre-polish` | ProjectStudio.jsx | ~3913 |
| Pre-polish nonfiction | `pre-polish-nf` | ProjectStudio.jsx | ~3807 |
| Pre-export | `pre-export` | exportSafetyGate.js | (built-in) |

---

## Example Log Output (from liveExportSafetyRegression.mjs)

```
[SAFETY-GATE] stage=pre-export chapter=1/The Algorithmic Stage ok=true action=PASS processLeaks=0 contamination=0 malformed=0
[SAFETY-GATE] stage=pre-export chapter=2/The Patron's Palette ok=false action=REJECT_REGENERATE processLeaks=7 contamination=6 malformed=2
[SAFETY-GATE:FAIL] chapter=2 type=process-leak phrase="The opening is sharp, highly polished" snippet="The opening is sharp, highly polished, and immediately establishes "
[SAFETY-GATE:FAIL] chapter=2 type=process-leak phrase="Next Move:" snippet="Next Move: Commit to the Bargain"
[SAFETY-GATE:FAIL] chapter=2 type=process-leak phrase="Action Plan:" snippet="Action Plan:"
[SAFETY-GATE] stage=pre-export chapter=3/The Office of Echoes ok=true action=PASS processLeaks=0 contamination=0 malformed=0
[SAFETY-GATE] Report stored at window.__UBS_LAST_SAFETY_REPORT
```

---

## Live Inspection

After any draft/polish/export operation, inspect the report in the browser console:

```javascript
// View last safety report
console.table(window.__UBS_LAST_SAFETY_REPORT.chapters)

// Check if export was blocked
window.__UBS_LAST_SAFETY_REPORT.chapters.filter(c => !c.ok)
```
