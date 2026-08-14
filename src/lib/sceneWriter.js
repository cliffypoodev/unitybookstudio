/**
 * Scene-by-scene chapter generation — Sudowrite-style architecture.
 * v14: preserves scene richness while preventing same-event restarts, summary flattening, and blunt on-the-nose dialogue.
 *
 * Defensive version:
 * - DeepSeek-only prose routing through modelRouting.js.
 * - Handles raw string LLM responses and wrapped object responses.
 * - Returns legacy compatibility fields expected by ProjectStudio.
 * - Calls chapter summary save with the correct chapterId/content/chapterNumber signature.
 */

import { stripDroppedWordSentences, stripMangledSentences, fixIndefiniteArticles, buildFactLedger, checkClockTimeViolations, checkFateViolations, stripFactLedgerViolations, buildFactLedgerPromptBlock } from './nfContentGuard.js'; // DRAFTGATE-2 & 3 + ARCH-1C
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-3
import { extractRequiredFinalLine, enforceExactFinalLine } from '@/lib/exactFinalLine';
import { buildProjectContextHeader, unwrapIntegrationResult, countWords, buildAuthorVoiceInstruction } from '@/lib/autonovel';
import { verifySceneProvenance, verifyContiguousSceneSequence } from '@/lib/generationContext';
import { isNonfictionProject } from '@/lib/manuscriptStats';
import { buildSetupConstraints, resolveChapterCount } from '@/lib/setupConstraints';
import { buildPovTenseBlock } from '@/lib/povTense';
import { cleanGeneratedProse } from '@/lib/proseQuality';
import { snapshot as pipelineSnapshot, captureReplayDiagnostic } from '@/lib/pipelineDiag';
import { runDialogueMechanicsPass } from '@/lib/dialogueMechanicsRepair'; // DIALOGUEFIX-1
import { applyAnthologyNameRenames, extractProminentProseNames } from '@/lib/anthologyRenamePass'; // RENAMEPASS-1 + NAMEREG-1
import { scrubModelLeaks } from '@/lib/modelLeakGuard'; // LEAKFIX-1
import { labelCompositeCharacters, fixFoiaAnachronisms, flagUnverifiedStats } from '@/lib/postClean';
import { crossCheckResearchFabrication } from '@/lib/qualityScan';
import { base44 } from '@/api/base44Client';
import {
  COMPACT_CRAFT_RULES,
  COMPACT_ANTI_SLOP,
  ANTI_DETECTION_PROSE_RULES_NF,
  NONFICTION_HARD_RULES,
  NONFICTION_NARRATIVE_CRAFT,
  COMEDY_CRAFT_RULES,
  isComedyBeatStyle,
  getComedyBeatInstruction,
  HUMAN_PROSE_PRIORITY_BLOCK,
} from '@/lib/craftCompact';
import { buildCustomAuthorStyleBlock, loadAuthorStyle } from '@/lib/authorStylePrompt';
import { buildPriorChapterEventLedger } from '@/lib/eventLedger'; // EVENTLEDGER-1B
import { buildPronounCanon, buildPronounCanonLines, harvestCastNames } from '@/lib/pronounLock'; // PRONOUNLOCK-1
import { buildRoleCanonLine } from '@/lib/canonRoles'; // CANON-2
import { buildBookStyleLedger, buildStyleBudgetPromptBlock } from '@/lib/aiSlopReduction'; // STYLEBUDGET-1
import { buildSeriesContinuityBlock } from '@/lib/seriesBible';
import { buildVolumeContractBlock } from '@/lib/volumeBible';
import { runSeriesContractGate } from '@/lib/seriesContractGate';
import { buildEroticaAuthorityBlocks } from '@/lib/eroticaAuthority';
import { MANDATORY_ENFORCEMENT_BLOCK } from '@/lib/enforcementBlock';
import { pickModel, pickFallbackModel, normalizeModelId, buildFallbackControls, isWhitelistedProseModel } from '@/lib/modelRouting';
import {
  buildRollingContext,
  getPreviousChapterEnding,
  ANTI_REPETITION_RULES,
  generateAndSaveSummary,
} from '@/lib/chapterCohesion';
import { excludeForeignQuotes } from '@/lib/quoteLedger';
import { getTwistContextForChapter, getAnthologyTwistBlock } from '@/lib/plotTwists';
import { resolveResearchContent } from '@/lib/researchStorage';
import { buildPacingBlock } from '@/lib/pacingModulation';
import { getRelevantResearch } from '@/lib/fictionResearch';
import { researchCoverageCheck } from '@/lib/researchCoverage';
import { 
  normalizeSceneBeatsForDrafting, 
  validateSceneContractReplay, 
  isCleanMetadata, 
  extractEventSignature, 
  extractProseEventSignatures, 
  classifyStoryFunction,
  auditSceneFutureBoundaries,
  auditSceneExitOvershoot,
  buildExitOvershootRepairPrompt,
  validateGeneratedSceneReplay,
  buildFutureBoundaryRepairPrompt,
  validateRawBeatChronology,
  repairRawContract
} from './sceneBeatNormalizer.js';

import {
  assertNarrativeTextClean,
  assertSceneContractUnchanged,
  applySceneExecutionPromptCanary,
  collectSceneExecutionCanaryEvidence,
  createImmutableSceneContract,
  finalizeSceneExecutionCanaryEvidence,
  findNarrativeMetaLeaks,
  prepareSceneExecutionCanaryTrial,
  prepareSceneExecutionPromptCanary,
  prepareSceneExecutionShadowIntegration,
  prepareSceneExecutionAcceptanceState,
  resolveSceneExecutionFlags, // DEADGATE-1
  reportSceneExecutionGateStatus, // DEADGATE-1
  evaluateSceneExecutionAcceptance,
} from '@/lib/generationContext';
import { buildProjectContinuityLockBlock, validateProjectChapterContent } from '@/lib/projectContentGuard';
import { auditSceneAgainstLedger, buildSceneContractRepairInstruction } from '@/lib/sceneContractGate';
import { buildCanonNameLockBlock, repairCanonNameDrift } from '@/lib/canonNameLock';
import { repairChapterQuotes } from '@/lib/quoteFixPolish';
import { repairManuscriptArtifacts } from '@/lib/manuscriptArtifactRepair';
import { buildAnthologyChapterVarietyBlock } from '@/lib/anthologyVarietyGuard';
import { buildInitialLedger, extractSceneLedgerUpdates, serializeLedger, cloneLedger, boundLedger, summarizeLedger, canonicalizeLedgerNames, setHolderOfRecord } from "@/lib/narrativeLedger";
import { inferCastGenders } from '@/lib/referentResolver';
import { trackedObjectsFromSpecs, dedupeTrackedObjects, holdersFromSpecState } from '@/lib/objectPossession';
import { measureRhythm, formatRhythmLine, isSeverelyFlat, isSeverelyGestural, pickBetterTake, buildRhythmRegenInstruction, buildGestureRegenInstruction } from '@/lib/proseRhythm';
import {
  isAnthologyProject,
  isNonfictionAnthology,
  buildAnthologyStoryContext,
  buildAnthologySpiceProseBlock,
  buildAnthologySpiceBeatContext,
} from '@/lib/anthologyEngine';

console.log('[SCENE-WRITER] Loaded sceneWriter-RECOVERY-v19-nf-target-clamp-no-negative-scene-words');

function extractTextFromLLMResult(value) {
  if (value == null) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractTextFromLLMResult).filter(Boolean).join('\n\n');
  }

  if (typeof value === 'object') {
    const direct =
      value.text ??
      value.prose ??
      value.content ??
      value.body ??
      value.output ??
      value.result ??
      value.response ??
      value.completion ??
      value.generated_text ??
      value.generatedText ??
      value.message?.content ??
      value.choices?.[0]?.message?.content ??
      value.choices?.[0]?.text ??
      value.data?.text ??
      value.data?.content ??
      value.data?.prose ??
      value.data?.message?.content;

    if (direct != null && direct !== value) {
      const extracted = extractTextFromLLMResult(direct);
      if (extracted) return extracted;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

function safeText(value, fallback = '') {
  if (value == null) return fallback;
  return String(value);
}

function compact(value, max = 6000) {
  const s = safeText(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n...[truncated for prompt size]`;
}

const NF_CANNED_CASUALTY_LEDGER_PARAGRAPH_RX = /(?:^|\n\s*)The casualty record should be treated as an evidence problem rather than a conclusion\.\s*The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths\.\s*A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot\.\s*(?=\n|$)/gi;

const NF_GENERATED_SCAR_TISSUE_RX = [
  NF_CANNED_CASUALTY_LEDGER_PARAGRAPH_RX,
  // Broad scars from the failed source-ledger architecture. These are NOT
  // generic banned words; they are specific generated story-world inventions
  // and boilerplate paragraphs that must not be recycled as context.
  /(?:^|\n\s*)The available accounts do not cleanly reconcile[\s\S]{0,700}?during the riot\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The official record presents a settled ledger[\s\S]{0,1200}?physical evidence suggests an unrecorded transaction\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The official tally of the 1954 riot[\s\S]{0,1600}?locked door\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The phrase [“"]the shop that cooked[”"][\s\S]{0,1800}?specific trauma within the oral history of the prison\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The newly discovered cellblock registers[\s\S]{0,1600}?researchers could systematically track[\s\S]{0,600}?1954 riot[\s\S]{0,500}?/gi,
  /(?:^|\n\s*)Contemporary administrative records and later correctional histories identify it as the master key[\s\S]{0,1800}?Someone possessed the means to do it\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The process yielded four names that appeared consistently across the disparate, incomplete records[\s\S]{0,2600}?The four probable names were the first exhumation\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)On the page dated September 21[\s\S]{0,2200}?Voc\. Shop B secured per order\. M-key used[\s\S]{0,2200}?buried the reason\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The guard’s logbook was a nondescript ledger[\s\S]{0,3600}?M-key used[\s\S]{0,2200}?artifact of procedure[\s\S]{0,1200}?all rules dissolved\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The surviving logbook for September 1954[\s\S]{0,2600}?Voc\. Shop B secured per order\. M-key used[\s\S]{0,2000}?larger record effectively erased\.\s*(?=\n|$)/gi,
  /\bLawrence [“"]Bud[”"] Gant\b[\s\S]{0,1800}?\bPaulie Russo\b[\s\S]{0,1800}?/gi,
];

function sanitizeNonfictionContextScarTissue(value) {
  let text = safeText(value);
  if (!text) return '';

  for (const rx of NF_GENERATED_SCAR_TISSUE_RX) {
    text = text.replace(rx, '\n');
  }

  // These phrases were generated by earlier defensive patches and should never be
  // re-fed as source context. If truly verified, the user/source system must supply
  // the underlying document, not the prior manuscript wording.
  text = text
    .replace(/\bVoc\. Shop B secured per order\. M-key used\.?/gi, '')
    .replace(/\bVocational Shop B\b/gi, 'the vocational shop')
    .replace(/\bShop B\b/g, 'the shop')
    .replace(/\bM-key\b/g, 'master key')
    .replace(/\bthe shop that cooked\b/gi, 'the workshop fire story')
    .replace(/\bcomplete destruction of evidence by fire\b/gi, 'severe fire damage')
    .replace(/\bLawrence [“"]Bud[”"] Gant\b/gi, 'one unnamed inmate')
    .replace(/\bHenry Clay\b/gi, 'one unnamed inmate')
    .replace(/\bRobert [“"]Bobby[”"] Vickers\b/gi, 'one unnamed inmate')
    .replace(/\bPaulie Russo\b/gi, 'one unnamed inmate')
    .replace(/\bThe available accounts do not cleanly reconcile the count, location, and sequence\.?/gi, 'The records leave the exact sequence unresolved.')
    .replace(/\bThe four probable names were the first exhumation\.?/gi, '')
    .replace(/\bThe process yielded four names\b/gi, 'The record did not yield verified names')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function extractProtagonistName(project) {
  if (!project?.characters_md) return 'the protagonist';

  const match = project.characters_md.match(/protagonist[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (match) return match[1];

  const nameMatch = project.characters_md.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/);
  if (nameMatch) return nameMatch[1];

  const singleName = project.characters_md.match(/\b([A-Z][a-z]{2,})\b/);
  return singleName ? singleName[1] : 'the protagonist';
}

function quickSceneEval(proseInput, spec, targetWords, project = {}) {
  const prose = extractTextFromLLMResult(proseInput);
  const words = prose.trim().split(/\s+/).filter(Boolean);
  const blockingIssues = [];
  const warnings = [];

  if (!(isNonfictionProject(project) || isNonfictionAnthology(project))) {
    const metaLeaks = findNarrativeMetaLeaks(prose);
    if (metaLeaks.length) {
      blockingIssues.push(
        `Manuscript planning-language leakage detected: ${metaLeaks.slice(0, 3).map((item) => `"${item.phrase}"`).join(', ')}. Rewrite as immersive story prose without referring to chapters, scene IDs, beats, contracts, or the drafting process.`
      );
    }
  }

  // SEVERE (nonfiction): invented names not present in research → blocking, retry
  // NFCLASS-3: this was `project?.book_type === 'nonfiction'` — a raw, case-sensitive
  // equality that ignored project_type entirely, while isNonfictionProject 2,800 lines
  // below in the same file used the authority. Divergence proven: a project declared
  // { project_type: 'nonfiction' } (a shape this app produces) drafted as nonfiction and
  // skipped every anti-fabrication gate. So did { book_type: 'Nonfiction' }.
  if (isNonfictionProjectAuthority(project)) {
    try {
      const { compositeNames } = labelCompositeCharacters(prose, project, spec?.chapter);
      if (Array.isArray(compositeNames) && compositeNames.length > 0) {
        blockingIssues.push(`Fabricated entities not found in the research: ${compositeNames.join(', ')}. Rewrite using ONLY people, organizations, quotes, and documents that appear in the supplied research. Do not invent names, dispatches, or quotations.`);
      }
    } catch (e) { /* detector unavailable — do not block */ }
    // Widen the net: catch invented QUOTES, titled OFFICIALS, and DOCUMENTS that
    // are not in the research (the composite-name check above misses these).
    try {
      const fab = crossCheckResearchFabrication(prose, project);
      if (!fab.clean) {
        const quotes = fab.violations.filter((v) => v.type === 'quote').map((v) => `"${v.snippet}"`);
        const others = fab.violations.filter((v) => v.type !== 'quote').map((v) => v.snippet);
        const parts = [];
        if (others.length) parts.push(`named sources not in the research: ${others.join('; ')}`);
        if (quotes.length) parts.push(`quotations not in the research: ${quotes.join('; ')}`);
        blockingIssues.push(`Unsourced material detected — ${parts.join(' | ')}. Rewrite this section using ONLY people, titles, organizations, documents, and quotations that appear in the supplied research. Do not invent or paraphrase a quote, official, dispatch, ledger, court order, or newspaper. If the research contains no source for a claim, OMIT the claim entirely — do not write about silences, gaps, or what the record does not show.`);
      }
    } catch (e) { /* detector unavailable — do not block */ }
    // Deterministic source check at section level (rewrite-first): invented
    // sources get rewritten IN CONTEXT here via the existing repair loop; the
    // end-of-chapter strip stays as last resort, so hard cuts — and the
    // orphaned references they leave behind — become rare.
    try {
      const srcFlags = deterministicSourceCheck(prose, project);
      if (srcFlags.length > 0) {
        blockingIssues.push(`Sources cited that are NOT in the research: ${srcFlags.map((v) => v.snippet).join(' | ')}. Rewrite this section citing ONLY sources named in the supplied research. Do not cite any archive, record, report, log, document, newspaper, or statistic that is not in the research — where no source exists, omit the claim entirely (do not narrate silences or gaps in the record). Also remove or rewrite any sentence that refers back to a source you are removing.`);
      }
    } catch (e) { /* detector unavailable — do not block */ }
    // ARCH-1C: clock times and figure fates are closed-world. Both checkers are
    // deterministic and were measured at zero false positives on 97k words of
    // real prose before wiring, so they block (rewrite-first) rather than
    // strip-only.
    try {
      const ledger = buildFactLedger(project);
      const clockV = checkClockTimeViolations(prose, ledger);
      if (clockV.length > 0) {
        blockingIssues.push(`Clock times not present in the research: ${clockV.slice(0, 3).map((v) => v.atom).join(', ')}. The research is the only permitted source for a time of day. Rewrite each affected sentence using either a clock time that appears in the research or general phrasing (that morning, around midday) — never invent a specific time.`);
      }
      const fateV = checkFateViolations(prose, ledger);
      if (fateV.length > 0) {
        blockingIssues.push(`Life-outcome claims not attested in the research: ${fateV.slice(0, 3).map((v) => v.atom).join(', ')}. The research does not state this person's death, survival, rescue, or injury. Rewrite each affected sentence to say only what the research documents about them — do not state or imply whether they lived, died, escaped, or were hurt.`);
      }
    } catch (e) { /* ledger unavailable — do not block */ }
  }

  // SEVERE: degenerate non-Latin output (model loop) → blocking, force retry
  const cjkMatches = prose.match(/[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g);
  if (cjkMatches && cjkMatches.length > 10) {
    blockingIssues.push(`Degenerate output: ${cjkMatches.length} non-Latin (CJK) characters detected. Rewrite the section as clean English prose only.`);
  }

  // SEVERE: under-target output → blocking
  // LENGTHGATE-1A: the old rule (< 50% of target AND < 300 absolute) let a scene at
  // 46% of an 800-word target pass because it cleared 300 words. Measured live: a
  // 5-section nonfiction chapter delivered ~366-word sections against 800-word
  // targets, assembled 1,830 words against a 4,000-word chapter target, and no gate
  // fired anywhere. Under-delivery now blocks relative to the target itself and
  // enters the existing repair loop. The absolute floor survives only as a lower
  // bound so tiny intentional targets cannot thrash the repair loop.
  const sceneWordFloor = Math.max(150, Math.round(targetWords * 0.6));
  if (words.length < sceneWordFloor) {
    blockingIssues.push(`Scene is only ${words.length} words — target was ${targetWords} (minimum ${sceneWordFloor}). Write complete, fully developed prose to the target length, not a summary or a compressed overview.`);
  }

  // SEVERE: dropped-word hole → blocking, force regeneration (DRAFTGATE-1A).
  // Article + preposition + article ("a to the", "an of the") is never valid
  // English prose — it is the fingerprint of the model dropping a banned or
  // skipped noun mid-phrase ("a [testament] to the…"). Measured live: four such
  // holes across three saved chapters, caught only by the export gate. Repairing
  // deterministically would mean inventing the missing word, so the scene is
  // blocked and the model rewrites the sentence itself. Mode-independent: this
  // is grammar, not a nonfiction rule.
  // DRAFTGATE-3B: widened dropped-word object net (possessives and demonstratives)
  const droppedWordHoles = prose.match(/\b(?:a|an)\s+(?:(?:to|of|in|on|for|with|from|by|at)\s+(?:the|its|this|that|their|his|her|these|those|a|an)\b|(?:to|of|in|on|for|with|from|by)\s+(?=[a-z]))/gi);
  if (droppedWordHoles && droppedWordHoles.length > 0) {
    blockingIssues.push(`Malformed sentence — dropped word (${droppedWordHoles.length} instance(s): ${droppedWordHoles.slice(0, 3).join(' | ')}). An article followed directly by a preposition means a noun was omitted. Rewrite each affected sentence with complete grammar; do not skip nouns after articles.`);
  }

  // SEVERE: tense drift → blocking
  if (spec.tense === 'past') {
    const stripped = prose.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, '');
    const presentVerbs = stripped.match(
      /\b(?:he|she|they|it|[A-Z]\w+)\s+(?:walks|runs|says|thinks|feels|sees|stands|looks|turns|opens|moves|reaches|pulls|pushes|steps|sits|rises|speaks|watches|grabs|holds|takes|puts|makes|gives|comes|goes|gets|knows|finds|tells|asks|leaves|starts|stops|calls|tries)\b/gi
    );

    if (presentVerbs && presentVerbs.length > 3) {
      blockingIssues.push(`Tense drift: ${presentVerbs.length} present-tense verbs detected in past-tense narration. Write in past tense.`);
    }
  }

  if (spec.tense === 'present') {
    const stripped = prose.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, '');
    const pastVerbs = stripped.match(
      /\b(?:he|she|they|it|[A-Z]\w+)\s+(?:walked|ran|said|thought|felt|saw|stood|looked|turned|opened|moved|reached|pulled|pushed|stepped|sat|rose|spoke|watched|grabbed|held|took|put|made|gave|came|went|got|knew|found|told|asked|left|started|stopped|called|tried)\b/gi
    );

    if (pastVerbs && pastVerbs.length > 4) {
      blockingIssues.push(`Tense drift: ${pastVerbs.length} past-tense verbs detected in present-tense narration. Write in present tense.`);
    }
  }

  // SEVERE: instruction/meta leakage → blocking
  const leakPatterns = [
    /\bRewrite to\b/i,
    /\bAdjust the\b/i,
    /\bAddress the\b/i,
    /\bEnsure that\b/i,
    /\bas an AI\b/i,
    /\bHere is the\s+(?:scene|chapter|prose)/i,
    /\bLet me know/i,
    /\b(?:first|second|third|fourth|final)\s+twist\b/i,
    /\b(?:inciting incident|midpoint|all is lost|dark night of the soul|break into two|break into three|plot point|pinch point|chapter hook|exit hook|story beat|scene beat|beat label|chapter function|narrative function)\b/i,
    /\b(?:the lesson|the theme|the reveal)\s+(?:was|is)\b/i,
    /\b(?:supplied|provided)\s+(?:research|materials?|sources?|documents?)\b/i,
    /\bresearch\s+pack\b/i,
    /\bthe\s+research\s+(?:contains|offers|provides|does\s+not\s+contain|shows\s+no)\b/i,
    // SCAFFOLDFIX-1: chapter-scaffold essay meta — the writer narrating the book's structure.
    /\bthis\s+(?:chapter|section|book)\b/i,
    /\bin\s+conclusion\b/i,
    /\bas\s+we\s+(?:transition|move\s+forward|delve|examine|explore)\b/i,
    /\bset(?:s|ting)?\s+the\s+stage\b/i,
    /\blay(?:s|ing)?\s+the\s+groundwork\b/i,
    /\bthe\s+(?:next|following|previous|preceding)\s+chapter\s+(?:will|examines?|explores?|traces?|turns?|looks?|delves?|investigates?|reconstructs?|details?|covers?|addresses?|considers?|shows?)\b/i,
  ];

  for (const rx of leakPatterns) {
    if (rx.test(prose)) {
      blockingIssues.push('Instruction leak detected — output contains meta-commentary instead of pure prose.');
      break;
    }
  }

  // GATEFIX-25: after lightCleanSceneOutput trims truncated tails, an ending that still
  // lacks terminal punctuation means no complete sentence exists — that is a truncated
  // generation and must go through the repair loop, never ship. Em-dash is NOT terminal.
  const lastChar = prose.trim().slice(-1);
  if (prose && !['.', '!', '?', '"', '\u201D'].includes(lastChar)) {
    blockingIssues.push('Scene ends mid-sentence (generation truncated) — regenerate this section.');
  }

  const allIssues = [...blockingIssues, ...warnings];
  return {
    hasBlockingIssue: blockingIssues.length > 0,
    issues: allIssues,
    issue: allIssues[0] || null,
    wordCount: words.length,
    warnings,
  };
}

function pickProseModel(project, modelOverride) {
  const base = normalizeModelId(pickModel('prose', project));

  // WAVE5-MODELPICKER: a whitelisted override is HONORED (per-chapter picks
  // and the project default finally work); anything unknown/stale still falls
  // back to the routed model — the warn below is finally truthful.
  const requested = normalizeModelId(modelOverride);
  if (requested && isWhitelistedProseModel(requested)) {
    if (requested !== base) {
      console.log('[MODEL] Honoring prose model override:', requested, '(routed default was', base + ')');
    }
    return requested;
  }
  if (requested && requested !== base) {
    console.warn('[MODEL] Ignored non-whitelisted prose model override:', requested, '→ using:', base);
  }

  console.log('[MODEL] Local prose routing | Genre:', project?.genre || 'unknown', '→', base);
  return base;
}

function buildAuthorVoiceCompact(project) {
  const parts = [];

  if (project?.author_voice && project.author_voice !== 'Custom / None') {
    const dossier = buildAuthorVoiceInstruction(project);
    parts.push(dossier);   // full craft fingerprint when a dossier exists; falls back to the generic line otherwise
  }

  if (project?.author_voice_notes) {
    parts.push(`CUSTOM VOICE NOTES: ${project.author_voice_notes}`);
  }

  if (project?.voice_md) {
    parts.push(`PROJECT VOICE GUIDE: ${compact(project.voice_md, 1800)}`);
  }

  return parts.join('\n\n');
}

function buildAuthorVoiceReminder(project) {
  let reminder = '';
  if (project?.author_voice && project.author_voice !== 'Custom / None') {
    reminder = `VOICE LOCK (APPLY NOW AS YOU WRITE): Render this section in the voice of ${project.author_voice}. Honor the PROSE MECHANICS, SENSORY FOCUS, and ANTI-TROPES defined earlier — concrete documented detail over mood, specific named sources over vague phrasing, and absolutely no invented people, quotes, or events. If a fact is not in the supplied research, leave it out rather than dramatize it.`;
  }
  if (isNonfictionProjectAuthority(project)) {
    const nfRule = `SOURCE FIDELITY (NONFICTION, ABSOLUTE): Use ONLY the proper names, titles, organizations, dates, quotations, and documents that appear verbatim in the supplied research/source pack. You may NOT introduce any named person, officer, clerk, letter, dispatch, or quoted line that is not in that material. If the research does not name someone, write around it ("a Union officer," "a shipping clerk") — never invent a name or a quote. Inventing a source is a critical failure.

ENTITY DISCIPLINE: Never merge facts about two different named people, plantations, holdings, or documents. Every claim about a person must trace to research text about THAT person. If the research describes two people with separate facts, they remain two people with separate facts — do not transfer a number, size, action, or date from one to the other, and never present a difference between two sources' subjects as a "discrepancy" in one subject.

CHRONOLOGY & SEASON DISCIPLINE: Never infer agricultural, seasonal, or logistical timing that the research does not state. Do not claim a harvest, planting, or season was beginning or ending on a given date unless the research says so, and never build a causal argument on inferred timing.

QUOTE & THESIS DISCIPLINE: Each verbatim quotation may appear at most ONCE in the chapter — never reuse a quote as a refrain or callback. Attribute arguments to their sources; the chapter's own narrating voice must not repeatedly assert OR repeatedly deny the book's thesis. State what the record shows, what named parties claimed, and move forward — at most one passage per chapter about what sources do not say.

META DISCIPLINE: The book's narrating voice must NEVER mention "the research," "the supplied research," "the provided materials," "the research pack," or "the sources provided." Write "the record," "the sources," "the archives," or name the specific collection. The reader must never see the machinery.

SOURCE-LABEL FIDELITY: Cite each narrator's collection exactly as the research states it for THAT narrator. Never label a narrator with a Texas volume (mesn161-164) unless the research lists that volume as their source. A narrator from another state's collection may appear ONLY with their true origin stated plainly (for example, "a Georgia narrator recorded by the same project") and only as comparison — never woven in as a Texas witness. Never attribute physical or textual details to a document (times of day, ink, specific clauses) unless the research states them.

TESTIMONY CONTENT DISCIPLINE: Never characterize what a witness's testimony "describes," "notes," "recalls," or "shows" beyond that witness's documented_actions and quote in the research. If a witness's research quote is empty, you may state their documented role and actions only — you may NOT describe, summarize, or imply the content of their words at all. Never attach one witness's quote, quote fragment, or subject matter to a different witness.
SCENE CONTINUITY DISCIPLINE: You are writing ONE continuous chapter, not standalone essays. Never write "this chapter", "this section", "this book", "in conclusion", "as we transition", "as we move forward", "as we delve", or "sets the stage". Never open a scene by re-introducing the chapter's subject or close a scene by summarizing it. Do not restate facts, dates, or thesis claims already established earlier in the chapter. Pick up where the prior prose left off and advance the account with NEW material from the evidence.`;
    reminder = reminder ? `${reminder}\n\n${nfRule}` : nfRule;
  }
  return reminder;
}

function getEffectiveContentSettings(project = {}) {
  const level = String(project?.reading_level || 'adult').toLowerCase();
  const isChildSafe = ['children', 'middle_grade'].includes(level);
  const isYA = level === 'young_adult' || level === 'ya';

  let spice = Number(project?.spice_level || 0);
  let gore = Number(project?.gore_level || project?.violence_level || 0);
  let language = Number(project?.language_intensity || 0);

  if (isChildSafe) {
    spice = 0;
    gore = Math.min(gore, 1);
    language = 0;
  } else if (isYA) {
    spice = Math.min(spice, 1);
    gore = Math.min(gore, 2);
    language = Math.min(language, 2);
  }

  return {
    spice_level: spice,
    gore_level: gore,
    violence_level: gore,
    language_intensity: language,
    reading_level: level,
  };
}

function buildSpiceCompact(project) {
  const effectiveSettings = getEffectiveContentSettings(project);

  if ((project.book_type !== 'fiction' && project.project_type !== 'anthology') || Number(effectiveSettings.spice_level) < 1) {
    return '';
  }

  return `INTIMACY: Spice ${effectiveSettings.spice_level}/4. Erotica register: ${project.erotica_register || 0}/3.`;
}

function buildViolenceCompact(project) {
  const effectiveSettings = getEffectiveContentSettings(project);
  const violence = Number(effectiveSettings.violence_level || effectiveSettings.gore_level || 0);
  if (violence < 1) return '';
  const labels = ['None', 'Mild Peril', 'Moderate Action', 'Intense', 'Graphic', 'Extreme / Restricted'];
  return `VIOLENCE: Level ${violence}/5 (${labels[violence] || labels[0]}). ${violence <= 2 ? 'Non-graphic.' : violence <= 3 ? 'Visceral but purposeful.' : 'Genre-appropriate intensity.'}`;
}

