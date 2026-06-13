import React, { useMemo, useState, useCallback } from 'react';
import {
  Shield,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Eye,
  Wand2,
  Copy,
  Check,
  FileText,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { parseDocxFile } from '@/lib/docxParser';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';

const AI_DETECT_VERSION = 'ProofreadSubPage-ai-detect-humanizer-v2';
console.log('[AI-DETECT] Loaded', AI_DETECT_VERSION);

// ════════════════════════════════════════════════════════════════
// AI VOCABULARY & PATTERN DETECTION CONSTANTS
// ════════════════════════════════════════════════════════════════

const AI_SIGNATURE_WORDS = [
  'tapestry', 'delve', 'nuanced', 'multifaceted', 'intricate', 'resplendent', 'ethereal',
  'visceral', 'palpable', 'labyrinthine', 'meticulous', 'paradigm', 'dichotomy', 'ephemeral',
  'juxtaposition', 'crescendo', 'cacophony', 'myriad', 'plethora', 'harbinger', 'quintessential',
  'profound', 'eloquent', 'testament', 'undeniable', 'unmistakable', 'insatiable', 'relentless',
  'crystalline', 'luminous', 'gossamer', 'serendipitous', 'ubiquitous', 'resonate', 'transcendent',
  'enigmatic', 'sardonic', 'mellifluous', 'sonorous', 'diaphanous', 'tableau', 'gravitas',
  'orchestrated', 'calibrated', 'utilize', 'commence', 'endeavor', 'pertaining', 'furthermore',
  'nonetheless', 'henceforth', 'aforementioned', 'sprawling', 'opulent', 'liminal', 'primal',
  'ancient', 'ritual', 'horizon', 'threshold', 'fractured', 'shimmering', 'haunting',
];

const AI_TRANSITION_PHRASES = [
  /^However,/gm, /^Moreover,/gm, /^Furthermore,/gm, /^Additionally,/gm,
  /^Consequently,/gm, /^Nevertheless,/gm, /^In conclusion,/gm, /^Notably,/gm,
  /^Interestingly,/gm, /^Importantly,/gm, /^Significantly,/gm, /^Ultimately,/gm,
  /^In essence,/gm, /^In other words,/gm, /^It is worth noting/gm,
  /^It's important to note/gm, /^This underscores/gm, /^This highlights/gm,
];

const EMOTIONAL_TELLS = [
  /\b(?:he|she|they|I)\s+felt\b/gi,
  /\b(?:he|she|they|I)\s+realized\b/gi,
  /\b(?:he|she|they|I)\s+understood\b/gi,
  /\b(?:he|she|they|I)\s+knew\b/gi,
  /\bit was (?:clear|obvious|evident|apparent)\b/gi,
  /\ba sense of\b/gi,
  /\ba wave of\b/gi,
  /\bthe weight of\b/gi,
  /\bthe truth of\b/gi,
  /\bthe reality of\b/gi,
];

const HEDGE_PHRASES = [
  /\bseemed to\b/gi,
  /\bappeared to\b/gi,
  /\bcouldn't help but\b/gi,
  /\bfound (?:himself|herself|themselves)\b/gi,
  /\bas if\b/gi,
  /\balmost\b/gi,
  /\bsomehow\b/gi,
  /\bin a way\b/gi,
];

const CLICHE_PHRASES = [
  /\bsilence (?:hung|fell) (?:heavy|thick)\b/gi,
  /\btension (?:hung|was) (?:thick|palpable)\b/gi,
  /\bweight of the world\b/gi,
  /\bcut through the silence\b/gi,
  /\bbreath (?:caught|hitched) in (?:his|her|their) throat\b/gi,
  /\bheart (?:pounded|hammered|raced)\b/gi,
  /\btime (?:seemed to )?stand still\b/gi,
  /\bsent a shiver down\b/gi,
];

const GENERIC_ABSTRACTIONS = [
  'truth', 'silence', 'darkness', 'light', 'moment', 'weight', 'shadow', 'echo',
  'hunger', 'need', 'fear', 'desire', 'power', 'control', 'freedom', 'choice',
  'memory', 'pain', 'hope', 'something', 'nothing', 'everything',
];

const BAD_OPENERS = new Set([
  'however', 'moreover', 'furthermore', 'additionally', 'consequently',
  'nevertheless', 'ultimately', 'suddenly', 'slowly', 'clearly', 'obviously',
]);

const SCORE_BANDS = [
  { min: 75, label: 'High AI Risk', badge: 'HIGH AI', colorClass: 'bg-red-500', textClass: 'text-red-600', borderClass: 'border-red-400', bgClass: 'bg-red-50/60 dark:bg-red-950/20' },
  { min: 50, label: 'Moderate AI Risk', badge: 'MODERATE', colorClass: 'bg-amber-500', textClass: 'text-amber-600', borderClass: 'border-amber-400', bgClass: 'bg-amber-50/60 dark:bg-amber-950/20' },
  { min: 25, label: 'Low AI Risk', badge: 'LOW', colorClass: 'bg-yellow-500', textClass: 'text-yellow-600', borderClass: 'border-yellow-400', bgClass: 'bg-yellow-50/60 dark:bg-yellow-950/20' },
  { min: 0, label: 'Likely Human-Style', badge: 'HUMAN', colorClass: 'bg-emerald-500', textClass: 'text-emerald-600', borderClass: 'border-emerald-400', bgClass: 'bg-emerald-50/60 dark:bg-emerald-950/20' },
];

const HUMANIZE_MODES = {
  light: {
    label: 'Light',
    description: 'Preserve wording, break robotic rhythm, remove obvious AI tells.',
  },
  standard: {
    label: 'Standard',
    description: 'Improve sentence variety, specificity, voice, and natural friction.',
  },
  deep: {
    label: 'Deep',
    description: 'Rewrite stiff passages while preserving meaning, scene logic, and tone.',
  },
  fiction_voice: {
    label: 'Fiction Voice',
    description: 'Make prose more character-grounded, sensory, and less generic.',
  },
};

// ════════════════════════════════════════════════════════════════
// BASIC TEXT HELPERS
// ════════════════════════════════════════════════════════════════

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function stripWord(word) {
  return String(word || '').toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '');
}

