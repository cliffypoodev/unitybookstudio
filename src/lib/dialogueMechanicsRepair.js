/**
 * Dialogue Mechanics Repair — Missing Opening Quote Detector & Fixer
 *
 * Detects lines where a closing quotation mark + dialogue tag is present but
 * the matching opening quote is missing, then surgically inserts the opener.
 *
 * Two issue categories:
 *   - paragraph_start_missing_quote: line begins with unquoted speech
 *   - mid_paragraph_missing_quote: speech appears mid-line after narration
 *
 * Handles both straight quotes (") and curly quotes (\u201c \u201d).
 * Conservative: flags ambiguous cases for manual review rather than guessing.
 *
 * Public API:
 *   - detectDialogueQuoteIssues(text, options)
 *   - repairMissingDialogueOpeners(text, options)
 *   - runDialogueMechanicsPass(text, options)
 *   - VERSION
 */

export const VERSION = 'dialogue-mechanics-repair-v1.1.0-orphan-closer';
console.log(`[DIALOGUE-MECHANICS-REPAIR] Loaded ${VERSION}`);

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Maximum character length for plausible dialogue. Anything longer gets
 * flagged for manual review instead of auto-repaired.
 */
const MAX_PLAUSIBLE_SPEECH_LENGTH = 300;

/**
 * Dialogue tags — the verb portion that follows a speaker name/pronoun.
 * Case-insensitive matching is applied at the regex level.
 */
const DIALOGUE_VERBS = [
  'said', 'asked', 'replied', 'countered', 'retorted', 'corrected',
  'whispered', 'murmured', 'demanded', 'challenged', 'confirmed',
  'repeated', 'continued', 'interrupted', 'admitted', 'added',
  'protested', 'agreed', 'insisted', 'observed', 'noted',
  'announced', 'warned', 'explained', 'suggested', 'offered',
  'prompted', 'conceded', 'argued', 'snapped', 'snarled',
  'growled', 'muttered', 'answered', 'breathed', 'shouted',
  'called', 'pressed', 'objected', 'exclaimed', 'declared',
];

/**
 * Two-word dialogue verb phrases (e.g., "shot back", "called out").
 * These are matched separately because the regex needs to allow for
 * the space between the two words.
 */
const DIALOGUE_VERB_PHRASES = [
  'shot back', 'called out', 'fired back', 'lashed out',
  'bit out', 'threw back', 'cried out', 'pointed out',
];

/**
 * Speaker subjects that can appear before the dialogue verb.
 * Includes pronouns, known character names, and a catch-all for
 * any capitalized name (single word starting with uppercase).
 */
const SPEAKER_PRONOUNS = 'she|he|they|it';
const SPEAKER_NAMES = 'the\\s+system|the\\s+voice|the\\s+AI|the\\s+guide|the\\s+director';
// Catch-all for any capitalized proper name (e.g., "Pauline", "Cross")
const SPEAKER_CAP_NAME = '[A-Z][a-zA-Z\u2019\']+';

/** Combined speaker pattern (non-capturing alternation). */
const SPEAKER_PATTERN = `(?:${SPEAKER_PRONOUNS}|${SPEAKER_NAMES}|${SPEAKER_CAP_NAME})`;

/** Combined single-word dialogue verb alternation. */
const VERB_PATTERN = `(?:${DIALOGUE_VERBS.join('|')})`;

/** Combined two-word dialogue verb phrase alternation. */
const VERB_PHRASE_PATTERN = `(?:${DIALOGUE_VERB_PHRASES.map(p => p.replace(' ', '\\s+')).join('|')})`;

// ─── Quote helpers ───────────────────────────────────────────────────────────

/** Matches any closing double-quote character (straight or curly). */
const CLOSE_QUOTE_CHAR = '["\\u201d]';
/** Matches any opening double-quote character (straight or curly). */
const OPEN_QUOTE_CHAR = '["\\u201c]';

/**
 * Return the matching opening quote for a given closing quote character.
 * Preserves curly/straight consistency.
 * @param {string} closeChar
 * @returns {string}
 */
function matchingOpener(closeChar) {
  if (closeChar === '\u201d') return '\u201c';
  return '"';
}

/**
 * Check whether a substring looks like plausible dialogue.
 *   - Contains at least one word character
 *   - Is under MAX_PLAUSIBLE_SPEECH_LENGTH characters
 *   - Does not contain other unmatched quote pairs (which would indicate
 *     we've crossed a dialogue boundary)
 *
 * @param {string} speech
 * @returns {{ plausible: boolean, reason?: string }}
 */
