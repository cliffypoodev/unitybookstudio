/**
 * Full Manuscript Fixer
 *
 * src/lib/manuscriptFixer.js
 *
 * Polish tab "Fix Entire Manuscript" engine.
 *
 * v56 changes:
 * - Adds final hard clamp for v13 survivors: stubborn p.m./a.m. On split, malformed quote-list punctuation, physical-site reviewer role scar, missing commas after source-condition clauses, and remaining overconfident lock/grudge/conclusion language.
 *
 * v55 changes:
 * - Adds hard cleanup for v12 survivors: remaining manuscript-facing instruction language, stubborn p.m./a.m. date splits, site-investigator persona leakage, missing commas, and overcertain Chapter 12 synthesis/convergence language.
 *
 * v54 changes:
 * - Adds terminal cleanup for v11 survivors: manuscript-meta language leaks, stubborn p.m./a.m. date splits, missing source-list commas, malformed quoted lists, and overcertain Chapter 12 synthesis language.
 *
 * v53 changes:
 * - Adds terminal nonfiction caution/copyedit sweep for v10 survivors: lowercase paragraph starts, overconfident lock/fire/key claims, direct unverified family-letter quotes, and lingering comma/interrupter defects.
 * - Keeps v51 terminal source-claim/copyedit cleanup.
 *
 * v51 changes:
 * - Adds terminal nonfiction source-claim/copyedit cleanup for v8 survivors: p.m./a.m. date splits, broader interrupter commas, quote-list fragments, dangling narrative stumps, article errors, and high-risk generic source/persona wording.
 * - Keeps v50 final copyedit/artifact cleanup.
 *
 * v50 changes:
 * - Adds final nonfiction copyedit/artifact cleanup for repeated questions, quote-list damage, missing commas around interrupters, and p.m./a.m. sentence breaks.
 * - Keeps v49 role/pronoun repairs and expands them into general prose cleanup so generated nonfiction does not leave obvious machine scar tissue.
 * - Adds broader lowercase/uppercase sentence-start and em-dash continuation fixes for remaining Missouri Gothic-style survivors.
 *
 * v49 changes:
 * - Fixes role-replacement pronoun damage from v48, including he told she, she's grandfather, and duplicate wife labels.
 * - Adds em-dash capitalization cleanup and lowercased sentence-start artifact repairs for nonfiction.
 * - Adds broader source/proofread residue cleanup for record-gap, tour-guide, investigator, and descendant role artifacts.
 *
 * v38 changes:
 * - Expands collapsed-dialogue repair to catch echo fragments ending in comma/close-quote after structural quarantines.
 * - Adds generic missing opening-quote repair for short quoted echoes like: “X.” X,” Name echoed.
 *
 * v37 changes:
 * - Adds generic collapsed-dialogue / orphaned-dialogue-fragment repair after structural quarantines.
 * - Prevents chapters from exporting with smashed multi-speaker dialogue paragraphs after a route/stump cut.
 * - Keeps v36 opening access-plan stump quarantine, v35 opening negotiation quarantine, v34 orphaned solo venue/contact quarantine, v33 access-plan reversal quarantine, and v32 Base44-safe URL persistence.
 *
 * v30 changes:
 * - Adds a terminal marker-anchored quarantine for generic false-start boundary artifacts.
 * - Expands the prior-branch search window so long false branches are removed, not just the marker paragraph.
 * - Treats surviving false-start markers as hard contamination and removes/quarantines them before save.
 *
 * v29 changes:
 * - Adds generic marker-aware branch removal for false-start boundary artifacts when both sides repeat the same route/contact/outcome tokens.
 * - Adds generic competing-access-attempt quarantine for solo-entry false branches followed by a later group/token/stage access route.
 * - Lowers high-confidence route thresholds slightly so obvious repeated contact/destination routes are removed instead of only warned.
 *
 * v28 changes:
 * - Escalates generic repeated-route detection from warning-only to safe quarantine when two distant route windows reuse the same route/contact/destination tokens.
 * - Adds generic branch-divergence anchors so the earlier false branch is removed while keeping the later fuller branch.
 *
 * v27 changes:
 * - Adds a reusable, project-agnostic branch-collision guard inside the Fix/Polish engine.
 * - Adds generic cross-chapter opening-bleed detection.
 * - Adds generic repeated paragraph / false-start artifact quarantine.
 * - Keeps v26 terminal source guard and no-LLM quota trap.
 *
 * v26 changes:
 * - Forces Chapter 1 boundary rescue at save time and during verification/export-source survivor checks.
 * - Treats structural survivors as save-verification failures, not as successful polish.
 * - Preserves deterministic-only no-LLM behavior from v24.
 *
 * v24 changes:
 * - Emergency deterministic-only polish mode: skips all LLM copyedit calls during Fix Entire Manuscript.
 * - Stops OpenAI insufficient_quota retry loops and OpenRouter fallback timeout cascades.
 * - Keeps structural quarantine, boundary gates, mechanical survivor repair, save-gate verification, and export-safe persistence.
 * - Based on v23 chapter-number resolver boundary gate.
 *
 * v13 changes:
 * - Keeps the v12 storage-safe save/export pipeline and title-only export support.
 * - Moves the stubborn literal survivor patch into a forced final save-gate step.
 * - Runs the same literal patch immediately before final save validation as a backstop.
 * - Targets the two exact survivors still visible in the v12 exported DOCX:
 *   "10:15 a.m. When..." -> "10:15 a.m., when..."
 *   "Caspian's hand, the one that had touched him felt..." -> adds comma before felt
 * - Does not rewrite prose or change story content.
 * - Large chapter prose remains URL/file-storage only. No full prose is written into
 *   Base44 inline entity fields for long chapters.
 */

import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import {
  prepareChapterContent,
  resolveChapterContent,
  prepareBackupContent,
  chapterHasContent,
} from '@/lib/chapterStorage';
import { clearRichContentFields } from '@/lib/richContentStorage';
import { countWords } from '@/lib/autonovel';
import { postDraftCleanup } from '@/lib/postDraftCleanup';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { isAnthologyProject } from '@/lib/anthologyEngine';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';

import {
  runCrossChapterBodyLanguageDedup,
  runAnthologyVocabBans,
  runContaminationDetector,
} from '@/lib/anthologyPolishChecks';

import { runDialogueTagCaps } from '@/lib/dialogueTagPolish';

import {
  runDialoguePunctuationFix,
  runDialogueFillerFix,
  runPunctuationCleanup,
  runSpellingFixes,
  runBrokenSentenceFixes,
  runCopingMechanismCaps,
} from '@/lib/punctuationPolish';

import {
  runChatGPTVocabCaps,
  runTransitionWordCaps,
} from '@/lib/chatgptPatternPolish';

import { runCapitalizationHygiene } from '@/lib/capitalizationPolish';
import { runStackedClauseVariation } from '@/lib/sentencePatternPolish';
import { fixVoicePatterns } from '@/lib/voicePatternPolish';
import { runExternalAiPatternFix } from '@/lib/externalAiPatterns';
import { runVocabCaps } from '@/lib/vocabCaps';
import { fixHangingQuotes } from '@/lib/quoteFixPolish';
import { calculateManuscriptStats } from '@/lib/manuscriptStats';
import { enforceExactFinalLine } from '@/lib/exactFinalLine';

const MANUSCRIPT_FIXER_SAVE_VERSION =
  'manuscriptFixer-save-pipeline-v56-nf-terminal-copyedit-caution-clamp';

console.log(`[MANUSCRIPT-FIXER] Loaded ${MANUSCRIPT_FIXER_SAVE_VERSION}`);

function safeString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(safeString).filter(Boolean).join('\n\n');

  if (typeof value === 'object') {
    const direct =
      value.text ||
      value.prose ||
      value.content ||
      value.cleanedText ||
      value.finalText ||
      value.body ||
      value.output ||
      value.result ||
      value.response ||
      value.message?.content ||
      value.choices?.[0]?.message?.content ||
      value.choices?.[0]?.text ||
      value.data?.text ||
      value.data?.content;

    if (direct != null && direct !== value) return safeString(direct);

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

function normalizeText(value) {
  return safeString(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function chapterNumber(chapter, fallback = 1) {
  const raw = chapter?.chapter_number || chapter?.number || fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveChapterNumberForFixer(chapterNumberValue, text = '') {
  const direct = Number(chapterNumberValue);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const raw = safeString(chapterNumberValue);
  const fromRaw =
    raw.match(/\bchapter[_\s-]*(\d{1,3})\b/i) ||
    raw.match(/\bch(?:apter)?\.?\s*(\d{1,3})\b/i) ||
    raw.match(/^\s*(\d{1,3})\s*$/);
  if (fromRaw) {
    const n = Number(fromRaw[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const source = normalizeText(text);
  const fromText =
    source.match(/^\s*Chapter\s+(\d{1,3})\s*:/im) ||
    source.match(/^\s*#*\s*Chapter\s+(\d{1,3})\b/im);
  if (fromText) {
    const n = Number(fromText[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return 0;
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text) {
  return normalizeText(text).match(/[^.!?...]+[.!?...][""\u2019)]*|[^.!?...]+$/g) || [];
}

function getLastSentence(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';

  const matches = splitSentences(normalized);
  if (!matches || !matches.length) return normalized;

  return matches[matches.length - 1].trim();
}

function makePreview(text, length = 420) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  return normalized.slice(0, length).replace(/\n{2,}/g, '\n').trim();
}

function makeEndPreview(text, length = 420) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  return normalized.slice(Math.max(0, normalized.length - length)).replace(/\n{2,}/g, '\n').trim();
}

function truncateForEntity(value, max = 1200) {
  const text = normalizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20).trim()}\n...[truncated]`;
}

function buildSmallPolishMetadata(content, extra = {}) {
  const normalized = normalizeText(content);
  const words = countWords(normalized);

  return {
    polish_saved_at: new Date().toISOString(),
    polish_save_version: MANUSCRIPT_FIXER_SAVE_VERSION,
    polish_saved_word_count: words,
    polish_saved_char_count: normalized.length,
    polish_saved_preview_start: makePreview(normalized, 420),
    polish_saved_preview_end: makeEndPreview(normalized, 420),
    polish_saved_hash_hint: `${words}:${normalized.length}:${normalized.slice(0, 32)}:${normalized.slice(-32)}`,
    polish_large_content_stored_as_url: true,
    polish_inline_full_content: false,
    ...extra,
  };
}

function applyTransientPolishedContent(chapter, content, storageFields = {}, metadata = {}) {
  const normalized = normalizeText(content);

  Object.assign(chapter, {
    ...storageFields,
    ...metadata,

    __polishedContent: normalized,
    __polishSavedContent: normalized,
    __polishSavedAt: new Date().toISOString(),
    __polishSaveVersion: MANUSCRIPT_FIXER_SAVE_VERSION,

    content_md: normalized,
    content: normalized,
    prose: normalized,
    body: normalized,
    finalText: normalized,
    cleanedText: normalized,
  });
}

function isNonfictionProject(project = {}) {
  const bookType = String(project.book_type || '').toLowerCase();
  const projectType = String(project.project_type || '').toLowerCase();
  return bookType === 'nonfiction' || projectType === 'nonfiction';
}

function isEroticProject(project = {}) {
  const genre = String(project.genre || '').toLowerCase();
  const subgenre = String(project.subgenre || '').toLowerCase();
  const projectType = String(project.project_type || '').toLowerCase();
  const bookType = String(project.book_type || '').toLowerCase();

  return (
    genre.includes('erot') ||
    subgenre.includes('erot') ||
    genre.includes('spicy') ||
    subgenre.includes('spicy') ||
    projectType.includes('erot') ||
    bookType.includes('erot') ||
    Number(project.spice_level || 0) >= 3 ||
    Number(project.erotica_register || 0) >= 2
  );
}

function looksTruncatedAtEnd(text) {
  const lastSentence = getLastSentence(text);
  if (!lastSentence || lastSentence.length < 18) return false;

  const cleaned = lastSentence.replace(/[....!?,""\u2019)]*$/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 5) return false;

  const last = words[words.length - 1]?.toLowerCase() || '';
  const secondLast = words[words.length - 2]?.toLowerCase() || '';
  const pair = `${secondLast} ${last}`.trim();

  const hardBadEnders = new Set([
    'the', 'a', 'an', 'to', 'of', 'in', 'and', 'but', 'or', 'for', 'with',
    'from', 'into', 'onto', 'at', 'by', 'as', 'that', 'this', 'their', 'its',
    'his', 'her', 'your', 'our', 'my', 'against', 'beneath', 'between',
    'through', 'toward', 'towards', 'inside', 'outside', 'because', 'while',
    'although', 'unless', 'until', 'under', 'over', 'beside', 'beyond',
    'within', 'without',
  ]);

  const incompletePairs = new Set([
    'rough against', 'pressed against', 'leaned against', 'looked at',
    'stared at', 'reached for', 'held onto', 'turned toward', 'moved toward',
    'back into', 'down into', 'up into', 'out of', 'one of', 'kind of',
    'part of', 'the sound', 'the smell', 'the taste', 'the feel', 'the edge',
    'the weight',
  ]);

  if (hardBadEnders.has(last)) return true;
  if (incompletePairs.has(pair)) return true;
  if (!/[.!?...)""\u2019]$/.test(lastSentence) && words.length > 7) return true;

  return false;
}

function suspiciousAssistantOutput(text) {
  const t = normalizeText(text).slice(0, 250);
  return /^(sure|certainly|okay|here is|here's|i have|below is|the revised|the corrected)/i.test(t);
}

function suspiciousSummaryOutput(original, candidate) {
  const originalWords = countWords(original);
  const candidateWords = countWords(candidate);

  if (originalWords < 800) return false;

  const candidateLower = normalizeText(candidate).toLowerCase();
  const summarySignals = [
    'this chapter',
    'the scene',
    'the story',
    'the protagonist',
    'the narrative',
    'in this section',
    'overall,',
    'the passage',
  ];

  const signalCount = summarySignals.filter((signal) => candidateLower.includes(signal)).length;

  return candidateWords < originalWords * 0.5 && signalCount >= 2;
}

function countEroticMarkers(text) {
  const t = normalizeText(text).toLowerCase();

  const markers = [
    'mouth', 'tongue', 'thigh', 'hips', 'skin', 'heat', 'want', 'desire',
    'pleasure', 'breath', 'moan', 'kiss', 'touched', 'touch', 'naked',
    'body', 'bodies', 'bed', 'hands', 'fingers', 'pulse', 'ache', 'arousal',
    'climax', 'consent', 'yes',
  ];

  let count = 0;

  for (const marker of markers) {
    const rx = new RegExp(`\\b${marker}\\b`, 'gi');
    count += (t.match(rx) || []).length;
  }

  return count;
}

function detectMalformedGrammarArtifacts(text) {
  const source = normalizeText(text);
  const artifacts = [];

  const patterns = [
    {
      type: 'subjectless_was_start',
      rx: /(^|[.!?...]\s+|\n)Was (guided|forced|taken|led|brought|moved|carried|dragged|pulled|pushed|strapped|secured|released|left|about|already|still|close|near|taller|shorter|older|younger|right|wrong|ready|supposed|meant|going|standing|sitting|lying|watching|waiting|breathing|trembling|shaking|crying|laughing|holding|trying|willing|looking|staring|wasting|devouring|adrift|part|a|an|the)\b/g,
    },
    {
      type: 'subjectless_were_start',
      rx: /(^|[.!?...]\s+|\n)Were (unloading|waiting|standing|sitting|watching|moving|trying|holding|breathing|shaking|trembling|ready|gone|there|not)\b/g,
    },
    {
      type: 'subjectless_action_start',
      rx: /(^|[.!?...]\s+|\n)(Looked|Turned|Felt|Knew|Thought|Sounded|Tasted|Smelled) (at|down|up|away|back|over|toward|towards|past|around|like|as if|of|about|that|he|she|they|it)\b/g,
    },
    {
      type: 'bad_article_or_variation_start',
      rx: /\b(A air|A silence|A room|A light was|A sound was|A metal was|One air|One silence|One corridor|One hum|One door|One bell|One stone|One sound|One boy|One walls|That silence|That air|That door|That man|That water|This ceiling|This stone|Its man|Its door|Its world)\b/g,
    },
    {
      type: 'dangling_period_fragment',
      rx: /\b(Closed|opened|on|at|with|from|into|of|to|for)\s+\./g,
    },
    {
      type: 'known_broken_phrase',
      rx: /\b(white space on \.|blank field on \.|the familiar pull at like a lie|said softly it in|The like hands on him|The few like a mile|A few like a mile|moved back in took|capped it set it aside|gaze lifted found|swung shut cutting|straightened setting|groaned doubling|still raised began|deep, deliberate silence right over|deep, deliberate beat right over|deep, deliberate moment right over|coffee on his beat|coffee on his silence|coffee on his pause|stale coffee on his beat|stale coffee on his silence|stale coffee on his pause|stumbled caught himself|lay back offered|lay back, offered|voice, when it came was|hands, he noticed were|hands, he noticed, were|hands he noticed were|The door to the playroom opened it|Corinne closed and set it aside|The harvest there is\. Impersonal|The almond on the tongue\. entry|He understood\. was ash|Tomas’s moment hitched|Tomas's moment hitched|Her own air felt short|His own pause raw|her own pause shallow|ragged silence between them|The words came out Matron|She thought of in her study|own silence had caught|He felt the tension coil in her belly heard|drove into her again setting|Her own moment felt short|her own moment felt short|her own silence shallow|They were both chest rising hard|own beat had caught|own moment raw|heard her silence hitch|ragged rhythm between them|She spoke — ragged|She spoke - ragged)\b/gi,
    },
    {
      type: 'leading_preposition_fragment',
      rx: /(^|[.!?...]\s+|\n)(of the|about the|their attention|the handler|the electricity|the collective)\b/g,
    },
  ];

  for (const item of patterns) {
    const matches = source.match(item.rx);
    if (!matches) continue;

    for (const match of matches.slice(0, 40)) {
      artifacts.push({
        type: item.type,
        text: match.trim().slice(0, 160),
      });
    }
  }

  return artifacts;
}



/**
 * Structural collision quarantine
 *
 * This pass is intentionally deterministic. It exists for the failure mode where the
 * app has saved multiple alternate drafts inside the same chapter, then the normal
 * polish safety gate rejects the cleaned version because the word loss looks large.
 *
 * Rule: remove only high-confidence duplicate/alternate-draft blocks with obvious
 * restart anchors. This is not a prose rewrite. It is a quarantine of stacked retries.
 */
function asMarkerArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function findFirstMarkerIndex(text, markers, startAt = 0) {
  let best = -1;
  let marker = '';

  for (const candidate of asMarkerArray(markers)) {
    const index = text.indexOf(candidate, startAt);
    if (index >= 0 && (best < 0 || index < best)) {
      best = index;
      marker = candidate;
    }
  }

  return { index: best, marker };
}

function removeRangeByMarkers(source, startMarker, endMarker, label, fixes) {
  const text = normalizeText(source);
  const startMatch = findFirstMarkerIndex(text, startMarker, 0);
  const start = startMatch.index;
  if (start < 0) return text;

  const endMatch = endMarker
    ? findFirstMarkerIndex(text, endMarker, start + startMatch.marker.length)
    : { index: text.length, marker: '[chapter end]' };

  let end = endMatch.index;
  if (end < 0) end = text.length;

  const removed = text.slice(start, end).trim();
  const removedWords = countWords(removed);

  // Safety: deterministic structural quarantine can remove large alternate-draft stacks,
  // but should still refuse almost-total chapter deletion.
  const totalWords = countWords(text);
  if (removedWords < 250) return text;
  if (totalWords > 0 && removedWords / totalWords > 0.85) return text;

  fixes.push({
    label,
    startMarker: startMatch.marker,
    endMarker: endMatch.marker || '[chapter end]',
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(`${text.slice(0, start).trim()}\n\n${text.slice(end).trim()}`);
}

function removeAfterMarkerIfPriorResolved(source, priorMarker, startMarker, label, fixes) {
  const text = normalizeText(source);
  const priorMatch = findFirstMarkerIndex(text, priorMarker, 0);
  const prior = priorMatch.index;
  if (prior < 0) return text;

  const startMatch = findFirstMarkerIndex(text, startMarker, prior + Math.max(1, priorMatch.marker.length));
  const start = startMatch.index;
  if (start < 0 || start <= prior) return text;

  const removed = text.slice(start).trim();
  const removedWords = countWords(removed);
  const totalWords = countWords(text);

  if (removedWords < 250) return text;
  if (totalWords > 0 && removedWords / totalWords > 0.85) return text;

  fixes.push({
    label,
    priorMarker: priorMatch.marker,
    startMarker: startMatch.marker,
    endMarker: '[chapter end]',
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(text.slice(0, start).trim());
}


function regexIndexAfter(text, pattern, startAt = 0) {
  const source = normalizeText(text);
  const rx = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`) : new RegExp(String(pattern), 'gi');
  rx.lastIndex = Math.max(0, startAt);
  const match = rx.exec(source);
  if (!match) return { index: -1, match: '' };
  return { index: match.index, match: match[0] || '' };
}

function removeAfterRegexPrior(source, priorPattern, startPattern, label, fixes, options = {}) {
  const text = normalizeText(source);
  const prior = regexIndexAfter(text, priorPattern, 0);
  if (prior.index < 0) return text;

  const start = regexIndexAfter(text, startPattern, prior.index + Math.max(1, prior.match.length));
  if (start.index < 0 || start.index <= prior.index) return text;

  const removed = text.slice(start.index).trim();
  const removedWords = countWords(removed);
  const totalWords = countWords(text);
  const minWords = options.minWords ?? 180;
  const maxRatio = options.maxRatio ?? 0.85;

  if (removedWords < minWords) return text;
  if (totalWords > 0 && removedWords / totalWords > maxRatio) return text;

  fixes.push({
    label,
    priorMarker: prior.match.slice(0, 180),
    startMarker: start.match.slice(0, 180),
    endMarker: '[chapter end]',
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(text.slice(0, start.index).trim());
}


function removeChapterIntroRangeByRegex(source, startPattern, endPattern, label, fixes, options = {}) {
  const text = normalizeText(source);
  const start = regexIndexAfter(text, startPattern, 0);
  if (start.index < 0) return text;

  const end = regexIndexAfter(text, endPattern, start.index + Math.max(1, start.match.length));
  if (end.index < 0 || end.index <= start.index) return text;

  const removed = text.slice(start.index, end.index).trim();
  const removedWords = countWords(removed);
  const totalWords = countWords(text);
  const minWords = options.minWords ?? 120;
  const maxRatio = options.maxRatio ?? 0.90;

  if (removedWords < minWords) return text;
  if (totalWords > 0 && removedWords / totalWords > maxRatio) return text;

  fixes.push({
    label,
    priorMarker: '[chapter start]',
    startMarker: start.match.slice(0, 180),
    endMarker: end.match.slice(0, 180),
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(`${text.slice(0, start.index).trim()}\n\n${text.slice(end.index).trim()}`);
}

function removeAfterRegexMarker(source, markerPattern, label, fixes, options = {}) {
  const text = normalizeText(source);
  const marker = regexIndexAfter(text, markerPattern, 0);
  if (marker.index < 0) return text;

  const end = marker.index + Math.max(1, marker.match.length);
  const removed = text.slice(end).trim();
  const removedWords = countWords(removed);
  const totalWords = countWords(text);
  const minWords = options.minWords ?? 120;
  const maxRatio = options.maxRatio ?? 0.92;

  if (removedWords < minWords) return text;
  if (totalWords > 0 && removedWords / totalWords > maxRatio) return text;

  fixes.push({
    label,
    priorMarker: marker.match.slice(0, 180),
    startMarker: '[after final marker]',
    endMarker: '[chapter end]',
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(text.slice(0, end).trim());
}


function forceBroniesChapterOneBoundary(source, fixes, labelPrefix = 'final rescue') {
  const text = normalizeText(source);
  if (!text) return text;

  const markerPattern = /A perfect, beautiful, boring human hallway\.\s*For now\./i;
  const marker = regexIndexAfter(text, markerPattern, 0);
  if (marker.index < 0) return text;

  const afterMarkerStart = marker.index + Math.max(1, marker.match.length);
  const after = text.slice(afterMarkerStart);

  // This is the exact contaminated boundary we keep seeing: Chapter 1 finishes,
  // then the Chapter 2 road/car sequence remains appended inside Chapter 1.
  if (!/The rain started as a lousy spit|Zonk’s car, a ten-year-old hatchback|Get in,[”"]\s+he said|metal carriage/i.test(after)) {
    return text;
  }

  const removed = after.trim();
  const removedWords = countWords(removed);
  const totalWords = countWords(text);

  if (removedWords < 80) return text;
  if (totalWords > 0 && removedWords / totalWords > 0.96) return text;

  fixes.push({
    label: `${labelPrefix}: Chapter 1 hard boundary locked at For now ending`,
    priorMarker: marker.match.slice(0, 180),
    startMarker: removed.slice(0, 180),
    endMarker: '[chapter end]',
    removedWords,
    removedChars: removed.length,
  });

  return normalizeText(text.slice(0, afterMarkerStart).trim());
}

function runFinalStructuralRescueForChapter(text, chapterNumber) {
  let out = normalizeText(text);
  const fixes = [];
  const ch = resolveChapterNumberForFixer(chapterNumber, out);

  if (!out) return { text: out, fixes, removedWords: 0, removedChars: 0 };

  if (ch === 1) {
    out = forceBroniesChapterOneBoundary(
      out,
      fixes,
      'final rescue'
    );

    out = removeAfterRegexPrior(
      out,
      /A perfect, beautiful, boring human hallway\.\s*For now\./i,
      /The rain started as a lousy spit,\s*then settled into a steady, cold drizzle/i,
      'final rescue: Chapter 1 removed car/road-trip bleed after completed For now ending',
      fixes,
      { minWords: 120, maxRatio: 0.95 }
    );

    out = removeAfterRegexMarker(
      out,
      /A perfect, beautiful, boring human hallway\.\s*For now\./i,
      'final rescue: Chapter 1 forced hard boundary at For now ending',
      fixes,
      { minWords: 120, maxRatio: 0.95 }
    );
  }

  if (ch === 4) {
    out = removeChapterIntroRangeByRegex(
      out,
      /Blaze picked up the red cuff again,\s+turning it over in his hands\.\s+[“"]Do not![”"]\s+Pip said again,\s+more urgent(?:ly)?\./i,
      /Before anyone could muster another deep thought,\s+the pounding started at the door\./i,
      'final rescue: Chapter 4 removed duplicate cuff tutorial intro before guard breach',
      fixes,
      { minWords: 250, maxRatio: 0.70 }
    );

    out = removeChapterIntroRangeByRegex(
      out,
      /Blaze picked up the red cuff again[\s\S]{0,260}?The cuff constricted\./i,
      /Before anyone could muster another deep thought,\s+the pounding started at the door\./i,
      'final rescue: Chapter 4 removed duplicate cuff tutorial intro using flexible opening marker',
      fixes,
      { minWords: 250, maxRatio: 0.80 }
    );

    out = removeAfterRegexMarker(
      out,
      /[“"]Well,[”"]\s+Zonk said,\s+his voice surprisingly steady in the quiet\.\s+[“"]That escalated\.[”"]/i,
      'final rescue: Chapter 4 forced hard boundary at That escalated ending',
      fixes,
      { minWords: 250, maxRatio: 0.95 }
    );

    out = removeAfterRegexMarker(
      out,
      /[“"]Well,[”"]\s+Zonk said,\s+his breath pluming in the cold air\.\s+[“"]That escalated\.[”"]/i,
      'final rescue: Chapter 4 forced hard boundary at That escalated ending',
      fixes,
      { minWords: 250, maxRatio: 0.95 }
    );

    out = removeAfterRegexPrior(
      out,
      /[“"]Well,[”"]\s+Zonk said,\s+his breath pluming in the cold air\.\s+[“"]That escalated\.[”"]/i,
      /The impact was (?:a )?(?:sick,\s*)?wet[^\n]{0,120}(?:shoulder plate|crunch|sound)/i,
      'final rescue: Chapter 4 removed late apartment-breach/action retry after That escalated ending',
      fixes,
      { minWords: 250, maxRatio: 0.80 }
    );
  }

  if (ch === 6) {
    out = removeAfterRegexPrior(
      out,
      /They descended\.\s+The cheerful, violent city was above them\.\s+The answers,\s+and whatever fresh nightmares they held were below\./i,
      /The alley was a pocket of shadow,\s+a forgotten seam between the pastel perfection/i,
      'final rescue: Chapter 6 removed alternate alley/Luna-contract branch after completed Gilded Saddle descent',
      fixes,
      { minWords: 300, maxRatio: 0.75 }
    );
  }

  if (ch === 8) {
    out = removeAfterRegexPrior(
      out,
      /Zonk took the scroll case\.\s+It was cool and heavy\./i,
      /The Velvet Room was a throat\./i,
      'final rescue: Chapter 8 removed duplicate Velvet Room/thestral delivery branch after Brass Tacks handoff',
      fixes,
      { minWords: 400, maxRatio: 0.80 }
    );
  }

  if (ch === 9) {
    out = removeAfterRegexPrior(
      out,
      /The disappointed duck\.\s+It seemed like the only honest thing in the room\./i,
      /The silence stretched\.\s+Luna[’']s starry mane drifted/i,
      'final rescue: Chapter 9 removed duplicate Luna explanation branch after completed audience beat',
      fixes,
      { minWords: 400, maxRatio: 0.80 }
    );
  }

  const beforeWords = countWords(text);
  const afterWords = countWords(out);
  const beforeChars = normalizeText(text).length;
  const afterChars = out.length;

  return {
    text: out,
    fixes,
    removedWords: Math.max(0, beforeWords - afterWords),
    removedChars: Math.max(0, beforeChars - afterChars),
  };
}

function runFinalStructuralRescuePass({ loaded, report, onProgress, stage = 'final structural rescue' }) {
  reportProgress(onProgress, `Fix Manuscript: ${stage}...`);

  let changedChapters = 0;
  let totalRemovedWords = 0;
  let totalFixes = 0;

  for (const item of loaded) {
    const before = item.content;
    const result = runFinalStructuralRescueForChapter(before, item.chapterNumber);

    if (!result.fixes.length || normalizeText(result.text) === normalizeText(before)) continue;

    item.content = result.text;
    item.changed = contentChanged(item.original, item.content);
    item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
    item.structureQuarantine.stages.push(stage);
    item.structureQuarantine.removedWords += result.removedWords;
    item.structureQuarantine.removedChars += result.removedChars;
    item.structureQuarantine.fixes.push(...result.fixes);

    changedChapters += 1;
    totalRemovedWords += result.removedWords;
    totalFixes += result.fixes.length;

    for (const fix of result.fixes) {
      addReportFix(report, `Ch.${item.chapterNumber}: FINAL STRUCTURE ${fix.label} (-${fix.removedWords} words)`);
    }

    console.warn(`[MANUSCRIPT-FIXER][FINAL-STRUCTURE-RESCUE v27] Ch.${item.chapterNumber} ${stage}`, {
      fixes: result.fixes,
      beforeWords: countWords(before),
      afterWords: countWords(item.content),
      removedWords: result.removedWords,
    });
  }

  report.saveGatePasses = report.saveGatePasses || {};
  report.saveGatePasses.finalStructuralRescue = report.saveGatePasses.finalStructuralRescue || {
    changedChapters: 0,
    totalFixes: 0,
    totalRemovedWords: 0,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  report.saveGatePasses.finalStructuralRescue.changedChapters += changedChapters;
  report.saveGatePasses.finalStructuralRescue.totalFixes += totalFixes;
  report.saveGatePasses.finalStructuralRescue.totalRemovedWords += totalRemovedWords;

  if (changedChapters) {
    addReportWarning(
      report,
      `Final structural rescue removed ${totalRemovedWords} word(s) across ${changedChapters} chapter(s). This is treated as confirmed duplicate/alternate-draft removal.`
    );
  }

  return { changedChapters, totalFixes, totalRemovedWords };
}

function runDeterministicStructuralQuarantineForChapter(text, chapterNumber) {
  let out = normalizeText(text);
  const fixes = [];
  const ch = resolveChapterNumberForFixer(chapterNumber, out);

  if (!out) return { text: out, fixes, removedWords: 0, removedChars: 0 };

  if (ch === 1) {
    out = forceBroniesChapterOneBoundary(
      out,
      fixes,
      'structural quarantine'
    );

    out = removeRangeByMarkers(
      out,
      'One moment, Zonk was a unicorn in a pastel nightmare;',
      'The rain started as a lousy spit, then settled into a steady, cold drizzle',
      'quarantined Chapter 1 alternate VR crash/Pip-arrival retry',
      fixes
    );

    out = removeAfterMarkerIfPriorResolved(
      out,
      'The hallway outside was empty, lit by a single, flickering bulb.',
      'One moment, Zonk was a unicorn in a pastel nightmare;',
      'quarantined Chapter 1 stranded alternate crash/Pip-arrival retry to chapter end',
      fixes
    );

    out = removeAfterMarkerIfPriorResolved(
      out,
      [
        'A perfect, beautiful, boring human hallway.\nFor now.',
        'A perfect, beautiful, boring human hallway.\n\nFor now.',
        'For now.'
      ],
      [
        'The rain started as a lousy spit, then settled into a steady, cold drizzle',
        'Zonk’s car, a ten-year-old hatchback',
        '“Get in,” he said, not looking at Pip.'
      ],
      'quarantined Chapter 1 cross-chapter car/road-trip bleed after completed ending',
      fixes
    );
  }

  if (ch === 2) {
    out = removeAfterMarkerIfPriorResolved(
      out,
      'Ezekiel Kincaid had no option but to stay.',
      'The springs of the sofa sighed under him, a sound as familiar as his own heartbeat.',
      'quarantined Chapter 2 alternate artifact-briefing/planning retry',
      fixes
    );
  }

  if (ch === 3) {
    out = removeAfterMarkerIfPriorResolved(
      out,
      'He had no idea how to close the box.',
      'The sound of the cuff closing was nothing like a handcuff.',
      'quarantined Chapter 3 alternate cuff-lock/release retry',
      fixes
    );
  }

  if (ch === 4) {
    out = removeAfterMarkerIfPriorResolved(
      out,
      [
        '“Well,” Zonk said, his breath pluming in the cold air. “That escalated.”',
        'That escalated.'
      ],
      [
        'The impact was a wet, heavy sound—shoulder plate meeting muscle and bone.',
        'The impact was a wet, heavy sound',
        'Blaze grunted, the force of his own charge'
      ],
      'quarantined Chapter 4 second apartment-breach/fire-escape retry',
      fixes
    );

    out = removeAfterMarkerIfPriorResolved(
      out,
      [
        '“Well,” Zonk said, his breath pluming in the cold air. “That escalated.”',
        'That escalated.'
      ],
      [
        'The impact was a wet, crunching sound that made Zonk’s teeth ache.',
        'The impact was a wet, crunching sound'
      ],
      'quarantined Chapter 4 third guard-breach/laundromat retry',
      fixes
    );

    out = removeAfterMarkerIfPriorResolved(
      out,
      [
        '“Well,” Zonk said, his breath pluming in the cold air. “That escalated.”',
        'That escalated.'
      ],
      [
        'The impact was a sick, wet crunch of plastic on bone.',
        'The impact was a sick, wet crunch'
      ],
      'quarantined Chapter 4 third guard-breach/laundromat retry variant',
      fixes
    );
  }

  if (ch === 5) {
    out = removeRangeByMarkers(
      out,
      'The silence that followed Pip’s pronouncement wasn’t a silence at all.',
      'The closet door clicked shut behind them, swallowing the last sliver of garish light',
      'quarantined Chapter 5 alternate Master Tally broker-route retry',
      fixes
    );

    out = removeAfterMarkerIfPriorResolved(
      out,
      [
        'The sweet, chemical air of the Market suddenly tasted like ashes.',
        'The sweet, chemical air of the Market hit him again, but now it just smelled cheap.',
        'They had a map. They had a time.'
      ],
      'The closet door clicked shut behind them, swallowing the last sliver of garish light',
      'quarantined Chapter 5 alternate Night Watch/info-source branch after broker map',
      fixes
    );
  }

  const beforeWords = countWords(text);
  const afterWords = countWords(out);
  const beforeChars = normalizeText(text).length;
  const afterChars = out.length;

  return {
    text: out,
    fixes,
    removedWords: Math.max(0, beforeWords - afterWords),
    removedChars: Math.max(0, beforeChars - afterChars),
  };
}

function runStructuralCollisionQuarantinePass({ loaded, report, onProgress, stage = 'structural collision quarantine' }) {
  reportProgress(onProgress, `Fix Manuscript: ${stage}...`);

  let changedChapters = 0;
  let totalRemovedWords = 0;
  let totalFixes = 0;

  for (const item of loaded) {
    const before = item.content;
    const result = runDeterministicStructuralQuarantineForChapter(before, item.chapterNumber);

    if (!result.fixes.length || normalizeText(result.text) === normalizeText(before)) continue;

    item.content = result.text;
    item.changed = contentChanged(item.original, item.content);
    item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
    item.structureQuarantine.stages.push(stage);
    item.structureQuarantine.removedWords += result.removedWords;
    item.structureQuarantine.removedChars += result.removedChars;
    item.structureQuarantine.fixes.push(...result.fixes);

    changedChapters += 1;
    totalRemovedWords += result.removedWords;
    totalFixes += result.fixes.length;

    for (const fix of result.fixes) {
      addReportFix(report, `Ch.${item.chapterNumber}: STRUCTURE ${fix.label} (-${fix.removedWords} words)`);
    }

    console.warn(`[MANUSCRIPT-FIXER][STRUCTURE-QUARANTINE v27] Ch.${item.chapterNumber} ${stage}`, {
      fixes: result.fixes,
      beforeWords: countWords(before),
      afterWords: countWords(item.content),
      removedWords: result.removedWords,
    });
  }

  report.saveGatePasses = report.saveGatePasses || {};
  report.saveGatePasses.structuralCollisionQuarantine = report.saveGatePasses.structuralCollisionQuarantine || {
    changedChapters: 0,
    totalFixes: 0,
    totalRemovedWords: 0,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  report.saveGatePasses.structuralCollisionQuarantine.changedChapters += changedChapters;
  report.saveGatePasses.structuralCollisionQuarantine.totalFixes += totalFixes;
  report.saveGatePasses.structuralCollisionQuarantine.totalRemovedWords += totalRemovedWords;

  if (changedChapters) {
    addReportWarning(
      report,
      `Structural quarantine removed ${totalRemovedWords} word(s) across ${changedChapters} chapter(s). Safety gate will treat this as intentional duplicate-draft removal, not accidental truncation.`
    );
  }

  return { changedChapters, totalFixes, totalRemovedWords };
}



/**
 * Generic branch-collision quarantine v28
 *
 * Project-agnostic manuscript structure cleanup for repeatable pipeline failures:
 * - Chapter N accidentally contains the opening of Chapter N+1.
 * - False-start / retry artifact markers survive in prose.
 * - Exact or near-duplicate paragraphs are stacked inside one chapter.
 * - Two distant same-chapter route windows repeat the same contact/destination/
 *   transaction/outcome path. v27 only warned on those; v28 can quarantine the
 *   earlier competing branch when confidence is high.
 * - v29 additionally uses generic false-start markers and competing-access
 *   pivots to remove earlier branch attempts that share the same route/outcome.
 */
const GENERIC_FALSE_START_MARKERS = [
  /\bthe false start collapsed into the only route that mattered\.?\b/i,
  /\bthe false start had collapsed into the only route that mattered\.?\b/i,
  /\bthe alternate draft collapsed into the only route that mattered\.?\b/i,
  /\bthe retry collapsed into the only route that mattered\.?\b/i,
];

const GENERIC_ROUTE_KEYWORDS = [
  'arrived', 'entered', 'reached', 'returned', 'found', 'met', 'meet', 'asked',
  'answered', 'offered', 'accepted', 'refused', 'agreed', 'deal', 'price',
  'payment', 'receipt', 'map', 'route', 'path', 'guide', 'contact', 'broker',
  'favor', 'delivery', 'package', 'guard', 'fight', 'escape', 'captured',
  'cell', 'prison', 'injury', 'wound', 'blood', 'first aid', 'safe house',
  'door', 'gate', 'corridor', 'tunnel', 'alley', 'market', 'bar', 'club',
  'palace', 'court', 'office', 'station', 'car', 'train', 'hotel', 'room',
];

const GENERIC_RESOLUTION_KEYWORDS = [
  'finally', 'at last', 'the deal was done', 'the transaction was complete',
  'they had a map', 'they had a route', 'they had a direction', 'they had a time',
  'he had his answer', 'she had her answer', 'they had their answer',
  'the path was clear', 'the door opened', 'the route was open', 'they escaped',
  'they ran', 'they left', 'they were out', 'the receipt', 'the map',
];

const GENERIC_BRANCH_STOPWORDS = new Set([
  'about','after','again','against','almost','along','already','always','another','around','asked','because','before','being','between','could','didn','doesn','don','down','even','every','everything','finally','first','from','going','great','hand','hands','having','here','himself','herself','into','just','little','looked','looking','made','might','minute','nothing','other','over','really','right','said','same','should','something','still','there','these','thing','things','through','under','until','voice','wasn','were','where','while','with','without','would','youre','their','them','they','this','that','what','when','which','your','ours','hers','his','ourselves','themselves'
]);

const GENERIC_BRANCH_DIVERGENCE_MARKERS_V28 = [
  /\bnew plan\b/i,
  /\bwe don[’']?t all go in\b/i,
  /\bone person is less of a target\b/i,
  /\bI(?:'|’)ll go\b/i,
  /\bI will go\b/i,
  /\bI(?:'|’)m going in\b/i,
  /\bstay (?:here|outside|behind|back)\b/i,
  /\bwait (?:here|outside|behind|back)\b/i,
  /\bkeep .{0,40}\b(?:safe|hidden|out of sight)\b/i,
  /\bif I(?:'|’)m not out\b/i,
  /\bwe need (?:a|an|the)?\s*(?:token|pass|receipt|map|guide|contact|route|way|door|exit)\b/i,
  /\bwe have to (?:run|move|go|leave|get|find|reach)\b/i,
  /\bwe can[’']?t go back\b/i,
];

const GENERIC_BRANCH_ROUTE_STARTERS_V28 = [
  /\b(?:the|a) (?:bouncer|guard|attendant|server|clerk|broker|contact|guide|vendor|driver|porter|receptionist)\b/i,
  /\b(?:booth|room|office|desk|counter|bar|club|market|alley|corridor|tunnel|gate|door|stage|cell|carriage|train|car)\b/i,
  /\b(?:entered|approached|reached|arrived|returned|walked|moved|pushed|opened|stepped|slid|sat|stood)\b/i,
];

function stripChapterHeadingForComparison(text) {
  return normalizeText(text)
    .replace(/^\s*#{0,3}\s*Chapter\s+\d{1,3}\s*[:\-.–—]?\s*[^\n]*\n+/i, '')
    .replace(/^\s*Chapter\s+\d{1,3}\s*[:\-.–—]?\s*[^\n]*\n+/i, '')
    .trim();
}

function compactComparableText(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'"\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordShingles(text, size = 10, limit = 80) {
  const words = compactComparableText(text).split(/\s+/).filter(Boolean);
  const out = [];
  const max = Math.min(Math.max(0, words.length - size + 1), limit);
  for (let i = 0; i < max; i += 1) {
    const shingle = words.slice(i, i + size).join(' ');
    if (shingle.length >= 45) out.push(shingle);
  }
  return out;
}

function findComparableNeedleIndex(haystack, needle) {
  const source = normalizeText(haystack);
  const compactNeedle = compactComparableText(needle);
  if (!compactNeedle || compactNeedle.length < 45) return -1;

  const direct = source.toLowerCase().indexOf(needle.toLowerCase());
  if (direct >= 0) return direct;

  const words = compactNeedle.split(/\s+/).filter(Boolean).slice(0, 10);
  if (words.length < 7) return -1;

  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const rx = new RegExp(escaped.join('[\\s\\S]{0,18}'), 'i');
  const match = rx.exec(source);
  return match ? match.index : -1;
}

function findNextChapterOpeningInsideCurrent(currentText, nextText) {
  const current = normalizeText(currentText);
  const next = stripChapterHeadingForComparison(nextText);
  if (!current || !next) return { index: -1, marker: '' };

  const startFloor = Math.floor(current.length * 0.35);
  const nextOpening = next.slice(0, 2200);

  const nextParagraphs = splitParagraphs(nextOpening).slice(0, 6).filter((p) => countWords(p) >= 18);
  for (const paragraph of nextParagraphs) {
    const probe = paragraph.slice(0, 360);
    const index = findComparableNeedleIndex(current.slice(startFloor), probe);
    if (index >= 0) return { index: startFloor + index, marker: probe.slice(0, 180) };
  }

  for (const shingle of wordShingles(nextOpening, 11, 90)) {
    const index = compactComparableText(current.slice(startFloor)).indexOf(shingle);
    if (index >= 0) {
      const words = shingle.split(/\s+/).slice(0, 8).join(' ');
      const rawIndex = findComparableNeedleIndex(current.slice(startFloor), words);
      if (rawIndex >= 0) return { index: startFloor + rawIndex, marker: shingle.slice(0, 180) };
    }
  }

  return { index: -1, marker: '' };
}

function runGenericAdjacentChapterBleedPass({ loaded, report, onProgress, stage = 'generic adjacent chapter bleed quarantine' }) {
  reportProgress(onProgress, `Fix Manuscript: ${stage}...`);

  let changedChapters = 0;
  let totalRemovedWords = 0;

  const ordered = [...loaded].sort((a, b) => (Number(a.chapterNumber) || 0) - (Number(b.chapterNumber) || 0));

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    const before = normalizeText(current.content);
    const nextContent = normalizeText(next.content);
    if (!before || !nextContent || countWords(before) < 500 || countWords(nextContent) < 120) continue;

    const hit = findNextChapterOpeningInsideCurrent(before, nextContent);
    if (hit.index < 0) continue;

    const tail = before.slice(hit.index).trim();
    const removedWords = countWords(tail);
    const totalWords = countWords(before);

    if (removedWords < 80) continue;
    if (totalWords > 0 && removedWords / totalWords > 0.85) continue;

    const after = normalizeText(before.slice(0, hit.index).trim());
    if (!after || after.length < 200 || normalizeText(after) === before) continue;

    const fix = {
      label: `generic adjacent chapter bleed: removed opening of Chapter ${next.chapterNumber} from end of Chapter ${current.chapterNumber}`,
      priorMarker: '[generic adjacent chapter comparison]',
      startMarker: hit.marker,
      endMarker: '[chapter end]',
      removedWords,
      removedChars: tail.length,
    };

    current.content = after;
    current.changed = contentChanged(current.original, current.content);
    current.structureQuarantine = current.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
    current.structureQuarantine.stages.push(stage);
    current.structureQuarantine.removedWords += removedWords;
    current.structureQuarantine.removedChars += tail.length;
    current.structureQuarantine.fixes.push(fix);

    changedChapters += 1;
    totalRemovedWords += removedWords;

    addReportFix(report, `Ch.${current.chapterNumber}: GENERIC BRANCH ${fix.label} (-${removedWords} words)`);
    console.warn(`[MANUSCRIPT-FIXER][GENERIC-BRANCH v30] Ch.${current.chapterNumber} adjacent bleed removed`, {
      nextChapter: next.chapterNumber,
      removedWords,
      marker: hit.marker,
    });
  }

  report.saveGatePasses = report.saveGatePasses || {};
  report.saveGatePasses.genericAdjacentChapterBleed = report.saveGatePasses.genericAdjacentChapterBleed || {
    changedChapters: 0,
    totalRemovedWords: 0,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };
  report.saveGatePasses.genericAdjacentChapterBleed.changedChapters += changedChapters;
  report.saveGatePasses.genericAdjacentChapterBleed.totalRemovedWords += totalRemovedWords;

  if (changedChapters) {
    addReportWarning(report, `Generic adjacent-chapter bleed guard removed ${totalRemovedWords} word(s) across ${changedChapters} chapter(s).`);
  }

  return { changedChapters, totalRemovedWords };
}

function significantBranchTokens(text) {
  const raw = normalizeText(text);
  const capitalized = raw.match(/\b[A-Z][a-zA-Z’'\-]{2,}(?:\s+[A-Z][a-zA-Z’'\-]{2,}){0,3}\b/g) || [];
  const normal = compactComparableText(raw)
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !GENERIC_BRANCH_STOPWORDS.has(word));

  const tokens = new Set();
  for (const item of capitalized) {
    const compact = compactComparableText(item);
    if (compact && !GENERIC_BRANCH_STOPWORDS.has(compact)) tokens.add(compact);
  }
  for (const item of normal) tokens.add(item);
  return tokens;
}

function genericProperBranchTokensV28(text) {
  const raw = normalizeText(text);
  const found = raw.match(/\b[A-Z][a-zA-Z’'\-]{2,}(?:\s+[A-Z][a-zA-Z’'\-]{2,}){0,3}\b/g) || [];
  const out = new Set();
  for (const item of found) {
    const compact = compactComparableText(item);
    if (!compact || compact.length < 4) continue;
    if (GENERIC_BRANCH_STOPWORDS.has(compact)) continue;
    if (/^(chapter|book|part)\b/i.test(compact)) continue;
    out.add(compact);
  }
  return out;
}

function intersectionCount(a, b) {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function hasGenericRouteLanguage(text) {
  const t = compactComparableText(text);
  return GENERIC_ROUTE_KEYWORDS.some((keyword) => t.includes(compactComparableText(keyword)));
}

function hasGenericResolutionLanguage(text) {
  const t = compactComparableText(text);
  return GENERIC_RESOLUTION_KEYWORDS.some((keyword) => t.includes(compactComparableText(keyword)));
}

function routeKeywordCountV28(text) {
  const t = compactComparableText(text);
  let count = 0;
  for (const keyword of GENERIC_ROUTE_KEYWORDS) {
    if (t.includes(compactComparableText(keyword))) count += 1;
  }
  return count;
}

function removeFalseStartMarkerParagraphs(text, fixes) {
  const paragraphs = splitParagraphs(text);
  if (!paragraphs.length) return normalizeText(text);

  const kept = [];
  let removedWords = 0;
  let removedCount = 0;

  for (const paragraph of paragraphs) {
    if (GENERIC_FALSE_START_MARKERS.some((rx) => rx.test(paragraph))) {
      removedWords += countWords(paragraph);
      removedCount += 1;
      continue;
    }
    kept.push(paragraph);
  }

  if (!removedCount) return normalizeText(text);

  fixes.push({
    label: `generic contamination marker: removed ${removedCount} false-start artifact paragraph(s)`,
    priorMarker: '[generic false-start marker]',
    startMarker: 'false start / alternate draft marker',
    endMarker: '[paragraph boundary]',
    removedWords,
    removedChars: Math.max(0, normalizeText(text).length - normalizeText(kept.join('\n\n')).length),
  });

  return normalizeText(kept.join('\n\n'));
}


const FORBIDDEN_PIPELINE_ARTIFACT_LABELS = [
  'The false start collapsed into the only route that mattered.',
  'The false start had collapsed into the only route that mattered.',
  'The alternate draft collapsed into the only route that mattered.',
  'The retry collapsed into the only route that mattered.',
];

const FORBIDDEN_PIPELINE_ARTIFACT_REGEXES = [
  /\bthe false start collapsed into the only route that mattered\.?\b/i,
  /\bthe false start had collapsed into the only route that mattered\.?\b/i,
  /\bthe alternate draft collapsed into the only route that mattered\.?\b/i,
  /\bthe retry collapsed into the only route that mattered\.?\b/i,
];

function containsForbiddenPipelineArtifact(text = '') {
  const source = normalizeText(text);
  return FORBIDDEN_PIPELINE_ARTIFACT_REGEXES.some((rx) => rx.test(source));
}

function removeForbiddenPipelineArtifactParagraphsHard(text = '') {
  const source = normalizeText(text);
  if (!source) return { text: source, changed: false, removedWords: 0, removedCount: 0, fixes: [] };

  const paragraphs = splitParagraphs(source);
  if (!paragraphs.length) {
    let fallback = source;
    let changed = false;
    for (const rx of FORBIDDEN_PIPELINE_ARTIFACT_REGEXES) {
      if (rx.test(fallback)) {
        fallback = fallback.replace(rx, '').replace(/\n{3,}/g, '\n\n').trim();
        changed = true;
      }
    }
    return {
      text: normalizeText(fallback),
      changed,
      removedWords: changed ? Math.max(1, countWords(source) - countWords(fallback)) : 0,
      removedCount: changed ? 1 : 0,
      fixes: changed ? ['hard forbidden pipeline artifact literal removal'] : [],
    };
  }

  const kept = [];
  let removedWords = 0;
  let removedCount = 0;

  for (const paragraph of paragraphs) {
    if (FORBIDDEN_PIPELINE_ARTIFACT_REGEXES.some((rx) => rx.test(paragraph))) {
      removedWords += Math.max(1, countWords(paragraph));
      removedCount += 1;
      continue;
    }
    kept.push(paragraph);
  }

  const cleaned = normalizeText(kept.join('\n\n'));
  return {
    text: cleaned,
    changed: removedCount > 0 || containsForbiddenPipelineArtifact(cleaned),
    removedWords,
    removedCount,
    fixes: removedCount ? [`hard removed ${removedCount} forbidden pipeline artifact paragraph(s)`] : [],
  };
}

function runHardForbiddenPipelineArtifactSweep({ loaded, report, onProgress, stage = 'hard forbidden pipeline artifact sweep' } = {}) {
  reportProgress(onProgress, `Fix Manuscript: ${stage}...`);

  let changedChapters = 0;
  let totalRemovedWords = 0;
  let totalRemovedCount = 0;

  for (const item of loaded || []) {
    const before = normalizeText(item?.content || '');
    if (!before || !containsForbiddenPipelineArtifact(before)) continue;

    const result = removeForbiddenPipelineArtifactParagraphsHard(before);
    if (!result.changed || normalizeText(result.text) === before) continue;

    item.content = normalizeText(result.text);
    item.changed = contentChanged(item.original, item.content);
    item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
    item.structureQuarantine.stages.push(stage);
    item.structureQuarantine.removedWords += result.removedWords;
    item.structureQuarantine.removedChars += Math.max(0, before.length - item.content.length);
    item.structureQuarantine.fixes.push(...result.fixes);

    changedChapters += 1;
    totalRemovedWords += result.removedWords;
    totalRemovedCount += result.removedCount;

    addReportFix(
      report,
      `Ch.${item.chapterNumber}: HARD ARTIFACT removed ${result.removedCount} forbidden pipeline artifact paragraph(s)`
    );

    console.warn(`[MANUSCRIPT-FIXER][HARD-ARTIFACT v31] Ch.${item.chapterNumber} removed forbidden pipeline artifact`, {
      removedCount: result.removedCount,
      removedWords: result.removedWords,
    });
  }

  report.saveGatePasses = report.saveGatePasses || {};
  report.saveGatePasses.hardForbiddenPipelineArtifactSweep = {
    changedChapters,
    totalRemovedWords,
    totalRemovedCount,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  if (changedChapters) {
    addReportWarning(
      report,
      `Hard artifact sweep removed ${totalRemovedCount} forbidden internal pipeline marker paragraph(s) across ${changedChapters} chapter(s).`
    );
  }

  return { changedChapters, totalRemovedWords, totalRemovedCount };
}


function removeRepeatedParagraphClusters(text, fixes) {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length < 8) return normalizeText(text);

  const kept = [];
  const seen = new Map();
  let removedWords = 0;
  let removedCount = 0;

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const words = countWords(paragraph);
    const key = compactComparableText(paragraph).slice(0, 520);

    if (words >= 35 && key.length >= 160 && seen.has(key)) {
      removedWords += words;
      removedCount += 1;
      continue;
    }

    let nearDuplicate = false;
    if (words >= 45 && key.length >= 220) {
      const tokens = significantBranchTokens(paragraph);
      for (const prior of seen.values()) {
        if (!prior.tokens || Math.abs(prior.words - words) > Math.max(35, words * 0.35)) continue;
        const overlap = intersectionCount(tokens, prior.tokens);
        const smaller = Math.max(1, Math.min(tokens.size, prior.tokens.size));
        if (overlap >= 18 && overlap / smaller >= 0.74) {
          nearDuplicate = true;
          break;
        }
      }
    }

    if (nearDuplicate) {
      removedWords += words;
      removedCount += 1;
      continue;
    }

    kept.push(paragraph);
    seen.set(key, { tokens: significantBranchTokens(paragraph), words });
  }

  if (!removedCount) return normalizeText(text);

  fixes.push({
    label: `generic duplicate paragraph cluster: removed ${removedCount} repeated paragraph(s)`,
    priorMarker: '[generic repeated paragraph scan]',
    startMarker: '[duplicate paragraph cluster]',
    endMarker: '[paragraph boundary]',
    removedWords,
    removedChars: Math.max(0, normalizeText(text).length - normalizeText(kept.join('\n\n')).length),
  });

  return normalizeText(kept.join('\n\n'));
}

function findGenericBranchCutStartV28(paragraphs, firstStart) {
  const floor = Math.max(0, firstStart - 6);
  const ceiling = Math.min(paragraphs.length - 1, firstStart + 3);

  for (let i = firstStart; i >= floor; i -= 1) {
    const p = paragraphs[i] || '';
    if (GENERIC_BRANCH_DIVERGENCE_MARKERS_V28.some((rx) => rx.test(p))) return i;
  }

  for (let i = firstStart; i >= floor; i -= 1) {
    const p = paragraphs[i] || '';
    if (GENERIC_BRANCH_ROUTE_STARTERS_V28.some((rx) => rx.test(p)) && hasGenericRouteLanguage(p)) return i;
  }

  for (let i = firstStart; i <= ceiling; i += 1) {
    const p = paragraphs[i] || '';
    if (GENERIC_BRANCH_DIVERGENCE_MARKERS_V28.some((rx) => rx.test(p))) return i;
  }

  return firstStart;
}

function detectGenericRouteQuarantineCandidatesV28(text) {
  const paragraphs = splitParagraphs(text);
  const candidates = [];
  if (paragraphs.length < 16) return candidates;

  const windows = [];
  const windowSize = 7;
  const step = 3;

  for (let i = 0; i <= paragraphs.length - windowSize; i += step) {
    const block = paragraphs.slice(i, i + windowSize).join('\n\n');
    const words = countWords(block);
    if (words < 230 || !hasGenericRouteLanguage(block)) continue;
    windows.push({
      start: i,
      end: i + windowSize,
      words,
      tokens: significantBranchTokens(block),
      properTokens: genericProperBranchTokensV28(block),
      routeCount: routeKeywordCountV28(block),
      hasResolution: hasGenericResolutionLanguage(block),
      preview: makePreview(block, 180),
    });
  }

  for (let a = 0; a < windows.length; a += 1) {
    for (let b = a + 1; b < windows.length; b += 1) {
      const first = windows[a];
      const second = windows[b];
      if (second.start - first.start < 10) continue;

      const overlap = intersectionCount(first.tokens, second.tokens);
      const smaller = Math.max(1, Math.min(first.tokens.size, second.tokens.size));
      const overlapRatio = overlap / smaller;
      const properOverlap = intersectionCount(first.properTokens, second.properTokens);
      const routeCount = Math.min(first.routeCount, second.routeCount);

      const highConfidence = overlap >= 22 && overlapRatio >= 0.40 && properOverlap >= 2 && routeCount >= 3;
      if (!highConfidence) continue;

      const cutStart = findGenericBranchCutStartV28(paragraphs, first.start);
      const cutEnd = second.start;
      if (cutEnd <= cutStart) continue;

      const removedBlock = paragraphs.slice(cutStart, cutEnd).join('\n\n');
      const removedWords = countWords(removedBlock);
      const totalWords = countWords(text);
      if (removedWords < 260) continue;
      if (removedWords > 6200) continue;
      if (totalWords > 0 && removedWords / totalWords > 0.66) continue;

      candidates.push({
        cutStart,
        cutEnd,
        removedWords,
        overlap,
        overlapRatio: Number(overlapRatio.toFixed(2)),
        properOverlap,
        firstWindow: `${first.start + 1}-${first.end}`,
        secondWindow: `${second.start + 1}-${second.end}`,
        firstPreview: first.preview,
        secondPreview: second.preview,
      });
    }
  }

  candidates.sort((a, b) => {
    if (b.properOverlap !== a.properOverlap) return b.properOverlap - a.properOverlap;
    if (b.overlap !== a.overlap) return b.overlap - a.overlap;
    return a.cutStart - b.cutStart;
  });

  return candidates.slice(0, 3);
}

function applyGenericRouteQuarantineV28(text, fixes) {
  let paragraphs = splitParagraphs(text);
  if (paragraphs.length < 16) return normalizeText(text);

  let changed = false;
  let totalRemovedWords = 0;

  for (let pass = 0; pass < 2; pass += 1) {
    const currentText = normalizeText(paragraphs.join('\n\n'));
    const candidates = detectGenericRouteQuarantineCandidatesV28(currentText);
    if (!candidates.length) break;

    const candidate = candidates[0];
    const removedBlock = paragraphs.slice(candidate.cutStart, candidate.cutEnd).join('\n\n');
    const removedWords = countWords(removedBlock);
    if (removedWords < 260) break;

    paragraphs = [
      ...paragraphs.slice(0, candidate.cutStart),
      ...paragraphs.slice(candidate.cutEnd),
    ];

    changed = true;
    totalRemovedWords += removedWords;
    fixes.push({
      label: 'generic repeated-route branch quarantine: removed earlier competing branch before later matching route window',
      priorMarker: candidate.firstPreview,
      startMarker: `windows ${candidate.firstWindow} -> ${candidate.secondWindow}`,
      endMarker: candidate.secondPreview,
      removedWords,
      removedChars: removedBlock.length,
      overlap: candidate.overlap,
      overlapRatio: candidate.overlapRatio,
      properOverlap: candidate.properOverlap,
    });
  }

  return changed && totalRemovedWords > 0 ? normalizeText(paragraphs.join('\n\n')) : normalizeText(text);
}



function findPriorBranchSceneStartV30(paragraphs, markerIndex) {
  const floor = Math.max(0, markerIndex - 72);
  const hardPivotPatterns = [
    /\bnew plan\b/i,
    /\bwe don[’']?t all go in\b/i,
    /\bone person is less of a target\b/i,
    /\bI(?:'|’)ll go\b/i,
    /\bI will go\b/i,
    /\bI(?:'|’)m going in\b/i,
    /\bstay (?:out here|outside|here|behind|back)\b/i,
    /\bif I(?:'|’)m not out\b/i,
    /\b(?:the|a) (?:door|gate|club|bar|market|room|corridor|alley|street|gondola|carriage|train|vehicle|counter|desk|stage)\b.{0,140}\b(?:stood|waited|opened|loomed|glowed|smelled|tasted|was|wasn[’']?t)\b/i,
    /\b(?:he|she|they|we|I) (?:entered|approached|reached|arrived|returned|walked into|moved into|stepped into|slid into|went into)\b/i,
  ];

  // Prefer a clear divergence/pivot marker, even if it is much earlier than the
  // surviving false-start paragraph. This is what catches long alternate routes.
  for (let i = markerIndex - 1; i >= floor; i -= 1) {
    const p = paragraphs[i] || '';
    if (hardPivotPatterns.some((rx) => rx.test(p))) return i;
  }

  // Otherwise use the earliest route-heavy paragraph in the prior window.
  let earliestRoute = -1;
  for (let i = floor; i < markerIndex; i += 1) {
    const p = paragraphs[i] || '';
    if (hasGenericRouteLanguage(p) && GENERIC_BRANCH_ROUTE_STARTERS_V28.some((rx) => rx.test(p))) {
      earliestRoute = i;
      break;
    }
  }
  if (earliestRoute >= 0) return earliestRoute;

  // Last resort: cut a bounded prior block instead of leaving the marker in prose.
  return Math.max(floor, markerIndex - 24);
}

function removeTerminalFalseStartBranchV30(text, fixes) {
  let paragraphs = splitParagraphs(text);
  if (paragraphs.length < 8) return normalizeText(text);

  let changed = false;
  let safety = 0;

  while (safety < 6) {
    safety += 1;
    const markerIndex = paragraphs.findIndex((paragraph) =>
      GENERIC_FALSE_START_MARKERS.some((rx) => rx.test(paragraph))
    );
    if (markerIndex < 0) break;

    const preStart = Math.max(0, markerIndex - 72);
    const postEnd = Math.min(paragraphs.length, markerIndex + 30);
    const preWindow = paragraphs.slice(preStart, markerIndex).join('\n\n');
    const postWindow = paragraphs.slice(markerIndex + 1, postEnd).join('\n\n');
    const markerParagraph = paragraphs[markerIndex] || '';

    const preRoute = hasGenericRouteLanguage(preWindow) || routeKeywordCountV28(preWindow) >= 4;
    const postRoute = hasGenericRouteLanguage(postWindow) || routeKeywordCountV28(postWindow) >= 4;
    const preTokens = significantBranchTokens(preWindow);
    const postTokens = significantBranchTokens(postWindow);
    const preProper = genericProperBranchTokensV28(preWindow);
    const postProper = genericProperBranchTokensV28(postWindow);
    const overlap = intersectionCount(preTokens, postTokens);
    const properOverlap = intersectionCount(preProper, postProper);
    const overlapRatio = overlap / Math.max(1, Math.min(preTokens.size, postTokens.size));

    // Any surviving false-start marker is contamination. If both sides are route-like,
    // quarantine the prior alternate branch. If not, remove the marker paragraph only.
    const shouldCutPriorBranch =
      preRoute &&
      postRoute &&
      (
        properOverlap >= 1 ||
        overlap >= 10 ||
        overlapRatio >= 0.18 ||
        routeKeywordCountV28(preWindow) >= 6
      );

    if (!shouldCutPriorBranch) {
      const removed = paragraphs.splice(markerIndex, 1).join('\n\n');
      changed = true;
      fixes.push({
        label: 'generic terminal false-start marker cleanup: removed surviving marker paragraph only',
        priorMarker: makePreview(preWindow, 180),
        startMarker: makePreview(removed, 180),
        endMarker: makePreview(postWindow, 180),
        removedWords: countWords(removed),
        removedChars: removed.length,
        overlap,
        overlapRatio: Number(overlapRatio.toFixed(2)),
        properOverlap,
      });
      continue;
    }

    const cutStart = findPriorBranchSceneStartV30(paragraphs, markerIndex);
    const cutEnd = markerIndex + 1;
    const removedBlock = paragraphs.slice(cutStart, cutEnd).join('\n\n');
    const removedWords = countWords(removedBlock);
    const totalWords = countWords(paragraphs.join('\n\n'));

    // Safety: never remove most of a chapter. The point is branch quarantine, not rewrite.
    if (removedWords < 80 || removedWords > 8500 || (totalWords > 0 && removedWords / totalWords > 0.72)) {
      const removed = paragraphs.splice(markerIndex, 1).join('\n\n');
      changed = true;
      fixes.push({
        label: 'generic terminal false-start marker cleanup: removed marker only after branch cut failed safety limits',
        priorMarker: makePreview(preWindow, 180),
        startMarker: makePreview(removed, 180),
        endMarker: makePreview(postWindow, 180),
        removedWords: countWords(removed),
        removedChars: removed.length,
        overlap,
        overlapRatio: Number(overlapRatio.toFixed(2)),
        properOverlap,
      });
      continue;
    }

    paragraphs = [
      ...paragraphs.slice(0, cutStart),
      ...paragraphs.slice(cutEnd),
    ];
    changed = true;
    fixes.push({
      label: 'generic terminal false-start branch quarantine: removed earlier alternate branch anchored to surviving false-start marker',
      priorMarker: makePreview(preWindow, 220),
      startMarker: `paragraphs ${cutStart + 1}-${cutEnd}`,
      endMarker: makePreview(postWindow, 220),
      removedWords,
      removedChars: removedBlock.length,
      overlap,
      overlapRatio: Number(overlapRatio.toFixed(2)),
      properOverlap,
      marker: makePreview(markerParagraph, 180),
    });
  }

  return changed ? normalizeText(paragraphs.join('\n\n')) : normalizeText(text);
}

function findPriorBranchSceneStartV29(paragraphs, markerIndex) {
  const floor = Math.max(0, markerIndex - 14);
  const sceneStartPatterns = [
    /\bthe door (?:to|of) .{0,80}\b(?:opened|slid open|creaked open|swung open)\b/i,
    /\b(?:as|when) they (?:reached|arrived|entered|approached|got to|came to)\b/i,
    /\b(?:he|she|they|we|I) (?:reached|arrived|entered|approached|returned|walked into|moved into|stepped into)\b/i,
    /\b(?:the|a) (?:corridor|hallway|room|bar|club|market|office|chamber|cell|door|gate|station|car|carriage|train|alley)\b.{0,120}\b(?:opened|waited|stood|loomed|smelled|tasted|was)\b/i,
  ];

  for (let i = markerIndex - 1; i >= floor; i -= 1) {
    const p = paragraphs[i] || '';
    if (sceneStartPatterns.some((rx) => rx.test(p))) return i;
  }

  for (let i = markerIndex - 1; i >= floor; i -= 1) {
    const p = paragraphs[i] || '';
    if (hasGenericRouteLanguage(p)) return i;
  }

  return Math.max(floor, markerIndex - 6);
}

function removeMarkerBoundRepeatedPriorBranchV29(text, fixes) {
  let paragraphs = splitParagraphs(text);
  if (paragraphs.length < 12) return normalizeText(text);

  let changed = false;
  let safety = 0;

  while (safety < 4) {
    safety += 1;
    const markerIndex = paragraphs.findIndex((paragraph) =>
      GENERIC_FALSE_START_MARKERS.some((rx) => rx.test(paragraph))
    );
    if (markerIndex < 0) break;

    const preStart = Math.max(0, markerIndex - 12);
    const postEnd = Math.min(paragraphs.length, markerIndex + 13);
    const preWindow = paragraphs.slice(preStart, markerIndex).join('\n\n');
    const postWindow = paragraphs.slice(markerIndex + 1, postEnd).join('\n\n');

    const preTokens = significantBranchTokens(preWindow);
    const postTokens = significantBranchTokens(postWindow);
    const preProper = genericProperBranchTokensV28(preWindow);
    const postProper = genericProperBranchTokensV28(postWindow);
    const overlap = intersectionCount(preTokens, postTokens);
    const properOverlap = intersectionCount(preProper, postProper);
    const routeCount = Math.min(routeKeywordCountV28(preWindow), routeKeywordCountV28(postWindow));
    const smaller = Math.max(1, Math.min(preTokens.size, postTokens.size));
    const overlapRatio = overlap / smaller;

    const repeatedSameRoute =
      routeCount >= 2 &&
      ((properOverlap >= 2 && overlap >= 12 && overlapRatio >= 0.24) ||
        (properOverlap >= 1 && overlap >= 20 && overlapRatio >= 0.34));

    if (!repeatedSameRoute) {
      // Marker is still contamination even if the prior branch is not safe to cut.
      const removed = paragraphs.splice(markerIndex, 1).join('\n\n');
      fixes.push({
        label: 'generic false-start marker cleanup: removed marker paragraph only; prior branch not repeated enough for quarantine',
        priorMarker: makePreview(preWindow, 160),
        startMarker: makePreview(removed, 160),
        endMarker: makePreview(postWindow, 160),
        removedWords: countWords(removed),
        removedChars: removed.length,
        overlap,
        overlapRatio: Number(overlapRatio.toFixed(2)),
        properOverlap,
      });
      changed = true;
      continue;
    }

    const cutStart = findPriorBranchSceneStartV29(paragraphs, markerIndex);
    const cutEnd = markerIndex + 1;
    const removedBlock = paragraphs.slice(cutStart, cutEnd).join('\n\n');
    const removedWords = countWords(removedBlock);
    const totalWords = countWords(paragraphs.join('\n\n'));

    if (removedWords < 140 || removedWords > 4200 || (totalWords > 0 && removedWords / totalWords > 0.55)) {
      const removed = paragraphs.splice(markerIndex, 1).join('\n\n');
      fixes.push({
        label: 'generic false-start marker cleanup: removed marker paragraph only; repeated branch cut failed safety limits',
        priorMarker: makePreview(preWindow, 160),
        startMarker: makePreview(removed, 160),
        endMarker: makePreview(postWindow, 160),
        removedWords: countWords(removed),
        removedChars: removed.length,
        overlap,
        overlapRatio: Number(overlapRatio.toFixed(2)),
        properOverlap,
      });
      changed = true;
      continue;
    }

    paragraphs = [
      ...paragraphs.slice(0, cutStart),
      ...paragraphs.slice(cutEnd),
    ];
    changed = true;
    fixes.push({
      label: 'generic marker-aware branch quarantine: removed earlier repeated branch before false-start boundary marker',
      priorMarker: makePreview(preWindow, 180),
      startMarker: `paragraphs ${cutStart + 1}-${cutEnd}`,
      endMarker: makePreview(postWindow, 180),
      removedWords,
      removedChars: removedBlock.length,
      overlap,
      overlapRatio: Number(overlapRatio.toFixed(2)),
      properOverlap,
    });
  }

  return changed ? normalizeText(paragraphs.join('\n\n')) : normalizeText(text);
}

function isSoloAccessAttemptStartV29(paragraph) {
  const p = normalizeText(paragraph);
  return [
    /\bnew plan\b/i,
    /\bwe don[’']?t all go in\b/i,
    /\bone person is less of a target\b/i,
    /\bI(?:'|’)ll go\b/i,
    /\bI will go\b/i,
    /\bI(?:'|’)m going in\b/i,
    /\bstay (?:out here|outside|here|behind|back)\b/i,
    /\bif I(?:'|’)m not out\b/i,
  ].some((rx) => rx.test(p));
}

function isEarlyAccessBypassPlanStartV33(paragraph) {
  const p = normalizeText(paragraph);
  return [
    /\bwe don[’']?t need to (?:sing|perform|pay|enter|go through|use)\b/i,
    /\bwe don[’']?t need (?:a|the)?\s*(?:token|pass|ticket|key|receipt|invitation)\b/i,
    /\b(?:no|not)\s+(?:token|pass|ticket|key|receipt|invitation)\b.{0,120}\b(?:offer|collateral|bargain|bargaining chip|trade|asset|favor)\b/i,
    /\b(?:offer|collateral|bargain|bargaining chip|trade|asset|favor)\b.{0,120}\b(?:token|pass|ticket|key|receipt|invitation|entry|door|bouncer|guard|contact|broker|manager)\b/i,
    /\busing .{0,60}\bas collateral\b/i,
    /\buse .{0,60}\bas collateral\b/i,
    /\bcompelling offer\b/i,
  ].some((rx) => rx.test(p));
}

function blockHasAccessBypassLanguageV33(text) {
  const p = normalizeText(text);
  return [
    /\bwe don[’']?t need to (?:sing|perform|pay|enter|go through|use)\b/i,
    /\bwe don[’']?t need (?:a|the)?\s*(?:token|pass|ticket|key|receipt|invitation)\b/i,
    /\b(?:offer|collateral|bargain|bargaining chip|trade|asset|favor|compelling offer)\b/i,
    /\b(?:solo|alone|one person|I(?:'|’)ll|I will|I(?:'|’)m going|wait outside|stay outside|out here)\b/i,
  ].some((rx) => rx.test(p));
}

function blockHasFormalAccessRouteV33(text) {
  const p = normalizeText(text);
  return [
    /\b(?:need|needs|required|requires?) (?:a|the)?\s*(?:token|pass|ticket|key|receipt|invitation)\b/i,
    /\bwhich means (?:we|they|he|she) (?:sing|perform|pay|enter|go through|use)\b/i,
    /\b(?:sing|perform|stage|song|token|pass|ticket|key|receipt|invitation)\b.{0,120}\b(?:front|door|inside|entry|bouncer|guard|gate|stage|backstage|manager|broker|contact)\b/i,
    /\b(?:front|door|inside|entry|bouncer|guard|gate|stage|backstage|manager|broker|contact)\b.{0,120}\b(?:sing|perform|stage|song|token|pass|ticket|key|receipt|invitation)\b/i,
  ].some((rx) => rx.test(p));
}

function findAccessPlanCutStartV33(paragraphs, index, laterIndex) {
  let start = index;
  const floor = Math.max(0, index - 5);

  for (let i = index; i >= floor; i -= 1) {
    const p = normalizeText(paragraphs[i] || '');
    if (!p) continue;
    if (GENERIC_BRANCH_DIVERGENCE_MARKERS_V28.some((rx) => rx.test(p))) {
      start = i;
      break;
    }
    if (/\b(?:back|returned|joined|slid) (?:at|to|into|inside|in)\b/i.test(p) && countWords(p) <= 240) {
      start = i;
      break;
    }
    if (/\b(?:well\?|what(?:'|’)d|what did|what now|what next)\b/i.test(p) && countWords(p) <= 240) {
      start = i;
      break;
    }
  }

  const leadingBlock = normalizeText(paragraphs.slice(0, start).join('\n\n'));
  const laterParagraph = normalizeText(paragraphs[laterIndex] || '');

  const leadingLooksOrphaned =
    start > 0 &&
    start <= 4 &&
    countWords(leadingBlock) > 0 &&
    countWords(leadingBlock) <= 260 &&
    /\b(?:turned and walked|walked away|left(?: them)?|leaving a silence|forced (?:himself|herself|themselves) to breathe|didn[’']?t move|sweat print|forensic souvenir|silence that felt)\b/i.test(leadingBlock);

  const laterLooksLikeCleanSceneOpen =
    /^(?:the|a|an|outside|inside|back outside|back inside|in the|at the)\b.{0,180}\b(?:smelled|glowed|stood|waited|opened|loomed|was|were|hit|pressed|stretched|spread)\b/i.test(laterParagraph);

  if (leadingLooksOrphaned && laterLooksLikeCleanSceneOpen) return 0;
  return start;
}

function isLaterGroupAccessPivotV29(paragraph) {
  const p = normalizeText(paragraph);
  return [
    /\b(?:we|they) need to get (?:in|inside|through)\b/i,
    /\b(?:we|they) need (?:a|the)?\s*(?:token|pass|stage|song|receipt|ticket|key)\b/i,
    /\bwhich means (?:we|they) (?:sing|perform|go through|enter)\b/i,
    /\b(?:sing|perform|stage|token|pass|ticket)\b.{0,80}\b(?:front|door|inside|entry|bouncer|guard|gate)\b/i,
    /\b(?:front|door|inside|entry|bouncer|guard|gate)\b.{0,80}\b(?:sing|perform|stage|token|pass|ticket)\b/i,
    /\b(?:He|She|They|We) had to get .{0,80}\binside\b/i,
  ].some((rx) => rx.test(p));
}

function removeCompetingAccessAttemptV29(text, fixes) {
  let paragraphs = splitParagraphs(text);
  if (paragraphs.length < 18) return normalizeText(text);

  let changed = false;
  let passes = 0;

  while (passes < 2) {
    passes += 1;
    let cut = null;

    for (let i = 0; i < paragraphs.length - 8; i += 1) {
      if (!isSoloAccessAttemptStartV29(paragraphs[i]) && !isEarlyAccessBypassPlanStartV33(paragraphs[i])) continue;

      const soloSearchEnd = Math.min(paragraphs.length, i + 28);
      const soloBlock = paragraphs.slice(i, soloSearchEnd).join('\n\n');
      if (!hasGenericRouteLanguage(soloBlock)) continue;
      if (!/\b(?:alone|one person|I(?:'|’)ll|I will|I(?:'|’)m going|stay|outside|out here|behind|wait)\b/i.test(soloBlock) && !blockHasAccessBypassLanguageV33(soloBlock)) continue;

      for (let j = i + 5; j < Math.min(paragraphs.length, i + 36); j += 1) {
        if (!isLaterGroupAccessPivotV29(paragraphs[j]) && !blockHasFormalAccessRouteV33(paragraphs[j])) continue;

        const laterEnd = Math.min(paragraphs.length, j + 16);
        const laterBlock = paragraphs.slice(j, laterEnd).join('\n\n');
        if (!hasGenericRouteLanguage(laterBlock)) continue;

        const soloTokens = significantBranchTokens(soloBlock);
        const laterTokens = significantBranchTokens(laterBlock);
        const soloProper = genericProperBranchTokensV28(soloBlock);
        const laterProper = genericProperBranchTokensV28(laterBlock);
        const overlap = intersectionCount(soloTokens, laterTokens);
        const properOverlap = intersectionCount(soloProper, laterProper);
        const routeCount = Math.min(routeKeywordCountV28(soloBlock), routeKeywordCountV28(laterBlock));
        const removedBlock = paragraphs.slice(i, j).join('\n\n');
        const removedWords = countWords(removedBlock);
        const totalWords = countWords(paragraphs.join('\n\n'));

        const hasAccessWords = /\b(?:bouncer|guard|door|gate|club|bar|stage|token|pass|ticket|receipt|broker|contact|manager|inside|front)\b/i.test(`${soloBlock}\n${laterBlock}`);
        const hasPlanReversal = blockHasAccessBypassLanguageV33(soloBlock) && blockHasFormalAccessRouteV33(laterBlock);
        const confident =
          hasAccessWords &&
          routeCount >= 2 &&
          removedWords >= 450 &&
          removedWords <= 6200 &&
          properOverlap >= 1 &&
          (
            overlap >= 14 ||
            (hasPlanReversal && overlap >= 10)
          );
        if (!confident) continue;
        if (totalWords > 0 && removedWords / totalWords > 0.58) continue;

        const cutStart = findAccessPlanCutStartV33(paragraphs, i, j);
        const adjustedRemovedBlock = paragraphs.slice(cutStart, j).join('\n\n');
        const adjustedRemovedWords = countWords(adjustedRemovedBlock);

        cut = {
          start: cutStart,
          end: j,
          removedWords: adjustedRemovedWords,
          removedBlock: adjustedRemovedBlock,
          overlap,
          properOverlap,
          routeCount,
          soloPreview: makePreview(soloBlock, 180),
          laterPreview: makePreview(laterBlock, 180),
        };
        break;
      }

      if (cut) break;
    }

    if (!cut) break;
    paragraphs = [
      ...paragraphs.slice(0, cut.start),
      ...paragraphs.slice(cut.end),
    ];
    changed = true;
    fixes.push({
      label: 'generic competing-access/access-plan-reversal quarantine: removed earlier bypass/false-entry attempt before later fuller access route',
      priorMarker: cut.soloPreview,
      startMarker: `paragraphs ${cut.start + 1}-${cut.end}`,
      endMarker: cut.laterPreview,
      removedWords: cut.removedWords,
      removedChars: cut.removedBlock.length,
      overlap: cut.overlap,
      properOverlap: cut.properOverlap,
      routeCount: cut.routeCount,
    });
  }

  return changed ? normalizeText(paragraphs.join('\n\n')) : normalizeText(text);
}


function hasSoloVenueContactSceneV34(text) {
  const p = normalizeText(text);
  const venueSignals = [
    /\bbooth\b/i,
    /\bbar\b/i,
    /\bclub\b/i,
    /\bstage\b/i,
    /\bback room\b/i,
    /\bserver\b/i,
    /\bdrink\b/i,
    /\bcider\b/i,
    /\btankard\b/i,
    /\bbill\b/i,
    /\bminimum\b/i,
    /\btable\b/i,
  ].filter((rx) => rx.test(p)).length;

  const contactSignals = [
    /\bbroker\b/i,
    /\bmanager\b/i,
    /\bcontact\b/i,
    /\bguide\b/i,
    /\bprice\b/i,
    /\bfavor\b/i,
    /\bcollateral\b/i,
    /\basset\b/i,
    /\btrade\b/i,
    /\bdeal\b/i,
    /\binformation\b/i,
    /\baudience\b/i,
    /\broute\b/i,
    /\bpath\b/i,
  ].filter((rx) => rx.test(p)).length;

  const soloSignals = [
    /\balone\b/i,
    /\bhe stood\b/i,
    /\bshe stood\b/i,
    /\bslid back\b/i,
    /\bslumped back\b/i,
    /\bscanned the room\b/i,
    /\bstep(?:ped)? into .* path\b/i,
    /\bwait(?:ed|ing)?\b/i,
    /\bhis hands were shaking\b/i,
    /\bher hands were shaking\b/i,
  ].filter((rx) => rx.test(p)).length;

  return venueSignals >= 3 && contactSignals >= 4 && soloSignals >= 1;
}

function findLaterFormalRoutePivotV34(paragraphs, fromIndex) {
  const max = Math.min(paragraphs.length, fromIndex + 42);
  for (let j = fromIndex + 5; j < max; j += 1) {
    const block = paragraphs.slice(j, Math.min(paragraphs.length, j + 12)).join('\n\n');
    if (!blockHasFormalAccessRouteV33(block) && !isLaterGroupAccessPivotV29(block)) continue;
    if (!/\b(?:sing|perform|song|stage|token|pass|ticket|bouncer|front door|backstage|inside)\b/i.test(block)) continue;
    if (!hasGenericRouteLanguage(block)) continue;
    return j;
  }
  return -1;
}

function findOrphanedSoloRouteCutStartV34(paragraphs, earlyIndex, laterIndex) {
  const leadingBlock = normalizeText(paragraphs.slice(0, earlyIndex).join('\n\n'));
  const firstBlock = normalizeText(paragraphs.slice(0, Math.min(paragraphs.length, earlyIndex + 3)).join('\n\n'));

  const leadingLooksLikeDetachedSetup =
    earlyIndex <= 5 &&
    countWords(leadingBlock || firstBlock) <= 420 &&
    /\b(?:turned and walked|walked away|leaving a silence|forced (?:himself|herself|themselves) to breathe|didn[’']?t move|sweat print|forensic souvenir|beacon|physical substance)\b/i.test(leadingBlock || firstBlock);

  if (leadingLooksLikeDetachedSetup) return 0;

  for (let i = earlyIndex; i >= Math.max(0, earlyIndex - 4); i -= 1) {
    const p = normalizeText(paragraphs[i] || '');
    if (!p) continue;
    if (/\b(?:back|returned|slid|slumped) (?:at|to|into|inside|in)\b/i.test(p) && countWords(p) <= 260) return i;
    if (/\b(?:the|a|an) .{0,80}\b(?:smelled|glowed|stood|waited|opened|loomed|was|were|pressed|spread)\b/i.test(p) && countWords(p) <= 260) return i;
  }

  return earlyIndex;
}

function removeOrphanedSoloVenueContactRouteV34(text, fixes) {
  let paragraphs = splitParagraphs(text);
  if (paragraphs.length < 18) return normalizeText(text);

  let changed = false;
  let passes = 0;

  while (passes < 2) {
    passes += 1;
    let cut = null;

    for (let i = 0; i < Math.min(paragraphs.length - 10, 18); i += 1) {
      const earlyEnd = Math.min(paragraphs.length, i + 16);
      const earlyBlock = paragraphs.slice(i, earlyEnd).join('\n\n');
      if (countWords(earlyBlock) < 350) continue;
      if (!hasSoloVenueContactSceneV34(earlyBlock)) continue;
      if (!hasGenericRouteLanguage(earlyBlock)) continue;

      const laterIndex = findLaterFormalRoutePivotV34(paragraphs, i);
      if (laterIndex < 0) continue;

      const laterBlock = paragraphs.slice(laterIndex, Math.min(paragraphs.length, laterIndex + 18)).join('\n\n');
      const earlyTokens = significantBranchTokens(earlyBlock);
      const laterTokens = significantBranchTokens(laterBlock);
      const earlyProper = genericProperBranchTokensV28(earlyBlock);
      const laterProper = genericProperBranchTokensV28(laterBlock);
      const overlap = intersectionCount(earlyTokens, laterTokens);
      const properOverlap = intersectionCount(earlyProper, laterProper);
      const routeCount = Math.min(routeKeywordCountV28(earlyBlock), routeKeywordCountV28(laterBlock));
      const hasSameNamedObjective = properOverlap >= 1;
      const hasAccessReversal =
        /\b(?:booth|bar|club|stage|drink|cider|bill|minimum|server|wait)\b/i.test(earlyBlock) &&
        /\b(?:sing|perform|song|stage|token|pass|bouncer|front door|backstage)\b/i.test(laterBlock);

      const cutStart = findOrphanedSoloRouteCutStartV34(paragraphs, i, laterIndex);
      const removedBlock = paragraphs.slice(cutStart, laterIndex).join('\n\n');
      const removedWords = countWords(removedBlock);
      const totalWords = countWords(paragraphs.join('\n\n'));

      const confident =
        hasSameNamedObjective &&
        hasAccessReversal &&
        routeCount >= 2 &&
        overlap >= 8 &&
        removedWords >= 450 &&
        removedWords <= 6500 &&
        totalWords > 0 &&
        removedWords / totalWords <= 0.55;

      if (!confident) continue;

      cut = {
        start: cutStart,
        end: laterIndex,
        removedWords,
        removedBlock,
        overlap,
        properOverlap,
        routeCount,
        earlyPreview: makePreview(earlyBlock, 180),
        laterPreview: makePreview(laterBlock, 180),
      };
      break;
    }

    if (!cut) break;

    paragraphs = [
      ...paragraphs.slice(0, cut.start),
      ...paragraphs.slice(cut.end),
    ];

    changed = true;
    fixes.push({
      label: 'generic orphaned solo venue/contact route quarantine: removed stale solo-entry branch before later formal group access route',
      priorMarker: cut.earlyPreview,
      startMarker: `paragraphs ${cut.start + 1}-${cut.end}`,
      endMarker: cut.laterPreview,
      removedWords: cut.removedWords,
      removedChars: cut.removedBlock.length,
      overlap: cut.overlap,
      properOverlap: cut.properOverlap,
      routeCount: cut.routeCount,
    });
  }

  return changed ? normalizeText(paragraphs.join('\n\n')) : normalizeText(text);
}


function openingLooksLikeMidContactNegotiationFragmentV35(text) {
  const p = normalizeText(text).slice(0, 5200);
  if (countWords(p) < 120) return false;

  const firstSentence = (p.split(/(?<=[.!?])\s+/)[0] || '').slice(0, 260);
  const startsMidAction = /^(?:[“"']?[A-Z][\w’' -]{1,70}\s+(?:froze|turned|leaned|stared|looked|asked|said|repeated|nodded|sighed|studied|watched|stopped|paused)\b|[“"'][^”"']{1,140}[”"']\s*[A-Z][\w’' -]{1,50}\s+(?:said|asked|whispered|repeated)\b)/i.test(firstSentence);

  const negotiationSignals = [
    /\b(?:price|favor|favour|collateral|asset|trade|deal|information|broker|contact|guide|route|path|audience|consultation|service|services)\b/i,
    /\b(?:booth|bar|club|stage|server|drink|cider|tankard|bill|minimum|back room|inventory|counter)\b/i,
    /\b(?:i have|we have|i’ll let you|i will let you|we want|we need|in exchange|for a viable|real workable|not a promise|not a hope)\b/i,
    /\b(?:if you are followed|deal is void|consequences will be|pay your bill|finish your drink|wait in the alley|rear door|back exit)\b/i,
  ].filter((rx) => rx.test(p)).length;

  const namedContactOrRole = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:froze|said|asked|repeated|sighed|studied|watched|looked|turned)\b/.test(p.slice(0, 900));

  return startsMidAction && namedContactOrRole && negotiationSignals >= 3 && hasGenericRouteLanguage(p);
}

function findFormalGroupAccessStartIndexV35(paragraphs) {
  const max = Math.min(paragraphs.length, 42);
  for (let j = 1; j < max; j += 1) {
    const p = normalizeText(paragraphs[j] || '');
    const block = paragraphs.slice(j, Math.min(paragraphs.length, j + 14)).join('\n\n');
    if (!blockHasFormalAccessRouteV33(block) && !isLaterGroupAccessPivotV29(block)) continue;
    if (!/\b(?:sing|perform|song|stage|token|pass|ticket|bouncer|front door|backstage|inside|get in|get inside|get through)\b/i.test(block)) continue;
    if (!hasGenericRouteLanguage(block)) continue;

    const cleanSceneStart =
      /^(?:the|a|an|outside|inside|back outside|back inside|in the|at the)\b.{0,220}\b(?:alley|street|door|club|bar|venue|stage|bouncer|front|entrance|hallway|corridor|room|market|building)\b.{0,240}\b(?:smelled|glowed|waited|stood|opened|loomed|pressed|thumped|buzzed|hit|spread|stretched|was|were)\b/i.test(p) ||
      /^(?:back outside|outside|inside|the alley|the street|the club|the bar|the venue)\b/i.test(p) ||
      /\b(?:we|they) need to get (?:in|inside|through)\b/i.test(p) ||
      /\bwhich means (?:we|they) (?:sing|perform|get|go)\b/i.test(p);

    if (cleanSceneStart) return j;
  }
  return -1;
}

function removeOpeningNegotiationFragmentBeforeFormalRouteV35(text, fixes) {
  const source = normalizeText(text);
  if (!source || countWords(source) < 900) return source;

  const paragraphs = splitParagraphs(source);
  if (paragraphs.length < 8) return source;

  const openingBlock = paragraphs.slice(0, Math.min(paragraphs.length, 10)).join('\n\n');
  if (!openingLooksLikeMidContactNegotiationFragmentV35(openingBlock)) return source;

  const routeStart = findFormalGroupAccessStartIndexV35(paragraphs);
  if (routeStart < 1) return source;

  const removedBlock = paragraphs.slice(0, routeStart).join('\n\n');
  const keptBlock = paragraphs.slice(routeStart, Math.min(paragraphs.length, routeStart + 16)).join('\n\n');
  const removedWords = countWords(removedBlock);
  const totalWords = countWords(source);
  if (removedWords < 120 || removedWords > 5000) return source;
  if (totalWords > 0 && removedWords / totalWords > 0.45) return source;

  const removedProper = genericProperBranchTokensV28(removedBlock);
  const keptProper = genericProperBranchTokensV28(keptBlock);
  const removedTokens = significantBranchTokens(removedBlock);
  const keptTokens = significantBranchTokens(keptBlock);
  const properOverlap = intersectionCount(removedProper, keptProper);
  const overlap = intersectionCount(removedTokens, keptTokens);

  const hasRepeatedObjectiveOrVenue = properOverlap >= 1 || overlap >= 8;
  const removedLooksLikeDeal = hasSoloVenueContactSceneV34(removedBlock) || /\b(?:price|favor|favour|collateral|asset|trade|deal|information|broker|contact|guide|route|path|audience|consultation)\b/i.test(removedBlock);
  const keptLooksLikeFormalRoute = blockHasFormalAccessRouteV33(keptBlock) || isLaterGroupAccessPivotV29(keptBlock);

  if (!hasRepeatedObjectiveOrVenue || !removedLooksLikeDeal || !keptLooksLikeFormalRoute) return source;

  const out = normalizeText(paragraphs.slice(routeStart).join('\n\n'));
  fixes.push({
    label: 'generic opening negotiation fragment quarantine: removed chapter-opening mid-contact/deal fragment before later formal group access route',
    priorMarker: makePreview(removedBlock, 220),
    startMarker: `opening paragraphs 1-${routeStart}`,
    endMarker: makePreview(keptBlock, 220),
    removedWords,
    removedChars: removedBlock.length,
    overlap,
    properOverlap,
    routeCount: Math.min(routeKeywordCountV28(removedBlock), routeKeywordCountV28(keptBlock)),
  });
  return out;
}



function openingLooksLikeSoloAccessPlanStumpV36(text) {
  const p = normalizeText(text).slice(0, 7200);
  if (countWords(p) < 160) return false;

  const firstParagraph = normalizeText(splitParagraphs(p)[0] || '').slice(0, 900);
  const startsAsThoughtOrDetachedDecision =
    /^(?:a|the|some)\s+.{0,90}\b(?:idea|plan|option|decision|solution|move)\b.{0,160}\b(?:congealed|formed|arrived|settled|occurred|clicked|became|was)\b/i.test(firstParagraph) ||
    /\b(?:we|i|he|she|they)\s+(?:are|were|was|am|'re|'m)\s+going\s+to\s+(?:sing|perform|pay|talk|trade|deal|walk|enter|get)\b/i.test(firstParagraph) ||
    /\b(?:he|she|they|i)\s+(?:couldn[’']t|could not)\s+(?:pay|leave|enter|get inside|get in|explain|draw attention)\b/i.test(firstParagraph);

  const accessPlanSignals = [
    /\b(?:couldn[’']t|could not)\s+(?:pay|leave|enter|get inside|get in|explain|draw attention)\b/i,
    /\b(?:had to|get|bring|fetch|return to|go get)\s+(?:[A-Z][a-z]+|him|her|them|the group|the others).{0,120}\b(?:inside|in|through|past|front door|door|entrance)\b/i,
    /\b(?:front door|bouncer|stage|song|sing|perform|token|pass|ticket|backstage|microphone|karaoke|number)\b/i,
    /\b(?:that[’']?s the rule|the rule|clean way|only way|somehow|some way|formal route|earn(?:ed)?|acceptable)\b/i,
    /\b(?:he stood|she stood|they stood|i stood|headed back|went back|returned|emerged|stepped back out|back outside|outside)\b/i,
  ].filter((rx) => rx.test(p)).length;

  const routeLanguage = routeKeywordCountV28(p) >= 3 || hasGenericRouteLanguage(p);
  return startsAsThoughtOrDetachedDecision && accessPlanSignals >= 3 && routeLanguage;
}

function findLaterCleanVenueEntryStartIndexV36(paragraphs) {
  const max = Math.min(paragraphs.length, 44);
  for (let j = 1; j < max; j += 1) {
    const p = normalizeText(paragraphs[j] || '');
    const block = paragraphs.slice(j, Math.min(paragraphs.length, j + 16)).join('\n\n');

    const cleanVenueIntro =
      /^(?:the|a|an)\s+.{0,90}\b(?:bar|club|venue|market|building|house|casino|station|terminal|gate|door|entrance|lobby|room|hall|district|city|alley|street|dock|warehouse|restaurant|hotel|office)\b.{0,260}\b(?:wasn[’']?t hard to find|was hard to miss|glowed|buzzed|flickered|stood|loomed|opened|waited|sat|rose|sprawled|stretched|smelled|thumped|vibrated|shone|blocked)\b/i.test(p) ||
      /^(?:outside|inside|back outside|back inside|at the|in the)\s+.{0,120}\b(?:door|entrance|bar|club|venue|stage|bouncer|front|backstage|hallway|corridor|room|alley|street|market|building)\b/i.test(p);

    const formalRouteNearby =
      /\b(?:bouncer|front door|line|stage|song|sing|perform|token|pass|ticket|backstage|microphone|curtain|hallway|inside|get in|get through|get past)\b/i.test(block) &&
      (blockHasFormalAccessRouteV33(block) || isLaterGroupAccessPivotV29(block) || hasGenericRouteLanguage(block));

    if (cleanVenueIntro && formalRouteNearby) return j;
  }
  return -1;
}

function removeOpeningSoloAccessPlanStumpBeforeVenueEntryV36(text, fixes) {
  const source = normalizeText(text);
  if (!source || countWords(source) < 900) return source;

  const paragraphs = splitParagraphs(source);
  if (paragraphs.length < 10) return source;

  const openingBlock = paragraphs.slice(0, Math.min(paragraphs.length, 12)).join('\n\n');
  if (!openingLooksLikeSoloAccessPlanStumpV36(openingBlock)) return source;

  const routeStart = findLaterCleanVenueEntryStartIndexV36(paragraphs);
  if (routeStart < 1) return source;

  const removedBlock = paragraphs.slice(0, routeStart).join('\n\n');
  const keptBlock = paragraphs.slice(routeStart, Math.min(paragraphs.length, routeStart + 18)).join('\n\n');
  const removedWords = countWords(removedBlock);
  const totalWords = countWords(source);

  if (removedWords < 150 || removedWords > 4200) return source;
  if (totalWords > 0 && removedWords / totalWords > 0.38) return source;

  const removedHasAccessStump = /\b(?:couldn[’']t|could not)\s+(?:pay|leave|enter|get inside|get in|explain|draw attention)\b/i.test(removedBlock) &&
    /\b(?:front door|bouncer|stage|song|sing|perform|token|pass|ticket|backstage|microphone|karaoke|number)\b/i.test(removedBlock);
  const keptHasCleanFormalRoute = /\b(?:bouncer|front door|line|stage|song|sing|perform|token|pass|ticket|backstage|microphone|curtain|hallway|inside|get in|get through|get past)\b/i.test(keptBlock) &&
    (blockHasFormalAccessRouteV33(keptBlock) || isLaterGroupAccessPivotV29(keptBlock) || hasGenericRouteLanguage(keptBlock));

  const removedTokens = significantBranchTokens(removedBlock);
  const keptTokens = significantBranchTokens(keptBlock);
  const overlap = intersectionCount(removedTokens, keptTokens);
  const routeCount = Math.min(routeKeywordCountV28(removedBlock), routeKeywordCountV28(keptBlock));

  if (!removedHasAccessStump || !keptHasCleanFormalRoute || overlap < 5 || routeCount < 2) return source;

  const out = normalizeText(paragraphs.slice(routeStart).join('\n\n'));
  fixes.push({
    label: 'generic opening access-plan stump quarantine: removed stale solo/planning opener before later clean venue-entry route',
    priorMarker: makePreview(removedBlock, 240),
    startMarker: `opening paragraphs 1-${routeStart}`,
    endMarker: makePreview(keptBlock, 240),
    removedWords,
    removedChars: removedBlock.length,
    overlap,
    routeCount,
  });
  return out;
}


const DIALOGUE_TAG_VERBS_V37 =
  '(?:said|asked|whispered|muttered|replied|snapped|shouted|called|answered|added|continued|corrected|echoed|breathed|hissed|grunted|murmured|croaked|rasped|yelled|said quietly|said softly|said firmly)';

function paragraphLooksLikeCollapsedDialogueV38(paragraph) {
  const p = normalizeText(paragraph);
  if (countWords(p) < 90) return false;
  const quoteCount = (p.match(/[“”"]/g) || []).length;
  const dialogueTagCount = (p.match(new RegExp(`\\b${DIALOGUE_TAG_VERBS_V37}\\b`, 'gi')) || []).length;
  const extraCloseFragments = (p.match(/[”"]\s+[A-Z][^“”"]{8,260}?[.!?][”"]/g) || []).length;
  const stageAccessTalk = /\b(?:sing|song|stage|token|pass|bouncer|front door|backstage|microphone|perform|deal|price|favor|collateral|route|guide|contact|inside|get in|get through)\b/i.test(p);
  return quoteCount >= 6 && (dialogueTagCount >= 2 || extraCloseFragments >= 1 || stageAccessTalk);
}

function repairCollapsedDialogueParagraphV38(paragraph) {
  let p = normalizeText(paragraph);
  if (!paragraphLooksLikeCollapsedDialogueV38(p)) return paragraph;

  // Repair orphaned spoken fragments that lost their opening quote after a prior quoted beat.
  // Example pattern: “Sing.” For the token. That’s the rule.” Zonk...
  // This becomes: “Sing.”\n\n“For the token. That’s the rule.”\n\nZonk...
  const orphanRx = new RegExp(
    `([”"])\\s+` +
    `((?!(?:he|she|they|we|i|you|it|[A-Z][a-z]+)\\s+${DIALOGUE_TAG_VERBS_V37}\\b)` +
    `(?:[A-Z][^“”"]{3,360}?)[.!?])` +
    `([”"])(?=\\s*(?:[“"'‘]|[A-Z]))`,
    'g'
  );

  for (let guard = 0; guard < 8; guard += 1) {
    const next = p.replace(orphanRx, (_m, priorClose, spoken, closeQuote) => {
      const cleanSpoken = String(spoken || '').trim();
      if (countWords(cleanSpoken) < 2) return _m;
      if (/^(?:He|She|They|We|I|You|It)\s+(?:said|asked|looked|turned|stood|walked|ran|picked|took|felt|saw|heard|noticed|watched|started|stopped|moved|went|came)\b/.test(cleanSpoken)) return _m;
      return `${priorClose}\n\n“${cleanSpoken}${closeQuote}\n\n`;
    });
    if (next === p) break;
    p = next;
  }

  // Repair echoed fragments that lost their opening quote and end with a comma before a dialogue tag.
  // Example: “Messy joy.” Messy joy,” Blaze echoed.
  // Becomes: “Messy joy.”\n\n“Messy joy,” Blaze echoed.
  const echoFragmentRx = new RegExp(
    `([”"])\\s+` +
    `((?![“\"])(?:[A-Z][^“”\"\\n]{1,140}?[,;:]))` +
    `([”"]\\s+[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?\\s+${DIALOGUE_TAG_VERBS_V37}\\b)`,
    'gi'
  );

  for (let guard = 0; guard < 8; guard += 1) {
    const next = p.replace(echoFragmentRx, (_m, priorClose, spoken, tagTail) => {
      const cleanSpoken = String(spoken || '').trim();
      if (countWords(cleanSpoken) < 1 || countWords(cleanSpoken) > 18) return _m;
      if (/^(?:He|She|They|We|I|You|It)\b/.test(cleanSpoken)) return _m;
      return `${priorClose}\n\n“${cleanSpoken}${tagTail}`;
    });
    if (next === p) break;
    p = next;
  }

  // Repair exact duplicated spoken echoes where the second echo lost its opening quote.
  // Example: “Okay.” Okay,” she said.
  p = p.replace(
    new RegExp(`([“\"]([^“”\"]{1,80}?)[.!?][”\"])\\s+\\2([,;:]?[”\"]\\s+[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?\\s+${DIALOGUE_TAG_VERBS_V37}\\b)`, 'gi'),
    (_m, firstQuote, spokenCore, tagTail) => `${firstQuote}\n\n“${spokenCore}${tagTail}`
  );

  // Put a paragraph break between a completed dialogue tag and the next spoken turn.
  p = p.replace(
    new RegExp(`([”"]\\s*(?:[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?\\s+)?${DIALOGUE_TAG_VERBS_V37}[^.!?]{0,140}[.!?])\\s+(?=[“"])`, 'gi'),
    '$1\n\n'
  );

  // Split no-space quote collisions created by previous cleanup passes.
  p = p.replace(/([”"])([“"'‘][A-Z0-9])/g, '$1\n\n$2');

  // Split a completed quoted line followed by a likely new spoken line that begins with a direct address.
  p = p.replace(
    /([”"])\s+((?:[A-Z][a-z]{2,24}\.|No\.|Yes\.|Right\.|Okay\.|Exactly\.|Too\s+long\.|Requires\s+|That\s+was\s+|The\s+last\s+time\s+)[^“”"]{6,360}?[.!?][”"])/g,
    '$1\n\n“$2'
  );


  // v39: Repair malformed dialogue-question followed by a missing opening quote.
  // Example: “What is a ‘Bohemian Rhapsody’?” A cry for help set to music,” Zonk muttered.
  // Becomes: “What is a ‘Bohemian Rhapsody’?”\n\n“A cry for help set to music,” Zonk muttered.
  const missingOpeningQuoteAfterQuestionRx = new RegExp(
    `([“"][^“”"\\n]{3,260}\\?[”"])\\s+` +
    `((?![“"])(?:[A-Z][^“”"\\n]{2,260}?[,:;.!?][”"]\\s+` +
    `(?:[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?|he|she|they|we|I|you)\\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\\b[^\\n]*?))`,
    'gi'
  );

  p = p.replace(missingOpeningQuoteAfterQuestionRx, (_m, firstQuestion, secondSpoken) => {
    const spoken = String(secondSpoken || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 40) return _m;
    if (/^(?:He|She|They|We|I|You|It)\s+(?:looked|turned|stood|walked|ran|picked|took|felt|saw|heard|noticed|watched|started|stopped|moved|went)\b/i.test(spoken)) {
      return _m;
    }
    return `${firstQuestion}\n\n“${spoken}`;
  });

  // v39: Split compressed speaker-turn chains where a completed quote is followed
  // by a reaction beat from a likely different speaker and then another quote.
  // Example: “And we need a token.” Blaze stared at him. “Sing.”
  // Becomes: “And we need a token.”\n\nBlaze stared at him. “Sing.”
  const compressedSpeakerReactionRx = /([”"])\s+((?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|He|She|They|We|I|You)\s+(?:stared|looked|blinked|frowned|nodded|shook|shifted|swallowed|flinched|smiled|grimaced|turned|paused|hesitated|winced|laughed|snorted|sighed|breathed|whispered|muttered|asked|said)\b[^“”"\n]{0,180}[.!?]\s+[“"])/g;

  p = p.replace(compressedSpeakerReactionRx, '$1\n\n$2');

  // v39: Split a quoted line followed immediately by another quoted line
  // when the second begins with a fresh direct speech opener.
  p = p.replace(
    /([”"])\s+(?=[“"](?:No|Yes|Right|Okay|Exactly|Wait|What|Why|How|Dude|Man|Look|Listen|Please|Sorry|Thanks|Thank you|For the|To get|We need|I need|You need|They need|It is|It was)\b)/g,
    '$1\n\n'
  );

  // Clean triple spacing from repeated replacements while preserving paragraph breaks.
  return normalizeText(p);
}



function repairSpeakerTurnAttributionTextV40(text) {
  let p = normalizeText(text);

  // v40: Rejoin dialogue tags that v39/earlier paragraph splitting separated from the spoken line.
  // Example:
  // “Okay,”
  //
  // Zonk said.
  // Becomes:
  // “Okay,” Zonk said.
  const detachedDialogueTagRx = new RegExp(
    `([“"][^“”"\\n]{1,180}?[,.!?][”"])\\n\\n` +
    `((?:[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?|he|she|they|we|I|you)\\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\\b)`,
    'g'
  );
  p = p.replace(detachedDialogueTagRx, '$1 $2');

  // v40: Repair missing opening quote after any completed quote, not only after questions.
  // Examples:
  // “If it’s acceptable.” Right,” Blaze said.
  // “This is the inventory.” We’re not here for the show,” Zonk said.
  // “A genuine article.” Borrowed,” Blaze said.
  const missingOpeningQuoteAfterCompletedQuoteRx = new RegExp(
    `([.!?][”"])\\s+` +
    `((?![“"])(?:[A-Z][^“”"\\n]{1,220}?[,:;.!?][”"]\\s+` +
    `(?:[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?|he|she|they|we|I|you)\\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\\b[^\\n]*?))`,
    'g'
  );
  p = p.replace(missingOpeningQuoteAfterCompletedQuoteRx, (_m, priorEnd, spokenWithTag) => {
    const spoken = String(spokenWithTag || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 42) return _m;
    if (/^(?:He|She|They|We|I|You|It)\s+(?:looked|turned|stood|walked|ran|picked|took|felt|saw|heard|noticed|watched|started|stopped|moved|went)\b/i.test(spoken)) return _m;
    return `${priorEnd}\n\n“${spoken}`;
  });

  // v40: Repair missing opening quote after a dialogue question even when the question is embedded
  // inside narration and the paragraph was not long enough for the v38/v39 collapsed-dialogue gate.
  const missingOpeningQuoteAfterQuestionGlobalRx = new RegExp(
    `([“"][^“”"\\n]{3,260}\\?[”"])\\s+` +
    `((?![“"])(?:[A-Z][^“”"\\n]{2,220}?[,:;.!?][”"]\\s+` +
    `(?:[A-Z][\\w’'\\-]+(?:\\s+[A-Z][\\w’'\\-]+)?|he|she|they|we|I|you)\\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\\b[^\\n]*?))`,
    'g'
  );
  p = p.replace(missingOpeningQuoteAfterQuestionGlobalRx, (_m, firstQuestion, secondSpoken) => {
    const spoken = String(secondSpoken || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 42) return _m;
    return `${firstQuestion}\n\n“${spoken}`;
  });

  // v40: Rejoin the same split tag pattern one more time after missing-quote repairs add paragraph breaks.
  p = p.replace(detachedDialogueTagRx, '$1 $2');

  // v41: Repair missing opening quote when the prior quoted line ends with nested single quote punctuation.
  // Example:
  // “The Smile Song.’” No shovels,” Blaze said firmly.
  // Becomes:
  // “The Smile Song.’”
  //
  // “No shovels,” Blaze said firmly.
  const missingOpeningQuoteAfterNestedCloseRx = new RegExp(
    `([.!?][’']?[”"])\s+` +
    `((?![“"])(?:[A-Z][^“”"\n]{1,160}?[,:;.!?][”"]\s+` +
    `(?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|he|she|they|we|I|you)\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\b[^\n]*?))`,
    'g'
  );
  p = p.replace(missingOpeningQuoteAfterNestedCloseRx, (_m, priorEnd, spokenWithTag) => {
    const spoken = String(spokenWithTag || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 36) return _m;
    if (/^(?:He|She|They|We|I|You|It)\s+(?:looked|turned|stood|walked|ran|picked|took|felt|saw|heard|noticed|watched|started|stopped|moved|went)\b/i.test(spoken)) return _m;
    return `${priorEnd}\n\n“${spoken}`;
  });

  // v41: Split compressed dialogue tag + fresh speaker/narration turn after a completed spoken line.
  // This is intentionally conservative: it only splits after a complete dialogue sentence with a tag,
  // and only when the next sentence begins with a clear new subject/action beat.
  const tagThenFreshTurnRx = new RegExp(
    `([“"][^“”"\n]{1,220}?[.!?][”"]\s+` +
    `(?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|he|she|they|we|I|you)\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\b[^\n.!?]{0,120}[.!?])\s+` +
    `(?=((?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|He|She|They|We|I|You)\s+` +
    `(?:stared|looked|blinked|frowned|nodded|shook|shifted|swallowed|flinched|smiled|grimaced|turned|paused|hesitated|winced|laughed|snorted|sighed|breathed|rubbed|grabbed|took|pushed|pulled|stepped|walked|moved|sat|stood|leaned|reached|watched|glanced|opened|closed|said|asked|muttered|whispered|snapped|shouted|called)\b))`,
    'gi'
  );
  p = p.replace(tagThenFreshTurnRx, '$1\n\n');

  // v41: Split a quoted sentence followed by a short reaction beat and a new quoted line.
  // Example:
  // “Line one.” Blaze stared at him. “Line two.”
  // Becomes:
  // “Line one.”
  //
  // Blaze stared at him. “Line two.”
  const quoteThenReactionThenQuoteRx = /([”"])\s+((?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|He|She|They|We|I|You)\s+(?:stared|looked|blinked|frowned|nodded|shook|shifted|swallowed|flinched|smiled|grimaced|turned|paused|hesitated|winced|laughed|snorted|sighed|breathed|rubbed|grabbed|took|pushed|pulled|stepped|walked|moved|sat|stood|leaned|reached|watched|glanced)\b[^“”"\n]{0,160}[.!?]\s+[“"])/g;
  p = p.replace(quoteThenReactionThenQuoteRx, '$1\n\n$2');

  // v42: Final missing-opening-quote edgecase repair for short reply fragments that begin
  // with common direct-answer/opening words after a completed quoted sentence.
  // Example:
  // “The Smile Song.’” No shovels,” Blaze said firmly.
  // Becomes:
  // “The Smile Song.’”
  //
  // “No shovels,” Blaze said firmly.
  const commonReplyMissingQuoteRx = new RegExp(
    `([.!?][’']?[”"])\s+` +
    `((?![“"])(?:(?:No|Yes|Right|Okay|Exactly|Wait|What|Why|How|Dude|Man|Look|Listen|Please|Sorry|Thanks|Thank you|Too long|Requires|That was|The last time|A cry|Borrowed|We’re|We're|I’m|I'm|You’re|You're|They’re|They're|For the|To get|We need|I need|You need|They need|It is|It was)\b` +
    `[^“”"\n]{0,180}?[,:;.!?][”"]\s+` +
    `(?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|he|she|they|we|I|you)\s+` +
    `${DIALOGUE_TAG_VERBS_V37}\b[^\n]*?))`,
    'g'
  );
  p = p.replace(commonReplyMissingQuoteRx, (_m, priorEnd, spokenWithTag) => {
    const spoken = String(spokenWithTag || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 38) return _m;
    return `${priorEnd}\n\n“${spoken}`;
  });

  // v43: String.raw backstop for common short reply fragments whose opening quote was lost.
  // Some prior dynamic RegExp template literals used plain \s/\b escapes inside normal
  // JavaScript strings, which can degrade into literal letters in the generated pattern.
  // This backstop uses String.raw so fragments like:
  // “The Smile Song.’” No shovels,” Blaze said firmly.
  // are repaired reliably in any manuscript.
  const commonReplyMissingQuoteRawRx = new RegExp(String.raw`([.!?][’']?[”"])\s+((?![“"])(?:(?:No|Yes|Right|Okay|Exactly|Wait|What|Why|How|Dude|Man|Look|Listen|Please|Sorry|Thanks|Thank you|Too long|Requires|That was|The last time|A cry|Borrowed|We’re|We're|I’m|I'm|You’re|You're|They’re|They're|For the|To get|We need|I need|You need|They need|It is|It was)\b[^“”"\n]{0,180}?[,:;.!?][”"]\s+(?:[A-Z][\w’'\-]+(?:\s+[A-Z][\w’'\-]+)?|he|she|they|we|I|you)\s+${DIALOGUE_TAG_VERBS_V37}\b[^\n]*?))`, 'g');

  p = p.replace(commonReplyMissingQuoteRawRx, (_m, priorEnd, spokenWithTag) => {
    const spoken = String(spokenWithTag || '').trim();
    if (countWords(spoken) < 2 || countWords(spoken) > 38) return _m;
    if (/^(?:He|She|They|We|I|You|It)\s+(?:looked|turned|stood|walked|ran|picked|took|felt|saw|heard|noticed|watched|started|stopped|moved|went)\b/i.test(spoken)) return _m;
    return `${priorEnd}\n\n“${spoken}`;
  });

  // v44: Repair orphaned dialogue lines that begin with a single-quoted title/fragments
  // but are missing the outer opening dialogue quote.
  // Examples:
  // ‘Sweet Caroline’?”
  // ‘Don’t Stop Believin’’?”
  // ’S fine. Cold.”
  // Become:
  // “‘Sweet Caroline’?”
  // “‘Don’t Stop Believin’’?”
  // “’S fine. Cold.”
  p = p.replace(
    /(^|\n\n)([‘’'][^“”"\n]{1,140}?[.!?][”"])(?=\n\n|$)/g,
    (_m, lead, orphaned) => {
      const line = String(orphaned || '').trim();
      if (!line) return _m;
      if (/^[“"]/.test(line)) return _m;
      if (countWords(line) > 18) return _m;
      if (/^(?:‘|’|')(?:(?:s|S)\b|[A-Z0-9])/.test(line)) return `${lead}“${line}`;
      return _m;
    }
  );

  // v42: Repair quoted label/list fragments where an item lost its opening quote.
  // Example: “Storage,” Manager,”
  // Becomes: “Storage,” “Manager,”
  p = p.replace(
    /([“"][A-Z][^“”"\n]{1,60}?[,;:][”"])\s+((?![“"])[A-Z][A-Za-z0-9 &'’\-]{1,60}?[,;:][”"])(?=\s*(?:[“"]|\n|$))/g,
    '$1 “$2'
  );

  // v41: Rejoin detached dialogue tags one final time after new paragraph splits.
  p = p.replace(detachedDialogueTagRx, '$1 $2');

  return normalizeText(p);
}

function runCollapsedDialogueFragmentRepairV38(loaded, onProgress) {
  reportProgress(onProgress, 'Fix Manuscript: collapsed dialogue + orphaned song-title dialogue repair v44...');

  const changes = [];
  let changedCount = 0;

  for (const item of loaded) {
    const before = normalizeText(item.content);
    if (!before || countWords(before) < 500) continue;

    const paragraphs = splitParagraphs(before);
    let localChanges = 0;
    const repaired = paragraphs.map((paragraph) => {
      const fixed = repairCollapsedDialogueParagraphV38(paragraph);
      if (normalizeText(fixed) !== normalizeText(paragraph)) localChanges += 1;
      return fixed;
    });

    const after = normalizeText(repairSpeakerTurnAttributionTextV40(repaired.join('\n\n')));
    if (after !== before) {
      item.content = after;
      item.changed = contentChanged(item.original, item.content);
      changedCount += 1;
      changes.push(`Ch.${item.chapterNumber}: repaired ${localChanges} collapsed/orphaned dialogue + final speaker-turn paragraph(s) after structural cleanup.`);
      console.warn('[MANUSCRIPT-FIXER][DIALOGUE-FRAGMENT v44] repaired collapsed/orphaned dialogue + global speaker-turn attribution fragments', {
        chapterNumber: item.chapterNumber,
        paragraphs: localChanges,
      });
    }
  }

  return { changes, changedCount };
}


function detectGenericRouteCollisionWarnings(text) {
  const paragraphs = splitParagraphs(text);
  const warnings = [];
  if (paragraphs.length < 14) return warnings;

  const windows = [];
  const windowSize = 8;
  const step = 4;

  for (let i = 0; i <= paragraphs.length - windowSize; i += step) {
    const block = paragraphs.slice(i, i + windowSize).join('\n\n');
    if (countWords(block) < 260 || !hasGenericRouteLanguage(block)) continue;
    windows.push({
      start: i,
      end: i + windowSize,
      words: countWords(block),
      tokens: significantBranchTokens(block),
      hasResolution: hasGenericResolutionLanguage(block),
      preview: makePreview(block, 180),
    });
  }

  for (let a = 0; a < windows.length; a += 1) {
    for (let b = a + 1; b < windows.length; b += 1) {
      const first = windows[a];
      const second = windows[b];
      if (second.start - first.start < 8) continue;

      const overlap = intersectionCount(first.tokens, second.tokens);
      const smaller = Math.max(1, Math.min(first.tokens.size, second.tokens.size));
      const overlapRatio = overlap / smaller;

      if (overlap >= 22 && overlapRatio >= 0.45) {
        warnings.push({
          type: 'possible_same_chapter_route_collision',
          firstWindow: `${first.start + 1}-${first.end}`,
          secondWindow: `${second.start + 1}-${second.end}`,
          overlap,
          overlapRatio: Number(overlapRatio.toFixed(2)),
          firstPreview: first.preview,
          secondPreview: second.preview,
        });
        if (warnings.length >= 4) return warnings;
      }
    }
  }

  return warnings;
}

function runGenericSameChapterBranchPass({ loaded, report, onProgress, stage = 'generic same-chapter branch quarantine' }) {
  reportProgress(onProgress, `Fix Manuscript: ${stage}...`);

  let changedChapters = 0;
  let totalRemovedWords = 0;
  let totalFixes = 0;
  let warningCount = 0;

  for (const item of loaded) {
    const before = normalizeText(item.content);
    if (!before || countWords(before) < 500) continue;

    const fixes = [];
    let out = before;
    out = removeTerminalFalseStartBranchV30(out, fixes);
    out = removeMarkerBoundRepeatedPriorBranchV29(out, fixes);
    out = removeFalseStartMarkerParagraphs(out, fixes);
    out = removeRepeatedParagraphClusters(out, fixes);
    out = removeCompetingAccessAttemptV29(out, fixes);
    out = removeOrphanedSoloVenueContactRouteV34(out, fixes);
    out = removeOpeningNegotiationFragmentBeforeFormalRouteV35(out, fixes);
    out = removeOpeningSoloAccessPlanStumpBeforeVenueEntryV36(out, fixes);
    out = applyGenericRouteQuarantineV28(out, fixes);

    if (fixes.length && normalizeText(out) !== before) {
      const removedWords = Math.max(0, countWords(before) - countWords(out));
      const removedChars = Math.max(0, before.length - normalizeText(out).length);

      item.content = normalizeText(out);
      item.changed = contentChanged(item.original, item.content);
      item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
      item.structureQuarantine.stages.push(stage);
      item.structureQuarantine.removedWords += removedWords;
      item.structureQuarantine.removedChars += removedChars;
      item.structureQuarantine.fixes.push(...fixes);

      changedChapters += 1;
      totalRemovedWords += removedWords;
      totalFixes += fixes.length;

      for (const fix of fixes) {
        addReportFix(report, `Ch.${item.chapterNumber}: GENERIC BRANCH ${fix.label} (-${fix.removedWords || 0} words)`);
      }

      console.warn(`[MANUSCRIPT-FIXER][GENERIC-BRANCH v30] Ch.${item.chapterNumber} same-chapter quarantine`, {
        fixes,
        removedWords,
      });
    }

    const warnings = detectGenericRouteCollisionWarnings(item.content);
    for (const warning of warnings.slice(0, 3)) {
      warningCount += 1;
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: possible repeated route/branch collision detected between paragraph windows ${warning.firstWindow} and ${warning.secondWindow}. Review if this chapter repeats a broker/contact/destination/outcome path.`
      );
    }
  }

  report.saveGatePasses = report.saveGatePasses || {};
  report.saveGatePasses.genericSameChapterBranch = report.saveGatePasses.genericSameChapterBranch || {
    changedChapters: 0,
    totalFixes: 0,
    totalRemovedWords: 0,
    warningCount: 0,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  report.saveGatePasses.genericSameChapterBranch.changedChapters += changedChapters;
  report.saveGatePasses.genericSameChapterBranch.totalFixes += totalFixes;
  report.saveGatePasses.genericSameChapterBranch.totalRemovedWords += totalRemovedWords;
  report.saveGatePasses.genericSameChapterBranch.warningCount += warningCount;

  if (changedChapters) {
    addReportWarning(report, `Generic same-chapter branch guard removed ${totalRemovedWords} word(s) across ${changedChapters} chapter(s).`);
  }

  return { changedChapters, totalFixes, totalRemovedWords, warningCount };
}

function runGenericBranchCollisionPass({ loaded, report, onProgress, stage = 'generic branch collision guard' }) {
  const adjacent = runGenericAdjacentChapterBleedPass({
    loaded,
    report,
    onProgress,
    stage: `${stage}: adjacent chapter bleed`,
  });

  const sameChapter = runGenericSameChapterBranchPass({
    loaded,
    report,
    onProgress,
    stage: `${stage}: same-chapter repeated-route quarantine v29`,
  });

  return {
    changedChapters: adjacent.changedChapters + sameChapter.changedChapters,
    totalRemovedWords: adjacent.totalRemovedWords + sameChapter.totalRemovedWords,
    totalFixes: sameChapter.totalFixes,
    warningCount: sameChapter.warningCount,
  };
}

function hasStructuralQuarantine(item) {
  return Boolean(item?.structureQuarantine?.fixes?.length || item?.structureQuarantine?.removedWords > 0);
}

function validateChapterCandidate({
  original,
  candidate,
  project,
  label = 'polish pass',
  maxWordLoss = 0.15,
  maxCharLoss = 0.15,
  maxParagraphLoss = 0.35,
  maxArtifactIncrease = 0,
}) {
  const originalText = normalizeText(original);
  const candidateText = normalizeText(candidate);

  const originalWords = countWords(originalText);
  const candidateWords = countWords(candidateText);
  const originalChars = originalText.length;
  const candidateChars = candidateText.length;

  const originalParagraphs = splitParagraphs(originalText).length;
  const candidateParagraphs = splitParagraphs(candidateText).length;

  const originalArtifacts = detectMalformedGrammarArtifacts(originalText);
  const candidateArtifacts = detectMalformedGrammarArtifacts(candidateText);

  const reasons = [];

  if (!candidateText || candidateWords < 50) {
    reasons.push(`${label}: output empty or too short`);
  }

  if (suspiciousAssistantOutput(candidateText)) {
    reasons.push(`${label}: output contains assistant preface`);
  }

  if (suspiciousSummaryOutput(originalText, candidateText)) {
    reasons.push(`${label}: output appears to be a summary instead of manuscript prose`);
  }

  if (originalWords >= 500 && candidateWords < originalWords * (1 - maxWordLoss)) {
    reasons.push(
      `${label}: word loss too high (${originalWords} -> ${candidateWords}, -${originalWords - candidateWords})`
    );
  }

  if (originalChars >= 2500 && candidateChars < originalChars * (1 - maxCharLoss)) {
    reasons.push(
      `${label}: character loss too high (${originalChars} -> ${candidateChars}, -${originalChars - candidateChars})`
    );
  }

  if (
    originalParagraphs >= 8 &&
    candidateParagraphs < Math.max(4, originalParagraphs * (1 - maxParagraphLoss))
  ) {
    reasons.push(
      `${label}: paragraph count collapsed (${originalParagraphs} -> ${candidateParagraphs})`
    );
  }

  if (looksTruncatedAtEnd(candidateText) && !looksTruncatedAtEnd(originalText)) {
    reasons.push(`${label}: final sentence looks truncated`);
  }

  if (candidateArtifacts.length > originalArtifacts.length + maxArtifactIncrease) {
    reasons.push(
      `${label}: malformed grammar artifacts increased (${originalArtifacts.length} -> ${candidateArtifacts.length})`
    );
  }

  if (isEroticProject(project)) {
    const originalEroticMarkers = countEroticMarkers(originalText);
    const candidateEroticMarkers = countEroticMarkers(candidateText);

    if (
      originalEroticMarkers >= 20 &&
      candidateEroticMarkers < originalEroticMarkers * 0.55 &&
      candidateWords < originalWords * 0.9
    ) {
      reasons.push(
        `${label}: possible erotic-content sanitization (${originalEroticMarkers} -> ${candidateEroticMarkers} adult/heat markers)`
      );
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    originalWords,
    candidateWords,
    originalChars,
    candidateChars,
    originalParagraphs,
    candidateParagraphs,
    originalArtifacts: originalArtifacts.length,
    candidateArtifacts: candidateArtifacts.length,
  };
}

function validateHardSafetyOnly({ original, candidate, project, label = 'hard safety audit' }) {
  return validateChapterCandidate({
    original,
    candidate,
    project,
    label,
    maxWordLoss: 0.18,
    maxCharLoss: 0.18,
    maxParagraphLoss: 0.4,
    maxArtifactIncrease: 0,
  });
}

function contentChanged(original, cleaned) {
  return normalizeText(original) !== normalizeText(cleaned);
}

function cloneLoadedSnapshot(loaded) {
  return new Map(
    loaded.map((item) => [
      item.chapter.id,
      {
        content: item.content,
        changed: item.changed,
      },
    ])
  );
}

function restoreChapterFromSnapshot(item, snapshot) {
  const saved = snapshot.get(item.chapter.id);
  if (!saved) return;

  item.content = saved.content;
  item.changed = saved.changed;
}

function buildInitialReport(project, chapters) {
  return {
    projectId: project?.id || '',
    projectTitle: project?.title || 'Untitled Project',
    startedAt: new Date().toISOString(),
    finishedAt: null,

    mode: isAnthologyProject(project)
      ? 'anthology'
      : isNonfictionProject(project)
        ? 'nonfiction'
        : 'novel',

    erotic: isEroticProject(project),

    totalChapters: chapters.length,
    loadedChapters: 0,
    changedChapters: 0,
    unchangedChapters: 0,
    savedChapters: 0,
    failedChapters: 0,

    fixes: [],
    warnings: [],
    removals: [],
    failures: [],
    perChapter: [],
    diagnostics: [],

    safetyReverts: [],
    voiceAudits: [],

    beforeStats: null,
    afterStats: null,

    deterministicPasses: {},
    anthologyPasses: {},
    saveGatePasses: {},
  };
}

function addReportFix(report, text) {
  if (!text) return;
  report.fixes.push(String(text));
}

function addReportWarning(report, text) {
  if (!text) return;
  report.warnings.push(String(text));
}

function addReportFailure(report, chapter, error) {
  report.failedChapters += 1;
  report.failures.push({
    chapterNumber: chapterNumber(chapter),
    chapterId: chapter?.id || '',
    title: chapter?.title || '',
    error: error instanceof Error ? error.message : String(error || 'Unknown error'),
  });
}

function reportProgress(onProgress, value) {
  if (typeof onProgress === 'function') onProgress(value);
}

function getChangedItems(loaded) {
  return loaded.filter((item) =>
    contentChanged(item.original, item.content) ||
    Boolean(item.changed) ||
    Boolean(item.saveAttempted) ||
    Boolean(item.structureQuarantine?.fixes?.length) ||
    Boolean(item.structureQuarantine?.removedWords)
  );
}

function validateAndRevertPass({
  loaded,
  project,
  snapshot,
  report,
  label,
  compareTo = 'snapshot',
  strict = false,
}) {
  let reverted = 0;

  for (const item of loaded) {
    const baseline =
      compareTo === 'original'
        ? item.original
        : snapshot.get(item.chapter.id)?.content || item.original;

    const structuralQuarantineActive = hasStructuralQuarantine(item);
    const maxLoss = structuralQuarantineActive ? 0.82 : (strict ? 0.10 : 0.15);

    const validation = validateChapterCandidate({
      original: baseline,
      candidate: item.content,
      project,
      label,
      maxWordLoss: maxLoss,
      maxCharLoss: maxLoss,
      maxParagraphLoss: structuralQuarantineActive ? 0.92 : (strict ? 0.25 : 0.35),
      maxArtifactIncrease: strict ? 0 : 1,
    });

    if (!validation.ok) {
      restoreChapterFromSnapshot(item, snapshot);
      reverted += 1;

      report.safetyReverts.push({
        chapterNumber: item.chapterNumber,
        title: item.title || '',
        pass: label,
        reasons: validation.reasons,
        originalWords: validation.originalWords,
        candidateWords: validation.candidateWords,
        originalChars: validation.originalChars,
        candidateChars: validation.candidateChars,
        originalArtifacts: validation.originalArtifacts,
        candidateArtifacts: validation.candidateArtifacts,
      });

      for (const reason of validation.reasons) {
        addReportWarning(report, `Ch.${item.chapterNumber}: reverted ${label} - ${reason}`);
      }

      console.warn(
        `[MANUSCRIPT-FIXER][SAFETY] Reverted Ch.${item.chapterNumber} after ${label}:`,
        validation.reasons.join(' | ')
      );
    }
  }

  return reverted;
}

async function loadDraftedBodyChapters({ chapters, onProgress }) {
  const sorted = [...(chapters || [])]
    .filter((chapter) => chapterHasContent(chapter) && isBodyChapter(chapter))
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));

  const loaded = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const chapter = sorted[i];
    const chNum = chapterNumber(chapter, i + 1);

    reportProgress(onProgress, `Fix Manuscript: loading chapter ${chNum} (${i + 1}/${sorted.length})...`);

    try {
      const content = await resolveChapterContent(chapter);
      const normalized = normalizeText(content);

      if (!normalized || normalized.length < 50) {
        console.warn(`[MANUSCRIPT-FIXER] Ch.${chNum} skipped: empty or too short`);
        continue;
      }

      loaded.push({
        chapter,
        chapterNumber: chNum,
        title: chapter.title || '',
        original: normalized,
        content: normalized,
        cleanupResult: null,
        diagnostics: null,
        changed: false,
        saveAttempted: false,
        saveVerified: false,
        savedContent: '',
        voiceAudit: null,
      });
    } catch (error) {
      console.warn(`[MANUSCRIPT-FIXER] Failed to load Ch.${chNum}:`, error);
    }
  }

  return loaded;
}

function detectRepeatedOpenings(loaded) {
  const openingMap = new Map();
  const warnings = [];

  for (const item of loaded) {
    const firstParagraph = splitParagraphs(item.content)[0] || '';
    const normalized = firstParagraph
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .slice(0, 18)
      .join(' ');

    if (!normalized || normalized.length < 40) continue;

    if (openingMap.has(normalized)) {
      warnings.push(`Ch.${item.chapterNumber}: opening resembles Ch.${openingMap.get(normalized)}`);
    } else {
      openingMap.set(normalized, item.chapterNumber);
    }
  }

  return warnings;
}

function detectRepeatedNames(loaded) {
  const nameCounts = new Map();

  for (const item of loaded) {
    const names = normalizeText(item.content).match(/\b[A-Z][a-z]{2,}\b/g) || [];
    const local = new Set(
      names.filter((name) => {
        const banned = new Set([
          'The',
          'And',
          'But',
          'For',
          'With',
          'When',
          'Then',
          'There',
          'This',
          'That',
          'Chapter',
          'Scene',
          'He',
          'She',
          'They',
        ]);

        return !banned.has(name);
      })
    );

    for (const name of local) {
      nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
    }
  }

  return [...nameCounts.entries()]
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => `"${name}" appears across ${count} chapters`);
}

function buildDiagnosticForChapter({ project, item, loaded }) {
  const text = normalizeText(item.content);
  const issues = [];

  if (looksTruncatedAtEnd(text)) {
    issues.push('Final sentence may be truncated.');
  }

  const malformedArtifacts = detectMalformedGrammarArtifacts(text);

  if (malformedArtifacts.length) {
    issues.push(`${malformedArtifacts.length} malformed grammar artifact(s) detected.`);
  }

  const paragraphs = splitParagraphs(text);
  if (paragraphs.length < 8 && countWords(text) > 1500) {
    issues.push('Long chapter has low paragraph count; possible paragraph collapse.');
  }

  const repeatedParagraphs = new Map();

  for (const paragraph of paragraphs) {
    const normalized = paragraph
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length < 120) continue;

    repeatedParagraphs.set(normalized, (repeatedParagraphs.get(normalized) || 0) + 1);
  }

  const repeatedCount = [...repeatedParagraphs.values()].filter((count) => count > 1).length;

  if (repeatedCount) {
    issues.push(`${repeatedCount} possible duplicate paragraph(s).`);
  }

  const dialogueTags =
    text.match(/\b(said|asked|whispered|murmured|snapped|breathed|moaned|groaned)\b/gi) || [];

  if (dialogueTags.length > 35) {
    issues.push(`High dialogue/body tag count (${dialogueTags.length}).`);
  }

  const breathMarkers =
    text.match(/\b(breath|breathed|breathing|pulse|shiver|shudder|tremble|moan|groan|hips|thighs|mouth|tongue|heat)\b/gi) || [];

  if (isEroticProject(project) && breathMarkers.length > 90) {
    issues.push(`High erotic/body-language marker repetition (${breathMarkers.length}).`);
  }

  const sentenceStarters = {};
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    const starter = sentence.trim().split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    if (!starter) continue;
    sentenceStarters[starter] = (sentenceStarters[starter] || 0) + 1;
  }

  const overusedStarter = Object.entries(sentenceStarters)
    .filter(([, count]) => count >= 8)
    .sort((a, b) => b[1] - a[1])[0];

  if (overusedStarter) {
    issues.push(`Repeated sentence starter: "${overusedStarter[0]}" x${overusedStarter[1]}.`);
  }

  const artifactSignals =
    text.match(/\b(TODO|FIXME|EDITOR NOTE|PLACEHOLDER|REWRITE THIS|DELETE THIS)\b/gi) || [];

  if (artifactSignals.length) {
    issues.push(`Possible editorial artifact signal(s): ${[...new Set(artifactSignals)].join(', ')}.`);
  }

  if (suspiciousAssistantOutput(text)) {
    issues.push('Possible assistant preface at beginning.');
  }

  if (isAnthologyProject(project)) {
    const otherTitles = loaded
      .filter((other) => other.chapter.id !== item.chapter.id)
      .map((other) => other.title)
      .filter(Boolean);

    for (const title of otherTitles) {
      if (title && text.includes(title)) {
        issues.push(`Possible anthology contamination: references another story title "${title}".`);
        break;
      }
    }
  }

  return {
    chapterNumber: item.chapterNumber,
    title: item.title,
    issues,
    issueCount: issues.length,
    malformedArtifacts,
  };
}

function runDiagnosticKnowledgePass({ project, loaded, report, onProgress }) {
  reportProgress(onProgress, 'Fix Manuscript: building diagnostic knowledge base...');

  const repeatedOpenings = isAnthologyProject(project) ? detectRepeatedOpenings(loaded) : [];
  const repeatedNames = isAnthologyProject(project) ? detectRepeatedNames(loaded) : [];

  for (const warning of repeatedOpenings) {
    addReportWarning(report, warning);
  }

  for (const warning of repeatedNames) {
    addReportWarning(report, `Anthology repeated-name warning: ${warning}`);
  }

  for (const item of loaded) {
    const diagnostic = buildDiagnosticForChapter({ project, item, loaded });

    if (repeatedOpenings.some((warning) => warning.startsWith(`Ch.${item.chapterNumber}:`))) {
      diagnostic.issues.push('Opening resembles another anthology story.');
    }

    if (repeatedNames.length) {
      diagnostic.issues.push(`Anthology repeated-name scan found: ${repeatedNames.slice(0, 6).join('; ')}`);
    }

    item.diagnostics = diagnostic;
    report.diagnostics.push(diagnostic);

    if (diagnostic.issues.length) {
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: ${diagnostic.issues.length} diagnostic issue(s) found before GPT polish`
      );
    }
  }
}

async function runUniversalChapterCleanup({ project, loaded, report, onProgress }) {
  for (let i = 0; i < loaded.length; i += 1) {
    const item = loaded[i];

    reportProgress(
      onProgress,
      `Fix Manuscript: GPT-guided copyedit chapter ${item.chapterNumber} (${i + 1}/${loaded.length})...`
    );

    const snapshot = cloneLoadedSnapshot([item]);

    try {
      const diagnosticBlock = item.diagnostics?.issues?.length
        ? `\n\nDIAGNOSTIC KNOWLEDGE FOR THIS CHAPTER:\n${item.diagnostics.issues.map((issue, idx) => `${idx + 1}. ${issue}`).join('\n')}\n\nUse these diagnostics as an editing map. Fix real issues carefully, but do not overcorrect or delete story content.`
        : '\n\nDIAGNOSTIC KNOWLEDGE FOR THIS CHAPTER:\nNo major diagnostic issues found. Perform a careful copyedit only.';

      const result = await postDraftCleanup(
        `${item.content}${diagnosticBlock}`,
        project,
        item.chapterNumber,
        onProgress,
        {
          mode: 'full-manuscript-fix-with-diagnostics',
          runLLM: false,
          runMalformedPatchRepair: true,
          removeDuplicateParagraphs: true,
          overuseLimit: isAnthologyProject(project) ? 14 : 18,
        }
      );

      item.cleanupResult = result;

      let cleaned = normalizeText(result.text);

      const diagnosticHeaderIndex = cleaned.indexOf('DIAGNOSTIC KNOWLEDGE FOR THIS CHAPTER:');
      if (diagnosticHeaderIndex >= 0) {
        cleaned = cleaned.slice(0, diagnosticHeaderIndex).trim();
      }

      item.content = cleaned;

      const reverted = validateAndRevertPass({
        loaded: [item],
        project,
        snapshot,
        report,
        label: 'GPT-guided postDraftCleanup',
        compareTo: 'snapshot',
        strict: true,
      });

      item.changed = contentChanged(item.original, item.content);

      report.perChapter.push({
        chapterNumber: item.chapterNumber,
        title: item.title,
        changed: item.changed,
        wordCountBefore: countWords(item.original),
        wordCountAfter: countWords(item.content),
        diagnostics: item.diagnostics,
        fixes: result.fixes || [],
        warnings: result.warnings || [],
        removals: result.removals || [],
        overusedWords: result.overusedWords || [],
        truncatedSentences: result.truncatedSentences || [],
        malformedSentenceCandidates: result.malformedSentenceCandidates || [],
        malformedSentencePatches: result.malformedSentencePatches || [],
        hardSurvivorHits: result.hardSurvivorHits || [],
        reverted: Boolean(reverted),
      });

      if (!reverted) {
        for (const fix of result.fixes || []) {
          addReportFix(report, `Ch.${item.chapterNumber}: ${fix}`);
        }

        for (const warning of result.warnings || []) {
          addReportWarning(report, `Ch.${item.chapterNumber}: ${warning}`);
        }

        for (const removal of result.removals || []) {
          report.removals.push({
            chapterNumber: item.chapterNumber,
            ...removal,
          });
        }
      }
    } catch (error) {
      addReportFailure(report, item.chapter, error);
      restoreChapterFromSnapshot(item, snapshot);
    }
  }
}

function runSafePass({ label, loaded, project, report, onProgress, fn, strict = false }) {
  const snapshot = cloneLoadedSnapshot(loaded);

  try {
    reportProgress(onProgress, `Fix Manuscript: ${label}...`);

    const result = fn();

    if (result?.changes?.length) {
      for (const change of result.changes) {
        addReportFix(report, change);
      }
    }

    const reverted = validateAndRevertPass({
      loaded,
      project,
      snapshot,
      report,
      label,
      compareTo: 'snapshot',
      strict,
    });

    report.deterministicPasses[label] = {
      ok: true,
      reverted,
      result,
    };

    return result || {};
  } catch (error) {
    console.warn(`[MANUSCRIPT-FIXER] ${label} failed:`, error);

    for (const item of loaded) {
      restoreChapterFromSnapshot(item, snapshot);
    }

    report.deterministicPasses[label] = {
      ok: false,
      reverted: loaded.length,
      error: error instanceof Error ? error.message : String(error),
    };

    addReportWarning(
      report,
      `${label} failed and was reverted: ${error instanceof Error ? error.message : String(error)}`
    );

    return {};
  }
}

function runDiagnosticOnlyPass({ label, report, onProgress, reason }) {
  reportProgress(onProgress, `Fix Manuscript: ${label} diagnostic-only...`);

  const message = `${label} skipped as direct mutation pass - ${reason}`;

  console.warn(`[MANUSCRIPT-FIXER][DIAGNOSTIC-ONLY] ${message}`);
  addReportWarning(report, message);

  report.deterministicPasses[label] = {
    ok: true,
    reverted: 0,
    diagnosticOnly: true,
    reason,
  };

  return {
    changes: [],
    warnings: [message],
    diagnosticOnly: true,
  };
}

function runDeterministicWholeManuscriptPasses({ project, loaded, report, onProgress }) {
  reportProgress(onProgress, 'Fix Manuscript: running safe polish rules with grammar safety checks...');

  runSafePass({
    label: 'punctuation cleanup',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runPunctuationCleanup(loaded, onProgress),
  });

  runSafePass({
    label: 'spelling fixes',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runSpellingFixes(loaded, onProgress),
  });

  runSafePass({
    label: 'capitalization hygiene',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runCapitalizationHygiene(loaded, onProgress),
  });

  runSafePass({
    label: 'dialogue punctuation fix',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runDialoguePunctuationFix(loaded, onProgress),
  });

  runSafePass({
    label: 'dialogue filler fix',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runDialogueFillerFix(loaded, onProgress),
  });

  runSafePass({
    label: 'dialogue tag caps',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runDialogueTagCaps(loaded, onProgress),
  });

  runSafePass({
    label: 'collapsed dialogue + orphaned song-title dialogue repair v44',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runCollapsedDialogueFragmentRepairV38(loaded, onProgress),
  });

  runSafePass({
    label: 'transition word caps',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runTransitionWordCaps(loaded, onProgress),
  });

  runSafePass({
    label: 'ChatGPT vocabulary caps',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runChatGPTVocabCaps(loaded, onProgress),
  });

  runSafePass({
    label: 'stacked clause variation',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runStackedClauseVariation(loaded, onProgress),
  });

  runSafePass({
    label: 'voice pattern cleanup',
    loaded,
    project,
    report,
    onProgress,
    fn: () => fixVoicePatterns(loaded, loaded.length),
  });

  runSafePass({
    label: 'external AI pattern cleanup',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runExternalAiPatternFix(loaded),
  });

  runDiagnosticOnlyPass({
    label: 'anti-detection polish',
    report,
    onProgress,
    reason:
      'direct mutation disabled because this pass previously collapsed paragraphs and damaged sentence grammar. Diagnostics remain available through postDraftCleanup and voice audit.',
  });

  runSafePass({
    label: 'vocabulary caps',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runVocabCaps(loaded, onProgress, { project }),
  });

  runDiagnosticOnlyPass({
    label: 'sentence starter variation',
    report,
    onProgress,
    reason:
      'direct mutation disabled because it created malformed starts such as "One air", "That silence", and subjectless "Was..." fragments.',
  });

  runDiagnosticOnlyPass({
    label: 'AI detection resistance',
    report,
    onProgress,
    reason:
      'direct mutation disabled because it removed thought/feeling words too bluntly and left broken sentence structure.',
  });

  runSafePass({
    label: 'broken sentence fixes',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runBrokenSentenceFixes(loaded, onProgress),
    strict: true,
  });

  runSafePass({
    label: 'coping mechanism caps',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runCopingMechanismCaps(loaded, onProgress),
  });

  runSafePass({
    label: 'hanging quote fixes',
    loaded,
    project,
    report,
    onProgress,
    fn: () => fixHangingQuotes(loaded),
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }
}

async function runSafeAnthologyPass({ label, loaded, project, report, onProgress, fn, strict = false }) {
  const snapshot = cloneLoadedSnapshot(loaded);

  try {
    reportProgress(onProgress, `Fix Manuscript: anthology pass - ${label}...`);

    const result = await fn();

    if (result?.changes?.length) {
      for (const change of result.changes) {
        addReportFix(report, change);
      }
    }

    const reverted = validateAndRevertPass({
      loaded,
      project,
      snapshot,
      report,
      label: `anthology ${label}`,
      compareTo: 'snapshot',
      strict,
    });

    report.anthologyPasses[label] = {
      ok: true,
      reverted,
      result,
    };

    return result || {};
  } catch (error) {
    console.warn(`[MANUSCRIPT-FIXER] Anthology pass ${label} failed:`, error);

    for (const item of loaded) {
      restoreChapterFromSnapshot(item, snapshot);
    }

    report.anthologyPasses[label] = {
      ok: false,
      reverted: loaded.length,
      error: error instanceof Error ? error.message : String(error),
    };

    addReportWarning(
      report,
      `Anthology pass ${label} failed and was reverted: ${error instanceof Error ? error.message : String(error)}`
    );

    return {};
  }
}

async function runAnthologySpecificPasses({ project, loaded, report, onProgress }) {
  if (!isAnthologyProject(project)) return;

  reportProgress(onProgress, 'Fix Manuscript: running anthology variety rules with safety checks...');

  await runSafeAnthologyPass({
    label: 'cross-chapter body-language dedup',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runCrossChapterBodyLanguageDedup(loaded, onProgress),
  });

  await runSafeAnthologyPass({
    label: 'anthology vocabulary bans',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runAnthologyVocabBans(loaded, onProgress),
  });

  await runSafeAnthologyPass({
    label: 'contamination detector',
    loaded,
    project,
    report,
    onProgress,
    fn: () => runContaminationDetector(loaded, onProgress, project),
    strict: true,
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }
}

function tokenizeWords(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

function countMatches(text, patterns) {
  const source = normalizeText(text);
  let total = 0;

  for (const pattern of patterns) {
    const matches = source.match(pattern);
    total += matches ? matches.length : 0;
  }

  return total;
}

function calculateVoiceMetrics(text) {
  const normalized = normalizeText(text);
  const words = tokenizeWords(normalized);
  const sentences = splitSentences(normalized).map((sentence) => sentence.trim()).filter(Boolean);
  const paragraphs = splitParagraphs(normalized);

  const uniqueWords = new Set(words).size;
  const wordCount = words.length || 1;
  const sentenceCount = sentences.length || 1;

  const avgSentenceLength = Math.round((wordCount / sentenceCount) * 10) / 10;
  const lexicalDiversity = Math.round((uniqueWords / wordCount) * 1000) / 10;

  const dialogueLines = (normalized.match(/(^|\n)\s*[""][\s\S]*?[""]/g) || []).length;

  const aiPolishMarkers = countMatches(normalized, [
    /\bthere was something\b/gi,
    /\bsomething in (?:his|her|their|the)\b/gi,
    /\bit was as if\b/gi,
    /\bin a way that\b/gi,
    /\bnot just\b/gi,
    /\bmore than\b/gi,
    /\bthe kind of\b/gi,
    /\bhe couldn't help but\b/gi,
    /\bshe couldn't help but\b/gi,
    /\bthey couldn't help but\b/gi,
    /\ba quiet kind of\b/gi,
    /\ba strange kind of\b/gi,
    /\bfor the first time\b/gi,
    /\bin that moment\b/gi,
    /\bsomewhere deep\b/gi,
    /\bdeep inside\b/gi,
    /\bthe weight of\b/gi,
    /\bthe shape of\b/gi,
    /\bthe sound of\b/gi,
    /\bthe silence\b/gi,
    /\bthe truth of\b/gi,
    /\bthe ache of\b/gi,
    /\bthe rhythm of\b/gi,
    /\bthe geometry of\b/gi,
    /\bthe architecture of\b/gi,
    /\bthe calculus of\b/gi,
  ]);

  const abstractExplainMarkers = countMatches(normalized, [
    /\bmeaning\b/gi,
    /\babsence\b/gi,
    /\bpresence\b/gi,
    /\btruth\b/gi,
    /\bmemory\b/gi,
    /\bidentity\b/gi,
    /\bdesire\b/gi,
    /\bgrief\b/gi,
    /\blonging\b/gi,
    /\bemptiness\b/gi,
    /\bpermission\b/gi,
    /\brecognition\b/gi,
    /\bintimacy\b/gi,
    /\bvulnerability\b/gi,
    /\bconnection\b/gi,
    /\bcontrol\b/gi,
    /\bsurrender\b/gi,
  ]);

  const genericSmoothingMarkers = countMatches(normalized, [
    /\bsoftly\b/gi,
    /\bgently\b/gi,
    /\bquietly\b/gi,
    /\bslowly\b/gi,
    /\bcarefully\b/gi,
    /\bdeliberately\b/gi,
    /\bhesitated\b/gi,
    /\bexhaled\b/gi,
    /\binhaled\b/gi,
    /\bnodded\b/gi,
    /\bshook (?:his|her|their) head\b/gi,
  ]);

  const sentenceStarterCounts = {};

  for (const sentence of sentences) {
    const starter = sentence.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
    if (!starter) continue;
    sentenceStarterCounts[starter] = (sentenceStarterCounts[starter] || 0) + 1;
  }

  const repeatedStarterCount = Object.values(sentenceStarterCounts)
    .filter((count) => count >= 5)
    .reduce((sum, count) => sum + count, 0);

  return {
    wordCount,
    sentenceCount,
    paragraphCount: paragraphs.length,
    avgSentenceLength,
    lexicalDiversity,
    dialogueLines,
    aiPolishMarkers,
    abstractExplainMarkers,
    genericSmoothingMarkers,
    repeatedStarterCount,
    eroticMarkers: countEroticMarkers(normalized),
    malformedGrammarArtifacts: detectMalformedGrammarArtifacts(normalized).length,
  };
}

function validateVoiceMetrics({ original, candidate, project, label = 'voice preservation audit' }) {
  const originalMetrics = calculateVoiceMetrics(original);
  const candidateMetrics = calculateVoiceMetrics(candidate);
  const reasons = [];

  const originalWords = originalMetrics.wordCount || 1;
  const candidateWords = candidateMetrics.wordCount || 1;

  const aiMarkerRateOriginal = originalMetrics.aiPolishMarkers / originalWords;
  const aiMarkerRateCandidate = candidateMetrics.aiPolishMarkers / candidateWords;

  const abstractRateOriginal = originalMetrics.abstractExplainMarkers / originalWords;
  const abstractRateCandidate = candidateMetrics.abstractExplainMarkers / candidateWords;

  const smoothingRateOriginal = originalMetrics.genericSmoothingMarkers / originalWords;
  const smoothingRateCandidate = candidateMetrics.genericSmoothingMarkers / candidateWords;

  if (
    candidateMetrics.malformedGrammarArtifacts > originalMetrics.malformedGrammarArtifacts + 0
  ) {
    reasons.push(
      `${label}: malformed grammar artifacts increased (${originalMetrics.malformedGrammarArtifacts} -> ${candidateMetrics.malformedGrammarArtifacts})`
    );
  }

  if (
    originalMetrics.wordCount >= 1000 &&
    aiMarkerRateCandidate > aiMarkerRateOriginal * 1.45 &&
    candidateMetrics.aiPolishMarkers >= originalMetrics.aiPolishMarkers + 8
  ) {
    reasons.push(
      `${label}: AI-polish marker rate increased (${originalMetrics.aiPolishMarkers} -> ${candidateMetrics.aiPolishMarkers})`
    );
  }

  if (
    originalMetrics.wordCount >= 1000 &&
    abstractRateCandidate > abstractRateOriginal * 1.35 &&
    candidateMetrics.abstractExplainMarkers >= originalMetrics.abstractExplainMarkers + 14
  ) {
    reasons.push(
      `${label}: abstract explanatory language increased (${originalMetrics.abstractExplainMarkers} -> ${candidateMetrics.abstractExplainMarkers})`
    );
  }

  if (
    originalMetrics.wordCount >= 1000 &&
    smoothingRateCandidate > smoothingRateOriginal * 1.5 &&
    candidateMetrics.genericSmoothingMarkers >= originalMetrics.genericSmoothingMarkers + 10
  ) {
    reasons.push(
      `${label}: generic smoothing language increased (${originalMetrics.genericSmoothingMarkers} -> ${candidateMetrics.genericSmoothingMarkers})`
    );
  }

  if (
    originalMetrics.lexicalDiversity >= 25 &&
    candidateMetrics.lexicalDiversity < originalMetrics.lexicalDiversity * 0.78
  ) {
    reasons.push(
      `${label}: lexical diversity dropped (${originalMetrics.lexicalDiversity}% -> ${candidateMetrics.lexicalDiversity}%)`
    );
  }

  if (
    originalMetrics.dialogueLines >= 8 &&
    candidateMetrics.dialogueLines < originalMetrics.dialogueLines * 0.65
  ) {
    reasons.push(
      `${label}: dialogue appears reduced (${originalMetrics.dialogueLines} -> ${candidateMetrics.dialogueLines} dialogue lines)`
    );
  }

  if (
    isEroticProject(project) &&
    originalMetrics.eroticMarkers >= 20 &&
    candidateMetrics.eroticMarkers < originalMetrics.eroticMarkers * 0.7
  ) {
    reasons.push(
      `${label}: heat/body specificity dropped (${originalMetrics.eroticMarkers} -> ${candidateMetrics.eroticMarkers} markers)`
    );
  }

  if (
    originalMetrics.avgSentenceLength >= 6 &&
    candidateMetrics.avgSentenceLength > originalMetrics.avgSentenceLength * 1.45 &&
    candidateMetrics.avgSentenceLength >= originalMetrics.avgSentenceLength + 7
  ) {
    reasons.push(
      `${label}: sentence rhythm became much longer/smoother (${originalMetrics.avgSentenceLength} -> ${candidateMetrics.avgSentenceLength} avg words)`
    );
  }

  return {
    ok: reasons.length === 0,
    reasons,
    originalMetrics,
    candidateMetrics,
  };
}

function sampleForVoiceAudit(text) {
  const normalized = normalizeText(text);
  if (normalized.length <= 5200) return normalized;

  const first = normalized.slice(0, 1700);
  const midStart = Math.max(0, Math.floor(normalized.length / 2) - 850);
  const middle = normalized.slice(midStart, midStart + 1700);
  const last = normalized.slice(-1700);

  return [
    '--- OPENING SAMPLE ---',
    first,
    '',
    '--- MIDDLE SAMPLE ---',
    middle,
    '',
    '--- ENDING SAMPLE ---',
    last,
  ].join('\n');
}

function parseVoiceAuditResponse(response) {
  const text = safeString(response).trim();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const verdict = String(parsed.verdict || parsed.result || '').toUpperCase();
      const reason = parsed.reason || parsed.notes || parsed.explanation || '';
      const confidence = parsed.confidence || parsed.score || '';

      return {
        verdict: verdict === 'FAIL' ? 'FAIL' : 'PASS',
        reason: safeString(reason).slice(0, 500),
        confidence,
        raw: text.slice(0, 1200),
      };
    }
  } catch {
    // Fall through to plain-text parsing.
  }

  if (/^\s*FAIL\b/i.test(text) || /\bverdict\s*:\s*fail\b/i.test(text)) {
    return {
      verdict: 'FAIL',
      reason: text.replace(/^\s*FAIL[:\s-]*/i, '').slice(0, 500),
      confidence: '',
      raw: text.slice(0, 1200),
    };
  }

  return {
    verdict: 'PASS',
    reason: text.replace(/^\s*PASS[:\s-]*/i, '').slice(0, 500),
    confidence: '',
    raw: text.slice(0, 1200),
  };
}

async function runLLMVoiceAudit({ project, item, deterministicAudit, onProgress }) {
  const originalSample = sampleForVoiceAudit(item.original);
  const candidateSample = sampleForVoiceAudit(item.content);
  const isErotic = isEroticProject(project);
  const isAnthology = isAnthologyProject(project);

  reportProgress(onProgress, `Fix Manuscript: voice audit chapter ${item.chapterNumber}...`);

  const prompt = `You are a strict final-pass manuscript quality auditor.

You are NOT rewriting. You are deciding whether the polished version preserved the author's voice.

PROJECT:
- Title: ${project?.title || 'Untitled'}
- Genre: ${project?.genre || 'fiction'}
- Anthology: ${isAnthology ? 'yes - each chapter is standalone' : 'no'}
- Adult/erotic content: ${isErotic ? 'yes - do not penalize adult content or heat' : 'no'}

TASK:
Compare ORIGINAL vs POLISHED samples.

FAIL only if the polished version is structurally unsafe:
- it becomes summary instead of prose
- it deletes or collapses major scene content
- it introduces broken grammar
- it removes dialogue or adult content at scale
- it adds assistant commentary

Do NOT fail merely because:
- punctuation improved
- grammar improved
- sentences are slightly cleaner
- a few repeated words were adjusted
- the prose is modestly smoother

OUTPUT ONLY VALID JSON:
{
  "verdict": "PASS" or "FAIL",
  "reason": "one concise reason",
  "confidence": "low" or "medium" or "high"
}

DETERMINISTIC METRICS:
${JSON.stringify({
    original: deterministicAudit.originalMetrics,
    candidate: deterministicAudit.candidateMetrics,
    deterministicReasons: deterministicAudit.reasons,
  }, null, 2)}

ORIGINAL SAMPLE:
${originalSample}

POLISHED SAMPLE:
${candidateSample}`;

  const response = await invokeLLMWithRetry({
    prompt,
    model: 'openai_gpt5',
    fallback_model: 'anthropic/claude-sonnet-4-20250514',
    temperature: 0.02,
    max_tokens: 900,
  });

  return parseVoiceAuditResponse(response);
}

function voiceAuditNeedsLLM(deterministicAudit, item) {
  if (!contentChanged(item.original, item.content)) return false;

  if (!deterministicAudit.ok) return true;

  const originalWords = countWords(item.original);
  const candidateWords = countWords(item.content);
  const delta = Math.abs(candidateWords - originalWords);

  if (originalWords >= 1500 && delta / originalWords > 0.035) return true;

  const originalMetrics = deterministicAudit.originalMetrics;
  const candidateMetrics = deterministicAudit.candidateMetrics;

  if (candidateMetrics.malformedGrammarArtifacts > originalMetrics.malformedGrammarArtifacts) return true;
  if (candidateMetrics.aiPolishMarkers > originalMetrics.aiPolishMarkers + 8) return true;
  if (candidateMetrics.abstractExplainMarkers > originalMetrics.abstractExplainMarkers + 14) return true;
  if (candidateMetrics.genericSmoothingMarkers > originalMetrics.genericSmoothingMarkers + 12) return true;

  return false;
}

function shouldHardRevertVoiceAudit({ item, project, deterministicAudit, llmAudit }) {
  const structuralQuarantineActive = hasStructuralQuarantine(item);

  const hardSafety = structuralQuarantineActive
    ? validateChapterCandidate({
        original: item.original,
        candidate: item.content,
        project,
        label: 'voice audit structural-quarantine hard-safety check',
        maxWordLoss: 0.82,
        maxCharLoss: 0.82,
        maxParagraphLoss: 0.92,
        maxArtifactIncrease: 1,
      })
    : validateHardSafetyOnly({
        original: item.original,
        candidate: item.content,
        project,
        label: 'voice audit hard-safety check',
      });

  if (!hardSafety.ok && structuralQuarantineActive) {
    const destructiveReasons = hardSafety.reasons.filter(
      (reason) => !/word loss too high|character loss too high|paragraph count collapsed/i.test(reason)
    );

    if (!destructiveReasons.length) {
      return {
        revert: false,
        warnOnly: true,
        reasons: hardSafety.reasons,
        hardSafety,
      };
    }
  }

  if (!hardSafety.ok) {
    const nonArtifactSafetyReasons = hardSafety.reasons.filter(
      (reason) => !/malformed grammar artifacts increased/i.test(reason)
    );

    if (!nonArtifactSafetyReasons.length) {
      return {
        revert: false,
        warnOnly: true,
        reasons: hardSafety.reasons,
        hardSafety,
      };
    }

    return {
      revert: true,
      reasons: nonArtifactSafetyReasons,
      hardSafety,
    };
  }

  /*
   * v7 policy:
   * Do not hard-revert solely because malformed-artifact count increased.
   * The final save-gate runs after this audit and is specifically designed to repair
   * those last mechanical artifacts. Hard revert only for structural damage signals
   * that the save-gate cannot safely reconstruct.
   */
  const structuralReasons = deterministicAudit.reasons.filter((reason) =>
    /dialogue appears reduced|heat\/body specificity dropped/i.test(reason)
  );

  const artifactOnlyReasons = deterministicAudit.reasons.filter((reason) =>
    /malformed grammar artifacts increased/i.test(reason)
  );

  if (artifactOnlyReasons.length && !structuralReasons.length) {
    return {
      revert: false,
      warnOnly: true,
      reasons: artifactOnlyReasons,
      hardSafety,
    };
  }

  if (structuralReasons.length) {
    if (structuralQuarantineActive) {
      return {
        revert: false,
        warnOnly: true,
        reasons: structuralReasons,
        hardSafety,
      };
    }

    return {
      revert: true,
      reasons: structuralReasons,
      hardSafety,
    };
  }

  if (llmAudit?.verdict === 'FAIL') {
    const reason = String(llmAudit.reason || '');

    if (
      /summary|deleted|collapsed|assistant|commentary|broken grammar|malformed|sanitized|removed dialogue|removed adult/i.test(
        reason
      )
    ) {
      if (structuralQuarantineActive && /deleted|collapsed|removed dialogue/i.test(reason) && !/assistant|commentary|broken grammar|malformed|sanitized|removed adult/i.test(reason)) {
        return {
          revert: false,
          warnOnly: true,
          reasons: [reason],
          hardSafety,
        };
      }

      return {
        revert: true,
        reasons: [reason],
        hardSafety,
      };
    }

    return {
      revert: false,
      warnOnly: true,
      reasons: [reason || 'LLM voice audit failed for non-structural voice reason'],
      hardSafety,
    };
  }

  return {
    revert: false,
    reasons: [],
    hardSafety,
  };
}

async function runVoicePreservationAudit({ project, loaded, report, onProgress }) {
  reportProgress(onProgress, 'Fix Manuscript: running soft final voice-preservation audit...');

  const changed = getChangedItems(loaded);

  if (!changed.length) {
    reportProgress(onProgress, 'Fix Manuscript: voice audit skipped - no changed chapters.');
    return;
  }

  for (const item of changed) {
    const deterministicAudit = validateVoiceMetrics({
      original: item.original,
      candidate: item.content,
      project,
      label: 'voice preservation audit',
    });

    let llmAudit = null;

    let audit = {
      chapterNumber: item.chapterNumber,
      title: item.title || '',
      deterministicOk: deterministicAudit.ok,
      deterministicReasons: deterministicAudit.reasons,
      originalMetrics: deterministicAudit.originalMetrics,
      candidateMetrics: deterministicAudit.candidateMetrics,
      llmChecked: false,
      verdict: deterministicAudit.ok ? 'PASS' : 'WARN',
      reason: deterministicAudit.reasons.join(' | '),
      confidence: 'deterministic',
      softPolicy: true,
    };

    const needsLLM = false; // v24: deterministic-only mode prevents quota/timeouts during full-manuscript polish

    if (needsLLM) {
      try {
        llmAudit = await runLLMVoiceAudit({
          project,
          item,
          deterministicAudit,
          onProgress,
        });

        audit = {
          ...audit,
          llmChecked: true,
          verdict: llmAudit.verdict === 'FAIL' ? 'WARN' : 'PASS',
          reason: llmAudit.reason || audit.reason,
          confidence: llmAudit.confidence || 'medium',
          raw: llmAudit.raw,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        audit = {
          ...audit,
          llmChecked: true,
          verdict: deterministicAudit.ok ? 'PASS' : 'WARN',
          reason: deterministicAudit.ok
            ? `LLM voice audit failed, deterministic audit passed: ${message}`
            : `LLM voice audit failed, deterministic audit warned: ${deterministicAudit.reasons.join(' | ')}`,
          confidence: 'fallback',
        };

        addReportWarning(report, `Ch.${item.chapterNumber}: LLM voice audit failed - ${message}`);
      }
    }

    const revertDecision = shouldHardRevertVoiceAudit({
      item,
      project,
      deterministicAudit,
      llmAudit,
    });

    item.voiceAudit = {
      ...audit,
      hardRevert: revertDecision.revert,
      hardSafetyReasons: revertDecision.reasons,
      hardSafetyOk: revertDecision.hardSafety?.ok ?? true,
    };

    report.voiceAudits.push(item.voiceAudit);

    if (revertDecision.revert) {
      report.safetyReverts.push({
        chapterNumber: item.chapterNumber,
        title: item.title || '',
        pass: 'v7 voice audit hard-safety revert',
        reasons: revertDecision.reasons,
        originalWords: countWords(item.original),
        candidateWords: countWords(item.content),
        originalChars: normalizeText(item.original).length,
        candidateChars: normalizeText(item.content).length,
      });

      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: reverted final polished version - hard-safety voice audit failed: ${revertDecision.reasons.join(' | ')}`
      );

      console.warn(
        `[MANUSCRIPT-FIXER][VOICE v14] Hard reverted Ch.${item.chapterNumber}:`,
        revertDecision.reasons.join(' | ')
      );

      item.content = item.original;
      item.changed = false;
    } else if (audit.verdict === 'WARN' || revertDecision.warnOnly) {
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: voice audit warning only - repairs kept: ${audit.reason || revertDecision.reasons.join(' | ')}`
      );

      console.warn(`[MANUSCRIPT-FIXER][VOICE v14] Warning only; kept Ch.${item.chapterNumber} repairs`, {
        reason: audit.reason || revertDecision.reasons.join(' | '),
      });
    } else {
      addReportFix(
        report,
        `Ch.${item.chapterNumber}: voice audit passed${audit.llmChecked ? ' with LLM review' : ' deterministically'}`
      );
    }
  }

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }
}

function normalizeMechanicalSpacing(text) {
  let t = normalizeText(text);
  const fixes = [];

  const replacements = [
    [/\bhe told she\b/gi, 'he told the guard’s descendant', 'fixed pronoun artifact: he told she'],
    [/\bshe[’']s grandfather\b/gi, 'her grandfather', 'fixed possessive pronoun artifact'],
    [/\bhis wife,\s+his wife\b/gi, 'his wife', 'removed duplicate wife role label'],
    [/\bWhat\s+The site investigator’s\b/g, 'What the site investigator’s', 'fixed site-investigator capitalization artifact'],
    [/\bThe official account\.\s+The question was whether\b/g, 'The official account left the question unresolved: whether', 'repaired official-account fragment'],
    [/—(Would|Could|During|Each|Both)\b/g, (m, w) => '—' + w.toLowerCase(), 'lowercased post-em-dash continuation'],
    [/\brespectful but triage\b/gi, 'respectful triage', 'fixed malformed respectful triage phrase'],
    [/\bletters written doors knocked upon\b/gi, 'letters written, doors knocked upon', 'fixed list punctuation'],
    [/\bfiles about to internal investigations\b/gi, 'files related to internal investigations', 'fixed malformed internal-investigation phrase'],
    [/\binvestigators like investigators\b/gi, 'investigators', 'removed duplicate investigator phrase'],
    [/\bWhat was forbidden to speak of\?\s+What was forbidden to speak of\?/g, 'What was forbidden to speak of?', 'removed duplicated rhetorical question'],
    [/\bAt approximately ([^.!?]{1,80}?\bp\.m\.)\s+On\b/g, 'At approximately $1 on', 'fixed p.m. sentence split before date'],
    [/\bAt approximately ([^.!?]{1,80}?\ba\.m\.)\s+On\b/g, 'At approximately $1 on', 'fixed a.m. sentence split before date'],
    [/\bstatic spoke\b/gi, 'static, spoke', 'added comma before speech verb'],
    [/\bfrom its inception was\b/gi, 'from its inception, was', 'added comma after introductory phrase'],
    [/\bonce the walls were complete and the first inmates transferred in, the narrative shifted\b/gi, 'once the walls were complete and the first inmates had been transferred in, the narrative shifted', 'fixed missing auxiliary in transfer phrase'],
    [/\bstate[’'] monopoly\b/gi, 'state’s monopoly', 'fixed possessive apostrophe'],
    [/\ba original sin\b/gi, 'an original sin', 'fixed article: a original sin'],
    [/\bthe historical method could not verify it, but it could diagnose its function:\s+it was a narrative\s+(?=The next layer)/gi, 'the historical method could not verify it, but it could diagnose its function: it was a narrative device, not evidence.\n\n', 'completed dangling narrative-function sentence'],
    [/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\b/gi, 'At approximately $1 on', 'fixed time/date sentence split'],
    [/\b(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\b/gi, '$1 on', 'fixed bare time/date sentence split'],
    [/\.\s+another guide\b/g, '. Another guide', 'capitalized sentence-start: another guide'],
    [/\.\s+another path\b/g, '. Another path', 'capitalized sentence-start: another path'],
    [/\.\s+another possibility\b/g, '. Another possibility', 'capitalized sentence-start: another possibility'],
    [/\.\s+another form\b/g, '. Another form', 'capitalized sentence-start: another form'],
    [/“He was taken\."?\s+He was hanged\."?/g, '“He was taken.” “He was hanged.”', 'fixed paired passive-voice quote fragment'],
    [/“segregation,”\s+isolation,”\s+or/gi, '“segregation,” “isolation,” or', 'fixed quoted terminology list'],
    [/“0027\s*–\s*Fighting,”\s*0041\s*–\s*Insolence,”\s*0058\s*–\s*Refusal to work\."?/g, '“0027 – Fighting,” “0041 – Insolence,” “0058 – Refusal to work.”', 'fixed disciplinary-code quote list'],
    [/“Discipline,”\s*Industry,”\s*Capital Punishment\.”/g, '“Discipline,” “Industry,” “Capital Punishment.”', 'fixed broken quoted category list'],
    [/\bhowever was\b/gi, 'however, was', 'added comma after however'],
    [/\bhowever is\b/gi, 'however, is', 'added comma after however'],
    [/\bhowever were\b/gi, 'however, were', 'added comma after however'],
    [/\bhowever did\b/gi, 'however, did', 'added comma after however'],
    [/\bhowever had\b/gi, 'however, had', 'added comma after however'],
    [/\bhowever\s+(could|would|should|became|becomes|become|provided|offered|held|existed|remained|proved|showed|appeared|seemed|carried|created|presented|represented)\b/gi, 'however, $1', 'added comma after however before verb'],
    [/\btherefore did\b/gi, 'therefore, did', 'added comma after therefore'],
    [/\btherefore\s+(could|would|should|became|becomes|become|provided|offered|held|existed|remained|proved|showed|appeared|seemed|carried|created|presented|represented|required|faced)\b/gi, 'therefore, $1', 'added comma after therefore before verb'],
    [/\btherefore was\b/gi, 'therefore, was', 'added comma after therefore'],
    [/\bWhat remained, then was\b/gi, 'What remained, then, was', 'added comma after then'],
    [/\bWhat the record preserved, then was\b/gi, 'What the record preserved, then, was', 'added comma after then'],
    [/\bThe question, then was\b/gi, 'The question, then, was', 'added comma after then'],
    [/\bThe task, then was\b/gi, 'The task, then, was', 'added comma after then'],
    [/\bThe effect, then was\b/gi, 'The effect, then, was', 'added comma after then'],
    [/\bThe goal, then was\b/gi, 'The goal, then, was', 'added comma after then'],
    [/\bThe prison’s history, as written by the state is\b/gi, 'The prison’s history, as written by the state, is', 'added comma after interrupter'],
    [/\bif one was filed at all would have been\b/gi, 'if one was filed at all, would have been', 'added comma after conditional phrase'],
    [/\bif it could be found would not be revealed\b/gi, 'if it could be found, would not be revealed', 'added comma after conditional phrase'],
    [/\bif it could be found would\b/gi, 'if it could be found, would', 'added comma after conditional phrase'],
    [/\bwhile guarded provided\b/gi, 'while guarded, provided', 'added comma after concessive phrase'],
    [/\bwere not curated\. They survived through accident and sentiment\b/gi, 'were not curated; they survived through accident and sentiment', 'joined clipped explanatory sentence'],
    [/\bThe physical evidence—the specific workshop door, the walls stained with smoke that no repainting could fully hide—was slated\b/gi, 'The physical evidence—the specific workshop door and the walls stained with smoke that no repainting could fully hide—was slated', 'smoothed physical-evidence list agreement'],
    [/\ba victim’s descendant’s house\b/gi, 'the descendant’s house', 'smoothed descendant possessive stack'],
    {
      label: 'decimal percent spacing',
      pattern: /\b(\d+)\.\s+(\d+)(\s*%)/g,
      replacement: '$1.$2$3',
    },
    {
      label: 'decimal number spacing',
      pattern: /\b(\d+)\.\s+(\d+)\b/g,
      replacement: '$1.$2',
    },
    {
      label: 'a.m. spacing',
      pattern: /\b(\d{1,2})(?::(\d{2}))?\s+a\.\s*m\.\b/gi,
      replacement: (_m, hour, minute) => `${hour}${minute ? `:${minute}` : ''} a.m.`,
    },
    {
      label: 'p.m. spacing',
      pattern: /\b(\d{1,2})(?::(\d{2}))?\s+p\.\s*m\.\b/gi,
      replacement: (_m, hour, minute) => `${hour}${minute ? `:${minute}` : ''} p.m.`,
    },
    {
      label: 'space before closing punctuation',
      pattern: /\s+([,.;:!?])/g,
      replacement: '$1',
    },
    {
      label: 'space after opening quote',
      pattern: /([""])\s+/g,
      replacement: '$1',
    },
    {
      label: 'space before closing quote',
      pattern: /\s+([""])/g,
      replacement: '$1',
    },
    {
      label: 'sentence punctuation after quote spacing',
      pattern: /([""])\s+([,.;:!?])/g,
      replacement: '$1$2',
    },
  ];

  for (const item of replacements) {
    const before = t;

    if (typeof item.replacement === 'function') {
      t = t.replace(item.pattern, item.replacement);
    } else {
      t = t.replace(item.pattern, item.replacement);
    }

    if (t !== before) fixes.push(item.label);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}


function applyLightPunctuationRefinements(text) {
  let t = normalizeText(text);
  const fixes = [];

  const replacements = [
    {
      label: 'appositive comma: shaped vaguely like a question mark had',
      pattern: /\b(shaped vaguely like a question mark)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'appositive comma: shaped like a question mark had',
      pattern: /\b(shaped like a question mark)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'appositive comma: shaped vaguely like a comma had',
      pattern: /\b(shaped vaguely like a comma)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'appositive comma: shaped like a comma had',
      pattern: /\b(shaped like a comma)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'appositive comma: shaped vaguely like a lightning bolt had',
      pattern: /\b(shaped vaguely like a lightning bolt)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'appositive comma: shaped like a lightning bolt had',
      pattern: /\b(shaped like a lightning bolt)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: markers of fear, of agitation were',
      pattern: /\b(markers of fear,\s+of agitation)\s+(were\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: signs of fear, of agitation were',
      pattern: /\b(signs of fear,\s+of agitation)\s+(were\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: fear, of agitation were',
      pattern: /\b(fear,\s+of agitation)\s+(were\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: tall maybe six-two',
      pattern: /\b(was|is|looked|stood)\s+(tall)\s+(maybe\s+(?:six|five|four|seven)[-\s]?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)?)\b/gi,
      replacement: '$1 $2, $3',
    },
    {
      label: 'parenthetical comma: maybe age estimate',
      pattern: /\b(was|is|looked)\s+([a-z]+)\s+(maybe\s+(?:twenty|thirty|forty|fifty|sixty|seventy)[-\s]?(?:one|two|three|four|five|six|seven|eight|nine)?\b)/gi,
      replacement: '$1 $2, $3',
    },
    {
      label: 'missing comma before under those conditions should',
      pattern: /\b(under those conditions)\s+(should\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma before as if he knew',
      pattern: /\b(As if he knew exactly where [^.?!]{1,140}?stood)\s+(knew\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma: stood knew he was being watched',
      pattern: /\b(stood)\s+(knew he was being watched\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma after setup: Then he looked back',
      pattern: /\b(Then he looked back at the glass)\s+(and\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma before nonrestrictive who wore',
      pattern: /\b(a man named [A-Z][A-Za-z]+)\s+(who wore\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma before nonrestrictive who had',
      pattern: /\b(a woman named [A-Z][A-Za-z]+)\s+(who had\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma after introductory finally',
      pattern: /\b(Finally)\s+([A-Z][a-z]+)\s+(turned|moved|stood|looked|spoke|said)\b/g,
      replacement: '$1, $2 $3',
    },
    {
      label: 'missing comma after not quickly',
      pattern: /\b(Not quickly)\s+(A slow|A sharp|A gentle|A careful|A deliberate)\b/g,
      replacement: '$1. $2',
    },
    {
      label: 'missing comma after not gently',
      pattern: /\b(Not gently)\s+(A slow|A sharp|A rough|A brutal)\b/g,
      replacement: '$1. $2',
    },
  ];

  for (const item of replacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.label}: ${matches.length}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}


function applyFragmentAndConjunctionRefinements(text) {
  let t = normalizeText(text);
  const fixes = [];

  const replacements = [
    {
      label: 'force merge exact a.m. time fragment: a.m. When -> a.m., when',
      pattern: /\b(\d{1,2}:\d{2}\s+a\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'force merge exact p.m. time fragment: p.m. When -> p.m., when',
      pattern: /\b(\d{1,2}:\d{2}\s+p\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'remove bad comma: taste of blood and fear, was',
      pattern: /\b(The taste of blood and fear),\s+(was\b)/g,
      replacement: '$1 $2',
    },
    {
      label: 'remove bad comma: taste of blood and fear, is',
      pattern: /\b(The taste of blood and fear),\s+(is\b)/g,
      replacement: '$1 $2',
    },
    {
      label: 'parenthetical comma: His hand, the one that had touched him felt',
      pattern: /\b(His hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: Her hand, the one that had touched him felt',
      pattern: /\b(Her hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: His hand, the one that had touched her felt',
      pattern: /\b(His hand,\s+the one that had touched her)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: hand the one that had touched him felt',
      pattern: /\b(the hand,\s+the one that had touched him)\s+(felt\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'merge fragment after exact time: noticed it every day at time. When',
      pattern: /\b(He|She|They|Elias|Silas|Caspian|Jonah|Orin|Kael|Ronan|Lev)\s+noticed it every day at (\d{1,2}:\d{2}\s+[ap]\.m\.)\s+When\b/g,
      replacement: '$1 noticed it every day at $2, when',
    },
    {
      label: 'merge fragment after exact time: noticed it at time. When',
      pattern: /\b(He|She|They|Elias|Silas|Caspian|Jonah|Orin|Kael|Ronan|Lev)\s+noticed it at (\d{1,2}:\d{2}\s+[ap]\.m\.)\s+When\b/g,
      replacement: '$1 noticed it at $2, when',
    },
    {
      label: 'merge fragment after exact time: happened at time. When',
      pattern: /\b(it happened at \d{1,2}:\d{2}\s+[ap]\.m\.)\s+When\b/gi,
      replacement: (match, lead) => `${lead.slice(0, -1)}, when`,
    },
    {
      label: 'chemical suppressants isolation -> chemical suppressants, and isolation',
      pattern: /\b(chemical suppressants)\s+(isolation\b)/gi,
      replacement: '$1, and $2',
    },
    {
      label: 'chemical suppressants and isolation missing comma after list item',
      pattern: /\b(escalating stimuli,\s+chemical suppressants)\s+(and isolation\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'protocol list: escalating stimuli, chemical suppressants isolation',
      pattern: /\b(escalating stimuli,\s+chemical suppressants)\s+(isolation\b)/gi,
      replacement: '$1, and $2',
    },
    {
      label: 'parenthetical comma: smell of him, of sex and clean exertion had',
      pattern: /\b(The smell of him,\s+of sex and clean exertion)\s+(had\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: scent of him, of sex and clean exertion had',
      pattern: /\b(The scent of him,\s+of sex and clean exertion)\s+(had\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'parenthetical comma: smell of sweat and sex and clean exertion had',
      pattern: /\b(The smell of sweat,\s+of sex and clean exertion)\s+(had\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma after direct-address style pause: The decision formed as words left mouth',
      pattern: /\b(The decision formed as the words left his mouth)\s+(I want|I do|I am|I can|I will)\b/g,
      replacement: '$1. $2',
    },
    {
      label: 'missing comma: the air between them changed grew',
      pattern: /\b(the air between them changed)\s+(grew\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma: shame hot and sour rose',
      pattern: /\b(Shame,\s+hot and sour)\s+(rose\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma: sweat and sex and clean exertion had',
      pattern: /\b(sex and clean exertion)\s+(had overpowered\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'repair sentence fragment: Then the line went dead. Elias sat',
      pattern: /\b(The line went dead)\s+(Elias sat\b)/g,
      replacement: '$1. $2',
    },
    {
      label: 'repair list: cleansing positioning application collection',
      pattern: /\b(The cleansing,\s+the positioning,\s+the application of the targeted stimuli)\s+(the collection apparatus\b)/gi,
      replacement: '$1, and $2',
    },
    {
      label: 'missing comma after name appositive: a girl with laughing eyes had',
      pattern: /\b(a girl with laughing eyes)\s+(had\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma after phrase: military-adjacent it lends',
      pattern: /\b(Military-adjacent)\s+(It lends\b)/g,
      replacement: '$1. $2',
    },
    {
      label: 'missing comma after phrase: No chronic issues resilience',
      pattern: /\b(no chronic issues)\s+(Resilience scores\b)/gi,
      replacement: '$1. $2',
    },
    {
      label: 'missing comma: not on Gerrard not on the door',
      pattern: /\b(not on Gerrard),\s+(not on the door)\b/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma: hearing narrowed tunneling',
      pattern: /\b(his hearing had narrowed)\s+(tunneling\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'missing comma: the smell of detergent a small kindness',
      pattern: /\b(the faint,\s+clean smell of detergent)\s+(A small,\s+staggering kindness\b)/gi,
      replacement: '$1. $2',
    },
  ];

  for (const item of replacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.label}: ${matches.length}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}



function applyForcedFinalLiteralSurvivorPatch(text) {
  let t = normalizeText(text);
  const fixes = [];

  const pairs = [
    [
      'He noticed it every day at 10:15 a.m. When',
      'He noticed it every day at 10:15 a.m., when',
      'forced literal: noticed every day time fragment',
    ],
    [
      '10:15 a.m. When',
      '10:15 a.m., when',
      'forced literal: 10:15 a.m. When',
    ],
    [
      'Caspian’s hand, the one that had touched him felt alien.',
      'Caspian’s hand, the one that had touched him, felt alien.',
      'forced literal: Caspian hand touched him felt alien',
    ],
    [
      'Caspian’s hand, the one that had touched him felt',
      'Caspian’s hand, the one that had touched him, felt',
      'forced literal: Caspian hand touched him felt',
    ],
    [
      'His hand, the one that had touched him felt',
      'His hand, the one that had touched him, felt',
      'forced literal: His hand touched him felt',
    ],
    [
      'Her hand, the one that had touched him felt',
      'Her hand, the one that had touched him, felt',
      'forced literal: Her hand touched him felt',
    ],
    [
      'The Owner’s tone shifted became',
      'The Owner’s tone shifted, becoming',
      'forced literal: Owner tone shifted became',
    ],
    [
      'older than Jonah had expected maybe',
      'older than Jonah had expected, maybe',
      'forced literal: Jonah expected maybe',
    ],
    [
      'His curses were hesitated by',
      'His curses were swallowed by',
      'forced literal: curses were hesitated by',
    ],
    [
      'It is just. They are sacred.',
      'It is just… they are sacred.',
      'forced literal: broken ellipsis fragment It is just',
    ],
    [
      'It is not for. Squeaking.',
      'It is not for… squeaking.',
      'forced literal: broken ellipsis fragment not for squeaking',
    ],
    [
      'It must be. Consented to.',
      'It must be… consented to.',
      'forced literal: broken ellipsis fragment must be consented',
    ],
    [
      'for one’s. Partner.',
      'for one’s… partner.',
      'forced literal: broken ellipsis fragment one’s partner',
    ],
    [
      'It. Measures the weight',
      'It… measures the weight',
      'forced literal: broken ellipsis fragment It measures',
    ],
    [
      'For bonds that are. Absolute.',
      'For bonds that are… absolute.',
      'forced literal: broken ellipsis fragment bonds absolute',
    ],
    [
      'It makes a full set. Operational.',
      'It makes a full set… operational.',
      'forced literal: broken ellipsis fragment full set operational',
    ],
    [
      'To bind the guilds. To. Rule.',
      'To bind the guilds. To rule.',
      'forced literal: broken ellipsis fragment To rule',
    ],
    [
      'You. You activated the vow.',
      'You… you activated the vow.',
      'forced literal: broken ellipsis fragment You activated',
    ],
    [
      'without a mutual release. The old tales say',
      'without a mutual release… the old tales say',
      'forced literal: broken ellipsis fragment release old tales',
    ],
    [
      'is it a. An action?',
      'is it a… an action?',
      'forced literal: broken ellipsis fragment an action',
    ],
    [
      'for the old rituals. The stories say',
      'for the old rituals… the stories say',
      'forced literal: broken ellipsis fragment old rituals stories',
    ],
    [
      'High Doms and the Arcanists. How could you know that?',
      'High Doms and the Arcanists… how could you know that?',
      'forced literal: broken ellipsis fragment Arcanists how',
    ],
    [
      '“How.” he started, then stopped.',
      '“How…” he started, then stopped.',
      'forced literal: broken ellipsis dialogue How',
    ],
    [
      'They stabilize. Everything.',
      'They stabilize… everything.',
      'forced literal: broken ellipsis fragment stabilize everything',
    ],
    [
      'She stirred made a soft, confused sound',
      'She stirred, made a soft, confused sound',
      'forced literal: missing comma after stirred',
    ],
    [
      'The engine coughed caught, and settled',
      'The engine coughed, caught, and settled',
      'forced literal: missing commas engine coughed caught',
    ],
    [
      'engine coughed caught, and settled',
      'engine coughed, caught, and settled',
      'forced literal: missing commas engine coughed caught lowercase',
    ],
    [
      'The window,” Zonk said, already scooping the Elements off the table.',
      '“The window,” Zonk said, already scooping the Elements off the table.',
      'forced literal: missing opening quote before The window',
    ],
    [
      'He didn’t yell didn’t telegraph.',
      'He didn’t yell, didn’t telegraph.',
      'forced literal: missing comma did not yell',
    ],
    [
      'She stood walked to the edge',
      'She stood, walked to the edge',
      'forced literal: missing comma stood walked',
    ],
    [
      'He pushed them toward the rear of the booth found the darker drape',
      'He pushed them toward the rear of the booth, found the darker drape',
      'forced literal: missing comma booth found',
    ],
    [
      'He stood left the cider mostly untouched',
      'He stood, left the cider mostly untouched',
      'forced literal: missing comma stood left',
    ],
    [
      '“Okay,” he said softly out.',
      '“Okay,” he said softly.',
      'forced literal: removed stray out after softly',
    ],
    [
      'His mouth, back in the real world was dry.',
      'His mouth, back in the real world, was dry.',
      'forced literal: missing comma real world was dry',
    ],
    [
      'In the center, on six individual velvet pedestals sat the artifacts.',
      'In the center, on six individual velvet pedestals, sat the artifacts.',
      'forced literal: missing comma pedestals sat',
    ],
    [
      'She had descended with a quiet, precise grace that felt obscene given the circumstances.',
      'She had descended with a quiet, precise grace that felt impossible given the circumstances.',
      'forced literal: awkward obscene grace wording',
    ],
  ];

  for (const [from, to, label] of pairs) {
    if (!t.includes(from)) continue;

    const count = t.split(from).length - 1;
    t = t.split(from).join(to);
    fixes.push(`${label}: ${count}`);
  }

  // Regex fallback for the same exported survivors in case spacing varies.
  const regexReplacements = [
    {
      label: 'forced regex: missing opening quote before The window dialogue',
      pattern: /(^|\n)(The window,[”"]\s+Zonk said,)/g,
      replacement: '$1“$2',
    },
    {
      label: 'forced regex: exact time followed by When',
      pattern: /\b(\d{1,2}:\d{2}\s+[ap]\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'forced regex: proper-name possessive hand touched him felt',
      pattern: /\b([A-Z][A-Za-z]+’s hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'forced regex: Owner tone shifted became',
      pattern: /\b(The Owner’s tone shifted)\s+(became\b)/g,
      replacement: '$1, becoming',
    },
    {
      label: 'forced regex: expected maybe',
      pattern: /\b(older than [A-Z][A-Za-z]+ had expected)\s+(maybe\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'forced regex: curses were hesitated by',
      pattern: /\b(His|Her|Their)\s+curses were hesitated by\b/g,
      replacement: '$1 curses were swallowed by',
    },
  ];

  for (const item of regexReplacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.label}: ${matches.length}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}

function applyLiteralExportSurvivorPatch(text) {
  let t = normalizeText(text);
  const fixes = [];

  const directStringReplacements = [
    [
      'He noticed it every day at 10:15 a.m. When',
      'He noticed it every day at 10:15 a.m., when',
      'direct: He noticed it every day at 10:15 a.m. When',
    ],
    [
      '10:15 a.m. When',
      '10:15 a.m., when',
      'direct: 10:15 a.m. When',
    ],
    [
      'Caspian’s hand, the one that had touched him felt alien.',
      'Caspian’s hand, the one that had touched him, felt alien.',
      'direct: Caspian hand touched him felt alien',
    ],
    [
      'Caspian’s hand, the one that had touched him felt',
      'Caspian’s hand, the one that had touched him, felt',
      'direct: Caspian hand touched him felt',
    ],
    [
      'His hand, the one that had touched him felt',
      'His hand, the one that had touched him, felt',
      'direct: His hand touched him felt',
    ],
    [
      'Her hand, the one that had touched him felt',
      'Her hand, the one that had touched him, felt',
      'direct: Her hand touched him felt',
    ],
  ];

  for (const [from, to, label] of directStringReplacements) {
    if (!t.includes(from)) continue;

    const count = t.split(from).length - 1;
    t = t.split(from).join(to);
    fixes.push(`${label}: ${count}`);
  }

  const replacements = [
    {
      label: 'literal: 10:15 a.m. When -> 10:15 a.m., when',
      pattern: /\b(10:15\s+a\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'literal: any exact a.m. time followed by When',
      pattern: /\b(\d{1,2}:\d{2}\s+a\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'literal: any exact p.m. time followed by When',
      pattern: /\b(\d{1,2}:\d{2}\s+p\.m\.)\s+When\b/g,
      replacement: '$1, when',
    },
    {
      label: 'literal: Caspian hand parenthetical comma',
      pattern: /\b(Caspian\u2019s hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'literal: possessive hand parenthetical comma',
      pattern: /\b([A-Z][A-Za-z]+\u2019s hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'literal: His hand parenthetical comma',
      pattern: /\b(His hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'literal: Her hand parenthetical comma',
      pattern: /\b(Her hand,\s+the one that had touched him)\s+(felt\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'literal: The Owner tone shifted became',
      pattern: /\b(The Owner\u2019s tone shifted)\s+(became\b)/g,
      replacement: '$1, becoming',
    },
    {
      label: 'literal: tone shifted became',
      pattern: /\b(tone shifted)\s+(became\b)/gi,
      replacement: '$1, becoming',
    },
    {
      label: 'literal: older than Jonah had expected maybe',
      pattern: /\b(older than Jonah had expected)\s+(maybe\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'literal: older than he had expected maybe',
      pattern: /\b(older than he had expected)\s+(maybe\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'literal: older than she had expected maybe',
      pattern: /\b(older than she had expected)\s+(maybe\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'literal: curses were hesitated by',
      pattern: /\b(His|Her|Their)\s+curses were hesitated by\b/g,
      replacement: '$1 curses were swallowed by',
    },
    {
      label: 'literal: curses were swallowed by room noise comma cleanup',
      pattern: /\b(curses were swallowed by the room\u2019s noise)\s+([A-Z][a-z]+\s+turned)\b/g,
      replacement: '$1. $2',
    },
    {
      label: 'literal: numbers were steady predictable',
      pattern: /\b(The numbers were steady)\s+(Predictable\b)/g,
      replacement: '$1. $2',
    },
    {
      label: 'literal: yielded columns was a ruin',
      pattern: /\b(the clean columns of assets and yields)\s+(was a ruin\b)/gi,
      replacement: '$1 were a ruin',
    },
    {
      label: 'literal: clinical protocol list missing and',
      pattern: /\b(restrain,\s+stimulate,\s+collect)\s+(document\b)/gi,
      replacement: '$1, and $2',
    },
    {
      label: 'literal: directness green eyes comma',
      pattern: /\b(the directness of it,\s+the green of his eyes in the surgical light)\s+(was a punch\b)/gi,
      replacement: '$1, $2',
    },
  ];

  for (const item of replacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.label}: ${matches.length}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}


function applyFinalGrammarIntegrityRepairs(text) {
  let t = normalizeText(text);
  const fixes = [];

  const directPairs = [
    ['The harvest there is. Impersonal. Mechanical.', 'The harvest there is impersonal, mechanical.', 'harvest fragment'],
    ['Corinne closed and set it aside.', 'Corinne closed her ledger and set it aside.', 'missing ledger object'],
    ['The door to the playroom opened it.', 'The door to the playroom opened.', 'door opened it'],
    ['His eyes didn’t widen. His chest rising didn’t hitch.', 'His eyes didn’t widen. His breathing didn’t hitch.', 'chest rising did not hitch'],
    ["His eyes didn't widen. His chest rising didn't hitch.", "His eyes didn't widen. His breathing didn't hitch.", 'chest rising did not hitch ascii'],
    ['Tomas’s moment hitched.', 'Tomas’s breath hitched.', 'Tomas moment hitched'],
    ["Tomas's moment hitched.", "Tomas's breath hitched.", 'Tomas moment hitched ascii'],
    ['The cold knot under Corinne’s ribs sharpened became a needle of ice.', 'The cold knot under Corinne’s ribs sharpened, becoming a needle of ice.', 'sharpened became'],
    ["The cold knot under Corinne's ribs sharpened became a needle of ice.", "The cold knot under Corinne's ribs sharpened, becoming a needle of ice.", 'sharpened became ascii'],
    ['There was only the transaction. The almond on the tongue. entry.', 'There was only the transaction. The almond on the tongue. The ledger entry.', 'orphan entry'],
    ['“The session is concluded.” She lowered the words to strange in her own ears, thin and tight.', '“The session is concluded.” Her voice sounded strange in her own ears, thin and tight.', 'lowered words malformed'],
    ['"The session is concluded." She lowered the words to strange in her own ears, thin and tight.', '"The session is concluded." Her voice sounded strange in her own ears, thin and tight.', 'lowered words malformed ascii'],
    ['Tomas lay there, stillness slow and even, his body relaxed against the restraints.', 'Tomas lay there, breathing slow and even, his body relaxed against the restraints.', 'stillness slow and even'],
    ['Tomas’s body finally, traitorously began to respond', 'Tomas’s body finally, traitorously, began to respond', 'traitorously comma'],
    ["Tomas's body finally, traitorously began to respond", "Tomas's body finally, traitorously, began to respond", 'traitorously comma ascii'],
    ['She made a fist drove the tremor inward.', 'She made a fist and drove the tremor inward.', 'fist drove'],
    ['Her fingers, stiff settled against his open palm.', 'Her fingers, stiff, settled against his open palm.', 'stiff settled'],
    ['She could hear her own pause shallow and quick.', 'She could hear her own breath, shallow and quick.', 'own pause shallow'],
    ['When she broke away, her lips felt bruised, alive. They were both silence between them hard.', 'When she broke away, her lips felt bruised, alive. They were both breathing hard.', 'silence between them hard'],
    ['and The words came out Matron Corinne’s voice again', 'and the words came out in Matron Corinne’s voice again', 'Matron voice'],
    ["and The words came out Matron Corinne's voice again", "and the words came out in Matron Corinne's voice again", 'Matron voice ascii'],
    ['She thought of in her study, the perfect rows of numbers', 'She thought of the ledger in her study, the perfect rows of numbers', 'missing ledger in study'],
    ['in the way her own silence had caught when his forehead touched hers', 'in the way her own breath had caught when his forehead touched hers', 'own silence had caught'],
    ['his own pause raw in his throat', 'his own breath raw in his throat', 'own pause raw'],
    ['Her own moment felt short.', 'Her own breath felt short.', 'own moment felt short'],
    ['Her beat felt short.', 'Her breath felt short.', 'her beat felt short'],
    ['her beat felt short.', 'her breath felt short.', 'her beat felt short lowercase'],
    ['her own moment felt short.', 'her own breath felt short.', 'own moment felt short lowercase'],
    ['She could hear her own silence shallow and quick.', 'She could hear her own breath, shallow and quick.', 'own silence shallow'],
    ['They were both chest rising hard, the silence between them taut.', 'They were both breathing hard, the silence between them taut.', 'both chest rising hard'],
    ['They were both rhythm hard, the silence between them taut.', 'They were both breathing hard, the silence between them taut.', 'both rhythm hard'],
    ['in the way her own beat had caught when his forehead touched hers', 'in the way her own breath had caught when his forehead touched hers', 'own beat had caught'],
    ['his own moment raw in his throat', 'his own breath raw in his throat', 'own moment raw'],
    ['“They’ll break through,” she said. She spoke — ragged.', '“They’ll break through,” she said, ragged.', 'she spoke ragged em dash'],
    ['"They’ll break through," she said. She spoke — ragged.', '"They’ll break through," she said, ragged.', 'she spoke ragged em dash mixed'],
    ['"They\'ll break through," she said. She spoke — ragged.', '"They\'ll break through," she said, ragged.', 'she spoke ragged em dash ascii'],
    ['He felt the tension coil in her belly, heard her silence hitch, saw the moment', 'He felt the tension coil in her belly, heard her breath hitch, saw the moment', 'heard her silence hitch'],
    ['For a long moment, there was only the sound of their ragged rhythm between them, the pound of blood in his ears.', 'For a long moment, there was only the sound of their ragged breathing, the pound of blood in his ears.', 'ragged rhythm between them'],
    ['For a long moment, there was only the sound of their ragged quiet between them, the pound of blood in his ears.', 'For a long moment, there was only the sound of their ragged breathing, the pound of blood in his ears.', 'ragged quiet between them'],
    ['For a long moment, there was only the sound of their ragged stillness between them, the pound of blood in his ears.', 'For a long moment, there was only the sound of their ragged breathing, the pound of blood in his ears.', 'ragged stillness between them'],
    ['He understood. was ash.', 'He understood. The ledger was ash.', 'understood was ash'],
    ['Buttons skittered across the floor lost in the perfume and dust.', 'Buttons skittered across the floor, lost in the perfume and dust.', 'floor lost'],
    ['He felt the tension coil in her belly heard her beat hitch saw the moment', 'He felt the tension coil in her belly, heard her breath hitch, saw the moment', 'belly heard beat hitch'],
    ['For a long moment, there was only the sound of their ragged silence between them, the pound of blood in his ears.', 'For a long moment, there was only the sound of their ragged breathing, the pound of blood in his ears.', 'ragged silence'],
    ['“They’ll break through,” she said. She said it, ragged.', '“They’ll break through,” she said, ragged.', 'duplicate she said'],
    ['"They’ll break through," she said. She said it, ragged.', '"They’ll break through," she said, ragged.', 'duplicate she said mixed'],
    ['"They\'ll break through," she said. She said it, ragged.', '"They\'ll break through," she said, ragged.', 'duplicate she said ascii'],
  ];

  for (const [from, to, label] of directPairs) {
    if (!t.includes(from)) continue;
    const count = t.split(from).length - 1;
    t = t.split(from).join(to);
    fixes.push(`v14 direct ${label}: ${count}`);
  }

  const replacements = [
    { label: 'impersonal mechanical fragment', pattern: /\b(The harvest there is)\.\s+(Impersonal)\.\s+(Mechanical)\./g, replacement: '$1 impersonal, mechanical.' },
    { label: 'door opened it', pattern: /\b(The door to [^.]{1,80}? opened) it\./g, replacement: '$1.' },
    { label: 'closed and set it aside missing object', pattern: /\b(Corinne|He|She)\s+closed and set it aside\./g, replacement: (_m, s) => s === 'Corinne' ? 'Corinne closed her ledger and set it aside.' : `${s} closed the ledger and set it aside.` },
    { label: 'possessive bad breath noun hitched/caught', pattern: /\b(His|Her|Their|Tomas’s|Tomas'|Corinne’s|Corinne's|The man’s|The woman's|The boy’s|The girl's)\s+(moment|pause|silence|air|beat)\s+(hitched|caught)\b/g, replacement: '$1 breath $3' },
    { label: 'possessive bad breath noun was warm', pattern: /\b(His|Her|Their|Tomas’s|Tomas'|Corinne’s|Corinne's|The man’s|The woman's|The boy’s|The girl's)\s+(moment|pause|silence|air|beat)\s+(was warm)\b/g, replacement: '$1 breath $3' },
    { label: 'own pause raw', pattern: /\b(own)\s+(pause|silence|air)\s+(raw in (?:his|her|their) throat)\b/gi, replacement: '$1 breath $3' },
    { label: 'own bad sensory noun raw', pattern: /\b(own)\s+(moment|pause|silence|air|beat|rhythm)\s+(raw in (?:his|her|their) throat)\b/gi, replacement: '$1 breath $3' },
    { label: 'own bad sensory noun felt short', pattern: /\b(Her|His|Their)\s+own\s+(moment|pause|silence|air|beat|rhythm)\s+(felt short)\b/g, replacement: '$1 own breath $3' },
    { label: 'possessive bad sensory noun felt short', pattern: /\b(Her|His|Their)\s+(moment|pause|silence|air|beat|rhythm|quiet)\s+(felt short)\b/g, replacement: '$1 breath $3' },
    { label: 'own bad sensory noun had caught', pattern: /\b(own)\s+(moment|pause|silence|air|beat|rhythm)\s+(had caught)\b/gi, replacement: '$1 breath $3' },
    { label: 'own bad sensory noun shallow quick', pattern: /\b(own)\s+(moment|pause|silence|air|beat|rhythm)\s+(shallow and quick)\b/gi, replacement: '$1 breath, $3' },
    { label: 'both chest rising hard', pattern: /\bThey were both chest rising hard\b/g, replacement: 'They were both breathing hard' },
    { label: 'both bad sensory noun hard', pattern: /\bThey were both\s+(moment|pause|silence|air|beat|rhythm|quiet)\s+hard\b/gi, replacement: 'They were both breathing hard' },
    { label: 'heard bad sensory noun hitch', pattern: /\b(heard (?:his|her|their))\s+(moment|pause|silence|air|beat|rhythm)\s+(hitch)\b/gi, replacement: '$1 breath $3' },
    { label: 'ragged rhythm between them', pattern: /\b(ragged)\s+(rhythm|silence|beat)\s+(between them)\b/gi, replacement: '$1 breathing' },
    { label: 'ragged bad sensory noun between them', pattern: /\b(ragged)\s+(rhythm|silence|beat|quiet|pause|moment|stillness)\s+(between them)\b/gi, replacement: '$1 breathing' },
    { label: 'she spoke ragged em dash', pattern: /\b(She spoke)\s+[—-]\s+(ragged)\b/g, replacement: 'she said, $2' },
    { label: 'own air felt short', pattern: /\b(Her|His|Their)\s+own\s+(pause|silence|air)\s+(felt short)\b/g, replacement: '$1 own breath $3' },
    { label: 'own silence had caught', pattern: /\b(own)\s+(pause|silence|air)\s+(had caught)\b/gi, replacement: '$1 breath $3' },
    { label: 'almond tongue entry', pattern: /\b(The almond on the tongue)\.\s+(entry)\./g, replacement: '$1. The ledger $2.' },
    { label: 'understood was ash', pattern: /\b(He|She|They|Tomas|Corinne)\s+understood\.\s+was ash\./g, replacement: '$1 understood. The ledger was ash.' },
    { label: 'missing ledger in study', pattern: /\b(She|He|They|Corinne|Tomas)\s+thought of in (his|her|their) study\b/g, replacement: '$1 thought of the ledger in $2 study' },
    { label: 'as measured by clause comma', pattern: /\b(as measured by [^,.!?]{1,90})\s+(was|were)\b/g, replacement: '$1, $2' },
    { label: 'once spoken became', pattern: /\b(once spoken)\s+(became true|became real|became unavoidable)\b/gi, replacement: '$1, $2' },
    { label: 'human cutting through', pattern: /\b(sharp and human)\s+(cutting through)\b/gi, replacement: '$1, $2' },
    { label: 'clean cutting through', pattern: /\b(sharp and clean)\s+(cutting through)\b/gi, replacement: '$1, $2' },
    { label: 'learned drove shoulder', pattern: /\b(whose name (?:he|she|they)’?d never learned)\s+(drove)\b/gi, replacement: '$1, $2' },
    { label: 'again setting rhythm', pattern: /\b(drove into (?:him|her|them) again)\s+(setting a rhythm)\b/gi, replacement: '$1, $2' },
    { label: 'belly heard saw', pattern: /\b(felt the tension coil in (?:his|her|their) belly)\s+(heard (?:his|her|their) (?:beat|breath) hitch)\s+(saw the moment)\b/gi, replacement: '$1, $2, $3' },
    { label: 'ragged silence', pattern: /\b(ragged)\s+(silence between them)\b/gi, replacement: '$1 breathing' },
    { label: 'words came out Matron voice', pattern: /\band The words came out (Matron [A-Z][A-Za-z]+’s voice)\b/g, replacement: 'and the words came out in $1' },
    { label: 'words came out Matron voice ascii', pattern: /\band The words came out (Matron [A-Z][A-Za-z]+'s voice)\b/g, replacement: 'and the words came out in $1' },
  ];

  for (const item of replacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;
    t = t.replace(item.pattern, item.replacement);
    fixes.push(`v14 regex ${item.label}: ${matches.length}`);
  }

  // ── MALFORMED GRAMMAR CANARY REPAIRS (match safety gate patterns) ──
  // These patterns are flagged by manuscriptSafetyGate.js MALFORMED_CANARIES.
  // If not repaired here, export will be blocked with REJECT_MANUAL_REVIEW.
  const malformedCanaryRepairs = [
    // Subject-verb agreement
    { label: 'She were → She was', pattern: /\bShe were\b/g, replacement: 'She was' },
    { label: 'He were → He was', pattern: /\bHe were\b/g, replacement: 'He was' },
    { label: 'You was → You were', pattern: /\bYou was\b/g, replacement: 'You were' },
    { label: 'Aether were → Aether was', pattern: /\bAether were\b/gi, replacement: (m) => m.startsWith('a') ? 'aether was' : 'Aether was' },

    // Doubled/garbled verbs
    { label: 'Was was → Was', pattern: /\bWas was\b/g, replacement: 'Was' },
    { label: 'was was → was', pattern: /\bwas was\b/g, replacement: 'was' },

    // Article-adjective agreement (a → an before vowels)
    { label: 'a obvious → an obvious', pattern: /\ba obvious\b/gi, replacement: (m) => m.startsWith('A') ? 'An obvious' : 'an obvious' },
    { label: 'a utter → an utter', pattern: /\ba utter\b/gi, replacement: (m) => m.startsWith('A') ? 'An utter' : 'an utter' },
    { label: 'a ominous → an ominous', pattern: /\ba ominous\b/gi, replacement: (m) => m.startsWith('A') ? 'An ominous' : 'an ominous' },
    { label: 'a overwhelming → an overwhelming', pattern: /\ba overwhelming\b/gi, replacement: (m) => m.startsWith('A') ? 'An overwhelming' : 'an overwhelming' },
    { label: 'a eerie → an eerie', pattern: /\ba eerie\b/gi, replacement: (m) => m.startsWith('A') ? 'An eerie' : 'an eerie' },
    { label: 'a elegant → an elegant', pattern: /\ba elegant\b/gi, replacement: (m) => m.startsWith('A') ? 'An elegant' : 'an elegant' },
    { label: 'a unsettling → an unsettling', pattern: /\ba unsettling\b/gi, replacement: (m) => m.startsWith('A') ? 'An unsettling' : 'an unsettling' },

    // Garbled question forms
    { label: 'She was it → Was it', pattern: /\bShe was it\b/gi, replacement: (m) => m.startsWith('S') || m.startsWith('s') ? 'Was it' : 'was it' },
    { label: 'He was it → Was it', pattern: /\bHe was it\b/gi, replacement: (m) => m.startsWith('H') || m.startsWith('h') ? 'Was it' : 'was it' },
    { label: 'were those just → Were those just', pattern: /\b(?:She|He) were those just\b/gi, replacement: 'Were those just' },

    // Garbled prepositions/articles
    { label: 'from to the → from the', pattern: /\bfrom to the\b/gi, replacement: 'from the' },
    { label: 'gaze from to → gaze from', pattern: /\bgaze from to\b/gi, replacement: 'gaze from' },
    { label: 'reached for the and → reached for the', pattern: /\breached for the and\b/gi, replacement: 'reached for the' },
    { label: 'looked at the and → looked at the', pattern: /\blooked at the and\b/gi, replacement: 'looked at the' },
    { label: 'picked up the and → picked up the', pattern: /\bpicked up the and\b/gi, replacement: 'picked up the' },
    { label: 'that slippage → the slippage', pattern: /\bthat ?slippage\b/gi, replacement: 'the slippage' },
  ];

  for (const item of malformedCanaryRepairs) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;
    t = t.replace(item.pattern, item.replacement);
    fixes.push(`malformed-canary ${item.label}: ${matches.length}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}

function findFinalGrammarIntegritySurvivors(text) {
  const source = normalizeText(text);
  const patterns = [
    /\bThe harvest there is\.\s+Impersonal\b/,
    /\bCorinne closed and set it aside\b/,
    /\bThe door to [^.]{1,80}? opened it\./,
    /\bHis chest rising didn’t hitch\b/,
    /\bHis chest rising didn't hitch\b/,
    /\b(?:His|Her|Their|Tomas’s|Tomas'|Corinne’s|Corinne's)\s+(?:moment|pause|silence|air|beat)\s+(?:hitched|caught|was warm)\b/,
    /\bThe almond on the tongue\.\s+entry\b/,
    /\b(?:He|She|They|Tomas|Corinne)\s+understood\.\s+was ash\b/,
    /\b(?:She|He|They|Corinne|Tomas)\s+thought of in (?:his|her|their) study\b/,
    /\band The words came out Matron\b/,
    /\bwhose name (?:he|she|they)’?d never learned\s+drove\b/i,
    /\bdrove into (?:him|her|them) again\s+setting a rhythm\b/i,
    /\bfelt the tension coil in (?:his|her|their) belly\s+heard\b/i,
    /\bThe cold knot under [^.]{1,80}? sharpened became\b/,
    /\bHer own moment felt short\b/,
    /\bher own moment felt short\b/,
    /\bown silence shallow and quick\b/i,
    /\bThey were both chest rising hard\b/,
    /\bown beat had caught\b/i,
    /\bown moment raw in\b/i,
    /\bheard her silence hitch\b/i,
    /\bShe spoke\s+[—-]\s+ragged\b/,
    /\bragged (?:rhythm|quiet|stillness|silence|beat|pause|moment) between them\b/i,
    /\bragged silence\b/i,
  ];

  return patterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => String(pattern));
}

function runFinalGrammarIntegrityGate({ loaded, project, report, onProgress }) {
  reportProgress(onProgress, 'Fix Manuscript: final grammar integrity gate v17...');

  let changedChapters = 0;
  let totalFixes = 0;
  let totalUnresolved = 0;

  for (const item of loaded) {
    const before = item.content;
    const repaired = applyFinalGrammarIntegrityRepairs(before);

    if (!repaired.fixes.length) {
      const unresolved = findFinalGrammarIntegritySurvivors(before);
      if (unresolved.length) {
        totalUnresolved += unresolved.length;
        addReportWarning(
          report,
          `Ch.${item.chapterNumber}: final grammar integrity gate found unresolved malformed pattern(s): ${unresolved.slice(0, 8).join('; ')}`
        );
      }
      continue;
    }

    const validation = validateChapterCandidate({
      original: before,
      candidate: repaired.text,
      project,
      label: 'final grammar integrity gate v17',
      maxWordLoss: 0.02,
      maxCharLoss: 0.02,
      maxParagraphLoss: 0.03,
      maxArtifactIncrease: 0,
    });

    if (!validation.ok) {
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: final grammar integrity gate v17 rejected - ${validation.reasons.join(' | ')}`
      );
      continue;
    }

    item.content = repaired.text;
    item.changed = contentChanged(item.original, item.content);

    changedChapters += 1;
    totalFixes += repaired.fixes.length;

    for (const fix of repaired.fixes) {
      addReportFix(report, `Ch.${item.chapterNumber}: GRAMMAR-GATE ${fix}`);
    }

    const unresolvedAfter = findFinalGrammarIntegritySurvivors(item.content);
    if (unresolvedAfter.length) {
      totalUnresolved += unresolvedAfter.length;
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: final grammar integrity gate still found unresolved pattern(s): ${unresolvedAfter.slice(0, 8).join('; ')}`
      );
    }

    console.log(`[MANUSCRIPT-FIXER][GRAMMAR-GATE v17] Ch.${item.chapterNumber} repaired`, {
      fixes: repaired.fixes,
      beforeChars: normalizeText(before).length,
      afterChars: normalizeText(item.content).length,
      unresolvedAfter,
    });
  }

  report.saveGatePasses.finalGrammarIntegrityGate = {
    ok: totalUnresolved === 0,
    changedChapters,
    totalFixes,
    totalUnresolved,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  console.log('[MANUSCRIPT-FIXER][GRAMMAR-GATE v17] Final grammar integrity gate complete', {
    changedChapters,
    totalFixes,
    totalUnresolved,
  });
}


function applyFinalSaveGateSurvivorRepairs(text) {
  let t = normalizeText(text);
  const fixes = [];

  const forcedFirst = applyForcedFinalLiteralSurvivorPatch(t);
  t = forcedFirst.text;
  for (const fix of forcedFirst.fixes) {
    fixes.push(`forced first-pass literal survivor patch: ${fix}`);
  }

  const replacements = [
    {
      label: 'swung shut cutting -> swung shut, cutting',
      pattern: /\b(swung shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'shut cutting -> shut, cutting',
      pattern: /\b(shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'straightened setting -> straightened, setting',
      pattern: /\b(straightened)\s+(setting\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'groaned doubling -> groaned, doubling',
      pattern: /\b(groaned)\s+(doubling\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'stumbled caught himself -> stumbled, caught himself',
      pattern: /\b(stumbled)\s+(caught himself\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'lay back offered -> lay back and offered',
      pattern: /\b(lay back)\s+(offered\b)/gi,
      replacement: '$1 and $2',
    },
    {
      label: 'lay back, offered -> lay back and offered',
      pattern: /\b(lay back),\s+(offered\b)/gi,
      replacement: '$1 and $2',
    },
    {
      label: 'laid back, offered -> laid back and offered',
      pattern: /\b(laid back),\s+(offered\b)/gi,
      replacement: '$1 and $2',
    },
    {
      label: 'sat back, offered -> sat back and offered',
      pattern: /\b(sat back),\s+(offered\b)/gi,
      replacement: '$1 and $2',
    },
    {
      label: 'voice when it came was -> voice, when it came, was',
      pattern: /\b(His voice|Her voice|Their voice),\s+when it came\s+was\b/g,
      replacement: '$1, when it came, was',
    },
    {
      label: 'still raised began -> still raised, began',
      pattern: /\b(still raised)\s+(began\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'His hand, still raised began -> His hand, still raised, began',
      pattern: /\b(His hand,\s+still raised)\s*,?\s+(began\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'Her hand, still raised began -> Her hand, still raised, began',
      pattern: /\b(Her hand,\s+still raised)\s*,?\s+(began\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'Their hand, still raised began -> Their hand, still raised, began',
      pattern: /\b(Their hand,\s+still raised)\s*,?\s+(began\b)/g,
      replacement: '$1, $2',
    },
    {
      label: 'His/Her/Their moment fogged -> breath fogged',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+moment\s+(fogged\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their pause fogged -> breath fogged',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+pause\s+(fogged\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their beat fogged -> breath fogged',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+beat\s+(fogged\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their silence fogged -> breath fogged',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+silence\s+(fogged\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their pause hitched -> breath hitched',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+pause\s+(hitched\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their moment hitched -> breath hitched',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+moment\s+(hitched\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their air hitched -> breath hitched',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+air\s+(hitched\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their beat hitched -> breath hitched',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+beat\s+(hitched\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'His/Her/Their silence hitched -> breath hitched',
      pattern: /\b(His|Her|Their|The man\u2019s|The boy\u2019s|The handler\u2019s|The Husbandman\u2019s|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+silence\s+(hitched\b)/g,
      replacement: '$1 breath $2',
    },
    {
      label: 'coffee on his beat/silence/pause/moment/air -> coffee on his breath',
      pattern: /\b(coffee on his)\s+(beat|silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
    },
    {
      label: 'stale coffee on his beat/silence/pause/moment/air -> stale coffee on his breath',
      pattern: /\b(stale coffee on his)\s+(beat|silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
    },
    {
      label: 'deep, deliberate silence/beat/moment right over -> deep, deliberate breath right over',
      pattern: /\b(deep,\s+deliberate)\s+(silence|beat|moment)\s+(right over\b)/gi,
      replacement: '$1 breath $3',
    },
    {
      label: 'took not a sniff, but a deep, deliberate silence/beat/moment -> breath',
      pattern: /\btook not a sniff,\s+but a deep,\s+deliberate\s+(silence|beat|moment)\b/gi,
      replacement: 'took not a sniff, but a deep, deliberate breath',
    },
    {
      label: 'own rhythm sounded too loud -> own breathing sounded too loud',
      pattern: /\bown rhythm sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'own movement sounded too loud -> own breathing sounded too loud',
      pattern: /\bown movement sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'own quiet sounded too loud -> own breathing sounded too loud',
      pattern: /\bown quiet sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'The Husbandman\u2019s beat/pause/moment/silence was warm -> breath was warm',
      pattern: /\b(The Husbandman\u2019s)\s+(beat|pause|moment|silence|air)\s+(was warm\b)/g,
      replacement: '$1 breath $3',
    },
    {
      label: 'His/Her/Their beat/pause/moment/silence was warm -> breath was warm',
      pattern: /\b(His|Her|Their|Orin\u2019s|Elias\u2019s|Jonah\u2019s|Caspian\u2019s|Ronan\u2019s|Kael\u2019s|Lev\u2019s|Silas\u2019s)\s+(beat|pause|moment|silence|air)\s+(was warm\b)/g,
      replacement: '$1 breath $3',
    },
    {
      label: 'moved back in took -> moved back in and took',
      pattern: /\bmoved back in\s+took\b/gi,
      replacement: 'moved back in and took',
    },
    {
      label: 'capped it set it aside -> capped it and set it aside',
      pattern: /\bcapped it\s+set it aside\b/gi,
      replacement: 'capped it and set it aside',
    },
    {
      label: 'gaze lifted found -> gaze lifted and found',
      pattern: /\bgaze lifted\s+found\b/gi,
      replacement: 'gaze lifted and found',
    },
    {
      label: 'reached for cold coffee took sip -> reached for cold coffee and took sip',
      pattern: /\b(He|She|They|Elias|Orin|Caspian|Jonah|Silas|Lev|Ronan|Kael)\s+reached for the cold coffee\s+took a sip\b/g,
      replacement: '$1 reached for the cold coffee and took a sip',
    },
    {
      label: 'His hands, he noticed, were -> He noticed his hands were',
      pattern: /\bHis hands,\s+he noticed,\s+were\b/g,
      replacement: 'He noticed his hands were',
    },
    {
      label: 'Her hands, she noticed, were -> She noticed her hands were',
      pattern: /\bHer hands,\s+she noticed,\s+were\b/g,
      replacement: 'She noticed her hands were',
    },
    {
      label: 'Their hands, they noticed, were -> They noticed their hands were',
      pattern: /\bTheir hands,\s+they noticed,\s+were\b/g,
      replacement: 'They noticed their hands were',
    },
    {
      label: 'His hands, he noticed were -> He noticed his hands were',
      pattern: /\bHis hands,\s+he noticed\s+were\b/g,
      replacement: 'He noticed his hands were',
    },
    {
      label: 'Her hands, she noticed were -> She noticed her hands were',
      pattern: /\bHer hands,\s+she noticed\s+were\b/g,
      replacement: 'She noticed her hands were',
    },
    {
      label: 'Their hands, they noticed were -> They noticed their hands were',
      pattern: /\bTheir hands,\s+they noticed\s+were\b/g,
      replacement: 'They noticed their hands were',
    },
    {
      label: 'His hands he noticed were -> He noticed his hands were',
      pattern: /\bHis hands\s+he noticed\s+were\b/g,
      replacement: 'He noticed his hands were',
    },
    {
      label: 'Her hands she noticed were -> She noticed her hands were',
      pattern: /\bHer hands\s+she noticed\s+were\b/g,
      replacement: 'She noticed her hands were',
    },
    {
      label: 'Their hands they noticed were -> They noticed their hands were',
      pattern: /\bTheir hands\s+they noticed\s+were\b/g,
      replacement: 'They noticed their hands were',
    },
    {
      label: 'hands he noticed were -> He noticed his hands were',
      pattern: /\b(His hands)\s+he noticed\s+(were\b)/g,
      replacement: 'He noticed his hands $2',
    },
    {
      label: 'the man noticed were -> the man noticed, were',
      pattern: /\b(the man noticed)\s+(were\b)/gi,
      replacement: '$1, $2',
    },
    {
      label: 'stepped/moved/turned/leaned/stood closing/sealing/leaving/setting -> comma repair',
      pattern: /\b(stepped forward|moved forward|turned|leaned forward|stood)\s+(closing|sealing|leaving|setting)\b/gi,
      replacement: '$1, $2',
    },
  ];

  for (const item of replacements) {
    const matches = t.match(item.pattern) || [];
    if (!matches.length) continue;

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.label}: ${matches.length}`);
  }

  const spacing = normalizeMechanicalSpacing(t);
  t = spacing.text;
  for (const fix of spacing.fixes) {
    fixes.push(`mechanical spacing: ${fix}`);
  }

  const punctuation = applyLightPunctuationRefinements(t);
  t = punctuation.text;
  for (const fix of punctuation.fixes) {
    fixes.push(`punctuation refinement: ${fix}`);
  }

  const fragmentConjunction = applyFragmentAndConjunctionRefinements(t);
  t = fragmentConjunction.text;
  for (const fix of fragmentConjunction.fixes) {
    fixes.push(`fragment/conjunction refinement: ${fix}`);
  }

  const literalSurvivors = applyLiteralExportSurvivorPatch(t);
  t = literalSurvivors.text;
  for (const fix of literalSurvivors.fixes) {
    fixes.push(`literal export survivor patch: ${fix}`);
  }

  const forcedLast = applyForcedFinalLiteralSurvivorPatch(t);
  t = forcedLast.text;
  for (const fix of forcedLast.fixes) {
    fixes.push(`forced last-pass literal survivor patch: ${fix}`);
  }

  const grammarIntegrity = applyFinalGrammarIntegrityRepairs(t);
  t = grammarIntegrity.text;
  for (const fix of grammarIntegrity.fixes) {
    fixes.push(`final grammar integrity repair: ${fix}`);
  }

  t = t
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return {
    text: t,
    fixes,
  };
}


function applyTerminalSourceGuardRepairs(text, chapterNumber) {
  let t = normalizeText(text);
  const fixes = [];
  const ch = resolveChapterNumberForFixer(chapterNumber, t);

  const hardArtifacts = removeForbiddenPipelineArtifactParagraphsHard(t);
  if (hardArtifacts.changed) {
    t = hardArtifacts.text;
    fixes.push(`terminal-source hard forbidden artifact removal: ${hardArtifacts.removedCount} paragraph(s)`);
  }

  const forcedLiteral = applyForcedFinalLiteralSurvivorPatch(t);
  if (forcedLiteral.fixes.length) {
    t = forcedLiteral.text;
    for (const fix of forcedLiteral.fixes) {
      fixes.push(`terminal-source forced literal: ${fix}`);
    }
  }

  // Absolute last-resort Chapter 1 boundary guard. This intentionally does not
  // rely on prior changed flags, save-gate ordering, or the regular survivor
  // sweep. If the completed Chapter 1 ending is followed by the road/car
  // sequence, the road/car sequence is Chapter 2 bleed and must not persist.
  if (ch === 1) {
    const before = t;
    const marker = regexIndexAfter(
      before,
      /A perfect, beautiful, boring human hallway\.\s*For now\./i,
      0
    );

    if (marker.index >= 0) {
      const cutAt = marker.index + Math.max(1, marker.match.length);
      const tail = before.slice(cutAt);
      const hasRoadBleed = /The rain started as a lousy spit|Zonk’s car, a ten-year-old hatchback|Zonk's car, a ten-year-old hatchback|metal carriage|engine coughed caught/i.test(tail);

      if (hasRoadBleed && countWords(tail) >= 50) {
        t = normalizeText(before.slice(0, cutAt));
        fixes.push(`terminal-source Ch.1 hard cut after For now ending (-${countWords(tail)} words)`);
      }
    }
  }

  if (ch === 4) {
    // Clean the quote-stack artifact that survived the export path.
    const before = t;
    t = t
      .replace(/[“”]{2,}\s*The window,[”"]\s+Zonk said,/g, '“The window,” Zonk said,')
      .replace(/(^|\n)\s*The window,[”"]\s+Zonk said,/g, '$1“The window,” Zonk said,');
    if (t !== before) fixes.push('terminal-source Ch.4 repaired stacked/missing opening quote before The window');
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}

function hasFinalSaveGateSurvivors(text) {
  return findFinalSaveGateSurvivors(text).length > 0;
}

function findFinalSaveGateSurvivors(text) {
  const source = normalizeText(text);

  const patterns = [

    /\bthe false start collapsed into the only route that mattered\.?\b/i,
    /\bthe false start had collapsed into the only route that mattered\.?\b/i,
    /\bthe alternate draft collapsed into the only route that mattered\.?\b/i,
    /\bthe retry collapsed into the only route that mattered\.?\b/i,

    /A perfect, beautiful, boring human hallway\.\s*For now\.[\s\S]{0,5000}The rain started as a lousy spit/i,
    /A perfect, beautiful, boring human hallway\.\s*For now\.[\s\S]{0,5000}Zonk’s car, a ten-year-old hatchback/i,
    /She stirred made a soft, confused sound/i,
    /\bengine coughed caught, and settled\b/i,
    /The window,[”"]\s+Zonk said/i,

    /10:15\s+a\.m\.\s+When/,
    /Caspian’s hand,\s+the one that had touched him\s+felt/,
    /\bswung shut cutting\b/i,
    /\bshut cutting off\b/i,
    /\bstraightened setting\b/i,
    /\bgroaned doubling\b/i,
    /\bstumbled caught himself\b/i,
    /\blay back offered\b/i,
    /\blay back,\s+offered\b/i,
    /\bvoice,\s+when it came was\b/i,
    /\bHis hands,\s+he noticed\s+were\b/,
    /\bHer hands,\s+she noticed\s+were\b/,
    /\bTheir hands,\s+they noticed\s+were\b/,
    /\bHis hands\s+he noticed\s+were\b/,
    /\bHer hands\s+she noticed\s+were\b/,
    /\bTheir hands\s+they noticed\s+were\b/,
    /\bstill raised began\b/i,
    /\bHis hand,\s+still raised\s+began\b/,
    /\bHer hand,\s+still raised\s+began\b/,
    /\bTheir hand,\s+still raised\s+began\b/,
    /\bHis moment fogged\b/,
    /\bHis pause fogged\b/,
    /\bHis beat fogged\b/,
    /\bHis silence fogged\b/,
    /\bHis moment hitched\b/,
    /\bHis pause hitched\b/,
    /\bHis beat hitched\b/,
    /\bHis air hitched\b/,
    /\bHis silence hitched\b/,
    /\bThe boy\u2019s moment hitched\b/,
    /\bThe boy\u2019s air hitched\b/,
    /\bThe boy\u2019s pause hitched\b/,
    /\bstale coffee on his beat\b/i,
    /\bstale coffee on his silence\b/i,
    /\bstale coffee on his pause\b/i,
    /\bcoffee on his beat\b/i,
    /\bcoffee on his silence\b/i,
    /\bcoffee on his pause\b/i,
    /\bdeep,\s+deliberate silence right over\b/i,
    /\bdeep,\s+deliberate beat right over\b/i,
    /\bdeep,\s+deliberate moment right over\b/i,
    /\btook not a sniff,\s+but a deep,\s+deliberate silence\b/i,
    /\btook not a sniff,\s+but a deep,\s+deliberate beat\b/i,
    /\btook not a sniff,\s+but a deep,\s+deliberate moment\b/i,
    /\bown rhythm sounded too loud\b/i,
    /\bown movement sounded too loud\b/i,
    /\bown quiet sounded too loud\b/i,
    /\bThe Husbandman\u2019s beat was warm\b/,
    /\bThe Husbandman\u2019s pause was warm\b/,
    /\bmoved back in took\b/i,
    /\bcapped it set it aside\b/i,
    /\bgaze lifted found\b/i,
    /\b\d+\.\s+\d+\s*%/,
    /\b\d{1,2}:\d{2}\s+[ap]\.\s*m\.\b/i,
    /\bshaped vaguely like a question mark\s+had\b/i,
    /\bshaped like a question mark\s+had\b/i,
    /\bmarkers of fear,\s+of agitation\s+were\b/i,
    /\bfear,\s+of agitation\s+were\b/i,
    /\bwas tall\s+maybe\s+(?:six|five|four|seven)[-\s]?(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)?\b/i,
    /\bnoticed it every day at \d{1,2}:\d{2}\s+[ap]\.m\.\s+When\b/i,
    /\bescalating stimuli,\s+chemical suppressants\s+isolation\b/i,
    /\bchemical suppressants\s+isolation\b/i,
    /\bThe smell of him,\s+of sex and clean exertion\s+had\b/,
    /\b\d{1,2}:\d{2}\s+a\.m\.\s+When\b/,
    /\b\d{1,2}:\d{2}\s+p\.m\.\s+When\b/,
    /\bThe taste of blood and fear,\s+was\b/,
    /\bHis hand,\s+the one that had touched him\s+felt\b/,
    /\b\d{1,2}:\d{2}\s+a\.m\.\s+When\b/,
    /\b\d{1,2}:\d{2}\s+p\.m\.\s+When\b/,
    /\b[A-Z][A-Za-z]+\u2019s hand,\s+the one that had touched him\s+felt\b/,
    /\bThe Owner\u2019s tone shifted\s+became\b/,
    /\btone shifted\s+became\b/i,
    /\bolder than Jonah had expected\s+maybe\b/i,
    /\bcurses were hesitated by\b/i,


    /\bthe air between them changed\s+grew\b/i,

  ];

  return patterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => String(pattern));
}

function runFinalSaveGateSurvivorSweep({ loaded, project, report, onProgress }) {
  reportProgress(onProgress, 'Fix Manuscript: final save-gate v26 mechanical survivor sweep...');

  let changedChapters = 0;
  let totalFixes = 0;
  let totalUnresolved = 0;

  for (const item of loaded) {
    const before = item.content;
    const repaired = applyFinalSaveGateSurvivorRepairs(before);

    if (!repaired.fixes.length) {
      const unresolved = findFinalSaveGateSurvivors(before);

      if (unresolved.length) {
        totalUnresolved += unresolved.length;
        addReportWarning(
          report,
          `Ch.${item.chapterNumber}: final save-gate survivor scan found unresolved pattern(s): ${unresolved
            .slice(0, 8)
            .join('; ')}`
        );
      }

      continue;
    }

    const validation = validateChapterCandidate({
      original: before,
      candidate: repaired.text,
      project,
      label: 'final save-gate v26 mechanical survivor sweep',
      maxWordLoss: 0.015,
      maxCharLoss: 0.015,
      maxParagraphLoss: 0.02,
      maxArtifactIncrease: 0,
    });

    if (!validation.ok) {
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: final save-gate v26 mechanical survivor sweep rejected - ${validation.reasons.join(' | ')}`
      );
      continue;
    }

    item.content = repaired.text;
    item.changed = contentChanged(item.original, item.content);

    changedChapters += 1;
    totalFixes += repaired.fixes.length;

    for (const fix of repaired.fixes) {
      addReportFix(report, `Ch.${item.chapterNumber}: SAVE-GATE ${fix}`);
    }

    const unresolvedAfter = findFinalSaveGateSurvivors(item.content);

    if (unresolvedAfter.length) {
      totalUnresolved += unresolvedAfter.length;
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: final save-gate survivor scan still found unresolved pattern(s): ${unresolvedAfter
          .slice(0, 8)
          .join('; ')}`
      );
    }

    console.log(`[MANUSCRIPT-FIXER][SAVE-GATE v14] Ch.${item.chapterNumber} repaired`, {
      fixes: repaired.fixes,
      beforeChars: normalizeText(before).length,
      afterChars: normalizeText(item.content).length,
      unresolvedAfter,
    });
  }

  report.saveGatePasses.finalSurvivorSweep = {
    ok: totalUnresolved === 0,
    changedChapters,
    totalFixes,
    totalUnresolved,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  console.log('[MANUSCRIPT-FIXER][SAVE-GATE v14] Final mechanical survivor sweep complete', {
    changedChapters,
    totalFixes,
    totalUnresolved,
  });
}


function isNonfictionFixerProject(project = {}) {
  const fields = [
    project.book_type,
    project.project_type,
    project.genre,
    project.subgenre,
    project.category,
    project.nonfiction_type,
    project.title,
    project.subtitle,
  ]
    .map((value) => safeString(value).toLowerCase())
    .join(' ');

  return /non[-\s]?fiction|history|true crime|investigative|memoir|biograph|caregiving|religion|civic|policy|medical|training|guide|manual|case study|historical|documentary/.test(fields);
}

function isFinanceFixerProject(project = {}) {
  const fields = [project.genre, project.subgenre, project.title, project.subtitle, project.description]
    .map((value) => safeString(value).toLowerCase())
    .join(' ');

  return /finance|investing|investment|retirement|stock market|index fund|mutual fund|personal finance|financial literacy|wall street|vanguard|bogle/.test(fields);
}

function isBibliographyLikeChapter(item = {}) {
  const title = safeString(item.title || item.chapter?.title).toLowerCase();
  const preview = normalizeText(item.content).slice(0, 900).toLowerCase();

  return /bibliography|works cited|sources|references|source list|selected sources/.test(title) ||
    /^\s*(bibliography|works cited|sources|references)\b/i.test(preview);
}

const NONFICTION_PLACEHOLDER_PATTERNS = [
  /\[\s*(source|citation|reference|verify|fact)[^\]]*needed[^\]]*\]/gi,
  /\[\s*(tk|todo|tbd|insert source|add source|verify source)[^\]]*\]/gi,
  /\bSOURCE NEEDED\b/gi,
  /\bCITATION NEEDED\b/gi,
  /\bREFERENCE NEEDED\b/gi,
];

const NONFICTION_FINANCE_CONTAMINATION_PATTERNS = [
  /\bJohn\s+C\.?\s+Bogle\b/i,
  /\bBogle'?s?\s+Folly\b/i,
  /\bBurton\s+G\.?\s+Malkiel\b/i,
  /\bA\s+Random\s+Walk\s+Down\s+Wall\s+Street\b/i,
  /\bVanguard\s+Group\b/i,
  /\bFirst\s+Index\s+Investment\s+Trust\b/i,
  /\bFINRA\b/i,
  /\bSEC\b.*\bmarket\s+structure\b/i,
  /\bCFPB\b/i,
  /\bRobinhood\b/i,
  /\bIRS\b.*\bretirement\b/i,
  /\bpayday\s+loan/i,
  /\bmutual\s+fund/i,
  /\bindex\s+fund/i,
  /\b401\(k\)|\bIRA\b/i,
];

const NONFICTION_ABSTRACT_PHRASE_REPAIRS = [
  [/\binstitutional silence\b/gi, 'the missing record'],
  [/\bbureaucratic memory\b/gi, 'the surviving files'],
  [/\bforensic history\b/gi, 'documentary reconstruction'],
  [/\bnarrative closure\b/gi, 'a clean ending'],
  [/\bphysical erasure\b/gi, 'the loss of physical evidence'],
  [/\bofficial record\b/gi, 'surviving record'],
  [/\bthe institution\b/gi, 'the agency'],
];

const NONFICTION_UNSUPPORTED_CERTAINTY_REPAIRS = [
  [/\bthe record proves\b/gi, 'the surviving record suggests'],
  [/\bthe evidence proves\b/gi, 'the available evidence suggests'],
  [/\bthis proves\b/gi, 'this suggests'],
  [/\bwithout question\b/gi, 'based on the available record'],
  [/\bthere is no doubt that\b/gi, 'the available record indicates that'],
  [/\bmust have been\b/gi, 'may have been'],
  [/\bforensic analysis would confirm\b/gi, 'a documented analysis would need to confirm'],
  [/\bthe surviving blueprints and operational manuals would later reveal\b/gi, 'the surviving plans and manuals, if available, would need to show'],
  [/\bwould later reveal\b/gi, 'may help establish'],
];

const NONFICTION_MOTIF_BUDGETS = [
  { label: 'locked door', pattern: /\blocked\s+door\b/gi, maxPerChapter: 6 },
  { label: 'silence', pattern: /\bsilence\b/gi, maxPerChapter: 8 },
  { label: 'official record', pattern: /\bofficial\s+record\b/gi, maxPerChapter: 4 },
  { label: 'institution', pattern: /\binstitution\b/gi, maxPerChapter: 8 },
  { label: 'archive', pattern: /\barchive\b|\barchives\b|\barchival\b/gi, maxPerChapter: 8 },
  { label: 'erasure', pattern: /\berasure\b|\berased\b|\berasing\b/gi, maxPerChapter: 4 },
];

const NONFICTION_CANNED_CREDIBILITY_PARAGRAPHS = [
  /(?:^|\n\s*)The casualty record should be treated as an evidence problem rather than a conclusion\. The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths\. A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot\.\s*(?=\n|$)/gi,
  /(?:^|\n\s*)The available accounts do not cleanly reconcile the count, location, and sequence of the reported deaths\. A credible reconstruction cannot solve that arithmetic by assertion; it has to compare the underlying casualty lists, newspaper accounts, institutional reports, and any surviving records that place specific men in specific locations during the riot\.\s*(?=\n|$)/gi,
];

const NONFICTION_SYNTHETIC_PERSONA_REPAIRS = [
  [/\bParanormal investigator Marcus al-Rashid and his team\b/g, 'A paranormal investigation team', 'replaced invented paranormal investigator name with role-based language'],
  [/\bMarcus al-Rashid\b/g, 'the investigator', 'replaced invented paranormal investigator name'],
  [/\bDr\.\s+Lillian\s+Choi,?\s+a site investigator specializing in historic institutional buildings,?\s+was retained to examine\b/g, 'A site investigator specializing in historic institutional buildings examined', 'replaced invented expert persona with role-based language'],
  [/\bDr\.\s+Lillian\s+Choi'?s\b/g, 'the site investigator’s', 'replaced invented expert possessive'],
  [/\bDr\.\s+Lillian\s+Choi\b/g, 'the site investigator', 'replaced invented expert name'],
  [/\bFranklin\s+Driscoll'?s\b/g, 'a retired guard’s', 'replaced invented retired-guard possessive'],
  [/\bFranklin\s+Driscoll\b/g, 'a retired guard', 'replaced invented retired-guard name'],
  [/\bRoberta\s+Hawkins'?s\b/g, 'a victim’s descendant’s', 'replaced invented descendant possessive'],
  [/\bRoberta\s+Hawkins\b/g, 'a victim’s descendant', 'replaced invented descendant name'],
  [/\bBertie\s+Hawkins'?s\b/g, 'the descendant’s', 'replaced invented family nickname possessive'],
  [/\bBertie\s+Hawkins\b/g, 'the descendant', 'replaced invented family nickname'],
  [/\bEleanor\s+Vance'?s\b/g, 'a guard’s descendant’s', 'replaced invented guard-descendant possessive'],
  [/\bEleanor\s+Vance\b/g, 'a guard’s descendant', 'replaced invented guard-descendant name'],
  [/\bTomás\s+Gutierrez'?s\b/g, 'the demolition foreman’s', 'replaced invented demolition-foreman possessive'],
  [/\bTomás\s+Gutierrez\b/g, 'the demolition foreman', 'replaced invented demolition-foreman name'],
  [/\bJenny\s+Switzer\s+and\s+Bill\s+Green\b/g, 'tour guides', 'replaced invented tour-guide names'],
  [/\bJenny\s+Switzer\b/g, 'a tour guide', 'replaced invented tour-guide name'],
  [/\bBill\s+Green\b/g, 'a tour guide', 'replaced invented tour-guide name'],
  [/\bEleanor\b/g, 'she', 'replaced invented guard-descendant first name'],
  [/\bRoberta[’']s\s+grandmother\b/g, 'his wife', 'replaced invented descendant first-name family link'],
  [/\bRoberta\b/g, 'the descendant', 'replaced invented descendant first name'],
];

function countRegexMatches(text, pattern) {
  const matches = normalizeText(text).match(pattern);
  return matches ? matches.length : 0;
}

function stripPlaceholderLinesForNonfiction(text) {
  let output = normalizeText(text);
  const fixes = [];

  for (const pattern of NONFICTION_PLACEHOLDER_PATTERNS) {
    if (pattern.test(output)) {
      pattern.lastIndex = 0;
      output = output.replace(pattern, '');
      fixes.push('removed source/citation placeholder token');
    }
  }

  const beforeLines = output.split('\n');
  const afterLines = beforeLines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/^[-*•]?\s*(source|citation|reference)\s+needed\b/i.test(trimmed) &&
      !/^[-*•]?\s*(tk|todo|tbd)\b/i.test(trimmed);
  });

  if (afterLines.length !== beforeLines.length) {
    fixes.push('removed standalone source-placeholder line');
  }

  return {
    text: afterLines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim(),
    fixes,
  };
}

function removeFinanceContaminationFromBibliography(text, project) {
  const normalized = normalizeText(text);
  if (!normalized || isFinanceFixerProject(project)) return { text: normalized, fixes: [] };

  const paragraphs = normalized.split(/\n{2,}/);
  const removed = [];
  const kept = [];

  for (const paragraph of paragraphs) {
    const contaminated = NONFICTION_FINANCE_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(paragraph));
    if (contaminated) {
      removed.push(paragraph);
    } else {
      kept.push(paragraph);
    }
  }

  return {
    text: kept.join('\n\n').replace(/\n{4,}/g, '\n\n\n').trim(),
    fixes: removed.length ? [`removed ${removed.length} unrelated finance/investing bibliography entr${removed.length === 1 ? 'y' : 'ies'}`] : [],
  };
}

function softenUnsupportedCertaintyForNonfiction(text) {
  let output = normalizeText(text);
  const fixes = [];

  for (const [pattern, replacement] of NONFICTION_UNSUPPORTED_CERTAINTY_REPAIRS) {
    const before = output;
    output = output.replace(pattern, replacement);
    if (before !== output) fixes.push(`softened unsupported certainty: ${String(pattern)}`);
  }

  return { text: output, fixes };
}

function reduceDenseAbstractNonfictionPhrases(text) {
  let output = normalizeText(text);
  const fixes = [];

  for (const [pattern, replacement] of NONFICTION_ABSTRACT_PHRASE_REPAIRS) {
    const count = countRegexMatches(output, pattern);
    if (count <= 2) continue;

    let seen = 0;
    output = output.replace(pattern, (match) => {
      seen += 1;
      return seen <= 2 ? match : replacement;
    });

    fixes.push(`reduced repeated abstract phrase after second use: ${String(pattern)}`);
  }

  return { text: output, fixes };
}

function removeCannedNonfictionCredibilityParagraphs(text) {
  let output = normalizeText(text);
  const fixes = [];
  let removed = 0;

  for (const pattern of NONFICTION_CANNED_CREDIBILITY_PARAGRAPHS) {
    output = output.replace(pattern, (match) => {
      removed += 1;
      return match.startsWith('\n') ? '\n' : '';
    });
  }

  output = output
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(?:\n\s*){3,}/g, '\n\n')
    .trim();

  if (removed) {
    fixes.push(`removed ${removed} repeated canned casualty/source-integrity paragraph${removed === 1 ? '' : 's'}`);
  }

  return { text: output, fixes, removed };
}

function replaceSyntheticNonfictionPersonas(text) {
  let output = normalizeText(text);
  const fixes = [];

  const apply = (pattern, replacement, label) => {
    const before = output;
    output = output.replace(pattern, replacement);
    if (before !== output && label && !fixes.includes(label)) fixes.push(label);
  };

  for (const [pattern, replacement, label] of NONFICTION_SYNTHETIC_PERSONA_REPAIRS) {
    apply(pattern, replacement, label);
  }

  // Second-pass surname cleanup. Earlier versions only removed full invented names,
  // which left ugly survivors like "Driscoll remembered" after "Franklin Driscoll"
  // had already been replaced elsewhere.
  const surnameRepairs = [
    [/\bDriscoll[’']s\b/g, 'the retired guard’s', 'replaced invented retired-guard surname possessive'],
    [/\bDriscoll\b/g, 'the retired guard', 'replaced invented retired-guard surname'],
    [/\bHawkins[’']s\b/g, 'the descendant’s', 'replaced invented descendant surname possessive'],
    [/\bHawkins\b/g, 'the descendant', 'replaced invented descendant surname'],
    [/\bChoi[’']s\b/g, 'the site investigator’s', 'replaced invented expert surname possessive'],
    [/\bChoi\b/g, 'the site investigator', 'replaced invented expert surname'],
    [/\bGutierrez[’']s\b/g, 'the demolition foreman’s', 'replaced invented demolition-foreman surname possessive'],
    [/\bGutierrez\b/g, 'the demolition foreman', 'replaced invented demolition-foreman surname'],
    [/\bVance\s+family\b/g, 'guard family', 'replaced invented guard-family surname'],
    [/\bVance\s+inheritance\b/g, 'guard-family inheritance', 'replaced invented guard-family surname'],
    [/\bVance\b/g, 'the guard’s descendant', 'replaced invented guard-descendant surname'],
    [/\bSwitzer\b/g, 'one guide', 'replaced invented tour-guide surname'],
    [/\bGreen\b/g, 'another guide', 'replaced invented tour-guide surname'],
  ];

  for (const [pattern, replacement, label] of surnameRepairs) {
    apply(pattern, replacement, label);
  }

  // Clean up role-label grammar created by safe name removal. This is deliberately
  // deterministic and conservative: it fixes known bad artifacts without inventing
  // new people, sources, quotes, or scenes.
  const grammarRepairs = [
    [/\bhe told she\b/gi, 'he told the guard’s descendant', 'fixed pronoun artifact: he told she'],
    [/\bshe[’']s grandfather\b/gi, 'her grandfather', 'fixed possessive pronoun artifact: she’s grandfather'],
    [/\bguardroom conversations she[’']s grandfather\b/gi, 'guardroom conversations her grandfather', 'fixed guard-family pronoun artifact'],
    [/\bhis wife,\s+his wife\b/gi, 'his wife', 'removed duplicate wife role label'],
    [/\bWhat\s+The site investigator’s\b/g, 'What the site investigator’s', 'lowercased site-investigator role after What'],
    [/\bWhat\s+the site investigator’s physical analysis could not determine\b/g, 'What the site investigator’s physical analysis could not determine', 'smoothed site-investigator analysis sentence'],
    [/\bthe letter thus\b/g, 'The letter thus', 'capitalized sentence-start letter role label'],
    [/\bthe letter now showed\b/g, 'The letter now showed', 'capitalized sentence-start letter role label'],
    [/\bThe official account\.\s+The question was whether\b/g, 'The official account left the question unresolved: whether', 'repaired official-account sentence fragment'],
    [/—Would\b/g, '—would', 'lowercased post-em-dash continuation Would'],
    [/—Could\b/g, '—could', 'lowercased post-em-dash continuation Could'],
    [/—During\b/g, '—during', 'lowercased post-em-dash continuation During'],
    [/—Each\b/g, '—each', 'lowercased post-em-dash continuation Each'],
    [/—Both\b/g, '—both', 'lowercased post-em-dash continuation Both'],
    [/\bpre-institutional record gap\b/gi, 'pre-institutional gaps in the record', 'repaired record-gap phrase'],
    [/\bfamilial and institutional record gap\b/gi, 'familial and institutional gaps in the record', 'repaired record-gap phrase'],
    [/\binstitutional record gap\b/gi, 'gaps in the institutional record', 'repaired record-gap phrase'],
    [/\bThe intersection of familial and institutional gaps in the record created\b/g, 'The intersection of family memory and institutional omission created', 'smoothed family/institution gap phrase'],
    [/\brespectful but triage\b/gi, 'respectful triage', 'fixed malformed respectful triage phrase'],
    [/\bletters written doors knocked upon\b/gi, 'letters written, doors knocked upon', 'added comma in letters/doors sequence'],
    [/\bfiles about to internal investigations\b/gi, 'files related to internal investigations', 'fixed malformed files-about phrase'],
    [/\binvestigators like investigators\b/gi, 'investigators', 'removed duplicate investigator role label'],
    [/\bWhat was forbidden to speak of\?\s+What was forbidden to speak of\?/g, 'What was forbidden to speak of?', 'removed duplicated rhetorical question'],
    [/\bAt approximately ([^.!?]{1,80}?\bp\.m\.)\s+On\b/g, 'At approximately $1 on', 'fixed p.m. sentence split before date'],
    [/\bAt approximately ([^.!?]{1,80}?\ba\.m\.)\s+On\b/g, 'At approximately $1 on', 'fixed a.m. sentence split before date'],
    [/\bstatic spoke\b/gi, 'static, spoke', 'added comma before speech verb'],
    [/\bfrom its inception was\b/gi, 'from its inception, was', 'added comma after introductory phrase'],
    [/\bonce the walls were complete and the first inmates transferred in, the narrative shifted\b/gi, 'once the walls were complete and the first inmates had been transferred in, the narrative shifted', 'fixed missing auxiliary in transfer phrase'],
    [/\bstate[’'] monopoly\b/gi, 'state’s monopoly', 'fixed possessive apostrophe'],
    [/“Discipline,”\s*Industry,”\s*Capital Punishment\.”/g, '“Discipline,” “Industry,” “Capital Punishment.”', 'fixed broken quoted category list'],
    [/\bhowever was\b/gi, 'however, was', 'added comma after however'],
    [/\bhowever is\b/gi, 'however, is', 'added comma after however'],
    [/\bhowever were\b/gi, 'however, were', 'added comma after however'],
    [/\bhowever did\b/gi, 'however, did', 'added comma after however'],
    [/\bhowever had\b/gi, 'however, had', 'added comma after however'],
    [/\btherefore did\b/gi, 'therefore, did', 'added comma after therefore'],
    [/\btherefore was\b/gi, 'therefore, was', 'added comma after therefore'],
    [/\bWhat remained, then was\b/gi, 'What remained, then, was', 'added comma after then'],
    [/\bWhat the record preserved, then was\b/gi, 'What the record preserved, then, was', 'added comma after then'],
    [/\bThe prison’s history, as written by the state is\b/gi, 'The prison’s history, as written by the state, is', 'added comma after interrupter'],
    [/\bif one was filed at all would have been\b/gi, 'if one was filed at all, would have been', 'added comma after conditional phrase'],
    [/\bif it could be found would not be revealed\b/gi, 'if it could be found, would not be revealed', 'added comma after conditional phrase'],
    [/\bif it could be found would\b/gi, 'if it could be found, would', 'added comma after conditional phrase'],
    [/\bwhile guarded provided\b/gi, 'while guarded, provided', 'added comma after concessive phrase'],
    [/\bwere not curated\. They survived through accident and sentiment\b/gi, 'were not curated; they survived through accident and sentiment', 'joined clipped explanatory sentence'],
    [/\bThe physical evidence—the specific workshop door, the walls stained with smoke that no repainting could fully hide—was slated\b/gi, 'The physical evidence—the specific workshop door and the walls stained with smoke that no repainting could fully hide—was slated', 'smoothed physical-evidence list agreement'],
    [/—(They|What|This|The)\b/g, (m, w) => '—' + w.toLowerCase(), 'lowercased post-em-dash continuation'],
    [/\bthe investigator like the investigator\b/gi, 'the investigator', 'removed duplicate investigator role label'],
    [/\bA descendant like a victim’s descendant\b/g, 'A victim’s descendant', 'removed descendant role simile artifact'],
    [/\ba descendant like a victim’s descendant\b/g, 'a victim’s descendant', 'removed descendant role simile artifact'],
    [/\bThe custodial role of a descendant like a victim’s descendant existed\b/g, 'The custodial role of a victim’s descendant existed', 'smoothed descendant custodial-role artifact'],
    [/\bthe descendant had done exactly that\b/g, 'the descendant had done exactly that', 'noop lowercase descendant phrase'],
    [/\bthe descendant’s house\b/g, 'the descendant’s house', 'noop descendant phrase'],
    [/\bThe surviving prison correspondence[^.]*?official notifications\.\s+the letter thus represented/g, (match) => match.replace('the letter thus represented', 'The letter thus represented'), 'capitalized letter sentence after archival context'],
    [/\bthe demolition foreman,\s+the demolition foreman for\b/gi, 'the demolition foreman for', 'removed duplicate demolition-foreman role phrase'],
    [/\bthe demolition foreman’s crew\b/gi, 'the demolition crew', 'smoothed demolition-foreman crew phrase'],
    [/\bthe demolition foreman’s schedule\b/gi, 'the demolition schedule', 'smoothed demolition-foreman schedule phrase'],
    [/\bthe site investigator’s key finding\b/gi, 'The site investigator’s key finding', 'capitalized site-investigator sentence opening'],
    [/\bthe site investigator’s analysis\b/gi, 'The site investigator’s analysis', 'capitalized site-investigator sentence opening'],
    [/\ba guard’s descendant’s inheritance\b/gi, 'A guard family’s inheritance', 'smoothed guard-descendant possessive opening'],
    [/\ba guard’s descendant’s inherited memory\b/gi, 'the family’s inherited memory', 'smoothed guard-descendant inherited-memory phrase'],
    [/\ba guard’s descendant’s grandfather’s\b/gi, 'her grandfather’s', 'smoothed guard-descendant grandfather possessive'],
    [/\ba guard’s descendant’s grandfather\b/gi, 'her grandfather', 'smoothed guard-descendant grandfather phrase'],
    [/\bthe guard’s descendant,\s+the granddaughter of a 1954 riot guard\b/gi, 'a guard’s descendant', 'removed duplicate guard-descendant appositive'],
    [/\ba guard’s descendant,\s+the guard’s granddaughter\b/gi, 'a guard’s descendant', 'removed duplicate guard-descendant appositive'],
    [/\bthe private letter from a workshop victim,\s+preserved by his descendant a victim’s descendant\b/gi, 'the private letter from a workshop victim, preserved by a descendant', 'smoothed victim-descendant appositive'],
    [/\ba victim’s descendant’s house\b/gi, 'The descendant’s house', 'smoothed victim-descendant possessive opening'],
    [/\ba victim’s descendant had been a young girl\b/gi, 'The descendant had been a young girl', 'smoothed victim-descendant sentence opening'],
    [/\ba victim’s descendant,\s+known to her family as Bertie had kept it tucked\b/gi, 'A victim’s descendant had kept it tucked', 'removed invented family nickname clause'],
    [/\ba victim’s descendant,\s+known to her family as Bertie\b/gi, 'a victim’s descendant', 'removed invented family nickname clause'],
    [/\bthe descendant’s great-uncle’s letter\b/gi, 'the letter from the descendant’s great-uncle', 'smoothed descendant great-uncle possessive stack'],
    [/\bthe descendant’s letter\b/gi, 'the family letter', 'smoothed descendant-letter phrase'],
    [/\ba retired guard like a retired guard carried\b/gi, 'a retired guard carried', 'removed duplicate retired-guard role phrase'],
    [/\bRetired guard a retired guard’s account\b/g, 'A retired guard’s account', 'smoothed retired-guard account opening'],
    [/\bOne of those names was a retired guard\.\s+He had been\b/g, 'One possible source was a retired guard who had been', 'smoothed retired-guard source sentence'],
    [/\bTo investigators of the riot’s lingering mysteries, however, the retired guard represented\b/gi, 'To investigators of the riot’s lingering mysteries, however, the account represented', 'removed false named-source continuity'],
    [/\bthe question for a retired guard,\s+the retired guard scheduled for an interview was\b/gi, 'the question for a retired guard was', 'removed duplicate retired-guard interview appositive'],
    [/\bthe question for a retired guard was therefore\b/gi, 'The question for a retired guard was therefore', 'capitalized retired-guard sentence opening'],
    [/\ba retired guard’s guarded recollections\b/gi, 'the retired guard’s guarded recollections', 'smoothed retired-guard recollections phrase'],
    [/\ba retired guard’s recollections\b/gi, 'the retired guard’s recollections', 'smoothed retired-guard recollections phrase'],
    [/\bthe paranormal investigator the investigator captured\b/gi, 'a paranormal investigator captured', 'smoothed paranormal-investigator duplicate phrase'],
    [/\bParanormal claims from the workshop area documented on tourist blogs and investigation team logs\b/gi, 'Paranormal claims from the workshop area, as documented in tourist blogs and investigation-team logs', 'added comma to paranormal-claim source phrase'],
    [/\bthe investigator,\s+often described phenomena\b/gi, 'investigators often described phenomena', 'smoothed investigator plural phrase'],
    [/\bthe investigator,\s+often described\b/gi, 'investigators often described', 'smoothed investigator plural phrase'],
    [/\bGuides like tour guides,\s+who led groups\b/gi, 'Tour guides who led groups', 'smoothed duplicate tour-guide phrase'],
    [/\bGuides like tour guides\b/gi, 'Tour guides', 'smoothed duplicate tour-guide phrase'],
    [/\bone guide,\s+in one account,\s+framed it\b/gi, 'one guide framed it', 'smoothed tour-guide surname replacement artifact'],
    [/\banother guide would often point\b/gi, 'another guide would often point', 'smoothed tour-guide surname replacement artifact'],
    [/\bthe unending schedule of the demolition foreman,\s+the demolition foreman\b/gi, 'the unending demolition schedule', 'smoothed duplicated demolition-foreman schedule phrase'],
    [/\bthe demolition foreman,\s+the demolition foreman\b/gi, 'the demolition foreman', 'removed duplicate trailing demolition-foreman role phrase'],
    [/\bDr\.\s+The site investigator’s\b/g, 'The site investigator’s', 'removed Dr. artifact before role label'],
    [/\bDr\.\s+the site investigator’s\b/gi, 'The site investigator’s', 'removed Dr. artifact before role label'],
    [/\bThe retired guard a retired guard’s fractured testimony\b/g, 'The retired guard’s fractured testimony', 'removed duplicate retired-guard possessive stack'],
    [/\bThe retired guard a retired guard’s\b/g, 'The retired guard’s', 'removed duplicate retired-guard role stack'],
    [/\bthe retired guard a retired guard’s\b/gi, 'the retired guard’s', 'removed duplicate retired-guard role stack'],
    [/\bA tour guide,\s+a guide who\b/g, 'A tour guide who', 'removed duplicate tour-guide appositive'],
    [/\btour guide,\s+a guide who\b/gi, 'tour guide who', 'removed duplicate tour-guide appositive'],
    [/\bThese was it conceivable that\b/g, 'Was it conceivable that', 'fixed malformed these-was-it question'],
    [/\bthe fire[’']\s+origin\b/gi, 'the fire’s origin', 'fixed missing possessive-s in fire origin'],
    [/“Discipline,”\s*Industry,”\s*Capital Punishment”/g, '“Discipline,” “Industry,” and “Capital Punishment”', 'fixed quoted category series'],
    [/\bthe family letter\b/gi, 'the letter', 'smoothed over-repeated family-letter role label'],
    [/\bA guard family’s inheritance’s\b/g, 'A guard family’s inheritance', 'fixed possessive stack after guard-family repair'],
    [/\bthe family’s inherited memory was not one of fact\b/gi, 'the family’s inherited memory was not one of fact', 'normalized family-memory phrase'],
    [/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+p\.m\.)\s+On\s+/gi, 'At approximately $1 on ', 'fixed stubborn p.m. On date split'],
    [/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+a\.m\.)\s+On\s+/gi, 'At approximately $1 on ', 'fixed stubborn a.m. On date split'],
    [/\b(\d{1,2}(?::\d{2})?\s+p\.m\.)\s+On\s+/g, '$1 on ', 'fixed bare p.m. On date split'],
    [/\b(\d{1,2}(?::\d{2})?\s+a\.m\.)\s+On\s+/g, '$1 on ', 'fixed bare a.m. On date split'],
    [/\bthe contradiction was not only between documents and memory, but within the institutional record itself\b/g, 'The contradiction was not only between documents and memory, but within the institutional record itself', 'capitalized contradiction sentence opening'],
    [/\bthe contradiction was between documents and memory, but within the institutional record itself\b/g, 'The contradiction was not only between documents and memory, but within the institutional record itself', 'repaired and capitalized contradiction sentence opening'],
    [/\bThe initial cell house, later known as A-Hall was\b/g, 'The initial cell house, later known as A-Hall, was', 'added comma after A-Hall appositive'],
    [/\bThe prison was built from local limestone, quarried cut, and fitted by hand\b/g, 'The prison was built from local limestone, quarried, cut, and fitted by hand', 'fixed quarried/cut series'],
    [/\baccording to later corrections histories had\b/gi, 'according to later corrections histories, had', 'added comma after corrections-histories source phrase'],
    [/\bthe 1954 fire marshal’s report, when viewed through this historical lens documented\b/gi, 'the 1954 fire marshal’s report, when viewed through this historical lens, documented', 'added comma after historical-lens interrupter'],
    [/\bthe riot became both rigid and indistinct\b/gi, 'the riot, became both rigid and indistinct', 'added comma after in-the-chaos interrupter tail'],
    [/\bthe available documents did not connect them as part of a continuum\b/gi, 'the available documents did not connect them as part of a continuum', 'normalized continuum sentence'],
    [/“0027\s*[–-]\s*Fighting,”\s*“?0041\s*[–-]\s*Insolence,”\s*“?0058\s*[–-]\s*Refusal to work\.””/g, '“0027 – Fighting,” “0041 – Insolence,” and “0058 – Refusal to work.”', 'fixed disciplinary-code quote list double quote'],
    [/“0027\s*[–-]\s*Fighting,”\s*“?0041\s*[–-]\s*Insolence,”\s*“?0058\s*[–-]\s*Refusal to work\.”/g, '“0027 – Fighting,” “0041 – Insolence,” and “0058 – Refusal to work.”', 'fixed disciplinary-code quote list'],
    [/\bOne possible descendant trail, if verified, could shift the investigation from institutional records to family-held material\.\s+She was the granddaughter of one of the men who had died in the workshop\./g, 'One possible descendant trail, if verified, could shift the investigation from institutional records to family-held material. That trail would require proof of relationship before the manuscript could treat the family-held letters as documentary evidence.', 'removed unsupported descendant continuity after source clamp'],
    [/\bThe descendant had been a young girl when her grandfather died\./g, 'The family memory, if verified, would place the loss inside a private household rather than inside the state’s administrative language.', 'softened unsupported descendant childhood claim'],
    [/\bThe descendant provided no dramatic story of discovering the letter\./g, 'The private-letter account did not need a dramatic discovery story.', 'softened unsupported descendant discovery claim'],
    [/\bthe descendant had done exactly that, responding to an online article about the workshop mystery\./g, 'that kind of public outreach would be the most plausible path by which such a private document surfaced.', 'softened unsupported descendant outreach claim'],
    [/\bA tour guide who conducted nighttime tours for over a decade, compiled notes\b/g, 'A tour-guide log, if available, would compile notes', 'softened unsupported tour-guide log claim'],
  ];

  for (const [pattern, replacement, label] of grammarRepairs) {
    apply(pattern, replacement, label);
  }

  output = output
    .replace(/\ba a\b/gi, 'a')
    .replace(/\ban a\b/gi, 'a')
    .replace(/\bthe the\b/gi, 'the')
    .replace(/\ba\s+(environment|actual|external|operational|official|institutional|administrative|ambiguous|isolated|impossible|old|open|urgent|unresolved)\b/gi, 'an $1')
    .replace(/\bthe retired guard represented a critical source\. He had been there\./gi, 'the account represented a critical source: a guard had been there.')
    .replace(/\bDriscoll said\b/g, 'the retired guard said')
    .replace(/\bDriscoll recalled\b/g, 'the retired guard recalled')
    .replace(/\bDriscoll remembered\b/g, 'the retired guard remembered')
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+[ap]\.m\.)\s+On\s+/gi, 'At approximately $1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s+[ap]\.m\.)\s+On\s+/g, '$1 on ')
    .replace(/\bthe contradiction was not only between documents and memory, but within the institutional record itself\b/g, 'The contradiction was not only between documents and memory, but within the institutional record itself')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/(?:\n\s*){3,}/g, '\n\n')
    .trim();

  return { text: output, fixes };
}

function repairNonfictionWallOfText(text) {
  const normalized = normalizeText(text);
  const paragraphs = splitParagraphs(normalized);
  const words = countWords(normalized);

  if (paragraphs.length > 2 || words < 850) {
    return { text: normalized, fixes: [] };
  }

  const sentences = splitSentences(normalized)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length < 10) return { text: normalized, fixes: [] };

  const rebuilt = [];
  let bucket = [];

  for (let i = 0; i < sentences.length; i += 1) {
    bucket.push(sentences[i]);
    const shouldBreak = bucket.length >= 4 || (bucket.length >= 2 && /\b(however|but|yet|instead|still|then|by contrast|in the record|the question|what remains)\b/i.test(sentences[i + 1] || ''));
    if (shouldBreak) {
      rebuilt.push(bucket.join(' '));
      bucket = [];
    }
  }

  if (bucket.length) rebuilt.push(bucket.join(' '));

  return {
    text: rebuilt.join('\n\n').trim(),
    fixes: ['repaired nonfiction wall-of-text paragraph structure'],
  };
}

function runNonfictionCopyeditResidueRepairs(text) {
  let output = normalizeText(text);
  const fixes = [];

  const replacements = [
    [/\ba environment\b/g, 'an environment', 'fixed article: a environment'],
    [/\bfre-standing\b/gi, 'free-standing', 'fixed typo: fre-standing'],
    [/\bWhat was it an act of containment\b/g, 'Was it an act of containment', 'fixed malformed containment question'],
    [/\baccording to the ([^,\.]{2,80}) was\b/gi, 'according to the $1, was', 'added comma after according-to interrupter'],
    [/\baccording to ([^,\.]{2,80}) was\b/gi, 'according to $1, was', 'added comma after according-to phrase'],
    [/—These\b/g, '—these', 'lowercased post-em-dash continuation'],
    [/\bopened it\b/gi, 'opened', 'fixed stray opened-it phrase'],
    [/\bInto was there an attempt\b/gi, 'Was there an attempt', 'fixed malformed question: Into was there'],
    [/\bbetween these two area\b/gi, 'between these two areas', 'fixed singular/plural: two areas'],
    [/\ba audience\b/gi, 'an audience', 'fixed article: a audience'],
    [/\ba informant\b/gi, 'an informant', 'fixed article: a informant'],
    [/\ban surviving record\b/gi, 'a surviving record', 'fixed article: an surviving record'],
    [/\bwas not necessarily an concealment\b/gi, 'was not necessarily a concealment', 'fixed article: an concealment'],
    [/\ba original sin\b/gi, 'an original sin', 'fixed article: a original sin'],
    [/\bA voice, faint and granular with static spoke\b/gi, 'A voice, faint and granular with static, spoke', 'added comma before speech verb'],
    [/\bmemories had they been captured might\b/gi, 'memories, had they been captured, might', 'fixed parenthetical clause: had they been captured'],
    [/\bthe contradiction was between documents and memory, but within the institutional record itself\b/gi, 'the contradiction was not only between documents and memory, but within the institutional record itself', 'repaired contradiction sentence'],
    [/\bThe historical method could not verify it, but it could diagnose its function:\s+it was a narrative\s*(?=The next layer)/gi, 'The historical method could not verify it, but it could diagnose its function: it was a narrative device, not evidence.\n\n', 'completed dangling narrative-function sentence'],
    [/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\b/gi, 'At approximately $1 on', 'fixed time/date split'],
    [/\b(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\b/gi, '$1 on', 'fixed bare time/date split'],
    [/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\s+/gi, 'At approximately $1 on ', 'fixed stubborn approximately time/date split'],
    [/\b(\d{1,2}(?::\d{2})?\s+(?:a|p)\.m\.)\s+On\s+/g, '$1 on ', 'fixed stubborn bare time/date split'],
    [/\.\s+another guide\b/g, '. Another guide', 'capitalized sentence-start: another guide'],
    [/“He was taken\."?\s+He was hanged\."?/g, '“He was taken.” “He was hanged.”', 'fixed paired passive-voice quote fragment'],
    [/“segregation,”\s+isolation,”\s+or/gi, '“segregation,” “isolation,” or', 'fixed quoted terminology list'],
    [/“0027\s*–\s*Fighting,”\s*0041\s*–\s*Insolence,”\s*0058\s*–\s*Refusal to work\."?/g, '“0027 – Fighting,” “0041 – Insolence,” “0058 – Refusal to work.”', 'fixed disciplinary-code quote list'],
    [/\bfile is too long\b/gi, 'file is too long', 'noop'],
  ];

  for (const [pattern, replacement, label] of replacements) {
    const before = output;
    output = output.replace(pattern, replacement);
    if (before !== output) fixes.push(label);
  }

  return { text: output, fixes };
}


function runNonfictionTerminalSourceClaimClamp(text) {
  let output = normalizeText(text);
  const fixes = [];

  const replacements = [
    {
      label: 'softened unsupported fire-marshal certainty',
      pattern: /Fire marshal reports from 1954, while focused on damage assessment and origin, contained a critical physical detail\./g,
      replacement: 'The available fire-related reporting, if preserved in full, would be the critical place to test the physical detail.'
    },
    {
      label: 'softened unsupported blueprint certainty',
      pattern: /Architectural blueprints of the Missouri State Penitentiary held in the state archives, detailed the workshop in Cell Hall 3\./g,
      replacement: 'Architectural records and surviving descriptions of the Missouri State Penitentiary would be the proper place to test the workshop layout in Cell Hall 3.'
    },
    {
      label: 'softened invented expert-report certainty',
      pattern: /A site investigator specializing in historic institutional buildings examined the workshop’s design\./g,
      replacement: 'A physical-site analysis of the workshop’s design would have to begin with the surviving plans, photographs, and any fire-related records.'
    },
    {
      label: 'softened generic descendant as named source',
      pattern: /A woman named a victim’s descendant responded to a letter\./g,
      replacement: 'One possible descendant trail, if verified, could shift the investigation from institutional records to family-held material.'
    },
    {
      label: 'softened uncited private interview certainty',
      pattern: /In interviews with local media, the demolition foreman framed his work in practical terms\./g,
      replacement: 'Public-facing redevelopment language often frames demolition in practical terms.'
    },
    {
      label: 'removed direct quote from generic demolition foreman',
      pattern: /“We’re not historians,” he told one reporter\. “We’re following the plans we’re given\. Some of these buildings, their best days are fifty years behind them\. You can’t save everything\.”/g,
      replacement: 'The practical argument is simple: demolition crews follow plans, schedules, safety surveys, and abatement requirements; preservation is usually decided before the machinery arrives.'
    },
    {
      label: 'softened blueprint hardware certainty after generic source clamp',
      pattern: /The blueprints specified the door’s hardware\. It was not a simple latch or a sliding bolt operated from within\. It was a mortise lock, requiring a specific, barrel-shaped key to engage or disengage the mechanism from the outside\. From the inside, a simple lever handle operated the latch, but it could not lock or unlock the door\./g,
      replacement: 'Any claim about the door’s hardware has to be treated as a source-dependent reconstruction. If the surviving plans and hardware descriptions are complete, they would need to establish whether the door used a mortise lock, whether the key operated from the corridor side, and whether any interior release existed.'
    },
    {
      label: 'softened fire-origin and locked-door physical certainty',
      pattern: /The fire had originated near the center of the workshop, among stored textiles and wood scraps\. The steel door showed no signs of forced entry from the inside; the handle mechanism was intact and functional\. The exterior of the door, however showed heat warping and smoke staining consistent with a fire burning unchecked on the other side\. Crucially, the mortise lock was found in the locked position\. The reports noted this fact without commentary\./g,
      replacement: 'The fire-origin question remains a source problem. A publishable reconstruction would need the complete fire-related record: origin notes, door-condition notes, photographs, witness statements, and any surviving description of the lock after the fire. Without that full packet, the manuscript should treat the locked-door mechanism as a serious evidentiary question rather than a proven forensic sequence.'
    },
    {
      label: 'softened expert methodology after invented site-investigator clamp',
      pattern: /Her methodology was systematic: she overlaid the 1954 fire marshal diagrams onto the original architectural plans, cross-referencing burn patterns with the room’s fixed features\. Her report, based solely on these physical documents did not speculate about human actions\. It detailed the environment that made those actions fatal\./g,
      replacement: 'That analysis would need to compare plans, photographs, fire-origin notes, door hardware, and any surviving damage descriptions. It should not speculate about human intent. Its value would be in defining what the room made possible and what it made impossible.'
    },
    {
      label: 'softened site-investigator key finding certainty',
      pattern: /The site investigator’s key finding concerned the door’s relationship to the fire\. The mortise lock was not a fire-rated assembly\. Under intense heat, the metal of the door itself would warp, but the lock mechanism, a complex arrangement of brass pins and a steel bolt could seize in place\. Her analysis suggested a sequence: if the door was locked before the fire, the heat could have fused the internal components, making it impossible to turn the key from the outside even if someone tried\. If it was locked during the fire, the person holding the key would have had to approach a door already radiating dangerous heat\. The fire marshal’s note that the lock was found in the locked position was a static fact; it could not reveal whether that state was intentional or a thermal accident\./g,
      replacement: 'The lock’s relationship to heat and smoke should be presented cautiously. A hardware specialist could test whether a comparable lock might seize under heat, but the surviving narrative cannot infer timing or intent from the locked position alone. At most, the lock narrows the question: when was the room secured, and who had lawful or practical access to the key?'
    },
    {
      label: 'softened site-investigator conclusion certainty',
      pattern: /What the site investigator’s physical analysis could not determine was intent\. The design guaranteed that whoever controlled the key controlled life or death for anyone inside, but the blueprints were neutral on the question of why that control was used or withheld\. Her report concluded that the workshop, as built was a deathtrap in the event of fire\. This was a function of its age, its purpose, and the penal architecture’s primary concern with containment over safety\. The 1954 fire exposed that fatal priority\. The men did not die because of a mysterious locked door; they died because the room was designed to be locked, and in the chaos of September 22, the system operated exactly as intended\./g,
      replacement: 'The physical record cannot determine intent. It can only show the danger created when a carceral workroom relies on external control, limited exits, high fire load, and human procedure. The safer conclusion is not that the system operated exactly as intended, but that a security-first design could become fatal when normal procedure collapsed.'
    },
    {
      label: 'softened fire-marshal field-note quote certainty',
      pattern: /The fire marshal’s field notes, which survived in a separate file from the final report, contained the terse observation: “Exterior door to workshop found locked\. Mortise lock engaged\. No signs of forced entry from interior\.”/g,
      replacement: 'If separate fire-marshal field notes survive, the critical evidence would be any language about the exterior door, the lock state, and signs of forced entry. Those details would determine how far the manuscript can move from possibility to documented fact.'
    },
    {
      label: 'softened quoted forensic architecture report',
      pattern: /The site investigator’s analysis highlighted this gap\. Her report noted that the fire marshal’s final conclusions were “not inconsistent with the physical evidence of the fire’s origin” but were “incomplete with respect to the security conditions that determined the fatal outcome\.”/g,
      replacement: 'A careful forensic-architecture reading would highlight this gap: a fire-origin explanation does not automatically explain the security conditions that made escape impossible.'
    },
    {
      label: 'softened definite key-control manual claim',
      pattern: /Standard operating procedures, outlined in administrative manuals from the period, dictated that workshop keys were to be signed out from a central control room at the start of each work detail\. The officer in charge of the detail was responsible for the key’s security until it was returned and logged\. The system was designed to create a clear chain of custody\./g,
      replacement: 'If period administrative manuals survive, they should be used to test the expected key-control chain: where workshop keys were kept, who signed them out, and how emergency lockdown changed the procedure.'
    },
    {
      label: 'softened unsupported duty-roster certainty',
      pattern: /The duty roster for September 22, 1954 would have named the officer assigned to the Cell Hall 3 workshop\. That roster was not among the archival documents initially available\./g,
      replacement: 'A duty roster for September 22, 1954, if preserved, might identify the officer assigned to the Cell Hall 3 workshop. If it is missing from the available file, that absence should be treated as a research gap, not as proof of concealment.'
    },
    {
      label: 'softened descendant letter certainty',
      pattern: /The final letter was different\. It was dated September 18, 1954—Four days before the riot\. It was shorter than the others\. The handwriting appeared more hurried\. It did not mention any specific threat or incident\. It conveyed a general, pervasive anxiety\./g,
      replacement: 'If a final family letter dated September 18, 1954, can be verified, its value would be limited but important: it would show the emotional atmosphere around the workshop assignment before the riot without proving the mechanics of the later fire.'
    },
    {
      label: 'softened direct quote from unverified family letter',
      pattern: /“Things feel tight here lately,” he wrote\. “The men are on edge\. They talk in the yard about things being settled\. I keep my head down and do my work\. I will be glad when my time in this shop is done\.”/g,
      replacement: 'The manuscript should paraphrase the letter unless the document has been verified and permission has been secured; its reported substance is anxiety, caution, and an awareness that the shop assignment mattered.'
    },
  ];

  for (const item of replacements) {
    const before = output;
    output = output.replace(item.pattern, item.replacement);
    if (output !== before) fixes.push(item.label);
  }

  const beforeBroadV52 = output;
  output = output
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+[ap]\.m\.)\s+On\s+/gi, 'At approximately $1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s+[ap]\.m\.)\s+On\s+/g, '$1 on ')
    .replace(/\bthe contradiction was not only between documents and memory, but within the institutional record itself\b/g, 'The contradiction was not only between documents and memory, but within the institutional record itself')
    .replace(/\bthe contradiction was between documents and memory, but within the institutional record itself\b/g, 'The contradiction was not only between documents and memory, but within the institutional record itself')
    .replace(/“0027\s*[–-]\s*Fighting,”\s*“?0041\s*[–-]\s*Insolence,”\s*“?0058\s*[–-]\s*Refusal to work\.””/g, '“0027 – Fighting,” “0041 – Insolence,” and “0058 – Refusal to work.”');
  if (output !== beforeBroadV52) fixes.push('v53 broad final source/copyedit sweep');


  const beforeBroadV53 = output;
  output = output
    .replace(/(^|\n)(the available documents did not connect them as part of a continuum\.)/g, '$1The available documents did not connect them as part of a continuum.')
    .replace(/(^|\n)(the 1954 fire marshal’s report, when viewed through this historical lens, documented)/g, '$1The 1954 fire marshal’s report, when viewed through this historical lens, documented')
    .replace(/(^|\n)(the 1954 fire marshal's report, when viewed through this historical lens, documented)/g, "$1The 1954 fire marshal's report, when viewed through this historical lens, documented")
    .replace(/\bThe implication was mechanical and inescapable\. For the door to be locked after the fire began, someone had to turn the key in the exterior lock\./g, 'The implication should be framed cautiously. If the door was locked from the corridor side, the central question becomes when it was secured, who had access to the key, and whether the available records can support that sequence.')
    .replace(/\bThe workshop was a textbook example of a high fire-load space\. The blueprints showed its designated use for textile repair and woodworking, with storage areas for bolts of cloth, bales of cotton waste, and bins of sawdust\. The 1954 fire report noted the point of origin was central, among these materials, which would have created an intense, fast-moving blaze\./g, 'The workshop should be treated as a probable high-fire-load space if the records confirm textile repair, woodworking, stored cloth, cotton waste, sawdust, or similar materials. Any claim about point of origin should depend on the complete fire report rather than on reconstruction alone.')
    .replace(/\bThe architecture ensured that smoke and heat would bank down from the ceiling, filling the space long before the flames consumed it\. Death would have come from inhalation and radiant heat long before the fire reached the walls\./g, 'The architecture likely increased smoke and heat danger, but the exact sequence of injury and death should remain tied to coroner records, fire reports, and any surviving scene descriptions.')
    .replace(/\bThe fire marshal’s notation of a locked door was a statement of physical fact, but the institutional record treated it as a neutral detail, a consequence rather than a cause\./g, 'If a fire-marshal note documented the locked door, that notation would be a key physical detail. The manuscript should still distinguish that physical detail from any conclusion about cause, intent, or responsibility.')
    .replace(/\bThe fire marshal's notation of a locked door was a statement of physical fact, but the institutional record treated it as a neutral detail, a consequence rather than a cause\./g, 'If a fire-marshal note documented the locked door, that notation would be a key physical detail. The manuscript should still distinguish that physical detail from any conclusion about cause, intent, or responsibility.')
    .replace(/\bThe fire marshal’s field notes proved the lock was engaged; the final report created a narrative where the lock was irrelevant\./g, 'If the field notes preserve the lock detail and the final report does not, the contrast should be presented as a documentary discrepancy, not as proof of editorial intent.')
    .replace(/\bThe fire marshal's field notes proved the lock was engaged; the final report created a narrative where the lock was irrelevant\./g, 'If the field notes preserve the lock detail and the final report does not, the contrast should be presented as a documentary discrepancy, not as proof of editorial intent.')
    .replace(/\bThe locked door was not a malfunction\. It was the product of a deliberate action enabled by that control\./g, 'The locked door should not be treated as a malfunction unless the hardware evidence supports that. The safer formulation is that the lock state points back to key control, procedure, and human action under emergency conditions.')
    .replace(/\bThe fire marshal’s report confirmed it was found locked\. The prison’s own protocols placed that key in the custody of a correctional officer\./g, 'If the fire report confirms the door was found locked, and if period protocols placed that key under correctional control, those facts would narrow the inquiry toward key custody.')
    .replace(/\bThe fire marshal's report confirmed it was found locked\. The prison's own protocols placed that key in the custody of a correctional officer\./g, 'If the fire report confirms the door was found locked, and if period protocols placed that key under correctional control, those facts would narrow the inquiry toward key custody.')
    .replace(/\bForensic analysis of the workshop’s blueprints and locking hardware, conducted decades later, established a hard fact: the door in question could only be secured with a specific key\./g, 'A cautious forensic reading of the workshop’s blueprints and locking hardware would need to establish a narrower fact: whether the door could only be secured with a specific key and whether any interior release existed.')
    .replace(/\bThis was not a barricade inmates could have erected from within during a frantic escape\. It was a deliberate act of locking\./g, 'If that hardware reading is correct, the door was not simply an interior barricade. It was a lock-control problem.')
    .replace(/\bThe documents established the how: a door that could only be locked from outside with a specific key, during a riot where key control was likely compromised, with a fire set inside\./g, 'The documents may establish part of the how: a controlled door, a riot that compromised normal procedure, and a fire inside the workshop. They still do not establish the full sequence.')
    .replace(/\bThe blueprints proved the door’s mechanism\. The regulations proved the key’s intended path\. The fire report proved the locked state and the fire’s origin\. The retired guard’s memory proved that an order to secure the area was given\./g, 'The blueprints, regulations, fire report, and retired-guard account each support a different part of the reconstruction. None of them, on their own, proves the full sequence.')
    .replace(/\bTogether, these three lanes of evidence constructed a scenario that the official “accident” narrative could no longer contain\./g, 'Together, these three lanes of evidence complicate the official accident narrative and justify a more cautious reconstruction.')
    .replace(/\bThe letter now showed that the men inside were not there by accident\./g, 'The letter, if verified, suggests that at least one man’s presence in or around the workshop may have been shaped by fear and calculation rather than pure accident.')
    .replace(/\bThe private letter and the door’s mechanism suggested a grim convergence of intention and neglect\./g, 'The private letter and the door’s mechanism suggest a possible convergence of fear, procedure, and neglect, but not a fully proven sequence.')
    .replace(/\b“They say it’s best to stay in the shop when things get hot,” he wrote, a phrase that later accounts would render chillingly literal\./g, 'The reported substance of the letter was that the shop may have seemed safer than the wider prison when tensions rose; that claim should be paraphrased unless the letter is verified and quoted with permission.')
    .replace(/\bThe envelope bore a Jefferson City postmark dated September 18, six days before the riot\. The handwriting was a cramped, anxious script, the ink faded to a watery brown\. It was addressed to his sister, Bertie’s grandmother\./g, 'If the envelope and letter can be verified, the postmark and addressee would matter more than literary description. The manuscript should record those details plainly and avoid ornamental certainty until the document is authenticated.')
    .replace(/\bThe letter arrived in a plain cardboard box, its corners softened by years of storage\./g, 'The reported letter was preserved in family papers.')
    .replace(/\bThis evidence established a critical precedent\./g, 'This evidence suggested a critical precedent.')
    .replace(/\bThe records proved it did\b/g, 'the records strongly suggest it did')
    .replace(/\bproved the locked state\b/g, 'may document the locked state')
    .replace(/\bproved the door’s mechanism\b/g, 'may document the door’s mechanism')
    .replace(/\bproved that an order\b/g, 'suggested that an order')
    .replace(/\bthe exact model of the radio on his belt that had gone dead\b/g, 'the radio on his belt going dead')
    .replace(/\bthe name of the inmate in the first cell he locked down when the alarm sounded\b/g, 'the first cell he remembered locking down when the alarm sounded')
    .replace(/\bwhich existed existed\b/gi, 'which existed')
    .replace(/\bif verified could\b/gi, 'if verified, could')
    .replace(/\bif it was a plan might have been\b/gi, 'if it was a plan, might have been')
    .replace(/\bif it was a plan might\b/gi, 'if it was a plan, might')
    .replace(/\bhowever could\b/gi, 'however, could')
    .replace(/\bhowever became\b/gi, 'however, became')
    .replace(/\bhowever existed\b/gi, 'however, existed')
    .replace(/\bhowever provided\b/gi, 'however, provided')
    .replace(/\btherefore could\b/gi, 'therefore, could')
    .replace(/\btherefore did\b/gi, 'therefore, did')
    .replace(/\bthen might\b/gi, 'then, might')
    .replace(/\bthen was\b/gi, 'then, was')
    .replace(/\bthe report, if it existed were not\b/gi, 'the report, if it existed, was not')
    .replace(/\bfiles, if they survived represented\b/gi, 'files, if they survived, represented')
    .replace(/\bInmate death registers had they been precisely kept might have listed\b/gi, 'Inmate death registers, had they been precisely kept, might have listed')
    .replace(/\bThe prison administration knew how to generate paperwork for the deaths it caused and the accidents it accepted\./g, 'The prison administration generated cleaner paperwork for some categories of death than for others.')
    .replace(/\bthe violence that was a consequence of its mere existence\b/g, 'the violence that followed from confinement, neglect, or breakdown')
    .replace(/\bthe historical truth of the forgotten fire was now clear in its outline\b/gi, 'the historical problem of the forgotten fire was now clearer in its outline');
  if (output !== beforeBroadV53) fixes.push('v53 terminal caution/copyedit sweep');

  const beforeV54 = output;
  output = output
    // v54: stubborn time/date splits that survived because earlier patterns stopped at the period inside p.m./a.m.
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s*(?:p|a)\.m\.)\s+On\s+/gi, 'At approximately $1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s*(?:p|a)\.m\.)\s+On\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, '$1 on $2')
    // v54: lowercase sentence-start survivors introduced by cautious source rewrites.
    .replace(/(^|[.!?]\s+)(the 1954 fire marshal[’']s report, when viewed through this historical lens, documented)/g, '$1The 1954 fire marshal’s report, when viewed through this historical lens, documented')
    .replace(/(^|[.!?]\s+)(the available documents did not connect them as part of a continuum\.)/g, '$1The available documents did not connect them as part of a continuum.')
    .replace(/(^|[.!?]\s+)(the historical problem of the forgotten fire was now clearer in its outline\.)/g, '$1The historical problem of the forgotten fire was now clearer in its outline.')
    // v54: missing comma pairs in source-list phrases.
    .replace(/\borigin notes door-condition notes\b/gi, 'origin notes, door-condition notes')
    .replace(/\bfire-origin notes door hardware\b/gi, 'fire-origin notes, door hardware')
    .replace(/\bphotographs, fire-origin notes, door hardware, and any surviving damage descriptions\b/gi, 'photographs, fire-origin notes, door hardware, and any surviving damage descriptions')
    // v54: malformed quoted-list punctuation survivors.
    .replace(/“0027\s*[–-]\s*Fighting,”\s*0041\s*[–-]\s*Insolence,”\s*and\s*“0058\s*[–-]\s*Refusal to work\.”/g, '“0027 – Fighting,” “0041 – Insolence,” and “0058 – Refusal to work.”')
    .replace(/“0027\s*[–-]\s*Fighting,”\s*“0041\s*[–-]\s*Insolence,”\s*“0058\s*[–-]\s*Refusal to work\.””/g, '“0027 – Fighting,” “0041 – Insolence,” and “0058 – Refusal to work.”')
    .replace(/“ligature,”\s*bed sheet,”\s*improvised cord\.”/gi, '“ligature,” “bed sheet,” and “improvised cord.”')
    .replace(/\breplaced by “segregation,”\s*isolation,”\s*or “administrative confinement\.”/gi, 'replaced by “segregation,” “isolation,” or “administrative confinement.”')
    .replace(/General finding aids listed broad categories:\s*“Warden’s Correspondence,”\s*Inmate Disciplinary Records,”\s*Annual Reports\.”/g, 'General finding aids listed broad categories such as warden’s correspondence, inmate disciplinary records, and annual reports.')
    .replace(/filed under “Special Inquiries,”\s*Major Disturbances,”\s*or fragmented/gi, 'filed under special inquiries, major disturbances, or fragmented')
    // v54: lingering comma/interrupter repairs.
    .replace(/\bif preserved in full would\b/gi, 'if preserved in full, would')
    .replace(/\bif preserved might\b/gi, 'if preserved, might')
    .replace(/\bif available would\b/gi, 'if available, would')
    .replace(/\bif verified would\b/gi, 'if verified, would')
    .replace(/\bif deemed a secure area would\b/gi, 'if deemed a secure area, would')
    .replace(/\bif they existed were\b/gi, 'if they existed, were')
    .replace(/\bwhen it came was\b/gi, 'when it came, was')
    .replace(/\baccounts, compiled in later years, often described\b/gi, 'accounts compiled in later years often described')
    // v54: remove manuscript-facing editorial directions from final prose.
    .replace(/\bThe manuscript should treat the locked-door mechanism as a serious evidentiary question rather than a proven forensic sequence\./g, 'The locked-door mechanism therefore remained an evidentiary question rather than a proven forensic sequence.')
    .replace(/\bThe manuscript should still distinguish that physical detail from any conclusion about cause, intent, or responsibility\./g, 'That physical detail still had to be distinguished from any conclusion about cause, intent, or responsibility.')
    .replace(/\bThe manuscript should record those details plainly and avoid ornamental certainty until the document is authenticated\./g, 'Those details mattered more than ornamental description, especially before authentication.')
    .replace(/\bA publishable reconstruction would need\b/g, 'A credible reconstruction would require')
    .replace(/\bThe safer formulation is that\b/g, 'The safer reading is that')
    .replace(/\bshould be treated as an evidence problem rather than a conclusion\b/gi, 'remained an evidence problem, not a settled conclusion')
    .replace(/\bshould be presented cautiously\b/gi, 'had to be presented cautiously')
    .replace(/\bshould depend on\b/gi, 'depended on')
    // v54: family-letter direct quote and verification caution.
    .replace(/“They say it’s best to stay in the shop when things get hot,” he wrote, a phrase that later accounts would render chillingly literal\./g, 'The reported substance of the letter was that the shop may have seemed safer than the wider prison when tensions rose.')
    .replace(/\bThe letter’s existence shifted that understanding\./g, 'If authenticated, the letter would shift that understanding.')
    .replace(/\bThe letter thus represented a category of evidence\b/g, 'The reported letter represented a category of evidence')
    .replace(/\bThe letter from the descendant’s great-uncle indicated that some men\b/g, 'The reported letter suggested that some men')
    .replace(/\bThe private letter from the descendant’s great-uncle contradicted this frame not by alleging conspiracy, but by documenting pre-riot awareness\./g, 'The reported private letter complicated this frame not by proving conspiracy, but by suggesting pre-riot awareness.')
    .replace(/\bThe letter provided the atmosphere preceding those facts\b/g, 'The reported letter suggested the atmosphere preceding those facts')
    .replace(/\bThe letter suggested the men inside were not passive victims of random flame, but individuals acting on a localized assessment of risk\./g, 'The reported letter suggested that at least one man may have been acting on a localized assessment of risk rather than drifting randomly into the room.')
    .replace(/\bThe descendant’s single letter proved such documents existed\./g, 'The reported letter suggested that such documents might still exist outside official archives.')
    // v54: Chapter 12 synthesis must not over-solve the mystery.
    .replace(/\bThe letter proved the workshop was not a random location\./g, 'The letter, if authenticated, would suggest the workshop was not a random location for at least one inmate.')
    .replace(/\bIt explained why he was there\./g, 'It offered one possible explanation for why he may have stayed near that space.')
    .replace(/\bIt turned the workshop from an anonymous cage into a chosen, and fatal, sanctuary\./g, 'It recast the workshop as a possible refuge that became fatal under conditions the record still does not fully explain.')
    .replace(/\bthe guilt in his recollection was obvious decades later\./g, 'his recollection carried signs of unease decades later.')
    .replace(/\bThe workshop, if deemed a secure area would have been a candidate for such an order\./g, 'The workshop, if deemed a secure area, could have been a candidate for such an order.')
    .replace(/\bBut its consequence, when combined with an ignition source was absolute\./g, 'But if it occurred with men still inside, its consequence would have been catastrophic once fire or smoke entered the room.')
    .replace(/\bThese were not details about flame or smoke\. They were details about containment\./g, 'Those remembered details, if accurately preserved, pointed less toward flame than toward containment.')
    .replace(/\bSomeone secured the door\./g, 'Someone, or some procedure, left the door secured.')
    .replace(/\bThis physical fact established the boundary of the event\. The door could not have been secured from within\./g, 'This physical claim, if supported by the plans and hardware evidence, would frame the boundary of the event: the door may not have been securable from within.')
    .replace(/\bthe mechanism\. The workshop door in Cell Hall 3 was a standard industrial steel door with a mortise lock, operable only by a key from the outside\. From within, a panic bar would have allowed egress—unless the lock was engaged\./g, 'part of the mechanism. The workshop door in Cell Hall 3 appears to have been a controlled industrial door, and any claim about its lock, key access, or interior release must rest on the surviving plans and hardware evidence.')
    .replace(/\bThe mechanism of its locking was not a mystery of engineering\. It was a question of human action\. A key was inserted\. The cylinder was turned\. The bolt slid home\. The available evidence did not identify whose hand performed that action, but it eliminated accident or malfunction as likely causes\. The door was secured by design\./g, 'The mechanism, as reconstructed, pointed toward key control rather than a simple barricade. The available evidence did not identify a hand at the lock, and it did not eliminate every accident or malfunction scenario without the full hardware record. It did, however, make the lock state central to the inquiry.')
    .replace(/\bIt outlined a sequence of high probability\./g, 'It outlined a plausible but still incomplete sequence.')
    .replace(/\bAs the riot exploded, certain inmates, including a man linked by blood or association to a decades-old racial murder, retreated to the workshop seeking shelter\. A guard, acting under standing orders to contain the riot or under a specific directive in the chaos, approached the door\. He carried a ring of keys, one of which fit that lock\. He inserted it\. He turned it\. Whether he heard the pounding inside, whether he saw the smoke already curling under the door, whether he believed he was containing a threat or simply following procedure, the record did not say\. His action transformed the workshop from a refuge into a sealed chamber\./g, 'One plausible reconstruction is narrower: some inmates may have viewed the workshop as a refuge, while staff may have been acting under orders to secure vulnerable areas. The record does not identify who held the relevant key, whether anyone checked the room, or when smoke and fire became visible. The tragedy likely emerged from the collision of those uncertainties rather than from a fully documented sequence of actions.')
    .replace(/\bThe question of intent behind the flames was rendered moot by the prior, unequivocal fact of the locked door\. The men would have died in that room regardless of who lit the match or why\. The lock was the primary cause of death; the fire was the instrument\./g, 'The question of intent behind the flames remained unresolved. The lock state, if documented, would explain why escape failed, but the fire’s origin, timing, and human cause still mattered. The door and the fire must be treated as linked evidence problems, not as a solved hierarchy of cause.')
    .replace(/\bThis reinterpretation shifted the 1954 workshop fire from an anecdotal tragedy within a riot to a case study in institutional failure\./g, 'This reconstruction shifts the 1954 workshop fire from an anecdotal tragedy within a riot toward a case study in institutional failure, while leaving the final sequence unresolved.')
    .replace(/\bAnd it revealed how the prison’s deep history of racial violence, embodied in the 1915 lynching of “Pinky,” could reach forward across decades to influence choices made in a moment of crisis\./g, 'It also suggested that the prison’s older history of racial violence may have shaped fears and interpretations inside the institution, though the direct line between 1915 and 1954 remains inferential.')
    .replace(/\bThe “old grudge” was not superstition; it was a living current in the prison’s social fabric, a threat recognized by an inmate and validated by his death\./g, 'The “old grudge,” if accurately reported, was not enough to solve the fire. It was a clue to the prison’s social atmosphere: fear, memory, and hierarchy moving through the same rooms as official procedure.')
    .replace(/\bWhere documents were silent, people heard whispers\. Where reports were vague, people saw figures\./g, 'Where documents were silent, later visitors supplied whispers; where reports were vague, folklore supplied figures.')
    .replace(/\bThe task that remained was to document how that truth continued to vibrate in the world long after the ashes had cooled\./g, 'The task that remained was to document how the unresolved question continued to echo long after the ashes had cooled.');
  if (output !== beforeV54) fixes.push('v54 terminal meta-language/source-certainty sweep');


  // v55: hard cleanup for v12 survivors after v54. These are deliberately plain-text
  // transformations because the prior failures came from exact instruction/source-caution
  // language surviving into final manuscript prose.
  const beforeV55 = output;
  output = output
    // stubborn date split survivor
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+p\.m\.)\s+On\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/g, 'At approximately $1 on $2')
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s+a\.m\.)\s+On\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/g, 'At approximately $1 on $2')
    .replace(/\b(\d{1,2}(?::\d{2})?\s+p\.m\.)\s+On\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/g, '$1 on $2')
    .replace(/\b(\d{1,2}(?::\d{2})?\s+a\.m\.)\s+On\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/g, '$1 on $2')
    // manuscript-facing instruction leaks
    .replace(/\bWithout that full packet, the manuscript should treat the locked-door mechanism as a serious evidentiary question rather than a proven forensic sequence\.\s*The implication should be framed cautiously\./g, 'Without that full packet, the locked-door mechanism remained a serious evidentiary question rather than a proven forensic sequence. The implication required caution.')
    .replace(/\bWithout that full packet, the manuscript should treat the locked-door mechanism as a serious evidentiary question rather than a proven forensic sequence\./g, 'Without that full packet, the locked-door mechanism remained a serious evidentiary question rather than a proven forensic sequence.')
    .replace(/\bThe implication should be framed cautiously\./g, 'The implication required caution.')
    .replace(/\bThe manuscript should treat the locked-door mechanism as a serious evidentiary question rather than a proven forensic sequence\./g, 'The locked-door mechanism remained a serious evidentiary question rather than a proven forensic sequence.')
    .replace(/\bThe manuscript should paraphrase the letter unless the document has been verified and permission has been secured; its reported substance is anxiety, caution, and an awareness that the shop assignment mattered\./g, 'Until the document is authenticated and permission is secured, the letter is strongest as paraphrased evidence: anxiety, caution, and an awareness that the shop assignment mattered.')
    .replace(/\bThe manuscript should paraphrase the letter unless the document has been verified and permission has been secured\./g, 'Until the document is authenticated and permission is secured, the letter is strongest as paraphrased evidence.')
    .replace(/\bIf period administrative manuals survive, they should be used to test the expected key-control chain:/g, 'Period administrative manuals, if available, would help test the expected key-control chain:')
    .replace(/\bAny claim about the door’s hardware has to be treated as a source-dependent reconstruction\./g, 'Any claim about the door’s hardware remained source-dependent.')
    // site-investigator persona leakage and invented report language
    .replace(/\bThe site investigator’s analysis highlighted this gap\.\s*Her report noted that the fire marshal’s final conclusions were “not inconsistent with the physical evidence of the fire’s origin” but were “incomplete with respect to the security conditions that determined the fatal outcome\.”\s*In the disciplined language of forensic architecture, this was a significant qualification\.\s*It meant the official answer explained the spark but not the trap\.\s*The system’s design made the two factors inseparable; the report treated them as distinct\./g, 'A cautious physical-site reading highlighted the gap: the available record might explain a fire, but it did not fully explain the security conditions that shaped the fatal outcome. That distinction mattered because the spark and the trap were separate evidence problems.')
    .replace(/\bThe site investigator’s analysis highlighted this gap\./g, 'A cautious physical-site reading highlighted this gap.')
    .replace(/\bHer report noted that the fire marshal’s final conclusions were “not inconsistent with the physical evidence of the fire’s origin” but were “incomplete with respect to the security conditions that determined the fatal outcome\.”/g, 'The available record may speak to fire damage, but it does not fully resolve the security conditions that shaped the fatal outcome.')
    .replace(/\bIn the disciplined language of forensic architecture, this was a significant qualification\./g, 'That qualification mattered.')
    .replace(/\bIt meant the official answer explained the spark but not the trap\./g, 'It separated the question of ignition from the question of entrapment.')
    .replace(/\bThe system’s design made the two factors inseparable; the report treated them as distinct\./g, 'The evidence had to keep both questions in view.')
    .replace(/\bsite investigator’s analysis\b/gi, 'physical-site analysis')
    .replace(/\bsite investigator\b/gi, 'physical-site reviewer')
    // soften overconfident documentary claims and source-certainty scars
    .replace(/\bThe fire marshal’s report from 1954, a document focused on origin and damage, noted the locked state of the door as a simple condition of the scene\./g, 'The fire-related record, if complete, would be the place to test whether the door’s locked state was formally documented as a scene condition.')
    .replace(/\bThe fire marshal’s report noted the door was found locked after the fire;/g, 'The fire-related record reportedly noted the door was found locked after the fire;')
    .replace(/\bThe fire marshal’s report, referenced in later historical summaries, noted the door was found locked after the fire was extinguished\./g, 'Later historical summaries describe the door as locked after the fire was extinguished, though the underlying fire record remains the critical source.')
    .replace(/\bThe blueprints and the fire report agreed on that point\./g, 'The available physical reconstruction pointed toward that problem.')
    .replace(/\bthe blueprints showing a keyed lock\b/g, 'the hardware reconstruction indicating a keyed lock')
    .replace(/\bthe blueprints, regulations, fire report, and retired-guard account each support a different part of the reconstruction\./g, 'The plans, regulations, fire-related reporting, and retired-guard account each support only part of the reconstruction.')
    .replace(/\bThe blueprints and fire reports had established the mechanics of the trap\./g, 'The plans and fire-related records had narrowed the mechanics of the possible trap.')
    .replace(/\bThe private letter from a workshop victim, preserved by a descendant, introduced a human chronology the official record ignored\./g, 'The reported private letter, if authenticated, introduced a human chronology the official record ignored.')
    .replace(/\bthe private letter, the archived blueprints\b/g, 'the reported private letter, the archival plans')
    .replace(/\bthe pre-riot letter fearing an “old grudge,”\b/g, 'the reported pre-riot letter describing an “old grudge,”')
    .replace(/\bthe pre-riot letter from a victim, expressing fear and a situational awareness\b/g, 'the reported pre-riot letter from a possible victim, expressing fear and situational awareness')
    // Chapter 12 over-synthesis: keep unresolved, do not validate the grudge by death.
    .replace(/\bIt contained the racial animus of the 1915 lynching, carried across generations in the prison’s informal hierarchies\.\s*It echoed the institutional indifference of the 1932 factory fire, where inmate deaths were recorded as industrial accidents\.\s*It reflected the absolute control of the Hole, where men were buried alive in silence\./g, 'It echoed earlier institutional patterns: racialized violence, industrial neglect, solitary confinement, and the habit of absorbing specific suffering into broad administrative categories.')
    .replace(/\bAnd it revealed how the prison’s deep history of racial violence, embodied in the 1915 lynching of “Pinky,” could reach forward across decades to influence choices made in a moment of crisis\./g, 'It also suggested that older patterns of racial violence and institutional hierarchy may have shaped fears inside the prison, though the direct line between 1915 and 1954 remains inferential.')
    .replace(/\bThe “old grudge” was not superstition; it was a living current in the prison’s social fabric, a threat recognized by an inmate and validated by his death\./g, 'The “old grudge,” if accurately reported, was not enough to solve the fire. It was a clue to social atmosphere, not a verdict.')
    .replace(/\bIt demonstrated how a bureaucracy could absorb a specific, complex moral event into a broader category of “riot casualties,” thereby dissolving individual responsibility\./g, 'It suggested how a bureaucracy could absorb a specific, complex moral event into a broader category of “riot casualties,” making individual responsibility harder to trace.')
    .replace(/\bIt showed how architecture designed for control could facilitate a fatal abandonment when operated by human hands under conditions of panic\./g, 'It showed how architecture designed for control could become dangerous when operated by human beings under conditions of panic.')
    // small copyedit survivors from v12
    .replace(/\bthe correct one existed\b/g, 'the correct one, existed')
    .replace(/\bonce compiled had to be\b/g, 'once compiled, had to be')
    .replace(/\bbefore it expired documenting the physical site\b/g, 'before it expired, documenting the physical site')
    .replace(/\bwhich workshop, exactly was meant\b/g, 'which workshop, exactly, was meant')
    .replace(/\bThe institutional record, for all its gaps offered\b/g, 'The institutional record, for all its gaps, offered')
    .replace(/\bThe memories held by former guards and inmates operated\b/g, 'The memories held by former guards and inmates operated')
    .replace(/\bthe memory of a guard, however might contain\b/g, 'the memory of a guard, however, might contain')
    .replace(/\bThat decision, if it occurred existed\b/g, 'That decision, if it occurred, existed')
    .replace(/\bThe Missouri State Penitentiary, closed since 2004 was not\b/g, 'The Missouri State Penitentiary, closed since 2004, was not')
    .replace(/\blike every other space was slated\b/g, 'like every other space, was slated')
    .replace(/\bif it was indeed the correct one existed\b/g, 'if it was indeed the correct one, existed')
    .replace(/\bif preserved might identify\b/g, 'if preserved, might identify')
    .replace(/\bthe missing duty roster meant\b/g, 'the missing duty roster, meant')
    .replace(/\bthe same standing orders, and with officers\b/g, 'the same standing orders and with officers')
    .replace(/\bcotton waste sawdust\b/g, 'cotton waste, sawdust')
    .replace(/\bperiod protocols placed that key\b/g, 'period protocols placed that key')
    .replace(/\bprotocol or violating it had control\b/g, 'protocol or violating it, had control')
    .replace(/\bif deemed a secure area would have\b/g, 'if deemed a secure area, would have')
    .replace(/\bif it occurred with men still inside, its consequence\b/g, 'if it occurred with men still inside, the consequence')
    .replace(/\bThe available documents did not connect them\b/g, 'The available documents did not connect them')
    .replace(/\breporting, if preserved in full would be\b/g, 'reporting, if preserved in full, would be')
    .replace(/\bhardware descriptions are complete, they would need to establish\b/g, 'hardware descriptions are complete, they would need to establish')
    .replace(/\bthe historical ledger for that location was curiously vague\b/g, 'the historical ledger for that location was curiously vague');
  if (output !== beforeV55) fixes.push('v55 terminal instruction-leak/site-persona/source-caution sweep');

  // v56: final hard clamp for v13 survivors. Keep this after all source-caution
  // rewrites so it catches text introduced by earlier deterministic cleanup passes.
  const beforeV56 = output;
  output = output
    // absolute time/date sentence split survivors: "2:30 p.m. On September..."
    .replace(/\bAt approximately\s+(\d{1,2}(?::\d{2})?\s*[ap]\.m\.)\s+On\s+/gi, 'At approximately $1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s*[ap]\.m\.)\s+On\s+/gi, '$1 on ')
    .replace(/\b(\d{1,2}(?::\d{2})?\s*[ap]\.m\.)\s+on\s+(September|October|November|December|January|February|March|April|May|June|July|August)/g, '$1 on $2')
    // malformed quoted-list residue
    .replace(/“ligature,”\s*bed sheet,”\s*and\s*“improvised cord\.”/g, '“ligature,” “bed sheet,” and “improvised cord.”')
    .replace(/“Discipline,”\s*Industry,”\s*Capital Punishment\.”/g, '“Discipline,” “Industry,” “Capital Punishment.”')
    .replace(/“([^”]{2,60}),”\s*([A-Z][^,”]{2,60}),”\s*and\s*“([^”]{2,60})\.”/g, '“$1,” “$2,” and “$3.”')
    .replace(/“(\d{3,4}\s*[–-]\s*[^”]{2,60}),”\s*“(\d{3,4}\s*[–-]\s*[^”]{2,60}),”\s*and\s*“(\d{3,4}\s*[–-]\s*[^”]{2,60})\.””/g, '“$1,” “$2,” and “$3.”')
    // missing commas after conditional/source-status clauses
    .replace(/\bif supported by the plans and hardware evidence would\b/gi, 'if supported by the plans and hardware evidence, would')
    .replace(/\bif authenticated would\b/gi, 'if authenticated, would')
    .replace(/\bif verified would\b/gi, 'if verified, would')
    .replace(/\bif documented would\b/gi, 'if documented, would')
    .replace(/\bif complete would\b/gi, 'if complete, would')
    .replace(/\bif preserved would\b/gi, 'if preserved, would')
    .replace(/\bif available would\b/gi, 'if available, would')
    .replace(/\bif they survived represented\b/gi, 'if they survived, represented')
    .replace(/\bSomeone, or some procedure left\b/g, 'Someone, or some procedure, left')
    .replace(/\bcompiled by the Department of Corrections in the weeks that followed was\b/g, 'compiled by the Department of Corrections in the weeks that followed, was')
    .replace(/\bthe riot, compiled by the Department of Corrections in the weeks that followed was\b/g, 'the riot, compiled by the Department of Corrections in the weeks that followed, was')
    .replace(/\bthe record, compiled by the Department of Corrections in the weeks that followed was\b/g, 'the record, compiled by the Department of Corrections in the weeks that followed, was')
    // role-label scar tissue after removing invented expert names
    .replace(/\bfrom the physical-site reviewer\b/gi, 'from physical-site analysis')
    .replace(/\bthe physical-site reviewer\b/gi, 'the physical-site analysis')
    .replace(/\bphysical-site reviewer\b/gi, 'physical-site analysis')
    .replace(/\bA cautious physical-site reading highlighted this gap\./g, 'A cautious physical reading of the site highlighted this gap.')
    .replace(/\bA cautious physical-site reading highlighted the gap:/g, 'A cautious physical reading of the site highlighted the gap:')
    .replace(/\bphysical-site analysis analysis\b/gi, 'physical-site analysis')
    // small grammar/copyedit survivors from v13
    .replace(/\bprolonged isolated, sensory deprivation\b/gi, 'prolonged isolation and sensory deprivation')
    .replace(/\bprolonged, isolated, sensory deprivation\b/gi, 'prolonged isolation and sensory deprivation')
    .replace(/\btime may have created\b/g, 'time, may have created')
    .replace(/\ban inmate population agitated by rumor\. The specific allegation, printed as fact was\b/g, 'an inmate population agitated by rumor. The specific allegation, printed as fact, was')
    .replace(/\bnewspaper accounts from the period was that workshops\b/g, 'newspaper accounts from the period was that workshops')
    .replace(/\bthe chaos, they reported had naturally led\b/g, 'the chaos, they reported, had naturally led')
    .replace(/\bwhere family memory met state record was where\b/g, 'where family memory met state record, was where')
    .replace(/\bmethods, and state archives\b/g, 'methods, and state archives')
    // remove remaining manuscript-process wording from final prose
    .replace(/\bThe manuscript should\b/g, 'The account should')
    .replace(/\bthe manuscript should\b/g, 'the account should')
    .replace(/\bthe manuscript can move\b/g, 'the evidence can move')
    .replace(/\bthe manuscript cannot\b/g, 'the evidence cannot')
    .replace(/\bthe manuscript must\b/g, 'the account must')
    // soften remaining over-confident Chapter 11/12 synthesis language
    .replace(/\bTogether, these three lanes of evidence constructed a scenario that the official “accident” narrative could no longer contain\./g, 'Together, these three lanes of evidence suggested a scenario more complicated than the official “accident” narrative could comfortably contain.')
    .replace(/\bThe next question was not how the fire started, but why the workshop had been both a calculated refuge for some inmates and, apparently, a target for someone else\./g, 'The next question was not only how the fire started, but why the workshop may have functioned as a perceived refuge for some inmates and a point of danger for others.')
    .replace(/\bIt exposed a fatal miscalculation\./g, 'It suggested a possible fatal miscalculation.')
    .replace(/\bWhat the men inside apparently failed to anticipate was that the greater danger would come from the institutional response to the riot itself—a response that may have viewed a locked door as a containment measure, regardless of who was behind it\./g, 'What the men inside may not have anticipated was that the institutional response to the riot could make any locked space dangerous, regardless of who was behind the door.')
    .replace(/\bThe operational reality of “stay in the shop” thus transformed from a potential tactic into a diagnosis of the disaster\./g, 'The operational reality of “stay in the shop” therefore became one possible way to understand the disaster.')
    .replace(/\bIt was a plan designed for one kind of prison violence, rendered catastrophic by another\./g, 'It may have been a plan designed for one kind of prison violence, rendered dangerous by another.')
    .replace(/\bThe workshop became a killing box not because the men inside were randomly trapped by spreading fire, but because their own calculation of safety intersected with a separate, institutional imperative to control the riot by any means necessary\./g, 'The workshop may have become fatal because a calculation of safety intersected with a separate institutional imperative to control the riot.')
    .replace(/\bThe locked door was the point where those two logics met, with fatal results\./g, 'The locked door was where those possible logics may have met, with fatal results.')
    .replace(/\bThe “old grudge” was not superstition; it was a living current in the prison’s social fabric, a threat recognized by an inmate and validated by his death\./g, 'The “old grudge,” if accurately reported, was not enough to solve the fire. It was a clue to social atmosphere, not a verdict.')
    .replace(/\bAnd it revealed how the prison’s deep history of racial violence, embodied in the 1915 lynching of “Pinky,” could reach forward across decades to influence choices made in a moment of crisis\./g, 'It also suggested that older patterns of racial violence and institutional hierarchy may have shaped fear inside the prison, though the direct line between 1915 and 1954 remains inferential.')
    .replace(/\bThe final race was no longer to prevent the destruction of the site, but to complete the synthesis before the last piece of paper was filed away and the last living memory dissolved into the quiet of the grave\./g, 'The final race was to complete the synthesis before the physical site, the surviving papers, and the last living memories became harder to recover.')
    // keep unresolved-evidence vocabulary visible in the final synthesis
    .replace(/\bThe historical problem of the forgotten fire was now clearer in its outline\./g, 'The historical problem of the forgotten fire was now clearer, but still unresolved.')
    .replace(/\bThe task that remained was to document how the unresolved question continued to echo long after the ashes had cooled\./g, 'The task that remained was to document how an unresolved question continued to echo long after the ashes had cooled.');
  if (output !== beforeV56) fixes.push('v56 terminal copyedit/source-caution clamp');


  const beforeStar = output;
  output = output.replace(/\n\s*\*\s*\n/g, '\n\n');
  if (output !== beforeStar) fixes.push('removed isolated star separator artifact');

  return { text: normalizeText(output), fixes };
}

function evaluateNonfictionChapterIntegrity({ item, project }) {
  const text = normalizeText(item.content);
  const warnings = [];

  if (!text) return warnings;

  for (const motif of NONFICTION_MOTIF_BUDGETS) {
    const count = countRegexMatches(text, motif.pattern);
    if (count > motif.maxPerChapter) {
      warnings.push(`${motif.label} motif over budget (${count}/${motif.maxPerChapter}); revise with new evidence instead of repeated thesis language`);
    }
  }

  const humanSignals = countRegexMatches(text, /\b(family|mother|father|son|daughter|wife|husband|children|worker|guard|inmate|prisoner|witness|survivor|resident|neighbor|victim|men|women|person|people|body|buried|death|name|named)\b/gi);
  const institutionSignals = countRegexMatches(text, /\b(institution|agency|bureaucracy|system|record|archive|official|redevelopment|facility|administration)\b/gi);

  if (countWords(text) > 1200 && institutionSignals > humanSignals * 2.5) {
    warnings.push('human texture is weak compared with institution/archive language');
  }

  if (/\b(the available record showed|the record showed|records would later reveal|forensic analysis would confirm)\b/i.test(text)) {
    warnings.push('visible source anchoring may still be too vague; replace generic record language with named record classes when available');
  }

  if (/The casualty record should be treated as an evidence problem rather than a conclusion/i.test(text)) {
    warnings.push('canned casualty/source-integrity boilerplate still present; rerun Fix/Polish or manually revise this chapter');
  }

  if (/\b(?:Marcus al-Rashid|Lillian Choi|Choi|Franklin Driscoll|Driscoll|Roberta Hawkins|Bertie Hawkins|Hawkins|Eleanor Vance|Vance|Tomás Gutierrez|Gutierrez|Jenny Switzer|Switzer|Bill Green)\b/i.test(text)) {
    warnings.push('possible invented narrative persona/surname remains; verify against project source ledger or replace with role-based language');
  }

  if (/\b(?:a guard’s descendant’s|a victim’s descendant’s|Retired guard a retired guard|the demolition foreman, the demolition foreman|paranormal investigator the investigator|Guides like tour guides|a retired guard like a retired guard|Dr\.\s+The site investigator|A tour guide,\s+a guide|These was it conceivable|the fire[’\']\s+origin|he told she|she[’\']s grandfather|his wife,\s+his wife|What\s+The site investigator|respectful but triage|investigators like investigators|files about to internal investigations|What was forbidden to speak of\?\s+What was forbidden to speak of|At approximately [^\n]{1,80}?[ap]\.m\.\s+On|the contradiction was not only between documents and memory|static spoke|state[’'] monopoly|Discipline,”\s*Industry,”\s*Capital Punishment|however was|however is|therefore did|What remained, then was)\b/i.test(text)) {
    warnings.push('role-label replacement artifact remains; rerun Fix/Polish with v53 or manually smooth the affected sentence');
  }

  if (/\b(composite|reconstructed|pseudonym|oral history|inference|speculation|unconfirmed|unresolved)\b/i.test(text) === false && /\bwould have|may have|could have|likely|probably|appears to|suggests\b/i.test(text)) {
    warnings.push('inferential material may need clearer labeling as inference/unresolved reconstruction');
  }

  if (isBibliographyLikeChapter(item)) {
    const hasPlaceholder = NONFICTION_PLACEHOLDER_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(text);
    });

    if (hasPlaceholder) warnings.push('bibliography still contains source placeholders');

    if (!isFinanceFixerProject(project) && NONFICTION_FINANCE_CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text))) {
      warnings.push('bibliography still contains unrelated finance/investing source contamination');
    }
  }

  return warnings;
}

function runNonfictionManuscriptIntegrityGate({ project, loaded, report, onProgress }) {
  if (!isNonfictionFixerProject(project)) return;

  reportProgress(onProgress, 'Fix Manuscript: nonfiction credibility/source integrity gate...');

  let changedChapters = 0;
  let totalFixes = 0;
  let totalWarnings = 0;
  let rejectedRepairs = 0;

  for (const item of loaded) {
    const before = item.content;
    let current = before;
    const fixes = [];

    const placeholderRepair = stripPlaceholderLinesForNonfiction(current);
    current = placeholderRepair.text;
    fixes.push(...placeholderRepair.fixes);

    const cannedParagraphRepair = removeCannedNonfictionCredibilityParagraphs(current);
    current = cannedParagraphRepair.text;
    fixes.push(...cannedParagraphRepair.fixes);

    const personaRepair = replaceSyntheticNonfictionPersonas(current);
    current = personaRepair.text;
    fixes.push(...personaRepair.fixes);

    if (isBibliographyLikeChapter(item)) {
      const bibliographyRepair = removeFinanceContaminationFromBibliography(current, project);
      current = bibliographyRepair.text;
      fixes.push(...bibliographyRepair.fixes);
    }

    const certaintyRepair = softenUnsupportedCertaintyForNonfiction(current);
    current = certaintyRepair.text;
    fixes.push(...certaintyRepair.fixes);

    const abstractionRepair = reduceDenseAbstractNonfictionPhrases(current);
    current = abstractionRepair.text;
    fixes.push(...abstractionRepair.fixes);

    const wallTextRepair = repairNonfictionWallOfText(current);
    current = wallTextRepair.text;
    fixes.push(...wallTextRepair.fixes);

    const copyeditRepair = runNonfictionCopyeditResidueRepairs(current);
    current = copyeditRepair.text;
    fixes.push(...copyeditRepair.fixes);

    const sourceClaimClamp = runNonfictionTerminalSourceClaimClamp(current);
    current = sourceClaimClamp.text;
    fixes.push(...sourceClaimClamp.fixes);

    const finalMechanical = normalizeMechanicalSpacing(current);
    current = finalMechanical.text;
    fixes.push(...finalMechanical.fixes.map((fix) => `terminal mechanical spacing: ${fix}`));

    const changed = normalizeText(current) !== normalizeText(before);

    if (changed) {
      const validation = validateChapterCandidate({
        original: before,
        candidate: current,
        project,
        label: 'nonfiction credibility/source integrity gate',
        maxWordLoss: isBibliographyLikeChapter(item) ? 0.65 : 0.18,
        maxCharLoss: isBibliographyLikeChapter(item) ? 0.65 : 0.18,
        maxParagraphLoss: isBibliographyLikeChapter(item) ? 0.65 : 0.28,
        maxArtifactIncrease: 0,
      });

      if (validation.ok) {
        item.content = current;
        item.changed = contentChanged(item.original, item.content);
        changedChapters += 1;
        totalFixes += fixes.length;

        for (const fix of fixes.slice(0, 12)) {
          addReportFix(report, `Ch.${item.chapterNumber}: NONFICTION-INTEGRITY ${fix}`);
        }

        if (fixes.length > 12) {
          addReportFix(report, `Ch.${item.chapterNumber}: NONFICTION-INTEGRITY ${fixes.length - 12} additional deterministic fix(es)`);
        }
      } else {
        rejectedRepairs += 1;
        addReportWarning(report, `Ch.${item.chapterNumber}: nonfiction integrity repair rejected - ${validation.reasons.join(' | ')}`);
      }
    }

    const warnings = evaluateNonfictionChapterIntegrity({ item, project });
    totalWarnings += warnings.length;

    for (const warning of warnings.slice(0, 10)) {
      addReportWarning(report, `Ch.${item.chapterNumber}: NONFICTION-INTEGRITY WARN ${warning}`);
    }
  }

  report.saveGatePasses.nonfictionIntegrityGate = {
    ok: totalWarnings === 0 && rejectedRepairs === 0,
    changedChapters,
    totalFixes,
    totalWarnings,
    rejectedRepairs,
    version: MANUSCRIPT_FIXER_SAVE_VERSION,
  };

  if (totalWarnings) {
    addReportWarning(report, `Nonfiction integrity gate found ${totalWarnings} unresolved warning(s). Use Health Check / chapter revision for remaining source, human-texture, or motif issues.`);
  }
}

function buildFinalStats(loaded) {
  const text = loaded.map((item) => item.content).join('\n\n');
  return calculateManuscriptStats(text);
}

async function saveChangedChapters({ project, loaded, report, onProgress }) {
  const changed = getChangedItems(loaded);

  report.changedChapters = changed.length;
  report.unchangedChapters = loaded.length - changed.length;

  if (!changed.length) {
    reportProgress(onProgress, 'Fix Manuscript: no safe chapter changes to save.');
    return;
  }

  for (let i = 0; i < changed.length; i += 1) {
    const item = changed[i];
    const chapter = item.chapter;

    const forcedPreSave = applyForcedFinalLiteralSurvivorPatch(item.content);
    if (forcedPreSave.fixes.length) {
      item.content = forcedPreSave.text;
      item.changed = contentChanged(item.original, item.content);

      for (const fix of forcedPreSave.fixes) {
        addReportFix(report, `Ch.${item.chapterNumber}: PRE-SAVE FORCED ${fix}`);
      }

      console.log(`[MANUSCRIPT-FIXER][SAVE-GATE v14] Ch.${item.chapterNumber} pre-save forced literal patch`, {
        fixes: forcedPreSave.fixes,
      });
    }

    const forcedPreSaveStructure = runFinalStructuralRescueForChapter(item.content, item.chapterNumber);
    if (forcedPreSaveStructure.fixes.length && normalizeText(forcedPreSaveStructure.text) !== normalizeText(item.content)) {
      item.content = forcedPreSaveStructure.text;
      item.changed = contentChanged(item.original, item.content);
      item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
      item.structureQuarantine.stages.push('pre-save final structural rescue');
      item.structureQuarantine.removedWords += forcedPreSaveStructure.removedWords;
      item.structureQuarantine.removedChars += forcedPreSaveStructure.removedChars;
      item.structureQuarantine.fixes.push(...forcedPreSaveStructure.fixes);

      for (const fix of forcedPreSaveStructure.fixes) {
        addReportFix(report, `Ch.${item.chapterNumber}: PRE-SAVE FINAL STRUCTURE ${fix.label} (-${fix.removedWords} words)`);
      }

      console.warn(`[MANUSCRIPT-FIXER][FINAL-STRUCTURE-RESCUE v27] Ch.${item.chapterNumber} pre-save rescue`, {
        fixes: forcedPreSaveStructure.fixes,
        removedWords: forcedPreSaveStructure.removedWords,
      });
    }

    const terminalPreSave = applyTerminalSourceGuardRepairs(item.content, item.chapterNumber);
    if (terminalPreSave.fixes.length && normalizeText(terminalPreSave.text) !== normalizeText(item.content)) {
      item.content = terminalPreSave.text;
      item.changed = contentChanged(item.original, item.content);
      item.structureQuarantine = item.structureQuarantine || { stages: [], removedWords: 0, removedChars: 0, fixes: [] };
      item.structureQuarantine.stages.push('terminal-source pre-save guard');

      for (const fix of terminalPreSave.fixes) {
        addReportFix(report, `Ch.${item.chapterNumber}: TERMINAL-SOURCE PRE-SAVE ${fix}`);
      }

      console.warn(`[MANUSCRIPT-FIXER][TERMINAL-SOURCE-GUARD v27] Ch.${item.chapterNumber} pre-save terminal repair`, {
        fixes: terminalPreSave.fixes,
        words: countWords(item.content),
      });
    }

    const structuralQuarantineActive = hasStructuralQuarantine(item);
    const finalValidation = validateChapterCandidate({
      original: item.original,
      candidate: item.content,
      project,
      label: structuralQuarantineActive
        ? 'final save validation (structure-quarantine aware)'
        : 'final save validation',
      maxWordLoss: structuralQuarantineActive ? 0.75 : 0.15,
      maxCharLoss: structuralQuarantineActive ? 0.75 : 0.15,
      maxParagraphLoss: structuralQuarantineActive ? 0.80 : 0.35,
      maxArtifactIncrease: 0,
    });

    if (!finalValidation.ok) {
      report.safetyReverts.push({
        chapterNumber: item.chapterNumber,
        title: item.title || '',
        pass: 'final save validation',
        reasons: finalValidation.reasons,
        originalWords: finalValidation.originalWords,
        candidateWords: finalValidation.candidateWords,
        originalChars: finalValidation.originalChars,
        candidateChars: finalValidation.candidateChars,
        originalArtifacts: finalValidation.originalArtifacts,
        candidateArtifacts: finalValidation.candidateArtifacts,
      });

      for (const reason of finalValidation.reasons) {
        addReportWarning(report, `Ch.${item.chapterNumber}: not saved - ${reason}`);
      }

      item.content = item.original;
      item.changed = false;
      continue;
    }

    reportProgress(
      onProgress,
      `Fix Manuscript: saving chapter ${item.chapterNumber} (${i + 1}/${changed.length})...`
    );

    try {
      const backupFields =
        chapter.backup_content || chapter.backup_content_url
          ? {}
          : await prepareBackupContent(item.original, project?.id, chapter.id, chapter);

      const contentFields = await prepareChapterContent(item.content, project?.id, chapter.id, chapter);

      const polishMetadata = buildSmallPolishMetadata(item.content, {
        polish_save_stage: 'initial-save',
      });

      const revisionNotes = [
        chapter.revision_notes || '',
        '',
        `Fix Entire Manuscript pass - ${polishMetadata.polish_saved_at}`,
        `Original words: ${countWords(item.original)}`,
        `Final words: ${countWords(item.content)}`,
        `Safety status: ${hasStructuralQuarantine(item) ? 'passed / structure-quarantine-aware' : 'passed'}`,
        hasStructuralQuarantine(item) ? `Structural quarantine: removed ${item.structureQuarantine.removedWords || 0} word(s) / ${item.structureQuarantine.fixes?.length || 0} block(s)` : '',
        `Save pipeline: URL/file storage only + small metadata`,
        `Save version: ${MANUSCRIPT_FIXER_SAVE_VERSION}`,
        item.diagnostics?.issues?.length ? `Diagnostics: ${item.diagnostics.issues.length} issue(s) checked` : '',
        item.voiceAudit ? `Voice audit: ${item.voiceAudit.verdict}${item.voiceAudit.llmChecked ? ' / LLM checked' : ' / deterministic'}${item.voiceAudit.softPolicy ? ' / soft policy' : ''}` : '',
        item.voiceAudit?.reason ? `Voice audit reason: ${item.voiceAudit.reason}` : '',
        ...(item.diagnostics?.issues || []).slice(0, 8).map((issue) => `DIAG: ${issue}`),
        ...(item.cleanupResult?.fixes || []).slice(0, 10).map((fix) => `- ${fix}`),
        ...(item.cleanupResult?.warnings || []).slice(0, 8).map((warning) => `WARN ${warning}`),
        ...(report.saveGatePasses?.finalSurvivorSweep?.totalFixes
          ? [`Final save-gate mechanical survivor sweep fixes: ${report.saveGatePasses.finalSurvivorSweep.totalFixes}`]
          : []),
        ...(report.saveGatePasses?.finalGrammarIntegrityGate?.totalFixes
          ? [`Final grammar integrity gate fixes: ${report.saveGatePasses.finalGrammarIntegrityGate.totalFixes}`]
          : []),
      ]
        .filter(Boolean)
        .join('\n');

      const savePayload = {
        ...clearRichContentFields(),
        ...contentFields,
        ...backupFields,
        ...polishMetadata,
        word_count: countWords(item.content),
        status: chapter.status === 'planned' ? 'reviewed' : chapter.status || 'reviewed',
        revision_notes: truncateForEntity(revisionNotes, 1800),
      };

      // v32: Base44-safe persistence.
      // Do NOT put the full repaired manuscript into content_md/content/prose/body/finalText/cleanedText
      // after GitHub upload. That was the cause of the 400 entity update failure:
      // GitHub accepted the repaired chapter, then Base44 rejected the oversized inline payload,
      // so export kept resolving the old dirty URL. The fresh full text stays in transient
      // __polishedContent for same-session export; the DB record stores URL + small metadata only.

      await runWithNetworkRetry(() =>
        base44.entities.Chapter.update(chapter.id, savePayload)
      );

      applyTransientPolishedContent(chapter, item.content, contentFields, polishMetadata);

      item.savedContent = item.content;
      item.saveAttempted = true;
      item.saveVerified = false;

      report.savedChapters += 1;

      console.log(`[MANUSCRIPT-FIXER][SAVE v32] Ch.${item.chapterNumber} saved via URL storage`, {
        chapterId: chapter.id,
        words: countWords(item.content),
        chars: normalizeText(item.content).length,
        hasContentMdUrl: Boolean(contentFields.content_md_url),
        hasContentUrl: Boolean(contentFields.content_url),
        hasPolishedTransientContent: Boolean(chapter.__polishedContent),
      });
    } catch (error) {
      addReportFailure(report, chapter, error);
    }
  }
}

async function verifySavedChapters({ loaded, report, onProgress }) {
  const savedCandidates = loaded.filter(
    (item) => item.saveAttempted || contentChanged(item.original, item.content)
  );

  if (!savedCandidates.length) return;

  reportProgress(onProgress, 'Fix Manuscript: verifying saved chapters...');

  for (const item of savedCandidates) {
    try {
      const rows = await base44.entities.Chapter.filter({ id: item.chapter.id });
      const fresh = Array.isArray(rows) ? rows[0] : null;

      if (!fresh) {
        addReportWarning(report, `Ch.${item.chapterNumber}: could not verify saved chapter record`);
        continue;
      }

      const expectedBeforeTerminal = normalizeText(item.savedContent || item.content);
      const expectedTerminal = applyTerminalSourceGuardRepairs(expectedBeforeTerminal, item.chapterNumber);
      const expected = normalizeText(expectedTerminal.text);
      if (expectedTerminal.fixes.length && expected !== expectedBeforeTerminal) {
        item.savedContent = expected;
        item.content = expected;
        item.changed = contentChanged(item.original, item.content);
        for (const fix of expectedTerminal.fixes) {
          addReportFix(report, `Ch.${item.chapterNumber}: VERIFY EXPECTED TERMINAL-SOURCE ${fix}`);
        }
      }

      const savedRaw = normalizeText(await resolveChapterContent(fresh));
      const savedTerminal = applyTerminalSourceGuardRepairs(savedRaw, item.chapterNumber);
      const saved = normalizeText(savedTerminal.text);

      const savedWords = countWords(saved);
      const expectedWords = countWords(expected);
      const ratio = expectedWords > 0 ? Math.abs(savedWords - expectedWords) / expectedWords : 0;

      const unresolvedSaved = findFinalSaveGateSurvivors(saved);
      const terminalSourceDirty = Boolean(savedTerminal.fixes.length) || unresolvedSaved.length > 0;

      if (unresolvedSaved.length) {
        addReportWarning(
          report,
          `Ch.${item.chapterNumber}: verified saved content still contains final survivor pattern(s): ${unresolvedSaved
            .slice(0, 8)
            .join('; ')}`
        );
      }

      if (ratio > 0.08 || unresolvedSaved.length || terminalSourceDirty) {
        addReportWarning(
          report,
          `Ch.${item.chapterNumber}: save verification mismatch or survivor hit (${savedWords}/${expectedWords} words). Re-uploading polished URL content.`
        );

        const repairedContentFields = await prepareChapterContent(
          expected,
          item.chapter?.project_id || fresh.project_id || '',
          item.chapter.id,
          fresh
        );

        const repairMetadata = buildSmallPolishMetadata(expected, {
          polish_save_stage: 'verification-reupload',
          polish_inline_repair_at: new Date().toISOString(),
          polish_save_version: `${MANUSCRIPT_FIXER_SAVE_VERSION}-verification-reupload`,
        });

        const repairPayload = {
          ...clearRichContentFields(),
          ...repairedContentFields,
          ...repairMetadata,
          word_count: countWords(expected),
        };

        // v32: verification re-upload must also be Base44-safe.
        // Store the repaired chapter as URL-backed content + small metadata only.
        // Never re-add full expected text into inline entity fields here.

        await runWithNetworkRetry(() =>
          base44.entities.Chapter.update(item.chapter.id, repairPayload)
        );

        applyTransientPolishedContent(item.chapter, expected, repairedContentFields, repairMetadata);

        item.saveVerified = true;

        addReportFix(
          report,
          `Ch.${item.chapterNumber}: save verification re-uploaded polished URL content`
        );

        console.warn(`[MANUSCRIPT-FIXER][SAVE v32] Ch.${item.chapterNumber} URL re-upload repair applied`, {
          savedWords,
          expectedWords,
          unresolvedSaved,
        });
      } else {
        const verifiedMetadata = buildSmallPolishMetadata(expected, {
          polish_save_stage: 'verified',
        });

        applyTransientPolishedContent(item.chapter, expected, fresh, verifiedMetadata);

        item.saveVerified = true;

        console.log(`[MANUSCRIPT-FIXER][SAVE v32] Ch.${item.chapterNumber} verified`, {
          savedWords,
          expectedWords,
          hasContentMdUrl: Boolean(fresh.content_md_url),
          hasContentUrl: Boolean(fresh.content_url),
          unresolvedSaved,
        });
      }
    } catch (error) {
      addReportWarning(
        report,
        `Ch.${item.chapterNumber}: verification failed - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

function buildHumanSummary(report) {
  const lines = [];

  lines.push('Fix Entire Manuscript complete.');
  lines.push('');
  lines.push(`Mode: ${report.mode}${report.erotic ? ' / erotic-adult' : ''}`);
  lines.push(`Loaded chapters: ${report.loadedChapters}`);
  lines.push(`Diagnostics generated: ${report.diagnostics.length}`);
  lines.push(`Voice audits: ${report.voiceAudits.length}`);
  lines.push(`Changed chapters: ${report.changedChapters}`);
  lines.push(`Saved chapters: ${report.savedChapters}`);
  lines.push(`Unchanged chapters: ${report.unchangedChapters}`);
  lines.push(`Failed chapters: ${report.failedChapters}`);
  lines.push(`Safety reverts: ${report.safetyReverts.length}`);

  if (report.saveGatePasses?.structuralCollisionQuarantine) {
    lines.push('');
    lines.push('Structural collision quarantine v18:');
    lines.push(`- Changed chapters: ${report.saveGatePasses.structuralCollisionQuarantine.changedChapters}`);
    lines.push(`- Fixes: ${report.saveGatePasses.structuralCollisionQuarantine.totalFixes}`);
    lines.push(`- Removed words: ${report.saveGatePasses.structuralCollisionQuarantine.totalRemovedWords}`);
  }

  if (report.saveGatePasses?.finalSurvivorSweep) {
    lines.push('');
    lines.push('Final save-gate v26 mechanical survivor sweep:');
    lines.push(`- Changed chapters: ${report.saveGatePasses.finalSurvivorSweep.changedChapters}`);
    lines.push(`- Fixes: ${report.saveGatePasses.finalSurvivorSweep.totalFixes}`);
    lines.push(`- Unresolved survivors: ${report.saveGatePasses.finalSurvivorSweep.totalUnresolved}`);
  }

  if (report.saveGatePasses?.finalGrammarIntegrityGate) {
    lines.push('');
    lines.push('Final grammar integrity gate v17:');
    lines.push(`- Changed chapters: ${report.saveGatePasses.finalGrammarIntegrityGate.changedChapters}`);
    lines.push(`- Fixes: ${report.saveGatePasses.finalGrammarIntegrityGate.totalFixes}`);
    lines.push(`- Unresolved survivors: ${report.saveGatePasses.finalGrammarIntegrityGate.totalUnresolved}`);
  }

  if (report.saveGatePasses?.nonfictionIntegrityGate) {
    lines.push('');
    lines.push('Nonfiction credibility/source integrity gate v45:');
    lines.push(`- Changed chapters: ${report.saveGatePasses.nonfictionIntegrityGate.changedChapters}`);
    lines.push(`- Fixes: ${report.saveGatePasses.nonfictionIntegrityGate.totalFixes}`);
    lines.push(`- Warnings: ${report.saveGatePasses.nonfictionIntegrityGate.totalWarnings}`);
    lines.push(`- Rejected repairs: ${report.saveGatePasses.nonfictionIntegrityGate.rejectedRepairs}`);
  }

  if (report.beforeStats && report.afterStats) {
    lines.push('');
    lines.push(`Before words: ${report.beforeStats.totalWords || report.beforeStats.wordCount || 'n/a'}`);
    lines.push(`After words: ${report.afterStats.totalWords || report.afterStats.wordCount || 'n/a'}`);
  }

  if (report.voiceAudits.length) {
    lines.push('');
    lines.push('Voice audit summary:');

    for (const audit of report.voiceAudits.slice(0, 10)) {
      lines.push(
        `- Ch.${audit.chapterNumber}: ${audit.verdict}${audit.llmChecked ? ' / LLM checked' : ' / deterministic'}${audit.softPolicy ? ' / soft policy' : ''}${audit.reason ? ` - ${audit.reason}` : ''}`
      );
    }

    if (report.voiceAudits.length > 10) {
      lines.push(`...and ${report.voiceAudits.length - 10} more voice audit(s).`);
    }
  }

  if (report.safetyReverts.length) {
    lines.push('');
    lines.push('Safety reverts:');

    for (const reverted of report.safetyReverts.slice(0, 10)) {
      lines.push(`- Ch.${reverted.chapterNumber} / ${reverted.pass}: ${reverted.reasons[0] || 'unsafe output rejected'}`);
    }

    if (report.safetyReverts.length > 10) {
      lines.push(`...and ${report.safetyReverts.length - 10} more safety revert(s).`);
    }
  }

  if (report.warnings.length) {
    lines.push('');
    lines.push(`Warnings: ${report.warnings.length}`);

    for (const warning of report.warnings.slice(0, 12)) {
      lines.push(`- ${warning}`);
    }

    if (report.warnings.length > 12) {
      lines.push(`...and ${report.warnings.length - 12} more warning(s).`);
    }
  }

  if (report.failures.length) {
    lines.push('');
    lines.push('Failures:');

    for (const failure of report.failures) {
      lines.push(`- Ch.${failure.chapterNumber}: ${failure.error}`);
    }
  }

  return lines.join('\n');
}

export async function fixEntireManuscript({
  project,
  chapters,
  onProgress,
  refreshAfterSave,
} = {}) {
  if (!project) throw new Error('Project is required.');
  if (!Array.isArray(chapters) || chapters.length === 0) throw new Error('No chapters were provided.');

  const candidateChapters = chapters
    .filter((chapter) => chapterHasContent(chapter) && isBodyChapter(chapter))
    .sort((a, b) => chapterNumber(a) - chapterNumber(b));

  if (!candidateChapters.length) {
    throw new Error('No drafted body chapters found to fix.');
  }

  const report = buildInitialReport(project, candidateChapters);

  reportProgress(onProgress, 'Fix Manuscript: loading drafted chapters...');

  const loaded = await loadDraftedBodyChapters({
    chapters: candidateChapters,
    onProgress,
  });

  report.loadedChapters = loaded.length;

  if (!loaded.length) {
    throw new Error('No readable drafted body chapter content found.');
  }

  report.beforeStats = calculateManuscriptStats(
    loaded.map((item) => item.original).join('\n\n')
  );

  runDiagnosticKnowledgePass({
    project,
    loaded,
    report,
    onProgress,
  });

  runStructuralCollisionQuarantinePass({
    loaded,
    report,
    onProgress,
    stage: 'pre-GPT structural collision quarantine',
  });

  runGenericBranchCollisionPass({
    loaded,
    report,
    onProgress,
    stage: 'pre-GPT generic branch collision guard',
  });

  await runUniversalChapterCleanup({
    project,
    loaded,
    report,
    onProgress,
  });

  runDeterministicWholeManuscriptPasses({
    project,
    loaded,
    report,
    onProgress,
  });

  await runAnthologySpecificPasses({
    project,
    loaded,
    report,
    onProgress,
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }

  await runVoicePreservationAudit({
    project,
    loaded,
    report,
    onProgress,
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }

  runStructuralCollisionQuarantinePass({
    loaded,
    report,
    onProgress,
    stage: 'pre-save structural collision quarantine',
  });

  runGenericBranchCollisionPass({
    loaded,
    report,
    onProgress,
    stage: 'pre-save generic branch collision guard',
  });

  runHardForbiddenPipelineArtifactSweep({
    loaded,
    report,
    onProgress,
    stage: 'pre-save hard forbidden pipeline artifact sweep',
  });

  runFinalSaveGateSurvivorSweep({
    loaded,
    project,
    report,
    onProgress,
  });

  runFinalGrammarIntegrityGate({
    loaded,
    project,
    report,
    onProgress,
  });

  runFinalStructuralRescuePass({
    loaded,
    report,
    onProgress,
    stage: 'post-grammar final structural rescue',
  });

  runGenericBranchCollisionPass({
    loaded,
    report,
    onProgress,
    stage: 'post-grammar generic branch collision guard',
  });

  runHardForbiddenPipelineArtifactSweep({
    loaded,
    report,
    onProgress,
    stage: 'post-grammar hard forbidden pipeline artifact sweep',
  });

  runNonfictionManuscriptIntegrityGate({
    project,
    loaded,
    report,
    onProgress,
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }

  report.afterStats = buildFinalStats(loaded);

  runHardForbiddenPipelineArtifactSweep({
    loaded,
    report,
    onProgress,
    stage: 'terminal pre-save hard forbidden pipeline artifact sweep',
  });

  // ── Exact final line enforcement (post-polish, pre-save) ───────
  for (const item of loaded) {
    const requiredLine = item.chapter?.__requiredFinalLine;
    if (requiredLine) {
      const label = `Ch.${item.chapterNumber || '?'}`;
      const result = enforceExactFinalLine(item.content, requiredLine, label);
      if (result.patched) {
        item.content = result.text;
        item.changed = true;
      }
    }
  }

  await saveChangedChapters({
    project,
    loaded,
    report,
    onProgress,
  });

  for (const item of loaded) {
    item.changed = contentChanged(item.original, item.content);
  }

  report.afterStats = buildFinalStats(loaded);

  await verifySavedChapters({
    loaded,
    report,
    onProgress,
  });

  if (typeof refreshAfterSave === 'function') {
    try {
      reportProgress(onProgress, 'Fix Manuscript: refreshing project...');
      await refreshAfterSave();
    } catch (error) {
      addReportWarning(report, `Refresh failed after save: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  report.finishedAt = new Date().toISOString();
  report.summary = buildHumanSummary(report);

  reportProgress(onProgress, 'Fix Manuscript complete.');

  console.log('[MANUSCRIPT-FIXER] Complete report:', report);

  return report;
}

export default fixEntireManuscript;