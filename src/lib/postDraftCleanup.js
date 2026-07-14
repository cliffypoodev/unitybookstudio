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

const POST_DRAFT_CLEANUP_VERSION = 'MICRO-COPYEDIT v4 HARD-SURVIVOR FINAL PASS - 2026-05-02';

console.log(`[POST-DRAFT] postDraftCleanup.js loaded: ${POST_DRAFT_CLEANUP_VERSION}`);

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

function projectIsNonfiction(project = {}) {
  const bookType = String(project.book_type || '').toLowerCase();
  const projectType = String(project.project_type || '').toLowerCase();

  return bookType === 'nonfiction' || projectType === 'nonfiction';
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

function findEditorialArtifacts(text) {
  const artifacts = [];
  const patterns = [
    /\[?\s*Replace\s+(the|this|these|that)\s+[\w\s]*with\s+[\w\s]*[.\]]/gi,
    /\[?\s*Remove\s+(the|this|these|that)\s+duplicate\s+[\w\s]*[.\]]/gi,
    /\[?\s*Insert\s+(a|the|an)\s+[\w\s]*here[.\]]/gi,
    /\[?\s*TODO[:\s][^\n]*/gi,
    /\[?\s*FIXME[:\s][^\n]*/gi,
    /\[?\s*NOTE TO (SELF|AUTHOR|EDITOR)[:\s][^\n]*/gi,
    /\[?\s*EDITOR'?S?\s+NOTE[:\s][^\n]*/gi,
    /\[?\s*DELETE\s+THIS[^\n]*/gi,
    /\[?\s*CUT\s+THIS\s+(SECTION|PARAGRAPH|SENTENCE)[^\n]*/gi,
    /\[?\s*REWRITE\s+THIS[^\n]*/gi,
    /\[?\s*NEEDS?\s+(REVISION|EDITING|REWRITE|WORK)[^\n]*/gi,
    /\[?\s*PLACEHOLDER[:\s][^\n]*/gi,
    /\[?\s*TK\s[^\n]*/gi,
    /\*\*\s*Replace\s+.*?scene\s+break.*?\*\*/gi,
    /<!--[\s\S]*?-->/g,
  ];

  for (const pattern of patterns) {
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

  let contractionFixed = 0;
  t = t.replace(
    /\b(doesn|wouldn|couldn|shouldn|hasn|hadn|isn|aren|weren|wasn|haven|mustn|needn|won|didn|can|ain)'\s/gi,
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

  let brokenDialogFixed = 0;
  t = t.replace(/([a-zA-Z])\s*"\s*(said|asked|whispered|murmured|shouted|snapped|replied|answered)\b/g, (match, prev, tag) => {
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

    const editorialPatterns = [
      /\[?\s*Replace\s+(the|this|these|that)\s+[\w\s]*with\s+[\w\s]*[.\]]/gi,
      /\[?\s*Remove\s+(the|this|these|that)\s+duplicate\s+[\w\s]*[.\]]/gi,
      /\[?\s*Insert\s+(a|the|an)\s+[\w\s]*here[.\]]/gi,
      /\[?\s*TODO[:\s][^\n]*/gi,
      /\[?\s*FIXME[:\s][^\n]*/gi,
      /\[?\s*NOTE TO (SELF|AUTHOR|EDITOR)[:\s][^\n]*/gi,
      /\[?\s*EDITOR'?S?\s+NOTE[:\s][^\n]*/gi,
      /\[?\s*DELETE\s+THIS[^\n]*/gi,
      /\[?\s*CUT\s+THIS\s+(SECTION|PARAGRAPH|SENTENCE)[^\n]*/gi,
      /\[?\s*REWRITE\s+THIS[^\n]*/gi,
      /\[?\s*NEEDS?\s+(REVISION|EDITING|REWRITE|WORK)[^\n]*/gi,
      /\[?\s*PLACEHOLDER[:\s][^\n]*/gi,
      /\[?\s*TK\s[^\n]*/gi,
      /\*\*\s*Replace\s+.*?scene\s+break.*?\*\*/gi,
      /<!--[\s\S]*?-->/g,
    ];

    for (const pattern of editorialPatterns) {
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

  const beforeAssistantPreface = t;
  t = t
    .replace(/^\s*(Here is|Here's|Certainly|Sure|Okay),?\s+(the\s+)?(corrected|edited|revised|cleaned)?\s*(chapter|text|prose)[:.\-\s]*/i, '')
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

  const replacements = [
    {
      label: 'missing conjunction after “moved back in”',
      pattern: /\bmoved back in\s+took\b/gi,
      replacement: 'moved back in and took',
    },
    {
      label: 'missing conjunction after “capped it”',
      pattern: /\bcapped it\s+set it aside\b/gi,
      replacement: 'capped it and set it aside',
    },
    {
      label: 'missing conjunction after “gaze lifted”',
      pattern: /\bgaze lifted\s+found\b/gi,
      replacement: 'gaze lifted and found',
    },
    {
      label: 'missing conjunction after “He reached for the cold coffee”',
      pattern: /\bHe reached for the cold coffee\s+took a sip\b/g,
      replacement: 'He reached for the cold coffee and took a sip',
    },
    {
      label: 'missing comma before “cutting”',
      pattern: /\bswung shut\s+cutting\b/gi,
      replacement: 'swung shut, cutting',
    },
    {
      label: 'missing comma before “setting”',
      pattern: /\bstraightened\s+setting\b/gi,
      replacement: 'straightened, setting',
    },
    {
      label: 'missing comma in raised-hand clause',
      pattern: /\bHis hand,\s+still raised\s+began\b/g,
      replacement: 'His hand, still raised, began',
    },
    {
      label: 'wrong noun: beat fogged → breath fogged',
      pattern: /\bHis beat fogged\b/g,
      replacement: 'His breath fogged',
    },
    {
      label: 'wrong noun: beat hitched → breath hitched',
      pattern: /\bHis beat hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: silence hitched → breath hitched',
      pattern: /\bHis silence hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: air hitched → breath hitched',
      pattern: /\bHis air hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: pause was warm → breath was warm',
      pattern: /\bHis pause was warm\b/g,
      replacement: 'His breath was warm',
    },
    {
      label: 'wrong noun: pause hitched → breath hitched',
      pattern: /\bHis pause hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: pause fogged → breath fogged',
      pattern: /\bHis pause fogged\b/g,
      replacement: 'His breath fogged',
    },
    {
      label: 'wrong noun: moment hitched → breath hitched',
      pattern: /\bHis moment hitched\b/g,
      replacement: 'His breath hitched',
    },
    {
      label: 'wrong noun: Husbandman pause → breath',
      pattern: /\bThe Husbandman’s pause was warm\b/g,
      replacement: 'The Husbandman’s breath was warm',
    },
    {
      label: 'wrong noun: stale coffee on his pause → breath',
      pattern: /\bstale coffee on his pause\b/gi,
      replacement: 'stale coffee on his breath',
    },
    {
      label: 'wrong noun: coffee on his pause → breath',
      pattern: /\bcoffee on his pause\b/gi,
      replacement: 'coffee on his breath',
    },
    {
      label: 'wrong noun: stale coffee on his silence → breath',
      pattern: /\bstale coffee on his silence\b/gi,
      replacement: 'stale coffee on his breath',
    },
    {
      label: 'wrong noun: coffee on his silence → breath',
      pattern: /\bcoffee on his silence\b/gi,
      replacement: 'coffee on his breath',
    },
    {
      label: 'wrong noun: deliberate moment → breath',
      pattern: /\bdeep,\s+deliberate moment right over\b/gi,
      replacement: 'deep, deliberate breath right over',
    },
    {
      label: 'wrong noun: deliberate beat → breath',
      pattern: /\bdeep,\s+deliberate beat right over\b/gi,
      replacement: 'deep, deliberate breath right over',
    },
    {
      label: 'wrong noun: took not a sniff but a breath',
      pattern: /\btook not a sniff,\s+but a deep,\s+deliberate (moment|beat)\b/gi,
      replacement: 'took not a sniff, but a deep, deliberate breath',
    },
    {
      label: 'missing comma after action',
      pattern: /\bshut\s+cutting off\b/gi,
      replacement: 'shut, cutting off',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+cutting off\b/gi,
      replacement: 'turned, cutting off',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+sealing\b/gi,
      replacement: 'turned, sealing',
    },
    {
      label: 'missing comma after action',
      pattern: /\bturned\s+leaving\b/gi,
      replacement: 'turned, leaving',
    },
    {
      label: 'missing comma after action',
      pattern: /\bstood\s+setting the\b/gi,
      replacement: 'stood, setting the',
    },
    {
      label: 'missing comma after action',
      pattern: /\bstepped forward\s+closing\b/gi,
      replacement: 'stepped forward, closing',
    },
    {
      label: 'missing comma after action',
      pattern: /\bleaned forward\s+closed his eyes\b/gi,
      replacement: 'leaned forward, closing his eyes',
    },
    {
      label: 'missing comma after dialogue setup',
      pattern: /\bHis voice,\s+when it came\s+was\b/g,
      replacement: 'His voice, when it came, was',
    },
    {
      label: 'missing comma in “noticed” clause',
      pattern: /\bthe man noticed\s+were\b/gi,
      replacement: 'the man noticed, were',
    },
    {
      label: 'minor table wording cleanup',
      pattern: /\bthe captive still sitting on his table\b/gi,
      replacement: 'the captive still sitting on the table',
    },
    {
      label: 'wrong noun: own movement sounded too loud → own breathing sounded too loud',
      pattern: /\bown movement sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'wrong noun: own quiet sounded too loud → own breathing sounded too loud',
      pattern: /\bown quiet sounded too loud\b/gi,
      replacement: 'own breathing sounded too loud',
    },
    {
      label: 'wrong noun: His own movement sounded too loud → His own breathing sounded too loud',
      pattern: /\bHis own movement sounded too loud\b/g,
      replacement: 'His own breathing sounded too loud',
    },
    {
      label: 'missing comma after groan',
      pattern: /\bHe groaned\s+doubling over\b/gi,
      replacement: 'He groaned, doubling over',
    },
    {
      label: 'missing comma after hand clause',
      pattern: /\bHis hand,\s+still raised\s*,?\s+began to tremble\b/g,
      replacement: 'His hand, still raised, began to tremble',
    },
    {
      label: 'wrong noun: boy air hitched → boy breath hitched',
      pattern: /\b(The boy’s|the boy’s|A boy’s|a boy’s)\s+air hitched\b/g,
      replacement: '$1 breath hitched',
    },
  ];

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

  const replacements = [
    {
      label: 'FINAL survivor: shut cutting → shut, cutting',
      pattern: /\b(shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: swung shut cutting → swung shut, cutting',
      pattern: /\b(swung shut)\s+(cutting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: straightened setting → straightened, setting',
      pattern: /\b(straightened)\s+(setting\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: groaned doubling → groaned, doubling',
      pattern: /\b(groaned)\s+(doubling\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: still raised began → still raised, began',
      pattern: /\b(still raised)\s+(began\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: hand still raised began',
      pattern: /\b(His hand,\s+still raised)\s*,?\s+(began\b)/g,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: pause fogged → breath fogged',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|Orin’s|Elias’s|Jonah’s|Caspian’s|Ronan’s|Kael’s|Lev’s|Silas’s)\s+pause\s+(fogged\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: pause hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|Orin’s|Elias’s|Jonah’s|Caspian’s|Ronan’s|Kael’s|Lev’s|Silas’s)\s+pause\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: moment hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|Orin’s|Elias’s|Jonah’s|Caspian’s|Ronan’s|Kael’s|Lev’s|Silas’s)\s+moment\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: air hitched → breath hitched',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|Orin’s|Elias’s|Jonah’s|Caspian’s|Ronan’s|Kael’s|Lev’s|Silas’s)\s+air\s+(hitched\b)/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: silence hitched/fogged → breath hitched/fogged',
      pattern: /\b(His|Her|Their|The man’s|The boy’s|The handler’s|The Husbandman’s|Orin’s|Elias’s|Jonah’s|Caspian’s|Ronan’s|Kael’s|Lev’s|Silas’s)\s+silence\s+(hitched|fogged)\b/g,
      replacement: '$1 breath $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: coffee on his silence/pause → coffee on his breath',
      pattern: /\b(coffee on his)\s+(silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: stale coffee on his silence/pause → stale coffee on his breath',
      pattern: /\b(stale coffee on his)\s+(silence|pause|moment|air)\b/gi,
      replacement: '$1 breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: deliberate beat/moment → deliberate breath',
      pattern: /\b(deep,\s+deliberate)\s+(beat|moment)\s+(right over\b)/gi,
      replacement: '$1 breath $3',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: took not a sniff but deliberate beat/moment',
      pattern: /\btook not a sniff,\s+but a deep,\s+deliberate\s+(beat|moment)\b/gi,
      replacement: 'took not a sniff, but a deep, deliberate breath',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: moved back in took → moved back in and took',
      pattern: /\bmoved back in\s+took\b/gi,
      replacement: 'moved back in and took',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: capped it set it aside → capped it and set it aside',
      pattern: /\bcapped it\s+set it aside\b/gi,
      replacement: 'capped it and set it aside',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: gaze lifted found → gaze lifted and found',
      pattern: /\bgaze lifted\s+found\b/gi,
      replacement: 'gaze lifted and found',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: reached for cold coffee took sip',
      pattern: /\b(He|She|They|Elias|Orin|Caspian|Jonah|Silas|Lev|Ronan|Kael)\s+reached for the cold coffee\s+took a sip\b/g,
      replacement: '$1 reached for the cold coffee and took a sip',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: noticed were → noticed, were',
      pattern: /\b(the man noticed)\s+(were\b)/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: hands he noticed were → hands, he noticed, were',
      pattern: /\b(His hands)\s+he noticed\s+(were\b)/g,
      replacement: '$1, he noticed, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
    {
      label: 'FINAL survivor: close action comma before closing/sealing/leaving',
      pattern: /\b(stepped forward|moved forward|turned|leaned forward|stood)\s+(closing|sealing|leaving|setting)\b/gi,
      replacement: '$1, $2',
      fixPrefix: 'Final hard-survivor pass repaired',
    },
  ];

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

function detectLikelyProperNames(text) {
  const source = normalizeText(text);
  const explicit = source.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const counts = new Map();

  for (const name of explicit) {
    const lower = name.toLowerCase();
    counts.set(lower, Math.max(counts.get(lower) || 0, 2));
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

  for (const lower of names) {
    const cap = capitalizeName(lower);
    const rx = new RegExp(`(^|[.!?…]\\s+|—\\s*)(${lower})(\\b)`, 'g');

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

  const replacements = [
    [/^A air\b/, 'The air'],
    [/^One air\b/, 'The air'],
    [/^One silence\b/, 'The silence'],
    [/^One corridor\b/, 'The corridor'],
    [/^One hum\b/, 'The hum'],
    [/^One walls\b/, 'The walls'],
    [/^Its man\b/, 'The man'],
    [/^Its door\b/, 'The door'],
    [/^Its world\b/, 'The world'],
    [/^That silence here\b/, 'The silence here'],
  ];

  for (const [pattern, replacement] of replacements) {
    s = s.replace(pattern, replacement);
  }

  s = s
    .replace(/\bwhite space on\s+\./g, 'white space.')
    .replace(/\bblank field on\s+\./g, 'blank field.')
    .replace(/\bthe familiar pull at like a lie\b/g, 'the familiar pull felt like a lie')
    .replace(/\bThe like hands on him\b/g, 'It felt like hands on him')
    .replace(/\bHe said softly it in\./g, 'He breathed it in softly.')
    .replace(/\bA stupid, wet sound\./g, 'A stupid, wet sound came from him.')
    .replace(/\bThe few like a mile\b/g, 'The few steps felt like a mile')
    .replace(/\bA few like a mile\b/g, 'The few steps felt like a mile')
    .replace(/\bHis beat was warm\b/g, 'His breath was warm')
    .replace(/\bHis pause came shorter\b/g, 'His breath came shorter')
    .replace(/\bHis beat fogged\b/g, 'His breath fogged')
    .replace(/\bHis pause fogged\b/g, 'His breath fogged')
    .replace(/\bHis air hitched\b/g, 'His breath hitched')
    .replace(/\bHis moment hitched\b/g, 'His breath hitched')
    .replace(/\bthe stale coffee on his pause\b/gi, 'the stale coffee on his breath')
    .replace(/\bthe stale coffee on his silence\b/gi, 'the stale coffee on his breath');

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

  s = s.replace(/^Was\b/, `${subject} was`);
  s = s.replace(/^Were\b/, `${subject} were`);
  s = s.replace(/^Had\b/, `${subject} had`);
  s = s.replace(/^Looked\b/, `${subject} looked`);
  s = s.replace(/^Turned\b/, `${subject} turned`);
  s = s.replace(/^Felt\b/, `${subject} felt`);
  s = s.replace(/^Knew\b/, `${subject} knew`);
  s = s.replace(/^Thought\b/, `${subject} thought`);
  s = s.replace(/^Sounded\b/, `${subject} sounded`);
  s = s.replace(/^Tasted\b/, `${subject} tasted`);
  s = s.replace(/^Smelled\b/, `${subject} smelled`);

  s = s.replace(/\bClosed\s*\.$/, 'closed it.');
  s = s.replace(/\bopened\s*\.$/, 'opened it.');
  s = s.replace(/\b(on|at|with|from|into|of|to|for)\s+\.$/, '.');

  s = s.replace(/(^|—\s+)([a-z][a-z]{2,})(\b)/g, (match, prefix, word, boundary) => {
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

  const repairedParagraphs = paragraphs.map((paragraph) => {
    const sentences = splitSentences(paragraph).map((sentence) => sentence.trim()).filter(Boolean);

    const repaired = sentences.map((sentence) => {
      const fixed = deterministicSentenceRepair(sentence, paragraph);

      if (fixed !== sentence) changed += 1;
      return fixed;
    });

    return repaired.join(' ');
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
      rx: /\b(the familiar pull at like a lie|white space on \.|blank field on \.|His beat warm|His beat was warm|His beat hitched|His beat fogged|His pause was warm|His pause came shorter|His pause hitched|His pause fogged|His air hitched|His moment hitched|The Husbandman’s pause was warm|The few like a mile|A few like a mile|He said softly it in|The like hands on him|deep, deliberate moment right over|deep, deliberate beat right over|moved back in took|capped it set it aside|gaze lifted found|swung shut cutting|straightened setting|coffee on his pause|coffee on his silence)\b/gi,
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

  if (/\b(white space on \.|blank field on \.|familiar pull at like a lie|said softly it in|The like hands on him|The few like a mile|A few like a mile|His beat hitched|His beat fogged|His pause was warm|His pause hitched|His pause fogged|His air hitched|His moment hitched|The Husbandman’s pause was warm|deep, deliberate moment right over|deep, deliberate beat right over|moved back in took|capped it set it aside|gaze lifted found|swung shut cutting|straightened setting|coffee on his pause|coffee on his silence)\b/i.test(s)) {
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

  const survivorPatterns = [
    /\bswung shut cutting\b/i,
    /\bshut cutting off\b/i,
    /\bstraightened setting\b/i,
    /\bgroaned doubling\b/i,
    /\bstill raised began\b/i,
    /\bHis pause fogged\b/,
    /\bHis moment hitched\b/,
    /\bHis air hitched\b/,
    /\bHis silence hitched\b/,
    /\bThe boy’s air hitched\b/,
    /\bstale coffee on his silence\b/i,
    /\bcoffee on his silence\b/i,
    /\bdeep,\s+deliberate beat right over\b/i,
    /\bdeep,\s+deliberate moment right over\b/i,
    /\bmoved back in took\b/i,
    /\bcapped it set it aside\b/i,
    /\bgaze lifted found\b/i,
  ];

  const hits = survivorPatterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => String(pattern));

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
export async function postDraftCleanup(text, project = {}, chapterNumber = '', onProgress, options = {}) {
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

  const changed = normalizeText(original) !== normalizeText(workingText);

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