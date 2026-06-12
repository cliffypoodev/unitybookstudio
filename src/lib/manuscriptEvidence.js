/**
 * Manuscript Evidence Engine — pure deterministic analysis.
 * NO LLM calls, NO saves, NO async.
 *
 * Builds a structured evidence report for each chapter and the
 * full manuscript, covering slop density, dialogue ratio, TTR,
 * adverb density, forensic tics, clichés, and repeated bigrams.
 *
 * @module manuscriptEvidence
 */

import { countAISlopPatterns, buildAISlopBudgetReport, SLOP_BUDGETS } from '@/lib/aiSlopReduction.js';
import { calculateManuscriptStats, detectHighFreqPhrases } from '@/lib/manuscriptStats.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * CONSTANTS
 * ═════════════════════════════════════════════════════════════════════════ */

const FORENSIC_KEYS = [
  'the available accounts indicate',
  'the available accounts suggest',
  'what remains unclear is',
  'the record shows',
  'the surviving record shows',
  'the record suggests',
  'this suggests',
  'the question therefore shifts',
];

const ADVERB_EXCLUSIONS = new Set([
  'only', 'early', 'family', 'holy', 'july', 'italy', 'rally', 'belly',
  'jelly', 'bully', 'ally', 'fly', 'reply', 'supply', 'apply', 'rely',
  'comply', 'imply', 'multiply', 'lily', 'folly', 'holly', 'molly',
  'polly', 'sally', 'tally', 'kelly',
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'of', 'for', 'and', 'or',
  'but', 'is', 'was', 'it', 'he', 'she', 'they', 'that', 'this', 'with',
  'from', 'as', 'by', 'has', 'had', 'have', 'not', 'are', 'were', 'been',
  'be', 'do', 'did', 'does', 'will', 'would', 'could', 'should', 'can',
  'may', 'might', 'shall', 'must', 'i', 'you', 'we', 'my', 'his', 'her',
  'its', 'our', 'their', 'me', 'him', 'us', 'them', 'who', 'what',
  'which', 'when', 'where', 'how', 'if', 'so', 'no', 'all', 'any',
  'some', 'each', 'every', 'into', 'about', 'up', 'out', 'over', 'than',
  'then', 'just', 'more', 'also', 'very', 'much', 'too', 'still',
  'already', 'now', 'here', 'there', 'back', 'down',
]);

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPER FUNCTIONS (internal — not exported)
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Fraction of non-empty lines starting with a straight or curly open quote.
 * @param {string} text
 * @returns {number}
 */
function computeDialogueRatio(text) {
  if (!text) return 0;
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return 0;
  let dialogueLines = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('"') || trimmed.startsWith('\u201c')) {
      dialogueLines++;
    }
  }
  return dialogueLines / lines.length;
}

/**
 * Type-token ratio — unique words / total words.
 * For texts >500 words, samples 500-word sliding windows every 250 words
 * and averages the per-window TTRs.
 * @param {string} text
 * @returns {number}
 */
