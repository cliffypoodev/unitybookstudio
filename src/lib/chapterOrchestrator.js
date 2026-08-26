// src/lib/chapterOrchestrator.js — ORCH-1 (HEADLESS-1, §10 I1)
//
// The MOVED body of ProjectStudio.jsx's draftChapter (091092c6, lines
// 3949-4942) — mechanical extraction with parity, not a rewrite. The
// transformation applied to the original body is exactly the one
// test/orch1.acceptance.mjs's normalized-diff check re-derives and verifies
// against the 091092c6 source: every React state call (setBusyLabel,
// setChapterDraft, the onProgress-or-setBusyLabel dispatch inside the old
// `report` helper) becomes a `deps.onProgress(event)` call; every
// `base44.entities.X.method` becomes `deps.X.method`; every other
// UI/global the body touched (invokeLLMWithRetry, pipelineSnapshot,
// refreshAll, toast, runProjectContentGuardBeforeSave, generateSceneBeats,
// backupChapterBeforeGeneratedOverwrite, projectId, chapterProseModels,
// settingsDrafts — all closures from the React component's own scope, none
// of them pure/importable) is threaded through `deps`; the old positional
// `shouldRefresh`/`modelOverride` params now live on `options`. Nothing
// else changes — same variable names, same control flow, same every
// console tag, same fail-open behavior. ProjectStudio.jsx's `draftChapter`
// is now a thin wrapper (< 60 lines) that builds `deps` from the
// component's scope and calls runChapterDraft.
//
// No React, no @/ aliases — relative imports only, so this module (and its
// battery) can be exercised with bare Node. The five small helpers below
// (formatProgressLabel, appendCleanBlock, GLOBAL_NAME_HYGIENE_PROMPT_BLOCK,
// buildNameHygieneEnhancedProject, logSafetyGateResult, storeSafetyReport,
// forceSongbirdAliasRepairText) are PURE module-level functions that lived
// in ProjectStudio.jsx (not component-scoped — verified none of them close
// over React state) and are copied here verbatim rather than imported back
// from a page component, to avoid a circular import between src/pages and
// src/lib. ProjectStudio.jsx keeps its own copies too, since other code in
// that file may still call them.

export const CHAPTER_ORCHESTRATOR_VERSION = 'chapter-orchestrator-v1';

import { chapterSchema, countWords, getDraftedCount, unwrapIntegrationResult } from './autonovel.js';
import { buildPriorLedger, saveChapterLedger } from './chapterCohesion.js';
import { buildChapterJudgePrompt, chapterJudgeSchema, checkTenseConsistency, checkPovConsistency } from './povTense.js';
import { mechanicalSlopScore, cleanGeneratedProse } from './proseQuality.js';
import { COMPACT_CRAFT_RULES, COMPACT_ANTI_SLOP } from './craftCompact.js';
import { MANDATORY_ENFORCEMENT_BLOCK } from './enforcementBlock.js';
import { runWithNetworkRetry } from './requestRetry.js';
import { prepareChapterContent, resolveChapterContent } from './chapterStorage.js';
import { verifiedChapterSave } from './verifiedChapterSave.js';
import { clearRichContentFields } from './richContentStorage.js';
import { maybeAutoPolishChapter } from './autoPolishHook.js';
import { filterConcreteCriticFindings } from './sceneContractGate.js';
import { runQualityScan } from './qualityScan.js';
import { generateChapterByScenes, finalizeChapterProse } from './sceneWriter.js';
import { createSceneExecutionAcceptanceRunners } from './sceneExecutionAcceptanceRunners.js';
import { validateProjectChapterContent } from './projectContentGuard.js';
import { repairCanonNameDrift } from './canonNameLock.js';
import { repairManuscriptArtifacts } from './manuscriptArtifactRepair.js';
import { postDraftCleanup } from './postDraftCleanup.js';
import { isBodyChapter } from './bibliographyGenerator.js';
import { repairChapterQuotes, normalizeSmartQuotesOnly } from './quoteFixPolish.js';
import { runDialogueMechanicsPass as runDialogueMechanicsFinal } from './dialogueMechanicsRepair.js';
import { isAnthologyProject } from './anthologyEngine.js';
import { isNonfictionProject as isNonfictionProjectAuthority } from './projectType.js';
import { assertNarrativeTextClean, loadGenerationSnapshot, verifySceneProvenance } from './generationContext.js';
import { auditBibleCompleteness } from './bibleGate.js';
import { pickModel, pickFallbackModel, buildFallbackControls, protectedProjectUpdate, normalizeModelId, DEFAULT_FICTION_PROSE_MODEL } from './modelRouting.js';
import { runManuscriptSafetyGate } from './manuscriptSafetyGate.js';
import { buildBannedNamePromptBlock } from './nameHygieneRules.js';

// ── copied verbatim from ProjectStudio.jsx (module-level, pure — see header) ──

function formatProgressLabel(value, fallback = 'Working…') {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => formatProgressLabel(item, '')).filter(Boolean).join(' • ') || fallback;
  if (typeof value === 'object') {
    const stage = value.stage || value.status || value.step || value.message || value.label;
    const sceneNumber = value.sceneNumber ?? value.scene_number;
    const sceneIndex = value.sceneIndex ?? value.scene_index;
    const totalScenes = value.totalScenes ?? value.total_scenes;
    const targetWords = value.targetWords ?? value.target_words;
    const model = value.model || value.proseModel || value.prose_model;

    const parts = [];
    if (stage) parts.push(String(stage));
    if (sceneNumber != null || sceneIndex != null) {
      const displayScene = sceneNumber != null ? sceneNumber : Number(sceneIndex) + 1;
      parts.push(totalScenes != null ? `scene ${displayScene}/${totalScenes}` : `scene ${displayScene}`);
    }
    if (targetWords != null) parts.push(`${targetWords} target words`);
    if (model) parts.push(String(model));
    if (parts.length) return parts.join(' • ');

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function appendCleanBlock(existing, block) {
  const current = String(existing || '').trim();
  const extra = String(block || '').trim();

  if (!extra) return current;
  if (current.includes(extra)) return current;
  return current ? `${current}\n\n${extra}` : extra;
}

const GLOBAL_NAME_HYGIENE_PROMPT_BLOCK = buildBannedNamePromptBlock({
  includeHighRisk: true,
  includeWatchlist: false,
});

function buildNameHygieneEnhancedProject(project) {
  const nameBlock = GLOBAL_NAME_HYGIENE_PROMPT_BLOCK;

  return {
    ...project,
    name_hygiene_prompt_block: nameBlock,
    name_exclusion_block: appendCleanBlock(project?.name_exclusion_block, nameBlock),
    style_rules: appendCleanBlock(project?.style_rules, nameBlock),
    constraints: appendCleanBlock(project?.constraints, nameBlock),
    author_voice_notes: appendCleanBlock(project?.author_voice_notes, nameBlock),
  };
}

function logSafetyGateResult(stage, chapterNum, title, gate) {
  const tag = gate.ok ? 'PASS' : 'FAIL';
  console.log(
    `[SAFETY-GATE] stage=${stage} chapter=${chapterNum}/${title || '?'} ok=${gate.ok} ` +
    `action=${gate.recommendedAction} processLeaks=${gate.processLeaks.matches.length} ` +
    `contamination=${gate.contamination.matches.length} malformed=${gate.malformed.matches.length}`
  );
  if (!gate.ok) {
    const snippets = [
      ...gate.processLeaks.matches.slice(0, 3),
      ...gate.contamination.matches.slice(0, 3),
      ...gate.malformed.matches.slice(0, 2),
    ];
    for (const s of snippets) {
      console.error(
        `[SAFETY-GATE:${tag}] chapter=${chapterNum} phrase="${s.phrase}" snippet="${(s.snippet || '').substring(0, 80)}"`
      );
    }
  }
}

function storeSafetyReport(stage, chapters) {
  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SAFETY_REPORT = { stage, timestamp: new Date().toISOString(), chapters };
    console.log('[SAFETY-GATE] Report stored at window.__UBS_LAST_SAFETY_REPORT');
  }
}

