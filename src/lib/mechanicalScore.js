/**
 * Mechanical (rule-based) quality score for chapter prose.
 * Starts at 100 and deducts points for specific, objective violations.
 * No LLM involved — pure string analysis.
 */

const BANNED_WORDS = [
  'shimmering', 'luminous', 'tapestry', 'intricate', 'meticulously',
  'insatiable', 'palpable', 'unmistakable', 'undeniable', 'relentless',
  'sprawling', 'labyrinthine', 'opulent', 'resplendent', 'ethereal',
  'visceral', 'cacophony', 'crescendo', 'juxtaposition', 'myriad',
  'plethora', 'testament', 'harbinger', 'paradigm', 'dichotomy',
];

const BANNED_PHRASES = [
  /in that moment/gi,
  /waves of (pleasure|sensation|emotion|feeling|heat|relief|desire|pain)/gi,
  /washed over (him|her|them|me|us)/gi,
  /threatened to overwhelm/gi,
  /couldn't help but/gi,
  /something (shifted|loosened|cracked|tightened|moved|settled) in (her|his|their|my) chest/gi,
  /the weight of everything/gi,
  /what might have been/gi,
  /a breath .{1,20} didn.t know/gi,
  /heart pounded in (his|her|their) chest/gi,
  /a knowing smile/gi,
  /the world seemed to (slow|stop|shift)/gi,
  /a silence that spoke volumes/gi,
  /sent (a )?(jolt|shiver|chill|wave|surge|bolt) (through|down|up)/gi,
];

const FREQUENCY_CAPS = [
  { rx: /\bshuddered\b/gi, max: 2, penalty: 1 },
  { rx: /\bsuddenly\b/gi, max: 2, penalty: 1 },
  { rx: /\bsomehow\b/gi, max: 2, penalty: 1 },
  { rx: /\bwhispered\b/gi, max: 4, penalty: 1 },
  { rx: /\bsnarled\b/gi, max: 2, penalty: 1 },
  { rx: /\brasped\b/gi, max: 2, penalty: 1 },
  { rx: /\b(his|her) voice was\b/gi, max: 2, penalty: 1 },
  { rx: /\beyes met\b/gi, max: 2, penalty: 1 },
];

/**
 * @param {string} text - Chapter prose
 * @returns {{ score: number, deductions: string[] }}
 */
export function mechanicalScore(text) {
  if (!text || text.trim().length < 50) return { score: 0, deductions: ['No content'] };

  let score = 100;
  const deductions = [];

  // Banned words: -2 per instance
  for (const word of BANNED_WORDS) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    const matches = text.match(rx) || [];
    if (matches.length > 0) {
      score -= matches.length * 2;
      deductions.push(`"${word}" ×${matches.length} (−${matches.length * 2})`);
    }
  }

  // Banned phrases: -3 per instance
  for (const rx of BANNED_PHRASES) {
    rx.lastIndex = 0;
    const matches = text.match(rx) || [];
    if (matches.length > 0) {
      const label = matches[0].slice(0, 30);
      score -= matches.length * 3;
      deductions.push(`"${label}…" ×${matches.length} (−${matches.length * 3})`);
    }
  }

  // Frequency caps
  for (const { rx, max, penalty } of FREQUENCY_CAPS) {
    rx.lastIndex = 0;
    const matches = text.match(rx) || [];
    const excess = matches.length - max;
    if (excess > 0) {
      score -= excess * penalty;
      deductions.push(`"${matches[0]}" ×${matches.length} (max ${max}, −${excess * penalty})`);
    }
  }

  // Capitalization errors: -1 per instance. EXCLUDE ellipses + abbreviations,
  // matching manuscriptStats.js countCapErrors() to keep scoring consistent
  // across all surfaces.
  const capRx = /[.!?]\s+[a-z]/g;
  let capErrors = 0;
  let capMatch;
  while ((capMatch = capRx.exec(text)) !== null) {
    const offset = capMatch.index;
    if (offset >= 1 && text[offset - 1] === '.') continue; // ellipsis
    if (offset >= 2 && /[A-Z][a-z]/.test(text.substring(offset - 2, offset))) continue; // abbreviation
    capErrors++;
  }
  if (capErrors > 0) {
    score -= capErrors;
    deductions.push(`Capitalization errors: ${capErrors} (−${capErrors})`);
  }

  // Scaffold/assistant leaks: -5 per instance. Anchored to paragraph/sentence
  // starts only, so mid-sentence matches like "around here is the chili" in
  // dialogue don't trigger a false positive.
  const scaffoldRx = /(?:^|\n\n|\n|[.!?]\s+)(This chapter will|Here is the|I've written|Let me know if|Here's the|Below is)\b/gi;
  const scaffolds = text.match(scaffoldRx) || [];
  if (scaffolds.length > 0) {
    score -= scaffolds.length * 5;
    deductions.push(`Assistant leaks: ${scaffolds.length} (−${scaffolds.length * 5})`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    deductions,
  };
}