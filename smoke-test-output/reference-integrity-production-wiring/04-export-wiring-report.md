# Export Path — Reference Integrity Wiring Report

## Changes Made

### `exportSafetyGate.js`
- Added import: `import { runReferenceIntegrityGate } from './referenceIntegrityGate.js'`
- Added whole-manuscript reference integrity check after per-chapter safety loop
- BLOCKING reference issues create `hardFailures` entries (block export)
- WARNING reference issues create `warnings` entries (do not block)
- Added `referenceReport` to returned report object
- Stored at `window.__UBS_LAST_EXPORT_REFERENCE_REPORT`

## Export Workflow (After Wiring)

| Step | Action | Reference Gate | Status |
|---|---|---|---|
| 1 | Resolve chapter content | — | ✅ |
| 2 | Apply final export cleanup | — | ✅ |
| 3 | Stale content check | — | ✅ |
| 4 | Surface dialogue repair | — | ✅ |
| 5 | Mid-paragraph dialogue autofix | — | ✅ |
| 6 | Per-chapter safety gate | Process leaks, contamination, malformed | ✅ |
| 7 | **Reference integrity gate** | **Full manuscript crosscheck** | ✅ NEW |
| 8 | Export format generation | — | ✅ |

## Export Types

| Export Type | Gate Runs? | References Preserved? | URLs/DOIs Preserved? | Block/Warning | Status |
|---|---|---|---|---|---|
| DOCX | ✅ Yes | ✅ Yes (back matter) | ✅ Yes (in text) | Block on BLOCKING | ✅ |
| Markdown | ✅ Yes | ✅ Yes (sections) | ✅ Yes (raw text) | Block on BLOCKING | ✅ |
| PDF (print) | ✅ Yes | ✅ Yes (HTML render) | ✅ Yes (hyperlinked) | Block on BLOCKING | ✅ |
| Clipboard | ✅ Yes | ✅ Yes (plain text) | ✅ Yes (plain text) | Block on BLOCKING | ✅ |

## Blocking vs Warning Behavior

| Issue Type | Export Behavior | User Action Required |
|---|---|---|
| BLOCKING reference issue | Export completely blocked | Fix reference, then re-export |
| WARNING reference issue | Export proceeds, warning shown | Review warnings (optional) |
| No reference issues | Export proceeds normally | None |
| No reference section | Gate runs, finds nothing, passes | None |

## Report Structure

The export safety report now includes:
```json
{
  "blocked": true/false,
  "hardFailures": [...],
  "warnings": [...],
  "passed": [...],
  "summary": "...",
  "referenceReport": {
    "ok": true/false,
    "sections": [...],
    "citations": [...],
    "entries": [...],
    "blockingIssues": [...],
    "warnings": [...],
    "summary": "..."
  }
}
```
