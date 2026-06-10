# 06 — Integration Wiring Guide

**Date:** 2026-06-10  
**Module:** `src/lib/unifiedProseRefinement.js`

---

## Current Wiring Status

The `unifiedProseRefinement.js` module is **created, tested, and passing** but is **not yet wired into** ProjectStudio.jsx or ExportTab.jsx. This document describes how to wire it in when ready.

---

## Integration Point 1: Manual Polish (ProjectStudio.jsx)

### Current Flow
The manual polish flow in `handleManuscriptPolish` calls 10+ modules individually:
1. Punctuation cleanup, spelling fixes
2. Dialogue mechanics repair
3. AI-slop reduction
4. Grammar repair
5. Quality gate
6. (Optionally) LLM polish

### Proposed Flow
Replace the deterministic subset with a single call:

```javascript
import { runUnifiedProseRefinement } from '@/lib/unifiedProseRefinement';

// In handleManuscriptPolish, for each chapter:
const result = runUnifiedProseRefinement({
  text: chapterContent,
  chapter: chapterNumber,
  project: { genre: project.genre, subgenre: project.subgenre },
  mode: 'standard',
});

// Use result.text as the cleaned content
// Check result.blocked before saving
// Display result.warnings to the user
// Log result.repairs for debugging

// Then optionally run LLM polish on result.text:
if (useLLMPolish) {
  const llmResult = await polishChapterWithLLM({
    chapterText: result.text,
    chapterTitle: chapter.title,
    chapterNumber: chapterNumber,
    // ...
  });
}
```

### What This Replaces
- `runPunctuationCleanup` (punctuationPolish.js) — partially, for grammar/spacing
- `runSpellingFixes` (punctuationPolish.js)
- `runBrokenSentenceFixes` (punctuationPolish.js)
- `runDialogueMechanicsPass` (dialogueMechanicsRepair.js)
- `runMidParagraphDialogueAutofixPass` (dialogueMechanicsRepair.js)
- `runAISlopReductionPass` (aiSlopReduction.js)
- `runDeterministicGrammarRepair` (prosePolishQualityGate.js)
- `repairMissingOpeningQuotes` (prosePolishQualityGate.js)
- `runProsePolishQualityGate` (prosePolishQualityGate.js)

### What This Does NOT Replace
These modules have unique functionality not covered by the unified pipeline:
- `polishChapterWithLLM` — LLM-based polish (separate, optional step)
- `runAntiDetectionPolish` — AI detection resistance
- `runStyleTicSweep` — manuscript-wide phrase capping
- `runVocabCaps` — vocabulary frequency capping
- `fixVoicePatterns` — voice pattern fixes
- `repairCanonNameDrift` — canon name locking
- `repairLoadedManuscriptArtifacts` — cross-chapter artifact repair (operates on loaded[])

---

## Integration Point 2: Export Preflight (ExportTab.jsx)

### Current Flow
Export only runs dialogue repair + safety gate.

### Proposed Flow
Add a `surface-only` pass before the safety gate:

```javascript
import { runUnifiedProseRefinement } from '@/lib/unifiedProseRefinement';

// In buildResolvedExportChapters, for each chapter:
const result = runUnifiedProseRefinement({
  text: chapterContent,
  chapter: chapterNumber,
  project: { genre: project.genre },
  mode: 'surface-only',  // Only phases 1-4: formatting, grammar, punctuation, dialogue
});

// Use result.text for export
// result.warnings feeds into the export report
```

### What This Adds to Export
- Phase 1: Fixes "e. g.", source markers, markdown residue
- Phase 2: Fixes "Was was", "She were", "a obvious"
- Phase 3: Fixes double commas, duplicate articles, quote cleanup
- Phase 4: Fixes dialogue openers (already done separately)

### Safety Guarantee
Surface-only mode skips phases 5-6 (slop reduction and sentence recasts), so export never performs aggressive text rewriting. It only applies safe, deterministic surface cleanup.

---

## Integration Point 3: Diagnostic Scan

### Use Case
UI button that scans a chapter without changing it, showing quality metrics.

```javascript
const result = runUnifiedProseRefinement({
  text: chapterContent,
  chapter: chapterNumber,
  mode: 'detect-only',
});

// result.text === original text (unchanged)
// result.repairs shows what WOULD be fixed
// result.warnings shows quality issues
// result.beforeMetrics shows current quality state
```

---

## Dependencies

```
unifiedProseRefinement.js
├── prosePolishQualityGate.js  (runDeterministicGrammarRepair, runProsePolishQualityGate)
├── dialogueMechanicsRepair.js (runDialogueMechanicsPass, repairSafeMidParagraphDialogueOpeners)
├── aiSlopReduction.js         (runAISlopReductionPass)
└── llmSentenceRecast.js       (applyLLMSentenceRecasts)
```

All imports use relative paths. All dependencies are deterministic. No LLM calls.
