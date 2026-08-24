# Polish pipeline stage inventory (POLISHSAFE-4)

One row per `verifyInvariant('<Stage>')` call site in `src/lib/manuscriptPolishRunner.js`
(44 call sites, 43 unique stage names — Scene Duplicate Sweep has two call sites for its
if/else branches). Classified against rule 0.2/2: the only allowed deterministic prose
mutations anywhere are typography (smart quotes, apostrophes, whitespace, dashes, double
spaces), a/an agreement (`fixIndefiniteArticles`), missing dialogue opener insertion
(DIALOGREPAIR-2), canonical name spelling (CANON-2B), and explicit structural removals
reported through `verifyInvariant(stage, allowedRemovals)`.

Classes: **T** typography-only · **S** structural-with-allowance (removal reported via
`allowedRemovals`) · **V** LLM-rewrite-with-deterministic-verifier · **F** flag-only ·
**M** deterministic word/phrase mutation (violated rule 0.2/2 before this arc).

Every row marked **M (retired)** was mutating before Arc C (POLISHSAFE-4) and is
flag-only as of this arc. Every row marked **M (book-string, retired)** was additionally
a hardcoded, apparently book-specific string with no place in shared code — deleted
outright rather than just gated to flag-only (POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS).

| # | Stage | Function(s) | Class | Evidence |
|---|---|---|---|---|
| 1 | Legacy Artifact Healing | `healLegacyArtifacts` (legacyArtifactHealer.js) | T | casing/dash repair after abbreviations only |
| 2 | Banned Vocabulary Recast | `recastBannedVocabulary` (aiSlopReduction.js) | M (retired) | cycling-synonym substitution for 33 banned words; POLISHSAFE-4-RETIRE-VOCAB-SUBSTITUTION |
| 3 | Witness Quote Consolidation | `consolidateForeignQuotes` (quoteLedger.js) | S* | removes duplicate-homed quote occurrences; `verifyInvariant` call carries no `allowedRemovals` (unreported) — flagged for a future arc, not retired here (out of the fork's confirmed-16 list; kept as documented follow-up) |
| 4 | Anthology Specific Checks | `runCrossChapterBodyLanguageDedup` + `runAnthologyVocabBans` + `runContaminationDetector` (anthologyPolishChecks.js) | M (retired) | word-map substitution + unreported sentence deletion; POLISHSAFE-4-RETIRE-ANTHOLOGY-VOCAB-AND-BODY-LANGUAGE-SUBSTITUTION. `runContaminationDetector` was already diagnostic-only |
| 5 | Punctuation & Spelling | `runPunctuationCleanup` + `runSpellingFixes` (punctuationPolish.js) | T | typography + literal misspelling correction (objective, like a/an) |
| 6 | Capitalization Fixes | `safeUppercaseReplace` | T | casing only |
| 7 | Capitalization Hygiene | `runCapitalizationHygiene` (capitalizationPolish.js, mostly T) + `runTransitionWordCaps` (chatgptPatternPolish.js) | M (retired) | transition-word deletion (POLISHSAFE-4-RETIRE-CHATGPT-PATTERN-SUBSTITUTION); `runCapitalizationHygiene`'s `fixMidSentenceCaps` also downcased a deliberate capital at the start of an embedded clause after a comma or lowercase word ("said, We're" -> "said, we're") - caught live in the Arc B/C live proof, retired in POLISHSAFE-4-RETIRE-MIDSENTENCE-CAP-DOWNCASE. The stage's other three passes (comma-fragmented titles, dialogue-tag verb caps, standalone "i" -> "I") are narrow, always-correct mechanical fixes and stayed T |
| 8 | Dialogue Punctuation & Filler | `runDialoguePunctuationFix` + `runDialogueFillerFix` | T | punctuation placement + filler-word deletion (narrow, mechanical) |
| 9 | Antithesis Cap | `runAntithesisCap` | S | pure reordering ("was not X but Y" -> "was Y, not X"); no words added/removed |
| 10 | Stacked Clause Variation | `runStackedClauseVariation` (sentencePatternPolish.js) | M (retired) | deleted the -ing clause's descriptive content, unreported; POLISHSAFE-4-RETIRE-STACKED-CLAUSE-VOICE-AND-EXTERNAL-AI-SUBSTITUTION |
| 11 | Nonfiction Core | `runNonfictionDeterministicCore` (nonfictionPolish.js, delegates heavily to chatgptPatternPolish.js) | M (retired) | epistemic-hedge phrase rewrites, abstract-phrase substitution, + all 7 chatgptPatternPolish.js functions; POLISHSAFE-4-RETIRE-NF-OVERCLAIM-AND-ABSTRACT-PHRASE-SUBSTITUTION + POLISHSAFE-4-RETIRE-CHATGPT-PATTERN-SUBSTITUTION |
| 12 | Voice Patterns | `fixVoicePatterns` (voicePatternPolish.js) | M (retired) | replacement-pool phrase rotation; POLISHSAFE-4-RETIRE-STACKED-CLAUSE-VOICE-AND-EXTERNAL-AI-SUBSTITUTION |
| 13 | External AI Patterns | `runExternalAiPatternFix` (externalAiPatterns.js) | M (retired) | phrase deletion; same commit as #12. Sudowrite scene-header strip in the same file is a generation-artifact removal (same class as model-leak scrubbing), untouched |
| 14 | Repetition Caps | local `runRepetitionCaps` (manuscriptPolishRunner.js) | M (retired) | word/phrase rotation ("shuddered", "the silence", etc.); POLISHSAFE-4-RETIRE-REPETITION-AND-DIALOGUE-TAG-SUBSTITUTION |
| 15 | Repetition Rewrite (NF) | `rewriteFlaggedSpots` (repetitionRewrite.js) | V | LLM-based, confirmed |
| 16 | Repetition Rewrite (fiction) | `rewriteFlaggedSpots` | V | same as #15 |
| 17 | Banned Name Auto-Rename | `applyApprovedNameReplacementMap` (nameHygieneRules.js) | out of scope | substitutes an AI-slop-fingerprint character NAME for an alternate, fiction-only; a different defect class from prose-word substitution (identity correction, not style). Not touched this arc — flagged for judgment in a future arc, not part of the fork's confirmed-16 |
| 18 | Dialogue Tag & Coping Caps | `runDialogueTagCaps` (dialogueTagPolish.js) + `runCopingMechanismCaps` (punctuationPolish.js) + `runBrokenSentenceFixes` | M (retired) | dialogue-tag/action word rotation + gesture-phrase deletion; POLISHSAFE-4-RETIRE-REPETITION-AND-DIALOGUE-TAG-SUBSTITUTION. The breath-stem cap in dialogueTagPolish.js was already flag-only (POLISHFIX-4) |
| 19 | High-Frequency Phrase Detection | inline (manuscriptPolishRunner.js) | F | pushes to `changes` only, never touches `f.content` |
| 20 | Vocab & ChatGPT Caps | `runVocabCaps` (vocabCaps.js) + `runChatGPTVocabCaps` (chatgptPatternPolish.js) | M (retired) | word/phrase substitution; POLISHSAFE-4-RETIRE-VOCAB-SUBSTITUTION + POLISHSAFE-4-RETIRE-CHATGPT-PATTERN-SUBSTITUTION |
| 21 | Anti-Detection Polish | `runAntiDetectionPolish` (antiDetectionPolish.js, Steps A-L) | M (retired) | Steps A-C already retired (TRIPLETRETIRE-1, no-op); D-H/K already flag-only; **Step J** hard-removed sentences unreported — POLISHSAFE-4-RETIRE-EMOTIONAL-MATH-HARDREMOVE. Step L is mostly F/T + the allowed a/an heal |
| 22 | Scene Duplicate Sweep | injected `sceneDuplicateSweep` callback | S | properly reported: `verifyInvariant('Scene Duplicate Sweep', sceneDupResult.allowedRemovals \|\| {})` |
| 23 | Style Tic Sweep | `runStyleTicSweep` (styleTicSweep.js) | M (retired) + M (book-string, retired) | shared tic-cap engine (phrase rotation) + malformed-grammar rule table (substitution) + over-explanation label deletion, all retired (POLISHSAFE-4-RETIRE-STYLE-TIC-SWEEP-SUBSTITUTION); two rules fabricated invented prose naming "Pauline" / "rooms with exits" — deleted outright (POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS) |
| 24 | Pre-Quote Artifact Repair | `repairLoadedManuscriptArtifacts` (manuscriptArtifactRepair.js) | T + M (book-string, retired) | apostrophe/quote typography (T) plus a hardcoded, unconditional Arthur->Langston / Cora->Clara rename — deleted outright (POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS) |
| 25 | Quote Fixes | `fixHangingQuotes` | T | quote typography |
| 26 | Canon Name Lock | `repairCanonNameDrift` | allowed-heal | CANON-2B, canonical name spelling |
| 27 | Final Artifact Cleanup | `repairLoadedManuscriptArtifacts` (same function as #24) | T + M (book-string, retired) | same fix as #24 — this function runs twice per pipeline execution |
| 28 | Grammar & Dialogue Mechanics | `runDeterministicGrammarRepair` (prosePolishQualityGate.js) + `repairMissingOpeningQuotes` (allowed) + `runDialogueMechanicsPass` (mostly allowed/T) + `runAISlopReductionPass` (aiSlopReduction.js) | M (retired) | subject-verb agreement substitution (She were->She was, They was->They were, etc. — only a-obvious/a-an stays a real repair): POLISHSAFE-4-RETIRE-GRAMMAR-AGREEMENT-SUBSTITUTION. `runAISlopReductionPass` shares `reduceAISlopDeterministic`, already retired under #2's commit |
| 29 | Canon Name Variant Heal | `healNameVariants` (canonRoles.js) | allowed-heal | canonical name spelling, same class as #26 |
| 30 | Cross-Chapter Dedupe | `healCrossChapterDuplicates` | V | LLM + `verifyRecastSentence`, confirmed |
| 31 | Simile Hard Cap | `healSimileDensity` | V | LLM + `verifySimileRecast`, confirmed |
| 32 | Subject Repair | `repairDroppedSubjects` | V | LLM + verifier, confirmed |
| 33 | Regenerate Lane | `regenerateFlaggedParagraphs` (Arc B) | V | LLM + `verifyRegeneratedParagraph`, confirmed |
| 34 | Context-Variable Pronoun Heal | `healContextVariablePronounScenes` (pronounLock.js) | out of scope | flips minority he/she to the scene's majority for a declared context-variable character — a narrowly-scoped continuity heal, not prose-style substitution. Not touched this arc; not part of the fork's confirmed-16 |
| 35 | NF LLM Polish | `polishChapterWithLLM` | V | confirmed |
| 36 | Fiction LLM Polish | `polishChapterWithLLM` | V | confirmed |
| 37 | Final Vocabulary Sweep | `recastBannedVocabulary` (again) + NF adverb-opener rewrite/delete (manuscriptPolishRunner.js) | M (retired) | same function as #2 (already retired) + NF adverb deletion, retired in the same commit as #2 (POLISHSAFE-4-RETIRE-VOCAB-SUBSTITUTION) |
| 38 | Sentence Case & Wound Repair | `runSentenceCaseRepair` (T) + `healProseWounds` (sentenceCaseRepair.js) | T + out of scope | wound repair does a narrow One/Its->The substitution and verb-jam and-insertion, a repair-of-prior-damage class distinct from stylistic substitution. Not touched this arc; not part of the fork's confirmed-16 |
| 39 | Quality Gate Revert | revert-only guard (manuscriptPolishRunner.js) | S | backstop, tracks `qualityGateAllowances` |
| 40 | Global Content Loss Guard | revert-only guard | S | backstop, tracks `contentLossAllowances` |
| 41 | Post-Restore Sentence Case Repair | re-invokes `runSentenceCaseRepair` | T | inherits #38's T half |
| 42 | Post-Restore Wound Repair | re-invokes `healProseWounds` | out of scope | inherits #38's out-of-scope half |
| 43 | Injected Test Healer | `_testInjectHealer` | N/A | test-only DI hook, no production behavior |

## Summary

- **M, retired this arc:** #2, 4, 7, 10, 11, 12, 13, 14, 18, 20, 21, 23, 24, 27, 28, 37 — 16 stages (matches the fork's confirmed-16 count; #23/#24/#27 also carried a book-string sub-issue, retired in the same or a follow-up commit).
- **M (book-string), retired this arc:** the Arthur/Cora rename (#24/#27), the Pauline/"rooms with exits" fabrication (#23), and a hardcoded NF sentence fix inside #11 — all deleted outright rather than merely flag-gated (POLISHSAFE-4-RETIRE-HARDCODED-BOOK-STRINGS).
- **V, already compliant:** #15, 16, 30-33, 35, 36 — 8 stages.
- **T / allowed-heal, already compliant:** #1, 5 (T half), 6, 8 (T half), 25, 26, 29, 41.
- **S, properly-reported structural, compliant:** #9, 22, 39, 40.
- **F, compliant:** #19.
- **Documented but not retired this arc** (found during the inventory, outside the fork's confirmed-16, left for explicit future judgment rather than unilateral action): #3 (Witness Quote Consolidation — unreported deletion), #17 (Banned Name Auto-Rename — a different defect class), #34 (Context-Variable Pronoun Heal — narrow continuity fix), #38/#42 (Sentence Case & Wound Repair's non-typography half — narrow damage-repair fixes).
- **N/A:** #43.

## Known related issue, not touched (HYGIENE-1 candidate)

`src/pages/ExportTab.jsx` has similar-looking hardcoded scar-tissue repairs (a quote-edge
fix referencing what looks like a specific book's climax scene around lines 1914-1916,
and a nonfiction "scar-tissue" sentence swap around lines 2628-2631). These are export-side,
outside `manuscriptPolishRunner.js` and this arc's scope — listed here for a HYGIENE-1
follow-up, not modified.
