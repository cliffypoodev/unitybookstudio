/**
 * Unified Prose Refinement — Orchestrates all deterministic cleanup modules
 * in a fixed, predictable pipeline order.
 *
 * Nine phases:
 *   1. Normalize formatting artifacts (deterministic, inline)
 *   2. Repair hard mechanical grammar defects (prosePolishQualityGate)
 *   3. Repair punctuation/spacing (adapted from punctuationPolish)
 *   4. Repair dialogue mechanics (dialogueMechanicsRepair)
 *   5. Reduce AI-slop phrases (aiSlopReduction)
 *   6. Apply sentence-level recasts (llmSentenceRecast)
 *   7. Detect essay-vs-scene imbalance (report only)
 *   8. Run final quality gate (prosePolishQualityGate)
 *   9. Compute metrics and return
 *
 * Modes:
 *   - 'standard'     Full pipeline (all 9 phases)
 *   - 'surface-only'  Phases 1-4 only (export preflight)
 *   - 'detect-only'   All detection, no mutations (return original text)
 *
 * IMPORTANT: Does NOT call any LLM. All transforms are deterministic.
 *
 * @module unifiedProseRefinement
 */

import { runDeterministicGrammarRepair, runProsePolishQualityGate } from './prosePolishQualityGate.js';
import { runDialogueMechanicsPass, repairSafeMidParagraphDialogueOpeners } from './dialogueMechanicsRepair.js';
import { runAISlopReductionPass } from './aiSlopReduction.js';
import { applyLLMSentenceRecasts } from './llmSentenceRecast.js';

export const VERSION = 'UNIFIED-PROSE-REFINEMENT v1.0 — 2026-06-10';
console.log('[UNIFIED-PROSE-REFINEMENT] loaded: v1.0');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Count words in a string (whitespace-split, empty-filtered).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  if (!text || !text.trim()) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Reset a global regex's lastIndex before use.
 * @param {RegExp} rx
 * @returns {RegExp}
 */
function resetRx(rx) {
  rx.lastIndex = 0;
  return rx;
}

/**
 * Count matches of a global regex in text (safe — resets lastIndex).
 * @param {RegExp} rx
 * @param {string} text
 * @returns {number}
 */
function countRxMatches(rx, text) {
  resetRx(rx);
  const m = text.match(rx);
  return m ? m.length : 0;
}

// ─── Phase 1: Normalize formatting artifacts ─────────────────────────────────

/**
 * Fix formatting artifacts deterministically.
 * @param {string} text
 * @returns {{ text: string, repairs: Array<{original: string, replacement: string, rule: string}> }}
 */
