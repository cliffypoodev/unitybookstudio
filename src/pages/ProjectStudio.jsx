import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { countParagraphs, verifySaveParagraphMatch, countRangeRemovals, sumQuarantineRemovals } from '../lib/structureUtils.js';
import { base44 } from '@/api/base44Client';
import ChapterQueue from '@/components/novel/ChapterQueue';
import DraftIntegrityBanner from '@/components/novel/DraftIntegrityBanner';
import OutlineEditor from '@/components/novel/OutlineEditor';
import ExportTab from '@/components/publishing/ExportTab';
import ReviewChapterList from '@/components/review/ReviewChapterList';
import ManuscriptDashboard from '@/components/review/ManuscriptDashboard';

import { searchWeb } from '@/lib/localLLM';
import { buildResearchQueries, extractFocusTerms, rankFetchCandidates } from '@/lib/researchQueryBuilder';

import HomeDashboard from '@/components/novel/HomeDashboard';
import StudioOverview from '@/components/novel/StudioOverview';
import FoundationTab from '@/components/notebook/FoundationTab';
import CoverCreator from '@/components/cover/CoverCreator';
import PreviewTab from '@/components/publishing/PreviewTab';
import ToolsTab from '@/components/tools/ToolsTab';

import NotebookShell from '@/components/notebook/NotebookShell';
import SetupTab from '@/components/notebook/SetupTab';
import SaveIndicator from '@/components/notebook/SaveIndicator';
import UndoButton from '@/components/notebook/UndoButton';
import useAutoSave from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/button';
import { applyGenreDefaults, buildChapterPlanPrompt, buildChapterPrompt, buildChapterReviewPrompt, buildCoverPrompt, buildEvaluationPrompt, buildExpandSettingsPrompt, buildExpandFoundationPrompt, buildFoundationPrompt, buildSceneBeatPrompt, CHAPTER_LENGTH_PRESETS, chapterPlanSchema, chapterReviewSchema, computeTotalWordTarget, countWords, createInitialProjectSettings, evaluationSchema, expandSettingsSchema, expandFoundationSchema, foundationSchema, sceneBeatSchema, getSceneBeatSchema, unwrapIntegrationResult } from '@/lib/autonovel';
import { invokeLLMWithRetry, invokeResearchLLM, generateImageWithRetry } from '@/lib/integrationRetry';
// NARRATIVE-CONNECT-3: the beat planner needs the same prior-chapter coverage
// memory the prose writer already uses, otherwise it re-plans events that
// earlier chapters already consumed.
import { buildRollingContext } from '@/lib/chapterCohesion';
import { parseTwistsToMd } from '@/lib/plotTwists';
import { suggestPovTense } from '@/lib/povTense';
import { calculateManuscriptStats, calculateManuscriptStatsNonfiction, isNonfictionProject, isComedyProject } from '@/lib/manuscriptStats';
// runNonfictionPolish is now handled by runManuscriptPolishPipeline({ mode: 'nonfiction' })
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { prepareChapterContent, resolveChapterContent, chapterHasContent, prepareBackupContent, resolveBackupContent, chapterHasBackup, chapterHasPreviousVersion, findImmediatelyOlderVersion } from '@/lib/chapterStorage';
import { getSetting } from '@/lib/settingsRead'; // WAVE5-SETTINGS
import { maybeFinalCheckAfterPolish } from '@/lib/autoPolishHook'; // WAVE5-SETTINGS
import { computeDraftIntegrityReport } from '@/lib/draftIntegrityReport';
import { clearRichContentFields } from '@/lib/richContentStorage';
import { mechanicalScore } from '@/lib/mechanicalScore';
import { validateProjectChapterContent, makeProjectContentGuardError, stripProjectContaminationBlocks } from '@/lib/projectContentGuard';
import { repairLoadedManuscriptArtifacts } from '@/lib/manuscriptArtifactRepair';
import { postDraftCleanup } from '@/lib/postDraftCleanup';
import { snapshot as pipelineSnapshot } from '@/lib/pipelineDiag';
import { runChapterDraft } from '@/lib/chapterOrchestrator';
import '@/lib/pipelineValidator';
import { detectProtagonistPronouns } from '@/lib/postClean';
import { generateBibliography, saveBibliographyChapter, isBodyChapter } from '@/lib/bibliographyGenerator';
import { buildCopyrightText, saveCopyrightChapter } from '@/lib/copyrightGenerator';
import { enforceChapterCount } from '@/lib/setupConstraints';
import { clearAndCreateChapters } from '@/lib/chapterCreator';
import { repairTruncatedChapters } from '@/lib/chapterRepair';
import { runExternalAiPatternFix } from '@/lib/externalAiPatterns';
import { fixHangingQuotes } from '@/lib/quoteFixPolish';
import { runAiDetectionResistance } from '@/lib/aiDetectionResist';
import { runAntiDetectionPolish } from '@/lib/antiDetectionPolish';
import { isAnthologyProject, buildAnthologyBiblePrompt, anthologyBibleSchema, parseAnthologyBible, storiesToChapterPlans, buildAnthologyStoryContext } from '@/lib/anthologyEngine';
import { generateAnthologyOutlinesBatched, rebuildAnthologyOutlineMd, hasInvalidAnthologyStories } from '@/lib/anthologyBatchOutline';
import { resolveResearchContent, prepareResearchContent, checkResearchIntegrity, shouldRunReResearch, snapshotResearchBeforeReResearch } from '@/lib/researchStorage';
import { researchCoverageCheck } from '@/lib/researchCoverage';
import { buildIdeaProjectFields } from '@/lib/ideaInjection';
import { prepareFoundationPayload, resolveAllFoundationFields } from '@/lib/foundationStorage';
import { selectFateSentences, formatFateNotes, figuresNeedingFates } from '@/lib/fateEnrichment'; // RESEARCHQUALITY-2D
import { extractPremiseEntities, buildPremiseCoverageBlock, reportPremiseCoverage } from '@/lib/premiseFidelity';
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-1
import { hydrateProjectForGeneration, GenerationContextError, validateSceneBeatContracts, verifySceneProvenance, captureRawArchitectProvenance, NarrativeInvariantError, verifyContiguousSceneSequence } from '@/lib/generationContext';
import { buildPriorChapterEventLedger, findReintroductions, rewriteReintroductions } from '@/lib/eventLedger'; // EVENTLEDGER-1A
import { findBeatEventCollisions, rewriteBeatCollisions, parseFutureOutlineSections, findBeatFutureOutlineCollisions, rewriteFutureOutlineCollisions } from '@/lib/eventCollision'; // SCENECOLLIDE-1 / LOOKAHEAD-1
import { collectChapterBeatEvents, findPrematureCharacterPresence } from '@/lib/characterStateLedger'; // CHARSTATE-2 / CHARSTATE-2C
import { buildChapterStateContract } from '@/lib/chapterStateContract'; // STATECONTRACT-1
import { auditBibleCompleteness } from '@/lib/bibleGate'; // BIBLEGATE-1
import { harvestCastNames } from '@/lib/pronounLock'; // CHARSTATE-1
import { normalizeSceneBeatsForDrafting } from '@/lib/sceneBeatNormalizer';
import { runVocabCaps, runSentenceStarterVariation } from '@/lib/vocabCaps';
import { runPerChapter } from '@/lib/anthologyPolishHelper';import { fixVoicePatterns } from '@/lib/voicePatternPolish';import { prepareSeedConcept, resolveSeedConcept } from '@/lib/seedConceptStorage';
import { runParallelDraftPool, PARALLEL_DRAFT_LANE_LIMIT } from '@/lib/parallelDraftPool';
import { runCrossChapterBodyLanguageDedup, runAnthologyVocabBans, runContaminationDetector } from '@/lib/anthologyPolishChecks';
import { runDialogueTagCaps } from '@/lib/dialogueTagPolish';
import { runChatGPTVocabCaps, runTransitionWordCaps } from '@/lib/chatgptPatternPolish';
import { runCapitalizationHygiene } from '@/lib/capitalizationPolish';
import { runStackedClauseVariation } from '@/lib/sentencePatternPolish';
import { runPunctuationCleanup, runSpellingFixes, runBrokenSentenceFixes, runCopingMechanismCaps, runDialoguePunctuationFix, runDialogueFillerFix } from '@/lib/punctuationPolish';
import { pickModel, pickFallbackModel, buildFallbackControls, protectedProjectUpdate, foundationSafeUpdate, normalizeModelId, DEFAULT_FICTION_PROSE_MODEL } from '@/lib/modelRouting';
import { generateBibleParallel, BIBLE_RESUMABLE_FIELDS } from '@/lib/parallelBibleGenerator';
import { AI_FAVORITE_NAMES, getUsedCharacterNames, buildNameExclusionBlock } from '@/lib/nameRegistry';
import { buildBannedNamePromptBlock, getAllBlockedNames } from '@/lib/nameHygieneRules';
import { repairChapterMetadata } from '@/lib/chapterMetadataRepair';
import { runStyleTicSweep } from '@/lib/styleTicSweep';
import { runManuscriptSafetyGate } from '@/lib/manuscriptSafetyGate';
import { safeReplaceChapterContent, verifySafeReplacement } from '@/lib/safeChapterReplace';
import { runProsePolishQualityGate, runDeterministicGrammarRepair, repairMissingOpeningQuotes, runPolishImprovementScoring } from '@/lib/prosePolishQualityGate';
import { polishChapterWithLLM } from '@/lib/llmProsePolisher';
import { runDialogueMechanicsPass, runMidParagraphDialogueAutofixPass } from '@/lib/dialogueMechanicsRepair';
import { runAISlopReductionPass } from '@/lib/aiSlopReduction';
import { shouldRunDialogueRepair, shouldRunAISlopReduction, shouldRunReferenceIntegrity } from '@/lib/polishPipelineConfig';
import { runReferenceIntegrityGate } from '@/lib/referenceIntegrityGate';
import { runManuscriptPolishPipeline } from '@/lib/manuscriptPolishRunner';
import { verifyExtractedAtoms, ATOM_BUCKETS } from '@/lib/researchAtomGuard'; // ARCH-2
import { runSceneDuplicateSweep } from '@/lib/sceneDuplicateSweep'; // SCENEDUP-3: live implementation moved here

console.log('[PROJECTSTUDIO] v16.0 loaded: HARDFIX — strict safety gate enforcement on draft/polish paths');

// Helper: log every safety gate result with structured output for live tracing.
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

// Helper: store safety report globally for live inspection
function storeSafetyReport(stage, chapters) {
  if (typeof window !== 'undefined') {
    window.__UBS_LAST_SAFETY_REPORT = { stage, timestamp: new Date().toISOString(), chapters };
    console.log('[SAFETY-GATE] Report stored at window.__UBS_LAST_SAFETY_REPORT');
  }
}

const PROJECT_STUDIO_VERSION = 'ProjectStudio-v15.7-controlled-nf-parallel-no-local-beat-fallback';
console.log('[PROJECT-STUDIO] Loaded', PROJECT_STUDIO_VERSION);


// Emergency hard fallback for projects where canonNameLock is not firing because
// project metadata is stale/missing at polish time. This is intentionally narrow
// and only activates for the Songbird/Iris/Pauline manuscript world.
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
const GLOBAL_NAME_HYGIENE_PROMPT_BLOCK = buildBannedNamePromptBlock({
  includeHighRisk: true,
  includeWatchlist: false,
});

const ADULT_FANFIC_PATTERN = /adult|erotic|erotica|explicit|smut|lemon|omegaverse|kink|bdsm|reverse harem|poly|heat|rut/i;
const FANFIC_PATTERN = /fan\s*fiction|fanfiction|fanfic|canon|fandom|source universe|ship fic|fix-it|fix it|missing episode|crossover|alternate universe|adult fanfic|erotic fanfic|smut|lemon|omegaverse/i;

function normalizeSetupRoutingDraft(draft = {}) {
  const next = { ...(draft || {}) };
  const genreText = `${next.genre || ''} ${next.subgenre || ''} ${next.genre_group || ''}`;
  const projectText = `${next.fandom_name || ''} ${next.source_universe || ''} ${next.canon_mode || ''} ${next.rights_mode || ''}`;
  const isFanfic =
    next.content_lane === 'fanfiction' ||
    next.rights_mode === 'fanfiction_noncommercial' ||
    next.fanfic_posting_target ||
    FANFIC_PATTERN.test(`${genreText} ${projectText}`);
  const isAdultFanfic = isFanfic && ADULT_FANFIC_PATTERN.test(genreText);

  if (isFanfic) {
    next.content_lane = 'fanfiction';
    next.book_type = 'fiction';
    next.rights_mode = next.rights_mode || 'fanfiction_noncommercial';
    if (next.rights_mode === 'fanfiction_noncommercial') next.commercial_use_allowed = false;
    next.canon_mode = next.canon_mode || 'canon_divergent';
  }

  if (isAdultFanfic) {
    next.reading_level = 'adult';
    next.spice_level = Math.max(Number(next.spice_level || 0), 3);
    next.language_intensity = Math.max(Number(next.language_intensity ?? 2), 2);
    next.erotica_register = Math.max(Number(next.erotica_register ?? 0), 1);
  }

  if (next.project_format === 'anthology') {
    next.project_type = 'anthology';
  }

  return next;
}


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


const SCENE_BEATS_ENTITY_CHAR_LIMIT = 6500;

// BEATFIX-1: minified JSON is the same data with the indentation removed —
// a lossless saving of roughly 13% on these payloads. Always try it before
// refusing (fiction) or before dropping to a lossier tier (nonfiction).
function fitOrMinifyForEntity(obj, limit = SCENE_BEATS_ENTITY_CHAR_LIMIT) {
  const pretty = JSON.stringify(obj, null, 2);
  if (pretty.length <= limit) return pretty;
  const minified = JSON.stringify(obj);
  if (minified.length <= limit) {
    console.warn(`[BEATFIX-1] entity payload ${pretty.length}c exceeds ${limit}c; losslessly minified to ${minified.length}c`);
    return minified;
  }
  return null;
}

// SEQFIX-1: one LLM call at a time — see parallelDraftPool.js. 4-lane batch
// against the local llama cascade-timed-out live (0/4 chapters drafted).
const NONFICTION_DRAFT_LANE_LIMIT = 1;
const ANTHOLOGY_DRAFT_LANE_LIMIT = 1;
const REWRITE_DRAFT_LANE_LIMIT = 1;


