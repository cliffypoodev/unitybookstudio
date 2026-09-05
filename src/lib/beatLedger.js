// src/lib/beatLedger.js
// BEATLEDGER-1 (UBS_plan.md Phase 1A) — the beat ledger: what has been
// dramatized on the page, extracted from already-drafted/already-accepted
// prose. Nothing reads this data yet (Phase 2+); this module only writes it.
//
// Scope boundary (deliberate): this module does NOT resolve or call a model
// itself. `extractSceneBeats` requires an injected `callLLM` — every real
// caller is responsible for choosing the model, per the Phase 1 standing
// rule "beat extraction uses the SAME agent/model the chapter was drafted
// with":
//   - the live hook (sceneWriter.js) already has the exact `model` variable
//     computed for this chapter's prose generation and passes it straight
//     through — no re-resolution, so it can never drift from the writer.
//   - the backfill script (scripts/beats-backfill.mjs) has no record of
//     which model actually drafted an old chapter, so it approximates with
//     modelRouting.js's pickModel('prose', project) — today's routed
//     default for this project. See docs/phase1-notes.md for that tradeoff.
// Both route every call through localLLM.js's callAgentWithMeta — never a
// new HTTP client, never a direct fetch.
//
// Relative imports only — this module is imported directly by
// test/beatledger1.acceptance.mjs under bare Node (same convention as
// proseLab.js).

import { entities } from './localDB.js';

export const BEAT_LEDGER_VERSION = 'beat-ledger-v1';

// Feature-flag shape matches the app's convention (generationContext.js
// SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE: Object.freeze({ key, defaultEnabled })),
// same as PROSELAB-1's PROSE_LAB_CAPTURE_FEATURE. Stored on the project record
// under its own field, `project.beat_ledger_flags`, separate from
// `project.scene_execution_flags` — same reasoning as PROSELAB-1: a
// diagnostic/backfill-adjacent extraction flag has no business tripping
// DEADGATE-1's "unknown scene-execution flag" warning.
export const BEAT_EXTRACTION_FEATURE = Object.freeze({
  key: 'beat_extraction_v1',
  defaultEnabled: false,
});

