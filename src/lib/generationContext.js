/**
 * Narrative generation context — the connective tissue between the stored
 * story bible, chapter plan, beat generator, and scene writer.
 *
 * Foundation fields larger than Base44's inline limit live behind *_url
 * fields. Generation must never use the raw project record directly because
 * those inline fields are intentionally blank. This module resolves the
 * complete foundation, validates the minimum fiction contract, and produces
 * an explicit immutable chapter snapshot for one generation operation.
 */

export const GENERATION_CONTEXT_VERSION = 'narrative-connect-v2';
export const SCENE_EXECUTION_PACKET_VERSION = 'scene-execution-packet-v1';
export const SCENE_EXECUTION_PROMPT_PROJECTION_VERSION = 'scene-execution-prompt-projection-v7';
export const SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION = 'scene-execution-shadow-integration-v1';
export const SCENE_EXECUTION_PROMPT_CANARY_VERSION = 'scene-execution-prompt-canary-v2';
export const SCENE_EXECUTION_CANARY_TRIAL_VERSION = 'scene-execution-canary-trial-v1';
export const SCENE_EXECUTION_CANARY_EVIDENCE_VERSION = 'scene-execution-canary-evidence-v2';
export const SCENE_EXECUTION_LEGACY_EVIDENCE_VERSION = 'scene-execution-legacy-evidence-v1';
export const SCENE_EXECUTION_CANARY_COMPARISON_VERSION = 'scene-execution-canary-comparison-v2';

export const SCENE_CONTEXT_COMPOSER_FEATURE = Object.freeze({
  key: 'scene_context_composer_v1',
  defaultEnabled: false,
});

export const SCENE_EXECUTION_SHADOW_FEATURE = Object.freeze({
  key: 'scene_execution_shadow_v1',
  defaultEnabled: false,
});

export const SCENE_EXECUTION_PROMPT_CANARY_FEATURE = Object.freeze({
  key: 'scene_execution_prompt_canary_v2',
  defaultEnabled: false,
});

export const SCENE_EXECUTION_CANARY_TRIAL_FEATURE = Object.freeze({
  key: 'scene_execution_canary_trial_v1',
  defaultEnabled: false,
});

export const SCENE_EXECUTION_CANARY_COMPARISON_FEATURE = Object.freeze({
  key: 'scene_execution_canary_comparison_v2',
  defaultEnabled: false,
});

export const SCENE_EXECUTION_ACCEPTANCE_GATE_VERSION = 'scene-execution-acceptance-gate-v1';
export const EXPECTED_SNAPSHOT_VERSION = 'narrative-connect-v2';
export const EXPECTED_SCENE_CONTRACT_VERSION = 'fiction-scene-contract-v2';

export const SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE = Object.freeze({
  key: 'scene_execution_acceptance_gate_v1',
  defaultEnabled: false,
});

export function isSceneContextComposerEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(flags, SCENE_CONTEXT_COMPOSER_FEATURE.key);
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

export function isSceneExecutionShadowEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(flags, SCENE_EXECUTION_SHADOW_FEATURE.key);
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_EXECUTION_SHADOW_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

export function isSceneExecutionPromptCanaryEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_EXECUTION_PROMPT_CANARY_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_EXECUTION_PROMPT_CANARY_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    flags,
    SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key
  );
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_EXECUTION_PROMPT_CANARY_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

export function isSceneExecutionCanaryTrialEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_EXECUTION_CANARY_TRIAL_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_EXECUTION_CANARY_TRIAL_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    flags,
    SCENE_EXECUTION_CANARY_TRIAL_FEATURE.key
  );
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_EXECUTION_CANARY_TRIAL_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

export function isSceneExecutionCanaryComparisonEnabled(flags) {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    flags,
    SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.key
  );
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

export function getSceneExecutionAcceptanceGateDecision(flags) {
  try {
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return 'disabled';
    const proto = Object.getPrototypeOf(flags);
    if (proto !== Object.prototype && proto !== null) return 'disabled';

    const descriptor = Object.getOwnPropertyDescriptor(
      flags,
      SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE.key
    );
    if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
      return 'disabled';
    }
    if (descriptor.value !== true) return 'disabled';

    if (
      !isSceneContextComposerEnabled(flags) ||
      !isSceneExecutionShadowEnabled(flags) ||
      !isSceneExecutionPromptCanaryEnabled(flags) ||
      !isSceneExecutionCanaryTrialEnabled(flags) ||
      !isSceneExecutionCanaryComparisonEnabled(flags)
    ) {
      return 'prerequisite_disabled';
    }

    return 'enabled';
  } catch {
    return 'disabled';
  }
}

export function isSceneExecutionAcceptanceGateEnabled(flags) {
  return getSceneExecutionAcceptanceGateDecision(flags) === 'enabled';
}

export const FOUNDATION_FIELDS = Object.freeze([
  'world_md',
  'characters_md',
  'outline_md',
  'canon_md',
  'voice_md',
  'mystery_md',
  'twists_md',
  'research_md',
]);

export const REQUIRED_FICTION_FOUNDATION_FIELDS = Object.freeze([
  'world_md',
  'characters_md',
  'outline_md',
  'canon_md',
]);

export class GenerationContextError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GenerationContextError';
    this.code = details.code || 'UNKNOWN_ERROR';
    this.details = details;
  }
}

export class NarrativeInvariantError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'NarrativeInvariantError';
    this.code = details.code || 'UNKNOWN_INVARIANT_ERROR';
    Object.assign(this, details);
  }
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function sceneBeatsFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.beats)) return value.beats;
  return [];
}

function stableContractJson(beats = []) {
  return JSON.stringify(beats.map((beat = {}) => ({
    scene_number: Number(beat.scene_number ?? beat.sceneNumber ?? 0),
    scene_id: text(beat.scene_id),
    scene_goal: text(beat.scene_goal),
    entry_state: text(beat.entry_state),
    required_events: (Array.isArray(beat.required_events) ? beat.required_events : []).map(text).filter(Boolean),
    forbidden_events: (Array.isArray(beat.forbidden_events) ? beat.forbidden_events : []).map(text).filter(Boolean),
    exit_state: text(beat.exit_state),
    continuity_dependencies: (Array.isArray(beat.continuity_dependencies) ? beat.continuity_dependencies : []).map(text).filter(Boolean),
  })));
}

function hashText(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export const NARRATIVE_META_LEAK_PATTERNS = Object.freeze([
  /\b(?:in|from|during|since|after|before)\s+(?:the\s+)?(?:previous|next|following|preceding)\s+chapter\b/gi,
  /\b(?:in|from|during|since|after|before)\s+Chapter\s+\d+\b/g,
  /\b(?:the\s+)?previous\s+chapter\b/gi,
  /\b(?:the\s+)?next\s+chapter\b/gi,
  /\b(?:scene\s+(?:id|number|contract|beat)|chapter\s+(?:contract|beat))\b/gi,
]);

export function findNarrativeMetaLeaks(value = '') {
  const source = String(value || '');
  const matches = [];
  for (const pattern of NARRATIVE_META_LEAK_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      matches.push({
        phrase: match[0],
        index: match.index,
        snippet: source.slice(Math.max(0, match.index - 45), Math.min(source.length, match.index + match[0].length + 45)),
      });
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
  return matches;
}

export function assertNarrativeTextClean(value, options = {}) {
  const matches = findNarrativeMetaLeaks(value);
  if (!matches.length) return Object.freeze({ ok: true, matches: Object.freeze([]) });

  throw new GenerationContextError(
    `Narrative output rejected for Chapter ${options.chapterNumber || '?'}: manuscript prose contains planning-language leakage (${matches.slice(0, 3).map((item) => `"${item.phrase}"`).join(', ')}).`,
    {
      code: 'NARRATIVE_META_LEAK',
      chapterNumber: options.chapterNumber || null,
      matches,
      narrativeContract: true,
    }
  );
}

function isStandaloneFiction(project = {}) {
  const projectType = String(project.project_type || '').toLowerCase();
  const bookType = String(project.book_type || 'fiction').toLowerCase();
  return bookType !== 'nonfiction' && projectType !== 'anthology';
}

function requiredFieldsFor(project = {}, override) {
  if (Array.isArray(override)) return override;
  return isStandaloneFiction(project) ? [...REQUIRED_FICTION_FOUNDATION_FIELDS] : [];
}

async function defaultFoundationResolver(project) {
  const module = await import('@/lib/foundationStorage');
  return module.resolveAllFoundationFields(project);
}

export function assertGenerationFoundationReady(project = {}, options = {}) {
  const requiredFields = requiredFieldsFor(project, options.requiredFields);
  const missingFields = requiredFields.filter((field) => !text(project[field]));

  if (missingFields.length) {
    const unresolvedUrlFields = missingFields.filter((field) => text(project[`${field}_url`]));
    throw new GenerationContextError(
      `Generation blocked: the complete story foundation is unavailable (${missingFields.join(', ')}). Reopen the project or rebuild the Story Bible before drafting.`,
      {
        code: unresolvedUrlFields.length
          ? 'FOUNDATION_URL_RESOLUTION_FAILED'
          : 'FOUNDATION_FIELDS_MISSING',
        missingFields,
        unresolvedUrlFields,
        projectId: project.id || null,
      }
    );
  }

  return {
    ok: true,
    requiredFields,
    missingFields: [],
  };
}

export async function hydrateProjectForGeneration(project = {}, options = {}) {
  if (!project?.id) {
    throw new GenerationContextError('Generation blocked: project identity is missing.', {
      code: 'PROJECT_ID_MISSING',
    });
  }

  const resolver = options.resolveAllFoundationFields || defaultFoundationResolver;
  let resolved = {};

  try {
    resolved = (await resolver(project)) || {};
  } catch (error) {
    throw new GenerationContextError(
      `Generation blocked: the complete story foundation could not be loaded. ${error?.message || error}`,
      {
        code: 'FOUNDATION_RESOLUTION_THREW',
        projectId: project.id,
        cause: error?.message || String(error),
      }
    );
  }

  const hydrated = { ...project };
  const resolvedFields = [];

  for (const field of FOUNDATION_FIELDS) {
    const fullText = text(resolved[field]);
    if (fullText) {
      hydrated[field] = fullText;
      resolvedFields.push(field);
    }
  }

  const validation = assertGenerationFoundationReady(hydrated, options);
  const report = Object.freeze({
    version: GENERATION_CONTEXT_VERSION,
    projectId: project.id,
    resolvedFields: Object.freeze([...resolvedFields]),
    requiredFields: Object.freeze([...validation.requiredFields]),
    sourceUpdatedAt: project.updated_date || project.updated_at || null,
  });

  Object.defineProperty(hydrated, '__generationContext', {
    value: report,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return hydrated;
}

function chapterNumber(chapter) {
  const number = Number(chapter?.chapter_number ?? chapter?.number ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function cloneChapter(chapter) {
  return Object.freeze({ ...(chapter || {}) });
}

export function buildGenerationSnapshot({ project, chapters = [], chapter } = {}) {
  if (!project?.id) {
    throw new GenerationContextError('Cannot create generation snapshot without a project.', {
      code: 'SNAPSHOT_PROJECT_MISSING',
    });
  }

  const orderedChapters = (Array.isArray(chapters) ? chapters : [])
    .filter(Boolean)
    .map(cloneChapter)
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));

  const targetId = chapter?.id || null;
  const targetNumber = chapterNumber(chapter);
  const currentChapter =
    orderedChapters.find((item) => targetId && item.id === targetId) ||
    orderedChapters.find((item) => targetNumber && chapterNumber(item) === targetNumber) ||
    (chapter ? cloneChapter(chapter) : null);

  if (!currentChapter) {
    throw new GenerationContextError('Cannot create generation snapshot: target chapter was not found.', {
      code: 'SNAPSHOT_CHAPTER_MISSING',
      projectId: project.id,
      chapterId: targetId,
      chapterNumber: targetNumber || null,
    });
  }

  const currentNumber = chapterNumber(currentChapter);
  const previousChapter =
    orderedChapters.find((item) => chapterNumber(item) === currentNumber - 1) || null;

  const newestChapterUpdate = orderedChapters
    .map((item) => item.updated_date || item.updated_at || '')
    .sort()
    .at(-1) || '';

  return Object.freeze({
    version: GENERATION_CONTEXT_VERSION,
    snapshotId: [project.id, currentChapter.id || currentNumber, project.updated_date || '', newestChapterUpdate].join(':'),
    project,
    chapters: Object.freeze(orderedChapters),
    chapter: currentChapter,
    previousChapter,
  });
}

export function getSceneGoal(scene) {
  return text(scene?.scene_goal || scene?.goal);
}

export function verifySceneProvenance(actualBeats, pipelineContract, failureStage) {
  if (!pipelineContract || !Array.isArray(pipelineContract.expected_scene_ids)) return;
  const expectedIds = pipelineContract.expected_scene_ids;
  const actualIds = (Array.isArray(actualBeats) ? actualBeats : []).map(b => b?.scene_id || b?.id).filter(Boolean);

  const expectedSet = new Set(expectedIds);
  const actualSet = new Set(actualIds);

  const missing = expectedIds.filter(id => !actualSet.has(id));
  const unexpected = actualIds.filter(id => !expectedSet.has(id));

  if (missing.length > 0) {
    const err = new NarrativeInvariantError(`Scene loss detected at ${failureStage}: Missing ${missing.join(', ')}`, {
      code: 'SCENE_LOST_IN_PIPELINE',
      expectedSceneIds: expectedIds,
      actualSceneIds: actualIds,
      missingSceneIds: missing,
      unexpectedSceneIds: unexpected,
      lastKnownCompleteStage: pipelineContract.source_stage,
      failureStage: failureStage
    });
    throw err;
  }
}

export function validateSceneBeatContracts(value, options = {}) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      throw new GenerationContextError('Scene-beat contract is not valid JSON.', {
        code: 'SCENE_CONTRACT_JSON_INVALID',
        cause: error?.message || String(error),
      });
    }
  }

  const beats = sceneBeatsFrom(parsed);

  if (!beats.length) {
    throw new GenerationContextError('Scene-beat contract contains no scenes.', {
      code: 'SCENE_CONTRACT_EMPTY',
      chapterNumber: options.chapterNumber || null,
    });
  }

  const expectedChapter = Number(options.chapterNumber || 0);
  const expectedPrefix = expectedChapter
    ? `ch${String(expectedChapter).padStart(2, '0')}-s`
    : '';
  const seenIds = new Set();
  const issues = [];

  beats.forEach((beat, index) => {
    const position = index + 1;
    const sceneId = text(beat?.scene_id);
    if (!sceneId) issues.push(`Scene ${position}: scene_id is missing`);
    else {
      if (expectedPrefix && !sceneId.toLowerCase().startsWith(expectedPrefix)) {
        issues.push(`Scene ${position}: scene_id "${sceneId}" does not belong to Chapter ${expectedChapter}`);
      }
      if (seenIds.has(sceneId.toLowerCase())) issues.push(`Scene ${position}: duplicate scene_id "${sceneId}"`);
      seenIds.add(sceneId.toLowerCase());
    }

    const sceneNumber = Number(beat?.scene_number ?? beat?.sceneNumber ?? 0);
    if (sceneNumber !== position) issues.push(`Scene ${position}: scene_number must be ${position}, got ${sceneNumber || 'missing'}`);
    if (expectedPrefix && sceneId.toLowerCase() !== `${expectedPrefix}${String(position).padStart(2, '0')}`) {
      issues.push(`Scene ${position}: scene_id must be ${expectedPrefix}${String(position).padStart(2, '0')}`);
    }

    if (!text(beat?.entry_state)) issues.push(`Scene ${position}: entry_state is missing`);
    if (!text(beat?.exit_state)) issues.push(`Scene ${position}: exit_state is missing`);
    if (!Array.isArray(beat?.required_events) || !beat.required_events.some((event) => text(event))) {
      issues.push(`Scene ${position}: required_events must contain at least one concrete event`);
    }
    if (!Array.isArray(beat?.forbidden_events)) {
      if (beat && typeof beat === 'object') {
        const rawForbidden = text(beat.forbidden_events);
        beat.forbidden_events =
          !rawForbidden || /^(?:none|n\/a|null|no forbidden events?)$/i.test(rawForbidden)
            ? []
            : [rawForbidden];
      } else {
        issues.push(`Scene ${position}: forbidden_events must be an array`);
      }
    }
    if (!text(beat?.scene_goal)) issues.push(`Scene ${position}: scene_goal is missing`);
  });

  if (issues.length) {
    throw new GenerationContextError(
      `Scene-beat contract rejected for Chapter ${expectedChapter || '?'}: ${issues.slice(0, 6).join('; ')}`,
      {
        code: 'SCENE_CONTRACT_INVALID',
        chapterNumber: expectedChapter || null,
        issues,
      }
    );
  }

  return Object.freeze({
    ok: true,
    chapterNumber: expectedChapter || null,
    sceneCount: beats.length,
    sceneIds: Object.freeze(beats.map((beat) => beat.scene_id)),
  });
}

export function createImmutableSceneContract(value, options = {}) {
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      throw new GenerationContextError('Scene-beat contract is not valid JSON.', {
        code: 'SCENE_CONTRACT_JSON_INVALID',
        cause: error?.message || String(error),
      });
    }
  }

  const report = validateSceneBeatContracts(parsed, options);
  // Preserve the complete accepted beat payload for the writer (POV, setting,
  // conflict, emotional arc, etc.). The fingerprint intentionally covers only
  // the semantic contract fields that downstream stages are forbidden to
  // merge, drop, reorder, or rewrite.
  const clonedBeats = JSON.parse(JSON.stringify(sceneBeatsFrom(parsed)));
  const fingerprint = hashText(stableContractJson(clonedBeats));
  return deepFreeze({
    version: 'fiction-scene-contract-v2',
    fingerprint,
    chapterNumber: report.chapterNumber,
    beats: clonedBeats,
  });
}

export function assertSceneContractUnchanged(contract, candidate, options = {}) {
  if (!contract?.fingerprint || !Array.isArray(contract?.beats)) {
    throw new GenerationContextError('Cannot verify scene contract: immutable baseline is missing.', {
      code: 'SCENE_CONTRACT_BASELINE_MISSING',
      narrativeContract: true,
    });
  }

  validateSceneBeatContracts(candidate, {
    chapterNumber: options.chapterNumber || contract.chapterNumber,
  });
  const candidateFingerprint = hashText(stableContractJson(sceneBeatsFrom(candidate)));
  if (candidateFingerprint !== contract.fingerprint) {
    throw new GenerationContextError(
      `Scene contract mutation blocked for Chapter ${options.chapterNumber || contract.chapterNumber || '?'}. A downstream module attempted to merge, drop, reorder, or rewrite an accepted scene.`,
      {
        code: 'SCENE_CONTRACT_MUTATED',
        narrativeContract: true,
        expectedFingerprint: contract.fingerprint,
        actualFingerprint: candidateFingerprint,
        expectedSceneIds: contract.beats.map((beat) => beat.scene_id),
        actualSceneIds: sceneBeatsFrom(candidate).map((beat) => beat?.scene_id),
      }
    );
  }
  return Object.freeze({ ok: true, fingerprint: contract.fingerprint });
}

export async function loadGenerationSnapshot({
  project,
  chapter,
  fetchChapters,
  resolveAllFoundationFields,
  requiredFields,
} = {}) {
  if (typeof fetchChapters !== 'function') {
    throw new GenerationContextError('Generation snapshot requires a chapter loader.', {
      code: 'SNAPSHOT_LOADER_MISSING',
    });
  }

  const [hydratedProject, freshChapters] = await Promise.all([
    hydrateProjectForGeneration(project, {
      resolveAllFoundationFields,
      requiredFields,
    }),
    fetchChapters(),
  ]);

  return buildGenerationSnapshot({
    project: hydratedProject,
    chapters: freshChapters,
    chapter,
  });
}


export function verifyContiguousSceneSequence(beats, expectedCount, stage) {
  const actualNumbers = (Array.isArray(beats) ? beats : []).map(b => Number(b?.scene_number || b?.sceneNumber || 0)).filter(n => n > 0);
  const expectedSequence = Array.from({ length: expectedCount }, (_, i) => i + 1);

  if (JSON.stringify(actualNumbers) !== JSON.stringify(expectedSequence)) {
    const missingSceneNumbers = expectedSequence.filter(n => !actualNumbers.includes(n));
    throw new NarrativeInvariantError(`Scene sequence gap detected at ${stage}: Expected [${expectedSequence.join(', ')}], got [${actualNumbers.join(', ')}]`, {
      code: 'SCENE_SEQUENCE_GAP',
      expectedSequence,
      actualSequence: actualNumbers,
      missingSceneNumbers,
      failureStage: stage
    });
  }
}


export function captureRawArchitectProvenance(beatResult) {
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

    const sId = el?.scene_id || el?.id || '?';
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

  return {
    raw_scene_count: rawCount,
    expected_scene_count: rawCount,
    expected_scene_ids: rawSceneIds,
    expected_scene_numbers: rawSceneNumbers,
    raw_indexes: rawIndexes,
    source_stage: 'architect-raw'
  };
}



// ─── Packet limits ─────────────────────────────────────────────────────
// Conservative model-safe limits for a single scene execution packet.
// Oversized authority fails closed with stable error codes.
export const PACKET_LIMITS = Object.freeze({
  MAX_ARRAY_LENGTH: 50,         // max records/elements per any packet array
  MAX_ID_LENGTH: 128,           // identity and ID string length
  MAX_STATE_ENTRY_LENGTH: 500,  // per-element length for state arrays
  MAX_VOICE_RULE_LENGTH: 300,   // per voice-rule entry
  MAX_FACT_SUMMARY_LENGTH: 1000, // fact summary
  MAX_PROVENANCE_LENGTH: 200,   // provenance reference
  MAX_BASIS_LENGTH: 500,        // knowledge-scope basis
  MAX_CONTINUITY_LENGTH: 2000,  // immediate continuity
  MAX_EVENT_TEXT_LENGTH: 500,    // required event text
  MAX_GOAL_LENGTH: 500,         // scene_goal
  MAX_STATE_LENGTH: 1000,       // entry_state, exit_state
});

// ─── Deterministic event IDs ───────────────────────────────────────────

function requireEventIdString(value, label) {
  if (typeof value !== 'string') {
    throw packetError(
      `generateDeterministicEventId: ${label} must be a string`,
      'INVALID_EVENT_ID_INPUT',
      [`${label} must be a string, got ${value === null ? 'null' : typeof value}`]
    );
  }
  if (value.trim() === '') {
    throw packetError(
      `generateDeterministicEventId: ${label} is empty`,
      'INVALID_EVENT_ID_INPUT',
      [`${label} is empty or whitespace-only`]
    );
  }
}

export function generateDeterministicEventId(projectId, chapterId, sceneId, category, ordinal, eventText) {
  requireEventIdString(projectId, 'projectId');
  requireEventIdString(chapterId, 'chapterId');
  requireEventIdString(sceneId, 'sceneId');
  requireEventIdString(category, 'category');
  requireEventIdString(eventText, 'eventText');
  if (typeof ordinal !== 'number' || !Number.isFinite(ordinal) || !Number.isInteger(ordinal) || ordinal <= 0) {
    throw packetError('generateDeterministicEventId: ordinal must be a finite positive integer', 'INVALID_EVENT_ID_INPUT', [`ordinal must be a finite positive integer, got ${String(ordinal)}`]);
  }
  const normProject = text(projectId);
  const normChapter = text(chapterId);
  const normScene = text(sceneId);
  const normCategory = text(category);
  const normText = text(eventText);
  const input = `${normProject}:${normChapter}:${normScene}:${normCategory}:${ordinal}:${normText}`;
  return `evt_${hashText(input)}`;
}

// ─── Centralized array-index predicate ─────────────────────────────────
// A valid ECMAScript array index is a string key k such that:
//   ToString(ToUint32(k)) === k  AND  ToUint32(k) < 2^32 - 1
// This means the maximum valid array index is 4294967294 (2^32 - 2).
// We additionally require that the index be < arr.length (within bounds).
const MAX_ARRAY_INDEX = 4294967294; // 2^32 - 2

