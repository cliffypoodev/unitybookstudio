/**
 * manuscriptPolishRunner.js — Orchestrates the full manuscript polish pipeline.
 *
 * This module replaces the ~700 lines of inline polish logic in
 * ProjectStudio.jsx handleManuscriptPolish with a single call:
 *
 *   const result = await runManuscriptPolishPipeline({ loaded, project, ... });
 *
 * Architecture:
 *   1. Manuscript-level pre-pass (cross-chapter ops)
 *   2. Per-chapter unified refinement (deterministic)
 *   3. Manuscript-level post-pass (repetition caps, style sweeps)
 *   4. Per-chapter LLM recast (optional, last)
 *   5. Quality gate + smart partial repair
 *
 * The LLM call is ALWAYS the last mutating step. All deterministic
 * passes run first so the LLM sees clean input.
 *
 * @module manuscriptPolishRunner
 */

// ── Manuscript-level modules (operate on loaded[] arrays) ──
import { runPunctuationCleanup, runSpellingFixes, runBrokenSentenceFixes,
  runCopingMechanismCaps, runDialoguePunctuationFix, runDialogueFillerFix }
  from './punctuationPolish.js';
import { runCapitalizationHygiene } from './capitalizationPolish.js';
import { fixVoicePatterns } from './voicePatternPolish.js';
import { runExternalAiPatternFix } from './externalAiPatterns.js';
import { runVocabCaps, runSentenceStarterVariation, runSentenceStarterVariationNF, detectBannedVocabulary } from './vocabCaps.js';
import { runDialogueTagCaps } from './dialogueTagPolish.js';
import { runChatGPTVocabCaps, runTransitionWordCaps } from './chatgptPatternPolish.js';
import { runStackedClauseVariation } from './sentencePatternPolish.js';
import { runAntithesisCap } from './antithesisCap.js';
import { runSentenceCaseRepair, healProseWounds } from './sentenceCaseRepair.js';
import { scrubModelLeaks, detectModelControlTokens } from './modelLeakGuard.js'; // LEAKFIX-1, LEAKFIX-2
import { runAntiDetectionPolish } from './antiDetectionPolish.js';
import { countParagraphs } from './structureUtils.js';
import { runAiDetectionResistance } from './aiDetectionResist.js';
import { runStyleTicSweep } from './styleTicSweep.js';
import { fixHangingQuotes, normalizeSmartQuotesOnly, closeTrailingUnclosedQuotes } from './quoteFixPolish.js';
import { healCrossChapterDuplicates, findCrossChapterDuplicateSentences, collectProperNouns } from './crossChapterDedupe.js';
import { healSimileDensity, selectSimileRecastTargets } from './simileRecast.js'; // STYLEBUDGET-2
import { repairDroppedSubjects, findDroppedSubjectSentences } from './subjectRepair.js'; // SUBJECTREPAIR-1
import { regenerateFlaggedParagraphs, collectRegenTargets, paragraphsOf } from './regenerateLane.js'; // REGENLANE-1 / REGENLANE-2C
import { makeUnknownPersonDetector } from './nameGate.js'; // NAMEGATE-1
import { makeTemplateFamilyDetector, makeOpeningEchoDetector } from './templateFamilies.js'; // STYLEBUDGET-3
import { makeFragmentDensityDetector, measureFragmentDensity, FRAGMENT_DENSITY_BUDGET_PER_1K } from './fragmentDensity.js'; // FRAGBUDGET-1
import { parseCanonCast, healNameVariants } from './canonRoles.js'; // CANON-2
import { harvestCastNames, buildPronounCanon, healContextVariablePronounScenes } from './pronounLock.js'; // SUBJECTREPAIR-1 / PRONOUNVAR-1
import { repairLoadedManuscriptArtifacts } from './manuscriptArtifactRepair.js';
import { repairCanonNameDrift } from './canonNameLock.js';
import { runPerChapter } from './anthologyPolishHelper.js';
import { runCrossChapterBodyLanguageDedup, runAnthologyVocabBans, runContaminationDetector }
  from './anthologyPolishChecks.js';
import { isAnthologyProject } from './anthologyEngine.js';
import { isComedyProject } from './manuscriptStats.js';
import { isNonfictionProject } from './projectType.js'; // POLISHSAFE-6: the authority — never a `mode` string test
import { rewriteFlaggedSpots, buildGlobalOpeningStats, buildGlobalActionBeatStats, buildCrossChapterPhraseStats } from './repetitionRewrite.js';
import { buildQuoteLedger, consolidateForeignQuotes } from './quoteLedger.js';
import { getAllBlockedNames, countNameOccurrences } from './nameHygieneRules.js'; // POLISHSAFE-5: flag only, never rewrite

// ── Per-chapter modules (operate on single text strings) ──
import { runDeterministicGrammarRepair, runProsePolishQualityGate,
  repairMissingOpeningQuotes, runPolishImprovementScoring }
  from './prosePolishQualityGate.js';
import { runDialogueMechanicsPass, runMidParagraphDialogueAutofixPass }
  from './dialogueMechanicsRepair.js';
import { runAISlopReductionPass, recastBannedVocabulary } from './aiSlopReduction.js';
import { shouldRunDialogueRepair, shouldRunAISlopReduction, shouldRunReferenceIntegrity }
  from './polishPipelineConfig.js';
import { runReferenceIntegrityGate } from './referenceIntegrityGate.js';
import { polishChapterWithLLM } from './llmProsePolisher.js';
import { countWords } from './autonovel.js';
import { runNonfictionDeterministicCore } from './nonfictionPolish.js';
import { nfContentEquivalent, stripDroppedWordSentences, fixIndefiniteArticles, stripCrossChapterDuplicates, stripMangledSentences, buildFactLedger, stripFactLedgerViolations } from './nfContentGuard.js'; // NFGUARD-1 + DRAFTGATE-2 & 3 + ARCH-1C
import { ensureResearchEvidence } from './researchStorage.js'; // RESEARCHQUALITY-2C
import { splitSentencesSafe } from './sceneWriter.js';
import { detectEssayImbalance } from './unifiedProseRefinement.js';
import { runAntiChatbotRecastPipeline } from './antiChatbotRecastPipeline.js';
import { safeUppercaseReplace } from './safeUppercase.js';
import { healLegacyArtifacts } from './legacyArtifactHealer.js';

export const VERSION = 'MANUSCRIPT-POLISH-RUNNER v1.1 — 2026-06-11';

/**
 * Simple DJB2-variant hash for LLM idempotency stamps.
 * Returns an 8-char hex string. Not cryptographic — just a content fingerprint.
 */
