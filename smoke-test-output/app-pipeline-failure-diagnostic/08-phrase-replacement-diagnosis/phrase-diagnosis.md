# Phrase Replacement Diagnosis

## Root Cause: "not just" removal is LLM-based, and LLM is disabled during fix/polish

### How "not just" goes from 85 → 3:

The reduction happens during the **rewrite step** (Pipeline A), NOT during fix/polish (Pipeline B).

The LLM (ghostwriter) is prompted during rewriting to avoid AI-ish patterns. It naturally reduces "not just" usage as part of its prose generation. The fix/polish pipeline has `runLLM: false` (manuscriptFixer.js line 3518), so no LLM-based slop removal occurs during polish.

### How "palpable" (5 → 0), "meticulously" (7 → 0), etc. go to zero:

Same mechanism — the LLM rewrite replaces these during prose generation. The fix/polish path's `runAnthologyVocabBans()` (anthologyPolishChecks.js line 644) has a different ban list:
- beacon → signal
- profound → deep
- crescendo → rise
- tapestry → pattern
- symphony → noise
- cathedral → room
- geometry → shape
- architecture → structure

This list does NOT include: palpable, meticulously, luminous, shimmering, ethereal.

### Why "the weight of" (43 → 43) is unchanged:

Neither the LLM rewrite nor the fix/polish deterministic passes remove "the weight of". It's counted as an AI-polish marker in `calculateVoiceMetrics()` (line 3985) but only for metric reporting — no removal action is taken.

### The "You was" and "Was was" malformed grammar:

**Origin:** `runTargetedMalformedSentenceRepair()` in postDraftCleanup.js (line 2090)

This function:
1. Detects malformed sentences using `classifyMalformedSentence()` (line 1725)
2. Sends candidates to LLM for repair patches
3. Applies patches using `applySentencePatchesByIndex()` (line 1916)
4. Falls back to `buildDeterministicFallbackPatches()` if LLM fails

The problem: When the LLM or deterministic fallback generates a repair patch for a sentence near the process-leaked text in Ch.2, the repair can introduce new grammar errors because the surrounding context is editorial critique, not prose. The repair function expects to fix grammar in fiction — when given "Was it his fatigue?" in the context of editorial commentary, it may produce "Was was it his fatigue?" as a malformed patch.

### Context examples from Ch.2 polished output:

```
...searching for the source of the critique. You was Julian talking about the paint itself, ...
```
This was NOT in the rewrite. The malformed sentence repair introduced "You was" — likely from attempting to fix a sentence that started with a bare verb in the process-leaked section.

```
...his own hand holding the brush. Was was it his fatigue? Or was the color itself...
```
This was NOT in the rewrite. The deterministic sentence repair may have doubled "Was" when attempting to fix what it saw as a "missing subject at sentence start" for "Was it his fatigue?"

### Diagnosis summary:
| Question | Answer |
|----------|--------|
| Which function changes "not just"? | LLM rewrite during Draft All (not fix/polish) |
| Is it regex-only? | No — it's LLM-based during rewrite. No regex removal exists in fix/polish. |
| Does it operate globally? | Yes — the LLM rewrites the full chapter |
| Does it preserve grammar? | Generally yes (LLM handles it) |
| Does it create fragments? | Not from "not just" removal specifically |
| Does it run before or after quote repair? | Before — rewrite precedes fix/polish |
| Does it explain "You was" or "Was was"? | **No** — those are from malformed sentence repair, not "not just" removal |
