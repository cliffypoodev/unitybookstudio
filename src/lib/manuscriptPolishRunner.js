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
import { runVocabCaps, runSentenceStarterVariation } from './vocabCaps.js';
import { runDialogueTagCaps } from './dialogueTagPolish.js';
import { runChatGPTVocabCaps, runTransitionWordCaps } from './chatgptPatternPolish.js';
import { runStackedClauseVariation } from './sentencePatternPolish.js';
import { runAntiDetectionPolish } from './antiDetectionPolish.js';
import { runAiDetectionResistance } from './aiDetectionResist.js';
import { runStyleTicSweep } from './styleTicSweep.js';
import { fixHangingQuotes } from './quoteFixPolish.js';
import { repairLoadedManuscriptArtifacts } from './manuscriptArtifactRepair.js';
import { repairCanonNameDrift } from './canonNameLock.js';
import { runPerChapter } from './anthologyPolishHelper.js';
import { runCrossChapterBodyLanguageDedup, runAnthologyVocabBans, runContaminationDetector }
  from './anthologyPolishChecks.js';
import { isAnthologyProject } from './anthologyEngine.js';
import { isComedyProject } from './manuscriptStats.js';
import { rewriteFlaggedSpots, buildGlobalOpeningStats } from './repetitionRewrite.js';

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
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    originalWordCounts.set(chNum, countWords(f.original || f.content || ''));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE A: Manuscript-level pre-pass (cross-chapter deterministic)
  // ══════════════════════════════════════════════════════════════════════════

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

  // A2: Anthology-specific checks (fiction-only)
  let anthologyStats = { bodyLangFixed: 0, anthVocabFixed: 0, contaminationFixed: 0, genreVocabFixed: 0 };
  if (mode !== 'nonfiction' && isAnthology) {
    onProgress('Polish: Anthology-specific checks…');
    const bodyResult = await runCrossChapterBodyLanguageDedup(loaded, onProgress);
    changes.push(...bodyResult.changes); anthologyStats.bodyLangFixed = bodyResult.bodyLangFixed || 0;
    const anthVocabResult = await runAnthologyVocabBans(loaded, onProgress);
    changes.push(...anthVocabResult.changes); anthologyStats.anthVocabFixed = anthVocabResult.anthVocabFixed || 0;
    const contamResult = await runContaminationDetector(loaded, onProgress, project);
    changes.push(...contamResult.changes); anthologyStats.contaminationFixed = contamResult.contaminationFixed || 0;
  }

  // A3: Punctuation cleanup + spelling fixes
  onProgress('Polish: Punctuation + spelling…');
  const punctResult = runPunctuationCleanup(loaded, onProgress);
  changes.push(...punctResult.changes);
  const spellingResult = runSpellingFixes(loaded, onProgress);
  changes.push(...spellingResult.changes);

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

  // A5: Capitalization hygiene + transition word caps
  const capHygieneResult = runCapitalizationHygiene(loaded, onProgress);
  changes.push(...capHygieneResult.changes);
  const capHygieneFixed = capHygieneResult.capFixed || 0;
  const transitionResult = runTransitionWordCaps(loaded, onProgress);
  changes.push(...transitionResult.changes);
  const transitionFixed = transitionResult.changes?.length || 0;

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

  // A7: Stacked clause variation
  const stackingResult = runStackedClauseVariation(loaded, onProgress);
  changes.push(...stackingResult.changes);
  const stackingFixed = stackingResult.stackingFixed || 0;

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

  // B1: Voice patterns
  onProgress('Polish: Fixing voice patterns…');
  const voiceResult = isAnthology
    ? runPerChapter(loaded, (l) => fixVoicePatterns(l, 1))
    : fixVoicePatterns(loaded, chapterCount);
  changes.push(...voiceResult.changes);
  const voiceFixed = voiceResult.voiceFixed || 0;

  // B2: External AI pattern detection
  onProgress('Polish: Scanning for external AI patterns…');
  const extResult = isAnthology
    ? runPerChapter(loaded, (l) => runExternalAiPatternFix(l))
    : runExternalAiPatternFix(loaded);
  changes.push(...extResult.changes);
  const externalPatternsFixed = extResult.fixed || 0;

  // B3: Repetition caps (fiction-only — NF has its own rep targets in NF core)
  onProgress('Polish: Fixing repetition…');
  let repFixed = 0;
  if (mode !== 'nonfiction') {
    const repResult = runRepetitionCaps(loaded, { isAnthology, isComedy, chapterCount, changes });
    repFixed = repResult.repFixed || 0;
  } else {
    repFixed = nfCoreStats.repFixed || 0;
  }

  let repetitionRewritten = 0;
  if (mode === 'nonfiction' && allowLLM) {
    onProgress('Polish (NF): Rewriting repeated openings/cadence…');
    // Build manuscript-wide opening frequency table so repeated openings ACROSS
    // chapters (not just within one chapter) get flagged and varied.
    const { overused: globalOverused } = buildGlobalOpeningStats(loaded.map(f => f.content));
    console.log(`[REP] globalOverused=${globalOverused.size} sample=[${[...globalOverused].slice(0,6).join(' | ')}]`);
    for (const _f of loaded) {
      const _p = String(_f.content || '').split(/\n\n+/).filter(Boolean).length;
      const _l = String(_f.content || '').split(/\n+/).filter(Boolean).length;
      console.log(`[REP] Ch.${_f.chapter?.chapter_number ?? '?'} paras(blankline)=${_p} lines(singlenl)=${_l}`);
    }
    for (const f of loaded) {                          // SEQUENTIAL — one chapter at a time, never Promise.all
      try {
        const r = await rewriteFlaggedSpots({ chapterText: f.content, chapter: f.chapter, project, globalOverused });
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

  // B5: Dynamic high-frequency phrase detection
  if (!isAnthology) {
    runHighFrequencyPhraseDetection(loaded, chapterCount, changes);
  }

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

  // B7: Anti-AI detection
  const antiDetect = isAnthology
    ? runPerChapter(loaded, (l, prog) => runAntiDetectionPolish(l, prog, { project }), [onProgress])
    : runAntiDetectionPolish(loaded, onProgress, { project });
  changes.push(...antiDetect.changes);
  const starterResult = runSentenceStarterVariation(loaded, onProgress);
  changes.push(...starterResult.changes);
  const aiResist = runAiDetectionResistance(loaded, onProgress);
  changes.push(...aiResist.changes);

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
    sceneDuplicateStats = {
      blocksRemoved: sceneDupResult.blocksRemoved || 0,
      wordsRemoved: sceneDupResult.wordsRemoved || 0,
      reportedOnly: sceneDupResult.reportedOnly || 0,
      flaggedForReview: sceneDupResult.flaggedForReview || 0,
      chaptersChanged: sceneDupResult.changedChapters?.size || sceneDupResult.changedChapters?.length || 0,
      skippedUnsafe: sceneDupResult.skippedUnsafe || 0,
    };
  }

  // B9: Style tic sweep
  onProgress('Polish: Running style tic sweep…');
  const styleTicResult = runStyleTicSweep(loaded, onProgress, { project, isAnthology, chapterCount });
  changes.push(styleTicResult.summary);
  changes.push(...(styleTicResult.changes || []));

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE C: Per-chapter deterministic cleanup + quality repair
  // ══════════════════════════════════════════════════════════════════════════

  // C1: Artifact repair (pre-quote)
  onProgress('Polish: Cleaning deterministic artifacts…');
  const artifactPreResult = repairLoadedManuscriptArtifacts(loaded, { project, forceSongbirdAliases: true });
  changes.push(...artifactPreResult.changes);

  // C2: Quote fixes
  onProgress('Polish: Fixing quotation boundaries…');
  const quoteResult = fixHangingQuotes(loaded);
  changes.push(...quoteResult.changes);
  const quotesFixed = quoteResult.quotesFixed || 0;

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

  // C4: Final artifact cleanup
  onProgress('Polish: Final safe mechanical cleanup…');
  const artifactResult = repairLoadedManuscriptArtifacts(loaded, { project, forceSongbirdAliases: true });
  changes.push(...artifactResult.changes);

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

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE E: Quality gate + improvement scoring
  // ══════════════════════════════════════════════════════════════════════════
  onProgress('Polish: Running post-polish quality gate…');
  const gateFailures = [];
  const improvementReports = [];

  for (const f of loaded) {
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
          f.content = f.original;
          changes.push(`🚫 Ch.${chNum}: polish BLOCKED — reverting to original.`);
        }
      }
    }
  }

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
  for (const f of loaded) {
    const chNum = f.chapter?.chapter_number || '?';
    const originalWc = originalWordCounts.get(chNum) || 0;
    if (originalWc < 50) continue; // skip trivially short chapters
    const finalWc = countWords(f.content || '');
    const retainedRatio = finalWc / originalWc;
    if (retainedRatio < 0.85) {
      const lossPct = Math.round((1 - retainedRatio) * 100);
      console.warn(`[POLISH-RUNNER] Ch.${chNum}: GLOBAL LOSS GUARD — final ${finalWc} words is ${lossPct}% below original ${originalWc} words. REVERTING.`);
      f.content = f.original || f.content;
      contentLossReverts++;
      changes.push(`Ch.${chNum} REVERTED — total content loss ${lossPct}% exceeded safety limit; flagged for manual review`);
    }
  }
  if (contentLossReverts > 0) {
    changes.push(`Content loss guard: ${contentLossReverts} chapter(s) reverted to pre-pipeline content.`);
  }

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);

  return {
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
