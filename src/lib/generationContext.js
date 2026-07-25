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

export function generateDeterministicEventId(projectId, chapterId, sceneId, category, ordinal, eventText) {
  const input = `${projectId}:${chapterId}:${sceneId}:${category}:${ordinal}:${text(eventText)}`;
  return `evt_${hashText(input)}`;
}

// ─── Recursive JSON-safe canonicalization ──────────────────────────────
// Recursively builds a canonical JSON-safe value from an arbitrary input.
// Rejects cyclic objects, undefined, functions, symbols, BigInt, NaN,
// Infinity, Date, class instances, and sparse arrays.
// Objects have their keys sorted recursively at every depth.
// Arrays preserve order; each element is recursively canonicalized.
// The top-level packet_id key is excluded.

const _SEEN = Symbol('canonicalize_seen');

function assertJsonSafe(value, path) {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw packetError(
        `Non-JSON-safe number at ${path}: ${value}`,
        'NON_JSON_SAFE_VALUE',
        [`${path} contains non-finite number: ${value}`]
      );
    }
    return;
  }
  if (typeof value === 'undefined') {
    throw packetError(
      `undefined at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains undefined`]
    );
  }
  if (typeof value === 'function') {
    throw packetError(
      `function at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains a function`]
    );
  }
  if (typeof value === 'symbol') {
    throw packetError(
      `symbol at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains a symbol`]
    );
  }
  if (typeof value === 'bigint') {
    throw packetError(
      `BigInt at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains a BigInt`]
    );
  }
  if (value instanceof Date) {
    throw packetError(
      `Date at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains a Date object`]
    );
  }
  if (typeof value === 'object') {
    // Reject class instances (prototype is not Object.prototype or Array.prototype or null)
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== Array.prototype && proto !== null) {
      throw packetError(
        `Class instance at ${path}`,
        'NON_JSON_SAFE_VALUE',
        [`${path} contains a class instance (${value.constructor?.name || 'unknown'})`]
      );
    }
    return;
  }
}

function canonicalizeValue(value, path, seen) {
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    assertJsonSafe(value, path);
    return value;
  }
  assertJsonSafe(value, path);

  if (typeof value !== 'object') {
    // Already rejected by assertJsonSafe, but be defensive
    throw packetError(`Unexpected type at ${path}`, 'NON_JSON_SAFE_VALUE', [`${path} contains unexpected type ${typeof value}`]);
  }

  if (seen.has(value)) {
    throw packetError(
      `Cyclic reference at ${path}`,
      'NON_JSON_SAFE_VALUE',
      [`${path} contains a cyclic object reference`]
    );
  }
  seen.add(value);

  if (Array.isArray(value)) {
    // Reject sparse arrays
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) {
        throw packetError(
          `Sparse array at ${path}`,
          'NON_JSON_SAFE_VALUE',
          [`${path} contains a sparse array (missing index ${i})`]
        );
      }
    }
    const result = value.map((el, i) => canonicalizeValue(el, `${path}[${i}]`, seen));
    seen.delete(value);
    return result;
  }

  // Plain object: sort keys, recursively canonicalize
  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (const k of sortedKeys) {
    result[k] = canonicalizeValue(value[k], `${path}.${k}`, seen);
  }
  seen.delete(value);
  return result;
}

function canonicalizePacketForFingerprint(packet) {
  // Build a shallow copy excluding packet_id, then recursively canonicalize.
  const copy = {};
  for (const k of Object.keys(packet)) {
    if (k === 'packet_id') continue;
    copy[k] = packet[k];
  }
  const canonical = canonicalizeValue(copy, 'packet', new Set());
  return JSON.stringify(canonical);
}