function isCanonicalArrayIndex(k, arrayLength) {
  const n = Number(k);
  if (!Number.isInteger(n) || n < 0 || n > MAX_ARRAY_INDEX) return false;
  if (String(n) !== k) return false; // must be canonical decimal
  if (n >= arrayLength) return false; // must be within bounds
  return true;
}

// ─── Descriptor-safe recursive inspection ──────────────────────────────
// Inspects a value recursively using property descriptors only.
// Never executes getters or setters.
// Rejects symbol-keyed, non-enumerable, accessor, cyclic, class instance,
// Date, function, symbol, BigInt, undefined, non-finite numbers, and sparse arrays.

function descriptorSafeInspect(value, path, seen) {
  if (value === null) return;
  if (typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw packetError(`Non-JSON-safe number at ${path}: ${value}`, 'NON_JSON_SAFE_VALUE', [`${path} contains non-finite number: ${value}`]);
    }
    return;
  }
  if (typeof value === 'undefined') {
    throw packetError(`undefined at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains undefined`]);
  }
  if (typeof value === 'function') {
    throw packetError(`function at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a function`]);
  }
  if (typeof value === 'symbol') {
    throw packetError(`symbol at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a symbol`]);
  }
  if (typeof value === 'bigint') {
    throw packetError(`BigInt at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a BigInt`]);
  }
  if (value instanceof Date) {
    throw packetError(`Date at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a Date object`]);
  }
  if (typeof value !== 'object') {
    throw packetError(`Unexpected type at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains unexpected type: ${typeof value}`]);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
    throw packetError(`Class instance at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a non-plain object (custom prototype)`]);
  }
  if (seen.has(value)) {
    throw packetError(`Cyclic reference at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a cyclic object reference`]);
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const arrLen = value.length;
    // Validate ALL own keys via descriptors: only 'length' and canonical indexes allowed.
    // Uses Reflect.ownKeys to enumerate own descriptors without iterating 0..length-1,
    // so validation cost is proportional to actual own-key count, not attacker-controlled length.
    const arrAllKeys = Reflect.ownKeys(value);
    let ownIndexCount = 0;
    for (const k of arrAllKeys) {
      if (typeof k === 'symbol') {
        throw packetError(`Symbol-keyed property at ${path}`, 'INVALID_PACKET_PROPERTY', [`${path} has a symbol-keyed array property: ${String(k)}`]);
      }
      if (k === 'length') continue; // standard array property
      if (!isCanonicalArrayIndex(k, arrLen)) {
        // Not a valid array index — could be a named property or out-of-bounds index
        const kDesc = Object.getOwnPropertyDescriptor(value, k);
        if (kDesc.get || kDesc.set) {
          throw packetError(`Named accessor on array at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has a named accessor array property: "${k}"`]);
        }
        if (!kDesc.enumerable) {
          throw packetError(`Non-enumerable array property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has a non-enumerable array property: "${k}"`]);
        }
        throw packetError(`Custom array property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has an unsupported custom array property: "${k}"`]);
      }
      // Valid canonical index — inspect its descriptor
      const desc = Object.getOwnPropertyDescriptor(value, k);
      if (desc.get || desc.set) {
        throw packetError(`Accessor at ${path}[${k}]`, 'INVALID_PACKET_PROPERTY', [`${path}[${k}] has an accessor (getter/setter) property`]);
      }
      if (!desc.enumerable) {
        throw packetError(`Non-enumerable index at ${path}[${k}]`, 'INVALID_PACKET_PROPERTY', [`${path}[${k}] has a non-enumerable index descriptor`]);
      }
      descriptorSafeInspect(desc.value, `${path}[${k}]`, seen);
      ownIndexCount++;
    }
    // Density check: every index from 0..length-1 must have an own descriptor.
    // We already validated each own index key, so if the count matches length, it's dense.
    if (ownIndexCount !== arrLen) {
      throw packetError(`Sparse array at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a sparse array (expected ${arrLen} indexes, found ${ownIndexCount})`]);
    }
    seen.delete(value);
    return;
  }

  // Plain object
  const allKeys = Reflect.ownKeys(value);
  for (const k of allKeys) {
    if (typeof k === 'symbol') {
      throw packetError(`Symbol-keyed property at ${path}`, 'INVALID_PACKET_PROPERTY', [`${path} has a symbol-keyed property: ${String(k)}`]);
    }
    const desc = Object.getOwnPropertyDescriptor(value, k);
    if (!desc.enumerable) {
      throw packetError(`Non-enumerable property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has a non-enumerable property: "${k}"`]);
    }
    if (desc.get || desc.set) {
      throw packetError(`Accessor property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has an accessor (getter/setter) property: "${k}"`]);
    }
    descriptorSafeInspect(desc.value, `${path}.${k}`, seen);
  }
  seen.delete(value);
}

// ─── Canonicalization (for fingerprint) ────────────────────────────────
// After descriptorSafeInspect has proven the packet safe, this builds
// a canonical JSON string. At this point we know there are no getters,
// symbols, or hostile values.

function canonicalizeValue(value, path, seen) {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value !== 'object') return value;

  if (seen.has(value)) {
    throw packetError(`Cyclic reference at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a cyclic object reference`]);
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((el, i) => canonicalizeValue(el, `${path}[${i}]`, seen));
    seen.delete(value);
    return result;
  }

  // Use Object.create(null) to prevent __proto__ from altering the prototype
  // and disappearing from the canonical representation.
  const sortedKeys = Object.keys(value).sort();
  const result = Object.create(null);
  for (const k of sortedKeys) {
    result[k] = canonicalizeValue(value[k], `${path}.${k}`, seen);
  }
  seen.delete(value);
  return result;
}

function canonicalizePacketForFingerprint(packet) {
  const copy = Object.create(null);
  for (const k of Object.keys(packet)) {
    if (k === 'packet_id') continue;
    copy[k] = packet[k];
  }
  const canonical = canonicalizeValue(copy, 'packet', new Set());
  return JSON.stringify(canonical);
}

export function generatePacketFingerprint(packet) {
  try {
    // Root type check
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
      throw packetError('Invalid packet', 'INVALID_PACKET', ['Packet must be a non-null plain object']);
    }
    if (packet instanceof Date) {
      throw packetError('Invalid packet: Date', 'INVALID_PACKET', ['Packet root is a Date object']);
    }
    const proto = Object.getPrototypeOf(packet);
    if (proto !== Object.prototype && proto !== null) {
      throw packetError('Invalid packet: class instance', 'INVALID_PACKET', ['Packet root is a non-plain object (custom prototype)']);
    }
    // Full recursive descriptor-safe inspection BEFORE canonicalization.
    // Validate packet_id if present: must be an ordinary, enumerable data
    // property holding a nonempty string.  Absence is valid (generating it)
    // but ONLY when neither the object nor its prototype supplies it.
    const pidDesc = Object.getOwnPropertyDescriptor(packet, 'packet_id');
    if (pidDesc) {
      if (pidDesc.get || pidDesc.set) {
        throw packetError('Accessor on packet.packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id has an accessor (getter/setter) property']);
      }
      if (!pidDesc.enumerable) {
        throw packetError('Non-enumerable packet.packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id is non-enumerable']);
      }
      const pidVal = pidDesc.value;
      if (typeof pidVal !== 'string') {
        const label = pidVal === null ? 'null' : pidVal === undefined ? 'undefined' : typeof pidVal;
        throw packetError('Invalid packet_id type', 'INVALID_PACKET_PROPERTY', [`packet.packet_id must be a string, got ${label}`]);
      }
      if (pidVal.trim() === '') {
        throw packetError('Empty packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id must be a nonempty string after trimming']);
      }
    } else if (proto && Object.getOwnPropertyDescriptor(proto, 'packet_id')) {
      // packet_id is not own but is inherited from prototype — reject without reading packet.packet_id
      throw packetError('Inherited packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id is inherited, not an own property']);
    }
    // Inspect every non-packet_id property via descriptors
    const seen = new Set();
    const allKeys = Reflect.ownKeys(packet);
    for (const k of allKeys) {
      if (typeof k === 'symbol') {
        throw packetError('Symbol-keyed property on packet', 'INVALID_PACKET_PROPERTY', [`packet has a symbol-keyed property: ${String(k)}`]);
      }
      if (k === 'packet_id') continue; // excluded from fingerprint authority
      const desc = Object.getOwnPropertyDescriptor(packet, k);
      if (!desc.enumerable) {
        throw packetError(`Non-enumerable property on packet: ${k}`, 'INVALID_PACKET_PROPERTY', [`packet has a non-enumerable property: "${k}"`]);
      }
      if (desc.get || desc.set) {
        throw packetError(`Accessor property on packet: ${k}`, 'INVALID_PACKET_PROPERTY', [`packet has an accessor (getter/setter) property: "${k}"`]);
      }
      descriptorSafeInspect(desc.value, `packet.${k}`, seen);
    }
    return `sep_${hashText(canonicalizePacketForFingerprint(packet))}`;
  } catch (e) {
    if (e instanceof NarrativeInvariantError) throw e;
    throw packetError('generatePacketFingerprint failed', 'INVALID_PACKET', [e.message || String(e)]);
  }
}

// ─── Packet schema constants ───────────────────────────────────────────

const PROHIBITED_KEYS = new Set([
  'world_md', 'characters_md', 'outline_md', 'canon_md', 'mystery_md', 'twists_md', 'research_md',
  'voice_md', 'story_bible', 'book_outline', 'chapter_collection', 'later_scene_contracts',
  'twist_truth', 'mystery_truth', 'reveal_truth', 'future_truth',
  'withheld_facts', 'private_knowledge',
  'project_records', 'chapter_records', 'prior_chapter_prose', 'accumulated_manuscript', 'prompt_text'
]);

const ALLOWED_PACKET_KEYS = new Set([
  'packet_version', 'packet_id', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'chapter_number', 'scene_id', 'scene_number',
  'scene_goal', 'entry_state', 'required_events', 'current_scene_forbidden_events',
  'future_reserved_events', 'exit_state', 'continuity_dependencies', 'pov_identity',
  'pov_known_facts', 'scene_authorized_facts', 'current_locations', 'current_possessions',
  'current_injuries', 'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'completed_events', 'voice_rules', 'immediate_continuity'
]);

const ALLOWED_FUTURE_EVENT_KEYS = new Set(['event_id']);
const ALLOWED_FACT_KEYS = new Set(['fact_id', 'summary', 'provenance', 'knowledge_scope']);
const ALLOWED_KNOWLEDGE_SCOPE_KEYS = new Set(['pov_identity', 'basis']);
const ALLOWED_REQUIRED_EVENT_KEYS = new Set(['event_id', 'text']);

const REQUIRED_NONEMPTY_STRING_FIELDS = [
  'packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id',
  'scene_goal', 'entry_state', 'exit_state', 'pov_identity'
];
const OPTIONAL_STRING_FIELDS = ['immediate_continuity'];

const STRING_ARRAY_FIELDS = [
  'current_scene_forbidden_events', 'continuity_dependencies',
  'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'voice_rules'
];

const RECORD_ARRAY_FIELDS = ['required_events', 'future_reserved_events', 'scene_authorized_facts'];
const ID_ARRAY_FIELDS = ['completed_events', 'pov_known_facts'];

const SET_LIKE_FIELDS = new Set([
  'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'completed_events', 'pov_known_facts'
]);

function packetError(message, code, issues) {
  return new NarrativeInvariantError(message, { code, issues: Object.freeze(issues || [message]) });
}

function requireString(value, fieldName, allowEmpty) {
  if (typeof value !== 'string') {
    throw packetError(`${fieldName} must be a string`, 'INVALID_FIELD_TYPE', [`${fieldName} must be a string, got ${typeof value}`]);
  }
  if (!allowEmpty && value.trim() === '') {
    throw packetError(`${fieldName} must be nonempty`, 'MISSING_REQUIRED_FIELD', [`${fieldName} is empty or whitespace-only`]);
  }
}

function requireArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw packetError(`${fieldName} must be an array`, 'INVALID_FIELD_TYPE', [`${fieldName} must be an array, got ${value === null ? 'null' : typeof value}`]);
  }
  for (let i = 0; i < value.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, i)) {
      throw packetError(`${fieldName} contains a sparse array`, 'NON_JSON_SAFE_VALUE', [`${fieldName} is a sparse array (missing index ${i})`]);
    }
  }
}

function requireStringArrayElements(arr, fieldName, maxElementLength) {
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    if (typeof el !== 'string') {
      throw packetError(`${fieldName}[${i}] must be a string`, 'INVALID_FIELD_TYPE', [`${fieldName}[${i}] must be a string, got ${el === null ? 'null' : typeof el}`]);
    }
    if (el.trim() === '') {
      throw packetError(`${fieldName}[${i}] must be nonempty`, 'INVALID_FIELD_VALUE', [`${fieldName}[${i}] is empty or whitespace-only`]);
    }
    if (maxElementLength && el.length > maxElementLength) {
      throw packetError(`${fieldName}[${i}] exceeds max length`, 'FIELD_TOO_LARGE', [`${fieldName}[${i}] is ${el.length} chars, max ${maxElementLength}`]);
    }
  }
}

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw packetError(`${fieldName} must be a plain object`, 'INVALID_RECORD', [`${fieldName} must be a non-null plain object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`]);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw packetError(`${fieldName} is a class instance`, 'INVALID_RECORD', [`${fieldName} must be a plain object, got non-plain object (custom prototype)`]);
  }
}

function requirePositiveInteger(value, fieldName) {
  if (typeof value !== 'number') {
    throw packetError(`${fieldName} must be a number`, 'INVALID_FIELD_TYPE', [`${fieldName} must be a number, got ${typeof value}`]);
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw packetError(`${fieldName} must be a finite positive integer`, fieldName === 'chapter_number' ? 'INVALID_CHAPTER_NUMBER' : 'INVALID_SCENE_NUMBER', [`${fieldName} must be a finite positive integer, got ${value}`]);
  }
}

function requireStringLength(value, fieldName, maxLen) {
  if (value.length > maxLen) {
    throw packetError(`${fieldName} exceeds max length`, 'FIELD_TOO_LARGE', [`${fieldName} is ${value.length} chars, max ${maxLen}`]);
  }
}

function requireIdLength(value, fieldName) {
  if (value.length > PACKET_LIMITS.MAX_ID_LENGTH) {
    throw packetError(`${fieldName} exceeds max ID length`, 'FIELD_TOO_LARGE', [`${fieldName} is ${value.length} chars, max ${PACKET_LIMITS.MAX_ID_LENGTH}`]);
  }
}

function requireArrayBound(arr, fieldName) {
  if (arr.length > PACKET_LIMITS.MAX_ARRAY_LENGTH) {
    throw packetError(`${fieldName} exceeds max array length`, 'ARRAY_TOO_LARGE', [`${fieldName} has ${arr.length} elements, max ${PACKET_LIMITS.MAX_ARRAY_LENGTH}`]);
  }
}

function requireSetUnique(arr, fieldName) {
  const seen = new Set();
  for (let i = 0; i < arr.length; i++) {
    const normalized = arr[i].trim();
    if (seen.has(normalized)) {
      throw packetError(`Duplicate entry in ${fieldName}`, 'DUPLICATE_SET_ENTRY', [`${fieldName}[${i}] "${arr[i]}" is a duplicate (after normalization)`]);
    }
    seen.add(normalized);
  }
}

// ─── Descriptor-safe deep-freeze check ─────────────────────────────────
// Uses Reflect.ownKeys and property descriptors. Never executes getters.

function isDeepFrozenSafe(value, seen) {
  if (!value || typeof value !== 'object') return true;
  if (!Object.isFrozen(value)) return false;
  if (seen.has(value)) return true; // cyclic but frozen
  seen.add(value);
  const keys = Reflect.ownKeys(value);
  for (const k of keys) {
    const desc = Object.getOwnPropertyDescriptor(value, k);
    // Accessors are NOT acceptable even on frozen objects
    if (desc.get || desc.set) return false;
    if (!isDeepFrozenSafe(desc.value, seen)) return false;
  }
  return true;
}

// ─── Descriptor-safe contract inspection ───────────────────────────────
// Reads contract authority via property descriptors only. Never invokes
// getters. Validates exact structure types before calling legacy validation.

function contractError(message, issues) {
  return packetError(message, 'SCENE_CONTRACT_NOT_IMMUTABLE', issues);
}

// Recursively inspect a contract value using descriptors only.
// Never invokes getters. Rejects accessors, symbols, non-enumerables, class instances,
// cycles, sparse arrays, custom array properties, and non-JSON-safe values.
function contractDescriptorInspect(value, path, seen) {
  if (value === null) return;
  if (typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw contractError(`Non-finite number at ${path}`, [`${path} contains non-finite number: ${value}`]);
    }
    return;
  }
  if (typeof value === 'undefined') throw contractError(`undefined at ${path}`, [`${path} contains undefined`]);
  if (typeof value === 'function') throw contractError(`function at ${path}`, [`${path} contains a function`]);
  if (typeof value === 'symbol') throw contractError(`symbol at ${path}`, [`${path} contains a symbol`]);
  if (typeof value === 'bigint') throw contractError(`BigInt at ${path}`, [`${path} contains a BigInt`]);
  if (value instanceof Date) throw contractError(`Date at ${path}`, [`${path} contains a Date object`]);
  if (typeof value !== 'object') throw contractError(`Unexpected type at ${path}`, [`${path} contains unexpected type: ${typeof value}`]);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
    throw contractError(`Non-plain object at ${path}`, [`${path} contains a non-plain object (custom prototype)`]);
  }
  if (seen.has(value)) throw contractError(`Cyclic reference at ${path}`, [`${path} contains a cyclic reference`]);
  seen.add(value);

  if (Array.isArray(value)) {
    const arrLen = value.length;
    const arrKeys = Reflect.ownKeys(value);
    let ownIndexCount = 0;
    for (const k of arrKeys) {
      if (typeof k === 'symbol') throw contractError(`Symbol on array at ${path}`, [`${path} has a symbol-keyed array property: ${String(k)}`]);
      if (k === 'length') continue;
      if (!isCanonicalArrayIndex(k, arrLen)) {
        const kDesc = Object.getOwnPropertyDescriptor(value, k);
        if (kDesc.get || kDesc.set) throw contractError(`Named accessor on array at ${path}.${k}`, [`${path} has a named accessor array property: "${k}"`]);
        if (!kDesc.enumerable) throw contractError(`Non-enumerable array property at ${path}.${k}`, [`${path} has a non-enumerable array property: "${k}"`]);
        throw contractError(`Custom array property at ${path}.${k}`, [`${path} has an unsupported custom array property: "${k}"`]);
      }
      const desc = Object.getOwnPropertyDescriptor(value, k);
      if (desc.get || desc.set) throw contractError(`Accessor at ${path}[${k}]`, [`${path}[${k}] has an accessor (getter/setter) property`]);
      if (!desc.enumerable) throw contractError(`Non-enumerable index at ${path}[${k}]`, [`${path}[${k}] has a non-enumerable index`]);
      contractDescriptorInspect(desc.value, `${path}[${k}]`, seen);
      ownIndexCount++;
    }
    if (ownIndexCount !== arrLen) {
      throw contractError(`Sparse array at ${path}`, [`${path} is a sparse array (expected ${arrLen} indexes, found ${ownIndexCount})`]);
    }
    seen.delete(value);
    return;
  }

  const allKeys = Reflect.ownKeys(value);
  for (const k of allKeys) {
    if (typeof k === 'symbol') throw contractError(`Symbol at ${path}`, [`${path} has a symbol-keyed property: ${String(k)}`]);
    const desc = Object.getOwnPropertyDescriptor(value, k);
    if (!desc.enumerable) throw contractError(`Non-enumerable at ${path}.${k}`, [`${path} has a non-enumerable property: "${k}"`]);
    if (desc.get || desc.set) throw contractError(`Accessor at ${path}.${k}`, [`${path} has an accessor (getter/setter) property: "${k}"`]);
    contractDescriptorInspect(desc.value, `${path}.${k}`, seen);
  }
  seen.delete(value);
}

