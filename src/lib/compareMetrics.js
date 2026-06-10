/**
 * Compare Metrics — shared computation for the Compare tab.
 *
 * Loads and analyzes two manuscript "versions" uniformly, regardless of source
 * (current project, different saved project, .docx upload, or .txt/.md paste).
 * Each version is reduced to a common VersionData object containing:
 *
 *   - name, chapters, fullText, stats
 *   - aggregates: per-chapter averages across Analytics-parity metrics
 *   - forensic: Lit Score / Audience Score / AI Index / Critic Status
 *     (runs the same synthesis used by the Forensic Analytics tab)
 *   - critic: null by default; populated on opt-in by runCriticForVersion
 *
 * The metric definitions here mirror the ones in AnalyticsSubPage.jsx. They
 * are duplicated rather than extracted to a shared lib so we don't have to
 * touch the Analytics tab; if a future refactor extracts the metrics into
 * a common metrics lib, this file can call into it unchanged.
 *
 * ONE IMPORTANT CORRECTION: dialogueRatio uses the fixed logic from the
 * Analytics tab rewrite (only words INSIDE quote marks), not the old
 * broken line-contains-quote version.
 */

import { base44 } from '@/api/base44Client';
import { parseDocxFile } from '@/lib/docxParser';
import { calculateManuscriptStats, detectHighFreqPhrases } from '@/lib/manuscriptStats';
import { countWords } from '@/lib/autonovel';
import { loadManuscriptChapters, getFullText } from '@/lib/manuscriptLoader';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { resolveChapterContent } from '@/lib/chapterStorage';
import { runForensicAnalysis } from '@/lib/forensicAnalytics';

/* =============================================================================
 * PER-CHAPTER METRIC FUNCTIONS
 *
 * Duplicated from AnalyticsSubPage.jsx to keep the Analytics tab untouched.
 * If these ever evolve out of sync, the golden version is whichever one is
 * being actively tuned — check both when making changes.
 * ========================================================================== */

function fleschKincaid(text) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 3);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const syllables = words.reduce(
    (sum, w) => sum + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length),
    0
  );
  if (!sentences.length || !words.length) return 0;
  return Math.max(
    0,
    Math.round(
      (0.39 * (words.length / sentences.length) +
        11.8 * (syllables / words.length) -
        15.59) *
        10
    ) / 10
  );
}

/**
 * Dialogue ratio — fixed version (words INSIDE quotes only). See commit
 * history for why the original line-contains-quote version was wrong.
 */
function dialogueRatio(text) {
  if (!text) return 0;
  const totalWords = (text.match(/\b[\w']+\b/g) || []).length;
  if (totalWords === 0) return 0;
  const normalized = text
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, '\u2019');
  const DIALOGUE_RX = /"([^"]{1,2000})"/g;
  let dialogueWords = 0;
  let m;
  while ((m = DIALOGUE_RX.exec(normalized)) !== null) {
    const inner = m[1] || '';
    dialogueWords += (inner.match(/\b[\w']+\b/g) || []).length;
  }
  return Math.round((dialogueWords / totalWords) * 100);
}

function vocabDiversity(text) {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-z]/g, '').length > 2);
  if (!words.length) return 0;
  return Math.round((new Set(words).size / words.length) * 1000) / 10;
}

function aiRiskScore(text) {
  const stats = calculateManuscriptStats(text);
  let risk =
    Math.min(30, stats.bannedWords * 3) +
    Math.min(20, stats.voiceWas * 2) +
    Math.min(15, stats.scaffolds * 10) +
    Math.min(15, Math.max(0, 100 - stats.cleanScore)) +
    Math.min(10, stats.repetitionTotal) +
    Math.min(10, (100 - vocabDiversity(text)) / 5);
  return Math.min(100, Math.round(risk));
}

/* =============================================================================
 * VERSION LOADING — unified across all source types
 * ========================================================================== */

/**
 * Load chapters for an arbitrary project by id, not just the currently open
 * one. Uses the same Chapter.filter + resolveChapterContent + isBodyChapter
 * chain as the main manuscriptLoader, but takes a project id directly.
 */
