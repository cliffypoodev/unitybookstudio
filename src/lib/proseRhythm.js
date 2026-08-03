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
