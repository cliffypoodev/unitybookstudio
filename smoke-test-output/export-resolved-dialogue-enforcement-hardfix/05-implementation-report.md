# Implementation Report

## Root Cause

**Pipeline Gap (C) + Export Gap (E) + Enforcement Gap (F)**

The dialogue mechanics repair module worked perfectly — it detected and repaired all 59 missing opening quotes with 100% repair rate. But the module never ran on export-resolved text.

Three gaps combined:
1. **Pipeline Gap**: Dialogue repair only ran during Polish Manuscript, not during export
2. **Export Gap**: Export resolved chapter content from stored fields/URLs that may never have been polished
3. **Enforcement Gap**: Dialogue issues were temporarily demoted from hard-block to warning-only

## Changes Made

### 1. ExportTab.jsx — Pre-Export Surface Dialogue Repair

Added a deterministic `runDialogueMechanicsPass()` on every resolved chapter's text **immediately before** the safety gate. This ensures:
- Missing opening quotes are repaired regardless of whether the chapter was polished
- The safety gate sees repaired text
- Results stored in `window.__UBS_LAST_EXPORT_SURFACE_REPORT`

### 2. exportSafetyGate.js — Dialogue Hard-Block Restored

Reverted dialogue issues from warning-only back to hard-block (threshold >5).
Since the surface repair pass runs BEFORE the gate, only unfixable issues will trigger the block.

### 3. dialogueMechanicsRepair.js — Expanded Verb/Speaker Coverage

- Added 8 new single-word dialogue verbs: `answered`, `breathed`, `shouted`, `called`, `pressed`, `objected`, `exclaimed`, `declared`
- Added 8 two-word dialogue verb phrases: `shot back`, `called out`, `fired back`, `lashed out`, `bit out`, `threw back`, `cried out`, `pointed out`
- Added speaker names: `Mira`, `Julian`, `the voice`
- Updated both `detectDialogueQuoteIssues()` and `repairMissingDialogueOpeners()` to iterate over both single-word and two-word regex patterns with deduplication

### 4. prosePolishQualityGate.js — Verb List Sync

Expanded the inline dialogue detector's verb and speaker lists to match `dialogueMechanicsRepair.js`.

### 5. exportSafetyGate.js — Verb List Sync

Same expansion as above for the export gate's inline detector.

### 6. safeChapterReplace.test.mjs — Test 12 Updated

Updated to simulate the full pre-export pipeline: surface dialogue repair THEN safety gate.

### 7. exportResolvedDialogueEnforcement.test.mjs — New Test Suite

60 assertions covering all 11 DOCX8 exact failure snippets: detection, repair, surface pass simulation, clean text preservation, apostrophe safety, and hard-block enforcement.

## Verification

| Test Suite | Result |
|---|---|
| exportResolvedDialogueEnforcement.test.mjs | 60/60 ✅ |
| safeChapterReplace.test.mjs | 67/67 ✅ |
| dialogueMechanicsRepair.test.mjs | 23/23 ✅ |
| prosePolisherDialogueSlopRegression.mjs | 38/38 ✅ |
| liveExportSafetyRegression.mjs | 25/25 ✅ |
| prosePolisherQualityGate.test.mjs | 15/15 ✅ |
| manuscriptSafetyGate.test.mjs | 33/33 ✅ |
| llmProsePolisher.test.mjs | 13/13 ✅ |
| aiSlopReduction.test.mjs | 24/24 ✅ |
| **Total** | **298/298 ✅** |
