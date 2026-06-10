# 03 — Polisher Rule Gap Analysis

**Date:** 2026-06-07
**Source:** Full codebase analysis of all polish-related modules

---

## Architecture: 100% Deterministic Regex Pipeline

> [!IMPORTANT]
> There is no "Prose Polisher" LLM agent. The entire polish pipeline is deterministic regex transforms.

---

## Complete Polish Function Inventory

| # | Function | File | Modifies Text? | Called During |
|---|----------|------|----------------|--------------|
| 1 | `stripProjectContaminationBlocks()` | projectContentGuard.js | Yes (removes foreign blocks) | Polish |
| 2 | `runManuscriptSafetyGate()` | manuscriptSafetyGate.js | No (quarantine only) | Polish |
| 3 | Banned word removal (inline) | ProjectStudio.jsx:4048 | Yes (33 words) | Polish |
| 4 | `runCrossChapterBodyLanguageDedup()` | anthologyPolishChecks.js | Yes | Polish (anthology) |
| 5 | `runAnthologyVocabBans()` | anthologyPolishChecks.js | Yes (8 words) | Polish (anthology) |
| 6 | `runContaminationDetector()` | anthologyPolishChecks.js | Yes | Polish (anthology) |
| 7 | `runPunctuationCleanup()` | punctuationPolish.js:12 | Yes | Polish |
| 8 | `runSpellingFixes()` | punctuationPolish.js:512 | Yes (14 words) | Polish |
| 9 | `runCapitalizationHygiene()` | capitalizationPolish.js | Yes | Polish |
| 10 | `runTransitionWordCaps()` | chatgptPatternPolish.js | Yes | Polish |
| 11 | `runDialoguePunctuationFix()` | punctuationPolish.js:700 | Yes | Polish |
| 12 | `runDialogueFillerFix()` | punctuationPolish.js:756 | Yes | Polish |
| 13 | `runStackedClauseVariation()` | sentencePatternPolish.js | Yes | Polish |
| 14 | `fixVoicePatterns()` | voicePatternPolish.js | Yes | Polish |
| 15 | `runExternalAiPatternFix()` | externalAiPatterns.js | Yes | Polish |
| 16 | `runDialogueTagCaps()` | dialogueTagPolish.js | Yes | Polish |
| 17 | `runCopingMechanismCaps()` | punctuationPolish.js:596 | Yes | Polish |
| 18 | `runBrokenSentenceFixes()` | punctuationPolish.js:555 | Yes | Polish |
| 19 | `runVocabCaps()` | vocabCaps.js | Yes | Polish |
| 20 | `runChatGPTVocabCaps()` | chatgptPatternPolish.js | Yes | Polish |
| 21 | `runAntiDetectionPolish()` | antiDetectionPolish.js | Yes | Polish |
| 22 | `runSentenceStarterVariation()` | vocabCaps.js | Yes | Polish |
| 23 | `runAiDetectionResistance()` | aiDetectionResist.js | Yes | Polish |
| 24 | `runSceneDuplicateSweep()` | sceneDuplicateSweep.js | Yes | Polish |
| 25 | `runStyleTicSweep()` | styleTicSweep.js:606 | Yes | Polish |
| 26 | `repairLoadedManuscriptArtifacts()` | manuscriptArtifactRepair.js | Yes | Polish |
| 27 | `fixHangingQuotes()` | quoteFixPolish.js:401 | Yes | Polish |
| 28 | `repairCanonNameDrift()` | canonNameLock.js | Yes | Polish |

### Diagnostic-Only (NOT called during polish):

| Function | File | Purpose |
|----------|------|---------|
| `mechanicalSlopScore()` | proseQuality.js:400 | Scores slop (0-10) — **draft phase only** |
| `runQualityScan()` | qualityScan.js:120 | Word repetition, POV drift — **draft phase only** |

---

## Gap Analysis: What Is NOT Covered

### ❌ Subject-Verb Agreement

**No function checks or repairs:**
- "She were" → "She was"
- "He were" → "He was" 
- "They was" → "They were"
- "You was" → ambiguous

**Impact:** 6 instances in v5.docx across 4 chapters (Ch.5, Ch.6, Ch.13, Ch.19)

### ❌ Duplicated Auxiliary Verbs (case-sensitive backreference bug)

`runPunctuationCleanup` line 174: `f.content.replace(/\b(\w{2,})\s+(\1)\b/gi, ...)`

The duplicate word detector uses backreference `\1` which is case-sensitive in JavaScript even with the `/i` flag. So "Was was" (different case) escapes detection.

**Impact:** 2 instances in v5.docx (Ch.6, Ch.13)

### ❌ Article Agreement

**No function checks:**
- "a obvious" → "an obvious"
- "a eager" → "an eager"
- "a important" → "an important"

**Impact:** 1 instance in v5.docx (Ch.6)

### ❌ Mid-Paragraph Missing Opening Quotes

`balanceParagraphEdges()` only handles paragraph-edge imbalance (first/last quote position). Mid-paragraph speech turns with missing openers are invisible.

The orphan dialogue rescue in `postSmartCleanup()` handles only phrases ≤140 chars starting with whitelisted words (Thank you, Yes, No, etc.). General dialogue like "The game is the model, Marcus" is not whitelisted.

**Impact:** 3+ instances in v5.docx (Ch.1)

### ❌ Contracted "X just" Slop Variants

The banned word list (ProjectStudio.jsx:4048) includes literal `"not just"` but NOT:
- "wasn't just"
- "didn't just"
- "isn't just"
- "the system wasn't just"
- "the platform wasn't just"

**Impact:** ~20+ instances across the manuscript

### ❌ Post-Polish Quality Gate

There is NO validation step after polish to verify the output is clean. The pipeline saves whatever comes out of the regex chain without checking:
- No malformed grammar check
- No quote integrity verification
- No slop threshold enforcement
- No "is this chapter actually better?" check

The safety gate (`runManuscriptSafetyGate`) runs PRE-polish only and checks process leakage/contamination, not prose quality.

---

## Functions That DO Exist (But Don't Cover These Gaps)

### Quote repair functions:
- `repairChapterQuotes()` — paragraph-edge balancing only
- `fixHangingQuotes()` — wrapper that calls `repairChapterQuotes` per chapter
- `balanceParagraphEdges()` — counts quotes per paragraph, fixes odd counts at edges

**Gap:** None handle mid-paragraph missing openers.

### "not just" removal:
- Banned word list removes literal "not just"
- `mechanicalSlopScore()` counts "not just X but Y" for scoring

**Gap:** Contracted variants ("wasn't just", "didn't just") are not targeted.

### "felt" / "realized" reduction:
- `mechanicalSlopScore()` counts these for scoring (draft-only)
- No polish function reduces their frequency

**Gap:** Counted during draft scoring but never capped during polish.

### "the weight of" reduction:
- Not targeted by any function

---

## Verdict

The polish pipeline is comprehensive for its target domain (vocabulary bans, punctuation, style tics, quote repair) but has **zero coverage** for:

1. **Grammar correctness** (subject-verb agreement, article agreement, duplicated auxiliaries)
2. **Mid-paragraph quote integrity** (missing openers between speech turns)
3. **Contracted slop variants** ("wasn't just", "didn't just")
4. **Post-polish quality verification** (no gate prevents saving bad output)
