/**
 * Universal Post-Draft Cleanup
 *
 * Used after chapter drafting and by full-manuscript polish/fix workflows.
 *
 * Goals:
 * - Fix obvious mechanical issues without changing story content.
 * - Repair genuinely malformed/truncated sentences when safe.
 * - Preserve voice, heat level, scene order, and paragraph rhythm.
 * - Return compatibility fields expected by ProjectStudio and polish tools.
 *
 * Important 2026-05-02 update:
 * - Adds a final hard-survivor repair pass at the absolute end.
 * - This pass runs AFTER the LLM, AFTER malformed sentence repair, AFTER final hygiene,
 *   and AFTER the normal micro-copyedit pass.
 * - Purpose: prevent known malformed phrase families from surviving into export.
 */

import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { shouldUppercaseAfterPunct } from '@/lib/safeUppercase';
import { scrubModelLeaks } from '@/lib/modelLeakGuard'; // LEAKFIX-1
import { isNonfictionProject as isNonfictionProjectAuthority } from '@/lib/projectType'; // NFCLASS-2
import { resolveProseRepairs, EMPTY_PROSE_REPAIRS } from '@/lib/bookScrubRules'; // PROSEGUARD-1

const POST_DRAFT_CLEANUP_VERSION = 'PROSEGUARD-1 REPAIR-ONLY-WHAT-YOU-CAN-PROVE-IS-BROKEN - 2026-08-05';

console.log(`[POST-DRAFT] postDraftCleanup.js loaded: ${POST_DRAFT_CLEANUP_VERSION}`);

/* PROSEGUARD-1 — the active project's prose repairs.
 *
 * The repair chain here is six functions deep (runSurgicalArtifactRepair ->
 * repairMalformedArticlesAndFragments -> deterministicSentenceRepair ->
 * commonNounArticleRepair) with eleven call sites, none of which currently carry the
 * project. Rather than thread a parameter through all of them, the entry point sets
 * this once and clears it in a finally block.
 *
 * That is safe here and only here: this app runs one LLM call at a time by hard rule,
 * cleanupChapterBatch is a sequential for-loop, and postDraftCleanup is never invoked
 * concurrently. The default is EMPTY, so a caller that forgets to set it gets no
 * rewriting at all rather than another book's rules — the failure mode is "does
 * nothing", never "corrupts someone else's manuscript".
 */
let proseRepairs = EMPTY_PROSE_REPAIRS;

/* PROSEGUARD-1 — the "known broken phrase" detectors are derived, not hand-written.
 *
 * Three places used to carry their own copy of the same alternation of one book's
 * broken sentences (a detector inside the malformed-pattern list, a branch in
 * classifyMalformedSentence, and buildSurvivorWarning) — the divergent-authority
 * shape again: three lists, free to drift, all naming a manuscript nobody is writing.
 * They now derive from the repair bank itself, so a phrase is "known broken" exactly
 * when this project has a rule that repairs it. No rules, no findings.
 */
function knownBrokenPhraseSources() {
  return [
    ...proseRepairs.microCopyedit.map((r) => r.pattern?.source),
    ...proseRepairs.hardSurvivor.map((r) => r.pattern?.source),
    ...proseRepairs.phraseRepairs.map(([rx]) => rx?.source),
  ].filter(Boolean);
}

// A regex that can never match, for when the project has no repair bank. Deliberately
// not an empty alternation — that matches everything.
const MATCHES_NOTHING = /(?!)/;

function knownBrokenPhraseRx() {
  const sources = knownBrokenPhraseSources();
  if (!sources.length) return MATCHES_NOTHING;
  try {
    return new RegExp(`(?:${sources.join('|')})`, 'gi');
  } catch (err) {
    console.warn(`[PROSEGUARD-1] could not build the known-broken-phrase detector: ${err.message}`);
    return MATCHES_NOTHING;
  }
}

function matchesKnownBrokenPhrase(value) {
  const rx = knownBrokenPhraseRx();
  rx.lastIndex = 0;
  return rx.test(String(value || ''));
}

function extractText(value) {
  if (value == null) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join('\n\n');
  }

  if (typeof value === 'object') {
    const direct =
      value.text ??
      value.prose ??
      value.content ??
      value.cleanedText ??
      value.finalText ??
      value.body ??
      value.output ??
      value.result ??
      value.response ??
      value.completion ??
      value.generated_text ??
      value.generatedText ??
      value.message?.content ??
      value.choices?.[0]?.message?.content ??
      value.choices?.[0]?.text ??
      value.data?.text ??
      value.data?.content ??
      value.data?.prose ??
      value.data?.message?.content;

    if (direct != null && direct !== value) {
      const extracted = extractText(direct);
      if (extracted) return extracted;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }

  return '';
}