function inspectContractDescriptorSafe(contract) {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) {
    throw contractError('Invalid scene contract', ['Scene contract must be a non-null plain object']);
  }
  if (contract instanceof Date) {
    throw contractError('Invalid scene contract: Date', ['Scene contract is a Date object']);
  }
  const proto = Object.getPrototypeOf(contract);
  if (proto !== Object.prototype && proto !== null) {
    throw contractError('Invalid scene contract: non-plain object', ['Scene contract has a custom prototype (class instance)']);
  }

  // Full recursive descriptor-safe inspection of the entire contract.
  // This catches ALL hostile structures before any value is read.
  contractDescriptorInspect(contract, 'contract', new Set());

  // Deep freeze check (descriptor-safe, rejects accessors)
  if (!isDeepFrozenSafe(contract, new Set())) {
    throw contractError('Scene contract is not deeply frozen', ['The supplied scene contract must be deeply frozen (immutable)']);
  }

  // --- Schema validation using only descriptor values (safe after recursive inspection) ---
  const versionDesc = Object.getOwnPropertyDescriptor(contract, 'version');
  if (!versionDesc || versionDesc.value !== 'fiction-scene-contract-v2') {
    throw contractError('Wrong scene contract version', [`Expected version "fiction-scene-contract-v2", got "${versionDesc?.value}"`]);
  }

  const fpDesc = Object.getOwnPropertyDescriptor(contract, 'fingerprint');
  if (!fpDesc || typeof fpDesc.value !== 'string' || !fpDesc.value) {
    throw contractError('Scene contract missing fingerprint', ['Scene contract fingerprint is missing or not a string']);
  }

  const cnDesc = Object.getOwnPropertyDescriptor(contract, 'chapterNumber');
  if (!cnDesc) {
    throw contractError('Scene contract missing chapterNumber', ['Scene contract chapterNumber is missing']);
  }
  if (typeof cnDesc.value !== 'number' || !Number.isFinite(cnDesc.value) || !Number.isInteger(cnDesc.value) || cnDesc.value <= 0) {
    throw contractError('Scene contract invalid chapterNumber', [`Scene contract chapterNumber must be a finite positive integer, got ${cnDesc.value}`]);
  }

  const beatsDesc = Object.getOwnPropertyDescriptor(contract, 'beats');
  if (!beatsDesc || !Array.isArray(beatsDesc.value)) {
    throw contractError('Scene contract missing beats array', ['Scene contract beats is missing or not an array']);
  }

  const beats = beatsDesc.value;
  for (let i = 0; i < beats.length; i++) {
    const beatDesc = Object.getOwnPropertyDescriptor(beats, i);
    // After recursive inspection, these are guaranteed to be data descriptors,
    // but we verify for defense-in-depth.
    if (!beatDesc || beatDesc.get || beatDesc.set) {
      throw contractError(`Invalid beat descriptor at ${i}`, [`beats[${i}] has an invalid descriptor`]);
    }
    const b = beatDesc.value;
    if (!b || typeof b !== 'object' || Array.isArray(b)) {
      throw contractError(`Scene contract beat ${i} is not a plain object`, [`beats[${i}] is not a valid plain object`]);
    }
    const beatProto = Object.getPrototypeOf(b);
    if (beatProto !== Object.prototype && beatProto !== null) {
      throw contractError(`Scene contract beat ${i} has custom prototype`, [`beats[${i}] has a custom prototype`]);
    }

    // Check beat keys via descriptors (non-enumerable rejection)
    const beatKeys = Reflect.ownKeys(b);
    for (const k of beatKeys) {
      if (typeof k === 'symbol') throw contractError(`Symbol on beat ${i}`, [`beats[${i}] has a symbol-keyed property: ${String(k)}`]);
      const bkDesc = Object.getOwnPropertyDescriptor(b, k);
      if (!bkDesc.enumerable) throw contractError(`Non-enumerable on beat ${i}: ${k}`, [`beats[${i}] has a non-enumerable property: "${k}"`]);
      if (bkDesc.get || bkDesc.set) throw contractError(`Accessor on beat ${i}: ${k}`, [`beats[${i}] has an accessor property: "${k}"`]);
    }

    // Schema: scene_number required as finite positive integer number
    const snDesc = Object.getOwnPropertyDescriptor(b, 'scene_number');
    if (!snDesc) {
      throw contractError(`Scene contract beat ${i} missing scene_number`, [`beats[${i}].scene_number is required`]);
    }
    if (typeof snDesc.value !== 'number') {
      throw contractError(`Scene contract beat ${i} scene_number not a number`, [`beats[${i}].scene_number must be a number, got ${typeof snDesc.value}`]);
    }
    if (!Number.isFinite(snDesc.value) || !Number.isInteger(snDesc.value) || snDesc.value <= 0) {
      throw contractError(`Scene contract beat ${i} invalid scene_number`, [`beats[${i}].scene_number must be a finite positive integer, got ${snDesc.value}`]);
    }

    const sidDesc = Object.getOwnPropertyDescriptor(b, 'scene_id');
    if (!sidDesc || typeof sidDesc.value !== 'string' || sidDesc.value.trim() === '') {
      throw contractError(`Scene contract beat ${i} invalid scene_id`, [`beats[${i}].scene_id is missing, not a string, or empty`]);
    }
    const sgDesc = Object.getOwnPropertyDescriptor(b, 'scene_goal');
    if (!sgDesc || typeof sgDesc.value !== 'string' || sgDesc.value.trim() === '') {
      throw contractError(`Scene contract beat ${i} invalid scene_goal`, [`beats[${i}].scene_goal is missing, not a string, or empty`]);
    }
    const esDesc = Object.getOwnPropertyDescriptor(b, 'entry_state');
    if (!esDesc || typeof esDesc.value !== 'string' || esDesc.value.trim() === '') {
      throw contractError(`Scene contract beat ${i} invalid entry_state`, [`beats[${i}].entry_state is missing, not a string, or empty`]);
    }
    const exDesc = Object.getOwnPropertyDescriptor(b, 'exit_state');
    if (!exDesc || typeof exDesc.value !== 'string' || exDesc.value.trim() === '') {
      throw contractError(`Scene contract beat ${i} invalid exit_state`, [`beats[${i}].exit_state is missing, not a string, or empty`]);
    }

    // required_events: array of nonempty strings, read via descriptors
    const reDesc = Object.getOwnPropertyDescriptor(b, 'required_events');
    if (!reDesc || !Array.isArray(reDesc.value)) {
      throw contractError(`Beat ${i} required_events not array`, [`beats[${i}].required_events is not an array`]);
    }
    for (let j = 0; j < reDesc.value.length; j++) {
      const elDesc = Object.getOwnPropertyDescriptor(reDesc.value, j);
      if (!elDesc || elDesc.get || elDesc.set) throw contractError(`Accessor at beats[${i}].required_events[${j}]`, [`beats[${i}].required_events[${j}] has an invalid descriptor`]);
      if (typeof elDesc.value !== 'string') throw contractError(`Beat ${i} required_events[${j}] not string`, [`beats[${i}].required_events[${j}] must be a string, got ${typeof elDesc.value}`]);
      if (elDesc.value.trim() === '') throw contractError(`Beat ${i} required_events[${j}] empty`, [`beats[${i}].required_events[${j}] is empty`]);
    }

    // forbidden_events: array of nonempty strings, read via descriptors
    const feDesc = Object.getOwnPropertyDescriptor(b, 'forbidden_events');
    if (!feDesc || !Array.isArray(feDesc.value)) {
      throw contractError(`Beat ${i} forbidden_events not array`, [`beats[${i}].forbidden_events is not an array`]);
    }
    for (let j = 0; j < feDesc.value.length; j++) {
      const felDesc = Object.getOwnPropertyDescriptor(feDesc.value, j);
      if (!felDesc || felDesc.get || felDesc.set) throw contractError(`Accessor at beats[${i}].forbidden_events[${j}]`, [`beats[${i}].forbidden_events[${j}] has an invalid descriptor`]);
      if (typeof felDesc.value !== 'string') throw contractError(`Beat ${i} forbidden_events[${j}] not string`, [`beats[${i}].forbidden_events[${j}] must be a string, got ${typeof felDesc.value}`]);
      if (felDesc.value.trim() === '') throw contractError(`Beat ${i} forbidden_events[${j}] empty`, [`beats[${i}].forbidden_events[${j}] is empty`]);
    }

    // continuity_dependencies: required array of nonempty strings
    const cdDesc = Object.getOwnPropertyDescriptor(b, 'continuity_dependencies');
    if (!cdDesc || !Array.isArray(cdDesc.value)) {
      throw contractError(`Beat ${i} continuity_dependencies not array`, [`beats[${i}].continuity_dependencies is required and must be an array`]);
    }
    for (let j = 0; j < cdDesc.value.length; j++) {
      const cdelDesc = Object.getOwnPropertyDescriptor(cdDesc.value, j);
      if (!cdelDesc || cdelDesc.get || cdelDesc.set) throw contractError(`Accessor at beats[${i}].continuity_dependencies[${j}]`, [`beats[${i}].continuity_dependencies[${j}] has an invalid descriptor`]);
      if (typeof cdelDesc.value !== 'string') throw contractError(`Beat ${i} continuity_dependencies[${j}] not string`, [`beats[${i}].continuity_dependencies[${j}] must be a string, got ${typeof cdelDesc.value}`]);
      if (cdelDesc.value.trim() === '') throw contractError(`Beat ${i} continuity_dependencies[${j}] empty`, [`beats[${i}].continuity_dependencies[${j}] is empty`]);
    }
  }
}

// ─── Validator ─────────────────────────────────────────────────────────

export function validateSceneExecutionPacket(packet, immutableSceneContract) {
  try {
    return _validatePacketInner(packet, immutableSceneContract);
  } catch (e) {
    if (e instanceof NarrativeInvariantError) throw e;
    // Normalize any raw error (TypeError, getter-thrown, legacy) into stable contract
    throw packetError(
      e.message || 'Packet validation failed',
      'VALIDATION_ERROR',
      [e.message || String(e)]
    );
  }
}

