/**
 * AI Slop Reduction — count, score, budget, and deterministically reduce
 * AI-generated "slop" patterns in fiction text.
 *
 * This module provides a five-function pipeline:
 *   1. countAISlopPatterns   — count each slop pattern
 *   2. scoreAISlopDensity    — density score with severity rating
 *   3. buildAISlopBudgetReport — compare counts against per-chapter budgets
 *   4. reduceAISlopDeterministic — safe, deterministic recasts for excess patterns
 *   5. runAISlopReductionPass — orchestrate: count → budget → reduce → re-count
 *
 * IMPORTANT:
 * - Pure text-in / text-out — does NOT call an LLM.
 * - Deterministic recasts only apply to occurrences beyond budget.
 * - Ambiguous cases are flagged for LLM review, never silently mangled.
 * - All regex patterns reset lastIndex before use (global flag safety).
 *
 * @module aiSlopReduction
 */

export const VERSION = 'AI-SLOP-REDUCTION v1.0 — 2026-06-08';

console.log('[AI-SLOP-REDUCTION] loaded:', VERSION);

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Normalise text for consistent processing.
 * Replaces curly apostrophes with straight ones (matching is done with both).
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return String(text ?? '');
}

/**
 * Count words in a string (whitespace-split, empty-filtered).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  const t = normalizeText(text).trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/**
 * Safely reset a global regex's lastIndex before use.
 * @param {RegExp} rx
 * @returns {RegExp}
 */
function resetRx(rx) {
  rx.lastIndex = 0;
  return rx;
}

/**
 * Count matches of a global regex in text (safe — resets lastIndex).
 * @param {RegExp} rx  Must have the `g` flag.
 * @param {string} text
 * @returns {number}
 */