async function loadChaptersByProjectId(projectId) {
  if (!projectId) return [];
  const rawChapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    500
  );
  const body = rawChapters
    .filter((ch) => isBodyChapter(ch))
    .sort((a, b) => a.chapter_number - b.chapter_number);
  const result = [];
  for (const ch of body) {
    const content = await resolveChapterContent(ch);
    if (content && content.length > 50) {
      result.push({
        chapter_number: ch.chapter_number,
        title: ch.title || 'Chapter ' + ch.chapter_number,
        content,
        id: ch.id,
        word_count: countWords(content),
      });
    }
  }
  return result;
}

/**
 * Load version data from one of four source types.
 *
 * spec shapes:
 *   { type: 'currentProject', project, chapters }
 *   { type: 'otherProject', projectId, projectTitle }
 *   { type: 'upload', file }                // .docx, .txt, .md
 *   { type: 'text', text, name }            // pre-loaded text (for .txt/.md drop)
 *
 * Returns a normalized VersionData object or null on failure.
 */
export async function loadVersionData(spec, onProgress) {
  if (!spec) return null;
  const note = onProgress || (() => {});

  let name = 'Unnamed';
  let chaptersRaw = [];
  let fullText = '';
  let projectType = 'fiction';
  let genre = 'Fiction';

  if (spec.type === 'currentProject') {
    name = spec.project?.title || 'Current Project';
    genre = spec.project?.genre || 'Fiction';
    projectType =
      (spec.project?.project_type || spec.project?.book_type || 'fiction').toLowerCase();
    note(`Loading chapters from ${name}…`);
    chaptersRaw = await loadManuscriptChapters('project', spec.project, spec.chapters, null);
    fullText = getFullText(chaptersRaw);
  } else if (spec.type === 'otherProject') {
    name = spec.projectTitle || 'Saved Project';
    note(`Loading chapters from ${name}…`);
    // Fetch full project record to get genre / type
    try {
      const full = await base44.entities.NovelProject.get(spec.projectId);
      genre = full?.genre || 'Fiction';
      projectType = (full?.project_type || full?.book_type || 'fiction').toLowerCase();
    } catch (err) {
      console.warn('[COMPARE] Could not fetch project record:', err?.message);
    }
    chaptersRaw = await loadChaptersByProjectId(spec.projectId);
    fullText = getFullText(chaptersRaw);
  } else if (spec.type === 'upload') {
    name = spec.file?.name || 'Uploaded file';
    note(`Parsing ${name}…`);
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'docx') {
      const parsed = await parseDocxFile(spec.file);
      fullText = parsed.fullText;
      chaptersRaw = (parsed.chapters || []).map((ch, i) => ({
        chapter_number: i + 1,
        title: ch.title || 'Chapter ' + (i + 1),
        content: ch.content || '',
        word_count: countWords(ch.content || ''),
      }));
    } else {
      const text = await spec.file.text();
      fullText = text;
      chaptersRaw = parsePlainTextChapters(text);
    }
  } else if (spec.type === 'text') {
    name = spec.name || 'Pasted text';
    fullText = spec.text || '';
    chaptersRaw = parsePlainTextChapters(fullText);
  } else {
    console.warn('[COMPARE] Unknown source type:', spec.type);
    return null;
  }

  if (!fullText || !chaptersRaw.length) {
    console.warn('[COMPARE] Empty manuscript for', name);
    return null;
  }

  // Compute per-chapter metrics
  note(`Analyzing ${chaptersRaw.length} chapters in ${name}…`);
  const chapters = chaptersRaw.map((ch) => ({
    chapter_number: ch.chapter_number,
    title: ch.title,
    content: ch.content,
    wordCount: ch.word_count || countWords(ch.content),
    readability: fleschKincaid(ch.content),
    vocabDiversity: vocabDiversity(ch.content),
    dialogueRatio: dialogueRatio(ch.content),
    aiRisk: aiRiskScore(ch.content),
    cleanScore: calculateManuscriptStats(ch.content).cleanScore,
  }));

  // Book-wide stats
  const stats = calculateManuscriptStats(fullText);

  // Phrase scan (high-frequency repetitions)
  const phrases = detectHighFreqPhrases(fullText, chapters.length || 1) || [];

  // Aggregates across chapters
  const n = chapters.length;
  const sum = (key) => chapters.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);
  const aggregates = {
    totalWords: stats.wordCount || sum('wordCount'),
    chapterCount: n,
    avgWordCount: Math.round(sum('wordCount') / n),
    avgReadability: Math.round((sum('readability') / n) * 10) / 10,
    avgVocabDiversity: Math.round((sum('vocabDiversity') / n) * 10) / 10,
    avgDialogueRatio: Math.round(sum('dialogueRatio') / n),
    avgAiRisk: Math.round(sum('aiRisk') / n),
    avgCleanScore: Math.round(sum('cleanScore') / n),
  };

  // Forensic synthesis — computes Lit / Audience / AI Index + LLM findings
  note(`Running forensic audit on ${name}…`);
  let forensic = null;
  try {
    forensic = await runForensicAnalysis({
      fullText,
      chapterStats: chapters,
      stats,
      title: name,
      genre,
      projectType,
    });
  } catch (err) {
    console.warn('[COMPARE] Forensic analysis failed for', name, ':', err?.message);
  }

  return {
    name,
    fullText,
    chapters,
    stats,
    aggregates,
    phrases,
    forensic,
    critic: null, // Populated on opt-in via runCriticForVersion
    projectType,
    genre,
  };
}

