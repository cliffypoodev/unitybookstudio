# UNITY BOOK STUDIO — POLISH PATH FORENSIC TRACE

## VERDICT
Similar to prose generation, the manuscript polishing pipeline is **entirely governed by hardcoded app-layer scripts** (`manuscriptPolishRunner.js`, `llmProsePolisher.js`, etc.).

The "polisher" agent configuration in `localLLM.js` is merely a transport layer pointing to the `prose-polisher` model with an empty system prompt. All prompt logic, rulesets, and deterministic cleanup functions are managed directly by the frontend source code before and after the LLM call.

---

## SECTION 1 — ENTRY POINTS
The "Fix Entire Manuscript Now" flow originates in the Review / Polish tab:
*   **`ManuscriptDashboard.jsx:206`** (`handleRunPolish`) - Triggered when the user clicks "Fix Entire Manuscript now?". It prompts the safety warning dialog and calls `polishHandler` (which was passed as a prop).
*   **`ProjectStudio.jsx:4167`** (`handlePolishRouted`) - Passed to `ManuscriptDashboard` as `onFixEntireManuscript`. Routes to either `handleManuscriptPolishNonfiction` or `handleManuscriptPolish` based on project genre.
*   **`ProjectStudio.jsx:4225` / `4433`** - Both routes eventually call **`runManuscriptPolishPipeline`** (imported from `src/lib/manuscriptPolishRunner.js`).

---

## SECTION 2 — THE POLISH PIPELINE FUNCTIONS
The `runManuscriptPolishPipeline` in `manuscriptPolishRunner.js` acts as the master orchestrator. It executes a vast array of **deterministic functions** before *and* after ever touching the LLM. 

Here are the polish/fix functions running in the pipeline, in chronological order:

### Phase A: Manuscript-level Pre-Pass (Cross-Chapter)
*   **`healLegacyArtifacts`** - Heals baked-in corruption from pre-merge pipelines.
*   **`recastBannedVocabulary`** - Synonym substitution for banned words.
*   *Anthology Checks:* `runCrossChapterBodyLanguageDedup`, `runAnthologyVocabBans`, `runContaminationDetector` (If an anthology project).

### Phase B: Manuscript-level Deterministic Polish
*   **`runPunctuationCleanup`**, **`runDialoguePunctuationFix`**, **`runSpellingFixes`**, **`runBrokenSentenceFixes`**, **`runDialogueFillerFix`**, **`runCopingMechanismCaps`**
*   **`runCapitalizationHygiene`**
*   **`runVocabCaps`**, **`runSentenceStarterVariation`**, **`runStackedClauseVariation`**, **`runChatGPTVocabCaps`**, **`runTransitionWordCaps`**, **`fixVoicePatterns`**, **`runExternalAiPatternFix`**, **`runDialogueTagCaps`**
*   **`runAntiDetectionPolish`**, **`runAiDetectionResistance`**
*   **`runStyleTicSweep`** - Cleans author-specific repetitive tics.

### Phase C: Per-Chapter Deterministic Cleanup & Repair
*   **`repairLoadedManuscriptArtifacts`** - Strips leaked meta-markdown.
*   **`fixHangingQuotes`** - Fixes mismatched quotation boundaries.
*   **`repairCanonNameDrift`** - Re-locks hallucinated character names to the canonical project spelling.
*   **`runDeterministicGrammarRepair`**
*   **`repairMissingOpeningQuotes`**
*   **`runDialogueMechanicsPass`** / **`runMidParagraphDialogueAutofixPass`** - Ensures American-style publishable dialogue punctuation.
*   **`runAISlopReductionPass`** - Replaces excessive use of "not just," "felt," "realized," etc.

### Phase D: LLM Prose Polish
*   **(Fiction):** **`polishChapterWithLLM`** (from `src/lib/llmProsePolisher.js`).
*   **(Nonfiction):** **`runAntiChatbotRecastPipeline`** (from `src/lib/antiChatbotRecastPipeline.js`).

---

## SECTION 3 — THE FORK & PROMPT GOVERNANCE
When Phase D executes, `polishChapterWithLLM` constructs the user and system prompts:
1.  **Prompt Assembly:** `llmProsePolisher.js` pulls `PROSE_POLISHER_SYSTEM_PROMPT` (which contains rigid rules like "Do not summarize", "Preserve all plot events") and merges it with project-specific anti-chatbot rules via `buildPolisherSystemPrompt`.
2.  **The Call:** It invokes `callAgent({ taskType: 'polish', systemPromptOverride: ... })` (`llmProsePolisher.js:247`).
3.  **The Route:** `localLLM.js` (`resolveAgent`) matches `'polish'` to the `polisher` agent, mapping to the model `'prose-polisher'` (`AGENT_MODELS.polisher`).
4.  **Governance:** Just like `ghostwriter`, `localLLM.js:40` defines `AGENT_SYSTEM_PROMPTS.polisher = ''`. Because `systemPromptOverride` was explicitly supplied by `llmProsePolisher.js`, the app layer retains 100% control over the LLM instructions.

---

## SECTION 4 — POST-LLM SAFETY GATING
Unlike drafting, polishing enforces strict word-count loss guards in code:
*   `llmProsePolisher.js:175` -> Hard fail if the LLM cuts > 12% of the chapter's word count.
*   `llmProsePolisher.js:178` -> Hard fail if the LLM expands > 15% of the chapter.
*   `llmProsePolisher.js:151` -> Hard fail if process leakage patterns (e.g., "Action Plan:", "Here is the revised chapter") are detected in the LLM output.

**Conclusion:** The Prose Polisher agent (`localLLM.js`) is effectively just a pass-through identifier for the model. The actual "Polishing Agent" is the unified `manuscriptPolishRunner.js` pipeline executing dozens of deterministic string-mutation scripts before culminating in a tightly boxed LLM call.