export function generatePacketFingerprint(packet) {
  return `sep_${hashText(canonicalizePacketForFingerprint(packet))}`;
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

// Required top-level string fields that must be nonempty
const REQUIRED_NONEMPTY_STRING_FIELDS = [
  'packet_version', 'snapshot_id', 'source_contract_fingerprint',
  'project_id', 'chapter_id', 'scene_id',
  'scene_goal', 'entry_state', 'exit_state', 'pov_identity'
];

// String fields that may be empty
const OPTIONAL_STRING_FIELDS = ['immediate_continuity'];

// Bounded, scene-safe declarative state statement arrays.
// Each element must be a nonempty string. These represent factual, scene-scoped
// declarations of current state (locations, possessions, injuries, etc.) used
// only for scene-level validation. They are NOT structured records.
const STRING_ARRAY_FIELDS = [
  'current_scene_forbidden_events', 'continuity_dependencies',
  'current_locations', 'current_possessions', 'current_injuries',
  'confirmed_deaths', 'current_separations', 'unavailable_objects',
  'canonically_unique_objects', 'voice_rules'
];

// Record array fields (validated separately)
const RECORD_ARRAY_FIELDS = [
  'required_events', 'future_reserved_events', 'scene_authorized_facts'
];

// ID-valued array fields (elements must be nonempty strings, treated as a set)
const ID_ARRAY_FIELDS = ['completed_events', 'pov_known_facts'];

function packetError(message, code, issues) {
  return new NarrativeInvariantError(message, { code, issues: Object.freeze(issues || [message]) });
}

function requireString(value, fieldName, allowEmpty) {
  if (typeof value !== 'string') {
    throw packetError(
      `${fieldName} must be a string`,
      'INVALID_FIELD_TYPE',
      [`${fieldName} must be a string, got ${typeof value}`]
    );
  }
  if (!allowEmpty && value.trim() === '') {
    throw packetError(
      `${fieldName} must be nonempty`,
      'MISSING_REQUIRED_FIELD',
      [`${fieldName} is empty or whitespace-only`]
    );
  }
}

function requireArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw packetError(
      `${fieldName} must be an array`,
      'INVALID_FIELD_TYPE',
      [`${fieldName} must be an array, got ${value === null ? 'null' : typeof value}`]
    );
  }
  // Reject sparse arrays
  for (let i = 0; i < value.length; i++) {
    if (!(i in value)) {
      throw packetError(
        `${fieldName} contains a sparse array`,
        'NON_JSON_SAFE_VALUE',
        [`${fieldName} is a sparse array (missing index ${i})`]
      );
    }
  }
}

function requireStringArrayElements(arr, fieldName) {
  for (let i = 0; i < arr.length; i++) {
    const el = arr[i];
    if (typeof el !== 'string') {
      throw packetError(
        `${fieldName}[${i}] must be a string`,
        'INVALID_FIELD_TYPE',
        [`${fieldName}[${i}] must be a string, got ${el === null ? 'null' : typeof el}`]
      );
    }
    if (el.trim() === '') {
      throw packetError(
        `${fieldName}[${i}] must be nonempty`,
        'INVALID_FIELD_VALUE',
        [`${fieldName}[${i}] is empty or whitespace-only`]
      );
    }
  }
}

function requirePlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw packetError(
      `${fieldName} must be a plain object`,
      'INVALID_RECORD',
      [`${fieldName} must be a non-null plain object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`]
    );
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw packetError(
      `${fieldName} is a class instance`,
      'INVALID_RECORD',
      [`${fieldName} must be a plain object, got class instance ${value.constructor?.name || 'unknown'}`]
    );
  }
}

function requirePositiveInteger(value, fieldName) {
  if (typeof value !== 'number') {
    throw packetError(
      `${fieldName} must be a number`,
      'INVALID_FIELD_TYPE',
      [`${fieldName} must be a number, got ${typeof value}`]
    );
  }
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw packetError(
      `${fieldName} must be a finite positive integer`,
      fieldName === 'chapter_number' ? 'INVALID_CHAPTER_NUMBER' : 'INVALID_SCENE_NUMBER',
      [`${fieldName} must be a finite positive integer, got ${value}`]
    );
  }
}

// ─── Validator ─────────────────────────────────────────────────────────

