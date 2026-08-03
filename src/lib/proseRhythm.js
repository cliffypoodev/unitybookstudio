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