/* =============================================================================
 * PLAIN TEXT CHAPTER PARSER
 *
 * The legacy parser only matched markdown '# Chapter N' headers. This version
 * matches the same family of patterns parseDocxFile uses (Chapter / CHAPTER /
 * Part / Section / Prologue / Epilogue) so pasted text behaves the same as
 * uploaded docx.
 * ========================================================================== */

function parsePlainTextChapters(text) {
  if (!text || text.length < 100) return [];
  const pattern = /^(#{0,3}\s*)(chapter\s+[\dIVXivx]+[^\n]*|part\s+[\dIVXivx]+[^\n]*|section\s+[\dIVXivx]+[^\n]*|prologue[^\n]*|epilogue[^\n]*)/gim;
  const matches = [...text.matchAll(pattern)];
  if (matches.length < 2) {
    return [
      {
        chapter_number: 1,
        title: 'Full Manuscript',
        content: text.trim(),
        word_count: countWords(text),
      },
    ];
  }
  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const block = text.substring(start, end).trim();
    const firstNewline = block.indexOf('\n');
    const title = (firstNewline === -1 ? block : block.substring(0, firstNewline)).replace(/^#+\s*/, '').trim();
    const content = firstNewline === -1 ? '' : block.substring(firstNewline + 1).trim();
    if (content.length > 50) {
      chapters.push({
        chapter_number: i + 1,
        title,
        content,
        word_count: countWords(content),
      });
    }
  }
  return chapters.length > 0
    ? chapters
    : [
        {
          chapter_number: 1,
          title: 'Full Manuscript',
          content: text.trim(),
          word_count: countWords(text),
        },
      ];
}

/* =============================================================================
 * COMPARISON COMPUTATION
 * ========================================================================== */

/**
 * Metric registry — which metrics are compared, their display labels, whether
 * higher is better, and the precision for display. Used by the UI to render
 * the side-by-side metric table with winner highlighting.
 *
 * Each entry has a `get` function that extracts the metric from a VersionData
 * object. This keeps the comparison logic declarative and easy to extend.
 */
export const METRIC_REGISTRY = [
  // Volume / scale
  { key: 'totalWords', label: 'Total Words', get: (v) => v.aggregates.totalWords, fmt: 'int', higherIsBetter: null },
  { key: 'chapterCount', label: 'Chapter Count', get: (v) => v.aggregates.chapterCount, fmt: 'int', higherIsBetter: null },
  { key: 'avgWordCount', label: 'Avg Words/Chapter', get: (v) => v.aggregates.avgWordCount, fmt: 'int', higherIsBetter: null },

  // Craft — higher is better
  { key: 'avgCleanScore', label: 'Clean Score (avg)', get: (v) => v.aggregates.avgCleanScore, fmt: 'pct', higherIsBetter: true },
  { key: 'avgVocabDiversity', label: 'Vocab Diversity (avg)', get: (v) => v.aggregates.avgVocabDiversity, fmt: 'pct_1', higherIsBetter: true },

  // Craft — lower is better (AI tells, banned words, voice-pattern repetitions)
  { key: 'bannedWords', label: 'Banned Words (total)', get: (v) => v.stats.bannedWords, fmt: 'int', higherIsBetter: false },
  { key: 'voiceWas', label: 'Voice Pattern Repeats', get: (v) => v.stats.voiceWas, fmt: 'int', higherIsBetter: false },
  { key: 'scaffolds', label: 'AI Scaffold Leaks', get: (v) => v.stats.scaffolds, fmt: 'int', higherIsBetter: false },
  { key: 'avgAiRisk', label: 'AI Risk Score (avg)', get: (v) => v.aggregates.avgAiRisk, fmt: 'pct', higherIsBetter: false },

  // Readability — closer to 7-9 is better, we display raw but don't winner-mark
  { key: 'avgReadability', label: 'Readability FK (avg)', get: (v) => v.aggregates.avgReadability, fmt: 'float_1', higherIsBetter: null },
  { key: 'avgDialogueRatio', label: 'Dialogue %', get: (v) => v.aggregates.avgDialogueRatio, fmt: 'pct', higherIsBetter: null },

  // Forensic synthesis — higher Lit and Audience better, lower AI Index better
  { key: 'litScore', label: 'Lit Score', get: (v) => v.forensic?.litScore, fmt: 'pct', higherIsBetter: true, group: 'forensic' },
  { key: 'audienceScore', label: 'Audience Score', get: (v) => v.forensic?.audienceScore, fmt: 'pct', higherIsBetter: true, group: 'forensic' },
  { key: 'aiIndex', label: 'AI Detection Index', get: (v) => v.forensic?.aiIndex, fmt: 'dec_2', higherIsBetter: false, group: 'forensic' },

  // Mechanical signature
  { key: 'scaffoldDensity', label: 'Scaffold Density (per 1k)', get: (v) => v.forensic?.mechanics?.scaffoldDensity?.density, fmt: 'float_2', higherIsBetter: false, group: 'mechanics' },
  { key: 'burstiness', label: 'Burstiness', get: (v) => v.forensic?.mechanics?.burstiness?.burstiness, fmt: 'float_1', higherIsBetter: true, group: 'mechanics' },
  { key: 'showTell', label: 'Show:Tell Ratio', get: (v) => v.forensic?.mechanics?.showTellRatio?.ratio, fmt: 'pct', higherIsBetter: null, group: 'mechanics' },
  { key: 'hookDensity', label: 'Hook Density', get: (v) => v.forensic?.mechanics?.hookDensity?.ratio, fmt: 'pct', higherIsBetter: true, group: 'mechanics' },
  { key: 'pacingCv', label: 'Pacing Variance (CV)', get: (v) => v.forensic?.mechanics?.pacingVariance?.coefficient, fmt: 'float_2', higherIsBetter: null, group: 'mechanics' },
];

/**
 * Format a numeric value per the registry entry's `fmt` hint.
 */
export function formatMetric(value, fmt) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  switch (fmt) {
    case 'int': return Math.round(n).toLocaleString();
    case 'pct': return Math.round(n) + '%';
    case 'pct_1': return (Math.round(n * 10) / 10) + '%';
    case 'float_1': return (Math.round(n * 10) / 10).toString();
    case 'float_2': return (Math.round(n * 100) / 100).toString();
    case 'dec_2': return n.toFixed(2);
    default: return String(value);
  }
}

