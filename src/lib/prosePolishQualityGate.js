// prosePolishQualityGate.js — deterministic post-polish validator
// No LLM calls, no async, no network. Pure regex-based detection & repair.

// ─── helpers ────────────────────────────────────────────────────────────────

function lineNumberOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function contextAround(text, index, radius = 40) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end);
}

// ─── MALFORMED GRAMMAR DETECTION ────────────────────────────────────────────

const SUBJUNCTIVE_PREFIXES = /(?:as\s+if|as\s+though|if)\s+$/i;

/**
 * Build malformed-grammar patterns. Each entry:
 *   { id, regex, description, hasSubjunctiveException }
 *
 * For He/She were we need a look-behind for subjunctive context.
 */
const MALFORMED_PATTERNS = [
  {
    id: 'she-were',
    // Matches "She were" but NOT when preceded by subjunctive prefix
    regex: /\bShe were\b/gi,
    description: 'She were → She was (unless subjunctive)',
    hasSubjunctiveException: true,
  },
  {
    id: 'he-were',
    regex: /\bHe were\b/gi,
    description: 'He were → He was (unless subjunctive)',
    hasSubjunctiveException: true,
  },
  {
    id: 'they-was',
    regex: /\bThey was\b/gi,
    description: 'They was → They were',
    hasSubjunctiveException: false,
  },
  {
    id: 'was-was',
    regex: /\bWas was\b/gi,
    description: 'Was was → Was',
    hasSubjunctiveException: false,
  },
  {
    id: 'you-was',
    regex: /\bYou was\b/gi,
    description: 'You was → flag only',
    hasSubjunctiveException: false,
  },
  {
    id: 'she-was-it',
    regex: /\bShe was it\b/gi,
    description: 'She was it → flag (likely "Was it")',
    hasSubjunctiveException: false,
  },
  {
    id: 'he-was-it',
    regex: /\bHe was it\b/gi,
    description: 'He was it → flag (likely "Was it")',
    hasSubjunctiveException: false,
  },
  {
    id: 'were-was',
    regex: /\bwere was\b/gi,
    description: 'were was → was',
    hasSubjunctiveException: false,
  },
  {
    id: 'was-were',
    regex: /\bwas were\b/gi,
    description: 'was were → were',
    hasSubjunctiveException: false,
  },
  {
    id: 'a-obvious',
    regex: /\ba obvious\b/gi,
    description: 'a obvious → an obvious',
    hasSubjunctiveException: false,
  },
  {
    id: 'proper-noun-were',
    // Excludes pronouns and common words that legitimately precede "were"
    regex: /\b(?!They|There|We|You|People|Things|Some|These|Those|What|Where|When|Here|All|Both|Few|Many|Most|Several|Others)([A-Z][a-z]{2,15}) were\b/g,
    description: 'Singular proper noun + "were" → likely garbled text (flag)',
    hasSubjunctiveException: false,
  },
  {
    id: 'were-those-just',
    regex: /\b(?:She|He) were those just\b/gi,
    description: 'She/He were those just → garbled (flag)',
    hasSubjunctiveException: false,
  },
];

function isSubjunctiveContext(text, matchIndex) {
  // Grab up to 20 chars before the match to look for "as if", "as though", "if"
  const before = text.slice(Math.max(0, matchIndex - 20), matchIndex);
  return SUBJUNCTIVE_PREFIXES.test(before);
}

function detectMalformedGrammar(text) {
  const matches = [];

  for (const pat of MALFORMED_PATTERNS) {
    // Reset lastIndex for global regexes
    pat.regex.lastIndex = 0;
    let m;
    while ((m = pat.regex.exec(text)) !== null) {
      if (pat.hasSubjunctiveException && isSubjunctiveContext(text, m.index)) {
        continue; // valid subjunctive — skip
      }
      matches.push({
        pattern: pat.id,
        match: m[0],
        context: contextAround(text, m.index),
        line: lineNumberOf(text, m.index),
      });
    }
  }

  return { count: matches.length, matches };
}

// ─── QUOTE ISSUE DETECTION ──────────────────────────────────────────────────