export function validateSceneExecutionPacket(packet, immutableSceneContract) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw packetError('Invalid packet', 'INVALID_PACKET', ['Packet must be a non-null plain object']);
  }

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
  for (const f of REQUIRED_NONEMPTY_STRING_FIELDS) {
    requireString(packet[f], f, false);
  }
  for (const f of OPTIONAL_STRING_FIELDS) {
    requireString(packet[f], f, true);
  }

  // ── Numeric fields ──
  requirePositiveInteger(packet.chapter_number, 'chapter_number');
  requirePositiveInteger(packet.scene_number, 'scene_number');

  // ── String array fields ──
  for (const f of STRING_ARRAY_FIELDS) {
    requireArray(packet[f], f);
    requireStringArrayElements(packet[f], f);
  }

  // ── Record array fields (type check only; detailed validation below) ──
  for (const f of RECORD_ARRAY_FIELDS) {
    requireArray(packet[f], f);
  }

  // ── ID array fields ──
  for (const f of ID_ARRAY_FIELDS) {
    requireArray(packet[f], f);
    for (let i = 0; i < packet[f].length; i++) {
      if (typeof packet[f][i] !== 'string') {
        throw packetError(
          `${f}[${i}] must be a string`,
          'INVALID_FIELD_TYPE',
          [`${f}[${i}] must be a string, got ${packet[f][i] === null ? 'null' : typeof packet[f][i]}`]
        );
      }
      if (packet[f][i].trim() === '') {
        throw packetError(
          `${f}[${i}] must be nonempty`,
          'INVALID_FIELD_VALUE',
          [`${f}[${i}] is empty or whitespace-only`]
        );
      }
    }
  }

  // ── Required event validation ──
  for (let i = 0; i < packet.required_events.length; i++) {
    const e = packet.required_events[i];
    requirePlainObject(e, `required_events[${i}]`);
    for (const k of Object.keys(e)) {
      if (!ALLOWED_REQUIRED_EVENT_KEYS.has(k)) {
        throw packetError(`Unknown key in required event: ${k}`, 'UNKNOWN_NESTED_KEY', [`required_events[${i}] key "${k}" is not allowed; only event_id and text are permitted`]);
      }
    }
    if (!('event_id' in e)) {
      throw packetError(`required_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing event_id`]);
    }
    if (!('text' in e)) {
      throw packetError(`required_events[${i}] missing text`, 'MISSING_REQUIRED_FIELD', [`required_events[${i}] is missing text`]);
    }
    requireString(e.event_id, `required_events[${i}].event_id`, false);
    requireString(e.text, `required_events[${i}].text`, false);
  }

  // ── Future-reserved event validation ──
  for (let i = 0; i < packet.future_reserved_events.length; i++) {
    const e = packet.future_reserved_events[i];
    requirePlainObject(e, `future_reserved_events[${i}]`);
    for (const k of Object.keys(e)) {
      if (k.includes('truth') || k.includes('secret') || k.includes('withheld') || k.includes('private')) {
        throw packetError(`Prohibited secret truth payload: ${k}`, 'PROHIBITED_SECRET_TRUTH', [`future_reserved_events[${i}] contains prohibited field "${k}"`]);
      }
      if (!ALLOWED_FUTURE_EVENT_KEYS.has(k)) {
        throw packetError(`Unknown key in future-reserved event: ${k}`, 'UNKNOWN_NESTED_KEY', [`future_reserved_events[${i}] key "${k}" is not allowed; only event_id is permitted`]);
      }
    }
    if (!('event_id' in e)) {
      throw packetError(`future_reserved_events[${i}] missing event_id`, 'MISSING_REQUIRED_FIELD', [`future_reserved_events[${i}] is missing event_id`]);
    }
    requireString(e.event_id, `future_reserved_events[${i}].event_id`, false);
  }

  // ── Scene-authorized fact validation ──
  for (let i = 0; i < packet.scene_authorized_facts.length; i++) {
    const f = packet.scene_authorized_facts[i];
    requirePlainObject(f, `scene_authorized_facts[${i}]`);
    for (const k of Object.keys(f)) {
      if (k.includes('withheld') || k.includes('private') || k.includes('secret') || k.includes('truth')) {
        throw packetError(`Prohibited knowledge field in fact: ${k}`, 'PROHIBITED_SECRET_TRUTH', [`scene_authorized_facts[${i}] contains prohibited field "${k}"`]);
      }
      if (!ALLOWED_FACT_KEYS.has(k)) {
        throw packetError(`Unknown key in authorized fact: ${k}`, 'UNKNOWN_NESTED_KEY', [`scene_authorized_facts[${i}] key "${k}" is not allowed; only fact_id, summary, provenance, and knowledge_scope are permitted`]);
      }
    }
    for (const reqField of ['fact_id', 'summary', 'provenance', 'knowledge_scope']) {
      if (!(reqField in f)) {
        throw packetError(`scene_authorized_facts[${i}] missing ${reqField}`, 'MISSING_REQUIRED_FIELD', [`scene_authorized_facts[${i}] is missing ${reqField}`]);
      }
    }
    requireString(f.fact_id, `scene_authorized_facts[${i}].fact_id`, false);
    requireString(f.summary, `scene_authorized_facts[${i}].summary`, false);
    requireString(f.provenance, `scene_authorized_facts[${i}].provenance`, false);
    // knowledge_scope must be a structured object
    requirePlainObject(f.knowledge_scope, `scene_authorized_facts[${i}].knowledge_scope`);
    for (const k of Object.keys(f.knowledge_scope)) {
      if (!ALLOWED_KNOWLEDGE_SCOPE_KEYS.has(k)) {
        throw packetError(
          `Unknown knowledge_scope key: ${k}`,
          'UNKNOWN_NESTED_KEY',
          [`scene_authorized_facts[${i}].knowledge_scope key "${k}" is not allowed; only pov_identity and basis are permitted`]
        );
      }
    }
    if (!('pov_identity' in f.knowledge_scope)) {
      throw packetError(
        `scene_authorized_facts[${i}].knowledge_scope missing pov_identity`,
        'MISSING_REQUIRED_FIELD',
        [`scene_authorized_facts[${i}].knowledge_scope is missing pov_identity`]
      );
    }
    if (!('basis' in f.knowledge_scope)) {
      throw packetError(
        `scene_authorized_facts[${i}].knowledge_scope missing basis`,
        'MISSING_REQUIRED_FIELD',
        [`scene_authorized_facts[${i}].knowledge_scope is missing basis`]
      );
    }
    requireString(f.knowledge_scope.pov_identity, `scene_authorized_facts[${i}].knowledge_scope.pov_identity`, false);
    requireString(f.knowledge_scope.basis, `scene_authorized_facts[${i}].knowledge_scope.basis`, false);
    if (f.knowledge_scope.pov_identity.trim() !== packet.pov_identity.trim()) {
      throw packetError(
        `Knowledge scope POV mismatch in scene_authorized_facts[${i}]`,
        'KNOWLEDGE_SCOPE_POV_MISMATCH',
        [`scene_authorized_facts[${i}].knowledge_scope.pov_identity "${f.knowledge_scope.pov_identity}" does not match packet pov_identity "${packet.pov_identity}"`]
      );
    }
  }

  // ── Identity cross-checks ──
  if (packet.source_contract_fingerprint !== immutableSceneContract?.fingerprint) {
    throw packetError('Contract fingerprint mismatch', 'CONTRACT_FINGERPRINT_MISMATCH', [`Expected "${immutableSceneContract?.fingerprint}", got "${packet.source_contract_fingerprint}"`]);
  }

  // Wrap assertSceneContractUnchanged to normalize error contract
  try {
    assertSceneContractUnchanged(immutableSceneContract, immutableSceneContract.beats, { chapterNumber: packet.chapter_number });
  } catch (e) {
    if (e instanceof NarrativeInvariantError) throw e;
    // Normalize GenerationContextError or other errors into the packet error contract
    const issues = e.details?.issues || e.details?.validationReasons || [e.message];
    throw packetError(
      e.message || 'Scene contract validation failed',
      e.code || 'SCENE_CONTRACT_INVALID',
      Array.isArray(issues) ? issues : [String(issues)]
    );
  }

  const beat = immutableSceneContract.beats.find(b => b.scene_id === packet.scene_id);
  if (!beat) {
    throw packetError('Scene identity mismatch', 'SCENE_IDENTITY_MISMATCH', [`scene_id "${packet.scene_id}" not found in contract beats`]);
  }

  if (packet.scene_number !== Number(beat.scene_number)) {
    throw packetError('Scene number mismatch', 'SCENE_NUMBER_MISMATCH', [`Expected scene_number ${beat.scene_number}, got ${packet.scene_number}`]);
  }
  if (text(packet.scene_goal) !== text(beat.scene_goal)) {
    throw packetError('Scene goal mismatch', 'SCENE_GOAL_MISMATCH', [`Packet scene_goal does not match contract`]);
  }
  if (text(packet.entry_state) !== text(beat.entry_state)) {
    throw packetError('Entry state mismatch', 'ENTRY_STATE_MISMATCH', [`Packet entry_state does not match contract`]);
  }
  if (text(packet.exit_state) !== text(beat.exit_state)) {
    throw packetError('Exit state mismatch', 'EXIT_STATE_MISMATCH', [`Packet exit_state does not match contract`]);
  }

  // ── Required events: exact count, order, text, deterministic ID ──
  const requiredEvents = packet.required_events;
  const beatEvents = Array.isArray(beat.required_events) ? beat.required_events : [];
  if (requiredEvents.length !== beatEvents.length) {
    throw packetError('Required events count mismatch', 'REQUIRED_EVENTS_MISMATCH', [`Expected ${beatEvents.length} required events, got ${requiredEvents.length}`]);
  }

  const reqEventIds = new Set();
  for (let i = 0; i < requiredEvents.length; i++) {
    if (text(requiredEvents[i].text) !== text(beatEvents[i])) {
      throw packetError('Required event text mismatch', 'REQUIRED_EVENTS_MISMATCH', [`Required event ${i + 1} text does not match contract`]);
    }
    const expectedId = generateDeterministicEventId(packet.project_id, packet.chapter_id, packet.scene_id, 'required', i + 1, beatEvents[i]);
    if (requiredEvents[i].event_id !== expectedId) {
      throw packetError('Event ID mismatch', 'EVENT_ID_MISMATCH', [`Required event ${i + 1} event_id does not match deterministic derivation`]);
    }
    if (reqEventIds.has(requiredEvents[i].event_id)) {
      throw packetError('Duplicate required event ID', 'DUPLICATE_EVENT_ID', [`Duplicate required event_id "${requiredEvents[i].event_id}"`]);
    }
    reqEventIds.add(requiredEvents[i].event_id);
  }

  // ── Forbidden events: exact count, order, text ──
  const forbiddenEvents = packet.current_scene_forbidden_events;
  const beatForbidden = Array.isArray(beat.forbidden_events) ? beat.forbidden_events : [];
  if (forbiddenEvents.length !== beatForbidden.length) {
    throw packetError('Forbidden events count mismatch', 'FORBIDDEN_EVENTS_MISMATCH', [`Expected ${beatForbidden.length} forbidden events, got ${forbiddenEvents.length}`]);
  }
  for (let i = 0; i < forbiddenEvents.length; i++) {
    if (text(forbiddenEvents[i]) !== text(beatForbidden[i])) {
      throw packetError('Forbidden event text mismatch', 'FORBIDDEN_EVENTS_MISMATCH', [`Forbidden event ${i + 1} text does not match contract`]);
    }
  }

  // ── Future-reserved event ID uniqueness and overlap with required ──
  const futureEventIds = new Set();
  for (const e of packet.future_reserved_events) {
    if (futureEventIds.has(e.event_id)) {
      throw packetError('Duplicate future reserved event ID', 'DUPLICATE_EVENT_ID', [`Duplicate future_reserved event_id "${e.event_id}"`]);
    }
    futureEventIds.add(e.event_id);
    if (reqEventIds.has(e.event_id)) {
      throw packetError('Event appears as both required and future-reserved', 'REQUIRED_AND_FUTURE_EVENT', [`event_id "${e.event_id}" cannot be both required and future-reserved`]);
    }
  }

  // ── Completed event ID uniqueness ──
  const completedEventIds = new Set();
  for (const id of packet.completed_events) {
    if (completedEventIds.has(id)) {
      throw packetError('Duplicate completed event ID', 'DUPLICATE_EVENT_ID', [`Duplicate completed event_id "${id}"`]);
    }
    completedEventIds.add(id);
  }

  // ── Fact ID uniqueness ──
  const factIdSet = new Set();
  for (const f of packet.scene_authorized_facts) {
    if (factIdSet.has(f.fact_id)) {
      throw packetError('Duplicate fact ID', 'DUPLICATE_FACT_ID', [`Duplicate fact_id "${f.fact_id}"`]);
    }
    factIdSet.add(f.fact_id);
  }

  // ── pov_known_facts must resolve to scene_authorized_facts ──
  const povFactIds = new Set();
  for (let i = 0; i < packet.pov_known_facts.length; i++) {
    const fid = packet.pov_known_facts[i];
    if (povFactIds.has(fid)) {
      throw packetError(`Duplicate pov_known_facts ID`, 'DUPLICATE_POV_FACT_ID', [`pov_known_facts[${i}] "${fid}" is a duplicate`]);
    }
    povFactIds.add(fid);
    if (!factIdSet.has(fid)) {
      throw packetError(`pov_known_facts ID not found in scene_authorized_facts`, 'UNRESOLVED_POV_FACT', [`pov_known_facts[${i}] "${fid}" does not resolve to any scene_authorized_facts entry`]);
    }
  }

  // ── Continuity size limit ──
  if (packet.immediate_continuity.length > 2000) {
    throw packetError('Immediate continuity too large', 'CONTINUITY_TOO_LARGE', [`immediate_continuity is ${packet.immediate_continuity.length} chars, max 2000`]);
  }

  // ── JSON safety of entire packet (also validates nested values) ──
  // This is done before fingerprint comparison to ensure the packet is
  // entirely JSON-safe and the fingerprint can be reliably computed.
  try {
    canonicalizePacketForFingerprint(packet);
  } catch (e) {
    if (e instanceof NarrativeInvariantError) throw e;
    throw packetError('Packet contains non-JSON-safe values', 'NON_JSON_SAFE_VALUE', [e.message]);
  }

  // ── Packet fingerprint ──
  requireString(packet.packet_id, 'packet_id', false);
  if (packet.packet_id !== generatePacketFingerprint(packet)) {
    throw packetError('Packet fingerprint mismatch', 'PACKET_FINGERPRINT_MISMATCH', ['packet_id does not match canonical fingerprint derivation']);
  }

  // ── Return defensive frozen clone ──
  return deepFreeze(JSON.parse(JSON.stringify(packet)));
}
