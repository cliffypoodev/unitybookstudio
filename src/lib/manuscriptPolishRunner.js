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


export const VERSION = 'MANUSCRIPT-POLISH-RUNNER v1.0 — 2026-06-10';

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
 * @returns {Object} { changes, savedCount, unchangedCount, afterStats, gateFailures, llmLog, ... }
 */
export async function runManuscriptPolishPipeline({
  loaded,
  project,
  onProgress = () => {},
  allowLLM = true,
  mode = 'fiction',
  sceneDuplicateSweep = null,
}) {
  const changes = [];
  const isAnthology = isAnthologyProject(project);
  const isComedy = isComedyProject(project);
  const chapterCount = loaded.length;
  const formatLabel = (l) => typeof l === 'string' ? l : '';

  console.log(`[POLISH-RUNNER] ========== START v1.0 ==========`);
  console.log(`[POLISH-RUNNER] chapters=${chapterCount} anthology=${isAnthology} mode=${mode} allowLLM=${allowLLM}`);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE A: Manuscript-level pre-pass (cross-chapter deterministic)
  // ══════════════════════════════════════════════════════════════════════════

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

  // A2: Anthology-specific checks
  let anthologyStats = { bodyLangFixed: 0, anthVocabFixed: 0, contaminationFixed: 0, genreVocabFixed: 0 };
  if (isAnthology) {
    onProgress('Polish: Anthology-specific checks…');
    const bodyResult = runCrossChapterBodyLanguageDedup(loaded, onProgress);
    changes.push(...bodyResult.changes); anthologyStats.bodyLangFixed = bodyResult.bodyLangFixed || 0;
    const anthVocabResult = runAnthologyVocabBans(loaded, onProgress);
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
    f.content = f.content.replace(/([.!?])\s+([a-z])/g, (match, punct, letter, offset) => {
      if (offset >= 2 && f.content[offset - 1] === '.' && f.content[offset - 2] === '.') return match;
      if (offset >= 2 && /[A-Z][a-z]/.test(f.content.substring(offset - 2, offset))) return match;
      return punct + ' ' + letter.toUpperCase();
    });
    if (f.content !== before) {
      const fixed = (before.match(/[.!?]\s+[a-z]/g) || []).length - (f.content.match(/[.!?]\s+[a-z]/g) || []).length;
      if (fixed > 0) { capFixed += fixed; changes.push(`Ch.${f.chapter?.chapter_number || '?'}: fixed ${fixed} cap errors`); }
    }
  }

  // A5: Capitalization hygiene + transition word caps
  const capHygieneResult = runCapitalizationHygiene(loaded, onProgress);
  changes.push(...capHygieneResult.changes);
  const transitionResult = runTransitionWordCaps(loaded, onProgress);
  changes.push(...transitionResult.changes);

  // A6: Dialogue punctuation + filler
  const dialogPunctResult = runDialoguePunctuationFix(loaded, onProgress);
  changes.push(...dialogPunctResult.changes);
  const dialogFillerResult = runDialogueFillerFix(loaded, onProgress);
  changes.push(...dialogFillerResult.changes);

  // A7: Stacked clause variation
  const stackingResult = runStackedClauseVariation(loaded, onProgress);
  changes.push(...stackingResult.changes);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE B: Per-chapter style/voice cleanup (manuscript-level dispatch)
  // ══════════════════════════════════════════════════════════════════════════

  // B1: Voice patterns
  onProgress('Polish: Fixing voice patterns…');
  const voiceResult = isAnthology
    ? runPerChapter(loaded, (l) => fixVoicePatterns(l, 1))
    : fixVoicePatterns(loaded, chapterCount);
  changes.push(...voiceResult.changes);

  // B2: External AI pattern detection
  onProgress('Polish: Scanning for external AI patterns…');
  const extResult = isAnthology
    ? runPerChapter(loaded, (l) => runExternalAiPatternFix(l))
    : runExternalAiPatternFix(loaded);
  changes.push(...extResult.changes);

  // B3: Repetition caps (MOVED from ProjectStudio inline)
  onProgress('Polish: Fixing repetition…');
  const repResult = runRepetitionCaps(loaded, { isAnthology, isComedy, chapterCount, changes });

  // B4: Dialogue tag caps + coping mechanism caps + broken sentence fixes
  const dialogueTagResult = isAnthology
    ? runPerChapter(loaded, (l, prog) => runDialogueTagCaps(l, prog), [onProgress])
    : runDialogueTagCaps(loaded, onProgress);
  changes.push(...dialogueTagResult.changes);
  const copingResult = isAnthology
    ? runPerChapter(loaded, (l, prog) => runCopingMechanismCaps(l, prog), [onProgress])
    : runCopingMechanismCaps(loaded, onProgress);
  changes.push(...copingResult.changes);
  const brokenResult = runBrokenSentenceFixes(loaded, onProgress);
  changes.push(...brokenResult.changes);

  // B5: Dynamic high-frequency phrase detection (novel mode only, report only)
  if (!isAnthology) {
    runHighFrequencyPhraseDetection(loaded, chapterCount, changes);
  }

  // B6: Vocab caps + ChatGPT vocab caps
  const vocabResult = isAnthology
    ? runPerChapter(loaded, (l, prog, opts) => runVocabCaps(l, prog, opts), [onProgress, { project }])
    : runVocabCaps(loaded, onProgress, { project });
  changes.push(...vocabResult.changes);
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

  // B8: Scene duplicate sweep (if provided by caller)
  if (sceneDuplicateSweep) {
    onProgress('Polish: Running scene duplicate sweep…');
    const sceneDupResult = sceneDuplicateSweep(loaded, onProgress, {
      project, isAnthology, chapterCount,
      allowCrossChapterRemoval: false, reportCrossChapterOnly: true,
      highConfidenceThreshold: 0.42, mediumConfidenceThreshold: 0.36,
      maxRemovalRatioPerChapter: 0.58, maxBlocksRemovedPerChapter: 10,
    });
    changes.push(sceneDupResult.summary);
    changes.push(...(sceneDupResult.changes || []));
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
    // Note: forceSongbirdAliasRepairText is project-specific and runs in ProjectStudio.
  }

  // C4: Final artifact cleanup
  onProgress('Polish: Final safe mechanical cleanup…');
  const artifactResult = repairLoadedManuscriptArtifacts(loaded, { project, forceSongbirdAliases: true });
  changes.push(...artifactResult.changes);

  // C5: Grammar repair + quote repair + dialogue mechanics + AI-slop
  onProgress('Polish: Deterministic grammar repair…');
  let grammarRepairCount = 0;
  let quoteRepairCount = 0;
  let dialogueRepairCount = 0;
  let midParaAutoFixCount = 0;
  let slopRepairCount = 0;

  for (const f of loaded) {
    // Grammar
    const gResult = runDeterministicGrammarRepair(f.content || '');
    if (gResult.repairs.length > 0) { f.content = gResult.text; grammarRepairCount += gResult.repairs.length; }

    // Missing opening quotes
    const qResult = repairMissingOpeningQuotes(f.content || '');
    if (qResult.repairs.length > 0) { f.content = qResult.text; quoteRepairCount += qResult.repairs.length; }

    // Dialogue mechanics
    if (shouldRunDialogueRepair(f.content || '', project)) {
      const dmResult = runDialogueMechanicsPass(f.content || '', {});
      if (dmResult.repairs.length > 0) { f.content = dmResult.text; dialogueRepairCount += dmResult.repairs.length; }

      const mpResult = runMidParagraphDialogueAutofixPass(f.content || '', {});
      if (mpResult.midParagraphAutoFixed > 0) { f.content = mpResult.text; midParaAutoFixCount += mpResult.midParagraphAutoFixed; }
    }

    // AI-slop reduction
    if (shouldRunAISlopReduction(project)) {
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
    onProgress('Polish: Running LLM prose polisher…');
    const briefContext = project
      ? `${project.title || ''} — ${project.genre || 'Fiction'}, ${project.pov_mode || 'Third person'}, ${project.tense || 'Past tense'}`
      : '';

    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const chNum = f.chapter?.chapter_number || (i + 1);
      const chTitle = f.chapter?.title || `Chapter ${chNum}`;
      onProgress(`Polish: LLM polishing Ch.${chNum} (${i + 1}/${loaded.length})…`);

      // Capture pre-LLM state for slop regression check
      const preLLMContent = f.content;
      const preLLMSlop = runAISlopReductionPass(preLLMContent, {});
      const preLLMSlopTotal = preLLMSlop.beforeTotal || 0;
      const wordsBefore = (f.content || '').split(/\s+/).length;

      try {
        const llmResult = await polishChapterWithLLM({
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

  console.log(`[POLISH-RUNNER] ========== COMPLETE ==========`);

  return {
    changes,
    gateFailures,
    llmLog: llmPolishLog,
    improvementReports,
    bannedRecastCount,
    grammarRepairCount,
    quoteRepairCount,
    dialogueRepairCount,
    slopRepairCount,
    capFixed,
    canonNamesFixed,
    anthologyStats,
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