/**
 * For a given metric (with higherIsBetter flag), determine which of A or B
 * is the winner. Returns 'A', 'B', or null (tie or no preference direction).
 */
export function declareMetricWinner(valueA, valueB, higherIsBetter) {
  if (higherIsBetter === null || higherIsBetter === undefined) return null;
  if (valueA == null || valueB == null) return null;
  const a = Number(valueA);
  const b = Number(valueB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return null;
  if (higherIsBetter) return a > b ? 'A' : 'B';
  return a < b ? 'A' : 'B';
}

/**
 * Tally metric wins across both versions. Returns
 * { aWins, bWins, ties, overall: 'A'|'B'|'tie' }.
 */
export function tallyWinners(versionA, versionB) {
  let aWins = 0, bWins = 0, ties = 0;
  for (const m of METRIC_REGISTRY) {
    if (m.higherIsBetter === null) continue; // Skip neutral metrics
    const vA = m.get(versionA);
    const vB = m.get(versionB);
    const winner = declareMetricWinner(vA, vB, m.higherIsBetter);
    if (winner === 'A') aWins++;
    else if (winner === 'B') bWins++;
    else ties++;
  }
  const overall = aWins > bWins ? 'A' : bWins > aWins ? 'B' : 'tie';
  return { aWins, bWins, ties, overall };
}

/**
 * Build a per-chapter matrix: for each chapter index that exists in BOTH
 * versions, compute the delta on each tracked metric. Skips chapters that
 * only exist in one version. Returns array of per-chapter delta objects.
 */
export function computeChapterMatrix(versionA, versionB) {
  if (!versionA || !versionB) return [];
  const maxLen = Math.min(versionA.chapters.length, versionB.chapters.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const a = versionA.chapters[i];
    const b = versionB.chapters[i];
    rows.push({
      index: i + 1,
      titleA: a.title,
      titleB: b.title,
      wordCountA: a.wordCount,
      wordCountB: b.wordCount,
      wordCountDelta: b.wordCount - a.wordCount,
      cleanA: a.cleanScore,
      cleanB: b.cleanScore,
      cleanDelta: b.cleanScore - a.cleanScore,
      aiRiskA: a.aiRisk,
      aiRiskB: b.aiRisk,
      aiRiskDelta: b.aiRisk - a.aiRisk,
      readabilityA: a.readability,
      readabilityB: b.readability,
      readabilityDelta: b.readability - a.readability,
    });
  }
  return rows;
}

/**
 * Extract phrase deltas: phrases present in A but gone from B (polish removed
 * them), and phrases new in B that weren't in A (polish introduced them).
 * Both lists capped at 20 entries.
 */
export function computePhraseDeltas(versionA, versionB) {
  if (!versionA?.phrases || !versionB?.phrases) return { removed: [], introduced: [] };
  const aMap = new Map();
  const bMap = new Map();
  for (const p of versionA.phrases) aMap.set(p.phrase || p, p.count || 1);
  for (const p of versionB.phrases) bMap.set(p.phrase || p, p.count || 1);
  const removed = [];
  const introduced = [];
  for (const [phrase, count] of aMap) {
    if (!bMap.has(phrase)) {
      removed.push({ phrase, count });
    } else {
      const bCount = bMap.get(phrase);
      // Only count as "reduced" if the drop is meaningful: at least 30% reduction
      // AND at least 3 fewer occurrences. This filters noise from phrases that
      // had 40 → 38 (2 fewer, a trivial change not worth surfacing).
      const dropRatio = (count - bCount) / count;
      const dropAbs = count - bCount;
      if (dropRatio >= 0.3 && dropAbs >= 3) {
        removed.push({ phrase, count, remaining: bCount });
      }
    }
  }
  for (const [phrase, count] of bMap) {
    if (!aMap.has(phrase)) introduced.push({ phrase, count });
  }
  removed.sort((a, b) => (b.count || 0) - (a.count || 0));
  introduced.sort((a, b) => (b.count || 0) - (a.count || 0));
  return { removed: removed.slice(0, 20), introduced: introduced.slice(0, 20) };
}