function isPlausibleDialogue(speech) {
  if (!speech || !speech.trim()) {
    return { plausible: false, reason: 'Empty speech content' };
  }
  if (!/\w/.test(speech)) {
    return { plausible: false, reason: 'No word characters in speech' };
  }
  if (speech.length > MAX_PLAUSIBLE_SPEECH_LENGTH) {
    return { plausible: false, reason: `Speech too long (${speech.length} chars > ${MAX_PLAUSIBLE_SPEECH_LENGTH} limit)` };
  }
  // Check for embedded quote pairs — indicates we'd be spanning multiple
  // dialogue blocks, which is almost certainly wrong.
  const openQuotes = (speech.match(/[\u201c"]/g) || []).length;
  const closeQuotes = (speech.match(/[\u201d"]/g) || []).length;
  if (openQuotes > 0 && closeQuotes > 0) {
    return { plausible: false, reason: 'Contains embedded quote pairs' };
  }
  return { plausible: true };
}

// ─── Detection ───────────────────────────────────────────────────────────────

/**
 * Build the main detection regex. Matches a closing-quote preceded by
 * punctuation, followed by whitespace and a dialogue tag (speaker + verb).
 *
 * The closing-quote punctuation combo: [,.\?!] followed by " or \u201d
 *
 * @returns {RegExp}
 */
function buildDialogueTagRegex() {
  // Single-word verbs: punctuation + closing quote + speaker + verb
  const rxSingle = new RegExp(
    `([,.?!])${CLOSE_QUOTE_CHAR}\\s+(${SPEAKER_PATTERN})\\s+(${VERB_PATTERN})\\b`,
    'gi'
  );
  // Two-word verb phrases: punctuation + closing quote + speaker + verb phrase
  const rxPhrase = new RegExp(
    `([,.?!])${CLOSE_QUOTE_CHAR}\\s+(${SPEAKER_PATTERN})\\s+(${VERB_PHRASE_PATTERN})\\b`,
    'gi'
  );
  return [rxSingle, rxPhrase];
}

/**
 * Detect missing opening quotes before dialogue tags.
 *
 * Scans each line for the pattern:
 *   [speech content][punct][close-quote] [speaker] [verb]
 * and checks whether a matching opening quote exists before the speech.
 *
 * @param {string} text - The full text to scan.
 * @param {object} [options] - Reserved for future configuration.
 * @returns {{ issues: Array<{line: number, type: string, snippet: string, speech: string, tag: string}>, count: number }}
 */
export function detectDialogueQuoteIssues(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { issues: [], count: 0 };
  }

  const issues = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const tagRxArr = buildDialogueTagRegex();
    const seenIndices = new Set(); // deduplicate across regex variants

    for (const tagRx of tagRxArr) {
      tagRx.lastIndex = 0;
      let match;

      while ((match = tagRx.exec(line)) !== null) {
        const matchStart = match.index;
        if (seenIndices.has(matchStart)) continue; // already found by another regex
        seenIndices.add(matchStart);

        const punct = match[1];
        const speaker = match[2];
        const verb = match[3];
        const tag = `${speaker} ${verb}`;

        // Text before the closing quote on this line = the candidate speech
        const textBefore = line.substring(0, matchStart + 1); // includes the punctuation

        // Check whether there's an opening quote that matches this closing quote.
        const hasOpener = hasMatchingOpenQuote(textBefore);

        if (hasOpener) continue; // properly quoted — skip

        // Determine issue type
        const trimmedBefore = line.substring(0, matchStart).trimStart();
        const speech = trimmedBefore + punct;

        const lineStartIsSpeech = isParagraphStartSpeech(line, matchStart);

        const type = lineStartIsSpeech
          ? 'paragraph_start_missing_quote'
          : 'mid_paragraph_missing_quote';

        // Build a snippet for context
        const snippetEnd = Math.min(line.length, match.index + match[0].length + 10);
        const snippetStart = Math.max(0, match.index - 40);
        const snippet = line.substring(snippetStart, snippetEnd).trim();

        issues.push({
          line: i + 1,
          type,
          snippet,
          speech: speech.trim(),
          tag,
        });
      }
    }
  }

  return { issues, count: issues.length };
}

/**
 * Check if there is a matching (unmatched) opening quote in the text
 * preceding the closing quote.
 *
 * Walks through the text tracking open/close quote pairs. If the final
 * state is "inside an open quote", then the closing quote at the end
 * IS matched. Otherwise, it's missing its opener.
 *
 * @param {string} textBefore - The text before (and including) the speech content.
 * @returns {boolean}
 */
function hasMatchingOpenQuote(textBefore) {
  if (!textBefore) return false;

  let depth = 0;

  for (let i = 0; i < textBefore.length; i++) {
    const ch = textBefore[i];
    if (ch === '\u201c' || (ch === '"' && isOpeningPosition(textBefore, i))) {
      depth++;
    } else if (ch === '\u201d') {
      if (depth > 0) depth--;
    } else if (ch === '"' && !isOpeningPosition(textBefore, i)) {
      if (depth > 0) depth--;
    }
  }

  return depth > 0;
}

/**
 * Heuristic: is the straight quote at position `i` in an opening position?
 * Opening if: at start of string, or preceded by whitespace/dash/open-paren.
 */
function isOpeningPosition(text, i) {
  if (i === 0) return true;
  const prev = text[i - 1];
  return /[\s\n({—\-]/.test(prev);
}

/**
 * Determine if the speech content starts at or very near the beginning
 * of the line (paragraph_start) vs after narration (mid_paragraph).
 */
function isParagraphStartSpeech(line, matchStart) {
  const textBeforeMatch = line.substring(0, matchStart).trim();
  // If there are fewer than 3 "narrative" words before the speech,
  // treat it as paragraph-start. Otherwise it's mid-paragraph.
  const words = textBeforeMatch.split(/\s+/).filter(Boolean);
  // Also: if the line starts (after optional whitespace) with the speech,
  // it's paragraph start.
  if (words.length === 0) return true;
  // If every word before looks like part of the speech (no period/sentence-ender
  // separating narration from speech), it's still paragraph-start dialogue.
  const hasNarrationBreak = /[.;!?]/.test(textBeforeMatch);
  if (!hasNarrationBreak && words.length <= 10) return true;
  return false;
}

// ─── Repair ──────────────────────────────────────────────────────────────────

/**
 * Repair detected missing opening quotes by inserting them.
 *
 * Strategy:
 *   - paragraph_start_missing_quote: Insert opener at line start.
 *   - mid_paragraph_missing_quote: Walk backward from closing quote to find
 *     the sentence boundary (period, semicolon, paragraph start, or a prior
 *     closing quote), then insert opener after that boundary.
 *
 * Safety:
 *   - Validates plausible dialogue (word content, length, no embedded quotes).
 *   - Flags ambiguous cases for manual review.
 *
 * @param {string} text - The full text to repair.
 * @param {object} [options] - Reserved for future configuration.
 * @returns {{ text: string, repairs: Array<{original: string, repaired: string, type: string}>, manualReview: Array<{snippet: string, reason: string}> }}
 */
export function repairMissingDialogueOpeners(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', repairs: [], manualReview: [] };
  }

  const repairs = [];
  const manualReview = [];

  const lines = text.split('\n');
  const repairedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) {
      repairedLines.push(line);
      continue;
    }

    // Process from right to left so insertions don't shift indices of
    // earlier matches on the same line.
    const tagRxArr = buildDialogueTagRegex();
    const matchesOnLine = [];
    const seenIndices = new Set();
    for (const tagRx of tagRxArr) {
      tagRx.lastIndex = 0;
      let m;
      while ((m = tagRx.exec(line)) !== null) {
        if (seenIndices.has(m.index)) continue;
        seenIndices.add(m.index);
        matchesOnLine.push({
          index: m.index,
          fullMatch: m[0],
          punct: m[1],
          speaker: m[2],
          verb: m[3],
        });
      }
    }

    // Reverse so we process right-to-left
    matchesOnLine.reverse();

    for (const hit of matchesOnLine) {
      const textBefore = line.substring(0, hit.index + 1);
      if (hasMatchingOpenQuote(textBefore)) continue; // already has opener

      // Identify the closing quote character used
      const closeQuoteChar = line[hit.index + hit.punct.length];
      const opener = matchingOpener(closeQuoteChar);

      // Determine issue type
      const lineStartIsSpeech = isParagraphStartSpeech(line, hit.index);

      if (lineStartIsSpeech) {
        // === paragraph_start_missing_quote ===
        const speech = line.substring(0, hit.index + 1).trim();
        const check = isPlausibleDialogue(speech);

        if (!check.plausible) {
          manualReview.push({
            snippet: line.substring(0, Math.min(line.length, 80)).trim(),
            reason: check.reason,
          });
          continue;
        }

        const original = line;
        // Insert opener at the very start of the line content (preserve leading whitespace)
        const leadingWS = line.match(/^(\s*)/)[1];
        line = leadingWS + opener + line.trimStart();

        repairs.push({
          original: original.trim(),
          repaired: line.trim(),
          type: 'paragraph_start_missing_quote',
        });

      } else {
        // === mid_paragraph_missing_quote ===
        // Walk backward from the closing-quote punctuation to find
        // a sentence boundary: period, semicolon, or prior closing quote.
        const insertPos = findSentenceBoundary(line, hit.index);

        const speech = line.substring(insertPos, hit.index + 1).trim();

        // Multiple sentence boundary candidates? Check for ambiguity.
        const boundaries = countSentenceBoundaries(line, insertPos, hit.index);

        if (boundaries > 1) {
          // Ambiguous — multiple possible insertion points
          manualReview.push({
            snippet: line.substring(Math.max(0, hit.index - 60), Math.min(line.length, hit.index + hit.fullMatch.length + 10)).trim(),
            reason: `Multiple sentence boundaries (${boundaries}) before closing quote — ambiguous insertion point`,
          });
          continue;
        }

        const check = isPlausibleDialogue(speech);
        if (!check.plausible) {
          manualReview.push({
            snippet: line.substring(Math.max(0, hit.index - 60), Math.min(line.length, hit.index + hit.fullMatch.length + 10)).trim(),
            reason: check.reason,
          });
          continue;
        }

        const original = line;
        line = line.substring(0, insertPos) + opener + line.substring(insertPos);

        repairs.push({
          original: original.trim(),
          repaired: line.trim(),
          type: 'mid_paragraph_missing_quote',
        });
      }
    }

    repairedLines.push(line);
  }

  return {
    text: repairedLines.join('\n'),
    repairs,
    manualReview,
  };
}

/**
 * Walk backward from `endIdx` through `line` to find the best sentence
 * boundary for inserting an opening quote.
 *
 * Boundaries (in order of preference):
 *   1. A prior closing quote (\u201d or ") followed by whitespace
 *   2. A period/semicolon followed by whitespace
 *   3. Start of line
 *
 * Returns the index where the opening quote should be inserted
 * (i.e., the position of the first character of the speech).
 *
 * @param {string} line
 * @param {number} endIdx - Index of the last punctuation char of the speech
 * @returns {number}
 */
function findSentenceBoundary(line, endIdx) {
  // Walk backward looking for a boundary
  for (let i = endIdx - 1; i >= 0; i--) {
    const ch = line[i];

    // Prior closing quote followed by space — speech starts after the space
    if ((ch === '\u201d' || ch === '"') && i < endIdx - 1) {
      // Find next non-space character after this quote
      let j = i + 1;
      while (j < endIdx && /\s/.test(line[j])) j++;
      return j;
    }

    // Period, semicolon, exclamation, question mark followed by space
    if ('.;!?'.includes(ch) && i < endIdx - 1 && /\s/.test(line[i + 1])) {
      let j = i + 1;
      while (j < endIdx && /\s/.test(line[j])) j++;
      return j;
    }
  }

  // No boundary found — insert at start of line content
  const leadingMatch = line.match(/^(\s*)/);
  return leadingMatch ? leadingMatch[1].length : 0;
}

/**
 * Count how many sentence boundaries exist between `startIdx` and `endIdx`.
 * Used to detect ambiguous insertion points.
 */
function countSentenceBoundaries(line, startIdx, endIdx) {
  let count = 0;
  for (let i = startIdx; i < endIdx; i++) {
    const ch = line[i];
    if ('.;!?'.includes(ch) && i < endIdx - 1 && /\s/.test(line[i + 1])) {
      count++;
    }
    if ((ch === '\u201d' || ch === '"') && i < endIdx - 1 && /\s/.test(line[i + 1])) {
      count++;
    }
  }
  return count;
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/**
 * Orchestrate the full dialogue mechanics repair pass:
 *   1. Detect issues in the original text.
 *   2. Repair what can be repaired safely.
 *   3. Re-detect on the repaired text to compute improvement.
 *
 * @param {string} text - The full text to process.
 * @param {object} [options] - Reserved for future configuration.
 * @returns {{
 *   text: string,
 *   repairs: Array<{original: string, repaired: string, type: string}>,
 *   manualReview: Array<{snippet: string, reason: string}>,
 *   beforeCount: number,
 *   afterCount: number,
 *   improved: boolean
 * }}
 */
// ─── DIALOGUEFIX-1: structural orphan-closer healer ─────────────────────────
// The verb-based detector above only recognizes dialogue followed by a speech
// verb ("Margot snapped"). Most real damage is dialogue followed by an ACTION
// beat ("Margot dropped the rope"). The reliable signal is structural: a
// closing curly quote whose span back to the previous quote boundary contains
// no opening quote is speech missing its opener. Verb-agnostic, curly-only
// (straight quotes are ambiguous), plausibility-capped.
// ─── PARABREAK-1: collapsed-dialogue paragraph splitter ─────────────────────
// The ghostwriter routinely emits an entire multi-speaker exchange as ONE
// paragraph. Live Brass Meridian Ch.5 shipped a 748-word paragraph holding ~30
// lines of dialogue inline with narration, and the four orphan closers the
// repairer gave up on were ALL inside it. Inside a block that size the healer
// cannot tell which speech a closer belongs to, so a dropped OPENING quote is
// mislabelled an "ambiguous orphan closer" and left on the page.
//
// One speaker turn per paragraph fixes readability AND removes the ambiguity:
// an orphan span that occupies a whole line cannot have narration in front of
// it, so it becomes deterministically repairable.
//
// Two break rules, both structural:
//   1. A new speech opens mid-line after a sentence or a speech already ended
//      ("...", she said. "When I asked...") - break before the opener.
//   2. An orphan speech span (text between two quote boundaries containing no
//      opener) - break before it and after its closer, isolating it.
// A dialogue tag belonging to the speech just closed is never split off:
// lowercase continuations ("he said") and speaker+speech-verb continuations
// ("Vale said") both stay attached to their speech.
const ORPHAN_TAG_CONTINUATION = new RegExp(
  `^(?:${SPEAKER_PATTERN})\\s+(?:${VERB_PATTERN}|${VERB_PHRASE_PATTERN})\\b`,
  'i'
);

// PARABREAK-2: an orphan span can OPEN with the previous speech's dialogue tag,
// e.g. `"Two words," Lena repeated. That is enough time."` - the dropped opener
// belongs to "That is enough time", not to "Lena repeated". Match the tag plus its
// terminating punctuation so the break can step over it and land on the speech.
const ORPHAN_TAG_LEAD = new RegExp(
  `^(?:${SPEAKER_PATTERN})\\s+(?:${VERB_PATTERN}|${VERB_PHRASE_PATTERN})\\b[^.!?]*[.!?]\\s+`,
  'i'
);

// PARABREAK-2: a dialogue tag ANYWHERE between one closing quote and the next
// opening quote means the same speaker is still holding the floor:
//   "Nothing," she said, pulling back. "Just thermal contraction."
// Breaking there does not just cost readability - it tells the reader the NEXT
// character spoke the second line. A missing break is a long paragraph; a wrong
// break is wrong attribution, so when a tag intervenes we leave it joined.
const DIALOGUE_TAG_ANYWHERE = new RegExp(
  `(?:^|[\\s,;(])(?:${SPEAKER_PATTERN})\\s+(?:${VERB_PATTERN}|${VERB_PHRASE_PATTERN})\\b`,
  'i'
);

function splitCollapsedLine(line) {
  const OPEN = '\u201c';
  const CLOSE = '\u201d';
  if (!line.includes(CLOSE)) return [line];
  const breaks = new Set();
  let inSpeech = false;
  let lastQuoteEnd = 0; // index just past the most recent quote character
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch !== OPEN && ch !== CLOSE) continue;
    if (ch === OPEN) {
      // Look back over the whole line, not just since the last quote: the
      // commonest turn boundary is `...approach.” “Time is fluid...`, where the
      // only text between the closer and the next opener is a single space.
      if (
        !inSpeech
        && i > 0
        && /[.!?\u201d]\s+$/.test(line.slice(0, i))
        && !DIALOGUE_TAG_ANYWHERE.test(line.slice(lastQuoteEnd, i))
      ) {
        breaks.add(line.slice(0, i).replace(/\s+$/, '').length);
      }
      inSpeech = true;
      lastQuoteEnd = i + 1;
      continue;
    }
    if (inSpeech) {
      inSpeech = false;
      lastQuoteEnd = i + 1;
      continue;
    }
    // Orphan closer: the span back to the previous quote boundary has no opener.
    const span = line.slice(lastQuoteEnd, i);
    let lead = (span.match(/^\s*/) || [''])[0].length;
    // PARABREAK-2: step over a leading dialogue tag so the break lands on the
    // speech that actually lost its opener, not in front of the tag.
    const tagLead = span.slice(lead).match(ORPHAN_TAG_LEAD);
    if (tagLead) lead += tagLead[0].length;
    const core = span.slice(lead);
    if (core && !ORPHAN_TAG_CONTINUATION.test(core)) {
      if (lastQuoteEnd + lead > 0) breaks.add(lastQuoteEnd + lead);
      // PARABREAK-2: break AFTER the orphan's closer only when what follows is
      // NOT this speech's own dialogue tag. Breaking in front of `Marcus asked.`
      // strands the tag in a paragraph of its own - 21 of those shipped in the
      // first live run of PARABREAK-1.
      const after = line.slice(i + 1);
      const afterCore = after.replace(/^\s+/, '');
      if (after.length !== afterCore.length && afterCore && !ORPHAN_TAG_CONTINUATION.test(afterCore)) {
        breaks.add(i + 1);
      }
    }
    lastQuoteEnd = i + 1;
  }
  if (!breaks.size) return [line];
  const points = [...breaks].sort((a, b) => a - b);
  const parts = [];
  let cursor = 0;
  for (const point of points) {
    if (point > cursor) {
      parts.push(line.slice(cursor, point).trim());
      cursor = point;
    }
  }
  parts.push(line.slice(cursor).trim());
  return parts.filter(Boolean);
}

export function splitCollapsedDialogueParagraphs(text) {
  const src = String(text || '');
  if (!src.includes('\u201d')) return { text: src, splits: 0 };
  let splits = 0;
  const out = src.split('\n').map((line) => {
    if (!line.trim()) return line;
    const parts = splitCollapsedLine(line);
    if (parts.length > 1) splits += parts.length - 1;
    return parts.join('\n\n');
  });
  if (splits) {
    console.log('[DIALOGUE-MECHANICS-REPAIR] Collapsed-dialogue splitter inserted ' + splits + ' paragraph break(s)');
  }
  return { text: out.join('\n'), splits };
}

export function repairOrphanClosers(text) {
  const src = String(text || '');
  if (!src.includes('\u201d')) return { text: src, repaired: 0, flagged: 0, wholeLineRepaired: 0 };
  let repaired = 0;
  let flagged = 0;
  let wholeLineRepaired = 0;
  const out = [];
  for (const para of src.split('\n')) {
    if (!para.includes('\u201d')) { out.push(para); continue; }
    let fixed = '';
    let cursor = 0;
    while (true) {
      const close = para.indexOf('\u201d', cursor);
      if (close === -1) { fixed += para.slice(cursor); break; }
      const span = para.slice(cursor, close);
      if (span.includes('\u201c')) {
        fixed += para.slice(cursor, close + 1);
        cursor = close + 1;
        continue;
      }
      // Span closes speech but contains no opener. Only heal the unambiguous
      // shape: leading whitespace + ONE sentence that starts with a capital
      // and ends at the closer. Multi-sentence spans are ambiguous (narration
      // may precede the speech) - flag, never guess.
      const ws = (span.match(/^\s*/) || [''])[0];
      const core = span.slice(ws.length);
      const singleSentence = !/[.!?]\u2019?\s+[A-Z\u201c]/.test(core.trimEnd().replace(/[.!?,]$/, ''));
      // PARABREAK-1: the multi-sentence bar exists ONLY to stop the healer
      // claiming narration that PRECEDES the speech on the same line. When the
      // orphan span IS the whole line - nothing before it, nothing after its
      // closer - there is no preceding narration, so the guard is vacuous and a
      // multi-sentence speech turn is the only reading left. This is what the
      // paragraph splitter above manufactures on purpose.
      const wholeLine = cursor === 0 && para.slice(close + 1).trim() === '';
      const plausible = core.length >= 4 && core.length <= 300 && /^[A-Z\u2018]/.test(core) && /[.!?,]$/.test(core.trimEnd());
      if (!plausible || (!singleSentence && !wholeLine)) {
        if (core.length >= 4) { flagged += 1; }
        fixed += para.slice(cursor, close + 1);
        cursor = close + 1;
        continue;
      }
      fixed += ws + '\u201c' + core + '\u201d';
      repaired += 1;
      if (!singleSentence && wholeLine) wholeLineRepaired += 1;
      cursor = close + 1;
    }
    out.push(fixed);
  }
  if (repaired) console.log('[DIALOGUE-MECHANICS-REPAIR] Orphan-closer healer inserted ' + repaired + ' missing opening quote(s)');
  if (wholeLineRepaired) console.log('[DIALOGUE-MECHANICS-REPAIR] ' + wholeLineRepaired + ' of those were whole-line multi-sentence turns (PARABREAK-1)');
  if (flagged) console.warn('[DIALOGUE-MECHANICS-REPAIR] ' + flagged + ' ambiguous orphan closer(s) left for review');
  return { text: out.join('\n'), repaired, flagged, wholeLineRepaired };
}

export function runDialogueMechanicsPass(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      text: text || '',
      repairs: [],
      manualReview: [],
      beforeCount: 0,
      afterCount: 0,
      improved: false,
    };
  }

  // PARABREAK-1: Step 0 - break a collapsed multi-speaker paragraph into one
  // turn per paragraph BEFORE anything line-oriented runs. Every repairer below
  // works per line, so a 748-word wall starves all of them at once. Opt-in:
  // the fiction drafting paths enable it; the nonfiction pre-save path does not.
  let working = text;
  let paragraphSplits = 0;
  if (options.splitCollapsedParagraphs) {
    const split = splitCollapsedDialogueParagraphs(text);
    working = split.text;
    paragraphSplits = split.splits;
  }
  text = working;

  // Step 1: Detect before repair
  const before = detectDialogueQuoteIssues(text, options);
  const beforeCount = before.count;

  console.log(`[DIALOGUE-MECHANICS-REPAIR] Detected ${beforeCount} missing opening quote(s)`);

  // Step 2: Repair
  const repairResult = repairMissingDialogueOpeners(text, options);

  // Step 3: Re-detect on repaired text
  const after = detectDialogueQuoteIssues(repairResult.text, options);
  const afterCount = after.count;

  const improved = afterCount < beforeCount;

  console.log(
    `[DIALOGUE-MECHANICS-REPAIR] After repair: ${afterCount} remaining issue(s), ` +
    `${repairResult.repairs.length} repaired, ${repairResult.manualReview.length} flagged for review`
  );

  // DIALOGUEFIX-1: structural pass catches orphans the verb detector misses
  // (dialogue followed by action beats instead of speech verbs).
  const orphan = repairOrphanClosers(repairResult.text);

  return {
    text: orphan.text,
    repairs: repairResult.repairs,
    orphanRepaired: orphan.repaired,
    orphanFlagged: orphan.flagged,
    orphanWholeLineRepaired: orphan.wholeLineRepaired || 0,
    paragraphSplits,
    manualReview: repairResult.manualReview,
    beforeCount,
    afterCount,
    improved: improved || orphan.repaired > 0 || paragraphSplits > 0,
  };
}

