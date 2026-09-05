// src/lib/proseLab.js
// PROSELAB-1 — Phase 0 "Prose Lab" capture (UBS_plan.md Phase 0). Zero behavior
// change when PROSE_LAB_CAPTURE_FEATURE is off: a wrapped call site builds and
// stores a capture record through the app's entity store only when the flag is
// on; it never blocks, delays, or alters the generation it wraps. A storage
// failure is logged and swallowed (fail open) — capture must never be able to
// break a real generation.
//
// Relative imports only — this module is imported directly by
// test/proselab1.acceptance.mjs under bare Node (master fix plan §0.1).

import { entities } from './localDB.js';

export const PROSELAB_VERSION = 'prose-lab-v1';

// Feature-flag shape matches the app's convention (generationContext.js
// SCENE_EXECUTION_ACCEPTANCE_GATE_FEATURE: Object.freeze({ key, defaultEnabled })).
// Stored on the project record under its own field, `project.prose_lab_flags`,
// separate from `project.scene_execution_flags` — a diagnostic-only capture flag
// has no business tripping DEADGATE-1's "unknown scene-execution flag" warning
// in generationContext.js's resolveSceneExecutionFlags.
export const PROSE_LAB_CAPTURE_FEATURE = Object.freeze({
  key: 'prose_lab_capture_v1',
  defaultEnabled: false,
});

// Descriptor-safe read — mirrors generationContext.js's isSceneContextComposerEnabled
// pattern: a getter/setter or non-enumerable value on the flags object never counts.
export function isProseLabCaptureEnabled(project) {
  const flags = project?.prose_lab_flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return PROSE_LAB_CAPTURE_FEATURE.defaultEnabled;
  }
  const proto = Object.getPrototypeOf(flags);
  if (proto !== Object.prototype && proto !== null) {
    return PROSE_LAB_CAPTURE_FEATURE.defaultEnabled;
  }
  const descriptor = Object.getOwnPropertyDescriptor(flags, PROSE_LAB_CAPTURE_FEATURE.key);
  if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable) {
    return PROSE_LAB_CAPTURE_FEATURE.defaultEnabled;
  }
  return descriptor.value === true;
}

function charCount(value) {
  return typeof value === 'string' ? value.length : 0;
}

function wordCount(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function makeId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function defaultCreate(doc) {
  return entities.ProseLabCapture.create(doc);
}

/**
 * Persist one generation attempt. Always returns the built record — even when
 * storage fails — so a caller can log or inspect it; never throws.
 *
 * NOTE (Phase 0 scope): `promptSections` is a best-effort breakdown supplied by
 * the caller, not computed here. The compiled prompt's ~40 named sub-blocks
 * (sceneWriter.js buildFictionPrompt — see docs/pipeline-map.md §1) are not
 * exposed at the generation call site without instrumenting buildFictionPrompt's
 * internals, which this phase deliberately does not do (capture-only, zero
 * behavior change to generation code). Callers with no breakdown available
 * should omit the field or pass {}; never fabricate numbers.
 */
export async function captureGeneration(record = {}, opts = {}) {
  const create = typeof opts.create === 'function' ? opts.create : defaultCreate;
  const full = {
    id: record.id || makeId(),
    timestamp: record.timestamp || new Date().toISOString(),
    project_id: record.projectId ?? null,
    book_id: record.bookId ?? record.projectId ?? null,
    chapter: record.chapter ?? null,
    scene_id: record.sceneId ?? null,
    attempt: record.attempt ?? 1,
    model: record.model ?? null,
    temperature: record.temperature ?? null,
    compiled_prompt: typeof record.compiledPrompt === 'string' ? record.compiledPrompt : '',
    prompt_char_count: charCount(record.compiledPrompt),
    prompt_sections: (record.promptSections && typeof record.promptSections === 'object' && !Array.isArray(record.promptSections))
      ? record.promptSections
      : {},
    output: typeof record.output === 'string' ? record.output : '',
    output_word_count: wordCount(record.output),
    accepted: record.accepted !== false,
    repair_reason: record.repairReason ?? null,
  };
  try {
    await create(full);
  } catch (err) {
    console.warn(`[PROSELAB] capture failed (fail-open): ${err?.message || err}`);
  }
  return full;
}
