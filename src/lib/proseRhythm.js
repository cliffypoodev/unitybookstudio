/**
 * RHYTHM-1 — deterministic prose-rhythm and gesture telemetry.
 *
 * MEASUREMENT ONLY. This module rewrites nothing and repairs nothing. It exists
 * because the SIGNATURE VOICE rules already command aggressive sentence-length
 * variance and the drafts ignore them: measured on Brass Meridian TEST export 12,
 * 49-61% of ALL sentences are 5 words or shorter (chapter means 5.6-7.2 words)
 * and "looked" appears 134 times in 21,909 words. You cannot fix what you do not
 * measure, and per the POLISHFIX-2/3 lesson, deterministic word-swap "fixes" for
 * style are banned - enforcement is generation-side (prompt) + telemetry (here).
 *
 * Pure functions, no imports, no I/O.
 */

const GESTURE_WORDS = ['looked', 'turned', 'nodded'];

/** Split prose into sentences for length statistics. Dialogue quotes are kept
 *  inside their sentences; fragments count as sentences on purpose - fragments
 *  ARE the staccato being measured. */
export function splitRhythmSentences(text) {
  return String(text || '')
    .replace(/[“”"]/g, '')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * @returns {{
 *   sentenceCount, wordCount, meanLen, pctShort, pctLong, maxShortRun,
 *   gesturesPer1000: {looked, turned, nodded, combined}
 * }}
 * pctShort = % of sentences with <= 5 words. pctLong = % with >= 20 words.
 * maxShortRun = longest run of CONSECUTIVE <=5-word sentences.
 */
export function measureRhythm(text) {
  const sentences = splitRhythmSentences(text);
  const lens = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const wordCount = lens.reduce((a, b) => a + b, 0);
  const shortCount = lens.filter((l) => l <= 5).length;
  const longCount = lens.filter((l) => l >= 20).length;

  let maxShortRun = 0;
  let run = 0;
  for (const l of lens) {
    if (l <= 5) { run += 1; if (run > maxShortRun) maxShortRun = run; }
    else run = 0;
  }

  const lower = String(text || '').toLowerCase();
  const per1000 = {};
  let combined = 0;
  for (const w of GESTURE_WORDS) {
    const count = (lower.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length;
    per1000[w] = wordCount ? Number(((count * 1000) / wordCount).toFixed(1)) : 0;
    combined += count;
  }
  per1000.combined = wordCount ? Number(((combined * 1000) / wordCount).toFixed(1)) : 0;

  return {
    sentenceCount: sentences.length,
    wordCount,
    meanLen: sentences.length ? Number((wordCount / sentences.length).toFixed(1)) : 0,
    pctShort: sentences.length ? Math.round((100 * shortCount) / sentences.length) : 0,
    pctLong: sentences.length ? Math.round((100 * longCount) / sentences.length) : 0,
    maxShortRun,
    gesturesPer1000: per1000,
  };
}

/** Advisory thresholds, calibrated on export 12 (which violates all of them)
 *  vs. the configured Crouch/Child register (which passes them). */
export const RHYTHM_ADVISORY = {
  minMeanLen: 8,
  maxPctShort: 40,
  maxShortRun: 5,
  maxGesturesPer1000: 6,
};

/** One console line per measurement point. Returns { line, flags }. */
export function formatRhythmLine(label, metrics) {
  const m = metrics;
  const flags = [];
  // Distribution stats are meaningless on a handful of sentences; run-length and
  // gesture density still are. 25 sentences ~= two paragraphs.
  const enoughSample = m.sentenceCount >= 25;
  if (enoughSample && m.meanLen && m.meanLen < RHYTHM_ADVISORY.minMeanLen) flags.push(`meanLen<${RHYTHM_ADVISORY.minMeanLen}`);
  if (enoughSample && m.pctShort > RHYTHM_ADVISORY.maxPctShort) flags.push(`pctShort>${RHYTHM_ADVISORY.maxPctShort}`);
  if (m.maxShortRun > RHYTHM_ADVISORY.maxShortRun) flags.push(`shortRun>${RHYTHM_ADVISORY.maxShortRun}`);
  if (m.gesturesPer1000.combined > RHYTHM_ADVISORY.maxGesturesPer1000) flags.push(`gestures>${RHYTHM_ADVISORY.maxGesturesPer1000}/1k`);
  const line =
    `[RHYTHM] ${label} | sents=${m.sentenceCount} mean=${m.meanLen}w short(≤5w)=${m.pctShort}% ` +
    `long(≥20w)=${m.pctLong}% maxShortRun=${m.maxShortRun} ` +
    `looked/turned/nodded=${m.gesturesPer1000.combined}/1kw` +
    (flags.length ? ` | ADVISORY: ${flags.join(' ')}` : ' | ok');
  return { line, flags };
}

// ── RHYTHM-2: severity tier + deterministic take comparison ──────────────────
//
// Calibrated on the instrumented ch.1 run (2026-08-03): raw scenes measured
// 5.8w/64%/run11, 4.9w/74%/run16, 7.6w/45%/run6. The first two are the disease
// at full strength; the third is the model doing it roughly right. SEVERE is
// drawn between them, so a chapter like that one regenerates exactly its two
// worst scenes (~+2 LLM calls) and leaves the near-miss alone.
export const RHYTHM_SEVERE = {
  maxMeanLen: 7,
  minPctShort: 60,
  maxShortRun: 7,
  minSentences: 25,
};

/** True when a raw scene is staccato enough to be worth ONE regeneration. */
export function isSeverelyFlat(metrics) {
  const m = metrics || {};
  if ((m.sentenceCount || 0) < RHYTHM_SEVERE.minSentences) return false;
  return (
    (m.meanLen || 0) < RHYTHM_SEVERE.maxMeanLen ||
    (m.pctShort || 0) > RHYTHM_SEVERE.minPctShort ||
    (m.maxShortRun || 0) > RHYTHM_SEVERE.maxShortRun
  );
}

/** Deterministic comparison of two takes of the same scene, BY RHYTHM ONLY.
 *  Returns 'candidate' when the regenerated take measurably improves rhythm,
 *  else 'original'. Ties go to the original - never churn on equal takes. */
export function pickBetterRhythm(original, candidate) {
  const a = original || {};
  const b = candidate || {};
  const score = (m) =>
    (m.meanLen || 0) -
    0.05 * (m.pctShort || 0) -
    0.3 * (m.maxShortRun || 0) +
    0.05 * (m.pctLong || 0);
  return score(b) > score(a) ? 'candidate' : 'original';
}

/** The one-shot regeneration instruction, quoting the measured numbers. Appended
 *  to the ORIGINAL scene prompt - it adds a correction, it replaces nothing, and
 *  the AUTHOR VOICE deference in the base prompt still governs. */
export function buildRhythmRegenInstruction(metrics) {
  const m = metrics || {};
  return `RHYTHM CORRECTION - REGENERATED TAKE (BINDING):
Your previous take of THIS scene measured: average sentence length ${m.meanLen} words, ${m.pctShort}% of sentences at 5 words or fewer, and a run of ${m.maxShortRun} consecutive short sentences. That is machine-gun staccato, not the configured voice.
Write the SAME scene again - same events, same entry and exit state, same characters, same facts - with the sentence rhythm the SIGNATURE VOICE rules demand:
- Average sentence length between 9 and 14 words.
- Never more than 3 consecutive sentences of 5 words or fewer.
- Roughly every 150 words, one sentence of 20+ words that moves through space, action, or thought without stopping.
- Fragments are for impact only - one per beat, not the default cadence.
Do not summarize. Do not change any event, name, injury, or object. Where the selected AUTHOR VOICE dossier specifies a different rhythm, the AUTHOR VOICE wins.`;
}

// ── GESTURE-2: severity tier + regeneration instruction for gesture loops ────
//
// Calibrated on export 13 per-scene density (gestures = looked/turned/nodded
// per 1000 words): clean scenes measure 5.1-8.4, diseased scenes 10.2-18.2,
// with a clear gap between 8.4 and 10.2. SEVERE is drawn in that gap. The
// advisory cap (6/1kw) proved decorative: ch.2 was drafted WITH the cap in its
// prompt and shipped 11.5/1kw - the model ignores gesture instructions it is
// not held to, exactly as it ignored rhythm targets before RHYTHM-2. Same cure:
// ONE bounded regeneration with the measured numbers quoted, deterministic
// pick, ties to the original. minWords guards small-sample noise.
export const GESTURE_SEVERE = {
  minPer1000: 10,
  minWords: 400,
};

/** True when a raw scene is gesture-saturated enough to be worth ONE regeneration. */
export function isSeverelyGestural(metrics) {
  const m = metrics || {};
  if ((m.wordCount || 0) < GESTURE_SEVERE.minWords) return false;
  const density = (m.gesturesPer1000 && m.gesturesPer1000.combined) || 0;
  return density >= GESTURE_SEVERE.minPer1000;
}

/** The gesture regeneration instruction, quoting the measured numbers. Composed
 *  alongside (or without) the rhythm instruction; AUTHOR VOICE still governs. */
export function buildGestureRegenInstruction(metrics) {
  const m = metrics || {};
  const density = (m.gesturesPer1000 && m.gesturesPer1000.combined) || 0;
  const perWord = m.gesturesPer1000 || {};
  return `GESTURE CORRECTION - REGENERATED TAKE (BINDING):
Your previous take of THIS scene used looked/turned/nodded at ${density} per 1000 words (looked ${perWord.looked ?? 0}, turned ${perWord.turned ?? 0}, nodded ${perWord.nodded ?? 0}). That is stage business standing in for thought.
Write the SAME scene again - same events, same entry and exit state, same characters, same facts - with the gesture loop broken:
- looked/turned/nodded: at most ONE of these words per 150 words of prose, and never twice in the same paragraph.
- Where the old take had a character look/turn/nod, give what they NOTICE, DECIDE, or DO instead - a concrete observation, a thought, an action that moves the scene.
- Do not swap in synonyms (glanced, pivoted, tilted his head) - that is the same disease wearing a new word. Replace the beat, not the verb.
Do not summarize. Do not change any event, name, injury, or object. Where the selected AUTHOR VOICE dossier specifies otherwise, the AUTHOR VOICE wins.`;
}

/** Deterministic comparison of two takes when EITHER severity trigger fired.
 *  triggers = { flat, gestural }. Rules, in order:
 *  1. A gesture-only regen must not INTRODUCE severe flatness - keep original.
 *  2. A flat-only regen must not INTRODUCE severe gesture density - keep original.
 *  3. Otherwise score each take on the triggered dimensions only; strict
 *     improvement wins, ties go to the original - never churn on equal takes. */
export function pickBetterTake(original, candidate, triggers) {
  const t = triggers || {};
  const a = original || {};
  const b = candidate || {};
  if (t.gestural && !t.flat && isSeverelyFlat(b) && !isSeverelyFlat(a)) return 'original';
  if (t.flat && !t.gestural && isSeverelyGestural(b) && !isSeverelyGestural(a)) return 'original';
  const rhythmScore = (m) =>
    (m.meanLen || 0) -
    0.05 * (m.pctShort || 0) -
    0.3 * (m.maxShortRun || 0) +
    0.05 * (m.pctLong || 0);
  const gestureDensity = (m) => (m.gesturesPer1000 && m.gesturesPer1000.combined) || 0;
  const score = (m) =>
    (t.flat ? rhythmScore(m) : 0) - (t.gestural ? 0.5 * gestureDensity(m) : 0);
  return score(b) > score(a) ? 'candidate' : 'original';
}