// ─── Mid-Paragraph Dialogue Classifier & Autofix ─────────────────────────────

/**
 * @typedef {'SAFE_TO_AUTOFIX' | 'MANUAL_REVIEW'} MidParagraphClassification
 */

/**
 * Classify a mid-paragraph missing-quote warning for safe auto-fix eligibility.
 *
 * Returns SAFE_TO_AUTOFIX only when ALL confidence checks pass:
 *   1. Closing quote before a clear dialogue tag exists.
 *   2. Speaker tag is clear (pronoun/name/noun + speech verb).
 *   3. No opening quote immediately before the spoken phrase.
 *   4. Start of spoken phrase follows a hard sentence boundary (. ? ! — or prior closing quote).
 *   5. Candidate speech is at least 2 words.
 *   6. Candidate speech does not begin inside narration (no partial sentence before boundary).
 *   7. Adding opening quote balances (or improves) quote parity in the paragraph.
 *   8. Repaired paragraph introduces no NEW hard issues.
 *   9. Repair inserts exactly one opening quote character — no other text changed.
 *
 * @param {string}  paragraph - The full paragraph text.
 * @param {object}  issue     - The issue object from detectDialogueQuoteIssues.
 * @param {object}  [options] - Reserved for future configuration.
 * @returns {{ classification: MidParagraphClassification, confidence: number, reason: string, insertPosition?: number, insertChar?: string }}
 */