function detectQuoteIssues(text) {
  const matches = [];
  // Pattern: closing quote followed by space, then capitalized speech that
  // ends with punctuation+closing-quote but has no opening quote in between.
  const re = /[\u201d"]\s+([A-Z][^\u201c\u201d"]{10,}[,\.!\?][\u201d"])/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const captured = m[1];
    matches.push({
      type: 'missing-opening-quote',
      snippet: captured.slice(0, 60) + (captured.length > 60 ? '...' : ''),
      context: contextAround(text, m.index, 60),
      line: lineNumberOf(text, m.index),
    });
  }

  return { count: matches.length, matches };
}

// ─── SLOP DETECTION ─────────────────────────────────────────────────────────

const SLOP_PATTERNS = [
  { label: 'not just', regex: /\bnot just\b/gi },
  { label: "wasn\u2019t just", regex: /\bwasn[\u2019']t just\b/gi },
  { label: "didn\u2019t just", regex: /\bdidn[\u2019']t just\b/gi },
  { label: "isn\u2019t just", regex: /\bisn[\u2019']t just\b/gi },
  { label: 'more than just', regex: /\bmore than just\b/gi },
  { label: 'the weight of', regex: /\bthe weight of\b/gi },
  { label: 'felt', regex: /\bfelt\b/gi },
  { label: 'realized', regex: /\brealized\b/gi },
  { label: 'narrative', regex: /\bnarrative\b/gi },
  { label: 'performance', regex: /\bperformance\b/gi },
  { label: "the system wasn\u2019t", regex: /\bthe system wasn[\u2019']t\b/gi },
  { label: "the platform wasn\u2019t", regex: /\bthe platform wasn[\u2019']t\b/gi },
  { label: 'the truth was', regex: /\bthe truth was\b/gi },
  { label: 'the real truth', regex: /\bthe real truth\b/gi },
  { label: 'foundation of', regex: /\bfoundation of\b/gi },
  { label: 'woven into', regex: /\bwoven into\b/gi },
  { label: 'washed over', regex: /\bwashed over\b/gi },
  { label: 'something shifted', regex: /\bsomething shifted\b/gi },
  { label: 'palpable', regex: /\bpalpable\b/gi },
  { label: 'meticulously', regex: /\bmeticulously\b/gi },
  { label: 'luminous', regex: /\bluminous\b/gi },
  { label: 'ethereal', regex: /\bethereal\b/gi },
  { label: 'relentless', regex: /\brelentless\b/gi },
];

function countSlop(text) {
  const perPattern = {};
  let total = 0;

  for (const sp of SLOP_PATTERNS) {
    sp.regex.lastIndex = 0;
    const hits = text.match(sp.regex);
    const n = hits ? hits.length : 0;
    perPattern[sp.label] = n;
    total += n;
  }

  return { total, perPattern };
}

// ─── MAIN QUALITY GATE ─────────────────────────────────────────────────────

/**
 * Run the full prose-polish quality gate on a chapter/text.
 *
 * @param {string} text - The polished text to validate.
 * @param {object} [options={}] - Options: chapterNumber, stage.
 * @returns {{ ok, malformed, quoteIssues, dialogueIssues, slopCounts, recommendedAction }}
 */
export function runProsePolishQualityGate(text, options = {}) {
  const malformed = detectMalformedGrammar(text);
  const quoteIssues = detectQuoteIssues(text);
  const slopCounts = countSlop(text);

  // Dialogue mechanics detection (lazy import to avoid circular deps)
  let dialogueIssues = { count: 0, issues: [] };
  try {
    dialogueIssues = detectDialogueQuoteIssuesInline(text);
  } catch (_e) {
    // If detection fails, don't block
  }

  let recommendedAction = 'PASS';

  // Determine action (most severe wins, checked first)
  if (malformed.count > 0) {
    recommendedAction = 'BLOCK_POLISH_SAVE';
  } else if (quoteIssues.count > 3 || dialogueIssues.count > 5) {
    recommendedAction = 'BLOCK_POLISH_SAVE';
  } else if (quoteIssues.count > 0 || dialogueIssues.count > 0) {
    recommendedAction = 'MANUAL_REVIEW';
  } else if (slopCounts.total > 30) {
    recommendedAction = 'MANUAL_REVIEW';
  }

  const ok = recommendedAction === 'PASS';

  return { ok, malformed, quoteIssues, dialogueIssues, slopCounts, recommendedAction };
}

// ─── DETERMINISTIC GRAMMAR REPAIR ───────────────────────────────────────────

/**
 * Automatically repair deterministic grammar issues.
 * Does NOT repair ambiguous cases (You was, She/He was it).
 *
 * @param {string} text
 * @returns {{ text: string, repairs: Array<{original, replacement, context}> }}
 */
export function runDeterministicGrammarRepair(text) {
  const repairs = [];
  let result = text;

  const REPAIR_RULES = [
    {
      id: 'she-were',
      find: /\bShe were\b/gi,
      replace: (m, idx, src) => {
        if (isSubjunctiveContext(src, idx)) return m; // keep subjunctive
        return m[0] === 'S' ? 'She was' : 'she was';
      },
    },
    {
      id: 'he-were',
      find: /\bHe were\b/gi,
      replace: (m, idx, src) => {
        if (isSubjunctiveContext(src, idx)) return m;
        return m[0] === 'H' ? 'He was' : 'he was';
      },
    },
    {
      id: 'they-was',
      find: /\bThey was\b/gi,
      replace: (m) => (m[0] === 'T' ? 'They were' : 'they were'),
    },
    {
      id: 'was-was',
      find: /\bWas was\b/gi,
      replace: (m) => (m[0] === 'W' ? 'Was' : 'was'),
    },
    {
      id: 'a-obvious',
      find: /\ba obvious\b/gi,
      replace: (m) => (m[0] === 'A' ? 'An obvious' : 'an obvious'),
    },
    {
      id: 'were-was',
      find: /\bwere was\b/gi,
      replace: () => 'was',
    },
    {
      id: 'was-were',
      find: /\bwas were\b/gi,
      replace: () => 'were',
    },
  ];

  for (const rule of REPAIR_RULES) {
    rule.find.lastIndex = 0;
    result = result.replace(rule.find, function (matched, ...args) {
      // The offset is the second-to-last argument for String.replace
      const offset = args[args.length - 2];
      const source = args[args.length - 1];
      const replacement = rule.replace(matched, offset, source);
      if (replacement !== matched) {
        repairs.push({
          original: matched,
          replacement,
          rule: rule.id,
          context: contextAround(text, text.indexOf(matched), 40),
        });
      }
      return replacement;
    });
  }

  return { text: result, repairs };
}

// ─── MISSING OPENING QUOTE REPAIR ───────────────────────────────────────────

/**
 * Repair missing opening smart quotes before dialogue.
 *
 * Looks for: closing-quote + space + CapitalizedSpeech...punctuation + closing-quote
 * and inserts an opening quote at the start of the speech.
 *
 * @param {string} text
 * @returns {{ text: string, repairs: Array<{original, replacement, context}> }}
 */
export function repairMissingOpeningQuotes(text) {
  const repairs = [];

  // Match: closing quote, whitespace, then dialogue without opening quote
  // that ends with punctuation + closing quote.
  const re = /([\u201d"])(\s+)([A-Z][^\u201c\u201d"]{10,}[,\.!\?])([\u201d"])/g;

  const result = text.replace(re, function (full, closeQ, space, speech, endQ) {
    const openQ = closeQ === '\u201d' || endQ === '\u201d' ? '\u201c' : '"';
    const repaired = closeQ + space + openQ + speech + endQ;
    repairs.push({
      original: full.slice(0, 80) + (full.length > 80 ? '...' : ''),
      replacement: repaired.slice(0, 80) + (repaired.length > 80 ? '...' : ''),
      context: full.slice(0, 100),
    });
    return repaired;
  });

  return { text: result, repairs };
}

// ─── INLINE DIALOGUE QUOTE DETECTION ────────────────────────────────────────
// Lightweight detection to avoid importing the full dialogueMechanicsRepair module.
// Uses backward scanning to find nearest opening quote for each closing quote.

function detectDialogueQuoteIssuesInline(text) {
  const issues = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Find patterns: punctuation + closing quote + dialogue tag
    // Single-word verbs
    const closeTagRx = /([,\.!\?])([\"\u201d])\s+((?:she|he|they|it|the\s+system|the\s+voice|the\s+AI|the\s+guide|the\s+director|[A-Z][a-z]{1,15})\s+(?:said|asked|replied|countered|retorted|corrected|whispered|murmured|demanded|challenged|confirmed|repeated|continued|interrupted|admitted|added|protested|agreed|insisted|observed|noted|announced|warned|explained|suggested|muttered|snapped|snarled|growled|answered|breathed|shouted|called|pressed|objected|exclaimed|declared))/gi;
    // Two-word verb phrases
    const closeTagRx2 = /([,\.!\?])([\"\u201d])\s+((?:she|he|they|it|the\s+system|the\s+voice|the\s+AI|the\s+guide|the\s+director|[A-Z][a-z]{1,15})\s+(?:shot\s+back|called\s+out|fired\s+back|lashed\s+out|bit\s+out|threw\s+back|cried\s+out|pointed\s+out))/gi;

    const seenIdx = new Set();
    for (const rx of [closeTagRx, closeTagRx2]) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(line)) !== null) {
        if (seenIdx.has(m.index)) continue;
        seenIdx.add(m.index);
        const beforeMatch = line.substring(0, m.index);
        let hasMatchingOpener = false;

        // Walk backward to find the nearest quote character before the match
        for (let j = beforeMatch.length - 1; j >= 0; j--) {
          const ch = beforeMatch[j];
          if (ch === '\u201c') {
            hasMatchingOpener = true;
            break;
          }
          if (ch === '\u201d') {
            break;
          }
          if (ch === '"') {
            const nextChar = j + 1 < beforeMatch.length ? beforeMatch[j + 1] : '';
            const prevChar = j > 0 ? beforeMatch[j - 1] : '';
            if (/[A-Za-z]/.test(nextChar)) {
              hasMatchingOpener = true;
              break;
            } else if (/[,\.!\?a-z]/.test(prevChar)) {
              break;
            }
          }
        }

        if (!hasMatchingOpener) {
          issues.push({
            line: i + 1,
            type: 'missing_opening_quote',
            snippet: line.substring(Math.max(0, m.index - 40), m.index + m[0].length + 5).substring(0, 100),
          });
        }
      }
    }
  }

  return { count: issues.length, issues };
}

// ─── IMPROVEMENT SCORING ────────────────────────────────────────────────────

/**
 * Compare before/after polish to compute improvement deltas.
 *
 * @param {string} beforeText - Text before polish
 * @param {string} afterText - Text after polish
 * @param {object} [options={}] - Options: chapterNumber
 * @returns {{ before, after, deltas, verdict, improved }}
 */
export function runPolishImprovementScoring(beforeText, afterText, options = {}) {
  const beforeGate = runProsePolishQualityGate(beforeText, options);
  const afterGate = runProsePolishQualityGate(afterText, options);

  const beforeWordCount = beforeText.split(/\s+/).filter(Boolean).length;
  const afterWordCount = afterText.split(/\s+/).filter(Boolean).length;

  const before = {
    malformed: beforeGate.malformed.count,
    quoteIssues: beforeGate.quoteIssues.count,
    dialogueIssues: beforeGate.dialogueIssues.count,
    slopTotal: beforeGate.slopCounts.total,
    wordCount: beforeWordCount,
    action: beforeGate.recommendedAction,
  };

  const after = {
    malformed: afterGate.malformed.count,
    quoteIssues: afterGate.quoteIssues.count,
    dialogueIssues: afterGate.dialogueIssues.count,
    slopTotal: afterGate.slopCounts.total,
    wordCount: afterWordCount,
    action: afterGate.recommendedAction,
  };

  const deltas = {
    malformed: after.malformed - before.malformed,
    quoteIssues: after.quoteIssues - before.quoteIssues,
    dialogueIssues: after.dialogueIssues - before.dialogueIssues,
    slopTotal: after.slopTotal - before.slopTotal,
    wordCount: after.wordCount - before.wordCount,
  };

  // Verdict logic
  let verdict = 'IMPROVED';
  if (after.malformed > 0) {
    verdict = 'BLOCKED_MALFORMED';
  } else if (after.dialogueIssues > 5) {
    verdict = 'BLOCKED_DIALOGUE';
  } else if (deltas.slopTotal > 0 && after.slopTotal > 30) {
    verdict = 'REPAIR_AGAIN';
  } else if (deltas.malformed >= 0 && deltas.slopTotal >= 0 && deltas.dialogueIssues >= 0) {
    verdict = 'UNCHANGED';
  }

  const improved = deltas.malformed < 0 || deltas.slopTotal < 0 || deltas.dialogueIssues < 0;

  return { before, after, deltas, verdict, improved, chapterNumber: options.chapterNumber };
}
