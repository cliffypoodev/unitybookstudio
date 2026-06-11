/**
 * safeUppercase.js — Shared guard for after-punctuation capitalization.
 *
 * Every module that uppercases the first letter after [.!?] must call
 * this helper instead of blindly doing `.toUpperCase()`. The guard
 * protects:
 *   1. Abbreviation periods  (e.g., i.e., etc., Dr., a.m., ...)
 *   2. Ellipsis              (..., …)
 *   3. Sentence-start abbreviations (e.g. at the very start of a sentence)
 *
 * Consumers:
 *   - disclaimerStripper.js
 *   - manuscriptPolishRunner.js (Phase A4)
 *   - nonfictionPolish.js (STEP 3)
 *   - chatgptPatternPolish.js (runTransitionWordCaps second pass)
 *   - postDraftCleanup.js (draft-time uppercase)
 *
 * @module safeUppercase
 */

/**
 * Abbreviation whitelist regex — matches when the preceding context
 * (up to and including the matched period) ends with a known abbreviation.
 *
 * Covers:
 *   Latin: e.g., i.e., etc., cf., al., viz.
 *   Time:  a.m., p.m.
 *   Titles: Dr., Mr., Mrs., Ms., St., No., Jr., Sr., Prof., Rev.
 *   Other: vs.
 *
 * The regex matches against the PRECEDING context (up to offset+1),
 * which includes the period itself but NOT the following whitespace.
 * Therefore the pattern ends with `\.$` (not `\.\s$`).
 */
const ABBREVIATION_RX = /\b(?:e\.g|i\.e|etc|vs|viz|a\.m|p\.m|cf|al|Dr|Mr|Mrs|Ms|St|No|Jr|Sr|Prof|Rev)\.$/i;

/**
 * Exported abbreviation token set — single source of truth.
 * Each entry is a lowercase token (with dots) whose trailing period is NOT
 * a sentence terminator.  Consumers:
 *   - antiDetectionPolish.js (abbreviation-aware sentence splitter)
 *   - Any future module that needs to distinguish abbreviation periods.
 */
export const ABBREVIATION_TOKENS = new Set([
  'e.g', 'i.e', 'etc', 'vs', 'viz',
  'a.m', 'p.m',
  'cf', 'al',
  'dr', 'mr', 'mrs', 'ms', 'st', 'no', 'jr', 'sr', 'prof', 'rev',
]);

/**
 * Ellipsis regex — matches when the preceding context ends with 2+ dots.
 */
const ELLIPSIS_RX = /\.{2,}$/;

/**
 * Sentence-start abbreviation lookahead — the letter being uppercased
 * is itself the start of an abbreviation like "e.g." or "i.e." or "a.m."
 * Detected by: lowercase letter followed by period+lowercase+period.
 */
const ABBREVIATION_START_RX = /^[a-z]\.[a-z]\./;

/**
 * Determine whether a post-punctuation lowercase letter should be
 * uppercased. Returns `true` if uppercasing is safe; `false` if
 * the letter is protected by an abbreviation, ellipsis, or proper noun.
 *
 * @param {string} text        The full text being processed.
 * @param {number} offset      The character offset of the matched punctuation [.!?].
 * @param {string} letter      The lowercase letter that would be uppercased.
 * @returns {boolean} `true` → safe to uppercase; `false` → skip.
 */
export function shouldUppercaseAfterPunct(text, offset, letter) {
  // Build preceding context (12 chars before the matched punct, plus the punct)
  const preceding = text.substring(Math.max(0, offset - 12), offset + 1);

  // Guard 1: ellipsis (three+ dots) — never uppercase after ...
  if (ELLIPSIS_RX.test(preceding)) return false;

  // Guard 2: abbreviation whitelist
  if (ABBREVIATION_RX.test(preceding)) return false;

  // Guard 3: preceding proper noun (e.g. "Mr.Smith" → period in a name)
  if (offset >= 2 && /[A-Z][a-z]/.test(text.substring(offset - 2, offset))) return false;

  // Guard 4: sentence-start abbreviation lookahead
  // The letter itself begins an abbreviation (e.g. "e.g.", "i.e.", "a.m.")
  // Look at the letter and what follows it in the text.
  const afterPunct = text.substring(offset + 1).replace(/^\s+/, ''); // strip whitespace after punct
  if (ABBREVIATION_START_RX.test(afterPunct)) return false;

  return true;
}

/**
 * Safe replacement function for the common pattern:
 *   text.replace(/([.!?])\s+([a-z])/g, ...)
 *
 * Use as:
 *   text = safeUppercaseReplace(text);
 *
 * @param {string} text  The text to process.
 * @returns {string}     Text with safe post-punctuation capitalizations applied.
 */
export function safeUppercaseReplace(text) {
  return text.replace(/([.!?])\s+([a-z])/g, (match, punct, letter, offset) => {
    if (!shouldUppercaseAfterPunct(text, offset, letter)) return match;
    return punct + ' ' + letter.toUpperCase();
  });
}