// Descriptor-safe read — identical pattern to proseLab.js's
// isProseLabCaptureEnabled (see that file for the getter/prototype/
// non-enumerable rationale).
export function isBeatExtractionEnabled(project) {
  const flags = project?.beat_ledger_flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return BEAT_EXTRACTION_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return BEAT_EXTRACTION_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(flags, BEAT_EXTRACTION_FEATURE.key);
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return BEAT_EXTRACTION_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

// UBS_plan.md Phase 1A "Extraction prompt (draft — tune during Phase 2
// calibration)" — verbatim starting text.
export const BEAT_EXTRACTION_PROMPT = `You are indexing a novel scene for a repetition-detection system. Read the scene and
output ONLY a JSON array of beat objects. A beat is a dramatic unit the READER
EXPERIENCES on the page: a confrontation, a revelation shown (not merely referenced),
an emotional beat landed, a decision made, a relationship shift, or a major setpiece.
Do not index background facts, references to past events, or scenery.
For each beat: beatType, participants (canonical names), subject (a short noun phrase),
summary (one sentence), emotionalCore ("state -> state"), outcome (one clause).
Typically 1-4 beats per scene. Output JSON only.`;

function sceneLabel(sceneNumber) {
  return sceneNumber === null || sceneNumber === undefined ? 'ALL' : String(sceneNumber);
}

function extractionTag(chapterNumber, sceneNumber) {
  return `[BEATLEDGER-1] Ch.${chapterNumber ?? '?'} scene ${sceneLabel(sceneNumber)}`;
}

// Some models wrap "JSON only" output in a markdown fence despite instructions.
// Strip a single leading/trailing ``` (optionally ```json) fence before parsing;
// never mutate the (rare) case where there is no fence.
function stripCodeFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function normalizeBeat(raw) {
  const participants = Array.isArray(raw?.participants)
    ? raw.participants.filter((p) => typeof p === 'string' && p.trim()).map((p) => p.trim())
    : [];
  return {
    beat_type: String(raw?.beatType ?? raw?.beat_type ?? '').trim(),
    participants,
    subject: String(raw?.subject ?? '').trim(),
    summary: String(raw?.summary ?? '').trim(),
    emotional_core: String(raw?.emotionalCore ?? raw?.emotional_core ?? '').trim(),
    outcome: String(raw?.outcome ?? '').trim(),
    on_page: raw?.onPage === false || raw?.on_page === false ? false : true,
  };
}

/**
 * Extracts dramatized beats from one already-generated scene (or, for
 * backfill, one whole chapter — sceneNumber is null there). NEVER returns
 * "0 beats" for a failure: an empty completion, a truncated completion
 * (finishReason === 'length'), or unparseable/malformed JSON all RAISE
 * instead, tagged [BEATLEDGER-1] with the chapter/scene. A genuine
 * zero-beat scene (valid JSON, empty array) returns [] and logs that
 * distinctly.
 *
 * @param {object} args
 * @param {object} args.project
 * @param {number} args.chapterNumber
 * @param {number|null} args.sceneNumber
 * @param {string} args.prose
 * @param {(prompt: string) => Promise<{text: string, finishReason: string|null}>} args.callLLM
 *   Required — see the module header for why this file never resolves a model itself.
 */
export async function extractSceneBeats({ project, chapterNumber, sceneNumber = null, prose, callLLM }) {
  if (typeof callLLM !== 'function') {
    throw new Error(`${extractionTag(chapterNumber, sceneNumber)}: extractSceneBeats requires an injected callLLM (caller bug, not a runtime failure)`);
  }
  const tag = extractionTag(chapterNumber, sceneNumber);
  const prompt = `${BEAT_EXTRACTION_PROMPT}\n\nSCENE:\n${String(prose || '')}`;

  const result = await callLLM(prompt, { project, chapterNumber, sceneNumber });
  const text = typeof result?.text === 'string' ? result.text : '';
  const finishReason = result?.finishReason ?? null;

  if (!text.trim()) {
    const reason = 'empty completion';
    console.warn(`${tag}: extraction FAILED — ${reason}`);
    throw new Error(`${tag}: extraction FAILED — ${reason}`);
  }
  if (finishReason === 'length') {
    const reason = 'truncated (finish_reason=length)';
    console.warn(`${tag}: extraction FAILED — ${reason}`);
    throw new Error(`${tag}: extraction FAILED — ${reason}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (err) {
    const reason = `malformed JSON (${err?.message || err})`;
    console.warn(`${tag}: extraction FAILED — ${reason}`);
    throw new Error(`${tag}: extraction FAILED — ${reason}`);
  }

  let beatsRaw;
  if (Array.isArray(parsed)) {
    beatsRaw = parsed;
  } else if (parsed && Array.isArray(parsed.beats)) {
    beatsRaw = parsed.beats;
  } else {
    const reason = 'parsed JSON is neither an array nor { beats: [...] }';
    console.warn(`${tag}: extraction FAILED — ${reason}`);
    throw new Error(`${tag}: extraction FAILED — ${reason}`);
  }

  const beats = beatsRaw.filter(Boolean).map(normalizeBeat);
  if (beats.length === 0) {
    console.log(`${tag}: 0 beats (model returned empty array)`);
  }
  return beats;
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `beat-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Persists one BeatLedgerEntry per beat, sequentially (one create at a
 * time — never Promise.all, per the Phase 1 "one LLM/store call at a time"
 * rule). Returns the array of persisted records (built even if a `create`
 * override is injected for the battery).
 */
export async function recordSceneBeats({
  beats,
  project,
  chapterId = null,
  chapterNumber = null,
  sceneNumber = null,
  sceneAnchor = null,
  sceneHash = null,
  source = 'live',
  extractorModel = null,
  create,
}) {
  const createFn = typeof create === 'function' ? create : (doc) => entities.BeatLedgerEntry.create(doc);
  const created = [];
  for (const beat of beats || []) {
    const doc = {
      id: makeId(),
      project_id: project?.id ?? null,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      scene_number: sceneNumber,
      scene_anchor: sceneAnchor,
      scene_hash: sceneHash,
      source,
      beat_type: beat.beat_type ?? '',
      participants: Array.isArray(beat.participants) ? beat.participants : [],
      subject: beat.subject ?? '',
      summary: beat.summary ?? '',
      emotional_core: beat.emotional_core ?? '',
      outcome: beat.outcome ?? '',
      on_page: beat.on_page !== false,
      extractor_model: extractorModel,
      created_date: new Date().toISOString(),
    };
    await createFn(doc);
    created.push(doc);
  }
  return created;
}
