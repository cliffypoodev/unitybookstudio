# 01 — Current Prose Pipeline Audit

**Date:** 2026-06-10  
**Scope:** All prose cleanup, polish, and safety modules in UBS

---

## Module Inventory

| Module | Lines | Deterministic? | Calls LLM? | Mutates Text? | Connected? |
|--------|-------|---------------|------------|--------------|-----------|
| `prosePolishQualityGate.js` | 470 | ✅ | ❌ | Some fns | ✅ ProjectStudio |
| `llmProsePolisher.js` | 311 | Partly | ✅ (Ollama) | No (returns) | ✅ ProjectStudio |
| `dialogueMechanicsRepair.js` | 930 | ✅ | ❌ | Repair fns | ✅ ProjectStudio, ExportTab |
| `aiSlopReduction.js` | 687 | ✅ | ❌ | Reduce fns | ✅ ProjectStudio |
| `llmSentenceRecast.js` | 130 | ✅ (**misnamed**) | ❌ | Yes | ❌ **ORPHANED — not imported anywhere** |
| `punctuationPolish.js` | 788 | ✅ | ❌ | In-place on loaded[] | ✅ ProjectStudio, manuscriptFixer |
| `manuscriptSafetyGate.js` | 574 | ✅ | ❌ | No (blocks) | ✅ Everywhere |
| `exportSafetyGate.js` | 390 | ✅ | ❌ | No (blocks) | ✅ ExportTab |
| `referenceIntegrityGate.js` | 963 | ✅ | ❌ | No (reports) | ✅ ExportTab, polishPipelineConfig |
| `postDraftCleanup.js` | ~200 | ✅ | ❌ | Yes | ✅ Post-draft path |
| `sentencePatternPolish.js` | ~400 | ✅ | ❌ | Yes | ✅ Polish pipeline |
| `quoteFixPolish.js` | ~150 | ✅ | ❌ | Yes | ✅ Polish pipeline |
| `styleTicSweep.js` | ~300 | ✅ | ❌ | Yes | ✅ Polish pipeline |

---

## What Runs When

### Manual Polish (ProjectStudio "Polish" button)
1. `runPunctuationCleanup` (from punctuationPolish.js)
2. `runSpellingFixes` (from punctuationPolish.js)
3. `runBrokenSentenceFixes` (from punctuationPolish.js)
4. `runDialoguePunctuationFix` (from punctuationPolish.js)
5. `runDialogueFillerFix` (from punctuationPolish.js)
6. `runCopingMechanismCaps` (from punctuationPolish.js)
7. `runDialogueMechanicsPass` (from dialogueMechanicsRepair.js)
8. `runMidParagraphDialogueAutofixPass` (from dialogueMechanicsRepair.js)
9. `runAISlopReductionPass` (from aiSlopReduction.js)
10. `runDeterministicGrammarRepair` (from prosePolishQualityGate.js)
11. `runProsePolishQualityGate` (from prosePolishQualityGate.js) — final gate
12. Optionally: `polishChapterWithLLM` (if LLM mode enabled)

### Export (ExportTab)
1. `runDialogueMechanicsPass` — surface repair only
2. `runMidParagraphDialogueAutofixPass` — surface repair only
3. `runPreExportSafetyGate` — orchestrator (calls manuscriptSafetyGate per chapter)
4. `runReferenceIntegrityGate` — whole-manuscript (via exportSafetyGate)
5. Series contract gate (if series linked)

### Draft All / Rewrite All
1. LLM generates chapter content
2. `postDraftCleanup` runs on generated text
3. `runManuscriptSafetyGate` validates output
4. Save if clean

---

## Critical Findings

### 1. `llmSentenceRecast.js` is ORPHANED
Despite the name, this module is **fully deterministic** (no LLM calls). It has 7 curated recast rules for "felt" → physical sensation patterns. However, **it is not imported anywhere in the codebase**. The `polishPipelineConfig.js` has a boolean `llmSentenceRecast` flag but no code actually reads that flag to call the module.

### 2. Formatting Artifacts Not Handled
No existing module handles:
- `e. g.` → `e.g.`
- `youTube` → `YouTube`
- `—Every` capitalization artifacts
- `' compliance. '` spaced quote artifacts
- Source markers like `[TK]` or `[SOURCE NEEDED]`

### 3. Essay/Forensic Phrase Detection Missing
The AI-slop reducer handles fiction slop ("felt", "palpable", "the weight of") but does NOT handle nonfiction/forensic AI-slop:
- "The available accounts indicate"
- "The record suggests"
- "This suggests"
- "What remains unclear"
- "The question therefore shifts"

### 4. Duplicated Detection
Malformed grammar detection exists in THREE places:
- `prosePolishQualityGate.js` (detect + repair)
- `manuscriptSafetyGate.js` (detect + block)
- `punctuationPolish.js` (partial — "Was was", "the the")

Slop counting exists in TWO places:
- `aiSlopReduction.js` (35 patterns with budgets)
- `prosePolishQualityGate.js` (23 patterns, report only)
- `exportSafetyGate.js` (13 patterns, inline)

### 5. No Central Orchestrator
There is no single function that runs the full deterministic cleanup pipeline in a predictable order. ProjectStudio.jsx calls modules individually but the order varies and some steps can be skipped. Export only runs dialogue repair + safety gate.

### 6. `punctuationPolish.js` API Mismatch
This module operates on `loaded[]` arrays (objects with `.content` property) — not on plain text strings. This means it cannot be easily called from a text-in/text-out pipeline without wrapping.

---

## Recommendation
Create `src/lib/unifiedProseRefinement.js` as a central orchestrator that:
- Runs deterministic cleanup in a fixed order
- Works on plain text strings (text-in / text-out)
- Reuses existing modules where possible
- Adds missing formatting artifact cleanup
- Adds essay/forensic phrase detection (report only)
- Returns structured results with metrics