function countWordsLocal(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function splitSentencesWithIndex(text) {
  const source = normalizeText(text);
  const matches = [];
  const rx = /[^.!?…]+[.!?…]["”')\]]*|[^.!?…]+$/g;
  let match;

  while ((match = rx.exec(source)) !== null) {
    const sentence = match[0].trim();
    if (!sentence || sentence.length < 4) continue;

    matches.push({
      text: sentence,
      start: match.index,
      end: match.index + match[0].length,
      wordCount: sentence.split(/\s+/).filter(Boolean).length,
    });
  }

  return matches;
}

function getBand(score) {
  return SCORE_BANDS.find((band) => score >= band.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

function safeJsonParse(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;

  let text = String(raw)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function copyToClipboard(text, message = 'Copied') {
  navigator.clipboard.writeText(String(text || '')).then(
    () => toast.success(message),
    () => toast.error('Copy failed')
  );
}

// ════════════════════════════════════════════════════════════════
// STATISTICAL ANALYSIS FUNCTIONS
// ════════════════════════════════════════════════════════════════

function analyzeText(text) {
  if (!text || text.length < 200) return null;

  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;
  const uniqueWords = new Set(words.map((w) => stripWord(w)).filter((w) => w.length > 2));

  const sentences = splitSentencesWithIndex(normalized);
  const sentLengths = sentences.map((s) => s.wordCount).filter((n) => n > 0);

  const paragraphs = normalized.split(/\n\s*\n/).filter((p) => p.trim().length > 50);
  const paraLengths = paragraphs.map((p) => p.trim().split(/\s+/).length);

  const stdev = (arr) => {
    if (arr.length < 3) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.sqrt(arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length);
  };

  const sentBurstiness = stdev(sentLengths);
  const paraUniformity = stdev(paraLengths);
  const guiraud = uniqueWords.size / Math.sqrt(Math.max(1, totalWords));

  const firstWords = sentences
    .map((s) => stripWord(s.text.split(/\s+/)[0]))
    .filter((w) => w && w.length > 1);

  const uniqueFirstWords = new Set(firstWords);
  const firstWordDiversity = firstWords.length > 0 ? uniqueFirstWords.size / firstWords.length : 0;

  let transitionCount = 0;
  for (const rx of AI_TRANSITION_PHRASES) {
    rx.lastIndex = 0;
    transitionCount += (normalized.match(rx) || []).length;
  }
  const transitionDensity = transitionCount / Math.max(1, totalWords / 1000);

  let aiVocabCount = 0;
  for (const word of AI_SIGNATURE_WORDS) {
    const rx = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    aiVocabCount += (normalized.match(rx) || []).length;
  }
  const aiVocabDensity = aiVocabCount / Math.max(1, totalWords / 1000);

  let emotionalTellCount = 0;
  for (const rx of EMOTIONAL_TELLS) {
    rx.lastIndex = 0;
    emotionalTellCount += (normalized.match(rx) || []).length;
  }
  const emotionalDensity = emotionalTellCount / Math.max(1, totalWords / 1000);

  let hedgeCount = 0;
  for (const rx of HEDGE_PHRASES) {
    rx.lastIndex = 0;
    hedgeCount += (normalized.match(rx) || []).length;
  }
  const hedgeDensity = hedgeCount / Math.max(1, totalWords / 1000);

  let clicheCount = 0;
  for (const rx of CLICHE_PHRASES) {
    rx.lastIndex = 0;
    clicheCount += (normalized.match(rx) || []).length;
  }
  const clicheDensity = clicheCount / Math.max(1, totalWords / 1000);

  const itWasCount = (normalized.match(/(?:^|\.\s+)It was(?:n't)?\s/g) || []).length;
  const itWasDensity = itWasCount / Math.max(1, totalWords / 1000);

  const narrationLines = normalized
    .split('\n')
    .filter((line) => line.trim().length > 30 && !line.trim().startsWith('"') && !line.trim().startsWith('“'));

  let streakCount = 0;
  for (let i = 0; i < narrationLines.length - 2; i += 1) {
    const a = stripWord(narrationLines[i].trim().split(/\s/)[0]);
    const b = stripWord(narrationLines[i + 1]?.trim().split(/\s/)[0]);
    const c = stripWord(narrationLines[i + 2]?.trim().split(/\s/)[0]);
    if (a && a === b && b === c) streakCount += 1;
  }

  const tripletCount = (normalized.match(/\b(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40},\s+(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40},\s+and\s+(?:the|a|an|his|her|their)\s+[^,.;!?]{2,40}/gi) || []).length;
  const tripletDensity = tripletCount / Math.max(1, totalWords / 1000);

  let score = 0;
  let weights = 0;

  const burstScore = sentBurstiness < 4 ? 95 : sentBurstiness < 6 ? 75 : sentBurstiness < 8 ? 50 : sentBurstiness < 10 ? 30 : 10;
  score += burstScore * 22; weights += 22;

  const fwdScore = firstWordDiversity < 0.30 ? 95 : firstWordDiversity < 0.40 ? 75 : firstWordDiversity < 0.50 ? 45 : firstWordDiversity < 0.60 ? 25 : 10;
  score += fwdScore * 18; weights += 18;

  const puScore = paraUniformity < 10 ? 90 : paraUniformity < 20 ? 65 : paraUniformity < 30 ? 40 : 15;
  score += puScore * 13; weights += 13;

  const vrScore = guiraud < 6.5 ? 90 : guiraud < 7.5 ? 65 : guiraud < 8.5 ? 40 : 15;
  score += vrScore * 13; weights += 13;

  const tdScore = transitionDensity > 8 ? 95 : transitionDensity > 5 ? 75 : transitionDensity > 3 ? 50 : transitionDensity > 1 ? 25 : 10;
  score += tdScore * 9; weights += 9;

  const avScore = aiVocabDensity > 3 ? 90 : aiVocabDensity > 1.5 ? 65 : aiVocabDensity > 0.5 ? 35 : 10;
  score += avScore * 9; weights += 9;

  const etScore = emotionalDensity > 8 ? 90 : emotionalDensity > 5 ? 65 : emotionalDensity > 3 ? 40 : 15;
  score += etScore * 6; weights += 6;

  const hedgeScore = hedgeDensity > 8 ? 85 : hedgeDensity > 5 ? 60 : hedgeDensity > 3 ? 40 : 15;
  score += hedgeScore * 5; weights += 5;

  const tripletScore = tripletDensity > 4 ? 85 : tripletDensity > 2 ? 55 : tripletDensity > 1 ? 35 : 10;
  score += tripletScore * 5; weights += 5;

  const aiProbability = Math.round(score / Math.max(1, weights));

  return {
    totalWords,
    totalSentences: sentences.length,
    totalParagraphs: paragraphs.length,
    sentBurstiness: Math.round(sentBurstiness * 10) / 10,
    paraUniformity: Math.round(paraUniformity * 10) / 10,
    guiraud: Math.round(guiraud * 100) / 100,
    uniqueWordCount: uniqueWords.size,
    firstWordDiversity: Math.round(firstWordDiversity * 100),
    transitionCount,
    transitionDensity: Math.round(transitionDensity * 10) / 10,
    aiVocabCount,
    aiVocabDensity: Math.round(aiVocabDensity * 10) / 10,
    emotionalTellCount,
    emotionalDensity: Math.round(emotionalDensity * 10) / 10,
    hedgeCount,
    hedgeDensity: Math.round(hedgeDensity * 10) / 10,
    clicheCount,
    clicheDensity: Math.round(clicheDensity * 10) / 10,
    itWasCount,
    itWasDensity: Math.round(itWasDensity * 10) / 10,
    tripletCount,
    tripletDensity: Math.round(tripletDensity * 10) / 10,
    streakCount,
    aiProbability,
  };
}

function analyzeChapter(text, chapterTitle) {
  const stats = analyzeText(text);
  if (!stats) return null;
  return { title: chapterTitle, ...stats };
}

// ════════════════════════════════════════════════════════════════
// SENTENCE-LEVEL RISK SCANNER
// ════════════════════════════════════════════════════════════════

function localSentenceRisk(sentence, index, allSentences) {
  const text = sentence.text;
  const lower = text.toLowerCase();
  const tags = [];
  let score = 0;

  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const firstWord = stripWord(words[0]);

  if (BAD_OPENERS.has(firstWord)) {
    score += 22;
    tags.push('formal transition opener');
  }

  if (/^(It was|There was|There were|This was|That was)\b/i.test(text.trim())) {
    score += 18;
    tags.push('generic expository opener');
  }

  if (/\b(?:he|she|they|I)\s+(felt|realized|understood|knew)\b/i.test(text)) {
    score += 18;
    tags.push('emotional telling');
  }

  if (/\b(a sense of|a wave of|the weight of|the truth of|the reality of)\b/i.test(text)) {
    score += 16;
    tags.push('abstract emotional framing');
  }

  if (/\b(seemed to|appeared to|couldn't help but|found himself|found herself|found themselves|somehow|almost)\b/i.test(text)) {
    score += 12;
    tags.push('hedging language');
  }

  if (/\b([^,]{3,45}),\s+([^,]{3,45}),\s+and\s+([^,.!?]{3,45})/i.test(text)) {
    score += 12;
    tags.push('triplet structure');
  }

  if (wordCount >= 24 && /[,;—-]/.test(text)) {
    score += 8;
    tags.push('stacked sentence');
  }

  if (wordCount >= 35) {
    score += 12;
    tags.push('overlong sentence');
  }

  if (wordCount <= 4 && !/^["“][^"”]+["”]/.test(text.trim())) {
    score += 4;
    tags.push('fragment rhythm');
  }

  let aiVocabHits = 0;
  for (const word of AI_SIGNATURE_WORDS) {
    if (new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text)) {
      aiVocabHits += 1;
    }
  }

  if (aiVocabHits) {
    score += Math.min(24, aiVocabHits * 10);
    tags.push(`AI-signature vocabulary x${aiVocabHits}`);
  }

  let abstractionHits = 0;
  for (const word of GENERIC_ABSTRACTIONS) {
    if (new RegExp('\\b' + word + '\\b', 'i').test(lower)) abstractionHits += 1;
  }

  if (abstractionHits >= 4) {
    score += 12;
    tags.push('abstract noun cluster');
  } else if (abstractionHits >= 2) {
    score += 6;
    tags.push('abstract wording');
  }

  for (const rx of CLICHE_PHRASES) {
    rx.lastIndex = 0;
    if (rx.test(text)) {
      score += 15;
      tags.push('cliche imagery');
      break;
    }
  }

  const prev = allSentences[index - 1]?.text || '';
  const next = allSentences[index + 1]?.text || '';
  const prevFirst = stripWord(prev.split(/\s+/)[0]);
  const nextFirst = stripWord(next.split(/\s+/)[0]);

  if (firstWord && firstWord === prevFirst && firstWord === nextFirst) {
    score += 22;
    tags.push('same-opener streak');
  } else if (firstWord && firstWord === prevFirst) {
    score += 8;
    tags.push('repeated opener');
  }

  return {
    ...sentence,
    index,
    score: Math.max(0, Math.min(100, Math.round(score))),
    tags: [...new Set(tags)],
  };
}

function buildSentenceAnalysis(chaptersToScan) {
  const chapterSentenceRows = [];
  const allRows = [];

  for (const chapter of chaptersToScan) {
    const sentences = splitSentencesWithIndex(chapter.body);
    const rows = sentences.map((sentence, index) => localSentenceRisk(sentence, index, sentences));
    const scored = rows.filter((row) => row.score > 0);
    const avgRisk = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
      : 0;

    const highRiskCount = rows.filter((row) => row.score >= 50).length;
    const maxRisk = rows.reduce((max, row) => Math.max(max, row.score), 0);

    chapterSentenceRows.push({
      title: chapter.title,
      rows,
      avgRisk,
      highRiskCount,
      maxRisk,
      sentenceCount: rows.length,
    });

    for (const row of rows) {
      if (row.score > 0) {
        allRows.push({
          chapterTitle: chapter.title,
          ...row,
        });
      }
    }
  }

  allRows.sort((a, b) => b.score - a.score);

  return {
    chapterSentenceRows,
    worstSentences: allRows.slice(0, 40),
  };
}

// ════════════════════════════════════════════════════════════════
// LLM PROMPTS
// ════════════════════════════════════════════════════════════════

function buildGeminiDetectionPrompt(text, chapterTitle, localWorstSentences = []) {
  const localHints = localWorstSentences.length
    ? `\nLOCAL SCANNER HINTS:\n${localWorstSentences.slice(0, 10).map((row, i) => `${i + 1}. Score ${row.score}: "${row.text}" | tags: ${row.tags.join(', ')}`).join('\n')}\n`
    : '';

  return `You are an expert AI-content detection analyst for fiction and nonfiction manuscripts. Your job is to determine whether this text has machine-generated prose patterns. You are NOT deciding authorship with certainty. You are identifying AI-risk signals that would be flagged by detector-style tools and by human editors.

Analyze this chapter titled "${chapterTitle || 'Untitled'}" and return a JSON object with these fields:

{
  "ai_probability": <number 0-100, where 0 = very human-style, 100 = very AI-patterned>,
  "confidence": <"high" | "medium" | "low">,
  "verdict": <"likely_human" | "mixed" | "likely_ai" | "almost_certainly_ai">,
  "signals_found": [
    {
      "signal": "<pattern name>",
      "severity": "<high|medium|low>",
      "example": "<quoted excerpt, max 45 words>",
      "suggestion": "<specific humanization fix>"
    }
  ],
  "humanization_plan": [
    "<actionable fix 1>",
    "<actionable fix 2>",
    "<actionable fix 3>"
  ],
  "summary": "<2-3 sentence explanation of your assessment>"
}

AI DETECTION SIGNALS TO CHECK:
1. Predictable sentence rhythm and low burstiness.
2. Uniform paragraph length.
3. Reused sentence openers.
4. AI-signature vocabulary: tapestry, nuanced, delve, visceral, palpable, crystalline, luminous, intricate, etc.
5. Formal transition overuse: However, Moreover, Furthermore, Additionally, Ultimately.
6. Emotional telling: he felt, she realized, it was clear, a sense of, a wave of.
7. Parallel structure abuse and triplet phrasing.
8. Stacked reflections: describes → reflects → re-reflects without new scene movement.
9. Epithets replacing clear names unnaturally.
10. Cliche imagery.
11. Too-perfect grammar and too-smooth prose with no natural friction.
12. Generic abstractions instead of concrete image/behavior.

Be rigorous and practical. Flag specific passages with exact quotes. Score conservatively. Do not moralize. Do not claim certainty. Return ONLY the JSON object. No markdown, no explanation, no backticks.

${localHints}

TEXT TO ANALYZE:
${normalizeText(text).substring(0, 12000)}`;
}

function buildHumanizePrompt({ passage, mode, project, issueTags }) {
  const modeMeta = HUMANIZE_MODES[mode] || HUMANIZE_MODES.standard;
  const title = project?.title || project?.title_working || 'Untitled Project';
  const genre = project?.genre || project?.subgenre || 'fiction';

  return `You are a professional manuscript line editor. Rewrite the passage below so it reads more naturally human, less detector-risky, and less generic, while preserving meaning, POV, tense, genre tone, and story facts.

PROJECT:
Title: ${title}
Genre: ${genre}

HUMANIZATION MODE:
${modeMeta.label} — ${modeMeta.description}

ISSUES TO REDUCE:
${(issueTags || []).join(', ') || 'robotic rhythm, generic phrasing, detector-risky AI patterns'}

RULES:
- Preserve the scene meaning.
- Do not summarize.
- Do not add new plot facts.
- Do not censor adult material if present.
- Do not make it purple or overwritten.
- Add natural sentence variety and specificity.
- Prefer concrete action/image over abstract explanation.
- Avoid "he felt/she realized/a sense of/a wave of" unless truly necessary.
- Return ONLY the rewritten passage. No notes. No markdown.

PASSAGE:
${passage}`;
}

// ════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════════════════════

function ScoreBadge({ score }) {
  const band = getBand(Number(score) || 0);

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${band.colorClass}`}>
      {band.badge} {Math.round(score || 0)}%
    </span>
  );
}

function MetricRow({ label, value, unit, humanRange, aiRange, actual, tip }) {
  const isAI = actual === 'ai';
  const isBorder = actual === 'borderline';

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="min-w-0 flex-1">
        <span className="text-sm text-foreground font-medium">{label}</span>
        {tip && <span className="text-[10px] text-muted-foreground ml-2">({tip})</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-xs text-muted-foreground sm:inline">{humanRange}</span>
        <span className={`text-sm font-bold min-w-[64px] text-right ${isAI ? 'text-red-500' : isBorder ? 'text-amber-500' : 'text-emerald-600'}`}>
          {value}{unit || ''}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{aiRange}</span>
      </div>
    </div>
  );
}

function CopiedButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(text || '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function RiskPill({ score }) {
  const band = getBand(score);

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${band.colorClass}`}>
      {score}
    </span>
  );
}

function SentenceHeatmap({ rows, onHumanize }) {
  const [expandedChapter, setExpandedChapter] = useState(0);

  if (!rows?.length) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Eye className="h-4 w-4" /> Sentence Heatmap
        </h3>
        <p className="text-xs text-muted-foreground">Red/orange sentences are most detector-risky.</p>
      </div>

      <div className="space-y-3">
        {rows.map((chapter, chapterIndex) => {
          const open = expandedChapter === chapterIndex;
          return (
            <div key={chapter.title || chapterIndex} className="rounded-xl border border-border/50 bg-background/50">
              <button
                type="button"
                onClick={() => setExpandedChapter(open ? -1 : chapterIndex)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
              >
                <div className="min-w-0 flex items-center gap-2">
                  {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="truncate text-sm font-semibold text-foreground">{chapter.title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">{chapter.highRiskCount} hot / {chapter.sentenceCount} sentences</span>
                  <ScoreBadge score={chapter.avgRisk} />
                </div>
              </button>

              {open && (
                <div className="max-h-[520px] space-y-2 overflow-y-auto border-t border-border/50 p-3">
                  {chapter.rows
                    .filter((row) => row.score >= 12)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 80)
                    .map((row) => {
                      const band = getBand(row.score);
                      return (
                        <div key={`${chapter.title}-${row.index}`} className={`rounded-lg border p-3 ${band.borderClass} ${band.bgClass}`}>
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <RiskPill score={row.score} />
                              <span className="text-[11px] text-muted-foreground">Sentence {row.index + 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CopiedButton text={row.text} />
                              <button
                                type="button"
                                onClick={() => onHumanize(row)}
                                className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-1 text-[11px] text-background"
                              >
                                <Wand2 className="h-3 w-3" /> Humanize
                              </button>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-foreground">{row.text}</p>
                          {row.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {row.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HumanizePanel({ selected, project, onClose }) {
  const [mode, setMode] = useState('standard');
  const [busy, setBusy] = useState(false);
  const [rewrite, setRewrite] = useState('');

  if (!selected) return null;

  const handleHumanize = async () => {
    setBusy(true);
    setRewrite('');

    try {
      const response = await invokeLLMWithRetry({
        task_type: 'proofread',
        model: 'gemini_3_flash',
        fallback_model: 'deepseek/deepseek-chat-v3-0324',
        temperature: 0.35,
        max_tokens: 2200,
        prompt: buildHumanizePrompt({
          passage: selected.text,
          mode,
          project,
          issueTags: selected.tags,
        }),
      });

      const text = typeof response === 'string'
        ? response
        : response?.text || response?.data || response?.content || '';

      setRewrite(normalizeText(text));
    } catch (error) {
      toast.error('Humanize failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 dark:bg-amber-950/20">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-amber-600" /> Humanization Workbench
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Rewrites the selected passage to reduce stiff/robotic patterns while preserving meaning.
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-background/70">
          Close
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original</span>
            <RiskPill score={selected.score} />
          </div>
          <p className="text-sm leading-6 text-foreground">{selected.text}</p>
          {selected.tags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {selected.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border/60 bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rewrite</span>
            {rewrite ? <CopiedButton text={rewrite} label="Copy rewrite" /> : null}
          </div>

          {rewrite ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{rewrite}</p>
          ) : (
            <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-xs text-muted-foreground">
              Choose a mode and generate a cleaner rewrite.
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {Object.entries(HUMANIZE_MODES).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-xl border px-3 py-2 text-left transition ${
              mode === key
                ? 'border-amber-700 bg-amber-900 text-white'
                : 'border-border/60 bg-background/70 text-foreground hover:border-amber-400'
            }`}
          >
            <div className="text-xs font-bold">{meta.label}</div>
            <div className={`mt-1 text-[10px] leading-4 ${mode === key ? 'text-white/80' : 'text-muted-foreground'}`}>
              {meta.description}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={handleHumanize} disabled={busy} className="rounded-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Generate Humanized Rewrite
        </Button>
      </div>
    </div>
  );
}

function ReportDownloadButton({ report }) {
  const handleDownload = () => {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `ai-detection-report-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Button type="button" onClick={handleDownload} variant="outline" size="sm" className="rounded-full gap-1 text-xs">
      <FileText className="h-3.5 w-3.5" /> Export Report
    </Button>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function ProofreadSubPage({ project, chapters, busyLabel, setBusyLabel, onRefreshAll }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [parsed, setParsed] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState('');
  const [overallStats, setOverallStats] = useState(null);
  const [chapterStats, setChapterStats] = useState([]);
  const [geminiResults, setGeminiResults] = useState([]);
  const [combinedScore, setCombinedScore] = useState(null);
  const [sentenceAnalysis, setSentenceAnalysis] = useState(null);
  const [selectedHumanize, setSelectedHumanize] = useState(null);
  const [lastScanMeta, setLastScanMeta] = useState(null);

  const isBusy = !!busyLabel || scanning;

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    const name = file.name || '';
    if (!name.toLowerCase().endsWith('.docx') && !name.toLowerCase().endsWith('.txt')) {
      toast.error('Please upload a .docx or .txt file');
      return;
    }

    setUploading(true);
    setParsed(null);
    setCombinedScore(null);
    setOverallStats(null);
    setChapterStats([]);
    setGeminiResults([]);
    setSentenceAnalysis(null);
    setSelectedHumanize(null);

    try {
      if (name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        const chunks = text.split(/\n{3,}/).filter((chunk) => chunk.trim().length > 100);

        setParsed({
          chapters: chunks.length
            ? chunks.map((body, i) => ({ title: `Section ${i + 1}`, body: body.trim() }))
            : [{ title: 'Full Document', body: text.trim() }],
          filename: name,
        });
      } else {
        const result = await parseDocxFile(file);
        setParsed({
          chapters: result.chapters?.length
            ? result.chapters
            : [{ title: 'Full Document', body: result.text || '' }],
          filename: name,
        });
      }

      toast.success('Document loaded');
    } catch (err) {
      toast.error('Failed to parse: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  }, []);

  const resetResults = () => {
    setOverallStats(null);
    setChapterStats([]);
    setGeminiResults([]);
    setCombinedScore(null);
    setSentenceAnalysis(null);
    setSelectedHumanize(null);
    setLastScanMeta(null);
  };

  const loadChaptersToScan = async () => {
    let chaptersToScan = [];

    if (source === 'project') {
      const bodyChapters = (chapters || [])
        .filter((ch) => chapterHasContent(ch) && isBodyChapter(ch))
        .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

      for (const ch of bodyChapters) {
        const content = await resolveChapterContent(ch);
        if (content && content.length > 200) {
          chaptersToScan.push({
            title: ch.title || `Chapter ${ch.chapter_number || '?'}`,
            body: content,
          });
        }
      }
    } else if (parsed?.chapters) {
      chaptersToScan = parsed.chapters.filter((c) => c.body && c.body.length > 200);
    }

    return chaptersToScan;
  };

  const handleScan = async () => {
    setScanning(true);
    setProgress('Loading text…');
    resetResults();

    try {
      const chaptersToScan = await loadChaptersToScan();

      if (!chaptersToScan.length) {
        toast.error('No content to analyze');
        return;
      }

      setLastScanMeta({
        source,
        chapterCount: chaptersToScan.length,
        scannedAt: new Date().toISOString(),
        filename: parsed?.filename || '',
      });

      setProgress('Phase 1: statistical fingerprint analysis…');
      console.log('[AI-DETECT] ═══ PHASE 1: STATISTICAL ANALYSIS ═══');

      const fullText = chaptersToScan.map((c) => c.body).join('\n\n');
      const overall = analyzeText(fullText);
      setOverallStats(overall);

      const perChapter = chaptersToScan.map((c) => analyzeChapter(c.body, c.title)).filter(Boolean);
      setChapterStats(perChapter);

      setProgress('Phase 2: sentence heatmap analysis…');
      console.log('[AI-DETECT] ═══ PHASE 2: SENTENCE HEATMAP ═══');

      const sentenceRows = buildSentenceAnalysis(chaptersToScan);
      setSentenceAnalysis(sentenceRows);

      setProgress('Phase 3: Gemini deep pattern analysis…');
      console.log('[AI-DETECT] ═══ PHASE 3: GEMINI DEEP ANALYSIS ═══');

      const maxGemini = 5;
      const step = Math.max(1, Math.floor(chaptersToScan.length / maxGemini));
      const sampled = [];

      for (let i = 0; i < chaptersToScan.length && sampled.length < maxGemini; i += step) {
        sampled.push({ idx: i, ...chaptersToScan[i] });
      }

      const gemResults = [];

      for (let s = 0; s < sampled.length; s += 1) {
        const ch = sampled[s];

        setProgress(`Phase 3: Gemini analyzing "${ch.title}" (${s + 1}/${sampled.length})…`);

        try {
          const localWorst = sentenceRows.chapterSentenceRows
            .find((row) => row.title === ch.title)
            ?.rows
            ?.filter((row) => row.score >= 25)
            ?.sort((a, b) => b.score - a.score) || [];

          const response = await invokeLLMWithRetry({
            task_type: 'critique',
            model: 'gemini_3_flash',
            fallback_model: 'deepseek/deepseek-chat-v3-0324',
            temperature: 0.1,
            max_tokens: 4000,
            prompt: buildGeminiDetectionPrompt(ch.body, ch.title, localWorst),
          });

          const raw = typeof response === 'string'
            ? response
            : response?.text || response?.data || response?.content || '';

          const parsedJson = safeJsonParse(raw);

          if (parsedJson) {
            const probability = Math.max(0, Math.min(100, Math.round(Number(parsedJson.ai_probability) || 0)));
            gemResults.push({
              chapterIdx: ch.idx,
              title: ch.title,
              ...parsedJson,
              ai_probability: probability,
              signals_found: Array.isArray(parsedJson.signals_found) ? parsedJson.signals_found : [],
              humanization_plan: Array.isArray(parsedJson.humanization_plan) ? parsedJson.humanization_plan : [],
            });

            console.log(`[AI-DETECT] Gemini "${ch.title}": ${probability}% (${parsedJson.verdict})`);
          } else {
            console.warn(`[AI-DETECT] Gemini parse failed for "${ch.title}"`);
            gemResults.push({
              chapterIdx: ch.idx,
              title: ch.title,
              ai_probability: null,
              verdict: 'parse_error',
              signals_found: [],
              humanization_plan: [],
              summary: 'Gemini response could not be parsed.',
            });
          }
        } catch (err) {
          console.error(`[AI-DETECT] Gemini failed for "${ch.title}":`, err?.message || err);
          gemResults.push({
            chapterIdx: ch.idx,
            title: ch.title,
            ai_probability: null,
            verdict: 'error',
            signals_found: [],
            humanization_plan: [],
            summary: err?.message || 'Gemini scan failed.',
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      setGeminiResults(gemResults);

      const validGemini = gemResults.filter((r) => r.ai_probability !== null);
      const geminiAvg = validGemini.length > 0
        ? Math.round(validGemini.reduce((sum, r) => sum + r.ai_probability, 0) / validGemini.length)
        : null;

      const heatmapAvg = sentenceRows.chapterSentenceRows.length
        ? Math.round(sentenceRows.chapterSentenceRows.reduce((sum, r) => sum + r.avgRisk, 0) / sentenceRows.chapterSentenceRows.length)
        : 0;

      const combined = geminiAvg !== null
        ? Math.round((overall.aiProbability * 0.35) + (heatmapAvg * 0.20) + (geminiAvg * 0.45))
        : Math.round((overall.aiProbability * 0.65) + (heatmapAvg * 0.35));

      setCombinedScore(combined);

      console.log(
        `[AI-DETECT] FINAL SCORE: ${combined}%`,
        { statistical: overall.aiProbability, heatmap: heatmapAvg, gemini: geminiAvg ?? 'N/A' }
      );
    } catch (err) {
      console.error('[AI-DETECT] Scan error:', err);
      toast.error('Scan failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setScanning(false);
      setProgress('');
    }
  };

  const totalSignals = geminiResults.reduce((sum, result) => sum + (result.signals_found?.length || 0), 0);
  const geminiAverage = geminiResults.filter((r) => r.ai_probability !== null).length
    ? Math.round(geminiResults.filter((r) => r.ai_probability !== null).reduce((sum, r) => sum + r.ai_probability, 0) / geminiResults.filter((r) => r.ai_probability !== null).length)
    : null;

  const heatmapAverage = sentenceAnalysis?.chapterSentenceRows?.length
    ? Math.round(sentenceAnalysis.chapterSentenceRows.reduce((sum, row) => sum + row.avgRisk, 0) / sentenceAnalysis.chapterSentenceRows.length)
    : null;

  const reportText = useMemo(() => {
    if (combinedScore === null) return '';

    const lines = [];
    lines.push('AI Detection / Humanization Risk Report');
    lines.push(`Version: ${AI_DETECT_VERSION}`);
    lines.push(`Project: ${project?.title || project?.title_working || 'Untitled'}`);
    lines.push(`Source: ${lastScanMeta?.source || source}`);
    lines.push(`Scanned: ${lastScanMeta?.scannedAt || new Date().toISOString()}`);
    lines.push('');
    lines.push(`Overall AI Risk Score: ${combinedScore}%`);
    lines.push(`Statistical Score: ${overallStats?.aiProbability ?? 'N/A'}%`);
    lines.push(`Sentence Heatmap Average: ${heatmapAverage ?? 'N/A'}%`);
    lines.push(`Gemini Deep Scan Average: ${geminiAverage ?? 'N/A'}%`);
    lines.push(`Flagged LLM Signals: ${totalSignals}`);
    lines.push('');

    if (overallStats) {
      lines.push('Statistical Fingerprint:');
      lines.push(`- Words: ${overallStats.totalWords}`);
      lines.push(`- Sentences: ${overallStats.totalSentences}`);
      lines.push(`- Sentence Burstiness: ${overallStats.sentBurstiness}`);
      lines.push(`- First-Word Diversity: ${overallStats.firstWordDiversity}%`);
      lines.push(`- Paragraph Uniformity: ${overallStats.paraUniformity}`);
      lines.push(`- Vocabulary Richness: ${overallStats.guiraud}`);
      lines.push(`- AI Vocabulary Density: ${overallStats.aiVocabDensity}/1K`);
      lines.push(`- Emotional Tells: ${overallStats.emotionalDensity}/1K`);
      lines.push(`- Hedge Density: ${overallStats.hedgeDensity}/1K`);
      lines.push(`- Cliche Density: ${overallStats.clicheDensity}/1K`);
      lines.push('');
    }

    if (sentenceAnalysis?.worstSentences?.length) {
      lines.push('Worst Sentence-Level Risks:');
      for (const row of sentenceAnalysis.worstSentences.slice(0, 25)) {
        lines.push(`- [${row.score}] ${row.chapterTitle}: "${row.text}"`);
        lines.push(`  Tags: ${row.tags.join(', ')}`);
      }
      lines.push('');
    }

    if (geminiResults.length) {
      lines.push('Gemini Deep Scan:');
      for (const result of geminiResults) {
        lines.push(`- ${result.title}: ${result.ai_probability ?? 'N/A'}% / ${result.verdict || 'unknown'}`);
        if (result.summary) lines.push(`  Summary: ${result.summary}`);
        for (const sig of result.signals_found || []) {
          lines.push(`  * ${sig.severity || 'medium'} — ${sig.signal || 'Pattern'}: ${sig.example || ''}`);
          if (sig.suggestion) lines.push(`    Fix: ${sig.suggestion}`);
        }
      }
    }

    return lines.join('\n');
  }, [combinedScore, geminiAverage, heatmapAverage, lastScanMeta, overallStats, project, sentenceAnalysis, source, totalSignals, geminiResults]);

  const band = getBand(combinedScore || 0);

  return (
    <div className="w-full max-w-5xl space-y-6 overflow-hidden">
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground mb-1 flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-600" /> AI Detection Scanner
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Detector-style manuscript scan with statistical fingerprinting, sentence-level heatmap, Gemini deep pattern review, and a humanization workbench for flagged passages.
            </p>
          </div>
          {combinedScore !== null && <ReportDownloadButton report={reportText} />}
        </div>
      </div>

      <SourceSelector source={source} setSource={setSource} project={project} />

      {source === 'upload' && !parsed && (
        <UploadZone onFileSelect={handleFileSelect} onFileLoaded={setParsed} uploading={uploading} />
      )}

      {source === 'upload' && parsed && (
        <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-foreground">
            {parsed.filename || parsed.title || 'Uploaded document'} — {parsed.chapters?.length || 1} section(s)
          </span>
          <Button variant="ghost" size="sm" onClick={() => { setParsed(null); resetResults(); }} className="shrink-0 rounded-full text-xs">
            Change File
          </Button>
        </div>
      )}

      {(source === 'project' || parsed) && !scanning && combinedScore === null && (
        <Button onClick={handleScan} disabled={isBusy} className="w-full rounded-full gap-2 text-base py-5">
          <Shield className="h-5 w-5" /> Run AI Detection Scan
        </Button>
      )}

      {scanning && (
        <div className="rounded-2xl border border-border/60 bg-card/70 py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-600" />
          <p className="mt-3 text-sm text-muted-foreground">{progress}</p>
        </div>
      )}

      {combinedScore !== null && (
        <div className="space-y-5">
          <div className={`rounded-2xl border-2 p-6 text-center ${band.borderClass} ${band.bgClass}`}>
            <div className={`text-6xl font-bold mb-1 ${band.textClass}`}>
              {combinedScore}%
            </div>
            <div className={`text-sm font-semibold uppercase tracking-wider mb-2 ${band.textClass}`}>
              {band.label}
            </div>
            <p className="text-xs text-muted-foreground">
              Statistical: {overallStats?.aiProbability}% · Heatmap: {heatmapAverage ?? 'N/A'}% · Gemini: {geminiAverage ?? 'N/A'}% · {totalSignals} deep pattern(s) flagged
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-muted-foreground">
              This is an AI-risk estimate for editing, not a legal or academic proof of authorship. Use it to find stiff, repetitive, over-polished, or detector-risky manuscript passages.
            </p>
          </div>

          <HumanizePanel
            selected={selectedHumanize}
            project={project}
            onClose={() => setSelectedHumanize(null)}
          />

          {overallStats && (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Statistical Fingerprint
              </h3>
              <MetricRow label="Sentence Burstiness" value={overallStats.sentBurstiness} tip="stdev of sentence lengths"
                humanRange="Human: >8" aiRange="AI: <5"
                actual={overallStats.sentBurstiness < 5 ? 'ai' : overallStats.sentBurstiness < 8 ? 'borderline' : 'human'} />
              <MetricRow label="First-Word Diversity" value={overallStats.firstWordDiversity} unit="%"
                tip="unique openers / total sentences" humanRange=">55%" aiRange="<40%"
                actual={overallStats.firstWordDiversity < 40 ? 'ai' : overallStats.firstWordDiversity < 55 ? 'borderline' : 'human'} />
              <MetricRow label="Paragraph Uniformity" value={overallStats.paraUniformity} tip="stdev of para lengths"
                humanRange="Human: >25" aiRange="AI: <12"
                actual={overallStats.paraUniformity < 12 ? 'ai' : overallStats.paraUniformity < 25 ? 'borderline' : 'human'} />
              <MetricRow label="Vocabulary Richness" value={overallStats.guiraud} tip="Guiraud's Index"
                humanRange=">8.5" aiRange="<7.0"
                actual={overallStats.guiraud < 7 ? 'ai' : overallStats.guiraud < 8.5 ? 'borderline' : 'human'} />
              <MetricRow label="AI Transitions" value={overallStats.transitionDensity} unit="/1K" tip="However, Moreover, etc."
                humanRange="<2" aiRange=">5"
                actual={overallStats.transitionDensity > 5 ? 'ai' : overallStats.transitionDensity > 2 ? 'borderline' : 'human'} />
              <MetricRow label="AI Vocabulary" value={overallStats.aiVocabDensity} unit="/1K" tip="tapestry, nuanced, etc."
                humanRange="<0.5" aiRange=">1.5"
                actual={overallStats.aiVocabDensity > 1.5 ? 'ai' : overallStats.aiVocabDensity > 0.5 ? 'borderline' : 'human'} />
              <MetricRow label="Emotional Tells" value={overallStats.emotionalDensity} unit="/1K" tip="he felt, she realized"
                humanRange="<3" aiRange=">6"
                actual={overallStats.emotionalDensity > 6 ? 'ai' : overallStats.emotionalDensity > 3 ? 'borderline' : 'human'} />
              <MetricRow label="Hedge Phrases" value={overallStats.hedgeDensity} unit="/1K" tip="seemed to, appeared to"
                humanRange="<3" aiRange=">6"
                actual={overallStats.hedgeDensity > 6 ? 'ai' : overallStats.hedgeDensity > 3 ? 'borderline' : 'human'} />
              <MetricRow label="Cliche Imagery" value={overallStats.clicheDensity} unit="/1K"
                humanRange="<1" aiRange=">3"
                actual={overallStats.clicheDensity > 3 ? 'ai' : overallStats.clicheDensity > 1 ? 'borderline' : 'human'} />
              <MetricRow label="Triplet Structures" value={overallStats.tripletDensity} unit="/1K" tip="the X, the Y, and the Z"
                humanRange="<1" aiRange=">3"
                actual={overallStats.tripletDensity > 3 ? 'ai' : overallStats.tripletDensity > 1 ? 'borderline' : 'human'} />
              <div className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                {overallStats.totalWords.toLocaleString()} words · {overallStats.totalSentences.toLocaleString()} sentences · {overallStats.uniqueWordCount.toLocaleString()} unique words · {overallStats.aiVocabCount} AI-signature words
              </div>
            </div>
          )}

          {chapterStats.length > 1 && (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Chapter Risk Table</h3>
              <div className="max-h-[320px] overflow-y-auto">
                {chapterStats.map((ch, i) => (
                  <div key={`${ch.title}-${i}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-secondary/40 text-sm">
                    <span className="min-w-0 flex-1 truncate text-foreground">{ch.title}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-muted-foreground sm:inline">{ch.totalWords.toLocaleString()}w</span>
                      <span className="hidden text-xs text-muted-foreground md:inline">burst:{ch.sentBurstiness}</span>
                      <ScoreBadge score={ch.aiProbability} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <SentenceHeatmap
            rows={sentenceAnalysis?.chapterSentenceRows || []}
            onHumanize={(row) => setSelectedHumanize(row)}
          />

          {sentenceAnalysis?.worstSentences?.length ? (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Worst Detector-Risk Sentences
              </h3>
              <div className="space-y-2">
                {sentenceAnalysis.worstSentences.slice(0, 12).map((row, i) => (
                  <div key={`${row.chapterTitle}-${row.index}-${i}`} className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <RiskPill score={row.score} />
                        <span className="truncate text-xs font-semibold text-muted-foreground">{row.chapterTitle}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHumanize(row)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2 py-1 text-[11px] text-background"
                      >
                        <Wand2 className="h-3 w-3" /> Humanize
                      </button>
                    </div>
                    <p className="text-sm leading-6 text-foreground">{row.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {geminiResults.length > 0 && totalSignals > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" /> Deep Pattern Findings ({totalSignals})
              </h3>
              <div className="space-y-4 max-h-[520px] overflow-y-auto">
                {geminiResults.map((gr, gi) => {
                  if (!gr.signals_found?.length) return null;

                  return (
                    <div key={`${gr.title}-${gi}`}>
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="truncate">{gr.title}</span>
                        {gr.ai_probability !== null && <ScoreBadge score={gr.ai_probability} />}
                      </div>

                      {gr.signals_found.map((sig, si) => (
                        <div key={`${sig.signal}-${si}`} className="ml-0 mb-2 rounded-xl bg-secondary/30 px-3 py-2 sm:ml-3">
                          <div className="flex items-center gap-2 mb-1">
                            {sig.severity === 'high' ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> :
                             sig.severity === 'medium' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /> :
                             <CheckCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />}
                            <span className="text-xs font-semibold text-foreground">{sig.signal || 'Pattern'}</span>
                          </div>
                          {sig.example && (
                            <p className="text-xs text-muted-foreground italic ml-5 mb-1">"{sig.example}"</p>
                          )}
                          {sig.suggestion && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400 ml-5">Fix: {sig.suggestion}</p>
                          )}
                        </div>
                      ))}

                      {gr.humanization_plan?.length ? (
                        <div className="ml-0 mt-2 rounded-xl border border-emerald-300/50 bg-emerald-50/50 p-3 dark:bg-emerald-950/20 sm:ml-3">
                          <div className="mb-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">Humanization Plan</div>
                          <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                            {gr.humanization_plan.map((step, idx) => <li key={idx}>{step}</li>)}
                          </ul>
                        </div>
                      ) : null}

                      {gr.summary && (
                        <p className="text-xs text-muted-foreground ml-0 mt-2 sm:ml-3">{gr.summary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {geminiResults.some((r) => r.summary && (!r.signals_found || r.signals_found.length === 0)) && (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
              <h3 className="text-sm font-bold text-foreground mb-2">Deep Scan Chapter Summaries</h3>
              <div className="space-y-2">
                {geminiResults
                  .filter((r) => r.summary && (!r.signals_found || r.signals_found.length === 0))
                  .map((r, i) => (
                    <div key={`${r.title}-${i}`} className="rounded-lg bg-secondary/30 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{r.title}</span>
                        {r.ai_probability !== null && <ScoreBadge score={r.ai_probability} />}
                      </div>
                      <span className="text-sm text-muted-foreground">{r.summary}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleScan} disabled={scanning} variant="outline" size="sm" className="rounded-full text-xs gap-1">
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Scan Again
            </Button>
            <Button onClick={resetResults} variant="ghost" size="sm" className="rounded-full text-xs">
              Clear Results
            </Button>
            {reportText && <ReportDownloadButton report={reportText} />}
          </div>
        </div>
      )}
    </div>
  );
}
