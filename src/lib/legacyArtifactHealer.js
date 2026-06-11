/**
 * legacyArtifactHealer.js — Repairs baked-in corruption from pre-merge pipeline.
 *
 * Three guarded repairs:
 *   (a) Proper-noun case restore  — youTube → YouTube, IPhone → iPhone, etc.
 *   (b) Post-abbreviation decap   — "e.g. The" → "e.g. the" (common words only)
 *   (c) Post-em-dash decap        — "—The" → "—the" mid-sentence (common words only)
 *
 * All repairs are conservative: only whitelisted words are touched, URLs and
 * markdown links are never modified.
 *
 * @module legacyArtifactHealer
 */

// ── Proper noun whitelist (from capitalizationPolish.js PROPER_NOUN_PRESERVE) ──
const PROPER_NOUNS = [
  'YouTube', 'iPhone', 'iPad', 'iOS', 'macOS', 'eBay', 'OpenAI', 'GitHub',
  'TikTok', 'LinkedIn', 'PowerPoint', 'JavaScript', 'WiFi', 'PhD',
  'McDonald', 'DeVito', 'McCoy', 'McGregor',
];

/**
 * Build wrong-case variant by toggling the first character's case.
 * YouTube → youTube, iPhone → IPhone, eBay → EBay, etc.
 */
function buildWrongVariant(canonical) {
  const first = canonical[0];
  const toggled = first === first.toUpperCase()
    ? first.toLowerCase()
    : first.toUpperCase();
  return toggled + canonical.slice(1);
}

// Pre-build lookup: wrongVariant → canonical
const WRONG_TO_CANONICAL = new Map();
for (const noun of PROPER_NOUNS) {
  const wrong = buildWrongVariant(noun);
  if (wrong !== noun) {
    WRONG_TO_CANONICAL.set(wrong, noun);
  }
}

// ── Common words for post-abbreviation and post-em-dash decap ──
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'it', 'he', 'she', 'they', 'we', 'you',
  'his', 'her', 'its', 'their',
  'there', 'then', 'when', 'where',
  'and', 'but', 'or', 'so',
  'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'was', 'were', 'is', 'are',
  'every', 'each', 'some', 'any',
]);

// ── Abbreviation regex for post-abbreviation decap ──
const ABBREV_RX = /\b(e\.g\.|i\.e\.|a\.m\.|p\.m\.|etc\.|vs\.|viz\.)\s+([A-Z])([a-z]+)/gi;

// ── Em/en dash regex for post-dash decap ──
// Negative char class ensures we don't fire after terminal punctuation or closing quotes.
const DASH_DECAP_RX = /([^.!?"'\u201d])([—–])([A-Z])([a-z]+)/g;

/**
 * Check if a match position is inside a URL or markdown link.
 * Looks at the 20 characters before the match for "://" (URL context)
 * or checks if it falls inside a markdown link pattern [...](...).
 *
 * @param {string} text - Full text
 * @param {number} matchIndex - Start index of the match
 * @returns {boolean} True if inside a URL/link context (should be skipped)
 */
function isInsideUrlOrLink(text, matchIndex) {
  const lookback = text.substring(Math.max(0, matchIndex - 20), matchIndex);
  // Check for URL protocol
  if (lookback.includes('://')) return true;
  // Quick check for markdown link context: look for unclosed ](
  // Scan backwards from matchIndex for '](' without a closing ')'
  const before = text.substring(Math.max(0, matchIndex - 200), matchIndex);
  const lastLinkOpen = before.lastIndexOf('](');
  if (lastLinkOpen !== -1) {
    // Check if there's a closing ')' between the '](' and our match
    const between = before.substring(lastLinkOpen + 2);
    if (!between.includes(')')) return true;
  }
  return false;
}

/**
 * Heal legacy artifacts in a text string.
 *
 * @param {string} text - Input text
 * @returns {{ text: string, repairs: Array<{ type: string, from: string, to: string }> }}
 */
export function healLegacyArtifacts(text) {
  if (!text || typeof text !== 'string') return { text: text || '', repairs: [] };

  const repairs = [];
  let result = text;

  // ═══════════════════════════════════════════════════════════════════
  // (a) Proper-noun case restore
  // ═══════════════════════════════════════════════════════════════════
  for (const [wrong, canonical] of WRONG_TO_CANONICAL) {
    // Build a word-boundary regex for the wrong variant
    const rx = new RegExp(`\\b${escapeRegex(wrong)}\\b`, 'g');
    let match;
    // Collect all match positions first, then replace from end to start
    const matches = [];
    while ((match = rx.exec(result)) !== null) {
      matches.push({ index: match.index, length: match[0].length });
    }
    // Process in reverse so indices stay valid
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      if (isInsideUrlOrLink(result, m.index)) continue;
      result = result.substring(0, m.index) + canonical + result.substring(m.index + m.length);
      repairs.push({ type: 'proper-noun-case', from: wrong, to: canonical });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // (b) Post-abbreviation decapitalization
  // ═══════════════════════════════════════════════════════════════════
  ABBREV_RX.lastIndex = 0;
  result = result.replace(ABBREV_RX, (match, abbrev, capLetter, rest) => {
    // With the `i` flag, [A-Z] matches lowercase too — only fire when actually uppercase
    if (capLetter !== capLetter.toUpperCase()) return match;
    const fullWord = capLetter + rest;
    if (COMMON_WORDS.has(fullWord.toLowerCase())) {
      repairs.push({ type: 'post-abbrev-decap', from: `${abbrev} ${fullWord}`, to: `${abbrev} ${fullWord.toLowerCase()}` });
      return `${abbrev} ${capLetter.toLowerCase()}${rest}`;
    }
    return match;
  });

  // ═══════════════════════════════════════════════════════════════════
  // (c) Post-em-dash decapitalization
  // ═══════════════════════════════════════════════════════════════════
  DASH_DECAP_RX.lastIndex = 0;
  result = result.replace(DASH_DECAP_RX, (match, before, dash, capLetter, rest) => {
    const fullWord = capLetter + rest;
    if (COMMON_WORDS.has(fullWord.toLowerCase())) {
      repairs.push({ type: 'post-dash-decap', from: `${dash}${fullWord}`, to: `${dash}${fullWord.toLowerCase()}` });
      return `${before}${dash}${capLetter.toLowerCase()}${rest}`;
    }
    return match;
  });

  return { text: result, repairs };
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