function safeJsonParseProjectStudio(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function truncateForEntityField(value, max = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 20)).trim()}… [trimmed]`;
}

function slimArrayForEntityField(value, maxItems = 8, maxChars = 280) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((item) => {
      if (typeof item === 'string') return truncateForEntityField(item, maxChars);
      if (item && typeof item === 'object') {
        return Object.fromEntries(
          Object.entries(item)
            .slice(0, 10)
            .map(([key, val]) => [
              key,
              typeof val === 'string'
                ? truncateForEntityField(val, Math.min(maxChars, 220))
                : Array.isArray(val)
                  ? slimArrayForEntityField(val, 4, 140)
                  : val,
            ])
        );
      }
      return item;
    })
    .filter((item) => item !== '' && item != null);
}

function compactSceneBeatUnitForEntity(unit = {}, index = 0) {
  const safe = unit && typeof unit === 'object' ? unit : {};
  return {
    scene_number: safe.scene_number ?? safe.section_number ?? index + 1,
    section_number: safe.section_number ?? safe.scene_number ?? index + 1,
    title: truncateForEntityField(safe.title || safe.scene_title || `Section ${index + 1}`, 120),
    mode: truncateForEntityField(safe.mode || safe.scene_type || safe.function || '', 80),
    tempo: truncateForEntityField(safe.tempo || safe.pacing || '', 80),
    purpose: truncateForEntityField(safe.purpose || safe.scene_purpose || safe.story_function || '', 380),
    content_direction: truncateForEntityField(safe.content_direction || safe.action || safe.summary || safe.beat_summary || '', 620),
    evidence_needed: truncateForEntityField(safe.evidence_needed || safe.source_plan || safe.research_anchor || '', 500),
    key_claim: truncateForEntityField(safe.key_claim || safe.thesis_move || safe.revelation || '', 360),
    opens_with: truncateForEntityField(safe.opens_with || safe.opening_image || '', 220),
    closes_with: truncateForEntityField(safe.closes_with || safe.closing_turn || '', 220),
    word_target: Number(safe.word_target || safe.target_words || safe.words || 0) || undefined,
    fabrication_warnings: slimArrayForEntityField(safe.fabrication_warnings || safe.risks || safe.warnings || [], 5, 180),
    source_confidence: truncateForEntityField(safe.source_confidence || safe.claim_lane || '', 120),
  };
}


function extractSceneBeatUnitsForValidation(beatResult = {}) {
  const raw = beatResult && typeof beatResult === 'object' ? beatResult : safeJsonParseProjectStudio(beatResult, {});
  if (Array.isArray(raw.sections)) return raw.sections;
  if (Array.isArray(raw.beats)) return raw.beats;
  if (Array.isArray(raw.scenes)) return raw.scenes;
  return [];
}

function validateNonfictionBeatPlanForDrafting(beatResult = {}, chapter = {}) {
  const units = extractSceneBeatUnitsForValidation(beatResult);
  const chapterNumber = chapter?.chapter_number || chapter?.number || '?';
  if (!Array.isArray(units) || units.length < 3) {
    const err = new Error(
      `Nonfiction beat generation returned an unusable section plan for chapter ${chapterNumber}: ${units?.length || 0} section(s). Refusing to draft from empty/partial beats because that creates generic or contaminated long-form prose.`
    );
    err.code = 'NF_EMPTY_BEAT_PLAN';
    throw err;
  }

  const usefulUnits = units.filter((unit) => {
    const text = [
      unit?.title,
      unit?.purpose,
      unit?.content_direction,
      unit?.summary,
      unit?.beat_summary,
      unit?.key_claim,
      unit?.evidence_needed,
    ].filter(Boolean).join(' ').trim();
    return text.length >= 80;
  });

  if (usefulUnits.length < Math.min(3, units.length)) {
    const err = new Error(
      `Nonfiction beat generation returned thin section instructions for chapter ${chapterNumber}: ${usefulUnits.length}/${units.length} usable section(s). Retry beat generation instead of drafting from weak beats.`
    );
    err.code = 'NF_THIN_BEAT_PLAN';
    throw err;
  }

  return units;
}

function compactSceneBeatsForEntity(beatResult = {}, chapter = null) {
  const raw = beatResult && typeof beatResult === 'object' ? beatResult : safeJsonParseProjectStudio(beatResult, {});
  const sourceUnits = Array.isArray(raw.sections)
    ? raw.sections
    : Array.isArray(raw.beats)
      ? raw.beats
      : Array.isArray(raw.scenes)
        ? raw.scenes
        : [];

  console.log(`[BEAT-PIPELINE] architect-parsed: ${sourceUnits.length} scenes`);

  // NARRATIVE-CONNECT-1: the old universal compactor converted fiction
  // {beats:[...]} into nonfiction-shaped {sections:[...]} and silently dropped
  // scene_goal, conflict, emotional_arc, cast, and every state-transition
  // field. Preserve the validated fiction contract exactly enough to redraft,
  // inspect, and verify later.
  if (Array.isArray(raw.beats)) {
    const compactFictionBeat = (unit = {}, index = 0) => ({
      scene_number: Number(unit.scene_number || index + 1),
      scene_id: truncateForEntityField(unit.scene_id, 40),
      scene_goal: truncateForEntityField(unit.scene_goal, 420),
      entry_state: truncateForEntityField(unit.entry_state, 520),
      required_events: slimArrayForEntityField(unit.required_events || [], 8, 240),
      forbidden_events: slimArrayForEntityField(unit.forbidden_events || [], 8, 240),
      exit_state: truncateForEntityField(unit.exit_state, 520),
      continuity_dependencies: slimArrayForEntityField(unit.continuity_dependencies || [], 8, 220),
      pov_character: truncateForEntityField(unit.pov_character, 100),
      setting: truncateForEntityField(unit.setting, 220),
      characters_present: slimArrayForEntityField(unit.characters_present || [], 12, 100),
      props_present: slimArrayForEntityField(unit.props_present || [], 12, 100),
      conflict: truncateForEntityField(unit.conflict, 380),
      emotional_arc: truncateForEntityField(unit.emotional_arc, 300),
      tension_level: Number(unit.tension_level || 0),
      exit_hook: truncateForEntityField(unit.exit_hook, 300),
      word_target: Number(unit.word_target || unit.target_words || 0) || undefined,
    });

    const fictionContract = {
      compacted_for_entity_field: true,
      compact_version: 'fiction-scene-contract-v1',
      chapter_number: chapter?.chapter_number || raw.chapter_number || null,
      title: truncateForEntityField(chapter?.title || raw.title || '', 140),
      beats: sourceUnits.map(compactFictionBeat),
    };
    const fictionJson = fitOrMinifyForEntity(fictionContract);
    if (fictionJson !== null) return fictionJson;

    // BEATCAP-1: the nonfiction compactor has always had lossier fallback tiers; the
    // fiction contract had exactly one tier and then a hard refusal. That was survivable
    // when the architect was deepseek-r1-14b (terse beats), but ADULTROUTE-1 routes
    // adult-lane beats to the uncensored 35B, which writes far more verbose
    // required_events — measured live 2026-08-13 (erotica anthology Ch.6: 7936c pretty /
    // 6889c minified against the 6500c cap; the chapter could never draft).
    // Tier 2 keeps EVERY contract field — the state machine needs entry/exit/
    // required_events — and shrinks per-field caps PROPORTIONALLY to the measured
    // overflow, with hard floors so events stay meaningful. Tier 3 additionally drops
    // the optional arrays (forbidden_events, continuity_dependencies, props_present),
    // mirroring the nonfiction 'bare' tier. Only then does the fail-closed refusal stand.
    const tightenFictionContract = (base, scale, version, dropOptional = false) => ({
      ...base,
      compact_version: version,
      beats: (base.beats || []).map((unit) => ({
        ...unit,
        scene_goal: truncateForEntityField(unit.scene_goal, Math.max(140, Math.round(420 * scale))),
        entry_state: truncateForEntityField(unit.entry_state, Math.max(180, Math.round(520 * scale))),
        required_events: slimArrayForEntityField(unit.required_events || [], Math.max(5, Math.round(8 * scale)), Math.max(80, Math.round(240 * scale))),
        forbidden_events: dropOptional ? undefined : slimArrayForEntityField(unit.forbidden_events || [], Math.max(2, Math.round(8 * scale)), Math.max(70, Math.round(240 * scale))),
        exit_state: truncateForEntityField(unit.exit_state, Math.max(180, Math.round(520 * scale))),
        continuity_dependencies: dropOptional ? undefined : slimArrayForEntityField(unit.continuity_dependencies || [], Math.max(2, Math.round(8 * scale)), Math.max(70, Math.round(220 * scale))),
        setting: truncateForEntityField(unit.setting, Math.max(90, Math.round(220 * scale))),
        characters_present: slimArrayForEntityField(unit.characters_present || [], Math.max(6, Math.round(12 * scale)), Math.max(50, Math.round(100 * scale))),
        props_present: dropOptional ? undefined : slimArrayForEntityField(unit.props_present || [], Math.max(3, Math.round(12 * scale)), Math.max(50, Math.round(100 * scale))),
        conflict: truncateForEntityField(unit.conflict, Math.max(120, Math.round(380 * scale))),
        emotional_arc: truncateForEntityField(unit.emotional_arc, Math.max(90, Math.round(300 * scale))),
        exit_hook: truncateForEntityField(unit.exit_hook, Math.max(90, Math.round(300 * scale))),
      })),
    });

    const minifiedLen = JSON.stringify(fictionContract).length;
    const scale = Math.max(0.3, Math.min(0.95, (SCENE_BEATS_ENTITY_CHAR_LIMIT * 0.9) / minifiedLen));
    const tightJson = fitOrMinifyForEntity(tightenFictionContract(fictionContract, scale, 'fiction-scene-contract-v1-tight'));
    if (tightJson !== null) {
      console.warn(`[BEATCAP-1] fiction scene contract (${minifiedLen}c minified) exceeded ${SCENE_BEATS_ENTITY_CHAR_LIMIT}c; tier-2 proportional compaction (scale ${scale.toFixed(2)}) applied — all contract fields kept.`);
      return tightJson;
    }

    const bareJson = fitOrMinifyForEntity(tightenFictionContract(fictionContract, Math.max(0.3, scale * 0.75), 'fiction-scene-contract-v1-bare', true));
    if (bareJson !== null) {
      console.warn(`[BEATCAP-1] tier-2 still over the cap; tier-3 bare compaction applied — forbidden_events/continuity_dependencies/props_present dropped, state machine fields kept.`);
      return bareJson;
    }

    const prettyLen = JSON.stringify(fictionContract, null, 2).length;
    const err = new Error(
      `Chapter ${chapter?.chapter_number || '?'} scene contract is ${prettyLen} characters (${minifiedLen} even without indentation) and cannot be saved safely even after BEATCAP-1 tier-2/tier-3 compaction. Reduce beat verbosity; the contract was not truncated.`
    );
    err.name = 'NarrativeContractError';
    err.code = 'FICTION_SCENE_CONTRACT_TOO_LARGE';
    throw err;
  }

  const compact = {
    compacted_for_entity_field: true,
    compact_version: 'scene-beats-compact-v15.5',
    compact_reason: 'Full scene beat payload may exceed Base44 entity field limits during parallel nonfiction/anthology drafting.',
    chapter_number: chapter?.chapter_number || raw.chapter_number || null,
    title: truncateForEntityField(chapter?.title || raw.title || '', 140),
    sections: sourceUnits.map((unit, index) => compactSceneBeatUnitForEntity(unit, index)).slice(0, 8),
    argument_progression: raw.argument_progression
      ? {
          prior_chapter_endpoint: truncateForEntityField(raw.argument_progression.prior_chapter_endpoint, 320),
          this_chapter_advances: truncateForEntityField(raw.argument_progression.this_chapter_advances, 360),
          new_ground: truncateForEntityField(raw.argument_progression.new_ground, 360),
          handoff: truncateForEntityField(raw.argument_progression.handoff, 320),
        }
      : undefined,
    continuity: raw.continuity
      ? {
          setup: truncateForEntityField(raw.continuity.setup, 280),
          payoff: truncateForEntityField(raw.continuity.payoff, 280),
          handoff: truncateForEntityField(raw.continuity.handoff, 280),
        }
      : undefined,
    source_audit_summary: raw.source_audit
      ? {
          notes: slimArrayForEntityField(raw.source_audit.notes || [], 6, 220),
          sourceSignals: slimArrayForEntityField(raw.source_audit.sourceSignals || [], 6, 180),
        }
      : undefined,
  };

  let compactJson = fitOrMinifyForEntity(compact);
  if (compactJson !== null) {
    return compactJson;
  }

  const tighter = {
    ...compact,
    sections: compact.sections.map((section) => ({
      scene_number: section.scene_number,
      section_number: section.section_number,
      title: truncateForEntityField(section.title, 90),
      mode: truncateForEntityField(section.mode, 50),
      purpose: truncateForEntityField(section.purpose, 240),
      content_direction: truncateForEntityField(section.content_direction, 360),
      evidence_needed: truncateForEntityField(section.evidence_needed, 260),
      key_claim: truncateForEntityField(section.key_claim, 220),
      word_target: section.word_target,
    })),
    source_audit_summary: undefined,
  };

  compactJson = fitOrMinifyForEntity(tighter);
  if (compactJson !== null) {
    return compactJson;
  }

  const bare = {
    compacted_for_entity_field: true,
    compact_version: 'scene-beats-compact-v15.5-bare',
    chapter_number: chapter?.chapter_number || raw.chapter_number || null,
    title: truncateForEntityField(chapter?.title || raw.title || '', 100),
    sections: (tighter.sections || []).slice(0, 6).map((section, index) => ({
      section_number: section.section_number || index + 1,
      title: truncateForEntityField(section.title, 80),
      purpose: truncateForEntityField(section.purpose, 180),
      content_direction: truncateForEntityField(section.content_direction, 220),
      word_target: section.word_target,
    })),
  };

  return fitOrMinifyForEntity(bare) ?? JSON.stringify(bare);
}


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

const PROJECT_FIELDS = ['world_md', 'characters_md', 'outline_md', 'canon_md', 'voice_md', 'mystery_md', 'twists_md', 'research_md'];
const PROJECT_SETTING_FIELDS = [
  // Core book setup
  'title',
  'tagline',
  'seed_concept',
  'book_type',
  'project_type',
  'genre',
  'subgenre',
  'target_audience',

  // Taxonomy / setup architecture
  'content_lane',
  'project_format',
  'rights_mode',
  'commercial_use_allowed',
  'genre_group',
  'market_category',

  // Fan fiction / shared-universe setup
  'fandom_name',
  'source_universe',
  'canon_mode',
  'fanfic_posting_target',
  'canon_characters',
  'canon_boundary',

  // POV / narration
  'pov_mode',
  'tense',
  'protagonist_pronouns',

  // Structure / pacing
  'beat_style',
  'scene_beat_style',
  'nf_structure_mode',
  'story_arc',
  'num_twists',
  'twist_count',
  'twist_intensity',

  // Author / voice
  'author_name',
  'author_voice',
  'author_voice_notes',
  'author_style_id',

  // Series
  'series_bible_id',
  'series_name',
  'series_number',
  'series_order',

  // Content controls
  'reading_level',
  'language_intensity',
  'spice_level',
  'violence_level', // SETUPFIX-1: was missing - project sync rebuilt drafts without it, so the next autosave wiped the user's saved value back to 0
  'erotica_register', // SETUPFIX-1: was missing - project sync rebuilt drafts without it, so the next autosave wiped the user's saved value back to 0

  // Length targets
  'chapter_target',
  'chapter_length_preset',
  'chapter_length_target',
  'target_chapter_words',
  'total_word_target',

  // Anthology
  'anthology_theme',
  'anthology_theme_type',
  'anthology_story_length',
  'anthology_variety',

  // Model routing
  'default_prose_model',

  // WAVE6-DEADGATE: per-project scene-execution gate toggles (Setup → Model & Series)
  'scene_execution_flags',
];

export default function ProjectStudio() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busyLabel, setBusyLabel] = React.useState('');
  // Per-chapter progress for parallel Draft All / Rewrite All operations.
  const [chapterProgress, setChapterProgress] = React.useState({});
  // Batch Draft/Rewrite stays generation-only. Polish/Fix Manuscript handles cleanup afterward.
  // Diagnostic: log every time chapterProgress changes so we can see if
  // React is actually re-rendering with new values.
  React.useEffect(() => {
    const keys = Object.keys(chapterProgress);
    console.log(`[CHAPTER-PROGRESS-STATE] Map now has ${keys.length} entries:`, chapterProgress);
  }, [chapterProgress]);
  const [selectedChapterId, setSelectedChapterId] = React.useState(null);
  const [activeDoc, setActiveDoc] = React.useState('world_md');
  const [chapterDraft, setChapterDraft] = React.useState('');

  // Support ?tab=ideas query param to open directly on a tab
  const initialTab = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || null;
  }, []);
  const [docDrafts, setDocDrafts] = React.useState({});
  const [settingsDrafts, setSettingsDrafts] = React.useState(createInitialProjectSettings());
  const [reviewData, setReviewData] = React.useState({});
  const [isApplyingFixes, setIsApplyingFixes] = React.useState(false);
  const [polishResults, setPolishResults] = React.useState(null);
  const [researchData, setResearchData] = React.useState({});
  const [chapterProseModels, setChapterProseModels] = React.useState({});
  const stopRequestedRef = React.useRef(false);
  const skipProjectSyncRef = React.useRef(false);
  // WAVE6-GENREKEEP: Setup fields the author has explicitly edited this session.
  // Genre defaults may fill anything untouched, but never overwrite these.
  const userTouchedSetupFieldsRef = React.useRef(new Set());
  const notebookRef = React.useRef(null);
  const undoSnapshotRef = React.useRef(null);
  const [isUndoing, setIsUndoing] = React.useState(false);
  const [undoSnapshot, setUndoSnapshot] = React.useState(null);
  const [draftIntegrityReport, setDraftIntegrityReport] = React.useState(null);
  const [researchIntegrityError, setResearchIntegrityError] = React.useState(null);
  const [researchCoverageVerdict, setResearchCoverageVerdict] = React.useState(null);

  const captureSnapshot = (label) => {
    const snap = {
      label,
      timestamp: Date.now(),
      project: project ? { ...project } : null,
      chapters: chapters.map((ch) => ({ ...ch })),
      docDrafts: { ...docDrafts },
      settingsDrafts: { ...settingsDrafts },
    };
    undoSnapshotRef.current = snap;
    setUndoSnapshot(snap);
  };

  const handleUndo = async () => {
    const snap = undoSnapshotRef.current;
    if (!snap || !snap.project) return;
    setIsUndoing(true);
    try {
      // Restore project fields
      const { id, created_date, updated_date, created_by, ...projectFields } = snap.project;
      await runWithNetworkRetry(() => base44.entities.NovelProject.update(projectId, projectFields));

      // Restore chapters that changed
      for (const oldCh of snap.chapters) {
        const { id: chId, created_date: cd, updated_date: ud, created_by: cb, ...chFields } = oldCh;
        await runWithNetworkRetry(() => base44.entities.Chapter.update(chId, chFields));
      }

      // Delete chapters that were created after the snapshot
      const currentChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 200);
      const snapshotIds = new Set(snap.chapters.map((c) => c.id));
      for (const ch of currentChapters) {
        if (!snapshotIds.has(ch.id)) {
          await base44.entities.Chapter.delete(ch.id);
        }
      }

      setDocDrafts(snap.docDrafts);
      setSettingsDrafts(snap.settingsDrafts);
      undoSnapshotRef.current = null;
      setUndoSnapshot(null);
      await refreshAll();
    } finally {
      setIsUndoing(false);
    }
  };

  // Project query — do NOT swallow errors silently. A transient 429/500/timeout
  // used to get caught by .catch(() => []) and present as "project doesn't
  // exist," which the UI then rendered as the "Project Not Found" screen.
  // Now: let errors bubble to React Query, auto-retry on transient failures,
  // and keep the previously loaded project visible across refetches.
  //
  // CRITICAL (React Query v5): we do NOT set initialData. In v5, providing
  // initialData without initialDataUpdatedAt causes the query to treat the
  // placeholder as fresh data — staleTime expires against "now" and the
  // queryFn never actually fires on mount. That was the root cause of the
  // "Project Not Found" screen: queryFn was silently skipped, projectRows
  // stayed [], project stayed null. No retries, no error, just a null pointer
  // walking straight into the 404 guard.
  const { data: rawProjectRows, isLoading: isLoadingProject, isError: isProjectError, error: projectError, refetch: refetchProject } = useQuery({
    queryKey: ['novel-project', projectId],
    queryFn: () => base44.entities.NovelProject.filter({ id: projectId }),
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    placeholderData: (prev) => prev, // v5 replacement for keepPreviousData
    staleTime: 30_000,
    enabled: !!projectId,
  });

  const { data: rawChapters, isLoading: isLoadingChapters } = useQuery({
    queryKey: ['novel-chapters', projectId],
    queryFn: () => base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100),
    placeholderData: (prev) => prev,
    enabled: !!projectId,
  });

  // Normalize — data is undefined on first render before queryFn resolves.
  // Keep all downstream code as-is by using `chapters` and `projectRows`
  // exactly the way the original code did (safe array access guaranteed).
  const projectRows = Array.isArray(rawProjectRows) ? rawProjectRows : [];
  const chapters = Array.isArray(rawChapters) ? rawChapters : [];

  const project = projectRows[0] || null;
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId) || chapters[0] || null;

  // VERSIONS-1B: chapterHasPreviousVersion is async (it may need a store
  // round-trip for a chapter saved before VERSIONS-1 landed), so it cannot
  // be called directly inside JSX render the way a sync check would be —
  // compute it here and hand OutlineEditor a plain boolean.
  const [hasPreviousVersion, setHasPreviousVersion] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    if (!selectedChapter) { setHasPreviousVersion(false); return undefined; }
    chapterHasPreviousVersion(selectedChapter).then((result) => {
      if (!cancelled) setHasPreviousVersion(result);
    });
    return () => { cancelled = true; };
  }, [selectedChapter?.id, selectedChapter?.content_md_url, selectedChapter?.previous_content_md_url]);

  // Destructive-generation safety helpers. Keep these AFTER project/chapters are initialized
  // to avoid React initialization-order crashes.
  const chapterHasPersistedManuscriptContent = (chapter) => Boolean(
    chapterHasContent(chapter) ||
    chapter?.content_html ||
    chapter?.content_html_url ||
    chapter?.content_delta ||
    chapter?.content_delta_url
  );

  const confirmDestructiveChapterAction = (message) => {
    if (typeof window === 'undefined') return true;
    return window.confirm(message);
  };

  const backupChapterBeforeGeneratedOverwrite = async (chapter, reason) => {
    if (!chapter?.id || !chapterHasPersistedManuscriptContent(chapter)) return false;

    const existingText = await resolveChapterContent(chapter);
    if (!existingText || !existingText.trim()) return false;

    const backupFields = await prepareBackupContent(existingText, project?.id || projectId, chapter.id, chapter);
    await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
      ...backupFields,
      revision_notes: [
        reason || 'Backup before generated overwrite',
        chapter.revision_notes || '',
      ].filter(Boolean).join('\n'),
    }));
    return true;
  };


  const runProjectContentGuardBeforeSave = (chapter, text, sourceLabel = 'draft') => {
    const guard = validateProjectChapterContent({
      project: buildNameHygieneEnhancedProject(project || {}),
      chapter,
      chapters,
      content: text,
    });

    if (guard?.shouldBlockSave) {
      console.error(`[PROJECT-CONTENT-GUARD] Blocked ${sourceLabel} save for Ch.${chapter?.chapter_number || '?'}`, guard);
      toast.error(`Blocked Ch.${chapter?.chapter_number || '?'} save: wrong-project contamination detected. Regenerate this chapter after checking Setup/Foundation.`);
      throw makeProjectContentGuardError(chapter, guard);
    }

    if (guard?.severity === 'warning') {
      console.warn(`[PROJECT-CONTENT-GUARD] Warning for Ch.${chapter?.chapter_number || '?'} ${sourceLabel}:`, guard.report);
    }

    return guard;
  };

  // Set project context for the floating brainstorm panel
  React.useEffect(() => {
    if (project) {
      window.__ubsProjectContext = {
        title: project.title,
        genre: project.genre,
        seed_concept: project.seed_concept,
        characters_md: project.characters_md,
        world_md: project.world_md,
        outline_md: project.outline_md,
        voice_md: project.voice_md,
      };
    }
    return () => { window.__ubsProjectContext = null; };
  }, [project?.id, project?.title]);

  React.useEffect(() => {
    if (!project) return;
    if (skipProjectSyncRef.current) { skipProjectSyncRef.current = false; return; }
    const baseDrafts = PROJECT_FIELDS.reduce((acc, f) => ({ ...acc, [f]: project[f] || '' }), {});
    setDocDrafts(baseDrafts);
    // Resolve foundation fields stored as URLs (outline_md, characters_md, etc.) + research
    resolveAllFoundationFields(project).then((resolved) => {
      setDocDrafts((prev) => { const next = { ...prev }; for (const [k, v] of Object.entries(resolved)) { if (v && v.length > (prev[k] || '').length) next[k] = v; } return next; });
    }).catch(() => {});

    if (project.research_md_url || project.research_md) {
      checkResearchIntegrity(project).then(({ isTruncated, reason }) => {
        if (isTruncated) {
          setResearchIntegrityError(reason);
        } else {
          setResearchIntegrityError(null);
        }
      });
    }

    if (project.research_md_url) { resolveResearchContent(project).then((c) => { if (c && c.length > (project.research_md || '').length) setDocDrafts((p) => ({ ...p, research_md: c })); }).catch(() => {}); }
    setSettingsDrafts(PROJECT_SETTING_FIELDS.reduce((acc, f) => ({ ...acc, [f]: project[f] ?? createInitialProjectSettings(project.book_type || 'fiction')[f] ?? '' }), createInitialProjectSettings(project.book_type || 'fiction')));
    if (project.seed_concept_url) { resolveSeedConcept(project).then((full) => { if (full) setSettingsDrafts((p) => ({ ...p, seed_concept: full })); }).catch(() => {}); }
    if (project.research_data) {
      try { setResearchData(typeof project.research_data === 'string' ? JSON.parse(project.research_data) : project.research_data); } catch { setResearchData({}); }
    }
  }, [project]);

  React.useEffect(() => {
    if (!chapters.length) return;
    // Auto-select first chapter if none selected or selected chapter no longer exists
    const selectedExists = selectedChapterId && chapters.some(ch => ch.id === selectedChapterId);
    if (!selectedExists) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  React.useEffect(() => {
    if (!project || !chapters || chapters.length === 0) {
      setResearchCoverageVerdict(null);
      return;
    }
    const isNonfictionMode = isNonfictionProjectAuthority(project);
    if (!isNonfictionMode) {
      setResearchCoverageVerdict(null);
      return;
    }

    const missingTopics = new Set();
    let chaptersWithGapsCount = 0;

    for (const ch of chapters) {
      if (!isBodyChapter(ch)) continue;
      const cov = researchCoverageCheck(ch, project);
      if (cov && cov.missingCount > 0) {
        chaptersWithGapsCount++;
        for (const m of cov.missing) missingTopics.add(m);
      }
    }

    if (missingTopics.size > 0) {
      setResearchCoverageVerdict({
        missingCount: missingTopics.size,
        chaptersCount: chaptersWithGapsCount,
        missing: Array.from(missingTopics)
      });
    } else {
      setResearchCoverageVerdict(null);
    }
  }, [project, chapters]);

  // Load chapter content when the selected chapter changes or its data updates
  const selectedChapterUpdatedAt = selectedChapter?.updated_date;
  const selectedChapterContentMd = selectedChapter?.content_md;
  const selectedChapterContentUrl = selectedChapter?.content_md_url;
  React.useEffect(() => {
    let cancelled = false;
    resolveChapterContent(selectedChapter).then((content) => {
      if (!cancelled) setChapterDraft(content);
    });
    return () => { cancelled = true; };
  }, [selectedChapterId, selectedChapterUpdatedAt, selectedChapterContentMd, selectedChapterContentUrl]);

  const saveProject = useMutation({
    mutationFn: (payload) => runWithNetworkRetry(() => base44.entities.NovelProject.update(projectId, payload)),
    onSuccess: () => { skipProjectSyncRef.current = true; queryClient.invalidateQueries({ queryKey: ['novel-project', projectId] }); },
  });

  const saveChapter = useMutation({
    mutationFn: ({ id, payload }) => runWithNetworkRetry(() => base44.entities.Chapter.update(id, payload)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novel-chapters', projectId] }),
  });

  const refreshAll = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['novel-project', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['novel-chapters', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['novel-projects'] }),
  ]);

  // WAVE6-GENREKEEP: fields applyGenreDefaults() overwrites, and the label shown
  // in the "kept your ..." toast (null = preserve silently, it is derived).
  const GENRE_DEFAULTED_FIELDS = {
    chapter_target: 'chapter count',
    chapter_length_target: 'chapter length',
    chapter_length_preset: null,
    target_chapter_words: null,
    total_word_target: null,
    pov_mode: 'POV',
    tense: 'tense',
    beat_style: 'beat style',
    scene_beat_style: null,
    nf_structure_mode: 'structure',
    spice_level: 'spice level',
    violence_level: 'violence level',
    erotica_register: 'prose register',
  };

  const markSetupFieldsTouched = (...fields) => {
    for (const f of fields) if (f) userTouchedSetupFieldsRef.current.add(f);
  };

  const updateSettingsDrafts = (updater) => {
    setSettingsDrafts((current) => {
      const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
      if (next.series_number !== '' && next.series_number != null) next.series_number = Number(next.series_number) || null;
      const ct = next.chapter_target;
      const clt = next.chapter_length_target;
      const chapterTarget = ct === '' ? '' : Math.max(1, Number(ct || 1));
      const chapterLengthTarget = clt === '' ? '' : Math.max(500, Number(clt || 3500));
      const numCt = chapterTarget === '' ? 0 : chapterTarget;
      const numClt = chapterLengthTarget === '' ? 0 : chapterLengthTarget;
      return {
        ...next,
        chapter_target: chapterTarget,
        chapter_length_target: chapterLengthTarget,
        total_word_target: numCt * numClt,
        target_chapter_words: chapterLengthTarget === '' ? '' : chapterLengthTarget,
        scene_beat_style: next.beat_style || '',
      };
    });
  };

  const handleSettingFieldChange = (field, value) => {
    markSetupFieldsTouched(field); // WAVE6-GENREKEEP
    updateSettingsDrafts({ [field]: value });

    // These fields affect project routing, Setup conditionals, and downstream
    // generation behavior. Persist them immediately so autosave cannot race
    // the visible UI state or leave the app thinking the project is still using
    // the previous lane/format/rights mode. Keep this list intentionally narrow
    // so normal typing fields do not hammer the database.
    const immediatePersistFields = new Set([
      'project_type',
      'book_type',
      'content_lane',
      'project_format',
      'rights_mode',
      'commercial_use_allowed',
      'genre',
      'subgenre',
      'canon_mode',
      'num_twists',
      'twist_intensity',
      'twist_count',
    ]);

    if (immediatePersistFields.has(field)) {
      runWithNetworkRetry(() =>
        base44.entities.NovelProject.update(projectId, { [field]: value })
      ).catch((err) => {
        console.warn('[SETTINGS] Immediate field save failed:', field, err?.message || err);
      });
    }
  };

  const handleBookTypeChange = (bookType) => {
    // Preserve lane/rights/format/genre details. Fan Fiction is still book_type='fiction',
    // so a full reset here can silently erase Fan Fiction + Adult/Erotic Fanfic settings.
    setSettingsDrafts((prev) => {
      const previousType = prev.book_type || project?.book_type || 'fiction';
      if (previousType === bookType) {
        return normalizeSetupRoutingDraft({ ...prev, book_type: bookType });
      }

      const initial = createInitialProjectSettings(bookType);
      return normalizeSetupRoutingDraft({
        ...initial,
        ...prev,
        book_type: bookType,
        title: prev.title || initial.title,
        tagline: prev.tagline || initial.tagline,
        seed_concept: prev.seed_concept || initial.seed_concept,
        author_name: prev.author_name || initial.author_name,
        author_style_id: prev.author_style_id || '',
        // WAVE2-ENUMFIX: 'novel' is not in the project_type enum
        // (fiction|nonfiction|erotica|anthology) — it broke every
        // project_type === 'fiction' routing check downstream.
        project_type: prev.project_format === 'anthology' ? 'anthology' : (bookType === 'nonfiction' ? 'nonfiction' : 'fiction'),
      });
    });
  };

  const handleGenreChange = (genre) => {
    // WAVE6-GENREKEEP: work out what will be kept from the CURRENT state, before
    // the state updater runs. The updater is deferred (and re-invoked under
    // StrictMode), so collecting labels inside it left the toast empty.
    const keptLabels = Object.entries(GENRE_DEFAULTED_FIELDS)
      .filter(([field, label]) => {
        if (!label || !userTouchedSetupFieldsRef.current.has(field)) return false;
        const v = settingsDrafts?.[field];
        return v !== undefined && v !== null && v !== '';
      })
      .map(([, label]) => label);

    updateSettingsDrafts((current) => {
      const protectedRouting = {
        content_lane: current.content_lane,
        project_format: current.project_format,
        project_type: current.project_type,
        rights_mode: current.rights_mode,
        commercial_use_allowed: current.commercial_use_allowed,
        genre_group: current.genre_group,
        fandom_name: current.fandom_name,
        source_universe: current.source_universe,
        canon_mode: current.canon_mode,
        fanfic_posting_target: current.fanfic_posting_target,
        canon_characters: current.canon_characters,
        canon_boundary: current.canon_boundary,
      };
      // WAVE6-GENREKEEP: applyGenreDefaults overwrites the whole length/intensity
      // /narration block with genre defaults. That is right for a project whose
      // values are still untouched, and wrong for one where the author already
      // made a deliberate choice: setting "4 chapters x 1,200 words" and THEN
      // picking a genre silently restored 22 x 3,600 with no prompt and no toast
      // (found in the end-to-end run, 2026-08-12). The protectedRouting block
      // above already establishes that deliberate choices survive a genre change
      // — these fields simply were not on the list. Anything the author has
      // actually edited is now preserved; everything untouched still takes the
      // genre default.
      const preserved = {};
      for (const field of Object.keys(GENRE_DEFAULTED_FIELDS)) {
        if (!userTouchedSetupFieldsRef.current.has(field)) continue;
        const v = current[field];
        if (v === undefined || v === null || v === '') continue;
        preserved[field] = v;
      }
      const suggestion = suggestPovTense(current.book_type, genre);
      const next = applyGenreDefaults({ ...current, genre, subgenre: '' }, genre);
      return normalizeSetupRoutingDraft({
        ...next,
        ...protectedRouting,
        genre,
        subgenre: '',
        pov_mode: suggestion.pov,
        tense: suggestion.tense,
        ...preserved,
      });
    });
    if (keptLabels.length) {
      const unique = [...new Set(keptLabels)];
      toast.success(`${genre} defaults applied — kept your ${unique.join(', ')}.`);
    }
  };

  const handleLengthPresetChange = (preset) => {
    markSetupFieldsTouched('chapter_length_preset', 'chapter_length_target'); // WAVE6-GENREKEEP
    updateSettingsDrafts({
      chapter_length_preset: preset,
      chapter_length_target: CHAPTER_LENGTH_PRESETS[preset]?.words || 3500,
    });
  };

  const handleApplyPovPreset = (preset) => {
    markSetupFieldsTouched('pov_mode', 'tense'); // WAVE6-GENREKEEP
    updateSettingsDrafts({ pov_mode: preset.pov, tense: preset.tense });
  };

  const handleSaveSettings = async () => {
    const p = { ...settingsDrafts }; if (!p.series_number && p.series_number !== 0) delete p.series_number; else p.series_number = Number(p.series_number);
    delete p.num_twists; delete p.twist_count; delete p.twist_intensity;
    if (p.seed_concept) { const sc = await prepareSeedConcept(p.seed_concept, projectId); p.seed_concept = sc.seed_concept; p.seed_concept_url = sc.seed_concept_url; }
    await saveProject.mutateAsync(p);
  };


  const runAnthologyFoundationBuild = async (resolvedSeed, sourceLabel = 'Build Story Bible') => {
    const ct = Number(settingsDrafts.chapter_target) || Number(project?.chapter_target) || 12;
    const anthologyProject = normalizeSetupRoutingDraft({
      ...project,
      ...settingsDrafts,
      chapter_target: ct,
      seed_concept: resolvedSeed,
      project_format: settingsDrafts.project_format || project?.project_format || 'anthology',
      project_type: 'anthology',
    });

    const makeFallbackStory = (storyNumber) => {
      // NFCLASS-1: one authority. The old inline regex matched /history/ against the
      // genre, so an anthology of historical FICTION was treated as nonfiction.
      const isNonfiction = isNonfictionProjectAuthority(anthologyProject);
      const theme = anthologyProject.anthology_theme || anthologyProject.seed_concept || anthologyProject.title || 'Collection Theme';
      const noun = isNonfiction ? 'Chapter' : 'Story';
      return {
        story_number: storyNumber,
        title: `${noun} ${storyNumber}: ${theme}`,
        premise: isNonfiction
          ? `A standalone ${String(theme).toLowerCase()} chapter with a distinct subject, opening hook, evidence path, and conclusion.`
          : `A standalone story exploring ${theme} from a distinct character, setting, conflict, and ending.`,
        protagonist: {
          name: isNonfiction ? `Subject ${storyNumber}` : `Protagonist ${storyNumber}`,
          age: isNonfiction ? 'TBD / research-dependent' : 'adult',
          occupation_or_role: isNonfiction ? 'concept | case_study | person | event' : 'role TBD',
          wound: isNonfiction ? 'Central question TBD' : 'private wound TBD',
          want: isNonfiction ? 'Distinct chapter angle TBD' : 'clear desire TBD',
          defining_trait: isNonfiction ? 'key insight TBD' : 'defining trait TBD',
        },
        setting: {
          location: anthologyProject.source_universe || anthologyProject.fandom_name || anthologyProject.genre || 'TBD',
          time_period: anthologyProject.canon_mode || 'TBD',
          sensory_anchor: isNonfiction ? 'Opening hook TBD' : 'sensory anchor TBD',
        },
        conflict: isNonfiction ? 'Tension/evidence question TBD' : 'central conflict TBD',
        twist_or_turn: isNonfiction ? 'counterintuitive insight TBD' : 'turning point TBD',
        ending_type: isNonfiction ? 'synthesis' : 'resolved or devastating',
        thematic_angle: `Unique angle ${storyNumber} on ${theme}`,
        pov: isNonfiction ? 'editorial' : (anthologyProject.pov_mode || 'third-close'),
        tense: isNonfiction ? 'mixed' : (anthologyProject.tense || 'past'),
        tone: anthologyProject.author_voice || anthologyProject.genre || '',
        estimated_words: Number(anthologyProject.chapter_length_target) || 3500,
      };
    };

    const normalizeStories = (inputStories) => {
      const seen = new Set();
      const cleaned = [];
      const source = Array.isArray(inputStories) ? inputStories : [];
      for (const rawStory of source) {
        if (!rawStory || typeof rawStory !== 'object') continue;
        const nextNum = cleaned.length + 1;
        const titleKey = String(rawStory.title || '').trim().toLowerCase();
        const premiseKey = String(rawStory.premise || rawStory.thematic_angle || '').trim().toLowerCase().slice(0, 160);
        const key = `${titleKey}|${premiseKey}`;
        if (key.length > 2 && seen.has(key)) continue;
        if (key.length > 2) seen.add(key);
        cleaned.push({ ...makeFallbackStory(nextNum), ...rawStory, story_number: nextNum });
        if (cleaned.length >= ct) break;
      }
      return cleaned;
    };

    const buildFallbackDocs = (parsedBible, stories, outlineMd) => {
      const theme = anthologyProject.anthology_theme || anthologyProject.seed_concept || anthologyProject.title || 'Collection Theme';
      const collectionTitle = parsedBible?.title || anthologyProject.title || String(theme).slice(0, 80) || 'Untitled Anthology';
      const fanContext = anthologyProject.content_lane === 'fanfiction' || anthologyProject.rights_mode === 'fanfiction_noncommercial'
        ? `\n\n## Fanfiction / Shared-Universe Guardrails\n- Source/Fandom: ${anthologyProject.fandom_name || anthologyProject.source_universe || 'User-defined fandom'}\n- Canon mode: ${anthologyProject.canon_mode || 'user-defined'}\n- Rights: Noncommercial fan work unless changed in Setup.\n- Respect canon boundaries entered in Setup. Do not invent contradictions unless the selected canon mode allows it.`
        : '';

      return {
        world_md: parsedBible?.worldMd || `# ${collectionTitle}\n\n## Master Theme\n${theme}\n\n## Collection Logic\nThis anthology is a collection of standalone ${isNonfictionProjectAuthority(anthologyProject) ? 'chapters/essays' : 'stories'} unified by the theme above. Each entry should have its own subject, conflict, arc, and ending while contributing to the larger collection experience.${fanContext}`,
        characters_md: parsedBible?.charactersMd || '',
        outline_md: outlineMd || rebuildAnthologyOutlineMd(stories),
        canon_md: parsedBible?.canonMd || `# Canon / Collection Rules\n\n- Each entry must stand alone.\n- Do not reuse the same protagonist/conflict structure unless this is intentionally set as a connected-universe anthology.\n- Maintain the tone, rights mode, and content lane selected in Setup.${fanContext}`,
        voice_md: parsedBible?.voiceMd || `# Voice Guide\n\nBaseline voice: ${anthologyProject.author_voice || anthologyProject.genre || 'project-appropriate prose'}\n\nAuthor notes:\n${anthologyProject.author_voice_notes || 'Use the author voice and style settings from Setup. Keep entries distinct without losing collection cohesion.'}`,
        mystery_md: '',
        twists_md: parsedBible?.twistsMd || '',
      };
    };

    try {
      console.log(`[ANTHOLOGY] ${sourceLabel}: safe foundation build started`, anthologyProject);
      setBusyLabel('Anthology: Building collection shell…');

      let parsedBible = {};
      try {
        const shellProject = { ...anthologyProject, chapter_target: Math.min(ct, 3) };
        const shellResponse = await Promise.race([
          invokeLLMWithRetry({
            task_type: 'foundation',
            prompt: buildAnthologyBiblePrompt(shellProject),
            response_json_schema: anthologyBibleSchema,
            model: pickModel('foundation', shellProject),
            spec: shellProject,
            _project: shellProject, // ADULTROUTE-1
            fallback_model: pickFallbackModel('foundation', shellProject),
            max_tokens: 8192,
          }, 1),
          // SHELLCAP-1: 90s was calibrated for the terse R1 architect. ADULTROUTE-1 routes
          // adult-lane foundation calls to the uncensored 35B, which needs 2-4 minutes for
          // the shell JSON on the local rig (measured 2026-08-13: every shell timed out at
          // 90s and the voice_guide/canon_rules never contributed). Timeout stays non-fatal.
          new Promise((_, reject) => setTimeout(() => reject(new Error('Anthology shell generation timed out')), 300000)),
        ]);
        parsedBible = parseAnthologyBible(unwrapIntegrationResult(shellResponse));
      } catch (shellErr) {
        console.warn('[ANTHOLOGY] Collection shell failed/timed out. Continuing with batched outlines:', shellErr?.message || shellErr);
        parsedBible = {};
      }

      setBusyLabel('Anthology: Creating story outline batches…');
      let stories = [];
      try {
        stories = await generateAnthologyOutlinesBatched(anthologyProject, { onProgress: (label) => setBusyLabel(formatProgressLabel(label)) });
      } catch (batchErr) {
        console.error('[ANTHOLOGY] Batched outlines failed validation. Refusing to save placeholders:', batchErr?.message || batchErr);
        throw new Error(`Anthology story concept generation failed before a valid outline was produced. Nothing was saved. ${batchErr?.message || ''}`.trim());
      }

      stories = normalizeStories(stories);
      if (stories.length !== ct || hasInvalidAnthologyStories(stories)) {
        throw new Error(`Anthology story concept generation returned ${stories.length}/${ct} valid stories. Refusing to save placeholder or instruction-dump outline.`);
      }

      const outlineMd = rebuildAnthologyOutlineMd(stories);
      const docs = buildFallbackDocs(parsedBible, stories, outlineMd);
      setDocDrafts(docs);

      const savePayload = foundationSafeUpdate(enforceChapterCount({
        ...docs,
        // Preserve current Setup taxonomy during the foundation save. This prevents
        // Build Story Bible refresh from reverting Fan Fiction + Adult/Erotic Fanfic
        // back to plain Fiction when autosave has not finished yet.
        content_lane: anthologyProject.content_lane,
        project_format: anthologyProject.project_format || 'anthology',
        rights_mode: anthologyProject.rights_mode,
        commercial_use_allowed: anthologyProject.commercial_use_allowed,
        genre_group: anthologyProject.genre_group,
        genre: anthologyProject.genre,
        subgenre: anthologyProject.subgenre,
        book_type: anthologyProject.book_type,
        project_type: 'anthology',
        reading_level: anthologyProject.reading_level,
        spice_level: anthologyProject.spice_level,
        language_intensity: anthologyProject.language_intensity,
        erotica_register: anthologyProject.erotica_register,
        canon_mode: anthologyProject.canon_mode,
        fandom_name: anthologyProject.fandom_name,
        source_universe: anthologyProject.source_universe,
        fanfic_posting_target: anthologyProject.fanfic_posting_target,
        canon_characters: anthologyProject.canon_characters,
        canon_boundary: anthologyProject.canon_boundary,
        title: parsedBible?.title || anthologyProject.title || project.title,
        tagline: parsedBible?.tagline || anthologyProject.tagline || project.tagline || '',
        foundation_score: hasInvalidAnthologyStories(stories) ? 6.5 : 8,
        current_focus: 'Review anthology story concepts',
        phase: 'drafting',
        status: 'ready',
        iteration: (project.iteration || 0) + 1,
      }, ct), anthologyProject);
      delete savePayload.num_twists;
      delete savePayload.twist_count;
      delete savePayload.twist_intensity;
      delete savePayload.twists;

      // STOREDEDUPE-2: pass the id; the update on the next line already has it.
      const safePayload = await prepareFoundationPayload(savePayload, project.id);
      setBusyLabel('Anthology: Saving story bible…');
      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, safePayload));

      setBusyLabel('Anthology: Creating chapter records…');
      const chapterPlans = storiesToChapterPlans(stories);
      await clearAndCreateChapters(chapterPlans, ct, project.id, outlineMd);
      await queryClient.invalidateQueries({ queryKey: ['novel-chapters', project.id] });
      await queryClient.refetchQueries({ queryKey: ['novel-chapters', project.id] });
      toast.success(`Anthology story bible built and Chapters tab synced: ${stories.length}/${ct} story concept(s).`);
    } catch (err) {
      console.error('[ANTHOLOGY] Safe foundation build failed:', err);
      toast.error(`Build Story Bible failed: ${err?.message || 'Unknown error'}`);
      throw err;
    } finally {
      setBusyLabel('');
    }

    await refreshAll();
  };

  const handleExpand = async () => {
    if (!project) return; if (!(settingsDrafts.seed_concept?.trim() || project.seed_concept?.trim())) { toast.error('Enter a premise in Setup first.'); return; }
    captureSnapshot('Expand');
    const bookType = settingsDrafts.book_type || 'fiction';
    try {
    // WAVE1-EXPANDPRETRY: the pre-save awaits below used to sit above this try,
    // so a network throw in prepareSeedConcept/update/resolveSeedConcept was an
    // unhandled rejection with no toast — the button just "did nothing".
    // Force save settings before generation to eliminate auto-save race condition
    const _expandSave = normalizeSetupRoutingDraft({ ...settingsDrafts }); if (!_expandSave.series_number && _expandSave.series_number !== 0) delete _expandSave.series_number; else _expandSave.series_number = Number(_expandSave.series_number); delete _expandSave.num_twists; delete _expandSave.twist_count; delete _expandSave.twist_intensity;
    if (_expandSave.seed_concept) { const sc = await prepareSeedConcept(_expandSave.seed_concept, project.id); _expandSave.seed_concept = sc.seed_concept; _expandSave.seed_concept_url = sc.seed_concept_url; }
    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _expandSave));
    const _resolvedSeed = await resolveSeedConcept({ ...project, seed_concept: settingsDrafts.seed_concept || project.seed_concept, seed_concept_url: _expandSave.seed_concept_url || project.seed_concept_url });
    if (isAnthologyProject(project) || settingsDrafts?.project_type === 'anthology') {
      await runAnthologyFoundationBuild(_resolvedSeed, 'Build Story Bible');
      return;
    }

    const _usedNames = await getUsedCharacterNames(project.id);
    // PREMISE-FIDELITY-1: the author's brief is a closed world. The project title is
    // excluded because it appears in nearly every premise and is not a story entity.
    const _premiseEntities = extractPremiseEntities(_resolvedSeed, { exclude: [project?.title, settingsDrafts?.title].filter(Boolean) });
    console.log('[PREMISE-FIDELITY-1] brief entities:', _premiseEntities.join(' | ') || '(none found)');
    const _nameBlock = [
      // NAMEHYGIENE-1: the author's own premise protects the names they chose.
      // Without it the ban list renamed Silas Bram to Nolan Bram on the live run.
      buildNameExclusionBlock([...new Set([...AI_FAVORITE_NAMES, ...getAllBlockedNames(), ..._usedNames])], _resolvedSeed),
      // PREMISE-FIDELITY-1: state the brief's entities as a requirement up front.
      // Without it, Silas Bram — named in the premise as the steward who hands over
      // the key and dies in ch.3 — simply never arrived in the character sheet.
      buildPremiseCoverageBlock(_premiseEntities),
      GLOBAL_NAME_HYGIENE_PROMPT_BLOCK,
    ].filter(Boolean).join('\n\n');
    setBusyLabel('Step 1/2 — Analyzing premise…');
    const settingsResponse = await invokeLLMWithRetry({
      task_type: 'foundation',
      prompt: buildExpandSettingsPrompt(_resolvedSeed, bookType, settingsDrafts),
      response_json_schema: expandSettingsSchema,
      model: pickModel('foundation', { ...settingsDrafts, book_type: bookType }),
      spec: settingsDrafts,
      _project: { ...settingsDrafts, book_type: bookType }, // ADULTROUTE-1
      fallback_model: pickFallbackModel('foundation', project),
    });
    const settings = unwrapIntegrationResult(settingsResponse);
    if (!settings || !settings.title) {
      console.warn('[FOUNDATION] Settings analysis returned empty or invalid result. Aborting expand.');
      toast.error('Story bible build aborted — settings analysis returned nothing. Nothing was saved.');
      setBusyLabel('');
      return;
    }

    const targetWords = settings.chapter_length_target || 3500;
    const closestPreset = Object.entries(CHAPTER_LENGTH_PRESETS)
      .map(([key, val]) => ({ key, delta: Math.abs(val.words - targetWords) }))
      .sort((a, b) => a.delta - b.delta)[0]?.key || 'standard';

    // PROTECT USER'S CHAPTER COUNT: never let LLM override it
    const userChapterTarget = Number(settingsDrafts.chapter_target) || 20;
    const userChapterLengthTarget = Number(settingsDrafts.chapter_length_target) || 3500;
    console.log('[CHAPTERS] User set:', userChapterTarget, '| Expand settings suggested:', settings.chapter_target || 'none', '| Keeping user value.');

    // DO NOT call updateSettingsDrafts here — it triggers auto-save
    // which overwrites the user's Setup fields. The LLM suggestions
    // are only used as context for bible generation below.
    const newSettings = {
      ...settingsDrafts,
      // Keep all user-set fields, only fill in blanks
      target_audience: settingsDrafts.target_audience || settings.target_audience || '',
      chapter_target: userChapterTarget,
      chapter_length_preset: settingsDrafts.chapter_length_preset || closestPreset,
      chapter_length_target: userChapterLengthTarget,
      target_chapter_words: userChapterLengthTarget,
      total_word_target: userChapterTarget * userChapterLengthTarget,
    };

    // Step 2: Foundation generation — parallel batches
    setBusyLabel('Step 2/2 — Building story bible (sequential — several minutes on local models)…');
    // RESUME-1: a PARTIAL foundation means the previous attempt was interrupted -
    // resume it. A COMPLETE one means the user deliberately asked for a rebuild -
    // regenerate it. Measured on The Gilded Hour: a dropped HMR socket threw away
    // four minutes of finished work and restarted at world (1/6), because there was
    // no resume path at all. Fields below their length floor do not count as present,
    // so a short field can never be carried past the field guard.
    const _existingDocs = Object.fromEntries(
      BIBLE_RESUMABLE_FIELDS.map((f) => [f, docDrafts?.[f] || project?.[f] || '']),
    );
    const _have = BIBLE_RESUMABLE_FIELDS.filter((f) => String(_existingDocs[f] || '').trim().length > 0);
    const _resumeFrom = (_have.length > 0 && _have.length < BIBLE_RESUMABLE_FIELDS.length) ? _existingDocs : {};
    console.log(
      `[RESUME-1] foundation state: ${_have.length}/${BIBLE_RESUMABLE_FIELDS.length} fields present -> `
      + (Object.keys(_resumeFrom).length ? 'resuming interrupted run' : 'generating all fields'),
    );
    const foundation = await generateBibleParallel(
      _resolvedSeed,
      { ...newSettings, book_type: bookType, research_data: project.research_data },
      {
        onProgress: (label) => setBusyLabel(formatProgressLabel(label)),
        nameBlock: _nameBlock,
        resumeFrom: _resumeFrom,
      }
    );

    // PREMISE-FIDELITY-1: verify afterwards, so a silent loss becomes a visible one.
    reportPremiseCoverage(
      _premiseEntities,
      [foundation.world_md, foundation.characters_md, foundation.canon_md,
        foundation.mystery_md, foundation.outline_md].filter(Boolean).join('\n'),
      'story bible',
    );

    const newDocs = {
      world_md: foundation.world_md || '',
      characters_md: foundation.characters_md || '',
      outline_md: foundation.outline_md || '',
      canon_md: foundation.canon_md || '',
      voice_md: foundation.voice_md || '',
      mystery_md: foundation.mystery_md || '',
      twists_md: foundation.twists_md || '',
    };
    setDocDrafts(newDocs);

    const plannedChapters = Array.isArray(foundation.chapters) ? foundation.chapters : [];

    const expandSavePayload = foundationSafeUpdate(enforceChapterCount({
      ...newDocs,
      foundation_score: foundation.foundation_score || 0,
      current_focus: foundation.current_focus || 'Review expanded foundation',
      phase: 'drafting', status: 'ready',
      iteration: (project.iteration || 0) + 1,
    }, userChapterTarget), project);
    // Belt-and-suspenders: never let AI overwrite twist settings
    delete expandSavePayload.num_twists;
    delete expandSavePayload.twist_count;
    delete expandSavePayload.twist_intensity;
    delete expandSavePayload.twists;
    // STOREDEDUPE-2: pass the id; the update on the next line already has it.
    const _safeExpandPayload = await prepareFoundationPayload(expandSavePayload, project.id);
    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _safeExpandPayload));
    setBusyLabel('Foundation: Creating chapters…');
    await clearAndCreateChapters(plannedChapters, userChapterTarget, project.id, newDocs.outline_md);
    } catch (err) {
      console.error('[FOUNDATION] Story bible build FAILED — nothing was saved:', err);
      toast.error(`Story bible build failed — nothing was saved. ${err?.message || err}`);
    } finally { setBusyLabel(''); }
    await refreshAll();
  };

  const handleSaveDocs = async () => {
    // STOREDEDUPE-2: without this the manual Save filed blobs under "unknown-project".
    let docsPayload = await prepareFoundationPayload({ ...docDrafts }, project?.id || projectId);
    if (docsPayload.research_md && docsPayload.research_md.length > 10000) {
      const rf = await prepareResearchContent(docsPayload.research_md, project?.id || projectId); docsPayload.research_md = rf.research_md; docsPayload.research_md_url = rf.research_md_url;
    }
    await saveProject.mutateAsync(docsPayload);
  };


  const formatNonfictionResearchMarkdown = (data, topicTitle = '') => {
    const safeArray = (value) => Array.isArray(value) ? value : [];
    const lines = [];

    lines.push('# Deep Research Brief');
    lines.push('');
    lines.push(`Generated for: ${project?.title || 'Untitled Project'}`);
    if (topicTitle) lines.push(`Research topic: ${topicTitle}`);
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Research Purpose');
    lines.push('This brief stores the nonfiction research foundation used by the story bible, drafting system, bibliography tooling, and source-aware manuscript workflow.');
    lines.push('');

    lines.push('## Key People & Figures');
    const figures = safeArray(data?.key_figures);
    if (figures.length) {
      figures.forEach((item) => {
        lines.push(`### ${item.name || 'Unnamed figure'}`);
        if (item.role) lines.push(`**Role:** ${item.role}`);
        if (item.dates_active) lines.push(`**Dates active:** ${item.dates_active}`);
        if (item.documented_actions) lines.push(`**Documented actions:** ${item.documented_actions}`);
        if (item.source_types) lines.push(`**Source types:** ${item.source_types}`);
        if (item.quote) lines.push(`**In their words:** "${item.quote}"`);
        lines.push('');
      });
    } else {
      lines.push('- No key figures returned.');
      lines.push('');
    }

    lines.push('## Key Events & Incidents');
    const events = safeArray(data?.key_events);
    if (events.length) {
      events.forEach((item) => {
        lines.push(`### ${item.event || 'Unnamed event'}`);
        if (item.date) lines.push(`**Date:** ${item.date}`);
        if (item.description) lines.push(`**Description:** ${item.description}`);
        if (item.sources) lines.push(`**Sources / source types:** ${item.sources}`);
        lines.push('');
      });
    } else {
      lines.push('- No key events returned.');
      lines.push('');
    }

    lines.push('## Key Institutions & Organizations');
    const institutions = safeArray(data?.institutions);
    if (institutions.length) {
      institutions.forEach((item) => {
        lines.push(`### ${item.name || 'Unnamed institution'}`);
        if (item.role) lines.push(`**Role:** ${item.role}`);
        if (item.period) lines.push(`**Period:** ${item.period}`);
        lines.push('');
      });
    } else {
      lines.push('- No institutions returned.');
      lines.push('');
    }

    lines.push('## Timeline');
    const timeline = safeArray(data?.timeline);
    if (timeline.length) {
      timeline.forEach((item) => {
        lines.push(`- **${item.date || 'Undated'}:** ${item.event || ''}`);
      });
      lines.push('');
    } else {
      lines.push('- No timeline returned.');
      lines.push('');
    }

    lines.push('## Primary Sources Available');
    const primarySources = safeArray(data?.primary_sources);
    if (primarySources.length) {
      primarySources.forEach((item) => {
        lines.push(`### ${item.source_type || 'Source type'}`);
        if (item.description) lines.push(item.description);
        if (item.availability) lines.push(`**Availability:** ${item.availability}`);
        lines.push('');
      });
    } else {
      lines.push('- No primary-source categories returned.');
      lines.push('');
    }

    const keyDocuments = safeArray(data?.key_documents);
    if (keyDocuments.length) {
      lines.push('## Key Documents (verbatim excerpts)');
      keyDocuments.forEach((item) => {
        lines.push(`### ${item.name || 'Document'}`);
        if (item.date) lines.push(`**Date:** ${item.date}`);
        if (item.issuer) lines.push(`**Issued by:** ${item.issuer}`);
        if (item.verbatim_excerpt) lines.push(`**In its own words:** "${item.verbatim_excerpt}"`);
        if (item.significance) lines.push(`**Significance:** ${item.significance}`);
        if (item.source) lines.push(`**Source:** ${item.source}`);
        lines.push('');
      });
    }

    lines.push('## Competing Narratives / Evidence Tensions');
    const narratives = safeArray(data?.competing_narratives);
    if (narratives.length) {
      narratives.forEach((item, idx) => {
        lines.push(`### Narrative Conflict ${idx + 1}`);
        if (item.official_story) lines.push(`**Official story:** ${item.official_story}`);
        if (item.evidence_counter) lines.push(`**Evidence counter:** ${item.evidence_counter}`);
        if (item.key_evidence) lines.push(`**Key evidence:** ${item.key_evidence}`);
        lines.push('');
      });
    } else {
      lines.push('- No competing narratives returned.');
      lines.push('');
    }

    lines.push('## Raw Structured Research JSON');
    lines.push('```json');
    lines.push(JSON.stringify(data || {}, null, 2));
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  };

  const researchSchema = {
    type: 'object',
    properties: {
      key_figures: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, dates_active: { type: 'string' }, documented_actions: { type: 'string' }, source_types: { type: 'string' }, quote: { type: 'string' } } } },
      key_events: { type: 'array', items: { type: 'object', properties: { event: { type: 'string' }, date: { type: 'string' }, description: { type: 'string' }, sources: { type: 'string' } } } },
      institutions: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, period: { type: 'string' } } } },
      timeline: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, event: { type: 'string' } } } },
      primary_sources: { type: 'array', items: { type: 'object', properties: { source_type: { type: 'string' }, description: { type: 'string' }, availability: { type: 'string' } } } },
      key_documents: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, date: { type: 'string' }, issuer: { type: 'string' }, verbatim_excerpt: { type: 'string' }, significance: { type: 'string' }, source: { type: 'string' } } } },
      competing_narratives: { type: 'array', items: { type: 'object', properties: { official_story: { type: 'string' }, evidence_counter: { type: 'string' }, key_evidence: { type: 'string' } } } },
    },
    required: ['key_figures', 'key_events', 'institutions', 'timeline', 'primary_sources', 'competing_narratives'],
  };

  const SEARCH_BRIDGE = '/search-bridge'; // NETFIX-1: proxied same-origin

  // Call the local bridge for search; never throw to the UI.
  const bridgeSearch = async (query, n = 8) => {
    try {
      const r = await fetch(`${SEARCH_BRIDGE}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, n }),
      });
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j?.results) ? j.results : [];
    } catch {
      return [];
    }
  };

  // Call the local bridge to FETCH + extract page text (deep content, not snippets).
  const bridgeFetch = async (url) => {
    try {
      const r = await fetch(`${SEARCH_BRIDGE}/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) return '';
      const j = await r.json();
      return typeof j?.text === 'string' ? j.text : '';
    } catch {
      return '';
    }
  };

  const executeResearchPipeline = async (queries, subject, topic, appendToExisting = false) => {
    try {
      setBusyLabel('Deep research — searching sources…');

      const seen = new Set();
      const hits = [];
      for (const q of queries) {
        const results = await bridgeSearch(q, 8);
        for (const res of results) {
          if (res?.url && !seen.has(res.url)) {
            seen.add(res.url);
            hits.push(res);
          }
        }
        // RESEARCHQUALITY-1: pace searches so the searxng engines do not
        // rate-limit and suspend mid-run (the 300ms burst did exactly that).
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!hits.length) {
        toast.error('Search bridge returned no results. Is it running on :8899?');
        setBusyLabel('');
        return;
      }

      // Fetch full page text for many sources (deep content for grounding).
      const TOP_TO_FETCH = 24;
      const pages = [];
      // RESEARCHFETCH-1: rank the fetch set by RELEVANCE to the book's subject +
      // focus terms so genuinely on-topic sources are fetched, instead of letting
      // keyword-noise archive pages (loc.gov / Chronicling-America newspapers) fill
      // every slot and starve the real sources (root cause of the empty Molasses
      // brief: 20 loc.gov items crowded out every relevant open-web source).
      // Archive-ness is only a tiebreak among equally-relevant hits; falls back to
      // input order when nothing scores. Book-agnostic (relevance from the brief).
      const fetchFocusTerms = extractFocusTerms(topic, subject);
      const toFetch = rankFetchCandidates({ hits, subject, focusTerms: fetchFocusTerms, limit: TOP_TO_FETCH });
      for (let i = 0; i < toFetch.length; i++) {
        const h = toFetch[i];
        setBusyLabel(`Deep research — reading sources ${i + 1}/${toFetch.length}…`);
        const text = await bridgeFetch(h.url);
        pages.push({
          title: h.title || 'Untitled',
          url: h.url,
          snippet: h.snippet || '',
          content: text ? text.slice(0, 6000) : '',
        });
        await new Promise((r) => setTimeout(r, 300));
      }

      // Only pages we pulled real text from go to extraction; fall back to all if none.
      const richPages = pages.filter((p) => p.content);
      // RESEARCH FLOOR GUARD: never ship a starved brief. A thin brief silently
      // starves the writer, and a starved writer fabricates (proven root cause
      // of the failed Chapter 1 draft). Abort loudly instead.
      if (richPages.length < 8) {
        toast.error(`Deep research aborted: only ${richPages.length} source page(s) returned real text (minimum 8). Check the search bridge, then retry.`);
        setBusyLabel('');
        return;
      }
      const extractionPages = richPages;

      // Extract in BATCHES. One capped LLM call over everything can only emit a
      // handful of facts no matter how much we feed it — that is why research came
      // back thin. Small batches each get their own output budget, so real facts
      // accumulate into a deep record. Sequential loop only (never Promise.all).
      // Batch by CHARACTER BUDGET, not page count. Four 15K corpus volumes in one
      // fixed-count batch overflowed the researcher model's context and silently
      // destroyed every witness extraction in that batch (root cause of three
      // consecutive briefs losing all Texas testimony). A large page now gets a
      // batch to itself, which also gives dense primary sources the model's full
      // extraction budget. Max 5 pages per batch still applies.
      const BATCH_CHAR_BUDGET = 20000;
      const batches = [];
      let current = [];
      let currentChars = 0;
      for (const p of extractionPages) {
        const size = (p.content || p.snippet || '').length;
        if (current.length && (currentChars + size > BATCH_CHAR_BUDGET || current.length >= 5)) {
          batches.push(current);
          current = [];
          currentChars = 0;
        }
        current.push(p);
        currentChars += size;
      }
      if (current.length) batches.push(current);

      let merged = {
        key_figures: [],
        key_events: [],
        institutions: [],
        timeline: [],
        primary_sources: [],
        competing_narratives: [],
        key_documents: [],
      };

      let existingObj = null;
      if (appendToExisting) {
        try {
          existingObj = JSON.parse(project.research_data || '{}');
          merged = {
            key_figures: existingObj.key_figures || [],
            key_events: existingObj.key_events || [],
            institutions: existingObj.institutions || [],
            timeline: existingObj.timeline || [],
            primary_sources: existingObj.primary_sources || [],
            competing_narratives: existingObj.competing_narratives || [],
            key_documents: existingObj.key_documents || [],
          };
        } catch { }
      }

      const seenKeys = {
        key_figures: new Set(),
        key_events: new Set(),
        institutions: new Set(),
        timeline: new Set(),
        primary_sources: new Set(),
        competing_narratives: new Set(),
        key_documents: new Set(),
      };
      const stripTitles = (name) =>
        (name || '')
          .replace(/^(president|union major general|confederate general|union general|major general|brigadier general|lieutenant general|maj\.? gen\.?|lt\.? gen\.?|general|gen\.?|colonel|col\.?|captain|capt\.?|lieutenant|lt\.?|sergeant|sgt\.?|major|maj\.?|reverend|rev\.?|honorable|hon\.?|dr\.?|mr\.?|mrs\.?|ms\.?|sir|the)\s+/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
      const dedupeKeyFor = (bucket, item) => {
        if (bucket === 'key_figures') return stripTitles(item.name);
        if (bucket === 'key_events') return (item.event || '').trim().toLowerCase();
        if (bucket === 'institutions') return stripTitles(item.name);
        if (bucket === 'timeline') return ((item.date || '') + '|' + (item.event || '')).trim().toLowerCase();
        if (bucket === 'primary_sources') return (item.source_type || '').trim().toLowerCase();
        if (bucket === 'competing_narratives') return (item.official_story || '').trim().toLowerCase();
        if (bucket === 'key_documents') return ((item.name || '') + '|' + (item.date || '')).trim().toLowerCase();
        return JSON.stringify(item).toLowerCase();
      };

      // Seed seenKeys with existing data so we don't duplicate
      if (appendToExisting) {
        Object.keys(merged).forEach(bucket => {
          if (Array.isArray(merged[bucket])) {
            merged[bucket].forEach(item => {
               if (item && typeof item === 'object') {
                  const k = dedupeKeyFor(bucket, item);
                  if (k) seenKeys[bucket].add(k);
               }
            });
          }
        });
      }

      // ARCH2-3: integrity guards below must only judge figures ADDED in this
      // run. Pre-existing figures were verified against their own run's pages,
      // which are not in this run's fetch set — re-judging them wipes good quotes.
      const preExistingFigKeys = new Set(seenKeys.key_figures);

      const mergeBucket = (bucket, arr) => {
        if (!Array.isArray(arr)) return;
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          const k = dedupeKeyFor(bucket, item);
          if (!k || seenKeys[bucket].has(k)) continue;
          seenKeys[bucket].add(k);
          merged[bucket].push(item);
        }
      };

      const quoteRule = (project.nf_structure_mode === 'investigative' || project.nf_structure_mode === 'narrative')
        ? '- VERBATIM QUOTE: For each person drawn from first-person testimony, also capture ONE short verbatim quote (about 5-25 words) of their own words from the source text, copied EXACTLY as written — preserve the original or dialect spelling, do NOT modernize or paraphrase. Put it in the "quote" field. If the source gives no usable first-person words for that person, leave "quote" empty. Never fabricate or paraphrase a quote.\n' +
          '- DATES DISCIPLINE: For dates_active, use ONLY years or dates that appear in the source text for that person (e.g., a stated birth year, or the interview year). If the source states no dates for that person, write "UNVERIFIED". NEVER infer, estimate, or invent birth or death years. A quote belongs to exactly ONE person — the narrator whose own section contains it. NEVER assign the same quote to more than one person; if you cannot tell whose section a quote belongs to, leave "quote" empty for all uncertain people.'
        : '- Do NOT include verbatim quotes. Leave the "quote" field empty for every figure; record only who each person was and what they documented or described.';

      let failedBatches = 0; // RESEARCHFAIL-1
      for (let b = 0; b < batches.length; b++) {
        setBusyLabel(`Deep research — extracting facts (batch ${b + 1}/${batches.length})…`);
        const batch = batches[b];

        const groundingBlock = [
          'REAL WEB SEARCH RESULTS — YOUR ONLY ALLOWED SOURCES.',
          'Use ONLY the facts, names, dates, quotations, and documents found below.',
          'Cite the specific URL for every documented claim. If a needed fact is not',
          'present here, mark it UNVERIFIED. Do not invent sources, names, dates, or',
          'documents. Forbidden filler: "the available accounts", "archival summaries reveal".',
          '',
          batch.map((p, i) => {
            const body = p.content || p.snippet || '(no extract available)';
            return `[${i + 1}] ${p.title}\nURL: ${p.url}\n${body}`;
          }).join('\n\n---\n\n'),
          '',
          'END OF ALLOWED SOURCES.',
        ].join('\n');

        try {
          const partial = await invokeResearchLLM({
            prompt: `${groundingBlock}

You are a deep-dive research assistant for an investigative nonfiction book.

MISSION:
Using ONLY the real sources above, extract verified, documented, source-aware facts. Do not invent facts, names, events, dates, documents, or sources. Every entity you list must trace to one of the sources above; attach the source URL it came from. If something is not supported by the sources above, omit it. Do NOT invent entries to reach any target number — if these sources contain only a few real facts, return only those few. Volume comes from real sources, never from padding.

TOPIC:
${topic}

EXTRACTION RULES:
- Extract EVERY real, documented person, event, institution, date, public record, official document, archival trail, court record, newspaper account, and academic source that actually appears in THESE sources.
- Pull specific named people and specific documents wherever the sources name them — these are the backbone of an honest forensic chapter.
- TESTIMONY & FIRST-PERSON SOURCES: When a source contains first-person testimony, oral-history interviews, depositions, letters, diaries, or named-interviewee material (for example WPA / Federal Writers' Project slave narratives, oral histories, witness statements), treat EVERY named individual in it as a real, documented person and add them to key_figures — even when the only documented facts are their name, what they described or experienced, and where or when it was recorded. Use that source's own URL. A person named in such a record IS documented; do not skip them for lacking a formal title or office. Record names as written in the source; if a name is clearly garbled by scanning, keep the most legible form and do not change it into a different name.
- SCOPE DISCIPLINE: key_figures may only contain narrators and witnesses drawn from testimony sources that match the TOPIC's place and subject. If a fetched source is a parallel collection from a DIFFERENT state, region, or subject (for example, an Alabama, Georgia, or Carolina narrative volume when the TOPIC is Texas), you may list that source in primary_sources as background, but you must NOT add its narrators to key_figures and must NOT take quotes from it. A witness from the wrong collection is contamination, not coverage.
- DOCUMENT GROUNDING (key_documents): When a source contains the text of a foundational or official document — a proclamation, executive order, military order, statute, treaty, court ruling, or similar — add it to key_documents with its name, date, and issuer, and capture a short VERBATIM excerpt (roughly 30-90 words) of its OPERATIVE language, copied EXACTLY as written. Prioritize clauses that define scope: lists of states, places, or people; effective dates; who is bound and who is exempt. Never paraphrase inside verbatim_excerpt, never trim a list of places down to a summary, and leave verbatim_excerpt empty if the document's actual text is not present in these sources. These excerpts are the book's legal and factual ground truth.
- Separate documented facts from disputed claims.
- Include competing narratives only where these sources actually contest each other.
- For each item, set source_types / sources to the real URL(s) above.
${quoteRule}

Return structured JSON:
- key_figures: array of {name, role, dates_active, documented_actions, source_types, quote}
- key_events: array of {event, date, description, sources}
- institutions: array of {name, role, period}
- timeline: array of {date, event}
- primary_sources: array of {source_type, description, availability}
- key_documents: array of {name, date, issuer, verbatim_excerpt, significance, source}
- competing_narratives: array of {official_story, evidence_counter, key_evidence}`,
            response_json_schema: researchSchema,
          });

          if (partial && typeof partial === 'object') {
            // ARCH-2: the researcher layer is closed-world too — every atom
            // (name/event/institution, year, month-year, number) the LLM
            // wrote into this batch's extraction must substring-match the
            // batch's own fetched pages, or it is a fabrication one level
            // upstream of drafting.
            const { kept: verifiedPartial, dropped: droppedAtoms } = verifyExtractedAtoms(partial, batch);
            const keptCount = ATOM_BUCKETS.reduce((n, bucket) => n + (verifiedPartial[bucket]?.length || 0), 0);
            console.log(`[ARCH-2] batch ${b + 1}: kept ${keptCount} item(s), dropped ${droppedAtoms.length} unsupported atom(s)`);
            mergeBucket('key_figures', verifiedPartial.key_figures);
            mergeBucket('key_events', verifiedPartial.key_events);
            mergeBucket('institutions', verifiedPartial.institutions);
            mergeBucket('timeline', verifiedPartial.timeline);
            mergeBucket('primary_sources', verifiedPartial.primary_sources);
            mergeBucket('competing_narratives', verifiedPartial.competing_narratives);
            mergeBucket('key_documents', verifiedPartial.key_documents);
          }
        } catch (batchErr) {
          failedBatches++; // RESEARCHFAIL-1
          console.warn('[RESEARCH] batch ' + (b + 1) + '/' + batches.length + ' failed, skipping: ' + (batchErr?.message || batchErr));
        }

        await new Promise((r) => setTimeout(r, 400));
      }

      const data = merged;

      // RESEARCHFAIL-1: a research run that extracted nothing must FAIL, loudly,
      // before anything is saved or marked complete. Measured 2026-08-06: the
      // researcher model did not exist, all 10 extraction batches errored, and the
      // run still saved an empty brief and toasted success — one click away from a
      // story bible generated from an empty closed world (i.e., pure fabrication).
      // Failing loud is the standing design rule ("nothing was saved").
      const totalExtracted = ['key_figures', 'key_events', 'institutions', 'timeline', 'primary_sources', 'competing_narratives', 'key_documents']
        .reduce((n, k) => n + ((data[k] || []).length), 0);
      if (failedBatches >= batches.length && batches.length > 0) {
        throw new Error('research extraction failed: all ' + batches.length + ' batches errored (check the researcher model routing) — nothing was saved');
      }
      if (totalExtracted === 0) {
        throw new Error('research extracted zero documented items from ' + pages.filter((p) => p.content).length + ' fetched sources — nothing was saved');
      }
      if (failedBatches > 0) {
        toast.warning('Research completed with ' + failedBatches + '/' + batches.length + ' failed extraction batches — coverage may be thin.');
      }
      setResearchData(data);

      // RESEARCHORDER-1: the save used to happen HERE — before the duplicate-quote
      // guard and the verbatim/attribution-binding guard (GATEFIX-13) below. Their
      // blanking then happened in memory only, and refreshAll() reloaded the
      // UN-blanked quotes from the DB. The save now runs after the guards.

      // EXTRACTION INTEGRITY: a verbatim quote belongs to exactly one narrator. If the
      // extractor assigned the same quote to multiple people, only the first keeps it —
      // a misattributed witness quote in nonfiction is as bad as a fabricated one.
      const seenQuotes = new Set();
      for (const f of data.key_figures || []) {
        const q = (f.quote || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!q) continue;
        if (preExistingFigKeys.has(stripTitles(f.name))) { seenQuotes.add(q); continue; }
        if (seenQuotes.has(q)) {
          console.warn('[RESEARCH-INTEGRITY] duplicate quote blanked for', f.name);
          f.quote = '';
        } else {
          seenQuotes.add(q);
        }
      }

      // QUOTE VERBATIM GUARD v2 — ATTRIBUTION BINDING (GATEFIX-13): a witness quote
      // must exist verbatim on at least one fetched page that ALSO names that witness.
      // A quote that exists somewhere in the run but never on a page mentioning its
      // speaker is a misattribution (real words, wrong mouth) and is blanked exactly
      // like a fabricated quote. This guard fails SAFE: an honestly-empty quote beats
      // a wrongly-attributed one.
      const normQuote = (s) => (s || '')
        .toLowerCase()
        .replace(/[‘’']/g, '')
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const normPages = (pages || []).map((p) => normQuote(p.content || ''));
      for (const f of data.key_figures || []) {
        if (preExistingFigKeys.has(stripTitles(f.name))) continue;
        const q = normQuote(f.quote);
        if (!q || q.split(' ').length < 4) continue;
        const nameTokens = normQuote(f.name).split(' ').filter((t) => t.length >= 3);
        const nameKey = nameTokens.length ? nameTokens[nameTokens.length - 1] : '';
        let foundAnywhere = false;
        let foundWithName = false;
        for (const pg of normPages) {
          if (!pg.includes(q)) continue;
          foundAnywhere = true;
          if (!nameKey || pg.includes(nameKey)) { foundWithName = true; break; }
        }
        if (!foundAnywhere) {
          console.warn('[RESEARCH-INTEGRITY] quote not found verbatim in sources — blanked for', f.name);
          f.quote = '';
        } else if (!foundWithName) {
          console.warn('[RESEARCH-INTEGRITY] quote not attributable — no source page contains both the quote and', f.name, '— blanked');
          f.quote = '';
        }
      }

      // RESEARCHQUALITY-2D: deterministic fate enrichment from the already-fetched
      // pages. For each figure, sentences containing BOTH the figure's surname and a
      // fate-class word are COPIED verbatim (whitespace-collapsed) into that figure's
      // own entry as fate_notes, with the page URL and a cross-page source count —
      // single-source fates stay visibly weak. No LLM call, no summarization, no new
      // claims: the corpus sentence is the note. Existing fate_notes are never
      // overwritten. The ledger's own-entry attestation reads fate_notes with zero
      // ledger changes.
      try {
        let enrichedCount = 0;
        for (const fig of data.key_figures || []) {
          if (!fig || fig.fate_notes) continue;
          const notes = selectFateSentences({ pages: richPages, figureName: fig.name });
          if (notes.length) { fig.fate_notes = formatFateNotes(notes); enrichedCount++; }
        }
        console.log('[FATE-ENRICH] ' + enrichedCount + ' figure(s) gained fate notes from ' + richPages.length + ' fetched page(s)');
      } catch (feErr) { console.warn('[FATE-ENRICH] enrichment pass failed safely:', feErr?.message); }

      // RESEARCHORDER-1: persist AFTER the integrity guards so blanked quotes stay blanked.
      const researchMd = formatNonfictionResearchMarkdown(data, subject);
      const researchFields = await prepareResearchContent(researchMd, project.id);

      setDocDrafts((current) => ({
        ...current,
        research_md: researchMd,
      }));

      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, {
        research_data: JSON.stringify(data),
        ...researchFields,
      }));

      const figs = (data.key_figures || []).length;
      const evs = (data.key_events || []).length;
      toast.success(`Deep research saved — ${pages.filter((p) => p.content).length} sources read, ${figs} figures, ${evs} events.`);
      await refreshAll();
    } catch (error) {
      console.error('[RESEARCH] Deep research failed:', error);
      toast.error('Deep research failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  const handleResearch = async () => {
    if (!project) return;

    const topic = await resolveSeedConcept(project) || settingsDrafts.seed_concept || '';
    if (!topic.trim()) {
      toast.error('Add a seed concept/topic before running deep research.');
      return;
    }

    // RERESEARCH-CONFIRM-1: this handler always REPLACES research_data/
    // research_md (executeResearchPipeline's appendToExisting is false
    // below) and is the same function bound to both the first-run "Research
    // This Topic" button and the "Re-Research" button — the gate is a no-op
    // (no dialog, no snapshot) whenever there's little/nothing to lose.
    // Runs AFTER the topic check above so confirming re-research on a
    // project that's missing a seed concept doesn't snapshot research it's
    // about to abort re-running anyway.
    const { proceed, info } = shouldRunReResearch(project, (msg) => window.confirm(msg));
    if (!proceed) return;
    if (info.needsConfirm) {
      try {
        await snapshotResearchBeforeReResearch(project);
      } catch (snapErr) {
        console.error('[RERESEARCH-CONFIRM-1] snapshot failed, aborting re-research:', snapErr);
        toast.error('Could not snapshot existing research; re-research was not started.');
        return;
      }
    }

    // RESEARCHQUALITY-1: focus-term queries first, capped total, built by the
    // pure query builder (src/lib/researchQueryBuilder.js). The old title-first
    // 14-35 query burst suspended the searxng engines before the high-signal
    // queries ran.
    const { subject, focusTerms, queries } = buildResearchQueries({
      title: project.title,
      topic,
      nfStructureMode: project.nf_structure_mode,
    });
    console.log(`[RESEARCH] [RESEARCHQUALITY-1] ${queries.length} queries (focus terms: ${focusTerms.join(', ') || 'none'})`);

    await executeResearchPipeline(queries, subject, topic, false);
  };

  const handleOutlineResearch = async () => {
    if (!project) return;

    const topic = await resolveSeedConcept(project) || settingsDrafts.seed_concept || '';
    if (!topic.trim()) {
      toast.error('Add a seed concept/topic before running outline research.');
      return;
    }

    const rawTitle = (project.title || '').trim();
    const firstLine = (topic.split('\n').find((l) => l.trim().length > 0) || topic).trim();
    let subject = (rawTitle || firstLine)
      .replace(/^(author|book title|title)\s*[:\-]?\s*/i, '')
      .replace(/[*_#>]/g, '')
      .replace(/["“”']/g, '')
      .split(/[:\-—]/)[0]
      .trim()
      .slice(0, 80);
    if (!subject) subject = firstLine.slice(0, 80);

    const missingTopics = new Set();
    const activeChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
    for (const ch of activeChapters) {
      const cov = researchCoverageCheck(ch, project);
      if (cov && cov.missingCount > 0) {
        for (const m of cov.missing) missingTopics.add(m);
      }
    }

    if (missingTopics.size === 0) {
      toast.success('Outline is already fully covered by existing research data.');
      return;
    }

    const queries = [];
    for (const m of missingTopics) {
      queries.push(`${subject} ${m}`);
      if (queries.length > 20) break; // cap to 20 queries so we don't spam the bridge
    }

    await executeResearchPipeline(queries, subject, topic, true);
  };

  // RESEARCHQUALITY-2D: targeted fate research. Builds one query per figure that
  // carries no fate evidence yet (capped at 24), fetches through the standard
  // pipeline in append mode, and lets the deterministic enrichment pass copy
  // fate sentences from whatever the queries bring back.
  const handleFateResearch = async () => {
    if (!project) return;

    const topic = await resolveSeedConcept(project) || settingsDrafts.seed_concept || '';
    if (!topic.trim()) {
      toast.error('Add a seed concept/topic before running fate research.');
      return;
    }

    const rawTitle = (project.title || '').trim();
    const firstLine = (topic.split('\n').find((l) => l.trim().length > 0) || topic).trim();
    let subject = (rawTitle || firstLine)
      .replace(/^(author|book title|title)\s*[:\-]?\s*/i, '')
      .replace(/[*_#>]/g, '')
      .replace(/["“”']/g, '')
      .split(/[:\-—]/)[0]
      .trim()
      .slice(0, 80);
    if (!subject) subject = firstLine.slice(0, 80);

    const needing = figuresNeedingFates(project.research_data);
    if (!needing.length) {
      toast.success('Every researched figure already carries fate evidence.');
      return;
    }

    const queries = [];
    for (const name of needing) {
      queries.push(name + ' ' + subject);
      if (queries.length >= 24) break;
    }

    await executeResearchPipeline(queries, subject, topic, true);
  };

  const handleSaveResearch = async (newData) => {
    setResearchData(newData);

    const topic = await resolveSeedConcept(project) || settingsDrafts.seed_concept || '';
    const researchMd = formatNonfictionResearchMarkdown(newData, topic);
    const researchFields = await prepareResearchContent(researchMd, project?.id || projectId);

    setDocDrafts((current) => ({
      ...current,
      research_md: researchMd,
    }));

    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, {
      research_data: JSON.stringify(newData),
      ...researchFields,
    }));
  };


  const handleRepairChapterMetadata = async () => {
    if (!project?.id || !chapters.length || busyLabel) return;

    const proceed = window.confirm(
      'Repair missing/generic chapter titles and descriptions?\n\n' +
      'This updates chapter metadata only. It will not change manuscript prose.'
    );

    if (!proceed) return;

    setBusyLabel('Repairing chapter titles and descriptions…');

    try {
      const resolvedResearch = project?.research_md_url
        ? await resolveResearchContent(project).catch(() => project?.research_md || '')
        : project?.research_md || '';

      const repaired = await repairChapterMetadata({
        project: {
          ...project,
          ...docDrafts,
          seed_concept: settingsDrafts.seed_concept || project.seed_concept || '',
          research_md: resolvedResearch || docDrafts.research_md || project.research_md || '',
        },
        chapters,
        onProgress: (label) => setBusyLabel(formatProgressLabel(label)),
      });

      await refreshAll();

      if (repaired.changed > 0) {
        toast.success(`Chapter metadata repaired: ${repaired.changed} updated.`);
      } else {
        toast.info('No missing/generic chapter metadata found.');
      }
    } catch (error) {
      console.error('[CHAPTER-METADATA] Repair failed:', error);
      toast.error('Chapter metadata repair failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedChapter) return;

    const contentFields = await prepareChapterContent(
      chapterDraft,
      project?.id || projectId,
      selectedChapter.id,
      selectedChapter
    );

    await saveChapter.mutateAsync({
      id: selectedChapter.id,
      payload: {
        ...contentFields,
        word_count: countWords(chapterDraft),
      },
    });
  };

  // VERSIONS-1: every save records previous_content_md_url (prepareChapterContent);
  // this is the real save path back — through Chapter.update (saveChapter's
  // mutation), verified the same way any other chapter save is, never a
  // direct edit outside it.
  // VERSIONS-1B: a chapter saved before VERSIONS-1 landed never got
  // previous_content_md_url — fall back to the version immediately before
  // the current one in the store's own history (findImmediatelyOlderVersion).
  // Still only ever a single saveChapter.mutateAsync call either way.
  // VERSIONS-1C: a restore is itself a save, so it must record what it
  // replaced too — otherwise a restore is a dead end (live: Ch.10's
  // previous_content_md_url was empty right after a restore, so the restore
  // itself could never be undone the same way).
  const handleRestorePreviousVersion = async (chapter) => {
    const targetUrl = chapter?.previous_content_md_url || await findImmediatelyOlderVersion(chapter);
    if (!targetUrl) {
      toast.error('No previous version to restore.');
      return;
    }
    setBusyLabel(`Restoring Ch.${chapter.chapter_number} previous version…`);
    try {
      await saveChapter.mutateAsync({
        id: chapter.id,
        payload: {
          ...clearRichContentFields(),
          content_md: '',
          content_md_url: targetUrl,
          previous_content_md_url: chapter?.content_md_url || '',
        },
      });
      if (chapter.id === selectedChapterId) {
        const restored = await resolveChapterContent({ ...chapter, content_md: '', content_md_url: targetUrl });
        setChapterDraft(restored);
      }
      await refreshAll();
      toast.success(`Restored Ch.${chapter.chapter_number} to its previous version.`);
    } finally {
      setBusyLabel('');
    }
  };

  // ── SAFE REJECTED CHAPTER REPLACEMENT ──
  // Replaces hard-failed chapter content through the safety gate,
  // clearing all stale content fields to prevent old contaminated text
  // from remaining in the export resolution path.
  const handleSafeReplaceRejectedChapter = async (chapter, repairedText) => {
    if (!chapter?.id) {
      toast.error('No chapter selected for replacement.');
      return { ok: false, reason: 'No chapter' };
    }

    setBusyLabel(`Safe-replacing Ch.${chapter.chapter_number}…`);

    try {
      const result = await safeReplaceChapterContent(chapter, repairedText, {
        projectId: project?.id || projectId,
        projectType: project?.project_type || 'fiction',
        saveFn: (id, payload) => runWithNetworkRetry(() => base44.entities.Chapter.update(id, payload)),
        stage: 'manual-replacement',
      });

      if (!result.ok) {
        console.error('[SAFE-REPLACE-UI] Replacement rejected:', result.reason);
        toast.error(
          `Chapter ${chapter.chapter_number} replacement REJECTED: ${result.reason}\n` +
          `Fix the replacement text and try again.`
        );
        setBusyLabel('');
        return result;
      }

      // Update the editor state if this is the currently selected chapter
      if (chapter.id === selectedChapterId) {
        setChapterDraft(repairedText);
      }

      // Invalidate queries to force re-fetch from DB
      await refreshAll();

      // Verify the replacement took effect by resolving the chapter content
      const updatedChapters = queryClient.getQueryData(['novel-chapters', projectId]) || [];
      const updatedChapter = updatedChapters.find(c => c?.id === chapter.id);
      if (updatedChapter) {
        const resolvedContent = await resolveChapterContent(updatedChapter);
        const verify = verifySafeReplacement(resolvedContent, updatedChapter, {
          projectType: project?.project_type || 'fiction',
        });

        if (!verify.ok) {
          console.error('[SAFE-REPLACE-UI] Post-replacement verification FAILED — stale content may persist');
          toast.error(
            `⚠️ Chapter ${chapter.chapter_number}: saved but resolved content STILL fails safety gate. ` +
            `Stale content may persist in content_md_url or legacy fields.`
          );
        } else {
          console.log('[SAFE-REPLACE-UI] Post-replacement verification PASSED');
        }
      }

      toast.success(
        `✅ Chapter ${chapter.chapter_number} safely replaced. ` +
        `${result.wordCount} words, gate PASS. ` +
        `${result.gate.processLeaks} leaks, ${result.gate.contamination} contamination.`
      );

      setBusyLabel('');
      return result;
    } catch (err) {
      console.error('[SAFE-REPLACE-UI] Error:', err);
      toast.error(`Chapter ${chapter.chapter_number} replacement error: ${err?.message || 'Unknown error'}`);
      setBusyLabel('');
      return { ok: false, reason: err?.message || 'Unknown error' };
    }
  };

  // Auto-save hooks — WAVE5-SETTINGS: interval comes from Settings (10–120s, default 60)
  const autosaveMs = Math.min(120, Math.max(10, Number(getSetting('autosave_interval', 60)))) * 1000;
  const settingsAutoSave = useAutoSave(settingsDrafts, handleSaveSettings, { delay: autosaveMs, enabled: !!project });
  const docsAutoSave = useAutoSave(docDrafts, handleSaveDocs, { delay: autosaveMs, enabled: !!project });
  const chapterAutoSave = useAutoSave(chapterDraft, handleSaveChapter, { delay: autosaveMs, enabled: !!selectedChapter });

  // Expose safe replacement handler on window for browser console use.
  // Usage: window.__UBS_SAFE_REPLACE(chapterNumber, repairedText)
  // The handler finds the chapter by number, runs the safety gate, saves, and verifies.
  React.useEffect(() => {
    if (typeof window !== 'undefined' && chapters?.length) {
      window.__UBS_SAFE_REPLACE = async (chapterNumber, repairedText) => {
        const ch = chapters.find(c => c?.chapter_number === chapterNumber);
        if (!ch) { console.error(`[SAFE-REPLACE] Chapter ${chapterNumber} not found`); return { ok: false }; }
        return handleSafeReplaceRejectedChapter(ch, repairedText);
      };
      console.log('[SAFE-REPLACE] window.__UBS_SAFE_REPLACE(chapterNumber, text) ready');
    }
  }, [chapters, project, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateFoundation = async () => {
    // BIBLEROUTE-1: single bible entrypoint. This button used to run a LEGACY
    // one-shot foundation builder - one LLM call returning all seven bible
    // docs plus every chapter in a single JSON. Result: stub-length fields
    // (world/canon/voice under 500 chars, no token budget for more) and a
    // complete bypass of the gated pipeline (batch generation, outline
    // distinctness gate + targeted repair, leak scrub, name gate). All bible
    // building now routes through the same gated flow as Setup's Build Story
    // Bible; handleExpand also saves settings, resolves the seed, and
    // branches anthology projects itself.
    await handleExpand();
  };

  const generateSceneBeats = async (chapter, allChapters, generationProjectOverride) => {
    // NARRATIVE-CONNECT-1: beat planning must use a fresh chapter list and the
    // fully resolved foundation. URL-backed bible fields are blank on the raw
    // entity by design; sending that raw entity to the architect silently
    // removes the story bible from the prompt.
    const chapterList = allChapters || await base44.entities.Chapter.filter(
      { project_id: projectId },
      'chapter_number',
      200
    );
    const generationProject = generationProjectOverride || await hydrateProjectForGeneration(project);
    const promptProject = buildNameHygieneEnhancedProject(generationProject);
    // Anthology: each story is standalone — no previous chapter context for beats
    const previousChapter = isAnthologyProject(promptProject) ? null : chapterList.find((item) => item.chapter_number === chapter.chapter_number - 1);
    const isNonfiction = isNonfictionProjectAuthority(promptProject);
    // Resolve previous chapter content from URL if needed
    const resolvedPrev = previousChapter ? { ...previousChapter, content_md: await resolveChapterContent(previousChapter) } : null;
    const schema = getSceneBeatSchema(promptProject);
    const beatModel = pickModel('beats', promptProject);
    console.log('[BEATS] Beat model:', beatModel);
    // NARRATIVE-CONNECT-3: prior-chapter coverage memory for the PLANNER.
    // buildRollingContext reads each earlier chapter's saved summary_json and
    // falls back to its beat_summary when the summary is not written yet. The
    // prose writer has always received this; the beat planner never did, so it
    // could re-plan an event an earlier chapter already used. Anthologies are
    // standalone per story, and Ch.1 has no prior chapters.
    let priorCoverage = '';
    if (!isAnthologyProject(promptProject) && Number(chapter.chapter_number) > 1) {
      try {
        priorCoverage = await buildRollingContext(projectId, Number(chapter.chapter_number));
      } catch (coverageError) {
        // Fail open: a coverage lookup failure must not block planning, but it
        // must be visible in the console rather than silently degrading.
        console.warn('[NARRATIVE-CONNECT] Prior-chapter coverage unavailable for the beat planner:', coverageError?.message || coverageError);
        priorCoverage = '';
      }
    }
    // EVENTLEDGER-1A: the summaries above under-describe what earlier chapters
    // actually executed (Ch.1's summary never mentioned the Thompson store scene
    // its beat contract staged). Prepend the deterministic event ledger built
    // from the persisted beat contracts so the planner sees completed EVENTS,
    // not just summaries. Prepended, not appended: the block must survive the
    // 9000-char clip in buildSceneBeatPrompt.
    let ledgerEvents = [];
    // CHARSTATE-2C (live proof Run 3, Arc D, 2026-08-24): the departed cast
    // BEFORE this chapter's own plan runs — the beat validator below rejects
    // a plan that lists any of these names present in a scene before that
    // plan's own text declares (and corroborates) their return.
    let plannerDepartedNames = [];
    // LOOKAHEAD-1: sections of the outline for chapters AFTER this one — a
    // plan must never pull them forward. Independent of chapter_number > 1
    // (a lookahead leak is possible even for chapter 1).
    const futureOutlineSections = parseFutureOutlineSections(promptProject?.outline_md, Number(chapter.chapter_number));
    if (!isAnthologyProject(promptProject) && Number(chapter.chapter_number) > 1) {
      const eventLedger = buildPriorChapterEventLedger(chapterList, Number(chapter.chapter_number));
      ledgerEvents = eventLedger.events;
      if (eventLedger.text) priorCoverage = `${eventLedger.text}\n\n${priorCoverage}`;
      console.log('[EVENTLEDGER] Planner ledger:', ledgerEvents.length, 'prior events,', eventLedger.text.length, 'chars');

      // STATECONTRACT-1: the planner sees the full closed-world contract too
      // (cast/status, resolved arcs, style bans — no scene map yet, the
      // planner is what generates the scenes). Prepended like the event
      // ledger so it survives the prompt clip. Fail open.
      try {
        // PROSEFEED-1: content_md is empty for URL-stored chapters — resolve
        // the real prose, or the state machine builds from nothing.
        const statePriorRecords = chapterList
          .filter((prior) => Number(prior?.chapter_number) > 0 && Number(prior?.chapter_number) < Number(chapter.chapter_number))
          .sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
        const statePriorChapters = [];
        for (const prior of statePriorRecords) {
          try {
            const inline = String(prior?.content_md || '');
            const body = inline.length > 200 ? inline : String((await resolveChapterContent(prior)) || '');
            // CHARSTATE-2: carry declared beat events so planner state honors
            // planner-declared returns/departures the prose patterns miss.
            if (body.length > 200) statePriorChapters.push({ chapterNumber: Number(prior.chapter_number), text: body, beatEvents: collectChapterBeatEvents(prior) });
          } catch { /* fail open per chapter */ }
        }
        const stateCast = harvestCastNames(promptProject?.characters_md, statePriorChapters.map((c) => c.text));
        const stateContractResult = buildChapterStateContract({
          project: promptProject,
          chapter,
          resolvedPriorProse: statePriorChapters,
          normalizedScenes: [],
          allProjectChapters: chapterList,
          cast: stateCast,
        });
        plannerDepartedNames = stateContractResult.facts?.departed || [];
        if (stateContractResult.block) {
          priorCoverage = `${stateContractResult.block}\n\n${priorCoverage}`;
          console.log('[CHARSTATE] Planner contract:', stateContractResult.block.split('\n').length - 1, 'fact(s)');
        }
      } catch (stateError) {
        console.warn('[CHARSTATE] Planner state build failed (non-fatal):', stateError?.message || stateError);
      }
    }
    console.log('[NARRATIVE-CONNECT] Beat-planner prior coverage chars:', priorCoverage.length);
    let beatResult = null;
    try {
      const initialBeatPrompt = await buildSceneBeatPrompt(promptProject, chapter, resolvedPrev, chapterList, priorCoverage);
      let beatPrompt = initialBeatPrompt;
      const maxContractAttempts = isNonfiction ? 1 : 4;

      for (let attempt = 1; attempt <= maxContractAttempts; attempt += 1) {
        const beatResponse = await invokeLLMWithRetry({
          task_type: 'outline',
          prompt: beatPrompt,
          response_json_schema: schema,
          spec: promptProject,
          _project: promptProject, // ADULTROUTE-1
          model: beatModel,
          max_tokens: beatModel?.includes('lumimaid') ? 4096 : 8192,
          ...buildFallbackControls('beats', promptProject),
        });
        beatResult = unwrapIntegrationResult(beatResponse);

        if (isNonfiction) break;

        // LENGTHTUNE-2: this model writes ~1100-1300 words per scene almost regardless of the
        // per-scene word target, so a story's length is driven by its SCENE COUNT — and the
        // architect over-generates scenes for short pieces (asks ~2, returns 3-7), which is why
        // anthology stories ran 1900-3361 words against a 1500 target. For an anthology, cap the
        // scene count to the target (~round(target/1200): one scene per ~1200 words of realistic
        // output) by MERGING excess beats into that many contiguous groups — no plot beat is
        // dropped, the retained scenes each cover more of the arc. Runs BEFORE BEATIDCANON-1 so
        // the merged beats get renumbered/canonicalized next. Fiction anthology only; regular
        // novels and nonfiction keep the architect's scene count.
        if (isAnthologyProject(promptProject)) {
          const _lc = Array.isArray(beatResult) ? beatResult : (beatResult?.beats || beatResult?.scenes || beatResult?.sections || []);
          const _lt = Number(chapter.target_words || promptProject.chapter_length_target || promptProject.target_chapter_words || 0);
          const _cap = Math.max(1, Math.round(_lt / 1200));
          if (Array.isArray(_lc) && _lt > 0 && _lc.length > _cap) {
            const _uniq = (arr) => Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
            const _groups = Array.from({ length: _cap }, () => []);
            _lc.forEach((_b, _i) => { _groups[Math.floor((_i * _cap) / _lc.length)].push(_b); });
            const _merged = _groups.filter((g) => g.length).map((g) => {
              const _first = g[0] || {};
              const _last = g[g.length - 1] || {};
              return {
                ..._first,
                scene_goal: _uniq(g.map((b) => b && b.scene_goal)).join(' Then: ') || String(_first.scene_goal || ''),
                entry_state: String(_first.entry_state || '').trim(),
                exit_state: String(_last.exit_state || _first.exit_state || '').trim(),
                required_events: _uniq(g.flatMap((b) => (Array.isArray(b && b.required_events) ? b.required_events : []))),
                forbidden_events: _uniq(g.flatMap((b) => (Array.isArray(b && b.forbidden_events) ? b.forbidden_events : []))),
              };
            });
            _lc.splice(0, _lc.length, ..._merged);
          }
        }

        // BEATIDCANON-1: scene_id and scene_number are POSITIONAL — fully determined by the
        // chapter number and the beat's index — so assign them deterministically here rather
        // than trust the architect model, which (esp. r1-14b) emits loose/wrong ids
        // ("ch1-s1" for Chapter 2) that the NO-RETRY contract validator rejects, killing
        // every chapter. Also backfill the four hard-required narrative fields the same
        // validator demands (scene_goal, entry_state, exit_state, one non-empty
        // required_events) when the terse reasoning model omits them, so a missing field
        // degrades to a generic placeholder instead of failing the chapter with no retry.
        // Runs on the SAME container the raw-provenance capture reads next, so pipeline_contract,
        // extraction, provenance and validateSceneBeatContracts all agree. Fiction only
        // (nonfiction broke out above; its beats use a different agent and path).
        {
          const _bc = Array.isArray(beatResult) ? beatResult : (beatResult?.beats || beatResult?.scenes || beatResult?.sections || []);
          const _cn = String(chapter.chapter_number).padStart(2, '0');
          _bc.forEach((_el, _i) => {
            if (!_el || typeof _el !== 'object') return;
            _el.scene_id = `ch${_cn}-s${String(_i + 1).padStart(2, '0')}`;
            _el.scene_number = _i + 1;
            if (!String(_el.scene_goal || '').trim()) _el.scene_goal = `Advance the story through beat ${_i + 1}.`;
            if (!String(_el.entry_state || '').trim()) _el.entry_state = _i === 0 ? 'The story opens.' : 'Continues directly from the previous scene.';
            if (!String(_el.exit_state || '').trim()) _el.exit_state = 'The scene resolves and hands off to what follows.';
            if (!Array.isArray(_el.required_events) || !_el.required_events.some((_e) => String(_e || '').trim())) {
              _el.required_events = [String(_el.scene_goal || '').trim() || `Beat ${_i + 1} occurs.`];
            }
          });
        }

        // 1. CAPTURE RAW ARCHITECT STRUCTURE BEFORE EXTRACTION
        const rawContainer = Array.isArray(beatResult) ? beatResult : (beatResult?.beats || beatResult?.scenes || beatResult?.sections || []);
        const rawCount = rawContainer.length;
        const rawIndexes = [];
        const rawSceneNumbers = [];
        const rawSceneIds = [];
        const invalidIndexes = [];
        const invalidReasons = [];

        for (let i = 0; i < rawContainer.length; i++) {
          const el = rawContainer[i];
          rawIndexes.push(i);
          const sNum = Number(el?.scene_number || el?.sceneNumber || 0);
          if (sNum > 0) rawSceneNumbers.push(sNum);
          
          const sId = el?.scene_id || el?.id || `?`; // if undefined, preserve length
          if (sId !== '?') rawSceneIds.push(sId);

          const reasons = [];
          if (!el || typeof el !== 'object') reasons.push('Element is not an object');
          else {
            if (!sNum) reasons.push('Missing scene_number');
            if (sId === '?') reasons.push('Missing scene_id');
            if (!el.required_events || !Array.isArray(el.required_events)) reasons.push('Missing required_events array');
          }

          if (reasons.length > 0) {
            invalidIndexes.push(i);
            invalidReasons.push(reasons.join(', '));
          }
        }

        console.log(`[BEAT-PIPELINE-RAW]
rawCount=${rawCount}
rawIndexes=${JSON.stringify(rawIndexes)}
rawSceneNumbers=${JSON.stringify(rawSceneNumbers)}
rawSceneIds=${JSON.stringify(rawSceneIds)}
invalidIndexes=${JSON.stringify(invalidIndexes)}
invalidReasons=${JSON.stringify(invalidReasons)}`);

        // 2. DETECT NUMBER GAPS
        const expectedCountForGapCheck = rawSceneNumbers.length > 0 ? Math.max(...rawSceneNumbers) : rawCount;
        const expectedSequence = Array.from({ length: expectedCountForGapCheck }, (_, i) => i + 1);
        
        if (JSON.stringify(rawSceneNumbers) !== JSON.stringify(expectedSequence) && expectedCountForGapCheck > 1) {
          const missingSceneNumbers = expectedSequence.filter(n => !rawSceneNumbers.includes(n));
          throw new NarrativeInvariantError(`SCENE_SEQUENCE_GAP: Expected sequence ${JSON.stringify(expectedSequence)}, got ${JSON.stringify(rawSceneNumbers)}`, {
            code: 'SCENE_SEQUENCE_GAP',
            expectedSequence,
            actualSequence: rawSceneNumbers,
            missingSceneNumbers,
            failureStage: 'architect-raw'
          });
        }

        if (invalidIndexes.length > 0) {
          throw new NarrativeInvariantError(`SCENE_MALFORMED_IN_PIPELINE: Element at index ${invalidIndexes[0]} is malformed`, {
            code: 'SCENE_MALFORMED_IN_PIPELINE',
            malformedIndex: invalidIndexes[0],
            expectedSceneNumber: invalidIndexes[0] + 1,
            validationReasons: invalidReasons
          });
        }

        // 3. ESTABLISH PROVENANCE FROM RAW ARRAY POSITIONS
        if (!beatResult.pipeline_contract) {
          beatResult.pipeline_contract = {
            raw_scene_count: rawCount,
            expected_scene_count: rawCount,
            expected_scene_ids: rawSceneIds,
            expected_scene_numbers: rawSceneNumbers,
            raw_indexes: rawIndexes,
            source_stage: 'architect-raw'
          };
        }

        // 4. COMPARE RAW AGAINST EXTRACTED UNITS
        const parsedUnits = extractSceneBeatUnitsForValidation(beatResult);
        
        const extractedCount = parsedUnits.length;
        const extractedNumbers = parsedUnits.map(b => Number(b?.scene_number || b?.sceneNumber || 0)).filter(n => n > 0);
        const extractedIds = parsedUnits.map(b => b?.scene_id || b?.id).filter(Boolean);

        if (rawCount !== extractedCount || JSON.stringify(rawSceneNumbers) !== JSON.stringify(extractedNumbers) || JSON.stringify(rawSceneIds) !== JSON.stringify(extractedIds)) {
          throw new NarrativeInvariantError(`Loss detected during extractSceneBeatUnitsForValidation`, {
            code: 'SCENE_LOST_IN_PIPELINE',
            expectedSceneIds: rawSceneIds,
            actualSceneIds: extractedIds,
            missingSceneIds: rawSceneIds.filter(id => !extractedIds.includes(id)),
            failureStage: 'scene-unit-extraction'
          });
        }

        verifySceneProvenance(parsedUnits, beatResult.pipeline_contract, 'architect-parsed');
        verifyContiguousSceneSequence(parsedUnits, beatResult.pipeline_contract.expected_scene_count, 'architect-parsed');

        validateSceneBeatContracts(beatResult || {}, {
          chapterNumber: chapter.chapter_number,
        });
        const proposedBeats = Array.isArray(beatResult?.beats) ? beatResult.beats : [];
        verifySceneProvenance(proposedBeats, beatResult.pipeline_contract, 'before-normalization');
        verifyContiguousSceneSequence(proposedBeats, beatResult.pipeline_contract.expected_scene_count, 'before-normalization');
        const overlapReport = normalizeSceneBeatsForDrafting(proposedBeats, {
          isNonfiction: false,
          chapterNumber: chapter.chapter_number,
          chapterTitle: chapter.title || '',
          projectTitle: promptProject.title || '',
        });

        const normalizedBeatPlan = Array.isArray(overlapReport?.beats)
          ? overlapReport.beats
          : Array.isArray(overlapReport?.normalizedBeats)
            ? overlapReport.normalizedBeats
            : [];

        const originalCount = proposedBeats.length;
        const newCount = normalizedBeatPlan.length;
        if (newCount < originalCount && (!overlapReport.merged || overlapReport.merged < (originalCount - newCount))) {
          throw new NarrativeInvariantError(`Refusing to accept normalized beat contract for Ch.${chapter.chapter_number}: ${originalCount} → ${newCount} scenes without sufficient merge records. Loss detected.`, {
            code: 'SCENE_LOST_IN_PIPELINE',
            failureStage: 'after-normalization'
          });
        } else {
          console.log(`[BEAT-PIPELINE] Accepting normalized beat contract for Ch.${chapter.chapter_number}: ${originalCount} → ${newCount} distinct scenes.`);
        }

        verifySceneProvenance(normalizedBeatPlan, beatResult.pipeline_contract, 'after-normalization');
        verifyContiguousSceneSequence(normalizedBeatPlan, beatResult.pipeline_contract.expected_scene_count, 'after-normalization');

        // BEATPLAN-1: the schema marks setting/characters_present/emotional_arc
        // required, but the local endpoint does not enforce response schemas —
        // and empty setting/emotion fields also starve the overlap detector
        // above, which scores scenes by place/emotion keywords. That is how
        // three retellings of one location scored 0.48 and shipped. Enforce
        // field presence here, on the same regeneration path as overlap
        // rejection; at attempt exhaustion the existing fallback still accepts
        // the plan, so a missing field can never kill a chapter.
        const beatFieldGaps = [];
        for (const nb of normalizedBeatPlan) {
          const missing = [];
          if (!String(nb?.setting || nb?.location || '').trim()) missing.push('setting');
          const castCount = (Array.isArray(nb?.characters_present) ? nb.characters_present.length : 0)
            + (Array.isArray(nb?.characters) ? nb.characters.length : 0);
          if (castCount === 0) missing.push('characters_present');
          if (!String(nb?.emotional_arc || nb?.emotional_beat || '').trim()) missing.push('emotional_arc');
          // BEATEVENT-1: a scene whose required_events are ALL internal
          // (noticing, reflecting, discussing) hands the writer a word target
          // and no plot — the ch.1 re-draft proved the writer fills that
          // vacuum by stealing a later scene's event. Require one concrete,
          // externally visible event per scene. An event matching neither
          // verb class gets the benefit of the doubt (precision over recall).
          const beatEvents = Array.isArray(nb?.required_events) ? nb.required_events.filter(Boolean) : [];
          const INTERNAL_EVENT = /\b(?:notic\w*|reflect\w*|discuss\w*|consider\w*|realiz\w*|express\w*|feel\w*|felt|think\w*|thought|wonder\w*|remember\w*|observ\w*|watch\w*|sens\w*|contemplat\w*|recall\w*|ponder\w*|worr\w*|fear\w*)\b/i;
          const CONCRETE_EVENT = /\b(?:find\w*|found|discover\w*|take\w*|took|open\w*|unlock\w*|enter\w*|arriv\w*|leav\w*|left|escap\w*|fight\w*|fought|attack\w*|confront\w*|reveal\w*|give\w*|gave|hand\w*|hide\w*|hid|steal\w*|stole|break\w*|broke|fix\w*|repair\w*|climb\w*|run\w*|ran|grab\w*|read\w*|writ\w*|wrote|send\w*|sent|receiv\w*|kill\w*|die\w*|died|destroy\w*|build\w*|built|search\w*|follow\w*|chas\w*|meet\w*|met|call\w*|answer\w*|refus\w*|decid\w*|agree\w*|demand\w*|threaten\w*|shoot\w*|shot|cut\w*|seal\w*|collaps\w*|explod\w*|trigger\w*|activat\w*|shut\w*|start\w*|stop\w*|us\w*|show\w*|tell\w*|told|ask\w*|warn\w*|reach\w*|cross\w*|push\w*|pull\w*|turn\w*|insert\w*)\b/i;
          const hasConcreteEvent = beatEvents.some((ev) => CONCRETE_EVENT.test(String(ev)) || !INTERNAL_EVENT.test(String(ev)));
          if (beatEvents.length > 0 && !hasConcreteEvent) missing.push('a concrete story event (all required_events are internal/verbal)');
          if (missing.length) beatFieldGaps.push(`${nb?.scene_id || 'scene'}: missing ${missing.join(', ')}`);
        }
        if (beatFieldGaps.length) {
          console.warn(`[BEATPLAN-1] Ch.${chapter.chapter_number} attempt ${attempt}: ${beatFieldGaps.length} beat(s) missing required fields — ${beatFieldGaps.join(' | ')}`);
        }

        // BEATLOOP-1 (2026-08-05): overlapReport.changed is true whenever the normalizer
        // merely REPORTED a medium/high-confidence overlap. For fiction the normalizer KEEPS
        // both beats (with a continuity_warning) and merges NOTHING, so a report is advisory —
        // the plan is already usable. Breaking only on !changed forced a full architect
        // regeneration on every reported overlap; chapters whose scenes legitimately share
        // place/cast/function/emotion (resolution & final chapters especially) can never reach
        // zero reports, so they exhausted all 4 attempts (~12 min of deepseek) and shipped the
        // attempt-1 plan anyway via the exhaustion fallback below. Break on the absence of a
        // STRUCTURAL change instead; advisory reports still ride along as continuity_warning on
        // the kept beats (which is why we adopt normalizedBeatPlan before breaking).
        const structurallyChanged =
          (overlapReport.removed || 0) > 0 ||
          (overlapReport.merged || 0) > 0 ||
          (overlapReport.chronologyReordered || 0) > 0 ||
          (typeof overlapReport.finalCount === 'number' &&
            typeof overlapReport.originalCount === 'number' &&
            overlapReport.finalCount !== overlapReport.originalCount);
        // EVENTLEDGER-1A: a plan that re-introduces a character an earlier
        // chapter already brought on stage is rejected like any structural
        // defect (Lipstick Ch.2 re-introduced Mr. Thompson after Ch.1's beat
        // contract executed the store meeting).
        const reintroductions = ledgerEvents.length ? findReintroductions(normalizedBeatPlan, ledgerEvents) : [];
        if (reintroductions.length) {
          console.warn('[EVENTLEDGER] Beat plan re-introduces ledgered characters:', reintroductions);
        }
        // SCENECOLLIDE-1: a plan that re-STAGES a completed (entity, action)
        // pair — a second arrival of the rival team, a second departure, a
        // repeated revelation — is rejected like a reintroduction, regardless
        // of how the beat is worded.
        const beatCollisions = ledgerEvents.length ? findBeatEventCollisions(normalizedBeatPlan, ledgerEvents) : [];
        if (beatCollisions.length) {
          console.warn('[SCENECOLLIDE] Beat plan re-stages completed events:', beatCollisions);
        }
        // LOOKAHEAD-1 (live proof Run 3, Arc D, 2026-08-24): the mirror of
        // SCENECOLLIDE-1 — a plan that pulls a LATER chapter's outline
        // content forward, the way REDUX ch.10 lifted ch.11's sandstorm/JB
        // return wholesale to dodge a scenecollide rejection.
        const futureCollisions = futureOutlineSections.length ? findBeatFutureOutlineCollisions(normalizedBeatPlan, futureOutlineSections) : [];
        if (futureCollisions.length) {
          console.warn('[LOOKAHEAD] Beat plan pulls forward a future chapter\'s outline content:', futureCollisions);
        }
        // CHARSTATE-2C: a departed character listed present in a scene
        // BEFORE any scene of this SAME plan declares (and corroborates)
        // their return — independent of the whole-chapter status the state
        // contract prompt uses (live REDUX ch.10: all three scenes listed
        // JB present, including scene 1, before scene 2's "JB returns").
        const prematurePresence = plannerDepartedNames.length ? findPrematureCharacterPresence(normalizedBeatPlan, plannerDepartedNames) : [];
        if (prematurePresence.length) {
          console.warn('[CHARSTATE] Beat plan lists a departed character present before their own plan\'s return:', prematurePresence);
        }
        if (!structurallyChanged && beatFieldGaps.length === 0 && reintroductions.length === 0 && beatCollisions.length === 0 && futureCollisions.length === 0 && prematurePresence.length === 0) {
          beatResult.beats = normalizedBeatPlan;
          break;
        }
        if (!structurallyChanged && beatFieldGaps.length === 0 && (reintroductions.length > 0 || beatCollisions.length > 0 || futureCollisions.length > 0) && prematurePresence.length === 0 && attempt === maxContractAttempts) {
          // Attempts exhausted on reintroduction/collision alone: repair
          // deterministically rather than ship a duplicate or fail the chapter.
          // prematurePresence has no deterministic rewrite (removing a name from
          // characters_present risks silently dropping a required actor) — an
          // exhausted plan with only that finding falls through to the
          // existing "still overlapping after N attempts" acceptance below.
          let repairedBeats = normalizedBeatPlan;
          if (reintroductions.length) repairedBeats = rewriteReintroductions(repairedBeats, reintroductions);
          if (beatCollisions.length) repairedBeats = rewriteBeatCollisions(repairedBeats, beatCollisions);
          if (futureCollisions.length) repairedBeats = rewriteFutureOutlineCollisions(repairedBeats, futureCollisions);
          beatResult.beats = repairedBeats;
          console.warn('[SCENECOLLIDE] Attempts exhausted — rewrote colliding beat phrasing deterministically for', [...reintroductions.map((f) => f.name), ...beatCollisions.map((f) => `${f.entity}/${f.class}`), ...futureCollisions.map((f) => `${f.entity}/ch${f.chapter_number}`)].join(', '));
          break;
        }

        const reindexedNormalizedBeats = normalizedBeatPlan; // NARRATIVE-CONNECT: Do not reindex to hide the missing middle scene

        beatResult = {
            ...(beatResult || {}),
            beats: reindexedNormalizedBeats,
          };

          console.warn(
            `[NARRATIVE-CONNECT] Keeping original scene IDs for Ch.${chapter.chapter_number}: ` +
            reindexedNormalizedBeats.map((beat) => beat.scene_id).join(', ')
          );

          validateSceneBeatContracts(beatResult, {
            chapterNumber: chapter.chapter_number,
          });

        if (attempt === maxContractAttempts) {
          if (
            Array.isArray(normalizedBeatPlan) &&
            normalizedBeatPlan.length > 0
          ) {
            console.warn(
              `[NARRATIVE-CONNECT] Chapter ${chapter.chapter_number} still contained overlapping beats after ${maxContractAttempts} attempts. Using the validated normalized beat plan.`
            );
            beatResult.beats = normalizedBeatPlan;
            break;
          }

          const error = new Error(
            `Chapter ${chapter.chapter_number} beat contract rejected: scenes still overlap or compete for the same story function after regeneration. ${overlapReport.report}`
          );
          error.name = 'NarrativeInvariantError';
          error.code = 'SCENE_CONTRACT_OVERLAP_UNRESOLVED';
          error.narrativeContract = true;
          error.details = overlapReport;
          throw error;
        }

        console.warn('[NARRATIVE-CONNECT] Rejecting overlapping beat contract and regenerating:', overlapReport);
        const reintroductionLines = reintroductions.length
          ? `\nCHARACTERS ALREADY INTRODUCED IN EARLIER CHAPTERS — this plan wrongly stages a FIRST meeting for: ${reintroductions.map((f) => f.name).join(', ')}. They are already known to the crew; write their scenes as continuations, never introductions.`
          : '';
        const collisionLines = beatCollisions.length
          ? `\nEVENTS ALREADY COMPLETED — this plan wrongly re-stages: ${beatCollisions.map((f) => `${f.class.toLowerCase()} of ${f.entity} (already executed: "${f.event.slice(0, 90)}")`).join('; ')}. These events happened; plan beats that advance the CONSEQUENCES, never a repeat performance.`
          : '';
        const futureCollisionLines = futureCollisions.length
          ? `\nCONTENT THAT BELONGS TO A LATER CHAPTER — this plan wrongly stages: ${futureCollisions.map((f) => `${f.entity} (belongs to Chapter ${f.chapter_number}: "${f.title}")`).join('; ')}. Plan ONLY what THIS chapter's own outline section covers; leave later chapters' events for their own chapters.`
          : '';
        const prematurePresenceLines = prematurePresence.length
          ? `\nDEPARTED CHARACTER STAGED TOO EARLY — this plan lists ${[...new Set(prematurePresence.map((f) => f.name))].join(', ')} as present in a scene BEFORE any scene of this same plan writes their return. Either remove them from those earlier scenes' cast, or move the return event earlier in the scene order.`
          : '';
        beatPrompt = `${initialBeatPrompt}\n\nREJECTED BEAT CONTRACT — REGENERATE ALL SCENES:\nThe previous scene plan would be merged by the duplicate/chronology detector, which means it contains alternate takes or repeated story functions. Replace the plan completely. Keep the same chapter outcome, but give every scene one distinct irreversible job. Do not merge or omit any required chapter event.\n\nDetector report: ${overlapReport.report}\nSpecific problems:\n${(overlapReport.warnings || []).slice(0, 8).map((warning) => `- ${warning}`).join('\n')}${beatFieldGaps.length ? `\nEvery beat MUST fill these required fields — the previous plan left them empty:\n${beatFieldGaps.map((gap) => `- ${gap}`).join('\n')}` : ''}${reintroductionLines}${collisionLines}${futureCollisionLines}${prematurePresenceLines}\n\nReturn a completely new JSON beat contract.`;
      }
    } catch (beatError) {
      if (!isNonfiction) throw beatError;

      console.error(
        `[BEATS][NF-NO-LOCAL-FALLBACK v15.7] Ch.${chapter.chapter_number}: nonfiction beat generation failed. Refusing to create local source-governed fallback beats because that fallback was producing repeated boilerplate and contaminated chapter logic.`,
        beatError?.message || beatError
      );

      const message = beatError?.message || 'Unknown beat generation error';
      throw new Error(
        `Nonfiction beat generation failed for chapter ${chapter.chapter_number}. No local fallback was used, because fallback beats can poison the manuscript. Retry this chapter after the model/API recovers. Original error: ${message}`
      );
    }

    if (isNonfiction) {
      validateNonfictionBeatPlanForDrafting(beatResult || {}, chapter);
    } else {
      const contractReport = validateSceneBeatContracts(beatResult || {}, {
        chapterNumber: chapter.chapter_number,
      });
      console.log('[NARRATIVE-CONNECT] Scene contract accepted:', contractReport);
      // CHAPTERBRIDGE-1: advisory — put the prior chapter's actual ending and
      // this chapter's opening entry_state side by side in the console, so a
      // reset like ch.2 opening inside a station ch.1 ended outside of is
      // visible at plan time instead of after drafting.
      {
        const priorTail = String(resolvedPrev?.content_md || '').slice(-220).replace(/\s+/g, ' ').trim();
        const firstEntry = String(beatResult?.beats?.[0]?.entry_state || '').replace(/\s+/g, ' ').trim();
        if (priorTail && firstEntry) {
          console.log(`[CHAPTERBRIDGE-1] prior ending: "...${priorTail}" | ch.${chapter.chapter_number} s1 entry_state: "${firstEntry}"`);
        }
      }
    }

    const fullBeatsJson = JSON.stringify(beatResult || {}, null, 2);
    
    let parsedCount = 0;
    try {
      const parsed = typeof beatResult === 'string' ? JSON.parse(beatResult) : beatResult;
      parsedCount = (parsed.beats || parsed.scenes || parsed.sections || []).length;
    } catch(e) {}
    console.log(`[BEAT-PIPELINE] before-compact-save: ${parsedCount} scenes`);

    verifySceneProvenance(extractSceneBeatUnitsForValidation(beatResult), beatResult?.pipeline_contract, 'before-compact-save');
    const compactBeatsJson = compactSceneBeatsForEntity(beatResult || {}, chapter);

    console.log(`[BEAT-PIPELINE] after-compact-save: compacted length ${compactBeatsJson.length}`);

    console.log(
      `[BEATS][COMPACT-SAVE v15.8] Ch.${chapter.chapter_number}: full=${fullBeatsJson.length} chars, entity=${compactBeatsJson.length} chars`
    );

    await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
      scene_beats_json: compactBeatsJson,
      scene_beats_compacted: fullBeatsJson.length > compactBeatsJson.length,
      scene_beats_full_length: fullBeatsJson.length,
      status: chapter.status === 'planned' ? 'beats_ready' : chapter.status,
    }));

    // Return the full local beat plan to drafting. Only the DB/entity save is compacted.
    // This preserves writing quality while preventing Base44 field-size 400 errors.
    return fullBeatsJson;
  };

  const draftChapter = async (chapter, shouldRefresh = true, modelOverride, onProgress, options = {}) => {
    // ORCH-1: draftChapter is now a thin wrapper around the moved body in
    // chapterOrchestrator.js's runChapterDraft. deps carries every UI/global
    // the body touches; see that module's header for the full mapping.
    const deps = {
      Chapter: base44.entities.Chapter,
      NovelProject: base44.entities.NovelProject,
      invokeLLMWithRetry,
      pipelineSnapshot,
      onProgress: (event) => {
        if (event.stage === 'report') {
          if (onProgress) onProgress(event.label);
          else setBusyLabel(event.label);
        } else if (event.stage === 'busy-label') {
          setBusyLabel(event.label);
        } else if (event.stage === 'chapter-draft-updated') {
          if (event.chapterId === selectedChapterId) setChapterDraft(event.content);
        }
      },
      toast,
      refreshAll,
      runProjectContentGuardBeforeSave,
      generateSceneBeats,
      backupChapterBeforeGeneratedOverwrite,
      projectId,
      chapterProseModels,
      settingsDrafts,
    };
    return runChapterDraft({
      project,
      chapter,
      chapters,
      deps,
      options: { ...options, shouldRefresh, modelOverride },
    });
  };

  // ARCH2-5B: coverage gate. Fiction: advisory console log only - fiction beat
  // atoms (character names, moods, chapter titles) are not researchable facts
  // and a hard block made fiction undraftable. Nonfiction: show the gaps and
  // let the operator decide - real chapters run 70-95% coverage, so blocking
  // at missingCount > 0 would stop every draft; the banner's Auto-Research
  // Gaps button remains the primary path to close real gaps first.
  const coverageGateAllowsDrafting = (chaptersToCheck, label) => {
    const isNonfictionMode = isNonfictionProjectAuthority(project);
    const gaps = [];
    for (const ch of chaptersToCheck) {
      const cov = researchCoverageCheck(ch, project);
      if (cov && cov.missingCount > 0) gaps.push({ n: ch.chapter_number, missing: cov.missing.slice(0, 4), count: cov.missingCount });
    }
    if (!gaps.length) return true;
    if (!isNonfictionMode) {
      console.log('[RESEARCH-COVERAGE] advisory (' + label + '): ' + gaps.map(g => 'Ch.' + g.n + ' missing ' + g.count + ' atom(s)').join(', '));
      return true;
    }
    const detail = gaps.slice(0, 6).map(g => 'Ch.' + g.n + ': ' + g.missing.join(', ')).join('\n');
    return confirmDestructiveChapterAction(label + ': ' + gaps.length + ' chapter(s) have outline topics missing from the research.\n\n' + detail + '\n\nRecommended: use Auto-Research Gaps first. Draft anyway? (The writer may invent unsupported facts for the missing topics.)');
  };

  const handleDraftSelected = async () => {
    if (!project || !selectedChapter || busyLabel) return;

    // ARCH2-5B: fiction advisory / nonfiction operator-confirmed gate
    if (!coverageGateAllowsDrafting([selectedChapter], 'Draft')) return;

    const persistedContent = chapterHasPersistedManuscriptContent(selectedChapter);
    const unsavedEditorContent = !persistedContent && chapterDraft?.trim().length > 0;

    if (persistedContent || unsavedEditorContent) {
      const ok = confirmDestructiveChapterAction(
        `Drafting Chapter ${selectedChapter.chapter_number} will replace the current chapter text. A backup will be attempted first if saved manuscript content exists. Continue?`
      );
      if (!ok) return;
    }

    captureSnapshot(`Draft Ch.${selectedChapter.chapter_number}`);
    setBusyLabel(`Drafting chapter ${selectedChapter.chapter_number}…`);
    try {
      await draftChapter(selectedChapter, true, chapterProseModels[selectedChapter.id], undefined, {
        backupBeforeOverwrite: persistedContent,
        backupReason: `Before Draft Chapter — Ch.${selectedChapter.chapter_number}`,
      });
    } catch (err) {
      console.error('Draft failed:', err);
      toast.error(`Drafting chapter ${selectedChapter.chapter_number} failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBusyLabel('');
      await refreshAll();
    }
  };

  const handleDraftAll = async () => {
    if (!project || busyLabel) return;
    captureSnapshot('Draft All Remaining');
    stopRequestedRef.current = false;

    let freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);

    // BIBLEGATE-1: the bible must be complete and parseable before drafting.
    // Fiction only — nonfiction casts are sources, not characters.
    if (!isNonfictionProjectAuthority(project)) {
      const bibleAudit = auditBibleCompleteness({ project, chapters: freshChapters });
      console.log('[BIBLEGATE] handleDraftAll audit:', JSON.stringify(bibleAudit));
      if (!bibleAudit.ok) {
        const parts = [];
        if (bibleAudit.missing.length) {
          parts.push(`missing entries: ${bibleAudit.missing.map((m) => `${m.name} (${m.mentions}x in outline/beats)`).join(', ')}`);
        }
        if (bibleAudit.malformedHeaders.length) {
          parts.push(`malformed headers: ${bibleAudit.malformedHeaders.map((h) => `"${h.header}" (${h.reason})`).join('; ')}`);
        }
        toast.error(`Story bible incomplete — fix before drafting: ${parts.join(' | ')}`);
        return;
      }
    }

    const draftableCandidates = freshChapters.filter((ch) => (ch.status === 'planned' || ch.status === 'beats_ready' || ch.status === 'error') && isBodyChapter(ch));
    const skippedWithContent = draftableCandidates.filter((ch) => chapterHasPersistedManuscriptContent(ch));
    const remaining = draftableCandidates
      .filter((ch) => !chapterHasPersistedManuscriptContent(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    // ARCH2-5B: fiction advisory / nonfiction operator-confirmed gate
    if (!coverageGateAllowsDrafting(remaining, 'Draft All')) return;

    if (skippedWithContent.length) {
      toast.info(`Draft All skipped ${skippedWithContent.length} chapter(s) that already contain manuscript text. Use Rewrite for drafted chapters.`);
    }

    if (!remaining.length) {
      toast.info('No empty planned chapters found to draft. Use Rewrite for chapters that already have text.');
      return;
    }

    const isAnthologyMode = project.project_type === 'anthology';
    const isNonfictionMode = isNonfictionProjectAuthority(project);
    const isParallelMode = isAnthologyMode || isNonfictionMode;
    const total = remaining.length;
    const failures = [];
    const useFastDraftAll = true;

    console.log(`[DRAFT ALL] Mode: ${isParallelMode ? 'parallel mode (anthology/nonfiction)' : 'sequential continuity-safe mode (fiction/novel)'}`);
    console.log('[DRAFT ALL] Batch generation mode: DRAFT-ONLY. Polish is handled by Fix Manuscript afterward.');
    console.log(`[DRAFT ALL] Chapters to draft:`, remaining.map(c => ({ id: c.id, num: c.chapter_number })));

    const seed = {};
    for (const ch of remaining) seed[ch.id] = 'queued…';
    setChapterProgress(seed);

    setBusyLabel(isParallelMode
      ? `Drafting ${total} remaining chapters in controlled parallel…`
      : `Sequentially drafting ${total} remaining chapters…`);

    try {
      if (isParallelMode) {
        const laneLimit = isNonfictionMode ? NONFICTION_DRAFT_LANE_LIMIT : (isAnthologyMode ? ANTHOLOGY_DRAFT_LANE_LIMIT : PARALLEL_DRAFT_LANE_LIMIT);
        console.log(`[DRAFT ALL] Controlled parallel mode active: launching ${remaining.length} chapter(s) through ${laneLimit} lane(s)`);

        const results = await runParallelDraftPool(remaining, async (chapter) => {
          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            console.log(`[DRAFT-CH-${chapter.chapter_number}] onProgress fired:`, label, '→', safeLabel);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            return await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastDraftAll,
            });
          } finally {
            console.log(`[DRAFT-CH-${chapter.chapter_number}] Finally: clearing from chapterProgress`);
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
          }
        }, { limit: laneLimit });

        for (const r of results) {
          if (r.status === 'rejected') {
            failures.push({ chapter: r.chapter.chapter_number, error: r.reason?.message || 'Unknown error' });
            console.error(`[DRAFT ALL] Ch.${r.chapter.chapter_number} failed:`, r.reason);
          }
        }

        console.log(`[DRAFT ALL] Complete: ${results.filter(r => r.status === 'fulfilled').length}/${remaining.length} parallel succeeded, ${failures.length} failed`);
      } else {
        // Fiction/novel mode: fully sequential from the first remaining chapter to the last.
        // No anchor-then-parallel split. Each successful chapter is saved and the chapter
        // list is refreshed before the next chapter starts, so continuity summaries and
        // previous-chapter text can carry forward naturally.
        for (let ci = 0; ci < remaining.length; ci++) {
          if (stopRequestedRef.current) break;

          const chapter = remaining[ci];
          setBusyLabel(`Sequential draft: chapter ${chapter.chapter_number} (${ci + 1}/${remaining.length})…`);

          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            const draftResult = await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastDraftAll,
            });

            if (draftResult?.content) {
              chapter.content_md = draftResult.content;
              chapter.__freshDraftContent = draftResult.content;
            }

            // Keep the existing safe refresh for now. Fast mode already removes the heavy
            // judge/revision/postDraftCleanup calls; this refresh preserves continuity safety.
            freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
          } catch (e) {
            console.error(`[DRAFT ALL] Ch.${chapter.chapter_number} failed:`, e);
            failures.push({ chapter: chapter.chapter_number, error: e?.message || 'Unknown error' });
          } finally {
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
            // Refresh UI after each chapter so completed drafts show immediately
            try { await refreshAll(); } catch {}
          }
        }
      }

      const finalChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
      const _draftAllPayload = protectedProjectUpdate({
        chapter_count: finalChapters.filter((c) => c.status === 'drafted' || c.status === 'reviewed').length,
        status: 'ready',
      });
      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _draftAllPayload));
    } finally {
      stopRequestedRef.current = false;
      setChapterProgress({});
      if (failures.length) {
        setBusyLabel(`Done — ${failures.length} failed: ${failures.map(f => 'Ch.' + f.chapter).join(', ')}`);
      } else {
        setBusyLabel('');
      }
    }
    await refreshAll();

    // ── Draft integrity report: read chapters back from DB, not in-memory ──
    try {
      const integrityReport = await computeDraftIntegrityReport(projectId, isBodyChapter);
      setDraftIntegrityReport(integrityReport);
      if (integrityReport.emptyChapterNumbers.length > 0) {
        console.warn(`[DRAFT-INTEGRITY] ${integrityReport.emptyChapterNumbers.length} chapters have empty/sub-100-word content after Draft All`);
      }
    } catch (integrityErr) {
      console.error('[DRAFT-INTEGRITY] Failed to compute integrity report:', integrityErr);
    }
  };

  const handleRedraftAllFresh = async () => {
    if (!project || busyLabel) return;
    const ok = confirm('Re-draft ALL chapters from scratch? This regenerates every chapter (current text is snapshotted for undo).');
    if (!ok) return;

    captureSnapshot('Re-draft All Fresh');
    stopRequestedRef.current = false;

    let freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
    const remaining = freshChapters
      .filter((ch) => isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    // ARCH2-5B: fiction advisory / nonfiction operator-confirmed gate
    if (!coverageGateAllowsDrafting(remaining, 'Re-draft All')) return;

    if (!remaining.length) {
      toast.info('No body chapters found to re-draft.');
      return;
    }

    const isAnthologyMode = project.project_type === 'anthology';
    const isNonfictionMode = isNonfictionProjectAuthority(project);
    const isParallelMode = isAnthologyMode || isNonfictionMode;
    const total = remaining.length;
    const failures = [];
    const useFastDraftAll = true;

    console.log(`[REDRAFT ALL] Mode: ${isParallelMode ? 'parallel mode (anthology/nonfiction)' : 'sequential continuity-safe mode (fiction/novel)'}`);
    console.log('[REDRAFT ALL] Batch generation mode: DRAFT-ONLY. Polish is handled by Fix Manuscript afterward.');
    console.log(`[REDRAFT ALL] Chapters to draft:`, remaining.map(c => ({ id: c.id, num: c.chapter_number })));

    const seed = {};
    for (const ch of remaining) seed[ch.id] = 'queued…';
    setChapterProgress(seed);

    setBusyLabel(isParallelMode
      ? `Re-drafting ${total} chapters in controlled parallel…`
      : `Sequentially re-drafting ${total} chapters…`);

    try {
      if (isParallelMode) {
        const laneLimit = isNonfictionMode ? NONFICTION_DRAFT_LANE_LIMIT : (isAnthologyMode ? ANTHOLOGY_DRAFT_LANE_LIMIT : PARALLEL_DRAFT_LANE_LIMIT);
        console.log(`[REDRAFT ALL] Controlled parallel mode active: launching ${remaining.length} chapter(s) through ${laneLimit} lane(s)`);

        const results = await runParallelDraftPool(remaining, async (chapter) => {
          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            console.log(`[REDRAFT-CH-${chapter.chapter_number}] onProgress fired:`, label, '→', safeLabel);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            return await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastDraftAll,
            });
          } finally {
            console.log(`[REDRAFT-CH-${chapter.chapter_number}] Finally: clearing from chapterProgress`);
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
          }
        }, { limit: laneLimit });

        for (const r of results) {
          if (r.status === 'rejected') {
            failures.push({ chapter: r.chapter.chapter_number, error: r.reason?.message || 'Unknown error' });
            console.error(`[REDRAFT ALL] Ch.${r.chapter.chapter_number} failed:`, r.reason);
          }
        }

        console.log(`[REDRAFT ALL] Complete: ${results.filter(r => r.status === 'fulfilled').length}/${remaining.length} parallel succeeded, ${failures.length} failed`);
      } else {
        // Fiction/novel mode: fully sequential.
        for (let ci = 0; ci < remaining.length; ci++) {
          if (stopRequestedRef.current) break;

          const chapter = remaining[ci];
          setBusyLabel(`Sequential re-draft: chapter ${chapter.chapter_number} (${ci + 1}/${remaining.length})…`);

          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            const draftResult = await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastDraftAll,
            });

            if (draftResult?.content) {
              chapter.content_md = draftResult.content;
              chapter.__freshDraftContent = draftResult.content;
            }

            freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
          } catch (e) {
            console.error(`[REDRAFT ALL] Ch.${chapter.chapter_number} failed:`, e);
            failures.push({ chapter: chapter.chapter_number, error: e?.message || 'Unknown error' });
          } finally {
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
            try { await refreshAll(); } catch {}
          }
        }
      }

      const finalChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
      const _draftAllPayload = protectedProjectUpdate({
        chapter_count: finalChapters.filter((c) => c.status === 'drafted' || c.status === 'reviewed').length,
        status: 'ready',
      });
      await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _draftAllPayload));
    } finally {
      stopRequestedRef.current = false;
      setChapterProgress({});
      if (failures.length) {
        setBusyLabel(`Done — ${failures.length} failed: ${failures.map(f => 'Ch.' + f.chapter).join(', ')}`);
      } else {
        setBusyLabel('');
      }
    }
    await refreshAll();

    // ── Draft integrity report: read chapters back from DB, not in-memory ──
    try {
      const integrityReport = await computeDraftIntegrityReport(projectId, isBodyChapter);
      setDraftIntegrityReport(integrityReport);
      if (integrityReport.emptyChapterNumbers.length > 0) {
        console.warn(`[DRAFT-INTEGRITY] ${integrityReport.emptyChapterNumbers.length} chapters have empty/sub-100-word content after Re-draft All Fresh`);
      }
    } catch (integrityErr) {
      console.error('[DRAFT-INTEGRITY] Failed to compute integrity report:', integrityErr);
    }
  };

  const handleStop = () => {
    stopRequestedRef.current = true;
  };

  // ── Re-draft only the empty/failed chapters from the integrity report ──
  const handleRedraftEmpty = async () => {
    if (!project || busyLabel || !draftIntegrityReport) return;
    const emptyIds = new Set(draftIntegrityReport.emptyChapterIds || []);
    if (!emptyIds.size) return;

    captureSnapshot('Re-draft empty chapters');
    stopRequestedRef.current = false;
    setDraftIntegrityReport(null); // clear the banner during re-draft

    // Fetch fresh chapters from DB — not in-memory state
    const freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
    const remaining = freshChapters
      .filter((ch) => emptyIds.has(ch.id) && isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    if (!remaining.length) {
      toast.info('No empty chapters found to re-draft.');
      return;
    }

    const isNonfictionMode = isNonfictionProjectAuthority(project);
    const isAnthologyMode = project.project_type === 'anthology';
    const isParallelMode = isAnthologyMode || isNonfictionMode;
    const failures = [];
    const total = remaining.length;

    const seed = {};
    for (const ch of remaining) seed[ch.id] = 'queued…';
    setChapterProgress(seed);

    setBusyLabel(`Re-drafting ${total} empty chapter(s)…`);

    try {
      if (isParallelMode) {
        const laneLimit = isNonfictionMode ? NONFICTION_DRAFT_LANE_LIMIT : (isAnthologyMode ? ANTHOLOGY_DRAFT_LANE_LIMIT : PARALLEL_DRAFT_LANE_LIMIT);
        const results = await runParallelDraftPool(remaining, async (chapter) => {
          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };
          try {
            return await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, { fastDraftOnly: true });
          } finally {
            setChapterProgress((prev) => { const next = { ...prev }; delete next[chapter.id]; return next; });
          }
        }, { limit: laneLimit });

        for (const r of results) {
          if (r.status === 'rejected') {
            failures.push({ chapter: r.chapter.chapter_number, error: r.reason?.message || 'Unknown error' });
          }
        }
      } else {
        for (let ci = 0; ci < remaining.length; ci++) {
          if (stopRequestedRef.current) break;
          const chapter = remaining[ci];
          setBusyLabel(`Re-drafting empty Ch.${chapter.chapter_number} (${ci + 1}/${total})…`);
          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };
          try {
            await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, { fastDraftOnly: true });
          } catch (e) {
            failures.push({ chapter: chapter.chapter_number, error: e?.message || 'Unknown error' });
          } finally {
            setChapterProgress((prev) => { const next = { ...prev }; delete next[chapter.id]; return next; });
          }
        }
      }
    } finally {
      stopRequestedRef.current = false;
      setChapterProgress({});
      setBusyLabel('');
    }

    await refreshAll();

    // Re-compute integrity report after re-draft
    try {
      const report = await computeDraftIntegrityReport(projectId, isBodyChapter);
      setDraftIntegrityReport(report);
    } catch (err) {
      console.error('[DRAFT-INTEGRITY] Re-draft integrity report failed:', err);
    }
  };

  const handleRewriteSelected = async () => {
    if (!project || !selectedChapter || busyLabel) return;
    if (!chapterHasPersistedManuscriptContent(selectedChapter) && !chapterDraft) return;

    const ok = confirmDestructiveChapterAction(
      `Rewrite Chapter ${selectedChapter.chapter_number}? This will replace the current chapter text. A backup will be attempted first. Continue?`
    );
    if (!ok) return;

    captureSnapshot(`Rewrite Ch.${selectedChapter.chapter_number}`);
    setBusyLabel(`Rewriting chapter ${selectedChapter.chapter_number}…`);
    try {
      await draftChapter(selectedChapter, true, chapterProseModels[selectedChapter.id], undefined, {
        backupBeforeOverwrite: chapterHasPersistedManuscriptContent(selectedChapter),
        backupReason: `Before Rewrite Chapter — Ch.${selectedChapter.chapter_number}`,
      });
      // Reset scan/fix pass counter on rewrite
      await runWithNetworkRetry(() => base44.entities.Chapter.update(selectedChapter.id, { scan_fix_passes: 0, clean_score: 0 }));
    } catch (err) {
      console.error('Rewrite failed:', err);
      toast.error(`Rewriting chapter ${selectedChapter.chapter_number} failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBusyLabel('');
    }
  };

  const handleRewriteAll = async () => {
    if (!project || busyLabel) return;
    captureSnapshot('Rewrite All Drafted');
    stopRequestedRef.current = false;

    let freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
    const draftedChaps = freshChapters
      .filter((ch) => chapterHasPersistedManuscriptContent(ch) && isBodyChapter(ch))
      .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

    if (!draftedChaps.length) {
      toast.info('No drafted body chapters found to rewrite.');
      return;
    }

    const isAnthologyMode = project.project_type === 'anthology';
    const isNonfictionMode = isNonfictionProjectAuthority(project);
    const isParallelMode = isAnthologyMode || isNonfictionMode;
    const total = draftedChaps.length;
    const useFastRewriteAll = true;

    const ok = confirmDestructiveChapterAction(
      isParallelMode
        ? `Rewrite Drafted will replace ${total} body chapter(s) in parallel. Backups will be attempted before each chapter is rewritten. Polish/Fix Manuscript can be run afterward. Continue?`
        : `Sequential Rewrite Drafted will replace ${total} body chapter(s) one at a time so continuity can carry forward. Backups will be attempted first. Polish/Fix Manuscript can be run afterward. Continue?`
    );
    if (!ok) return;

    const rewriteFailures = [];
    setBusyLabel(isParallelMode
      ? `Rewriting ${total} drafted chapters in controlled parallel…`
      : `Sequentially rewriting ${total} drafted chapters…`);

    console.log(`[REWRITE ALL] Mode: ${isParallelMode ? 'parallel mode (anthology/nonfiction)' : 'sequential continuity-safe mode (fiction/novel)'}`);
    console.log('[REWRITE ALL] Batch generation mode: DRAFT-ONLY. Polish is handled by Fix Manuscript afterward.');

    const seed = {};
    for (const ch of draftedChaps) seed[ch.id] = 'queued…';
    setChapterProgress(seed);

    try {
      if (isParallelMode) {
        const laneLimit = isNonfictionMode ? REWRITE_DRAFT_LANE_LIMIT : (isAnthologyMode ? ANTHOLOGY_DRAFT_LANE_LIMIT : PARALLEL_DRAFT_LANE_LIMIT);
        console.log(`[REWRITE ALL] Controlled parallel mode active: launching ${draftedChaps.length} chapter(s) through ${laneLimit} lane(s)`);

        const results = await runParallelDraftPool(draftedChaps, async (chapter) => {
          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            console.log(`[REWRITE-CH-${chapter.chapter_number}] onProgress fired:`, label, '→', safeLabel);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            const value = await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastRewriteAll,
              backupBeforeOverwrite: chapterHasPersistedManuscriptContent(chapter),
              backupReason: `Before Rewrite All — Ch.${chapter.chapter_number}`,
            });

            await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, { scan_fix_passes: 0, clean_score: 0 }));
            return value;
          } finally {
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
          }
        }, { limit: laneLimit });

        for (const r of results) {
          if (r.status === 'rejected') {
            rewriteFailures.push({ chapter: r.chapter.chapter_number, error: r.reason?.message || 'Unknown error' });
            console.error(`[REWRITE ALL] Ch.${r.chapter.chapter_number} failed:`, r.reason);
          }
        }

        console.log(`[REWRITE ALL] Complete: ${results.filter(r => r.status === 'fulfilled').length}/${draftedChaps.length} parallel succeeded, ${rewriteFailures.length} failed`);
      } else {
        // Fiction/novel mode: fully sequential. Rewriting one chapter can change
        // continuity, so later chapters wait for the updated prior chapters to save.
        for (let ci = 0; ci < draftedChaps.length; ci++) {
          if (stopRequestedRef.current) break;

          const chapter = draftedChaps[ci];
          setBusyLabel(`Sequential rewrite: chapter ${chapter.chapter_number} (${ci + 1}/${draftedChaps.length})…`);

          const onProgress = (label) => {
            const safeLabel = formatProgressLabel(label);
            setChapterProgress((prev) => ({ ...prev, [chapter.id]: safeLabel }));
          };

          try {
            await draftChapter(chapter, false, chapterProseModels[chapter.id] || undefined, onProgress, {
              fastDraftOnly: useFastRewriteAll,
              backupBeforeOverwrite: chapterHasPersistedManuscriptContent(chapter),
              backupReason: `Before Rewrite All — Ch.${chapter.chapter_number}`,
            });

            await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, { scan_fix_passes: 0, clean_score: 0 }));
            // Refresh after each rewrite so the next chapter sees the updated sequence.
            freshChapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 100);
          } catch (e) {
            console.error(`[REWRITE ALL] Ch.${chapter.chapter_number} failed:`, e);
            rewriteFailures.push({ chapter: chapter.chapter_number, error: e?.message || 'Unknown error' });
          } finally {
            setChapterProgress((prev) => {
              const next = { ...prev };
              delete next[chapter.id];
              return next;
            });
          }
        }
      }
    } finally {
      stopRequestedRef.current = false;
      setChapterProgress({});
      if (rewriteFailures.length) {
        setBusyLabel(`Done — ${rewriteFailures.length} failed: ${rewriteFailures.map(f => 'Ch.' + f.chapter).join(', ')}`);
      } else {
        setBusyLabel('');
      }
    }
    await refreshAll();
  };

  const handleGenerateBeats = async () => {
    if (!project || !selectedChapter) return;
    setBusyLabel(`Generating beats for chapter ${selectedChapter.chapter_number}…`);
    try {
      await generateSceneBeats(selectedChapter);
    } finally {
      setBusyLabel('');
    }
    await refreshAll();
  };

  const handleEvaluate = async () => {
    if (!project) return;
    captureSnapshot('Evaluate');
    setBusyLabel('Evaluating project…');
    try {
    // Resolve chapter content from URLs for evaluation
    const resolvedChapters = await Promise.all(
      chapters.map(async (ch) => {
        if (chapterHasContent(ch) && !ch.content_md && ch.content_md_url) {
          return { ...ch, content_md: await resolveChapterContent(ch) };
        }
        return ch;
      })
    );
    const evaluationResponse = await invokeLLMWithRetry({
      task_type: 'critique',
      prompt: buildEvaluationPrompt(project, resolvedChapters),
      response_json_schema: evaluationSchema,
      model: pickModel('evaluate', project),
      spec: project,
      fallback_model: pickFallbackModel('evaluate', project),
    });
    const evaluation = unwrapIntegrationResult(evaluationResponse);

    const _evalPayload = protectedProjectUpdate({
      novel_score: evaluation.novel_score,
      foundation_score: evaluation.foundation_score,
      current_focus: evaluation.current_focus,
      arc_summary_md: evaluation.arc_summary_md,
      status: 'ready',
      phase: chapters.some((chapter) => chapter.status === 'drafted') ? 'revision' : project.phase,
    });

    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _evalPayload));
    } finally {
      setBusyLabel('');
    }
    await refreshAll();
  };

  // Helper: extract protagonist name from characters_md
  const extractProtagonistName = (proj) => {
    if (!proj?.characters_md) return 'the protagonist';
    // Look for "Protagonist: Name" or "**Name**" at the start, or first capitalized name pair
    const protMatch = proj.characters_md.match(/(?:protagonist|main character|MC)[:\s]+([A-Z][a-z]+ (?:[A-Z][a-z]+)?)/i);
    if (protMatch) return protMatch[1].trim();
    const nameMatch = proj.characters_md.match(/\b([A-Z][a-z]{2,} [A-Z][a-z]{2,})\b/);
    return nameMatch ? nameMatch[1] : 'the protagonist';
  };

  const handleScanChapter = async (chapter) => {
    if (!project || !chapterHasContent(chapter)) return;

    // Gate: cap scan/fix at 2 passes per chapter
    if ((chapter.scan_fix_passes || 0) >= 2) {
      toast.error('This chapter has already been scanned/fixed 2 times. Additional passes may degrade quality. Click "Rewrite Chapter" to generate fresh content.');
      return;
    }
    setBusyLabel(`Scanning chapter ${chapter.chapter_number}…`);
    try {
    // Resolve chapter content from URL if needed
    const resolvedContent = await resolveChapterContent(chapter);
    const resolvedChapter = { ...chapter, content_md: resolvedContent };

    // CONTENT DESTRUCTION GUARD — prevents saving corrupted text
    const isContentDestroyed = (text) => {
      if (!text || text.length < 100) return true;
      const theyCount = (text.match(/they they/gi) || []).length;
      if (theyCount > 10) return true;
      const sample = text.substring(0, 60).trim();
      if (sample.length > 10) {
        const repeatCount = text.split(sample).length - 1;
        if (repeatCount > 5) return true;
      }
      const words = text.split(/\s+/);
      if (words.length > 50) {
        const uniqueWords = new Set(words.map(w => w.toLowerCase()));
        if (uniqueWords.size / words.length < 0.05) return true;
      }
      return false;
    };

    // Step 1: Gemini Flash scans for issues (diagnosis only, no rewriting)
    const scanOnlySchema = {
      type: 'object',
      properties: {
        audience_score: chapterReviewSchema.properties.audience_score,
        critic_score: chapterReviewSchema.properties.critic_score,
        verdict: chapterReviewSchema.properties.verdict,
        one_line: chapterReviewSchema.properties.one_line,
        strengths: chapterReviewSchema.properties.strengths,
        issues: chapterReviewSchema.properties.issues,
      },
      required: ['audience_score', 'critic_score', 'verdict', 'one_line', 'strengths', 'issues'],
    };
    let scanResult = null;
    try {
      const scanResponse = await base44.integrations.Core.InvokeLLM({
        prompt: buildChapterReviewPrompt(project, resolvedChapter),
        response_json_schema: scanOnlySchema,
        model: 'gemini_3_flash',
      });
      scanResult = unwrapIntegrationResult(scanResponse);
    } catch (diagErr) {
      console.warn('[SCAN/FIX] Diagnosis failed:', diagErr.message, '\u2014 proceeding to Critic Agent cleanup without diagnosis');
      // Create a minimal scan result so the Critic Agent still runs
      scanResult = { audience_score: 0, critic_score: 0, verdict: 'Unknown', one_line: 'Diagnosis unavailable', strengths: [], issues: [{ severity: 'moderate', category: 'unknown', description: 'Diagnosis step failed \u2014 running Critic Agent cleanup as fallback' }] };
    }

    // Step 2: Run the Critic Agent (same 15-rule backend function used in post-generation)
    let review = { ...scanResult, revised_content_md: null };
    // Critic Agent always runs — it has its own safety guards (content destruction check, 70% length check)
    const hasFixableIssues = true;

    if (hasFixableIssues) {
      setBusyLabel(`Cleaning chapter ${chapter.chapter_number} via Critic Agent…`);

      // Gather context for the Critic Agent
      const protagonistName = extractProtagonistName(project);
      const pronouns = project.protagonist_pronouns
        || (detectProtagonistPronouns(project) ? detectProtagonistPronouns(project) + '/' + (detectProtagonistPronouns(project) === 'she' ? 'her' : detectProtagonistPronouns(project) === 'he' ? 'him' : 'them') : 'they/them');

      // Get previous/next chapter context for transitions (skip for anthologies — standalone stories)
      let previousChapterEnding = '';
      let nextChapterOpening = '';
      if (!isAnthologyProject(project)) {
        const sortedChapters = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
        const prevCh = sortedChapters.find(c => c.chapter_number === chapter.chapter_number - 1);
        const nextCh = sortedChapters.find(c => c.chapter_number === chapter.chapter_number + 1);
        if (prevCh && chapterHasContent(prevCh)) previousChapterEnding = ((await resolveChapterContent(prevCh)) || '').slice(-400);
        if (nextCh && chapterHasContent(nextCh)) nextChapterOpening = ((await resolveChapterContent(nextCh)) || '').slice(0, 400);
      }

      console.log('[SCANFIX] Calling criticAgent. Content:', resolvedContent.length, 'chars');

      const criticResponse = await base44.functions.invoke('criticAgent', {
        chapterText: resolvedContent,
        chapterNumber: chapter.chapter_number || 1,
        totalChapters: project.chapter_target || chapters.length || 25,
        protagonistName,
        protagonistPronouns: pronouns,
        genre: project.genre || 'fiction',
        previousChapterEnding,
        nextChapterOpening,
      });
      const criticResult = criticResponse?.data || criticResponse;

      console.log('[SCANFIX] Critic returned. success:', criticResult?.success, 'len:', criticResult?.cleanedText?.length);

      if (criticResult?.success && criticResult?.cleanedText) {
        const cleaned = criticResult.cleanedText;
        const origLen = resolvedContent.length;

        // Log before/after metrics
        const revisedWords = cleaned.split(/\s+/);
        const uniqueWords = new Set(revisedWords.map(w => w.toLowerCase()));
        const uniqueRatio = uniqueWords.size / revisedWords.length;
        const theyTheyCount = (cleaned.match(/they they/gi) || []).length;
        console.log('[SCAN/FIX] Critic Agent: Original length:', origLen, '| Cleaned length:', cleaned.length);
        console.log('[SCAN/FIX] Unique word ratio:', uniqueRatio.toFixed(3), '| "they they" count:', theyTheyCount);

        if (isContentDestroyed(cleaned)) {
          console.error('[SCAN/FIX] CONTENT DESTRUCTION DETECTED after Critic Agent. Keeping original.');
        } else if (cleaned.trim().length < origLen * 0.7) {
          console.warn('[SCAN/FIX] Critic Agent output too short (' + cleaned.length + ' vs ' + origLen + '). Keeping original.');
        } else {
          review.revised_content_md = cleaned;
          console.log('[SCAN/FIX] Critic Agent applied successfully. Input:', origLen, '→ Output:', cleaned.length);
        }
      } else {
        console.warn('[SCAN/FIX] Critic Agent returned failure or empty. Keeping original.', criticResult?.error || '');
      }
    }

    // Auto-apply fixes if available and not destroyed
    if (review?.revised_content_md) {
      const cleanedRevision = review.revised_content_md.replace(/\*\*/g, '');

      if (isContentDestroyed(cleanedRevision)) {
        console.error('[SCAN/FIX] Post-clean CONTENT DESTRUCTION DETECTED. Refusing to save.');
      } else if (countWords(cleanedRevision) < 50) {
        console.warn('[SCAN] Revised content too short (' + countWords(cleanedRevision) + ' words), skipping auto-apply.');
      } else {
        // Compute mechanical score on the cleaned text
        const mScore = mechanicalScore(cleanedRevision);
        const reviewContentFields = await prepareChapterContent(cleanedRevision, project?.id || projectId, chapter.id, chapter);
        await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
          ...reviewContentFields,
          word_count: countWords(review.revised_content_md),
          score: Math.round(((Number(review.critic_score) || 0) + (Number(review.audience_score) || 0)) / 2) / 10,
          clean_score: mScore.score,
          scan_fix_passes: (chapter.scan_fix_passes || 0) + 1,
          revision_notes: [
            review.one_line,
            `Critic: ${Number(review.critic_score) || 0}% | Audience: ${Number(review.audience_score) || 0}% | ${review.verdict || 'Unknown'}`,
            `Clean Score: ${mScore.score}/100`,
            ...(mScore.deductions.length ? [`Deductions: ${mScore.deductions.join(', ')}`] : []),
            ...(review.issues || []).map((i) => `[${i.severity}] ${i.category}: ${i.description}`),
          ].join('\n'),
          status: 'reviewed',
        }));
        if (chapter.id === selectedChapter?.id) {
          setChapterDraft(review.revised_content_md);
        }
      }
    }

    // Also compute mechanical score for display even if no fixes were applied
    const resolvedForScore = review?.revised_content_md || await resolveChapterContent(chapter);
    review.clean_score = mechanicalScore(resolvedForScore).score;
    review.clean_deductions = mechanicalScore(resolvedForScore).deductions;

    setReviewData((prev) => ({ ...prev, [chapter.id]: review }));
    } finally {
      setBusyLabel('');
    }
    await refreshAll();
  };

  const handleApplyFixes = async (chapter, revisedContent) => {
    if (!chapter || !revisedContent) return;
    setIsApplyingFixes(true);
    const review = reviewData[chapter.id];
    const fixContentFields = await prepareChapterContent(revisedContent, project?.id || projectId, chapter.id, chapter);
    await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
      ...fixContentFields,
      word_count: countWords(revisedContent),
      score: review ? Math.round(((Number(review.critic_score) || 0) + (Number(review.audience_score) || 0)) / 2) / 10 : chapter.score,
      revision_notes: review ? [
        review.one_line,
        `Critic: ${Number(review.critic_score) || 0}% | Audience: ${Number(review.audience_score) || 0}% | ${review.verdict || 'Unknown'}`,
        ...(review.issues || []).map((i) => `[${i.severity}] ${i.category}: ${i.description}`),
      ].join('\n') : chapter.revision_notes,
      status: 'reviewed',
    }));
    if (chapter.id === selectedChapter?.id) {
      setChapterDraft(revisedContent);
    }
    setIsApplyingFixes(false);
    await refreshAll();
  };

  // ── Genre-aware polish routing ──
  const isComedy = isComedyProject(project);
  const handlePolishRouted = async () => {
    if (isNonfictionProject(project)) {
      await handleManuscriptPolishNonfiction();
    } else {
      await handleManuscriptPolish();
    }
  };

  // ── NONFICTION POLISH ──
  const handleManuscriptPolishNonfiction = async () => {
    if (!project || busyLabel) return;
    const allChapters = [...chapters].filter(ch => chapterHasContent(ch) && isBodyChapter(ch)).sort((a, b) => a.chapter_number - b.chapter_number);
    if (!allChapters.length) { toast.error('No drafted chapters to polish.'); return; }
    captureSnapshot('NF Polish');
    setBusyLabel('Polish (NF): Loading chapters…');
    try {
      const loaded = [];
      for (let i = 0; i < allChapters.length; i++) {
        const ch = allChapters[i];
        setBusyLabel(`Polish (NF): Loading chapter ${ch.chapter_number || (i+1)} of ${allChapters.length}…`);
        try {
          const content = await resolveChapterContent(ch);
          if (content && content.length > 50) loaded.push({ chapter: ch, content, original: content });
        } catch (err) { console.error('[POLISH-NF] Failed:', err.message); }
      }
      if (!loaded.length) { toast.error('No content found.'); setBusyLabel(''); return; }

      // ── PRE-POLISH SAFETY GATE (nonfiction) ──
      // Check for process leakage before nonfiction polish runs.
      // Bad input must be quarantined before repair transforms.
      setBusyLabel('Polish (NF): Running safety gate preflight…');
      const nfSafetyRejected = [];
      const nfSafeLoaded = [];
      for (const f of loaded) {
        const gate = runManuscriptSafetyGate(f.content, {
          project,
          chapter: f.chapter,
          stage: 'pre-polish',
          allowBusinessTerms: true,
        });
        logSafetyGateResult('pre-polish-nf', f.chapter?.chapter_number, f.chapter?.title, gate);
        const onlyDroppedWordFailures = !gate.ok
          && Array.isArray(gate.reasons) && gate.reasons.length > 0
          && gate.reasons.every((r) => {
            const s = String(r);
            if (!s.startsWith('Malformed grammar')) return false;
            const phrases = s.match(/"[^"]+"/g) || [];
            return phrases.length > 0 && phrases.every((p) => p.includes('dropped word'));
          });
        if (gate.ok) {
          nfSafeLoaded.push(f);
        } else if (onlyDroppedWordFailures) {
          // POLISHFIX-9: every hard failure on this chapter is the dropped-word
          // shape, which the polish pre-pass strips deterministically
          // (DRAFTGATE-2B). Rejecting it here deadlocked the repair — the
          // chapter was too broken to enter the fixer that fixes exactly that
          // brokenness. Admitted loudly; the post-polish save gate re-checks.
          console.warn('[POLISH-NF-SAFETY-GATE] ADMITTED Ch.' + (f.chapter?.chapter_number || '?') + ' for deterministic dropped-word repair (' + gate.reasons.length + ' reason(s))');
          nfSafeLoaded.push(f);
        } else {
          nfSafetyRejected.push({ chapter: f.chapter, reasons: gate.reasons });
          console.error('[POLISH-NF-SAFETY-GATE] REJECTED Ch.' + (f.chapter?.chapter_number || '?') + ': ' + gate.reasons.join('; '));
        }
      }
      if (nfSafetyRejected.length > 0) {
        toast.error(`Safety Gate (NF): ${nfSafetyRejected.length} chapter(s) rejected. Rejected: ${nfSafetyRejected.map(r => 'Ch.' + (r.chapter?.chapter_number || '?')).join(', ')}. Regenerate them first.`, { duration: 15000 });
        loaded.length = 0;
        loaded.push(...nfSafeLoaded);
      }
      if (!loaded.length) { toast.error('All NF chapters rejected by safety gate.'); setBusyLabel(''); return; }

      const beforeStats = calculateManuscriptStatsNonfiction(loaded.map(f => f.content).join('\n\n'));

      // ── UNIFIED PIPELINE (NF mode) ──
      const pipelineResult = await runManuscriptPolishPipeline({
        loaded,
        project,
        onProgress: (label) => setBusyLabel(formatProgressLabel(label)),
        allowLLM: false,
        mode: 'nonfiction',
      });

      const changes = [...pipelineResult.changes];
      const ps = pipelineResult.stats || {};
      const structViolations = pipelineResult.structureViolations || [];
      window.__UBS_LAST_STRUCTURE_VIOLATIONS = structViolations;

      for (const v of structViolations) {
        if (v.action === 'REVERTED') {
          changes.push(`🚫 Ch.${v.chapter}: ${v.stage} reverted for unauthorized structure reduction (${v.before} -> ${v.attemptedAfter} paragraphs).`);
        } else if (v.action === 'ACCEPTED') {
          changes.push(`✓ Ch.${v.chapter}: ${v.stage} explicitly authorized paragraph reduction (${v.before} -> ${v.attemptedAfter} paragraphs).`);
        }
      }

      // ── SAVE LOOP (same architecture as fiction handler) ──
      let savedCount = 0;
      let unchangedCount = 0;
      const saveFailures = [];
      const _polishChangedCount = loaded.filter(f => f.content !== f.original).length;
      setBusyLabel('Polish (NF): Saving ' + _polishChangedCount + ' chapters…');

      for (let i = 0; i < loaded.length; i++) {
        const f = loaded[i];
        const chNum = f.chapter.chapter_number || (i + 1);
        if (f.content === f.original) { unchangedCount++; continue; }
        setBusyLabel(`Polish (NF): Saving chapter ${chNum} (${savedCount + 1}/${_polishChangedCount})…`);
        try {
          const contentFields = await prepareChapterContent(f.content, project?.id || projectId, f.chapter.id, f.chapter);
          const backupFields = f.chapter.backup_content || f.chapter.backup_content_url
            ? {}
            : await prepareBackupContent(f.original, project?.id || projectId, f.chapter.id, f.chapter);
          const staleClear = {};
          for (const staleField of [
            'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
            'chapter_text', 'markdown', 'content_html', 'content_html_url',
            'content_delta', 'content_delta_url', '__polishedContent',
            '__polishSavedContent', '__polishExportContent',
          ]) { staleClear[staleField] = ''; }
          const savePayload = {
            ...staleClear,
            ...contentFields,
            ...backupFields,
            word_count: countWords(f.content),
            ...(f.chapter.title ? { title: f.chapter.title } : {}),  // Persist name-hygiene title rename
          };
          await runWithNetworkRetry(() => base44.entities.Chapter.update(f.chapter.id, savePayload));
          f.chapter = { ...f.chapter, ...savePayload };
          savedCount++;

          try {
            const verifyRecord = (await base44.entities.Chapter.filter({ id: f.chapter.id }))?.[0];
            if (!verifyRecord) {
              saveFailures.push({ chNum, expectedLen: 0, actualLen: 0, reason: 'paragraph count mismatch (missing read-back)' });
            } else {
              const verifyContent = await resolveChapterContent(verifyRecord);
              const matchResult = verifySaveParagraphMatch(f.content, verifyContent);
              if (!matchResult.ok) {
                saveFailures.push({ chNum, expectedLen: matchResult.expected, actualLen: matchResult.actual, reason: 'paragraph count mismatch' });
              }
            }
          } catch (readErr) {
            saveFailures.push({ chNum, expectedLen: 0, actualLen: 0, reason: 'paragraph count mismatch (read-back exception)' });
          }
        } catch (saveErr) {
          console.error('[POLISH-NF] Ch.' + chNum + ' SAVE THREW:', saveErr.message);
          saveFailures.push({ chNum, error: saveErr.message });
        }
      }

      const afterStats = calculateManuscriptStatsNonfiction(loaded.map(f => f.content).join('\n\n'));
      setPolishResults({ before: beforeStats, after: afterStats, changes, structureViolations: structViolations, timestamp: new Date().toISOString() });

      // ── REFERENCE INTEGRITY GATE (post-NF-polish) ──
      setBusyLabel('Polish (NF): Running reference integrity check…');
      const allPolishedText = loaded.map(f => f.content).join('\n\n');
      const refReport = runReferenceIntegrityGate(allPolishedText, project);
      if (typeof window !== 'undefined') {
        window.__UBS_LAST_REFERENCE_REPORT = refReport;
      }
      if (!refReport.ok) {
        toast.error(`Reference Integrity: ${refReport.blockingIssues.length} blocking issue(s).`, { duration: 20000 });
        changes.push('\u26a0\ufe0f Reference integrity: ' + refReport.summary);
      } else if (refReport.warnings?.length > 0) {
        toast.info(`Reference Integrity: ${refReport.warnings.length} warning(s).`, { duration: 15000 });
        changes.push('Reference integrity: ' + refReport.summary);
      } else if (refReport.sections?.length > 0) {
        changes.push('\u2705 Reference integrity: PASS \u2014 ' + refReport.summary);
      }

      const nfCoreStats = ps.nfCore || {};
      const report = `NF Polish v2: ${savedCount} saved, ${unchangedCount} unchanged | Banned: -${ps.bannedRecastCount || 0} | Cap: ${ps.capFixed || 0} | Voice: ${ps.voiceFixed || 0} | Reps: ${nfCoreStats.repFixed || 0} | Scaffolds: ${nfCoreStats.scaffoldsRemoved || 0} | Disclaimers: ${nfCoreStats.disclaimersRemoved || 0} | Grammar(NF): ${nfCoreStats.grammarFixed || 0} | Spelling: ${nfCoreStats.spellingFixed || 0} | Vocab: ${ps.vocabCapped || 0} | Quotes: ${ps.quotesFixed || 0} | ExtAI: ${ps.externalPatternsFixed || 0}
` + changes.join('\n') + (saveFailures.length > 0 ? '\n\n\ud83d\udea8 SAVE FAILED for ' + saveFailures.length + ' chapter(s): ' + saveFailures.map(sf => sf.reason?.includes('paragraph count mismatch') ? `Ch.${sf.chNum} (${sf.reason}: expected ${sf.expectedLen}, got ${sf.actualLen})` : `Ch.${sf.chNum} (${sf.reason})`).join(', ') : '') + (savedCount > 0 && saveFailures.length === 0 ? '\n\n\u2705 Re-export to get the updated manuscript.' : '');
      // WAVE5-SETTINGS: optional post-polish quality scan appended to the report.
      const nfFinalCheck = await maybeFinalCheckAfterPolish({ project, loaded, onProgress: setBusyLabel });
      toast.info(report + (nfFinalCheck?.length ? '\n\n\ud83d\udd0e Final check: ' + nfFinalCheck.length + ' finding(s)\n' + nfFinalCheck.slice(0, 10).join('\n') : (nfFinalCheck ? '\n\n\ud83d\udd0e Final check: clean' : '')), { duration: 30000 });
    } catch (err) {
      console.error('[POLISH-NF] FATAL:', err);
      toast.error('NF Polish failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
      await refreshAll();
    }
  };

  // ── MANUSCRIPT POLISH v2 — deterministic cross-chapter cleanup (fiction) ──
  const handleManuscriptPolish = async () => {
    if (!project || busyLabel) return;
    const allChapters = [...chapters].filter(ch => chapterHasContent(ch) && isBodyChapter(ch)).sort((a, b) => a.chapter_number - b.chapter_number);
    if (!allChapters.length) { toast.error('No drafted chapters to polish.'); return; }

    captureSnapshot('Manuscript Polish');
    const isAnthology = isAnthologyProject(project);
    console.log('[POLISH] ========== STARTING MANUSCRIPT POLISH v6 — FINAL SAVE-GATE + DB SOURCE VERIFY ACTIVE ==========');
    console.log('[POLISH] Anthology mode:', isAnthology);
    setBusyLabel('Polish: Loading chapters…');

    try {
    // ── STEP 1: Load all chapter content ──
    const loaded = [];
    for (let i = 0; i < allChapters.length; i++) {
      const ch = allChapters[i];
      const chNum = ch.chapter_number || (i + 1);
      setBusyLabel(`Polish: Loading chapter ${chNum} of ${allChapters.length}…`);
      try {
        const content = await resolveChapterContent(ch);
        if (content && content.length > 50) {
          loaded.push({ chapter: ch, content, original: content });
          console.log('[POLISH] Loaded Ch.' + chNum + ': ' + content.length + ' chars');
        } else {
          console.warn('[POLISH] Ch.' + chNum + ' empty/short (' + (content?.length || 0) + '), skipping');
        }
      } catch (err) {
        console.error('[POLISH] Failed to load Ch.' + chNum + ':', err.message);
      }
    }

    if (!loaded.length) { toast.error('No chapter content found to polish.'); setBusyLabel(''); return; }
    const totalChars = loaded.reduce((s, f) => s + f.content.length, 0);
    if (totalChars < 1000) { toast.error('Loaded only ' + totalChars + ' chars — content loading failed.'); setBusyLabel(''); return; }

    const changes = [];

    console.log('[POLISH] Loaded', loaded.length, 'chapters,', totalChars, 'chars');

    // STEP 1b: Hard project-contamination trim before any polish rewrites.
    // If a wrong-project block was stitched into the end of a chapter, remove the
    // obvious foreign block before the normal polish passes amplify it.
    let projectContaminationTrimmed = 0;
    for (const f of loaded) {
      const trim = stripProjectContaminationBlocks({
        project: buildNameHygieneEnhancedProject(project || {}),
        chapter: f.chapter,
        chapters,
        content: f.content,
      });
      if (trim.changed) {
        f.content = trim.text;
        projectContaminationTrimmed += 1;
        console.warn('[PROJECT-CONTENT-GUARD] Trimmed foreign block during polish Ch.' + (f.chapter?.chapter_number || '?') + ':', trim.report);
      } else if (trim.guard?.severity === 'critical') {
        changes.push('⚠️ Ch.' + (f.chapter?.chapter_number || '?') + ': project contamination detected but not safely auto-trimmed — regenerate this chapter. ' + trim.report);
      }
    }

    if (projectContaminationTrimmed > 0) {
      changes.push('Project Content Guard: trimmed obvious wrong-project blocks from ' + projectContaminationTrimmed + ' chapter(s).');
    }

    // ── STEP 1c: PRE-POLISH SAFETY GATE ──
    // Check every chapter for process leakage and contamination BEFORE any
    // polish transforms run. Bad input must be quarantined before repair
    // transforms because repair transforms (fixHangingQuotes, runBrokenSentenceFixes,
    // banned-word cleanup) can create grammar regressions when applied to
    // editorial/process text.
    setBusyLabel('Polish: Running safety gate preflight…');
    const safetyRejected = [];
    const safeLoaded = [];
    const gateEntries = [];
    for (const f of loaded) {
      const gate = runManuscriptSafetyGate(f.content, {
        project,
        chapter: f.chapter,
        stage: 'pre-polish',
      });
      logSafetyGateResult('pre-polish', f.chapter?.chapter_number, f.chapter?.title, gate);
      gateEntries.push({ chapterNumber: f.chapter?.chapter_number, title: f.chapter?.title, ok: gate.ok, action: gate.recommendedAction, processLeaks: gate.processLeaks.matches.length, contamination: gate.contamination.matches.length, malformed: gate.malformed.matches.length, reasons: gate.reasons });
      if (gate.ok) {
        safeLoaded.push(f);
      } else {
        safetyRejected.push({
          chapter: f.chapter,
          action: gate.recommendedAction,
          reasons: gate.reasons,
        });
        console.error('[POLISH-SAFETY-GATE] REJECTED Ch.' + (f.chapter?.chapter_number || '?') + ': ' + gate.reasons.join('; '));
        changes.push('🚫 Ch.' + (f.chapter?.chapter_number || '?') + ' REJECTED by safety gate (' + gate.recommendedAction + '): ' + gate.reasons.join('; '));
      }
    }
    storeSafetyReport('pre-polish', gateEntries);

    if (safetyRejected.length > 0) {
      console.warn('[POLISH-SAFETY-GATE] ' + safetyRejected.length + ' chapter(s) rejected. Only ' + safeLoaded.length + ' will be polished.');
      changes.push('Safety Gate: ' + safetyRejected.length + ' chapter(s) quarantined, ' + safeLoaded.length + ' eligible for polish.');
      toast.error(
        `Safety Gate: ${safetyRejected.length} chapter(s) rejected (process leaks or contamination). ` +
        `Rejected: ${safetyRejected.map(r => 'Ch.' + (r.chapter?.chapter_number || '?')).join(', ')}. ` +
        `These chapters will NOT be polished. Regenerate them first.`,
        { duration: 20000 }
      );
    }

    // Replace loaded array with only safe chapters for all subsequent polish steps.
    // Rejected chapters keep their original content unchanged.
    loaded.length = 0;
    loaded.push(...safeLoaded);

    if (!loaded.length) {
      toast.error('All chapters were rejected by the safety gate. No chapters to polish.');
      setBusyLabel('');
      return;
    }
    // ══════════════════════════════════════════════════════════════════════════
    // UNIFIED PIPELINE: All polish logic delegated to manuscriptPolishRunner.
    // Architecture: Deterministic-first, LLM-last, slop regression checked.
    // ══════════════════════════════════════════════════════════════════════════
    const isComedy = isComedyProject(project);
    const beforeStats = calculateManuscriptStats(loaded.map(f => f.content).join('\n\n'), { isComedy });
    setBusyLabel('Polish: Running unified pipeline…');

    const pipelineResult = await runManuscriptPolishPipeline({
      loaded,
      project,
      onProgress: (label) => setBusyLabel(label),
      allowLLM: false,
      mode: 'fiction',
      sceneDuplicateSweep: runSceneDuplicateSweep,
    });

    // Merge pipeline results into local scope variables used by the save/toast logic
    changes.push(...pipelineResult.changes);
    const structViolations = pipelineResult.structureViolations || [];
    window.__UBS_LAST_STRUCTURE_VIOLATIONS = structViolations;

    for (const v of structViolations) {
      if (v.action === 'REVERTED') {
        changes.push(`🚫 Ch.${v.chapter}: ${v.stage} reverted for unauthorized structure reduction (${v.before} -> ${v.attemptedAfter} paragraphs).`);
      } else if (v.action === 'ACCEPTED') {
        changes.push(`✓ Ch.${v.chapter}: ${v.stage} explicitly authorized paragraph reduction (${v.before} -> ${v.attemptedAfter} paragraphs).`);
      }
    }

    const anthologyStats = pipelineResult.anthologyStats || { bodyLangFixed: 0, anthVocabFixed: 0, contaminationFixed: 0, genreVocabFixed: 0 };
    const ps = pipelineResult.stats || {};
    const missingNounWarnings = []; // Now handled inside pipeline; no inline capHygiene warnings
    const polishGateFailures = pipelineResult.gateFailures || [];
    if (polishGateFailures.length > 0) {
      window.__UBS_LAST_POLISH_GATE = polishGateFailures;
    }

    // ── STEP 13: Save modified chapters ──
    let _polishChangedCount = loaded.filter(f => f.content !== f.original).length;
    console.warn('[POLISH-DEBUG] SAVE PHASE: ' + _polishChangedCount + '/' + loaded.length + ' chapters have changes to save');
    if (_polishChangedCount === 0) {
      console.warn('[POLISH-DEBUG] WARNING: Zero chapters changed. Either content was already clean OR polish functions did not modify f.content references.');
    }
    setBusyLabel('Polish: Saving ' + _polishChangedCount + ' chapters…');
    let savedCount = 0;
    let unchangedCount = 0;
    const saveFailures = [];  // Track chapters whose post-save verification doesn't match

    for (let i = 0; i < loaded.length; i++) {
      const f = loaded[i];
      const chNum = f.chapter.chapter_number || (i + 1);
      if (f.content === f.original) { unchangedCount++; continue; }
      setBusyLabel(`Polish: Saving chapter ${chNum} (${savedCount + 1}/${_polishChangedCount})…`);

      try {
        // prepareChapterContent may upload content as a file (when >10KB).
        // Uploads can fail on large chapters due to rate limits, network
        // blips, or transient 5xx errors. Keep both the upload AND the
        // entity update inside the try/catch so failures on one chapter
        // don't kill the whole polish run. Retry uploads up to 2 times.
        let contentFields;
        let uploadAttempts = 0;
        const MAX_UPLOAD_ATTEMPTS = 3;
        while (true) {
          uploadAttempts++;
          try {
            contentFields = await prepareChapterContent(f.content, project?.id || projectId, f.chapter.id, f.chapter);
            break;
          } catch (upErr) {
            console.warn('[POLISH-DEBUG] Ch.' + chNum + ' upload attempt ' + uploadAttempts + ' failed:', upErr.message);
            if (uploadAttempts >= MAX_UPLOAD_ATTEMPTS) throw upErr;
            await new Promise(r => setTimeout(r, 1000 * uploadAttempts));
          }
        }
        const backupFields = f.chapter.backup_content || f.chapter.backup_content_url
          ? {}
          : await prepareBackupContent(f.original, project?.id || projectId, f.chapter.id, f.chapter);
        console.warn('[POLISH-DEBUG] Ch.' + chNum + ' SAVING: inline=' + (contentFields.content_md?.length || 0) + ' url=' + (contentFields.content_md_url || 'none') + ' (upload attempts: ' + uploadAttempts + ')');

        const polishSourceStamp = `[POLISH-SOURCE-STAMP] ${PROJECT_STUDIO_VERSION} ${new Date().toISOString()} Ch.${chNum} len=${f.content.length} words=${countWords(f.content)} SceneDup=${ps.sceneDuplicate?.blocksRemoved || 0}/${ps.sceneDuplicate?.wordsRemoved || 0}`;
        const revisionNotes = [f.chapter.revision_notes || '', polishSourceStamp]
          .filter(Boolean)
          .join('\n')
          .slice(-8000);

        // Clear stale content fields so export doesn't resolve old pre-polish text.
        // Same strategy as safeReplaceChapterContent() — belt-and-suspenders safety.
        const staleClear = {};
        for (const staleField of [
          'content', 'draft', 'body', 'prose', 'finalText', 'cleanedText',
          'chapter_text', 'markdown', 'content_html', 'content_html_url',
          'content_delta', 'content_delta_url', '__polishedContent',
          '__polishSavedContent', '__polishExportContent',
        ]) {
          staleClear[staleField] = '';
        }

        const savePayload = {
          ...staleClear,          // Clear stale fields first
          ...contentFields,       // Then set canonical content (content_md / content_md_url)
          ...backupFields,
          word_count: countWords(f.content),
          revision_notes: revisionNotes,
        };

        await runWithNetworkRetry(() => base44.entities.Chapter.update(f.chapter.id, savePayload));
        // Keep the in-memory chapter record aligned with the exact content fields
        // we just wrote so immediate export cannot accidentally use the stale
        // pre-polish object from React Query state.
        f.chapter = { ...f.chapter, ...savePayload };
        savedCount++;

        // VERIFICATION PASS: read the chapter back from DB and confirm it has
        // our polished content (not the pre-polish original). This catches the
        // "save silently didn't persist" bug where uploads were swallowing
        // their errors and Ch 17 silently kept its pre-polish content.
        //
        // Length-alone won't catch all bugs (e.g. dialogue punct fixes swap
        // chars without changing length). We also compare the count of
        // broken-dialogue-punct patterns — if polish fixed them but DB still
        // has them, the save silently failed.
        try {
          const verifyRecord = (await base44.entities.Chapter.filter({ id: f.chapter.id }))?.[0];
          if (verifyRecord) {
            const verifyContent = await resolveChapterContent(verifyRecord);
            const verifyLen = verifyContent?.length || 0;
            const expectedLen = f.content.length;
            const diffPct = Math.abs(verifyLen - expectedLen) / Math.max(expectedLen, 1);

            // Content-pattern fingerprint: count broken dialogue-punct
            // patterns that polish should have zeroed out. If polish fixed
            // them but DB still has them, the save silently didn't persist.
            const expectedBrokenPunct = (f.content.match(/[\u201d"][.!?]/g) || []).length;
            const actualBrokenPunct = (verifyContent?.match(/[\u201d"][.!?]/g) || []).length;
            const punctDrift = actualBrokenPunct - expectedBrokenPunct;

            // Source-of-truth verification: after the DB read-back, run the same
            // final structure quarantine as a detector only. If it would still
            // remove a block from the DB copy, then export will still be stale/dirty
            // no matter what the polish report claims. This is the anti-gaslight gate.
            const verifyStructure = runSceneDuplicateSweep.applyStrandedAlternateDraftQuarantine(String(verifyContent || ''));
            const verifyStillDirty = verifyStructure.text !== String(verifyContent || '');

            const matchResult = verifySaveParagraphMatch(f.content, verifyContent);

            if (!matchResult.ok) {
               console.warn(`[POLISH-VERIFY] Ch.${chNum} PARAGRAPH COUNT MISMATCH: expected ${matchResult.expected}, got ${matchResult.actual}`);
               saveFailures.push({ chNum, expectedLen: matchResult.expected, actualLen: matchResult.actual, reason: 'paragraph count mismatch' });
            } else if (diffPct > 0.05) {
              console.warn('[POLISH-VERIFY] Ch.' + chNum + ' SAVE MISMATCH: expected ' + expectedLen + ' chars, got ' + verifyLen + ' (' + Math.round(diffPct * 100) + '% off).');
              saveFailures.push({ chNum, expectedLen, actualLen: verifyLen, reason: 'length mismatch' });
            } else if (punctDrift > 3) {
              console.warn('[POLISH-VERIFY] Ch.' + chNum + ' CONTENT DRIFT: expected ' + expectedBrokenPunct + ' broken dialog-punct marks, DB has ' + actualBrokenPunct + '. Save did NOT persist polish changes.');
              saveFailures.push({ chNum, expectedLen, actualLen: verifyLen, reason: 'content drift', punctExpected: expectedBrokenPunct, punctActual: actualBrokenPunct });
            } else if (verifyStillDirty) {
              const firstDirty = (verifyStructure.changes || [])[0] || {};
              console.warn('[POLISH-VERIFY] Ch.' + chNum + ' STRUCTURE STILL DIRTY AFTER SAVE:', verifyStructure.changes);
              saveFailures.push({
                chNum,
                expectedLen,
                actualLen: verifyLen,
                reason: 'structure contamination',
                structureReason: firstDirty.reason || 'final structure gate would still remove content from DB copy',
                preview: firstDirty.preview || '',
              });
            } else {
              console.warn('[POLISH-VERIFY] Ch.' + chNum + ' verified OK (' + verifyLen + ' chars, ' + actualBrokenPunct + ' broken-punct, structure-clean)');
            }
          } else {
            console.warn('[POLISH-VERIFY] Ch.' + chNum + ' verify failed: record not found in DB');
          }
        } catch (verifyErr) {
          console.warn('[POLISH-VERIFY] Ch.' + chNum + ' verify failed:', verifyErr.message);
        }
      } catch (saveErr) {
        console.error('[POLISH-DEBUG] Ch.' + chNum + ' SAVE THREW:', saveErr.message);
        saveFailures.push({ chNum, error: saveErr.message });
      }
    }
    console.warn('[POLISH-DEBUG] SAVE COMPLETE: saved=' + savedCount + ' unchanged=' + unchangedCount + ' failures=' + saveFailures.length);
    if (saveFailures.length > 0) {
      console.warn('[POLISH-DEBUG] SAVE FAILURES:', saveFailures);
    }

    // ── Capture AFTER stats for comparison ──
    const afterStats = calculateManuscriptStats(loaded.map(f => f.content).join('\n\n'), { isComedy });
    setPolishResults({
      before: beforeStats,
      after: afterStats,
      changes,
      timestamp: new Date().toISOString(),
    });

    const anthLine = isAnthology && (anthologyStats.bodyLangFixed || anthologyStats.anthVocabFixed || anthologyStats.contaminationFixed || anthologyStats.genreVocabFixed) ? ` | Anth: BL${anthologyStats.bodyLangFixed}/V${anthologyStats.anthVocabFixed}/C${anthologyStats.contaminationFixed}/G${anthologyStats.genreVocabFixed}` : '';

    // Surface missing-noun warnings in the Polish report so authors can review
    // the flagged sites manually — we flag only, never auto-fix these.
    const warningBlock = missingNounWarnings.length > 0
      ? '\n\n⚠️ ' + missingNounWarnings.length + ' MISSING-NOUN SITE(S) FLAGGED.\n' +
        'Open the Polish tab to see the Review Queue with one-click fixes.\n' +
        missingNounWarnings.slice(0, 3).map(w => `  Ch.${w.chapterNumber}: "${w.pattern}"`).join('\n') +
        (missingNounWarnings.length > 3 ? `\n  ... and ${missingNounWarnings.length - 3} more.` : '')
      : '';

    // Surface save-verification failures — tells the user that specific
    // chapters claimed to save but the verification read-back didn't match.
    // These are the chapters that will appear unpolished in the export.
    const saveFailureBlock = saveFailures.length > 0
      ? '\n\n🚨 SAVE VERIFICATION FAILED for ' + saveFailures.length + ' chapter(s). ' +
        'These chapters may not reflect polish changes when you export:\n' +
        saveFailures.slice(0, 5).map(sf => {
          if (sf.error) return `  Ch.${sf.chNum}: SAVE THREW — ${sf.error}`;
          if (sf.reason === 'content drift') return `  Ch.${sf.chNum}: saved but DB still has ${sf.punctActual} broken-punct (expected ${sf.punctExpected})`;
          if (sf.reason === 'structure contamination') return `  Ch.${sf.chNum}: DB still contains alternate-draft structure contamination — ${sf.structureReason || 'dirty source'}${sf.preview ? ` | ${sf.preview}` : ''}`;
          return `  Ch.${sf.chNum}: DB content (${sf.actualLen} chars) differs from polished content (${sf.expectedLen} chars)`;
        }).join('\n') +
        (saveFailures.length > 5 ? `\n  ... and ${saveFailures.length - 5} more.` : '') +
        '\n\nTry running Polish again. If failures persist, check the browser console for [POLISH-VERIFY] logs.'
      : '';

    const report = `Polish v6: ${savedCount} saved, ${unchangedCount} unchanged | Banned: -${ps.bannedRecastCount || 0} | Cap: ${ps.capFixed || 0}+${ps.capHygieneFixed || 0} | Voice: ${ps.voiceFixed || 0} | Trans: ${ps.transitionFixed || 0} | Dialog: ${ps.dialogPunctFixed || 0} | Filler: ${ps.dialogFillerFixed || 0} | Stack: ${ps.stackingFixed || 0} | Reps: ${ps.repFixed || 0} | SceneDupes: ${ps.sceneDuplicate?.blocksRemoved || 0} blocks/${ps.sceneDuplicate?.wordsRemoved || 0} words/${ps.sceneDuplicate?.reportedOnly || 0} reported | StyleTic: ${ps.styleTic?.fixed || 0}/${ps.styleTic?.familiesFound || 0} families | GrammarArtifacts: ${ps.styleTic?.grammarFixed || 0} | Vocab: ${ps.vocabCapped || 0} | Quotes: ${ps.quotesFixed || 0} | ExtAI: ${ps.externalPatternsFixed || 0} | LLM: ${ps.llmPolishCount || 0}/${ps.llmFallbackCount || 0}${anthLine}
` + changes.join('\n') + warningBlock + saveFailureBlock + ((ps.sceneDuplicate?.chaptersChanged || 0) > 0 ? `

Scene Duplicate Sweep changed ${ps.sceneDuplicate.chaptersChanged} chapter(s), removed ${ps.sceneDuplicate.blocksRemoved} duplicate block(s), and removed approximately ${ps.sceneDuplicate.wordsRemoved} duplicate word(s).` : '') + ((ps.sceneDuplicate?.reportedOnly || 0) > 0 ? `

Scene Duplicate Sweep reported ${ps.sceneDuplicate.reportedOnly} medium-confidence duplicate candidate(s) without removing them.` : '') + ((ps.sceneDuplicate?.skippedUnsafe || 0) > 0 ? `

Scene Duplicate Sweep skipped ${ps.sceneDuplicate.skippedUnsafe} candidate(s) because safety rules blocked removal.` : '') + ((ps.styleTic?.chaptersChanged || 0) > 0 ? `

Style Tic Sweep changed ${ps.styleTic.chaptersChanged} chapter(s).` : '') + (savedCount > 0 && saveFailures.length === 0 ? '\n\n✅ Re-export to get the updated manuscript.' : '');

    // WAVE5-SETTINGS: optional post-polish quality scan appended to the report.
    const fictionFinalCheck = await maybeFinalCheckAfterPolish({ project, loaded, onProgress: setBusyLabel });
    toast.info(report + (fictionFinalCheck?.length ? '\n\n🔎 Final check: ' + fictionFinalCheck.length + ' finding(s)\n' + fictionFinalCheck.slice(0, 10).join('\n') : (fictionFinalCheck ? '\n\n🔎 Final check: clean' : '')), { duration: 30000 });

    } catch (polishError) {
      console.error('[POLISH] FATAL ERROR:', polishError);
      toast.error('Polish failed: ' + (polishError.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
      await refreshAll();
    }
  };

  // ── SCAN & FIX ALL — calls criticAgent directly, bypasses handleScanChapter ──
  const handleScanFixAll = async () => {
    if (!project || busyLabel) return;
    const allChapters = [...chapters].filter(ch => chapterHasContent(ch)).sort((a, b) => a.chapter_number - b.chapter_number);
    if (!allChapters.length) { toast.error('No drafted chapters to scan.'); return; }
    if (!window.confirm(`Scan & Fix all ${allChapters.length} chapters? This runs the Critic Agent on each chapter once. May take several minutes.`)) return;

    captureSnapshot('Scan & Fix All');
    setBusyLabel('Scanning all chapters…');
    const results = { succeeded: [], failed: [], unchanged: [], skipped: [], startTime: Date.now() };

    for (let i = 0; i < allChapters.length; i++) {
      if (stopRequestedRef.current) break;
      const chapter = allChapters[i];
      const chapterNum = chapter.chapter_number || (i + 1);
      setBusyLabel(`Scan & Fix: chapter ${chapterNum} of ${allChapters.length} (${results.succeeded.length} fixed, ${results.unchanged.length} unchanged)`);

      // Skip chapters at max passes
      if ((chapter.scan_fix_passes || 0) >= 2) {
        results.skipped.push(chapterNum);
        continue;
      }

      try {
        const currentContent = await resolveChapterContent(chapter);
        if (!currentContent || currentContent.length < 100) { results.unchanged.push(chapterNum); continue; }

        const protagonistName = extractProtagonistName(project);
        const pronouns = project.protagonist_pronouns
          || (detectProtagonistPronouns(project) ? detectProtagonistPronouns(project) + '/' + (detectProtagonistPronouns(project) === 'she' ? 'her' : detectProtagonistPronouns(project) === 'he' ? 'him' : 'them') : 'they/them');

        // Skip cross-chapter context for anthologies — each story is standalone
        const prevCh = isAnthologyProject(project) ? null : allChapters[i - 1];
        const nextCh = isAnthologyProject(project) ? null : allChapters[i + 1];
        const previousEnding = prevCh ? (await resolveChapterContent(prevCh) || '').slice(-400) : '';
        const nextOpening = nextCh ? (await resolveChapterContent(nextCh) || '').slice(0, 400) : '';

        const criticResponse = await base44.functions.invoke('criticAgent', {
          chapterText: currentContent,
          chapterNumber: chapterNum,
          totalChapters: allChapters.length,
          protagonistName,
          protagonistPronouns: pronouns,
          genre: project.genre || 'fiction',
          previousChapterEnding: previousEnding,
          nextChapterOpening: nextOpening,
        });
        const criticResult = criticResponse?.data || criticResponse;

        if (criticResult?.success && criticResult?.cleanedText) {
          const cleaned = criticResult.cleanedText;
          // Content destruction guard
          const theyCount = (cleaned.match(/they they/gi) || []).length;
          const words = cleaned.split(/\s+/);
          const uniqueWords = new Set(words.map(w => w.toLowerCase()));
          if (theyCount > 10 || (words.length > 50 && uniqueWords.size / words.length < 0.05)) {
            console.error('[SCANFIX-ALL] Content destruction Ch.' + chapterNum); results.unchanged.push(chapterNum); continue;
          }
          if (cleaned.length < currentContent.length * 0.7) {
            console.warn('[SCANFIX-ALL] Output too short Ch.' + chapterNum); results.unchanged.push(chapterNum); continue;
          }
          if (cleaned.trim() === currentContent.trim()) {
            results.unchanged.push(chapterNum); continue;
          }
          // Save
          const mScore = mechanicalScore(cleaned);
          const contentFields = await prepareChapterContent(cleaned, project?.id || projectId, chapter.id, chapter);
          await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
            ...contentFields,
            word_count: countWords(cleaned),
            clean_score: mScore.score,
            scan_fix_passes: (chapter.scan_fix_passes || 0) + 1,
            status: 'reviewed',
          }));
          results.succeeded.push(chapterNum);
          console.log('[SCANFIX-ALL] Ch.' + chapterNum + ' fixed:', currentContent.length, '→', cleaned.length);
        } else {
          console.warn('[SCANFIX-ALL] Critic returned unsuccessful Ch.' + chapterNum);
          results.unchanged.push(chapterNum);
        }
      } catch (error) {
        console.error('[SCANFIX-ALL] Ch.' + chapterNum + ' failed:', error.message);
        results.failed.push({ chapter: chapterNum, error: error.message });
      }
      // 3s cooldown between chapters
      if (i < allChapters.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    const elapsed = Math.round((Date.now() - results.startTime) / 1000);
    const report = `Scan & Fix Complete!\n\n` +
      `✅ Fixed: ${results.succeeded.length} chapters\n` +
      `➖ Unchanged: ${results.unchanged.length} chapters\n` +
      (results.skipped.length ? `⏭️ Skipped (max passes): ${results.skipped.length} chapters\n` : '') +
      `❌ Failed: ${results.failed.length} chapters\n` +
      `⏱️ Time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s` +
      (results.failed.length ? `\n\nFailed: ${results.failed.map(f => 'Ch.' + f.chapter).join(', ')}` : '');
    toast.info(report, { duration: 15000 });
    stopRequestedRef.current = false;
    setBusyLabel('');
    await refreshAll();
  };

  const handleScanAll = async () => {
    if (!project) return;
    const drafted = chapters.filter((c) => chapterHasContent(c));
    if (!drafted.length) return;
    setBusyLabel('Scanning all chapters…');
    try {
    for (const chapter of drafted) {
      setBusyLabel(`Scanning chapter ${chapter.chapter_number} of ${drafted.length}…`);
      await handleScanChapter(chapter);
    }
    } finally {
      setBusyLabel('');
    }
  };

  const handleGenerateCover = async () => {
    if (!project) return;
    setBusyLabel('Generating cover art…');
    try {
    const imageResponse = await generateImageWithRetry({
      prompt: buildCoverPrompt(project),
      existing_image_urls: [],
    });
    const image = unwrapIntegrationResult(imageResponse);

    const _coverPayload = protectedProjectUpdate({
      cover_image_url: image.url, status: 'ready',
      phase: project.phase === 'foundation' ? 'drafting' : project.phase,
    });

    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _coverPayload));
    await runWithNetworkRetry(() => base44.entities.CoverArtGallery.create({
      project_id: project.id, image_url: image.url,
      prompt_summary: 'Auto-generated from Home tab',
    }));
    queryClient.invalidateQueries({ queryKey: ['cover-gallery', project.id] });
    } finally {
      setBusyLabel('');
    }
    await refreshAll();
  };

  const handleGenerateCoverWithPrompt = async (customPrompt) => {
    if (!project) return;
    setBusyLabel('Generating cover art…');
    try {
    const imageResponse = await generateImageWithRetry({
      prompt: customPrompt,
      existing_image_urls: [],
    });
    const image = unwrapIntegrationResult(imageResponse);

    const _coverPromptPayload = protectedProjectUpdate({
      cover_image_url: image.url, status: 'ready',
      phase: project.phase === 'foundation' ? 'drafting' : project.phase,
    });

    await runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, _coverPromptPayload));
    await runWithNetworkRetry(() => base44.entities.CoverArtGallery.create({
      project_id: project.id, image_url: image.url,
      prompt_summary: 'Custom prompt generation',
    }));
    queryClient.invalidateQueries({ queryKey: ['cover-gallery', project.id] });
    } finally {
      setBusyLabel('');
    }
    await refreshAll();
  };

  const handleUsePrompt = (prompt) => {
    updateSettingsDrafts((current) => ({
      ...current,
      seed_concept: prompt.content || '',
      ...(prompt.book_type ? { book_type: prompt.book_type } : {}),
      ...(prompt.genre ? { genre: prompt.genre } : {}),
    }));
    notebookRef.current?.goToTab('setup');
  };

  const handleChatbotUseIdea = (ideaData) => {
    // CHATFIX-1: complete mapping lives in the pure, tested helper —
    // setting/themes/characters/researchNeeds fold into the seed premise.
    const mapped = buildIdeaProjectFields(ideaData);
    updateSettingsDrafts((current) => ({ ...current, ...mapped }));
    notebookRef.current?.goToTab('setup');
  };

  // CHATFIX-1: the floating brainstorm's "Use This Idea" applies to the open
  // project through this event (previously it only copied to the clipboard).
  React.useEffect(() => {
    const onUseIdeaEvent = (e) => {
      if (e?.detail) {
        handleChatbotUseIdea(e.detail);
        toast.success('Idea loaded into Setup');
      }
    };
    window.addEventListener('ubs:use-idea', onUseIdeaEvent);
    return () => window.removeEventListener('ubs:use-idea', onUseIdeaEvent);
  });

  const handleSavePublishSettings = async (publishSettings) => {
    if (!project) return;

    await saveProject.mutateAsync({ publishSettings });
  };

  const handleGenerateCopyright = async () => {
    if (!project || busyLabel) return;
    setBusyLabel('Copyright: Building page…');
    try {
      const copyrightText = buildCopyrightText(project);
      setBusyLabel('Copyright: Saving front matter…');
      await saveCopyrightChapter({ project, chapters, copyrightText });
      setBusyLabel('Copyright: Refreshing project…');
      toast.success('Copyright page generated as front matter (Chapter 0). Review it in the Chapters tab.');
    } catch (err) {
      console.error('[COPYRIGHT] Failed:', err);
      toast.error('Copyright page failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
      await refreshAll();
    }
  };

  const handleGenerateBibliography = async () => {
    if (!project || busyLabel) return;
    setBusyLabel('Bibliography: Loading chapters…');
    try {
      const bibText = await generateBibliography({
        project,
        chapters,
        onProgress: (label) => setBusyLabel(label),
      });
      setBusyLabel('Bibliography: Saving back matter…');
      await saveBibliographyChapter({ project, chapters, bibText });
      setBusyLabel('Bibliography: Refreshing project…');
      toast.success('Bibliography generated! A "Bibliography & Sources" chapter has been added. Review it in the Chapters tab, then re-export.');
    } catch (err) {
      console.error('[BIBLIOGRAPHY] Failed:', err);
      toast.error('Bibliography generation failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
      await refreshAll();
    }
  };

  const handleSaveExportChapter = async (chapterId, content) => {
    if (!chapterId) return;

    // Guard against accidental blank overwrites. ExportTab should always send
    // content, but Find/Replace, autosave, and editor callbacks can route
    // through this path. Undefined/null content is never a valid save.
    if (content === undefined || content === null) {
      console.warn('[EXPORT SAVE] Refused to save undefined/null content for chapter:', chapterId);
      toast.error('Export save skipped: no chapter content was provided.');
      return;
    }

    const safeContent = String(content);

    const existingChapter = chapters.find((chapter) => chapter?.id === chapterId) || null;
    const exportContentFields = await prepareChapterContent(
      safeContent,
      project?.id || projectId,
      chapterId,
      existingChapter
    );

    await saveChapter.mutateAsync({
      id: chapterId,
      payload: {
        ...exportContentFields,
        word_count: countWords(safeContent),
      },
    });
  };

  const [currentUser_, setCurrentUser_] = React.useState(null);
  React.useEffect(() => { base44.auth.me().then(setCurrentUser_).catch(() => {}); }, []);
  if (isLoadingProject || isLoadingChapters) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading studio…</div>;

  // If the project fetch ERRORED (network, 429, timeout, 500), show a retry
  // screen — NOT the "Project Not Found" screen. The project almost certainly
  // still exists; the fetch just failed. Do not kick the user back to library.
  if (!project && isProjectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Couldn't load this project right now.</p>
        <p className="text-xs max-w-md text-center opacity-70">
          {projectError?.message ? String(projectError.message).slice(0, 200) : 'The server did not respond. This is usually a transient issue.'}
        </p>
        <div className="flex gap-2">
          <Button variant="default" className="rounded-full" onClick={() => refetchProject()}>Retry</Button>
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/')}>Back to Library</Button>
        </div>
      </div>
    );
  }

  // Only show "Project not found" when the query genuinely resolved with no
  // rows AND had no error. This is a real 404 — the project id in the URL
  // does not exist (deleted, wrong user, bad link).
  if (!project) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground"><p>Project not found.</p><Button variant="outline" className="rounded-full" onClick={() => navigate('/')}>Back to Library</Button></div>;
  // AUTH-3: no created_by email gate. The per-user data directory is the
  // authorization boundary — a project that loads from this session's store IS
  // this user's. Legacy records carry Base44-era emails that can never match.

  return (
    <main style={{ height: '100vh', overflow: 'hidden' }}>
      <style>{`
        .ubs-studio-root,
        .ubs-studio-root * {
          box-sizing: border-box;
        }

        .ubs-outline-left-pane,
        .ubs-outline-right-pane {
          min-width: 0;
          min-height: 0;
        }

        .ubs-outline-right-pane {
          width: 100%;
          max-width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .ubs-outline-right-pane > * {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          min-height: 0;
          flex: 1 1 auto;
        }

        .ubs-outline-right-pane textarea,
        .ubs-outline-right-pane [contenteditable="true"],
        .ubs-outline-right-pane pre,
        .ubs-outline-right-pane .ProseMirror {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          white-space: pre-wrap !important;
          word-break: normal !important;
          overflow-wrap: break-word !important;
        }

        .ubs-outline-right-pane h1,
        .ubs-outline-right-pane h2,
        .ubs-outline-right-pane h3,
        .ubs-outline-right-pane p,
        .ubs-outline-right-pane div,
        .ubs-outline-right-pane span {
          word-break: normal;
          overflow-wrap: break-word;
        }
      `}</style>
      <div className="ubs-studio-root" style={{ height: '100%', minWidth: 0, minHeight: 0 }}>

        <NotebookShell
          projectTitle={project.title || 'Untitled Project'}
          subtitle={project.tagline || project.seed_concept}
          navigateRef={notebookRef}
          initialTab={initialTab}
          headerActions={<UndoButton snapshot={undoSnapshot} onUndo={handleUndo} isUndoing={isUndoing} />}
          sections={[
            {
              id: 'home',
              label: 'Home',
              layout: 'split',
              left: (
                <StudioOverview
                  project={project}
                  chapters={chapters}
                  busyLabel={busyLabel}
                  onGenerateFoundation={handleGenerateFoundation}
                  onGenerateCover={handleGenerateCover}
                  onEvaluate={handleEvaluate}
                />
              ),
              right: (
                <HomeDashboard
                  project={project}
                  chapters={chapters}
                  onNavigateTab={(tab) => notebookRef.current?.goToTab(tab)}
                />
              ),
            },

            {
              id: 'setup',
              label: 'Setup',
              layout: 'split',
              left: (
                <SetupTab
                  side="left"
                  values={settingsDrafts}
                  onFieldChange={handleSettingFieldChange}
                  onBookTypeChange={handleBookTypeChange}
                  onGenreChange={handleGenreChange}
                  onLengthPresetChange={handleLengthPresetChange}
                  onApplyPovPreset={handleApplyPovPreset}
                  onSave={handleSaveSettings}
                  isSaving={saveProject.isPending}
                  busyLabel={busyLabel}
                  lastSaved={settingsAutoSave.lastSaved}
                />
              ),
              right: (
                <SetupTab
                  side="right"
                  values={settingsDrafts}
                  onFieldChange={handleSettingFieldChange}
                  onBookTypeChange={handleBookTypeChange}
                  onGenreChange={handleGenreChange}
                  onLengthPresetChange={handleLengthPresetChange}
                  onApplyPovPreset={handleApplyPovPreset}
                  onSave={handleSaveSettings}
                  isSaving={saveProject.isPending}
                  busyLabel={busyLabel}
                  lastSaved={settingsAutoSave.lastSaved}
                  project={project}
                  onRefresh={refreshAll}
                />
              ),
            },
            {
              id: 'foundation',
              label: 'Foundation',
              layout: 'split',
              left: (
                <FoundationTab
                  side="left"
                  project={project}
                  chapters={chapters}
                  activeDoc={activeDoc}
                  onActiveDocChange={setActiveDoc}
                  docDrafts={docDrafts}
                  onDocChange={(field, value) => setDocDrafts((current) => ({ ...current, [field]: value }))}
                  onSave={handleSaveDocs}
                  onGenerate={handleGenerateFoundation}
                  onExpand={handleExpand}
                  isSaving={saveProject.isPending}
                  busyLabel={busyLabel}
                  lastSaved={docsAutoSave.lastSaved}
                  researchData={researchData}
                  onResearch={handleResearch}
                  onOutlineResearch={handleOutlineResearch}
                  onFateResearch={handleFateResearch}
                  onReResearch={handleResearch}
                  onResearchChange={handleSaveResearch}
                  onGenerateCopyright={handleGenerateCopyright}
                  onGenerateBibliography={handleGenerateBibliography}
                  onRefreshAll={refreshAll}
                />
              ),
              right: (
                <FoundationTab
                  side="right"
                  project={project}
                  chapters={chapters}
                  activeDoc={activeDoc}
                  onActiveDocChange={setActiveDoc}
                  docDrafts={docDrafts}
                  onDocChange={(field, value) => setDocDrafts((current) => ({ ...current, [field]: value }))}
                  onSave={handleSaveDocs}
                  onGenerate={handleGenerateFoundation}
                  onExpand={handleExpand}
                  isSaving={saveProject.isPending}
                  busyLabel={busyLabel}
                  lastSaved={docsAutoSave.lastSaved}
                  researchData={researchData}
                  onResearch={handleResearch}
                  onOutlineResearch={handleOutlineResearch}
                  onFateResearch={handleFateResearch}
                  onReResearch={handleResearch}
                  onResearchChange={handleSaveResearch}
                  onGenerateCopyright={handleGenerateCopyright}
                  onGenerateBibliography={handleGenerateBibliography}
                  onRefreshAll={refreshAll}
                />
              ),
            },
            {
              id: 'outline',
              label: 'Chapters',
              layout: 'split',
              left: (
                <div className="ubs-outline-left-pane flex h-full min-w-0 flex-col gap-3 overflow-hidden">
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-3 text-xs leading-5 text-amber-950">
                    <div className="font-semibold">Batch drafting is draft-only.</div>
                    <p className="mt-1 text-amber-900/80">
                      Draft All and Rewrite All generate and save chapters. Run Fix Manuscript/Polish afterward for cleanup.
                    </p>
                  </div>
                  {draftIntegrityReport && (
                    <DraftIntegrityBanner
                      report={draftIntegrityReport}
                      onRedraftEmpty={handleRedraftEmpty}
                      onDismiss={() => setDraftIntegrityReport(null)}
                      busyLabel={busyLabel}
                    />
                  )}
                  {researchIntegrityError && (
                    <div className="rounded-2xl border border-red-200/70 bg-red-50/70 p-3 text-xs leading-5 text-red-950">
                      <div className="font-semibold text-red-700">Research Integrity Warning</div>
                      <p className="mt-1 text-red-900/80">
                        {researchIntegrityError} Nonfiction chapters will draft with fact-free filler until you go to <strong>Setup &gt; Research</strong> and generate or upload your research again.
                      </p>
                      <button
                        onClick={() => setResearchIntegrityError(null)}
                        className="mt-2 text-[10px] font-medium text-red-700 hover:text-red-900 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  {researchCoverageVerdict && !researchIntegrityError && (
                    <div className="rounded-2xl border border-red-200/70 bg-red-50/70 p-3 text-xs leading-5 text-red-950">
                      <div className="font-semibold text-red-700">Incomplete Research Coverage</div>
                      <p className="mt-1 text-red-900/80">
                        <strong>Research gaps detected.</strong> The outline introduces {researchCoverageVerdict.missingCount} topics across {researchCoverageVerdict.chaptersCount} chapters that are missing from your research data.
                      </p>
                      <ul className="mt-2 list-disc pl-4 text-[11px] text-red-800 space-y-0.5">
                        {researchCoverageVerdict.missing.slice(0, 5).map((topic, i) => (
                          <li key={i}>{topic}</li>
                        ))}
                        {researchCoverageVerdict.missingCount > 5 && (
                          <li>...and {researchCoverageVerdict.missingCount - 5} more</li>
                        )}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={handleOutlineResearch}
                          className="px-2.5 py-1 rounded-md bg-red-600 text-white text-[10px] font-medium hover:bg-red-700"
                        >
                          Auto-Research Gaps
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="min-h-0 flex-1">
                    <ChapterQueue chapters={chapters} selectedChapterId={selectedChapter?.id} onSelect={setSelectedChapterId} onDraftAll={handleDraftAll} onRedraftAllFresh={handleRedraftAllFresh} busyLabel={busyLabel} chapterProgress={chapterProgress} onStop={handleStop} onRepairMetadata={handleRepairChapterMetadata} />
                  </div>
                </div>
              ),
              right: (
                <div className="ubs-outline-right-pane">
                  <OutlineEditor
                    project={project}
                    chapter={selectedChapter}
                    chapters={chapters}
                    chapterDraft={chapterDraft}
                    onDraftChange={setChapterDraft}
                    onSave={handleSaveChapter}
                    isSaving={saveChapter.isPending}
                    onGenerateBeats={handleGenerateBeats}
                    onDraftChapter={handleDraftSelected}
                    onDraftAll={handleDraftAll}
                    onRewriteChapter={handleRewriteSelected}
                    onRewriteAll={handleRewriteAll}
                    busyLabel={busyLabel}
                    lastSaved={chapterAutoSave.lastSaved}
                    onStop={handleStop}
                    isFiction={!isNonfictionProjectAuthority(project)}
                    selectedProseModel={
                      normalizeModelId(
                        selectedChapter
                          ? (chapterProseModels[selectedChapter.id] || project?.default_prose_model || settingsDrafts.default_prose_model)
                          : (project?.default_prose_model || settingsDrafts.default_prose_model)
                      ) || DEFAULT_FICTION_PROSE_MODEL
                    }
                    onProseModelChange={(model) => selectedChapter && setChapterProseModels(prev => ({ ...prev, [selectedChapter.id]: model }))}
                    globalDefaultModel={normalizeModelId(project?.default_prose_model || settingsDrafts.default_prose_model) || DEFAULT_FICTION_PROSE_MODEL}
                    hasChapterOverride={!!(selectedChapter && chapterProseModels[selectedChapter.id])}
                    onResetToDefault={() => selectedChapter && setChapterProseModels(prev => {
                      const next = { ...prev };
                      delete next[selectedChapter.id];
                      return next;
                    })}
                    onRestoreOriginal={selectedChapter ? async () => {
                      const backup = await resolveBackupContent(selectedChapter);
                      if (!backup) {
                        toast.error('No backup found for this chapter.');
                        return;
                      }

                      const cf = await prepareChapterContent(
                        backup,
                        project?.id || projectId,
                        selectedChapter.id,
                        selectedChapter
                      );

                      await runWithNetworkRetry(() => base44.entities.Chapter.update(selectedChapter.id, {
                        ...clearRichContentFields(),
                        content_md_fallback_present: true,
                        ...cf,
                        word_count: countWords(backup),
                        backup_content: '',
                        backup_content_url: '',
                      }));

                      setChapterDraft(backup);
                      await refreshAll();
                      toast.success('Original content restored.');
                    } : undefined}
                    onRestorePreviousVersion={selectedChapter ? () => handleRestorePreviousVersion(selectedChapter) : undefined}
                    hasPreviousVersion={hasPreviousVersion}
                  />
                </div>
              ),
            },
            {
              id: 'review',
              label: 'Polish',
              layout: 'split',
              left: <ReviewChapterList chapters={chapters} />,
              right: <ManuscriptDashboard project={project} chapters={chapters} busyLabel={busyLabel} polishResults={polishResults} onFixEntireManuscript={handlePolishRouted} />,
            },
            {
              id: 'export',
              label: 'Export',
              layout: 'wide',
              content: <ExportTab project={project} chapters={chapters} onSaveSettings={handleSavePublishSettings} onSaveChapter={handleSaveExportChapter} isSavingChapter={saveChapter.isPending} />,
            },
            {
              id: 'cover',
              label: 'Cover',
              layout: 'wide',
              content: <CoverCreator project={project} busyLabel={busyLabel} />,
            },
            {
              id: 'preview',
              label: 'Preview',
              layout: 'wide',
              content: <PreviewTab project={project} chapters={chapters} />,
            },
            {
              id: 'tools',
              label: 'Tools',
              layout: 'wide',
              content: (
                <ToolsTab
                  project={project}
                  chapters={chapters}
                  onUsePrompt={handleUsePrompt}
                  onUseIdea={handleChatbotUseIdea}
                  busyLabel={busyLabel}
                  setBusyLabel={setBusyLabel}
                  onProjectRefresh={(fresh) => {
                    skipProjectSyncRef.current = true;
                    queryClient.setQueryData(['novel-project', projectId], [fresh]);
                  }}
                  onRefreshAll={refreshAll}
                />
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
