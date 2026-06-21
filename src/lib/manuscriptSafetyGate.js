// =============================================================
// manuscriptSafetyGate.js — Unified manuscript safety gate v1
//
// Shared safety module for the three active UI paths:
//   1. Draft/Rewrite → draftChapter() save path
//   2. Polish → handleManuscriptPolish() / handleManuscriptPolishNonfiction()
//   3. Export → handleExport() / buildResolvedExportChapters()
//
// IMPORTANT: Bad input must be quarantined BEFORE repair transforms
// because repair transforms (fixHangingQuotes, runBrokenSentenceFixes,
// banned-word cleanup) can create grammar regressions when applied to
// editorial/process text.
// =============================================================

/**
 * Normalize text for matching only. Preserves original text for output.
 * - Normalizes curly quotes to straight equivalents
 * - Normalizes whitespace
 */
export function sanitizeForMatching(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── PROCESS LEAK DETECTION ──────────────────────────────────────

/**
 * Hard process-leak canary phrases.
 * These should never appear in manuscript prose.
 * Each entry: { phrase, severity, matchMode }
 *   matchMode:
 *     'exact'      — case-insensitive exact substring
 *     'line-start' — phrase must appear at the start of a line (heading/label)
 *     'standalone' — phrase appears as a standalone line or heading
 */
const PROCESS_LEAK_CANARIES = [
  // Editorial critique language
  { phrase: 'The opening is sharp, highly polished', severity: 'critical', matchMode: 'exact' },
  { phrase: 'The prose hits all the required marks', severity: 'critical', matchMode: 'exact' },
  { phrase: 'Analysis & Strengths', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Areas for Refinement', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Areas for improvement', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Best Next Move', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Next Move:', severity: 'critical', matchMode: 'line-start' },
  { phrase: 'Action Plan:', severity: 'critical', matchMode: 'line-start' },
  { phrase: 'Action Plan for Next Section', severity: 'critical', matchMode: 'exact' },
  { phrase: 'Constraint Adherence', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Show vs. Tell', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Pacing & Tension', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Voice Consistency', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Sensory Density', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Micro-Adjustments', severity: 'critical', matchMode: 'standalone' },

  // Process commentary
  { phrase: 'The current trajectory is working exactly as planned', severity: 'critical', matchMode: 'exact' },
  { phrase: 'We have established the what and the why', severity: 'critical', matchMode: 'exact' },
  { phrase: 'The structure is solid', severity: 'high', matchMode: 'exact' },
  { phrase: "you don't need to polish", severity: 'critical', matchMode: 'exact' },
  { phrase: 'The next logical step', severity: 'high', matchMode: 'exact' },
  { phrase: 'The goal is for the reader', severity: 'high', matchMode: 'exact' },

  // Instruction/meta labels
  { phrase: 'Strengths:', severity: 'high', matchMode: 'line-start' },
  { phrase: 'Weaknesses:', severity: 'high', matchMode: 'line-start' },
  { phrase: 'Critique:', severity: 'high', matchMode: 'line-start' },
  { phrase: 'Revision notes', severity: 'high', matchMode: 'line-start' },
  { phrase: 'Here is the revised', severity: 'critical', matchMode: 'exact' },
  { phrase: 'I will now', severity: 'high', matchMode: 'exact' },
  { phrase: 'Self-Correction', severity: 'high', matchMode: 'standalone' },
  { phrase: 'Anticipation Check', severity: 'critical', matchMode: 'standalone' },
  { phrase: 'Thinking...', severity: 'high', matchMode: 'standalone' },

  // Directive language (high confidence in heading/label context)
  { phrase: 'I recommend', severity: 'high', matchMode: 'exact' },
  { phrase: 'We need to move', severity: 'high', matchMode: 'exact' },
  { phrase: 'Focus on how', severity: 'high', matchMode: 'exact' },
  { phrase: 'TODO', severity: 'high', matchMode: 'standalone' },
];

/**
 * Check if a match is a false positive (appears naturally in story prose).
 */
function isProcessLeakFalsePositive(phrase, context, fullText) {
  const lowerPhrase = phrase.toLowerCase();
  const lowerContext = context.toLowerCase();

  // "overthinking" should not trigger "Thinking..."
  if (lowerPhrase === 'thinking...' && /\boverthinking\b/i.test(context)) return true;

  // "analysis bench" / "analysis of" should not trigger "Analysis"
  if (lowerPhrase === 'analysis & strengths') return false; // always real
  if (/\banalysis\s+(?:bench|of|tool|station|lab|result|data)\b/i.test(context)) return true;

  // "Self-Correction" as a sci-fi data label in dialogue or system output
  if (lowerPhrase === 'self-correction') {
    // If it appears inside quotes or after a data/system context, allow it
    const idx = lowerContext.indexOf(lowerPhrase);
    if (idx > 0) {
      const before = context.substring(Math.max(0, idx - 40), idx);
      if (/[""\u201C\u201D]/.test(before) || /\b(?:display|screen|readout|console|label|status|system)\b/i.test(before)) {
        return true;
      }
    }
  }

  // "TODO" inside dialogue or as part of a compound word
  if (lowerPhrase === 'todo' && /\b(?:to-do|todo list)\b/i.test(context)) return true;

  // "I recommend" inside character dialogue
  if (lowerPhrase === 'i recommend') {
    const idx = lowerContext.indexOf(lowerPhrase);
    if (idx > 0) {
      const before = context.substring(Math.max(0, idx - 60), idx);
      if (/[""\u201C]\s*$/m.test(before)) return true; // inside dialogue
    }
  }

  // "We need to move" / "Focus on how" inside dialogue
  if (lowerPhrase === 'we need to move' || lowerPhrase === 'focus on how') {
    const idx = lowerContext.indexOf(lowerPhrase);
    if (idx > 0) {
      const before = context.substring(Math.max(0, idx - 60), idx);
      if (/[""\u201C]\s*$/m.test(before)) return true;
    }
  }

  return false;
}

/**
 * Detect process leakage in manuscript text.
 *
 * @param {string} text - Chapter text to scan
 * @param {object} options - { stage, lenient }
 * @returns {{ hasLeak: boolean, matches: Array<{phrase, index, snippet, severity}> }}
 */
export function detectProcessLeaks(text, options = {}) {
  if (!text || typeof text !== 'string') return { hasLeak: false, matches: [] };

  const normalized = sanitizeForMatching(text);
  const lines = text.split('\n');
  const matches = [];

  for (const canary of PROCESS_LEAK_CANARIES) {
    const phraseNorm = sanitizeForMatching(canary.phrase);
    const phraseLower = phraseNorm.toLowerCase();

    if (canary.matchMode === 'standalone') {
      // Match if the phrase appears as a standalone line or heading
      for (let i = 0; i < lines.length; i++) {
        const lineTrimmed = lines[i].trim().replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
        if (lineTrimmed.toLowerCase() === phraseLower || lineTrimmed.toLowerCase().startsWith(phraseLower + ':')) {
          const snippet = lines[i].trim().substring(0, 120);
          if (!isProcessLeakFalsePositive(canary.phrase, lines[i], text)) {
            matches.push({
              phrase: canary.phrase,
              index: text.indexOf(lines[i]),
              snippet,
              severity: canary.severity,
              line: i + 1,
            });
          }
        }
      }
    } else if (canary.matchMode === 'line-start') {
      // Match if the phrase appears at the start of a line
      for (let i = 0; i < lines.length; i++) {
        const lineTrimmed = lines[i].trim().replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
        if (lineTrimmed.toLowerCase().startsWith(phraseLower)) {
          const snippet = lines[i].trim().substring(0, 120);
          if (!isProcessLeakFalsePositive(canary.phrase, lines[i], text)) {
            matches.push({
              phrase: canary.phrase,
              index: text.indexOf(lines[i]),
              snippet,
              severity: canary.severity,
              line: i + 1,
            });
          }
        }
      }
    } else {
      // 'exact' — case-insensitive substring match anywhere
      const normalizedLower = normalized.toLowerCase();
      let searchFrom = 0;
      while (true) {
        const idx = normalizedLower.indexOf(phraseLower, searchFrom);
        if (idx === -1) break;
        const snippetStart = Math.max(0, idx - 30);
        const snippetEnd = Math.min(normalized.length, idx + phraseLower.length + 30);
        const snippet = normalized.substring(snippetStart, snippetEnd);

        if (!isProcessLeakFalsePositive(canary.phrase, snippet, text)) {
          matches.push({
            phrase: canary.phrase,
            index: idx,
            snippet,
            severity: canary.severity,
          });
        }
        searchFrom = idx + phraseLower.length;
      }
    }
  }

  return {
    hasLeak: matches.length > 0,
    matches,
  };
}


// ── PROJECT CONTAMINATION DETECTION ─────────────────────────────

/**
 * Hard contamination phrases.
 * These are terms from other projects or business contexts that should not
 * appear in fiction manuscripts.
 */
const HARD_CONTAMINATION_PHRASES = [
  // Unity project contamination
  { phrase: 'Unity Supported Living Services', severity: 'critical' },
  { phrase: 'Unity Supported Living', severity: 'critical' },
  { phrase: 'Unity Media Solutions', severity: 'critical' },
  { phrase: 'Unity Media', severity: 'critical' },

  // Business/org contamination
  { phrase: 'care documentation', severity: 'high' },
  { phrase: 'compliance documentation', severity: 'high' },
  { phrase: 'cohort analysis', severity: 'high' },
  { phrase: 'subscription service', severity: 'high' },
  { phrase: 'Project Management Office', severity: 'critical' },
  { phrase: 'AI content pipeline', severity: 'critical' },
  { phrase: 'investor interest', severity: 'high' },
  { phrase: 'premium digital resource hub', severity: 'critical' },
  { phrase: 'developmental disabilities', severity: 'high' },
  { phrase: 'funding streams', severity: 'high' },
  { phrase: 'platform market penetration', severity: 'critical' },
  { phrase: 'quarterly profit reports', severity: 'critical' },
];

/**
 * Context-sensitive contamination phrases.
 * These are only flagged in fiction/anthology projects, not in business nonfiction.
 */
const CONTEXT_CONTAMINATION_PHRASES = [
  { phrase: 'business plan', severity: 'medium' },
  { phrase: 'app launch', severity: 'medium' },
  { phrase: 'software product', severity: 'medium' },
  { phrase: 'startup', severity: 'medium' },
];

/**
 * Standalone term contamination. Only flagged as standalone, not inside compounds.
 * Q3 and ROI are common in business but may appear in sci-fi/tech fiction naturally.
 */
const STANDALONE_CONTAMINATION = [
  { phrase: 'Q3', severity: 'medium', requireStandalone: true },
  { phrase: 'ROI', severity: 'medium', requireStandalone: true },
];

/**
 * Check whether the project type justifies business terms.
 */
function projectAllowsBusinessTerms(project) {
  if (!project) return false;
  const type = String(project.project_type || '').toLowerCase();
  const genre = String(project.genre || '').toLowerCase();
  const topic = String(project.topic || project.description || '').toLowerCase();

  // Business nonfiction, caregiver manuals, etc.
  if (type.includes('nonfiction') || type.includes('manual') || type.includes('guide')) {
    if (genre.includes('business') || genre.includes('management') || genre.includes('caregiving') || genre.includes('training')) {
      return true;
    }
    if (topic.includes('business') || topic.includes('care') || topic.includes('management')) {
      return true;
    }
  }
  return false;
}

/**
 * Detect cross-project contamination in manuscript text.
 *
 * @param {string} text - Chapter text to scan
 * @param {object} options - { project, allowBusinessTerms }
 * @returns {{ hasContamination: boolean, matches: Array<{phrase, index, snippet, severity}> }}
 */
export function detectProjectContamination(text, options = {}) {
  if (!text || typeof text !== 'string') return { hasContamination: false, matches: [] };

  const { project, allowBusinessTerms } = options;
  const normalized = sanitizeForMatching(text);
  const normalizedLower = normalized.toLowerCase();
  const matches = [];

  // Always check hard contamination
  for (const canary of HARD_CONTAMINATION_PHRASES) {
    const phraseLower = canary.phrase.toLowerCase();
    let searchFrom = 0;
    while (true) {
      const idx = normalizedLower.indexOf(phraseLower, searchFrom);
      if (idx === -1) break;
      const snippetStart = Math.max(0, idx - 30);
      const snippetEnd = Math.min(normalized.length, idx + phraseLower.length + 30);
      matches.push({
        phrase: canary.phrase,
        index: idx,
        snippet: normalized.substring(snippetStart, snippetEnd),
        severity: canary.severity,
      });
      searchFrom = idx + phraseLower.length;
    }
  }

  // Context-sensitive: only flag in fiction/anthology, unless explicitly allowed
  const allowBiz = allowBusinessTerms ?? projectAllowsBusinessTerms(project);
  if (!allowBiz) {
    for (const canary of CONTEXT_CONTAMINATION_PHRASES) {
      const phraseLower = canary.phrase.toLowerCase();
      let searchFrom = 0;
      while (true) {
        const idx = normalizedLower.indexOf(phraseLower, searchFrom);
        if (idx === -1) break;
        const snippetStart = Math.max(0, idx - 30);
        const snippetEnd = Math.min(normalized.length, idx + phraseLower.length + 30);
        matches.push({
          phrase: canary.phrase,
          index: idx,
          snippet: normalized.substring(snippetStart, snippetEnd),
          severity: canary.severity,
        });
        searchFrom = idx + phraseLower.length;
      }
    }

    // Standalone terms (Q3, ROI) — only flag if they appear as standalone words
    for (const canary of STANDALONE_CONTAMINATION) {
      const rx = new RegExp(`\\b${canary.phrase}\\b`, 'g');
      let m;
      while ((m = rx.exec(normalized)) !== null) {
        // Check it's not inside a story-native context like "Q3 sector" in sci-fi
        const before = normalized.substring(Math.max(0, m.index - 40), m.index);
        const after = normalized.substring(m.index + canary.phrase.length, Math.min(normalized.length, m.index + canary.phrase.length + 40));
        const snippet = before + canary.phrase + after;
        matches.push({
          phrase: canary.phrase,
          index: m.index,
          snippet: snippet.substring(0, 120),
          severity: canary.severity,
        });
      }
    }
  }

  return {
    hasContamination: matches.length > 0,
    matches,
  };
}


// ── MALFORMED GRAMMAR DETECTION ─────────────────────────────────

const MALFORMED_CANARIES = [
  { pattern: /\bfrom to the\b/gi, name: 'from to the' },
  { pattern: /\bgaze from to\b/gi, name: 'gaze from to' },
  { pattern: /\blooked at;/gi, name: 'looked at;' },
  { pattern: /\bfixed on,/gi, name: 'fixed on,' },
  { pattern: /\bfocused on,/gi, name: 'focused on,' },
  { pattern: /\bYou was\b/g, name: 'You was' },
  { pattern: /\bWas was\b/g, name: 'Was was' },
  { pattern: /\bthat ?slippage\b/gi, name: 'that slippage' },
  { pattern: /\breached for the and\b/gi, name: 'reached for the and' },
  { pattern: /\blooked at the and\b/gi, name: 'looked at the and' },
  { pattern: /\bpicked up the and\b/gi, name: 'picked up the and' },
  // Verb agreement failures (added for polish-enforcement hardfix)
  { pattern: /\bShe were\b/g, name: 'She were' },
  { pattern: /\bHe were\b/g, name: 'He were' },
  { pattern: /\bShe was it\b/gi, name: 'She was it' },
  { pattern: /\bHe was it\b/gi, name: 'He was it' },
  { pattern: /\ba obvious\b/gi, name: 'a obvious' },
  // Singular proper noun + "were" — excludes common words via negative lookahead
  // Also excludes subjunctive mood: "if X were", "as though X were", "wish X were", etc.
  {
    pattern: /\b(?!They|There|We|You|People|Things|Some|These|Those|What|Where|When|Here|All|Both|Few|Many|Most|Several|Others)([A-Z][a-z]{2,15}) were\b/g,
    name: 'Singular proper noun + were',
    // Custom validator to exclude subjunctive false positives
    validate: (match, text) => {
      const idx = text.lastIndexOf(match[0], match.index + match[0].length);
      const before = text.substring(Math.max(0, idx - 60), idx).toLowerCase();
      // Subjunctive markers: "if X were", "as if X were", "as though X were",
      // "though X were", "wish/wished X were", "like X were", "whether X were"
      if (/\b(?:if|as if|as though|though|even if|even though|wish|wished|wishing|like|whether|suppose|supposing|imagine|imagined|lest)\s+$/i.test(before)) {
        return false; // subjunctive — not a grammar error
      }
      // "Were X to..." (inverted subjunctive) — skip if "were" starts a clause
      if (/,\s*$/.test(before) || /\.\s*$/.test(before)) {
        return false; // sentence-initial or clause-initial — might be valid
      }
      // Compound subject: "X and <Proper> were" — the proper noun is the second
      // item of a plural subject, so "were" is correct. e.g. "Post and the Chicago Tribune were"
      if (/\band(?:\s+the)?\s*$/i.test(before)) {
        return false;
      }
      // Plural head-noun earlier in the clause governs "were", with the proper noun
      // only inside a modifier. e.g. "the lines between Washington and Texas were"
      // Look for a plural common noun + a connecting preposition before the proper noun.
      if (/\b(lines|routes|records|ledgers|papers|newspapers|troops|forces|men|operators|wires|messages|reports|dispatches|documents|states|courts|roads|ports)\b[^.?!]*\b(?:between|from|of|in|across|along|to|and)\s+[A-Za-z]*\s*$/i.test(before)) {
        return false;
      }
      return true; // likely a real error
    },
  },
  { pattern: /\b(?:She|He) were those just\b/gi, name: 'were those just' },
];

/**
 * Detect known malformed grammar patterns.
 *
 * @param {string} text - Chapter text to scan
 * @returns {{ hasMalformed: boolean, matches: Array<{phrase, index, snippet}> }}
 */
export function detectMalformedGrammar(text) {
  if (!text || typeof text !== 'string') return { hasMalformed: false, matches: [] };

  const matches = [];

  for (const canary of MALFORMED_CANARIES) {
    canary.pattern.lastIndex = 0;
    let m;
    while ((m = canary.pattern.exec(text)) !== null) {
      // If this canary has a custom validator, check it
      if (canary.validate && !canary.validate(m, text)) {
        continue; // validator says this is a false positive
      }
      const snippetStart = Math.max(0, m.index - 30);
      const snippetEnd = Math.min(text.length, m.index + m[0].length + 30);
      matches.push({
        phrase: canary.name,
        index: m.index,
        snippet: text.substring(snippetStart, snippetEnd),
      });
    }
  }

  return {
    hasMalformed: matches.length > 0,
    matches,
  };
}


// ── UNIFIED SAFETY GATE ─────────────────────────────────────────

/**
 * Run the unified manuscript safety gate.
 *
 * @param {string} text - Chapter text to scan
 * @param {object} options - {
 *   project,
 *   chapter,
 *   stage: 'post-draft' | 'pre-polish' | 'pre-export',
 *   allowBusinessTerms,
 * }
 * @returns {{
 *   ok: boolean,
 *   processLeaks: { hasLeak, matches },
 *   contamination: { hasContamination, matches },
 *   malformed: { hasMalformed, matches },
 *   recommendedAction: 'PASS' | 'REJECT_REGENERATE' | 'REJECT_MANUAL_REVIEW' | 'WARN_ONLY',
 *   reasons: string[],
 * }}
 */
export function runManuscriptSafetyGate(text, options = {}) {
  const { stage = 'pre-polish', project, chapter } = options;

  const processLeaks = detectProcessLeaks(text, options);
  const contamination = detectProjectContamination(text, options);
  const malformed = detectMalformedGrammar(text);

  const reasons = [];
  let recommendedAction = 'PASS';

  // Process leaks: always hard reject
  if (processLeaks.hasLeak) {
    const criticalLeaks = processLeaks.matches.filter(m => m.severity === 'critical');
    const highLeaks = processLeaks.matches.filter(m => m.severity === 'high');

    if (criticalLeaks.length > 0) {
      recommendedAction = 'REJECT_REGENERATE';
      reasons.push(`CRITICAL process leakage detected (${criticalLeaks.length} instance(s)): ${criticalLeaks.map(m => '"' + m.phrase + '"').join(', ')}`);
    } else if (highLeaks.length >= 2) {
      recommendedAction = 'REJECT_REGENERATE';
      reasons.push(`Multiple high-severity process leaks detected (${highLeaks.length}): ${highLeaks.map(m => '"' + m.phrase + '"').join(', ')}`);
    } else if (highLeaks.length === 1) {
      // Single high-severity leak: manual review
      if (recommendedAction === 'PASS') recommendedAction = 'REJECT_MANUAL_REVIEW';
      reasons.push(`Process leak detected: "${highLeaks[0].phrase}"`);
    }
  }

  // Contamination: reject if critical, warn if medium
  if (contamination.hasContamination) {
    const criticalContam = contamination.matches.filter(m => m.severity === 'critical');
    const highContam = contamination.matches.filter(m => m.severity === 'high');
    const mediumContam = contamination.matches.filter(m => m.severity === 'medium');

    if (criticalContam.length > 0) {
      if (recommendedAction !== 'REJECT_REGENERATE') recommendedAction = 'REJECT_REGENERATE';
      reasons.push(`CRITICAL cross-project contamination (${criticalContam.length}): ${criticalContam.map(m => '"' + m.phrase + '"').join(', ')}`);
    } else if (highContam.length > 0) {
      if (recommendedAction === 'PASS') recommendedAction = 'REJECT_REGENERATE';
      reasons.push(`Cross-project contamination (${highContam.length}): ${highContam.map(m => '"' + m.phrase + '"').join(', ')}`);
    }

    if (mediumContam.length > 0 && recommendedAction === 'PASS') {
      recommendedAction = 'WARN_ONLY';
      reasons.push(`Possible contamination (${mediumContam.length}): ${mediumContam.map(m => '"' + m.phrase + '"').join(', ')}`);
    }
  }

  // Malformed grammar: warn or manual review
  if (malformed.hasMalformed) {
    if (recommendedAction === 'PASS') {
      const strictMatches = malformed.matches.filter(m => m.name !== 'Singular proper noun + were');
      recommendedAction = strictMatches.length >= 3 ? 'REJECT_MANUAL_REVIEW' : 'WARN_ONLY';
    }
    reasons.push(`Malformed grammar (${malformed.matches.length}): ${malformed.matches.map(m => '"' + m.phrase + '"').join(', ')}`);
  }

  const ok = recommendedAction === 'PASS' || recommendedAction === 'WARN_ONLY';

  return {
    ok,
    processLeaks,
    contamination,
    malformed,
    recommendedAction,
    reasons,
    stage,
    chapterNumber: chapter?.chapter_number || null,
  };
}


// ── STRICTER PROMPT BUILDER ─────────────────────────────────────

/**
 * Build a stricter anti-process-leak prompt suffix for retry attempts.
 */
export function buildStricterDraftPromptSuffix() {
  return `\n\nCRITICAL INSTRUCTION — OUTPUT ONLY FINISHED MANUSCRIPT PROSE:
- Do NOT include critique, analysis, action plans, next steps, revision notes, or commentary.
- Do NOT include headings about strengths, weaknesses, areas for improvement, or next moves.
- Do NOT include "I recommend", "The opening is sharp", "Action Plan:", "Best Next Move", or any editorial language.
- Do NOT reference other projects, companies, or organizations not part of this story.
- Begin directly in the story with action, dialogue, or sensory detail.
- Output ONLY the chapter prose.`;
}

/**
 * Build anti-contamination prompt suffix for retry attempts.
 * @param {string[]} detectedPhrases - The specific contamination phrases found
 */
export function buildAntiContaminationPromptSuffix(detectedPhrases = []) {
  const phraseList = detectedPhrases.length > 0
    ? detectedPhrases.map(p => `"${p}"`).join(', ')
    : 'cross-project business, organizational, or client-identifying terms';

  return `\n\nCRITICAL: DO NOT REFERENCE OTHER PROJECTS OR ORGANIZATIONS.
The following terms are FORBIDDEN in this manuscript: ${phraseList}.
Do not mention real companies, business plans, funding streams, or app launches unless they are explicitly part of this story's world.
Write only within the world and characters of THIS project.`;
}

console.log('[MANUSCRIPT-SAFETY-GATE] v1 loaded: process leak + contamination + malformed grammar detection');
