# Root Cause Report — Export-Resolved Dialogue Enforcement Hardfix

> **Report 4 of 4** — Export-Resolved Dialogue Enforcement Hardfix
> Generated: 2026-06-08

## Executive Summary

The 50 missing opening quote issues in DOCX8 are caused by **three concurrent root causes**: the dialogue repair module only runs in the polish pipeline (Pipeline Gap), export resolves content that may never have been polished (Export Gap), and the export safety gate treats dialogue issues as non-blocking warnings (Enforcement Gap). All three must be fixed together.

---

## Root Cause Classification

| Category | Root Cause? | Evidence | Severity |
|----------|-------------|----------|----------|
| **A. Detection Gap** | ❌ NO | `detectDialogueQuoteIssues()` finds all 50 issues across 13 chapters | — |
| **B. Repair Gap** | ❌ NO | `repairMissingDialogueOpeners()` repairs all 50 to 0 remaining | — |
| **C. Pipeline Gap** | ✅ **YES** | Dialogue repair only runs in polish flow (STEP 12b-1), not in export flow | **Critical** |
| **D. Save Gap** | ⚠️ PARTIAL | If chapter was polished, repaired text is saved; but many chapters were not polished | Moderate |
| **E. Export Gap** | ✅ **YES** | Export resolves content that may never have been polished, and no repair runs on resolved text | **Critical** |
| **F. Enforcement Gap** | ✅ **YES** | Dialogue issues demoted from hard-block to warning-only in export gate ([line 120](file:///Users/cliff/Downloads/UBS/src/lib/exportSafetyGate.js#L120)) | **Critical** |

### Primary Root Causes: C + E + F

---

## Detailed Analysis

### Root Cause C: Pipeline Gap

**What**: `runDialogueMechanicsPass()` is only called in one place in the entire codebase:

```
src/pages/ProjectStudio.jsx:4562
```

This is inside `handleManuscriptPolish()` at STEP 12b-1. The export pipeline in `ExportTab.jsx` never imports or calls any function from `dialogueMechanicsRepair.js`.

**Why it matters**: The polish pipeline is optional — users can export without ever running polish. Even if they polish, chapters edited afterward don't get re-polished automatically.

**Evidence**:
- `grep 'dialogueMechanicsRepair' ExportTab.jsx` → **0 results**
- `grep 'runDialogueMechanicsPass' src/` → only `ProjectStudio.jsx` and test files

### Root Cause E: Export Gap

**What**: Export resolves chapter content from stored DB fields or URLs ([ExportTab.jsx:210-304](file:///Users/cliff/Downloads/UBS/src/components/publishing/ExportTab.jsx#L210-L304)). The resolved content is whatever was last saved — which may be:

1. Raw LLM output (never polished)
2. Pre-STEP-12b-1 polished text (polished before dialogue repair existed)
3. Re-fetched URL content (stale/overwritten after polish)
4. Editor-saved text (saved via Export tab editor, bypassing polish)

The `applyFinalExportCleanup()` function ([ExportTab.jsx:2674-2732](file:///Users/cliff/Downloads/UBS/src/components/publishing/ExportTab.jsx#L2674-L2732)) runs 10+ cleanup passes but **none** include dialogue repair:

| Export cleanup pass | Repairs dialogue? |
|--------------------|--------------------|
| `runExportTextSafetyNet()` | ❌ |
| `runTerminalExportSourceGuard()` | ❌ |
| `removeForbiddenExportArtifactParagraphs()` | ❌ |
| `uniquifyDuplicateExportChapterTitles()` | ❌ |
| `runCrossChapterExportRouteGuard()` | ❌ |
| `thinSongbirdStyleTicsAcrossChapters()` | ❌ |
| `thinGenericStyleTicsAcrossChapters()` | ❌ |
| `applyNonfictionSourceIntegrityExportCleanup()` | ❌ |
| `repairStyleThinningArtifacts()` | ❌ |
| `runNonfictionFinalExportScarTissueSweep()` | ❌ |

### Root Cause F: Enforcement Gap

**What**: The export safety gate explicitly treats dialogue issues as **warnings**, not hard blocks:

```javascript
// exportSafetyGate.js line 120-121
// Dialogue issues: warning-only (fixable by running Polish Manuscript)
// Process leaks, contamination, and malformed grammar remain hard blocks.
```

The gate's classification:
- `dialogueIssueCount > 5 && gate.ok` → `dialogueWarning = true` (line 122)
- Warning entries go to `warnings` array, not `hardFailures`
- `blocked` flag only checks `hardFailures.length > 0` (line 156)
- Export proceeds with warnings logged to console

**Contrast with other issue types**:

```javascript
// These ARE hard blocks:
if (entry.recommendedAction === 'REJECT_REGENERATE' ||
    entry.recommendedAction === 'REJECT_MANUAL_REVIEW') {
  hardFailures.push(entry);  // → blocks export
}
```

---

## Impact Assessment

### Per-Chapter Breakdown

| Chapter | Issues | Repaired by Polish? | In DOCX8? |
|---------|--------|---------------------|-----------|
| Ch.1 | 5 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.3 | 5 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.4 | 2 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.6 | 10 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.7 | 8 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.8 | 4 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.9 | 1 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.10 | 3 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.12 | 3 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.13 | 2 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.14 | 4 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.17 | 1 | ✅ (if polished) | ❌ Yes — unrepaired |
| Ch.20 | 2 | ✅ (if polished) | ❌ Yes — unrepaired |
| **Total** | **50** | — | **50 unrepaired** |

---

## Fix Specification

### Fix 1: Pre-Export Surface Repair

**What**: Run `runDialogueMechanicsPass()` on each chapter's resolved text immediately before DOCX packaging.

**Where**: In `buildResolvedExportChapters()` ([ExportTab.jsx](file:///Users/cliff/Downloads/UBS/src/components/publishing/ExportTab.jsx#L762)), between `applyFinalExportCleanup()` (line 762) and the safety gate (line 803).

**Implementation**:

```javascript
// After line 762: const cleaned = applyFinalExportCleanup(resolved, project);
// ADD: Pre-export dialogue mechanics repair pass

let preExportDialogueRepairLog = [];
try {
  const { runDialogueMechanicsPass } = await import('../lib/dialogueMechanicsRepair.js');
  for (const ch of cleaned) {
    const content = ch?.content_md || '';
    if (content.length < 100) continue;
    const dmResult = runDialogueMechanicsPass(content, {});
    if (dmResult.repairs.length > 0) {
      ch.content_md = dmResult.text;
      ch.word_count = countPlainWords(dmResult.text);
      preExportDialogueRepairLog.push({
        chapter: ch?.chapter_number || ch?.__exportIndex + 1,
        repaired: dmResult.repairs.length,
        before: dmResult.beforeCount,
        after: dmResult.afterCount,
      });
      console.log(
        `[EXPORT] Pre-export dialogue repair: Ch.${ch?.chapter_number} — ` +
        `${dmResult.repairs.length} fixed (${dmResult.beforeCount} → ${dmResult.afterCount})`
      );
    }
  }
  if (preExportDialogueRepairLog.length > 0) {
    console.log('[EXPORT] Pre-export dialogue repair summary:', preExportDialogueRepairLog);
  }
} catch (e) {
  console.warn('[EXPORT] Pre-export dialogue repair unavailable:', e?.message);
}
```

**Rationale**: Using dynamic `import()` avoids circular import issues (same pattern as `exportSafetyGate.js` line 19-29). Running on `cleaned` text means all other export cleanup passes have already executed, so the dialogue repair sees the final text.

### Fix 2: Revert Dialogue Issues to Hard Block

**What**: Change dialogue issues from warning-only to hard block in `exportSafetyGate.js`.

**Where**: [exportSafetyGate.js:120-125](file:///Users/cliff/Downloads/UBS/src/lib/exportSafetyGate.js#L120-L125)

**Before**:
```javascript
// Dialogue issues: warning-only (fixable by running Polish Manuscript)
if (dialogueIssueCount > 5 && gate.ok) {
  entry.dialogueWarning = true;
  entry.reasons = [...(entry.reasons || []),
    `${dialogueIssueCount} missing opening quote dialogue issues — run Polish Manuscript to repair`];
}
```

**After**:
```javascript
// Dialogue issues: HARD BLOCK if pre-export repair could not resolve them
if (dialogueIssueCount > 0) {
  entry.ok = false;
  entry.recommendedAction = 'REJECT_MANUAL_REVIEW';
  entry.reasons = [...(entry.reasons || []),
    `${dialogueIssueCount} missing opening quote dialogue issues remain after pre-export repair`];
}
```

**Rationale**: With Fix 1 in place, dialogue issues should be resolved before the safety gate runs. If any remain after pre-export repair, they represent issues the repair module couldn't fix (ambiguous cases) and should block export for manual review.

### Fix 3: Post-Repair Re-gate (Defense in Depth)

**What**: After the pre-export dialogue repair pass (Fix 1), if any chapters still have dialogue issues, the safety gate catches them as hard blocks (Fix 2). This creates a **repair-then-verify** pattern:

```
Export Pipeline (FIXED):
  Resolve → Normalize → Cleanup → [Dialogue Repair ✅] → Safety Gate (hard block) → DOCX
                                         ↑                        ↑
                                    Fix 1: Repair            Fix 2: Enforce
```

**Expected behavior after fix**:
1. Pre-export repair resolves all 50 issues → use repaired text → export proceeds ✅
2. If pre-export repair cannot resolve all issues → safety gate hard-blocks → export refused ❌

---

## Verification Plan

After implementing all three fixes:

1. **Re-run DOCX8 dialogue scan** on exported text
   - Expected: 0 missing opening quotes across all 20 chapters
   
2. **Test Scenario A**: Export without polishing
   - Expected: Pre-export repair catches and fixes dialogue issues
   
3. **Test Scenario B**: Export with ambiguous dialogue (manual review cases)
   - Expected: Safety gate hard-blocks, user sees clear error message

4. **Test Scenario C**: Export after successful polish
   - Expected: Pre-export repair finds 0 issues (already fixed), gate passes clean

---

## File References

| File | Role | Lines of Interest |
|------|------|-------------------|
| [dialogueMechanicsRepair.js](file:///Users/cliff/Downloads/UBS/src/lib/dialogueMechanicsRepair.js) | Detection + repair module | 141-203 (detect), 283-401 (repair), 483-522 (orchestrate) |
| [exportSafetyGate.js](file:///Users/cliff/Downloads/UBS/src/lib/exportSafetyGate.js) | Export safety gate | 120-125 (warning-only classification), 227-258 (inline detector) |
| [ExportTab.jsx](file:///Users/cliff/Downloads/UBS/src/components/publishing/ExportTab.jsx) | Export pipeline | 678-760 (resolution), 762 (cleanup), 803-823 (gate), 2674-2732 (cleanup function) |
| [ProjectStudio.jsx](file:///Users/cliff/Downloads/UBS/src/pages/ProjectStudio.jsx) | Polish pipeline | 3930 (polish entry), 4556-4577 (STEP 12b-1 dialogue repair) |