function countMatches(rx, text) {
  resetRx(rx);
  const m = text.match(rx);
  return m ? m.length : 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SLOP PATTERN DEFINITIONS
 *
 * Each entry: { key, label, regex }
 * All regexes are case-insensitive with global flag.
 * Curly-apostrophe variants (\u2019) are included alongside straight ones.
 * ═════════════════════════════════════════════════════════════════════════ */

import { parseCustomBannedWords } from './settingsRead.js'; // WAVE5-SETTINGS
const SLOP_PATTERNS = [
  // STYLEBUDGET-1 fingerprint constructions
  { key: 'small smile',       label: 'small smile',             regex: /\bsmall\s+smile\b/gi },
  { key: 'but it was real',   label: 'but it was real',         regex: /\bbut\s+it\s+was\s+real\b/gi },
  { key: 'short, sharp',      label: 'short, sharp',            regex: /\bshort,\s+sharp\b/gi },
  { key: 'for now',           label: 'for now',                 regex: /\bfor\s+now\b/gi },
  { key: 'indifferent',       label: 'indifferent',             regex: /\bindifferen(?:t|ce)\b/gi },
  { key: 'breath she didn\u2019t know', label: 'breath she didn\u2019t know', regex: /\bbreath\s+she\s+didn[\u2019']t\s+know\b/gi },
  { key: 'breath he didn\u2019t know',  label: 'breath he didn\u2019t know',  regex: /\bbreath\s+he\s+didn[\u2019']t\s+know\b/gi },
  { key: 'breath they didn\u2019t know', label: 'breath they didn\u2019t know', regex: /\bbreath\s+they\s+didn[\u2019']t\s+know\b/gi },
  // ── "not just" family ──
  { key: 'not just',          label: 'not just',                regex: /\bnot\s+just\b/gi },
  { key: "wasn't just",       label: "wasn't just",             regex: /\bwasn['\u2019]t\s+just\b/gi },
  { key: "didn't just",       label: "didn't just",             regex: /\bdidn['\u2019]t\s+just\b/gi },
  { key: "isn't just",        label: "isn't just",              regex: /\bisn['\u2019]t\s+just\b/gi },
  { key: 'more than just',    label: 'more than just',          regex: /\bmore\s+than\s+just\b/gi },

  // ── weight of ──
  { key: 'the weight of',     label: 'the weight of',           regex: /\bthe\s+weight\s+of\b/gi },
  { key: 'the sheer weight',  label: 'the sheer weight',        regex: /\bthe\s+sheer\s+weight\b/gi },

  // ── filtering verbs ──
  { key: 'felt',              label: 'felt',                    regex: /\bfelt\b/gi },
  { key: 'realized',          label: 'realized',                regex: /\brealized\b/gi },
  { key: 'the realization',   label: 'the realization',         regex: /\bthe\s+realization\b/gi },

  // ── thematic words (acceptable in-story but watch density) ──
  { key: 'narrative',         label: 'narrative',               regex: /\bnarrative\b/gi },
  { key: 'performance',       label: 'performance',             regex: /\bperformance\b/gi },

  // ── system/platform phrases ──
  { key: "the system wasn't", label: "the system wasn't",       regex: /\bthe\s+system\s+wasn['\u2019]t\b/gi },
  { key: "the platform wasn't", label: "the platform wasn't",   regex: /\bthe\s+platform\s+wasn['\u2019]t\b/gi },

  // ── other phrases ──
  { key: 'it was designed to', label: 'it was designed to',     regex: /\bit\s+was\s+designed\s+to\b/gi },
  { key: "it wasn't merely",  label: "it wasn't merely",        regex: /\bit\s+wasn['\u2019]t\s+merely\b/gi },
  { key: "wasn't merely",     label: "wasn't merely",           regex: /\bwasn['\u2019]t\s+merely\b/gi },
  { key: 'not merely',        label: 'not merely',              regex: /\bnot\s+merely\b/gi },

  // ── he/she realized ──
  { key: 'she realized',      label: 'she realized',            regex: /\bshe\s+realized\b/gi },
  { key: 'he realized',       label: 'he realized',             regex: /\bhe\s+realized\b/gi },

  // ── settled/washed over ──
  { key: 'settled over',      label: 'settled over',            regex: /\bsettled\s+over\b/gi },
  { key: 'washed over',       label: 'washed over',             regex: /\bwashed\s+over\b/gi },

  // ── something shifted ──
  { key: 'something shifted', label: 'something shifted',       regex: /\bsomething\s+shifted\b/gi },

  // ── individual slop words ──
  { key: 'palpable',          label: 'palpable',                regex: /\bpalpable\b/gi },
  { key: 'meticulously',      label: 'meticulously',            regex: /\bmeticulously\b/gi },
  { key: 'luminous',          label: 'luminous',                regex: /\bluminous\b/gi },
  { key: 'relentless',        label: 'relentless',              regex: /\brelentless\b/gi },
  { key: 'woven into',        label: 'woven into',              regex: /\bwoven\s+into\b/gi },
  { key: 'foundational',      label: 'foundational',            regex: /\bfoundational\b/gi },
  { key: 'optimized',         label: 'optimized',               regex: /\boptimized\b/gi },
  { key: 'quantifiable',      label: 'quantifiable',            regex: /\bquantifiable\b/gi },
  { key: 'measurable',        label: 'measurable',              regex: /\bmeasurable\b/gi },
  { key: 'operational',       label: 'operational',             regex: /\boperational\b/gi },
  { key: 'interface',         label: 'interface',               regex: /\binterface\b/gi },
  { key: 'feedback loop',     label: 'feedback loop',           regex: /\bfeedback\s+loop\b/gi },

  // ── forensic phrases ──
  { key: 'the available accounts indicate', label: 'the available accounts indicate', regex: /\bthe\s+available\s+accounts\s+indicate\b/gi },
  { key: 'the available accounts suggest',  label: 'the available accounts suggest',  regex: /\bthe\s+available\s+accounts\s+suggest\b/gi },
  { key: 'what remains unclear is',         label: 'what remains unclear is',         regex: /\bwhat\s+remains\s+unclear\s+is\b/gi },
  { key: 'the record shows',                label: 'the record shows',                regex: /\bthe\s+record\s+shows\b/gi },
  { key: 'the surviving record shows',      label: 'the surviving record shows',      regex: /\bthe\s+surviving\s+record\s+shows\b/gi },
  { key: 'the record suggests',              label: 'the record suggests',              regex: /\bthe\s+record\s+suggests\b/gi },
  { key: 'this suggests',                    label: 'this suggests (sentence opener)',   regex: /(?:^|(?<=[.!?]\s))This\s+suggests\b/gm },
  { key: 'the question therefore shifts',    label: 'the question therefore shifts',    regex: /\bthe\s+question\s+therefore\s+shifts\b/gi },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * SLOP BUDGETS (per chapter)
 *
 * Families group related patterns under a shared cap.
 * Individual entries cap a single pattern.
 * ═════════════════════════════════════════════════════════════════════════ */

// STYLEBUDGET-1: fingerprint families measured on the live 82k-word draft
// (11 "small smile", 15 "but it was real", 12 "short, sharp", 24 "for now",
// 30 "indifferent"). Budgets are per TEXT (chapter/story); the cross-chapter
// accumulation these tells actually live in is enforced by the book-level
// style ledger below, which bans a family from the writer's prompt once the
// BOOK has spent its allowance.
export const SLOP_BUDGETS = [
  {
    name: 'small smile family',
    keys: ['small smile', 'but it was real'],
    budget: 1,
    bookBudget: 3,
  },
  {
    name: 'short sharp',
    keys: ['short, sharp'],
    budget: 1,
    bookBudget: 3,
  },
  {
    name: 'for now',
    keys: ['for now'],
    budget: 2,
    bookBudget: 8,
  },
  {
    name: 'indifferent universe',
    keys: ['indifferent'],
    budget: 1,
    bookBudget: 5,
  },
  {
    name: 'breath she didn\u2019t know',
    keys: ['breath she didn\u2019t know', 'breath he didn\u2019t know', 'breath they didn\u2019t know'],
    budget: 0,
    bookBudget: 1,
  },
  {
    name: 'not just family',
    keys: ['not just', "wasn't just", "didn't just", "isn't just", 'more than just'],
    budget: 2,
  },
  {
    name: 'felt',
    keys: ['felt'],
    budget: 6,
  },
  {
    name: 'realized family',
    keys: ['realized', 'the realization', 'she realized', 'he realized'],
    budget: 3,
  },
  {
    name: 'the weight of',
    keys: ['the weight of', 'the sheer weight'],
    budget: 2,
  },
  {
    name: 'narrative',
    keys: ['narrative'],
    budget: 4,
  },
  {
    name: 'performance',
    keys: ['performance'],
    budget: 4,
  },
  {
    name: "system/platform wasn't",
    keys: ["the system wasn't", "the platform wasn't"],
    budget: 2,
  },
  {
    name: 'it was designed to',
    keys: ['it was designed to'],
    budget: 2,
  },
  {
    name: 'merely family',
    keys: ["it wasn't merely", "wasn't merely", 'not merely'],
    budget: 2,
  },
  {
    name: 'washed/settled over',
    keys: ['washed over', 'settled over'],
    budget: 2,
  },
  {
    name: 'something shifted',
    keys: ['something shifted'],
    budget: 1,
  },
  // Individual low-budget words — max 1 each
  { name: 'palpable',      keys: ['palpable'],      budget: 1 },
  { name: 'meticulously',  keys: ['meticulously'],  budget: 1 },
  { name: 'luminous',      keys: ['luminous'],      budget: 1 },
  { name: 'relentless',    keys: ['relentless'],    budget: 1 },
  { name: 'woven into',    keys: ['woven into'],    budget: 1 },
  { name: 'foundational',  keys: ['foundational'],  budget: 1 },
  { name: 'optimized',     keys: ['optimized'],     budget: 2 },
  { name: 'quantifiable',  keys: ['quantifiable'],  budget: 1 },
  { name: 'measurable',    keys: ['measurable'],    budget: 1 },
  { name: 'operational',   keys: ['operational'],   budget: 2 },
  { name: 'interface',     keys: ['interface'],     budget: 3 },
  { name: 'feedback loop', keys: ['feedback loop'], budget: 1 },

  // ── forensic phrases (budget=1 each) ──
  { name: 'the available accounts indicate', keys: ['the available accounts indicate'], budget: 1 },
  { name: 'the available accounts suggest',  keys: ['the available accounts suggest'],  budget: 1 },
  { name: 'what remains unclear is',         keys: ['what remains unclear is'],         budget: 1 },
  { name: 'the record shows',                keys: ['the record shows'],                budget: 1 },
  { name: 'the surviving record shows',      keys: ['the surviving record shows'],      budget: 1 },
  { name: 'the record suggests',              keys: ['the record suggests'],              budget: 1 },
  { name: 'this suggests (sentence opener)',  keys: ['this suggests'],                    budget: 1 },
  { name: 'the question therefore shifts',    keys: ['the question therefore shifts'],    budget: 1 },
];

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. countAISlopPatterns
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Count occurrences of each AI slop pattern in the given text.
 *
 * @param {string} text     The chapter / manuscript text to scan.
 * @param {object} [options]  Reserved for future use.
 * @returns {{ counts: Record<string, number>, total: number, density: number }}
 *   - counts: map of pattern key → occurrence count
 *   - total: sum of all pattern counts
 *   - density: total per 1000 words
 */
export function countAISlopPatterns(text, options = {}) {
  const safe = normalizeText(text);
  if (!safe.trim()) {
    return { counts: {}, total: 0, density: 0 };
  }

  const wc = countWords(safe);
  const counts = {};
  let total = 0;

  for (const pat of SLOP_PATTERNS) {
    const n = countMatches(pat.regex, safe);
    counts[pat.key] = n;
    total += n;
  }

  const density = wc > 0 ? Math.round((total / wc) * 1000 * 100) / 100 : 0;

  return { counts, total, density };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. scoreAISlopDensity
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Compute a density score with severity rating.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{ density: number, total: number, wordCount: number, severity: string }}
 *   severity: 'low' (<5/1K), 'medium' (5–10/1K), 'high' (>10/1K)
 */
export function scoreAISlopDensity(text, options = {}) {
  const safe = normalizeText(text);
  const wc = countWords(safe);
  const { total, density } = countAISlopPatterns(safe, options);

  let severity = 'low';
  if (density > 10) severity = 'high';
  else if (density >= 5) severity = 'medium';

  return { density, total, wordCount: wc, severity };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. buildAISlopBudgetReport
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Compare actual pattern counts against per-chapter budgets.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{
 *   budgets: Array<{ name: string, budget: number, actual: number, over: boolean, overBy: number }>,
 *   totalOver: number,
 *   totalOverBy: number,
 * }}
 */
export function buildAISlopBudgetReport(text, options = {}) {
  const { counts } = countAISlopPatterns(text, options);

  let totalOver = 0;
  let totalOverBy = 0;

  const budgets = SLOP_BUDGETS.map((b) => {
    const actual = b.keys.reduce((sum, k) => sum + (counts[k] || 0), 0);
    const over = actual > b.budget;
    const overBy = over ? actual - b.budget : 0;
    if (over) {
      totalOver++;
      totalOverBy += overBy;
    }
    return { name: b.name, budget: b.budget, actual, over, overBy };
  });

  return { budgets, totalOver, totalOverBy };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. reduceAISlopDeterministic
 *
 * Conservative, deterministic recasts.  Only acts on EXCESS occurrences
 * (beyond budget).  Ambiguous cases go to flaggedForLLM.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} SlopRepair
 * @property {string} original   The matched text before replacement.
 * @property {string} replacement The text after replacement.
 * @property {string} pattern     The slop budget name that triggered this.
 */

/**
 * @typedef {Object} SlopFlag
 * @property {string} snippet  A context snippet around the flagged pattern.
 * @property {string} pattern  The slop budget name.
 * @property {string} reason   Why it was flagged rather than recast.
 */

/**
 * Apply deterministic recasts to excess slop occurrences.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{ text: string, repairs: SlopRepair[], flaggedForLLM: SlopFlag[] }}
 */
export function reduceAISlopDeterministic(text, options = {}) {
  let result = normalizeText(text);
  if (!result.trim()) {
    return { text: result, repairs: [], flaggedForLLM: [] };
  }

  const repairs = [];
  const flaggedForLLM = [];

  // Build budget report to know which families are over budget
  const report = buildAISlopBudgetReport(result, options);
  const overBudgetMap = {};
  for (const b of report.budgets) {
    if (b.over) {
      overBudgetMap[b.name] = { budget: b.budget, actual: b.actual, overBy: b.overBy };
    }
  }

  // If nothing is over budget, short-circuit
  if (report.totalOver === 0) {
    return { text: result, repairs: [], flaggedForLLM: [] };
  }

  // ── Helper: skip N budget-allowed occurrences, then recast excess ──

  /**
   * POLISHSAFE-4: walk through regex matches, skip `budget` occurrences, and
   * FLAG every excess occurrence — never substitute. Every recast this helper
   * used to apply was a word/phrase swap outside rule 0.2/2's whitelist
   * (typography, a/an agreement, DIALOGREPAIR-2, CANON-2B, reported
   * structural removals). Text is returned unchanged; `recastFn` is kept as
   * a parameter for call-site compatibility but its decision is only used to
   * pick a flag reason, never applied.
   *
   * @param {string}   src          Current text.
   * @param {RegExp}   rx           Global, case-insensitive regex.
   * @param {number}   budget       How many to leave unflagged.
   * @param {string}   patternName  For bookkeeping.
   * @param {Function} recastFn     (match, surroundingContext) => { replacement, flagReason } | null
   * @returns {string} `src`, unchanged.
   */
  function recastExcess(src, rx, budget, patternName, recastFn) {
    resetRx(rx);
    let occurrence = 0;
    let m;
    while ((m = rx.exec(src)) !== null) {
      occurrence++;
      if (occurrence <= budget) { if (m[0].length === 0) rx.lastIndex++; continue; }

      const offset = m.index;
      const snippetStart = Math.max(0, offset - 60);
      const snippetEnd = Math.min(src.length, offset + m[0].length + 60);
      const snippet = src.substring(snippetStart, snippetEnd).replace(/\n/g, ' ');

      const decision = recastFn(m[0], snippet, [m[1], m[2], m[3], offset, src]);
      const reason = decision?.flagReason
        || (decision?.replacement !== undefined ? `"${m[0]}" flagged — substitution retired (POLISHSAFE-4)` : 'Could not safely recast deterministically — needs LLM review.');
      flaggedForLLM.push({ snippet, pattern: patternName, reason });
      if (m[0].length === 0) rx.lastIndex++;
    }
    return src;
  }

  // ── Recast: "wasn't just" family ──
  if (overBudgetMap['not just family']) {
    const info = overBudgetMap['not just family'];

    // Handle "wasn't just" / "wasn't merely" first (more specific patterns)
    // Pattern: "X wasn't just Y; it was Z" → "X was now Z" (gerund) or "X had become Z" (noun)
    // "X wasn't just Y; it was Z" - POLISHSAFE-4: substitution retired (this
    // used to rewrite to "X was now Z" / "X had become Z"). Flag only.
    const semicolonRx = /([A-Za-z\s]+)\s+wasn['\u2019]t\s+just\s+([^;.!?]+);\s*it\s+was\s+([^.!?]+)/gi;
    result = recastExcess(result, semicolonRx, info.budget, 'not just family', (match) => {
      return { flagReason: `"${match}" flagged - substitution retired (POLISHSAFE-4)` };
    });

    // Simple "wasn't just" fallback for short phrases
    const simpleWasntJustRx = /\bwasn['\u2019]t\s+just\b/gi;
    result = recastExcess(result, simpleWasntJustRx, info.budget, 'not just family', (match) => {
      return { replacement: 'was more than' };
    });

    // "wasn't merely" → same treatment
    const wasntMerelyRx = /\bwasn['\u2019]t\s+merely\b/gi;
    result = recastExcess(result, wasntMerelyRx, 0, 'not just family', (match) => {
      return { replacement: 'was more than' };
    });
  }

  // ── Recast: "the weight of" ──
  if (overBudgetMap['the weight of']) {
    const info = overBudgetMap['the weight of'];

    // "the weight of the realization" → "the understanding"
    const weightRealizationRx = /\bthe\s+weight\s+of\s+the\s+realization\b/gi;
    result = recastExcess(result, weightRealizationRx, 0, 'the weight of', () => {
      return { replacement: 'the understanding' };
    });

    // "the weight of it" → "the pressure"
    const weightItRx = /\bthe\s+weight\s+of\s+it\b/gi;
    result = recastExcess(result, weightItRx, 0, 'the weight of', () => {
      return { replacement: 'the pressure' };
    });

    // "the weight of X settled" → "X pressed down"
    const weightSettledRx = /\bthe\s+weight\s+of\s+(\w[\w\s]{0,30}?)\s+settled\b/gi;
    result = recastExcess(result, weightSettledRx, 0, 'the weight of', (match, _snippet, args) => {
      const subject = (args[0] || '').trim();
      if (!subject) return null;
      return { replacement: `${subject} pressed down` };
    });

    // Generic remaining "the weight of" excess
    const weightGenericRx = /\bthe\s+weight\s+of\b/gi;
    result = recastExcess(result, weightGenericRx, info.budget, 'the weight of', (_match, snippet) => {
      return { flagReason: 'Generic "the weight of" — context-dependent, needs LLM review.' };
    });
  }

  // ── Recast: "something shifted" ──
  if (overBudgetMap['something shifted']) {
    const info = overBudgetMap['something shifted'];
    const ssStartRx = /(?:^|(?<=[\n.!?]\s*))Something\s+shifted[.,;]?\s*/gi;
    result = recastExcess(result, ssStartRx, info.budget, 'something shifted', (match, snippet) => {
      return { replacement: '' };
    });
    const ssGenericRx = /\bsomething\s+shifted\b/gi;
    result = recastExcess(result, ssGenericRx, info.budget, 'something shifted', (_match, snippet) => {
      return { flagReason: 'Mid-sentence "something shifted" — needs contextual rewrite.' };
    });
  }

  // ── Recast: "felt" (dominant AI-slop pattern) ──
  // Strategy: convert filtering verb to physical sensation or action.
  // "She felt panic rising" → "Panic rose" / "Panic tightened behind her ribs"
  // "He felt the weight" → "The weight pressed"
  // Only recast excess (beyond budget of 8).
  if (overBudgetMap['felt']) {
    const info = overBudgetMap['felt'];

    // "felt a [noun]" → "a [noun] moved through / caught / pressed"
    const feltARx = /\b([Ss]he|[Hh]e|[A-Z][a-z]{1,15})\s+felt\s+a\s+(\w+)/gi;
    result = recastExcess(result, feltARx, info.budget, 'felt', (match, snippet, args) => {
      const subj = args[0];
      const noun = args[1];
      return { replacement: `A ${noun} caught ${subj.toLowerCase()}` };
    });

    // "felt the [noun]" → "the [noun] pressed / landed"
    const feltTheRx = /\b([Ss]he|[Hh]e|[A-Z][a-z]{1,15})\s+felt\s+the\s+(\w+)/gi;
    result = recastExcess(result, feltTheRx, info.budget, 'felt', (match, snippet, args) => {
      const noun = args[1];
      return { replacement: `The ${noun} pressed against ${args[0].toLowerCase()}` };
    });

    // "felt [adjective]" (e.g., "felt hollow", "felt sick") — deterministic recasts
    const FELT_ADJ_MAP = {
      hollow: 'went hollow inside',
      sick: 'stomach turned',
      cold: 'went cold',
      warm: 'warmed',
      heavy: 'heavied',
      light: 'lightened',
      dizzy: 'head spun',
      numb: 'went numb',
      raw: 'stung',
      empty: 'hollowed out',
      alive: 'quickened',
      lost: 'faltered',
      wrong: 'clenched',
      right: 'steadied',
      strange: 'shifted',
      odd: 'shifted',
      small: 'shrank',
      tight: 'tightened',
    };
    const feltAdjKeys = Object.keys(FELT_ADJ_MAP).join('|');
    const feltAdjRx = new RegExp('\\b(She|He|[A-Z][a-z]{1,15}|she|he)\\s+felt\\s+(' + feltAdjKeys + ')\\b', 'gi');
    result = recastExcess(result, feltAdjRx, info.budget, 'felt', (match, snippet, args) => {
      const subj = args[0];
      const adj = args[1].toLowerCase();
      const recast = FELT_ADJ_MAP[adj];
      if (recast) {
        return { replacement: `${subj} ${recast}` };
      }
      return { flagReason: '"felt ' + adj + '" — no safe recast available.' };
    });

    // "felt like" — common AI filtering — flag for LLM
    const feltLikeRx = /\bfelt\s+like\b/gi;
    result = recastExcess(result, feltLikeRx, info.budget, 'felt', (_match, snippet) => {
      return { flagReason: 'Remaining "felt like" — context-dependent, needs LLM review.' };
    });

    // Generic remaining "felt" excess — flag for LLM
    const feltGenericRx = /\bfelt\b/gi;
    result = recastExcess(result, feltGenericRx, info.budget, 'felt', (_match, snippet) => {
      return { flagReason: 'Remaining "felt" — context-dependent, needs LLM review.' };
    });
  }

  // ── Recast: "realized" family ──
  if (overBudgetMap['realized family']) {
    const info = overBudgetMap['realized family'];

    // "she/he realized that" → drop "she/he realized that" and keep clause
    const realizedThatRx = /\b([Ss]he|[Hh]e|[A-Z][a-z]{1,15})\s+realized\s+that\s+/gi;
    result = recastExcess(result, realizedThatRx, info.budget, 'realized family', (match, snippet, args) => {
      // Just remove the filtering — let the clause stand on its own
      return { replacement: '' };
    });

    // "she/he realized" (without that) — flag for LLM
    const realizedSimpleRx = /\b([Ss]he|[Hh]e)\s+realized\b/gi;
    result = recastExcess(result, realizedSimpleRx, info.budget, 'realized family', (_match, snippet) => {
      return { flagReason: 'Remaining "realized" — needs contextual dramatization.' };
    });

    // "the realization" → "the thought" or "the understanding"
    const theRealizationRx = /\bthe\s+realization\b/gi;
    result = recastExcess(result, theRealizationRx, 0, 'realized family', () => {
      return { replacement: 'the understanding' };
    });
  }

  // ── Recast: individual slop words (adjective/adverb removal) ──
  const singleWordSlop = [
    { name: 'palpable',     rx: /\bpalpable\s+/gi,     rxAlt: /\bpalpable\b/gi },
    { name: 'meticulously', rx: /\bmeticulously\s+/gi,  rxAlt: /\bmeticulously\b/gi },
    { name: 'luminous',     rx: /\bluminous\s+/gi,      rxAlt: /\bluminous\b/gi },
    { name: 'relentless',   rx: /\brelentless\s+/gi,    rxAlt: /\brelentless\b/gi },
    { name: 'foundational', rx: /\bfoundational\s+/gi,  rxAlt: /\bfoundational\b/gi },
  ];

  for (const sw of singleWordSlop) {
    if (!overBudgetMap[sw.name]) continue;
    const info = overBudgetMap[sw.name];

    // Try the "adjective + space" version first (e.g. "the palpable tension" → "the tension")
    result = recastExcess(result, sw.rx, info.budget, sw.name, (match, snippet) => {
      // Check if removing it looks safe — is it followed by a noun-like word?
      // Simple heuristic: if the word is preceded by an article/determiner/pronoun
      // and followed by a noun-ish word, it's safe to drop
      const afterWord = snippet.substring(snippet.indexOf(match) + match.length).trim().split(/\s+/)[0] || '';
      if (afterWord && /^[a-z]/i.test(afterWord)) {
        // Looks like "adjective noun" — safe to remove adjective
        return { replacement: '' };
      }
      return { flagReason: `"${sw.name}" appears structurally important — needs LLM review.` };
    });

    // Standalone fallback — flag if still over budget
    result = recastExcess(result, sw.rxAlt, info.budget, sw.name, (_match, snippet) => {
      return { flagReason: `Remaining "${sw.name}" is structurally embedded — needs LLM review.` };
    });
  }

  // ── Recast: forensic phrases ──
  const forensicRecasts = [
    {
      name: 'the available accounts indicate',
      rx: /\bthe\s+available\s+accounts\s+indicate\b/gi,
      alts: ['the evidence indicates', 'records indicate', 'the sources confirm'],
    },
    {
      name: 'the available accounts suggest',
      rx: /\bthe\s+available\s+accounts\s+suggest\b/gi,
      alts: ['the evidence suggests', 'records suggest', 'the sources imply'],
    },
    {
      name: 'what remains unclear is',
      rx: /\bwhat\s+remains\s+unclear\s+is\b/gi,
      alts: ['the open question is', 'still uncertain is', 'one unresolved point is'],
    },
    {
      name: 'the record shows',
      rx: /\bthe\s+record\s+shows\b/gi,
      alts: ['documents confirm', 'the evidence shows', 'sources confirm'],
    },
    {
      name: 'the surviving record shows',
      rx: /\bthe\s+surviving\s+record\s+shows\b/gi,
      alts: ['the remaining evidence shows', 'what survives confirms', 'extant sources show'],
    },
    {
      name: 'the record suggests',
      rx: /\bthe\s+record\s+suggests\b/gi,
      alts: ['the evidence implies', 'documents suggest', 'the record indicates'],
    },
    {
      name: 'this suggests (sentence opener)',
      rx: /(?:^|(?<=[.!?]\s))This\s+suggests\b/gm,
      alts: ['This implies', 'This points to', 'This indicates'],
    },
    {
      name: 'the question therefore shifts',
      rx: /\bthe\s+question\s+therefore\s+shifts\s+to\b/gi,
      alts: ['the focus then moves to', 'attention turns to', 'the inquiry turns to'],
    },
    {
      name: 'the question therefore shifts',
      rx: /\bthe\s+question\s+therefore\s+shifts\b/gi,
      alts: ['the question then becomes', 'the focus shifts', 'the central question becomes'],
    },
  ];

  for (const fp of forensicRecasts) {
    if (!overBudgetMap[fp.name]) continue;
    const info = overBudgetMap[fp.name];
    let fpIdx = 0;
    result = recastExcess(result, fp.rx, info.budget, fp.name, (match, snippet) => {
      const alt = fp.alts[fpIdx % fp.alts.length];
      fpIdx++;
      // Preserve original capitalisation
      const replacement = match[0] === match[0].toUpperCase()
        ? alt.charAt(0).toUpperCase() + alt.slice(1)
        : alt;
      return { replacement };
    });
  }

  // Clean up any double spaces left by removals
  result = result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\n{4,}/g, '\n\n\n');

  return { text: result, repairs, flaggedForLLM };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. runAISlopReductionPass
 *
 * Orchestrate: count → budget → reduce → re-count
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Full AI slop reduction pass: analyse, recast, and report.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {{
 *   text: string,
 *   repairs: SlopRepair[],
 *   flaggedForLLM: SlopFlag[],
 *   beforeTotal: number,
 *   afterTotal: number,
 *   beforeBudgetReport: object,
 *   afterBudgetReport: object,
 *   improved: boolean,
 * }}
 */
export function runAISlopReductionPass(text, options = {}) {
  const safe = normalizeText(text);

  // ── Before snapshot ──
  const beforeCounts = countAISlopPatterns(safe, options);
  const beforeBudgetReport = buildAISlopBudgetReport(safe, options);
  const beforeTotal = beforeCounts.total;

  // ── Reduce ──
  const { text: reduced, repairs, flaggedForLLM } = reduceAISlopDeterministic(safe, options);

  // ── After snapshot ──
  const afterCounts = countAISlopPatterns(reduced, options);
  const afterBudgetReport = buildAISlopBudgetReport(reduced, options);
  const afterTotal = afterCounts.total;

  const improved = afterTotal < beforeTotal;

  console.log('[AI-SLOP-REDUCTION] pass complete:', {
    beforeTotal,
    afterTotal,
    repairsApplied: repairs.length,
    flaggedForLLM: flaggedForLLM.length,
    improved,
  });

  return {
    text: reduced,
    repairs,
    flaggedForLLM,
    beforeTotal,
    afterTotal,
    beforeBudgetReport,
    afterBudgetReport,
    improved,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. recastBannedVocabulary
 *
 * Replaces 33 banned AI-slop words with grammatically valid synonyms.
 * NEVER deletes to empty string — always substitutes.
 * Cycles through synonym options to vary output.
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Map of banned words to their synonym replacement options.
 * At least 2 options per word.
 */
const BANNED_VOCAB_MAP = {
  'shimmering':     ['gleaming', 'bright', 'glinting'],
  'luminous':       ['bright', 'glowing', 'radiant'],
  'tapestry':       ['fabric', 'web', 'mosaic'],
  'intricate':      ['complex', 'detailed', 'elaborate'],
  'meticulously':   ['carefully', 'precisely', 'thoroughly'],
  'insatiable':     ['unquenchable', 'greedy', 'voracious'],
  'palpable':       ['obvious', 'thick', 'tangible'],
  'unmistakable':   ['clear', 'obvious', 'plain'],
  'undeniable':     ['clear', 'certain', 'plain'],
  'relentless':     ['constant', 'unyielding', 'steady'],
  'sprawling':      ['vast', 'wide', 'expansive'],
  'labyrinthine':   ['winding', 'tangled', 'convoluted'],
  'opulent':        ['lavish', 'rich', 'luxurious'],
  'resplendent':    ['brilliant', 'dazzling', 'striking'],
  'ethereal':       ['delicate', 'airy', 'ghostly'],
  'visceral':       ['raw', 'gut-level', 'deep'],
  'cacophony':      ['din', 'racket', 'noise'],
  'crescendo':      ['peak', 'climax', 'surge'],
  'juxtaposition':  ['contrast', 'comparison', 'pairing'],
  'myriad':         ['countless', 'many', 'numerous'],
  'plethora':       ['abundance', 'wealth', 'excess'],
  'testament':      ['proof', 'evidence', 'sign'],
  'harbinger':      ['herald', 'sign', 'omen'],
  'paradigm':       ['model', 'framework', 'pattern'],
  'dichotomy':      ['divide', 'split', 'contrast'],
  'multifaceted':   ['complex', 'varied', 'layered'],
  'aforementioned': ['previous', 'earlier', 'noted'],
  'nonetheless':    ['still', 'even so', 'yet'],
  'furthermore':    ['also', 'in addition', 'besides'],
  'henceforth':     ['from now on', 'going forward', 'after this'],
  'commence':       ['begin', 'start', 'open'],
  'utilize':        ['use', 'employ', 'apply'],
  'endeavor':       ['effort', 'attempt', 'venture'],
  'pertaining':     ['about', 'related', 'regarding'],
};

/**
 * POLISHSAFE-4: flag every banned-vocabulary occurrence instead of
 * substituting a cycling synonym. Detection only — `text` is always
 * returned unchanged; `recasts` stays empty for call-site compatibility.
 *
 * @param {string} text
 * @returns {{ text: string, recasts: [], flagged: Array<{word: string, count: number}> }}
 */
export function recastBannedVocabulary(text) {
  const result = normalizeText(text);
  const recasts = [];
  const flagged = [];

  if (!result.trim()) {
    return { text: result, recasts, flagged };
  }

  // WAVE5-SETTINGS: user-supplied word=replacement entries join the banned map.
  const userRecastMap = parseCustomBannedWords().recastMap;

  // "testament to" is counted separately from bare "testament" below, the
  // same precedence the retired substitution used to apply.
  const testamentToCount = (result.match(/\btestament\s+to\b/gi) || []).length;
  if (testamentToCount > 0) flagged.push({ word: 'testament to', count: testamentToCount });

  for (const word of Object.keys({ ...BANNED_VOCAB_MAP, ...userRecastMap })) {
    const rx = new RegExp('\\b' + word + '\\b', 'gi');
    let count = (result.match(rx) || []).length;
    if (word === 'testament') count -= testamentToCount;
    if (count > 0) flagged.push({ word, count });
  }

  return { text: result, recasts, flagged };
}

export default runAISlopReductionPass;

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLEBUDGET-1 — the book-level style ledger.
 *
 * The per-text budgets above cannot see the fingerprint that exposed the live
 * 82k draft: constructions that pass every chapter individually and accumulate
 * into a tell across the book (11 "small smile", 15 "but it was real"), plus
 * raw simile density (332 "like a" + 82 "as if" ≈ 5.0/1k words). This layer is
 * deterministic and draft-time: measure prior chapters, ban exhausted families
 * from the writer's prompt, and state a simile budget the scene must respect.
 * ═════════════════════════════════════════════════════════════════════════ */

export const SIMILE_DENSITY_BUDGET_PER_1K = 3.0; // ≈ 1 conspicuous simile per 330 words

export function measureSimileDensity(text) {
  const safe = normalizeText(text);
  const wc = countWords(safe);
  if (!wc) return { likeA: 0, asIf: 0, total: 0, per1k: 0, wordCount: 0 };
  const likeA = (safe.match(/\blike\s+an?\b/gi) || []).length;
  const asIf = (safe.match(/\bas\s+if\b/gi) || []).length;
  const total = likeA + asIf;
  return { likeA, asIf, total, per1k: Math.round((total / wc) * 1000 * 100) / 100, wordCount: wc };
}

/**
 * Cross-chapter spend per budget family. `bookBudget` on a SLOP_BUDGETS entry
 * marks it as book-capped; families without one are per-text only.
 */
export function buildBookStyleLedger(priorTexts) {
  const texts = (Array.isArray(priorTexts) ? priorTexts : [priorTexts]).map((t) => String(t || ''));
  const corpus = texts.join('\n\n');
  const { counts } = countAISlopPatterns(corpus);
  const families = [];
  for (const family of SLOP_BUDGETS) {
    if (!Number.isFinite(family.bookBudget)) continue;
    const spent = family.keys.reduce((sum, key) => sum + (counts[key] || 0), 0);
    families.push({ name: family.name, keys: family.keys, bookBudget: family.bookBudget, spent, exhausted: spent >= family.bookBudget });
  }
  const simile = measureSimileDensity(corpus);
  return { families, simile };
}

/**
 * Prompt-ready style budget block for the scene writer. Empty string when the
 * book is young and nothing is exhausted (the base style rules already cover
 * general restraint).
 */
export function buildStyleBudgetPromptBlock(ledger) {
  if (!ledger) return '';
  const lines = [];
  const exhausted = (ledger.families || []).filter((family) => family.exhausted);
  if (exhausted.length) {
    lines.push(
      'EXHAUSTED CONSTRUCTIONS — this book has already spent its allowance of each of these; do NOT use them or close variants in this chapter:'
    );
    for (const family of exhausted) {
      lines.push(`- ${family.keys.map((key) => `"${key}"`).join(', ')} (used ${family.spent}x already)`);
    }
  }
  if (ledger.simile && ledger.simile.wordCount > 2000 && ledger.simile.per1k > SIMILE_DENSITY_BUDGET_PER_1K) {
    lines.push(
      `SIMILE BUDGET: earlier chapters average ${ledger.simile.per1k} "like a / as if" comparisons per 1000 words — over the ${SIMILE_DENSITY_BUDGET_PER_1K}/1000 budget. In this chapter, use at most one conspicuous simile per ~330 words; prefer a plain concrete action or sensory statement over a comparison.`
    );
  }
  return lines.length ? `STYLE BUDGET — MANDATORY:\n${lines.join('\n')}` : '';
}