function buildFanfictionEroticaBridgeBlock(project) {
  const lane = String(project?.content_lane || '').toLowerCase();
  const rights = String(project?.rights_mode || '').toLowerCase();
  const genre = String(project?.genre || '').toLowerCase();
  const subgenre = String(project?.subgenre || '').toLowerCase();
  const spice = Number(project?.spice_level || 0);
  const isFanfic = lane === 'fanfiction' || rights === 'fanfiction_noncommercial' || Boolean(project?.fandom_name || project?.source_universe);
  const eroticFanfic = isFanfic && (spice >= 2 || /erotic|erotica|explicit fanfic|adult fanfic|smut|lemon|kink|bdsm|omegaverse/.test(`${genre} ${subgenre}`));

  if (!eroticFanfic) return '';

  return `FANFICTION + EROTICA BRIDGE:
- This is a fan-fiction / shared-universe project with adult heat enabled.
- Preserve canon voice, fandom setting, ship dynamics, continuity, tropes, and source-universe constraints while honoring the configured spice level.
- Do not silently downgrade adult fanfic to clean romance just because the content lane is Fan Fiction.
- Do not bypass the erotica prose register. If spice is 3 or 4, intimate scenes must remain on-page and explicit according to the project's settings.
- Treat fandom/canon material as continuity context, not as a reason to remove the adult-content beats.
- All sexual/intimate content must involve adult characters only.`;
}

function buildReadingLevelBlock(project) {
  const level = String(project?.reading_level || 'adult').toLowerCase();

  switch (level) {
    case 'children':
      return `READING LEVEL: CHILDREN'S BOOK / EARLY READER
- Use simple, clear vocabulary and short sentences.
- Keep descriptions concrete and easy to picture.
- Avoid profanity, graphic violence, sexual content, and adult themes.
- Emotional stakes should be understandable to a child.
- Dialogue should sound natural but simple.
- Do not use literary abstraction, cynicism, or horror imagery.`;

    case 'middle_grade':
      return `READING LEVEL: MIDDLE GRADE
- Use clear, energetic prose for ages roughly 8–12.
- Keep sentence structure readable and direct.
- Tension, danger, mystery, humor, and emotion are allowed, but avoid graphic violence, sexual content, and adult cynicism.
- Characters can feel fear, embarrassment, grief, courage, and wonder, but keep emotional handling age-appropriate.
- Favor vivid action, discovery, friendship, family, school/community conflicts, and moral choices.`;

    case 'young_adult':
    case 'ya':
      return `READING LEVEL: YOUNG ADULT
- Use accessible but emotionally intense prose.
- Keep pacing strong, character interiority vivid, and voice immediate.
- Romantic tension is allowed, but do not write explicit sexual content unless the project settings explicitly permit adult/erotica material.
- Violence can be tense and consequential, but avoid gratuitous gore unless explicitly enabled.
- Prioritize identity, loyalty, belonging, fear, desire, rebellion, and difficult choices.`;

    case 'adult':
    default:
      return `READING LEVEL: ADULT COMMERCIAL FICTION
- Use polished, mature, commercially readable prose.
- No simplification is required.
- Let vocabulary, sentence length, emotional complexity, and darkness match the project's genre and settings.`;
  }
}