function normalizeText(text) {
  return extractText(text)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text) {
  return String(text || '').match(/[^.!?…]+[.!?…]["”’)]*|[^.!?…]+$/g) || [];
}

function getLastSentence(paragraph) {
  const p = String(paragraph || '').trim();
  if (!p) return '';

  const matches = splitSentences(p);
  if (!matches.length) return p;

  return matches[matches.length - 1].trim();
}

// NFCLASS-2: this file used to carry its own opinion of what "nonfiction" means
// (a raw equality check against book_type, with a project_type fallback, each
// compared to the literal string "nonfiction"). It disagreed with
// the authority in BOTH directions: it called a declared-fiction project carrying
// project_type 'nonfiction' nonfiction, and it called { genre: 'Memoir' } with
// nothing declared fiction. What hangs off this boolean is the NONFICTION RULES
// block ("Do not invent facts, names, dates, quotes, citations, statistics, or
// sources") in the copyedit prompt — a wrong answer here runs a nonfiction
// manuscript through a copyedit pass with the anti-fabrication constraint missing.
function projectIsNonfiction(project = {}) {
  return isNonfictionProjectAuthority(project);
}

function projectIsAnthology(project = {}) {
  return String(project.project_type || '').toLowerCase() === 'anthology';
}

function projectIsErotic(project = {}) {
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

function isLikelyHeading(line) {
  const trimmed = String(line || '').trim();

  if (!trimmed) return false;
  if (/^chapter\s+\d+/i.test(trimmed)) return true;
  if (/^scene\s+\d+/i.test(trimmed)) return true;
  if (/^part\s+\d+/i.test(trimmed)) return true;
  if (/^[A-Z0-9 ,:'"!?—-]{3,80}$/.test(trimmed) && trimmed.split(/\s+/).length <= 10) return true;

  return false;
}

function looksLikeIntentionalEllipsis(sentence) {
  const s = String(sentence || '').trim();
  if (!/[.…]["”’)]*$/.test(s)) return false;

  const cleaned = s.replace(/[.…"”’)]*$/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const last = words[words.length - 1]?.toLowerCase() || '';

  const impossibleEnders = new Set([
    'the',
    'a',
    'an',
    'to',
    'of',
    'and',
    'but',
    'or',
    'for',
    'with',
    'from',
    'into',
    'onto',
    'at',
    'by',
    'as',
    'because',
    'while',
    'although',
    'unless',
    'until',
  ]);

  if (impossibleEnders.has(last)) return false;

  return true;
}

function looksTruncated(sentence, nextParagraph = '') {
  const s = String(sentence || '').trim();

  if (!s || s.length < 18) return false;
  if (isLikelyHeading(s)) return false;

  const cleaned = s.replace(/[.…!?,"”’)]*$/g, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length < 5) return false;

  const last = words[words.length - 1]?.toLowerCase() || '';
  const secondLast = words[words.length - 2]?.toLowerCase() || '';
  const pair = `${secondLast} ${last}`.trim();

  const hardBadEnders = new Set([
    'the',
    'a',
    'an',
    'to',
    'of',
    'in',
    'and',
    'but',
    'or',
    'for',
    'with',
    'from',
    'into',
    'onto',
    'at',
    'by',
    'as',
    'that',
    'this',
    'their',
    'its',
    'his',
    'her',
    'your',
    'our',
    'my',
    'against',
    'beneath',
    'between',
    'through',
    'toward',
    'towards',
    'inside',
    'outside',
    'because',
    'while',
    'although',
    'unless',
    'until',
    'under',
    'over',
    'beside',
    'beyond',
    'within',
    'without',
  ]);

  const incompletePairs = new Set([
    'rough against',
    'pressed against',
    'leaned against',
    'looked at',
    'stared at',
    'reached for',
    'held onto',
    'turned toward',
    'moved toward',
    'back into',
    'down into',
    'up into',
    'out of',
    'one of',
    'kind of',
    'part of',
    'the sound',
    'the smell',
    'the taste',
    'the feel',
    'the edge',
    'the weight',
  ]);

  if (hardBadEnders.has(last)) return true;
  if (incompletePairs.has(pair)) return true;

  if (!/[.!?…)"”’]$/.test(s) && words.length > 7) {
    return true;
  }

  if (/[.…]["”’)]*$/.test(s)) {
    if (looksLikeIntentionalEllipsis(s)) return false;

    const next = String(nextParagraph || '').trim();

    if (!next) return true;
    if (/^(chapter|scene|part)\b/i.test(next)) return true;

    return false;
  }

  return false;
}

function findTruncatedCandidates(text) {
  const paragraphs = splitParagraphs(text);
  const candidates = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const lastSentence = getLastSentence(paragraph);
    const nextParagraph = paragraphs[i + 1] || '';

    if (looksTruncated(lastSentence, nextParagraph)) {
      candidates.push({
        paragraphIndex: i,
        sentence: lastSentence,
        nextParagraphPreview: nextParagraph.slice(0, 160),
      });
    }
  }

  return candidates;
}

// PROSEGUARD-1 — an editorial artifact is a DELIMITED thing.
//
// The previous list was duplicated verbatim in two places (findEditorialArtifacts and
// regexCleanup), which is the divergent-authority shape this codebase keeps paying for;
// worse, every pattern was written as `\[?\s*MARKER[^\n]*` — an OPTIONAL opening bracket
// followed by an unbounded run to end of line. That deletes the rest of the author's
// paragraph whenever ordinary narration happens to contain the marker words. Proven
// against the live file:
//
//   in : The engine needs work, and the plane leaves at dawn. She grabbed the toolbox…
//   out: The engine
//   in : Note to self: never trust him again. She closed the diary and slid it under…
//   out: (empty)
//
// The rule now: an artifact must be closed on BOTH ends — inside brackets, inside an
// HTML comment, or an ALL-CAPS marker that owns its own line. A sentence of prose that
// merely contains "needs work" is prose. Markers are matched case-SENSITIVELY on the
// line-owned forms so lowercase narration ("todo" is a Spanish word; "note to self" is
// a thought a character can have) can never be mistaken for an instruction to the model.
export const EDITORIAL_ARTIFACT_PATTERNS = Object.freeze([
  // Bracketed instruction of any of the known shapes: [TODO: …], [Replace the X with Y].
  /\[\s*(?:Replace|Remove|Insert|TODO|FIXME|TK|PLACEHOLDER|NOTE TO (?:SELF|AUTHOR|EDITOR)|EDITOR'?S?\s+NOTE|DELETE\s+THIS|CUT\s+THIS|REWRITE\s+THIS|NEEDS?\s+(?:REVISION|EDITING|REWRITE|WORK))\b[^\]\n]*\]/gi,
  // An ALL-CAPS marker that owns its own line, start to finish.
  /^[ \t>*_-]*(?:TODO|FIXME|TK|PLACEHOLDER|NOTE TO (?:SELF|AUTHOR|EDITOR)|EDITOR'?S?\s+NOTE|DELETE\s+THIS|CUT\s+THIS\s+(?:SECTION|PARAGRAPH|SENTENCE)|REWRITE\s+THIS|NEEDS?\s+(?:REVISION|EDITING|REWRITE|WORK))\b[^\n]*$/gm,
  // Bolded scene-break instruction, closed by its own markers.
  /\*\*\s*Replace\s+[^*\n]*?scene\s+break[^*\n]*?\*\*/gi,
  // HTML comment — already delimited on both ends.
  /<!--[\s\S]*?-->/g,
]);

function findEditorialArtifacts(text) {
  const artifacts = [];

  for (const pattern of EDITORIAL_ARTIFACT_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) artifacts.push(...matches);
  }

  return artifacts;
}

function detectRepeatedParagraphs(text) {
  const paragraphs = splitParagraphs(text);
  const seen = new Map();
  const repeated = [];

  paragraphs.forEach((paragraph, index) => {
    const normalized = paragraph
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalized.length < 120) return;

    if (seen.has(normalized)) {
      repeated.push({
        firstIndex: seen.get(normalized),
        repeatIndex: index,
        preview: paragraph.slice(0, 140),
      });
    } else {
      seen.set(normalized, index);
    }
  });

  return repeated;
}

function detectProperNameSet(text) {
  const source = normalizeText(text);
  const matches = source.match(/\b[A-Z][a-z]{2,}(?:[’'][A-Z][a-z]{2,})?\b/g) || [];

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
    'Part',
    'He',
    'She',
    'They',
    'His',
    'Her',
    'Their',
    'Him',
    'You',
    'Your',
    'Sir',
    'God',
    'Jesus',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
    'January',
    'February',
    'March',
    'April',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]);

  const counts = new Map();

  for (const match of matches) {
    if (banned.has(match)) continue;
    counts.set(match.toLowerCase(), (counts.get(match.toLowerCase()) || 0) + 1);
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([name]) => name)
  );
}

function detectOverusedWords(text, limit = 14) {
  const properNames = detectProperNameSet(text);

  const ignore = new Set([
    'the',
    'and',
    'that',
    'with',
    'this',
    'from',
    'they',
    'there',
    'were',
    'was',
    'had',
    'his',
    'her',
    'she',
    'him',
    'you',
    'your',
    'for',
    'but',
    'not',
    'all',
    'out',
    'into',
    'one',
    'what',
    'when',
    'where',
    'then',
    'than',
    'them',
    'their',
    'over',
    'under',
    'back',
    'down',
    'could',
    'would',
    'should',
    'through',
    'about',
    'just',
    'like',
    'only',
    'more',
    'even',
    'been',
    'have',
    'has',
    'did',
    'does',
  ]);

  const words = normalizeText(text)
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map((word) => word.replace(/^['-]+|['-]+$/g, ''))
    .filter((word) => word.length >= 5 && !ignore.has(word) && !properNames.has(word));

  const counts = new Map();

  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .filter((item) => item.count >= limit)
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

function regexCleanup(inputText, options = {}) {
  let t = normalizeText(inputText);
  const fixes = [];
  const removals = [];

  const beforeDoubleSpaces = (t.match(/ {2,}/g) || []).length;
  t = t.replace(/ {2,}/g, ' ');
  if (beforeDoubleSpaces > 0) fixes.push(`Fixed ${beforeDoubleSpaces} double-space issue(s)`);

  const beforeExcessBlankLines = (t.match(/\n{4,}/g) || []).length;
  t = t.replace(/\n{4,}/g, '\n\n\n');
  if (beforeExcessBlankLines > 0) fixes.push(`Reduced ${beforeExcessBlankLines} excessive blank-line cluster(s)`);

  let capFixed = 0;
  t = t.replace(/([.!?])\s+([a-z])/g, (match, punct, letter, offset) => {
    if (!shouldUppercaseAfterPunct(t, offset, letter)) return match;
    capFixed += 1;
    return `${punct} ${letter.toUpperCase()}`;
  });
  if (capFixed > 0) fixes.push(`Fixed ${capFixed} post-punctuation capitalization issue(s)`);

  let lowercaseIFixed = 0;
  t = t.replace(/\bi\b/g, (match, offset) => {
    const before = offset > 0 ? t[offset - 1] : ' ';
    const after = t[offset + 1] || ' ';

    if (/[a-zA-Z]/.test(before) || /[a-zA-Z]/.test(after)) return match;

    lowercaseIFixed += 1;
    return 'I';
  });
  if (lowercaseIFixed > 0) fixes.push(`Fixed ${lowercaseIFixed} lowercase "i" issue(s)`);

  const fusedPatterns = [
    [/\byetI\b/g, 'yet I'],
    [/\byetThe\b/g, 'yet the'],
    [/\byetShe\b/g, 'yet she'],
    [/\byetHe\b/g, 'yet he'],
    [/\bbutI\b/g, 'but I'],
    [/\bandI\b/g, 'and I'],
    [/\bandThe\b/g, 'and the'],
    [/\bandShe\b/g, 'and she'],
    [/\bandHe\b/g, 'and he'],
    [/\bthatI\b/g, 'that I'],
    [/\bthatThe\b/g, 'that the'],
    [/\bofThe\b/g, 'of the'],
    [/\binThe\b/g, 'in the'],
    [/\btoThe\b/g, 'to the'],
    [/\bforThe\b/g, 'for the'],
    [/\bwasThe\b/g, 'was the'],
    [/\bhadThe\b/g, 'had the'],
    [/\bfromThe\b/g, 'from the'],
    [/\bintoThe\b/g, 'into the'],
  ];

  let fusedFixed = 0;
  for (const [pattern, replacement] of fusedPatterns) {
    const matches = t.match(pattern);
    if (matches) {
      fusedFixed += matches.length;
      t = t.replace(pattern, replacement);
    }
  }
  if (fusedFixed > 0) fixes.push(`Fixed ${fusedFixed} fused-word issue(s)`);

  // PROSEGUARD-1: `can` and `won` are ordinary English words, and in a manuscript
  // that uses single quotes for dialogue (British convention, and anything imported
  // from a .docx) a quotation ending in one of them is followed by `' `. The old
  // pattern ate the closing quote and inverted the sentence:
  //   in : He said, 'I think he won' and walked out.
  //   out: He said, 'I think he won't and walked out.
  // Every other stem in the list is a bound morpheme — `doesn`, `wouldn`, `hasn` are
  // not words — so they stay unconditionally. The two ambiguous ones are dropped as
  // soon as the text shows any sign of single-quote dialogue.
  const usesSingleQuoteDialogue = /(^|[\s(\[—-])'[A-Za-z]/.test(t);
  const contractionStems = usesSingleQuoteDialogue
    ? /\b(doesn|wouldn|couldn|shouldn|hasn|hadn|isn|aren|weren|wasn|haven|mustn|needn|didn|ain)'\s/gi
    : /\b(doesn|wouldn|couldn|shouldn|hasn|hadn|isn|aren|weren|wasn|haven|mustn|needn|won|didn|can|ain)'\s/gi;

  let contractionFixed = 0;
  t = t.replace(
    contractionStems,
    (match, word) => {
      contractionFixed += 1;
      return `${word}'t `;
    }
  );
  if (contractionFixed > 0) fixes.push(`Fixed ${contractionFixed} broken contraction(s)`);

  let quoteFixes = 0;
  const beforeQuotes = t;

  t = t
    .replace(/[\u201d]{2,}/g, '\u201d')
    .replace(/[\u201c]{2,}/g, '\u201c')
    .replace(/"{2,}/g, '"');

  if (t !== beforeQuotes) quoteFixes += 1;

  t = t.replace(/(["”])([,.!?])/g, (match, quote, punct) => {
    quoteFixes += 1;
    return `${punct}${quote}`;
  });

  if (quoteFixes > 0) fixes.push(`Fixed quote punctuation/duplicate quote issue(s)`);

  const beforeDashes = t;
  t = t
    .replace(/\s*--\s*/g, '—')
    .replace(/\s+—\s+/g, '—')
    .replace(/—{2,}/g, '—');
  if (t !== beforeDashes) fixes.push('Normalized em dash spacing');

  const beforeEllipses = t;
  t = t.replace(/\.{3,}/g, '…');
  if (t !== beforeEllipses) fixes.push('Normalized ellipses');

  // PROSEGUARD-1: the `\s*` before the quote made this unable to tell a CLOSING quote
  // from an OPENING one, so a quoted word that happened to be a dialogue verb was
  // dismantled:
  //   in : Nobody used the word "asked" anymore.
  //   out: Nobody used the word," asked" anymore.
  // The artifact this rule exists for is a quote fused to the preceding word with no
  // space — `…he was safe" said Ilka`. Requiring no whitespace before the quote keeps
  // that repair and makes the false positive impossible.
  let brokenDialogFixed = 0;
  t = t.replace(/([a-zA-Z])"\s*(said|asked|whispered|murmured|shouted|snapped|replied|answered)\b/g, (match, prev, tag) => {
    brokenDialogFixed += 1;
    return `${prev}," ${tag}`;
  });
  if (brokenDialogFixed > 0) fixes.push(`Fixed ${brokenDialogFixed} dialogue-tag punctuation issue(s)`);

  const artifacts = findEditorialArtifacts(t);
  if (artifacts.length > 0) {
    for (const artifact of artifacts) {
      removals.push({
        type: 'editorial_artifact',
        text: artifact.slice(0, 160),
      });
    }

    // PROSEGUARD-1: one authority. The removal loop and the detector above must
    // never be able to disagree about what an artifact is.
    for (const pattern of EDITORIAL_ARTIFACT_PATTERNS) {
      pattern.lastIndex = 0;
      t = t.replace(pattern, '');
    }

    t = t.replace(/\n{3,}/g, '\n\n');
    fixes.push(`Removed ${artifacts.length} editorial artifact(s)`);
  }

  const repeatedParagraphs = detectRepeatedParagraphs(t);
  if (repeatedParagraphs.length > 0 && options.removeDuplicateParagraphs !== false) {
    const paragraphs = splitParagraphs(t);
    const removeIndexes = new Set(repeatedParagraphs.map((item) => item.repeatIndex));

    t = paragraphs.filter((_, index) => !removeIndexes.has(index)).join('\n\n');

    for (const item of repeatedParagraphs) {
      removals.push({
        type: 'duplicate_paragraph',
        text: item.preview,
      });
    }

    fixes.push(`Removed ${repeatedParagraphs.length} duplicate paragraph(s)`);
  }

  const truncated = findTruncatedCandidates(t);

  if (truncated.length > 0) {
    fixes.push(`Flagged ${truncated.length} possible truncated sentence(s) for LLM inspection`);
  }

  return {
    text: normalizeText(t),
    fixes,
    removals,
    truncated,
    repeatedParagraphs,
  };
}

function buildProjectContext(project = {}) {
  const isNF = projectIsNonfiction(project);
  const isAnthology = projectIsAnthology(project);
  const isErotic = projectIsErotic(project);

  const lines = [];

  lines.push(`Project type: ${project.project_type || project.book_type || 'fiction'}`);
  lines.push(`Genre: ${project.genre || 'unspecified'}`);
  lines.push(`Subgenre: ${project.subgenre || 'unspecified'}`);
  lines.push(`POV: ${project.pov_mode || 'project default'}`);
  lines.push(`Tense: ${project.tense || 'project default'}`);
  lines.push(`Anthology: ${isAnthology ? 'yes' : 'no'}`);
  lines.push(`Nonfiction: ${isNF ? 'yes' : 'no'}`);
  lines.push(`Erotic/adult content: ${isErotic ? 'yes' : 'no'}`);
  lines.push(`Language intensity: ${project.language_intensity ?? 'unspecified'}`);
  lines.push(`Spice level: ${project.spice_level ?? 'unspecified'}`);
  lines.push(`Violence level: ${project.violence_level ?? 'unspecified'}`);

  if (project.author_voice) lines.push(`Author voice: ${project.author_voice}`);
  if (project.author_voice_notes) lines.push(`Author voice notes: ${String(project.author_voice_notes).slice(0, 900)}`);
  if (project.voice_md) lines.push(`Voice bible: ${String(project.voice_md).slice(0, 1200)}`);

  return lines.join('\n');
}

function buildTruncationRepairInstructions(truncated = []) {
  if (!truncated.length) return '';

  return `
TRUNCATION CHECK:
The deterministic pass flagged these possible incomplete sentence endings. Inspect them in context.

${truncated.map((item, i) => `${i + 1}. "${item.sentence}"`).join('\n')}

Rules:
- If a flagged line is truly cut off, complete it naturally using only nearby context.
- If it is an intentional suspense fragment or stylistic ellipsis, leave it alone.
- Do not add new plot events.
- Do not expand erotic content beyond what already exists.
- Do not remove heat, consent cues, emotional beats, or scene-specific detail.
`;
}

function buildUniversalCopyeditPrompt({
  text,
  project,
  chapterNumber,
  truncated,
  mode,
}) {
  const isNF = projectIsNonfiction(project);
  const isAnthology = projectIsAnthology(project);
  const isErotic = projectIsErotic(project);

  const projectContext = buildProjectContext(project);
  const truncationInstructions = buildTruncationRepairInstructions(truncated);

  return `You are a professional manuscript copy editor. You are cleaning one chapter after generation.

PROJECT CONTEXT:
${projectContext}

CHAPTER:
Chapter ${chapterNumber || '?'}

EDIT MODE:
${mode || 'standard'}

MISSION:
Fix mechanical and readability problems while preserving the author's content, voice, heat level, story events, paragraph structure, and scene order.

MUST FIX:
- punctuation errors
- grammar errors
- capitalization errors
- broken contractions
- fused words
- obvious missing words
- dialogue punctuation errors
- wrong quote placement
- duplicated paragraphs
- editorial artifacts accidentally left in the prose
- truly truncated sentences
- scrambled sentences where two drafts collided
- obvious pronoun/POV/tense slips
- malformed sentence starts like "Was guided...", "Was close.", "Looked at it...", "A air...", "One silence..."
- dangling broken fragments like "Closed .", "on .", "at .", "from .", "with ."
- lowercase proper-name sentence starts after punctuation or em dash
- noun-substitution artifacts like "His pause fogged", "His moment hitched", "his silence", or "his air hitched" when the context clearly means breath

DO NOT CHANGE:
- the plot
- character names
- setting
- sequence of events
- heat level
- consent dynamics
- erotic tone
- adult content that is already present
- chapter structure
- intentional sentence fragments
- intentional ellipses
- stylistic repetition that serves rhythm
- dialogue personality
- nonfiction claims or facts

${isErotic ? `EROTIC FICTION SAFETY/STYLE RULES:
- Preserve adult consensual erotic content already present.
- Do not sanitize the chapter.
- Do not escalate beyond what the text already implies.
- Do not introduce new sexual acts or new consent dynamics.
- Keep repairs mechanical and prose-level.` : ''}

${isAnthology ? `ANTHOLOGY RULE:
This chapter is a standalone story. Do not force continuity with other chapters.` : ''}

${isNF ? `NONFICTION RULES:
- Do not invent facts, names, dates, quotes, citations, statistics, or sources.
- Keep the author's claims intact.
- Only fix prose mechanics and clarity.` : ''}

${truncationInstructions}

OUTPUT RULES:
- Return ONLY the corrected chapter text.
- No commentary.
- No markdown fences.
- No summary.
- No bullet list of edits.
- Do not include "Here is".
- Do not include notes to the author.

CHAPTER TEXT:
${text}`;
}

function validateEditedText(originalText, editedText, options = {}) {
  const original = normalizeText(originalText);
  const edited = normalizeText(editedText);

  const originalWords = countWords(original);
  const editedWords = countWords(edited);

  if (!edited || editedWords < 50) {
    return {
      ok: false,
      reason: 'edited output too short',
    };
  }

  const minRatio = options.minLengthRatio ?? 0.72;
  const maxRatio = options.maxLengthRatio ?? 1.22;

  if (originalWords > 100 && editedWords < originalWords * minRatio) {
    return {
      ok: false,
      reason: `edited output lost too much content (${editedWords}/${originalWords} words)`,
    };
  }

  if (originalWords > 100 && editedWords > originalWords * maxRatio) {
    return {
      ok: false,
      reason: `edited output expanded too much (${editedWords}/${originalWords} words)`,
    };
  }

  const originalParagraphs = splitParagraphs(original).length;
  const editedParagraphs = splitParagraphs(edited).length;

  if (originalParagraphs >= 4 && editedParagraphs < Math.max(2, originalParagraphs * 0.55)) {
    return {
      ok: false,
      reason: `edited output collapsed too many paragraphs (${editedParagraphs}/${originalParagraphs})`,
    };
  }

  // DIALOGUEFIX-2: the copyedit model must not change quotation structure. A
  // drafted chapter arrives here with healed, balanced dialogue; one polish
  // call stripped 17 opening quotes and passed the old checks. If the edit
  // makes the smart-quote imbalance worse, reject it and keep the input.
  const qCount = (t, ch) => (t.match(new RegExp(ch, 'g')) || []).length;
  const inImbalance = Math.abs(qCount(original, '\u201c') - qCount(original, '\u201d'));
  const outImbalance = Math.abs(qCount(edited, '\u201c') - qCount(edited, '\u201d'));
  if (outImbalance > inImbalance + 1) {
    return {
      ok: false,
      reason: `edited output broke quote balance (imbalance ${inImbalance} -> ${outImbalance})`,
    };
  }

  if (/^(sure|here|okay|certainly)[,!.:\s]/i.test(edited.slice(0, 40))) {
    return {
      ok: false,
      reason: 'edited output contains assistant preface',
    };
  }

  return {
    ok: true,
    reason: '',
  };
}

async function llmCopyedit({
  text,
  project,
  chapterNumber,
  truncated,
  mode,
  onProgress,
}) {
  const cleanText = normalizeText(text);

  if (!cleanText || cleanText.length < 500) {
    return {
      text: cleanText,
      fixes: [],
      warnings: [],
      skipped: true,
      remainingTruncations: findTruncatedCandidates(cleanText),
    };
  }

  onProgress?.(`Copyediting chapter ${chapterNumber || ''} with GPT fixer…`.trim());

  const prompt = buildUniversalCopyeditPrompt({
    text: cleanText,
    project,
    chapterNumber,
    truncated,
    mode,
  });

  try {
    const result = await invokeLLMWithRetry({
    task_type: 'polish',
      prompt,
      model: 'openai_gpt5',
      fallback_model: 'deepseek/deepseek-v3.2',
      temperature: 0.05,
      max_tokens: Math.min(Math.max(Math.ceil(cleanText.length / 2.4), 3500), 16000),
      disable_fallbacks: false,
    });

    const edited = normalizeText(extractText(result));
    const validation = validateEditedText(cleanText, edited);

    if (!validation.ok) {
      return {
        text: cleanText,
        fixes: [`GPT copyedit rejected: ${validation.reason}`],
        warnings: [validation.reason],
        skipped: true,
        remainingTruncations: findTruncatedCandidates(cleanText),
      };
    }

    const originalWords = countWords(cleanText);
    const editedWords = countWords(edited);
    const wordDiff = Math.abs(originalWords - editedWords);
    const remainingTruncations = findTruncatedCandidates(edited);

    return {
      text: edited,
      fixes: [
        `GPT copyedit applied: ${originalWords} → ${editedWords} words (${wordDiff} word delta)`,
        truncated?.length
          ? `Truncation check: ${truncated.length} flagged → ${remainingTruncations.length} remaining`
          : null,
      ].filter(Boolean),
      warnings: [],
      skipped: false,
      remainingTruncations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      text: cleanText,
      fixes: [`GPT copyedit failed: ${message}`],
      warnings: [message],
      skipped: true,
      remainingTruncations: findTruncatedCandidates(cleanText),
    };
  }
}

function runFinalHygiene(text) {
  let t = normalizeText(text);
  const fixes = [];

  // PROSEGUARD-1: the editorial adjective was OPTIONAL, which reduced this to
  // "Here is the chapter" plus a permissive tail — a phrase a narrator can write:
  //   in : Here is the chapter of my life I never wrote down. It started in June.
  //   out: of my life I never wrote down. It started in June.
  // An assistant preface owns its own line and ends in a colon, a period or a line
  // break. Requiring that terminator, or an explicit editorial adjective, keeps the
  // repair and makes it impossible for it to bite into a sentence.
  const beforeAssistantPreface = t;
  t = t
    .replace(/^\s*(?:Here is|Here's|Certainly|Sure|Okay),?\s+(?:the\s+)?(?:corrected|edited|revised|cleaned)\s+(?:chapter|text|prose)\b[:.\-\s]*/i, '')
    .replace(/^\s*(?:Here is|Here's|Certainly|Sure|Okay),?\s+(?:the\s+)?(?:chapter|text|prose)\s*(?::|\.\s*$|\.?\s*\n)/i, '')
    .replace(/^\s*```(?:\w+)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (t !== beforeAssistantPreface) fixes.push('Removed assistant preface/fence');

  const beforeMarkdownHeadings = t;
  t = t.replace(/^#+\s+/gm, '');
  if (t !== beforeMarkdownHeadings) fixes.push('Removed markdown heading markers');

  const beforeWhitespace = t;
  t = t
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (t !== beforeWhitespace) fixes.push('Final whitespace normalization');

  return {
    text: t,
    fixes,
  };
}

function applyReplacementSet(text, replacements, logPrefix) {
  let t = normalizeText(text);
  const fixes = [];

  for (const item of replacements) {
    const before = t;
    const matches = before.match(item.pattern) || [];

    if (!matches.length) continue;

    console.log(`${logPrefix} ${item.label}: ${matches.length} match(es)`);

    t = t.replace(item.pattern, item.replacement);
    fixes.push(`${item.fixPrefix || 'Micro-copyedit repaired'} ${matches.length} issue(s): ${item.label}`);
  }

  return {
    text: normalizeText(t),
    fixes,
  };
}

function runMicroCopyeditRepairs(text) {
  console.log('[POST-DRAFT] runMicroCopyeditRepairs() executing');

  const replacements = proseRepairs.microCopyedit;

  const result = applyReplacementSet(text, replacements, '[POST-DRAFT][MICRO v4]');

  if (!result.fixes.length) {
    console.log('[POST-DRAFT][MICRO v4] runMicroCopyeditRepairs completed: 0 matches');
  } else {
    console.log(`[POST-DRAFT][MICRO v4] runMicroCopyeditRepairs completed: ${result.fixes.length} repair type(s)`);
  }

  return result;
}

function runFinalHardSurvivorRepairs(text) {
  console.log('[POST-DRAFT] runFinalHardSurvivorRepairs() executing');

  const replacements = proseRepairs.hardSurvivor;

  const result = applyReplacementSet(text, replacements, '[POST-DRAFT][HARD-SURVIVOR v4]');

  if (!result.fixes.length) {
    console.log('[POST-DRAFT][HARD-SURVIVOR v4] completed: 0 survivor matches');
  } else {
    console.log(`[POST-DRAFT][HARD-SURVIVOR v4] completed: ${result.fixes.length} survivor repair type(s)`);
  }

  return result;
}

function capitalizeName(value) {
  const raw = String(value || '');
  if (!raw) return raw;

  return raw
    .split(/([-’'])/)
    .map((part) => {
      if (!part || /^[-’']$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}

// PROSEGUARD-1: this used to force every capitalized token to a count of 2 with
// `Math.max(counts.get(lower) || 0, 2)`, so the `count >= 2` filter below could never
// reject anything and the only thing standing between ordinary prose and the
// "proper name" list was a hand-written ban list of one old book's vocabulary. Any
// word that merely started a sentence became a name. Counting for real restores the
// filter's meaning: a token has to actually appear capitalized more than once.
function detectLikelyProperNames(text) {
  const source = normalizeText(text);
  const counts = new Map();

  // Only occurrences that are NOT at a sentence start count. That is the actual
  // signal for a proper noun: an ordinary word can be capitalized because it opens a
  // sentence, a name is capitalized in the middle of one. Counting every capitalized
  // token (and then forcing the count to 2) made every sentence-opening word a "name".
  const rx = /\b[A-Z][a-z]{2,}\b/g;
  let m;
  while ((m = rx.exec(source)) !== null) {
    const preceding = source.slice(0, m.index).trimEnd();
    const atSentenceStart = preceding === '' || /[.!?…:;"”'’—(\[\n]$/.test(preceding);
    if (atSentenceStart) continue;
    counts.set(m[0].toLowerCase(), (counts.get(m[0].toLowerCase()) || 0) + 1);
  }

  const banned = new Set([
    'the',
    'and',
    'but',
    'for',
    'with',
    'from',
    'into',
    'onto',
    'there',
    'this',
    'that',
    'then',
    'when',
    'where',
    'what',
    'chapter',
    'scene',
    'part',
    'room',
    'door',
    'sound',
    'silence',
    'farm',
    'farmer',
    'farmers',
    'handler',
    'handlers',
    'husbandman',
    'asset',
    'body',
    'table',
    'water',
    'stone',
    'floor',
    'ceiling',
    'voice',
    'breath',
    'pulse',
    'light',
    'air',
  ]);

  return [...counts.entries()]
    .filter(([word, count]) => count >= 2 && !banned.has(word) && word.length >= 4)
    .map(([word]) => word);
}

function repairLowercaseProperNameStarts(text) {
  let t = normalizeText(text);
  let fixes = 0;

  const names = detectLikelyProperNames(t);

  // PROSEGUARD-1: the `—\s*` branch capitalized a word MID-SENTENCE after an em dash,
  // which is not a sentence boundary in English:
  //   in : Nothing moved. He waited by the door — nothing came.
  //   out: Nothing moved. He waited by the door—Nothing came.
  // Only sentence-terminal punctuation and start-of-text open a new sentence.
  for (const lower of names) {
    const cap = capitalizeName(lower);
    const rx = new RegExp(`(^|[.!?…]\\s+)(${lower})(\\b)`, 'g');

    t = t.replace(rx, (match, prefix, name, boundary) => {
      if (name !== lower) return match;
      fixes += 1;
      return `${prefix}${cap}${boundary}`;
    });
  }

  return {
    text: t,
    fixes,
  };
}

function commonNounArticleRepair(sentence) {
  let s = String(sentence || '').trim();

  // PROSEGUARD-1: both banks were 26 inline literals from one dead manuscript, and
  // several were not repairs at all — "A stupid, wet sound." became "A stupid, wet
  // sound came from him.", inventing narrative content and asserting who made the
  // sound. They now come from the project. Empty by default.
  for (const [pattern, replacement] of proseRepairs.articleRepairs) {
    s = s.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of proseRepairs.phraseRepairs) {
    pattern.lastIndex = 0;
    s = s.replace(pattern, replacement);
  }

  return s;
}

function inferSubjectFromContext(context) {
  const source = String(context || '');
  const before = source.slice(0, 700);

  const nameMatches =
    before.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g) || [];

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
    'One',
    'Chapter',
    'Scene',
    'Part',
    'His',
    'Her',
    'Their',
    'Room',
    'Door',
    'Air',
    'Silence',
  ]);

  const usableNames = nameMatches.filter((name) => !banned.has(name.split(/\s+/)[0]));
  if (usableNames.length) return usableNames[usableNames.length - 1];

  const he = (before.match(/\bhe\b/gi) || []).length + (before.match(/\bhis\b/gi) || []).length;
  const she = (before.match(/\bshe\b/gi) || []).length + (before.match(/\bher\b/gi) || []).length;
  const they = (before.match(/\bthey\b/gi) || []).length + (before.match(/\btheir\b/gi) || []).length;

  if (they > he && they > she) return 'They';
  if (she > he) return 'She';

  return 'He';
}

function deterministicSentenceRepair(sentence, context = '') {
  let s = String(sentence || '').trim();
  if (!s || isLikelyHeading(s)) return s;

  const original = s;
  const subject = inferSubjectFromContext(context);

  s = commonNounArticleRepair(s);

  // PROSEGUARD-1 — the fabricated-subject block is deleted, not guarded.
  //
  // It ran on EVERY sentence, not just the ones classifyMalformedSentence flagged, and
  // it invented a subject by taking the last capitalized token in the paragraph. `Was`,
  // `Had` and `Were` are themselves capitalized tokens and were not in the ban list, so
  // the "subject" it inserted was usually the very word it was repairing, and because
  // runSurgicalArtifactRepair runs more than once per call it compounded. Proven
  // against the live file:
  //
  //   Had he known, he would have stayed.  ->  Had had had had he known, he would…
  //   Was that a threat?                   ->  Was was was was that a threat?
  //
  // Both inputs were correct English to begin with — subject-auxiliary inversion and a
  // question. Even on a genuine fragment ("Was shaking.") the repair is a guess about
  // who is doing the action, and a guessed subject is fabrication. This app's standing
  // rule is that blank beats fabricated: a fragment left as a fragment is honest and
  // the author can see it. `subject` is retained below for the article repairs that
  // legitimately use context.
  //
  // The `Closed .` / `opened .` rules went with it — they invent an object ("it") and
  // lowercase a sentence start (`The store was dark. Closed.` -> `…dark. closed it.`).
  // Deleting a dangling preposition before a full stop is a true artifact repair, so
  // that one stays.
  s = s.replace(/\b(on|at|with|from|into|of|to|for)\s+\.$/, '.');

  // PROSEGUARD-1: the second copy of the em-dash capitalizer (the other was in
  // repairLowercaseProperNameStarts). An em dash does not start a sentence, so
  // capitalizing after one rewrites the middle of the author's sentence.
  s = s.replace(/(^)([a-z][a-z]{2,})(\b)/g, (match, prefix, word, boundary) => {
    const likelyNames = detectLikelyProperNames(context + '\n' + original);
    if (likelyNames.includes(word.toLowerCase())) {
      return `${prefix}${capitalizeName(word)}${boundary}`;
    }
    return match;
  });

  return s;
}

function repairMalformedArticlesAndFragments(text) {
  const paragraphs = splitParagraphs(text);
  const fixes = [];
  let changed = 0;

  // PROSEGUARD-1: splitParagraphs only splits on a BLANK line, so a chapter whose
  // paragraphs are separated by a single newline arrived here as one "paragraph" and
  // the sentence round-trip re-joined the whole thing with spaces — every line break
  // in the chapter gone, in one pass, silently (word count is unchanged, so
  // validateEditedText never trips):
  //   in : He opened the door.\nThe room was empty.\nShe was gone.
  //   out: He opened the door. The room was empty. She was gone.
  // Repairing line by line and re-joining on the original newline makes the round-trip
  // structure-preserving. A line that splitSentences cannot parse (one made only of
  // terminal punctuation returned []) is now passed through untouched rather than
  // dropped.
  const repairedParagraphs = paragraphs.map((paragraph) => {
    const lines = paragraph.split('\n');

    const repairedLines = lines.map((line) => {
      if (!line.trim()) return line;

      const sentences = splitSentences(line).map((sentence) => sentence.trim()).filter(Boolean);
      if (!sentences.length) return line;

      const repaired = sentences.map((sentence) => {
        const fixed = deterministicSentenceRepair(sentence, paragraph);

        if (fixed !== sentence) changed += 1;
        return fixed;
      });

      const rejoined = repaired.join(' ');

      // splitSentences cannot begin a match on a terminal character, so a line that
      // opens with an ellipsis or a full stop loses it on the round-trip. If the
      // rejoined text is not a superset of the line's own words, keep the original.
      const wordsIn = (line.match(/[\w’']+/g) || []).length;
      const wordsOut = (rejoined.match(/[\w’']+/g) || []).length;
      if (wordsOut < wordsIn) return line;

      return rejoined;
    });

    return repairedLines.join('\n');
  });

  if (changed > 0) fixes.push(`Repaired ${changed} deterministic malformed sentence/artifact issue(s)`);

  return {
    text: normalizeText(repairedParagraphs.join('\n\n')),
    fixes,
  };
}

function findSurgicalArtifacts(text) {
  const source = normalizeText(text);
  const artifacts = [];

  const patterns = [
    {
      type: 'subjectless_was_start',
      rx: /(^|[.!?…]\s+|\n)Was (guided|forced|taken|led|brought|moved|carried|dragged|pulled|pushed|strapped|secured|released|left|about|already|still|close|near|taller|shorter|older|younger|right|wrong|ready|supposed|meant|going|standing|sitting|lying|watching|waiting|breathing|trembling|shaking|crying|laughing|holding|trying|willing|looking|staring|wasting|devouring|adrift|part|a|an|the)\b/g,
    },
    {
      type: 'subjectless_were_start',
      rx: /(^|[.!?…]\s+|\n)Were (unloading|waiting|standing|sitting|watching|moving|trying|holding|breathing|shaking|trembling|ready|gone|there|not)\b/g,
    },
    {
      type: 'subjectless_action_start',
      rx: /(^|[.!?…]\s+|\n)(Looked|Turned|Felt|Knew|Thought|Sounded|Tasted|Smelled) (at|down|up|away|back|over|toward|towards|past|around|like|as if|of|about|that|he|she|they|it)\b/g,
    },
    {
      type: 'true_bad_article_start',
      rx: /\b(A air|One air|One silence|One corridor|One hum|One walls|Its man|Its door|Its world)\b/g,
    },
    {
      type: 'specific_bad_that_silence',
      rx: /\bThat silence here\b/g,
    },
    {
      type: 'dangling_period_fragment',
      rx: /\b(Closed|opened|on|at|with|from|into|of|to|for)\s+\./g,
    },
    {
      type: 'known_broken_phrase',
      rx: knownBrokenPhraseRx(),
    },
    {
      type: 'leading_preposition_fragment',
      rx: /(^|[.!?…]\s+|\n)(of the|about the)\b/g,
    },
  ];

  for (const item of patterns) {
    const matches = source.match(item.rx);
    if (matches) {
      for (const match of matches.slice(0, 25)) {
        artifacts.push({
          type: item.type,
          text: match.trim().slice(0, 180),
        });
      }
    }
  }

  return artifacts;
}

function runSurgicalArtifactRepair(text) {
  let t = normalizeText(text);
  const fixes = [];

  const properNames = repairLowercaseProperNameStarts(t);
  t = properNames.text;
  if (properNames.fixes > 0) {
    fixes.push(`Fixed ${properNames.fixes} lowercase proper-name sentence start(s)`);
  }

  const malformed = repairMalformedArticlesAndFragments(t);
  t = malformed.text;
  fixes.push(...malformed.fixes);

  const micro = runMicroCopyeditRepairs(t);
  t = micro.text;
  fixes.push(...micro.fixes);

  const hard = runFinalHardSurvivorRepairs(t);
  t = hard.text;
  fixes.push(...hard.fixes);

  const remainingArtifacts = findSurgicalArtifacts(t);

  return {
    text: normalizeText(t),
    fixes,
    remainingArtifacts,
  };
}

function getSentenceContext(paragraph, sentence) {
  const p = String(paragraph || '').trim();
  const s = String(sentence || '').trim();

  if (!p || !s) return p.slice(0, 900);

  const index = p.indexOf(s);
  if (index < 0) return p.slice(0, 900);

  const start = Math.max(0, index - 320);
  const end = Math.min(p.length, index + s.length + 320);

  return p.slice(start, end);
}

function classifyMalformedSentence(sentence) {
  const s = String(sentence || '').trim();
  if (!s || isLikelyHeading(s)) return null;

  const lower = s.toLowerCase();

  if (/^(was|were|had|looked|turned|felt|knew|thought|sounded|tasted|smelled)\b/i.test(s)) {
    return 'missing subject at sentence start';
  }

  if (/^(a air|one air|one silence|one corridor|one hum|one walls|its man|its door|its world)\b/i.test(s)) {
    return 'true malformed article/pronoun sentence start';
  }

  if (/^that silence here\b/i.test(s)) {
    return 'specific malformed demonstrative sentence start';
  }

  if (/^(of the|about the)\b/i.test(s)) {
    return 'leading preposition fragment';
  }

  if (/\b(Closed|opened|on|at|with|from|into|of|to|for)\s+\.$/i.test(s)) {
    return 'dangling punctuation fragment';
  }

  if (matchesKnownBrokenPhrase(s)) {
    return 'known malformed phrase';
  }

  if (/\b(was|were|had)\s+(a|an|the)?\s*$/i.test(s)) {
    return 'incomplete sentence ending';
  }

  if (
    lower.includes(' a air ') ||
    lower.startsWith('a air') ||
    lower.includes(' one air ') ||
    lower.startsWith('one air') ||
    lower.includes(' one silence ') ||
    lower.startsWith('one silence') ||
    lower.includes(' one corridor ') ||
    lower.startsWith('one corridor') ||
    lower.includes(' one hum ') ||
    lower.startsWith('one hum') ||
    lower.includes(' one walls ') ||
    lower.startsWith('one walls') ||
    lower.includes(' its man ') ||
    lower.startsWith('its man') ||
    lower.includes(' its door ') ||
    lower.startsWith('its door') ||
    lower.includes(' its world ') ||
    lower.startsWith('its world')
  ) {
    return 'malformed article/pronoun phrase';
  }

  return null;
}

function detectMalformedSentenceCandidates(text, maxCandidates = 60) {
  const paragraphs = splitParagraphs(text);
  const candidates = [];
  const seen = new Set();

  for (let pIndex = 0; pIndex < paragraphs.length; pIndex += 1) {
    const paragraph = paragraphs[pIndex];
    const sentences = splitSentences(paragraph).map((sentence) => sentence.trim()).filter(Boolean);

    for (let sIndex = 0; sIndex < sentences.length; sIndex += 1) {
      const sentence = sentences[sIndex];
      const reason = classifyMalformedSentence(sentence);

      if (!reason) continue;

      const key = `${pIndex}:${sIndex}:${reason}:${sentence}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        id: `p${pIndex}_s${sIndex}`,
        paragraphIndex: pIndex,
        sentenceIndex: sIndex,
        reason,
        sentence,
        context: getSentenceContext(paragraph, sentence),
      });

      if (candidates.length >= maxCandidates) return candidates;
    }
  }

  return candidates;
}

function extractJsonCandidateBlocks(text) {
  const cleaned = String(text || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const blocks = [cleaned];

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) blocks.push(objectMatch[0]);

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) blocks.push(arrayMatch[0]);

  return [...new Set(blocks.filter(Boolean))];
}

function parseJsonPatchResponse(response) {
  const raw = extractText(response).trim();
  if (!raw) return [];

  const blocks = extractJsonCandidateBlocks(raw);

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const patches = Array.isArray(parsed) ? parsed : parsed.patches;

      if (!Array.isArray(patches)) continue;

      return patches
        .map((patch) => ({
          id: String(patch.id || '').trim(),
          paragraphIndex:
            Number.isFinite(Number(patch.paragraphIndex)) ? Number(patch.paragraphIndex) : null,
          sentenceIndex:
            Number.isFinite(Number(patch.sentenceIndex)) ? Number(patch.sentenceIndex) : null,
          replacement: normalizeText(patch.replacement || patch.fixed || patch.text || ''),
          reason: String(patch.reason || '').trim(),
        }))
        .filter((patch) => patch.replacement && patch.replacement.length >= 3);
    } catch {
      // Try next block.
    }
  }

  console.warn('[POST-DRAFT] JSON patch parse failed:', raw.slice(0, 1000));
  return [];
}

function validateSingleSentencePatch(originalSentence, replacement) {
  const original = normalizeText(originalSentence);
  const edited = normalizeText(replacement);

  if (!original || !edited) return { ok: false, reason: 'empty sentence patch' };

  const originalWords = countWords(original);
  const editedWords = countWords(edited);

  if (editedWords < 2) return { ok: false, reason: 'replacement too short' };

  if (originalWords >= 4 && editedWords > originalWords * 2.6 + 10) {
    return { ok: false, reason: 'replacement expands sentence too much' };
  }

  if (originalWords >= 8 && editedWords < originalWords * 0.28) {
    return { ok: false, reason: 'replacement cuts sentence too much' };
  }

  if (/^(sure|here|okay|certainly)[,!.:\s]/i.test(edited.slice(0, 40))) {
    return { ok: false, reason: 'replacement contains assistant preface' };
  }

  if (/\n{2,}/.test(edited)) {
    return { ok: false, reason: 'replacement contains paragraph break' };
  }

  return { ok: true, reason: '' };
}

function getPatchTarget(patch, candidates) {
  if (patch.id) {
    const byId = candidates.find((candidate) => candidate.id === patch.id);
    if (byId) return byId;
  }

  if (patch.paragraphIndex != null && patch.sentenceIndex != null) {
    return candidates.find(
      (candidate) =>
        candidate.paragraphIndex === patch.paragraphIndex &&
        candidate.sentenceIndex === patch.sentenceIndex
    );
  }

  return null;
}

function applySentencePatchesByIndex(text, candidates, patches) {
  const paragraphs = splitParagraphs(text);
  const paragraphSentences = paragraphs.map((paragraph) =>
    splitSentences(paragraph).map((sentence) => sentence.trim()).filter(Boolean)
  );

  const fixes = [];
  const warnings = [];
  const appliedKeys = new Set();

  for (const patch of patches) {
    const candidate = getPatchTarget(patch, candidates);

    if (!candidate) {
      warnings.push(`Ignored malformed-sentence patch with unknown target: ${patch.id || 'no-id'}`);
      continue;
    }

    const key = `${candidate.paragraphIndex}:${candidate.sentenceIndex}`;
    if (appliedKeys.has(key)) {
      warnings.push(`Skipped duplicate malformed-sentence patch target ${key}`);
      continue;
    }

    const current =
      paragraphSentences[candidate.paragraphIndex]?.[candidate.sentenceIndex] || '';

    if (!current) {
      warnings.push(`Skipped malformed-sentence patch ${candidate.id}: sentence index no longer exists`);
      continue;
    }

    const validation = validateSingleSentencePatch(current, patch.replacement);
    if (!validation.ok) {
      warnings.push(`Rejected malformed-sentence patch ${candidate.id}: ${validation.reason}`);
      continue;
    }

    paragraphSentences[candidate.paragraphIndex][candidate.sentenceIndex] = patch.replacement.trim();
    appliedKeys.add(key);
    fixes.push(`Applied malformed-sentence patch ${candidate.id}: ${candidate.reason}`);
  }

  const repairedText = paragraphSentences
    .map((sentences) => sentences.join(' '))
    .join('\n\n');

  return {
    text: normalizeText(repairedText),
    fixes,
    warnings,
  };
}

function buildMalformedSentencePatchPrompt({
  project,
  chapterNumber,
  candidates,
  retry = false,
}) {
  const isNF = projectIsNonfiction(project);
  const isAnthology = projectIsAnthology(project);
  const isErotic = projectIsErotic(project);

  const candidatePayload = candidates.map((candidate) => ({
    id: candidate.id,
    paragraphIndex: candidate.paragraphIndex,
    sentenceIndex: candidate.sentenceIndex,
    reason: candidate.reason,
    sentence: candidate.sentence,
    context: candidate.context,
    deterministicSuggestion: deterministicSentenceRepair(candidate.sentence, candidate.context),
  }));

  return `You are a surgical manuscript grammar repair tool.

You are NOT rewriting the chapter.
You are NOT improving style.
You are NOT summarizing.
You are only repairing malformed sentence-level grammar artifacts.

PROJECT:
- Chapter: ${chapterNumber || '?'}
- Genre: ${project?.genre || 'fiction'}
- Anthology: ${isAnthology ? 'yes' : 'no'}
- Nonfiction: ${isNF ? 'yes' : 'no'}
- Erotic/adult content: ${isErotic ? 'yes — preserve adult content already present' : 'no'}

TASK:
For each flagged item, return a corrected replacement sentence only if the sentence is truly malformed.

Fix only:
- missing subject at sentence start
- broken article/demonstrative starts like "A air..." or "One corridor..."
- dangling fragments like "Closed ." or "white space on ."
- lowercase proper-name sentence starts
- leading fragments like "of the..." when they clearly need connection or subject
- noun-substitution artifacts where breath became pause, moment, air, silence, or beat

Rules:
- Preserve meaning.
- Preserve character names.
- Preserve adult content already present.
- Do not sanitize.
- Do not add new plot events.
- Do not make the prose prettier.
- Do not add explanations.
- If the deterministicSuggestion is already correct, use it.
- If no safe repair is possible, omit that id.
- Replacement must be a single sentence or the smallest possible corrected sentence fragment.
- Keep the author's tense and POV.
${retry ? '- This is a retry. You MUST return valid JSON only. No prose outside JSON.' : ''}

OUTPUT ONLY VALID JSON:
{
  "patches": [
    {
      "id": "same id from input",
      "paragraphIndex": 0,
      "sentenceIndex": 0,
      "replacement": "corrected sentence only",
      "reason": "brief reason"
    }
  ]
}

FLAGGED ITEMS:
${JSON.stringify(candidatePayload, null, 2)}`;
}

function buildDeterministicFallbackPatches(candidates) {
  return candidates
    .map((candidate) => {
      const replacement = deterministicSentenceRepair(candidate.sentence, candidate.context);

      if (!replacement || replacement === candidate.sentence) return null;
      if (classifyMalformedSentence(replacement)) return null;

      return {
        id: candidate.id,
        paragraphIndex: candidate.paragraphIndex,
        sentenceIndex: candidate.sentenceIndex,
        replacement,
        reason: `deterministic fallback: ${candidate.reason}`,
      };
    })
    .filter(Boolean);
}

async function requestMalformedPatches({
  project,
  chapterNumber,
  candidates,
  retry = false,
}) {
  const prompt = buildMalformedSentencePatchPrompt({
    project,
    chapterNumber,
    candidates,
    retry,
  });

  const result = await invokeLLMWithRetry({
    task_type: 'critique',
    prompt,
    model: pickModel('critique', project) || 'openai_gpt5',
    fallback_model: pickFallbackModel('critique', project) || 'deepseek/deepseek-v3.2',
    temperature: retry ? 0 : 0.02,
    max_tokens: retry ? 6500 : 5000,
    disable_fallbacks: false,
  });

  return parseJsonPatchResponse(result);
}

async function runTargetedMalformedSentenceRepair({
  text,
  project,
  chapterNumber,
  onProgress,
}) {
  let source = normalizeText(text);

  const deterministicBefore = runSurgicalArtifactRepair(source);
  source = deterministicBefore.text;

  let candidates = detectMalformedSentenceCandidates(source);

  if (!candidates.length) {
    return {
      text: source,
      fixes: deterministicBefore.fixes || [],
      warnings: [],
      candidates: [],
      patches: [],
      skipped: false,
    };
  }

  onProgress?.(`Repairing malformed sentence artifacts in chapter ${chapterNumber || ''}…`.trim());

  let patches = [];

  try {
    patches = await requestMalformedPatches({
      project,
      chapterNumber,
      candidates,
      retry: false,
    });

    if (!patches.length) {
      const retryCandidates = candidates.slice(0, 24);

      patches = await requestMalformedPatches({
        project,
        chapterNumber,
        candidates: retryCandidates,
        retry: true,
      });
    }
  } catch (error) {
    console.warn('[POST-DRAFT] malformed sentence LLM repair failed:', error);
  }

  if (!patches.length) {
    patches = buildDeterministicFallbackPatches(candidates);
  } else {
    const patchedIds = new Set(patches.map((patch) => patch.id).filter(Boolean));
    const fallbackPatches = buildDeterministicFallbackPatches(
      candidates.filter((candidate) => !patchedIds.has(candidate.id))
    );
    patches = [...patches, ...fallbackPatches];
  }

  if (!patches.length) {
    return {
      text: source,
      fixes: deterministicBefore.fixes || [],
      warnings: [`Malformed sentence repair found ${candidates.length} candidate(s), but returned no usable patches`],
      candidates,
      patches: [],
      skipped: true,
    };
  }

  const applied = applySentencePatchesByIndex(source, candidates, patches);
  const validation = validateEditedText(source, applied.text, {
    minLengthRatio: 0.94,
    maxLengthRatio: 1.08,
  });

  if (!validation.ok) {
    return {
      text: source,
      fixes: deterministicBefore.fixes || [],
      warnings: [`Malformed sentence patch stage rejected: ${validation.reason}`],
      candidates,
      patches,
      skipped: true,
    };
  }

  const remaining = detectMalformedSentenceCandidates(applied.text);

  return {
    text: applied.text,
    fixes: [
      ...(deterministicBefore.fixes || []),
      `Targeted malformed-sentence repair checked ${candidates.length} candidate(s)`,
      ...applied.fixes,
    ],
    warnings: [
      ...applied.warnings,
      remaining.length
        ? `Malformed sentence repair left ${remaining.length} candidate(s): ${remaining
            .slice(0, 8)
            .map((item) => `"${item.sentence.slice(0, 90)}"`)
            .join('; ')}`
        : null,
    ].filter(Boolean),
    candidates,
    patches,
    skipped: false,
  };
}

function buildFrequencyWarnings(overusedWords = []) {
  if (!overusedWords.length) return [];

  return overusedWords
    .filter((item) => item.count >= 18)
    .slice(0, 10)
    .map((item) => `"${item.word}" appears ${item.count} times`);
}

function buildSurvivorWarning(text) {
  const source = normalizeText(text);

  // PROSEGUARD-1: this was the third hand-maintained copy of the same one-book
  // phrase list. A survivor is a phrase this project has a repair rule for that is
  // still present after every pass ran — which is the only definition that means
  // anything, and the only one that cannot drift from the repairs themselves.
  const hits = knownBrokenPhraseSources()
    .map((src) => {
      try { return new RegExp(src, 'i'); } catch { return null; }
    })
    .filter((rx) => rx && rx.test(source))
    .map((rx) => String(rx));

  return hits;
}

/**
 * Main chapter-level cleanup entry.
 *
 * @param {string|object} text
 * @param {object} project
 * @param {number|string} chapterNumber
 * @param {function} onProgress
 * @param {object} options
 */
/**
 * PROSEGUARD-1 wrapper: resolve this project's prose repairs, run the cleanup, and
 * always put the module back to EMPTY so no book can inherit another book's rules
 * through a thrown error.
 */
export async function postDraftCleanup(text, project = {}, chapterNumber = '', onProgress, options = {}) {
  proseRepairs = resolveProseRepairs(project);
  try {
    return await postDraftCleanupInner(text, project, chapterNumber, onProgress, options);
  } finally {
    proseRepairs = EMPTY_PROSE_REPAIRS;
  }
}

async function postDraftCleanupInner(text, project = {}, chapterNumber = '', onProgress, options = {}) {
  // LEAKFIX-1: kill model control tokens + non-Latin drift before every other
  // pass. Covers continuation and judge-revision output, which never re-enter
  // the scene-level light clean.
  const initialText = scrubModelLeaks(normalizeText(text), `Ch.${chapterNumber}`).text;

  console.log(`[POST-DRAFT] postDraftCleanup() called: ${POST_DRAFT_CLEANUP_VERSION}`, {
    chapterNumber,
    inputChars: initialText.length,
    runLLM: options.runLLM !== false,
    runMalformedPatchRepair: options.runMalformedPatchRepair !== false,
    mode: options.mode || 'post-draft',
  });

  if (!initialText || initialText.length < 100) {
    return {
      text: initialText || '',
      cleanedText: initialText || '',
      finalText: initialText || '',
      fixes: [],
      warnings: [],
      overusedWords: [],
      frequencyWarnings: [],
      removals: [],
      truncatedSentences: [],
      repeatedParagraphs: [],
      surgicalArtifacts: [],
      malformedSentenceCandidates: [],
      malformedSentencePatches: [],
      wordCount: countWords(initialText),
      changed: false,
      skipped: true,
      version: POST_DRAFT_CLEANUP_VERSION,
    };
  }

  const mode = options.mode || 'post-draft';
  const runLLM = options.runLLM !== false;
  const runMalformedPatchRepair = options.runMalformedPatchRepair !== false;

  onProgress?.(`Cleaning chapter ${chapterNumber || ''}…`.trim());

  const original = initialText;
  const phase1 = regexCleanup(original, {
    removeDuplicateParagraphs: options.removeDuplicateParagraphs !== false,
  });

  let workingText = phase1.text;
  let fixes = [...phase1.fixes];
  const removals = [...(phase1.removals || [])];
  let warnings = [];
  let llmResult = null;
  let malformedPatchResult = null;

  if (runLLM) {
    llmResult = await llmCopyedit({
      text: workingText,
      project,
      chapterNumber,
      truncated: phase1.truncated || [],
      mode,
      onProgress,
    });

    workingText = llmResult.text;
    fixes = [...fixes, ...(llmResult.fixes || [])];
    warnings = [...warnings, ...(llmResult.warnings || [])];
  }

  const finalHygiene = runFinalHygiene(workingText);
  workingText = finalHygiene.text;
  fixes = [...fixes, ...finalHygiene.fixes];

  const microBeforeSurgical = runMicroCopyeditRepairs(workingText);
  workingText = microBeforeSurgical.text;
  fixes = [...fixes, ...microBeforeSurgical.fixes];

  const hardBeforeSurgical = runFinalHardSurvivorRepairs(workingText);
  workingText = hardBeforeSurgical.text;
  fixes = [...fixes, ...hardBeforeSurgical.fixes];

  const surgicalRepair = runSurgicalArtifactRepair(workingText);
  const surgicalValidation = validateEditedText(workingText, surgicalRepair.text, {
    minLengthRatio: 0.94,
    maxLengthRatio: 1.08,
  });

  if (surgicalValidation.ok) {
    workingText = surgicalRepair.text;
    fixes = [...fixes, ...surgicalRepair.fixes];
  } else {
    warnings.push(`Surgical artifact repair rejected: ${surgicalValidation.reason}`);
  }

  if (runMalformedPatchRepair) {
    malformedPatchResult = await runTargetedMalformedSentenceRepair({
      text: workingText,
      project,
      chapterNumber,
      onProgress,
    });

    const malformedValidation = validateEditedText(workingText, malformedPatchResult.text, {
      minLengthRatio: 0.94,
      maxLengthRatio: 1.08,
    });

    if (malformedValidation.ok) {
      workingText = malformedPatchResult.text;
      fixes = [...fixes, ...(malformedPatchResult.fixes || [])];
      warnings = [...warnings, ...(malformedPatchResult.warnings || [])];
    } else {
      warnings.push(`Targeted malformed-sentence repair rejected: ${malformedValidation.reason}`);
    }
  }

  const finalMicro = runMicroCopyeditRepairs(workingText);
  workingText = finalMicro.text;
  fixes = [...fixes, ...finalMicro.fixes];

  /*
   * CRITICAL FINAL STEP:
   * This must remain near the bottom, after every LLM/deterministic pass that could
   * reintroduce malformed phrase families.
   */
  const finalHardSurvivors = runFinalHardSurvivorRepairs(workingText);
  workingText = finalHardSurvivors.text;
  fixes = [...fixes, ...finalHardSurvivors.fixes];

  /*
   * One last hygiene normalization after hard-survivor replacements.
   */
  const finalFinalHygiene = runFinalHygiene(workingText);
  workingText = finalFinalHygiene.text;
  fixes = [...fixes, ...finalFinalHygiene.fixes];

  const finalTruncations = findTruncatedCandidates(workingText);
  const repeatedParagraphs = detectRepeatedParagraphs(workingText);
  const overusedWords = detectOverusedWords(workingText, options.overuseLimit || 18);
  const frequencyWarnings = buildFrequencyWarnings(overusedWords);
  const surgicalArtifacts = findSurgicalArtifacts(workingText);
  const malformedSentenceCandidates = detectMalformedSentenceCandidates(workingText);
  const hardSurvivorHits = buildSurvivorWarning(workingText);

  if (finalTruncations.length > 0) {
    warnings.push(`${finalTruncations.length} possible truncated sentence(s) still need human review`);
  }

  if (repeatedParagraphs.length > 0) {
    warnings.push(`${repeatedParagraphs.length} possible duplicate paragraph(s) still remain`);
  }

  if (frequencyWarnings.length > 0) {
    warnings.push(...frequencyWarnings);
  }

  if (surgicalArtifacts.length > 0) {
    warnings.push(`${surgicalArtifacts.length} possible surgical grammar artifact(s) still need review`);
  }

  if (malformedSentenceCandidates.length > 0) {
    warnings.push(
      `${malformedSentenceCandidates.length} malformed sentence candidate(s) still need review: ${malformedSentenceCandidates
        .slice(0, 8)
        .map((item) => `"${item.sentence.slice(0, 90)}"`)
        .join('; ')}`
    );
  }

  if (hardSurvivorHits.length > 0) {
    warnings.push(
      `Hard-survivor scan still found ${hardSurvivorHits.length} unresolved pattern(s): ${hardSurvivorHits
        .slice(0, 8)
        .join('; ')}`
    );
  }

  // PROSEGUARD-1: `original` is initialText, which is already the LEAKFIX-1 scrub of
  // the caller's input — so a chapter whose only defect was a model control token came
  // back rewritten with changed:false, and the caller had no reason to save it. The
  // baseline for "did this change" has to be what the caller actually handed us.
  const changed = normalizeText(text) !== normalizeText(workingText);

  const allFixes = [...new Set(fixes.filter(Boolean))];
  const allWarnings = [...new Set(warnings.filter(Boolean))];

  console.log(`[POST-DRAFT] postDraftCleanup() finished: ${POST_DRAFT_CLEANUP_VERSION}`, {
    chapterNumber,
    changed,
    fixCount: allFixes.length,
    warningCount: allWarnings.length,
    outputChars: workingText.length,
    outputWords: countWords(workingText),
  });

  if (allFixes.length || allWarnings.length) {
    console.log(
      `[POST-DRAFT] Ch.${chapterNumber || '?'}: ${allFixes.length} fix action(s), ${allWarnings.length} warning(s)`
    );

    for (const warning of allWarnings) {
      console.warn(`[POST-DRAFT] Ch.${chapterNumber || '?'} warning: ${warning}`);
    }
  }

  return {
    text: workingText,
    cleanedText: workingText,
    finalText: workingText,
    content: workingText,
    prose: workingText,

    fixes: allFixes,
    warnings: allWarnings,
    overusedWords,
    frequencyWarnings,
    removals,

    truncatedSentences: finalTruncations,
    repeatedParagraphs,
    surgicalArtifacts,
    malformedSentenceCandidates,
    malformedSentencePatches: malformedPatchResult?.patches || [],
    hardSurvivorHits,

    wordCount: countWords(workingText),
    originalWordCount: countWords(original),

    changed,
    skipped: false,
    llmSkipped: llmResult?.skipped || false,
    malformedPatchSkipped: malformedPatchResult?.skipped || false,
    version: POST_DRAFT_CLEANUP_VERSION,
  };
}

/**
 * Convenience helper for future full-manuscript engines.
 * Runs the same cleaner over an array of chapter records.
 */
export async function cleanupChapterBatch({
  chapters = [],
  project = {},
  resolveContent,
  onProgress,
  options = {},
}) {
  const results = [];

  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    const chapterNumber = chapter?.chapter_number || chapter?.number || index + 1;

    onProgress?.(`Cleaning chapter ${chapterNumber} (${index + 1}/${chapters.length})…`);

    const rawText =
      typeof resolveContent === 'function'
        ? await resolveContent(chapter)
        : chapter?.content_md || chapter?.content || chapter?.prose || chapter?.body || '';

    const cleaned = await postDraftCleanup(
      rawText,
      project,
      chapterNumber,
      onProgress,
      options
    );

    results.push({
      chapter,
      chapterNumber,
      originalText: normalizeText(rawText),
      cleanedText: cleaned.text,
      result: cleaned,
      changed: cleaned.changed,
    });
  }

  return results;
}

export default postDraftCleanup;