function _validatePacketInner(packet, immutableSceneContract) {
  // ── Full recursive descriptor-safe inspection BEFORE reading any nested value ──
  // This rejects all hostile structures (getters, symbols, non-enumerables,
  // class instances, cycles, etc.) before any schema field is accessed.
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw packetError('Invalid packet root', 'INVALID_PACKET', ['Packet must be a non-null plain object']);
  }
  if (packet instanceof Date) {
    throw packetError('Invalid packet root: Date', 'INVALID_PACKET', ['Packet root is a Date object']);
  }
  const packetProto = Object.getPrototypeOf(packet);
  if (packetProto !== Object.prototype && packetProto !== null) {
    throw packetError('Invalid packet root: class instance', 'INVALID_PACKET', ['Packet root is a non-plain object (custom prototype)']);
  }
  descriptorSafeInspect(packet, 'packet', new Set());

  // ── Top-level key enforcement ──
  for (const k of Object.keys(packet)) {
    if (PROHIBITED_KEYS.has(k)) {
      throw packetError(`Prohibited key: ${k}`, 'PROHIBITED_KEY', [`Top-level key "${k}" is a prohibited raw foundation or private field`]);
    }
    if (!ALLOWED_PACKET_KEYS.has(k)) {
      throw packetError(`Unknown key: ${k}`, 'UNKNOWN_KEY', [`Top-level key "${k}" is not in the allowed packet schema`]);
    }
  }

  // ── Required field presence ──
  if (!Object.prototype.hasOwnProperty.call(packet, 'packet_id') && packetProto && Object.getOwnPropertyDescriptor(packetProto, 'packet_id')) {
    throw packetError('Inherited packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id is inherited, not an own property']);
  }
  const allRequiredKeys = [
    ...REQUIRED_NONEMPTY_STRING_FIELDS, ...OPTIONAL_STRING_FIELDS,
    ...STRING_ARRAY_FIELDS, ...RECORD_ARRAY_FIELDS, ...ID_ARRAY_FIELDS,
    'chapter_number', 'scene_number', 'packet_id'
  ];
  for (const k of allRequiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(packet, k)) {
      throw packetError(`Missing required field: ${k}`, 'MISSING_REQUIRED_FIELD', [`Field "${k}" is missing from the packet`]);
    }
  }

  // ── Version ──
  requireString(packet.packet_version, 'packet_version', false);
  if (packet.packet_version !== SCENE_EXECUTION_PACKET_VERSION) {
    throw packetError('Wrong packet version', 'WRONG_PACKET_VERSION', [`Expected "${SCENE_EXECUTION_PACKET_VERSION}", got "${packet.packet_version}"`]);
  }

  // ── String fields ──
  for (const f of REQUIRED_NONEMPTY_STRING_FIELDS) requireString(packet[f], f, false);
  for (const f of OPTIONAL_STRING_FIELDS) requireString(packet[f], f, true);

  // ── String field length limits ──
  for (const f of ['project_id', 'chapter_id', 'scene_id', 'snapshot_id', 'source_contract_fingerprint']) requireIdLength(packet[f], f);
  requireStringLength(packet.scene_goal, 'scene_goal', PACKET_LIMITS.MAX_GOAL_LENGTH);
  requireStringLength(packet.entry_state, 'entry_state', PACKET_LIMITS.MAX_STATE_LENGTH);
  requireStringLength(packet.exit_state, 'exit_state', PACKET_LIMITS.MAX_STATE_LENGTH);
  requireStringLength(packet.pov_identity, 'pov_identity', PACKET_LIMITS.MAX_ID_LENGTH);
  requireStringLength(packet.immediate_continuity, 'immediate_continuity', PACKET_LIMITS.MAX_CONTINUITY_LENGTH);

  // ── Numeric fields ──
  requirePositiveInteger(packet.chapter_number, 'chapter_number');
  requirePositiveInteger(packet.scene_number, 'scene_number');

  // ── String array fields ──
  for (const f of STRING_ARRAY_FIELDS) {
    requireArray(packet[f], f);
    requireArrayBound(packet[f], f);
    const maxElem = f === 'voice_rules' ? PACKET_LIMITS.MAX_VOICE_RULE_LENGTH : PACKET_LIMITS.MAX_STATE_ENTRY_LENGTH;
    requireStringArrayElements(packet[f], f, maxElem);
    if (SET_LIKE_FIELDS.has(f)) requireSetUnique(packet[f], f);
  }

  // ── Record array fields ──
  for (const f of RECORD_ARRAY_FIELDS) {
    requireArray(packet[f], f);
    requireArrayBound(packet[f], f);
  }

  // ── ID array fields ──
  for (const f of ID_ARRAY_FIELDS) {
    requireArray(packet[f], f);
    requireArrayBound(packet[f], f);
    for (let i = 0; i < packet[f].length; i++) {
      if (typeof packet[f][i] !== 'string') {
        throw packetError(`${f}[${i}] must be a string`, 'INVALID_FIELD_TYPE', [`${f}[${i}] must be a string, got ${packet[f][i] === null ? 'null' : typeof packet[f][i]}`]);
      }
      if (packet[f][i].trim() === '') {
        throw packetError(`${f}[${i}] must be nonempty`, 'INVALID_FIELD_VALUE', [`${f}[${i}] is empty or whitespace-only`]);
      }
      requireIdLength(packet[f][i], `${f}[${i}]`);
    }
    if (SET_LIKE_FIELDS.has(f)) requireSetUnique(packet[f], f);
  }

  // ── Required event validation ──
  for (let i = 0; i < packet.required_events.length; i++) {
    const e = packet.required_events[i];
    requirePlainObject(e, `required_events[${i}]`);
    for (const k of Object.keys(e)) {
      if (!ALLOWED_REQUIRED_EVENT_KEYS.has(k)) throw packetError(`Unknown key in required event: ${k}`, 'UNKNOWN_NESTED_KEY', [`required_events[${i}] key "${k}" is not allowed; only event_id and text are permitted`]);
    }
    if (!Object.prototype.hasOwnProperty.call(e, 'event_id')) throw packetError(`required_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing event_id`]);
    if (!Object.prototype.hasOwnProperty.call(e, 'text')) throw packetError(`required_events[${i}] missing text`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing text`]);
    requireString(e.event_id, `required_events[${i}].event_id`, false);
    requireString(e.text, `required_events[${i}].text`, false);
    requireIdLength(e.event_id, `required_events[${i}].event_id`);
    requireStringLength(e.text, `required_events[${i}].text`, PACKET_LIMITS.MAX_EVENT_TEXT_LENGTH);
  }

  // ── Future-reserved event validation ──
  for (let i = 0; i < packet.future_reserved_events.length; i++) {
    const e = packet.future_reserved_events[i];
    requirePlainObject(e, `future_reserved_events[${i}]`);
    for (const k of Object.keys(e)) {
      if (k.includes('truth') || k.includes('secret') || k.includes('withheld') || k.includes('private')) {
        throw packetError(`Prohibited secret truth payload: ${k}`, 'PROHIBITED_SECRET_TRUTH', [`future_reserved_events[${i}] contains prohibited field "${k}"`]);
      }
      if (!ALLOWED_FUTURE_EVENT_KEYS.has(k)) throw packetError(`Unknown key in future-reserved event: ${k}`, 'UNKNOWN_NESTED_KEY', [`future_reserved_events[${i}] key "${k}" is not allowed; only event_id is permitted`]);
    }
    if (!Object.prototype.hasOwnProperty.call(e, 'event_id')) throw packetError(`future_reserved_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`future_reserved_events[${i}] is missing event_id`]);
    requireString(e.event_id, `future_reserved_events[${i}].event_id`, false);
    requireIdLength(e.event_id, `future_reserved_events[${i}].event_id`);
  }

  // ── Scene-authorized fact validation ──
  for (let i = 0; i < packet.scene_authorized_facts.length; i++) {
    const f = packet.scene_authorized_facts[i];
    requirePlainObject(f, `scene_authorized_facts[${i}]`);
    for (const k of Object.keys(f)) {
      if (k.includes('withheld') || k.includes('private') || k.includes('secret') || k.includes('truth')) {
        throw packetError(`Prohibited knowledge field in fact: ${k}`, 'PROHIBITED_SECRET_TRUTH', [`scene_authorized_facts[${i}] contains prohibited field "${k}"`]);
      }
      if (!ALLOWED_FACT_KEYS.has(k)) throw packetError(`Unknown key in authorized fact: ${k}`, 'UNKNOWN_NESTED_KEY', [`scene_authorized_facts[${i}] key "${k}" is not allowed`]);
    }
    for (const reqField of ['fact_id', 'summary', 'provenance', 'knowledge_scope']) {
      if (!Object.prototype.hasOwnProperty.call(f, reqField)) throw packetError(`scene_authorized_facts[${i}] missing ${reqField}`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}] is missing ${reqField}`]);
    }
    requireString(f.fact_id, `scene_authorized_facts[${i}].fact_id`, false);
    requireString(f.summary, `scene_authorized_facts[${i}].summary`, false);
    requireString(f.provenance, `scene_authorized_facts[${i}].provenance`, false);
    requireIdLength(f.fact_id, `scene_authorized_facts[${i}].fact_id`);
    requireStringLength(f.summary, `scene_authorized_facts[${i}].summary`, PACKET_LIMITS.MAX_FACT_SUMMARY_LENGTH);
    requireStringLength(f.provenance, `scene_authorized_facts[${i}].provenance`, PACKET_LIMITS.MAX_PROVENANCE_LENGTH);
    requirePlainObject(f.knowledge_scope, `scene_authorized_facts[${i}].knowledge_scope`);
    for (const k of Object.keys(f.knowledge_scope)) {
      if (!ALLOWED_KNOWLEDGE_SCOPE_KEYS.has(k)) throw packetError(`Unknown knowledge_scope key: ${k}`, 'UNKNOWN_NESTED_KEY', [`scene_authorized_facts[${i}].knowledge_scope key "${k}" is not allowed`]);
    }
    if (!Object.prototype.hasOwnProperty.call(f.knowledge_scope, 'pov_identity')) throw packetError(`scene_authorized_facts[${i}].knowledge_scope missing pov_identity`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}].knowledge_scope is missing pov_identity`]);
    if (!Object.prototype.hasOwnProperty.call(f.knowledge_scope, 'basis')) throw packetError(`scene_authorized_facts[${i}].knowledge_scope missing basis`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}].knowledge_scope is missing basis`]);
    requireString(f.knowledge_scope.pov_identity, `scene_authorized_facts[${i}].knowledge_scope.pov_identity`, false);
    requireString(f.knowledge_scope.basis, `scene_authorized_facts[${i}].knowledge_scope.basis`, false);
    requireStringLength(f.knowledge_scope.basis, `scene_authorized_facts[${i}].knowledge_scope.basis`, PACKET_LIMITS.MAX_BASIS_LENGTH);
    if (f.knowledge_scope.pov_identity.trim() !== packet.pov_identity.trim()) {
      throw packetError(`Knowledge scope POV mismatch in scene_authorized_facts[${i}]`, 'KNOWLEDGE_SCOPE_POV_MISMATCH', [`scene_authorized_facts[${i}].knowledge_scope.pov_identity "${f.knowledge_scope.pov_identity}" does not match packet pov_identity "${packet.pov_identity}"`]);
    }
  }

  // ── Contract validation (descriptor-safe, mutation-safe) ──
  inspectContractDescriptorSafe(immutableSceneContract);

  if (packet.source_contract_fingerprint !== immutableSceneContract.fingerprint) {
    throw packetError('Contract fingerprint mismatch', 'CONTRACT_FINGERPRINT_MISMATCH', [`Expected "${immutableSceneContract.fingerprint}", got "${packet.source_contract_fingerprint}"`]);
  }

  const defensiveBeats = JSON.parse(JSON.stringify(immutableSceneContract.beats));
  try {
    assertSceneContractUnchanged(immutableSceneContract, defensiveBeats, { chapterNumber: packet.chapter_number });
  } catch (e) {
    if (e instanceof NarrativeInvariantError) throw e;
    const issues = e.details?.issues || e.details?.validationReasons || [e.message];
    throw packetError(e.message || 'Scene contract validation failed', e.code || 'SCENE_CONTRACT_INVALID', Array.isArray(issues) ? issues : [String(issues)]);
  }

  const beat = immutableSceneContract.beats.find(b => b.scene_id === packet.scene_id);
  if (!beat) throw packetError('Scene identity mismatch', 'SCENE_IDENTITY_MISMATCH', [`scene_id "${packet.scene_id}" not found in contract beats`]);
  if (packet.scene_number !== Number(beat.scene_number)) throw packetError('Scene number mismatch', 'SCENE_NUMBER_MISMATCH', [`Expected scene_number ${beat.scene_number}, got ${packet.scene_number}`]);
  if (text(packet.scene_goal) !== text(beat.scene_goal)) throw packetError('Scene goal mismatch', 'SCENE_GOAL_MISMATCH', [`Packet scene_goal does not match contract`]);
  if (text(packet.entry_state) !== text(beat.entry_state)) throw packetError('Entry state mismatch', 'ENTRY_STATE_MISMATCH', [`Packet entry_state does not match contract`]);
  if (text(packet.exit_state) !== text(beat.exit_state)) throw packetError('Exit state mismatch', 'EXIT_STATE_MISMATCH', [`Packet exit_state does not match contract`]);

  // ── Required events ──
  const requiredEvents = packet.required_events;
  const beatEvents = Array.isArray(beat.required_events) ? beat.required_events : [];
  if (requiredEvents.length !== beatEvents.length) throw packetError('Required events count mismatch', 'REQUIRED_EVENTS_MISMATCH', [`Expected ${beatEvents.length} required events, got ${requiredEvents.length}`]);
  // Duplicate ID detection FIRST (before text or deterministic-ID comparison)
  const reqEventIds = new Set();
  for (let i = 0; i < requiredEvents.length; i++) {
    if (reqEventIds.has(requiredEvents[i].event_id)) throw packetError('Duplicate required event ID', 'DUPLICATE_EVENT_ID', [`Duplicate required event_id "${requiredEvents[i].event_id}"`]);
    reqEventIds.add(requiredEvents[i].event_id);
  }
  for (let i = 0; i < requiredEvents.length; i++) {
    if (text(requiredEvents[i].text) !== text(beatEvents[i])) throw packetError('Required event text mismatch', 'REQUIRED_EVENTS_MISMATCH', [`Required event ${i + 1} text does not match contract`]);
    const expectedId = generateDeterministicEventId(packet.project_id, packet.chapter_id, packet.scene_id, 'required', i + 1, beatEvents[i]);
    if (requiredEvents[i].event_id !== expectedId) throw packetError('Event ID mismatch', 'EVENT_ID_MISMATCH', [`Required event ${i + 1} event_id does not match deterministic derivation`]);
  }

  // ── Forbidden events ──
  const forbiddenEvents = packet.current_scene_forbidden_events;
  const beatForbidden = Array.isArray(beat.forbidden_events) ? beat.forbidden_events : [];
  if (forbiddenEvents.length !== beatForbidden.length) throw packetError('Forbidden events count mismatch', 'FORBIDDEN_EVENTS_MISMATCH', [`Expected ${beatForbidden.length} forbidden events, got ${forbiddenEvents.length}`]);
  for (let i = 0; i < forbiddenEvents.length; i++) {
    if (text(forbiddenEvents[i]) !== text(beatForbidden[i])) throw packetError('Forbidden event text mismatch', 'FORBIDDEN_EVENTS_MISMATCH', [`Forbidden event ${i + 1} text does not match contract`]);
  }

  // ── Continuity dependencies ──
  const packetContDeps = packet.continuity_dependencies;
  const beatContDeps = Array.isArray(beat.continuity_dependencies) ? beat.continuity_dependencies : [];
  if (packetContDeps.length !== beatContDeps.length) throw packetError('Continuity dependencies count mismatch', 'CONTINUITY_DEPENDENCIES_MISMATCH', [`Expected ${beatContDeps.length} continuity dependencies, got ${packetContDeps.length}`]);
  for (let i = 0; i < packetContDeps.length; i++) {
    if (text(packetContDeps[i]) !== text(beatContDeps[i])) throw packetError('Continuity dependency text mismatch', 'CONTINUITY_DEPENDENCIES_MISMATCH', [`Continuity dependency ${i + 1} text does not match contract`]);
  }

  // ── Future-reserved event ID uniqueness and overlap ──
  const futureEventIds = new Set();
  for (const e of packet.future_reserved_events) {
    if (futureEventIds.has(e.event_id)) throw packetError('Duplicate future reserved event ID', 'DUPLICATE_EVENT_ID', [`Duplicate future_reserved event_id "${e.event_id}"`]);
    futureEventIds.add(e.event_id);
    if (reqEventIds.has(e.event_id)) throw packetError('Event appears as both required and future-reserved', 'REQUIRED_AND_FUTURE_EVENT', [`event_id "${e.event_id}" cannot be both required and future-reserved`]);
  }

  // ── Completed event ID uniqueness ──
  const completedEventIds = new Set();
  for (const id of packet.completed_events) {
    if (completedEventIds.has(id)) throw packetError('Duplicate completed event ID', 'DUPLICATE_EVENT_ID', [`Duplicate completed event_id "${id}"`]);
    completedEventIds.add(id);
  }

  // ── Fact ID uniqueness ──
  const factIdSet = new Set();
  for (const f of packet.scene_authorized_facts) {
    if (factIdSet.has(f.fact_id)) throw packetError('Duplicate fact ID', 'DUPLICATE_FACT_ID', [`Duplicate fact_id "${f.fact_id}"`]);
    factIdSet.add(f.fact_id);
  }

  // ── pov_known_facts resolution ──
  const povFactIds = new Set();
  for (let i = 0; i < packet.pov_known_facts.length; i++) {
    const fid = packet.pov_known_facts[i];
    if (povFactIds.has(fid)) throw packetError('Duplicate pov_known_facts ID', 'DUPLICATE_POV_FACT_ID', [`pov_known_facts[${i}] "${fid}" is a duplicate`]);
    povFactIds.add(fid);
    if (!factIdSet.has(fid)) throw packetError('pov_known_facts ID not found in scene_authorized_facts', 'UNRESOLVED_POV_FACT', [`pov_known_facts[${i}] "${fid}" does not resolve to any scene_authorized_facts entry`]);
  }

  // ── Packet fingerprint ──
  requireString(packet.packet_id, 'packet_id', false);
  if (packet.packet_id !== generatePacketFingerprint(packet)) throw packetError('Packet fingerprint mismatch', 'PACKET_FINGERPRINT_MISMATCH', ['packet_id does not match canonical fingerprint derivation']);

  // ── Return defensive frozen clone ──
  return deepFreeze(JSON.parse(JSON.stringify(packet)));
}

// ─── Stage 2: pure Scene Execution Packet composer ────────────────────
// This component is deliberately disconnected from live generation. Callers
// must opt in with the default-off feature flag, and the function accepts only
// explicit scene-safe authority rather than raw foundation or manuscript data.

const COMPOSER_INPUT_KEYS = new Set([
  'flags',
  'snapshot',
  'immutableSceneContract',
  'sceneId',
  'context',
]);

const COMPOSER_CONTEXT_KEYS = new Set([
  'pov_identity',
  'immediate_continuity',
  'future_reserved_event_ids',
  'scene_authorized_facts',
  'completed_event_ids',
  'voice_rules',
  'current_locations',
  'current_possessions',
  'current_injuries',
  'confirmed_deaths',
  'current_separations',
  'unavailable_objects',
  'canonically_unique_objects',
  'pov_known_fact_ids',
]);

function composerError(message, code, issues) {
  return packetError(message, code, issues);
}

function requireComposerObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
    throw composerError(
      `Invalid composer object at ${path}`,
      'INVALID_COMPOSER_INPUT',
      [`${path} must be a non-null plain object`]
    );
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw composerError(
      `Invalid composer prototype at ${path}`,
      'INVALID_COMPOSER_INPUT',
      [`${path} must use Object.prototype or a null prototype`]
    );
  }
}

function composerOwnDataValue(object, key, path, required = true) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (!descriptor) {
    if (!required) return undefined;
    throw composerError(
      `Missing composer input at ${path}.${key}`,
      'INVALID_COMPOSER_INPUT',
      [`${path}.${key} must be an own enumerable data property`]
    );
  }
  if (descriptor.get || descriptor.set || !descriptor.enumerable) {
    throw composerError(
      `Unsafe composer input at ${path}.${key}`,
      'INVALID_COMPOSER_INPUT',
      [`${path}.${key} must be an own enumerable data property without accessors`]
    );
  }
  return descriptor.value;
}

function inspectComposerRecord(value, path, allowedKeys) {
  requireComposerObject(value, path);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      throw composerError(
        `Symbol-keyed composer input at ${path}`,
        'INVALID_COMPOSER_INPUT',
        [`${path} has a symbol-keyed property: ${String(key)}`]
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor.get || descriptor.set || !descriptor.enumerable) {
      throw composerError(
        `Unsafe composer input at ${path}.${key}`,
        'INVALID_COMPOSER_INPUT',
        [`${path}.${key} must be an own enumerable data property without accessors`]
      );
    }
    if (!allowedKeys.has(key)) {
      if (PROHIBITED_KEYS.has(key)) {
        throw composerError(
          `Prohibited composer input: ${key}`,
          'PROHIBITED_KEY',
          [`${path}.${key} is raw foundation, manuscript, prompt, or private authority and cannot enter a Scene Execution Packet`]
        );
      }
      throw composerError(
        `Unknown composer input: ${key}`,
        'INVALID_COMPOSER_INPUT',
        [`${path}.${key} is not an allowed composer field`]
      );
    }
  }
}

function cloneComposerValue(value, path) {
  descriptorSafeInspect(value, path, new Set());
  return canonicalizeValue(value, path, new Set());
}

function composerArray(context, key) {
  const value = composerOwnDataValue(context, key, 'composer.context', false);
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw composerError(
      `Invalid composer array at composer.context.${key}`,
      'INVALID_COMPOSER_INPUT',
      [`composer.context.${key} must be an array`]
    );
  }
  return cloneComposerValue(value, `composer.context.${key}`);
}

export function composeSceneExecutionPacket(input) {
  inspectComposerRecord(input, 'composer', COMPOSER_INPUT_KEYS);

  const flags = composerOwnDataValue(input, 'flags', 'composer', false);
  if (!isSceneContextComposerEnabled(flags)) {
    throw composerError(
      'Scene context composer is disabled',
      'SCENE_CONTEXT_COMPOSER_DISABLED',
      [`Set the own data flag "${SCENE_CONTEXT_COMPOSER_FEATURE.key}" to true for an explicit shadow-mode composer call`]
    );
  }

  const snapshot = composerOwnDataValue(input, 'snapshot', 'composer');
  const immutableSceneContract = composerOwnDataValue(input, 'immutableSceneContract', 'composer');
  const requestedSceneId = composerOwnDataValue(input, 'sceneId', 'composer');
  const context = composerOwnDataValue(input, 'context', 'composer');

  requireComposerObject(snapshot, 'composer.snapshot');
  if (!Object.isFrozen(snapshot)) {
    throw composerError(
      'Generation snapshot is not immutable',
      'INVALID_COMPOSER_INPUT',
      ['composer.snapshot must be the frozen output of buildGenerationSnapshot()']
    );
  }
  inspectComposerRecord(context, 'composer.context', COMPOSER_CONTEXT_KEYS);
  descriptorSafeInspect(context, 'composer.context', new Set());
  inspectContractDescriptorSafe(immutableSceneContract);

  if (typeof requestedSceneId !== 'string' || requestedSceneId.trim() === '') {
    throw composerError(
      'Invalid requested scene identity',
      'INVALID_COMPOSER_INPUT',
      ['composer.sceneId must be a nonempty string']
    );
  }

  const snapshotId = composerOwnDataValue(snapshot, 'snapshotId', 'composer.snapshot');
  const project = composerOwnDataValue(snapshot, 'project', 'composer.snapshot');
  const chapter = composerOwnDataValue(snapshot, 'chapter', 'composer.snapshot');
  requireComposerObject(project, 'composer.snapshot.project');
  requireComposerObject(chapter, 'composer.snapshot.chapter');

  const projectId = composerOwnDataValue(project, 'id', 'composer.snapshot.project');
  const chapterId = composerOwnDataValue(chapter, 'id', 'composer.snapshot.chapter');
  const snapshotChapterNumber =
    composerOwnDataValue(chapter, 'chapter_number', 'composer.snapshot.chapter', false) ??
    composerOwnDataValue(chapter, 'number', 'composer.snapshot.chapter', false);

  if (typeof snapshotId !== 'string' || snapshotId.trim() === '') {
    throw composerError('Invalid snapshot identity', 'INVALID_COMPOSER_INPUT', ['composer.snapshot.snapshotId must be a nonempty string']);
  }
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    throw composerError('Invalid project identity', 'INVALID_COMPOSER_INPUT', ['composer.snapshot.project.id must be a nonempty string']);
  }
  if (typeof chapterId !== 'string' || chapterId.trim() === '') {
    throw composerError('Invalid chapter identity', 'INVALID_COMPOSER_INPUT', ['composer.snapshot.chapter.id must be a nonempty string']);
  }
  if (
    typeof snapshotChapterNumber !== 'number' ||
    !Number.isFinite(snapshotChapterNumber) ||
    !Number.isInteger(snapshotChapterNumber) ||
    snapshotChapterNumber <= 0
  ) {
    throw composerError(
      'Invalid snapshot chapter number',
      'INVALID_COMPOSER_INPUT',
      [`composer.snapshot.chapter.chapter_number must be a finite positive integer, got ${snapshotChapterNumber}`]
    );
  }
  if (snapshotChapterNumber !== immutableSceneContract.chapterNumber) {
    throw composerError(
      'Snapshot and contract chapter mismatch',
      'COMPOSER_SNAPSHOT_MISMATCH',
      [`Snapshot Chapter ${snapshotChapterNumber} does not match contract Chapter ${immutableSceneContract.chapterNumber}`]
    );
  }

  const sceneId = requestedSceneId.trim();
  const beatIndex = immutableSceneContract.beats.findIndex((candidate) => candidate.scene_id === sceneId);
  if (beatIndex < 0) {
    throw composerError(
      'Requested scene is not in the immutable contract',
      'COMPOSER_SCENE_NOT_FOUND',
      [`sceneId "${sceneId}" is not present in the immutable scene contract`]
    );
  }
  const beat = immutableSceneContract.beats[beatIndex];

  const povIdentity = composerOwnDataValue(context, 'pov_identity', 'composer.context');
  const immediateContinuity = composerOwnDataValue(context, 'immediate_continuity', 'composer.context', false);
  if (typeof povIdentity !== 'string' || povIdentity.trim() === '') {
    throw composerError(
      'Missing composer POV identity',
      'INVALID_COMPOSER_INPUT',
      ['composer.context.pov_identity must be a nonempty string']
    );
  }
  if (immediateContinuity !== undefined && typeof immediateContinuity !== 'string') {
    throw composerError(
      'Invalid composer immediate continuity',
      'INVALID_COMPOSER_INPUT',
      ['composer.context.immediate_continuity must be a string when supplied']
    );
  }

  const futureReservedEventIds = composerArray(context, 'future_reserved_event_ids');
  const completedEventIds = composerArray(context, 'completed_event_ids');
  const povKnownFactIds = composerArray(context, 'pov_known_fact_ids');
  const sceneAuthorizedFacts = composerArray(context, 'scene_authorized_facts');
  const contractEventIdsForBeats = (beats) => beats.flatMap((contractBeat) =>
    contractBeat.required_events.map((eventText, index) =>
      generateDeterministicEventId(
        projectId.trim(),
        chapterId.trim(),
        contractBeat.scene_id,
        'required',
        index + 1,
        eventText
      )
    )
  );
  const priorContractEventIds = contractEventIdsForBeats(
    immutableSceneContract.beats.slice(0, beatIndex)
  );
  const futureContractEventIds = contractEventIdsForBeats(
    immutableSceneContract.beats.slice(beatIndex + 1)
  );

  const packet = {
    packet_version: SCENE_EXECUTION_PACKET_VERSION,
    snapshot_id: snapshotId.trim(),
    source_contract_fingerprint: immutableSceneContract.fingerprint,
    project_id: projectId.trim(),
    chapter_id: chapterId.trim(),
    chapter_number: immutableSceneContract.chapterNumber,
    scene_id: beat.scene_id,
    scene_number: beat.scene_number,
    scene_goal: beat.scene_goal,
    entry_state: beat.entry_state,
    exit_state: beat.exit_state,
    pov_identity: povIdentity.trim(),
    immediate_continuity: immediateContinuity === undefined ? '' : immediateContinuity,
    required_events: beat.required_events.map((eventText, index) => ({
      event_id: generateDeterministicEventId(
        projectId.trim(),
        chapterId.trim(),
        beat.scene_id,
        'required',
        index + 1,
        eventText
      ),
      text: eventText,
    })),
    // Later contract events are represented by deterministic IDs only. Their
    // text and outcome never enter the current scene's packet.
    future_reserved_events: [...futureContractEventIds, ...futureReservedEventIds]
      .map((eventId) => ({ event_id: eventId })),
    scene_authorized_facts: sceneAuthorizedFacts,
    completed_events: [...completedEventIds, ...priorContractEventIds],
    voice_rules: composerArray(context, 'voice_rules'),
    current_locations: composerArray(context, 'current_locations'),
    current_possessions: composerArray(context, 'current_possessions'),
    current_injuries: composerArray(context, 'current_injuries'),
    confirmed_deaths: composerArray(context, 'confirmed_deaths'),
    current_separations: composerArray(context, 'current_separations'),
    unavailable_objects: composerArray(context, 'unavailable_objects'),
    canonically_unique_objects: composerArray(context, 'canonically_unique_objects'),
    pov_known_facts: povKnownFactIds,
    current_scene_forbidden_events: beat.forbidden_events.slice(),
    continuity_dependencies: beat.continuity_dependencies.slice(),
  };

  packet.packet_id = generatePacketFingerprint(packet);
  return validateSceneExecutionPacket(packet, immutableSceneContract);
}

// ─── Stage 3: pure Scene Execution Prompt Projection ─────────────────
// This renderer is deliberately disconnected from live generation. It accepts
// only a validated Scene Execution Packet and its immutable source contract,
// then projects the minimum current-scene authority needed by a future prompt
// integration. Later-scene authority remains opaque event IDs only.

const PROMPT_PROJECTION_INPUT_KEYS = new Set([
  'flags',
  'packet',
  'immutableSceneContract',
]);

const OPAQUE_PROMPT_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function requireOpaquePromptReference(value, path) {
  if (!OPAQUE_PROMPT_REFERENCE_PATTERN.test(value)) {
    throw packetError(
      `Prompt projection reference at ${path} is not opaque`,
      'INVALID_PROMPT_PROJECTION_ID',
      [`${path} must contain only letters, numbers, ".", "_", ":", or "-" and cannot contain whitespace or prose`]
    );
  }
}

function assertPromptProjectionReferencesOpaque(packet) {
  for (let index = 0; index < packet.required_events.length; index += 1) {
    requireOpaquePromptReference(
      packet.required_events[index].event_id,
      `packet.required_events[${index}].event_id`
    );
  }
  for (let index = 0; index < packet.future_reserved_events.length; index += 1) {
    requireOpaquePromptReference(
      packet.future_reserved_events[index].event_id,
      `packet.future_reserved_events[${index}].event_id`
    );
  }
  for (let index = 0; index < packet.completed_events.length; index += 1) {
    requireOpaquePromptReference(
      packet.completed_events[index],
      `packet.completed_events[${index}]`
    );
  }
  for (let index = 0; index < packet.scene_authorized_facts.length; index += 1) {
    requireOpaquePromptReference(
      packet.scene_authorized_facts[index].fact_id,
      `packet.scene_authorized_facts[${index}].fact_id`
    );
  }
  for (let index = 0; index < packet.pov_known_facts.length; index += 1) {
    requireOpaquePromptReference(
      packet.pov_known_facts[index],
      `packet.pov_known_facts[${index}]`
    );
  }
}

function clonePromptProjectionFact(fact) {
  return {
    fact_id: fact.fact_id,
    summary: fact.summary,
    provenance: fact.provenance,
    knowledge_scope: {
      pov_identity: fact.knowledge_scope.pov_identity,
      basis: fact.knowledge_scope.basis,
    },
  };
}

export function renderSceneExecutionPromptProjection(input) {
  inspectComposerRecord(input, 'promptProjection', PROMPT_PROJECTION_INPUT_KEYS);

  const flags = composerOwnDataValue(input, 'flags', 'promptProjection', false);
  if (!isSceneContextComposerEnabled(flags)) {
    throw packetError(
      'Scene execution prompt projection is disabled',
      'SCENE_CONTEXT_COMPOSER_DISABLED',
      [`Set the own data flag "${SCENE_CONTEXT_COMPOSER_FEATURE.key}" to true for an explicit shadow-mode projection call`]
    );
  }

  const packet = composerOwnDataValue(input, 'packet', 'promptProjection');
  const immutableSceneContract = composerOwnDataValue(
    input,
    'immutableSceneContract',
    'promptProjection'
  );

  const validatedPacket = validateSceneExecutionPacket(
    packet,
    immutableSceneContract
  );
  assertPromptProjectionReferencesOpaque(validatedPacket);

  const projection = {
    projection_version: SCENE_EXECUTION_PROMPT_PROJECTION_VERSION,
    packet_id: validatedPacket.packet_id,
    scene_identity: {
      project_id: validatedPacket.project_id,
      chapter_id: validatedPacket.chapter_id,
      chapter_number: validatedPacket.chapter_number,
      scene_id: validatedPacket.scene_id,
      scene_number: validatedPacket.scene_number,
      pov_identity: validatedPacket.pov_identity,
    },
    current_scene_authority: {
      scene_goal: validatedPacket.scene_goal,
      entry_state: validatedPacket.entry_state,
      required_events: validatedPacket.required_events.map((event) => ({
        event_id: event.event_id,
        text: event.text,
      })),
      forbidden_events: validatedPacket.current_scene_forbidden_events.slice(),
      exit_state: validatedPacket.exit_state,
    },
    continuity: {
      immediate_continuity: validatedPacket.immediate_continuity,
      dependencies: validatedPacket.continuity_dependencies.slice(),
      completed_event_ids: validatedPacket.completed_events.slice(),
      current_locations: validatedPacket.current_locations.slice(),
      current_possessions: validatedPacket.current_possessions.slice(),
      current_injuries: validatedPacket.current_injuries.slice(),
      confirmed_deaths: validatedPacket.confirmed_deaths.slice(),
      current_separations: validatedPacket.current_separations.slice(),
      unavailable_objects: validatedPacket.unavailable_objects.slice(),
      canonically_unique_objects: validatedPacket.canonically_unique_objects.slice(),
    },
    knowledge_authority: {
      authorized_facts: validatedPacket.scene_authorized_facts.map(
        clonePromptProjectionFact
      ),
      pov_known_fact_ids: validatedPacket.pov_known_facts.slice(),
    },
    execution_constraints: {
      pov_identity_is_literal: true,
      require_exact_pov_identity_mention: true,
      allow_unlisted_personal_names: false,
      allow_unlisted_event_instruments: false,
      allow_unlisted_history_or_knowledge: false,
      exit_state_is_terminal: true,
      first_exit_state_attainment_is_terminal: true,
      entry_or_threshold_crossing_attains_inside_exit_state: true,
      allow_post_exit_action_or_description: false,
    },
    voice_rules: validatedPacket.voice_rules.slice(),
    future_boundaries: {
      reserved_event_ids: validatedPacket.future_reserved_events.map(
        (event) => event.event_id
      ),
    },
    final_output_contract: {
      minimum_word_count: 0,
      requested_word_target_present: false,
      unlisted_concrete_fact_budget: 0,
      required_sequence: [
        validatedPacket.entry_state,
        ...validatedPacket.required_events.map((event) => event.text),
        validatedPacket.exit_state,
      ],
      terminal_state: validatedPacket.exit_state,
      continuity_to_preserve:
        validatedPacket.continuity_dependencies.slice(),
      instruction:
        `No word-count target applies. Use only the listed scene authority to enact required_sequence in order. End the response the first time "${validatedPacket.exit_state}" is established. Emit no words after the sentence that establishes it.`,
    },
  };

  return [
    '<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>',
    'Current-scene authority only. final_output_contract is the controlling last instruction and must be followed literally. No word-count target is present or valid in this canary prompt. Future-reserved event IDs are opaque boundaries; do not infer or expand them. Treat current_scene_authority.exit_state as an absolute hard stop and make the transition into that state the final narrative beat. Exit-state attainment begins at the first clause that establishes the exit-state transition; never postpone the boundary to a later restatement. If the exit state places someone inside a location, entering it or crossing its threshold already attains that state. End that same sentence after only the minimum required continuity confirmation; do not describe or inventory the destination, move farther, look around, react, or close the door afterward. The final sentence may only enact or briefly confirm the exit state and required continuity; end the response immediately after it, with no atmospheric coda or further action, movement, observation, thought, reflection, dialogue, plan, or setup. scene_identity.pov_identity is a literal canonical identity, never a role label or placeholder: include that exact string at least once, use only it or compatible pronouns for the POV character, and never substitute or invent a personal name. Treat knowledge_authority.authorized_facts as exhaustive. Unless continuity or knowledge_authority explicitly supplies a story fact, omit it instead of inventing a prior attempt, elapsed time, object provenance, familiarity, ownership, expectation, plan, history, relationship, location detail, or knowledge. Complete required events using only objects or instruments supplied by current-scene authority or continuity; never add a key, tool, mechanism, or source location. Do not perform, imply, or prepare forbidden events.',
    JSON.stringify(projection, null, 2),
    '<<< END VALIDATED SCENE EXECUTION AUTHORITY >>>',
  ].join('\n');
}

// ─── Stage 4: default-off Scene Writer shadow integration ────────────
// This is the first controlled writer seam. It precomputes validated packet
// projections for every contracted scene, but it never accepts, rewrites, or
// returns a model prompt. The writer may observe these projections for
// diagnostics only; prompt injection remains a later, separately gated stage.

const SHADOW_REQUEST_KEYS = new Set([
  'integration',
  'immutableSceneContract',
]);

const SHADOW_INTEGRATION_KEYS = new Set([
  'flags',
  'snapshot',
  'contextBySceneId',
]);

const verifiedSceneExecutionShadowStates = new WeakSet();

function finalizeSceneExecutionShadowState(state) {
  const frozen = deepFreeze(state);
  verifiedSceneExecutionShadowStates.add(frozen);
  return frozen;
}

function disabledSceneExecutionShadowState() {
  return finalizeSceneExecutionShadowState({
    integration_version: SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION,
    enabled: false,
    mode: 'disabled',
    scene_reports: [],
  });
}

function inspectShadowContextMap(contextBySceneId, immutableSceneContract) {
  requireComposerObject(
    contextBySceneId,
    'sceneExecutionShadow.integration.contextBySceneId'
  );

  const expectedSceneIds = immutableSceneContract.beats.map(
    (beat) => beat.scene_id
  );
  const expectedSceneIdSet = new Set(expectedSceneIds);
  const actualSceneIds = [];

  for (const key of Reflect.ownKeys(contextBySceneId)) {
    if (typeof key === 'symbol') {
      throw composerError(
        'Symbol-keyed shadow scene context',
        'INVALID_SCENE_EXECUTION_SHADOW',
        ['sceneExecutionShadow.integration.contextBySceneId cannot contain symbol-keyed properties']
      );
    }
    const descriptor = Object.getOwnPropertyDescriptor(contextBySceneId, key);
    if (descriptor.get || descriptor.set || !descriptor.enumerable) {
      throw composerError(
        `Unsafe shadow scene context at ${key}`,
        'INVALID_SCENE_EXECUTION_SHADOW',
        [`sceneExecutionShadow.integration.contextBySceneId.${key} must be an own enumerable data property without accessors`]
      );
    }
    if (!expectedSceneIdSet.has(key)) {
      throw composerError(
        `Unknown shadow scene context: ${key}`,
        'INVALID_SCENE_EXECUTION_SHADOW',
        [`sceneExecutionShadow.integration.contextBySceneId.${key} does not match an immutable contract scene`]
      );
    }
    inspectComposerRecord(
      descriptor.value,
      `sceneExecutionShadow.integration.contextBySceneId.${key}`,
      COMPOSER_CONTEXT_KEYS
    );
    descriptorSafeInspect(
      descriptor.value,
      `sceneExecutionShadow.integration.contextBySceneId.${key}`,
      new Set()
    );
    actualSceneIds.push(key);
  }

  const actualSceneIdSet = new Set(actualSceneIds);
  const missingSceneIds = expectedSceneIds.filter(
    (sceneId) => !actualSceneIdSet.has(sceneId)
  );
  if (missingSceneIds.length) {
    throw composerError(
      'Shadow scene context coverage is incomplete',
      'SCENE_EXECUTION_SHADOW_CONTEXT_MISSING',
      missingSceneIds.map(
        (sceneId) => `Missing own scene-safe context for immutable contract scene "${sceneId}"`
      )
    );
  }
}

export function prepareSceneExecutionShadowIntegration(input) {
  inspectComposerRecord(input, 'sceneExecutionShadow', SHADOW_REQUEST_KEYS);

  const integration = composerOwnDataValue(
    input,
    'integration',
    'sceneExecutionShadow',
    false
  );
  if (integration === undefined || integration === null) {
    return disabledSceneExecutionShadowState();
  }

  inspectComposerRecord(
    integration,
    'sceneExecutionShadow.integration',
    SHADOW_INTEGRATION_KEYS
  );
  const flags = composerOwnDataValue(
    integration,
    'flags',
    'sceneExecutionShadow.integration',
    false
  );
  if (!isSceneExecutionShadowEnabled(flags)) {
    return disabledSceneExecutionShadowState();
  }
  if (!isSceneContextComposerEnabled(flags)) {
    throw composerError(
      'Scene execution shadow integration requires the packet composer gate',
      'SCENE_EXECUTION_SHADOW_CORE_DISABLED',
      [`Set both own data flags "${SCENE_EXECUTION_SHADOW_FEATURE.key}" and "${SCENE_CONTEXT_COMPOSER_FEATURE.key}" to true for an explicit shadow-only run`]
    );
  }

  const immutableSceneContract = composerOwnDataValue(
    input,
    'immutableSceneContract',
    'sceneExecutionShadow'
  );
  const snapshot = composerOwnDataValue(
    integration,
    'snapshot',
    'sceneExecutionShadow.integration'
  );
  const contextBySceneId = composerOwnDataValue(
    integration,
    'contextBySceneId',
    'sceneExecutionShadow.integration'
  );

  inspectContractDescriptorSafe(immutableSceneContract);
  inspectShadowContextMap(contextBySceneId, immutableSceneContract);

  const acceptanceEnabled = getSceneExecutionAcceptanceGateDecision(flags) === 'enabled';
  const sceneReports = immutableSceneContract.beats.map((beat) => {
    const context = composerOwnDataValue(
      contextBySceneId,
      beat.scene_id,
      'sceneExecutionShadow.integration.contextBySceneId'
    );
    const packet = composeSceneExecutionPacket({
      flags,
      snapshot,
      immutableSceneContract,
      sceneId: beat.scene_id,
      context,
    });
    const projection = renderSceneExecutionPromptProjection({
      flags,
      packet,
      immutableSceneContract,
    });
    const report = {
      snapshot_id: packet.snapshot_id,
      project_id: packet.project_id,
      chapter_id: packet.chapter_id,
      source_contract_fingerprint: packet.source_contract_fingerprint,
      scene_id: beat.scene_id,
      scene_number: beat.scene_number,
      packet_id: packet.packet_id,
      projection,
      ...(acceptanceEnabled ? { packet: deepFreeze(packet) } : {}),
    };
    return deepFreeze(report);
  });

  return finalizeSceneExecutionShadowState({
    integration_version: SCENE_EXECUTION_SHADOW_INTEGRATION_VERSION,
    enabled: true,
    mode: 'shadow',
    source_contract_fingerprint: immutableSceneContract.fingerprint,
    scene_reports: sceneReports,
  });
}

// ─── Stage 5: single-scene prompt canary ─────────────────────────────
// The canary is the first controlled use of a validated prompt projection.
// It accepts only a branded Stage 4 shadow state, requires a third independent
// default-off feature flag, and may target exactly one immutable-contract
// scene. Every other scene receives its original prompt byte-for-byte. For the
// selected scene only, recognized scene-length directives are removed before
// the authority projection is appended so the model never receives two
// incompatible completion conditions.

const PROMPT_CANARY_REQUEST_KEYS = new Set([
  'integration',
  'shadowState',
  'immutableSceneContract',
]);

const PROMPT_CANARY_INTEGRATION_KEYS = new Set([
  'flags',
  'targetSceneId',
]);

const PROMPT_CANARY_APPLY_KEYS = new Set([
  'state',
  'prompt',
  'sceneId',
]);

const verifiedSceneExecutionPromptCanaryStates = new WeakSet();
const verifiedSceneExecutionPromptCanaryResults = new WeakSet();

const FULL_LINE_SCENE_WORD_TARGET_PATTERNS = Object.freeze([
  /^\s*-?\s*Target\s+length\s*:\s*(?:approximately\s+)?\d[\d,]*(?:\s*(?:-|–|—|to)\s*\d[\d,]*)?\s+words?\.?\s*$/i,
  /^\s*-\s*(?:Target|Aim\s+for|Hit)\s+(?:approximately\s+)?\d[\d,]*(?:\s*(?:-|–|—|to)\s*\d[\d,]*)?\s+words?\.?\s*$/i,
]);
const INLINE_SCENE_WORD_TARGET_PATTERN =
  /\s+Target\s+length\s*:\s*(?:approximately\s+)?\d[\d,]*(?:\s*(?:-|–|—|to)\s*\d[\d,]*)?\s+words?\.(?=\s|$)/gi;
const RESIDUAL_SCENE_WORD_TARGET_PATTERN =
  /\b(?:Target(?:\s+length)?|Aim\s+for|Hit)\b[^\n]{0,40}\b\d[\d,]*(?:\s*(?:-|–|—|to)\s*\d[\d,]*)?\s+words?\b/i;

function removeSceneWordTargetDirectives(prompt) {
  let removed = 0;
  const rewrittenLines = prompt.split('\n').flatMap((line) => {
    if (
      FULL_LINE_SCENE_WORD_TARGET_PATTERNS.some((pattern) =>
        pattern.test(line)
      )
    ) {
      removed += 1;
      return [];
    }
    const rewritten = line.replace(
      INLINE_SCENE_WORD_TARGET_PATTERN,
      () => {
        removed += 1;
        return '';
      }
    );
    return [rewritten.replace(/[ \t]+(?=\r?$)/, '')];
  });
  const rewrittenPrompt = rewrittenLines.join('\n');
  if (RESIDUAL_SCENE_WORD_TARGET_PATTERN.test(rewrittenPrompt)) {
    throw composerError(
      'Scene execution prompt canary contains an unsupported word target',
      'SCENE_EXECUTION_PROMPT_CANARY_WORD_TARGET_CONFLICT',
      ['The selected scene prompt must not send any numeric word target to the model; add the directive shape to the deterministic canary rewrite before testing it']
    );
  }
  return {
    prompt: rewrittenPrompt,
    removed_word_target_directive_count: removed,
  };
}

function finalizeSceneExecutionPromptCanaryState(state) {
  const frozen = deepFreeze(state);
  verifiedSceneExecutionPromptCanaryStates.add(frozen);
  return frozen;
}

function disabledSceneExecutionPromptCanaryState() {
  return finalizeSceneExecutionPromptCanaryState({
    integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
    enabled: false,
    mode: 'disabled',
    target_scene_id: null,
    packet_id: null,
    projection: null,
  });
}

export function prepareSceneExecutionPromptCanary(input) {
  inspectComposerRecord(input, 'sceneExecutionPromptCanary', PROMPT_CANARY_REQUEST_KEYS);

  const integration = composerOwnDataValue(
    input,
    'integration',
    'sceneExecutionPromptCanary',
    false
  );
  if (integration === undefined || integration === null) {
    return disabledSceneExecutionPromptCanaryState();
  }

  inspectComposerRecord(
    integration,
    'sceneExecutionPromptCanary.integration',
    PROMPT_CANARY_INTEGRATION_KEYS
  );
  const flags = composerOwnDataValue(
    integration,
    'flags',
    'sceneExecutionPromptCanary.integration',
    false
  );
  if (!isSceneExecutionPromptCanaryEnabled(flags)) {
    return disabledSceneExecutionPromptCanaryState();
  }
  if (!isSceneExecutionShadowEnabled(flags)) {
    throw composerError(
      'Scene execution prompt canary requires the shadow gate',
      'SCENE_EXECUTION_PROMPT_CANARY_SHADOW_DISABLED',
      [`Set own data flags "${SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key}", "${SCENE_EXECUTION_SHADOW_FEATURE.key}", and "${SCENE_CONTEXT_COMPOSER_FEATURE.key}" to true for an explicit single-scene canary`]
    );
  }
  if (!isSceneContextComposerEnabled(flags)) {
    throw composerError(
      'Scene execution prompt canary requires the packet composer gate',
      'SCENE_EXECUTION_PROMPT_CANARY_CORE_DISABLED',
      [`Set own data flags "${SCENE_EXECUTION_PROMPT_CANARY_FEATURE.key}", "${SCENE_EXECUTION_SHADOW_FEATURE.key}", and "${SCENE_CONTEXT_COMPOSER_FEATURE.key}" to true for an explicit single-scene canary`]
    );
  }

  const shadowState = composerOwnDataValue(
    input,
    'shadowState',
    'sceneExecutionPromptCanary'
  );
  if (
    !shadowState ||
    typeof shadowState !== 'object' ||
    !verifiedSceneExecutionShadowStates.has(shadowState) ||
    shadowState.enabled !== true ||
    shadowState.mode !== 'shadow'
  ) {
    throw composerError(
      'Scene execution prompt canary requires a verified enabled shadow state',
      'SCENE_EXECUTION_PROMPT_CANARY_SHADOW_INVALID',
      ['sceneExecutionPromptCanary.shadowState must be the enabled result returned by prepareSceneExecutionShadowIntegration in this runtime']
    );
  }

  const immutableSceneContract = composerOwnDataValue(
    input,
    'immutableSceneContract',
    'sceneExecutionPromptCanary'
  );
  inspectContractDescriptorSafe(immutableSceneContract);
  if (
    shadowState.source_contract_fingerprint !==
    immutableSceneContract.fingerprint
  ) {
    throw composerError(
      'Scene execution prompt canary contract does not match its shadow state',
      'SCENE_EXECUTION_PROMPT_CANARY_CONTRACT_MISMATCH',
      ['sceneExecutionPromptCanary.shadowState was prepared from a different immutable scene contract']
    );
  }

  const targetSceneId = composerOwnDataValue(
    integration,
    'targetSceneId',
    'sceneExecutionPromptCanary.integration'
  );
  if (
    typeof targetSceneId !== 'string' ||
    !OPAQUE_PROMPT_REFERENCE_PATTERN.test(targetSceneId)
  ) {
    throw composerError(
      'Scene execution prompt canary target is invalid',
      'INVALID_SCENE_EXECUTION_PROMPT_CANARY_TARGET',
      ['sceneExecutionPromptCanary.integration.targetSceneId must be one opaque immutable-contract scene ID']
    );
  }

  const targetBeat = immutableSceneContract.beats.find(
    (beat) => beat.scene_id === targetSceneId
  );
  const targetReport = shadowState.scene_reports.find(
    (report) => report.scene_id === targetSceneId
  );
  if (
    !targetBeat ||
    !targetReport ||
    Number(targetReport.scene_number) !== Number(targetBeat.scene_number)
  ) {
    throw composerError(
      'Scene execution prompt canary target is not covered by the shadow state',
      'SCENE_EXECUTION_PROMPT_CANARY_TARGET_MISMATCH',
      [`No verified shadow projection exists for immutable-contract scene "${targetSceneId}"`]
    );
  }

  return finalizeSceneExecutionPromptCanaryState({
    integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
    enabled: true,
    mode: 'single-scene-canary',
    snapshot_id: targetReport.snapshot_id,
    project_id: targetReport.project_id,
    chapter_id: targetReport.chapter_id,
    source_contract_fingerprint: targetReport.source_contract_fingerprint,
    target_scene_id: targetSceneId,
    packet_id: targetReport.packet_id,
    projection: targetReport.projection,
  });
}

function finalizeSceneExecutionPromptCanaryResult(result) {
  const frozen = deepFreeze(result);
  verifiedSceneExecutionPromptCanaryResults.add(frozen);
  return frozen;
}

export function applySceneExecutionPromptCanary(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionPromptCanaryApply',
    PROMPT_CANARY_APPLY_KEYS
  );
  const state = composerOwnDataValue(
    input,
    'state',
    'sceneExecutionPromptCanaryApply'
  );
  if (
    !state ||
    typeof state !== 'object' ||
    !verifiedSceneExecutionPromptCanaryStates.has(state)
  ) {
    throw composerError(
      'Scene execution prompt canary state is not verified',
      'INVALID_SCENE_EXECUTION_PROMPT_CANARY_STATE',
      ['sceneExecutionPromptCanaryApply.state must be returned by prepareSceneExecutionPromptCanary in this runtime']
    );
  }

  const prompt = composerOwnDataValue(
    input,
    'prompt',
    'sceneExecutionPromptCanaryApply'
  );
  const sceneId = composerOwnDataValue(
    input,
    'sceneId',
    'sceneExecutionPromptCanaryApply'
  );
  if (typeof prompt !== 'string') {
    throw composerError(
      'Scene execution prompt canary prompt must be a string',
      'INVALID_SCENE_EXECUTION_PROMPT_CANARY_INPUT',
      ['sceneExecutionPromptCanaryApply.prompt must be a string']
    );
  }

  if (!state.enabled) {
    return finalizeSceneExecutionPromptCanaryResult({
      integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
      enabled: false,
      applied: false,
      mode: 'disabled',
      target_scene_id: null,
      scene_id: typeof sceneId === 'string' ? sceneId : null,
      packet_id: null,
      prompt,
    });
  }

  if (
    typeof sceneId !== 'string' ||
    !OPAQUE_PROMPT_REFERENCE_PATTERN.test(sceneId)
  ) {
    throw composerError(
      'Scene execution prompt canary scene ID is invalid',
      'INVALID_SCENE_EXECUTION_PROMPT_CANARY_INPUT',
      ['sceneExecutionPromptCanaryApply.sceneId must be one opaque scene ID']
    );
  }

  if (sceneId !== state.target_scene_id) {
    return finalizeSceneExecutionPromptCanaryResult({
      integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
      enabled: true,
      applied: false,
      mode: 'single-scene-canary-bypass',
      target_scene_id: state.target_scene_id,
      scene_id: sceneId,
      packet_id: null,
      prompt,
    });
  }

  if (
    prompt.includes('<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>') ||
    prompt.includes('<<< END VALIDATED SCENE EXECUTION AUTHORITY >>>')
  ) {
    throw composerError(
      'Scene execution prompt canary authority is already present',
      'SCENE_EXECUTION_PROMPT_CANARY_DUPLICATE',
      ['The target prompt already contains a validated Scene Execution Authority marker']
    );
  }

  const rewrittenBase = removeSceneWordTargetDirectives(prompt);
  return finalizeSceneExecutionPromptCanaryResult({
    integration_version: SCENE_EXECUTION_PROMPT_CANARY_VERSION,
    enabled: true,
    applied: true,
    mode: 'single-scene-canary',
    target_scene_id: state.target_scene_id,
    scene_id: sceneId,
    packet_id: state.packet_id,
    source_prompt_fingerprint: hashText(prompt),
    canary_base_prompt_fingerprint: hashText(rewrittenBase.prompt),
    removed_word_target_directive_count:
      rewrittenBase.removed_word_target_directive_count,
    prompt: `${rewrittenBase.prompt}\n\n${state.projection}`,
  });
}

// ─── Stage 6: test-only canary trial and evidence envelope ──────────
// Stage 5 proves that one projection can cross the prompt boundary. Stage 6
// makes that crossing eligible for controlled testing only: a fourth
// independent default-off gate must bind one explicit trial to one project,
// chapter, contract, packet, and scene. Evidence is collected only after the
// selected scene survives the writer's deterministic gates, and contains
// fingerprints/counts rather than raw prompts, prose, or foundation content.

const CANARY_TRIAL_REQUEST_KEYS = new Set([
  'integration',
  'promptCanaryState',
  'immutableSceneContract',
  'projectId',
  'chapterId',
]);

const CANARY_TRIAL_INTEGRATION_KEYS = new Set([
  'flags',
  'mode',
  'trialId',
  'projectId',
  'chapterId',
  'targetSceneId',
]);

const CANARY_EVIDENCE_INPUT_KEYS = new Set([
  'trialState',
  'promptCanaryResult',
  'basePrompt',
  'modelPrompt',
  'acceptedProse',
  'repaired',
  'issues',
]);

const CANARY_EVIDENCE_SET_KEYS = new Set([
  'trialState',
  'evidenceRecords',
]);

const CANARY_TRIAL_MODE = 'test-only-single-scene';
const CANARY_AUTHORITY_BEGIN = '<<< BEGIN VALIDATED SCENE EXECUTION AUTHORITY >>>';
const CANARY_AUTHORITY_END = '<<< END VALIDATED SCENE EXECUTION AUTHORITY >>>';

const verifiedSceneExecutionCanaryTrialStates = new WeakSet();
const verifiedSceneExecutionCanaryEvidenceRecords = new WeakSet();

function finalizeSceneExecutionCanaryTrialState(state) {
  const frozen = deepFreeze(state);
  verifiedSceneExecutionCanaryTrialStates.add(frozen);
  return frozen;
}

function disabledSceneExecutionCanaryTrialState() {
  return finalizeSceneExecutionCanaryTrialState({
    integration_version: SCENE_EXECUTION_CANARY_TRIAL_VERSION,
    enabled: false,
    mode: 'disabled',
    trial_id: null,
    project_id: null,
    chapter_id: null,
    snapshot_id: null,
    target_scene_id: null,
    packet_id: null,
    source_contract_fingerprint: null,
  });
}

function requireOpaqueCanaryTrialReference(value, path, code) {
  if (
    typeof value !== 'string' ||
    !OPAQUE_PROMPT_REFERENCE_PATTERN.test(value)
  ) {
    throw composerError(
      `Invalid canary trial reference at ${path}`,
      code,
      [`${path} must be one nonempty opaque identifier without whitespace or prose`]
    );
  }
  return value;
}

function requireVerifiedPromptCanaryState(promptCanaryState) {
  if (
    !promptCanaryState ||
    typeof promptCanaryState !== 'object' ||
    !verifiedSceneExecutionPromptCanaryStates.has(promptCanaryState)
  ) {
    throw composerError(
      'Scene execution canary trial requires a verified prompt canary state',
      'SCENE_EXECUTION_CANARY_TRIAL_CANARY_INVALID',
      ['sceneExecutionCanaryTrial.promptCanaryState must be returned by prepareSceneExecutionPromptCanary in this runtime']
    );
  }
}

export function prepareSceneExecutionCanaryTrial(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionCanaryTrial',
    CANARY_TRIAL_REQUEST_KEYS
  );

  const integration = composerOwnDataValue(
    input,
    'integration',
    'sceneExecutionCanaryTrial',
    false
  );
  const promptCanaryState = composerOwnDataValue(
    input,
    'promptCanaryState',
    'sceneExecutionCanaryTrial'
  );
  requireVerifiedPromptCanaryState(promptCanaryState);

  if (integration === undefined || integration === null) {
    if (promptCanaryState.enabled) {
      throw composerError(
        'Enabled prompt canary requires a Stage 6 trial envelope',
        'SCENE_EXECUTION_CANARY_TRIAL_REQUIRED',
        [`Provide one explicit "${CANARY_TRIAL_MODE}" trial with the own data flag "${SCENE_EXECUTION_CANARY_TRIAL_FEATURE.key}" enabled`]
      );
    }
    return disabledSceneExecutionCanaryTrialState();
  }

  inspectComposerRecord(
    integration,
    'sceneExecutionCanaryTrial.integration',
    CANARY_TRIAL_INTEGRATION_KEYS
  );
  const flags = composerOwnDataValue(
    integration,
    'flags',
    'sceneExecutionCanaryTrial.integration',
    false
  );
  if (!isSceneExecutionCanaryTrialEnabled(flags)) {
    if (promptCanaryState.enabled) {
      throw composerError(
        'Enabled prompt canary requires the Stage 6 trial gate',
        'SCENE_EXECUTION_CANARY_TRIAL_REQUIRED',
        [`Set the own data flag "${SCENE_EXECUTION_CANARY_TRIAL_FEATURE.key}" to true for one explicit test-only scene trial`]
      );
    }
    return disabledSceneExecutionCanaryTrialState();
  }
  if (
    !isSceneContextComposerEnabled(flags) ||
    !isSceneExecutionShadowEnabled(flags) ||
    !isSceneExecutionPromptCanaryEnabled(flags)
  ) {
    throw composerError(
      'Scene execution canary trial requires all prior gates',
      'SCENE_EXECUTION_CANARY_TRIAL_PRIOR_GATE_DISABLED',
      ['The composer, shadow, prompt canary, and canary trial flags must all be own enumerable data properties set to true']
    );
  }
  if (!promptCanaryState.enabled || promptCanaryState.mode !== 'single-scene-canary') {
    throw composerError(
      'Scene execution canary trial requires an enabled Stage 5 canary',
      'SCENE_EXECUTION_CANARY_TRIAL_CANARY_DISABLED',
      ['Prepare one verified enabled single-scene prompt canary before preparing its trial envelope']
    );
  }

  const mode = composerOwnDataValue(
    integration,
    'mode',
    'sceneExecutionCanaryTrial.integration'
  );
  if (mode !== CANARY_TRIAL_MODE) {
    throw composerError(
      'Scene execution canary trial mode is not test-only',
      'INVALID_SCENE_EXECUTION_CANARY_TRIAL_MODE',
      [`sceneExecutionCanaryTrial.integration.mode must equal "${CANARY_TRIAL_MODE}"`]
    );
  }

  const trialId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(
      integration,
      'trialId',
      'sceneExecutionCanaryTrial.integration'
    ),
    'sceneExecutionCanaryTrial.integration.trialId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_ID'
  );
  const requestedProjectId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(
      integration,
      'projectId',
      'sceneExecutionCanaryTrial.integration'
    ),
    'sceneExecutionCanaryTrial.integration.projectId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_BINDING'
  );
  const requestedChapterId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(
      integration,
      'chapterId',
      'sceneExecutionCanaryTrial.integration'
    ),
    'sceneExecutionCanaryTrial.integration.chapterId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_BINDING'
  );
  const targetSceneId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(
      integration,
      'targetSceneId',
      'sceneExecutionCanaryTrial.integration'
    ),
    'sceneExecutionCanaryTrial.integration.targetSceneId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_BINDING'
  );
  const projectId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(input, 'projectId', 'sceneExecutionCanaryTrial'),
    'sceneExecutionCanaryTrial.projectId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_BINDING'
  );
  const chapterId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(input, 'chapterId', 'sceneExecutionCanaryTrial'),
    'sceneExecutionCanaryTrial.chapterId',
    'INVALID_SCENE_EXECUTION_CANARY_TRIAL_BINDING'
  );

  if (requestedProjectId !== projectId || requestedChapterId !== chapterId) {
    throw composerError(
      'Scene execution canary trial does not match the active project and chapter',
      'SCENE_EXECUTION_CANARY_TRIAL_SCOPE_MISMATCH',
      ['The test-only trial projectId and chapterId must exactly match the active writer inputs']
    );
  }
  if (targetSceneId !== promptCanaryState.target_scene_id) {
    throw composerError(
      'Scene execution canary trial target does not match its prompt canary',
      'SCENE_EXECUTION_CANARY_TRIAL_TARGET_MISMATCH',
      ['The test-only trial targetSceneId must exactly match the verified Stage 5 target scene']
    );
  }

  const immutableSceneContract = composerOwnDataValue(
    input,
    'immutableSceneContract',
    'sceneExecutionCanaryTrial'
  );
  inspectContractDescriptorSafe(immutableSceneContract);
  if (
    promptCanaryState.project_id !== projectId ||
    promptCanaryState.chapter_id !== chapterId ||
    promptCanaryState.source_contract_fingerprint !==
      immutableSceneContract.fingerprint
  ) {
    throw composerError(
      'Scene execution canary trial provenance does not match the active runtime',
      'SCENE_EXECUTION_CANARY_TRIAL_PROVENANCE_MISMATCH',
      ['The branded Stage 5 snapshot, project, chapter, and contract provenance must exactly match the active writer inputs']
    );
  }
  if (!immutableSceneContract.beats.some((beat) => beat.scene_id === targetSceneId)) {
    throw composerError(
      'Scene execution canary trial target is outside the immutable contract',
      'SCENE_EXECUTION_CANARY_TRIAL_TARGET_MISMATCH',
      [`No immutable-contract scene matches "${targetSceneId}"`]
    );
  }

  return finalizeSceneExecutionCanaryTrialState({
    integration_version: SCENE_EXECUTION_CANARY_TRIAL_VERSION,
    enabled: true,
    mode: CANARY_TRIAL_MODE,
    trial_id: trialId,
    project_id: projectId,
    chapter_id: chapterId,
    snapshot_id: promptCanaryState.snapshot_id,
    target_scene_id: targetSceneId,
    packet_id: promptCanaryState.packet_id,
    source_contract_fingerprint: immutableSceneContract.fingerprint,
  });
}

function countMarker(value, marker) {
  let count = 0;
  let index = 0;
  while ((index = value.indexOf(marker, index)) !== -1) {
    count += 1;
    index += marker.length;
  }
  return count;
}

function countCanaryEvidenceWords(value) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function finalizeSceneExecutionCanaryEvidenceRecord(record) {
  const frozen = deepFreeze(record);
  verifiedSceneExecutionCanaryEvidenceRecords.add(frozen);
  return frozen;
}

export function collectSceneExecutionCanaryEvidence(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionCanaryEvidence',
    CANARY_EVIDENCE_INPUT_KEYS
  );

  const trialState = composerOwnDataValue(
    input,
    'trialState',
    'sceneExecutionCanaryEvidence'
  );
  if (
    !trialState ||
    typeof trialState !== 'object' ||
    !verifiedSceneExecutionCanaryTrialStates.has(trialState) ||
    !trialState.enabled
  ) {
    throw composerError(
      'Canary evidence requires a verified enabled Stage 6 trial',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_TRIAL',
      ['sceneExecutionCanaryEvidence.trialState must be returned by prepareSceneExecutionCanaryTrial in this runtime']
    );
  }

  const promptCanaryResult = composerOwnDataValue(
    input,
    'promptCanaryResult',
    'sceneExecutionCanaryEvidence'
  );
  if (
    !promptCanaryResult ||
    typeof promptCanaryResult !== 'object' ||
    !verifiedSceneExecutionPromptCanaryResults.has(promptCanaryResult) ||
    !promptCanaryResult.applied
  ) {
    throw composerError(
      'Canary evidence requires the verified applied Stage 5 result',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_RESULT',
      ['sceneExecutionCanaryEvidence.promptCanaryResult must be the applied result returned by applySceneExecutionPromptCanary in this runtime']
    );
  }
  if (
    promptCanaryResult.scene_id !== trialState.target_scene_id ||
    promptCanaryResult.packet_id !== trialState.packet_id
  ) {
    throw composerError(
      'Canary evidence result does not match the trial target',
      'SCENE_EXECUTION_CANARY_EVIDENCE_SCOPE_MISMATCH',
      ['The applied scene ID and packet ID must exactly match the verified Stage 6 trial']
    );
  }

  const basePrompt = composerOwnDataValue(
    input,
    'basePrompt',
    'sceneExecutionCanaryEvidence'
  );
  const modelPrompt = composerOwnDataValue(
    input,
    'modelPrompt',
    'sceneExecutionCanaryEvidence'
  );
  const acceptedProse = composerOwnDataValue(
    input,
    'acceptedProse',
    'sceneExecutionCanaryEvidence'
  );
  const repaired = composerOwnDataValue(
    input,
    'repaired',
    'sceneExecutionCanaryEvidence'
  );
  const issues = composerOwnDataValue(
    input,
    'issues',
    'sceneExecutionCanaryEvidence'
  );

  if (
    typeof basePrompt !== 'string' ||
    typeof modelPrompt !== 'string' ||
    typeof acceptedProse !== 'string' ||
    acceptedProse.trim() === '' ||
    typeof repaired !== 'boolean' ||
    !Array.isArray(issues)
  ) {
    throw composerError(
      'Canary evidence inputs are invalid',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_INPUT',
      ['basePrompt, modelPrompt, and nonempty acceptedProse must be strings; repaired must be boolean; issues must be an array']
    );
  }
  descriptorSafeInspect(issues, 'sceneExecutionCanaryEvidence.issues', new Set());
  if (issues.some((issue) => typeof issue !== 'string')) {
    throw composerError(
      'Canary evidence issues must be strings',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_INPUT',
      ['sceneExecutionCanaryEvidence.issues may contain only strings']
    );
  }
  const rewrittenBase = removeSceneWordTargetDirectives(basePrompt);
  if (
    promptCanaryResult.prompt !== modelPrompt ||
    promptCanaryResult.source_prompt_fingerprint !== hashText(basePrompt) ||
    promptCanaryResult.canary_base_prompt_fingerprint !==
      hashText(rewrittenBase.prompt) ||
    promptCanaryResult.removed_word_target_directive_count !==
      rewrittenBase.removed_word_target_directive_count ||
    !modelPrompt.startsWith(`${rewrittenBase.prompt}\n\n`) ||
    countMarker(basePrompt, CANARY_AUTHORITY_BEGIN) !== 0 ||
    countMarker(basePrompt, CANARY_AUTHORITY_END) !== 0 ||
    countMarker(modelPrompt, CANARY_AUTHORITY_BEGIN) !== 1 ||
    countMarker(modelPrompt, CANARY_AUTHORITY_END) !== 1
  ) {
    throw composerError(
      'Canary evidence cannot prove one exact rewrite and authority injection',
      'SCENE_EXECUTION_CANARY_EVIDENCE_PROMPT_MISMATCH',
      ['The model prompt must be the verified canary result, remove only deterministic scene word-target directives from the source prompt, and contain exactly one matched authority marker pair']
    );
  }

  const authorityProjection = modelPrompt.slice(
    rewrittenBase.prompt.length + 2
  );
  return finalizeSceneExecutionCanaryEvidenceRecord({
    evidence_version: SCENE_EXECUTION_CANARY_EVIDENCE_VERSION,
    status: 'accepted',
    mode: CANARY_TRIAL_MODE,
    trial_id: trialState.trial_id,
    project_id: trialState.project_id,
    chapter_id: trialState.chapter_id,
    snapshot_id: trialState.snapshot_id,
    scene_id: trialState.target_scene_id,
    packet_id: trialState.packet_id,
    source_contract_fingerprint: trialState.source_contract_fingerprint,
    base_prompt_fingerprint: hashText(basePrompt),
    canary_base_prompt_fingerprint: hashText(rewrittenBase.prompt),
    model_prompt_fingerprint: hashText(modelPrompt),
    authority_projection_fingerprint: hashText(authorityProjection),
    removed_word_target_directive_count:
      rewrittenBase.removed_word_target_directive_count,
    accepted_prose_fingerprint: hashText(acceptedProse),
    accepted_word_count: countCanaryEvidenceWords(acceptedProse),
    repaired,
    issue_count: issues.length,
    authority_marker_pairs: 1,
    raw_content_included: false,
  });
}

export function finalizeSceneExecutionCanaryEvidence(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionCanaryEvidenceSet',
    CANARY_EVIDENCE_SET_KEYS
  );
  const trialState = composerOwnDataValue(
    input,
    'trialState',
    'sceneExecutionCanaryEvidenceSet'
  );
  if (
    !trialState ||
    typeof trialState !== 'object' ||
    !verifiedSceneExecutionCanaryTrialStates.has(trialState)
  ) {
    throw composerError(
      'Canary evidence set requires a verified Stage 6 trial',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_SET',
      ['sceneExecutionCanaryEvidenceSet.trialState must be returned by prepareSceneExecutionCanaryTrial in this runtime']
    );
  }
  const evidenceRecords = composerOwnDataValue(
    input,
    'evidenceRecords',
    'sceneExecutionCanaryEvidenceSet'
  );
  if (!Array.isArray(evidenceRecords)) {
    throw composerError(
      'Canary evidence set must be an array',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_SET',
      ['sceneExecutionCanaryEvidenceSet.evidenceRecords must be an array']
    );
  }
  descriptorSafeInspect(
    evidenceRecords,
    'sceneExecutionCanaryEvidenceSet.evidenceRecords',
    new Set()
  );

  if (!trialState.enabled) {
    if (evidenceRecords.length !== 0) {
      throw composerError(
        'Disabled canary trial cannot return evidence',
        'SCENE_EXECUTION_CANARY_EVIDENCE_CARDINALITY',
        ['A disabled Stage 6 trial must produce zero evidence records']
      );
    }
    return Object.freeze([]);
  }
  if (evidenceRecords.length !== 1) {
    throw composerError(
      'Enabled canary trial must return exactly one evidence record',
      'SCENE_EXECUTION_CANARY_EVIDENCE_CARDINALITY',
      [`Expected exactly one evidence record for "${trialState.target_scene_id}", received ${evidenceRecords.length}`]
    );
  }

  const [record] = evidenceRecords;
  if (
    !record ||
    typeof record !== 'object' ||
    !verifiedSceneExecutionCanaryEvidenceRecords.has(record) ||
    record.trial_id !== trialState.trial_id ||
    record.scene_id !== trialState.target_scene_id ||
    record.packet_id !== trialState.packet_id
  ) {
    throw composerError(
      'Canary evidence record does not match the verified trial',
      'INVALID_SCENE_EXECUTION_CANARY_EVIDENCE_SET',
      ['The one evidence record must be returned by collectSceneExecutionCanaryEvidence for this exact trial']
    );
  }
  return Object.freeze(evidenceRecords.slice());
}

// ─── Stage 7: isolated legacy-versus-canary evidence comparison ────
// Stage 6 proves that one selected scene can cross the model boundary and
// produce content-free evidence. Stage 7 adds a separately gated offline
// comparison against the exact legacy prompt. It can recommend more test-only
// evidence collection, but one scene can never authorize a broader rollout.

const LEGACY_EVIDENCE_INPUT_KEYS = new Set([
  'trialState',
  'basePrompt',
  'modelPrompt',
  'acceptedProse',
  'repaired',
  'issues',
]);

const CANARY_COMPARISON_REQUEST_KEYS = new Set([
  'integration',
  'trialState',
  'legacyEvidence',
  'canaryEvidence',
]);

const CANARY_COMPARISON_INTEGRATION_KEYS = new Set([
  'flags',
  'mode',
  'comparisonId',
  'trialId',
  'projectId',
  'chapterId',
  'targetSceneId',
]);

const CANARY_COMPARISON_MODE = 'test-only-paired-evaluation';
const verifiedSceneExecutionLegacyEvidenceRecords = new WeakSet();
const verifiedSceneExecutionCanaryComparisonRecords = new WeakSet();

function requireVerifiedEnabledCanaryTrialState(trialState, path, code) {
  if (
    !trialState ||
    typeof trialState !== 'object' ||
    !verifiedSceneExecutionCanaryTrialStates.has(trialState) ||
    !trialState.enabled
  ) {
    throw composerError(
      `Invalid Stage 7 trial state at ${path}`,
      code,
      [`${path} must be an enabled state returned by prepareSceneExecutionCanaryTrial in this runtime`]
    );
  }
}

function inspectCanaryEvidenceIssues(issues, path, code) {
  if (!Array.isArray(issues)) {
    throw composerError(
      `Invalid evidence issues at ${path}`,
      code,
      [`${path} must be an array of strings`]
    );
  }
  descriptorSafeInspect(issues, path, new Set());
  if (issues.some((issue) => typeof issue !== 'string')) {
    throw composerError(
      `Invalid evidence issue value at ${path}`,
      code,
      [`${path} may contain only strings`]
    );
  }
}

function finalizeSceneExecutionLegacyEvidenceRecord(record) {
  const frozen = deepFreeze(record);
  verifiedSceneExecutionLegacyEvidenceRecords.add(frozen);
  return frozen;
}

export function collectSceneExecutionLegacyEvidence(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionLegacyEvidence',
    LEGACY_EVIDENCE_INPUT_KEYS
  );

  const trialState = composerOwnDataValue(
    input,
    'trialState',
    'sceneExecutionLegacyEvidence'
  );
  requireVerifiedEnabledCanaryTrialState(
    trialState,
    'sceneExecutionLegacyEvidence.trialState',
    'INVALID_SCENE_EXECUTION_LEGACY_EVIDENCE_TRIAL'
  );

  const basePrompt = composerOwnDataValue(
    input,
    'basePrompt',
    'sceneExecutionLegacyEvidence'
  );
  const modelPrompt = composerOwnDataValue(
    input,
    'modelPrompt',
    'sceneExecutionLegacyEvidence'
  );
  const acceptedProse = composerOwnDataValue(
    input,
    'acceptedProse',
    'sceneExecutionLegacyEvidence'
  );
  const repaired = composerOwnDataValue(
    input,
    'repaired',
    'sceneExecutionLegacyEvidence'
  );
  const issues = composerOwnDataValue(
    input,
    'issues',
    'sceneExecutionLegacyEvidence'
  );

  if (
    typeof basePrompt !== 'string' ||
    basePrompt.trim() === '' ||
    typeof modelPrompt !== 'string' ||
    typeof acceptedProse !== 'string' ||
    acceptedProse.trim() === '' ||
    typeof repaired !== 'boolean'
  ) {
    throw composerError(
      'Legacy comparison evidence inputs are invalid',
      'INVALID_SCENE_EXECUTION_LEGACY_EVIDENCE_INPUT',
      ['basePrompt, modelPrompt, and acceptedProse must be nonempty strings; repaired must be boolean']
    );
  }
  inspectCanaryEvidenceIssues(
    issues,
    'sceneExecutionLegacyEvidence.issues',
    'INVALID_SCENE_EXECUTION_LEGACY_EVIDENCE_INPUT'
  );
  if (
    modelPrompt !== basePrompt ||
    countMarker(basePrompt, CANARY_AUTHORITY_BEGIN) !== 0 ||
    countMarker(basePrompt, CANARY_AUTHORITY_END) !== 0
  ) {
    throw composerError(
      'Legacy comparison evidence does not preserve the exact base prompt',
      'SCENE_EXECUTION_LEGACY_EVIDENCE_PROMPT_MISMATCH',
      ['The legacy model prompt must equal the base prompt byte-for-byte and contain no Scene Execution Authority markers']
    );
  }

  return finalizeSceneExecutionLegacyEvidenceRecord({
    evidence_version: SCENE_EXECUTION_LEGACY_EVIDENCE_VERSION,
    status: 'accepted',
    mode: 'legacy-control',
    trial_id: trialState.trial_id,
    project_id: trialState.project_id,
    chapter_id: trialState.chapter_id,
    snapshot_id: trialState.snapshot_id,
    scene_id: trialState.target_scene_id,
    packet_id: trialState.packet_id,
    source_contract_fingerprint: trialState.source_contract_fingerprint,
    base_prompt_fingerprint: hashText(basePrompt),
    model_prompt_fingerprint: hashText(modelPrompt),
    accepted_prose_fingerprint: hashText(acceptedProse),
    accepted_word_count: countCanaryEvidenceWords(acceptedProse),
    repaired,
    issue_count: issues.length,
    authority_marker_pairs: 0,
    raw_content_included: false,
  });
}

function finalizeSceneExecutionCanaryComparisonRecord(record) {
  const frozen = deepFreeze(record);
  verifiedSceneExecutionCanaryComparisonRecords.add(frozen);
  return frozen;
}

function assertComparisonScopeMatchesTrial(record, trialState, label) {
  if (
    record.trial_id !== trialState.trial_id ||
    record.project_id !== trialState.project_id ||
    record.chapter_id !== trialState.chapter_id ||
    record.snapshot_id !== trialState.snapshot_id ||
    record.scene_id !== trialState.target_scene_id ||
    record.packet_id !== trialState.packet_id ||
    record.source_contract_fingerprint !== trialState.source_contract_fingerprint
  ) {
    throw composerError(
      `${label} does not match the Stage 7 trial scope`,
      'SCENE_EXECUTION_CANARY_COMPARISON_SCOPE_MISMATCH',
      [`${label} must match the exact trial, project, chapter, snapshot, scene, packet, and contract fingerprint`]
    );
  }
}

export function evaluateSceneExecutionCanaryComparison(input) {
  inspectComposerRecord(
    input,
    'sceneExecutionCanaryComparison',
    CANARY_COMPARISON_REQUEST_KEYS
  );

  const integration = composerOwnDataValue(
    input,
    'integration',
    'sceneExecutionCanaryComparison'
  );
  inspectComposerRecord(
    integration,
    'sceneExecutionCanaryComparison.integration',
    CANARY_COMPARISON_INTEGRATION_KEYS
  );
  const flags = composerOwnDataValue(
    integration,
    'flags',
    'sceneExecutionCanaryComparison.integration'
  );
  if (!isSceneExecutionCanaryComparisonEnabled(flags)) {
    throw composerError(
      'Scene execution canary comparison is disabled',
      'SCENE_EXECUTION_CANARY_COMPARISON_DISABLED',
      [`Set the own data flag "${SCENE_EXECUTION_CANARY_COMPARISON_FEATURE.key}" to true for one explicit test-only paired evaluation`]
    );
  }
  if (
    !isSceneContextComposerEnabled(flags) ||
    !isSceneExecutionShadowEnabled(flags) ||
    !isSceneExecutionPromptCanaryEnabled(flags) ||
    !isSceneExecutionCanaryTrialEnabled(flags)
  ) {
    throw composerError(
      'Scene execution canary comparison requires all prior gates',
      'SCENE_EXECUTION_CANARY_COMPARISON_PRIOR_GATE_DISABLED',
      ['The composer, shadow, prompt canary, trial, and comparison flags must all be own enumerable data properties set to true']
    );
  }

  const mode = composerOwnDataValue(
    integration,
    'mode',
    'sceneExecutionCanaryComparison.integration'
  );
  if (mode !== CANARY_COMPARISON_MODE) {
    throw composerError(
      'Scene execution canary comparison mode is not test-only',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_MODE',
      [`sceneExecutionCanaryComparison.integration.mode must equal "${CANARY_COMPARISON_MODE}"`]
    );
  }

  const comparisonId = requireOpaqueCanaryTrialReference(
    composerOwnDataValue(
      integration,
      'comparisonId',
      'sceneExecutionCanaryComparison.integration'
    ),
    'sceneExecutionCanaryComparison.integration.comparisonId',
    'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_ID'
  );
  const trialState = composerOwnDataValue(
    input,
    'trialState',
    'sceneExecutionCanaryComparison'
  );
  requireVerifiedEnabledCanaryTrialState(
    trialState,
    'sceneExecutionCanaryComparison.trialState',
    'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_TRIAL'
  );

  const requestedScope = {
    trial_id: requireOpaqueCanaryTrialReference(
      composerOwnDataValue(
        integration,
        'trialId',
        'sceneExecutionCanaryComparison.integration'
      ),
      'sceneExecutionCanaryComparison.integration.trialId',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_SCOPE'
    ),
    project_id: requireOpaqueCanaryTrialReference(
      composerOwnDataValue(
        integration,
        'projectId',
        'sceneExecutionCanaryComparison.integration'
      ),
      'sceneExecutionCanaryComparison.integration.projectId',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_SCOPE'
    ),
    chapter_id: requireOpaqueCanaryTrialReference(
      composerOwnDataValue(
        integration,
        'chapterId',
        'sceneExecutionCanaryComparison.integration'
      ),
      'sceneExecutionCanaryComparison.integration.chapterId',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_SCOPE'
    ),
    scene_id: requireOpaqueCanaryTrialReference(
      composerOwnDataValue(
        integration,
        'targetSceneId',
        'sceneExecutionCanaryComparison.integration'
      ),
      'sceneExecutionCanaryComparison.integration.targetSceneId',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_SCOPE'
    ),
  };
  if (
    requestedScope.trial_id !== trialState.trial_id ||
    requestedScope.project_id !== trialState.project_id ||
    requestedScope.chapter_id !== trialState.chapter_id ||
    requestedScope.scene_id !== trialState.target_scene_id
  ) {
    throw composerError(
      'Scene execution canary comparison scope does not match its trial',
      'SCENE_EXECUTION_CANARY_COMPARISON_SCOPE_MISMATCH',
      ['The comparison trialId, projectId, chapterId, and targetSceneId must exactly match the verified Stage 6 trial']
    );
  }

  const legacyEvidence = composerOwnDataValue(
    input,
    'legacyEvidence',
    'sceneExecutionCanaryComparison'
  );
  const canaryEvidence = composerOwnDataValue(
    input,
    'canaryEvidence',
    'sceneExecutionCanaryComparison'
  );
  if (
    !legacyEvidence ||
    typeof legacyEvidence !== 'object' ||
    !verifiedSceneExecutionLegacyEvidenceRecords.has(legacyEvidence) ||
    !canaryEvidence ||
    typeof canaryEvidence !== 'object' ||
    !verifiedSceneExecutionCanaryEvidenceRecords.has(canaryEvidence)
  ) {
    throw composerError(
      'Scene execution canary comparison requires branded evidence',
      'INVALID_SCENE_EXECUTION_CANARY_COMPARISON_EVIDENCE',
      ['legacyEvidence and canaryEvidence must be returned by their Stage 7 and Stage 6 collectors in this runtime']
    );
  }
  assertComparisonScopeMatchesTrial(
    legacyEvidence,
    trialState,
    'Legacy evidence'
  );
  assertComparisonScopeMatchesTrial(
    canaryEvidence,
    trialState,
    'Canary evidence'
  );

  if (
    legacyEvidence.base_prompt_fingerprint !==
      canaryEvidence.base_prompt_fingerprint ||
    legacyEvidence.model_prompt_fingerprint !==
      legacyEvidence.base_prompt_fingerprint ||
    (canaryEvidence.removed_word_target_directive_count === 0 &&
      canaryEvidence.canary_base_prompt_fingerprint !==
        canaryEvidence.base_prompt_fingerprint) ||
    (canaryEvidence.removed_word_target_directive_count > 0 &&
      canaryEvidence.canary_base_prompt_fingerprint ===
        canaryEvidence.base_prompt_fingerprint) ||
    canaryEvidence.model_prompt_fingerprint ===
      canaryEvidence.canary_base_prompt_fingerprint ||
    legacyEvidence.authority_marker_pairs !== 0 ||
    canaryEvidence.authority_marker_pairs !== 1 ||
    legacyEvidence.raw_content_included !== false ||
    canaryEvidence.raw_content_included !== false
  ) {
    throw composerError(
      'Scene execution canary comparison cannot prove a matched prompt pair',
      'SCENE_EXECUTION_CANARY_COMPARISON_PROMPT_MISMATCH',
      ['Both paths must share one source-prompt fingerprint; legacy must preserve it exactly, while canary may remove only attested scene word-target directives before adding exactly one authority marker pair']
    );
  }

  const issueDelta =
    canaryEvidence.issue_count - legacyEvidence.issue_count;
  const repairDelta =
    Number(canaryEvidence.repaired) - Number(legacyEvidence.repaired);
  let mechanicalOutcome = 'neutral-signal';
  let additionalTestOnlyTrialsSupported = true;
  let recommendation = 'collect-live-model-paired-evidence';
  if (issueDelta > 0 || repairDelta > 0) {
    mechanicalOutcome = 'canary-regression-signal';
    additionalTestOnlyTrialsSupported = false;
    recommendation = 'stop-test-only-canary';
  } else if (issueDelta < 0 || repairDelta < 0) {
    mechanicalOutcome = 'canary-improvement-signal';
  }

  return finalizeSceneExecutionCanaryComparisonRecord({
    comparison_version: SCENE_EXECUTION_CANARY_COMPARISON_VERSION,
    status: 'evaluated',
    mode: CANARY_COMPARISON_MODE,
    comparison_id: comparisonId,
    trial_id: trialState.trial_id,
    project_id: trialState.project_id,
    chapter_id: trialState.chapter_id,
    snapshot_id: trialState.snapshot_id,
    scene_id: trialState.target_scene_id,
    packet_id: trialState.packet_id,
    source_contract_fingerprint: trialState.source_contract_fingerprint,
    base_prompt_fingerprint: legacyEvidence.base_prompt_fingerprint,
    canary_base_prompt_fingerprint:
      canaryEvidence.canary_base_prompt_fingerprint,
    removed_word_target_directive_count:
      canaryEvidence.removed_word_target_directive_count,
    legacy_accepted_prose_fingerprint:
      legacyEvidence.accepted_prose_fingerprint,
    canary_accepted_prose_fingerprint:
      canaryEvidence.accepted_prose_fingerprint,
    accepted_outputs_identical:
      legacyEvidence.accepted_prose_fingerprint ===
      canaryEvidence.accepted_prose_fingerprint,
    legacy_word_count: legacyEvidence.accepted_word_count,
    canary_word_count: canaryEvidence.accepted_word_count,
    word_count_delta:
      canaryEvidence.accepted_word_count -
      legacyEvidence.accepted_word_count,
    legacy_repaired: legacyEvidence.repaired,
    canary_repaired: canaryEvidence.repaired,
    repair_delta: repairDelta,
    legacy_issue_count: legacyEvidence.issue_count,
    canary_issue_count: canaryEvidence.issue_count,
    issue_count_delta: issueDelta,
    mechanical_outcome: mechanicalOutcome,
    broader_rollout_supported: false,
    additional_test_only_trials_supported:
      additionalTestOnlyTrialsSupported,
    live_model_evidence_required: true,
    rollout_decision: 'hold',
    recommendation,
    raw_content_included: false,
  });
}

// ─── Stage 9: default-off scene execution acceptance gate (Checkpoint 1) ───

export const PREPARE_ACCEPTANCE_INPUT_KEYS = Object.freeze([
  'flags',
  'snapshot',
  'immutableSceneContract',
  'shadowState',
]);
const PREPARE_ACCEPTANCE_INPUT_KEY_LOOKUP = new Set(PREPARE_ACCEPTANCE_INPUT_KEYS);

export const DISABLED_ACCEPTANCE_STATE_KEYS = Object.freeze([
  'version',
  'enabled',
  'contract_fingerprint',
  'records_by_scene_id',
]);
const DISABLED_ACCEPTANCE_STATE_KEY_LOOKUP = new Set(DISABLED_ACCEPTANCE_STATE_KEYS);

export const ENABLED_ACCEPTANCE_STATE_KEYS = Object.freeze([
  'version',
  'enabled',
  'contract_fingerprint',
  'records_by_scene_id',
]);
const ENABLED_ACCEPTANCE_STATE_KEY_LOOKUP = new Set(ENABLED_ACCEPTANCE_STATE_KEYS);

export const ENABLED_SCENE_RECORD_KEYS = Object.freeze([
  'beat_index',
  'scene_number',
  'scene_id',
  'packet_id',
  'packet',
  'shadow_report',
]);
const ENABLED_SCENE_RECORD_KEY_LOOKUP = new Set(ENABLED_SCENE_RECORD_KEYS);

export const PACKET_FUTURE_EVENT_KEYS = Object.freeze(['event_id']);
const PACKET_FUTURE_EVENT_KEY_LOOKUP = new Set(PACKET_FUTURE_EVENT_KEYS);

export const PRIVATE_FUTURE_AUTHORITY_ENTRY_KEYS = Object.freeze([
  'event_id',
  'text',
]);
const PRIVATE_FUTURE_AUTHORITY_ENTRY_KEY_LOOKUP = new Set(PRIVATE_FUTURE_AUTHORITY_ENTRY_KEYS);

export const SNAPSHOT_KEYS = Object.freeze([
  'version',
  'snapshotId',
  'project',
  'chapters',
  'chapter',
  'previousChapter',
]);
const SNAPSHOT_KEY_LOOKUP = new Set(SNAPSHOT_KEYS);

export const IMMUTABLE_CONTRACT_KEYS = Object.freeze([
  'version',
  'fingerprint',
  'chapterNumber',
  'beats',
]);

export const MANDATORY_BEAT_KEYS = Object.freeze([
  'scene_number',
  'scene_id',
  'scene_goal',
  'entry_state',
  'required_events',
  'forbidden_events',
  'exit_state',
  'continuity_dependencies',
]);

const verifiedSceneAcceptanceErrors = new WeakSet();
const verifiedSceneExecutionAcceptanceStates = new WeakSet();
const PRIVATE_FUTURE_AUTHORITY_MAP = new WeakMap();

function sceneAcceptanceError(message, code, details = []) {
  const err = new Error(message);
  err.code = code;
  err.details = details;
  verifiedSceneAcceptanceErrors.add(err);
  return err;
}

function isSceneAcceptanceError(err) {
  return err && typeof err === 'object' && verifiedSceneAcceptanceErrors.has(err);
}

function finalizeSceneExecutionAcceptanceState(state) {
  const frozen = deepFreeze(state);
  verifiedSceneExecutionAcceptanceStates.add(frozen);
  return frozen;
}

function disabledSceneExecutionAcceptanceState() {
  const state = Object.create(null);
  state.version = SCENE_EXECUTION_ACCEPTANCE_GATE_VERSION;
  state.enabled = false;
  state.contract_fingerprint = null;
  state.records_by_scene_id = Object.freeze(Object.create(null));
  inspectComposerRecord(state, 'disabledSceneExecutionAcceptanceState', DISABLED_ACCEPTANCE_STATE_KEY_LOOKUP);
  return finalizeSceneExecutionAcceptanceState(state);
}

function enabledSceneExecutionAcceptanceState(contractFingerprint, recordsBySceneId) {
  const state = Object.create(null);
  state.version = SCENE_EXECUTION_ACCEPTANCE_GATE_VERSION;
  state.enabled = true;
  state.contract_fingerprint = contractFingerprint;
  state.records_by_scene_id = deepFreeze(recordsBySceneId);
  inspectComposerRecord(state, 'enabledSceneExecutionAcceptanceState', ENABLED_ACCEPTANCE_STATE_KEY_LOOKUP);
  return finalizeSceneExecutionAcceptanceState(state);
}

function inspectPrepareAcceptanceInputRecord(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw sceneAcceptanceError('Malformed prepare acceptance input record', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) {
      throw sceneAcceptanceError('Prepare acceptance input must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const symbolKeys = Object.getOwnPropertySymbols(input);
    if (symbolKeys.length > 0) {
      throw sceneAcceptanceError('Symbol properties prohibited in prepare acceptance input', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const stringKeys = Object.getOwnPropertyNames(input);
    if (stringKeys.length !== PREPARE_ACCEPTANCE_INPUT_KEYS.length) {
      throw sceneAcceptanceError('Prepare acceptance input property count mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const extracted = Object.create(null);
    for (let i = 0; i < PREPARE_ACCEPTANCE_INPUT_KEYS.length; i++) {
      const key = PREPARE_ACCEPTANCE_INPUT_KEYS[i];
      if (!PREPARE_ACCEPTANCE_INPUT_KEY_LOOKUP.has(key)) {
        throw sceneAcceptanceError('Unknown property in prepare acceptance input', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const desc = Object.getOwnPropertyDescriptor(input, key);
      if (!desc || desc.get || desc.set || !desc.enumerable) {
        throw sceneAcceptanceError(`Invalid descriptor for ${key} in prepare acceptance input`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      extracted[key] = desc.value;
    }
    return extracted;
  } catch (err) {
    if (isSceneAcceptanceError(err)) throw err;
    throw sceneAcceptanceError('Sanitized prepare acceptance input inspection failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
}

function canonicalizeJsonValueDescriptorSafe(val, seenObjects = new WeakSet()) {
  if (val === null) return null;
  const type = typeof val;
  if (type === 'boolean' || type === 'string') return val;
  if (type === 'number') {
    if (!Number.isFinite(val)) {
      throw sceneAcceptanceError('Non-finite numbers prohibited in contract JSON payload', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    return val;
  }
  if (type !== 'object') {
    throw sceneAcceptanceError(`Unsupported type ${type} in contract JSON payload`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }

  if (seenObjects.has(val)) {
    throw sceneAcceptanceError('Cyclic references prohibited in contract JSON payload', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  seenObjects.add(val);

  if (Array.isArray(val)) {
    if (Object.getPrototypeOf(val) !== Array.prototype || !Object.isFrozen(val) || Object.getOwnPropertySymbols(val).length > 0) {
      throw sceneAcceptanceError('Arrays in contract payload must be frozen standard arrays', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const arrLenDesc = Object.getOwnPropertyDescriptor(val, 'length');
    if (!arrLenDesc || arrLenDesc.get || arrLenDesc.set || arrLenDesc.enumerable !== false || arrLenDesc.configurable !== false || arrLenDesc.writable !== false) {
      throw sceneAcceptanceError('Invalid array length descriptor in contract payload', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const aLen = arrLenDesc.value;
    if (!Number.isInteger(aLen) || aLen < 0 || Object.getOwnPropertyNames(val).length !== aLen + 1) {
      throw sceneAcceptanceError('Invalid array length or custom properties in contract payload', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const canonicalArr = new Array(aLen);
    for (let i = 0; i < aLen; i++) {
      const itemDesc = Object.getOwnPropertyDescriptor(val, String(i));
      if (!itemDesc || itemDesc.get || itemDesc.set || !itemDesc.enumerable || itemDesc.configurable !== false || itemDesc.writable !== false) {
        throw sceneAcceptanceError(`Invalid array item descriptor at index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      canonicalArr[i] = canonicalizeJsonValueDescriptorSafe(itemDesc.value, seenObjects);
    }
    return Object.freeze(canonicalArr);
  }

  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) {
    throw sceneAcceptanceError('Objects in contract payload must be plain objects', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  if (!Object.isFrozen(val) || Object.getOwnPropertySymbols(val).length > 0) {
    throw sceneAcceptanceError('Objects in contract payload must be frozen plain objects without symbols', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }

  const objKeys = Object.getOwnPropertyNames(val);
  const canonicalObj = Object.create(null);
  for (let kIdx = 0; kIdx < objKeys.length; kIdx++) {
    const pKey = objKeys[kIdx];
    const pDesc = Object.getOwnPropertyDescriptor(val, pKey);
    if (!pDesc || pDesc.get || pDesc.set || !pDesc.enumerable) {
      throw sceneAcceptanceError(`Invalid property descriptor for key ${pKey} in contract payload`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    canonicalObj[pKey] = canonicalizeJsonValueDescriptorSafe(pDesc.value, seenObjects);
  }
  return Object.freeze(canonicalObj);
}

function inspectAndCanonicalizeContractDescriptorSafe(immutableSceneContract) {
  try {
    if (!immutableSceneContract || typeof immutableSceneContract !== 'object' || Array.isArray(immutableSceneContract) || !Object.isFrozen(immutableSceneContract)) {
      throw sceneAcceptanceError('Contract root must be a frozen plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const proto = Object.getPrototypeOf(immutableSceneContract);
    if (proto !== Object.prototype && proto !== null) {
      throw sceneAcceptanceError('Invalid contract prototype', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    if (Object.getOwnPropertySymbols(immutableSceneContract).length > 0) {
      throw sceneAcceptanceError('Symbol properties prohibited on contract root', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const rootKeys = Object.getOwnPropertyNames(immutableSceneContract);
    if (rootKeys.length !== IMMUTABLE_CONTRACT_KEYS.length) {
      throw sceneAcceptanceError('Contract root property count mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    for (let rIdx = 0; rIdx < IMMUTABLE_CONTRACT_KEYS.length; rIdx++) {
      if (rootKeys[rIdx] !== IMMUTABLE_CONTRACT_KEYS[rIdx]) {
        throw sceneAcceptanceError('Contract root property key or order mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
    }

    const verDesc = Object.getOwnPropertyDescriptor(immutableSceneContract, 'version');
    const fpDesc = Object.getOwnPropertyDescriptor(immutableSceneContract, 'fingerprint');
    const cnDesc = Object.getOwnPropertyDescriptor(immutableSceneContract, 'chapterNumber');
    const bDesc = Object.getOwnPropertyDescriptor(immutableSceneContract, 'beats');

    if (!verDesc || !fpDesc || !cnDesc || !bDesc || verDesc.get || fpDesc.get || cnDesc.get || bDesc.get || !verDesc.enumerable || !fpDesc.enumerable || !cnDesc.enumerable || !bDesc.enumerable) {
      throw sceneAcceptanceError('Invalid contract root descriptors', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    if (verDesc.value !== EXPECTED_SCENE_CONTRACT_VERSION) {
      throw sceneAcceptanceError('Contract version mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    if (typeof fpDesc.value !== 'string' || fpDesc.value.trim().length === 0 || !Number.isInteger(cnDesc.value) || cnDesc.value <= 0) {
      throw sceneAcceptanceError('Invalid contract metadata values', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const rawBeats = bDesc.value;
    if (!Array.isArray(rawBeats) || Object.getPrototypeOf(rawBeats) !== Array.prototype || !Object.isFrozen(rawBeats) || Object.getOwnPropertySymbols(rawBeats).length > 0) {
      throw sceneAcceptanceError('Contract beats must be a frozen standard dense array', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const beatsLengthDesc = Object.getOwnPropertyDescriptor(rawBeats, 'length');
    if (!beatsLengthDesc || beatsLengthDesc.get || beatsLengthDesc.set || beatsLengthDesc.enumerable !== false || beatsLengthDesc.configurable !== false || beatsLengthDesc.writable !== false) {
      throw sceneAcceptanceError('Invalid contract beats length descriptor', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const numBeats = beatsLengthDesc.value;
    if (!Number.isInteger(numBeats) || numBeats <= 0 || Object.getOwnPropertyNames(rawBeats).length !== numBeats + 1) {
      throw sceneAcceptanceError('Invalid contract beats count or custom properties', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const extractedBeats = new Array(numBeats);
    for (let i = 0; i < numBeats; i++) {
      const beatIndexDesc = Object.getOwnPropertyDescriptor(rawBeats, String(i));
      if (!beatIndexDesc || beatIndexDesc.get || beatIndexDesc.set || !beatIndexDesc.enumerable || beatIndexDesc.configurable !== false || beatIndexDesc.writable !== false) {
        throw sceneAcceptanceError(`Invalid descriptor for beat index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const rawBeat = beatIndexDesc.value;
      if (!rawBeat || typeof rawBeat !== 'object' || Array.isArray(rawBeat) || !Object.isFrozen(rawBeat)) {
        throw sceneAcceptanceError(`Beat at index ${i} must be a frozen plain object`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const bProto = Object.getPrototypeOf(rawBeat);
      if (bProto !== Object.prototype && bProto !== null) {
        throw sceneAcceptanceError(`Invalid beat prototype at index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      if (Object.getOwnPropertySymbols(rawBeat).length > 0) {
        throw sceneAcceptanceError(`Symbol properties prohibited on beat at index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      const beatKeys = Object.getOwnPropertyNames(rawBeat);
      for (const mKey of MANDATORY_BEAT_KEYS) {
        if (!beatKeys.includes(mKey)) {
          throw sceneAcceptanceError(`Missing mandatory beat key ${mKey} at index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
      }

      const canonicalBeat = Object.create(null);
      for (let kIdx = 0; kIdx < beatKeys.length; kIdx++) {
        const bKey = beatKeys[kIdx];
        const pDesc = Object.getOwnPropertyDescriptor(rawBeat, bKey);
        if (!pDesc || pDesc.get || pDesc.set || !pDesc.enumerable) {
          throw sceneAcceptanceError(`Invalid descriptor for beat key ${bKey} at index ${i}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }

        const val = canonicalizeJsonValueDescriptorSafe(pDesc.value);
        if (bKey === 'required_events') {
          if (!Array.isArray(val) || val.length === 0) {
            throw sceneAcceptanceError('required_events must be a nonempty array', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
          }
          for (let rIdx = 0; rIdx < val.length; rIdx++) {
            if (typeof val[rIdx] !== 'string' || val[rIdx].trim().length === 0) {
              throw sceneAcceptanceError('required_events items must be non-whitespace strings', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
            }
          }
        }
        canonicalBeat[bKey] = val;
      }
      extractedBeats[i] = Object.freeze(canonicalBeat);
    }

    const canonicalContract = Object.create(null);
    canonicalContract.version = verDesc.value;
    canonicalContract.fingerprint = fpDesc.value;
    canonicalContract.chapterNumber = cnDesc.value;
    canonicalContract.beats = Object.freeze(extractedBeats);
    return Object.freeze(canonicalContract);
  } catch (err) {
    if (isSceneAcceptanceError(err)) throw err;
    throw sceneAcceptanceError('Contract descriptor extraction failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
}

function validatePrivateFutureAuthority(entries) {
  if (!Array.isArray(entries) || !Object.isFrozen(entries) || Object.getPrototypeOf(entries) !== Array.prototype) {
    throw sceneAcceptanceError('Private future authority must be a frozen dense array', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  if (Object.getOwnPropertySymbols(entries).length > 0) {
    throw sceneAcceptanceError('Private future authority symbol properties prohibited', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  const lDesc = Object.getOwnPropertyDescriptor(entries, 'length');
  if (!lDesc || lDesc.get || lDesc.set || lDesc.enumerable !== false || lDesc.configurable !== false || lDesc.writable !== false) {
    throw sceneAcceptanceError('Private future authority frozen length descriptor invalid', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  const len = lDesc.value;
  if (!Number.isInteger(len) || len < 0) {
    throw sceneAcceptanceError('Private future authority length value invalid', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  if (Object.getOwnPropertyNames(entries).length !== len + 1) {
    throw sceneAcceptanceError('Private future authority custom properties prohibited', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  for (let i = 0; i < len; i++) {
    const desc = Object.getOwnPropertyDescriptor(entries, String(i));
    if (!desc || desc.get || desc.set || !desc.enumerable) {
      throw sceneAcceptanceError('Private future authority index descriptor invalid', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const entry = desc.value;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Object.isFrozen(entry) || Object.getPrototypeOf(entry) !== null) {
      throw sceneAcceptanceError('Private future authority entry must be a frozen null-prototype object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    inspectComposerRecord(entry, 'validatePrivateFutureAuthority.entry', PRIVATE_FUTURE_AUTHORITY_ENTRY_KEY_LOOKUP);
    const evId = composerOwnDataValue(entry, 'event_id', 'validatePrivateFutureAuthority.entry');
    const text = composerOwnDataValue(entry, 'text', 'validatePrivateFutureAuthority.entry');
    if (typeof evId !== 'string' || evId.trim().length === 0 || typeof text !== 'string' || text.trim().length === 0) {
      throw sceneAcceptanceError('Private future authority entry strings must be non-whitespace', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
  }
  return entries;
}

function inspectSnapshotRecordSafe(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw sceneAcceptanceError('Snapshot must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  const proto = Object.getPrototypeOf(snapshot);
  if (proto !== Object.prototype && proto !== null) {
    throw sceneAcceptanceError('Invalid snapshot prototype', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  if (Object.getOwnPropertySymbols(snapshot).length > 0) {
    throw sceneAcceptanceError('Symbol properties prohibited on snapshot', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  const keys = Object.getOwnPropertyNames(snapshot);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!SNAPSHOT_KEY_LOOKUP.has(k)) {
      throw sceneAcceptanceError(`Unknown key ${k} in snapshot`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const desc = Object.getOwnPropertyDescriptor(snapshot, k);
    if (!desc || desc.get || desc.set || !desc.enumerable) {
      throw sceneAcceptanceError(`Invalid descriptor for key ${k} in snapshot`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
  }

  const version = composerOwnDataValue(snapshot, 'version', 'inspectSnapshotRecordSafe');
  const snapshotId = composerOwnDataValue(snapshot, 'snapshotId', 'inspectSnapshotRecordSafe');
  const project = composerOwnDataValue(snapshot, 'project', 'inspectSnapshotRecordSafe');
  const chapter = composerOwnDataValue(snapshot, 'chapter', 'inspectSnapshotRecordSafe');

  return { version, snapshotId, project, chapter };
}

export function prepareSceneExecutionAcceptanceState(input) {
  try {
    const extractedInput = inspectPrepareAcceptanceInputRecord(input);
    const flags = extractedInput.flags;
    const snapshot = extractedInput.snapshot;
    const immutableSceneContract = extractedInput.immutableSceneContract;
    const shadowState = extractedInput.shadowState;

    const decision = getSceneExecutionAcceptanceGateDecision(flags);
    if (decision === 'disabled') {
      return disabledSceneExecutionAcceptanceState();
    }
    if (decision === 'prerequisite_disabled') {
      throw sceneAcceptanceError('Acceptance gate prerequisite disabled', 'SCENE_ACCEPTANCE_PREREQUISITE_DISABLED', []);
    }

    if (!shadowState || typeof shadowState !== 'object' || !verifiedSceneExecutionShadowStates.has(shadowState) || shadowState.enabled !== true) {
      throw sceneAcceptanceError('Invalid shadow state', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const canonicalContract = inspectAndCanonicalizeContractDescriptorSafe(immutableSceneContract);
    const contractFingerprint = canonicalContract.fingerprint;
    const contractChapterNumber = canonicalContract.chapterNumber;
    const beats = canonicalContract.beats;

    const extractedSnap = inspectSnapshotRecordSafe(snapshot);

    if (extractedSnap.version !== EXPECTED_SNAPSHOT_VERSION) {
      throw sceneAcceptanceError('Snapshot version mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const snapshotId = extractedSnap.snapshotId;
    if (typeof snapshotId !== 'string' || snapshotId.trim().length === 0) {
      throw sceneAcceptanceError('Snapshot snapshotId must be a non-whitespace string', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    let projectId, chapterId, chNum;
    try {
      const project = extractedSnap.project;
      if (!project || typeof project !== 'object' || Array.isArray(project)) {
        throw sceneAcceptanceError('Snapshot project must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const projProto = Object.getPrototypeOf(project);
      if (projProto !== Object.prototype && projProto !== null) {
        throw sceneAcceptanceError('Invalid snapshot project prototype', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const projIdDesc = Object.getOwnPropertyDescriptor(project, 'id');
      if (!projIdDesc || projIdDesc.get || projIdDesc.set || !projIdDesc.enumerable) {
        throw sceneAcceptanceError('Invalid snapshot project id descriptor', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      projectId = projIdDesc.value;
      if (typeof projectId !== 'string' || projectId.trim().length === 0) {
        throw sceneAcceptanceError('Snapshot project.id must be a non-whitespace string', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      const chapter = extractedSnap.chapter;
      if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) {
        throw sceneAcceptanceError('Snapshot chapter must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const chProto = Object.getPrototypeOf(chapter);
      if (chProto !== Object.prototype && chProto !== null) {
        throw sceneAcceptanceError('Invalid snapshot chapter prototype', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const chIdDesc = Object.getOwnPropertyDescriptor(chapter, 'id');
      if (!chIdDesc || chIdDesc.get || chIdDesc.set || !chIdDesc.enumerable) {
        throw sceneAcceptanceError('Invalid snapshot chapter id descriptor', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      chapterId = chIdDesc.value;
      if (typeof chapterId !== 'string' || chapterId.trim().length === 0) {
        throw sceneAcceptanceError('Snapshot chapter.id must be a non-whitespace string', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      const chDesc = Object.getOwnPropertyDescriptor(chapter, 'chapter_number');
      if (chDesc) {
        if (chDesc.get || chDesc.set || !chDesc.enumerable) {
          throw sceneAcceptanceError('Invalid snapshot chapter_number descriptor', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
        chNum = chDesc.value;
      } else {
        const numDesc = Object.getOwnPropertyDescriptor(chapter, 'number');
        if (!numDesc || numDesc.get || numDesc.set || !numDesc.enumerable) {
          throw sceneAcceptanceError('Missing or invalid snapshot chapter number descriptor', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
        chNum = numDesc.value;
      }
      if (!Number.isInteger(chNum) || chNum <= 0) {
        throw sceneAcceptanceError('Snapshot chapter number must be a finite positive integer', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
    } catch (err) {
      if (isSceneAcceptanceError(err)) throw err;
      throw sceneAcceptanceError('Snapshot project or chapter reflection failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    if (chNum !== contractChapterNumber || shadowState.source_contract_fingerprint !== contractFingerprint) {
      throw sceneAcceptanceError('Contract provenance mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const reports = shadowState.scene_reports;
    if (!Array.isArray(beats) || !Array.isArray(reports) || beats.length !== reports.length || beats.length === 0) {
      throw sceneAcceptanceError('Beat count mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const recordsBySceneId = Object.create(null);
    const privateAuthorityTable = Object.create(null);
    const canonicalRecords = [];
    const canonicalAuthorities = [];
    const expectedAuthorityRecords = [];
    const seenPacketIds = new Set();

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const report = reports[i];
      const packet = report.packet;

      if (!packet || typeof packet !== 'object') {
        throw sceneAcceptanceError('Missing retained packet in shadow report', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      if (seenPacketIds.has(packet.packet_id)) {
        throw sceneAcceptanceError('Duplicate packet ID across scene records', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      seenPacketIds.add(packet.packet_id);

      if (
        report.snapshot_id !== snapshotId ||
        report.snapshot_id !== packet.snapshot_id ||
        packet.snapshot_id !== snapshotId ||
        report.project_id !== projectId ||
        report.project_id !== packet.project_id ||
        packet.project_id !== projectId ||
        report.chapter_id !== chapterId ||
        report.chapter_id !== packet.chapter_id ||
        packet.chapter_id !== chapterId ||
        report.packet_id !== packet.packet_id ||
        packet.chapter_number !== chNum ||
        chNum !== contractChapterNumber ||
        shadowState.source_contract_fingerprint !== contractFingerprint ||
        report.source_contract_fingerprint !== contractFingerprint ||
        packet.source_contract_fingerprint !== contractFingerprint ||
        beat.scene_id !== report.scene_id ||
        beat.scene_id !== packet.scene_id ||
        beat.scene_number !== report.scene_number ||
        beat.scene_number !== packet.scene_number
      ) {
        throw sceneAcceptanceError('Full 19-point pairwise provenance mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      validateSceneExecutionPacket(packet, canonicalContract);

      const record = Object.create(null);
      record.beat_index = i;
      record.scene_number = beat.scene_number;
      record.scene_id = beat.scene_id;
      record.packet_id = packet.packet_id;
      record.packet = packet;
      record.shadow_report = report;
      
      inspectComposerRecord(record, 'prepareSceneExecutionAcceptanceState.record', ENABLED_SCENE_RECORD_KEY_LOOKUP);
      const frozenRecord = deepFreeze(record);
      canonicalRecords.push(frozenRecord);
      recordsBySceneId[beat.scene_id] = frozenRecord;

      const privateEntries = [];
      const expectedEntries = [];
      const futureEvents = packet.future_reserved_events;
      if (!Array.isArray(futureEvents)) {
        throw sceneAcceptanceError('Future reserved events must be a dense array', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      for (let fIdx = 0; fIdx < futureEvents.length; fIdx++) {
        const fEv = futureEvents[fIdx];
        if (!fEv || typeof fEv !== 'object' || Array.isArray(fEv)) {
          throw sceneAcceptanceError('Future event must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
        inspectComposerRecord(fEv, 'prepareSceneExecutionAcceptanceState.future_event', PACKET_FUTURE_EVENT_KEY_LOOKUP);
        const eventId = composerOwnDataValue(fEv, 'event_id', 'prepareSceneExecutionAcceptanceState.future_event');

        let resolvedText = null;
        for (let laterIdx = i + 1; laterIdx < beats.length; laterIdx++) {
          const laterBeat = beats[laterIdx];
          const reqEvs = laterBeat.required_events;
          if (Array.isArray(reqEvs)) {
            for (let rIdx = 0; rIdx < reqEvs.length; rIdx++) {
              const reqText = reqEvs[rIdx];
              const expectedId = generateDeterministicEventId(projectId, chapterId, laterBeat.scene_id, 'required', rIdx + 1, reqText);
              if (expectedId === eventId) {
                resolvedText = reqText;
                break;
              }
            }
          }
          if (resolvedText) break;
        }

        if (!resolvedText) {
          throw sceneAcceptanceError('Unresolvable future event ID', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }

        const pEntry = Object.create(null);
        pEntry.event_id = eventId;
        pEntry.text = resolvedText;
        inspectComposerRecord(pEntry, 'prepareSceneExecutionAcceptanceState.private_future_entry', PRIVATE_FUTURE_AUTHORITY_ENTRY_KEY_LOOKUP);
        const frozenPEntry = deepFreeze(pEntry);
        privateEntries.push(frozenPEntry);
        expectedEntries.push({ event_id: eventId, text: resolvedText, entry: frozenPEntry });
      }
      const frozenAuthArray = validatePrivateFutureAuthority(deepFreeze(privateEntries));
      canonicalAuthorities.push(frozenAuthArray);
      expectedAuthorityRecords.push(expectedEntries);
      privateAuthorityTable[beat.scene_id] = frozenAuthArray;
    }

    if (Object.getPrototypeOf(recordsBySceneId) !== null || Object.getOwnPropertySymbols(recordsBySceneId).length > 0) {
      throw sceneAcceptanceError('Invalid recordsBySceneId prototype or symbols', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const recKeys = Object.getOwnPropertyNames(recordsBySceneId);
    if (recKeys.length !== beats.length) {
      throw sceneAcceptanceError('recordsBySceneId cardinality mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    for (let i = 0; i < beats.length; i++) {
      const expectedSceneId = beats[i].scene_id;
      if (recKeys[i] !== expectedSceneId) {
        throw sceneAcceptanceError('recordsBySceneId key order mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const desc = Object.getOwnPropertyDescriptor(recordsBySceneId, expectedSceneId);
      if (!desc || desc.get || desc.set || !desc.enumerable) {
        throw sceneAcceptanceError('Invalid descriptor in recordsBySceneId', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const recVal = desc.value;
      if (
        recVal !== canonicalRecords[i] ||
        !recVal || typeof recVal !== 'object' || Object.getPrototypeOf(recVal) !== null ||
        !Object.isFrozen(recVal) || recVal.beat_index !== i || recVal.packet !== reports[i].packet ||
        recVal.shadow_report !== reports[i] || recVal.packet_id !== recVal.packet.packet_id ||
        recVal.scene_id !== recVal.packet.scene_id || recVal.scene_id !== reports[i].scene_id ||
        recVal.scene_number !== recVal.packet.scene_number || recVal.scene_number !== reports[i].scene_number
      ) {
        throw sceneAcceptanceError('recordsBySceneId record value invariance failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      const rStringKeys = Object.getOwnPropertyNames(recVal);
      if (rStringKeys.length !== ENABLED_SCENE_RECORD_KEYS.length) {
        throw sceneAcceptanceError('Scene record key cardinality mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      for (let kIdx = 0; kIdx < ENABLED_SCENE_RECORD_KEYS.length; kIdx++) {
        const rKey = ENABLED_SCENE_RECORD_KEYS[kIdx];
        const rDesc = Object.getOwnPropertyDescriptor(recVal, rKey);
        if (!rDesc || rDesc.get || rDesc.set || !rDesc.enumerable) {
          throw sceneAcceptanceError(`Invalid descriptor for scene record property ${rKey}`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
      }
    }

    const frozenPrivateAuthorityTable = deepFreeze(privateAuthorityTable);

    if (!Object.isFrozen(frozenPrivateAuthorityTable) || Object.getPrototypeOf(frozenPrivateAuthorityTable) !== null || Object.getOwnPropertySymbols(frozenPrivateAuthorityTable).length > 0) {
      throw sceneAcceptanceError('Invalid frozen privateAuthorityTable prototype or symbols', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const privKeys = Object.getOwnPropertyNames(frozenPrivateAuthorityTable);
    if (privKeys.length !== beats.length) {
      throw sceneAcceptanceError('privateAuthorityTable cardinality mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    for (let i = 0; i < beats.length; i++) {
      const expectedSceneId = beats[i].scene_id;
      if (privKeys[i] !== expectedSceneId) {
        throw sceneAcceptanceError('privateAuthorityTable key order mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const pDesc = Object.getOwnPropertyDescriptor(frozenPrivateAuthorityTable, expectedSceneId);
      if (!pDesc || pDesc.get || pDesc.set || !pDesc.enumerable || pDesc.configurable !== false || pDesc.writable !== false) {
        throw sceneAcceptanceError('Invalid descriptor in frozen privateAuthorityTable', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const authArray = pDesc.value;
      if (authArray !== canonicalAuthorities[i] || !Object.isFrozen(authArray) || Object.getPrototypeOf(authArray) !== Array.prototype) {
        throw sceneAcceptanceError('privateAuthorityTable array identity or freezing mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }

      const expEntries = expectedAuthorityRecords[i];
      if (authArray.length !== expEntries.length) {
        throw sceneAcceptanceError('Post-freeze authority length mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      for (let eIdx = 0; eIdx < expEntries.length; eIdx++) {
        const itemDesc = Object.getOwnPropertyDescriptor(authArray, String(eIdx));
        if (!itemDesc || itemDesc.get || itemDesc.set || !itemDesc.enumerable || itemDesc.configurable !== false || itemDesc.writable !== false) {
          throw sceneAcceptanceError(`Invalid post-freeze entry descriptor at [${i}][${eIdx}]`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
        const itemVal = itemDesc.value;
        const expVal = expEntries[eIdx];
        if (itemVal !== expVal.entry || itemVal.event_id !== expVal.event_id || itemVal.text !== expVal.text) {
          throw sceneAcceptanceError(`Post-freeze entry value mismatch at [${i}][${eIdx}]`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
        }
      }
    }

    const state = enabledSceneExecutionAcceptanceState(contractFingerprint, recordsBySceneId);
    PRIVATE_FUTURE_AUTHORITY_MAP.set(state, frozenPrivateAuthorityTable);
    return state;
  } catch (err) {
    if (isSceneAcceptanceError(err)) throw err;
    throw sceneAcceptanceError('Sanitized prepareSceneExecutionAcceptanceState boundary failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
}

// ─── Stage 9: default-off scene execution acceptance gate (Checkpoint 2: Clean Audit Path) ───

export const SCENE_EXECUTION_ACCEPTANCE_EVALUATION_VERSION = 'scene-execution-acceptance-evaluation-v1';

export const EVALUATE_ACCEPTANCE_INPUT_KEYS = Object.freeze([
  'flags',
  'acceptanceState',
  'targetSceneId',
  'prose',
  'runners',
]);
const EVALUATE_ACCEPTANCE_INPUT_KEY_LOOKUP = new Set(EVALUATE_ACCEPTANCE_INPUT_KEYS);

export const AUDIT_REQUEST_KEYS = Object.freeze([
  'version',
  'contract_fingerprint',
  'scene_id',
  'scene_number',
  'packet',
  'prose',
  'private_future_authority',
]);
const AUDIT_REQUEST_KEY_LOOKUP = new Set(AUDIT_REQUEST_KEYS);

export const AUDIT_RESPONSE_KEYS = Object.freeze([
  'version',
  'contract_fingerprint',
  'scene_id',
  'scene_number',
  'packet_id',
  'status',
  'issues',
  'coverage',
]);
const AUDIT_RESPONSE_KEY_LOOKUP = new Set(AUDIT_RESPONSE_KEYS);

export const AUDIT_ISSUE_KEYS = Object.freeze([
  'code',
  'classification',
  'excerpt',
  'offset',
]);
const AUDIT_ISSUE_KEY_LOOKUP = new Set(AUDIT_ISSUE_KEYS);

export const AUDIT_COVERAGE_KEYS = Object.freeze([
  'entry_state_satisfied',
  'exit_state_attained',
  'required_events_satisfied',
  'forbidden_events_avoided',
  'continuity_satisfied',
]);
const AUDIT_COVERAGE_KEY_LOOKUP = new Set(AUDIT_COVERAGE_KEYS);

export const ALLOWED_COVERAGE_STATUSES = Object.freeze([
  'verified',
  'unverified',
  'failed',
]);
const ALLOWED_COVERAGE_STATUS_LOOKUP = new Set(ALLOWED_COVERAGE_STATUSES);

export const EVALUATOR_RESULT_KEYS = Object.freeze([
  'version',
  'enabled',
  'mode',
  'status',
  'contract_fingerprint',
  'scene_id',
  'scene_number',
  'packet_id',
  'audit',
  'repair',
  'final_prose',
  'issues',
]);
const EVALUATOR_RESULT_KEY_LOOKUP = new Set(EVALUATOR_RESULT_KEYS);

const verifiedSceneExecutionAcceptanceResults = new WeakSet();

function finalizeSceneExecutionAcceptanceResult(result) {
  const frozen = deepFreeze(result);
  verifiedSceneExecutionAcceptanceResults.add(frozen);
  return frozen;
}

function disabledSceneExecutionAcceptanceResult() {
  const result = Object.create(null);
  result.version = SCENE_EXECUTION_ACCEPTANCE_EVALUATION_VERSION;
  result.enabled = false;
  result.mode = 'disabled';
  result.status = 'bypassed';
  result.contract_fingerprint = null;
  result.scene_id = null;
  result.scene_number = null;
  result.packet_id = null;
  result.audit = null;
  result.repair = null;
  result.final_prose = null;
  result.issues = Object.freeze([]);
  inspectComposerRecord(result, 'disabledSceneExecutionAcceptanceResult', EVALUATOR_RESULT_KEY_LOOKUP);
  return finalizeSceneExecutionAcceptanceResult(result);
}

function acceptedCleanSceneExecutionAcceptanceResult({ contractFingerprint, sceneId, sceneNumber, packetId, auditResponse, prose }) {
  const result = Object.create(null);
  result.version = SCENE_EXECUTION_ACCEPTANCE_EVALUATION_VERSION;
  result.enabled = true;
  result.mode = 'acceptance';
  result.status = 'accepted';
  result.contract_fingerprint = contractFingerprint;
  result.scene_id = sceneId;
  result.scene_number = sceneNumber;
  result.packet_id = packetId;
  result.audit = auditResponse;
  result.repair = null;
  result.final_prose = prose;
  result.issues = Object.freeze([]);

  inspectComposerRecord(result, 'acceptedCleanSceneExecutionAcceptanceResult', EVALUATOR_RESULT_KEY_LOOKUP);
  return finalizeSceneExecutionAcceptanceResult(result);
}

function inspectEvaluateAcceptanceInputRecord(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw sceneAcceptanceError('Malformed evaluate acceptance input record', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const proto = Object.getPrototypeOf(input);
    if (proto !== Object.prototype && proto !== null) {
      throw sceneAcceptanceError('Evaluate acceptance input must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const symbolKeys = Object.getOwnPropertySymbols(input);
    if (symbolKeys.length > 0) {
      throw sceneAcceptanceError('Symbol properties prohibited in evaluate acceptance input', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const stringKeys = Object.getOwnPropertyNames(input);
    if (stringKeys.length !== EVALUATE_ACCEPTANCE_INPUT_KEYS.length) {
      throw sceneAcceptanceError('Evaluate acceptance input property count mismatch', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const extracted = Object.create(null);
    for (let i = 0; i < EVALUATE_ACCEPTANCE_INPUT_KEYS.length; i++) {
      const key = EVALUATE_ACCEPTANCE_INPUT_KEYS[i];
      if (!EVALUATE_ACCEPTANCE_INPUT_KEY_LOOKUP.has(key)) {
        throw sceneAcceptanceError('Unknown property in evaluate acceptance input', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      const desc = Object.getOwnPropertyDescriptor(input, key);
      if (!desc || desc.get || desc.set || !desc.enumerable) {
        throw sceneAcceptanceError(`Invalid descriptor for ${key} in evaluate acceptance input`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
      }
      extracted[key] = desc.value;
    }
    return extracted;
  } catch (err) {
    if (isSceneAcceptanceError(err)) throw err;
    throw sceneAcceptanceError('Sanitized evaluate acceptance input inspection failure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
}

function finalizeAuditRunnerRequest(req) {
  if (!req || typeof req !== 'object' || Array.isArray(req)) {
    throw sceneAcceptanceError('Audit request must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
  }
  inspectComposerRecord(req, 'finalizeAuditRunnerRequest', AUDIT_REQUEST_KEY_LOOKUP);
  return deepFreeze(req);
}

function inspectAuditResponseRecordSafe(rawResponse, auditRequest) {
  if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
    throw sceneAcceptanceError('Audit response must be a plain object', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  const proto = Object.getPrototypeOf(rawResponse);
  if (proto !== Object.prototype && proto !== null) {
    throw sceneAcceptanceError('Invalid audit response prototype', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  if (Object.getOwnPropertySymbols(rawResponse).length > 0) {
    throw sceneAcceptanceError('Symbol properties prohibited on audit response', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  const keys = Object.getOwnPropertyNames(rawResponse);
  if (keys.length !== AUDIT_RESPONSE_KEYS.length) {
    throw sceneAcceptanceError('Audit response key count mismatch', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!AUDIT_RESPONSE_KEY_LOOKUP.has(k)) {
      throw sceneAcceptanceError(`Unknown property ${k} in audit response`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
    const desc = Object.getOwnPropertyDescriptor(rawResponse, k);
    if (!desc || desc.get || desc.set || !desc.enumerable) {
      throw sceneAcceptanceError(`Invalid descriptor for property ${k} in audit response`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
  }

  const ver = composerOwnDataValue(rawResponse, 'version', 'inspectAuditResponseRecordSafe');
  const fp = composerOwnDataValue(rawResponse, 'contract_fingerprint', 'inspectAuditResponseRecordSafe');
  const sId = composerOwnDataValue(rawResponse, 'scene_id', 'inspectAuditResponseRecordSafe');
  const sNum = composerOwnDataValue(rawResponse, 'scene_number', 'inspectAuditResponseRecordSafe');
  const pId = composerOwnDataValue(rawResponse, 'packet_id', 'inspectAuditResponseRecordSafe');
  const status = composerOwnDataValue(rawResponse, 'status', 'inspectAuditResponseRecordSafe');
  const issues = composerOwnDataValue(rawResponse, 'issues', 'inspectAuditResponseRecordSafe');
  const coverage = composerOwnDataValue(rawResponse, 'coverage', 'inspectAuditResponseRecordSafe');

  if (
    ver !== SCENE_EXECUTION_ACCEPTANCE_GATE_VERSION ||
    fp !== auditRequest.contract_fingerprint ||
    sId !== auditRequest.scene_id ||
    sNum !== auditRequest.scene_number ||
    pId !== auditRequest.packet.packet_id
  ) {
    throw sceneAcceptanceError('Audit response identity mismatch', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }

  if (status === 'audit_failed') {
    throw sceneAcceptanceError('auditRunner reported audit failure', 'SCENE_ACCEPTANCE_AUDIT_FAILED', []);
  }
  if (status !== 'clean' && status !== 'issues_found') {
    throw sceneAcceptanceError(`Invalid audit response status: ${status}`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }

  if (!Array.isArray(issues) || !Object.isFrozen(issues)) {
    throw sceneAcceptanceError('Audit response issues must be a frozen array', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }

  if (status === 'clean') {
    if (issues.length !== 0) {
      throw sceneAcceptanceError('Clean audit response cannot contain issues', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
  }

  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
    throw sceneAcceptanceError('Audit response coverage must be a plain object', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  const covProto = Object.getPrototypeOf(coverage);
  if (covProto !== Object.prototype && covProto !== null) {
    throw sceneAcceptanceError('Invalid coverage object prototype', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  if (Object.getOwnPropertySymbols(coverage).length > 0) {
    throw sceneAcceptanceError('Symbol properties prohibited on coverage object', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  const covKeys = Object.getOwnPropertyNames(coverage);
  if (covKeys.length !== AUDIT_COVERAGE_KEYS.length) {
    throw sceneAcceptanceError('Coverage key count mismatch', 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
  }
  for (let cIdx = 0; cIdx < covKeys.length; cIdx++) {
    const cKey = AUDIT_COVERAGE_KEYS[cIdx];
    if (!covKeys.includes(cKey)) {
      throw sceneAcceptanceError(`Missing coverage key: ${cKey}`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
    const cDesc = Object.getOwnPropertyDescriptor(coverage, cKey);
    if (!cDesc || cDesc.get || cDesc.set || !cDesc.enumerable) {
      throw sceneAcceptanceError(`Invalid descriptor for coverage property ${cKey}`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
    if (!ALLOWED_COVERAGE_STATUS_LOOKUP.has(cDesc.value)) {
      throw sceneAcceptanceError(`Invalid status for coverage property ${cKey}: ${cDesc.value}`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
    if (status === 'clean' && cDesc.value === 'failed') {
      throw sceneAcceptanceError(`Clean audit response cannot contain failed coverage status for ${cKey}`, 'SCENE_ACCEPTANCE_AUDIT_MALFORMED', []);
    }
  }

  return deepFreeze(rawResponse);
}

export async function evaluateSceneExecutionAcceptance(input) {
  try {
    const extractedInput = inspectEvaluateAcceptanceInputRecord(input);
    const flags = extractedInput.flags;
    const acceptanceState = extractedInput.acceptanceState;
    const targetSceneId = extractedInput.targetSceneId;
    const prose = extractedInput.prose;
    const runners = extractedInput.runners;

    const decision = getSceneExecutionAcceptanceGateDecision(flags);
    if (decision === 'disabled') {
      return disabledSceneExecutionAcceptanceResult();
    }
    if (decision === 'prerequisite_disabled') {
      throw sceneAcceptanceError('Acceptance gate prerequisite disabled', 'SCENE_ACCEPTANCE_PREREQUISITE_DISABLED', []);
    }

    if (!acceptanceState || typeof acceptanceState !== 'object' || !verifiedSceneExecutionAcceptanceStates.has(acceptanceState) || acceptanceState.enabled !== true) {
      throw sceneAcceptanceError('Invalid or unbranded acceptance state', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    if (typeof targetSceneId !== 'string' || targetSceneId.trim().length === 0) {
      throw sceneAcceptanceError('targetSceneId must be a non-whitespace string', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const recordsBySceneId = acceptanceState.records_by_scene_id;
    if (!recordsBySceneId || typeof recordsBySceneId !== 'object' || Object.getPrototypeOf(recordsBySceneId) !== null) {
      throw sceneAcceptanceError('Invalid records_by_scene_id map in acceptance state', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    const sceneRecordDesc = Object.getOwnPropertyDescriptor(recordsBySceneId, targetSceneId);
    if (!sceneRecordDesc || sceneRecordDesc.get || sceneRecordDesc.set || !sceneRecordDesc.enumerable) {
      throw sceneAcceptanceError(`Target scene record ${targetSceneId} not found in acceptance state`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const sceneRecord = sceneRecordDesc.value;
    if (!sceneRecord || typeof sceneRecord !== 'object' || Object.getPrototypeOf(sceneRecord) !== null || !Object.isFrozen(sceneRecord)) {
      throw sceneAcceptanceError('Invalid target scene record structure', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    inspectComposerRecord(sceneRecord, 'evaluateSceneExecutionAcceptance.sceneRecord', ENABLED_SCENE_RECORD_KEY_LOOKUP);

    if (typeof prose !== 'string' || prose.trim().length === 0 || prose.length > 200000) {
      throw sceneAcceptanceError('Prose must be a non-whitespace string under 200,000 characters', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }

    if (!runners || typeof runners !== 'object' || Array.isArray(runners)) {
      throw sceneAcceptanceError('runners must be a plain object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const runnersProto = Object.getPrototypeOf(runners);
    if (runnersProto !== Object.prototype && runnersProto !== null) {
      throw sceneAcceptanceError('Invalid runners object prototype', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    if (Object.getOwnPropertySymbols(runners).length > 0) {
      throw sceneAcceptanceError('Symbol properties prohibited on runners object', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const auditRunnerDesc = Object.getOwnPropertyDescriptor(runners, 'auditRunner');
    if (!auditRunnerDesc || auditRunnerDesc.get || auditRunnerDesc.set || !auditRunnerDesc.enumerable || typeof auditRunnerDesc.value !== 'function') {
      throw sceneAcceptanceError('Missing or invalid auditRunner function in runners', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const auditRunner = auditRunnerDesc.value;

    const privateAuthorityTable = PRIVATE_FUTURE_AUTHORITY_MAP.get(acceptanceState);
    if (!privateAuthorityTable || typeof privateAuthorityTable !== 'object' || Object.getPrototypeOf(privateAuthorityTable) !== null) {
      throw sceneAcceptanceError('Missing or invalid private authority table', 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const authDesc = Object.getOwnPropertyDescriptor(privateAuthorityTable, targetSceneId);
    if (!authDesc || authDesc.get || authDesc.set || !authDesc.enumerable) {
      throw sceneAcceptanceError(`Private future authority for scene ${targetSceneId} not found`, 'SCENE_ACCEPTANCE_STATE_INVALID', []);
    }
    const privateFutureAuthority = validatePrivateFutureAuthority(authDesc.value);

    const auditRequest = finalizeAuditRunnerRequest({
      version: SCENE_EXECUTION_ACCEPTANCE_GATE_VERSION,
      contract_fingerprint: acceptanceState.contract_fingerprint,
      scene_id: sceneRecord.scene_id,
      scene_number: sceneRecord.scene_number,
      packet: sceneRecord.packet,
      prose,
      private_future_authority: privateFutureAuthority,
    });

    let rawAuditResponse;
    try {
      rawAuditResponse = await auditRunner(auditRequest);
    } catch (err) {
      if (isSceneAcceptanceError(err)) throw err;
      throw sceneAcceptanceError(
        `auditRunner execution failed: ${err?.message || 'unknown error'}`,
        'SCENE_ACCEPTANCE_AUDIT_RUNNER_FAILED',
        [String(err?.message || err)]
      );
    }

    const validatedAuditResponse = inspectAuditResponseRecordSafe(rawAuditResponse, auditRequest);

    return acceptedCleanSceneExecutionAcceptanceResult({
      contractFingerprint: acceptanceState.contract_fingerprint,
      sceneId: sceneRecord.scene_id,
      sceneNumber: sceneRecord.scene_number,
      packetId: sceneRecord.packet_id,
      auditResponse: validatedAuditResponse,
      prose,
    });
  } catch (err) {
    if (isSceneAcceptanceError(err)) throw err;
    throw sceneAcceptanceError(
      `Sanitized evaluateSceneExecutionAcceptance boundary failure: ${err?.message || 'unknown error'}`,
      'SCENE_ACCEPTANCE_STATE_INVALID',
      [String(err?.message || err)]
    );
  }
}