function normalizeFormattingArtifacts(text) {
  const repairs = [];
  let result = text;

  const FORMATTING_RULES = [
    // Fix spaced abbreviations
    {
      id: 'eg-spacing',
      find: /\be\.\s+g\./gi,
      replace: 'e.g.',
    },
    {
      id: 'ie-spacing',
      find: /\bi\.\s+e\./gi,
      replace: 'i.e.',
    },
    // Fix brand capitalization
    {
      id: 'youtube-cap',
      find: /\byouTube\b/g,
      replace: 'YouTube',
    },
    {
      id: 'linkedin-cap',
      find: /\blinkedIn\b/g,
      replace: 'LinkedIn',
    },
    {
      id: 'github-cap',
      find: /\bgitHub\b/g,
      replace: 'GitHub',
    },
    {
      id: 'javascript-cap',
      find: /\bjavascript\b/g,
      replace: 'JavaScript',
    },
    // Fix spaced quoted terms: "' compliance. '" → "compliance"
    {
      id: 'spaced-quoted-terms',
      find: /['\u2018]\s+(\w[\w\s]*?)\.\s*['\u2019]/g,
      replace: (m, inner) => inner.trim(),
    },
    // Fix source-marker leftovers
    {
      id: 'source-marker-curly',
      find: /\{\{SOURCE\}\}/gi,
      replace: '',
    },
    {
      id: 'source-marker-bracket',
      find: /\[SOURCE NEEDED\]/gi,
      replace: '',
    },
    {
      id: 'tk-marker',
      find: /\[TK\]/gi,
      replace: '',
    },
    {
      id: 'todo-marker',
      find: /\[TODO\]/gi,
      replace: '',
    },
    {
      id: 'fixme-marker',
      find: /\[FIXME\]/gi,
      replace: '',
    },
    // Fix markdown residue artifacts
    {
      id: 'markdown-bold-residue',
      find: /\*\*([^*]+)\*\*/g,
      replace: (m, inner) => inner,
    },
    {
      id: 'markdown-italic-residue',
      find: /(?<!\*)\*([^*]+)\*(?!\*)/g,
      replace: (m, inner) => inner,
    },
    {
      id: 'markdown-strikethrough-residue',
      find: /~~([^~]+)~~/g,
      replace: (m, inner) => inner,
    },
    // Fix em-dash capitalization artifact: '—Every' mid-sentence
    // Only match if preceded by lowercase letter + space/punct (not start of sentence)
    {
      id: 'emdash-cap-artifact',
      find: /([a-z,;])\s*\u2014\s*([A-Z])([a-z])/g,
      replace: (m, before, cap, rest) => {
        // Only lowercase if followed by lowercase (i.e., not a proper noun pattern)
        return `${before}\u2014${cap.toLowerCase()}${rest}`;
      },
    },
  ];

  for (const rule of FORMATTING_RULES) {
    resetRx(rule.find);
    if (typeof rule.replace === 'string') {
      const before = result;
      result = result.replace(rule.find, rule.replace);
      if (result !== before) {
        // Find all actual replacements
        resetRx(rule.find);
        const matches = before.match(rule.find);
        if (matches) {
          for (const m of matches) {
            repairs.push({ original: m, replacement: rule.replace, rule: rule.id });
          }
        }
      }
    } else {
      // Function replacer — track each invocation
      result = result.replace(rule.find, (...args) => {
        const original = args[0];
        const replacement = rule.replace(...args);
        if (replacement !== original) {
          repairs.push({ original, replacement, rule: rule.id });
        }
        return replacement;
      });
    }
  }

  // Clean up any double-spaces left by marker removals
  const beforeClean = result;
  result = result.replace(/  +/g, ' ').replace(/^ +/gm, (m) => m); // collapse inline doubles
  result = result.replace(/\n{4,}/g, '\n\n\n'); // cap blank-line runs

  return { text: result, repairs };
}

// ─── Phase 3: Punctuation/spacing repairs (string-based) ─────────────────────

/**
 * Apply punctuation fixes to a single string.
 * Adapted from punctuationPolish.js which operates on loaded[] arrays.
 * @param {string} text
 * @returns {{ text: string, repairs: Array<{original: string, replacement: string, rule: string}> }}
 */
