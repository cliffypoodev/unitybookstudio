/**
 * aiCheckDimensions.js
 *
 * Deterministic five-dimension AI-check scoring for manuscript text.
 * No LLM calls — pure text analysis using aiSlopReduction patterns,
 * statistical fingerprints, and vocabulary metrics.
 *
 * Dimensions:
 *   1. Slop Density    — AI cliché / pattern density (from aiSlopReduction)
 *   2. Rhythm Rigidity — sentence-length burstiness & paragraph uniformity
 *   3. Vocabulary Soup — AI signature words, hedge phrases, emotional tells
 *   4. Structural Monotony — first-word diversity, triplet structures, streaks
 *   5. Transition Overuse — "However/Moreover/Furthermore" density
 *
 * Each dimension scores 0–100 (0 = fully human, 100 = fully AI).
 * An overall weighted average produces a single composite score.
 *
 * @module aiCheckDimensions
 */

import { countAISlopPatterns, scoreAISlopDensity } from '@/lib/aiSlopReduction';

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═════════════════════════════════════════════════════════════════════════ */

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function stdev(arr) {
  if (arr.length < 3) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length);
}

function splitSentences(text) {
  return (text || '').split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 5);
}

function stripWord(w) {
  return (w || '').replace(/[^a-zA-Z']/g, '').toLowerCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * AI VOCAB / TRANSITION / HEDGE LISTS (small for perf — same as ProofreadSubPage)
 * ═════════════════════════════════════════════════════════════════════════ */

const AI_TRANSITIONS = [
  /\bhowever\b/gi, /\bmoreover\b/gi, /\bfurthermore\b/gi, /\bnevertheless\b/gi,
  /\bnonetheless\b/gi, /\bconsequently\b/gi, /\bconversely\b/gi, /\bin conclusion\b/gi,
  /\badditionally\b/gi, /\bspecifically\b/gi, /\bultimately\b/gi, /\bsignificantly\b/gi,
];

const AI_SIGNATURE = [
  'tapestry', 'nuanced', 'intricacies', 'pivotal', 'multifaceted',
  'commendable', 'delve', 'embark', 'underscores', 'landscape',
  'vibrant', 'testament', 'renowned', 'culmination', 'quintessential',
];

const HEDGE_PHRASES = [
  /\bseemed to\b/gi, /\bappeared to\b/gi, /\ba sense of\b/gi,
  /\bsomething like\b/gi, /\bas if\b/gi, /\bperhaps\b/gi,
];

const EMOTIONAL_TELLS = [
  /\b(?:he|she|they) felt\b/gi, /\b(?:he|she|they) realized\b/gi,
  /\b(?:he|she|they) knew\b/gi, /\b(?:he|she|they) could feel\b/gi,
  /\b(?:he|she|they) could see\b/gi,
];

/* ═══════════════════════════════════════════════════════════════════════════
 * DIMENSION SCORING — each returns { score: 0-100, detail: string }
 * ═════════════════════════════════════════════════════════════════════════ */

function scoreSlopDensity(text) {
  const { total, density: rawDensity } = countAISlopPatterns(text);
  const densityResult = scoreAISlopDensity(text);
  const wc = countWords(text);
  const per1k = wc > 0 ? (total / wc) * 1000 : 0;

  // Score: >8/1K = 100, 0/1K = 0, linear between
  const score = Math.min(100, Math.round((per1k / 8) * 100));

  return {
    score,
    label: 'Slop Density',
    detail: `${total} AI-slop patterns (${per1k.toFixed(1)}/1K words). Severity: ${densityResult?.severity || 'low'}.`,
    raw: { totalPatterns: total, per1k: Math.round(per1k * 10) / 10, severity: densityResult?.severity },
  };
}

function scoreRhythmRigidity(text) {
  const sentences = splitSentences(text);
  const sentLengths = sentences.map((s) => countWords(s)).filter((n) => n > 0);
  const paragraphs = (text || '').split(/\n\s*\n/).filter((p) => p.trim().length > 50);
  const paraLengths = paragraphs.map((p) => countWords(p));

  const sentBurst = stdev(sentLengths);
  const paraBurst = stdev(paraLengths);

  // Low burstiness = AI (uniform). sentBurst < 4 → score 95, > 12 → score 5
  const sentScore = sentBurst < 4 ? 95 : sentBurst < 6 ? 75 : sentBurst < 8 ? 50 : sentBurst < 10 ? 25 : 5;
  const paraScore = paraBurst < 10 ? 90 : paraBurst < 20 ? 60 : paraBurst < 30 ? 35 : 10;

  const score = Math.round(sentScore * 0.6 + paraScore * 0.4);

  return {
    score,
    label: 'Rhythm Rigidity',
    detail: `Sentence burstiness: ${sentBurst.toFixed(1)} (human >8). Paragraph variation: ${paraBurst.toFixed(1)} (human >25).`,
    raw: { sentBurstiness: Math.round(sentBurst * 10) / 10, paraVariation: Math.round(paraBurst * 10) / 10 },
  };
}

function scoreVocabSoup(text) {
  const wc = countWords(text);
  const norm = (text || '').toLowerCase();
  const per1k = (count) => wc > 0 ? (count / wc) * 1000 : 0;

  let aiVocab = 0;
  for (const word of AI_SIGNATURE) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    aiVocab += (norm.match(rx) || []).length;
  }

  let hedges = 0;
  for (const rx of HEDGE_PHRASES) { rx.lastIndex = 0; hedges += (norm.match(rx) || []).length; }

  let emotional = 0;
  for (const rx of EMOTIONAL_TELLS) { rx.lastIndex = 0; emotional += (norm.match(rx) || []).length; }

  const aiPer1k = per1k(aiVocab);
  const hedgePer1k = per1k(hedges);
  const emotPer1k = per1k(emotional);

  const aiScore = aiPer1k > 3 ? 90 : aiPer1k > 1.5 ? 65 : aiPer1k > 0.5 ? 35 : 10;
  const hedgeScore = hedgePer1k > 6 ? 85 : hedgePer1k > 3 ? 55 : hedgePer1k > 1 ? 30 : 10;
  const emotScore = emotPer1k > 6 ? 85 : emotPer1k > 3 ? 55 : emotPer1k > 1 ? 30 : 10;

  const score = Math.round(aiScore * 0.5 + hedgeScore * 0.25 + emotScore * 0.25);

  return {
    score,
    label: 'Vocabulary Soup',
    detail: `AI words: ${aiPer1k.toFixed(1)}/1K. Hedge phrases: ${hedgePer1k.toFixed(1)}/1K. Emotional tells: ${emotPer1k.toFixed(1)}/1K.`,
    raw: { aiVocabPer1k: Math.round(aiPer1k * 10) / 10, hedgePer1k: Math.round(hedgePer1k * 10) / 10, emotionalPer1k: Math.round(emotPer1k * 10) / 10 },
  };
}

function scoreStructuralMonotony(text) {
  const sentences = splitSentences(text);
  const firstWords = sentences.map((s) => stripWord(s.split(/\s+/)[0])).filter((w) => w.length > 1);
  const uniqueFirstWords = new Set(firstWords);
  const fwDiv = firstWords.length > 0 ? uniqueFirstWords.size / firstWords.length : 1;

  // Triplets: the X, the Y, and the Z
  const triplets = ((text || '').match(
    /\b(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40},\s+(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40},\s+and\s+(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40}/gi
  ) || []).length;
  const wc = countWords(text);
  const tripletPer1k = wc > 0 ? (triplets / wc) * 1000 : 0;

  const fwdScore = fwDiv < 0.30 ? 95 : fwDiv < 0.40 ? 75 : fwDiv < 0.50 ? 50 : fwDiv < 0.60 ? 25 : 5;
  const tripScore = tripletPer1k > 3 ? 85 : tripletPer1k > 1.5 ? 55 : tripletPer1k > 0.5 ? 30 : 5;

  const score = Math.round(fwdScore * 0.7 + tripScore * 0.3);

  return {
    score,
    label: 'Structural Monotony',
    detail: `First-word diversity: ${(fwDiv * 100).toFixed(0)}% (human >55%). Triplet structures: ${tripletPer1k.toFixed(1)}/1K.`,
    raw: { firstWordDiversity: Math.round(fwDiv * 100), tripletsPer1k: Math.round(tripletPer1k * 10) / 10 },
  };
}

function scoreTransitionOveruse(text) {
  const wc = countWords(text);
  const norm = (text || '');

  let count = 0;
  for (const rx of AI_TRANSITIONS) { rx.lastIndex = 0; count += (norm.match(rx) || []).length; }
  const per1k = wc > 0 ? (count / wc) * 1000 : 0;

  const score = per1k > 8 ? 95 : per1k > 5 ? 75 : per1k > 3 ? 50 : per1k > 1 ? 25 : 5;

  return {
    score,
    label: 'Transition Overuse',
    detail: `${count} AI transitions (${per1k.toFixed(1)}/1K). Human fiction typically <2/1K.`,
    raw: { count, per1k: Math.round(per1k * 10) / 10 },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * PUBLIC API
 * ═════════════════════════════════════════════════════════════════════════ */

const DIMENSION_WEIGHTS = {
  slopDensity: 25,
  rhythmRigidity: 25,
  vocabSoup: 20,
  structuralMonotony: 18,
  transitionOveruse: 12,
};

/**
 * Build a deterministic five-dimension AI-check report for manuscript text.
 * @param {string} text — full manuscript text (or chapter text)
 * @returns {{ dimensions: Array, compositeScore: number, wordCount: number }}
 */
export function buildDimensionReport(text) {
  if (!text || countWords(text) < 100) {
    return { dimensions: [], compositeScore: 0, wordCount: 0 };
  }

  const dimensions = [
    { key: 'slopDensity', ...scoreSlopDensity(text) },
    { key: 'rhythmRigidity', ...scoreRhythmRigidity(text) },
    { key: 'vocabSoup', ...scoreVocabSoup(text) },
    { key: 'structuralMonotony', ...scoreStructuralMonotony(text) },
    { key: 'transitionOveruse', ...scoreTransitionOveruse(text) },
  ];

  let weightedSum = 0;
  let totalWeight = 0;
  for (const dim of dimensions) {
    const w = DIMENSION_WEIGHTS[dim.key] || 10;
    weightedSum += dim.score * w;
    totalWeight += w;
  }

  const compositeScore = Math.round(weightedSum / Math.max(1, totalWeight));

  return {
    dimensions,
    compositeScore,
    wordCount: countWords(text),
  };
}

export { DIMENSION_WEIGHTS };
