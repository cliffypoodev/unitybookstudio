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
