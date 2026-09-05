// src/lib/sceneDelta.js
// SCENEDELTA-1 (UBS_plan.md Phase 1B) — the scene delta: what each PLANNED
// scene is FOR (newInformation, stateChange, conflictType, participants),
// derived at outline/planning time. Nothing reads this data yet (Phase 2+);
// this module only writes it.
//
// Same scope boundary as beatLedger.js: this module never resolves or calls
// a model itself. deriveSceneDelta requires an injected callLLM — the
// backfill script (the only real caller for now; the live path only
// requests the field in the prompt, see autonovel.js) chooses the model via
// modelRouting.js's pickModel, same as BEATLEDGER-1's backfill.
//
// Relative imports only — this module is imported directly by
// test/scenedelta1.acceptance.mjs under bare Node (same convention as
// proseLab.js / beatLedger.js).

import { entities } from './localDB.js';

export const SCENE_DELTA_VERSION = 'scene-delta-v1';

// Same convention as PROSE_LAB_CAPTURE_FEATURE / BEAT_EXTRACTION_FEATURE.
// Own field (project.scene_delta_flags) so this planner-only flag can never
// trip DEADGATE-1's "unknown scene-execution flag" warning.
export const SCENE_DELTA_FEATURE = Object.freeze({
  key: 'scene_delta_v1',
  defaultEnabled: false,
});

// Descriptor-safe read — identical pattern to proseLab.js/beatLedger.js.
export function isSceneDeltaEnabled(project) {
  const flags = project?.scene_delta_flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return SCENE_DELTA_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return SCENE_DELTA_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(flags, SCENE_DELTA_FEATURE.key);
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return SCENE_DELTA_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

// The exact bullet appended to the beat-planner's "Each beat must include:"
// list when the flag is on. Its own exported constant so the battery can
// assert the planner prompt contains this text verbatim with the flag on,
// without re-deriving it independently (that would test the string against
// itself, not against what autonovel.js actually emits).
export function buildSceneDeltaFieldBlock() {
  return '\n- delta: { newInformation, stateChange, conflictType, participants } — newInformation is what the reader/POV learns in this scene that they did not know before it; stateChange is the concrete before→after shift this scene causes; conflictType is a short label (e.g. "interpersonal_confrontation"); participants is the canonical names this delta involves';
}

function normalizeDelta(raw) {
  const participants = Array.isArray(raw?.participants)
    ? raw.participants.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())
    : [];
  return {
    newInformation: String(raw?.newInformation ?? raw?.new_information ?? '').trim(),
    stateChange: String(raw?.stateChange ?? raw?.state_change ?? '').trim(),
    conflictType: String(raw?.conflictType ?? raw?.conflict_type ?? '').trim(),
    participants,
  };
}

function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/**
 * Derives a delta for one already-planned scene (from its scene_beats_json
 * beat object). Mirrors extractSceneBeats's failure discipline: an empty
 * completion, a truncated one (finishReason === 'length'), or malformed JSON
 * all RAISE — never a silently-empty delta.
 *
 * @param {object} args
 * @param {object} args.project
 * @param {number} args.chapterNumber
 * @param {number} args.sceneIndex
 * @param {object} args.sceneBeat - the planned scene's existing beat object (scene_goal, entry_state, exit_state, etc.)
 * @param {(prompt: string) => Promise<{text: string, finishReason: string|null}>} args.callLLM
 */
export async function deriveSceneDelta({ project, chapterNumber, sceneIndex, sceneBeat, callLLM }) {
  if (typeof callLLM !== 'function') {
    throw new Error(`[SCENEDELTA-1] Ch.${chapterNumber} scene ${sceneIndex}: deriveSceneDelta requires an injected callLLM (caller bug, not a runtime failure)`);
  }
  const tag = `[SCENEDELTA-1] Ch.${chapterNumber} scene ${sceneIndex}`;
  const prompt = `You are indexing a planned novel scene for a repetition-detection system. Given this scene's plan, output ONLY a JSON object describing its delta — what this scene is FOR.
{
  "newInformation": "what the reader/POV learns in this scene that they did not know before it",
  "stateChange": "the concrete before -> after shift this scene causes",
  "conflictType": "a short label, e.g. interpersonal_confrontation",
  "participants": ["canonical names this delta involves"]
}
Output JSON only.

SCENE PLAN:
${JSON.stringify(sceneBeat || {})}`;

  const result = await callLLM(prompt, { project, chapterNumber, sceneIndex });
  const text = typeof result?.text === 'string' ? result.text : '';
  const finishReason = result?.finishReason ?? null;

  if (!text.trim()) {
    throw new Error(`${tag}: derivation FAILED — empty completion`);
  }
  if (finishReason === 'length') {
    throw new Error(`${tag}: derivation FAILED — truncated (finish_reason=length)`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (err) {
    throw new Error(`${tag}: derivation FAILED — malformed JSON (${err?.message || err})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${tag}: derivation FAILED — parsed JSON is not an object`);
  }

  return normalizeDelta(parsed);
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `delta-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Persists one SceneDelta record. Never touches Chapter.scene_beats_json —
 * Phase 2's gate reads deltas from either the entity or the planner field.
 */
export async function recordSceneDelta({
  project,
  chapterId = null,
  chapterNumber = null,
  sceneIndex = null,
  delta,
  source = 'backfill',
  create,
}) {
  const createFn = typeof create === 'function' ? create : (doc) => entities.SceneDelta.create(doc);
  const doc = {
    id: makeId(),
    project_id: project?.id ?? null,
    chapter_id: chapterId,
    chapter_number: chapterNumber,
    scene_index: sceneIndex,
    delta,
    source,
    created_date: new Date().toISOString(),
  };
  await createFn(doc);
  return doc;
}