function computeTypeTokenRatio(text) {
  if (!text) return 0;
  const words = text.toLowerCase().match(/\b[a-z']+\b/g);
  if (!words || words.length === 0) return 0;

  if (words.length <= 500) {
    const unique = new Set(words);
    return unique.size / words.length;
  }

  // Sliding-window average
  let totalTTR = 0;
  let windowCount = 0;
  for (let start = 0; start + 500 <= words.length; start += 250) {
    const window = words.slice(start, start + 500);
    const unique = new Set(window);
    totalTTR += unique.size / window.length;
    windowCount++;
  }
  return windowCount > 0 ? totalTTR / windowCount : 0;
}

/**
 * Count of words ending in 'ly' (excluding known non-adverbs) / total words.
 * @param {string} text
 * @returns {number}
 */
function computeAdverbDensity(text) {
  if (!text) return 0;
  const words = text.toLowerCase().match(/\b[a-z']+\b/g);
  if (!words || words.length === 0) return 0;

  let adverbCount = 0;
  for (const w of words) {
    if (w.endsWith('ly') && w.length > 2 && !ADVERB_EXCLUSIONS.has(w)) {
      adverbCount++;
    }
  }
  return adverbCount / words.length;
}

/**
 * Top 5 repeated bigrams by frequency (excluding stop-word-only pairs).
 * @param {string} text
 * @returns {Array<{bigram: string, count: number}>}
 */
function computeRepeatedBigrams(text) {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b[a-z']+\b/g);
  if (!words || words.length < 2) return [];

  const counts = {};
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    // Exclude pairs where BOTH words are stop words
    if (STOP_WORDS.has(w1) && STOP_WORDS.has(w2)) continue;
    const bigram = `${w1} ${w2}`;
    counts[bigram] = (counts[bigram] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([bigram, count]) => ({ bigram, count }));
}

/**
 * Safe word count via whitespace split.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN EXPORT
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Build a comprehensive manuscript evidence report.
 *
 * @param {Array<{chapter: object, content: string, original: string}>} loaded
 * @param {object} project — the project record
 * @returns {object} Structured evidence JSON (see module doc)
 */
export function buildManuscriptEvidenceReport(loaded, project) {
  const chapters = [];
  let manuscriptTotalWords = 0;
  const pacingCurve = [];
  const dialogueRatioCurve = [];
  const slopScoreCurve = [];
  const allText = [];

  for (const entry of loaded) {
    const content = entry.content || '';
    const chapter = entry.chapter || {};
    const chapterNumber = chapter.chapter_number ?? chapter.chapterNumber ?? chapters.length + 1;
    const title = chapter.title || `Chapter ${chapterNumber}`;
    const words = countWords(content);
    manuscriptTotalWords += words;

    // Dialogue ratio
    const dialogueRatio = computeDialogueRatio(content);

    // Type-token ratio
    const typeTokenRatio = computeTypeTokenRatio(content);

    // Adverb density
    const adverbDensity = computeAdverbDensity(content);

    // Slop analysis
    const slopResult = countAISlopPatterns(content);
    const budgetReport = buildAISlopBudgetReport(content);

    const overBudget = budgetReport.budgets.filter(b => b.over === true);

    // Top 5 offenders by count
    const topOffenders = Object.entries(slopResult.counts)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key]) => key);

    // Forensic tic counts — only the forensic keys
    const forensicTicCounts = {};
    for (const fk of FORENSIC_KEYS) {
      if (slopResult.counts[fk] !== undefined) {
        forensicTicCounts[fk] = slopResult.counts[fk];
      }
    }

    // Cliché count from manuscriptStats
    const msStats = calculateManuscriptStats(content);
    const clicheCount = msStats.predictablePhrases || 0;

    // Repeated bigrams
    const repeatedBigrams = computeRepeatedBigrams(content);

    // Quality gate action from cleanScore
    const cleanScore = msStats.cleanScore ?? 0;
    let qualityGateAction;
    if (cleanScore >= 90) {
      qualityGateAction = 'pass';
    } else if (cleanScore >= 70) {
      qualityGateAction = 'review';
    } else {
      qualityGateAction = 'revise';
    }

    chapters.push({
      chapterNumber,
      title,
      words,
      dialogueRatio: Math.round(dialogueRatio * 10000) / 10000,
      typeTokenRatio: Math.round(typeTokenRatio * 10000) / 10000,
      adverbDensity: Math.round(adverbDensity * 10000) / 10000,
      slop: {
        score: slopResult.density,
        total: slopResult.total,
        byTier: overBudget,
        topOffenders,
      },
      forensicTicCounts,
      clicheCount,
      repeatedBigrams,
      qualityGateAction,
    });

    pacingCurve.push(words);
    dialogueRatioCurve.push(Math.round(dialogueRatio * 10000) / 10000);
    slopScoreCurve.push(slopResult.density);
    allText.push(content);
  }

  // Manuscript-level type-token ratio
  const fullText = allText.join('\n');
  const manuscriptTTR = computeTypeTokenRatio(fullText);

  return {
    chapters,
    manuscript: {
      totalWords: manuscriptTotalWords,
      chapterCount: chapters.length,
      pacingCurve,
      dialogueRatioCurve,
      slopScoreCurve,
      ttr: Math.round(manuscriptTTR * 10000) / 10000,
    },
  };
}

console.log('[MANUSCRIPT-EVIDENCE] v1 loaded');
