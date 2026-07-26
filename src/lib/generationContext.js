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

export const SCENE_CONTEXT_COMPOSER_FEATURE = Object.freeze({
  key: 'scene_context_composer_v1',
  defaultEnabled: false,
});

export function isSceneContextComposerEnabled(flags) {
  if (!flags || typeof flags !== 'object') return SCENE_CONTEXT_COMPOSER_FEATURE.defaultEnabled;
  return flags[SCENE_CONTEXT_COMPOSER_FEATURE.key] === true;
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
    // Validate ALL own keys via descriptors: only 'length' and canonical indexes allowed
    const arrAllKeys = Reflect.ownKeys(value);
    for (const k of arrAllKeys) {
      if (typeof k === 'symbol') {
        throw packetError(`Symbol-keyed property at ${path}`, 'INVALID_PACKET_PROPERTY', [`${path} has a symbol-keyed array property: ${String(k)}`]);
      }
      if (k === 'length') continue; // standard array property
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || String(idx) !== k) {
        // Named/custom string property on array
        const kDesc = Object.getOwnPropertyDescriptor(value, k);
        if (kDesc.get || kDesc.set) {
          throw packetError(`Named accessor on array at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has a named accessor array property: "${k}"`]);
        }
        if (!kDesc.enumerable) {
          throw packetError(`Non-enumerable array property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has a non-enumerable array property: "${k}"`]);
        }
        throw packetError(`Custom array property at ${path}.${k}`, 'INVALID_PACKET_PROPERTY', [`${path} has an unsupported custom array property: "${k}"`]);
      }
    }
    // Validate each index 0..length-1
    for (let i = 0; i < value.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (!desc) {
        throw packetError(`Sparse array at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains a sparse array (missing index ${i})`]);
      }
      if (desc.get || desc.set) {
        throw packetError(`Accessor at ${path}[${i}]`, 'INVALID_PACKET_PROPERTY', [`${path}[${i}] has an accessor (getter/setter) property`]);
      }
      if (!desc.enumerable) {
        throw packetError(`Non-enumerable index at ${path}[${i}]`, 'INVALID_PACKET_PROPERTY', [`${path}[${i}] has a non-enumerable index descriptor`]);
      }
      descriptorSafeInspect(desc.value, `${path}[${i}]`, seen);
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

  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (const k of sortedKeys) {
    result[k] = canonicalizeValue(value[k], `${path}.${k}`, seen);
  }
  seen.delete(value);
  return result;
}

function canonicalizePacketForFingerprint(packet) {
  const copy = {};
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
    // Inspects all properties except packet_id (which is excluded from authority).
    // First validate packet_id descriptor safely if present.
    const pidDesc = Object.getOwnPropertyDescriptor(packet, 'packet_id');
    if (pidDesc) {
      if (pidDesc.get || pidDesc.set) {
        throw packetError('Accessor on packet.packet_id', 'INVALID_PACKET_PROPERTY', ['packet.packet_id has an accessor (getter/setter) property']);
      }
      if (typeof pidDesc.value !== 'symbol' && typeof pidDesc.value !== 'function') {
        // packet_id is a normal value, skip from inspection but allow
      } else {
        throw packetError('Invalid packet_id value', 'NON_JSON_SAFE_VALUE', [`packet.packet_id contains ${typeof pidDesc.value}`]);
      }
    }
    // Build a proxy view that skips packet_id for inspection
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
    if (!(i in value)) {
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
    const arrKeys = Reflect.ownKeys(value);
    for (const k of arrKeys) {
      if (typeof k === 'symbol') throw contractError(`Symbol on array at ${path}`, [`${path} has a symbol-keyed array property: ${String(k)}`]);
      if (k === 'length') continue;
      const idx = Number(k);
      if (!Number.isInteger(idx) || idx < 0 || String(idx) !== k) {
        const kDesc = Object.getOwnPropertyDescriptor(value, k);
        if (kDesc.get || kDesc.set) throw contractError(`Named accessor on array at ${path}.${k}`, [`${path} has a named accessor array property: "${k}"`]);
        if (!kDesc.enumerable) throw contractError(`Non-enumerable array property at ${path}.${k}`, [`${path} has a non-enumerable array property: "${k}"`]);
        throw contractError(`Custom array property at ${path}.${k}`, [`${path} has an unsupported custom array property: "${k}"`]);
      }
    }
    for (let i = 0; i < value.length; i++) {
      const desc = Object.getOwnPropertyDescriptor(value, i);
      if (!desc) throw contractError(`Sparse array at ${path}`, [`${path} is a sparse array (missing index ${i})`]);
      if (desc.get || desc.set) throw contractError(`Accessor at ${path}[${i}]`, [`${path}[${i}] has an accessor (getter/setter) property`]);
      if (!desc.enumerable) throw contractError(`Non-enumerable index at ${path}[${i}]`, [`${path}[${i}] has a non-enumerable index`]);
      contractDescriptorInspect(desc.value, `${path}[${i}]`, seen);
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
  const allRequiredKeys = [
    ...REQUIRED_NONEMPTY_STRING_FIELDS, ...OPTIONAL_STRING_FIELDS,
    ...STRING_ARRAY_FIELDS, ...RECORD_ARRAY_FIELDS, ...ID_ARRAY_FIELDS,
    'chapter_number', 'scene_number', 'packet_id'
  ];
  for (const k of allRequiredKeys) {
    if (!(k in packet)) {
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
    if (!('event_id' in e)) throw packetError(`required_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing event_id`]);
    if (!('text' in e)) throw packetError(`required_events[${i}] missing text`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing text`]);
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
    if (!('event_id' in e)) throw packetError(`future_reserved_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`future_reserved_events[${i}] is missing event_id`]);
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
      if (!(reqField in f)) throw packetError(`scene_authorized_facts[${i}] missing ${reqField}`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}] is missing ${reqField}`]);
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
    if (!('pov_identity' in f.knowledge_scope)) throw packetError(`scene_authorized_facts[${i}].knowledge_scope missing pov_identity`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}].knowledge_scope is missing pov_identity`]);
    if (!('basis' in f.knowledge_scope)) throw packetError(`scene_authorized_facts[${i}].knowledge_scope missing basis`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}].knowledge_scope is missing basis`]);
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
