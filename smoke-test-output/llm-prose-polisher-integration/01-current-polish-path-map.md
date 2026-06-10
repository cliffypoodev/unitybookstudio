# 01 — Current Polish Path Map

**Date:** 2026-06-07
**Source:** `handleManuscriptPolish()` in `ProjectStudio.jsx` (L3926–L4600)

---

## Confirmation

> [!IMPORTANT]
> **The current polish path is deterministic only.** No actual LLM Prose Polisher call exists in the active `handleManuscriptPolish()` pipeline.

The app does have a `prose-polisher` Ollama model configured in `localLLM.js` (L13), and a `polisher` agent slot (L100–101), but these are **never called** during the active polish flow. The polish pipeline is 28+ sequential regex/string transforms.

---

## Active Polish Path — Step-by-Step

| Step | Label | Function | File | Type |
|------|-------|----------|------|------|
| 1 | Load chapters | `resolveChapterContent()` | ProjectStudio.jsx:3939 | I/O |
| 1b | Project contamination trim | `stripProjectContaminationBlocks()` | projectContentGuard.js | Deterministic |
| 1c | **Pre-polish safety gate** | `runManuscriptSafetyGate()` | manuscriptSafetyGate.js | Deterministic |
| — | *Rejected chapters removed from pipeline* | — | — | — |
| 2 | Banned word removal | Inline loop (33 words) | ProjectStudio.jsx:4048 | Deterministic |
| 2b | Anthology-specific checks | `runCrossChapterBodyLanguageDedup()`, `runAnthologyVocabBans()`, `runContaminationDetector()` | anthologyPolishChecks.js | Deterministic |
| 3 | Punctuation cleanup | `runPunctuationCleanup()` | punctuationPolish.js:12 | Deterministic |
| 3 | Spelling fixes | `runSpellingFixes()` | punctuationPolish.js:512 | Deterministic |
| 3b | Capitalization errors | Inline regex | ProjectStudio.jsx:4086 | Deterministic |
| 3c | Capitalization hygiene | `runCapitalizationHygiene()` | capitalizationPolish.js | Deterministic |
| 3d | Transition word caps | `runTransitionWordCaps()` | chatgptPatternPolish.js | Deterministic |
| 4 | Dialogue punctuation fix | `runDialoguePunctuationFix()` | punctuationPolish.js:700 | Deterministic |
| 4b | Dialogue filler fix | `runDialogueFillerFix()` | punctuationPolish.js:756 | Deterministic |
| 5 | Stacked clause variation | `runStackedClauseVariation()` | sentencePatternPolish.js | Deterministic |
| 5b | Voice pattern fix | `fixVoicePatterns()` | voicePatternPolish.js | Deterministic |
| 5c | External AI pattern fix | `runExternalAiPatternFix()` | externalAiPatterns.js | Deterministic |
| 5d | Broken sentence fixes | `runBrokenSentenceFixes()` | punctuationPolish.js:555 | Deterministic |
| 6 | Dialogue tag caps | `runDialogueTagCaps()` | dialogueTagPolish.js | Deterministic |
| 6b | Coping mechanism caps | `runCopingMechanismCaps()` | punctuationPolish.js:596 | Deterministic |
| 7 | Vocab caps | `runVocabCaps()` | vocabCaps.js | Deterministic |
| 7b | ChatGPT vocab caps | `runChatGPTVocabCaps()` | chatgptPatternPolish.js | Deterministic |
| 8 | Anti-detection polish | `runAntiDetectionPolish()` | antiDetectionPolish.js | Deterministic |
| 8b | Sentence starter variation | `runSentenceStarterVariation()` | vocabCaps.js | Deterministic |
| 9 | AI detection resistance | `runAiDetectionResistance()` | aiDetectionResist.js | Deterministic |
| 10 | Scene duplicate sweep | `runSceneDuplicateSweep()` | Inline (ProjectStudio.jsx:949) | Deterministic |
| 10c | Style tic sweep | `runStyleTicSweep()` | styleTicSweep.js:606 | Deterministic |
| 11 | Manuscript artifact repair | `repairLoadedManuscriptArtifacts()` | manuscriptArtifactRepair.js | Deterministic |
| 11a | Quote boundary repair | `fixHangingQuotes()` | quoteFixPolish.js:401 | Deterministic |
| 11b | Canon name lock | `repairCanonNameDrift()` | canonNameLock.js | Deterministic |
| 11c | Final artifact cleanup | `repairLoadedManuscriptArtifacts()` (2nd pass) | manuscriptArtifactRepair.js | Deterministic |
| 11d | Final structure quarantine | `applyStrandedAlternateDraftQuarantine()` | Inline | Deterministic |
| 12a | **Deterministic grammar repair** | `runDeterministicGrammarRepair()` | prosePolishQualityGate.js | Deterministic |
| 12b | **Missing opening quote repair** | `repairMissingOpeningQuotes()` | prosePolishQualityGate.js | Deterministic |
| 12c | **Post-polish quality gate** | `runProsePolishQualityGate()` | prosePolishQualityGate.js | Deterministic |
| 13 | Save | `prepareChapterContent()` | ProjectStudio.jsx:4537 | I/O |
| 13b | Post-save verification | Content hash comparison | ProjectStudio.jsx:4555 | Verification |

---

## Where the LLM Prose Polisher Will Be Inserted

The LLM polish step will be added **between Step 1c (pre-polish safety gate) and Step 2 (banned word removal)**:

```
Load → Safety Gate → [NEW: LLM Prose Polish] → Deterministic Cleanup → Quality Gate → Save
```

This ensures:
1. Process-leaked/contaminated chapters are never sent to the LLM
2. LLM output goes through all deterministic cleanup passes
3. Post-polish quality gate validates the final result before save
4. If the LLM fails, the pipeline falls back to deterministic-only polish

---

## LLM Infrastructure Already Available

| Component | File | Status |
|-----------|------|--------|
| `callAgent({ taskType: 'polish' })` | localLLM.js:106 | ✅ Routes to `prose-polisher` model |
| `AGENT_MODELS.polisher` = `prose-polisher` | localLLM.js:13 | ✅ Model name configured |
| `AGENT_TEMPERATURES.polisher` = 0.3 | localLLM.js:22 | ✅ Conservative temperature |
| `invokeLLMWithRetry()` | integrationRetry.js:73 | ✅ With retry + timeout |
| Ollama server | http://127.0.0.1:11434 | ✅ Active |

The model and infrastructure exist. They're just never called during polish.