function getReadingLevelChapterTarget(project, fallback = 2000) {
  const level = String(project?.reading_level || 'adult').toLowerCase();

  const explicit = Number(project?.target_chapter_words || project?.chapter_length_target || project?.chapter_target || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  switch (level) {
    case 'children':
      return 700;
    case 'middle_grade':
      return 1400;
    case 'young_adult':
    case 'ya':
      return 2200;
    case 'adult':
    default:
      return fallback || 2500;
  }
}

function buildContentLimitsBlock(project) {
  const settings = getEffectiveContentSettings(project);

  if (settings.reading_level === 'children' || settings.reading_level === 'middle_grade') {
    return `AGE-APPROPRIATE CONTENT LIMITS:
- No explicit sexual content.
- No erotic framing.
- No graphic gore.
- No profanity.
- Keep fear, danger, and conflict appropriate for ${settings.reading_level === 'children' ? 'children' : 'middle grade'} readers.`;
  }

  if (settings.reading_level === 'young_adult' || settings.reading_level === 'ya') {
    return `YOUNG ADULT CONTENT LIMITS:
- Romantic tension is allowed, but avoid explicit sexual description unless project settings clearly authorize adult content.
- Profanity must stay within the selected language intensity.
- Violence may be intense but should not become gratuitously graphic unless explicitly enabled.`;
  }

  return '';
}

function normalizeBeatStyle(project) {
  return String(project?.scene_beat_style || project?.beat_style || '').trim().toLowerCase();
}

function buildBeatStyleBlock(project) {
  const style = normalizeBeatStyle(project);

  if (!style) return '';

  const base = `SELECTED BEAT / PROSE MODE: ${project.scene_beat_style || project.beat_style}
- This beat mode SERVES the selected AUTHOR VOICE. Where any instruction in this mode conflicts with the AUTHOR VOICE's TONE, PACING, ENDING RULE, or ANTI-TROPES, the AUTHOR VOICE wins.`;

  if (isComedyBeatStyle(style)) {
    return `${base}

${COMEDY_CRAFT_RULES}

${getComedyBeatInstruction(style)}`;
  }

  if (style.includes('fast') || style.includes('thriller')) {
    return `${base}
- Keep scenes urgent, lean, and forward-driving.
- Use short-to-medium paragraphs.
- Let action, discovery, confrontation, or danger change the scene state every few paragraphs.
- Avoid long reflective loops.
- Each scene should end with pressure, reversal, new information, or a decision.`;
  }

  if (style.includes('gritty') || style.includes('cinematic')) {
    return `${base}
- Write with grounded cinematic realism.
- Use physical detail, atmosphere, silence, and consequence.
- Keep emotion embodied rather than explained.
- Make the scene feel filmed: blocking, gesture, sensory texture, tension.`;
  }

  if (style.includes('blockbuster') || style.includes('hollywood')) {
    return `${base}
- Use big-screen pacing, spectacle, reversals, and strong emotional hooks.
- Keep the prose clean and propulsive.
- Build scenes around visual moments, escalating stakes, and memorable character choices.`;
  }

  if (style.includes('slow') || style.includes('burn')) {
    return `${base}
- Let tension accumulate gradually through implication, subtext, restraint, and withheld information.
- Prioritize mood, pressure, character observation, and small destabilizing details.
- Avoid melodramatic overstatement.`;
  }

  if (style.includes('romance')) {
    return `${base}
- Center emotional chemistry, attraction, vulnerability, conflict, misread signals, and intimate character beats.
- Make tension specific to the characters rather than generic longing.
- Keep prose emotionally vivid but not repetitive.`;
  }

  if (style.includes('faith')) {
    return `${base}
- Use faith, conscience, forgiveness, grace, doubt, and moral courage as organic parts of the character journey.
- Avoid sermonizing.
- Let belief appear through choices, behavior, and conflict.`;
  }

  if (style.includes('investigative') || style.includes('nonfiction')) {
    return `${base}
- This beat mode SERVES the AUTHOR VOICE and the NONFICTION NARRATIVE CRAFT rules. Where anything here conflicts with them, they win.
- Dramatize through scene: a specific person, place, and moment drawn from the record — not a survey of documents and institutions.
- Introduce each source as something someone does (writes, reads, signs, withholds, destroys); vary how every source enters and never repeat the same framing twice in a row.
- Let facts imply significance; never announce importance. No vague-authority filler such as "the evidence suggests" or "historians believe."
- Keep evidentiary caution: specific facts, real chronology, no invented dialogue or unsupported claims.`;
  }

  if (style.includes('psychological')) {
    return `${base}
- Emphasize perception, contradiction, obsession, memory, dread, denial, and unstable interpretation.
- Do not loop the same internal realization.
- Each paragraph must deepen the character's understanding or worsen the uncertainty.`;
  }

  if (style.includes('dark') || style.includes('suspense')) {
    return `${base}
- Build dread through implication, sensory unease, threat proximity, and consequences.
- Avoid cartoonish darkness.
- Keep danger specific, personal, and escalating.`;
  }

  if (style.includes('satirical') || style.includes('satire')) {
    return `${base}
- Use comic escalation, absurd contrast, sharp social observation, and specific ridiculous details.
- Do not explain the joke.
- Let characters take the absurdity seriously.`;
  }

  return `${base}
- Follow the selected mode's implied rhythm, pacing, tone, and emotional register.
- Keep the prose specific, scene-driven, and non-repetitive.`;
}

function buildGenreBlock(project) {
  const genre = project?.genre || '';
  const subgenre = project?.subgenre || '';
  const bookType = project?.book_type || project?.project_type || '';

  return `PROJECT CATEGORY:
- Book type: ${bookType || 'fiction'}
- Genre: ${genre || 'unspecified'}
- Subgenre: ${subgenre || 'unspecified'}`;
}

function buildLanguageBlock(project) {
  const settings = getEffectiveContentSettings(project);
  const level = Number(settings.language_intensity || 0);

  switch (level) {
    case 0:
      return `LANGUAGE INTENSITY: 0/4
- No profanity.
- Keep wording clean and broadly accessible.`;
    case 1:
      return `LANGUAGE INTENSITY: 1/4
- Mild profanity is allowed sparingly.
- Do not overuse curse words.`;
    case 2:
      return `LANGUAGE INTENSITY: 2/4
- Moderate profanity is allowed when character-appropriate.
- Profanity should punctuate emotion, not replace characterization.`;
    case 3:
      return `LANGUAGE INTENSITY: 3/4
- Strong profanity is allowed when natural to character and genre.
- Avoid repetitive profanity patterns.`;
    case 4:
      return `LANGUAGE INTENSITY: 4/4
- Very strong profanity is allowed when natural to the world and characters.
- Keep it character-specific and purposeful, not random noise.`;
    default:
      return '';
  }
}

function buildGoreBlock(project) {
  const settings = getEffectiveContentSettings(project);
  const gore = Number(settings.gore_level || 0);

  if (gore <= 0) {
    return `VIOLENCE / GORE: 0/4
- Avoid graphic gore.
- Violence may be implied or handled cleanly if required by the scene.`;
  }

  if (gore === 1) {
    return `VIOLENCE / GORE: 1/4
- Mild violence is allowed.
- Avoid graphic body horror or prolonged injury detail.`;
  }

  if (gore === 2) {
    return `VIOLENCE / GORE: 2/4
- Moderate violence is allowed.
- Keep injury detail restrained and consequential.`;
  }

  if (gore === 3) {
    return `VIOLENCE / GORE: 3/4
- Strong violence is allowed when genre-appropriate.
- Avoid gratuitous repetition of wound imagery.`;
  }

  return `VIOLENCE / GORE: 4/4
- Graphic violence is allowed if the project requires it.
- Keep it specific, consequential, and not cartoonish.`;
}

function buildSceneSpecBlock(spec = {}) {
  return `SCENE SPEC:
- Scene number: ${spec.sceneNumber || spec.index || 'current'}
- Scene purpose: ${spec.purpose || spec.goal || spec.scene_goal || 'advance the chapter'}
- POV: ${spec.pov || spec.pov_character || 'project default'}
- Location: ${spec.location || spec.setting || 'project default'}
- Time: ${spec.time || 'project default'}
- Target words: ${spec.targetWords || spec.target_words || spec.word_target || 'scene target'}
- Required beats:
${
  Array.isArray(spec.beats)
    ? spec.beats.map((b, i) => `  ${i + 1}. ${typeof b === 'string' ? b : JSON.stringify(b)}`).join('\n')
    : safeText(
        spec.beats ||
          spec.summary ||
          spec.description ||
          spec.scene_goal ||
          spec.conflict ||
          spec.emotional_arc ||
          spec.content_direction ||
          '- Follow the chapter plan.'
      )
}`;
}

function buildPreviousContextBlock({
  previousChapterTail,
  rollingContext,
  previousChapterEnding,
  accumulatedProse,
  priorChapterSummaries,
}) {
  const parts = [];

  if (Array.isArray(priorChapterSummaries) && priorChapterSummaries.length) {
    parts.push(
      `PRIOR CHAPTER SUMMARIES:\n${priorChapterSummaries
        .map((s, i) => {
          if (typeof s === 'string') return `Chapter ${i + 1}: ${compact(sanitizeNonfictionContextScarTissue(s), 400)}`;
          return `Chapter ${s.chapter_number || s.number || i + 1}: ${compact(sanitizeNonfictionContextScarTissue(s.beat_summary || s.summary || s.title || JSON.stringify(s)), 400)}`;
        })
        .join('\n\n')}`
    );
  }

  if (rollingContext) {
    parts.push(`ROLLING CONTINUITY CONTEXT:\n${compact(sanitizeNonfictionContextScarTissue(rollingContext), 2000)}`);
  }

  if (previousChapterEnding) {
    parts.push(`PREVIOUS CHAPTER ENDING:\n${compact(sanitizeNonfictionContextScarTissue(previousChapterEnding), 1600)}`);
  }

  if (previousChapterTail) {
    parts.push(`IMMEDIATE PREVIOUS CHAPTER TAIL:\n${compact(sanitizeNonfictionContextScarTissue(previousChapterTail), 1600)}`);
  }

  if (accumulatedProse) {
    parts.push(`PROSE ALREADY WRITTEN IN THIS CHAPTER:\n${compact(sanitizeNonfictionContextScarTissue(accumulatedProse), 2500)}`);
  }

  return parts.join('\n\n');
}

function getLastParagraph(text, max = 900) {
  const parts = String(text || '')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const last = parts.length ? parts[parts.length - 1] : String(text || '').trim();
  if (!last) return '';
  return last.length > max ? last.slice(-max) : last;
}

function buildContinuationGuardBlock({ accumulatedProse = '', spec = {}, sceneIndex = 0, totalScenes = 1 }) {
  const already = String(accumulatedProse || '').trim();
  const sceneNumber = spec?.sceneNumber || spec?.scene_number || Number(sceneIndex || 0) + 1;

  if (!already) {
    return `SCENE START DISCIPLINE:
- This is scene ${sceneNumber} of ${totalScenes}.
- Start the chapter in the exact situation required by this scene beat.
- Do not draft beyond this scene's purpose. Leave later beats for later scenes.`;
  }

  return `CONTINUATION LOCK — READ CAREFULLY:
- This is scene ${sceneNumber} of ${totalScenes}. Earlier scenes in THIS SAME CHAPTER have ALREADY BEEN WRITTEN.
- You must continue AFTER the already-written prose. Do NOT restart the chapter. Do NOT write an alternate version of an earlier scene.
- Do NOT re-stage already completed events, locations, reveals, entrances, arguments, fights, quests, arrivals, explanations, reports, reflections, or discoveries.
- Do NOT open by reintroducing the apartment, the initial setting, the quest, the vault, the crash, the explanation, the attack, the escape, the report-writing aftermath, or any earlier chapter premise unless the current scene beat truly occurs there AFTER the last written moment.
- If the current scene beat appears to overlap earlier prose, treat it as a remaining consequence or next escalation, not a second version.
- If the same story function already happened, do not repeat it. Escalate it with a new decision, new leverage, new information, or a new cost.
- Begin with the next physically possible action, reaction, decision, or consequence after the last paragraph below.

LAST WRITTEN PARAGRAPH TO CONTINUE FROM:
${compact(getLastParagraph(already, 900), 900)}`;
}

function normalizeForSceneSimilarity(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeWordSet(text) {
  const stop = new Set([
    'the','and','that','this','with','from','into','onto','about','there','their','they','them','then','than','when','where','what','were','was','had','has','have','his','her','she','him','you','your','for','but','not','all','out','one','two','just','like','back','down','over','under','again','very','would','could','should','been','being','through','because','before','after','inside','outside','still','only','really','more','most','some','any','every','each','its','it','he','we','i','a','an','of','to','in','on','at','by','as','is','are','or','if'
  ]);
  return new Set(
    normalizeForSceneSimilarity(text)
      .split(' ')
      .filter((w) => w.length >= 5 && !stop.has(w))
  );
}

function jaccardSimilarity(aSet, bSet) {
  if (!aSet?.size || !bSet?.size) return 0;
  let intersection = 0;
  for (const item of aSet) if (bSet.has(item)) intersection += 1;
  const union = aSet.size + bSet.size - intersection;
  return union ? intersection / union : 0;
}

function detectLikelySceneRestart(sceneProse, accumulatedProse, spec = {}, sceneIndex = 0) {
  const prior = String(accumulatedProse || '').trim();
  const current = String(sceneProse || '').trim();
  if (!prior || !current || sceneIndex <= 0) return { duplicate: false, reason: '' };

  const currentLead = current.slice(0, 1800);
  const priorAll = prior.slice(-10000);
  const leadSet = makeWordSet(currentLead);
  const priorSet = makeWordSet(priorAll);
  const similarity = jaccardSimilarity(leadSet, priorSet);

  const restartPhrases = [
    /\bthe apartment smelled\b/i,
    /\bthe world vanished into a loading screen\b/i,
    /\bthe plaza pulsed\b/i,
    /\bthe path to the royal vault\b/i,
    /\bthe tavern was called\b/i,
    /\bthe vault itself\b/i,
    /\binside,? the vault\b/i,
    /\bquest complete\b/i,
    /\bthe shape on the floor moved\b/i,
    /\bthe silence after the cuff\b/i,
    /\bthe impact was\b/i,
    /\bthe alley behind\b/i,
    /\bthe storage locker smelled\b/i,
  ];

  const repeatedRestartCue = restartPhrases.some((rx) => rx.test(currentLead) && rx.test(prior));
  if (repeatedRestartCue) {
    return { duplicate: true, reason: 'scene begins with a restart cue already used earlier in the chapter' };
  }

  if (similarity >= 0.34 && leadSet.size >= 25) {
    return { duplicate: true, reason: `scene lead overlaps prior chapter prose too strongly (${Math.round(similarity * 100)}% anchor overlap)` };
  }

  // If the beat is supposed to be scene 2+ but the generated scene opens like a new Chapter 1 setup,
  // force a continuation repair. This catches varied alternate takes that do not share exact wording.
  const chapterRestartOpeners = [
    /^(?:the|a)\s+apartment\b/i,
    /^(?:the|a)\s+plaza\b/i,
    /^(?:the|a)\s+path\b/i,
    /^(?:the|a)\s+tavern\b/i,
    /^inside,?\s+the\s+vault\b/i,
    /^the\s+vault\s+(?:itself|door)\b/i,
    /^the\s+shape\s+on\s+the\s+floor\b/i,
    /^the\s+silence\s+after\b/i,
    /^the\s+impact\s+was\b/i,
    /^the\s+storage\s+locker\b/i,
  ];
  const opensLikeFreshSetPiece = chapterRestartOpeners.some((rx) => rx.test(current.trim()));
  if (opensLikeFreshSetPiece && prior.length > 1200) {
    return { duplicate: true, reason: 'scene opens like a fresh set-piece instead of continuing from accumulated prose' };
  }

  return { duplicate: false, reason: '' };
}

function buildDuplicateRepairPrompt({ originalPrompt, accumulatedProse, duplicateProse, duplicateReason, targetWords }) {
  return `${originalPrompt}

DUPLICATE / RESTART REPAIR REQUIRED:
The previous scene output repeated or restarted material already written earlier in this same chapter.
Reason: ${duplicateReason || 'Likely alternate-draft duplication.'}

You must rewrite ONLY the next scene as a continuation.

NON-NEGOTIABLE RULES:
- Do NOT restart the chapter.
- Do NOT write another version of the setup, quest, vault, explanation, guard arrival, escape, storage-locker discussion, disguise sequence, or any previous event.
- Do NOT reintroduce facts already established in the accumulated prose.
- Do NOT mention twist numbers, beat labels, plot mechanics, chapter function, or outline terms in the prose.
- Begin after the last written paragraph below.
- Move the story into the next distinct action, consequence, reversal, or decision.
- Output ONLY finished prose for the corrected next scene.
- Length: AT LEAST ${targetWords} words.

LAST WRITTEN PARAGRAPH:
${compact(getLastParagraph(accumulatedProse, 1200), 1200)}

BAD DUPLICATE OUTPUT TO REPLACE:
${compact(duplicateProse, 3500)}`;
}

function buildChapterContextBlock(project, chapter) {
  return `CURRENT CHAPTER:
- Chapter number: ${chapter?.number || chapter?.chapter_number || ''}
- Chapter title: ${chapter?.title || chapter?.name || ''}
- Chapter summary/plan:
${compact(chapter?.summary || chapter?.plan || chapter?.outline || chapter?.beats_md || chapter?.beat_summary || chapter?.description || '', 4000)}`;
}

function buildCanonCastBlock(project) {
  let cast = project?.canon_cast;
  if (typeof cast === 'string') { try { cast = JSON.parse(cast); } catch { cast = null; } }
  if (!Array.isArray(cast) || !cast.length) return '';
  const lines = cast.map((c) => {
    const props = Array.isArray(c.props) && c.props.length ? c.props.join(', ') : '—';
    return `- ${c.canonical_name} (${c.role || 'character'}${c.archetype ? ', ' + c.archetype : ''})\n` +
           `  Physical: ${c.physical_signature || '—'}\n` +
           `  Voice: ${c.voice_fingerprint || '—'}\n` +
           `  Props: ${props}`;
  }).join('\n');
  return `CANON CAST — LOCKED IDENTITIES (USE THESE EXACT NAMES):
These are the ONLY character names. Do not rename, invent, or substitute. Keep each
character's physical signature and voice consistent every time they appear. Props
listed are real named objects — when one appears, name it exactly; never let a
listed prop silently vanish.
${lines}`;
}

function buildFoundationBlock(project) {
  const parts = [];

  // ANTHOLOGYBLEED-2: for an anthology, every "chapter" is a STANDALONE story with its own
  // cast. The whole-book bible (world_md/characters_md/outline_md/canon_md/mystery_md/
  // twists_md/canon_cast) aggregates ALL stories, so injecting it into a scene prompt leaks
  // one story's protagonist and setting into another (measured live 2026-08-09: Story 1's
  // security guard "Marcus" surfaced in Story 3 via BOOK OUTLINE). Each story's own isolated
  // context is already supplied separately as anthologyContext (getAnthologyContext ->
  // buildAnthologyStoryContext), so the shared foundation is redundant here and MUST be
  // omitted. Closed-world isolation — same principle as ANTHOLOGYBLEED-1's ledger blanking.
  if (isAnthologyProject(project)) return '';

  if (project?.seed_concept) parts.push(`PROJECT BRAIN / SEED CONCEPT:\n${compact(sanitizeNonfictionContextScarTissue(project.seed_concept), 3000)}`);
  if (project?.world_md) parts.push(`WORLD / SETTING:\n${compact(sanitizeNonfictionContextScarTissue(project.world_md), 3000)}`);
  if (project?.characters_md) parts.push(`CHARACTERS:\n${compact(sanitizeNonfictionContextScarTissue(project.characters_md), 3000)}`);

  const canonBlock = buildCanonCastBlock(project);
  if (canonBlock) parts.push(canonBlock);

  if (project?.outline_md) parts.push(`BOOK OUTLINE:\n${compact(sanitizeNonfictionContextScarTissue(project.outline_md), 4000)}`);
  if (project?.canon_md) parts.push(`CANON / CONTINUITY:\n${compact(sanitizeNonfictionContextScarTissue(project.canon_md), 3000)}`);
  if (project?.voice_md) parts.push(`VOICE NOTES:\n${compact(sanitizeNonfictionContextScarTissue(project.voice_md), 2000)}`);
  if (project?.mystery_md) parts.push(`MYSTERY / REVEAL TRACK:\n${compact(sanitizeNonfictionContextScarTissue(project.mystery_md), 2000)}`);
  if (project?.twists_md) parts.push(`TWISTS / REVERSALS:\n${compact(sanitizeNonfictionContextScarTissue(project.twists_md), 2000)}`);

  return parts.join('\n\n');
}

function buildResearchBlock(project, relevantResearch) {
  const parts = [];

  if (relevantResearch) {
    parts.push(`ALLOWED FACTS — CLOSED WORLD. The material below plus the story bible is the ONLY permitted source of names, dates, numbers, places, quotations, and documents. Any factual atom not present here must NOT appear in your prose — omit the claim entirely rather than supply a fact from memory:\n${compact(sanitizeNonfictionContextScarTissue(relevantResearch), 6500)}`);
  }

  if (project?.research_md) {
    parts.push(`PROJECT RESEARCH NOTES / SOURCE BACKBRAIN:\n${compact(sanitizeNonfictionContextScarTissue(project.research_md), 4500)}`);
  }

  const explicitSourceMaterial = [project?.sources_md, project?.bibliography_md, project?.citations_md, project?.source_notes_md]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join('\n\n');

  if (explicitSourceMaterial) {
    parts.push(`EXPLICIT SOURCE / CITATION / BIBLIOGRAPHY MATERIAL SUPPLIED BY PROJECT:\n${compact(sanitizeNonfictionContextScarTissue(explicitSourceMaterial), 5500)}`);
  }

  return parts.join('\n\n');
}

function extractLikelySourceSignals(text = '') {
  const src = String(text || '');
  if (!src.trim()) return [];

  const lines = src
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sourceLike = [];
  const rx = /\b(?:archive|archives|records?|report|memo|memorandum|minutes|ledger|register|newspaper|post-dispatch|post-tribune|times|journal|gazette|court|case|docket|hearing|testimony|interview|oral history|photograph|photo|blueprint|map|bibliography|source|citation|schreiber|warden|governor|department|board|committee|inquest|coroner|medical examiner|death certificate|statute|law|act|proposal|redevelopment|plan)\b/i;

  for (const line of lines) {
    if (rx.test(line) || /^[-*•]\s+/.test(line) || /^\d{4}[\s:,-]/.test(line)) {
      const cleaned = line.replace(/\s+/g, ' ').trim();
      if (cleaned.length >= 18 && cleaned.length <= 260 && !sourceLike.includes(cleaned)) sourceLike.push(cleaned);
    }
    if (sourceLike.length >= 24) break;
  }

  return sourceLike;
}

function buildSourceAudit(relevantResearch = '', project = {}) {
  const combined = [
    relevantResearch,
    project?.research_md,
    project?.sources_md,
    project?.bibliography_md,
    project?.citations_md,
    project?.source_notes_md,
    project?.research_data && (typeof project.research_data === 'string' ? project.research_data : JSON.stringify(project.research_data, null, 2)),
  ].filter(Boolean).join('\n\n');

  const sourceSignals = extractLikelySourceSignals(combined);
  const hasExplicitBibliography = Boolean(String(project?.bibliography_md || project?.citations_md || project?.sources_md || '').trim());

  return {
    version: 'nf-guidance-v18-writer-not-auditor',
    sourceSignalCount: sourceSignals.length,
    sourceSignals: sourceSignals.slice(0, 18),
    hasExplicitBibliography,
    notes: [
      `Nonfiction guidance v18: ${sourceSignals.length} likely source/reference signals found in supplied research context; writer layer must not invent documents or inject audit boilerplate.`,
      hasExplicitBibliography
        ? 'Explicit source/bibliography material was present in the project context.'
        : 'No explicit bibliography field detected; citation targets were inferred only from research/source categories.',
      'Drafting rule: write natural nonfiction prose; unsupported specifics stay out of the manuscript instead of becoming repeated warning paragraphs.',
    ],
  };
}

function buildCitationBibliographyDisciplineBlock(project, relevantResearch = '') {
  const audit = buildSourceAudit(relevantResearch, project);
  const sourceLines = audit.sourceSignals.length
    ? audit.sourceSignals.map((line, i) => `${i + 1}. ${line}`).join('\n')
    : 'No explicit source lines detected. Use only broad source categories already present in project context and avoid invented citations.';

  return `NONFICTION SOURCE GUIDANCE — v18 WRITER RESET:
- Treat research as evidence, not decorative background.
- Every paragraph with factual claims should be anchored to one of these: a named supplied source, a supplied source category, a specific documented event, or cautious inference from supplied facts.
- Do NOT fabricate citations, footnotes, page numbers, URLs, article titles, archive box numbers, case numbers, interviewees, document names, or bibliography entries.
- Do NOT claim “the records show,” “newspapers reported,” “archives confirm,” or “official reports stated” unless that source category or named source appears in the supplied context.
- If the supplied material names a source, preserve its exact wording. Do not improve, invent, or normalize the title.
- If only a source category is available, cite the category in prose rather than inventing a title: “contemporary newspaper accounts,” “state archival summaries,” “former correctional histories,” “court records,” “redevelopment documents.”
- Separate fact from inference:
  * Confirmed fact: state plainly and tie to the available source category.
  * Reasonable inference: use cautious language such as “suggests,” “raises the possibility,” “appears,” “may indicate,” or “leaves open.”
  * Unsupported detail: do not include it as fact.
- Avoid confidence inflation. Do not write “proved,” “confirmed,” “clearly,” “undeniably,” or “too precise to dismiss” unless the supplied research proves that strength.
- Before drafting, quietly separate supplied facts from inference. Do not expose that classification in the manuscript.
- Death counts, casualty groupings, dates, prisoner names, locations, and legal outcomes are locked to supplied material. If unresolved, state the uncertainty once in ordinary prose and move on. No reusable casualty-ledger paragraph.
- EVENT-MECHANISM HARD LOCK: do not state that a door was “secured from the outside,” that someone “abandoned” people, that a “male voice” spoke, or that a recording was “one of dozens,” unless those exact details appear in the supplied source context. Use neutral wording: “a recorded voice,” “a locked or secured door,” “the mechanism remains unresolved.”
- SOURCE-CONFIDENCE HARD LOCK: any sentence using “clear,” “proved,” “confirmed,” “showed,” “established,” “documented,” “according to tour operators,” “the records reveal,” or “the reports prove” must be backed by supplied source wording. If not, use cautious verbs: “suggested,” “appeared to,” “was described as,” “left open,” “may indicate.”
- QUOTE LEDGER: exact quotation marks may only surround words that appear in supplied source material or project setup. For paraphrase, remove quotation marks and identify the source category.
- SOURCE NAME LEDGER: do not convert partial phrases into fake source names. If the model is unsure whether a phrase is a proper source title, describe it as a source category instead.
- Bibliography behavior for draft prose: do not append a bibliography inside the chapter body. Instead, write prose that clearly exposes which source categories/named sources will require endnotes during the nonfiction polish/export phase.

LIKELY SOURCE SIGNALS AVAILABLE TO THIS CHAPTER:
${sourceLines}`;
}

function buildOutputRules(project, targetWords) {
  const isNF = isNonfictionProject(project) || isNonfictionAnthology(project);

  if (isNF) {
    return `OUTPUT RULES:
- Write ONLY the nonfiction manuscript prose for this scene/section.
- Do not include headings unless the chapter plan explicitly requires them.
- Do not include analysis, notes, apologies, explanations, markdown fences, or self-checks.
- Length: AT LEAST ${targetWords} words — do not stop before reaching that count; develop the material fully rather than summarizing.
- Use grounded, verifiable phrasing.
- Break paragraphs naturally every 3–5 sentences.
- Keep every paragraph purposeful: new fact, source category, contradiction, mechanism, consequence, or unresolved question.
- Do not invent facts, quotes, statistics, citations, dates, named sources, archival logbook entries, key labels, named candidate victims, private collections, discovered documents, missing logbook pages, named inmates, or site-inspection scenes.
- Do not invent footnotes, endnotes, page numbers, URLs, archive box labels, article titles, case numbers, bibliography entries, guard logbooks, work rosters, master-key inventories, or exact document language.
- Expose source grounding in natural prose: contemporary newspaper accounts, state archival summaries, court records, redevelopment documents, official reports, photographs, maps, interviews, etc., only when supplied.
- If a detail is not supported by the supplied material, write around it with cautious phrasing or name it as unresolved.
- For numbers, death counts, casualty categories, dates, names, source titles, quotes, court outcomes, and locations: do not improvise. State only what the supplied material supports, or explicitly say the available record is unclear.
- Rotate evidence verbs naturally: "indicate", "suggest", "describe", "point to", "reveal", "reflect", "document", "outline". Never use the same evidence construction more than once per section. BANNED phrases (never use): "the available accounts indicate", "the available accounts suggest", "the surviving record shows", "what remains unclear is", "the record suggests", "this suggests" (as a sentence opener), "the question therefore shifts".
- If a casualty count or death location appears contradictory, do NOT resolve it and do NOT insert a generic caution paragraph. Keep the uncertainty concise and tied to the immediate paragraph.
- Do not repeat the same thesis sentence in different words. Advance the investigation.
${buildFactLedgerPromptBlock(buildFactLedger(project))}`;
  }

  return `OUTPUT RULES:
- Write ONLY the finished fictional prose for this scene.
- No headings unless the scene itself naturally contains one.
- No bullet points.
- No outline language.
- No plot-mechanic language: do not write twist, midpoint, beat, hook, reveal, theme, chapter function, or scene function as narration.
- No analysis, notes, apologies, explanations, markdown fences, or self-checks.
- Target approximately ${targetWords} words.
- Begin directly in scene.
- End on a complete sentence.
- Do not summarize the scene. Dramatize it.

FINAL RHYTHM CHECK (this enforces the SIGNATURE VOICE sentence-rhythm rules above with concrete numbers - where the selected AUTHOR VOICE dossier specifies a different rhythm, the AUTHOR VOICE wins):
- Average sentence length for the scene must land between 9 and 14 words. Fragments are seasoning, not the meal.
- Never write more than 3 consecutive sentences of 5 words or fewer. After two short sentences, the next one must be long - a subordinate clause, an image, a complication.
- Roughly every 150 words, include at least one sentence of 20+ words that moves through the space or the thought without stopping.
- Use "looked", "turned", and "nodded" at most 3 times COMBINED per 500 words. Replace them with the specific verbs the SIGNATURE VOICE rules demand - what does this character do that only they would do?`;
}

function buildManuscriptPurityBlock() {
  return `MANUSCRIPT PURITY / NO STRUCTURE LEAKAGE:
- Write as if this is the final published book. Never expose planning language to the reader.
- Never mention plot mechanics, beat labels, act structure, twist numbers, chapter function, scene function, outline terms, or writing-process terms in the manuscript prose.
- Forbidden as narration: "the first twist", "the second twist", "turning point", "midpoint", "inciting incident", "all is lost", "dark night of the soul", "break into three", "chapter hook", "exit hook", "scene beat", "story beat", "the reveal", "the theme", "the lesson".
- If a beat says a twist/reveal/hook occurs, dramatize the event itself. Do not label it as a twist/reveal/hook.
- Never write meta sentences like "The first twist was..." or "The lesson was..." Replace them with character-specific realization, concrete consequence, or action.
- Clean mechanical prose only: no malformed phrases like "The door opened it" or "The cage was opened it".
- Do not repeat an aftermath/reflection/report beat if the chapter has already processed that same story function.`;
}


function buildSceneContinuityExpansionBlock({ accumulatedProse = '', spec = {}, targetWords = 800 } = {}) {
  const hasPrior = String(accumulatedProse || '').trim().length > 120;
  const sceneNumber = Number(spec?.sceneNumber || spec?.scene_number || (Number(spec?.index) + 1) || 1);

  return `SCENE CONTINUITY / RICHNESS PRESERVATION RULES:
- Do not overcorrect repetition by flattening the scene into summary. Write vivid, textured, literary prose with concrete action, subtext, tension, and scene-specific sensory detail.
- Every scene must add one NEW story pressure: a new intimacy, discovery, threat, reversal, price, power shift, secret, commitment, or irreversible choice.
- Do not restart a prior event. If the current beat overlaps an earlier beat, continue from the consequence instead of replaying the setup.
- Do not write a second version of the same argument. Let the later exchange reveal new information or force a new decision.
- Avoid blunt thesis-dialogue. Characters should not over-explain metaphors like cages, walls, tools, silence, truth, safety, betrayal, or art. Let objects, behavior, hesitation, and subtext carry the meaning.
- Preserve sophisticated author voice and atmosphere. Keep the prose rich, but make the richness do work: every image should sharpen place, mood, character, conflict, or decision.
- If a symbolic object appears, make it change pressure or meaning by the end of the scene; do not just mention it repeatedly.
- If the beat involves a major decision, show the external pressure and the private cost once, then move to the next consequence.
- Prefer layered conflict over direct explanation: what the character says, what they avoid saying, what the room/object/body betrays.
- Current scene number: ${sceneNumber}. Length: AT LEAST ${targetWords} words — do not end the scene before reaching that count; develop the material fully rather than summarizing.${hasPrior ? '\n- Prior scene prose already exists. Continue from it. Do not summarize it, restate it, or offer another version of its central event.' : ''}`;
}

function buildNoSlopBlock() {
  return `${COMPACT_ANTI_SLOP}

ANTI-REPETITION REQUIREMENTS:
${ANTI_REPETITION_RULES}

ABSOLUTE PROSE RULES:
- No recursive emotional loops.
- No repeated paragraph openings.
- No repeated "she realized/he realized/they realized" insight chains.
- No generic dread, generic ache, generic silence, generic darkness.
- Every paragraph must either move action, reveal information, sharpen conflict, deepen character choice, or change scene pressure.
- Do not repeat the same metaphor in different words.
- Do not restate the chapter premise after it is established.
- Do not use fake escalation where the prose says stakes rise but nothing changes.
- Specific physical detail beats abstract emotion.
- VARY ACTION CHOREOGRAPHY: do not lean on the same physical beat ("he turned", "he reached", "he stepped", "he looked up", "he nodded"). No single movement verb may become the default within a scene. Rotate how characters move, and cut beats that do not change the scene.
- MODULATE RHYTHM WITHIN THE VOICE: even when the selected AUTHOR VOICE is clipped, jagged, or staccato, do NOT let every sentence land at the same short length. Break runs of uniform fragments with an occasional longer sentence so the short ones keep their punch. A strong voice still varies its tempo — uniform sentence length reads as machine cadence. This rule refines the voice; it does not replace its identity.`;
}


function buildNonfictionPerspectiveFirewall(project) {
  const authorName = String(project?.author_name || '').trim();
  const bylineRule = authorName
    ? `- Treat "${authorName}" as BYLINE METADATA ONLY unless the project explicitly says this is a memoir or first-person field-investigation book. Do not put ${authorName} on the page as a character, investigator, eyewitness, traveler, archivist, narrator, or protagonist.`
    : '- Treat the author name/byline as metadata only unless the project explicitly says this is a memoir or first-person field-investigation book. Do not put the author on the page as a character, investigator, eyewitness, traveler, archivist, narrator, or protagonist.';

  return `NONFICTION PERSPECTIVE FIREWALL — ROOT SOURCE CUT:
- This is investigative/historical nonfiction, not fiction, memoir, paranormal mystery, or author-as-detective narrative.
${bylineRule}
- Do NOT invent author actions: no site visits, archive trips, motel rooms, phone calls, recorder playback, emotional reactions, headlamps, conversations, or discovery scenes unless those exact events are explicitly present in the supplied research as documented facts.
- Do NOT use free-indirect fiction POV, character interiority, cinematic body sensations, wandering attention details, or “human irrelevant details” for the author or real people.
- Center the narration on evidence, documents, chronology, institutions, named historical actors, verifiable events, and unanswered questions.
- If the research describes an investigative process, summarize it as methodology in restrained nonfiction narration. Do not dramatize it as a scene.
- A person may anchor a passage only if that person is documented in the supplied research and relevant to the historical event. The author/byline is not a historical subject unless explicitly stated.
- Preferred voice: disciplined investigative narration. Vary evidentiary constructions — never repeat the same framing device ("The record shows…", "Accounts from the period…") within the same section. Vary evidence-attribution phrasing across the chapter.
- Forbidden voice: “She stood...”, “She felt...”, “Her stomach tightened...”, “Back at the motel...”, “The whisper became her compass...”, or any phrasing that turns the author into the protagonist.`;
}


function buildNonfictionSectionNonOverlapBlock({ accumulatedProse = '', spec = {}, targetWords = 800 }) {
  const priorText = String(accumulatedProse || '').trim();
  const hasPrior = priorText.length > 300;
  const sectionNumber = Number(spec?.sceneNumber || spec?.scene_number || spec?.section_number || (Number(spec?.index) + 1) || 1);
  const sectionPurpose = String(spec?.purpose || spec?.scene_goal || spec?.content_direction || '').trim();
  const keyClaim = String(spec?.key_claim || '').trim();
  const evidenceNeeded = String(spec?.evidence_needed || '').trim();
  const uniqueMaterial = String(spec?.unique_material || spec?.owned_material || '').trim();
  const avoidMaterial = String(spec?.covered_material_to_avoid || spec?.avoid_repeating || '').trim();
  const escalationQuestion = String(spec?.escalation_question || spec?.next_question || '').trim();

  return `NONFICTION SECTION CONTRACT — v6 PUBLICATION QUALITY / ESCALATION:
- This output is ONLY section ${sectionNumber}, AT LEAST ${targetWords} words — do not stop short of that count. Do not write a whole-chapter overview.
- Format this section as manuscript prose with paragraph breaks every 3–5 sentences. Never return one giant paragraph.
- This section must ADVANCE the investigation. It cannot merely rephrase the premise, the contradiction, the institutional silence, or the locked-door question.
${sectionPurpose ? `- Section purpose: ${sectionPurpose}` : '- Follow the assigned section purpose only.'}
${keyClaim ? `- Section key claim: ${keyClaim}` : '- Make one clear claim, then support it with evidence.'}
${evidenceNeeded ? `- Evidence to prioritize: ${evidenceNeeded}` : '- Use the most relevant supplied evidence only.'}
${uniqueMaterial ? `- Material this section owns: ${uniqueMaterial}` : '- Give this section its own concrete evidence lane: a date, record type, institution, person, mechanism, consequence, or contradiction.'}
${avoidMaterial ? `- Do NOT repeat or re-explain: ${avoidMaterial}` : '- Do not repeat material already assigned to earlier sections.'}
${escalationQuestion ? `- The section should answer or sharpen this escalation question: ${escalationQuestion}` : '- End by sharpening the next factual question, not by repeating the same grand theme.'}

PUBLICATION-QUALITY TARGET:
- Write like a disciplined investigative history book, not a blog summary, textbook, or dramatic monologue.
- Use the chapter's evidence as a ladder: each paragraph should add a new rung — fact, source type, contradiction, mechanism, consequence, or unresolved question.
- Before writing each paragraph, assign its claim lane internally: confirmed / source-category-supported / inferred / unresolved. If the lane is unresolved, write it as a question or gap, not as narrative fact.
- Put the strongest sourced detail near the middle of the section, then interpret it cautiously.
- Use specific nouns and institutional mechanisms: keys, reports, fire doors, guard protocols, casualty lists, parole board policy, riot response, newspaper coverage, architectural layout — only when supplied by context/research.
- Avoid generic thesis-echo language: “the silence,” “the official story,” “the gap,” “the mystery,” “the past,” “the institution,” unless paired with a fresh concrete fact.
- Avoid overclaiming intent. If the evidence does not prove concealment, write “the record does not explain,” “the available accounts leave unclear,” or “the omission had the effect of...” instead of declaring a cover-up.
- Every 2–3 paragraphs, shift from claim → evidence → interpretation → consequence. Do not stay in abstract analysis for more than one paragraph at a time.
- Do not end with a decorative mic-drop. End with factual momentum or a precise unanswered question.
${hasPrior ? '- Earlier section prose already exists. Continue from it. Do not summarize, paraphrase, or re-stage it.' : '- This is the opening section. Establish the specific problem quickly, then move into evidence.'}`;
}

function buildNonfictionPublicationQualityBlock({ chapter, spec, accumulatedProse = '' } = {}) {
  const chapterTitle = String(chapter?.title || '').trim();
  const sectionTitle = String(spec?.title || spec?.name || '').trim();
  const hasPrior = String(accumulatedProse || '').trim().length > 300;

  return `NEAR-100 NONFICTION QUALITY BAR — v9 HARD SOURCE-LEDGER QUALITY:
- Aim for publishable investigative historical nonfiction, not merely acceptable draft prose.
- The reader should feel forward motion: each section must either reveal a new fact, complicate a prior assumption, explain a mechanism, name a consequence, or narrow the central question.
- Do not write filler paragraphs that only restate importance, silence, mystery, darkness, brutality, control, or erasure.
- Do not use more than one sentence in this section built around “not X but Y.”
- Do not use more than one sentence in this section built around “What remained / What mattered / What the record shows.”
- Do not call a silence “a choice” unless the supplied evidence supports deliberate omission. Prefer precise evidentiary language.
- Do not invent citations or footnotes. Do not fabricate document titles. Refer to source categories only when the context supports them. Preserve exact supplied source names/categories for later bibliography/endnotes.
- Treat casualty counts, named victims, legal outcomes, and official classifications as locked data. If the source context is inconsistent, name the inconsistency instead of smoothing it over.
- Do not invent certainty around sensory/audio details. Unless source text states sex, tone, duration, enhancement method, tour provenance, or number of recordings, keep those details neutral.
- When discussing the workshop/death-count problem, avoid reusable casualty-ledger phrasing. State the specific uncertainty in fresh, concrete language and do not repeat it across sections.
- Good paragraph pattern: factual claim → supplied source/source category → why it matters → next question.
- Better paragraph pattern: specific record/detail → contradiction → institutional consequence.
- Bad paragraph pattern: broad claim → metaphor → broad claim → thematic conclusion.
${chapterTitle ? `- Chapter title/context: ${chapterTitle}` : ''}
${sectionTitle ? `- Current section title: ${sectionTitle}` : ''}
${hasPrior ? '- Assume previous sections already established the premise; do not restart the chapter.' : ''}`;
}

function buildFictionPrompt({
  project,
  chapter,
  chapters = [],
  spec,
  accumulatedProse = '',
  previousChapterTail = '',
  rollingContext = '',
  previousChapterEnding = '',
  priorChapterSummaries = [],
  targetWords = 800,
  relevantResearch = '',
  anthologyContext = '',
  twistContext = '',
  seriesContinuityBlock = '',
  volumeContractBlock = '',
  authorStyleBlock = '',
  includeFullCraft = false,
  revisionFeedback = '',
}) {
  const projectHeader = buildProjectContextHeader(project);
  const setupConstraints = buildSetupConstraints(project);
  const povTenseBlock = buildPovTenseBlock(project);
  const readingLevelBlock = buildReadingLevelBlock(project);
  const contentLimitsBlock = buildContentLimitsBlock(project);
  const beatStyleBlock = buildBeatStyleBlock(project);
  const pacingBlock = buildPacingBlock(project, chapter);
  const genreBlock = buildGenreBlock(project);
  const languageBlock = buildLanguageBlock(project);
  const goreBlock = buildGoreBlock(project);
  const spiceBlock = buildSpiceCompact(project);
  const violenceBlock = buildViolenceCompact(project);
  const authorVoiceBlock = buildAuthorVoiceCompact(project);
  const foundationBlock = buildFoundationBlock(project);
  const researchBlock = buildResearchBlock(project, relevantResearch);
  const previousContextBlock = buildPreviousContextBlock({
    previousChapterTail,
    rollingContext,
    previousChapterEnding,
    accumulatedProse,
    priorChapterSummaries,
  });
  const continuationGuardBlock = buildContinuationGuardBlock({
    accumulatedProse,
    spec,
    sceneIndex: spec?.index || 0,
    totalScenes: spec?.totalScenes || spec?.total_scenes || 1,
  });
  const chapterContextBlock = buildChapterContextBlock(project, chapter);
  const projectContinuityLockBlock = buildProjectContinuityLockBlock(project, chapter, chapters);
  const canonNameLockBlock = buildCanonNameLockBlock(project, chapter, chapters);
  const anthologyVarietyBlock = buildAnthologyChapterVarietyBlock(project, chapter, chapters);
  const sceneSpecBlock = buildSceneSpecBlock(spec);
  const noSlopBlock = buildNoSlopBlock(project);
  const manuscriptPurityBlock = buildManuscriptPurityBlock(project);
  const sceneContinuityExpansionBlock = buildSceneContinuityExpansionBlock({ accumulatedProse, spec, targetWords });
  const authorVoiceReminder = buildAuthorVoiceReminder(project);
  const outputRules = buildOutputRules(project, targetWords);
  const eroticaBlocks = buildEroticaAuthorityBlocks(project);
  const fanfictionEroticaBridgeBlock = buildFanfictionEroticaBridgeBlock(project);
  const anthologySpice = buildAnthologySpiceProseBlock(project);
  const anthologySpiceBeat = buildAnthologySpiceBeatContext(project);
  const twistBlock = twistContext ? `TWIST / REVERSAL CONTEXT:\n${compact(twistContext, 2500)}` : '';
  const craftRules = includeFullCraft ? COMPACT_CRAFT_RULES : '';
  const revisionBlock = String(revisionFeedback || '').trim()
    ? `REJECTED-DRAFT CORRECTIONS — BINDING:\nThe previous chapter draft was rejected. Fix every issue below while still following this scene's immutable state contract. Do not create an alternate event sequence.\n${compact(revisionFeedback, 5000)}`
    : '';

  return [
    `You are the prose engine for a professional long-form book-writing app. Your job is to write the next scene as polished manuscript prose.`,
    HUMAN_PROSE_PRIORITY_BLOCK,
    projectHeader,
    genreBlock,
    setupConstraints,
    povTenseBlock,
    readingLevelBlock,
    contentLimitsBlock,
    languageBlock,
    goreBlock,
    spiceBlock,
    violenceBlock,
    eroticaBlocks,
    fanfictionEroticaBridgeBlock,
    anthologySpice,
    anthologySpiceBeat,
    authorVoiceBlock,
    authorStyleBlock,
    beatStyleBlock,
    pacingBlock,
    seriesContinuityBlock,
    volumeContractBlock,
    anthologyContext,
    twistBlock,
    foundationBlock,
    researchBlock,
    previousContextBlock,
    continuationGuardBlock,
    chapterContextBlock,
    projectContinuityLockBlock,
    canonNameLockBlock,
    anthologyVarietyBlock,
    sceneSpecBlock,
    revisionBlock,
    manuscriptPurityBlock,
    sceneContinuityExpansionBlock,
    noSlopBlock,
    craftRules,
    MANDATORY_ENFORCEMENT_BLOCK,
    authorVoiceReminder,
    outputRules,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildNonfictionPrompt({
  project,
  chapter,
  chapters = [],
  spec,
  accumulatedProse = '',
  previousChapterTail = '',
  rollingContext = '',
  previousChapterEnding = '',
  priorChapterSummaries = [],
  targetWords = 800,
  relevantResearch = '',
  anthologyContext = '',
  authorStyleBlock = '',
}) {
  const projectHeader = buildProjectContextHeader(project);
  const setupConstraints = buildSetupConstraints(project);
  const povTenseBlock = buildPovTenseBlock(project);
  const readingLevelBlock = buildReadingLevelBlock(project);
  const contentLimitsBlock = buildContentLimitsBlock(project);
  const beatStyleBlock = buildBeatStyleBlock(project);
  const pacingBlock = buildPacingBlock(project, chapter);
  const genreBlock = buildGenreBlock(project);
  const authorVoiceBlock = buildAuthorVoiceCompact(project);
  const foundationBlock = buildFoundationBlock(project);
  const researchBlock = buildResearchBlock(project, relevantResearch);
  const previousContextBlock = buildPreviousContextBlock({
    previousChapterTail,
    rollingContext,
    previousChapterEnding,
    accumulatedProse,
    priorChapterSummaries,
  });
  const continuationGuardBlock = buildContinuationGuardBlock({
    accumulatedProse,
    spec,
    sceneIndex: spec?.index || 0,
    totalScenes: spec?.totalScenes || spec?.total_scenes || 1,
  });
  const chapterContextBlock = buildChapterContextBlock(project, chapter);
  const projectContinuityLockBlock = buildProjectContinuityLockBlock(project, chapter, chapters);
  const canonNameLockBlock = buildCanonNameLockBlock(project, chapter, chapters);
  const anthologyVarietyBlock = buildAnthologyChapterVarietyBlock(project, chapter, chapters);
  const sceneSpecBlock = buildSceneSpecBlock(spec);
  const outputRules = buildOutputRules(project, targetWords);
  const nonfictionPerspectiveFirewall = buildNonfictionPerspectiveFirewall(project);
  const nonfictionSectionNonOverlapBlock = buildNonfictionSectionNonOverlapBlock({
    accumulatedProse,
    spec,
    targetWords,
  });
  const nonfictionPublicationQualityBlock = buildNonfictionPublicationQualityBlock({ chapter, spec, accumulatedProse });
  const citationBibliographyDisciplineBlock = buildCitationBibliographyDisciplineBlock(project, relevantResearch);
  const authorVoiceReminder = buildAuthorVoiceReminder(project);

  return [
    `You are the nonfiction prose engine for a professional book-writing app. Write disciplined investigative/historical nonfiction manuscript prose using only the supplied project material and research.`,
    nonfictionPerspectiveFirewall,
    projectHeader,
    genreBlock,
    povTenseBlock,
    readingLevelBlock,
    contentLimitsBlock,
    authorVoiceBlock,
    authorStyleBlock,
    beatStyleBlock,
    pacingBlock,
    anthologyContext,
    foundationBlock,
    researchBlock,
    NONFICTION_HARD_RULES,
    NONFICTION_NARRATIVE_CRAFT,
    ANTI_DETECTION_PROSE_RULES_NF,
    MANDATORY_ENFORCEMENT_BLOCK,
    citationBibliographyDisciplineBlock,
    nonfictionPublicationQualityBlock,
    chapterContextBlock,
    projectContinuityLockBlock,
    canonNameLockBlock,
    anthologyVarietyBlock,
    setupConstraints,
    previousContextBlock,
    continuationGuardBlock,
    nonfictionSectionNonOverlapBlock,
    sceneSpecBlock,
    authorVoiceReminder,
    outputRules,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildRepairPrompt({ originalPrompt, brokenProse, issues, targetWords }) {
  return `${originalPrompt}

REPAIR PASS — TARGETED FIX ONLY:
The previous output failed these specific checks:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Rules:
- Repair ONLY the specific issue(s) listed above.
- Preserve the original prose, plot, opening, ending, names, dialogue, and sequence.
- Do NOT expand, pad, or add paragraphs.
- Do NOT add theme explanation, literary analysis, or philosophical reflection.
- Do NOT make it more literary or polished than the original.
- Do NOT change the chapter opening style or closing beat.
- Output ONLY the corrected scene prose.
- No notes, no explanation, no markdown.
- Hit approximately ${targetWords} words.
- Remove any leaked outline/story-structure language such as twist, midpoint, beat, hook, reveal, theme, or chapter function.

OUTPUT TO REPAIR:
${compact(brokenProse, 5000)}`;
}

function cleanNarrativeMetaLeaks(prose) {
  let text = String(prose || '');
  const originalText = text;

  // DELETE entire sentences containing meta-structure language.
  // Do NOT convert to abstract phrases like "the truth was" — strip them entirely.
  const metaLeakPatterns = [
    /\bThe\s+(?:first|second|third|fourth|final)\s+twist\s+was\b/gi,
    /\bthe\s+(?:first|second|third|fourth|final)\s+twist\b/gi,
    /\bthe\s+(?:real\s+)?(?:twist|reveal|mystery)\s+(?:was|is)\b/gi,
    /\bthe\s+truth\s+was\s+that\b/gi,
    /\b(?:This|It)\s+was\s+the\s+(?:inciting incident|midpoint|turning point|chapter hook|exit hook)\b/gi,
    /\b(?:the lesson|the theme|the reveal)\s+(?:was|is)\b/gi,
    /\bthe\s+(?:inciting incident|midpoint|chapter hook|exit hook|scene beat|story beat|beat label|chapter function|narrative function)\b/gi,
    // v2 additions: editorial critique / process commentary leaked from LLM
    /\b(?:The opening is|The prose hits|The prose is) (?:sharp|strong|solid|excellent|highly polished|working)\b/gi,
    /\bAction Plan(?:\s+for)?\s*:/gi,
    /\bNext Move\s*:/gi,
    /\bBest Next Move\b/gi,
    /\bAreas for (?:Refinement|improvement)\b/gi,
    /\bAnalysis & Strengths\b/gi,
    /\bConstraint Adherence\b/gi,
    /\bAnticipation Check\b/gi,
    /\bThe current trajectory is working\b/gi,
    /\bWe have established the what and the why\b/gi,
    /\bThe structure is solid\b/gi,
    /\byou don't need to polish\b/gi,
    /\bThe next logical step\b/gi,
    /\bHere is the revised\b/gi,
    /\bI will now\b/gi,
    /\bI recommend\b/gi,
  ];

  // Split into paragraphs, then sentences, and delete any sentence matching meta patterns.
  const paragraphs = text.split(/\n\n+/);
  text = paragraphs.map(para => {
    const sentences = para.split(/(?<=[.!?])\s+/);
    const kept = sentences.filter(sentence => {
      for (const rx of metaLeakPatterns) {
        rx.lastIndex = 0;
        if (rx.test(sentence)) return false;
      }
      return true;
    });
    return kept.join(' ');
  }).join('\n\n');

  // Remove accidental outline residue at line starts without deleting normal prose.
  text = text
    .replace(/^\s*(?:Twist|Midpoint|All Is Lost|Dark Night of the Soul|Break into (?:Two|Three)|Plot Point|Pinch Point|Scene Beat|Story Beat)\s*\d*\s*[:\-]\s*/gim, '')
    .replace(/\b(?:as a character arc|as a narrative beat|as a plot beat)\b/gi, '')
    .replace(/^\s*(?:Strengths|Weaknesses|Critique|Revision notes|Self-Correction|Micro-Adjustments|Pacing & Tension|Voice Consistency|Sensory Density|Show vs\. Tell)\s*:?\s*/gim, '');

  if (text !== originalText) {
    console.log('[cleanNarrativeMetaLeaks] v2: removed meta/process leak content');
  }

  return text;
}


function applyHardNonfictionSourceLedger(prose, project) {
  // RECOVERY v16:
  // This function used to inject a canned casualty/source-ledger paragraph directly
  // into raw nonfiction prose whenever it detected casualty-count uncertainty. That
  // made the same paragraph repeat across chapters and turned the writer into an
  // evidence-audit engine. Raw drafting must not do that. Verification belongs in a
  // separate audit/report layer, not inside the prose generator.
  if (!(isNonfictionProject(project) || isNonfictionAnthology(project))) return prose;

  let text = String(prose || '');
  if (!text.trim()) return text;

  // Hard remove scar-tissue paragraphs from previous over-defensive nonfiction patches.
  text = sanitizeNonfictionContextScarTissue(text);

  // Keep only light, non-destructive certainty softening. No canned paragraphs.
  text = text
    .replace(/\bclear,\s*urgent\s+male\s+voice\b/gi, 'distinct recorded voice')
    .replace(/\bclear\s+male\s+voice\b/gi, 'distinct recorded voice')
    .replace(/\burgent\s+male\s+voice\b/gi, 'recorded voice')
    .replace(/\bdisembodied\s+voice\b/gi, 'recorded voice')
    .replace(/\bwith\s+someone\s+left\s+on\s+the\s+other\s+side\b/gi, 'with the mechanism and circumstances still unresolved')
    .replace(/\bcontradicted\s+the\s+official\s+story\b/gi, 'complicated the official story')
    .replace(/\bchallenged\s+the\s+sanitized,\s*official\s+version\s+of\s+events\b/gi, 'complicated the simplified public version of events')
    .replace(/\bthe\s+convergence\s+was\s+too\s+precise\s+to\s+dismiss\s+as\s+random\s+noise\b/gi, 'the convergence was specific enough to justify historical scrutiny')
    .replace(/\bwas\s+not\s+a\s+speculative\s+milestone\s+but\s+a\s+published\s+target\b/gi, 'appeared in public planning material as a target date')
    .replace(/\bthe\s+building\s+itself\s+was\s+the\s+last\s+silent\s+witness\b/gi, 'the building itself remained a potentially important physical source')
    .replace(/\bprimary\s+crime\s+scene\b/gi, 'primary physical site')
    .replace(/\bforensic\s+architect\b/gi, 'site investigator')
    .replace(/\bthe\s+machine\s+of\s+containment\b/gi, 'the system of containment')
    .replace(/\bVocational Shop B\b/gi, 'the vocational shop')
    .replace(/\bShop B\b/g, 'the shop')
    .replace(/\bthe shop that cooked\b/gi, 'the workshop fire story')
    .replace(/\bcomplete destruction of evidence by fire\b/gi, 'severe fire damage');

  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => {
    const p = paragraph.trim();
    if (!p) return p;

    // Guard against unsupported exact-provenance phrasing around EVP/tour details.
    if (/\bEVP\b/i.test(p) || /\belectronic voice phenomenon\b/i.test(p) || /\brecording\b/i.test(p)) {
      return p
        .replace(/\bone\s+of\s+dozens\s+collected\s+over\s+years\s+of\s+tours\b/gi, 'one artifact within the site’s modern paranormal-tour culture')
        .replace(/\baccording\s+to\s+the\s+tour\s+operators,\s*/gi, 'as presented in the tour context, ')
        .replace(/\braw\s+data\s+point\b/gi, 'reported audio artifact')
        .replace(/\bpurportedly\s+extracted\s+from\s+the\s+environment\s+itself\b/gi, 'presented as captured in the environment')
        .replace(/\ba\s+psychic\s+imprint\s+or\s+an\s+auditory\s+pareidolia\b/gi, 'paranormal evidence or auditory misperception');
    }

    return p;
  });

  return paragraphs.join('\n\n');
}

function tightenNonfictionThesisEchoes(prose, project) {
  if (!(isNonfictionProject(project) || isNonfictionAnthology(project))) return prose;
  let text = String(prose || '');
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length < 4) return text;

  const echoPatterns = [
    /\b(the\s+)?silence\s+(?:in|of|around)\s+(?:the\s+)?(?:record|report|archive|door)\b/i,
    /\bnot\s+(?:a|an)\s+[^.]{0,45}\s+but\s+(?:a|an|the)\b/i,
    /\blocked\s+door\b/i,
    /\bofficial\s+(?:story|record|narrative|account|report)\b/i,
    /\babsorbed\s+into\s+the\s+(?:larger|broader)\s+(?:riot|narrative|statistic)\b/i,
  ];

  const seen = new Map();
  const kept = [];

  for (const paragraph of paragraphs) {
    let echoScore = 0;
    for (const rx of echoPatterns) {
      if (rx.test(paragraph)) echoScore += 1;
    }

    const normalized = paragraph.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const abstractHeavy = /\b(silence|gap|official story|official record|mystery|institution|narrative|erasure|truth)\b/.test(normalized);
    const concreteAnchor = /\b(?:\d{4}|september|governor|warden|guard|key|door|fire|workshop|cell hall|newspaper|report|parole|national guard|donnelly|delapp|donnell|missouri|post-dispatch|post-tribune)\b/i.test(paragraph);

    if (echoScore >= 2 && abstractHeavy && !concreteAnchor && kept.length > 2) {
      continue;
    }

    const firstNine = normalized.split(' ').slice(0, 9).join(' ');
    if (firstNine && seen.has(firstNine) && paragraph.length < 550) {
      continue;
    }
    seen.set(firstNine, true);
    kept.push(paragraph);
  }

  return kept.join('\n\n');
}

function normalizeManuscriptParagraphs(prose, project) {
  let text = String(prose || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) return '';

  // If the model or a cleaner collapsed the chapter into one giant paragraph,
  // rebuild readable nonfiction paragraph breaks without changing wording.
  const isNF = isNonfictionProject(project) || isNonfictionAnthology(project);
  const paragraphCount = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const wordCount = countWords(text);

  if (isNF && paragraphCount <= 1 && wordCount > 350) {
    const sentences = splitSentencesSafe(text.replace(/\s+/g, ' '));

    const paragraphs = [];
    let bucket = [];
    let bucketWords = 0;

    for (const rawSentence of sentences) {
      const sentence = String(rawSentence || '').trim();
      if (!sentence) continue;
      const sentenceWords = countWords(sentence);
      bucket.push(sentence);
      bucketWords += sentenceWords;

      const startsNewMove = /^(?:The|But|Yet|However|Instead|This|That|These|Those|What remained|The problem|The question|The official|The institution|The riot|The workshop|The prison|Governor|Newspaper|Records?|Reports?|By\s+\d{4}|In\s+\d{4})\b/i.test(sentence);
      const shouldBreak = bucket.length >= 4 || bucketWords >= 155 || (bucket.length >= 3 && startsNewMove);

      if (shouldBreak) {
        paragraphs.push(bucket.join(' '));
        bucket = [];
        bucketWords = 0;
      }
    }

    if (bucket.length) paragraphs.push(bucket.join(' '));
    text = paragraphs.filter(Boolean).join('\n\n');
  }

  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function cleanMechanicalArtifacts(prose) {
  let text = String(prose || '');

  text = text
    .replace(/\b(The\s+cage)\s+wasn['’]t\s+being\s+opened\s+it\./gi, "$1 wasn't opening.")
    .replace(/\b(The\s+cage)\s+was\s+being\s+opened\s+it\./gi, '$1 was opening.')
    .replace(/\b(The\s+(?:study|office|bedroom|front|back|courtyard|vestibule|kitchen|apartment|car|cab|elevator|rehearsal room|hall|corridor|alley|club|taxi)?\s*door)\s+opened\s+it\./gi, '$1 opened.')
    .replace(/\b(The\s+(?:study|office|bedroom|front|back|courtyard|vestibule|kitchen|apartment|car|cab|elevator|rehearsal room|hall|corridor|alley|club|taxi)?\s*door),\s+when\s+[^.]{0,80}?\s+opened\s+it\./gi, '$1 opened.')
    .replace(/\b(door)\s+opened\s+it\b/gi, '$1 opened')
    .replace(/\b(doors)\s+opened\s+it\b/gi, '$1 opened')
    .replace(/\b(she|he|they)\s+stepped\s+found\b/gi, '$1 stepped inside and found')
    .replace(/\b(she|he|they)\s+walked\s+found\b/gi, '$1 walked in and found')
    .replace(/\b(theI)\b/g, 'the I')
    // Nonfiction/LLM typography cleanup: fix missing spaces after closing quotes and punctuation.
    .replace(/([”"'])((?:[A-Z][a-z])|(?:[a-z]{2,}))/g, '$1 $2')
    .replace(/([.!?][”"'])([A-Z])/g, '$1 $2')
    .replace(/([,;:])([A-Za-z])/g, '$1 $2')
    // Preserve paragraph breaks. Do NOT use /\s{2,}/g here; that collapses newlines into one giant block.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return text;
}

/**
 * lightCleanSceneOutput — Per-scene transport-artifact cleanup ONLY.
 * Strips markdown, headers, model junk, assistant framing, code fences.
 * Does NOT run the full postClean pipeline (no sentence deletion, no
 * paragraph dedup, no frequency capping, no word-cap truncation).
 * The heavy cleanup runs once on the final assembled chapter.
 */
function lightCleanSceneOutput(rawResult) {
  let prose = extractTextFromLLMResult(rawResult);

  try {
    prose = unwrapIntegrationResult(prose);
  } catch {
    // Never let unwrap cleanup crash generation.
  }

  prose = extractTextFromLLMResult(prose);

  // Strip transport artifacts only — no deep prose transformation.
  prose = String(prose || '')
    // Markdown headers
    .replace(/^#{1,6}\s+.*/gm, (m) => m.replace(/^#{1,6}\s+/, ''))
    // Bold / italic markers
    .replace(/\*\*/g, '')
    .replace(/(?<!\*)\*(?!\*)(.*?)\*(?!\*)/g, '$1')
    .replace(/__/g, '')
    // Scene/chapter/part labels
    .replace(/^\s*(?:Scene|Chapter|Part)\s+\d+[:.\-\s].*$/gim, '')
    // Code fences
    .replace(/```(?:\w+)?/g, '')
    // Diff artifacts
    .replace(/^---\s*a\/.*/gm, '')
    .replace(/^\+\+\+\s*b\/.*/gm, '')
    .replace(/^@@\s.*?@@.*$/gm, '')
    // Assistant framing: "Here is...", "Self-check...", "Let me know..."
    .replace(/^\s*(?:Here is|Here's)\b.*$/gim, '')
    .replace(/^\s*(?:Self-check|Notes?|Analysis|Explanation)\s*:.*$/gim, '')
    .replace(/\n+(?:Let me know if[^\n]*|I hope (?:this|you)[^\n]*|Feel free to[^\n]*|Would you like[^\n]*)\s*$/gi, '')
    // Instruction leaks
    .replace(/\[(?:NOTE(?:\s+TO\s+AUTHOR)?|TODO|TK|FIXME|EDITOR|INSERT|PLACEHOLDER)[^\]]*\]/gi, '')
    // Content warnings at top
    .replace(/^(?:Content Warning|CW|TW|Trigger Warning|Disclaimer)[:\s][^\n]*\n+/gi, '')
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  // LEAKFIX-1: strip model control tokens (/nothink, <think> blocks, <|...|>)
  // and non-Latin language drift BEFORE the truncation check, so a trailing
  // leak never masks or triggers the trailing-trim logic.
  prose = scrubModelLeaks(prose, 'scene').text;

  // GATEFIX-25: an ending without terminal punctuation means the model was cut off
  // mid-sentence. Never dress the stump with a period — trim back to the last complete
  // sentence and log what was dropped. If no complete sentence exists at all, append a
  // period as a last resort so downstream checks still run (the eval will block it).
  const lastChar = prose.slice(-1);
  if (prose && !['.', '!', '?', '"', '\u201D'].includes(lastChar)) {
    const cutMatch = prose.match(/[\s\S]*[.!?]["\u201D\u2019)\]]*(?=\s|$)/);
    if (cutMatch && cutMatch[0].trim().length > 0) {
      const dropped = prose.slice(cutMatch[0].length).trim();
      if (dropped) console.warn('[TRUNCATION] dropped incomplete trailing fragment:', dropped.slice(0, 80));
      prose = cutMatch[0].trimEnd();
    } else {
      prose = prose + '.';
    }
  }

  // LEAKFIX-1: CJK handling moved to scrubModelLeaks above (which also removes
  // the beheaded English lead-in a drift run leaves behind).

  return prose;
}

/**
 * cleanSceneOutput — DEEP cleanup pass. Runs the full postClean pipeline
 * including sentence deletion, paragraph dedup, frequency capping, etc.
 * Should run ONLY ONCE on the final assembled chapter prose.
 */
function cleanSceneOutput(rawResult, project) {
  let prose = extractTextFromLLMResult(rawResult);

  try {
    prose = unwrapIntegrationResult(prose);
  } catch {
    // Never let unwrap cleanup crash generation.
  }

  prose = extractTextFromLLMResult(prose);
  prose = cleanGeneratedProse(prose || '');
  prose = extractTextFromLLMResult(prose);
  prose = cleanNarrativeMetaLeaks(prose);
  prose = cleanMechanicalArtifacts(prose);

  prose = String(prose || '')
    .replace(/^#+\s.*$/gm, '')
    .replace(/^\s*(?:Scene|Chapter|Part)\s+\d+[:.\-\s].*$/gim, '')
    .replace(/^\s*(?:Here is|Here's)\b.*$/gim, '')
    .replace(/^\s*(?:Self-check|Notes?|Analysis|Explanation)\s*:.*$/gim, '')
    .replace(/```(?:\w+)?/g, '')
    .trim();

  if (isNonfictionProject(project) || isNonfictionAnthology(project)) {
    // stable nonfiction type-safety repair v1:
    // postClean helpers may return wrapper objects such as { text, flags }.
    // Unwrap after each helper so the next helper always receives plain text.
    const compositeResult = labelCompositeCharacters(prose, project);
    prose = extractTextFromLLMResult(compositeResult);

    const foiaResult = fixFoiaAnachronisms(prose);
    prose = extractTextFromLLMResult(foiaResult);

    const statsResult = flagUnverifiedStats(prose, project);
    prose = extractTextFromLLMResult(statsResult);
  }

  prose = applyHardNonfictionSourceLedger(prose, project);
  prose = tightenNonfictionThesisEchoes(prose, project);
  prose = normalizeManuscriptParagraphs(prose, project);

  // DRAFTGATE-3C: heal a/an agreement deterministically
  const healedArt = fixIndefiniteArticles(prose);
  prose = healedArt.text;
  if (healedArt.fixed > 0) {
    console.log(`[DRAFTGATE-3C] Ch.? (draft assembly): fixed ${healedArt.fixed} indefinite article(s)`);
  }

  // DRAFTGATE-3D: rebreak mega-paragraphs (>250 words) into ~120-word paragraphs
  const paras = prose.split(/\n{2,}/);
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
    prose = paras.join('\n\n');
    console.log(`[DRAFTGATE-3D] Ch.? (draft assembly): re-broke ${rebroke} oversized paragraph(s)`);
  }

  // DRAFTGATE-1B: strip stray markdown emphasis/scene-break markers left
  // dangling after terminal punctuation at line or paragraph end ("…it broke. *").
  // They are provable artifacts, never prose, and they fail the export gate's
  // unterminated-paragraph check.
  prose = String(prose || '').replace(/([.!?…”])[ \t]*[*_]+[ \t]*(?=\n|$)/g, '$1');

  return String(prose || '').trim();
}

function estimateSceneTargets(chapterTarget, sceneCount) {
  const count = Math.max(1, Number(sceneCount || 1));
  const total = Math.max(500, Number(chapterTarget || 2500));
  const base = Math.floor(total / count);

  return Array.from({ length: count }, (_, index) => {
    if (index === count - 1) {
      return Math.max(300, total - base * (count - 1));
    }

    return Math.max(300, base);
  });
}

function normalizeSceneSpecs(scenes, chapterTarget) {
  const safeScenes =
    Array.isArray(scenes) && scenes.length
      ? scenes
      : [
          {
            sceneNumber: 1,
            purpose: 'Draft the full chapter as one cohesive scene.',
            beats: ['Follow the chapter plan and advance the story with finished prose.'],
          },
        ];

  const targets = estimateSceneTargets(chapterTarget, safeScenes.length);

  return safeScenes.map((scene, index) => ({
    ...scene,
    sceneNumber: scene.sceneNumber || scene.number || index + 1,
    index,
    totalScenes: safeScenes.length,
    targetWords: (() => {
      const rawTarget = Number(scene.targetWords ?? scene.target_words ?? scene.word_target ?? scene.words ?? scene.target ?? targets[index] ?? 800);
      if (!Number.isFinite(rawTarget) || rawTarget < 250) return Number(targets[index] || 800);
      return Math.max(250, Math.min(2500, Math.round(rawTarget)));
    })(),
    tense: scene.tense,
  }));
}

function chapterExistingText(chapter) {
  return String(chapter?.content || chapter?.prose || chapter?.draft || chapter?.manuscript || chapter?.body || chapter?.content_md || '').trim();
}

function getChapterTargetWords(project, chapter) {
  const explicit = Number(
    chapter?.target_words ||
      chapter?.targetWords ||
      project?.target_chapter_words ||
      project?.chapter_length_target ||
      project?.chapter_target ||
      0
  );

  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  return getReadingLevelChapterTarget(project, 2500);
}

function getChapterNumber(chapter) {
  const raw = chapter?.chapter_number || chapter?.number || chapter?.chapterNumber || 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

async function getProjectResearchText(project, chapter) {
  try {
    const resolvedRaw = await resolveResearchContent(project);
    const resolved = extractTextFromLLMResult(resolvedRaw).trim();

    if (!resolved || resolved.length < 100) return resolved || '';

    const chapterNumber = getChapterNumber(chapter);
    const beatSource =
      chapter?.scene_beats ||
      chapter?.beats ||
      chapter?.chapter_beats ||
      chapter?.summary ||
      chapter?.description ||
      chapter?.title ||
      '';

    const beatText = extractTextFromLLMResult(beatSource);
    const relevant = getRelevantResearch(resolved, chapterNumber, beatText);

    let combined = [resolved, relevant].filter(Boolean).join('\n\n');
    // ARCH2-4a: a verbatim witness quote has exactly one home chapter (derived
    // from the outline). Foreign-homed quotes are excised from this chapter's
    // research block so the writer references the testimony without re-quoting.
    try {
      const allChapters = await base44.entities.Chapter.filter({ project_id: project.id });
      const ex = excludeForeignQuotes(combined, project, allChapters, chapterNumber);
      if (ex.excluded.length) {
        console.warn('[QUOTE-LEDGER] ch' + chapterNumber + ': excised ' + ex.excluded.length + ' foreign-homed quote(s): ' + ex.excluded.join(' | '));
      }
      combined = ex.text;
    } catch (qlErr) { /* fail-open: drafting continues with unfiltered research */ }
    return combined;
  } catch (error) {
    console.warn('[sceneWriter] Research resolution failed safely; drafting will continue without injected research:', error);
    return '';
  }
}

async function getSeriesContinuity(project) {
  try {
    if (!project?.series_bible_id) return '';

    // Load the actual SeriesBible entity (not the project — this was the critical bug)
    const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
    const seriesBible = bibles?.[0];
    if (!seriesBible) {
      console.warn('[sceneWriter] SeriesBible not found for id:', project.series_bible_id);
      return '';
    }

    const flavor = project.series_flavor || 'continuation';

    if (flavor === 'standalone') {
      // Standalone sequels get light world/voice context only
      const parts = ['=== SERIES CONTEXT (standalone sequel — shared world) ==='];
      if (seriesBible.voice_profile) parts.push(`VOICE PROFILE: ${seriesBible.voice_profile.substring(0, 300)}`);
      if (seriesBible.rules_and_systems) parts.push(`WORLD RULES: ${seriesBible.rules_and_systems.substring(0, 400)}`);
      if (seriesBible.world_state) parts.push(`WORLD STATE: ${seriesBible.world_state.substring(0, 300)}`);
      if (seriesBible.tone_and_themes) parts.push(`TONE/THEMES: ${seriesBible.tone_and_themes.substring(0, 300)}`);
      parts.push('NOTE: This is a standalone story in a shared world. You are not bound by previous book characters or threads.');
      parts.push('=== END SERIES CONTEXT ===');
      return parts.join('\n');
    }

    if (flavor === 'anthology_volume') {
      // Anthology volumes get shared theme/rules without carrying protagonist obligations
      const parts = ['=== SERIES CONTEXT (anthology — shared theme) ==='];
      if (seriesBible.tone_and_themes) parts.push(`SHARED THEME: ${seriesBible.tone_and_themes.substring(0, 300)}`);
      if (seriesBible.rules_and_systems) parts.push(`WORLD RULES: ${seriesBible.rules_and_systems.substring(0, 400)}`);
      if (seriesBible.voice_profile) parts.push(`TONE GUIDE: ${seriesBible.voice_profile.substring(0, 200)}`);
      parts.push('NOTE: This is an anthology volume. Use your own protagonist and plot. Do NOT reuse protagonists from other volumes.');
      parts.push('=== END SERIES CONTEXT ===');
      return parts.join('\n');
    }

    // True continuation — strict canon injection
    return buildSeriesContinuityBlock(seriesBible, project.series_number);
  } catch (error) {
    console.warn('[sceneWriter] Series continuity load failed:', error);
    return '';
  }
}

/**
 * Load volume entry/exit contract block for the current chapter position.
 * Uses entry_contract_json and exit_contract_json from the project.
 */
async function getVolumeContractBlock(project, chapter) {
  try {
    if (!project?.series_bible_id) return '';
    const flavor = project.series_flavor || 'continuation';
    if (flavor === 'anthology_volume') return ''; // anthology volumes have no arc obligations

    let entryContract = null;
    let exitContract = null;

    try { entryContract = project.entry_contract_json ? JSON.parse(project.entry_contract_json) : null; } catch {}
    try { exitContract = project.exit_contract_json ? JSON.parse(project.exit_contract_json) : null; } catch {}

    if (!entryContract && !exitContract) return '';

    const chapterNumber = chapter?.chapter_number || chapter?.chapterNumber || 1;
    // CHAPCOUNT-1: chapter_target is the canonical field; reading chapter_count
    // first resolved 20 for every project the current Setup screen creates.
    const totalChapters = resolveChapterCount(project, 20);

    // For standalone flavor, use light guidance only
    if (flavor === 'standalone') {
      if (exitContract) {
        return '\n=== VOLUME ENDING GUIDANCE (standalone — optional) ===\n' +
          (exitContract.description || 'Consider how this volume ends in the context of the series world.') +
          '\n=== END VOLUME GUIDANCE ===\n';
      }
      return '';
    }

    // True continuation — strict contract enforcement
    return buildVolumeContractBlock(entryContract, exitContract, chapterNumber, totalChapters);
  } catch (error) {
    console.warn('[sceneWriter] Volume contract block load failed:', error);
    return '';
  }
}

async function getAuthorStyleBlock(project) {
  try {
    if (!project?.author_style_id) return '';

    const style = await loadAuthorStyle(project.author_style_id);
    if (!style) return '';

    return buildCustomAuthorStyleBlock(style);
  } catch (error) {
    console.warn('[sceneWriter] Author style load failed:', error);
    return '';
  }
}

async function getChapterContinuity(project, chapter, external = {}) {
  try {
    const chapterNumber = getChapterNumber(chapter);
    const projectId = project?.id;

    const previousChapterTail =
      external.previousChapterTail ||
      external.previousChapterEnding ||
      external.previous_chapter_tail ||
      (await getPreviousChapterEnding(projectId, chapterNumber));

    const rollingContext =
      external.rollingContext ||
      external.rolling_context ||
      (await buildRollingContext(projectId, chapterNumber));

    return {
      previousChapterTail,
      rollingContext,
      previousChapterEnding: external.previousChapterEnding || previousChapterTail,
    };
  } catch (error) {
    console.warn('[sceneWriter] Continuity context failed:', error);

    return {
      previousChapterTail: external.previousChapterTail || '',
      rollingContext: external.rollingContext || '',
      previousChapterEnding: external.previousChapterEnding || '',
    };
  }
}

async function getPriorChapterSummaries(project, chapter, supplied = []) {
  if (Array.isArray(supplied) && supplied.length) return supplied;

  try {
    if (!project?.id || !chapter) return [];

    const chapterNumber = getChapterNumber(chapter);
    if (!chapterNumber || chapterNumber <= 1) return [];

    const chapters = await base44.entities.Chapter.filter({ project_id: project.id });

    return (chapters || [])
      .filter((c) => Number(c.number || c.chapter_number || 0) < chapterNumber)
      .sort((a, b) => Number(a.number || a.chapter_number || 0) - Number(b.number || b.chapter_number || 0))
      .map((c) => c.summary || c.chapter_summary || c.continuity_summary || c.beat_summary || '')
      .filter(Boolean)
      .slice(-6);
  } catch (error) {
    console.warn('[sceneWriter] Prior summaries failed:', error);
    return [];
  }
}

async function getTwistBlock(project, chapter) {
  try {
    const base = getTwistContextForChapter(project, chapter);
    const anthology = getAnthologyTwistBlock(project, chapter);
    return [base, anthology].filter(Boolean).join('\n\n');
  } catch (error) {
    console.warn('[sceneWriter] Twist context failed:', error);
    return '';
  }
}

function getAnthologyContext(project, chapter) {
  if (!isAnthologyProject(project)) return '';

  try {
    return buildAnthologyStoryContext(project, chapter);
  } catch (error) {
    console.warn('[sceneWriter] Anthology context failed:', error);
    return '';
  }
}

function buildSceneStateContractBlock(spec) {
  const isClean = isCleanMetadata;

  const sceneId = String(spec?.scene_id || '').trim();
  const entryState = String(spec?.entry_state || '').trim();
  const exitState = String(spec?.exit_state || '').trim();
  const requiredEvents = Array.isArray(spec?.required_events) ? spec.required_events.filter(Boolean).filter(isClean) : [];
  const forbiddenEvents = Array.isArray(spec?.forbidden_events) ? spec.forbidden_events.filter(Boolean).filter(isClean) : [];
  const dependencies = Array.isArray(spec?.continuity_dependencies) ? spec.continuity_dependencies.filter(Boolean).filter(isClean) : [];
  const priorCompletedEvents = Array.isArray(spec?.prior_completed_events) ? spec.prior_completed_events.filter(Boolean).filter(isClean) : [];
  const priorExitStates = Array.isArray(spec?.prior_exit_states) ? spec.prior_exit_states.filter(Boolean).filter(isClean) : [];
  const futureReservedEvents = Array.isArray(spec?.future_reserved_events) ? spec.future_reserved_events.filter(Boolean).filter(isClean) : [];

  if (!sceneId && !entryState && !exitState && !requiredEvents.length) return '';

  const lines = [
    `SCENE ID: ${sceneId || 'missing — do not draft'}`,
    `ENTRY STATE (must be true when the scene opens): ${entryState || 'missing'}`,
    `REQUIRED EVENTS FOR THIS SCENE ONLY (each exactly once): ${requiredEvents.length ? requiredEvents.join('; ') : 'missing'}`,
    `FORBIDDEN REPLAYS / REVERSALS: ${forbiddenEvents.length ? forbiddenEvents.join('; ') : 'None listed; still do not replay earlier events.'}`,
    // SCENESCOPE-1: the reservation list above only covers events some scene
    // OWNS. Ch.2 proved the writer also invents UNPLANNED threshold events
    // (arrivals, openings, unlockings) that belong to no scene — staging the
    // same Sector-7 arrival three times in one chapter. Forbid the class.
    `UNPLANNED MAJOR EVENTS ARE FORBIDDEN: stage NO arrival at a new location, NO opening/unlocking of any door, vault, hatch, panel, or passage, NO discovery of a new area, and NO major reveal unless it is explicitly listed in REQUIRED EVENTS above. Travel and preparation may approach a threshold; CROSSING it belongs to whichever later scene or chapter owns it. When the required events are done, end the scene at its EXIT STATE — do not escalate past it.`,
    `EXIT STATE (must be true when the scene ends): ${exitState || 'missing'}`,
  ];
  if (priorCompletedEvents.length) {
    lines.push(`COMPLETED EVENTS FROM EARLIER SCENES — NEVER REPLAY: ${priorCompletedEvents.join('; ')}`);
  }
  if (priorExitStates.length) {
    lines.push(`LOCKED PRIOR EXIT STATES — MUST REMAIN TRUE: ${priorExitStates.join('; ')}`);
  }
  if (futureReservedEvents.length) {
    const futureReservedObjs = Array.isArray(spec?.future_reserved_event_objects) ? spec.future_reserved_event_objects : futureReservedEvents.map(e => ({event: e}));
    const linesToAdd = [
      `RESERVED FOR LATER SCENES — DO NOT PERFORM OR RESOLVE:`,
      ...futureReservedObjs.filter(o => o?.event).map(obj => 
        `- ${obj.event}${obj.sceneNumber || obj.sceneId ? ` (Reserved for Scene ${obj.sceneNumber || obj.sceneId})` : ''}`
      ),
      `You may refer to existing characters or objects, foreshadow danger, or notice unexplained things. You MAY NOT perform the event, resolve it, transfer the reserved object, reveal the reserved information, or stage an alternate version of it.`
    ];
    lines.push(linesToAdd.join('\n'));
  }
  if (dependencies.length) lines.push(`CONTINUITY DEPENDENCIES: ${dependencies.join('; ')}`);
  // KEYLEDGER-1f: possession is an entry condition, not a suggestion.
  const holders = Array.isArray(spec?.holders_of_record) ? spec.holders_of_record.filter(Boolean) : [];
  if (holders.length) {
    lines.push(
      `OBJECT POSSESSION AT SCENE OPEN (must be true on the first page of this scene): ${holders.join('; ')}. ` +
      `Nobody else may be holding, pocketing, drawing, or handing over these objects unless this scene WRITES the handover on the page.`
    );
  }
  // PRONOUNLOCK-1: pronouns are canon, not style. In-dialogue misgendering by
  // another character (disguise, mockery) is allowed; narration is not.
  const pronounCanon = String(spec?.pronoun_canon || '').trim();
  if (pronounCanon) {
    lines.push(`CHARACTER PRONOUNS (canonical — narration must NEVER vary them): ${pronounCanon}.`);
  }
  // CANON-2: roles are canon too — no other character may be given these jobs.
  const roleCanon = String(spec?.role_canon || '').trim();
  if (roleCanon) {
    lines.push(`CHARACTER ROLES (canonical — from the character sheet, which OUTRANKS any conflicting world/canon note): ${roleCanon}. Never attribute one character's canonical role to another.`);
  }
  // STYLEBUDGET-1: rendered as its own block inside the contract.
  const styleBudget = String(spec?.style_budget || '').trim();
  if (styleBudget) {
    lines.push(styleBudget);
  }

  return `NARRATIVE STATE CONTRACT — MANDATORY:
This is one versioned scene, not an alternate take. Write only this scene.
Never reverse a death, departure, revelation, injury, object transfer, or decision
established by the entry state or prior context.
${lines.join('\n')}`;
}

function buildSceneCastBlock(spec) {
  const present = Array.isArray(spec?.characters_present) ? spec.characters_present.filter(Boolean) : [];
  const props = Array.isArray(spec?.props_present) ? spec.props_present.filter(Boolean) : [];
  if (!present.length && !props.length) return '';
  const lines = [];
  if (present.length) lines.push(`Characters in THIS scene (only these, by their canon names): ${present.join(', ')}`);
  if (props.length) lines.push(`Props in play THIS scene (carry them, name them exactly): ${props.join(', ')}`);
  return `THIS SCENE — CAST & PROPS:\n${lines.join('\n')}`;
}

function filterTwistContextForScene(twistContext, spec) {
  if (!twistContext) return '';

  const blocks = twistContext.split('\n\n').filter(Boolean);

  // Create a strict authorization text from ONLY permitted fields
  const authFields = [
    spec.scene_goal || '',
    ...(Array.isArray(spec.required_events) ? spec.required_events : []),
    ...(Array.isArray(spec.twists) ? spec.twists : []),
    ...(Array.isArray(spec.assigned_twists) ? spec.assigned_twists : [])
  ];
  const authText = authFields.join(' ').toLowerCase();

  const filtered = blocks.filter(block => {
    if (block.startsWith('=== TWIST MANAGEMENT')) return true;
    if (block === '===') return true;

    // Twists are identified by their name in quotes, e.g., "The Betrayal"
    const nameMatch = block.match(/"([^"]+)"/);
    if (nameMatch) {
      const name = nameMatch[1].toLowerCase();
      // Only keep the twist instruction if the twist name is explicitly assigned or referenced in authorized fields
      return authText.includes(name);
    }
    return true;
  });

  // If only headers/footers remain, return empty
  if (filtered.length <= 2 && filtered.every(b => b.startsWith('===') || b === '===')) {
    return '';
  }

  return filtered.join('\n\n');
}

function buildScenePrompt(args) {
  const isNF = isNonfictionProject(args.project) || isNonfictionAnthology(args.project);
  const base = isNF ? buildNonfictionPrompt(args) : buildFictionPrompt(args);
  const sceneCast = buildSceneCastBlock(args.spec || args);
  const stateContract = isNF ? '' : buildSceneStateContractBlock(args.spec || args);
  
  const serializedLedger = args.runtimeLedger ? serializeLedger(args.runtimeLedger) : '';
  const ledgerInstruction = serializedLedger 
    ? `\n\n${serializedLedger}\n\nCRITICAL NARRATIVE-STATE DIRECTIVE:\n- You must begin exactly from the actual final state established above.\n- Do NOT resurrect any character marked DEAD.\n- Do NOT utilize any object marked UNAVAILABLE/DESTROYED.\n- Do NOT replay any RECENT COMPLETED EVENTS.`
    : '';

  let out = [stateContract, sceneCast, base].filter(Boolean).join('\n\n') + ledgerInstruction;
  // ARCH2-4b-a: foreign-homed witness quotes must not reach the model through
  // ANY prompt channel (bible fields, beats, rolling context) — not only the
  // research block. Home-chapter quotes and unhomed quotes pass through
  // untouched; with no chapter list the ledger derives nothing and this is a
  // no-op (fail-open).
  try {
    const chNum = getChapterNumber(args.chapter);
    const ex = excludeForeignQuotes(out, args.project, args.chapters || [], chNum);
    if (ex.excluded.length) console.warn('[QUOTE-LEDGER] ch' + chNum + ' prompt-level excision: ' + ex.excluded.join(' | '));
    out = ex.text;
  } catch (qpErr) { /* fail-open: prompt goes out unfiltered */ }
  return out;
}

async function generateSceneWithRepair({
  project,
  spec,
  prompt,
  model,
  fallbackModel,
  disableFallbacks,
  targetWords,
  temperature = 0.72,
  maxTokens = 5500,
}) {
  let result = await invokeLLMWithRetry({
    prompt,
    model,
    fallback_model: fallbackModel,
    fallback_models: fallbackModel ? [fallbackModel] : [],
    disable_fallbacks: disableFallbacks,
    use_gemini_fallback: !disableFallbacks,
    use_openai_fallback: !disableFallbacks,
    temperature,
    max_tokens: maxTokens,
  });

  let prose = lightCleanSceneOutput(result);
  let evalResult = quickSceneEval(prose, spec, targetWords, project);

  if (!evalResult.hasBlockingIssue) {
    return {
      prose,
      repaired: false,
      issues: [],
    };
  }

  // Repair up to 3 times. Each pass rewrites the section to remove flagged
  // material (fabricated quotes/officials/documents, tense drift, stubs).
  const MAX_REPAIRS = 3;
  let repairAttempt = 0;
  while (evalResult.hasBlockingIssue && repairAttempt < MAX_REPAIRS) {
    repairAttempt++;
    const repairPrompt = buildRepairPrompt({
      originalPrompt: prompt,
      brokenProse: prose,
      issues: evalResult.issues,
      targetWords,
    });
    result = await invokeLLMWithRetry({
      prompt: repairPrompt,
      model,
      fallback_model: fallbackModel,
      fallback_models: fallbackModel ? [fallbackModel] : [],
      disable_fallbacks: disableFallbacks,
      use_gemini_fallback: !disableFallbacks,
      use_openai_fallback: !disableFallbacks,
      temperature: Math.max(0.4, temperature - 0.1 * repairAttempt),
      max_tokens: maxTokens,
    });
    prose = lightCleanSceneOutput(result);
    evalResult = quickSceneEval(prose, spec, targetWords, project);
  }

  // Backstop (nonfiction): if fabricated sources survived every repair, physically
  // strip the offending sentences rather than ship them. A clean gap in the prose
  // is always better than a convincing invented document or quote.
  let stripped = false;
  if (isNonfictionProjectAuthority(project)) {
    // DRAFTGATE-2A: dropped-word sentences that survived every repair are
    // stripped, never shipped. The model re-drops banned nouns on every
    // regeneration, so this deterministic last resort is what converges.
    try {
      const dw = stripDroppedWordSentences(prose);
      if (dw.removed.length > 0) {
        console.warn(`[DRAFTGATE-2] Stripped ${dw.removed.length} dropped-word sentence(s) after repairs failed: ${dw.removed.slice(0, 2).join(' | ')}`);
        prose = dw.text;
        stripped = true;
        evalResult = quickSceneEval(prose, spec, targetWords, project);
      }
    } catch (e) { /* strip unavailable — continue */ }
    try {
      const mang = stripMangledSentences(prose);
      if (mang.removed.length > 0) {
        console.warn(`[DRAFTGATE-3H] Stripped ${mang.removed.length} mangled sentence(s) after repairs failed: ${mang.removed.slice(0, 2).join(' | ')}`);
        prose = mang.text;
        stripped = true;
        evalResult = quickSceneEval(prose, spec, targetWords, project);
      }
    } catch (e) { /* strip unavailable — continue */ }
    // ARCH-1B: deterministic closed-world strip runs FIRST and never depends on an LLM.
    try {
      const cw = closedWorldCheck(prose, project);
      if (cw.length) {
        const beforeCw = prose;
        prose = stripFabricatedSentences(prose, cw);
        if (prose !== beforeCw) { stripped = true; evalResult = quickSceneEval(prose, spec, targetWords, project); }
      }
    } catch (e) { /* closed-world unavailable — continue */ }
    // ARCH-1C: clock/fate ledger strip — if an un-evidenced clock time or
    // life-outcome claim survived every repair, the sentence is removed.
    // Blank beats fabricated.
    try {
      const flLedger = buildFactLedger(project);
      const fl = stripFactLedgerViolations(prose, flLedger);
      if (fl.removed.length > 0) {
        console.warn(`[FATE-GATE] Stripped ${fl.removed.length} un-evidenced clock/fate sentence(s) after repairs failed: ${fl.removed.slice(0, 2).join(' | ')}`);
        prose = fl.text;
        stripped = true;
        evalResult = quickSceneEval(prose, spec, targetWords, project);
      }
    } catch (e) { /* fact-ledger strip unavailable — continue */ }
    // SCAFFOLDFIX-1: scaffold/meta sentences that survived every repair are stripped, never shipped.
    try {
      const SCAFFOLD_STRIP_RX = [
        /\bthis\s+(?:chapter|section|book)\b/i,
        /\bin\s+conclusion\b/i,
        /\bas\s+we\s+(?:transition|move\s+forward|delve|examine|explore)\b/i,
        /\bset(?:s|ting)?\s+the\s+stage\b/i,
        /\blay(?:s|ing)?\s+the\s+groundwork\b/i,
        /\bthe\s+(?:next|following|previous|preceding)\s+chapter\s+(?:will|examines?|explores?|traces?|turns?|looks?|delves?|investigates?|reconstructs?|details?|covers?|addresses?|considers?|shows?)\b/i,
        /\b(?:supplied|provided)\s+(?:research|materials?|sources?|documents?)\b/i,
        /\bthe\s+research\s+(?:contains|offers|provides|does\s+not\s+contain|shows\s+no)\b/i,
      ];
      const scaffoldParts = prose.split(/(?<=[.!?"\u201D])\s+/);
      const scaffoldKept = scaffoldParts.filter(s => !SCAFFOLD_STRIP_RX.some(rx => rx.test(s)));
      if (scaffoldKept.length !== scaffoldParts.length) {
        console.warn(`[SCAFFOLD-STRIP] Removed ${scaffoldParts.length - scaffoldKept.length} scaffold/meta sentence(s).`);
        prose = scaffoldKept.join(' ');
        stripped = true;
        evalResult = quickSceneEval(prose, spec, targetWords, project);
      }
    } catch (e) { /* scaffold strip unavailable — continue */ }
    try {
      const fab = crossCheckResearchFabrication(prose, project);
      if (!fab.clean) {
        const before = prose;
        prose = stripFabricatedSentences(prose, fab.violations);
        stripped = prose !== before;
        if (stripped) evalResult = quickSceneEval(prose, spec, targetWords, project);
      }
    } catch (e) { /* strip unavailable — ship best repair */ }
  }

  return {
    prose,
    repaired: repairAttempt > 0,
    stripped,
    issues: evalResult.issues,
  };
}

// Removes whole sentences containing fabricated material (quotes, officials,
// documents) the model refused to drop during repair. Targeted by the exact
// snippets crossCheckResearchFabrication returned. Nonfiction backstop.
// One LLM pass over the whole assembled chapter: returns exact sentences that
// cite a document, record, dispatch, or institutional source NOT present in the
// research. Catches unquoted references (e.g. "Department of the Gulf records")
// that the regex detector cannot. Fails safe (returns [] on any error).
async function semanticSourceCheck(prose, project) {
  // NFCLASS-3: see above — the authority decides, not a raw field equality.
  if (!prose || !project || !isNonfictionProjectAuthority(project)) return [];
  const research = typeof project.research_data === 'string'
    ? project.research_data
    : (project.research_data ? JSON.stringify(project.research_data) : '');
  if (!research || research.length < 50) return [];
  const prompt = [
    'You are a fact-checker verifying a nonfiction chapter against its ONLY permitted research.',
    'Return a JSON array (and NOTHING else) of the EXACT sentences from the CHAPTER that assert a specific document, record, ledger, dispatch, telegram, court record, report, letter, statistic, or named institutional source that does NOT appear in the RESEARCH.',
    'Include a sentence ONLY if it presents such a source as real and that source is absent from the research. Do NOT include general historical statements, analysis, or sentences that already say the record is silent/unknown. Copy each flagged sentence VERBATIM from the chapter.',
    'If nothing qualifies, return [].',
    '',
    '=== RESEARCH (the only permitted sources) ===',
    research.slice(0, 12000),
    '',
    '=== CHAPTER ===',
    prose.slice(0, 16000),
    '',
    'JSON array of unsupported-source sentences:',
  ].join('\n');
  try {
    const result = await invokeLLMWithRetry({
      prompt,
      model: pickProseModel(project),
      disable_fallbacks: false,
      use_gemini_fallback: true,
      use_openai_fallback: true,
      temperature: 0.1,
      max_tokens: 1500,
    });
    const raw = extractTextFromLLMResult(result) || '';
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s) => typeof s === 'string' && s.trim().length > 12)
              .map((s) => ({ type: 'semantic', snippet: s.trim() }));
  } catch (e) {
    console.warn('[SEMANTIC-CHECK] skipped (failed safely):', e?.message || e);
    return [];
  }
}

// Deterministic source check v2 (no model judgment). Flags sentences that cite:
//  (a) a proper-name source (capitalized: "Galveston Daily News", "Freedmen's
//      Bureau") whose full name is NOT in the research;
//  (b) a generic source claim ("X records/reports/dispatches") whose owner's
//      distinctive words are NOT in the research;
//  (c) a percentage statistic absent from the research.
// Checks RESEARCH ONLY — not the AI-generated bible, which could carry the same
// invented sources and whitelist them. Flagged sentences are stripped.
// Sentence splitter that will not break on rank abbreviations or single-letter
// name initials ("Major William S. Pease"). Shared by the source check and the
// fabrication strip so flagged snippets and removed sentences align 1:1.
export function splitSentencesSafe(text) {
  const PROT = '\u0001';
  const ABBR = /(?<!\u0001)\b(D\.\s?C|U\.\s?S|Gen|Maj|Brig|Col|Capt|Lt|Sgt|Gov|Sec|Dr|Mr|Mrs|Ms|St|Mt|Jr|Sr|No|vs|etc|a\.m|p\.m)\.(?=\s|$)/gi;
  // GATEFIX-22: protect dotted domain names (archives.gov, loc.gov, blogs.loc.gov) so a
  // mid-domain split can never strand a "gov." stump after a sentence strip.
  let work = String(text || '').replace(/\b((?:[a-z0-9-]+\.)+(?:gov|com|org|net|edu|io))\b/gi, (m) => m.split('.').join(PROT));
  work = work.replace(ABBR, (m) => m.replace('.', PROT));
  // Single-letter initials followed by a capitalized word: "William S. Pease"
  work = work.replace(/\b([A-Z])\.(?=\s+[A-Z])/g, '$1' + PROT);
  // DRAFTGATE-3F: consecutive initials with NO space ("J.P. Morgan", "U.S.A.").
  // The space-requiring rule above missed them, so the tokenizer split
  // MID-NAME and the closed-world strip removed only the tail — shipping
  // stumps like "…in the basement of the J." (measured in a live export).
  // Protected, the whole sentence stays one part and strips remove it whole.
  work = work.replace(/\b([A-Z])\.(?=[A-Z]\b|[A-Z]\.)/g, '$1' + PROT);
  // DRAFTGATE-3F: legal-citation "v." ("Dorr, trustee, v. United States…") —
  // a lowercase single-letter abbreviation, never a sentence terminator.
  work = work.replace(/\b(v)\.(?=\s)/g, '$1' + PROT);
  // DRAFTGATE-3A: protect decimals ("2.3 million", "3.5%"), decimal-dotted
  // enumerations, and any digit.digit shape — an unprotected decimal made the
  // period a sentence terminator that neither match alternative could consume,
  // and match() DROPS unmatched spans. Measured live: every "2.3 million"
  // sentence in a shipped book lost its head through this splitter.
  work = work.replace(/(\d)\.(?=\d)/g, '$1' + PROT);
  // DRAFTGATE-3E: partition by construction. String.match DROPS spans that fit
  // no alternative — measured live: raw scene text with markdown emphasis after
  // terminal punctuation ("…looked wrong.**") refused ~22 times in one chapter
  // run, and every refusal downgraded dedupe, the closed-world strip, and the
  // 3D re-breaker to no-ops, shipping fabrications and mega-paragraphs.
  // Instead of enumerating breaker shapes, iterate the terminator matches and
  // emit every inter-match gap as its own part: parts.join('') === work on
  // EVERY input, by construction. Untokenizable spans survive as single parts,
  // which every consumer already treats as sentence units.
  const SENT_RE = /[^.!?]*[.!?]+["'\u201d\u2019)\]]*(?:\s+|$)/g;
  const parts = [];
  let last = 0;
  let mt;
  while ((mt = SENT_RE.exec(work)) !== null) {
    if (mt.index > last) parts.push(work.slice(last, mt.index));
    parts.push(mt[0]);
    last = mt.index + mt[0].length;
    if (mt[0].length === 0) SENT_RE.lastIndex++; // unreachable ([.!?]+ needs a char) — loop safety only
  }
  if (last < work.length) parts.push(work.slice(last));
  if (parts.length === 0) parts.push(work);
  // DRAFTGATE-3A LOSSLESS INVARIANT — retained as a dead-man's switch: the
  // partition makes loss impossible; if this ever fires, the tokenizer regressed.
  if (parts.join('') !== work) {
    console.error('[DRAFTGATE-3A] splitSentencesSafe would have LOST text (' + (work.length - parts.join('').length) + ' chars) — returning input unsplit. Fix the tokenizer, never ship the loss.');
    return [String(text || '')];
  }
  return parts.map((s) => s.split(PROT).join('.'));
}

// Removes exact duplicate sentences (10+ words) — chapter-wide tics the local
// models bake in at drafting time. Keeps the first occurrence only.
function dedupeRepeatedSentences(prose) {
  if (!prose) return prose;
  const sentences = splitSentencesSafe(prose);
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const s of sentences) {
    const key = s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
    const wc = key.split(' ').filter(Boolean).length;
    if (wc >= 8 && seen.has(key)) { removed++; continue; }
    if (wc >= 8) seen.add(key);
    kept.push(s);
  }
  if (removed) console.warn('[DEDUPE] Removed', removed, 'exact duplicate sentence(s).');
  return kept.join('');
}

// GATEFIX-16: a verbatim quotation may appear at most ONCE per chapter. The local
// models reuse witness quotes as refrains with varied framing, so exact-sentence
// dedupe never sees them. Collapse by QUOTE CONTENT: keep the sentence containing
// the first occurrence; drop later sentences that repeat the same quote (>=4 words).
function dedupeRepeatedQuotes(prose) {
  if (!prose) return prose;
  const normQ = (s) => (s || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  // QUOTEDEDUPE-1: scan the WHOLE prose for quote spans instead of scanning
  // per-sentence. Multi-sentence quotes ("One step. One breath.") straddle the
  // sentence splitter, so the old per-sentence regex never saw opener and
  // closer together and repeated dialogue survived.
  const QUOTE_RE = /[\u201c"]([^\u201c\u201d"]{10,400})[\u201d"]/g;
  const sentences = splitSentencesSafe(prose);
  const offs = [];
  let pos = 0;
  for (const s of sentences) { offs.push(pos); pos += s.length; }
  const seen = [];
  const dropIdx = new Set();
  let m;
  while ((m = QUOTE_RE.exec(prose)) !== null) {
    const q = normQ(m[1]);
    if (q.split(' ').filter(Boolean).length < 4) continue;
    const dup = seen.some((sq) => sq === q || sq.includes(q) || q.includes(sq));
    if (dup) {
      for (let i = 0; i < sentences.length; i += 1) {
        const a = offs[i];
        const b = offs[i] + sentences[i].length;
        if (a < QUOTE_RE.lastIndex && b > m.index) dropIdx.add(i);
      }
    } else {
      seen.push(q);
    }
  }
  if (!dropIdx.size) return prose;
  console.warn('[DEDUPE-QUOTES] Removed', dropIdx.size, 'sentence(s) repeating an earlier verbatim quote.');
  return sentences.filter((_, i) => !dropIdx.has(i)).join('');
}

// GATEFIX-16: detection-only alarm for phrase-tic families the dedupers cannot fix.
// Feeds the human review checklist; does not modify prose.
function repetitionAlarm(prose) {
  if (!prose) return 0;
  const bare = String(prose).replace(/[\u201c"][^\u201c\u201d"]*[\u201d"]/g, ' ');
  const words = bare.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  const seen = new Map();
  const flagged = new Set();
  for (let i = 0; i + 8 <= words.length; i++) {
    const g = words.slice(i, i + 8).join(' ');
    if (seen.has(g)) { if (i - seen.get(g) >= 8) flagged.add(g); }
    else seen.set(g, i);
  }
  if (flagged.size) console.warn('[REPETITION]', flagged.size, 'repeated 8-word phrase families remain in this chapter.');
  return flagged.size;
}

// BOOKECHO-1: deterministic cross-chapter echo detector. The chapter-level
// dedupers and repetitionAlarm cannot see other chapters, so the writer
// reuses its best images verbatim across the book (audit #4: "eardrums like
// deep water" in ch.1 AND ch.5; "lock disengaged with a heavy thunk" in
// ch.2 AND ch.5). An echo is any 8-word phrase of this chapter that already
// appears in a PRIOR chapter's prose. Exported for direct testing.
export function buildCrossChapterEchoDetector(priorChapterProse) {
  const echoNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const priorGrams = new Set();
  for (const pc of (Array.isArray(priorChapterProse) ? priorChapterProse : [])) {
    const w = echoNorm(pc).split(' ');
    for (let i = 0; i + 8 <= w.length; i += 1) priorGrams.add(w.slice(i, i + 8).join(' '));
  }
  const isEchoed = (s) => {
    const w = echoNorm(s).split(' ');
    for (let i = 0; i + 8 <= w.length; i += 1) {
      if (priorGrams.has(w.slice(i, i + 8).join(' '))) return true;
    }
    return false;
  };
  // A reused phrase's 8-gram often SPANS a sentence boundary ("...a heavy
  // thunk. The door...") — the audited thunk echo is exactly this shape. So
  // test each sentence alone AND joined with its successor; a pair-only hit
  // flags the first sentence (rewriting it breaks the echo either way).
  const findEchoSentences = (prose) => {
    const sents = splitSentencesSafe(prose).map((s) => s.trim());
    const flagged = [];
    for (let i = 0; i < sents.length; i += 1) {
      if (sents[i].length <= 20) continue;
      if (isEchoed(sents[i]) || (i + 1 < sents.length && isEchoed(sents[i] + ' ' + sents[i + 1]))) {
        flagged.push(sents[i]);
      }
    }
    return flagged;
  };
  return { isEchoed, findEchoSentences, echoNorm, priorGramCount: priorGrams.size };
}

// REPEAT-1: IN-CHAPTER near-duplicate sentences.
//
// The existing dedupers are blind exactly where this model repeats itself.
// dedupeRepeatedSentences drops EXACT sentences of 8+ words; repetitionAlarm
// reports repeated 8-word phrases. Measured across all five saved Brass Meridian
// chapters (2026-08-04), the 8-word floor caught ZERO in-chapter repeats. Lower
// the floor and the disease is everywhere:
//
//   floor 8 words -> 0 repeats      floor 5 words -> 7
//   floor 4 words -> 20 repeats     (dialogue excluded throughout)
//
//   ch.1  "he looked at lena"           x3
//   ch.5  "marcus didn t move"          x3
//   ch.2  "he didn t look back"         x2
//   ch.5  "her fingers hovered over the switches"  x2
//
// This is not a coincidence: the RHYTHM advisory measures this book at 43-57%
// sentences of five words or fewer. The gate's floor sat above the register the
// model actually writes in.
//
// NEAR-duplicates are worse than exact ones, because no exact matcher can ever
// see them. At word-Jaccard >= 0.75, five words or more, every hit in the live
// book is the model reusing its own image with a word swapped:
//
//   0.78  "the blast door GROANED, a heavy metallic SHRIEK that vibrated through
//          the soles of Lena's boots"
//         "the blast door SHUDDERED, a heavy metallic GROAN that vibrated through
//          the soles of Lena's boots"
//   0.80  "the cane slipped from his grasp, clattering AGAINST the concrete"
//         "the cane slipped from his grasp, clattering ONTO the concrete"
//   0.78  "she slipped the key back into her pocket" / "Lena slipped the key ..."
//
// RULES, and why each number is what it is - all three were measured, not guessed:
//   - exact repeat, 4+ words: 20 hits in the live book, every one a tic. At 3 words
//     it starts collecting "she looked up", which is ordinary prose.
//   - near repeat, 5+ words and Jaccard >= 0.75: 7 hits, every one a defect, no
//     judgment calls. At 0.65 it starts collecting "he didn't look at X" families,
//     which are sometimes one beat described once.
//   - at least 3 sentences apart: deliberate back-to-back repetition is a craft
//     device ("He didn't move. He didn't move.") and is none of this gate's business.
//
// Dialogue is excluded entirely. Characters repeat themselves on purpose.
//
// This detector REPORTS PAIRS; it never deletes. A near-duplicate carries meaning
// that an exact duplicate does not, so the repair rewrites the LATER sentence and
// leaves the first alone.
export const REPEAT_RULES = {
  exactMinWords: 4,
  nearMinWords: 5,
  nearMinJaccard: 0.75,
  minSentenceGap: 3,
};

export function findInChapterRepeats(prose, rules = REPEAT_RULES) {
  const R = { ...REPEAT_RULES, ...(rules || {}) };
  const norm = (t) => String(t || '').toLowerCase()
    .replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const jaccard = (a, b) => {
    const A = new Set(a); const B = new Set(b);
    let inter = 0;
    for (const x of A) if (B.has(x)) inter += 1;
    const uni = A.size + B.size - inter;
    return uni ? inter / uni : 0;
  };
  // A scene-break line rides along on the front of the sentence that follows it,
  // because the splitter has no reason to treat "* * *" as a sentence. Detection
  // is unaffected (normalisation drops the asterisks) but the repair replaces its
  // target by exact string match, so a target carrying the break would rewrite the
  // break away. Measured on live ch.5, whose two blast-door sentences both open a
  // scene. Strip the decoration off the target; the remainder is still an exact
  // substring of the prose, so the replacement lands and the break survives.
  const SCENE_BREAK_LEAD_RX = /^(?:[*#\u00b7\u2022](?:\s*[*#\u00b7\u2022]){0,4}\s*\n+\s*)+/;
  const raw = splitSentencesSafe(String(prose || ''))
    .map((x) => x.trim().replace(SCENE_BREAK_LEAD_RX, '').trim());
  const items = raw.map((text, idx) => {
    // A sentence carrying dialogue is out of scope - a character may repeat a line.
    if (/["\u201c\u201d]/.test(text)) return null;
    const k = norm(text);
    const w = k.split(' ').filter(Boolean);
    return w.length ? { idx, text, k, w } : null;
  });
  const pairs = [];
  const claimed = new Set();
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    if (!a) continue;
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      if (!b || claimed.has(j)) continue;
      if (b.idx - a.idx < R.minSentenceGap) continue;
      let kind = null; let score = 0;
      if (a.k === b.k && a.w.length >= R.exactMinWords) { kind = 'exact'; score = 1; }
      else if (a.w.length >= R.nearMinWords && b.w.length >= R.nearMinWords) {
        const jac = jaccard(a.w, b.w);
        if (jac >= R.nearMinJaccard) { kind = 'near'; score = jac; }
      }
      if (!kind) continue;
      // The LATER sentence is the one that gets rewritten, so each later sentence
      // is claimed once - three copies of one tic produce two repairs, not three.
      claimed.add(j);
      pairs.push({ kind, score: Number(score.toFixed(3)), first: a.text, later: b.text, firstIdx: a.idx, laterIdx: b.idx });
    }
  }
  return pairs;
}

/** True when `candidate` would still repeat `original` under the same rules. */
export function stillRepeats(candidate, original, rules = REPEAT_RULES) {
  const probe = findInChapterRepeats(
    `${original} PLACEHOLDER ONE. PLACEHOLDER TWO. PLACEHOLDER THREE. ${candidate}`,
    rules);
  return probe.some((p) => p.first === String(original).trim() && p.later === String(candidate).trim());
}

// BOOKECHO-2: the chapter-level final passes, callable on ANY prose artifact.
// Live measurement (ch.2–ch.5 re-drafts, 2026-08-02) proved the BOOKECHO-1
// rewrites and the chapter-level dedupers were computed on the critic
// artifact and then DISCARDED — the saved chapter is ProjectStudio's join of
// per-scene acceptedProse (live ch.5 shipped a verbatim duplicated opening in
// scenes 1 and 3 for exactly this reason). Exported so the save path runs
// dedupe + repetition alarm + cross-chapter echo repair on the artifact that
// actually ships. Fail-open throughout: this can never block a chapter.
export async function finalizeChapterProse(prose, project, priorChapterProse = []) {
  let finalProse = String(prose || '');
  if (!finalProse) return finalProse;
  finalProse = dedupeRepeatedSentences(finalProse);
  finalProse = dedupeRepeatedQuotes(finalProse);
  repetitionAlarm(finalProse);

  // BOOKECHO-1: detect cross-chapter echoes, then ONE bounded repair pass that
  // rewrites only the offending sentences. Each replacement applies by exact
  // match and is re-checked against the prior-gram set before it is accepted
  // (fail closed per sentence). The gate itself NEVER blocks a chapter.
  try {
    if (Array.isArray(priorChapterProse) && priorChapterProse.length) {
      const echoDet = buildCrossChapterEchoDetector(priorChapterProse);
      const echoes = echoDet.findEchoSentences(finalProse);
      if (echoes.length) {
        const list = echoes.slice(0, 12);
        const repairPrompt = [
          'You are line-editing a novel chapter. Each numbered sentence below reuses a distinctive phrase from an EARLIER chapter of the same book. Rewrite each sentence with fresh phrasing while preserving its exact meaning, characters, tone, and tense. Do not add new events or details. If a sentence contains quotation marks, keep the dialogue quoted.',
          'Return ONLY the rewritten sentences, one per line, numbered to match. No commentary.',
          '',
          ...list.map((s, i) => `${i + 1}. ${s}`),
        ].join('\n');
        let repairedCount = 0;
        try {
          const echoResult = await invokeLLMWithRetry({
            prompt: repairPrompt,
            model: pickProseModel(project),
            temperature: 0.4,
            max_tokens: 2000,
          });
          const raw = extractTextFromLLMResult(echoResult) || '';
          const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
          for (let i = 0; i < list.length; i += 1) {
            const line = lines.find((l) => l.startsWith(`${i + 1}.`) || l.startsWith(`${i + 1})`));
            if (!line) continue;
            const rewritten = line.replace(/^\d+[.)]\s*/, '').trim();
            if (rewritten.length < 15) continue;
            if (echoDet.echoNorm(rewritten) === echoDet.echoNorm(list[i])) continue;
            if (echoDet.isEchoed(rewritten)) continue;
            if (!finalProse.includes(list[i])) continue;
            finalProse = finalProse.replace(list[i], rewritten);
            repairedCount += 1;
          }
        } catch (echoLLMErr) { /* fail open: echoes ship rather than block */ }
        const remaining = echoDet.findEchoSentences(finalProse).length;
        console.warn(`[BOOKECHO-1] echoSentences=${echoes.length} repaired=${repairedCount} remaining=${remaining}`);
      } else {
        console.log('[BOOKECHO-1] echoSentences=0');
      }
    }
  } catch (echoErr) { /* BOOKECHO-1 never blocks a chapter */ }

  // REPEAT-1: in-chapter near-duplicates, repaired the same way cross-chapter
  // echoes are - one bounded pass, rewrite the LATER sentence only, apply by exact
  // match, re-check before accepting, fail open. Runs AFTER the echo repair so a
  // rewrite cannot reintroduce a repeat the echo pass just created.
  try {
    const repeats = findInChapterRepeats(finalProse);
    if (repeats.length) {
      const echoDet2 = (Array.isArray(priorChapterProse) && priorChapterProse.length)
        ? buildCrossChapterEchoDetector(priorChapterProse) : null;
      const list = repeats.slice(0, 12);
      const repairPrompt = [
        'You are line-editing a novel chapter. Each numbered item below is a sentence that repeats an earlier sentence in the SAME chapter, shown after it for reference. Rewrite ONLY the numbered sentence so it no longer echoes the reference, preserving its exact meaning, characters, tone and tense. Do not add new events or details. Do not make it longer.',
        'Return ONLY the rewritten sentences, one per line, numbered to match. No commentary.',
        '',
        ...list.map((p, i) => `${i + 1}. ${p.later}\n   (echoes: ${p.first})`),
      ].join('\n');
      let repaired = 0;
      try {
        const res = await invokeLLMWithRetry({
          prompt: repairPrompt,
          model: pickProseModel(project),
          temperature: 0.4,
          max_tokens: 2000,
        });
        const raw = extractTextFromLLMResult(res) || '';
        const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
        for (let i = 0; i < list.length; i += 1) {
          const line = lines.find((l) => l.startsWith(`${i + 1}.`) || l.startsWith(`${i + 1})`));
          if (!line) continue;
          const rewritten = line.replace(/^\d+[.)]\s*/, '').trim();
          if (rewritten.length < 8) continue;
          if (rewritten === list[i].later) continue;
          if (stillRepeats(rewritten, list[i].first)) continue;
          if (echoDet2 && echoDet2.isEchoed(rewritten)) continue;
          if (!finalProse.includes(list[i].later)) continue;
          finalProse = finalProse.replace(list[i].later, rewritten);
          repaired += 1;
        }
      } catch (repeatLLMErr) { /* fail open: repeats ship rather than block */ }
      const remaining = findInChapterRepeats(finalProse).length;
      const worst = repeats.slice(0, 3).map((p) => `${p.kind}/${p.score} "${p.later.slice(0, 52)}"`).join(' | ');
      console.warn(`[REPEAT-1] pairs=${repeats.length} repaired=${repaired} remaining=${remaining} | ${worst}`);
    } else {
      console.log('[REPEAT-1] pairs=0');
    }
  } catch (repeatErr) { /* REPEAT-1 never blocks a chapter */ }

  return finalProse;
}

// ARCH-1B: CLOSED-WORLD CHECK (nonfiction). Every proper-noun phrase, month-year date,
// year, and significant number in the prose must exist in the project's evidence
// (research_data + seed + all bible fields). One principle replaces the per-shape regex
// arms race: a fact is in the evidence or it does not ship. Atoms inside verified quotes
// pass automatically (a verbatim quote is a substring of the evidence by definition).
// Violations reuse the existing strip machinery ({ snippet } = the offending sentence).
function closedWorldCheck(prose, project) {
  try {
    if (!prose || !project) return [];
    const normCW = (s) => String(s || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    // EVIDENCE-1: the closed world is the RESEARCH, not the bible. world_md,
    // characters_md, canon_md, mystery_md, outline_md and voice_md are AI-generated
    // downstream of the research and can carry hallucinated atoms; including them
    // whitelisted the exact fabrications this gate exists to catch (proven live: an
    // event appearing nowhere in the research reached a drafted chapter through a
    // bible field, with an invented chronology attached, and every closed-world pass
    // accepted it because the bible was inside the evidence). This is the same rule
    // crossCheckResearchFabrication already applies and documents. research_md — the
    // full research brief, hydrated by foundationStorage — joins the corpus so
    // legitimately researched atoms that the distilled research_data summary omits do
    // not false-positive. seed_concept stays: operator-written, not generated.
    const EV = ' ' + normCW([project.research_data, project.research_md, project.seed_concept].filter(Boolean).join(' ')) + ' ';
    if (EV.trim().length < 200) {
      console.warn(`[CLOSED-WORLD] evidence corpus is ${EV.trim().length} chars (<200) — skipping the check. This chapter was NOT closed-world verified.`);
      return [];
    }
    const MONTHS = 'january february march april may june july august september october november december';
    const STOP = new Set(('the this that these those his her their its it in on at by for no yet but and a an or nor when where while so as if to from with of not never ' + MONTHS + ' monday tuesday wednesday thursday friday saturday sunday').split(' '));
    const inEV = (raw) => {
      let n = normCW(raw).replace(/^(major general|brigadier general|general|colonel|major|captain|lieutenant|reverend|president|governor|mr|mrs|ms|dr|aunt|the|a|an)\s+/, '');
      if (!n || STOP.has(n)) return true;
      if (EV.includes(' ' + n + ' ') || EV.includes(n)) return true;
      const alt = n.endsWith('s') ? n.slice(0, -1) : n + 's';
      return EV.includes(' ' + alt + ' ') || EV.includes(alt);
    };
    const sentences = splitSentencesSafe(prose);
    const out = [];
    const MRE = new RegExp('\\b(' + MONTHS.split(' ').join('|') + ')\\s+(?:\\d{1,2},?\\s+)?(1[6-9]\\d\\d|20\\d\\d)\\b', 'gi');
    for (const s of sentences) {
      const bad = [];
      const pre = /(?:[A-Z][\w.'\u2019-]*)(?:\s+(?:of|the|and|No\.|[A-Z][\w.'\u2019-]*))*/g;
      let m;
      while (!bad.length && (m = pre.exec(s)) !== null) {
        let ph = m[0].trim();
        const isSentInitial = m.index === 0 || /[.!?\u201D"]\s*$/.test(s.slice(0, m.index));
        if (isSentInitial) {
          // GATEFIX-28: a sentence-initial capitalized function word ("When", "But",
          // "For", "If", "While", "In", ...) glues onto the proper noun that follows.
          // Drop leading stopword tokens before checking the phrase against evidence.
          const toks = ph.split(/\s+/);
          while (toks.length && STOP.has(normCW(toks[0]))) toks.shift();
          ph = toks.join(' ');
          if (!ph) continue;
        }
        const words = ph.split(/\s+/).filter((w) => !/^(of|the|and)$/i.test(w));
        if (words.length === 1 && (isSentInitial || STOP.has(normCW(words[0])))) continue;
        if (!inEV(ph)) {
          // EVIDENCE-2: a compound phrase is innocent when every content segment is
          // independently in evidence. The old path split only on "and", so a phrase
          // like a descriptor + researched name + "of" + researched unit failed as a
          // unit and the sentence was flagged — false positives that drive pointless
          // repair cycles and can strip researched people from prose. Compounds now
          // split on connectives, and leading descriptor tokens that the evidence
          // itself contains as ordinary words are stripped before the retest (the
          // closed world doubles as the descriptor lexicon — nothing hardcoded).
          // A phrase with any genuinely-unresearched content segment still flags,
          // and a wholly-unresearched phrase flags exactly as before.
          const segs = ph.split(/\s+(?:and|of|at|in|on|for|the)\s+/i).filter(Boolean);
          const segOk = (seg) => {
            if (inEV(seg)) return true;
            const toks = normCW(seg).split(' ').filter(Boolean);
            while (toks.length > 1 && EV.includes(' ' + toks[0] + ' ')) toks.shift();
            return toks.length > 0 && inEV(toks.join(' '));
          };
          if (!segs.length || !segs.every(segOk)) bad.push(ph);
        }
      }
      MRE.lastIndex = 0;
      while (!bad.length && (m = MRE.exec(s)) !== null) { if (!inEV(m[0])) bad.push(m[0]); }
      const YRE = /\b(1[6-9]\d\d|20\d\d)s?\b/g;
      let ym;
      while (!bad.length && (ym = YRE.exec(s)) !== null) { if (!inEV(ym[1])) bad.push(ym[1]); }
      const NRE = /\b\d{1,3}(?:,\d{3})+\b|\b\d{3,}\b/g;
      let nm;
      while (!bad.length && (nm = NRE.exec(s)) !== null) { if (!/^(1[6-9]\d\d|20\d\d)$/.test(nm[0]) && !inEV(nm[0])) bad.push(nm[0]); }
      if (bad.length) {
        console.warn('[CLOSED-WORLD] atom not in evidence:', bad[0], '— sentence flagged.');
        out.push({ type: 'closed-world', snippet: s.trim() });
      }
    }
    return out;
  } catch (e) {
    // ARCH-1 backstop: an empty return is indistinguishable from 'no fabrication found',
    // so an internal error here reads as a clean chapter. It still returns [] rather than
    // blocking the draft, but it can no longer be silent about it.
    console.error('[CLOSED-WORLD] check threw and found nothing as a result — this chapter was NOT closed-world verified:', e);
    return [];
  }
}

function deterministicSourceCheck(prose, project) {
  // NFCLASS-3: see above — the authority decides, not a raw field equality.
  if (!prose || !project || !isNonfictionProjectAuthority(project)) return [];
  const research = typeof project.research_data === 'string'
    ? project.research_data
    : (project.research_data ? JSON.stringify(project.research_data) : '');
  if (!research || research.length < 50) return [];
  const norm = (s) => (s || '').toLowerCase().replace(/[\u2018\u2019\u2032`]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim();
  const hay = norm(research);
  const inHay = (p) => {
    const q = norm(p);
    if (!q) return true;
    if (hay.includes(q)) return true;
    // singular/plural tolerance on the final word
    const alt = q.endsWith('s') ? q.slice(0, -1) : q + 's';
    return hay.includes(alt);
  };
  const violations = [];
  const seen = new Set();
  const add = (s) => {
    const k = s.toLowerCase().slice(0, 60);
    if (seen.has(k)) return;
    seen.add(k);
    violations.push({ type: 'source', snippet: s.trim().slice(0, 120), detail: 'source/statistic not in research' });
  };
  const sentences = splitSentencesSafe(prose);
  const NOUN = "([Rr]ecords?|[Rr]eports?|[Oo]rders?|[Dd]ispatch(?:es)?|[Dd]ocuments?|[Aa]rchives?|[Aa]nalysis|[Ll]edgers?|[Ll]ogs?|[Ll]ogbooks?|[Cc]orrespondence|[Mm]anifests?|[Rr]egisters?|[Tt]ranscripts?|[Bb]ureau|[Dd]epartments?|[Cc]ommands?|[Dd]ivisions?|[Hh]eadquarters|Army|Navy|[Oo]ffice|[Aa]dministration|[Cc]ommissions?|[Cc]ommittees?|[Dd]eployments?|[Gg]azette|[Tt]elegrams?|[Tt]elegraph|[Nn]ews(?:paper)?|[Jj]ournal|[Hh]erald|[Cc]hronicle|Picayune|Tribune|Times|Post|Examiner|Courier|Sentinel|Statesman|Advocate|Enquirer|Observer|Banner|Star|Sun|Press)";
  const SRC = new RegExp("\\b([A-Z][A-Za-z.&'\u2019-]+(?:\\s+(?:of|the|and|de|du|for|[A-Z][A-Za-z.&'\u2019-]+|\\d{2,4}))*)\\s+(?:[a-z][a-z'\u2019-]+\\s+){0,2}" + NOUN + "\\b", 'g');
  // Lowercase-owner source claims the old check never examined:
  // "the shipping ledgers", "the plantation records", "the court documents"
  const LOWSRC = /\bthe\s+((?:[a-z][a-z-]+\s+){1,2})(records|ledgers|dispatch(?:es)?|documents|logs?|manifests?|registers?|transcripts?)\b/g;
  const FILLER = new Set(['same', 'available', 'historical', 'own', 'other', 'these', 'those', 'existing', 'surviving', 'official', 'public', 'written']);
  const USS = /\bUSS\s+([A-Z][A-Za-z-]+)/g;
  for (const s of sentences) {
    let hit = false;
    let m;
    SRC.lastIndex = 0;
    while ((m = SRC.exec(s)) !== null) {
      const noun = m[2];
      if (/^[A-Z]/.test(noun)) {
        // Proper-name source: the full name must appear in the research.
        const fullName = m[1].replace(/^The\s+/i, '') + ' ' + noun;
        if (!inHay(fullName)) { hit = true; break; }
        continue;
      }
      // Generic source claim: the FULL cited phrase must trace to the research.
      // (Owner-token matching allowed "Galveston shipping ledgers" through because
      // "galveston" appears in any research on this topic.)
      if (!inHay(m[0])) { hit = true; break; }
    }
    if (!hit) {
      LOWSRC.lastIndex = 0;
      while ((m = LOWSRC.exec(s)) !== null) {
        const ownerWords = m[1].trim().split(/\s+/).filter((w) => !FILLER.has(w));
        if (ownerWords.length === 0) continue;
        if (!inHay(ownerWords.join(' ') + ' ' + m[2])) { hit = true; break; }
      }
    }
    if (!hit) {
      USS.lastIndex = 0;
      while ((m = USS.exec(s)) !== null) {
        if (!inHay('uss ' + m[1])) { hit = true; break; }
      }
    }
    if (!hit) {
      // GATEFIX-15: "documented/recorded in <x> records" source claims must trace
      // to the research like any other citation.
      const INSRC = /\b(?:documented|recorded|reported|reflected|confirmed|shown|archived|preserved)\s+in\s+((?:[a-z][a-z-]+\s+){0,3}(?:records|archives|documents|reports|files|deployments|registers|dispatches|correspondence|letters|telegrams|timelines?|logs))\b/g;
      let m5;
      INSRC.lastIndex = 0;
      while ((m5 = INSRC.exec(s)) !== null) {
        if (!inHay(m5[1])) { hit = true; break; }
      }
    }
    if (!hit) {
      const st = s.match(/\b(\d{1,3})\s?(?:%|percent)\b/i);
      if (st) {
        const n = st[1];
        if (!hay.includes(n + '%') && !hay.includes(n + ' percent')) hit = true;
      }
    }
    if (hit) add(s);
  }
  return violations;
}

function stripFabricatedSentences(prose, violations) {
  if (!prose || !Array.isArray(violations) || violations.length === 0) return prose;
  const needles = violations
    .map((v) => (v && v.snippet ? String(v.snippet).toLowerCase().trim() : ''))
    .filter((n) => n.length >= 8)
    .map((n) => n.slice(0, 45));
  if (!needles.length) return prose;
  const sentences = splitSentencesSafe(prose);
  const kept = sentences.filter((s) => {
    const sl = s.toLowerCase();
    return !needles.some((n) => sl.includes(n));
  });
  let out = kept.join('');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
  // Guard: if stripping removed almost everything, keep the original rather than ship a stub.
  return out.length > Math.min(120, prose.length * 0.25) ? out : prose;
}

function parseScenesFromChapter(chapter, providedScenes, isNF) {
  if (Array.isArray(providedScenes) && providedScenes.length) return providedScenes;

  const raw = chapter?.scene_beats_json;

  if (!raw) return [];

  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (isNF) {
      if (Array.isArray(parsed.sections)) return parsed.sections;
      if (Array.isArray(parsed.beats)) return parsed.beats;
      if (Array.isArray(parsed)) return parsed;
      return [];
    }

    if (Array.isArray(parsed.beats)) return parsed.beats;
    if (Array.isArray(parsed.scenes)) return parsed.scenes;
    if (Array.isArray(parsed.sections)) return parsed.sections;
    if (Array.isArray(parsed)) return parsed;

    return [];
  } catch {
    return [];
  }
}

function buildCleanResult(finalProse, generatedScenes = [], repairReports = [], extra = {}) {
  const wordCount = countWords(finalProse);

  return {
    text: finalProse,
    prose: finalProse,
    cleanedText: finalProse,
    finalText: finalProse,
    wordCount,
    totalWords: wordCount,

    overusedWords: [],
    frequencyWarnings: [],
    removals: [],
    repetitionWarnings: [],
    slopWarnings: [],
    modelWarnings: [],

    compositeNames: [],
    foiaFixes: [],
    statFlags: [],

    sceneReports: generatedScenes,
    repairReports,

    ...extra,
  };
}

// BOUNDARYREPAIR-1: how many times the future-boundary repair may iterate while it
// is still strictly reducing the violation count. Fail-closed is unchanged — this
// only stops a converging repair from being abandoned after one pass.
const FUTURE_BOUNDARY_REPAIR_PASSES = 3;

// DEADCHARFIX-1: the deterministic narrative-state audit (dead characters acting,
// unavailable objects, limb contradictions) is an INTEGRITY gate and still fails
// closed. It just gets the same number of attempts as every other repair loop in
// this file instead of a single roll of the dice.
const STATE_CONTRACT_REPAIR_PASSES = 3;

// CHRONOPOLICY-1: beat ORDER is a quality constraint, not an integrity one.
// A mis-ordered beat produces a weaker chapter; it cannot invent a fact. The
// integrity gates (quote binding, dead-character, closed-world facts) still fail
// closed — this one repairs, then reports, then lets the chapter draft.
//
// Live evidence for the change: Ch.2 died on "Marcus unlocks the cabinet with a
// code" (the validator demanded Marcus first ACQUIRE a code) and Ch.5 died on
// "Lena destroys the brass key" one scene after she retrieves it — the key had
// already opened doors back in Ch.2, but this validator only ever sees ONE
// chapter of beats. BOTH returned ZERO repairs: the complaint was unsatisfiable,
// not the beat plan wrong. Under the old policy each cost an entire chapter.
export function applyChronologyPolicy(parsedScenes) {
  try {
    validateRawBeatChronology(parsedScenes);
    return parsedScenes;
  } catch (err) {
    if (!(err.name === 'ChronologyError' || String(err.message).includes('Chronology'))) {
      throw err; // DO NOT catch ReferenceError or TypeError
    }
    console.warn('[CHRONOLOGY-VALIDATOR] Chronology overlaps detected:', err.message);

    const repairResult = repairRawContract(parsedScenes);
    const repairedScenes = repairResult.beats;
    console.log('[CHRONOLOGY-REPAIR] Repaired scenes report:', JSON.stringify(repairResult.repairs, null, 2));

    try {
      validateRawBeatChronology(repairedScenes);
      console.log('[CHRONOLOGY-REPAIR] Repair resolved every chronology complaint.');
    } catch (residualErr) {
      if (!(residualErr.name === 'ChronologyError' || String(residualErr.message).includes('Chronology'))) {
        throw residualErr; // DO NOT swallow ReferenceError or TypeError
      }
      console.warn(
        `[CHRONOLOGY-ADVISORY] Chronology complaint survived repair and was NOT enforced: ` +
        `${residualErr.message} (repairs applied: ${repairResult.repairs.length}). ` +
        `Drafting continues; review the beat order for this chapter.`
      );
    }
    return repairedScenes;
  }
}

export async function generateChapterSceneByScene({
  project,
  chapter,
  scenes,
  previousChapterTail = '',
  rollingContext: externalRollingContext = '',
  previousChapterEnding: externalPreviousChapterEnding = '',
  priorChapterSummaries: suppliedPriorChapterSummaries = [],
  proseModelOverride,
  model: modelOverride,
  includeFullCraft = true,
  revisionFeedback = '',
  onProgress,
  sceneExecutionShadow = null,
  sceneExecutionPromptCanary = null,
  sceneExecutionCanaryTrial = null,
  sceneExecutionAcceptanceRunners = null,
  priorLedger = null,
  priorChapterProse = [],
}) {
  if (!project) throw new Error('Project is required.');
  if (!chapter) throw new Error('Chapter is required.');

  const isAnthology = isAnthologyProject(project);
  const isNF = isNonfictionProject(project) || isNonfictionAnthology(project);
  const chapterNumber = getChapterNumber(chapter);
  const chapterTarget = getChapterTargetWords(project, chapter);
  let parsedScenes = parseScenesFromChapter(chapter, scenes, isNF);
  
  console.log(`[BEAT-PIPELINE] parseScenesFromChapter output: ${parsedScenes.length} scenes.`);

  const parsedJson = typeof chapter?.scene_beats_json === 'string' ? JSON.parse(chapter.scene_beats_json) : (chapter?.scene_beats_json || {});
  if (parsedJson?.pipeline_contract && !isNF) {
    verifySceneProvenance(parsedScenes, parsedJson.pipeline_contract, 'writer-parse');
    verifyContiguousSceneSequence(parsedScenes, parsedJson.pipeline_contract.expected_scene_count, 'writer-parse');
  }

  // Determine expected count to catch silent loss before normalization
  let expectedCount = parsedJson?.pipeline_contract?.expected_scene_count || (scenes ? scenes.length : 0);
  if (!expectedCount && chapter?.scene_beats_json) {
    try {
      const j = typeof chapter.scene_beats_json === 'string' ? JSON.parse(chapter.scene_beats_json) : chapter.scene_beats_json;
      expectedCount = (j.beats || j.scenes || j.sections || (Array.isArray(j) ? j : [])).length;
    } catch (e) {
      // Ignored for expected count
    }
  }

  if (!isNF) {
    parsedScenes = applyChronologyPolicy(parsedScenes);
  }

  const immutableContract = !isNF
    ? createImmutableSceneContract(parsedScenes, { chapterNumber })
    : null;
    
  console.log(`[BEAT-PIPELINE] normalizer-input: ${parsedScenes.length} scenes. Expected: ${expectedCount}`);

  const beatPreflight = normalizeSceneBeatsForDrafting(parsedScenes, {
    isNonfiction: isNF,
    chapterNumber,
    chapterTitle: chapter?.title || '',
    projectTitle: project?.title || '',
  });

  if (expectedCount > 0 && beatPreflight.finalCount < expectedCount) {
    const error = new Error(
      `Chapter ${chapterNumber} scene contract lost data. Expected ${expectedCount} scenes, but pipeline reduced it to ${beatPreflight.finalCount} without proof of merge.`
    );
    error.name = 'NarrativeInvariantError';
    error.code = 'SCENE_LOST_IN_PIPELINE';
    error.narrativeContract = true;
    error.contractFingerprint = immutableContract?.fingerprint || null;
    throw error;
  }

  if (beatPreflight?.changed) {
    if (!isNF) {
      // The fiction normalizer is a detector, not the owner of the accepted
      // scene contract. It may attach diagnostic metadata while preserving
      // every semantic contract field. Verify that preservation directly
      // instead of treating an advisory report as scene loss.
      assertSceneContractUnchanged(immutableContract, beatPreflight.beats, {
        chapterNumber,
      });
      console.warn(
        '[NARRATIVE-CONNECT] Fiction overlap reported with the immutable scene contract intact; drafting the accepted contract unchanged.',
        beatPreflight.report,
        beatPreflight.warnings || []
      );
    } else {
      console.warn('[sceneWriter] Scene beat preflight changed chapter beats:', beatPreflight.report, beatPreflight.warnings || []);
    }
    onProgress?.({
      stage: 'scene_beat_preflight',
      chapterNumber,
      originalCount: beatPreflight.originalCount,
      finalCount: beatPreflight.finalCount,
      merged: beatPreflight.merged,
      reported: beatPreflight.reported,
      report: beatPreflight.report,
    });
  }

  // ARCH2-1: advisory research-coverage report — logs only, never blocks or mutates.
  try {
    const cov = researchCoverageCheck(chapter, project);
    if (cov) console.warn('[COVERAGE] ch' + (chapter?.chapter_number || '?') + ': ' + cov.coverage + '% of ' + cov.total + ' beat atoms in evidence' + (cov.missingCount ? ' — MISSING: ' + cov.missing.join(' | ') : ''));
  } catch (covErr) { /* advisory only — drafting continues regardless */ }

  const normalizedScenes = normalizeSceneSpecs(
    isNF ? (beatPreflight?.beats || parsedScenes) : immutableContract.beats,
    chapterTarget
  );
  if (!isNF) {
    assertSceneContractUnchanged(immutableContract, normalizedScenes, { chapterNumber });
  }

  const sceneExecutionShadowState = prepareSceneExecutionShadowIntegration({
    integration: sceneExecutionShadow,
    immutableSceneContract: immutableContract,
  });
  const sceneExecutionPromptCanaryState = prepareSceneExecutionPromptCanary({
    integration: sceneExecutionPromptCanary,
    shadowState: sceneExecutionShadowState,
    immutableSceneContract: immutableContract,
  });
  const sceneExecutionCanaryTrialState = prepareSceneExecutionCanaryTrial({
    integration: sceneExecutionCanaryTrial,
    promptCanaryState: sceneExecutionPromptCanaryState,
    immutableSceneContract: immutableContract,
    projectId: project?.id,
    chapterId: chapter?.id,
  });

  // DEADGATE-1: flags used to come ONLY from sceneExecutionShadow.flags, and
  // ProjectStudio never passes sceneExecutionShadow — so all six scene-execution gates
  // were not just off, they were unreachable. The project record can declare them now,
  // and whatever the answer is, it gets said out loud once per chapter.
  let flags = resolveSceneExecutionFlags(project, null);
  let snapshot = null;
  if (sceneExecutionShadow && typeof sceneExecutionShadow === 'object' && !Array.isArray(sceneExecutionShadow)) {
    if (Object.prototype.hasOwnProperty.call(sceneExecutionShadow, 'flags')) {
      flags = resolveSceneExecutionFlags(project, sceneExecutionShadow.flags);
    }
    if (Object.prototype.hasOwnProperty.call(sceneExecutionShadow, 'snapshot')) {
      snapshot = sceneExecutionShadow.snapshot;
    }
  }
  reportSceneExecutionGateStatus(flags, `Ch.${chapterNumber}`);

  const sceneExecutionAcceptanceState = prepareSceneExecutionAcceptanceState({
    flags,
    snapshot,
    immutableSceneContract: immutableContract,
    shadowState: sceneExecutionShadowState,
  });

  const model = pickProseModel(project, proseModelOverride || modelOverride);
  const fallbackControls = buildFallbackControls('prose', project);
  const fallbackModel = fallbackControls.fallback_model || pickFallbackModel('prose', project);
  const disableFallbacks = fallbackControls.disable_fallbacks !== false;

  const [relevantResearch, seriesContinuityBlock, volumeContractBlock, authorStyleBlock, continuity, priorChapterSummaries, twistContext] =
    await Promise.all([
      getProjectResearchText(project, chapter),
      getSeriesContinuity(project),
      getVolumeContractBlock(project, chapter),
      getAuthorStyleBlock(project),
      getChapterContinuity(project, chapter, {
        previousChapterTail,
        rollingContext: externalRollingContext,
        previousChapterEnding: externalPreviousChapterEnding,
      }),
      getPriorChapterSummaries(project, chapter, suppliedPriorChapterSummaries),
      getTwistBlock(project, chapter),
    ]);

  const anthologyContext = getAnthologyContext(project, chapter);
  const allProjectChapters = Array.isArray(project?.__chapters) ? project.__chapters : [];

  // DRAFTFIX-1: a draft always starts empty. The UI promises that re-drafting
  // overwrites current content; seeding from the saved chapter made every
  // redraft append onto the prior draft (stacked-drafts bug, proven 2026-07-06).
  let accumulatedProse = '';
  const generatedScenes = [];
  const repairReports = [];
  const sceneExecutionCanaryEvidenceRecords = [];
  let lastScenePrompt = '';
  // LEDGERSCOPE-1: the ledger is BOOK-scoped. `accumulatedProse` above stays
  // chapter-local on purpose (DRAFTFIX-1) - seeding prose caused stacked drafts.
  // The ledger carries no prose, only facts, so it is safe to carry forward and
  // it is the only thing that can stop Ch.4 restoring a hand Ch.3 amputated.
  let runtimeLedger = priorLedger ? cloneLedger(priorLedger) : buildInitialLedger();
  // HOLDER-3 — canonicalise the RUNTIME ledger against this chapter's cast, here,
  // before any scene is drafted or audited.
  //
  // HOLDER-2 did this inside extractSceneLedgerUpdates, which is the WRITE path -
  // it runs after a scene is drafted. The audit that hard-blocks a scene reads
  // `runtimeLedger` directly, so it was still seeing the un-canonicalised fold.
  // Live ch.5 at 85218aec: the fold produced holder "Marcus" (chapters 1-4 never
  // wrote "Marcus Reed"), the prose scanner resolved the same man to the cast name
  // "Marcus Reed", and the audit reported a handover from Marcus to Marcus Reed -
  // one man passing an object to himself, three passes, chapter rejected.
  //
  // The cast for the whole chapter is known right here. Resolve once, up front, so
  // every downstream reader sees the same names the scanner produces.
  {
    const chapterCast = [...new Set(normalizedScenes.flatMap((s) => [
      ...(Array.isArray(s?.characters) ? s.characters : []),
      ...(Array.isArray(s?.characters_present) ? s.characters_present : []),
    ]).filter(Boolean))];
    if (chapterCast.length) {
      const before = JSON.stringify(runtimeLedger.possessions || {});
      runtimeLedger = canonicalizeLedgerNames(runtimeLedger, chapterCast);
      const after = JSON.stringify(runtimeLedger.possessions || {});
      if (before !== after) {
        console.warn(`[HOLDER-3] Ch.${chapterNumber} holder names resolved against the cast: ${before} -> ${after}`);
      } else {
        console.log(`[HOLDER-3] Ch.${chapterNumber} holder names already canonical: ${after}`);
      }

      // HOLDER-4: the chapter's OPENING CONTRACT outranks the inherited ledger.
      // The writer is handed scene 1's entry_state and writes to it; the audit
      // reads the ledger. When they disagree the audit rejects prose that is doing
      // exactly what it was told, and no repair can win. The plan is what the page
      // will say, so the plan sets the opening holder.
      const opening = holdersFromSpecState(normalizedScenes[0], chapterCast);
      for (const [obj, holder] of opening) {
        const current = Object.keys(runtimeLedger.possessions || {}).find((char) =>
          (runtimeLedger.possessions[char] || []).some((held) => {
            const a = String(held).toLowerCase();
            const b = String(obj).toLowerCase();
            return a === b || a.includes(b) || b.includes(a);
          })
        );
        const probe = canonicalizeLedgerNames(
          Object.assign(buildInitialLedger(), { possessions: { [holder]: [obj] } }),
          chapterCast
        );
        const canonHolder = Object.keys(probe.possessions)[0] || holder;
        if (current && current === canonHolder) continue;
        // Keep the ledger's own richer spelling of the object where it has one.
        const spelling = current
          ? (runtimeLedger.possessions[current] || []).find((held) => {
            const a = String(held).toLowerCase();
            const b = String(obj).toLowerCase();
            return a === b || a.includes(b) || b.includes(a);
          }) || obj
          : obj;
        setHolderOfRecord(runtimeLedger, spelling, canonHolder);
        console.warn(
          `[HOLDER-4] Ch.${chapterNumber} opening contract overrides the inherited ledger: ` +
          `"${spelling}" ${current ? `was with ${current}, ` : ''}is with ${canonHolder} per scene 1 entry_state.`
        );
      }
    }
  }
  // KEYLEDGER-1f: the CLOSED tracked-object set comes from the plan (props_present
  // across this chapter's scenes) plus anything the ledger already tracks. It is
  // never derived from prose.
  // KEYLEDGER-2d: the plan set and the ledger-held set can name the same object
  // two ways ("Brass Key" + "key" on the live ch.4 run) - one object, one stream.
  const trackedObjects = dedupeTrackedObjects([...new Set([
    ...trackedObjectsFromSpecs(normalizedScenes),
    ...Object.values(runtimeLedger.possessions || {}).flat().map(String),
  ])].filter((o) => o && o.length > 2 && o.length < 40));
  console.log(`[KEYLEDGER] Ch.${chapterNumber} tracked objects: ${trackedObjects.join(' | ') || '(none)'}`);
  if (priorLedger) {
    console.log(`[NARRATIVE-LEDGER] Ch.${chapterNumber} seeded from prior chapters: ${summarizeLedger(runtimeLedger)}`);
  } else {
    console.log(`[NARRATIVE-LEDGER] Ch.${chapterNumber} starting from an empty ledger (no prior chapter state available).`);
  }

  // Contract-Level Replay Validation using semantic signatures
  const isClean = isCleanMetadata;

  validateSceneContractReplay(normalizedScenes);
  // EVENTLEDGER-1B: the replay gate consults prior_completed_events, but until
  // now that list was born at scene 1 of every chapter knowing nothing about
  // chapters 1..N-1 — which is how a chapter could restage an earlier chapter's
  // scene verbatim-in-function. Seed it from the persisted beat contracts.
  // Anthology stories are standalone: no cross-story seeding.
  const priorChapterEvents = (!isAnthologyProject(project) && Number(chapter?.chapter_number) > 1)
    ? buildPriorChapterEventLedger(allProjectChapters, Number(chapter.chapter_number), { maxChars: 5000 }).events
    : [];
  if (priorChapterEvents.length) {
    console.log('[EVENTLEDGER] Writer seeded with', priorChapterEvents.length, 'completed events from earlier chapters');
  }

  // PRONOUNLOCK-1: canonical pronouns for the cast, declared in the character
  // sheet or inferred from dominant usage in already-drafted chapters. Fail
  // open: an empty canon adds nothing to the prompt.
  let pronounCanonLine = '';
  try {
    const priorTexts = allProjectChapters
      .filter((prior) => Number(prior?.chapter_number) > 0 && Number(prior?.chapter_number) < Number(chapter?.chapter_number))
      .map((prior) => String(prior?.content_md || ''))
      .filter((body) => body.length > 200);
    const castNames = harvestCastNames(project?.characters_md, priorTexts);
    if (castNames.length) {
      const pronounCanon = buildPronounCanon(project, priorTexts, castNames);
      pronounCanonLine = buildPronounCanonLines(pronounCanon.canon);
      if (pronounCanonLine) console.log('[PRONOUNLOCK] Canon for this chapter:', pronounCanonLine);
      if (pronounCanon.unresolved.length) {
        console.warn('[PRONOUNLOCK] Characters with heavy MIXED pronoun usage and no declaration:', pronounCanon.unresolved.map((entry) => `${entry.name} (he ${entry.he} / she ${entry.she})`).join(', '));
      }
    }
  } catch (pronounError) {
    console.warn('[PRONOUNLOCK] Canon build failed (non-fatal):', pronounError?.message || pronounError);
  }

  // CANON-2: canonical roles from the character sheet — the single source of
  // truth. The REDUX draft opened with "Sadie, the ship's navigator" because a
  // contradictory world_md line reached the prompt with equal authority; this
  // line outranks it. Fail open: no declared roles adds nothing.
  let roleCanonLine = '';
  try {
    roleCanonLine = buildRoleCanonLine(project?.characters_md);
    if (roleCanonLine) console.log('[CANON-2] Role canon for this chapter:', roleCanonLine);
  } catch (roleError) {
    console.warn('[CANON-2] Role canon build failed (non-fatal):', roleError?.message || roleError);
  }

  // STYLEBUDGET-1: book-level style spend from prior chapters — exhausted
  // constructions are banned in this chapter's prompt, and a simile budget is
  // stated when earlier chapters run hot. Anthologies are standalone stories:
  // no cross-story style ledger. Fail open.
  let styleBudgetBlock = '';
  try {
    if (!isAnthologyProject(project)) {
      const styleTexts = allProjectChapters
        .filter((prior) => Number(prior?.chapter_number) > 0 && Number(prior?.chapter_number) < Number(chapter?.chapter_number))
        .map((prior) => String(prior?.content_md || ''))
        .filter((body) => body.length > 200);
      if (styleTexts.length) {
        const styleLedger = buildBookStyleLedger(styleTexts);
        styleBudgetBlock = buildStyleBudgetPromptBlock(styleLedger);
        if (styleBudgetBlock) console.log('[STYLEBUDGET] Active for this chapter:', styleBudgetBlock.split('\n').length - 1, 'line(s); simile per1k so far:', styleLedger.simile.per1k);
      }
    }
  } catch (styleError) {
    console.warn('[STYLEBUDGET] Ledger build failed (non-fatal):', styleError?.message || styleError);
  }

  for (let i = 0; i < normalizedScenes.length; i += 1) {
    const spec = normalizedScenes[i];
    const priorScenes = normalizedScenes.slice(0, i);
    const futureScenes = normalizedScenes.slice(i + 1);
    const promptSpec = {
      ...spec,
      // KEYLEDGER-1f: who has what when this scene opens.
      pronoun_canon: pronounCanonLine, // PRONOUNLOCK-1
      role_canon: roleCanonLine, // CANON-2
      style_budget: styleBudgetBlock, // STYLEBUDGET-1
      holders_of_record: Object.entries(runtimeLedger.possessions || {})
        .filter(([, objs]) => Array.isArray(objs) && objs.length)
        .map(([char, objs]) => `${char} has the ${objs.join(' and the ')}`),
      required_events: Array.isArray(spec?.required_events) ? spec.required_events.filter(Boolean).filter(isClean) : [],
      prior_completed_events: [
        ...priorChapterEvents,
        ...priorScenes.flatMap((scene) =>
          Array.isArray(scene?.required_events) ? scene.required_events.filter(Boolean).filter(isClean) : []
        ),
      ],
      prior_exit_states: priorScenes
        .map((scene) => String(scene?.exit_state || '').trim())
        .filter(Boolean).filter(isClean),
      future_reserved_events: futureScenes.flatMap((scene) =>
        Array.isArray(scene?.required_events) ? scene.required_events.filter(Boolean).filter(isClean) : []
      ),
      // EXITSTATE-1: the next scene's entry_state is the independent statement of
      // where the characters must be standing when THIS scene ends. It is the
      // ground truth the exit-state audit checks the scene's ending against.
      next_entry_state: String(normalizedScenes[i + 1]?.entry_state || '').trim(),
      // BEATFIELD-2: the beat schema declares `setting`; there is no `location` property
      // anywhere in it, so this field was permanently empty for every scene of every
      // chapter. The neighbouring lines already hedge (`spec.location || spec.setting`).
      next_location: String(normalizedScenes[i + 1]?.setting || normalizedScenes[i + 1]?.location || '').trim(),
      future_reserved_event_objects: futureScenes.flatMap((scene) =>
        Array.isArray(scene?.required_events) ? scene.required_events.filter(Boolean).filter(isClean).map(ev => ({
          event: ev,
          sceneId: scene.scene_id,
          sceneNumber: scene.scene_number || scene.sceneNumber
        })) : []
      ),
    };
    const isFirst = i === 0;
    const rawSceneTarget = Number(spec.targetWords || Math.floor(chapterTarget / normalizedScenes.length));
    const sceneTarget = Number.isFinite(rawSceneTarget) && rawSceneTarget > 0
      ? Math.max(250, Math.min(2500, Math.round(rawSceneTarget)))
      : Math.max(350, Math.floor(chapterTarget / Math.max(1, normalizedScenes.length)));

    onProgress?.({
      stage: 'scene_start',
      sceneIndex: i,
      sceneNumber: spec.sceneNumber,
      totalScenes: normalizedScenes.length,
      targetWords: sceneTarget,
      model,
    });

    const basePrompt = buildScenePrompt({
      project,
      chapter,
      chapters: allProjectChapters,
      spec: promptSpec,
      accumulatedProse,
      previousChapterTail: isFirst && !isAnthology ? continuity.previousChapterTail : '',
      rollingContext: isAnthology ? '' : continuity.rollingContext,
      previousChapterEnding: isAnthology ? '' : continuity.previousChapterEnding,
      priorChapterSummaries: isFirst && !isAnthology ? priorChapterSummaries : [],
      targetWords: sceneTarget,
      relevantResearch,
      anthologyContext,
      twistContext: filterTwistContextForScene(twistContext, promptSpec),
      seriesContinuityBlock,
      volumeContractBlock,
      authorStyleBlock,
      includeFullCraft,
      revisionFeedback,
      runtimeLedger,
    });
    const promptCanaryResult = applySceneExecutionPromptCanary({
      state: sceneExecutionPromptCanaryState,
      prompt: basePrompt,
      sceneId: spec.scene_id,
    });
    const prompt = promptCanaryResult.prompt;

    const shadowSceneReport = sceneExecutionShadowState.enabled
      ? sceneExecutionShadowState.scene_reports[i]
      : null;
    if (shadowSceneReport) {
      if (shadowSceneReport.scene_id !== spec.scene_id) {
        const error = new Error(
          `Scene execution shadow report mismatch at scene ${i + 1}.`
        );
        error.name = 'NarrativeInvariantError';
        error.code = 'SCENE_EXECUTION_SHADOW_SEQUENCE_MISMATCH';
        error.narrativeContract = true;
        throw error;
      }
      pipelineSnapshot(
        chapter?.id,
        `0-shadow-authority-scene-${i + 1}`,
        shadowSceneReport.projection
      );
      onProgress?.({
        stage: 'scene_execution_shadow',
        sceneIndex: i,
        sceneNumber: spec.sceneNumber,
        sceneId: spec.scene_id,
        totalScenes: normalizedScenes.length,
        packetId: shadowSceneReport.packet_id,
        mode: sceneExecutionShadowState.mode,
      });
    }
    if (promptCanaryResult.applied) {
      pipelineSnapshot(
        chapter?.id,
        `0-prompt-canary-scene-${i + 1}`,
        prompt
      );
      onProgress?.({
        stage: 'scene_execution_prompt_canary',
        sceneIndex: i,
        sceneNumber: spec.sceneNumber,
        sceneId: spec.scene_id,
        totalScenes: normalizedScenes.length,
        packetId: promptCanaryResult.packet_id,
        mode: promptCanaryResult.mode,
      });
    }

    // Capture the prompt sent to the model for diagnostic comparison
    pipelineSnapshot(chapter?.id, `0-prompt-scene-${i + 1}`, prompt);
    lastScenePrompt = prompt;

    // Re-roll on empty prose instead of failing the whole chapter. The local model
    // intermittently returns an empty (or think-only) response on large late-chapter prompts;
    // a single empty return should not discard an otherwise-good chapter. Nudge temperature up
    // slightly each retry to break a deterministic empty.
    let generated = null;
    let sceneProse = '';
    const MAX_EMPTY_REROLLS = 3;
    for (let attempt = 1; attempt <= MAX_EMPTY_REROLLS; attempt++) {
      generated = await generateSceneWithRepair({
        project,
        spec: promptSpec,
        prompt,
        model,
        fallbackModel,
        disableFallbacks,
        targetWords: sceneTarget,
        temperature: (isNF ? 0.55 : 0.72) + (attempt - 1) * 0.05,
        maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
      });
      sceneProse = lightCleanSceneOutput(generated.prose);
      if (sceneProse) break;
      console.warn('[sceneWriter] Scene ' + (spec.sceneNumber || i + 1) + ' returned empty prose (attempt ' + attempt + '/' + MAX_EMPTY_REROLLS + ') — re-rolling.');
    }

    // 0a: Raw LLM output BEFORE any cleaning
    pipelineSnapshot(chapter?.id, `0a-scene-${i + 1}-raw-llm-output`, String(generated?.prose || ''));
    // RHYTHM-1: measured at the RAW output so polish/repair effects are attributable.
    let rawRhythm = null;
    try {
      rawRhythm = measureRhythm(String(generated?.prose || ''));
      console.log(formatRhythmLine(`Ch.${chapterNumber} scene ${i + 1} raw`, rawRhythm).line);
    } catch (rhythmErr) { /* telemetry only - never blocks drafting */ }

    // RHYTHM-2: ONE bounded regeneration when the raw take is severely flat.
    // Measured on the instrumented ch.1 run: the prompt-side restatement alone
    // moved mean sentence length 6.2 -> 6.5 words - the model ignores rhythm
    // instructions it is not held to. This is a REGENERATION of the same scene
    // with the measured numbers quoted, judged deterministically, ties to the
    // original. It never mutates prose (the POLISHFIX lesson) and never runs on
    // nonfiction. Cost: one extra prose call only on severely flat scenes.
    // GESTURE-2: the same ONE-regeneration slot now also fires on severe gesture
    // density (looked/turned/nodded saturation). Never more than one regen per
    // scene; when both severities fire, one regen carries both corrections.
    const regenFlat = !isNF && rawRhythm && isSeverelyFlat(rawRhythm);
    const regenGestural = !isNF && rawRhythm && isSeverelyGestural(rawRhythm);
    if (regenFlat || regenGestural) {
      try {
        const regenInstruction = [
          regenFlat ? buildRhythmRegenInstruction(rawRhythm) : null,
          regenGestural ? buildGestureRegenInstruction(rawRhythm) : null,
        ].filter(Boolean).join('\n\n');
        const regenerated = await generateSceneWithRepair({
          project,
          spec: promptSpec,
          prompt: `${prompt}\n\n${regenInstruction}`,
          model,
          fallbackModel,
          disableFallbacks,
          targetWords: sceneTarget,
          temperature: 0.72,
          maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
        });
        const regenProse = lightCleanSceneOutput(regenerated?.prose || '');
        if (regenProse) {
          const regenRhythm = measureRhythm(String(regenerated.prose || ''));
          const winner = pickBetterTake(rawRhythm, regenRhythm, { flat: regenFlat, gestural: regenGestural });
          const regenTrigger = [regenFlat ? 'flat' : null, regenGestural ? 'gesture' : null].filter(Boolean).join('+');
          console.log(
            `[RHYTHM-2] Ch.${chapterNumber} scene ${i + 1} regen (${regenTrigger}): ` +
            `raw mean=${rawRhythm.meanLen}w run=${rawRhythm.maxShortRun} gest=${rawRhythm.gesturesPer1000.combined}/1k -> ` +
            `regen mean=${regenRhythm.meanLen}w run=${regenRhythm.maxShortRun} gest=${regenRhythm.gesturesPer1000.combined}/1k | keeping ${winner}`
          );
          if (winner === 'candidate') {
            generated = regenerated;
            sceneProse = regenProse;
            pipelineSnapshot(chapter?.id, `0a2-scene-${i + 1}-rhythm-regen-kept`, String(generated?.prose || ''));
          }
        } else {
          console.log(`[RHYTHM-2] Ch.${chapterNumber} scene ${i + 1} regen returned empty - keeping original.`);
        }
      } catch (regenErr) {
        console.warn(`[RHYTHM-2] Ch.${chapterNumber} scene ${i + 1} regen failed - keeping original:`, regenErr?.message || regenErr);
      }
    }
    pipelineSnapshot(chapter?.id, `0b-scene-${i + 1}-after-lightClean`, sceneProse);

    if (!sceneProse) {
      throw new Error('Scene ' + (spec.sceneNumber || i + 1) + ' returned empty prose after ' + MAX_EMPTY_REROLLS + ' attempts.');
    }

    if (!isNF) {
      try {
        assertNarrativeTextClean(sceneProse, { chapterNumber });
      } catch (error) {
        error.sceneId = spec.scene_id || null;
        error.sceneNumber = spec.sceneNumber || i + 1;
        error.narrativeContract = true;
        throw error;
      }
    }

    const duplicateCheck = detectLikelySceneRestart(sceneProse, accumulatedProse, spec, i);
    if (duplicateCheck.duplicate) {
      console.warn(`[sceneWriter] Scene ${spec.sceneNumber || i + 1} looked like a restart/duplicate — repairing: ${duplicateCheck.reason}`);
      onProgress?.({
        stage: 'duplicate_repair',
        sceneIndex: i,
        sceneNumber: spec.sceneNumber,
        totalScenes: normalizedScenes.length,
        reason: duplicateCheck.reason,
      });

      const repairPrompt = buildDuplicateRepairPrompt({
        originalPrompt: prompt,
        accumulatedProse,
        duplicateProse: sceneProse,
        duplicateReason: duplicateCheck.reason,
        targetWords: sceneTarget,
      });

      const repaired = await generateSceneWithRepair({
        project,
        spec,
        prompt: repairPrompt,
        model,
        fallbackModel,
        disableFallbacks,
        targetWords: sceneTarget,
        temperature: isNF ? 0.5 : 0.62,
        maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
      });

      const repairedProse = lightCleanSceneOutput(repaired.prose);
      const secondCheck = detectLikelySceneRestart(repairedProse, accumulatedProse, spec, i);
      if (repairedProse && !secondCheck.duplicate) {
        sceneProse = repairedProse;
        generated.repaired = true;
        generated.issues = [...(generated.issues || []), `Duplicate/restart repaired: ${duplicateCheck.reason}`];
      } else {
        const duplicateError = new Error(
          `Scene ${spec.scene_id || spec.sceneNumber || i + 1} was rejected: duplicate/restart survived its repair pass (${duplicateCheck.reason}).`
        );
        duplicateError.name = 'NarrativeInvariantError';
        duplicateError.code = 'SCENE_DUPLICATE_UNRESOLVED';
        duplicateError.sceneId = spec.scene_id || null;
        duplicateError.sceneNumber = spec.sceneNumber || i + 1;
        duplicateError.reason = duplicateCheck.reason;
        console.error('[NARRATIVE-CONNECT] Hard-blocking unsafe scene:', duplicateError);
        throw duplicateError;
      }
    }


    if (!isNF) {
      let futureAudit = await auditSceneFutureBoundaries(sceneProse, promptSpec, model);
      if (!futureAudit.ok) {
        if (futureAudit.auditFailed) {
          const auditError = new Error(`Scene ${spec.scene_id || spec.sceneNumber || i + 1} was rejected: future boundary audit failed to execute or returned malformed JSON.`);
          auditError.name = 'NarrativeInvariantError';
          auditError.code = 'SCENE_BOUNDARY_AUDIT_FAILED';
          auditError.sceneId = spec.scene_id || null;
          auditError.sceneNumber = spec.sceneNumber || i + 1;
          throw auditError;
        }

        console.warn(`[SCENE-BOUNDARY-AUDIT] scene=${spec.sceneNumber || i + 1} futureViolations=${futureAudit.violations.length}`);
        futureAudit.violations.forEach((v, vIdx) => {
          console.log(`[SCENE-BOUNDARY-VIOLATION]
scene=${spec.scene_id || spec.sceneNumber || i + 1}
futureScene=${v.sceneId || v.sceneNumber || 'unknown'}
category=${v.category}
futureEvent="${v.event}"
excerpt="${v.excerpt}"
sentenceIndex=${v.sentenceIndex}`);
        });

        onProgress?.({
          stage: 'scene_contract_repair',
          sceneIndex: i,
          sceneNumber: spec.sceneNumber,
          totalScenes: normalizedScenes.length,
          reason: 'Performed future events early: ' + futureAudit.violations.map(v => v.event).join(', ')
        });

        const cleanedPrompt = prompt.replace(/TWIST \/ REVERSAL CONTEXT:[\s\S]*?(?=\n\n(?:NARRATIVE STATE CONTRACT|THIS SCENE|=== SERIES CONTEXT|[A-Z0-9_\s]+:|$))/i, '');
        const repairPrompt = [
          cleanedPrompt,
          buildFutureBoundaryRepairPrompt(sceneProse, promptSpec, futureAudit.violations)
        ].join('\n\n');

        // BOUNDARYREPAIR-1: repair while it is still making progress.
        //
        // This ran exactly ONE pass. Observed live on Ch.2 scene 1: violations went
        // 6 -> 2 in that single pass — clearly converging — and the chapter was then
        // thrown away anyway. Every other gate in this file gets a repair attempt;
        // this one got one shot at a multi-part problem.
        //
        // Fail-closed is NOT relaxed: if violations remain when the loop ends, the
        // same error with the same code is thrown as before. The loop stops early on
        // a STALL (no strict decrease) so a model that cannot fix the remainder is
        // not asked repeatedly for nothing.
        // BOUNDARYPOLICY-2: use every pass, and keep the BEST attempt.
        //
        // The stall-abort below was wrong in practice. Live Ch.3 scene 1 failed on
        // pass 1 with no progress (1 -> 1) and the chapter died; a later identical
        // run repaired the SAME scene 1 -> 0 on its first pass. The repair is a
        // stochastic regeneration, so one unlucky pass is a dice roll, not proof
        // that the complaint is unsatisfiable.
        const originalViolationCount = futureAudit.violations.length;
        let repairedProse = '';
        let bestProse = '';
        let bestCount = originalViolationCount;
        let bestAudit = futureAudit;
        let currentPrompt = repairPrompt;

        for (let repairPass = 1; repairPass <= FUTURE_BOUNDARY_REPAIR_PASSES; repairPass += 1) {
          const repaired = await generateSceneWithRepair({
            project,
            spec,
            prompt: currentPrompt,
            model,
            fallbackModel,
            disableFallbacks,
            targetWords: sceneTarget,
            temperature: 0.48,
            maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
          });

          const passProse = lightCleanSceneOutput(repaired.prose);
          if (!passProse) break;

          const passAudit = await auditSceneFutureBoundaries(passProse, promptSpec, model);

          console.log(`[SCENE-BOUNDARY-REPAIR-RESULT]
pass=${repairPass}/${FUTURE_BOUNDARY_REPAIR_PASSES}
remainingCount=${passAudit.violations.length}
remainingViolations=${JSON.stringify(passAudit.violations.map(v => v.event))}`);

          repairedProse = passProse;
          futureAudit = passAudit;

          // An audit that could not execute tells us nothing; stop asking.
          if (passAudit.auditFailed) break;

          if (passAudit.violations.length < bestCount) {
            bestCount = passAudit.violations.length;
            bestProse = passProse;
            bestAudit = passAudit;
          }

          if (passAudit.ok) break;

          currentPrompt = [
            cleanedPrompt,
            buildFutureBoundaryRepairPrompt(passProse, promptSpec, passAudit.violations)
          ].join('\n\n');
        }

        if (bestAudit.ok && bestProse) {
          sceneProse = bestProse;
          generated.repaired = true;
          generated.issues = [...(generated.issues || []), `Future boundary repaired`];
        } else {
          // BOUNDARYPOLICY-2: performing a later scene's beat early is a STRUCTURE
          // problem, not an integrity one — it cannot invent a fact. Losing the whole
          // chapter over it costs the writer everything and returns nothing to read.
          // Keep the least-violating draft, say so loudly, and carry on.
          if (bestProse && bestCount < originalViolationCount) {
            sceneProse = bestProse;
            generated.repaired = true;
            generated.issues = [...(generated.issues || []), `Future boundary partially repaired (${originalViolationCount} -> ${bestCount})`];
          }
          const survivors = (bestAudit.violations || []).map(v => v.event).join(' | ');
          console.warn(
            `[FUTURE-BOUNDARY-ADVISORY] scene=${spec.scene_id || spec.sceneNumber || i + 1} ` +
            `${bestCount} violation(s) survived ${FUTURE_BOUNDARY_REPAIR_PASSES} repair pass(es) and were NOT enforced. ` +
            `Drafting continues; review this scene against the next one. Survivors: ${survivors}`
          );
        }
      } else {
        // EXITSTATE-1: this line used to claim the exit state had been checked.
        // It was a label for a check that does not exist. The only test here is
        // auditSceneFutureBoundaries - "did this scene perform a LATER scene's
        // required_event" - so the else branch means exactly one thing: no future
        // events were performed. It never looked at the exit state. The ch.5
        // scene that walked out of the station and onto the ice printed this
        // line. Report what was actually checked.
        console.log(`[SCENE-BOUNDARY-AUDIT] scene=${spec.sceneNumber || i + 1} futureViolations=0`);
      }

      // EXITSTATE-1 — did the scene STOP where the contract says it stops?
      // Separate question, separate audit. Structure problem, not an integrity
      // one, so it follows BOUNDARYPOLICY-2: repair, keep the best draft, and go
      // loud rather than losing the chapter.
      if (String(promptSpec.exit_state || '').trim()) {
        let exitAudit = await auditSceneExitOvershoot(sceneProse, promptSpec, model);
        if (exitAudit.auditFailed) {
          console.warn(
            `[EXITSTATE-1] scene=${spec.scene_id || spec.sceneNumber || i + 1} audit could not execute; ` +
            `skipping the exit-state check for this scene.`
          );
        } else if (exitAudit.ok) {
          console.log(`[EXITSTATE-1] scene=${spec.sceneNumber || i + 1} stopsAtExitState=true`);
        } else {
          const originalExitCount = exitAudit.violations.length;
          console.warn(
            `[EXITSTATE-1] scene=${spec.scene_id || spec.sceneNumber || i + 1} ` +
            `overshoot=${originalExitCount}`
          );
          exitAudit.violations.forEach((v) => {
            console.log(`[EXITSTATE-VIOLATION]
scene=${spec.scene_id || spec.sceneNumber || i + 1}
exit_state=${promptSpec.exit_state}
next_entry_state=${promptSpec.next_entry_state || '(none - last scene)'}
reason=${v.reason || '(none given)'}
excerpt=${JSON.stringify(v.excerpt)}`);
          });

          let bestExitProse = sceneProse;
          let bestExitCount = originalExitCount;
          let bestExitOk = false;
          const exitBasePrompt = prompt.replace(/TWIST \/ REVERSAL CONTEXT:[\s\S]*?(?=\n\n(?:NARRATIVE STATE CONTRACT|THIS SCENE|=== SERIES CONTEXT|[A-Z0-9_\s]+:|$))/i, '');
          let exitPrompt = [
            exitBasePrompt,
            buildExitOvershootRepairPrompt(sceneProse, promptSpec, exitAudit.violations),
          ].join('\n\n');

          for (let exitPass = 1; exitPass <= FUTURE_BOUNDARY_REPAIR_PASSES; exitPass += 1) {
            const repairedExit = await generateSceneWithRepair({
              project,
              spec,
              prompt: exitPrompt,
              model,
              fallbackModel,
              disableFallbacks,
              targetWords: sceneTarget,
              temperature: 0.48,
              maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
            });
            const passProse = lightCleanSceneOutput(repairedExit.prose);
            if (!passProse || !passProse.trim()) break;

            const passAudit = await auditSceneExitOvershoot(passProse, promptSpec, model);
            console.log(`[EXITSTATE-REPAIR-RESULT]
pass=${exitPass}/${FUTURE_BOUNDARY_REPAIR_PASSES}
remainingCount=${passAudit.violations.length}
remaining=${JSON.stringify((passAudit.violations || []).map((v) => v.excerpt.slice(0, 120)))}`);

            if (passAudit.auditFailed) break;

            if (passAudit.violations.length < bestExitCount) {
              bestExitCount = passAudit.violations.length;
              bestExitProse = passProse;
            }
            if (passAudit.ok) {
              bestExitProse = passProse;
              bestExitCount = 0;
              bestExitOk = true;
              break;
            }
            // EXITSTATE-2: stop when a pass makes it WORSE. Measured on the live
            // ch.5 run: scene 1 went 1 -> 3 -> 6 -> 8 and scene 2 went 6 -> 6 ->
            // 5 -> 8 across three passes. Each regeneration writes a NEW ending,
            // so the audit is judging a moving target; asking again after the
            // count has grown spends a 60-second call to make the draft worse.
            // The best-so-far draft is already retained, so stopping costs nothing.
            if (passAudit.violations.length > bestExitCount) {
              console.warn(
                `[EXITSTATE-2] scene=${spec.scene_id || spec.sceneNumber || i + 1} repair diverged ` +
                `(${bestExitCount} -> ${passAudit.violations.length}); keeping the best draft and stopping.`
              );
              break;
            }

            exitPrompt = [
              exitBasePrompt,
              buildExitOvershootRepairPrompt(passProse, promptSpec, passAudit.violations),
            ].join('\n\n');
          }

          if (bestExitCount < originalExitCount && bestExitProse) {
            sceneProse = bestExitProse;
            generated.repaired = true;
            generated.issues = [
              ...(generated.issues || []),
              bestExitOk
                ? 'Exit-state overshoot repaired'
                : `Exit-state overshoot partially repaired (${originalExitCount} -> ${bestExitCount})`,
            ];
          }

          if (!bestExitOk) {
            console.warn(
              `[EXITSTATE-ADVISORY] scene=${spec.scene_id || spec.sceneNumber || i + 1} ` +
              `${bestExitCount} overshoot(s) survived ${FUTURE_BOUNDARY_REPAIR_PASSES} repair pass(es) ` +
              `and were NOT enforced. Drafting continues; this scene ends past its contracted exit ` +
              `state and the next scene will open somewhere else.`
            );
          }
        }
      }

      // SCENESCOPE-1: advisory telemetry — count threshold-crossing phrasings
      // in the accepted draft. Deterministic, never blocks; gives the next
      // chapter run a measurable number for the unplanned-arrival class.
      {
        const thresholdMatches = sceneProse.match(/\b(?:unlock(?:ed|s)?|swung open|slid open|door (?:gave|opened)|hatch (?:opened|gave)|vault (?:door )?(?:opened|swung)|stepped (?:inside|through|into)|seal broke)\b/gi) || [];
        const authorized = (Array.isArray(promptSpec.required_events) ? promptSpec.required_events : []).join(' ').toLowerCase();
        const authorizedish = /open|unlock|enter|arriv|discover|reveal|breach|inside/.test(authorized);
        console.log(`[SCENESCOPE-1] scene=${spec.sceneNumber || i + 1} thresholdCrossings=${thresholdMatches.length} authorizedByRequiredEvents=${authorizedish}`);
      }

      // PROSE REPLAY AUDIT
      let replayAudit = validateGeneratedSceneReplay(sceneProse, generatedScenes);
      if (!replayAudit.ok) {
        console.warn(`[SCENE-REPLAY-AUDIT] scene=${spec.sceneNumber || i + 1} priorReplayCount=${replayAudit.replays.length}`);
        
        onProgress?.({
          stage: 'scene_contract_repair',
          sceneIndex: i,
          sceneNumber: spec.sceneNumber,
          totalScenes: normalizedScenes.length,
          reason: 'Semantic prose replay: ' + replayAudit.replays.join(', ')
        });

        const repairPrompt = [
          prompt,
          `The scene you generated semantically replays irreversible events from earlier scenes: \n- ${replayAudit.replays.join('\n- ')}\n\nRewrite the scene without replaying these events.`
        ].join('\n\n');

        // REPLAYPOLICY-1: this gate got exactly ONE regeneration, while the
        // future-boundary gate next to it gets three. Live Ch.3/Ch.4 died here
        // repeatedly on a single unlucky pass. Same bounded budget, same keep-best
        // rule as BOUNDARYPOLICY-2.
        const originalReplayCount = replayAudit.replays.length;
        let repaired = null;
        let repairedProse = '';
        let postRepairAudit = replayAudit;
        let bestReplayProse = '';
        let bestReplayCount = originalReplayCount;
        let bestReplayAudit = replayAudit;

        for (let replayPass = 1; replayPass <= FUTURE_BOUNDARY_REPAIR_PASSES; replayPass += 1) {
          repaired = await generateSceneWithRepair({
            project,
            spec,
            prompt: repairPrompt,
            model,
            fallbackModel,
            disableFallbacks,
            targetWords: sceneTarget,
            temperature: 0.48,
            maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
          });

          repairedProse = lightCleanSceneOutput(repaired.prose);
          if (!repairedProse) break;
          postRepairAudit = validateGeneratedSceneReplay(repairedProse, generatedScenes);

          console.log(`[SCENE-REPLAY-REPAIR-RESULT]
pass=${replayPass}/${FUTURE_BOUNDARY_REPAIR_PASSES}
remainingCount=${postRepairAudit.replays.length}
remainingReplays=${JSON.stringify(postRepairAudit.replays)}`);

          if (postRepairAudit.replays.length < bestReplayCount) {
            bestReplayCount = postRepairAudit.replays.length;
            bestReplayProse = repairedProse;
            bestReplayAudit = postRepairAudit;
          }
          if (postRepairAudit.ok) break;
        }

        // CAPTURE REPLAY DIAGNOSTICS FOR ALL MATCHES
        for (const match of replayAudit.detailedMatches) {
          captureReplayDiagnostic({
            chapterId: chapter?.id,
            chapterNumber: chapter?.chapterNumber || spec.chapter_number,
            currentSceneId: spec.scene_id || null,
            currentSceneNumber: spec.sceneNumber || i + 1,
            priorSceneId: match.priorSceneId,
            priorSceneNumber: match.priorSceneNumber,
            currentContract: spec,
            priorContract: match.priorContract,
            currentRawProse: generated.prose,
            currentCleanedProse: sceneProse,
            priorAcceptedProse: match.priorAcceptedProse,
            currentSignatures: replayAudit.currentSignatures,
            priorSignatures: match.priorSignatures,
            allMatchesReturned: replayAudit.replays,
            matchedFunction: match.matchedFunction,
            matchedName: match.matchedName,
            matchedObject: match.matchedObject,
            detectorRule: match.rule,
            repairPrompt,
            repairedRawProse: repaired.prose,
            repairedCleanedProse: repairedProse,
            replayMatchesAfterRepair: postRepairAudit.replays,
            finalResult: postRepairAudit.ok ? 'PASS' : 'FAIL'
          });
        }

        if (bestReplayAudit.ok && bestReplayProse) {
          sceneProse = bestReplayProse;
          generated.repaired = true;
          generated.issues = [...(generated.issues || []), `Semantic replay repaired`];
          replayAudit = bestReplayAudit; // update so it passes
        } else {
          // REPLAYPOLICY-1: re-treading an earlier beat is repetitive writing, not a
          // fabricated fact. Keep the least-repetitive draft and report it.
          if (bestReplayProse && bestReplayCount < originalReplayCount) {
            sceneProse = bestReplayProse;
            generated.repaired = true;
            generated.issues = [...(generated.issues || []), `Semantic replay partially repaired (${originalReplayCount} -> ${bestReplayCount})`];
            replayAudit = bestReplayAudit;
          }
          console.warn(
            `[SCENE-REPLAY-ADVISORY] scene=${spec.scene_id || spec.sceneNumber || i + 1} ` +
            `${bestReplayCount} replay(s) survived ${FUTURE_BOUNDARY_REPAIR_PASSES} repair pass(es) and were NOT enforced. ` +
            `Drafting continues; review this scene for repeated material. Survivors: ${(bestReplayAudit.replays || []).join(' | ')}`
          );
        }
      }

    }

    // KEYLEDGER-1f: the scene cast, with genders inferred from the accumulated book
    // prose — measured stable across all five Brass Meridian saves. When two cast
    // members share a gender, pronoun references drop to low confidence and the
    // possession/condition checks stay silent rather than guess.
    const sceneCastNames = (Array.isArray(promptSpec?.characters_present) && promptSpec.characters_present.length
      ? promptSpec.characters_present
      : (Array.isArray(promptSpec?.characters) ? promptSpec.characters : [])
    ).map((c) => String(c || '').trim()).filter(Boolean);
    const sceneCast = sceneCastNames.length
      ? inferCastGenders(`${accumulatedProse}\n\n${sceneProse}`, sceneCastNames)
      : null;

    if (!isNF) {
      let contractAudit = auditSceneAgainstLedger({
        prose: sceneProse,
        accumulatedProse,
        spec: promptSpec,
        runtimeLedger,
        sceneCast,
      });

      if (!contractAudit.ok) {
        console.warn(
          `[NARRATIVE-CONNECT] Scene ${spec.sceneNumber || i + 1} failed deterministic contract audit; repairing:`,
          contractAudit.report
        );

        onProgress?.({
          stage: 'scene_contract_repair',
          sceneIndex: i,
          sceneNumber: spec.sceneNumber,
          totalScenes: normalizedScenes.length,
          reason: contractAudit.report,
        });

        const contractRepairPrompt = [
          prompt,
          buildSceneContractRepairInstruction(contractAudit),
        ].join('\n\n');

        // DEADCHARFIX-1: this gate STAYS hard — a dead character acting puts
        // something false on the page. But it was given exactly ONE regeneration,
        // the same asymmetry BOUNDARYPOLICY-2 and REPLAYPOLICY-1 fixed elsewhere.
        // Live Ch.4 scene 3: the single repair pass came back carrying non-Latin
        // drift ([LEAK-GUARD] removed 1 non-Latin drift run ... e.g. 精密), so the
        // one and only chance was spent on output that was degraded for an entirely
        // unrelated reason, and a chapter died. Same bounded budget as its
        // neighbours; still fails closed when the budget is spent.
        let repairedContractProse = '';
        let contractRepair = null;

        for (let contractPass = 1; contractPass <= STATE_CONTRACT_REPAIR_PASSES; contractPass += 1) {
          contractRepair = await generateSceneWithRepair({
            project,
            spec: promptSpec,
            prompt: contractRepairPrompt,
            model,
            fallbackModel,
            disableFallbacks,
            targetWords: sceneTarget,
            temperature: 0.48,
            maxTokens: Math.max(3500, Math.min(8000, sceneTarget * 3)),
          });

          repairedContractProse = lightCleanSceneOutput(contractRepair.prose);

          if (!repairedContractProse) {
            console.warn(`[STATE-CONTRACT-REPAIR] pass ${contractPass}/${STATE_CONTRACT_REPAIR_PASSES} produced empty prose.`);
            continue;
          }

          contractAudit = auditSceneAgainstLedger({
            prose: repairedContractProse,
            accumulatedProse,
            spec: promptSpec,
            runtimeLedger,
            sceneCast,
          });

          console.log(
            `[STATE-CONTRACT-REPAIR] pass=${contractPass}/${STATE_CONTRACT_REPAIR_PASSES} ` +
            `resolved=${contractAudit.ok} ${contractAudit.ok ? '' : 'remaining=' + JSON.stringify(contractAudit.report)}`
          );

          if (contractAudit.ok) break;
        }

        if (!repairedContractProse || !contractAudit.ok) {
          const contractError = new Error(
            `Scene ${spec.scene_id || spec.sceneNumber || i + 1} was rejected: deterministic narrative-state violations survived repair (${contractAudit.report || 'empty repaired prose'}).`
          );
          contractError.name = 'NarrativeInvariantError';
          contractError.code = 'SCENE_STATE_CONTRACT_UNRESOLVED';
          contractError.sceneId = spec.scene_id || null;
          contractError.sceneNumber = spec.sceneNumber || i + 1;
          contractError.audit = contractAudit;
          contractError.narrativeContract = true;
          console.error('[NARRATIVE-CONNECT] Hard-blocking state-invalid scene:', contractError);
          throw contractError;
        }

        sceneProse = repairedContractProse;
        generated.repaired = true;
        generated.issues = [
          ...(generated.issues || []),
          'Deterministic scene-state contract repaired',
        ];
      }
    }

    const acceptanceResult = await evaluateSceneExecutionAcceptance({
      flags,
      acceptanceState: sceneExecutionAcceptanceState,
      targetSceneId: spec.scene_id,
      prose: sceneProse,
      runners: sceneExecutionAcceptanceRunners || {},
    });

    if (acceptanceResult.status === 'accepted') {
      if (acceptanceResult.final_prose !== sceneProse) {
        sceneProse = acceptanceResult.final_prose;
        if (acceptanceResult.repair) {
          generated.repaired = true;
          generated.issues = [
            ...(generated.issues || []),
            `Evaluator repaired scene: ${acceptanceResult.repair.replacements[0].issue_code}`
          ];
        }
      }
    }

    const sceneGuard = validateProjectChapterContent({
      project,
      chapter,
      chapters: allProjectChapters,
      content: [accumulatedProse, sceneProse].filter(Boolean).join('\n\n'),
    });
    if (sceneGuard.shouldBlockSave) {
      if (isNF) {
        console.warn(`[SCENE-WRITER][NF-GUARD-WARN v3] Ch.${chapter?.chapter_number || chapter?.chapterNumber || '?'} scene ${spec.sceneNumber || i + 1}: project contamination guard warned but did not block nonfiction draft: ${sceneGuard.report}`);
      } else {
        throw new Error(`Project contamination guard blocked scene ${spec.sceneNumber || i + 1}: ${sceneGuard.report}`);
      }
    }

    const ledgerBefore = JSON.parse(JSON.stringify(runtimeLedger));

    if (!isNF) {
      runtimeLedger = extractSceneLedgerUpdates(runtimeLedger, sceneProse, promptSpec, {
        sceneCast,
        trackedObjects,
      });
      const heldNow = Object.entries(runtimeLedger.possessions || {})
        .map(([char, objs]) => `${char}:${(objs || []).join('/')}`).join(' ');
      console.log(`[KEYLEDGER] Ch.${chapterNumber} scene ${spec.sceneNumber || i + 1} holder of record: ${heldNow || '(none)'}`);
      const objectStateNow = Object.entries(runtimeLedger.objectConditions || {})
        .filter(([, conds]) => (conds || []).length > 0)
        .map(([obj, conds]) => `${obj}:${conds.join('/')}`).join(' ');
      if (objectStateNow) console.log(`[OBJECTSTATE] Ch.${chapterNumber} scene ${spec.sceneNumber || i + 1} object conditions: ${objectStateNow}`);
      console.log(`[NARRATIVE-CONNECT] Updated ledger for scene ${spec.sceneNumber || i + 1}. Dead: ${runtimeLedger.deadCharacters.length}, Unavailable Objects: ${runtimeLedger.unavailableObjects.length}, Completed Events: ${runtimeLedger.completedEvents.length}`);
    }

    const ledgerAfter = JSON.parse(JSON.stringify(runtimeLedger));

    if (promptCanaryResult.applied) {
      const canaryEvidence = collectSceneExecutionCanaryEvidence({
        trialState: sceneExecutionCanaryTrialState,
        promptCanaryResult,
        basePrompt,
        modelPrompt: prompt,
        acceptedProse: sceneProse,
        repaired: generated?.repaired === true,
        issues: Array.isArray(generated?.issues) ? generated.issues : [],
      });
      sceneExecutionCanaryEvidenceRecords.push(canaryEvidence);
      pipelineSnapshot(
        chapter?.id,
        `0e-canary-evidence-scene-${i + 1}`,
        JSON.stringify(canaryEvidence)
      );
      onProgress?.({
        stage: 'scene_execution_canary_evidence',
        sceneIndex: i,
        sceneNumber: spec.sceneNumber,
        sceneId: spec.scene_id,
        totalScenes: normalizedScenes.length,
        trialId: canaryEvidence.trial_id,
        packetId: canaryEvidence.packet_id,
        status: canaryEvidence.status,
      });
    }

    generatedScenes.push({
      sceneId: spec.scene_id || spec.id || null,
      sceneNumber: spec.sceneNumber || i + 1,
      spec: promptSpec,
      originalProse: generated?.prose || '',
      acceptedProse: sceneProse,
      ledgerBefore,
      ledgerAfter,
      // Legacy fields
      prose: sceneProse,
      repaired: generated?.repaired || false,
      issues: generated?.issues || [],
      targetWords: sceneTarget,
      wordCount: countWords(sceneProse),
    });

    repairReports.push({
      sceneNumber: spec.sceneNumber,
      repaired: generated?.repaired || false,
      issues: generated?.issues || [],
    });

    accumulatedProse = [accumulatedProse, sceneProse]
      .filter(Boolean)
      .join('\n\n* * *\n\n');

    onProgress?.({
      stage: 'scene_done',
      sceneIndex: i,
      sceneNumber: spec.sceneNumber,
      totalScenes: normalizedScenes.length,
      words: countWords(sceneProse),
      repaired: generated.repaired,
      issues: generated.issues,
    });
  }

  const sceneExecutionCanaryEvidence = finalizeSceneExecutionCanaryEvidence({
    trialState: sceneExecutionCanaryTrialState,
    evidenceRecords: sceneExecutionCanaryEvidenceRecords,
  });

  pipelineSnapshot(chapter?.id, '0c-accumulated-pre-final-clean', accumulatedProse);
  let finalProse = cleanSceneOutput(accumulatedProse, project);
  if (!isNF) assertNarrativeTextClean(finalProse, { chapterNumber });
  pipelineSnapshot(chapter?.id, '0d-after-final-cleanSceneOutput', finalProse);

  const nameRepair = repairCanonNameDrift(finalProse, { project, chapter, chapters: allProjectChapters });
  if (nameRepair.changed) {
    console.warn('[CANON-NAME-LOCK] Repaired generated chapter names:', nameRepair.repairs);
    finalProse = nameRepair.text;
  }

  const artifactRepair = repairManuscriptArtifacts(finalProse, { project, chapter });
  if (artifactRepair.changed) {
    console.warn('[ARTIFACT-REPAIR] Cleaned generated chapter artifacts:', artifactRepair.changes);
    finalProse = artifactRepair.text;
  }

  const quoteRepair = repairChapterQuotes(finalProse);
  if (quoteRepair.text !== finalProse) {
    console.warn('[QUOTE-REPAIR] Cleaned generated chapter quotes before return:', quoteRepair.fixes);
    finalProse = quoteRepair.text;
  }
  // DIALOGUEFIX-1: heal missing opening quotes BEFORE the dedupers. Orphaned
  // dialogue is invisible to quote-content dedupe until it is properly quoted,
  // and the module previously ran only in polish and pre-export - never here.
  const dmDraft = runDialogueMechanicsPass(finalProse, { stage: 'draft-final' });
  if (dmDraft.text !== finalProse) {
    console.warn('[DIALOGUE-MECHANICS-REPAIR] Draft-time repairs: ' + (dmDraft.repairs?.length || 0) + ' verb-tag, ' + (dmDraft.orphanRepaired || 0) + ' orphan-closer');
    finalProse = dmDraft.text;
  }

  // RENAMEPASS-1: deterministic anthology cross-story name de-collision. USEDNAMES-1 bans other
  // stories' names in the PROMPT, but the model can defy the ban on its strongest associations
  // (e.g. a Latino janitor's wife -> "Maria" even when "Maria" is banned for that story). This
  // runs on the FINISHED prose: any name owned by a DIFFERENT story in the collection (never this
  // story's own) is renamed consistently across every occurrence, gender preserved from nearby
  // pronouns, to a fresh name used by no story. FICTION anthology only; deterministic.
  // SCOPINGFIX-1: never run on a documented-nonfiction anthology. A real recurring name — a
  // researcher who appears across cases, a real person two stories legitimately share — would be
  // renamed to an invented one, which is fabrication. The isNF gate confines this to fiction.
  let anthologyProseNames = [];
  if (isAnthology && !isNF) {
    const renamePass = applyAnthologyNameRenames(finalProse, chapter, allProjectChapters);
    if (renamePass.renames.length) {
      console.warn('[RENAMEPASS-1] De-collided cross-story names: ' + renamePass.renames.map((r) => `${r.from}->${r.to}(${r.count})`).join(', '));
      finalProse = renamePass.prose;
    }
    // NAMEREG-1: register the names this story's FINISHED prose actually uses — including
    // any rename targets just introduced — so later stories ban them at prompt time
    // (variety guard) and de-collide against them at rename time. Computed AFTER the
    // rename pass on purpose. Deterministic, no LLM.
    anthologyProseNames = extractProminentProseNames(finalProse);
    if (anthologyProseNames.length) {
      console.log('[NAMEREG-1] Prose names registered for this story: ' + anthologyProseNames.join(', '));
    }
  }

  // BOOKECHO-2: the final passes now live in finalizeChapterProse so the SAVE
  // path can run them on the artifact that actually ships (see export below).
  // This call keeps the critic/fallback artifact clean; the save path in
  // ProjectStudio passes the prior chapters, so echo repair spends its one
  // LLM call there, not here.
  finalProse = await finalizeChapterProse(finalProse, project, priorChapterProse);

  // Semantic source verification (nonfiction): one MODEL pass over the whole
  // chapter (semanticSourceCheck — previously defined but never wired) catches
  // unquoted invented sources; the deterministic check runs as a second net.
  // Anything stripped is followed by a quote re-balance, because removing a
  // sentence can orphan quotation marks.
  if (isNonfictionProjectAuthority(project)) {
    try {
      let semanticFlags = [];
      try { semanticFlags = await semanticSourceCheck(finalProse, project); } catch (e) { semanticFlags = []; }
      const deterministicFlags = deterministicSourceCheck(finalProse, project);
      const allFlags = [...semanticFlags, ...deterministicFlags];
      if (allFlags.length) {
        console.warn('[SEMANTIC-CHECK] Unsupported sources flagged:', allFlags.map((f) => f.snippet.slice(0, 80)));
        const beforeSem = finalProse;
        finalProse = stripFabricatedSentences(finalProse, allFlags);
        if (finalProse !== beforeSem) {
          console.warn('[SEMANTIC-CHECK] Stripped', allFlags.length, 'unsupported-source sentence(s).');
          const postStripQuotes = repairChapterQuotes(finalProse);
          if (postStripQuotes.text !== finalProse) {
            console.warn('[SEMANTIC-CHECK] Re-balanced quotes after strip:', postStripQuotes.fixes);
            finalProse = postStripQuotes.text;
          }
        }
      }
    } catch (e) { /* semantic pass unavailable — ship regex-gated prose */ }
  }
  pipelineSnapshot(chapter?.id, '0e-after-sceneWriter-cleanup', finalProse);
  // RHYTHM-1: chapter-level reading on what actually ships from the scene writer.
  try {
    console.log(formatRhythmLine(`Ch.${chapterNumber} final`, measureRhythm(finalProse)).line);
  } catch (rhythmErr) { /* telemetry only */ }

  // ── Exact final line enforcement ──────────────────────────────
  const chapterLabel = `Ch.${chapterNumber}`;
  const requiredFinalLine = extractRequiredFinalLine(lastScenePrompt);
  if (requiredFinalLine !== null) {
    chapter.__requiredFinalLine = requiredFinalLine || null;
  }
  const finalLineResult = enforceExactFinalLine(finalProse, requiredFinalLine, chapterLabel);
  if (finalLineResult.patched) {
    finalProse = finalLineResult.text;
    pipelineSnapshot(chapter?.id, '0f-after-finalLine-enforcement', finalProse);
  }

  const finalGuard = validateProjectChapterContent({
    project,
    chapter,
    chapters: allProjectChapters,
    content: finalProse,
  });
  if (finalGuard.shouldBlockSave) {
    if (isNF) {
      console.warn(`[SCENE-WRITER][NF-FINAL-GUARD-WARN v3] Ch.${chapter?.chapter_number || chapter?.chapterNumber || '?'}: project contamination guard warned but did not block nonfiction chapter return: ${finalGuard.report}`);
    } else {
      const err = new Error(`Project contamination guard blocked generated chapter before return: ${finalGuard.report}`);
      err.projectContentGuard = true;
      err.guard = finalGuard;
      throw err;
    }
  }

  // ── POST-GENERATION SERIES CONTRACT GATE ──────────────────────
  // Validates generated prose against series canon for linked volumes.
  // Non-series projects skip entirely. Standalone/anthology use warning-only mode.
  if (project?.series_bible_id) {
    try {
      let seriesBibleForGate = null;
      try {
        const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
        seriesBibleForGate = bibles?.[0] || null;
      } catch {}

      let entryContract = null;
      let exitContract = null;
      try { entryContract = project.entry_contract_json ? JSON.parse(project.entry_contract_json) : null; } catch {}
      try { exitContract = project.exit_contract_json ? JSON.parse(project.exit_contract_json) : null; } catch {}

      // CHAPCOUNT-1: chapter_target is the canonical field; reading chapter_count
    // first resolved 20 for every project the current Setup screen creates.
    const totalChapters = resolveChapterCount(project, 20);
      const isFinalChapter = chapterNumber >= totalChapters;

      const seriesGateReport = runSeriesContractGate(finalProse, project, seriesBibleForGate, null, {
        entryContract,
        exitContract,
        isFinalChapter,
        isExport: false,
      });

      // Store for debugging
      if (typeof window !== 'undefined') {
        window.__UBS_LAST_SERIES_CONTRACT_REPORT = seriesGateReport;
        console.log('[SERIES-GATE] Post-generation report stored at window.__UBS_LAST_SERIES_CONTRACT_REPORT');
      }

      if (seriesGateReport.summary.blocks > 0 || seriesGateReport.summary.warnings > 0) {
        const flavor = project.series_flavor || 'continuation';
        const logPrefix = `[SERIES-GATE] Ch.${chapterNumber}`;

        for (const r of seriesGateReport.results) {
          if (r.severity === 'BLOCK') {
            console.error(`${logPrefix} BLOCK: ${r.description}`);
          } else if (r.severity === 'WARNING') {
            console.warn(`${logPrefix} WARN: ${r.description}`);
          }
        }

        // For true continuation, blocks are hard errors
        if (flavor === 'continuation' && seriesGateReport.summary.blocks > 0) {
          const blockDescriptions = seriesGateReport.results
            .filter(r => r.severity === 'BLOCK')
            .map(r => r.description)
            .join('; ');
          console.error(`${logPrefix} SERIES CONTRACT VIOLATION: ${blockDescriptions}`);
          // WARNING logged but not thrown — blocking prose generation on heuristic
          // text-match could cause false-positive DOA failures. Instead, the report
          // is stored and the Export gate provides the hard stop.
        }
      }
    } catch (gateErr) {
      console.warn('[SERIES-GATE] Post-generation gate error (non-fatal):', gateErr?.message);
    }
  }

  const totalWords = countWords(finalProse);
  const cleanResult = buildCleanResult(finalProse, generatedScenes, repairReports, {
    sceneBeatPreflight: beatPreflight,
    sceneBeatPreflightReport: beatPreflight?.report || '',
    sourceAudit: isNF ? buildSourceAudit(relevantResearch, project) : null,
    ...(sceneExecutionShadowState.enabled
      ? { sceneExecutionShadow: sceneExecutionShadowState }
      : {}),
    ...(sceneExecutionPromptCanaryState.enabled
      ? { sceneExecutionPromptCanary: sceneExecutionPromptCanaryState }
      : {}),
    ...(sceneExecutionCanaryTrialState.enabled
      ? {
          sceneExecutionCanaryTrial: sceneExecutionCanaryTrialState,
          sceneExecutionCanaryEvidence,
        }
      : {}),
  });

  if (!isAnthology && chapter?.id && finalProse) {
    try {
      onProgress?.({
        stage: 'summary_start',
        chapterNumber,
      });

      await generateAndSaveSummary(chapter.id, finalProse, chapterNumber);

      onProgress?.({
        stage: 'summary_done',
        chapterNumber,
      });
    } catch (error) {
      console.warn('[sceneWriter] Summary save failed:', error);
    }
  }

  return {
    text: finalProse,
    prose: finalProse,
    content: finalProse,
    cleanedText: finalProse,
    finalText: finalProse,

    sceneWordCounts: generatedScenes.map((s) => s.wordCount),
    scenes: generatedScenes,
    generatedScenes,
    repairReports,

    // LEDGERSCOPE-1: hand the ledger back. Before this it died with the function
    // and no later chapter could ever see what this one established.
    narrativeLedger: boundLedger(runtimeLedger),

    cleanResult,
    sourceAudit: cleanResult?.sourceAudit || null,

    totalWords,
    wordCount: totalWords,
    words: totalWords,

    anthologyProseNames, // NAMEREG-1

    model,
    actualModelUsed: model,
    drafted_with_model: model,
    fallbackModel: disableFallbacks ? null : fallbackModel,
    disableFallbacks,
    ...(sceneExecutionShadowState.enabled
      ? { sceneExecutionShadow: sceneExecutionShadowState }
      : {}),
    ...(sceneExecutionPromptCanaryState.enabled
      ? { sceneExecutionPromptCanary: sceneExecutionPromptCanaryState }
      : {}),
    ...(sceneExecutionCanaryTrialState.enabled
      ? {
          sceneExecutionCanaryTrial: sceneExecutionCanaryTrialState,
          sceneExecutionCanaryEvidence,
        }
      : {}),
  };
}

export async function generateSingleScene({
  project,
  chapter,
  scene,
  accumulatedProse = '',
  previousChapterTail = '',
  rollingContext = '',
  previousChapterEnding = '',
  priorChapterSummaries = [],
  proseModelOverride,
  model: modelOverride,
  includeFullCraft = true,
}) {
  const chapterTarget = getChapterTargetWords(project, chapter);
  const [spec] = normalizeSceneSpecs([scene], chapterTarget);

  const model = pickProseModel(project, proseModelOverride || modelOverride);
  const fallbackControls = buildFallbackControls('prose', project);
  const fallbackModel = fallbackControls.fallback_model || pickFallbackModel('prose', project);
  const disableFallbacks = fallbackControls.disable_fallbacks !== false;

  const [relevantResearch, seriesContinuityBlock, volumeContractBlock, authorStyleBlock, continuity, loadedPriorChapterSummaries, twistContext] =
    await Promise.all([
      getProjectResearchText(project, chapter),
      getSeriesContinuity(project),
      getVolumeContractBlock(project, chapter),
      getAuthorStyleBlock(project),
      getChapterContinuity(project, chapter, {
        previousChapterTail,
        rollingContext,
        previousChapterEnding,
      }),
      getPriorChapterSummaries(project, chapter, priorChapterSummaries),
      getTwistBlock(project, chapter),
    ]);

  const prompt = buildScenePrompt({
    project,
    chapter,
    spec,
    accumulatedProse,
    previousChapterTail: continuity.previousChapterTail,
    rollingContext: continuity.rollingContext,
    previousChapterEnding: continuity.previousChapterEnding,
    priorChapterSummaries: loadedPriorChapterSummaries,
    targetWords: spec.targetWords,
    relevantResearch,
    anthologyContext: getAnthologyContext(project, chapter),
    twistContext: filterTwistContextForScene(twistContext, spec),
    seriesContinuityBlock,
    volumeContractBlock,
    authorStyleBlock,
    includeFullCraft,
  });

  const generated = await generateSceneWithRepair({
    project,
    spec,
    prompt,
    model,
    fallbackModel,
    disableFallbacks,
    targetWords: spec.targetWords,
    temperature: isNonfictionProject(project) || isNonfictionAnthology(project) ? 0.55 : 0.72,
    maxTokens: Math.max(3500, Math.min(8000, Number(spec.targetWords || 800) * 3)),
  });

  const prose = cleanSceneOutput(generated.prose, project);  // single-scene path: deep clean is appropriate here
  const wordCount = countWords(prose);
  const cleanResult = buildCleanResult(prose, [], [], {
    repaired: generated.repaired,
    issues: generated.issues,
  });

  return {
    text: prose,
    prose,
    content: prose,
    cleanedText: prose,
    finalText: prose,

    repaired: generated.repaired,
    issues: generated.issues,

    cleanResult,

    wordCount,
    totalWords: wordCount,
    words: wordCount,

    model,
    actualModelUsed: model,
    drafted_with_model: model,
    fallbackModel: disableFallbacks ? null : fallbackModel,
    disableFallbacks,
  };
}

export function buildSceneWriterDebugPrompt(args) {
  return buildScenePrompt(args);
}

// Legacy compatibility export.
// ProjectStudio imports this exact name.
export const generateChapterByScenes = generateChapterSceneByScene;

export { auditSceneFutureBoundaries, validateGeneratedSceneReplay };
