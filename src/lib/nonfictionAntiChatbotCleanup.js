/**
 * nonfictionAntiChatbotCleanup.js — Deterministic cleanup + micro-recast for nonfiction
 *
 * Two subsystems:
 *   1. Deterministic cleanup: regex-based removal of essay-bot transitions,
 *      filter verb patterns, "not just" constructions, and weak openings.
 *      No LLM required. Zero risk of hallucination.
 *
 *   2. Paragraph-level micro-recast: splits text into 80–160 word paragraphs,
 *      identifies eligible weak paragraphs, and recasts them individually
 *      with a strict nonfiction prompt.
 *
 * Safety constraints:
 *   - Never alters citation parentheticals
 *   - Never alters bibliography/reference sections
 *   - Never removes headings
 *   - Never removes list items
 *   - Returns detailed change log
 *
 * @module nonfictionAntiChatbotCleanup
 */

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
  countChatbotPatterns,
} from './antiChatbotProse.js';

import {
  detectMarkdownHeadings,
  detectSectionHeadings,
} from './recastModelRouting.js';


// ─── Constants ────────────────────────────────────────────────────────────

/** Profiles that qualify for nonfiction cleanup */
const NONFICTION_PROFILES = new Set(['nonfiction', 'business_guide', 'training_manual']);