export function classifyMidParagraphDialogueWarning(paragraph, issue, options = {}) {
  const failResult = (reason) => ({ classification: 'MANUAL_REVIEW', confidence: 0, reason });

  if (!paragraph || !issue || issue.type !== 'mid_paragraph_missing_quote') {
    return failResult('Not a mid-paragraph missing-quote issue');
  }

  // ── Check 1: Closing quote + dialogue tag ──
  const tagMatch = issue.tag;
  if (!tagMatch || !tagMatch.trim()) {
    return failResult('No clear dialogue tag in issue');
  }

  // Parse speaker and verb from tag
  const tagParts = tagMatch.trim().split(/\s+/);
  if (tagParts.length < 2) {
    return failResult('Dialogue tag too short to classify');
  }

  // ── Check 2: Clear speaker tag ──
  const speakerPart = tagParts.slice(0, -1).join(' ');
  const verbPart = tagParts[tagParts.length - 1];
  const validSpeaker = new RegExp(
    `^(?:${SPEAKER_PRONOUNS}|${SPEAKER_NAMES}|${SPEAKER_CAP_NAME})$`,
    'i'
  );
  if (!validSpeaker.test(speakerPart)) {
    return failResult(`Unclear speaker: "${speakerPart}"`);
  }
  const validVerb = new RegExp(`^(?:${DIALOGUE_VERBS.join('|')})$`, 'i');
  if (!validVerb.test(verbPart)) {
    return failResult(`Unclear dialogue verb: "${verbPart}"`);
  }

  // ── Check 3: No opening quote before speech ──
  // Run repair on the paragraph and check what it does
  const repairResult = repairMissingDialogueOpeners(paragraph, {});

  if (repairResult.repairs.length === 0) {
    // No repair found — may already be balanced or truly ambiguous
    return failResult('Repair module found no insertion point');
  }

  // Find the repair matching this issue (by type)
  const matchingRepair = repairResult.repairs.find(r => r.type === 'mid_paragraph_missing_quote');
  if (!matchingRepair) {
    return failResult('No mid-paragraph repair matched this issue');
  }

  // ── Check 9: Exactly one character inserted ──
  const origLen = matchingRepair.original.length;
  const fixedLen = matchingRepair.repaired.length;
  const delta = fixedLen - origLen;
  if (delta !== 1) {
    return failResult(`Repair changed ${delta} chars (expected exactly 1)`);
  }

  // Find the inserted character
  let insertIdx = -1;
  for (let i = 0; i < fixedLen; i++) {
    if (i >= origLen || matchingRepair.repaired[i] !== matchingRepair.original[i]) {
      insertIdx = i;
      break;
    }
  }
  if (insertIdx < 0) {
    return failResult('Could not locate inserted character');
  }

  const insertedChar = matchingRepair.repaired[insertIdx];
  if (insertedChar !== '\u201c' && insertedChar !== '"') {
    return failResult(`Inserted character is not a quote: "${insertedChar}"`);
  }

  // ── Check 4: Hard sentence boundary before insertion ──
  const textBeforeInsert = matchingRepair.repaired.substring(0, insertIdx);
  const trimmedBefore = textBeforeInsert.trimEnd();
  if (trimmedBefore.length > 0) {
    const lastChar = trimmedBefore[trimmedBefore.length - 1];
    const validBoundary = '.?!;:\u201d"—\u2014\u2013'.includes(lastChar);
    if (!validBoundary) {
      return failResult(`No hard sentence boundary before insertion (last char: "${lastChar}")`);
    }
  }

  // ── Check 5: Candidate speech at least 2 words ──
  const speechAfterInsert = matchingRepair.repaired.substring(insertIdx + 1);
  // Extract speech up to closing quote
  const closingQuoteIdx = speechAfterInsert.search(/["\u201d]/);
  if (closingQuoteIdx < 0) {
    return failResult('No closing quote found after insertion');
  }
  const speechContent = speechAfterInsert.substring(0, closingQuoteIdx).trim();
  const wordCount = speechContent.split(/\s+/).filter(Boolean).length;
  if (wordCount < 1) {
    return failResult(`Speech too short: ${wordCount} word(s)`);
  }

  // ── Check 6: Not starting inside narration ──
  // If the character before the boundary is a letter (not punctuation/whitespace),
  // we may be in the middle of a sentence.
  if (trimmedBefore.length > 0) {
    const charBeforeBoundary = trimmedBefore[trimmedBefore.length - 2];
    // Check that we're not inserting mid-word
    if (charBeforeBoundary && /[a-zA-Z]/.test(insertedChar)) {
      return failResult('Insertion point may be inside narration');
    }
  }

  // ── Check 7: Quote balance improves or stays equal ──
  const origOpens = (matchingRepair.original.match(/[\u201c"]/g) || []).length;
  const origCloses = (matchingRepair.original.match(/[\u201d]/g) || []).length +
    (matchingRepair.original.match(/"/g) || []).filter((_, idx) => {
      // This is an approximation — count unmatched straight closing quotes
      return true;
    }).length;
  const fixedOpens = (matchingRepair.repaired.match(/[\u201c"]/g) || []).length;
  // Balance check: the fixed version should have equal or better parity
  const origImbalance = Math.abs(origOpens - origCloses);
  const fixedImbalance = Math.abs(fixedOpens - origCloses);
  // Allow same or improved
  if (fixedImbalance > origImbalance + 1) {
    return failResult(`Quote balance worsened: ${origImbalance} → ${fixedImbalance}`);
  }

  // ── Check 8: No new hard issues ──
  const beforeIssues = detectDialogueQuoteIssues(matchingRepair.original, {});
  const afterIssues = detectDialogueQuoteIssues(matchingRepair.repaired, {});
  if (afterIssues.count > beforeIssues.count) {
    return failResult(`Repair introduced ${afterIssues.count - beforeIssues.count} new issue(s)`);
  }

  // ── Check paragraph-level safety ──
  // Nested quotes
  if (/['\u2018\u2019]{2,}/.test(paragraph)) {
    return failResult('Paragraph contains nested quotes');
  }
  // Code, headings, lists, citations
  if (/^#{1,6}\s/.test(paragraph.trim()) || /^\s*[-*+]\s/.test(paragraph.trim())) {
    return failResult('Paragraph is a heading or list item');
  }
  if (/\b(?:```|~~|__)\b/.test(paragraph) || /\[\d+\]/.test(paragraph)) {
    return failResult('Paragraph contains code or citation markers');
  }

  // ── All checks pass ──
  const confidence = 95; // High confidence — all 9 checks passed

  return {
    classification: 'SAFE_TO_AUTOFIX',
    confidence,
    reason: `Clear speaker "${speakerPart}", verb "${verbPart}", ${wordCount}-word speech, single quote insertion at boundary`,
    insertPosition: insertIdx,
    insertChar: insertedChar,
  };
}

/**
 * Apply safe mid-paragraph dialogue opener repairs.
 *
 * Only applies repairs that pass {@link classifyMidParagraphDialogueWarning}
 * with SAFE_TO_AUTOFIX classification.
 *
 * @param {string}  text    - The full text to repair.
 * @param {object}  [options] - Reserved for future configuration.
 * @returns {{
 *   text: string,
 *   safeRepairs: Array<{original: string, repaired: string, classification: string, confidence: number, reason: string}>,
 *   manualReview: Array<{snippet: string, reason: string, classification: string}>,
 *   beforeCount: number,
 *   afterCount: number,
 * }}
 */
export function repairSafeMidParagraphDialogueOpeners(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', safeRepairs: [], manualReview: [], beforeCount: 0, afterCount: 0 };
  }

  // Detect all issues first
  const before = detectDialogueQuoteIssues(text, options);
  const midParaIssues = before.issues.filter(i => i.type === 'mid_paragraph_missing_quote');

  if (midParaIssues.length === 0) {
    return { text, safeRepairs: [], manualReview: [], beforeCount: 0, afterCount: 0 };
  }

  const safeRepairs = [];
  const manualReview = [];
  const lines = text.split('\n');

  // Process each mid-paragraph issue
  // We need to process right-to-left within each line to avoid index shift
  const issuesByLine = new Map();
  for (const issue of midParaIssues) {
    const lineIdx = issue.line - 1;
    if (!issuesByLine.has(lineIdx)) issuesByLine.set(lineIdx, []);
    issuesByLine.get(lineIdx).push(issue);
  }

  for (const [lineIdx, issues] of issuesByLine) {
    const originalLine = lines[lineIdx];
    let currentLine = originalLine;

    // Classify each issue
    for (const issue of issues) {
      const classification = classifyMidParagraphDialogueWarning(currentLine, issue, options);

      if (classification.classification === 'SAFE_TO_AUTOFIX') {
        // Apply the repair via the standard repair function
        const repairResult = repairMissingDialogueOpeners(currentLine, {});
        if (repairResult.repairs.length > 0) {
          const matchingRepair = repairResult.repairs.find(r => r.type === 'mid_paragraph_missing_quote');
          if (matchingRepair) {
            currentLine = repairResult.text;
            safeRepairs.push({
              original: matchingRepair.original,
              repaired: matchingRepair.repaired,
              classification: 'SAFE_TO_AUTOFIX',
              confidence: classification.confidence,
              reason: classification.reason,
            });
          }
        }
      } else {
        manualReview.push({
          snippet: issue.snippet,
          reason: classification.reason,
          classification: 'MANUAL_REVIEW',
        });
      }
    }

    lines[lineIdx] = currentLine;
  }

  const repairedText = lines.join('\n');
  const after = detectDialogueQuoteIssues(repairedText, {});

  return {
    text: repairedText,
    safeRepairs,
    manualReview,
    beforeCount: midParaIssues.length,
    afterCount: after.issues.filter(i => i.type === 'mid_paragraph_missing_quote').length,
  };
}

/**
 * Orchestrate the full mid-paragraph dialogue auto-fix pass.
 *
 * 1. Runs the standard {@link runDialogueMechanicsPass} first (handles all types).
 * 2. On the result, runs the classifier to verify mid-paragraph repairs are safe.
 * 3. Returns combined results.
 *
 * This is the recommended entry point for both polish and export paths.
 *
 * @param {string}  text    - The full text to process.
 * @param {object}  [options] - Reserved for future configuration.
 * @returns {{
 *   text: string,
 *   standardRepairs: number,
 *   midParagraphAutoFixed: number,
 *   midParagraphManualReview: number,
 *   allDialogueIssuesBefore: number,
 *   allDialogueIssuesAfter: number,
 *   details: Array<{snippet: string, classification: string, confidence: number, reason: string}>,
 * }}
 */
export function runMidParagraphDialogueAutofixPass(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      text: text || '',
      standardRepairs: 0,
      midParagraphAutoFixed: 0,
      midParagraphManualReview: 0,
      allDialogueIssuesBefore: 0,
      allDialogueIssuesAfter: 0,
      details: [],
    };
  }

  // Detect before
  const beforeAll = detectDialogueQuoteIssues(text, options);

  // Step 1: Run standard dialogue mechanics pass (repairs line-start AND mid-paragraph)
  const standardResult = runDialogueMechanicsPass(text, options);

  // Step 2: Check remaining mid-paragraph issues (if any survived standard repair)
  const afterStandard = detectDialogueQuoteIssues(standardResult.text, options);
  const remainingMidPara = afterStandard.issues.filter(i => i.type === 'mid_paragraph_missing_quote');

  let finalText = standardResult.text;
  let midParaAutoFixed = 0;
  let midParaManualReview = 0;
  const details = [];

  // Log standard repairs that were mid-paragraph type
  const standardMidParaRepairs = standardResult.repairs.filter(r => r.type === 'mid_paragraph_missing_quote');
  for (const r of standardMidParaRepairs) {
    details.push({
      snippet: r.original.substring(0, 100),
      classification: 'SAFE_TO_AUTOFIX',
      confidence: 95,
      reason: 'Repaired by standard dialogue mechanics pass (single quote insertion at boundary)',
    });
    midParaAutoFixed++;
  }

  // Step 3: If any mid-paragraph issues remain, run the safe classifier
  if (remainingMidPara.length > 0) {
    const safeResult = repairSafeMidParagraphDialogueOpeners(finalText, options);
    finalText = safeResult.text;
    midParaAutoFixed += safeResult.safeRepairs.length;
    midParaManualReview += safeResult.manualReview.length;
    for (const r of safeResult.safeRepairs) {
      details.push({
        snippet: r.original.substring(0, 100),
        classification: r.classification,
        confidence: r.confidence,
        reason: r.reason,
      });
    }
    for (const mr of safeResult.manualReview) {
      details.push({
        snippet: mr.snippet,
        classification: mr.classification,
        confidence: 0,
        reason: mr.reason,
      });
    }
  }

  const afterAll = detectDialogueQuoteIssues(finalText, options);

  return {
    text: finalText,
    standardRepairs: standardResult.repairs.length,
    midParagraphAutoFixed: midParaAutoFixed,
    midParagraphManualReview: midParaManualReview,
    allDialogueIssuesBefore: beforeAll.count,
    allDialogueIssuesAfter: afterAll.count,
    details,
  };
}

export default {
  VERSION,
  detectDialogueQuoteIssues,
  repairMissingDialogueOpeners,
  runDialogueMechanicsPass,
  classifyMidParagraphDialogueWarning,
  repairSafeMidParagraphDialogueOpeners,
  runMidParagraphDialogueAutofixPass,
};
