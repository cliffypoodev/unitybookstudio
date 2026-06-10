# Production Path Audit

## Action → Module Routing Matrix

| Action | File | Uses Global Config? | Uses Safety Gate? | Uses Export Gate? | Uses Export Surface Repair? | Status |
|---|---|---|---|---|---|---|
| Draft All | ProjectStudio.jsx | ❌ N/A (generation only) | ❌ N/A | ❌ N/A | ❌ N/A | ✅ By design |
| Rewrite All | ProjectStudio.jsx | ❌ N/A (generation only) | ❌ N/A | ❌ N/A | ❌ N/A | ✅ By design |
| Polish Manuscript (Fiction) | ProjectStudio.jsx | ✅ Yes (shouldRunDialogueRepair, shouldRunAISlopReduction) | ✅ Yes (manuscriptSafetyGate) | ❌ N/A | ❌ N/A | ✅ Wired |
| Polish Manuscript (NF) | ProjectStudio.jsx | ❌ Delegates to nonfictionPolish | ✅ Yes (manuscriptSafetyGate) | ❌ N/A | ❌ N/A | ✅ Safe |
| Scan/Fix Chapter | ProjectStudio.jsx | ❌ N/A (Critic Agent) | ❌ Content destruction guard | ❌ N/A | ❌ N/A | ✅ Safe |
| Safe Chapter Replace | ProjectStudio.jsx | ❌ N/A (safety-gated write) | ✅ Yes (via safeChapterReplace) | ❌ N/A | ❌ N/A | ✅ Safe |
| Export DOCX | ExportTab.jsx | ❌ Not needed at export | ❌ N/A | ✅ Yes (exportSafetyGate) | ✅ Yes (runDialogueMechanicsPass) | ✅ Wired |
| Export PDF | ExportTab.jsx | ❌ Same as DOCX path | ❌ N/A | ✅ Yes (same buildResolved) | ✅ Yes (same surface repair) | ✅ Wired |
| Export Markdown | ExportTab.jsx | ❌ Same path | ❌ N/A | ✅ Yes | ✅ Yes | ✅ Wired |
| Export Clipboard | ExportTab.jsx | ❌ Same path | ❌ N/A | ✅ Yes | ✅ Yes | ✅ Wired |

## Production Wiring Changes Made

| File | Change | Lines |
|---|---|---|
| ProjectStudio.jsx | Added import: shouldRunDialogueRepair, shouldRunAISlopReduction from polishPipelineConfig | Line 81 |
| ProjectStudio.jsx | STEP 12b-1: dialogue repair gated with shouldRunDialogueRepair(text, project) | Lines 4556-4564 |
| ProjectStudio.jsx | STEP 12b-2: slop reduction gated with shouldRunAISlopReduction(project) | Lines 4579-4590 |
| package.json | Added test:polish-pipeline script | Line 17 |

## Key Architecture Notes

- Draft/Rewrite are generation-only actions. They do NOT run polish. This is by design.
- The NF polish delegates to runNonfictionPolish() which has its own cleanup engine.
- Export runs surface dialogue repair + export safety gate on ALL exports regardless of project type.
- polishPipelineConfig controls POLISH behavior only, not export safety.
