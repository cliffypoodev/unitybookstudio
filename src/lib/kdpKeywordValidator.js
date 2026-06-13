/**
 * KDP Keyword Validator — deterministic validation for Amazon KDP keywords.
 * No LLM calls. Pure string validation.
 *
 * @module kdpKeywordValidator
 */

/** Amazon KDP max character limit per keyword phrase. */
export const KDP_KEYWORD_CHAR_LIMIT = 50;

/** Words Amazon explicitly bans or ignores in keyword fields. */
const BANNED_WORDS = new Set([
  'bestseller', 'best seller', 'free', '#1', 'number one',
  'best-selling', 'award-winning', 'award winning',
]);

/** Common author names that violate Amazon TOS when used as keywords. */
const AUTHOR_NAME_PATTERNS = /\b(stephen king|james patterson|nora roberts|danielle steel|j\.?k\.? rowling|colleen hoover|brandon sanderson)\b/i;

/**
 * Validate a single KDP keyword phrase.
 * @param {string} keyword
 * @param {object} [options]
 * @param {string} [options.title] — book title to check for redundancy
 * @param {string} [options.subtitle] — subtitle to check for redundancy
 * @returns {{ valid: boolean, warnings: string[], charCount: number }}
 */
export function validateKeyword(keyword, options = {}) {
  const warnings = [];
  const trimmed = (keyword || '').trim();
  const charCount = trimmed.length;

  if (charCount === 0) {
    return { valid: false, warnings: ['Empty keyword'], charCount: 0 };
  }

  if (charCount > KDP_KEYWORD_CHAR_LIMIT) {
    warnings.push(`Over ${KDP_KEYWORD_CHAR_LIMIT}-char limit (${charCount} chars)`);
  }

  const lower = trimmed.toLowerCase();

  // Banned words
  for (const banned of BANNED_WORDS) {
    if (lower.includes(banned)) {
      warnings.push(`Contains banned term: "${banned}"`);
    }
  }

  // Author name patterns
  if (AUTHOR_NAME_PATTERNS.test(lower)) {
    warnings.push('Contains a trademarked author name — Amazon will reject');
  }

  // Redundancy check against title/subtitle
  if (options.title) {
    const titleWords = new Set(options.title.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const kwWords = lower.split(/\s+/).filter(w => w.length > 3);
    const overlap = kwWords.filter(w => titleWords.has(w));
    if (overlap.length > 0 && overlap.length === kwWords.length) {
      warnings.push('All significant words already in title — Amazon indexes those separately');
    }
  }

  // Too short / too generic
  if (lower.split(/\s+/).length === 1 && charCount < 8) {
    warnings.push('Single short word — too generic, consider a phrase');
  }

  return {
    valid: warnings.length === 0,
    warnings,
    charCount,
  };
}

/**
 * Validate an array of KDP keyword objects.
 * @param {Array<{keyword: string}>} keywords
 * @param {object} [options] — same as validateKeyword options
 * @returns {{ results: Array, validCount: number, invalidCount: number, totalWarnings: number }}
 */
export function validateKeywordSet(keywords, options = {}) {
  const results = (keywords || []).map((kw) => {
    const result = validateKeyword(kw.keyword || kw, options);
    return { ...kw, ...result };
  });

  const validCount = results.filter(r => r.valid).length;

  return {
    results,
    validCount,
    invalidCount: results.length - validCount,
    totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
  };
}