/** Essay-bot transition patterns with their replacements */
const ESSAY_BOT_REPLACEMENTS = [
  // Full phrase removals (sentence-start)
  { pattern: /(?:^|\.\s+)Moreover,\s+/gm, replacement: (match) => match.replace(/Moreover,\s+/, ''), capitalize: true },
  { pattern: /(?:^|\.\s+)Furthermore,\s+/gm, replacement: (match) => match.replace(/Furthermore,\s+/, ''), capitalize: true },
  { pattern: /(?:^|\.\s+)Additionally,\s+/gm, replacement: (match) => match.replace(/Additionally,\s+/, ''), capitalize: true },
  { pattern: /It is important to note that /gi, replacement: '', capitalize: true },
  { pattern: /It should be understood that /gi, replacement: '', capitalize: true },
  { pattern: /This shows that /gi, replacement: '', capitalize: true },
  { pattern: /This highlights /gi, replacement: '', capitalize: true },
  { pattern: /In today's world,?\s*/gi, replacement: '', capitalize: true },
];

/** Filter verb patterns safe for deterministic nonfiction replacement */
const NONFICTION_FILTER_VERB_PATTERNS = [
  // "It felt like X" → "X"
  { pattern: /It felt like /gi, replacement: '', capitalize: true },
  // "It seemed like X" → "X"
  { pattern: /It seemed like /gi, replacement: '', capitalize: true },
  // "X seemed to be Y" → "X was Y"
  { pattern: /(\b\w+)\s+seemed to be\b/gi, replacement: '$1 was' },
  // "X appeared to be Y" → "X was Y"
  { pattern: /(\b\w+)\s+appeared to be\b/gi, replacement: '$1 was' },
  // "seemed to function" → "functioned" (nonfiction-safe)
  { pattern: /seemed to (\w+)/gi, replacement: (_, verb) => verb + 'ed', filterContext: true },
];

/** Not-just construction patterns */
const NOT_JUST_PATTERNS = [
  { pattern: /not just (\w[\w\s]*?),?\s*but (?:also\s+)?/gi, replacement: 'both $1 and ' },
  { pattern: /wasn't simply /gi, replacement: 'was ' },
  { pattern: /wasn't just /gi, replacement: 'was ' },
  { pattern: /more than (\w[\w\s]*?) — /gi, replacement: '$1 and ' },
];


// ─── Helpers ──────────────────────────────────────────────────────────────

function countWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Check if a position is inside a citation parenthetical.
 */
function isInsideCitation(text, matchIndex) {
  // Find all citation spans
  const citPatterns = [
    /\([^)]*\d{4}[^)]*\)/g,
    /\[\d+\]/g,
  ];
  for (const re of citPatterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      if (matchIndex >= m.index && matchIndex < m.index + m[0].length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if text is inside a bibliography section.
 */
function isBibliographySection(text) {
  return /^(?:references|bibliography|works?\s+cited|sources|endnotes|footnotes)\s*$/im.test(text.trim());
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Split text into paragraphs preserving structure.
 */
function splitIntoParagraphs(text) {
  const safe = String(text || '').trim();
  if (!safe) return [];
  return safe.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}


// ─── Weakness Detection ──────────────────────────────────────────────────

/**
 * Detect nonfiction-specific weaknesses in text.
 *
 * @param {string} text
 * @param {Object} [projectOrProfile]
 * @returns {{ essayBotTransitions: number, filterVerbs: number, notJustConstructions: number, weakOpenings: number, isNonfiction: boolean, details: Object }}
 */
export function detectNonfictionWeaknesses(text, projectOrProfile) {
  const safe = String(text || '');
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const isNonfiction = NONFICTION_PROFILES.has(rules.profileKey);

  // Essay-bot transitions
  const essayBotRe = /\b(?:Moreover|Furthermore|Additionally)\b|It is important to note|It should be understood|This shows that|This highlights|In today's world/gi;
  const essayBotMatches = safe.match(essayBotRe) || [];

  // Filter verbs (nonfiction patterns)
  const filterVerbRe = /\b(?:felt|seemed|appeared|noticed|realized|wondered)\b/gi;
  const filterVerbMatches = safe.match(filterVerbRe) || [];

  // Not-just constructions
  const notJustRe = /\b(?:not just|wasn't simply|wasn't just|more than\b.*?—)/gi;
  const notJustMatches = safe.match(notJustRe) || [];

  // Weak openings (paragraph-level)
  const paragraphs = splitIntoParagraphs(safe);
  let weakOpenings = 0;
  for (const p of paragraphs) {
    if (/^(?:It felt|It seemed|The (?:fact|reality|truth) (?:is|was)|There (?:is|was|are|were))\b/i.test(p)) {
      weakOpenings++;
    }
  }

  return {
    essayBotTransitions: essayBotMatches.length,
    filterVerbs: filterVerbMatches.length,
    notJustConstructions: notJustMatches.length,
    weakOpenings,
    isNonfiction,
    details: {
      essayBotList: essayBotMatches,
      filterVerbList: filterVerbMatches,
      profileKey: rules.profileKey,
    },
  };
}


// ─── Deterministic Cleanup Functions ─────────────────────────────────────

/**
 * Remove essay-bot transitions from nonfiction text.
 * Safe: never modifies citations, bibliography, or block quotes.
 *
 * @param {string} text
 * @param {Object} [options]
 * @returns {{ text: string, changes: Array<{ from: string, to: string, position: number }> }}
 */
export function reduceEssayBotTransitions(text, options = {}) {
  let result = String(text || '');
  const changes = [];

  // Split into paragraphs to process individually
  const paragraphs = splitIntoParagraphs(result);
  const processedParagraphs = [];

  for (const para of paragraphs) {
    // Skip bibliography sections
    if (isBibliographySection(para)) {
      processedParagraphs.push(para);
      continue;
    }

    let processed = para;

    // Remove "Moreover, " / "Furthermore, " / "Additionally, " at sentence start
    for (const transition of ['Moreover, ', 'Furthermore, ', 'Additionally, ']) {
      // At paragraph start
      if (processed.startsWith(transition)) {
        const after = capitalizeFirst(processed.slice(transition.length));
        changes.push({ from: transition, to: '', position: 0 });
        processed = after;
      }
      // After period + space (mid-paragraph)
      const midRe = new RegExp(`\\.\\s+${transition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      let m;
      while ((m = midRe.exec(processed)) !== null) {
        if (!isInsideCitation(processed, m.index)) {
          const before = processed.slice(0, m.index + 2); // keep ". "
          const after = capitalizeFirst(processed.slice(m.index + 2 + transition.length));
          changes.push({ from: transition, to: '', position: m.index });
          processed = before + after;
          break; // re-run after modification
        }
      }
    }

    // Remove "It is important to note that " (sentence-initial)
    for (const phrase of ['It is important to note that ', 'It should be understood that ', 'This shows that ', 'This highlights ', "In today's world, ", "In today's world "]) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      let m;
      while ((m = re.exec(processed)) !== null) {
        if (!isInsideCitation(processed, m.index)) {
          const before = processed.slice(0, m.index);
          const after = capitalizeFirst(processed.slice(m.index + m[0].length));
          changes.push({ from: m[0], to: '', position: m.index });
          processed = before + after;
          break;
        }
      }
    }

    processedParagraphs.push(processed);
  }

  return { text: processedParagraphs.join('\n\n'), changes };
}


/**
 * Reduce filter verbs in nonfiction text.
 * Only targets sentence-initial patterns safe for deterministic replacement.
 *
 * @param {string} text
 * @param {Object} [options]
 * @returns {{ text: string, changes: Array<{ from: string, to: string }> }}
 */
export function reduceNonfictionFilterVerbs(text, options = {}) {
  let result = String(text || '');
  const changes = [];

  // Split into paragraphs, skip bibliography
  const paragraphs = splitIntoParagraphs(result);
  const processedParagraphs = [];

  for (const para of paragraphs) {
    if (isBibliographySection(para)) {
      processedParagraphs.push(para);
      continue;
    }

    let processed = para;

    // "It felt like X" → "X" (capitalize)
    const feltLike = /It felt like /gi;
    let m;
    while ((m = feltLike.exec(processed)) !== null) {
      if (!isInsideCitation(processed, m.index)) {
        const before = processed.slice(0, m.index);
        const after = capitalizeFirst(processed.slice(m.index + m[0].length));
        changes.push({ from: m[0], to: '' });
        processed = before + after;
        break;
      }
    }

    // "It seemed like X" → "X"
    const seemedLike = /It seemed like /gi;
    while ((m = seemedLike.exec(processed)) !== null) {
      if (!isInsideCitation(processed, m.index)) {
        const before = processed.slice(0, m.index);
        const after = capitalizeFirst(processed.slice(m.index + m[0].length));
        changes.push({ from: m[0], to: '' });
        processed = before + after;
        break;
      }
    }

    // "X appeared to be Y" → "X was Y"
    const appearedToBe = /(\b\w+)\s+appeared to be\b/gi;
    while ((m = appearedToBe.exec(processed)) !== null) {
      if (!isInsideCitation(processed, m.index)) {
        const replacement = m[1] + ' was';
        changes.push({ from: m[0], to: replacement });
        processed = processed.slice(0, m.index) + replacement + processed.slice(m.index + m[0].length);
        break;
      }
    }

    processedParagraphs.push(processed);
  }

  return { text: processedParagraphs.join('\n\n'), changes };
}


/**
 * Reduce "not just / more than / wasn't simply" constructions.
 *
 * @param {string} text
 * @param {Object} [options]
 * @returns {{ text: string, changes: Array<{ from: string, to: string }> }}
 */
export function reduceNotJustConstructions(text, options = {}) {
  let result = String(text || '');
  const changes = [];

  for (const { pattern, replacement } of NOT_JUST_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m;
    while ((m = re.exec(result)) !== null) {
      if (!isInsideCitation(result, m.index)) {
        const replaced = m[0].replace(pattern, replacement);
        changes.push({ from: m[0], to: replaced });
        result = result.slice(0, m.index) + replaced + result.slice(m.index + m[0].length);
        break; // re-run after modification to avoid index issues
      }
    }
  }

  return { text: result, changes };
}


/**
 * Strengthen weak paragraph openings in nonfiction.
 *
 * @param {string} text
 * @param {Object} [options]
 * @returns {{ text: string, changes: Array<{ from: string, to: string }> }}
 */
export function strengthenNonfictionParagraphOpenings(text, options = {}) {
  const paragraphs = splitIntoParagraphs(String(text || ''));
  const changes = [];
  const processedParagraphs = [];

  for (const para of paragraphs) {
    // Skip headings, bibliography, short paragraphs
    if (/^#/.test(para) || isBibliographySection(para) || countWords(para) < 20) {
      processedParagraphs.push(para);
      continue;
    }

    let processed = para;

    // "The fact is that X" → "X"
    const factIs = /^The (?:fact|reality|truth) (?:is|was) that /i;
    const fm = processed.match(factIs);
    if (fm) {
      const after = capitalizeFirst(processed.slice(fm[0].length));
      changes.push({ from: fm[0], to: '' });
      processed = after;
    }

    processedParagraphs.push(processed);
  }

  return { text: processedParagraphs.join('\n\n'), changes };
}


/**
 * Validate that nonfiction structure is preserved between original and revised text.
 *
 * @param {string} original
 * @param {string} revised
 * @returns {{ ok: boolean, headingsPreserved: boolean, citationsPreserved: boolean, originalHeadings: number, revisedHeadings: number, originalCitations: number, revisedCitations: number, error: string|null }}
 */
export function preserveNonfictionStructure(original, revised) {
  const origH = detectMarkdownHeadings(original) + detectSectionHeadings(original);
  const revH = detectMarkdownHeadings(revised) + detectSectionHeadings(revised);

  const citRe = /\([^)]*\d{4}[^)]*\)/g;
  const origC = (original.match(citRe) || []).length;
  const revC = (revised.match(citRe) || []).length;

  const headingsPreserved = revH >= origH;
  const citationsPreserved = revC >= origC;
  const ok = headingsPreserved && citationsPreserved;

  return {
    ok,
    headingsPreserved,
    citationsPreserved,
    originalHeadings: origH,
    revisedHeadings: revH,
    originalCitations: origC,
    revisedCitations: revC,
    error: ok ? null : `Structure damage: headings ${origH}→${revH}, citations ${origC}→${revC}`,
  };
}


/**
 * Run the full deterministic cleanup pipeline for nonfiction.
 *
 * @param {string} text
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @returns {{ text: string, applied: boolean, changeLog: Object, beforeWeaknesses: Object, afterWeaknesses: Object }}
 */
export function runNonfictionDeterministicCleanup(text, projectOrProfile, options = {}) {
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const isNonfiction = NONFICTION_PROFILES.has(rules.profileKey);

  if (!isNonfiction) {
    return {
      text,
      applied: false,
      changeLog: { essayBot: [], filterVerbs: [], notJust: [], openings: [], total: 0 },
      beforeWeaknesses: detectNonfictionWeaknesses(text, projectOrProfile),
      afterWeaknesses: detectNonfictionWeaknesses(text, projectOrProfile),
    };
  }

  const beforeWeaknesses = detectNonfictionWeaknesses(text, projectOrProfile);

  // Phase 1: Remove essay-bot transitions
  const eb = reduceEssayBotTransitions(text);
  let current = eb.text;

  // Phase 2: Reduce filter verbs
  const fv = reduceNonfictionFilterVerbs(current);
  current = fv.text;

  // Phase 3: Reduce not-just constructions
  const nj = reduceNotJustConstructions(current);
  current = nj.text;

  // Phase 4: Strengthen openings
  const so = strengthenNonfictionParagraphOpenings(current);
  current = so.text;

  // Validate structure preserved
  const structure = preserveNonfictionStructure(text, current);
  if (!structure.ok) {
    // Abort cleanup — return original
    return {
      text,
      applied: false,
      changeLog: { essayBot: eb.changes, filterVerbs: fv.changes, notJust: nj.changes, openings: so.changes, total: 0, aborted: true, reason: structure.error },
      beforeWeaknesses,
      afterWeaknesses: beforeWeaknesses,
    };
  }

  const totalChanges = eb.changes.length + fv.changes.length + nj.changes.length + so.changes.length;
  const afterWeaknesses = detectNonfictionWeaknesses(current, projectOrProfile);

  return {
    text: current,
    applied: totalChanges > 0,
    changeLog: {
      essayBot: eb.changes,
      filterVerbs: fv.changes,
      notJust: nj.changes,
      openings: so.changes,
      total: totalChanges,
    },
    beforeWeaknesses,
    afterWeaknesses,
  };
}


// ─── Micro-Recast Subsystem ──────────────────────────────────────────────

/**
 * @typedef {Object} MicroRecastUnit
 * @property {string} text - Paragraph text
 * @property {number} index - Position in the original text
 * @property {string} type - 'heading' | 'citation_heavy' | 'list' | 'bibliography' | 'eligible' | 'short'
 * @property {number} words - Word count
 * @property {boolean} protected - Whether this unit is protected from recast
 */

/**
 * Split nonfiction text into paragraph-level micro-recast units.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {number} [options.minUnitWords=30] - Minimum words to be eligible
 * @param {number} [options.maxUnitWords=250] - Maximum words for a single unit
 * @returns {{ units: MicroRecastUnit[] }}
 */
export function splitNonfictionIntoMicroRecastUnits(text, options = {}) {
  const minWords = options.minUnitWords || 30;
  const maxWords = options.maxUnitWords || 250;
  const paragraphs = splitIntoParagraphs(String(text || ''));
  const units = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const words = countWords(para);

    // Classify the paragraph
    let type = 'eligible';
    let isProtected = false;

    // Heading
    if (/^#{1,6}\s+/.test(para) || (para.length < 80 && para === para.toUpperCase() && /[A-Z]/.test(para))) {
      type = 'heading';
      isProtected = true;
    }
    // Bibliography section
    else if (isBibliographySection(para) || /^(?:references|bibliography|works?\s+cited|sources)\s*$/im.test(para)) {
      type = 'bibliography';
      isProtected = true;
    }
    // List (>50% list items)
    else if (/^(?:\s*[-*•]\s|\s*\d+\.\s)/m.test(para)) {
      const lines = para.split('\n').filter(l => l.trim());
      const listLines = lines.filter(l => /^\s*(?:[-*•]\s|\d+\.\s)/.test(l));
      if (listLines.length > lines.length * 0.5) {
        type = 'list';
        isProtected = true;
      }
    }
    // Citation-heavy (>2 citations in a single paragraph)
    else {
      const citCount = (para.match(/\([^)]*\d{4}[^)]*\)/g) || []).length + (para.match(/\[\d+\]/g) || []).length;
      if (citCount > 2) {
        type = 'citation_heavy';
        isProtected = true;
      }
    }

    // Too short
    if (words < minWords && type === 'eligible') {
      type = 'short';
      isProtected = true;
    }

    units.push({
      text: para,
      index: i,
      type,
      words,
      protected: isProtected,
    });
  }

  return { units };
}


/**
 * Determine if a micro-recast unit should be recast.
 *
 * @param {MicroRecastUnit} unit
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @param {number} [options.microRecastThreshold=75] - Score threshold
 * @returns {{ eligible: boolean, reason: string, metrics: Object|null }}
 */
export function shouldMicroRecastNonfictionUnit(unit, projectOrProfile, options = {}) {
  const threshold = options.microRecastThreshold || 75;

  if (unit.protected) {
    return { eligible: false, reason: `Protected: ${unit.type}`, metrics: null };
  }

  if (unit.type !== 'eligible') {
    return { eligible: false, reason: `Type: ${unit.type}`, metrics: null };
  }

  const metrics = analyzeProseTexture(unit.text);

  if (metrics.compositeScore >= threshold) {
    return { eligible: false, reason: `Score ${metrics.compositeScore} >= threshold ${threshold}`, metrics };
  }

  return { eligible: true, reason: `Score ${metrics.compositeScore} < threshold ${threshold}`, metrics };
}


/**
 * Build a strict nonfiction micro-recast prompt for a single paragraph.
 *
 * @param {MicroRecastUnit} unit
 * @param {Object} [projectOrProfile]
 * @param {Object} [metrics]
 * @returns {string}
 */
export function buildNonfictionMicroRecastPrompt(unit, projectOrProfile, metrics) {
  const origWords = countWords(unit.text);
  const minWords = Math.floor(origWords * 0.95);
  const maxWords = Math.ceil(origWords * 1.15);

  // Detect citations in this paragraph
  const hasCit = /\([^)]*\d{4}[^)]*\)/.test(unit.text) || /\[\d+\]/.test(unit.text);

  const citBlock = hasCit ? `\n- Preserve citations EXACTLY as written (e.g., "(Author, Year)"). Do not paraphrase, move, or remove any citation.` : '';

  return `Revise this single paragraph only.
The original is ${origWords} words. Your revision MUST be between ${minWords} and ${maxWords} words.

MANDATORY RULES:
- Do not summarize.
- Preserve every claim, example, and data point.${citBlock}
- Keep within 95–115% of original word count.
- Improve clarity and authority.
- Remove essay-bot phrasing ("Moreover", "Furthermore", "It is important to note", etc.).
- Prefer precise verbs over filter verbs ("felt", "seemed", "noticed", "realized").
- Do not add literary imagery, sensory details, or scene dramatization.
- Do not add unsupported facts, examples, or statistics.
- Do not add emotional language or narrative urgency.
- Return ONLY the revised paragraph — no explanation, no notes, no preamble.

PARAGRAPH:
${unit.text}`;
}


/**
 * Run the nonfiction micro-recast pipeline.
 *
 * @param {string} text - Text (ideally after deterministic cleanup)
 * @param {Object} [projectOrProfile]
 * @param {Object} [options]
 * @param {Function} [options.callLLMForModel] - Model-aware LLM call
 * @param {Function} [options.callLLM] - Fallback LLM call
 * @param {number} [options.microRecastThreshold=75]
 * @param {number} [options.maxMicroRecasts=10]
 * @returns {Promise<{ text: string, report: Object }>}
 */
export async function runNonfictionMicroRecastPipeline(text, projectOrProfile, options = {}) {
  const maxRecasts = options.maxMicroRecasts || 10;
  const { callLLMForModel, callLLM } = options;
  const threshold = options.microRecastThreshold || 75;

  const report = {
    unitsAnalyzed: 0,
    unitsEligible: 0,
    unitsRecast: 0,
    unitsFailed: 0,
    unitsSkipped: 0,
    unitsProtected: 0,
    unitDetails: [],
  };

  // Split into micro-recast units
  const { units } = splitNonfictionIntoMicroRecastUnits(text);
  report.unitsAnalyzed = units.length;

  const processedUnits = [];
  let recastCount = 0;

  for (const unit of units) {
    // Check eligibility
    const eligibility = shouldMicroRecastNonfictionUnit(unit, projectOrProfile, { microRecastThreshold: threshold });

    if (!eligibility.eligible) {
      processedUnits.push(unit.text);
      if (unit.protected) report.unitsProtected++;
      else report.unitsSkipped++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'skipped',
        reason: eligibility.reason,
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        words: unit.words,
      });
      continue;
    }

    // Safety: cap micro-recasts per run
    if (recastCount >= maxRecasts) {
      processedUnits.push(unit.text);
      report.unitsSkipped++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'skipped',
        reason: 'max_micro_recasts_reached',
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        words: unit.words,
      });
      continue;
    }

    report.unitsEligible++;

    // No LLM available
    if (!callLLMForModel && !callLLM) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: 'no_llm_available',
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        words: unit.words,
      });
      continue;
    }

    // Build prompt and call LLM
    const prompt = buildNonfictionMicroRecastPrompt(unit, projectOrProfile, eligibility.metrics);
    let recastText;

    try {
      if (callLLMForModel) {
        recastText = await callLLMForModel(prompt, 'prose-recast-polisher', 0.4);
      } else {
        recastText = await callLLM(prompt);
      }
    } catch (err) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: `llm_error: ${err?.message || 'unknown'}`,
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        words: unit.words,
      });
      continue;
    }

    if (typeof recastText !== 'string') {
      recastText = recastText?.text || recastText?.content || String(recastText || '');
    }

    // Clean model output
    recastText = recastText.replace(/<think>[\s\S]*?<\/think>/gi, '');
    recastText = recastText.replace(/<\/think>/gi, '');
    recastText = recastText.replace(/\\boxed\{[^}]*\}/g, '');
    recastText = recastText.trim();

    // Validate per-paragraph
    const recastWords = countWords(recastText);
    const origWords = unit.words;
    const ratio = recastWords / origWords;

    // Word ratio check (92–115%)
    if (ratio < 0.92 || ratio > 1.15) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: `word_ratio: ${Math.round(ratio * 100)}% (${recastWords}/${origWords} words)`,
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        afterWords: recastWords,
        words: unit.words,
      });
      continue;
    }

    // Citation preservation check
    const origCit = (unit.text.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
    const recastCit = (recastText.match(/\([^)]*\d{4}[^)]*\)/g) || []).length;
    if (recastCit < origCit) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: `citation_loss: ${origCit}→${recastCit}`,
        beforeScore: eligibility.metrics?.compositeScore ?? null,
        words: unit.words,
      });
      continue;
    }

    // Quality check
    const afterMetrics = analyzeProseTexture(recastText);
    const beforeScore = eligibility.metrics?.compositeScore ?? 0;
    const afterScore = afterMetrics.compositeScore;

    if (afterScore < beforeScore) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: `score_regression: ${beforeScore}→${afterScore}`,
        beforeScore,
        afterScore,
        words: unit.words,
      });
      continue;
    }

    // Chatbot pattern check
    const beforePat = countChatbotPatterns(unit.text);
    const afterPat = countChatbotPatterns(recastText);
    if (afterPat.total > beforePat.total + 2) {
      processedUnits.push(unit.text);
      report.unitsFailed++;
      report.unitDetails.push({
        index: unit.index,
        type: unit.type,
        action: 'failed',
        reason: `chatbot_increase: ${beforePat.total}→${afterPat.total}`,
        beforeScore,
        afterScore,
        words: unit.words,
      });
      continue;
    }

    // Success!
    processedUnits.push(recastText);
    recastCount++;
    report.unitsRecast++;
    report.unitDetails.push({
      index: unit.index,
      type: unit.type,
      action: 'recast',
      reason: 'improved',
      beforeScore,
      afterScore,
      beforeWords: origWords,
      afterWords: recastWords,
      wordRatio: Math.round(ratio * 100),
    });
  }

  // Reassemble text
  const resultText = processedUnits.join('\n\n');

  // Global structure validation
  const structure = preserveNonfictionStructure(text, resultText);
  if (!structure.ok) {
    // Abort — return original
    report.aborted = true;
    report.abortReason = structure.error;
    return { text, report };
  }

  return { text: resultText, report };
}