function forceSongbirdAliasRepairText(input = '', options = {}) {
  let out = String(input || '');
  const before = out;
  const projectText = `${options?.project?.title || ''} ${options?.project?.name || ''} ${options?.project?.book_title || ''} ${options?.project?.description || ''} ${options?.project?.premise || ''}`;
  const forcedByProject = /\bSongbird\b/i.test(projectText) || options?.forceSongbirdAliases === true;
  const songbirdSignal = forcedByProject || /\b(Iris|Pauline|HIDA|Harlem Institute|Port Chicago|Children’s Hour|Children's Hour|Glass Menagerie|Phillip Cross|Langston Finch|Pauline Carter)\b/i.test(out);
  if (!songbirdSignal) return { text: out, changed: false, repairs: [] };

  const protectedAliases = [];
  const protect = (pattern, label) => {
    out = out.replace(pattern, (m) => {
      const token = `__SONGBIRD_ALIAS_PROTECT_${label}_${protectedAliases.length}__`;
      protectedAliases.push([token, m]);
      return token;
    });
  };

  protect(/\bArthur Miller\b/g, 'ARTHUR_MILLER');
  protect(/\bKing Arthur\b/g, 'KING_ARTHUR');
  protect(/\bArthurian\b/g, 'ARTHURIAN');

  let arthurCount = 0;
  let coraCount = 0;

  out = out.replace(/\bArthur Finch\b/g, () => { arthurCount += 1; return 'Langston Finch'; });
  out = out.replace(/\bArthur(['’])s\b/g, (_m, apos) => { arthurCount += 1; return `Langston${apos}s`; });
  out = out.replace(/\bArthur\b/g, () => { arthurCount += 1; return 'Langston'; });

  out = out.replace(/\bCora(['’])s\b/g, (_m, apos) => { coraCount += 1; return `Clara${apos}s`; });
  out = out.replace(/\bCora\b/g, () => { coraCount += 1; return 'Clara'; });

  for (const [token, original] of protectedAliases) out = out.split(token).join(original);

  const repairs = [];
  if (arthurCount) repairs.push(`Arthur → Langston (${arthurCount}; Songbird emergency hard alias fallback)`);
  if (coraCount) repairs.push(`Cora → Clara (${coraCount}; Songbird emergency hard alias fallback)`);
  return { text: out, changed: out !== before, repairs };
}

/**
 * The moved body of draftChapter (091092c6). `deps` carries every UI/global
 * the body touches — none of it is optional; the wrapper in ProjectStudio.jsx
 * builds a real one from component scope, the battery builds a mocked one,
 * and scripts/ubs-run.mjs (RUNNER-1) builds a Node-side one:
 *   Chapter: { filter, update }, NovelProject: { update },
 *   invokeLLMWithRetry, pipelineSnapshot, onProgress, toast: { error },
 *   refreshAll, runProjectContentGuardBeforeSave, generateSceneBeats,
 *   backupChapterBeforeGeneratedOverwrite, projectId, chapterProseModels,
 *   settingsDrafts.
 * `chapters` is accepted for API symmetry with the rest of this arc's
 * signatures but is not read inside this body (draftChapter never read the
 * closure's raw chapter list either — it always re-fetched a fresh one
 * through deps.Chapter.filter via loadGenerationSnapshot).
 */
export async function runChapterDraft({ project, chapter, chapters, deps, options = {} }) {
  void chapters;
    // NARRATIVE-CONNECT-1: capture one explicit, fully hydrated generation
    // snapshot. Never let beat/scene generation read the React closure's stale
    // chapter list or blank URL-backed foundation fields.
    const generationSnapshot = await loadGenerationSnapshot({
      project,
      chapter,
      fetchChapters: () => deps.Chapter.filter(
        { project_id: deps.projectId },
        'chapter_number',
        200
      ),
    });
    chapter = generationSnapshot.chapter;
    const generationChapters = generationSnapshot.chapters;
    const generationProject = generationSnapshot.project;
    console.log('[NARRATIVE-CONNECT] Generation snapshot ready:', {
      snapshotId: generationSnapshot.snapshotId,
      chapter: chapter.chapter_number,
      chapters: generationChapters.length,
      foundation: generationProject.__generationContext,
    });

    // BIBLEGATE-1: the bible must be complete and parseable before drafting.
    // Fiction only — nonfiction casts are sources, not characters.
    if (!isNonfictionProjectAuthority(generationProject)) {
      const bibleAudit = auditBibleCompleteness({ project: generationProject, chapters: generationChapters });
      console.log('[BIBLEGATE] draftChapter audit:', JSON.stringify(bibleAudit));
      if (!bibleAudit.ok) {
        const parts = [];
        if (bibleAudit.missing.length) {
          parts.push(`missing entries: ${bibleAudit.missing.map((m) => `${m.name} (${m.mentions}x in outline/beats)`).join(', ')}`);
        }
        if (bibleAudit.malformedHeaders.length) {
          parts.push(`malformed headers: ${bibleAudit.malformedHeaders.map((h) => `"${h.header}" (${h.reason})`).join('; ')}`);
        }
        deps.toast.error(`Story bible incomplete — fix before drafting: ${parts.join(' | ')}`);
        return;
      }
    }

    // When called with onProgress callback (from parallel Draft All), route
    // progress through it to the per-chapter slot. Otherwise use global busyLabel.
    const report = (value) => {
      const safeLabel = formatProgressLabel(value);
      deps.onProgress({ stage: 'report', chapterId: chapter.id, label: safeLabel });
    };
    if (deps.onProgress) {
      console.log(`[DRAFT-CH-${chapter.chapter_number}] draftChapter received onProgress callback`);
    }
    // Anthology: each story is standalone — no previous chapter context
    const isAnthologyDraft = isAnthologyProject(generationProject);
    const previousChapter = isAnthologyDraft ? null : generationSnapshot.previousChapter;
    const resolvedPrev = previousChapter ? { ...previousChapter, content_md: await resolveChapterContent(previousChapter) } : null;
    const draftingProject = { ...buildNameHygieneEnhancedProject(generationProject), __chapters: generationChapters };
    const targetWords = draftingProject.chapter_length_target || draftingProject.target_chapter_words || 3500;
    const minAcceptable = Math.round(targetWords * 0.7);
    // Track generated prose for emergency save if a later step fails
    let emergencyProse = null;
    let emergencyWordCount = 0;
    // Determine which prose model to use (fiction only)
    // Priority: per-chapter override → global default → fallback constant
    const isFiction = !isNonfictionProjectAuthority(draftingProject);
    const globalDefault = normalizeModelId(draftingProject.default_prose_model || deps.settingsDrafts.default_prose_model) || DEFAULT_FICTION_PROSE_MODEL;
    const proseModelOverride = isFiction ? (normalizeModelId(options.modelOverride) || normalizeModelId(deps.chapterProseModels[chapter.id]) || globalDefault) : undefined;
    const fastDraftOnly = options.fastDraftOnly === true;

    try {
    if (options.backupBeforeOverwrite) {
      report(`Backing up chapter ${chapter.chapter_number} before overwrite…`);
      await deps.backupChapterBeforeGeneratedOverwrite(
        chapter,
        options.backupReason || `Before generated overwrite — Ch.${chapter.chapter_number}`
      );
    }

    // Generate scene beats before drafting
    report(`Generating beats for chapter ${chapter.chapter_number}…`);
    const beatsJson = await deps.generateSceneBeats(chapter, generationChapters, generationProject);
    const chapterWithBeats = { ...chapter, scene_beats_json: beatsJson };

    // Get previous chapter tail for continuity
    const previousChapterTail = resolvedPrev?.content_md
      ? resolvedPrev.content_md.split(/\s+/).slice(-2000).join(' ')
      : '';

    // Scene-by-scene generation
    report(`Writing chapter ${chapter.chapter_number} scene by scene…`);
    const isNonfiction = isNonfictionProjectAuthority(draftingProject);

    // ── COVERAGE TRACKER INPUT ──
    // Build compact summaries of every chapter BEFORE this one so the LLM can
    // avoid re-narrating material already covered. Only title + beat_summary,
    // not full content — the prompt should know WHAT was covered, not re-ingest
    // every word. Skip for anthologies (each story is standalone) and for Ch 1
    // (no prior chapters to dedupe against).
    const isAnth = isAnthologyProject(generationProject);
    const priorChapterSummaries = (!isAnth && chapter.chapter_number > 1)
      ? generationChapters
          .filter(c => c && c.chapter_number && c.chapter_number < chapter.chapter_number && isBodyChapter(c))
          .sort((a, b) => a.chapter_number - b.chapter_number)
          .map(c => ({
            chapter_number: c.chapter_number,
            title: c.title || '',
            beat_summary: c.beat_summary || '',
          }))
      : [];

    // BOOKECHO-1: full prose of all PRIOR chapters for the cross-chapter
    // phrase-echo detector in sceneWriter. Resolved sequentially from storage;
    // any failure leaves that chapter out and the detector simply sees less.
    const priorChapterProse = [];
    if (!isAnth && chapter.chapter_number > 1) {
      try {
        const echoPriors = generationChapters
          .filter(c => c && c.chapter_number && c.chapter_number < chapter.chapter_number && isBodyChapter(c))
          .sort((a, b) => a.chapter_number - b.chapter_number);
        for (const pc of echoPriors) {
          try {
            const t = await resolveChapterContent(pc);
            if (typeof t === 'string' && t.length > 500) priorChapterProse.push(t);
          } catch (echoResolveErr) { /* skip this chapter */ }
        }
        console.log(`[BOOKECHO-1] prior chapters resolved for echo check: ${priorChapterProse.length}`);
      } catch (echoPrepErr) { /* detector will skip */ }
    }

    console.log('[DRAFT DEBUG] Calling generateChapterByScenes. Beats parsed:', JSON.parse(chapterWithBeats.scene_beats_json || '{}')?.beats?.length || JSON.parse(chapterWithBeats.scene_beats_json || '{}')?.sections?.length || 0, 'scenes', '| proseModelOverride:', proseModelOverride || 'none', '| coverage summaries:', priorChapterSummaries.length);
    
    // Verify compact parse and before-draft
    const parsedForDraft = typeof chapterWithBeats.scene_beats_json === 'string' ? JSON.parse(chapterWithBeats.scene_beats_json) : chapterWithBeats.scene_beats_json;
    if (parsedForDraft?.pipeline_contract && !isAnthologyProject(generationProject) && !isNonfictionProjectAuthority(generationProject)) {
       verifySceneProvenance(parsedForDraft.beats, parsedForDraft.pipeline_contract, 'before-generateChapterByScenes');
    }

    const sceneExecutionAcceptanceRunners = createSceneExecutionAcceptanceRunners({
      project: draftingProject,
    });

    // LEDGERSCOPE-1: fold every EARLIER chapter's saved ledger into one and hand
    // it to the writer. Without this the ledger was rebuilt empty per chapter, so
    // nothing could stop Ch.4 restoring a hand Ch.3 amputated.
    // ANTHOLOGYBLEED-1: anthology stories are standalone — folding a prior STORY's
    // ledger cross-contaminates casts (foldChapterLedgers canonicalises holder names
    // across all prior ledgers, merging e.g. Story-2 "Marcus" onto Story-5 "Marcus")
    // and injects another story's held-object facts into this story's prompt. The
    // within-story ledger is unaffected: with priorLedger null the writer seeds a
    // fresh buildInitialLedger() per story (sceneWriter.js) and builds scene-to-scene
    // continuity inside the one story exactly as before.
    const priorLedger = isAnth ? null : await buildPriorLedger(project?.id || deps.projectId, chapter.chapter_number);

    const sceneResult = await generateChapterByScenes({
      sceneExecutionAcceptanceRunners,
      project: draftingProject,
      chapter: chapterWithBeats,
      previousChapterTail,
      onProgress: (label) => report(label),
      proseModelOverride,
      priorChapterSummaries,
      priorLedger,
      // BOOKECHO-2: priorChapterProse is intentionally NOT passed here anymore.
      // The scene writer's internal chapter artifact is used for the critic and
      // then discarded; spending the echo-repair LLM call on it was wasted
      // (measured live: every BOOKECHO-1 rewrite was lost). The save path below
      // runs finalizeChapterProse on the joined prose that actually ships.
    });

    console.log('[DRAFT DEBUG] generateChapterByScenes returned. Prose length:', sceneResult?.prose?.length || 0);
    let chapterContent = sceneResult.prose;
    let wordCount = sceneResult.totalWords;
    let cleanResult = sceneResult.cleanResult;

    // Capture generated prose immediately for emergency save
    emergencyProse = chapterContent;
    emergencyWordCount = wordCount;
    deps.pipelineSnapshot(chapter.id, '1-raw-llm-output', chapterContent);

    // v15.2: Nonfiction draft save should stop here.
    // The dedicated nonfiction polish engine handles nonfiction refinement later.
    // Do not run fiction-style judge/retry/postDraftCleanup during initial nonfiction draft save.
    if (isNonfiction) {
      report(`Saving nonfiction chapter ${chapter.chapter_number}; nonfiction polish remains available through Fix/Polish…`);

      const canonRepair = repairCanonNameDrift(chapterContent, { project: draftingProject, chapter, chapters: generationChapters });
      if (canonRepair.changed) {
        console.warn('[CANON-NAME-LOCK][NF-DRAFT-SAVE v15.2] Repaired draft Ch.' + (chapter.chapter_number || '?') + ':', canonRepair.repairs);
        chapterContent = canonRepair.text;
      }

      const hardAliasRepair = forceSongbirdAliasRepairText(chapterContent, { project: draftingProject });
      if (hardAliasRepair.changed) {
        console.warn('[SONGBIRD-HARD-ALIAS][NF-DRAFT-SAVE v15.2] Repaired draft Ch.' + (chapter.chapter_number || '?') + ':', hardAliasRepair.repairs);
        chapterContent = hardAliasRepair.text;
      }

      const artifactRepair = repairManuscriptArtifacts(chapterContent, { project: draftingProject, chapter });
      if (artifactRepair.changed) {
        console.warn('[ARTIFACT-REPAIR][NF-DRAFT-SAVE v15.2] Repaired draft Ch.' + (chapter.chapter_number || '?') + ':', artifactRepair.changes);
        chapterContent = artifactRepair.text;
      }

      const draftQuoteRepair = repairChapterQuotes(chapterContent);
      if (draftQuoteRepair.text !== chapterContent) {
        console.warn('[QUOTE-REPAIR][NF-DRAFT-SAVE v15.2] Repaired draft Ch.' + (chapter.chapter_number || '?') + ' before save:', draftQuoteRepair.fixes);
        chapterContent = draftQuoteRepair.text;
      }

      // DIALOGUEFIX-2: true-last dialogue heal. Every stage between the scene
      // writer and this save (LLM copyedit, artifact repair, quote balancing)
      // has re-broken opening quotes at least once. Heal the class here, at
      // the final mutating step, exactly like sentence-case repair in polish.
      const dmFinalNf = runDialogueMechanicsFinal(chapterContent, { stage: 'pre-save' });
      if (dmFinalNf.text !== chapterContent) {
        console.warn('[DIALOGUE-MECHANICS-REPAIR] Pre-save repairs Ch.' + (chapter.chapter_number || '?') + ': ' + (dmFinalNf.repairs?.length || 0) + ' verb-tag, ' + (dmFinalNf.orphanRepaired || 0) + ' orphan-closer');
        chapterContent = dmFinalNf.text;
      }

      wordCount = countWords(chapterContent);
      const isStub = wordCount < 200;
      const chapterStatus = isStub ? 'error' : 'drafted';
      const qualityScan = runQualityScan(chapterContent, draftingProject, chapter.chapter_number);
      const slopResult = mechanicalSlopScore(chapterContent);
      const finalTense = checkTenseConsistency(chapterContent, draftingProject);
      const finalPov = checkPovConsistency(chapterContent, draftingProject, chapter.chapter_number);
      const totalTenseViolations = finalTense.reduce((sum, v) => sum + (v.count || 0), 0);
      // v15.7: do not inject evidence-ledger/source-audit text into chapter metadata during initial draft save.
      // Source review belongs in a separate audit tool, not in the writer/save path.
      const sourceAuditNotes = [];

      const guard = validateProjectChapterContent({
        project: buildNameHygieneEnhancedProject(draftingProject || {}),
        chapter,
        chapters: generationChapters,
        content: chapterContent,
      });
      if (guard?.shouldBlockSave || guard?.severity === 'warning') {
        console.warn(`[PROJECT-CONTENT-GUARD][NF-WARN-ONLY v15.2] Ch.${chapter?.chapter_number || '?'} nonfiction draft save: guard warned but did not block save.`, guard.report || guard);
      }

      // ── POST-DRAFT SAFETY GATE (nonfiction) ──
      const nfPostDraftGate = runManuscriptSafetyGate(chapterContent, {
        project: draftingProject,
        chapter,
        stage: 'post-draft',
        allowBusinessTerms: true,
      });
      logSafetyGateResult('post-draft-nf', chapter.chapter_number, chapter.title, nfPostDraftGate);
      if (nfPostDraftGate.processLeaks.hasLeak) {
        console.error('[DRAFT-SAFETY-GATE][NF] Ch.' + chapter.chapter_number + ' process leak detected:', nfPostDraftGate.reasons.join('; '));
        // For nonfiction, log and warn but do not block save — process leaks are rarer in NF.
        // The pre-polish gate will catch them before polish runs.
      }

      const revisionNotes = [
        'NONFICTION DRAFT SAVE v15.7: generated draft saved before Fix/Polish. No evidence-ledger source-audit notes injected into manuscript metadata.',
        'Run Fix/Polish to apply the dedicated nonfiction polish engine.',
        `Mechanical slop score: ${slopResult.score}/10`,
        ...sourceAuditNotes,
        ...slopResult.details,
        ...finalTense.map((v) => v.description),
        ...finalPov.map((v) => v.description),
        isStub ? `STUB ERROR: ${wordCount} words. Regenerate required.` : null,
        wordCount < minAcceptable && !isStub
          ? `UNDERWEIGHT: ${wordCount}/${targetWords} words (${Math.round(wordCount / targetWords * 100)}%).`
          : null,
        nfPostDraftGate.processLeaks.hasLeak ? `⚠️ SAFETY GATE: process leaks detected — run Fix/Polish to address.` : null,
      ].filter(Boolean).join('\n');

      console.log(`[PROJECTSTUDIO][NF-DRAFT-SAVE-DEFER-POLISH v15.7] Ch.${chapter.chapter_number}: saving generated nonfiction draft; no evidence-ledger metadata injected.`);

      const contentFields = await prepareChapterContent(chapterContent, project?.id || deps.projectId, chapter.id, chapter);

      const nfSavePayload = {
        title: chapter.title,
        ...clearRichContentFields(),
        content_md_fallback_present: true,
        ...contentFields,
        word_count: wordCount,
        score: isStub ? 0 : Math.min(slopResult.pass ? 8 : 7, 9),
        voice_adherence: null,
        tense_violations: totalTenseViolations,
        slop_score: slopResult.score,
        slop_details: JSON.stringify(slopResult.details),
        revision_notes: revisionNotes,
        quality_scan: qualityScan,
        status: chapterStatus,
        drafted_with_model: sceneResult.actualModelUsed || proseModelOverride || '',
        draft_all_mode: fastDraftOnly ? 'fast' : 'standard',
      };
      const nfVerify = await verifiedChapterSave({
        chapterId: chapter.id,
        savePayload: nfSavePayload,
        writtenContent: chapterContent,
        chapterNumber: chapter.chapter_number,
      });
      if (!nfVerify.ok) {
        throw new Error(`Verified save failed for Ch.${chapter.chapter_number}: ${nfVerify.reason}`);
      }
      await maybeAutoPolishChapter({ project, chapter, content: chapterContent, onProgress: (label) => deps.onProgress({ stage: 'busy-label', chapterId: chapter.id, label }) }); // WAVE5-SETTINGS

      deps.onProgress({ stage: 'chapter-draft-updated', chapterId: chapter.id, content: chapterContent });

      const draftedCount = getDraftedCount(generationChapters);
      const _draftProjectPayload = protectedProjectUpdate({
        chapter_count: chapterStatus === 'drafted' && chapter.status === 'planned' ? draftedCount + 1 : draftedCount,
        status: 'ready',
      });

      await runWithNetworkRetry(() => deps.NovelProject.update(project.id, _draftProjectPayload));

      if (options.shouldRefresh) {
        await deps.refreshAll();
      }

      return {
        chapterId: chapter.id,
        chapterNumber: chapter.chapter_number,
        mode: 'nonfiction-draft-save-defer-polish-v15.7',
        wordCount,
        status: chapterStatus,
        content: chapterContent,
      };
    }

    // If still underweight after scene-by-scene, do one continuation pass
    if (wordCount < minAcceptable && wordCount >= 200) {
      report(`Extending chapter ${chapter.chapter_number} (${wordCount}/${targetWords} words)…`);
      const needed = targetWords - wordCount;
      const lastSentence = chapterContent.trim().split(/[.!?]/).filter(s => s.trim()).pop()?.trim() || '';
      const contPrompt = `${COMPACT_CRAFT_RULES}\n\n${COMPACT_ANTI_SLOP}\n\n${MANDATORY_ENFORCEMENT_BLOCK}\n\n${draftingProject.name_hygiene_prompt_block || ''}\n\nCONTINUE WRITING from exactly where you left off. Match the existing voice, tense (${draftingProject.tense || 'past'}), and POV (${draftingProject.pov_mode || 'third-close'}). Do not repeat any content that already exists. Do not add scene headers or markdown.\n\nHere is the last sentence you wrote: "${lastSentence}"\nYou have written ${wordCount} words. You need at least ${needed} more words. Do not restart. Do not summarize. Continue with NEW scenes, NEW dialogue, NEW action. Write at least ${needed} words.`;
      const contResponse = await deps.invokeLLMWithRetry({
        task_type: 'prose',
        prompt: contPrompt,
        response_json_schema: chapterSchema,
        // WAVE5-MODELPICKER: honor the chapter's model override for the top-up
        // continuation too — a chapter should never be drafted by model A and
        // extended by model B.
        model: proseModelOverride || pickModel('prose_continuation', draftingProject),
        spec: draftingProject,
        ...buildFallbackControls('prose_continuation', draftingProject),
      });
      const cont = unwrapIntegrationResult(contResponse);
      if (cont?.content_md && cont.content_md.trim().length > 100) {
        chapterContent = chapterContent.trim() + '\n\n' + cont.content_md.trim();
        cleanResult = cleanGeneratedProse(chapterContent, { targetWords });
        chapterContent = cleanResult.text;
        wordCount = countWords(chapterContent);
      }
      deps.pipelineSnapshot(chapter.id, '2-after-continuation', chapterContent);
    }

    if (fastDraftOnly) {
      report(`Fast-saving chapter ${chapter.chapter_number} without judge/revision/copyedit…`);
      deps.pipelineSnapshot(chapter.id, '3-fast-save-point', chapterContent);

      // ── POST-DRAFT SAFETY GATE ──
      // Check for process leakage and contamination BEFORE saving.
      // Bad input must be quarantined before repair transforms because repair
      // transforms can create grammar regressions when applied to editorial/process text.
      const postDraftGate = runManuscriptSafetyGate(chapterContent, {
        project: draftingProject,
        chapter,
        stage: 'post-draft',
      });
      logSafetyGateResult('post-draft', chapter.chapter_number, chapter.title, postDraftGate);
      storeSafetyReport('post-draft', [{ chapterNumber: chapter.chapter_number, title: chapter.title, ok: postDraftGate.ok, action: postDraftGate.recommendedAction, processLeaks: postDraftGate.processLeaks.matches.length, contamination: postDraftGate.contamination.matches.length, malformed: postDraftGate.malformed.matches.length, reasons: postDraftGate.reasons }]);

      if (!postDraftGate.ok) {
        console.error('[DRAFT-SAFETY-GATE] Ch.' + chapter.chapter_number + ' FAILED:', postDraftGate.reasons.join('; '));

        // Do not save process-leaked or contaminated content over prior clean content.
        // The user should regenerate this chapter individually.
        report(`⚠️ Ch.${chapter.chapter_number}: SAFETY GATE REJECTED — ${postDraftGate.recommendedAction}. ` +
          `Reasons: ${postDraftGate.reasons.join('; ')}. Chapter NOT saved. Regenerate this chapter.`);

        return {
          chapterId: chapter.id,
          chapterNumber: chapter.chapter_number,
          mode: 'fast',
          wordCount: 0,
          status: 'error',
          safetyGateFailed: true,
          reasons: postDraftGate.reasons,
        };
      }

      const finalSlop = mechanicalSlopScore(chapterContent);
      const finalTense = checkTenseConsistency(chapterContent, draftingProject);
      const finalPov = checkPovConsistency(chapterContent, draftingProject, chapter.chapter_number);
      const totalTenseViolations = finalTense.reduce((sum, v) => sum + (v.count || 0), 0);
      const isStub = wordCount < 200;
      const chapterStatus = isStub ? 'error' : 'drafted';
      const qualityScan = runQualityScan(chapterContent, draftingProject, chapter.chapter_number);

      const fastRevisionNotes = [
        'FAST DRAFT ALL MODE: generated and saved without judge/revision/post-draft cleanup.',
        'Run Fix Manuscript / Polish afterward for copyediting, survivor repairs, punctuation cleanup, and manuscript-level polish.',
        `Mechanical slop score: ${finalSlop.score}/10`,
        ...finalSlop.details,
        ...finalTense.map((v) => v.description),
        ...finalPov.map((v) => v.description),
        isStub ? `STUB ERROR: ${wordCount} words. Regenerate required.` : null,
        wordCount < minAcceptable && !isStub
          ? `UNDERWEIGHT: ${wordCount}/${targetWords} words (${Math.round(wordCount / targetWords * 100)}%).`
          : null,
      ].filter(Boolean).join('\n');

      deps.runProjectContentGuardBeforeSave(chapter, chapterContent, 'fast draft');

      const contentFields = await prepareChapterContent(chapterContent, project?.id || deps.projectId, chapter.id, chapter);

      const fastSavePayload = {
        title: chapter.title,
        ...clearRichContentFields(),
        content_md_fallback_present: true,
        ...contentFields,
        word_count: wordCount,
        score: isStub ? 0 : Math.min(finalSlop.pass ? 8 : 7, 9),
        voice_adherence: null,
        tense_violations: totalTenseViolations,
        slop_score: finalSlop.score,
        slop_details: JSON.stringify(finalSlop.details),
        revision_notes: fastRevisionNotes,
        quality_scan: qualityScan,
        status: chapterStatus,
        drafted_with_model: sceneResult.actualModelUsed || proseModelOverride || '',
        draft_all_mode: 'fast',
        // NAMEREG-1: persist the names this story's finished prose actually used, so later
        // anthology stories can ban and de-collide against them (rename targets included).
        ...(Array.isArray(sceneResult.anthologyProseNames) && sceneResult.anthologyProseNames.length
          ? { prose_names: JSON.stringify(sceneResult.anthologyProseNames) }
          : {}),
      };
      const fastVerify = await verifiedChapterSave({
        chapterId: chapter.id,
        savePayload: fastSavePayload,
        writtenContent: chapterContent,
        chapterNumber: chapter.chapter_number,
      });
      if (!fastVerify.ok) {
        throw new Error(`Verified save failed for Ch.${chapter.chapter_number}: ${fastVerify.reason}`);
      }
      await maybeAutoPolishChapter({ project, chapter, content: chapterContent, onProgress: (label) => deps.onProgress({ stage: 'busy-label', chapterId: chapter.id, label }) }); // WAVE5-SETTINGS

      deps.onProgress({ stage: 'chapter-draft-updated', chapterId: chapter.id, content: chapterContent });

      const draftedCount = getDraftedCount(generationChapters);
      const _draftProjectPayload = protectedProjectUpdate({
        chapter_count: chapterStatus === 'drafted' && chapter.status === 'planned' ? draftedCount + 1 : draftedCount,
        status: 'ready',
      });

      await runWithNetworkRetry(() => deps.NovelProject.update(project.id, _draftProjectPayload));

      if (options.shouldRefresh) {
        await deps.refreshAll();
      }

      return {
        chapterId: chapter.id,
        chapterNumber: chapter.chapter_number,
        mode: 'fast',
        wordCount,
        status: chapterStatus,
        content: chapterContent,
      };
    }

    // Quality evaluation (judge, slop, tense, POV)
    report(`Evaluating chapter ${chapter.chapter_number}…`);
    const sourceAuditNotes = []; // defined here so it's always in scope for retry feedback
    const slopResult = mechanicalSlopScore(chapterContent);
    const tenseViolations = checkTenseConsistency(chapterContent, project);
    const povViolations = checkPovConsistency(chapterContent, project, chapter.chapter_number);
    const judgeResponse = await deps.invokeLLMWithRetry({
      task_type: 'critique',
      prompt: buildChapterJudgePrompt(project, chapter, chapterContent, [...tenseViolations, ...povViolations]),
      response_json_schema: chapterJudgeSchema,
      model: pickModel('judge', project),
      spec: project,
      fallback_model: pickFallbackModel('judge', project),
    });
    const judge = unwrapIntegrationResult(judgeResponse);
    const judgeContractComplete =
      Number.isFinite(Number(judge?.narrative_contract_adherence)) &&
      Number.isFinite(Number(judge?.continuity_integrity)) &&
      Array.isArray(judge?.contract_violations) &&
      Array.isArray(judge?.process_leaks);

    // The LLM critic is advisory. Deterministic scene/project gates remain authoritative.
    // Do not rewrite a structurally valid chapter merely because the critic assigned 7/10
    // or produced uncertain language such as "may be a violation".
    
    const concreteJudgeContractViolations = Array.isArray(judge?.contract_violations)
      ? filterConcreteCriticFindings(judge.contract_violations, sceneResult?.generatedScenes)
      : [];

    const concreteJudgeProcessLeaks = Array.isArray(judge?.process_leaks)
      ? filterConcreteCriticFindings(judge.process_leaks, sceneResult?.generatedScenes)
      : [];

    // Scores below 8 are revision notes, not hard rewrite triggers.
    const needsRetry = !slopResult.pass
      || judge.voice_adherence < 5
      || concreteJudgeContractViolations.length > 0
      || concreteJudgeProcessLeaks.length > 0
      || tenseViolations.some((v) => v.severity === 'critical')
      || povViolations.some((v) => v.severity === 'critical')
      || wordCount < minAcceptable;

    const preJudgeRewriteContent = chapterContent;
    const preJudgeRewriteWordCount = wordCount;
    const preJudgeRewriteCleanResult = cleanResult;
    // CRITFIX-1: tracks whether a judge rewrite actually replaced the draft.
    // Re-judging is only meaningful when the text changed.
    let judgeRewriteApplied = false;

    // Full chapter judge rewrites are disabled.
    // The original draft was generated scene-by-scene through deterministic
    // chronology/state gates. A second complete generation can replay events
    // and overwrite that safer draft. The critic remains advisory, while
    // concrete final contract violations still hard-block below.
    const allowJudgeFullRewrite = false;

    if (needsRetry && allowJudgeFullRewrite) {
      const judgeIssues = Array.isArray(judge?.issues) ? judge.issues : [];
      const retryFeedback = [
        ...tenseViolations.map((v) => v.description),
        ...povViolations.map((v) => v.description),
        ...judgeIssues,
        ...concreteJudgeContractViolations,
        ...concreteJudgeProcessLeaks,
        `Mechanical slop score: ${slopResult.score}/10`,
        ...sourceAuditNotes,
        ...slopResult.details,
        wordCount < minAcceptable
          ? `CRITICAL: Chapter is only ${wordCount} words. Target is ${targetWords}. Minimum ${minAcceptable} words.`
          : null,
        cleanResult.overusedWords?.length
          ? `REPETITION: ${cleanResult.overusedWords.map((w) => `"${w.word}" (${w.count}x)`).join(', ')}`
          : null,
        'Rewrite to fully obey POV mode and tense.',
      ].filter(Boolean).join('\n');

      report(`Revising chapter ${chapter.chapter_number}…`);
      // Retry as scene-by-scene again with feedback injected
      const retryResult = await generateChapterByScenes({
        sceneExecutionAcceptanceRunners,
        project,
        chapter: chapterWithBeats,
        previousChapterTail,
        onProgress: (label) => report(label),
        proseModelOverride,
        priorChapterSummaries,
        revisionFeedback: retryFeedback,
      });
      const rewrittenContent = retryResult.prose;
      const rewrittenWordCount = retryResult.totalWords;
      const rewrittenCleanResult = retryResult.cleanResult;

      let acceptJudgeRewrite = true;

      try {
        assertNarrativeTextClean(rewrittenContent, {
          chapterNumber: chapter.chapter_number,
        });

        deps.runProjectContentGuardBeforeSave(
          chapter,
          rewrittenContent,
          'judge-rewrite'
        );

        const restartSignals = [
          /(?:^|\n)\s*\*\s*(?:\n|$)/g,
          /\b(?:reached|arrived at|stood before|returned to) the archive\b/gi,
          /\b(?:opened|unlocked|turned the key in) the archive(?: door)?\b/gi,
          /\b(?:broke|snapped|destroyed|dropped) the (?:brass )?key\b/gi,
        ];

        const restartCounts = restartSignals.map((pattern) => (
          rewrittenContent.match(pattern) || []
        ).length);

        const repeatedArchiveEntry =
          restartCounts[1] > 1 || restartCounts[2] > 1;

        const repeatedKeyResolution =
          restartCounts[3] > 1;

        if (repeatedArchiveEntry || repeatedKeyResolution) {
          const reasons = [
            repeatedArchiveEntry
              ? 'archive entry/opening event repeated'
              : null,
            repeatedKeyResolution
              ? 'key resolution event repeated'
              : null,
          ].filter(Boolean);

          const error = new Error(
            `Judge rewrite introduced a chronology restart: ${reasons.join('; ')}`
          );
          error.name = 'NarrativeInvariantError';
          error.code = 'JUDGE_REWRITE_CHRONOLOGY_RESTART';
          error.narrativeContract = true;
          throw error;
        }
      } catch (rewriteAuditError) {
        acceptJudgeRewrite = false;
        console.error(
          `[NARRATIVE-CONNECT] Rejecting unsafe judge rewrite for Ch.${chapter.chapter_number}; preserving original scene-audited draft:`,
          rewriteAuditError?.message || rewriteAuditError
        );
      }

      if (acceptJudgeRewrite) {
        chapterContent = rewrittenContent;
        wordCount = rewrittenWordCount;
        cleanResult = rewrittenCleanResult;
        judgeRewriteApplied = true;
      } else {
        chapterContent = preJudgeRewriteContent;
        wordCount = preJudgeRewriteWordCount;
        cleanResult = preJudgeRewriteCleanResult;
      }
    }
    if (needsRetry && !allowJudgeFullRewrite) {
      console.warn(
        `[NARRATIVE-CONNECT] Ch.${chapter.chapter_number}: critic requested revision, ` +
        `but destructive full-chapter rewrite was skipped; preserving scene-audited draft.`
      );
    }

    deps.pipelineSnapshot(chapter.id, '4-after-judge-revision', chapterContent);

    // Finalize scores and save
    const finalSlop = needsRetry ? mechanicalSlopScore(chapterContent) : slopResult;
    const finalTense = needsRetry ? checkTenseConsistency(chapterContent, project) : tenseViolations;
    const finalPov = needsRetry ? checkPovConsistency(chapterContent, project, chapter.chapter_number) : povViolations;
    // CRITFIX-1: with the full-chapter rewrite disabled (or rejected), the
    // draft is byte-identical to what the critic already judged. Re-judging
    // identical input costs 23-60s per chapter and gives a nondeterministic
    // second verdict on the same bytes. Reuse the first judgment instead.
    const finalJudge = (needsRetry && judgeRewriteApplied) ? unwrapIntegrationResult(await deps.invokeLLMWithRetry({
      task_type: 'critique',
      prompt: buildChapterJudgePrompt(project, chapter, chapterContent, [...finalTense, ...finalPov]),
      response_json_schema: chapterJudgeSchema,
      model: pickModel('judge', project),
      spec: project,
      fallback_model: pickFallbackModel('judge', project),
    })) : judge;

    const judgeIssues = Array.isArray(finalJudge?.issues) ? finalJudge.issues : [];
    const finalContractViolations = Array.isArray(finalJudge?.contract_violations) ? finalJudge.contract_violations : [];
    const finalProcessLeaks = Array.isArray(finalJudge?.process_leaks) ? finalJudge.process_leaks : [];

    const finalConcreteContractViolations =
      filterConcreteCriticFindings(finalContractViolations, sceneResult?.generatedScenes);

    const finalConcreteProcessLeaks =
      filterConcreteCriticFindings(finalProcessLeaks, sceneResult?.generatedScenes);

    // Only concrete, explicit critic findings may hard-block here.
    // Numeric critic scores and omitted critic fields are advisory because
    // deterministic scene, continuity, contamination, and safety gates already ran.
    if (
      finalConcreteContractViolations.length > 0 ||
      finalConcreteProcessLeaks.length > 0
    ) {
      const error = new Error(
        `Chapter ${chapter.chapter_number} rejected after its one contract-aware rewrite: ${[
          ...finalConcreteContractViolations,
          ...finalConcreteProcessLeaks,
        ].filter(Boolean).slice(0, 8).join('; ')}`
      );
      error.name = 'NarrativeInvariantError';
      error.code = 'NARRATIVE_CONTRACT_UNRESOLVED';
      error.narrativeContract = true;
      error.contractViolations = finalConcreteContractViolations;
      error.processLeaks = finalConcreteProcessLeaks;
      throw error;
    }

    if (
      Number(finalJudge?.narrative_contract_adherence) < 8 ||
      Number(finalJudge?.continuity_integrity) < 8
    ) {
      console.warn(
        `[NARRATIVE-CRITIC][ADVISORY] Ch.${chapter.chapter_number}: ` +
        `contract=${finalJudge?.narrative_contract_adherence ?? 'n/a'}/10, ` +
        `continuity=${finalJudge?.continuity_integrity ?? 'n/a'}/10. ` +
        `Deterministic gates passed, so the chapter will not be discarded.`
      );
    }
    const isStub = wordCount < 200;
    const combinedRevisionNotes = [
      ...finalTense.map((v) => v.description),
      ...finalPov.map((v) => v.description),
      ...judgeIssues,
      `Mechanical slop score: ${finalSlop.score}/10`,
      ...finalSlop.details,
      ...(cleanResult.frequencyWarnings || []),
      finalJudge.voice_adherence < 5 ? 'Auto-flag: voice adherence below threshold.' : null,
      !finalSlop.pass ? 'Auto-flag: mechanical slop score below threshold.' : null,
      isStub ? `STUB ERROR: ${wordCount} words. Regenerate required.` : null,
      wordCount < minAcceptable && !isStub
        ? `UNDERWEIGHT: ${wordCount}/${targetWords} words (${Math.round(wordCount / targetWords * 100)}%).`
        : null,
    ].filter(Boolean).join('\n');

    const totalTenseViolations = finalTense.reduce((sum, v) => sum + (v.count || 0), 0);
    const chapterStatus = isStub ? 'error' : 'drafted';
    const qualityScan = runQualityScan(chapterContent, project, chapter.chapter_number);

    let finalDmOrphans = 0;
    let finalDmManualReview = 0;

    if (sceneResult?.generatedScenes && Array.isArray(sceneResult.generatedScenes)) {
      sceneResult.generatedScenes.forEach((sc, idx) => {
        console.log(`[STRUCTURED-SCENES] sceneId=${sc.sceneId || 'none'} acceptedProseChars=${sc.acceptedProse?.length || 0}`);
        
        if (!sc.acceptedProse) {
          const err = new Error(`Scene ${idx + 1} is missing acceptedProse`);
          err.name = 'NarrativeInvariantError';
          err.code = 'STRUCTURED_SCENE_PROSE_MISSING';
          err.sceneId = sc.sceneId;
          err.narrativeContract = true;
          throw err;
        }
      });

      // Per-scene cleanup
      for (let i = 0; i < sceneResult.generatedScenes.length; i++) {
        let sceneProse = sceneResult.generatedScenes[i].acceptedProse || '';
        
        const cleanup = await postDraftCleanup(sceneProse, project, chapter.chapter_number, report);
        sceneProse = cleanup.text;

        const canonRepair = repairCanonNameDrift(sceneProse, { project: generationProject, chapter, chapters: generationChapters });
        if (canonRepair.changed) sceneProse = canonRepair.text;

        const hardAliasRepair = forceSongbirdAliasRepairText(sceneProse, { project });
        if (hardAliasRepair.changed) sceneProse = hardAliasRepair.text;

        const artifactRepair = repairManuscriptArtifacts(sceneProse, { project, chapter });
        if (artifactRepair.changed) sceneProse = artifactRepair.text;

        const draftQuoteRepair = repairChapterQuotes(sceneProse);
        if (draftQuoteRepair.text !== sceneProse) sceneProse = draftQuoteRepair.text;

        // PARABREAK-1: split a collapsed multi-speaker paragraph into one turn per
        // paragraph BEFORE the line-oriented repairers run. Live Ch.5 shipped a
        // 748-word paragraph whose four "ambiguous orphan closers" were all dropped
        // OPENING quotes that the healer could not attribute inside a block that size.
        const dmFinal = runDialogueMechanicsFinal(sceneProse, { stage: 'pre-save', splitCollapsedParagraphs: true });
        if (dmFinal.text !== sceneProse) sceneProse = dmFinal.text;
        
        finalDmOrphans += (dmFinal.orphanFlagged || 0);
        finalDmManualReview += (dmFinal.manualReview?.length || 0);

        sceneResult.generatedScenes[i].acceptedProse = sceneProse;
      }

      // DIALOGUEPOLICY-1: report malformed dialogue, do not destroy the chapter.
      //
      // Live Ch.3: the repairer found and fixed 15 missing opening quotes, then left
      // TWO ambiguous orphan closers it could not attribute with confidence — and a
      // finished 4,141-word chapter was thrown away over them. A stray quotation mark
      // is a copy-editing defect. It cannot fabricate a fact, and unlike the writer,
      // the gate cannot tell which line the quote belongs to. Surface it and let the
      // writer decide; a chapter on the page can be fixed, a discarded one cannot.
      if (finalDmOrphans > 0 || finalDmManualReview > 0) {
        console.warn(
          `[DIALOGUE-ADVISORY] Ch.${chapter.chapter_number}: unresolved malformed dialogue was NOT enforced ` +
          `(orphans: ${finalDmOrphans}, manual review: ${finalDmManualReview}). ` +
          `The chapter was saved; proofread its quotation marks.`
        );
      }

      // Final audit
      if (typeof window !== 'undefined') {
        const { auditChapterLedgerContinuity } = await import('@/lib/sceneContractGate');
        const { buildInitialLedger, extractSceneLedgerUpdates } = await import('@/lib/narrativeLedger');
        
        try {
          const cleanedScenes = sceneResult.generatedScenes.map(s => s.acceptedProse);
          auditChapterLedgerContinuity({ generatedScenes: sceneResult.generatedScenes, cleanedScenes }, buildInitialLedger, extractSceneLedgerUpdates);
        } catch (auditError) {
          if (auditError.name === 'NarrativeInvariantError') {
            console.error('[NARRATIVE-CONNECT] Final chapter-level continuity audit failed after cleanup:', auditError);
            throw auditError;
          }
        }
      }

      // Join after successful audit
      chapterContent = sceneResult.generatedScenes
        .map(s => s.acceptedProse)
        .filter(Boolean)
        .join('\n\n* * *\n\n');

      // BOOKECHO-2: THIS join is the artifact that gets saved — the chapter-level
      // dedupers and the cross-chapter echo repair used to run only on the scene
      // writer's internal artifact, which the save path discards (live ch.5
      // shipped a verbatim duplicated opening in scenes 1 and 3, and all 19
      // measured BOOKECHO-1 rewrites were lost). Run the final passes here, on
      // the prose that ships. Fail open: the chapter saves either way.
      try {
        chapterContent = await finalizeChapterProse(chapterContent, draftingProject, priorChapterProse);
      } catch (echoFinalizeErr) {
        console.warn('[BOOKECHO-2] finalize failed open; chapter saved without final passes:', echoFinalizeErr?.message || echoFinalizeErr);
      }

    } else {
      // Fallback for non-structured text (e.g. earlier pipeline steps)
      const cleanup = await postDraftCleanup(chapterContent, project, chapter.chapter_number, report);
      chapterContent = cleanup.text;
      
      const canonRepair = repairCanonNameDrift(chapterContent, { project: generationProject, chapter, chapters: generationChapters });
      if (canonRepair.changed) chapterContent = canonRepair.text;

      const hardAliasRepair = forceSongbirdAliasRepairText(chapterContent, { project });
      if (hardAliasRepair.changed) chapterContent = hardAliasRepair.text;

      const artifactRepair = repairManuscriptArtifacts(chapterContent, { project, chapter });
      if (artifactRepair.changed) chapterContent = artifactRepair.text;

      const draftQuoteRepair = repairChapterQuotes(chapterContent);
      if (draftQuoteRepair.text !== chapterContent) chapterContent = draftQuoteRepair.text;

      // PARABREAK-1: same treatment on the non-structured fallback path.
      const dmFinal = runDialogueMechanicsFinal(chapterContent, { stage: 'pre-save', splitCollapsedParagraphs: true });
      if (dmFinal.text !== chapterContent) chapterContent = dmFinal.text;

      // DIALOGUEPOLICY-1: same policy on the non-structured fallback path — report,
      // do not destroy. A stray quotation mark is a copy-editing defect.
      if (dmFinal.orphanFlagged > 0 || (dmFinal.manualReview && dmFinal.manualReview.length > 0)) {
        console.warn(
          `[DIALOGUE-ADVISORY] Ch.${chapter.chapter_number}: unresolved malformed dialogue was NOT enforced ` +
          `(orphans: ${dmFinal.orphanFlagged}, manual review: ${dmFinal.manualReview?.length}). ` +
          `The chapter was saved; proofread its quotation marks.`
        );
      }
    }

    if (chapterContent.includes('<<<SCENE_BOUNDARY>>>')) {
      const error = new Error(`Chapter ${chapter.chapter_number} contains internal scene boundary sentinel leakage.`);
      error.name = 'NarrativeInvariantError';
      error.code = 'INTERNAL_SCENE_SENTINEL_LEAK';
      error.narrativeContract = true;
      throw error;
    }

    // DRAFTSAVE-1: a draft that came out with straight quotes (live REDUX ch.3
    // redraft: 0 curly / 265 straight) enters storage typography-normalized,
    // so every downstream gate and ledger sees the same quote alphabet.
    // Character-for-character glyph swap only — QUOTENORM-1 invariants hold.
    if ((chapterContent.match(/"/g) || []).length > 10) {
      const draftQuoteNorm = normalizeSmartQuotesOnly(chapterContent);
      if (draftQuoteNorm.changed > 0) {
        chapterContent = draftQuoteNorm.text;
        console.log(`[DRAFTSAVE-1] Ch.${chapter.chapter_number}: normalized ${draftQuoteNorm.changed} straight quote(s) before save.`);
      }
    }

    wordCount = countWords(chapterContent);
    assertNarrativeTextClean(chapterContent, { chapterNumber: chapter.chapter_number });
    deps.runProjectContentGuardBeforeSave(chapter, chapterContent, 'draft');
    
    deps.pipelineSnapshot(chapter.id, '8-final-save', chapterContent);

    // LEDGERSCOPE-1: persist this chapter's end state so the NEXT chapter can see
    // it. Deliberately awaited but never allowed to throw - a failed ledger write
    // must not cost a drafted chapter.
    // ANTHOLOGYBLEED-1: never persist an anthology story's ledger — nothing may
    // fold it into a sibling story. priorLedger is already null for anthology above;
    // this is defense in depth so a saved ledger cannot leak even if the fold guard
    // regresses.
    if (sceneResult?.narrativeLedger && !isAnth) {
      await saveChapterLedger(chapter.id, sceneResult.narrativeLedger, chapter.chapter_number);
    }
    const contentFields = await prepareChapterContent(chapterContent, project?.id || deps.projectId, chapter.id, chapter);

    const stdSavePayload = {
      title: chapter.title,
      ...clearRichContentFields(),
      content_md_fallback_present: true,
      ...contentFields,
      word_count: wordCount,
      score: isStub ? 0 : Math.min(finalJudge.overall || 7, 9.5),
      voice_adherence: finalJudge.voice_adherence,
      tense_violations: totalTenseViolations,
      slop_score: finalSlop.score,
      slop_details: JSON.stringify(finalSlop.details),
      revision_notes: combinedRevisionNotes,
      quality_scan: qualityScan,
      status: chapterStatus,
      drafted_with_model: sceneResult.actualModelUsed || proseModelOverride || '',
    };
    const stdVerify = await verifiedChapterSave({
      chapterId: chapter.id,
      savePayload: stdSavePayload,
      writtenContent: chapterContent,
      chapterNumber: chapter.chapter_number,
    });
    if (!stdVerify.ok) {
      throw new Error(`Verified save failed for Ch.${chapter.chapter_number}: ${stdVerify.reason}`);
    }
    await maybeAutoPolishChapter({ project, chapter, content: chapterContent, onProgress: (label) => deps.onProgress({ stage: 'busy-label', chapterId: chapter.id, label }) }); // WAVE5-SETTINGS

    // Immediately update the draft textarea if this is the selected chapter
    deps.onProgress({ stage: 'chapter-draft-updated', chapterId: chapter.id, content: chapterContent });

    const draftedCount = getDraftedCount(generationChapters);
    const _draftProjectPayload = protectedProjectUpdate({
      chapter_count: chapterStatus === 'drafted' && chapter.status === 'planned' ? draftedCount + 1 : draftedCount,
      status: 'ready',
    });

    await runWithNetworkRetry(() => deps.NovelProject.update(project.id, _draftProjectPayload));

    if (options.shouldRefresh) {
      await deps.refreshAll();
    }

    return {
      chapterId: chapter.id,
      chapterNumber: chapter.chapter_number,
      mode: 'deluxe',
      wordCount,
      status: chapterStatus,
      content: chapterContent,
    };
    } catch (draftError) {
      // Emergency save: if prose was generated but a later step failed, save what we have.
      if (draftError) {
        const shouldBlockEmergencySave = (error) => {
          if (!error) return false;
          if (error.name === 'NarrativeInvariantError') return true;
          if (error.narrativeContract === true) return true;
          if (error.details?.narrativeContract === true) return true;
          
          const code = error.code || error.details?.code;
          if (!code) return false;

          if (code === 'FINAL_CHAPTER_CONTINUITY_AUDIT_UNAVAILABLE') return true;
          if (code === 'SCENE_STATE_CONTRACT_UNRESOLVED') return true;
          if (code === 'SCENE_DUPLICATE_UNRESOLVED') return true;
          if (code === 'MALFORMED_DIALOGUE_UNRESOLVED') return true;
          if (code === 'OBJECT_POSSESSION_VIOLATION') return true;
          if (code === 'EVIDENCE_AVAILABILITY_VIOLATION') return true;
          if (code.startsWith('NARRATIVE_')) return true;
          if (code.startsWith('SCENE_')) return true;
          if (code.startsWith('FINAL_CHAPTER_')) return true;
          if (code === 'INTERNAL_SCENE_SENTINEL_LEAK') return true;
          return false;
        };

        if (draftError?.projectContentGuard || shouldBlockEmergencySave(draftError)) {
          console.error('[DRAFT-GUARD] Emergency save skipped because generated content violated a hard contract:', draftError?.guard || draftError?.message);
          throw draftError;
        }
      }

      if (emergencyProse && emergencyWordCount >= 200) {
        console.warn(`[EMERGENCY SAVE] draftChapter Ch.${chapter.chapter_number}: saving ${emergencyWordCount} words despite error.`);
        try {
          const emergencyFields = await prepareChapterContent(emergencyProse, project?.id || deps.projectId, chapter.id, chapter);
          await runWithNetworkRetry(() => deps.Chapter.update(chapter.id, {
            ...clearRichContentFields(),
            content_md_fallback_present: true,
            ...emergencyFields,
            word_count: emergencyWordCount,
            status: 'drafted',
            revision_notes: `Emergency save — post-generation step failed: ${draftError.message || 'Unknown error'}`,
          }));
          deps.onProgress({ stage: 'chapter-draft-updated', chapterId: chapter.id, content: emergencyProse });
        } catch (saveErr) {
          console.error(`[EMERGENCY SAVE] Also failed for Ch.${chapter.chapter_number}:`, saveErr);
        }
      }
      throw draftError;
    }
}
