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
import { runVocabCaps, runSentenceStarterVariation, runSentenceStarterVariationNF } from './vocabCaps.js';
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
import { repairLoadedManuscriptArtifacts } from './manuscriptArtifactRepair.js';
import { repairCanonNameDrift } from './canonNameLock.js';
import { runPerChapter } from './anthologyPolishHelper.js';
import { runCrossChapterBodyLanguageDedup, runAnthologyVocabBans, runContaminationDetector }
  from './anthologyPolishChecks.js';
import { isAnthologyProject } from './anthologyEngine.js';
import { isComedyProject } from './manuscriptStats.js';
import { rewriteFlaggedSpots, buildGlobalOpeningStats, buildGlobalActionBeatStats, buildCrossChapterPhraseStats } from './repetitionRewrite.js';
import { buildQuoteLedger, consolidateForeignQuotes } from './quoteLedger.js';
import { getAllBlockedNames, getReplacementSuggestionsForName, countNameOccurrences, applyApprovedNameReplacementMap } from './nameHygieneRules.js';

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
  _llmOverride = null,
  _testInjectHealer = null,
}) {
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

  const structureViolations = [];
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
  function verifyInvariant(stageName, allowedRemovals = {}) {
    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const key = getChapterKey(f, i);
      const snap = __snapshots.get(key);
      if (!snap) continue;
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

  // A1: Banned vocabulary RECAST (synonym substitution, never empty-string)
  onProgress('Polish: Recasting banned vocabulary…');
  let bannedRecastCount = 0;
  for (const f of loaded) {
    const result = recastBannedVocabulary(f.content);
    if (result.recasts.length > 0) {
      f.content = result.text;
      bannedRecastCount += result.recasts.length;
      changes.push(`Ch.${f.chapter?.chapter_number || '?'}: recast ${result.recasts.length} banned word(s)`);
    }
  }
  if (bannedRecastCount > 0) {
    changes.push(`Banned vocabulary: recast ${bannedRecastCount} word(s) with synonyms (no deletions).`);
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

  // NF-SPECIFIC: Run NF deterministic core
  let nfCoreStats = {};
  if (mode === 'nonfiction') {
    onProgress('Polish (NF): Running nonfiction deterministic core…');
    const nfCore = runNonfictionDeterministicCore(loaded, onProgress, project);
    changes.push(...nfCore.changes);
    nfCoreStats = nfCore.stats || {};
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

  // B3.5: Banned AI-slop character-name auto-rename (FICTION ONLY — nonfiction names are real people)
  if (mode !== 'nonfiction') {
    const fullText = loaded.map(f => String(f.content || '')).join('\n');
    const present = getAllBlockedNames().filter(n => countNameOccurrences(fullText, n) > 0);
    if (present.length) {
      const used = new Set(present.map(n => n.toLowerCase()));
      const autoMap = {};
      for (const name of present) {
        const sugg = getReplacementSuggestionsForName(name);
        const pick = sugg.find(s => !used.has(s.toLowerCase()) && countNameOccurrences(fullText, s) === 0) || sugg[0];
        autoMap[name] = pick;
        used.add(pick.toLowerCase());
      }
      console.log('[NAME-HYGIENE] auto-renaming banned names: ' + JSON.stringify(autoMap));
      for (const f of loaded) {
        // Titles are metadata (not body content); rename banned names there too so a chapter
        // heading like "Elias's Final Words" stays consistent with the renamed body prose.
        if (f.chapter && f.chapter.title) {
          const tr = applyApprovedNameReplacementMap(f.chapter.title, autoMap);
          if (tr.changed) {
            changes.push('Ch.' + (f.chapter?.chapter_number || '?') + ': title renamed -> ' + tr.text);
            f.chapter.title = tr.text;
          }
        }
        const r = applyApprovedNameReplacementMap(f.content, autoMap);
        if (r.changed) {
          f.content = r.text;
          for (const a of r.applied) {
            changes.push('Ch.' + (f.chapter?.chapter_number || '?') + ': banned name "' + a.from + '" -> "' + a.to + '" (' + a.count + ')');
          }
        }
      }
    }
  }
  verifyInvariant('Banned Name Auto-Rename');

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
  const antiDetect = isAnthology
    ? runPerChapter(loaded, (l, prog) => runAntiDetectionPolish(l, prog, { project }), [onProgress])
    : runAntiDetectionPolish(loaded, onProgress, { project });
  changes.push(...antiDetect.changes);
  // FICTIONFIX-2: the referent-preserving starter pass runs for ALL modes —
  // article swaps corrupted fiction referents too (Songbird blind test). The
  // legacy fiction pass still runs for fiction, but its swap strategies are
  // disabled; it now only caps "It was" and pronoun openers.
  const starterResultSafe = runSentenceStarterVariationNF(loaded, onProgress);
  changes.push(...starterResultSafe.changes);
  const starterResult = mode === 'nonfiction'
    ? { changes: [] }
    : runSentenceStarterVariation(loaded, onProgress);
  changes.push(...starterResult.changes);
  const aiResist = runAiDetectionResistance(loaded, onProgress);
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
      if (dmResult.repairs.length > 0) { f.content = dmResult.text; dialogueRepairCount += dmResult.repairs.length; }
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
  // the early deterministic vocabulary steps and reintroduce banned vocabulary
  // (29 "testament" instances survived a full-book polish). The deterministic
  // recast therefore runs again here, after every LLM stage, as the true last
  // mutating step.
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Final vocabulary sweep…');
  let finalVocabFixed = 0;
  const FINAL_NF_ADVERBS = ['arguably', 'interestingly', 'remarkably', 'notably', 'undoubtedly', 'unquestionably'];
  for (const f of loaded) {
    const finalRecast = recastBannedVocabulary(f.content || '');
    if (finalRecast.recasts.length > 0) {
      f.content = finalRecast.text;
      finalVocabFixed += finalRecast.recasts.length;
    }
    if (mode === 'nonfiction') {
      for (const w of FINAL_NF_ADVERBS) {
        f.content = f.content.replace(new RegExp('(^|[.!?]\\s+)' + w + ',?\\s+([a-z])', 'gi'), (m, pre, ch) => { finalVocabFixed++; return pre + ch.toUpperCase(); });
        f.content = f.content.replace(new RegExp(',?\\s+' + w + '\\b,?', 'gi'), () => { finalVocabFixed++; return ''; });
      }
    }
  }
  if (finalVocabFixed > 0) changes.push('Final vocabulary sweep: ' + finalVocabFixed + ' banned word(s) recast/cleaned after LLM stages.');
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

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);

  return {
    structureViolations,
    changes,
    gateFailures,
    llmLog: llmPolishLog,
    improvementReports,
    anthologyStats,
    // Comprehensive stats for report template
    stats: {
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
function runRepetitionCaps(loaded, { isAnthology, isComedy, chapterCount, changes }) {
  const targets = [
    { pattern: /\bthe loop\b/gi, name: 'the loop', maxBase: 20, perChapter: 1, replacements: ['the cycle','the recursion','the reset','the pattern'] },
    { pattern: /\bshuddered\b/gi, name: 'shuddered', maxBase: 6, perChapter: 0.3, replacements: ['trembled','flinched','stiffened','shook','went rigid'] },
    { pattern: /\bthe silence\b/gi, name: 'the silence', maxBase: 8, perChapter: 0.4, replacements: ['the quiet','the stillness','the hush','the dead air'] },
    { pattern: /\bthe bond\b/gi, name: 'the bond', maxBase: 8, perChapter: 0.4, replacements: ['the link','the tether','the connection','the thread','it'] },
    { pattern: /\bthe darkness\b/gi, name: 'the darkness', maxBase: 8, perChapter: 0.4, replacements: ['the gloom','the shadow','the black','the dark'] },
    { pattern: /\bwhispered\b/gi, name: 'whispered', maxBase: 12, perChapter: 0.5, replacements: ['murmured','breathed','said softly'] },
    { pattern: /\bexhaled\b/gi, name: 'exhaled', maxBase: 6, perChapter: 0.3, replacements: ['breathed out','let out a breath','released a breath'] },
    { pattern: /\bclenched\b/gi, name: 'clenched', maxBase: 10, perChapter: 0.5, replacements: ['tightened','curled','balled','gripped'] },
    { pattern: /\bthe scent of\b/gi, name: 'the scent of', maxBase: 6, perChapter: 0.3, replacements: ['the smell of','the odor of','the tang of'] },
    { pattern: /\beyes met\b/gi, name: 'eyes met', maxBase: 6, perChapter: 0.3, replacements: ['gazes locked','gazes caught'] },
    { pattern: /\bsuddenly\b/gi, name: 'suddenly', maxBase: 6, perChapter: 0.3, replacements: [] },
    { pattern: /\bsomehow\b/gi, name: 'somehow', maxBase: isComedy ? 12 : 4, perChapter: isComedy ? 0.6 : 0.2, replacements: [] },
  ];

  let repFixed = 0;

  if (isAnthology) {
    // Per-chapter independent caps
    for (const f of loaded) {
      for (const t of targets) {
        const matches = f.content.match(t.pattern);
        if (!matches || matches.length <= Math.max(2, t.maxBase / 10)) continue;
        const maxThis = Math.max(2, Math.round(t.maxBase / 10));
        const excess = matches.length - maxThis;
        let instIdx = 0; let chReplaced = 0; let repIdx = 0;
        f.content = f.content.replace(t.pattern, (match) => {
          instIdx++;
          if (instIdx <= maxThis || chReplaced >= excess) return match;
          chReplaced++; repFixed++;
          if (t.replacements.length === 0) return '';
          const rep = t.replacements[repIdx++ % t.replacements.length];
          return match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep;
        });
        f.content = f.content.replace(/  +/g, ' ');
        if (chReplaced > 0) changes.push(`Ch.${f.chapter?.chapter_number || '?'}: replaced ${chReplaced}x "${t.name}"`);
      }
    }
  } else {
    // Novel mode: global repetition caps
    const allText = loaded.map(f => f.content).join('\n\n');
    for (const t of targets) {
      const total = (allText.match(t.pattern) || []).length;
      const cap = Math.round(Math.max(t.maxBase, chapterCount * t.perChapter));
      if (total <= cap) continue;
      const excess = total - cap;
      let replaced = 0;

      const chCounts = loaded.map((f, idx) => ({ idx, count: (f.content.match(t.pattern) || []).length }))
        .sort((a, b) => b.count - a.count);

      for (const cc of chCounts) {
        if (replaced >= excess) break;
        if (cc.count <= 1) continue;
        const f = loaded[cc.idx];
        let instIdx = 0; let chReplaced = 0; let repIdx = 0;
        const maxThis = Math.min(cc.count - 1, excess - replaced);
        f.content = f.content.replace(t.pattern, (match) => {
          instIdx++;
          if (instIdx <= 1 || chReplaced >= maxThis) return match;
          chReplaced++; replaced++; repFixed++;
          if (t.replacements.length === 0) return '';
          const rep = t.replacements[repIdx++ % t.replacements.length];
          return rep === '' ? '' : (match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep);
        });
        f.content = f.content.replace(/  +/g, ' ');
        if (chReplaced > 0) changes.push(`Ch.${f.chapter?.chapter_number || '?'}: replaced ${chReplaced}x "${t.name}"`);
      }
    }
  }

  if (repFixed > 0) changes.push(`Repetition caps: ${repFixed} replacements.`);
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