export function simpleHash(text = '') {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Run the full manuscript polish pipeline.
 *
 * @param {Object} options
 * @param {Array} options.loaded - [{chapter, content, original}]
 * @param {Object} options.project - Project record
 * @param {Function} options.onProgress - Progress label callback
 * @param {boolean} [options.allowLLM=true] - Enable LLM prose polish
 * @param {string} [options.mode='fiction'] - 'fiction' or 'nonfiction'
 * @param {Function} [options.sceneDuplicateSweep] - Scene duplicate sweep function (injected from caller)
 * @param {Function} [options._llmOverride] - TEST ONLY: mock function replacing polishChapterWithLLM. Receives ({ chapterText, chapterNumber }) and must return { ok, text, error }.
 * @returns {Object} { changes, savedCount, unchangedCount, afterStats, gateFailures, llmLog, ... }
 */
export async function runManuscriptPolishPipeline({
  loaded,
  project,
  onProgress = () => {},
  allowLLM = true,
  mode = 'fiction',
  sceneDuplicateSweep = null,
  allowDedupeLLM = true,
  allowStyleLLM = true, // STYLEBUDGET-2: simile hard-cap recasts (one verified sentence per call)
  allowSubjectRepairLLM = true, // SUBJECTREPAIR-1: restore dropped subjects (model picks the subject, verifier enforces shape)
  allowRegenLLM = true, // REGENLANE-1: block-and-regenerate lane (model rewrites, verifier enforces shape)
  _llmOverride = null,
  _testInjectHealer = null,
  _crossDedupeLLMOverride = null,
  _simileLLMOverride = null, // STYLEBUDGET-2 test/DI
  _subjectLLMOverride = null, // SUBJECTREPAIR-1 test/DI
  _regenLLMOverride = null, // REGENLANE-1 test/DI
}) {
  // RESEARCHQUALITY-2C: hydrate URL-backed research evidence so the polish-lane
  // ledger sees the same closed world as drafting. Fail-open.
  project = await ensureResearchEvidence(project);
  const changes = [];
  const isAnthology = isAnthologyProject(project);
  const isComedy = isComedyProject(project);
  const chapterCount = loaded.length;
  const formatLabel = (l) => typeof l === 'string' ? l : '';

  console.log(`[POLISH-RUNNER] ========== START v1.0 ==========`);
  console.log(`[POLISH-RUNNER] chapters=${chapterCount} anthology=${isAnthology} mode=${mode} allowLLM=${allowLLM}`);

  // Record original word counts for global loss guard (Step 2)
  const originalWordCounts = new Map();
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const key = (f.chapter && f.chapter.id) ? f.chapter.id : i;
    originalWordCounts.set(key, countWords(f.original || f.content || ''));
  }

  // POLISHSAFE-1B: record each chapter's smart-quote imbalance and input text
  // at pipeline start. The final QUOTE-GUARD reverts any chapter the pipeline
  // left with WORSE quote balance than it arrived with — no polish stage is
  // allowed to ship corrupted dialogue (measured live: a balanced 133/133
  // chapter left the old pipeline at 127/133 and hard-blocked its own export).
  const quoteImbalance = (t) => {
    const s = String(t || '');
    let open = 0; let close = 0;
    for (const ch of s) { if (ch === '“') open++; else if (ch === '”') close++; }
    return Math.abs(open - close);
  };
  const initialQuoteState = new Map();
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const key = (f.chapter && f.chapter.id) ? f.chapter.id : i;
    initialQuoteState.set(key, { imbalance: quoteImbalance(f.original || f.content || ''), text: String(f.original || f.content || '') });
  }

  const structureViolations = [];
  const paragraphDeletionFlags = []; // LEGACYSTAGES-1: { chapter, paragraphIndex, reason } — Pre-Quote Artifact Repair / Final Artifact Cleanup no longer merge a paragraph away; they flag it here instead.
  function countParagraphs(text) {
    return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).filter(p => p.trim().length > 0).length;
  }
  const __snapshots = new Map();
  function getChapterKey(f, index) {
    return (f.chapter && f.chapter.id) ? f.chapter.id : index;
  }
  function checkpoint() {
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const key = getChapterKey(f, i);
      const chNum = f.chapter?.chapter_number || '?';
      __snapshots.set(key, { text: f.content, pCount: countParagraphs(f.content), chNum });
    }
  }
  // PROSE-GUARD-1 (report mode): every stage boundary already runs through
  // verifyInvariant, so this is the one place to measure — not read off
  // comments — what each deterministic stage actually changed. Compares
  // only the letters-and-digits SEQUENCE (punctuation/whitespace-only edits,
  // like a repaired apostrophe or a normalized quote, stay silent); no
  // reverting yet, this is the stage inventory Arc C was meant to produce.
  function lettersAndDigitsOnly(text) {
    return String(text || '').replace(/[^a-zA-Z0-9]/g, '');
  }
  function verifyInvariant(stageName, allowedRemovals = {}) {
    // VERSIONS-1D: two `loaded` entries can resolve to the SAME chapter key
    // (getChapterKey keys on f.chapter.id — a duplicate chapter record hits
    // this) and both get compared against the one shared snapshot; if a
    // stage changes both entries' letters identically, that's two real,
    // independent findings that happen to print the same text, logged as
    // [PROSE-GUARD] twice for what reads as one logical chapter. Dedupe ONLY
    // that printed line per key per stage — the STRUCTURE-GUARD paragraph
    // check/revert below still runs for every entry unconditionally, because
    // a downstream stage (e.g. cross-chapter dedup) can make two
    // same-keyed entries diverge in content, and each needs its own
    // independent safety-net check; skipping it for a repeat key would
    // silently drop that entry's revert protection.
    const reportedProseGuardKeys = new Set();
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const key = getChapterKey(f, i);
      const snap = __snapshots.get(key);
      if (!snap) continue;
      if (lettersAndDigitsOnly(snap.text) !== lettersAndDigitsOnly(f.content) && !reportedProseGuardKeys.has(key)) {
        reportedProseGuardKeys.add(key);
        console.warn(`[PROSE-GUARD] ${stageName} Ch.${snap.chNum}: letters changed`);
      }
      const afterCount = countParagraphs(f.content);
      const reduction = snap.pCount - afterCount;
      if (reduction > 0) {
        const expected = allowedRemovals[key] || 0;
        if (reduction !== expected) {
          console.warn(`[STRUCTURE-GUARD] ${stageName} Ch.${snap.chNum}: count reduced ${snap.pCount} -> ${afterCount} (allowed: ${expected}). REVERTED.`);
          structureViolations.push({
            stage: stageName,
            chapter: snap.chNum,
            before: snap.pCount,
            attemptedAfter: afterCount,
            allowedRemovals: expected,
            action: 'REVERTED'
          });
          f.content = snap.text;
        } else {
          structureViolations.push({
            stage: stageName,
            chapter: snap.chNum,
            before: snap.pCount,
            attemptedAfter: afterCount,
            allowedRemovals: expected,
            action: 'ACCEPTED'
          });
        }
      }
    }
    checkpoint();
  }
  checkpoint();

  let totalLeakTokensRemoved = 0;
  let totalLeakParagraphsRemoved = 0;

  function runModelLeakScrub(stageName) {
    const allowances = {};
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const key = getChapterKey(f, i);
      const leak = scrubModelLeaks(f.content, `Ch.${f.chapter?.chapter_number || '?'}`);
      if (leak.changes && leak.changes.length) {
        f.content = leak.text;
        changes.push(`Ch.${f.chapter?.chapter_number || '?'}: ${stageName} - ${leak.changes.join('; ')}`);
      }
      if (leak.paragraphsRemoved > 0) {
        allowances[key] = leak.paragraphsRemoved;
        totalLeakParagraphsRemoved += leak.paragraphsRemoved;
      }
      if (leak.tokensRemoved > 0) {
        totalLeakTokensRemoved += leak.tokensRemoved;
      }
    }
    verifyInvariant(stageName, allowances);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE A: Manuscript-level pre-pass (cross-chapter deterministic)
  // ══════════════════════════════════════════════════════════════════════════

  // A-LEAK (LEAKFIX-1): scrub model control tokens (/nothink, <think>, <|...|>)
  // and non-Latin language drift from every chapter FIRST, so re-polishing a
  // damaged manuscript heals both leak classes.
  onProgress('Polish: Scrubbing model leaks…');
  runModelLeakScrub('Initial Model Leaks Scrub');

  // A0: Legacy artifact healing (baked-in corruption from pre-merge pipeline)
  onProgress('Polish: Healing legacy artifacts…');
  let legacyRepairCount = 0;
  for (const f of loaded) {
    const healResult = healLegacyArtifacts(f.content);
    if (healResult.repairs.length > 0) {
      f.content = healResult.text;
      legacyRepairCount += healResult.repairs.length;
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: healed ${healResult.repairs.length} legacy artifact(s)`);
    }
  }
  if (legacyRepairCount > 0) {
    changes.push(`Legacy artifact healing: ${legacyRepairCount} repair(s).`);
  }
  verifyInvariant('Legacy Artifact Healing');

  // A1: Banned vocabulary — POLISHSAFE-4: synonym substitution retired, flag-only.
  onProgress('Polish: Scanning banned vocabulary…');
  let bannedRecastCount = 0;
  for (const f of loaded) {
    const result = recastBannedVocabulary(f.content);
    if (result.flagged.length > 0) {
      const chNum = f.chapter?.chapter_number || '?';
      for (const fl of result.flagged) {
        bannedRecastCount += fl.count;
        changes.push(`Ch.${chNum}: BANNED "${fl.word}" x${fl.count} flagged - substitution retired (POLISHSAFE-4)`);
      }
    }
  }
  if (bannedRecastCount > 0) {
    changes.push(`Banned vocabulary: ${bannedRecastCount} word(s) flagged - substitution retired (POLISHSAFE-4).`);
  }
  verifyInvariant('Banned Vocabulary Recast');

  // A1.5: ARCH2-4b-a — witness-quote consolidation. A research quote may be
  // printed inside quotation marks in exactly ONE chapter (beat-derived home,
  // else manuscript first-use), exactly once. Narrated references are never
  // touched. Fail-safe: oversized spans are flagged for manual review, not cut.
  onProgress('Polish: Consolidating witness quotes…');
  try {
    const beatHomes = new Map();
    for (const e of buildQuoteLedger(project, loaded.map((x) => x.chapter))) {
      if (e.home !== null && !beatHomes.has(e.norm)) beatHomes.set(e.norm, e.home);
    }
    const qc = consolidateForeignQuotes(loaded, project, beatHomes);
    changes.push(...qc.changes);
    for (const fl of qc.flagged) changes.push('QUOTE-CONSOLIDATION FLAG: ' + fl);
    if (qc.removed > 0) {
      changes.push('Quote consolidation: removed ' + qc.removed + ' foreign-homed quote occurrence(s).');
    }
    console.log('[QUOTE-CONSOLIDATION] removed=' + qc.removed + ' flagged=' + qc.flagged.length);
  } catch (qcErr) { console.warn('[QUOTE-CONSOLIDATION] skipped:', qcErr?.message); }
  verifyInvariant('Witness Quote Consolidation');

  // A2: Anthology-specific checks (fiction-only)
  // FICTIONFIX-1: body-language dedupe was anthology-gated, so plain novels
  // never ran it (Songbird blind test: stomach beats INCREASED under polish).
  // It is book-agnostic — run it for ALL fiction. Vocab bans + contamination
  // remain anthology-only.
  let anthologyStats = { bodyLangFixed: 0, anthVocabFixed: 0, contaminationFixed: 0, genreVocabFixed: 0 };
  if (mode !== 'nonfiction') {
    onProgress('Polish: Cross-chapter body-language dedupe…');
    const bodyResult = await runCrossChapterBodyLanguageDedup(loaded, onProgress);
    changes.push(...bodyResult.changes); anthologyStats.bodyLangFixed = bodyResult.bodyLangFixed || 0;
  }
  if (mode !== 'nonfiction' && isAnthology) {
    onProgress('Polish: Anthology-specific checks…');
    const anthVocabResult = await runAnthologyVocabBans(loaded, onProgress);
    changes.push(...anthVocabResult.changes); anthologyStats.anthVocabFixed = anthVocabResult.anthVocabFixed || 0;
    const contamResult = await runContaminationDetector(loaded, onProgress, project);
    changes.push(...contamResult.changes); anthologyStats.contaminationFixed = contamResult.contaminationFixed || 0;
  }
  verifyInvariant('Anthology Specific Checks');

  // A3: Punctuation cleanup + spelling fixes
  onProgress('Polish: Punctuation + spelling…');
  const punctResult = runPunctuationCleanup(loaded, onProgress);
  changes.push(...punctResult.changes);
  const spellingResult = runSpellingFixes(loaded, onProgress);
  changes.push(...spellingResult.changes);
  verifyInvariant('Punctuation & Spelling');

  // A4: Capitalization fixes
  onProgress('Polish: Fixing capitalization…');
  let capFixed = 0;
  for (const f of loaded) {
    const before = f.content;
    f.content = safeUppercaseReplace(f.content);
    if (f.content !== before) {
      const fixed = (before.match(/[.!?]\s+[a-z]/g) || []).length - (f.content.match(/[.!?]\s+[a-z]/g) || []).length;
      if (fixed > 0) { capFixed += fixed; changes.push(`Ch.${f.chapter?.chapter_number || '?'}: fixed ${fixed} cap errors`); }
    }
  }
  verifyInvariant('Capitalization Fixes');

  // A5: Capitalization hygiene + transition word caps
  const capHygieneResult = runCapitalizationHygiene(loaded, onProgress);
  changes.push(...capHygieneResult.changes);
  const capHygieneFixed = capHygieneResult.capFixed || 0;
  const transitionResult = runTransitionWordCaps(loaded, onProgress);
  changes.push(...transitionResult.changes);
  const transitionFixed = transitionResult.changes?.length || 0;
  verifyInvariant('Capitalization Hygiene');

  // A6: Dialogue punctuation + filler
  let dialogPunctFixed = 0;
  let dialogFillerFixed = 0;
  if (mode !== 'nonfiction') {
    const dialogPunctResult = runDialoguePunctuationFix(loaded, onProgress);
    changes.push(...dialogPunctResult.changes);
    dialogPunctFixed = dialogPunctResult.dialogPunctFixed || 0;
    const dialogFillerResult = runDialogueFillerFix(loaded, onProgress);
    changes.push(...dialogFillerResult.changes);
    dialogFillerFixed = dialogFillerResult.dialogFillerFixed || 0;
  }
  verifyInvariant('Dialogue Punctuation & Filler');

  // A6.5: ARCH2-4b-c — antithesis ("not X but Y") density cap. Keeps the
  // first two per chapter, deterministically inverts later SAFE copula shapes
  // ("was not X but Y" → "was Y, not X"), leaves everything else untouched.
  const antithesisResult = runAntithesisCap(loaded, onProgress);
  changes.push(...antithesisResult.changes);
  verifyInvariant('Antithesis Cap');

  // A7: Stacked clause variation
  const stackingResult = runStackedClauseVariation(loaded, onProgress);
  changes.push(...stackingResult.changes);
  const stackingFixed = stackingResult.stackingFixed || 0;
  verifyInvariant('Stacked Clause Variation');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B: Per-chapter style/voice cleanup (manuscript-level dispatch)
  // ══════════════════════════════════════════════════════════════════════════

  // DRAFTGATE-2B: heal dropped-word holes in SAVED chapters. Deterministic,
  // provable (article+preposition+the is never valid prose), runs before the
  // NFGUARD snapshot on purpose — this is a sanctioned pre-pass repair, and it
  // is loud. See nfContentGuard.js stripDroppedWordSentences.
  if (mode === 'nonfiction') {
    // BOOKGATE-3: strip exact cross-chapter duplicate sentences (12+ words),
    // keeping the earliest chapter's copy. Runs before NFGUARD snapshots so
    // the heal is baseline. Loud per chapter.
    {
      const ccd = stripCrossChapterDuplicates(loaded.map((f) => String(f.content || '')));
      ccd.removedPerChapter.forEach((removed, i) => {
        if (removed.length > 0) {
          const chNumCcd = loaded[i].chapter?.chapter_number || '?';
          console.warn(`[BOOKGATE-3] Ch.${chNumCcd}: stripped ${removed.length} cross-chapter duplicate sentence(s): ${removed.slice(0, 2).join(' | ')}`);
          changes.push(`Ch.${chNumCcd}: BOOKGATE-3 stripped ${removed.length} cross-chapter duplicate sentence(s)`);
          loaded[i].content = ccd.texts[i];
        }
      });
    }

    for (const f of loaded) {
      // POLISHFIX-10: same provable-artifact strip as DRAFTGATE-1B, applied to
      // SAVED chapters — a stray emphasis marker dangling after terminal
      // punctuation ("…it broke. *") fails the export unterminated check and
      // chapters saved before DRAFTGATE-1B never re-pass through assembly.
      const beforeEmph = String(f.content || '');
      const afterEmph = beforeEmph.replace(/([.!?…”])[ \t]*[*_]+[ \t]*(?=\n|$)/g, '$1');
      if (afterEmph !== beforeEmph) {
        const chNumEm = f.chapter?.chapter_number || '?';
        console.warn(`[POLISHFIX-10] Ch.${chNumEm}: stripped trailing emphasis artifact(s) after terminal punctuation`);
        changes.push(`Ch.${chNumEm}: POLISHFIX-10 stripped trailing emphasis artifact(s)`);
        f.content = afterEmph;
      }

      // DRAFTGATE-3C: heal a/an agreement deterministically
      const healedArt = fixIndefiniteArticles(String(f.content || ''));
      f.content = healedArt.text;
      if (healedArt.fixed > 0) {
        const chNum = f.chapter?.chapter_number || '?';
        console.log(`[DRAFTGATE-3C] Ch.${chNum}: fixed ${healedArt.fixed} indefinite article(s)`);
        changes.push(`Ch.${chNum}: DRAFTGATE-3C fixed ${healedArt.fixed} indefinite article(s)`);
      }

      // DRAFTGATE-3D: rebreak mega-paragraphs (>250 words) into ~120-word paragraphs
      const paras = String(f.content || '').split(/\n{2,}/);
      let rebroke = 0;
      for (let i = 0; i < paras.length; i++) {
        const p = paras[i];
        const words = p.split(/\s+/).filter(Boolean).length;
        if (words > 250) {
          const sents = splitSentencesSafe(p);
          if (sents.length > 1) {
            const newParas = [];
            let curr = [];
            let currWords = 0;
            for (const s of sents) {
              const w = s.split(/\s+/).filter(Boolean).length;
              curr.push(s);
              currWords += w;
              if (currWords >= 120) {
                newParas.push(curr.join(' '));
                curr = [];
                currWords = 0;
              }
            }
            if (curr.length > 0) {
              if (newParas.length > 0) {
                newParas[newParas.length - 1] += ' ' + curr.join(' ');
              } else {
                newParas.push(curr.join(' '));
              }
            }
            paras[i] = newParas.join('\n\n');
            rebroke++;
          }
        }
      }
      if (rebroke > 0) {
        f.content = paras.join('\n\n');
        const chNum = f.chapter?.chapter_number || '?';
        console.log(`[DRAFTGATE-3D] Ch.${chNum}: re-broke ${rebroke} oversized paragraph(s)`);
        changes.push(`Ch.${chNum}: DRAFTGATE-3D re-broke ${rebroke} oversized paragraph(s)`);
      }

      const dw = stripDroppedWordSentences(String(f.content || ''));
      if (dw.removed.length > 0) {
        const chNumDw = f.chapter?.chapter_number || '?';
        console.warn(`[DRAFTGATE-2] Ch.${chNumDw}: stripped ${dw.removed.length} dropped-word sentence(s): ${dw.removed.slice(0, 2).join(' | ')}`);
        changes.push(`Ch.${chNumDw}: DRAFTGATE-2 stripped ${dw.removed.length} dropped-word (broken-grammar) sentence(s)`);
        f.content = dw.text;
      }

      const mang = stripMangledSentences(String(f.content || ''));
      if (mang.removed.length > 0) {
        const chNumMang = f.chapter?.chapter_number || '?';
        console.warn(`[DRAFTGATE-3H] Ch.${chNumMang}: stripped ${mang.removed.length} mangled sentence(s): ${mang.removed.slice(0, 2).join(' | ')}`);
        changes.push(`Ch.${chNumMang}: DRAFTGATE-3H stripped ${mang.removed.length} mangled sentence(s)`);
        f.content = mang.text;
      }

      // ARCH-1C: heal un-evidenced clock times and life-outcome claims in SAVED
      // chapters. Deterministic, closed-world, loud. Runs before the NFGUARD
      // snapshot on purpose — this is a sanctioned pre-pass repair.
      const flPolish = stripFactLedgerViolations(String(f.content || ''), buildFactLedger(project));
      if (flPolish.removed.length > 0) {
        const chNumFl = f.chapter?.chapter_number || '?';
        console.warn(`[FATE-GATE] Ch.${chNumFl}: stripped ${flPolish.removed.length} un-evidenced clock/fate sentence(s): ${flPolish.removed.slice(0, 2).join(' | ')}`);
        changes.push(`Ch.${chNumFl}: ARCH-1C stripped ${flPolish.removed.length} un-evidenced clock/fate sentence(s)`);
        f.content = flPolish.text;
      }
    }
  }

  // NFGUARD-1 (POLISHFIX-8): snapshot every chapter before any style/voice pass
  // touches it. The guard before PHASE H reverts any chapter whose CONTENT
  // (not typography) changed. See nfContentGuard.js for why.
  const nfGuardSnapshots = mode === 'nonfiction' ? loaded.map((f) => String(f.content || '')) : null;

  // NF-SPECIFIC: Run NF deterministic core
  let nfCoreStats = {};
  if (mode === 'nonfiction') {
    if (isNonfictionProject(project)) {
      // POLISHSAFE-6: runNonfictionDeterministicCore's sub-steps (grammar/
      // spelling rewrites, repetition substitution, scaffold removal,
      // credibility-gate rewrites, em-dash-to-comma swaps) either change
      // letters directly or fail NFGUARD-1's own equivalence check
      // (nfContentEquivalent does not tolerate a dash becoming a comma, or a
      // new punctuation mark being inserted) — so NFGUARD-1 was reverting
      // this stage's work on every NF run regardless. Typography (quote
      // glyphs, whitespace) is still normalized later by the pipeline's
      // unconditional PHASE H; nothing real is lost by skipping this stage.
      for (const f of loaded) {
        console.log(`[POLISHSAFE-6] Nonfiction Core Ch.${f.chapter?.chapter_number || '?'}: typography-only (NF)`);
      }
    } else {
      onProgress('Polish (NF): Running nonfiction deterministic core…');
      const nfCore = runNonfictionDeterministicCore(loaded, onProgress, project);
      changes.push(...nfCore.changes);
      nfCoreStats = nfCore.stats || {};
    }
  }
  verifyInvariant('Nonfiction Core');

  // B1: Voice patterns
  onProgress('Polish: Fixing voice patterns…');
  const voiceResult = isAnthology
    ? runPerChapter(loaded, (l) => fixVoicePatterns(l, 1))
    : fixVoicePatterns(loaded, chapterCount);
  changes.push(...voiceResult.changes);
  const voiceFixed = voiceResult.voiceFixed || 0;
  verifyInvariant('Voice Patterns');

  // B2: External AI pattern detection
  onProgress('Polish: Scanning for external AI patterns…');
  const extResult = isAnthology
    ? runPerChapter(loaded, (l) => runExternalAiPatternFix(l))
    : runExternalAiPatternFix(loaded);
  changes.push(...extResult.changes);
  const externalPatternsFixed = extResult.fixed || 0;
  verifyInvariant('External AI Patterns');

  // B3: Repetition caps (fiction-only — NF has its own rep targets in NF core)
  onProgress('Polish: Fixing repetition…');
  let repFixed = 0;
  if (mode !== 'nonfiction') {
    const repResult = runRepetitionCaps(loaded, { isAnthology, isComedy, chapterCount, changes });
    repFixed = repResult.repFixed || 0;
  } else {
    repFixed = nfCoreStats.repFixed || 0;
  }
  verifyInvariant('Repetition Caps');

  let repetitionRewritten = 0;
  if (mode === 'nonfiction' && allowLLM) {
    onProgress('Polish (NF): Rewriting repeated openings/cadence…');
    // Build manuscript-wide opening frequency table so repeated openings ACROSS
    // chapters (not just within one chapter) get flagged and varied.
    const { overused: globalOverused } = buildGlobalOpeningStats(loaded.map(f => f.content));
    console.log(`[REP] globalOverused=${globalOverused.size} sample=[${[...globalOverused].slice(0,6).join(' | ')}]`);
    // ARCH2-4b-b: cross-chapter narrative phrase families (8+ words repeated
    // in 2+ chapters outside quotation marks) feed the same guarded
    // per-paragraph rewrite as overused openings.
    const { overused: crossPhrases, familiesFound } = buildCrossChapterPhraseStats(loaded.map(f => f.content));
    console.log(`[XREP] cross-chapter families=${familiesFound} flagged=${crossPhrases.size} sample=[${[...crossPhrases].slice(0,4).join(' | ')}]`);
    for (const _f of loaded) {
      const _p = String(_f.content || '').split(/\n\n+/).filter(Boolean).length;
      const _l = String(_f.content || '').split(/\n+/).filter(Boolean).length;
      console.log(`[REP] Ch.${_f.chapter?.chapter_number ?? '?'} paras(blankline)=${_p} lines(singlenl)=${_l}`);
    }
    for (const f of loaded) {                          // SEQUENTIAL — one chapter at a time, never Promise.all
      try {
        const r = await rewriteFlaggedSpots({ chapterText: f.content, chapter: f.chapter, project, globalOverused, globalActionBeats: crossPhrases, mode: 'nonfiction', maxRewrites: 18 });
        console.log(`[REP] Ch.${f.chapter?.chapter_number ?? '?'} flagged=${r.flags?.openings?.length ?? 0} cadence=${r.flags?.cadence?.length ?? 0} ok=${r.ok} changed=${r.changed}${r.reason ? ' reason=' + r.reason : ''}`);
        if (r.ok && r.changed) {
          f.content = r.text;                            // updates in-memory; existing save loop persists it
          repetitionRewritten++;
          changes.push(`Ch.${f.chapter?.chapter_number || '?'}: repetition openings/cadence rewritten`);
        } else if (!r.ok) {
          changes.push(`Ch.${f.chapter?.chapter_number || '?'}: repetition rewrite skipped (${r.reason})`);
        }
      } catch (e) {
        changes.push(`Ch.${f.chapter?.chapter_number || '?'}: repetition rewrite error (${e.message})`);
      }
    }
  }
  verifyInvariant('Repetition Rewrite');

  if (mode !== 'nonfiction' && allowLLM) {
    onProgress('Polish: Rewriting repeated openings/beats…');
    const { overused: globalOverused } = buildGlobalOpeningStats(loaded.map(f => f.content));
    const { overused: globalActionBeats, minCount } = buildGlobalActionBeatStats(loaded.map(f => f.content));
    console.log(`[REP-FIC] openings=${globalOverused.size} actionBeats=${globalActionBeats.size} (minCount=${minCount}) sample=[${[...globalActionBeats].slice(0,6).join(' | ')}]`);
    // FICTIONFIX-1: cross-chapter narrative phrase families (ARCH2-4B-B) now
    // feed the fiction rewrite too, merged into the action-beat set.
    const { overused: ficCrossPhrases, familiesFound: ficFamilies } = buildCrossChapterPhraseStats(loaded.map(f => f.content));
    const beatsPlusPhrases = new Set([...globalActionBeats, ...ficCrossPhrases]);
    console.log(`[XREP-FIC] cross-chapter families=${ficFamilies} flagged=${ficCrossPhrases.size}`);
    for (const f of loaded) {                          // SEQUENTIAL — one chapter at a time, never Promise.all
      try {
        const r = await rewriteFlaggedSpots({ chapterText: f.content, chapter: f.chapter, project, globalOverused, globalActionBeats: beatsPlusPhrases, mode: 'fiction', maxRewrites: 24 });
        console.log(`[REP-FIC] Ch.${f.chapter?.chapter_number ?? '?'} openings=${r.flags?.openings?.length ?? 0} beats=${r.flags?.actionBeats?.length ?? 0} cadence=${r.flags?.cadence?.length ?? 0} changed=${r.changed} rewritten=${r.stats?.rewritten ?? 0}`);
        if (r.ok && r.changed) {
          f.content = r.text;
          repetitionRewritten++;
          changes.push(`Ch.${f.chapter?.chapter_number || '?'}: repetition openings/beats/cadence rewritten`);
        }
      } catch (e) {
        changes.push(`Ch.${f.chapter?.chapter_number || '?'}: repetition rewrite error (${e.message})`);
      }
    }
  }
  verifyInvariant('Repetition Rewrite');

  // POLISHSAFE-5: Banned AI-slop character-name detection (FICTION ONLY —
  // nonfiction names are real people). This used to auto-rename ("B3.5")
  // with no approval ever given despite the function name
  // applyApprovedNameReplacementMap — live, it rewrote REDUX Ch.10's
  // antagonist "Halvard" to "Fenwick" x20, the exact name the book's own bible
  // says he is never called ("never 'Fenwick', never 'Russell'"). Prose was
  // regex-edited and canon ignored with no gate catching it afterward.
  // Flag only now; a banned name in the manuscript is an author decision
  // (who this character actually is), never a mechanical rename.
  if (mode !== 'nonfiction') {
    const fullText = loaded.map(f => String(f.content || '')).join('\n');
    const present = getAllBlockedNames().filter(n => countNameOccurrences(fullText, n) > 0);
    for (const name of present) {
      const count = countNameOccurrences(fullText, name);
      console.warn(`[NAME-HYGIENE] banned name present: "${name}" (${count}x) — flagged only`);
      changes.push(`Banned name "${name}" (${count}x) present in the manuscript — flagged only, not renamed. Review manually.`);
    }
  }
  verifyInvariant('Banned Name Flag');

  // B4: Dialogue tag caps + coping mechanism caps + broken sentence fixes (fiction-only)
  if (mode !== 'nonfiction') {
    const dialogueTagResult = isAnthology
      ? runPerChapter(loaded, (l, prog) => runDialogueTagCaps(l, prog), [onProgress])
      : runDialogueTagCaps(loaded, onProgress);
    changes.push(...dialogueTagResult.changes);
    const copingResult = isAnthology
      ? runPerChapter(loaded, (l, prog) => runCopingMechanismCaps(l, prog), [onProgress])
      : runCopingMechanismCaps(loaded, onProgress);
    changes.push(...copingResult.changes);
  }
  const brokenResult = runBrokenSentenceFixes(loaded, onProgress);
  changes.push(...brokenResult.changes);
  verifyInvariant('Dialogue Tag & Coping Caps');

  // B5: Dynamic high-frequency phrase detection
  if (!isAnthology) {
    runHighFrequencyPhraseDetection(loaded, chapterCount, changes);
  }
  verifyInvariant('High-Frequency Phrase Detection');

  // B6: Vocab caps + ChatGPT vocab caps
  const vocabResult = isAnthology
    ? runPerChapter(loaded, (l, prog, opts) => runVocabCaps(l, prog, opts), [onProgress, { project }])
    : runVocabCaps(loaded, onProgress, { project });
  changes.push(...vocabResult.changes);
  const vocabCapped = vocabResult.vocabCapped || 0;
  const chatgptResult = isAnthology
    ? runPerChapter(loaded, (l, prog) => runChatGPTVocabCaps(l, prog), [onProgress])
    : runChatGPTVocabCaps(loaded, onProgress);
  changes.push(...chatgptResult.changes);
  verifyInvariant('Vocab & ChatGPT Caps');

  // B7: Anti-AI detection
  let antiDetect = { changes: [] };
  let starterResultSafe = { changes: [] };
  if (isNonfictionProject(project)) {
    // POLISHSAFE-6: runAntiDetectionPolish's remaining NF-reachable sub-step
    // (em-dash density fix, inside extraPolishChecks) fails NFGUARD-1's own
    // equivalence check the same way Nonfiction Core's did, and
    // runSentenceStarterVariationNF's "The"->"That"/sentence-join rewrite is
    // 100% letter-changing with no typography-only residue to preserve.
    // Typography is still normalized later by the pipeline's unconditional
    // PHASE H.
    for (const f of loaded) {
      console.log(`[POLISHSAFE-6] Anti-Detection Polish Ch.${f.chapter?.chapter_number || '?'}: typography-only (NF)`);
    }
  } else {
    antiDetect = isAnthology
      ? runPerChapter(loaded, (l, prog) => runAntiDetectionPolish(l, prog, { project }), [onProgress])
      : runAntiDetectionPolish(loaded, onProgress, { project });
    starterResultSafe = runSentenceStarterVariationNF(loaded, onProgress);
  }
  changes.push(...antiDetect.changes);
  // FICTIONFIX-2: the referent-preserving starter pass runs for ALL modes —
  // article swaps corrupted fiction referents too (Songbird blind test). The
  // legacy fiction pass still runs for fiction, but its swap strategies are
  // disabled; it now only caps "It was" and pronoun openers.
  changes.push(...starterResultSafe.changes);
  const starterResult = mode === 'nonfiction'
    ? { changes: [] }
    : runSentenceStarterVariation(loaded, onProgress);
  changes.push(...starterResult.changes);
  const aiResist = runAiDetectionResistance(loaded, onProgress); // unconditional — confirmed typography-safe for NF too
  changes.push(...aiResist.changes);
  verifyInvariant('Anti-Detection Polish');

  // B8: Scene duplicate sweep (fiction only)
  let sceneDuplicateStats = { blocksRemoved: 0, wordsRemoved: 0, reportedOnly: 0, chaptersChanged: 0, skippedUnsafe: 0 };
  if (mode !== 'nonfiction' && sceneDuplicateSweep) {
    onProgress('Polish: Running scene duplicate sweep…');
    const sceneDupResult = sceneDuplicateSweep(loaded, onProgress, {
      project, isAnthology, chapterCount,
      allowCrossChapterRemoval: false, reportCrossChapterOnly: true,
    });
    changes.push(sceneDupResult.summary);
    changes.push(...(sceneDupResult.changes || []));
    anthologyStats.sceneDupes = {
      blocksRemoved: sceneDupResult.blocksRemoved || 0,
      wordsRemoved: sceneDupResult.wordsRemoved || 0,
      skippedUnsafe: sceneDupResult.skippedUnsafe || 0,
    };
    verifyInvariant('Scene Duplicate Sweep', sceneDupResult.allowedRemovals || {});
  } else {
    verifyInvariant('Scene Duplicate Sweep');
  }

  // B9: Style tic sweep
  onProgress('Polish: Running style tic sweep…');
  const styleTicResult = runStyleTicSweep(loaded, onProgress, { project, isAnthology, chapterCount });
  changes.push(styleTicResult.summary);
  changes.push(...(styleTicResult.changes || []));
  verifyInvariant('Style Tic Sweep');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE C: Per-chapter deterministic cleanup + quality repair
  // ══════════════════════════════════════════════════════════════════════════

  // C1: Artifact repair (pre-quote)
  onProgress('Polish: Cleaning deterministic artifacts…');
  const artifactPreResult = repairLoadedManuscriptArtifacts(loaded, { project, forceSongbirdAliases: true });
  changes.push(...artifactPreResult.changes);
  for (const fl of artifactPreResult.flags || []) {
    console.warn(`[LEGACYSTAGES-1] Ch.${fl.chapter}: would have deleted paragraph ${fl.paragraphIndex} (${fl.reason}) — flagged, not removed`);
    changes.push(`Ch.${fl.chapter}: LEGACYSTAGES-1 flagged paragraph ${fl.paragraphIndex} (${fl.reason}) — kept, not removed`);
    paragraphDeletionFlags.push({ ...fl, stage: 'Pre-Quote Artifact Repair' });
  }
  verifyInvariant('Pre-Quote Artifact Repair');

  // C2: Quote fixes
  onProgress('Polish: Fixing quotation boundaries…');
  const quoteResult = fixHangingQuotes(loaded);
  changes.push(...quoteResult.changes);
  const quotesFixed = quoteResult.quotesFixed || 0;
  verifyInvariant('Quote Fixes');

  // C3: Canon name lock
  onProgress('Polish: Locking canon names…');
  let canonNamesFixed = 0;
  for (const f of loaded) {
    const canonRepair = repairCanonNameDrift(f.content || '', { project, chapter: f.chapter });
    if (canonRepair.changed) {
      f.content = canonRepair.text;
      canonNamesFixed += canonRepair.repairs?.length || 1;
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: canon-name lock repaired ${canonRepair.repairs?.join('; ') || ''}`);
    }
  }
  verifyInvariant('Canon Name Lock');

  // C4: Final artifact cleanup
  onProgress('Polish: Final safe mechanical cleanup…');
  const artifactResult = repairLoadedManuscriptArtifacts(loaded, { project, forceSongbirdAliases: true });
  changes.push(...artifactResult.changes);
  for (const fl of artifactResult.flags || []) {
    console.warn(`[LEGACYSTAGES-1] Ch.${fl.chapter}: would have deleted paragraph ${fl.paragraphIndex} (${fl.reason}) — flagged, not removed`);
    changes.push(`Ch.${fl.chapter}: LEGACYSTAGES-1 flagged paragraph ${fl.paragraphIndex} (${fl.reason}) — kept, not removed`);
    paragraphDeletionFlags.push({ ...fl, stage: 'Final Artifact Cleanup' });
  }
  verifyInvariant('Final Artifact Cleanup');

  // C5: Deterministic grammar repair + dialogue mechanics
  onProgress('Polish: Running grammar repair…');
  let grammarRepairCount = 0;
  let quoteRepairCount = 0;
  let dialogueRepairCount = 0;
  let midParaAutoFixCount = 0;
  let slopRepairCount = 0;

  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    // Grammar
    const gResult = runDeterministicGrammarRepair(f.content || '');
    if (gResult.repairs.length > 0) { f.content = gResult.text; grammarRepairCount += gResult.repairs.length; }
    // Missing opening quotes
    const qResult = repairMissingOpeningQuotes(f.content || '');
    if (qResult.repairs.length > 0) { f.content = qResult.text; quoteRepairCount += qResult.repairs.length; }
    // Dialogue mechanics (fiction only — NF source quotes must not be reformatted)
    if (mode !== 'nonfiction' && shouldRunDialogueRepair(f.content || '', project)) {
      const dmResult = runDialogueMechanicsPass(f.content || '', {});
      // DIALOGREPAIR-2: the pass reports each healer separately; keeping the text
      // only when the VERB-TAG detector repaired something silently discarded the
      // orphan-closer and close-heavy healers' work (live: 16 defects, 0 kept).
      const dmTotal = Number(dmResult.totalRepaired) ||
        (dmResult.repairs.length + (dmResult.orphanRepaired || 0) + (dmResult.unclosedRepaired || 0) + (dmResult.closeHeavyRepaired || 0));
      if (dmTotal > 0 && dmResult.text !== f.content) { f.content = dmResult.text; dialogueRepairCount += dmTotal; }
      const mpResult = runMidParagraphDialogueAutofixPass(f.content || '', {});
      if (mpResult.midParagraphAutoFixed > 0) { f.content = mpResult.text; midParaAutoFixCount += mpResult.midParagraphAutoFixed; }
    }
    // AI-slop reduction — force-enable for NF and anthology (deterministic budgeted recasts are safe for all modes)
    if (mode === 'nonfiction' || isAnthology || shouldRunAISlopReduction(project)) {
      const slopResult = runAISlopReductionPass(f.content || '', {});
      if (slopResult.repairs.length > 0 || slopResult.improved) {
        f.content = slopResult.text;
        slopRepairCount += slopResult.repairs.length;
      }
    }
  }

  if (grammarRepairCount > 0) changes.push(`Grammar repair: fixed ${grammarRepairCount} issue(s).`);
  if (quoteRepairCount > 0) changes.push(`Quote repair: fixed ${quoteRepairCount} missing opening quote(s).`);
  if (dialogueRepairCount > 0) changes.push(`Dialogue mechanics: fixed ${dialogueRepairCount} issue(s).`);
  if (midParaAutoFixCount > 0) changes.push(`Mid-paragraph dialogue: ${midParaAutoFixCount} auto-fixed.`);
  if (slopRepairCount > 0) changes.push(`AI-slop reduction: ${slopRepairCount} recast(s).`);
  verifyInvariant('Grammar & Dialogue Mechanics');

  // ══════════════════════════════════════════════════════════════════════════
  // CROSSDEDUPE-1: cross-chapter verbatim duplicate sentences (fiction, LLM).
  // The export gate (BOOKGATE-3) hard-blocks on exactly these; this heals them
  // in the polish lane so a finished book does not dead-end at export. One
  // sequential LLM call per duplicate, deterministically verified (same
  // meaning-preservation contract as the prose polisher: unverifiable recasts
  // are skipped and reported, never forced). Nonfiction is excluded — NF prose
  // is typography-only in polish (NFGUARD-1) and NF quotes are closed-world.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // CANON-2: name-variant heal. A capitalized token that is a one-edit
  // near-miss of exactly one canonical cast name ("Ludor" in a book whose
  // canon is Ludo/Ludovic — 3 live hits) is generation drift, not a
  // character. Deterministic, and only when the canonical form dominates
  // (>=5x), so a legitimately similar minor character is never clobbered.
  // ══════════════════════════════════════════════════════════════════════════
  let nameVariantsHealed = 0;
  if (mode !== 'nonfiction') {
    try {
      const canonCast = parseCanonCast(project?.characters_md);
      if (canonCast.length) {
        for (const f of loaded) {
          const healed = healNameVariants(f.content || '', canonCast);
          if (healed.repairs.length) {
            f.content = healed.text;
            for (const r of healed.repairs) {
              nameVariantsHealed += r.count;
              changes.push(`Ch.${f.chapter?.chapter_number || '?'}: canon name variant healed — "${r.variant}" -> "${r.canonical}" (${r.count}x).`);
              console.log(`[CANON-2] Ch.${f.chapter?.chapter_number || '?'}: healed name variant "${r.variant}" -> "${r.canonical}" (${r.count}x)`);
            }
          }
        }
      }
    } catch (canonError) {
      console.warn('[CANON-2] Name-variant heal failed open:', canonError?.message);
    }
  }
  verifyInvariant('Canon Name Variant Heal');

  let crossDedupeStats = { recast: 0, skipped: [], dupesFound: 0 };
  if (mode !== 'nonfiction' && !isAnthology) {
    onProgress('Polish: Scanning for cross-chapter duplicate sentences…');
    const dedupeChapters = loaded.map((f) => ({ chapterNumber: f.chapter?.chapter_number, text: f.content || '' }));
    // POLISHSAFE-1C: the dedupe healer has its own switch, independent of the
    // full LLM prose polish. The UI's Fix Manuscript lane is deterministic-first
    // (allowLLM false), but a dedupe recast is one verified sentence, not a
    // chapter rewrite — running it there is exactly the point of the pass.
    // Each recast is still one sequential LLM call, deterministically verified,
    // and fails open to a report if the LLM is unreachable.
    if (allowLLM || allowDedupeLLM || _crossDedupeLLMOverride) {
      try {
        crossDedupeStats = await healCrossChapterDuplicates(dedupeChapters, {
          callLLM: _crossDedupeLLMOverride,
          project,
          onProgress,
        });
        for (let i = 0; i < loaded.length; i++) {
          if (dedupeChapters[i].text !== loaded[i].content) loaded[i].content = dedupeChapters[i].text;
        }
        changes.push(...crossDedupeStats.changes);
        if (crossDedupeStats.dupesFound > 0) {
          changes.push(`CrossDedupe: ${crossDedupeStats.dupesFound} duplicated sentence(s) found, ${crossDedupeStats.recast} recast, ${crossDedupeStats.skipped.length} left for review.`);
        }
      } catch (err) {
        console.error('[CROSSDEDUPE] pass failed open:', err?.message);
        changes.push(`CrossDedupe: pass unavailable (${err?.message || 'unknown'}) — duplicates NOT healed.`);
      }
    } else {
      const found = findCrossChapterDuplicateSentences(dedupeChapters);
      crossDedupeStats.dupesFound = found.length;
      if (found.length > 0) {
        changes.push(`CrossDedupe: ${found.length} duplicated sentence(s) found — LLM disabled, reported only: ${found.map((d) => `ch${d.a}=ch${d.b}`).join(', ')}.`);
        console.warn(`[CROSSDEDUPE] LLM disabled — ${found.length} cross-chapter duplicate(s) reported, not healed.`);
      }
    }
  }
  verifyInvariant('Cross-Chapter Dedupe');

  // STYLEBUDGET-2: simile HARD CAP over legacy chapters. Fiction only. Same
  // discipline as the dedupe healer: one sequential LLM call per sentence,
  // deterministically verified (no simile left, no new proper nouns, same
  // framing), fail-open to a report when the LLM is off or unreachable.
  let simileStats = { chaptersOver: 0, recast: 0, skipped: 0 };
  if (mode !== 'nonfiction' && !isAnthology) {
    for (const f of loaded) {
      const chNum = f.chapter?.chapter_number || '?';
      const plan = selectSimileRecastTargets(String(f.content || ''));
      if (!plan.over) continue;
      simileStats.chaptersOver += 1;
      if (allowLLM || allowStyleLLM || _simileLLMOverride) {
        try {
          const healed = await healSimileDensity(String(f.content || ''), { callLLM: _simileLLMOverride, project, onProgress, label: `Ch.${chNum}` });
          if (healed.recast > 0) {
            f.content = healed.text;
            simileStats.recast += healed.recast;
            changes.push(`Ch.${chNum}: STYLEBUDGET-2 recast ${healed.recast} simile sentence(s) (${healed.before} → ${healed.after} per 1k)`);
          }
          simileStats.skipped += healed.skipped.length;
        } catch (err) {
          console.error(`[STYLEBUDGET-2] Ch.${chNum} pass failed open:`, err?.message);
          changes.push(`Ch.${chNum}: STYLEBUDGET-2 unavailable (${err?.message || 'unknown'}) — similes NOT recast.`);
        }
      } else {
        changes.push(`Ch.${chNum}: STYLEBUDGET-2 over simile budget (${plan.per1k}/1k vs ${plan.budgetPer1k}) — LLM disabled, reported only.`);
        console.warn(`[STYLEBUDGET-2] Ch.${chNum}: over budget (${plan.per1k}/1k) — LLM disabled, reported only.`);
      }
    }
    if (simileStats.chaptersOver > 0) {
      changes.push(`STYLEBUDGET-2: ${simileStats.chaptersOver} chapter(s) over simile budget, ${simileStats.recast} sentence(s) recast, ${simileStats.skipped} left for review.`);
    }
  }
  verifyInvariant('Simile Hard Cap');

  // SUBJECTREPAIR-1: restore subjects the retired caps deleted ("Was wearing…",
  // "Looked at Ludo.", "A strange sense of relief wash over her."). Fiction and
  // nonfiction alike — a subjectless sentence is broken in any genre. The model
  // only chooses the subject; the verifier enforces candidate === subject +
  // original. Fail-open; LLM off → report only.
  let subjectStats = { found: 0, repaired: 0, skipped: 0 };
  {
    let castForRepair = [];
    try {
      castForRepair = harvestCastNames(project?.characters_md, loaded.map((f) => String(f.content || '')));
      // SUBJECTREPAIR-1B: the model answers with bible names too ("Ludovic was
      // focused…"); every canon name and alias is a legal subject.
      for (const entry of parseCanonCast(project?.characters_md)) {
        for (const n of [entry.name, ...(entry.aliases || [])]) if (n && !castForRepair.includes(n)) castForRepair.push(n);
      }
    } catch { castForRepair = castForRepair || []; }
    for (const f of loaded) {
      const chNum = f.chapter?.chapter_number || '?';
      const found = findDroppedSubjectSentences(String(f.content || ''));
      if (!found.length) continue;
      subjectStats.found += found.length;
      if (allowLLM || allowSubjectRepairLLM || _subjectLLMOverride) {
        try {
          const rep = await repairDroppedSubjects(String(f.content || ''), { callLLM: _subjectLLMOverride, project, castNames: castForRepair, onProgress, label: `Ch.${chNum}` });
          if (rep.repaired > 0) {
            f.content = rep.text;
            subjectStats.repaired += rep.repaired;
            changes.push(`Ch.${chNum}: SUBJECTREPAIR-1 restored ${rep.repaired}/${rep.found} dropped subject(s)`);
          }
          subjectStats.skipped += rep.skipped.length;
        } catch (err) {
          console.error(`[SUBJECTREPAIR-1] Ch.${chNum} pass failed open:`, err?.message);
          changes.push(`Ch.${chNum}: SUBJECTREPAIR-1 unavailable (${err?.message || 'unknown'}) — ${found.length} dropped subject(s) NOT repaired.`);
        }
      } else {
        changes.push(`Ch.${chNum}: SUBJECTREPAIR-1 found ${found.length} dropped-subject sentence(s) — LLM disabled, reported only.`);
      }
    }
    if (subjectStats.found > 0) changes.push(`SUBJECTREPAIR-1: ${subjectStats.found} dropped-subject sentence(s) found, ${subjectStats.repaired} restored, ${subjectStats.skipped} left for review.`);
  }
  verifyInvariant('Subject Repair');

  // REGENLANE-1 / REGENLANE-2: legacy chapters get the same one-chance
  // block-and-regenerate lane the writer applies to new prose — the lane
  // MALFORMEDSENT-1 could detect but never fix. Fiction AND nonfiction (the
  // lane's own verifier gates NF's closed-world check through the
  // projectType authority — no mode string test here); one sequential LLM
  // call per flagged paragraph, deterministically verified, fail-open to a
  // report.
  checkpoint();
  let regenStats = { chaptersWithTargets: 0, regenerated: 0, skipped: 0 };
  // REGENLANE-2B: keyed by the loaded-file object itself (stable across the
  // sortedLoaded reorder below — same references, just resorted) so
  // NFGUARD-1 can find each chapter's accepted lane rewrites later.
  const laneReplacementsByFile = new Map();
  if (!isAnthology) {
    let castForRegen = [];
    try {
      castForRegen = harvestCastNames(project?.characters_md, loaded.map((f) => String(f.content || '')));
      for (const entry of parseCanonCast(project?.characters_md)) {
        for (const n of [entry.name, ...(entry.aliases || [])]) if (n && !castForRegen.includes(n)) castForRegen.push(n);
      }
    } catch { castForRegen = castForRegen || []; }
    const sortedLoaded = [...loaded].sort((a, b) => (Number(a.chapter?.chapter_number) || 0) - (Number(b.chapter?.chapter_number) || 0));
    // NAMEGATE-1: built once (evidence computed once), reused across every
    // chapter in this pass; a no-op for nonfiction (already has its own
    // closed-world check).
    // NAMEGATE-1B (finding 54): `castForRegen` above is prose-augmented (plus
    // canon aliases) — exactly right for the OTHER regen-lane checks, wrong
    // for NAMEGATE, which must judge a name against what the author actually
    // declared. sheetCast is bible-only; evidence is bible-only too
    // (chapters: []) — chapter beats are outline output, not the bible.
    const sheetCast = harvestCastNames(project?.characters_md, []);
    const unknownPersonDetector = makeUnknownPersonDetector({ project, cast: sheetCast, chapters: [] });
    for (let idx = 0; idx < sortedLoaded.length; idx += 1) {
      const f = sortedLoaded[idx];
      const chNum = f.chapter?.chapter_number || '?';
      const priorProse = sortedLoaded.slice(0, idx).map((p) => String(p.content || ''));
      // STYLEBUDGET-3: prior openings for the echo detector, and the family
      // detector's book spend, both built from the same prior-chapter slice.
      const priorOpenings = sortedLoaded.slice(0, idx).map((p) => ({ chapterNumber: p.chapter?.chapter_number, text: String(p.content || '') }));
      const templateFamilyDetector = makeTemplateFamilyDetector({ priorProse });
      const openingEchoDetector = makeOpeningEchoDetector({ priorOpenings, castNames: castForRegen });
      console.log(`[STYLEBUDGET-3] Ch.${chNum}: family targets ${templateFamilyDetector(String(f.content || '')).length}, opening-echo targets ${openingEchoDetector(String(f.content || '')).length}`);
      const fragmentDensityDetector = makeFragmentDensityDetector();
      const fragDensityNow = measureFragmentDensity(String(f.content || ''));
      console.log(`[FRAGBUDGET-1] Ch.${chNum}: fragments ${fragDensityNow.fragments} (${fragDensityNow.per1k}/1k, budget ${FRAGMENT_DENSITY_BUDGET_PER_1K}), targets ${fragmentDensityDetector(String(f.content || '')).length}`);
      const unknownPersonsNow = unknownPersonDetector(String(f.content || ''));
      console.log(`[NAMEGATE-1] Ch.${chNum}: checked ${collectProperNouns(String(f.content || '')).length} proper noun(s), ${unknownPersonsNow.length} unknown person(s)`);
      unknownPersonsNow.forEach((u) => console.log(`[NAMEGATE-1] Ch.${chNum}: ${u.reason}`));
      if (allowLLM || allowRegenLLM || _regenLLMOverride) {
        try {
          const regen = await regenerateFlaggedParagraphs(String(f.content || ''), {
            callLLM: _regenLLMOverride, project, cast: castForRegen, priorProse, label: `Ch.${chNum}`, onProgress,
            extraDetectors: [detectBannedVocabulary, templateFamilyDetector, openingEchoDetector, fragmentDensityDetector, unknownPersonDetector], // POLISHSAFE-4 + STYLEBUDGET-3 + FRAGBUDGET-1 + NAMEGATE-1
          });
          if (regen.targets.length > 0) regenStats.chaptersWithTargets += 1;
          if (regen.regenerated > 0) {
            f.content = regen.text;
            regenStats.regenerated += regen.regenerated;
            changes.push(`Ch.${chNum}: Regenerate Lane — regenerated ${regen.regenerated}, skipped ${regen.skipped.length}`);
            // REGENLANE-2B: recorded so NFGUARD-1 (below) can revert everything
            // ELSE this chapter's polish pass did and re-apply just these —
            // each already closed-world-verified by check (10) when NF.
            if (regen.replacements?.length) laneReplacementsByFile.set(f, regen.replacements);
          }
          regenStats.skipped += regen.skipped.length;
        } catch (err) {
          console.error(`[REGENLANE] Ch.${chNum} pass failed open:`, err?.message);
          changes.push(`Ch.${chNum}: Regenerate Lane unavailable (${err?.message || 'unknown'}) — flagged paragraph(s) NOT regenerated.`);
        }
      } else {
        const targets = collectRegenTargets(String(f.content || ''), { cast: castForRegen, extraDetectors: [detectBannedVocabulary, templateFamilyDetector, openingEchoDetector, fragmentDensityDetector, unknownPersonDetector] });
        if (targets.length > 0) {
          regenStats.chaptersWithTargets += 1;
          changes.push(`Ch.${chNum}: Regenerate Lane found ${targets.length} flagged paragraph(s) — LLM disabled, reported only.`);
        }
      }
    }
    if (regenStats.chaptersWithTargets > 0) {
      changes.push(`Regenerate Lane: ${regenStats.chaptersWithTargets} chapter(s) had flagged paragraph(s), ${regenStats.regenerated} regenerated, ${regenStats.skipped} left for review.`);
    }
  }
  verifyInvariant('Regenerate Lane');

  // PRONOUNVAR-1: heal WITHIN-scene pronoun drift for context-variable
  // characters (e.g. Solveig, declared genderfluid). Between scenes the
  // presentation may change by design; inside one scene it must be uniform.
  // Deterministic (no LLM): flip the minority gendered pronouns to the scene's
  // majority, ONLY in sentences attributed to that character. A tie is left
  // alone. Fiction only.
  let pronounVarStats = { chaptersHealed: 0, flips: 0 };
  if (mode !== 'nonfiction') {
    try {
      const castForVar = harvestCastNames(project?.characters_md, loaded.map((f) => String(f.content || '')));
      const canonForVar = buildPronounCanon(project, loaded.map((f) => String(f.content || '')), castForVar);
      const variableNames = Array.isArray(canonForVar.variable) ? canonForVar.variable : [];
      if (variableNames.length) {
        for (const f of loaded) {
          const chNum = f.chapter?.chapter_number || '?';
          let chFlips = 0;
          for (const name of variableNames) {
            const res = healContextVariablePronounScenes(String(f.content || ''), name, castForVar);
            if (res.healed.length) { f.content = res.text; chFlips += res.healed.reduce((s, h) => s + h.count, 0); }
          }
          if (chFlips > 0) {
            pronounVarStats.chaptersHealed += 1;
            pronounVarStats.flips += chFlips;
            changes.push(`Ch.${chNum}: PRONOUNVAR-1 unified ${chFlips} within-scene pronoun(s) for context-variable character(s)`);
            console.log(`[PRONOUNVAR-1] Ch.${chNum}: unified ${chFlips} within-scene pronoun(s)`);
          }
        }
      }
    } catch (pvErr) {
      console.error('[PRONOUNVAR-1] pass failed open:', pvErr?.message);
    }
  }
  verifyInvariant('Context-Variable Pronoun Heal');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE D: LLM prose polish (LAST mutating step)
  // ══════════════════════════════════════════════════════════════════════════
  const llmPolishLog = [];
  let llmPolishCount = 0;
  let llmFallbackCount = 0;

  if (allowLLM) {
    if (mode === 'nonfiction') {
      // ── NF Mode: real LLM prose polish (uses the nonfiction polisher prompt) ──
      onProgress('Polish (NF): Running LLM prose polisher…');
      const briefContext = project
        ? `${project.title || ''} — Nonfiction${project.author_voice ? `, voice: ${project.author_voice}` : ''}`
        : '';

      for (let i = 0; i < loaded.length; i++) {
        const f = loaded[i];
        const chNum = f.chapter?.chapter_number || (i + 1);
        const chTitle = f.chapter?.title || `Chapter ${chNum}`;
        onProgress(`Polish (NF): LLM polishing Ch.${chNum} (${i + 1}/${loaded.length})…`);

        const preLLMContent = f.content;
        const preLLMSlop = runAISlopReductionPass(preLLMContent, {});
        const preLLMSlopTotal = preLLMSlop.beforeTotal || 0;
        const wordsBefore = (f.content || '').split(/\s+/).length;

        try {
          const llmResult = _llmOverride
            ? await _llmOverride({ chapterText: f.content, chapterNumber: chNum })
            : await polishChapterWithLLM({
                chapterText: f.content,
                chapterTitle: chTitle,
                chapterNumber: chNum,
                projectContext: briefContext,
                project,
                timeoutMs: 600000,
              });

          if (llmResult.ok) {
            const postLLMSlop = runAISlopReductionPass(llmResult.text, {});
            const postLLMSlopTotal = postLLMSlop.beforeTotal || 0;
            if (postLLMSlopTotal > preLLMSlopTotal + 2) {
              llmFallbackCount++;
              llmPolishLog.push({ chapter: chNum, ok: false, error: `slop regression (${preLLMSlopTotal} → ${postLLMSlopTotal})`, fallback: true });
              changes.push(`Ch.${chNum}: NF LLM polish REVERTED — slop regression`);
            } else {
              f.content = llmResult.text;
              llmPolishCount++;
              const wordsAfter = (llmResult.text || '').split(/\s+/).length;
              changes.push(`Ch.${chNum}: NF LLM polished (${wordsBefore} → ${wordsAfter} words)`);
            }
          } else {
            llmFallbackCount++;
            llmPolishLog.push({ chapter: chNum, ok: false, error: llmResult.error, fallback: true });
            changes.push(`Ch.${chNum}: NF LLM polish fallback — ${llmResult.error || 'unknown'}`);
          }
        } catch (err) {
          llmFallbackCount++;
          llmPolishLog.push({ chapter: chNum, ok: false, error: err?.message, fallback: true });
          changes.push(`Ch.${chNum}: NF LLM polish error — ${err?.message}`);
        }
      }
      changes.push(`NF LLM Polish: ${llmPolishCount} polished, ${llmFallbackCount} fallback.`);
    } else {
  verifyInvariant('NF LLM Polish');
      // ── Fiction Mode: LLM prose polish ──
      onProgress('Polish: Running LLM prose polisher…');
      const briefContext = project
        ? `${project.title || ''} — ${project.genre || 'Fiction'}, ${project.pov_mode || 'Third person'}, ${project.tense || 'Past tense'}`
        : '';

      for (let i = 0; i < loaded.length; i++) {
        const f = loaded[i];
        const chNum = f.chapter?.chapter_number || (i + 1);
        const chTitle = f.chapter?.title || `Chapter ${chNum}`;
        onProgress(`Polish: LLM polishing Ch.${chNum} (${i + 1}/${loaded.length})…`);

        // LLM idempotency: skip if this chapter's content hasn't changed since
        // last LLM polish (hash stamp in revision_notes matches current content hash)
        const contentHash = simpleHash(f.content || '');
        const existingStamp = (f.chapter?.revision_notes || '').match(/\[llm-polished:([a-f0-9]+)\]/);
        if (existingStamp && existingStamp[1] === contentHash) {
          llmPolishLog.push({ chapter: chNum, ok: true, skipped: true, reason: 'idempotency-hash-match' });
          changes.push(`Ch.${chNum}: LLM polish skipped (already polished, hash match)`);
          continue;
        }

        // Capture pre-LLM state for slop regression check
        const preLLMContent = f.content;
        const preLLMSlop = runAISlopReductionPass(preLLMContent, {});
        const preLLMSlopTotal = preLLMSlop.beforeTotal || 0;
        const wordsBefore = (f.content || '').split(/\s+/).length;

        try {
          const llmResult = _llmOverride
            ? await _llmOverride({ chapterText: f.content, chapterNumber: chNum })
            : await polishChapterWithLLM({
                chapterText: f.content,
                chapterTitle: chTitle,
                chapterNumber: chNum,
                projectContext: briefContext,
                project,
                timeoutMs: 600000,
              });

          if (llmResult.ok) {
            // ── Slop regression check: reject LLM output if it increases slop ──
            const postLLMSlop = runAISlopReductionPass(llmResult.text, {});
            const postLLMSlopTotal = postLLMSlop.beforeTotal || 0;

            if (postLLMSlopTotal > preLLMSlopTotal + 2) {
              // LLM made slop WORSE → revert
              llmFallbackCount++;
              llmPolishLog.push({ chapter: chNum, ok: false, error: `slop regression (${preLLMSlopTotal} → ${postLLMSlopTotal})`, fallback: true });
              changes.push(`Ch.${chNum}: LLM polish REVERTED — slop regression (${preLLMSlopTotal} → ${postLLMSlopTotal})`);
              console.warn(`[POLISH-RUNNER] Ch.${chNum}: LLM slop regression — reverting`);
            } else {
              f.content = llmResult.text;
              llmPolishCount++;
              const wordsAfter = (llmResult.text || '').split(/\s+/).length;
              changes.push(`Ch.${chNum}: LLM polished (${wordsBefore} → ${wordsAfter} words)`);
              // Stamp idempotency hash so re-runs skip this chapter
              const polishedHash = simpleHash(llmResult.text);
              f.chapter.revision_notes = ((f.chapter.revision_notes || '') + `\n[llm-polished:${polishedHash}]`).slice(-8000);
            }
          } else {
            llmFallbackCount++;
            llmPolishLog.push({ chapter: chNum, ok: false, error: llmResult.error, fallback: true });
            changes.push(`Ch.${chNum}: LLM polish fallback — ${llmResult.error || 'unknown'}`);
          }
        } catch (err) {
          llmFallbackCount++;
          llmPolishLog.push({ chapter: chNum, ok: false, error: err?.message, fallback: true });
          changes.push(`Ch.${chNum}: LLM polish error — ${err?.message}`);
        }
      }
      changes.push(`LLM Prose Polish: ${llmPolishCount} polished, ${llmFallbackCount} fallback.`);
    }
  }
  verifyInvariant('Fiction LLM Polish');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE D2: Final vocabulary sweep — POLISHFIX-3.
  // The LLM stages above (rewriteFlaggedSpots, polishChapterWithLLM) run after
  // the early deterministic vocabulary steps and can reintroduce banned
  // vocabulary, so the scan runs again here, after every LLM stage, as the
  // true last check. POLISHSAFE-4: both the banned-vocabulary recast and the
  // NF adverb-opener rewrite/delete are retired — flag-only.
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Final vocabulary sweep…');
  let finalVocabFlagged = 0;
  const FINAL_NF_ADVERBS = ['arguably', 'interestingly', 'remarkably', 'notably', 'undoubtedly', 'unquestionably'];
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const finalRecast = recastBannedVocabulary(f.content || '');
    for (const fl of finalRecast.flagged) {
      finalVocabFlagged += fl.count;
      changes.push(`Ch.${chNum}: BANNED "${fl.word}" x${fl.count} flagged (final sweep) - substitution retired (POLISHSAFE-4)`);
    }
    if (mode === 'nonfiction') {
      for (const w of FINAL_NF_ADVERBS) {
        const count = ((f.content || '').match(new RegExp('\\b' + w + '\\b', 'gi')) || []).length;
        if (count > 0) {
          finalVocabFlagged += count;
          changes.push(`Ch.${chNum}: NF adverb "${w}" x${count} flagged (final sweep) - deletion retired (POLISHSAFE-4)`);
        }
      }
    }
  }
  if (finalVocabFlagged > 0) changes.push('Final vocabulary sweep: ' + finalVocabFlagged + ' word(s) flagged - substitution retired (POLISHSAFE-4).');
  verifyInvariant('Final Vocabulary Sweep');

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE D3: FICTIONFIX-1 — sentence-case + spacing healer. Several passes
  // (phrase deletions, triplet reduction, paragraph merging, LLM splices) can
  // leave a sentence starting lowercase, a beheaded fragment, doubled spaces,
  // or a missing space after a closing quote. Heal the CLASS here, after every
  // mutating stage, instead of patching each producer.
  const caseRepair = runSentenceCaseRepair(loaded, onProgress);
  changes.push(...caseRepair.changes);
  // FICTIONFIX-2: heal article-swap wounds and verb jams left by older passes
  const woundRepair = healProseWounds(loaded, onProgress);
  changes.push(...woundRepair.changes);
  verifyInvariant('Sentence Case & Wound Repair');

  // PHASE E: Quality gate + improvement scoring
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Running post-polish quality gate…');
  const gateFailures = [];
  const improvementReports = [];
  const qualityGateAllowances = {};

  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const key = getChapterKey(f, i);
    const chNum = f.chapter?.chapter_number || '?';

    // Improvement scoring
    try {
      const scoring = runPolishImprovementScoring(f.original || '', f.content || '', { chapterNumber: chNum });
      improvementReports.push(scoring);
    } catch (err) {
      console.warn('[POLISH-RUNNER] Scoring error:', err?.message);
    }

    // Quality gate
    const gate = runProsePolishQualityGate(f.content || '', { chapterNumber: chNum, stage: 'post-polish' });
    if (!gate.ok) {
      gateFailures.push({
        chapter: chNum,
        action: gate.recommendedAction,
        malformed: gate.malformed.count,
        quoteIssues: gate.quoteIssues.count,
        slopTotal: gate.slopCounts.total,
      });
      changes.push(`Post-polish gate Ch.${chNum}: ${gate.recommendedAction}`);

      // Smart partial repair with slop regression check
      if (gate.recommendedAction === 'BLOCK_POLISH_SAVE') {
        const originalGate = runProsePolishQualityGate(f.original || '');
        const repairedGate = gate;
        const origSlop = originalGate.slopCounts?.total || 0;
        const repairedSlop = repairedGate.slopCounts?.total || 0;

        if (f.content !== f.original &&
            repairedGate.malformed.count < originalGate.malformed.count &&
            repairedSlop <= origSlop + 2) {
          // Improved — save partial repair
          changes.push(`⚠️ Ch.${chNum}: saved with partial repairs. Manual review needed.`);
        } else {
          // No improvement or slop regression — revert
          const beforeWc = countParagraphs(f.content);
          f.content = f.original || f.content;
          const afterWc = countParagraphs(f.original || f.content);
          if (beforeWc > afterWc) {
            qualityGateAllowances[key] = beforeWc - afterWc;
          }
          changes.push(`🚫 Ch.${chNum}: polish BLOCKED — reverting to original.`);
        }
      }
    }
  }

  verifyInvariant('Quality Gate Revert', qualityGateAllowances);

  if (gateFailures.length === 0) {
    changes.push('Post-polish gate: all chapters PASS.');
  }

  // Reference integrity (auto-detect)
  const refCheckText = loaded.map(f => f.content).join('\n\n');
  if (shouldRunReferenceIntegrity(refCheckText, project)) {
    onProgress('Polish: Running reference integrity check…');
    const refReport = runReferenceIntegrityGate(refCheckText, project);
    if (!refReport.ok) changes.push('⚠️ Reference integrity: ' + refReport.summary);
    else if (refReport.warnings?.length > 0) changes.push('Reference integrity: ' + refReport.summary);
  }

  // Essay imbalance detection (NF diagnostic — report only, never rewrites)
  if (mode === 'nonfiction') {
    onProgress('Polish (NF): Checking essay/narrative balance…');
    for (const f of loaded) {
      const chNum = f.chapter?.chapter_number || '?';
      const imbalance = detectEssayImbalance(f.content || '', project);
      if (imbalance.warnings.length > 0) {
        changes.push(...imbalance.warnings.map(w => `Ch.${chNum}: ${w}`));
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE F: Global per-chapter content loss guard (backstop)
  // ══════════════════════════════════════════════════════════════════════════
  let contentLossReverts = 0;
  const contentLossAllowances = {};
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const key = getChapterKey(f, i);
    const chNum = f.chapter?.chapter_number || '?';
    const originalWc = originalWordCounts.get(key) || 0;
    if (originalWc < 50) continue; // skip trivially short chapters
    const finalWc = countWords(f.content || '');
    const retainedRatio = finalWc / originalWc;
    if (retainedRatio < 0.85) {
      const lossPct = Math.round((1 - retainedRatio) * 100);
      console.warn(`[POLISH-RUNNER] Ch.${chNum}: GLOBAL LOSS GUARD — final ${finalWc} words is ${lossPct}% below original ${originalWc} words. REVERTING.`);
      const beforeWc = countParagraphs(f.content);
      f.content = f.original || f.content;
      const afterWc = countParagraphs(f.original || f.content);
      if (beforeWc > afterWc) {
        contentLossAllowances[key] = beforeWc - afterWc;
      }
      contentLossReverts++;
      changes.push(`Ch.${chNum} REVERTED — total content loss ${lossPct}% exceeded safety limit; flagged for manual review`);
    }
  }
  verifyInvariant('Global Content Loss Guard', contentLossAllowances);

  if (contentLossReverts > 0) {
    changes.push(`Content loss guard: ${contentLossReverts} chapter(s) reverted to pre-pipeline content.`);
    // FICTIONFIX-2: reverted chapters carry PRE-pipeline text, including any
    // damage the healers already fixed once this run — heal them again so a
    // revert can never reintroduce mechanical wounds. Both healers are
    // idempotent and deterministic.
    const revertCaseRepair = runSentenceCaseRepair(loaded, onProgress);
    changes.push(...revertCaseRepair.changes);
    verifyInvariant('Post-Restore Sentence Case Repair');

    const revertWoundRepair = healProseWounds(loaded, onProgress);
    changes.push(...revertWoundRepair.changes);
    verifyInvariant('Post-Restore Wound Repair');

    if (_testInjectHealer) {
      _testInjectHealer(loaded);
      verifyInvariant('Injected Test Healer');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE G: Absolute Final Model Leaks Scrub (LEAKFIX-2)
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Final absolute model leak scrub…');
  runModelLeakScrub('Final Model Leaks Scrub');

  // Residual hard check
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const chNum = f.chapter?.chapter_number || '?';
    const remainingLeak = detectModelControlTokens(f.content || '');
    if (remainingLeak.length > 0) {
      throw new Error(`CRITICAL: Model control token leaked through final scrub in Ch.${chNum}: "${remainingLeak[0].token}"`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NFGUARD-1 (POLISHFIX-8): on nonfiction, any pass that changed prose CONTENT
  // (beyond quote glyphs / whitespace / collapsed doubled punctuation) is
  // reverted here, per chapter, loudly. Typography (PHASE H below) then runs on
  // the reverted text, so quote normalization is preserved. Flag-only passes
  // are unaffected — their changes[] entries survive.
  if (nfGuardSnapshots) {
    loaded.forEach((f, gi) => {
      const beforeText = nfGuardSnapshots[gi];
      const afterText = String(f.content || '');
      if (!nfContentEquivalent(beforeText, afterText)) {
        const chLabel = f.chapter?.chapter_number ?? gi + 1;
        console.error(`[NFGUARD-1] Ch.${chLabel}: a polish pass changed prose content — REVERTED. Deterministic NF polish may alter typography only; rewrite passes must flag, not fix.`);
        // REGENLANE-2B/2C: revert to the snapshot as before, then re-apply
        // ONLY the regenerate lane's own accepted replacements for this
        // chapter — each already closed-world-verified (check 10) when NF.
        // Finding 48: the snapshot is taken BEFORE "Nonfiction Core" /
        // "Anti-Detection Polish" / typography run, so the lane's `before`
        // (the paragraph as it stood AFTER those stages) can fail the exact
        // string match even though nothing content-wise actually diverged.
        // Fallback: locate the paragraph by its recorded `paragraphIndex` in
        // the reverted text and accept it when it is typography-equivalent
        // to `before` (nfContentEquivalent) — an earlier stage's quote/
        // whitespace drift, not a real conflict. Only when NEITHER the exact
        // match nor the index+equivalence fallback finds a unique span is
        // the replacement dropped, loudly.
        let reverted = beforeText;
        let kept = 0;
        let dropped = 0;
        for (const r of (laneReplacementsByFile.get(f) || [])) {
          if (!r?.before) continue;
          const exactOccurrences = reverted.split(r.before).length - 1;
          if (exactOccurrences === 1) {
            reverted = reverted.split(r.before).join(r.after);
            kept += 1;
            continue;
          }
          const revertedParagraphs = paragraphsOf(reverted);
          const targetParagraph = revertedParagraphs[r.paragraphIndex];
          if (targetParagraph && nfContentEquivalent(targetParagraph, r.before)) {
            const occurrences = reverted.split(targetParagraph).length - 1;
            if (occurrences === 1) {
              reverted = reverted.split(targetParagraph).join(r.after);
              kept += 1;
              continue;
            }
          }
          dropped += 1;
        }
        if (kept > 0) console.log(`[NFGUARD-1] Ch.${chLabel}: kept ${kept} lane rewrite(s)`);
        if (dropped > 0) console.log(`[NFGUARD-1] Ch.${chLabel}: dropped ${dropped} lane rewrite(s) (span not found)`);
        const nfguardNotes = [];
        if (kept > 0) nfguardNotes.push(`kept ${kept} lane rewrite(s)`);
        if (dropped > 0) nfguardNotes.push(`dropped ${dropped} lane rewrite(s) (span not found)`);
        changes.push(`Ch.${chLabel}: NFGUARD-1 reverted content changes made by style passes (typography-only policy)${nfguardNotes.length ? `, ${nfguardNotes.join(', ')}` : ''}`);
        f.content = reverted;
      }
    });
  }

  // PHASE H: Typography normalization — QUOTENORM-1.
  // The last mutating step. Deterministic passes (and, when enabled, the LLM)
  // can emit straight quotes; this makes quote typography uniform (all curly) so
  // the export gate's typography verdict cannot hard-block a finished book on
  // mixed straight/curly quotes. Character-for-character only — word and
  // paragraph counts are invariant by construction.
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Typography normalization (quotes)…');
  let smartQuotesNormalized = 0;
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const before = f.content || '';
    const res = normalizeSmartQuotesOnly(before);
    if (res.changed > 0 && res.text !== before) {
      f.content = res.text;
      smartQuotesNormalized += res.changed;
    }
  }
  if (smartQuotesNormalized > 0) {
    changes.push(`Typography: normalized ${smartQuotesNormalized} straight quote mark(s) to curly (QUOTENORM-1)`);
  }
  console.log(`[POLISH-RUNNER] [QUOTENORM-1] normalized ${smartQuotesNormalized} straight quote mark(s) across ${loaded.length} chapter(s)`);

  // QUOTECLOSE-2: close any trailing unclosed dialogue quote left in a paragraph.
  // Runs AFTER typography is uniform (all curly). Paragraph-count-preserving, so
  // STRUCTURE-GUARD has nothing to revert; it only appends a closing ”.
  let trailingQuotesClosed = 0;
  for (let i = 0; i < loaded.length; i++) {
    const f = loaded[i];
    const before = f.content || '';
    const res = closeTrailingUnclosedQuotes(before);
    if (res.changed > 0 && res.text !== before) {
      f.content = res.text;
      trailingQuotesClosed += res.changed;
    }
  }
  if (trailingQuotesClosed > 0) {
    changes.push(`Dialogue: closed ${trailingQuotesClosed} trailing unclosed quote(s) (QUOTECLOSE-2)`);
  }
  console.log(`[POLISH-RUNNER] [QUOTECLOSE-2] closed ${trailingQuotesClosed} trailing unclosed quote(s) across ${loaded.length} chapter(s)`);

  // ══════════════════════════════════════════════════════════════════════════
  // POLISHSAFE-1B: final unconditional dialogue-balance heal + QUOTE-GUARD.
  //
  // Heal: runDialogueMechanicsPass runs on EVERY fiction chapter as the last
  // mutating step — no eligibility gate. Its healers are strict no-ops on
  // balanced text, and gating them (the old shouldRunDialogueRepair path) is
  // exactly how a chapter that a mid-pipeline stage unbalanced reached export
  // still broken.
  //
  // Guard: any chapter whose smart-quote imbalance is now WORSE than at
  // pipeline start reverts to its input text, loudly. Same contract as
  // STRUCTURE-GUARD extended to quote balance: a polish that corrupts dialogue
  // does not ship, period.
  // ══════════════════════════════════════════════════════════════════════════
  let finalBalanceRepairs = 0;
  let quoteGuardReverts = 0;
  if (mode !== 'nonfiction') {
    onProgress('Polish: Final dialogue-balance pass…');
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const dmFinal = runDialogueMechanicsPass(f.content || '', {});
      const dmFinalTotal = Number(dmFinal.totalRepaired) ||
        (dmFinal.repairs.length + (dmFinal.orphanRepaired || 0) + (dmFinal.unclosedRepaired || 0) + (dmFinal.closeHeavyRepaired || 0));
      if (dmFinalTotal > 0 && dmFinal.text !== f.content) {
        f.content = dmFinal.text;
        finalBalanceRepairs += dmFinalTotal;
      }
    }
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const key = getChapterKey(f, i);
      const initial = initialQuoteState.get(key);
      if (!initial) continue;
      const finalImbalance = quoteImbalance(f.content || '');
      if (finalImbalance > initial.imbalance) {
        const chNum = f.chapter?.chapter_number || '?';
        console.error(`[QUOTE-GUARD] Ch.${chNum}: pipeline left quote balance WORSE than input (imbalance ${initial.imbalance} -> ${finalImbalance}). REVERTED to input text.`);
        changes.push(`Ch.${chNum}: QUOTE-GUARD reverted all polish (quote balance would have gotten worse: ${initial.imbalance} -> ${finalImbalance}).`);
        f.content = initial.text;
        quoteGuardReverts += 1;
      }
    }
  }
  if (finalBalanceRepairs > 0) changes.push(`Final dialogue-balance pass: ${finalBalanceRepairs} repair(s) (POLISHSAFE-1B).`);
  console.log(`[POLISH-RUNNER] [POLISHSAFE-1B] final balance repairs=${finalBalanceRepairs} quoteGuardReverts=${quoteGuardReverts}`);

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);

  return {
    structureViolations,
    paragraphDeletionFlags,
    changes,
    gateFailures,
    llmLog: llmPolishLog,
    improvementReports,
    anthologyStats,
    // Comprehensive stats for report template
    stats: {
      crossDedupeFound: crossDedupeStats.dupesFound,
      crossDedupeRecast: crossDedupeStats.recast,
      simileChaptersOver: simileStats.chaptersOver, // STYLEBUDGET-2
      simileRecast: simileStats.recast,
      simileSkipped: simileStats.skipped,
      subjectFound: subjectStats.found, // SUBJECTREPAIR-1
      subjectRepaired: subjectStats.repaired,
      pronounVarFlips: pronounVarStats.flips, // PRONOUNVAR-1
      pronounVarChapters: pronounVarStats.chaptersHealed,
      finalBalanceRepairs,
      quoteGuardReverts,
      bannedRecastCount,
      capFixed,
      capHygieneFixed,
      voiceFixed,
      transitionFixed,
      dialogPunctFixed,
      dialogFillerFixed,
      stackingFixed,
      repFixed,
      repetitionRewritten,
      externalPatternsFixed,
      vocabCapped,
      quotesFixed,
      grammarRepairCount,
      quoteRepairCount,
      dialogueRepairCount,
      midParaAutoFixCount,
      slopRepairCount,
      canonNamesFixed,
      llmPolishCount,
      llmFallbackCount,
      sceneDuplicate: sceneDuplicateStats,
      styleTic: {
        fixed: styleTicResult.styleTicFixed || 0,
        familiesFound: styleTicResult.repeatedTicFamiliesFound || 0,
        grammarFixed: styleTicResult.grammarArtifactsFixed || 0,
        chaptersChanged: styleTicResult.changedChapterCount || 0,
      },
      nfCore: nfCoreStats,
      contentLossReverts,
      leakTokensRemoved: totalLeakTokensRemoved,
      leakParagraphsRemoved: totalLeakParagraphsRemoved,
    },
    // Legacy flat fields (kept for backward compat)
    bannedRecastCount,
    grammarRepairCount,
    quoteRepairCount,
    dialogueRepairCount,
    slopRepairCount,
    capFixed,
    canonNamesFixed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Repetition caps (extracted from ProjectStudio inline)
// ═══════════════════════════════════════════════════════════════════════════
// POLISHSAFE-4: scan repeated word/phrase overuse and FLAG the excess —
// never substitute or delete. loaded[].content is never mutated here.
function runRepetitionCaps(loaded, { isAnthology, isComedy, chapterCount, changes }) {
  const targets = [
    { pattern: /\bthe loop\b/gi, name: 'the loop', maxBase: 20, perChapter: 1 },
    { pattern: /\bshuddered\b/gi, name: 'shuddered', maxBase: 6, perChapter: 0.3 },
    { pattern: /\bthe silence\b/gi, name: 'the silence', maxBase: 8, perChapter: 0.4 },
    { pattern: /\bthe bond\b/gi, name: 'the bond', maxBase: 8, perChapter: 0.4 },
    { pattern: /\bthe darkness\b/gi, name: 'the darkness', maxBase: 8, perChapter: 0.4 },
    { pattern: /\bwhispered\b/gi, name: 'whispered', maxBase: 12, perChapter: 0.5 },
    { pattern: /\bexhaled\b/gi, name: 'exhaled', maxBase: 6, perChapter: 0.3 },
    { pattern: /\bclenched\b/gi, name: 'clenched', maxBase: 10, perChapter: 0.5 },
    { pattern: /\bthe scent of\b/gi, name: 'the scent of', maxBase: 6, perChapter: 0.3 },
    { pattern: /\beyes met\b/gi, name: 'eyes met', maxBase: 6, perChapter: 0.3 },
    { pattern: /\bsuddenly\b/gi, name: 'suddenly', maxBase: 6, perChapter: 0.3 },
    { pattern: /\bsomehow\b/gi, name: 'somehow', maxBase: isComedy ? 12 : 4, perChapter: isComedy ? 0.6 : 0.2 },
  ];

  const repFixed = 0;

  if (isAnthology) {
    for (const f of loaded) {
      for (const t of targets) {
        const matches = f.content.match(t.pattern);
        if (!matches) continue;
        const maxThis = Math.max(2, Math.round(t.maxBase / 10));
        if (matches.length <= maxThis) continue;
        changes.push(`Ch.${f.chapter?.chapter_number || '?'}: "${t.name}" ${matches.length} found, ${maxThis} allowed, ${matches.length - maxThis} flagged - substitution retired (POLISHSAFE-4)`);
      }
    }
  } else {
    const allText = loaded.map(f => f.content).join('\n\n');
    for (const t of targets) {
      const total = (allText.match(t.pattern) || []).length;
      const cap = Math.round(Math.max(t.maxBase, chapterCount * t.perChapter));
      if (total <= cap) continue;
      changes.push(`"${t.name}": ${total} found, ${cap} allowed, ${total - cap} flagged - substitution retired (POLISHSAFE-4)`);
    }
  }

  return { repFixed };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper: High-frequency phrase detection (report only)
// ═══════════════════════════════════════════════════════════════════════════
function runHighFrequencyPhraseDetection(loaded, chapterCount, changes) {
  const text = loaded.map(f => f.content).join('\n\n');
  const phraseCounts = {};
  const wordList = text.toLowerCase().split(/\s+/);
  const skip = new Set(['of the','in the','to the','on the','at the','and the','for the','was the','from the','with the','into the','that the','but the','had been','would be','could be','did not','was not','had not','she had','he had','she was','he was','her eyes','his eyes','she said','he said','they had','it was','there was','back to','out of']);

  for (let i = 0; i < wordList.length - 1; i++) {
    const w1 = wordList[i].replace(/[^a-z]/g, '');
    const w2 = wordList[i + 1].replace(/[^a-z]/g, '');
    if (w1.length < 3 || w2.length < 3) continue;
    const p = w1 + ' ' + w2;
    if (skip.has(p)) continue;
    phraseCounts[p] = (phraseCounts[p] || 0) + 1;
  }

  const threshold = Math.max(chapterCount * 6, 80);
  const highFreq = Object.entries(phraseCounts).filter(([, c]) => c > threshold).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [phrase, count] of highFreq) {
    changes.push(`⚠️ "${phrase}" appears ${count}x (threshold: ${threshold})`);
  }
}
