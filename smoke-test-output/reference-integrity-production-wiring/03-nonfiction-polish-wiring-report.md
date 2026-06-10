# Nonfiction Polish — Reference Integrity Wiring Report

## Changes Made

### `polishPipelineConfig.js`
- Added `referenceIntegrity` property to all 6 profiles
- Added `shouldRunReferenceIntegrity(text, project)` function
- Added import of `detectReferenceSections`, `extractInlineCitations` from `referenceIntegrityGate.js`
- Exported `shouldRunReferenceIntegrity`

### `ProjectStudio.jsx`
- Added import: `import { shouldRunReferenceIntegrity } from '@/lib/polishPipelineConfig'`
- Added import: `import { runReferenceIntegrityGate } from '@/lib/referenceIntegrityGate'`
- Wired into `handleManuscriptPolishNonfiction()` after `runNonfictionPolish()`
- Wired into `handleManuscriptPolish()` after Step 12b-3 (improvement scoring)

## Nonfiction Polish Workflow (After Wiring)

| Step | Workflow | Reference Gate Behavior | Status |
|---|---|---|---|
| 1 | Load chapters | — | ✅ |
| 2 | Pre-polish safety gate | — | ✅ |
| 3 | `runNonfictionPolish()` | — | ✅ |
| 4 | **Reference integrity gate** | **Runs on all polished text** | ✅ NEW |
| 5 | Report via toast | BLOCKING → error, WARNING → info | ✅ NEW |
| 6 | Store report | `window.__UBS_LAST_REFERENCE_REPORT` | ✅ NEW |
| 7 | Final polish report | Includes reference summary in changes | ✅ NEW |

## Fiction Polish Workflow (After Wiring)

| Step | Workflow | Reference Gate Behavior | Status |
|---|---|---|---|
| 1-12b-3 | All existing polish steps | — | ✅ |
| 12b-3b | **Reference integrity (auto-detect)** | **Only if refs detected** | ✅ NEW |
| 12c | Post-polish quality gate | — | ✅ |
| 12d | Save | — | ✅ |

## Safety Guarantees
- Reference gate is **read-only** — never mutates text
- Polish save proceeds regardless of reference findings
- Blocking issues produce error toast but do NOT prevent save
- Author sees findings and must fix before export
- No data is fabricated, invented, or auto-completed
