# UI Action Wiring Report

## ProjectStudio.jsx — Polish Actions

### handleManuscriptPolish (Fiction Polish)

| Step | Module | Profile-Aware? | Status |
|---|---|---|---|
| 1c. Pre-polish safety gate | manuscriptSafetyGate | Universal (always runs) | ✅ |
| 1d. LLM prose polish | llmProsePolisher | Not gated by config (always runs if model available) | ✅ |
| 12b. Missing opening quote repair | prosePolishQualityGate | Universal (always runs) | ✅ |
| 12b-1. Dialogue mechanics repair | dialogueMechanicsRepair | ✅ **Profile-aware** (shouldRunDialogueRepair) | ✅ Wired |
| 12b-2. AI-slop reduction | aiSlopReduction | ✅ **Profile-aware** (shouldRunAISlopReduction) | ✅ Wired |
| 12b-3. Improvement scoring | prosePolishQualityGate | Universal | ✅ |
| 12c. Post-polish quality gate | prosePolishQualityGate | Universal | ✅ |

### handleManuscriptPolishNonfiction (Nonfiction Polish)

| Step | Module | Profile-Aware? | Status |
|---|---|---|---|
| Pre-polish safety gate | manuscriptSafetyGate | Universal | ✅ |
| Nonfiction polish engine | nonfictionPolish | Separate engine (already nonfiction-specific) | ✅ |

### handlePolishRouted

Routes to fiction or nonfiction polish based on `isNonfictionProject(project)`. This is the entry point.

| Check | Status |
|---|---|
| Loads project profile | ✅ Via shouldRunDialogueRepair/shouldRunAISlopReduction |
| Passes project into AI-slop reduction | ✅ shouldRunAISlopReduction(project) gates the loop |
| Passes project into dialogue repair | ✅ shouldRunDialogueRepair(text, project) gates per-chapter |
| Saves through canonical path | ✅ prepareChapterContent + prepareBackupContent |
| No DET-specific assumptions in polish path | ✅ Verified |

## ExportTab.jsx — Export Actions

| Step | Module | Project-Agnostic? | Status |
|---|---|---|---|
| Resolve canonical content | chapterStorage | ✅ Universal | ✅ |
| Normalize export body | applyFinalExportCleanup | ✅ Universal | ✅ |
| Stale URL check | Inline | ✅ Universal | ✅ |
| Pre-export surface dialogue repair | dialogueMechanicsRepair | ✅ Runs on ALL exports | ✅ |
| Pre-export safety gate | exportSafetyGate | ✅ Universal hard-block | ✅ |
| Process leak detection | exportSafetyGate | ✅ Universal | ✅ |
| Contamination detection | exportSafetyGate | ✅ Universal | ✅ |
| Malformed hard failures | exportSafetyGate | ✅ Universal | ✅ |
| Depends on project title | ❌ No dependency | ✅ |
| Depends on chapter numbers | ❌ No dependency | ✅ |