function repairPunctuationAndSpacing(text) {
  const repairs = [];
  let result = text;

  function track(rule, rx, replacement) {
    resetRx(rx);
    const matches = result.match(rx);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        repairs.push({ original: m, replacement: typeof replacement === 'string' ? replacement : '(fn)', rule });
      }
      resetRx(rx);
      result = result.replace(rx, replacement);
    }
  }

  // Double commas
  track('double-commas', /,,+/g, ',');
  // Double periods (not ellipsis)
  track('double-periods', /(?<!\.)\.\.(?!\.)/g, '.');
  // Space before comma/period
  track('space-before-comma', / +,/g, ',');
  track('space-before-period', / +\./g, '.');
  // Double spaces (not paragraph breaks)
  track('double-spaces', /([^\n]) {2,}([^\n])/g, '$1 $2');
  // Comma followed by period
  track('comma-period', /,\./g, '.');
  // Period followed by comma
  track('period-comma', /\.,/g, '.');
  // Empty smart quotes
  track('empty-smart-quotes', /\u201c\u201d/g, '');
  // Semicolon followed by period or comma
  track('semicolon-period', /;\./g, '.');
  track('semicolon-comma', /;,/g, ';');

  // Duplicate articles
  track('the-the', /\bthe\s+the\b/gi, 'the');
  track('a-a', /\ba\s+a\b/gi, 'a');
  track('an-an', /\ban\s+an\b/gi, 'an');

  // Straight-to-curly quote conversion
  const straightCount = countRxMatches(/"/g, result);
  if (straightCount > 0) {
    let inQuote = false;
    let converted = '';
    for (let i = 0; i < result.length; i++) {
      const ch = result[i];
      if (ch === '"') {
        if (!inQuote) {
          converted += '\u201c';
          inQuote = true;
        } else {
          converted += '\u201d';
          inQuote = false;
        }
      } else {
        converted += ch;
      }
    }
    // If toggle got out of sync (unclosed), fall back to regex
    if (inQuote) {
      let t = result;
      t = t.replace(/(^|[\s\n(\u2014])"(\S)/g, '$1\u201c$2');
      t = t.replace(/(\S)"([\s\n,.!?;:\u2014)\-]|$)/g, '$1\u201d$2');
      let toggleOpen = true;
      t = t.replace(/"/g, () => {
        const q = toggleOpen ? '\u201c' : '\u201d';
        toggleOpen = !toggleOpen;
        return q;
      });
      result = t;
    } else {
      result = converted;
    }
    if (straightCount > 0) {
      repairs.push({ original: `${straightCount} straight quotes`, replacement: 'curly quotes', rule: 'straight-to-curly' });
    }
  }

  // Triple/double closing quotes cleanup
  const tripleBefore = result;
  result = result.replace(/[\u201d]{2,}/g, '\u201d');
  result = result.replace(/"{2,}/g, '"');
  if (result !== tripleBefore) {
    repairs.push({ original: 'stacked closing quotes', replacement: 'single closing quote', rule: 'stacked-closing-quotes' });
  }

  return { text: result, repairs };
}

// ─── Phase 7: Essay-vs-Scene Imbalance Detection ────────────────────────────

const ESSAY_PHRASES = [
  /\bThe available accounts indicate\b/gi,
  /\bThe record suggests\b/gi,
  /\bThis suggests\b/gi,
  /\bWhat remains unclear\b/gi,
  /\bThe question therefore shifts\b/gi,
  /\bdoes not merely\b/gi,
  /\bnot merely\b/gi,
  /\bIt is worth noting\b/gi,
  /\bThe evidence suggests\b/gi,
  /\bAs previously discussed\b/gi,
  /\bIn this context\b/gi,
  /\bThe implications of\b/gi,
];

const SCENE_ACTION_PATTERNS = {
  dialogueLines: /^.*[\u201c"].*[\u201d"].*$/gm,
  actionVerbs: /\b(?:grabbed|ran|slammed|kicked|threw|pulled|pushed|shouted|whispered|sprinted|ducked|leaped|crawled|lunged|swung|dodged|stumbled|collapsed)\b/gi,
  sensoryDetails: /\b(?:smelled|tasted|felt|heard|saw|touched|reeked|stank|burned|ached|stung|throbbed|echoed|glowed|flickered)\b/gi,
};

/**
 * Detect essay-vs-scene imbalance.
 * Returns a balance report with warnings. Does NOT rewrite anything.
 *
 * @param {string} text
 * @param {object} [project]
 * @returns {{ essayPhraseCount: number, sceneIndicatorCount: number, balanceScore: number, warnings: string[] }}
 */
export function detectEssayImbalance(text, project = {}) {
  const warnings = [];
  if (!text || !text.trim()) {
    return { essayPhraseCount: 0, sceneIndicatorCount: 0, balanceScore: 0, warnings };
  }

  // Count essay/forensic phrases
  let essayPhraseCount = 0;
  for (const rx of ESSAY_PHRASES) {
    essayPhraseCount += countRxMatches(rx, text);
  }

  // Count scene-action indicators
  let sceneIndicatorCount = 0;
  for (const [key, rx] of Object.entries(SCENE_ACTION_PATTERNS)) {
    sceneIndicatorCount += countRxMatches(rx, text);
  }

  // Balance score: positive = scene-heavy, negative = essay-heavy, 0 = balanced
  const total = essayPhraseCount + sceneIndicatorCount;
  let balanceScore = 0;
  if (total > 0) {
    balanceScore = Math.round(((sceneIndicatorCount - essayPhraseCount) / total) * 100);
  }

  // Determine thresholds based on genre
  const genre = (project?.genre || '').toLowerCase();
  const isNonfiction = genre === 'nonfiction' || genre === 'training';
  const essayThreshold = isNonfiction ? 20 : 8;
  const balanceThreshold = isNonfiction ? -60 : -30;

  if (essayPhraseCount > essayThreshold) {
    warnings.push(
      `High essay-summary phrase density: ${essayPhraseCount} forensic/essay phrases detected` +
      (isNonfiction ? ' (relaxed threshold for nonfiction)' : '')
    );
  }

  if (balanceScore < balanceThreshold) {
    warnings.push(
      `Essay-heavy imbalance: balance score ${balanceScore} (essay: ${essayPhraseCount}, scene: ${sceneIndicatorCount})`
    );
  }

  if (essayPhraseCount > 0 && sceneIndicatorCount === 0 && !isNonfiction) {
    warnings.push('No scene-action indicators found — text reads entirely as summary/essay');
  }

  return { essayPhraseCount, sceneIndicatorCount, balanceScore, warnings };
}

// ─── Metrics Computation ─────────────────────────────────────────────────────

const SLOP_COUNT_RX = [
  /\bnot just\b/gi, /\bwasn['\u2019]t just\b/gi, /\bdidn['\u2019]t just\b/gi,
  /\bisn['\u2019]t just\b/gi, /\bmore than just\b/gi, /\bthe weight of\b/gi,
  /\bfelt\b/gi, /\brealized\b/gi, /\bnarrative\b/gi, /\bperformance\b/gi,
  /\bpalpable\b/gi, /\bmeticulously\b/gi, /\bluminous\b/gi, /\bethereal\b/gi,
  /\brelentless\b/gi, /\bwoven into\b/gi, /\bwashed over\b/gi,
  /\bsomething shifted\b/gi,
];

const MALFORMED_RX = [
  /\bShe were\b/gi, /\bHe were\b/gi, /\bThey was\b/gi,
  /\bWas was\b/gi, /\ba obvious\b/gi, /\bwere was\b/gi, /\bwas were\b/gi,
];

const DIALOGUE_ISSUE_RX = /[\u201d"]\s+(?:she|he|they|it|[A-Z][a-z]+)\s+(?:said|asked|replied|whispered|murmured|demanded|shouted)/gi;

/**
 * Compute text quality metrics.
 * @param {string} text
 * @returns {{ wordCount: number, slopTotal: number, malformedCount: number, dialogueIssueCount: number }}
 */
function computeMetrics(text) {
  if (!text || !text.trim()) {
    return { wordCount: 0, slopTotal: 0, malformedCount: 0, dialogueIssueCount: 0 };
  }

  const wordCount = countWords(text);

  let slopTotal = 0;
  for (const rx of SLOP_COUNT_RX) {
    slopTotal += countRxMatches(rx, text);
  }

  let malformedCount = 0;
  for (const rx of MALFORMED_RX) {
    malformedCount += countRxMatches(rx, text);
  }

  const dialogueIssueCount = countRxMatches(DIALOGUE_ISSUE_RX, text);

  return { wordCount, slopTotal, malformedCount, dialogueIssueCount };
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

/**
 * Run the unified prose refinement pipeline.
 *
 * @param {object} params
 * @param {string} params.text         — Input text to refine.
 * @param {number} [params.chapter]    — Chapter number (for logging).
 * @param {object} [params.project]    — Project metadata (genre, etc.).
 * @param {string} [params.mode='standard'] — 'standard' | 'surface-only' | 'detect-only'
 * @param {boolean} [params.allowLLM=false] — Reserved; this module never calls LLMs.
 * @param {string} [params.intensity='standard'] — Reserved for future use.
 * @returns {{
 *   text: string,
 *   changed: boolean,
 *   blocked: boolean,
 *   warnings: string[],
 *   repairs: Array<{original: string, replacement: string, rule: string}>,
 *   qualityReport: object|null,
 *   beforeMetrics: object,
 *   afterMetrics: object,
 * }}
 */
export function runUnifiedProseRefinement({
  text,
  chapter,
  project,
  mode = 'standard',
  allowLLM = false,
  intensity = 'standard',
}) {
  const originalInput = text || '';
  let current = originalInput;
  const repairs = [];
  const warnings = [];
  let blocked = false;
  let qualityReport = null;

  const isDetectOnly = mode === 'detect-only';
  const isSurfaceOnly = mode === 'surface-only';

  // ── Compute before-metrics ──
  const beforeMetrics = computeMetrics(originalInput);

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 1: Normalize formatting artifacts
  // ──────────────────────────────────────────────────────────────────────────
  const phase1 = normalizeFormattingArtifacts(current);
  if (!isDetectOnly) current = phase1.text;
  repairs.push(...phase1.repairs);

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 2: Repair hard mechanical grammar defects
  // ──────────────────────────────────────────────────────────────────────────
  const phase2 = runDeterministicGrammarRepair(current);
  if (!isDetectOnly) current = phase2.text;
  for (const r of phase2.repairs) {
    repairs.push({ original: r.original, replacement: r.replacement, rule: r.rule || 'grammar-repair' });
  }
  // POLISHSAFE-4: subject-verb agreement mutations retired to flag-only —
  // surface them as warnings instead of silently substituting.
  if (phase2.flagged && phase2.flagged.length > 0) {
    warnings.push(`${phase2.flagged.length} malformed-grammar pattern(s) flagged - substitution retired (POLISHSAFE-4)`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 3: Repair punctuation/spacing
  // ──────────────────────────────────────────────────────────────────────────
  const phase3 = repairPunctuationAndSpacing(current);
  if (!isDetectOnly) current = phase3.text;
  repairs.push(...phase3.repairs);

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 4: Repair dialogue mechanics
  // ──────────────────────────────────────────────────────────────────────────
  const phase4a = runDialogueMechanicsPass(current);
  if (!isDetectOnly) current = phase4a.text;
  for (const r of phase4a.repairs) {
    repairs.push({ original: r.original, replacement: r.repaired, rule: 'dialogue-opener-' + r.type });
  }

  const phase4b = repairSafeMidParagraphDialogueOpeners(current);
  if (!isDetectOnly) current = phase4b.text;
  for (const r of phase4b.safeRepairs) {
    repairs.push({ original: r.original, replacement: r.repaired, rule: 'dialogue-mid-para-safe' });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phases 5-6: Skip if surface-only mode
  // ──────────────────────────────────────────────────────────────────────────
  if (!isSurfaceOnly) {
    // ────────────────────────────────────────────────────────────────────────
    // Phase 5: Reduce AI-slop phrases
    // ────────────────────────────────────────────────────────────────────────
    const phase5 = runAISlopReductionPass(current);
    if (!isDetectOnly) current = phase5.text;
    for (const r of phase5.repairs) {
      repairs.push({ original: r.original, replacement: r.replacement, rule: 'slop-' + r.pattern });
    }
    if (phase5.flaggedForLLM && phase5.flaggedForLLM.length > 0) {
      warnings.push(`${phase5.flaggedForLLM.length} slop pattern(s) flagged for LLM review`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Phase 6: Apply sentence-level recasts (deterministic)
    // ────────────────────────────────────────────────────────────────────────
    const phase6 = applyLLMSentenceRecasts(current);
    if (!isDetectOnly) current = phase6.text;
    for (const d of phase6.details) {
      repairs.push({ original: d.original, replacement: d.recast, rule: 'sentence-recast' });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 7: Detect essay-vs-scene imbalance (report only, no rewrite)
  // ──────────────────────────────────────────────────────────────────────────
  const phase7 = detectEssayImbalance(current, project);
  warnings.push(...phase7.warnings);

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 8: Run final quality gate
  // ──────────────────────────────────────────────────────────────────────────
  qualityReport = runProsePolishQualityGate(current, { chapterNumber: chapter });
  if (qualityReport.recommendedAction === 'BLOCK_POLISH_SAVE') {
    blocked = true;
    warnings.push('Quality gate BLOCKED: ' + qualityReport.recommendedAction);
  } else if (qualityReport.recommendedAction === 'MANUAL_REVIEW') {
    warnings.push('Quality gate flagged for MANUAL_REVIEW');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Phase 9: Compute after-metrics and return
  // ──────────────────────────────────────────────────────────────────────────
  const finalText = isDetectOnly ? originalInput : current;
  const afterMetrics = computeMetrics(finalText);
  const changed = finalText !== originalInput;

  console.log(`[UNIFIED-PROSE-REFINEMENT] run complete:`, {
    mode,
    chapter: chapter || '?',
    changed,
    blocked,
    repairsCount: repairs.length,
    warningsCount: warnings.length,
    wordsBefore: beforeMetrics.wordCount,
    wordsAfter: afterMetrics.wordCount,
  });

  return {
    text: finalText,
    changed,
    blocked,
    warnings,
    repairs,
    qualityReport,
    beforeMetrics,
    afterMetrics,
  };
}

export default runUnifiedProseRefinement;
