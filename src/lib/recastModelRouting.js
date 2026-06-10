/**
 * recastModelRouting.js — Model routing for anti-chatbot recast pipeline
 *
 * Routes recast tasks to the most appropriate Ollama model based on:
 *   - Genre/profile (fiction vs nonfiction)
 *   - Detected weakness types (filter verbs, chatbot patterns, etc.)
 *   - Structure risk (citations, headings)
 *   - Voice risk (literary, memoir)
 *
 * Also provides post-recast validation gates:
 *   - Heading preservation (nonfiction)
 *   - Literary anti-flattening (literary/speculative/memoir)
 *
 * @module recastModelRouting
 */

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
  countChatbotPatterns,
} from './antiChatbotProse.js';


// ─── Model Registry ───────────────────────────────────────────────────────

/**
 * Registry of available recast models and their characteristics.
 */
export const RECAST_MODELS = {
  'prose-recast-polisher': {
    name: 'prose-recast-polisher',
    temperature: 0.4,
    strengths: ['nonfiction', 'filter_verbs', 'citations', 'authority', 'structure'],
    description: 'Dedicated conservative prose editor. Best for nonfiction, filter verb reduction, and structural preservation.',
  },
  'prose-polisher': {
    name: 'prose-polisher',
    temperature: 0.55,
    strengths: ['literary', 'voice', 'rhythm', 'texture', 'speculative'],
    description: 'General-purpose model. Better at literary texture changes and voice-sensitive recasting.',
  },
};

/** Default model for recasting */
export const DEFAULT_RECAST_MODEL = 'prose-recast-polisher';

/** Profiles considered nonfiction */
const NONFICTION_PROFILES = new Set(['nonfiction', 'business_guide', 'training_manual']);

/** Profiles considered literary/voice-sensitive */
const LITERARY_PROFILES = new Set(['literary', 'memoir']);


// ─── Weakness Detection ──────────────────────────────────────────────────

/**
 * @typedef {Object} WeaknessReport
 * @property {string[]} types - List of detected weakness type strings
 * @property {number} filterVerbDensity
 * @property {number} chatbotPatternCount
 * @property {boolean} hasCitations
 * @property {boolean} hasHeadings
 * @property {string} structureRisk - 'high' | 'medium' | 'low'
 * @property {string} voiceRisk - 'high' | 'medium' | 'low'
 */

/**
 * Detect weakness types in a chunk for routing decisions.
 *
 * @param {{ text: string }} chunk
 * @param {Object} metrics - Result of analyzeProseTexture()
 * @param {Object} [projectOrProfile]
 * @returns {WeaknessReport}
 */
export function detectRecastWeaknessTypes(chunk, metrics, projectOrProfile) {
  const types = [];
  const text = chunk?.text || '';
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const isNonfiction = NONFICTION_PROFILES.has(rules.profileKey);

  // Filter verb density
  const filterVerbDensity = metrics?.filterVerbDensity ?? 0;
  if (filterVerbDensity > 8) types.push('filter_verb_heavy');

  // Chatbot patterns
  const patterns = countChatbotPatterns(text);
  const chatbotPatternCount = patterns.total;
  if (chatbotPatternCount > 10) types.push('chatbot_patterns');

  // Thesis statements
  if ((metrics?.thesisStatementDensity ?? 0) > 0) types.push('thesis_statements');

  // Symmetrical pairs
  if ((metrics?.symmetryScore ?? 0) > 35) types.push('symmetrical_pairs');

  // Weak opening
  if (metrics?.openingVerbStrength === 'weak') types.push('weak_opening');

  // Soft ending
  if (metrics?.endingPunch === false) types.push('soft_ending');

  // Low concrete ratio
  if ((metrics?.concreteRatio ?? 100) < 40) types.push('low_concrete');

  // Generic emotions
  if ((metrics?.genericEmotionDensity ?? 0) > 3) types.push('generic_emotions');

  // Triple constructions
  if ((metrics?.tripleConstructionDensity ?? 0) > 4) types.push('triple_constructions');

  // Essay-bot transitions (nonfiction-specific)
  const essayBotPattern = /\b(?:Moreover|Furthermore|Additionally|It is important to note)\b/g;
  const essayBotMatches = (text.match(essayBotPattern) || []).length;
  if (essayBotMatches > 0 && isNonfiction) types.push('essay_bot_transitions');

  // Structure detection
  const hasCitations = /\([^)]*\d{4}[^)]*\)/.test(text) || /\[\d+\]/.test(text);
  const headingCount = detectMarkdownHeadings(text) + detectSectionHeadings(text);
  const hasHeadings = headingCount > 0;

  if (hasCitations) types.push('citation_bearing');
  if (hasHeadings && isNonfiction) types.push('heading_bearing');

  // Risk levels
  const structureRisk = (hasCitations || hasHeadings) ? 'high' : isNonfiction ? 'medium' : 'low';
  const voiceRisk = LITERARY_PROFILES.has(rules.profileKey) ? 'high' : 'low';

  return {
    types,
    filterVerbDensity,
    chatbotPatternCount,
    hasCitations,
    hasHeadings,
    structureRisk,
    voiceRisk,
  };
}


// ─── Model Routing ───────────────────────────────────────────────────────

/**
 * @typedef {Object} RoutingDecision
 * @property {string} model - Selected model name
 * @property {number} temperature - Recommended temperature
 * @property {string} reason - Human-readable routing reason
 * @property {string[]} weaknesses - Detected weakness types
 * @property {string} profileKey - Resolved profile key
 * @property {string} structureRisk
 * @property {string} voiceRisk
 */

/**
 * Choose the best recast model for a chunk based on genre, weakness, and structure.
 *
 * @param {Object} [projectOrProfile]
 * @param {{ text: string }} chunk
 * @param {Object} metrics - Result of analyzeProseTexture()
 * @param {Object} [options]
 * @param {string} [options.forceModel] - Force a specific model
 * @returns {RoutingDecision}
 */
export function chooseRecastModel(projectOrProfile, chunk, metrics, options = {}) {
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const profileKey = rules.profileKey;
  const weaknesses = detectRecastWeaknessTypes(chunk, metrics, projectOrProfile);

  // Manual override
  if (options.forceModel && RECAST_MODELS[options.forceModel]) {
    const m = RECAST_MODELS[options.forceModel];
    return {
      model: m.name,
      temperature: m.temperature,
      reason: `forced_override: ${options.forceModel}`,
      weaknesses: weaknesses.types,
      profileKey,
      structureRisk: weaknesses.structureRisk,
      voiceRisk: weaknesses.voiceRisk,
    };
  }

  const makeResult = (modelKey, reason) => {
    const m = RECAST_MODELS[modelKey];
    return {
      model: m.name,
      temperature: m.temperature,
      reason,
      weaknesses: weaknesses.types,
      profileKey,
      structureRisk: weaknesses.structureRisk,
      voiceRisk: weaknesses.voiceRisk,
    };
  };

  // Rule 1: Nonfiction always → prose-recast-polisher
  if (NONFICTION_PROFILES.has(profileKey)) {
    return makeResult('prose-recast-polisher', 'nonfiction_authority');
  }

  // Rule 2: Citation-bearing → prose-recast-polisher (structure safety)
  if (weaknesses.hasCitations) {
    return makeResult('prose-recast-polisher', 'citation_structure_preservation');
  }

  // Rule 3: Filter-verb-heavy fiction (>10/1K) → prose-recast-polisher
  if (weaknesses.filterVerbDensity > 10) {
    return makeResult('prose-recast-polisher', 'filter_verb_specialist');
  }

  // Rule 4: Literary/memoir → prose-polisher (voice preservation)
  if (LITERARY_PROFILES.has(profileKey)) {
    return makeResult('prose-polisher', 'literary_voice_preservation');
  }

  // Rule 5: Default for thriller/fiction → prose-recast-polisher
  return makeResult('prose-recast-polisher', 'general_improvement');
}


// ─── Heading Preservation Gate ────────────────────────────────────────────

/**
 * Count markdown headings (# lines) in text.
 * @param {string} text
 * @returns {number}
 */
export function detectMarkdownHeadings(text) {
  const safe = String(text || '');
  const matches = safe.match(/^#{1,6}\s+.+$/gm) || [];
  return matches.length;
}

/**
 * Count section headings: ALL-CAPS lines (≥3 words) that are standalone.
 * @param {string} text
 * @returns {number}
 */
export function detectSectionHeadings(text) {
  const safe = String(text || '');
  const lines = safe.split('\n');
  let count = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // ALL-CAPS line with at least 3 words, no lowercase
    if (trimmed.length > 10 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && !/[a-z]/.test(trimmed)) {
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      if (wordCount >= 2) count++;
    }
    // Bold-only lines: **Heading Text**
    if (/^\*\*[^*]+\*\*$/.test(trimmed) && trimmed.length > 6) {
      count++;
    }
  }
  return count;
}

/**
 * Validate that headings are preserved in a recast.
 * For nonfiction/business/training, heading loss is rejected.
 *
 * @param {string} original
 * @param {string} recast
 * @param {Object} [projectOrProfile]
 * @returns {{ ok: boolean, originalCount: number, recastCount: number, error: string|null }}
 */
export function validateHeadingPreservation(original, recast, projectOrProfile) {
  const rules = getAntiChatbotRulesForProject(projectOrProfile);
  const isNonfiction = NONFICTION_PROFILES.has(rules.profileKey);

  const originalMd = detectMarkdownHeadings(original);
  const recastMd = detectMarkdownHeadings(recast);
  const originalSec = detectSectionHeadings(original);
  const recastSec = detectSectionHeadings(recast);

  const originalCount = originalMd + originalSec;
  const recastCount = recastMd + recastSec;

  // Nonfiction: heading loss is a hard rejection
  if (isNonfiction && recastCount < originalCount) {
    return {
      ok: false,
      originalCount,
      recastCount,
      error: `Heading loss in nonfiction: ${originalCount} → ${recastCount} (lost ${originalCount - recastCount})`,
    };
  }

  return { ok: true, originalCount, recastCount, error: null };
}


// ─── Literary Anti-Flattening Guard ──────────────────────────────────────

/**
 * Validate that a literary recast actually improves the prose, not just "corrects" it.
 * Rejects recasts that flatten literary voice without meaningful improvement.
 *
 * @param {Object} beforeMetrics - analyzeProseTexture() of original
 * @param {Object} afterMetrics - analyzeProseTexture() of recast
 * @param {Object} [options]
 * @param {string} [options.profileKey] - Genre profile
 * @returns {{ ok: boolean, reason: string|null, beforeScore: number, afterScore: number, flatteningDetails: Object|null }}
 */
export function validateLiteraryRecast(beforeMetrics, afterMetrics, options = {}) {
  const profileKey = options.profileKey || '';
  const isLiterary = LITERARY_PROFILES.has(profileKey);

  // Only apply to literary profiles
  if (!isLiterary) {
    return { ok: true, reason: null, beforeScore: beforeMetrics?.compositeScore, afterScore: afterMetrics?.compositeScore, flatteningDetails: null };
  }

  const before = beforeMetrics || {};
  const after = afterMetrics || {};
  const beforeScore = before.compositeScore ?? 0;
  const afterScore = after.compositeScore ?? 0;

  // Reject if composite stays flat or drops
  if (afterScore <= beforeScore) {
    return {
      ok: false,
      reason: `literary_flat_score: ${beforeScore} → ${afterScore} (no improvement)`,
      beforeScore,
      afterScore,
      flatteningDetails: { type: 'flat_score', delta: afterScore - beforeScore },
    };
  }

  // Reject if sentence variance drops significantly
  const varianceDelta = (after.sentenceLengthVariance ?? 0) - (before.sentenceLengthVariance ?? 0);
  if (varianceDelta < -1.0) {
    return {
      ok: false,
      reason: `literary_variance_drop: ${before.sentenceLengthVariance} → ${after.sentenceLengthVariance} (rhythm flattened)`,
      beforeScore,
      afterScore,
      flatteningDetails: { type: 'variance_drop', delta: varianceDelta },
    };
  }

  // Reject if concrete ratio drops significantly
  const concreteDelta = (after.concreteRatio ?? 0) - (before.concreteRatio ?? 0);
  if (concreteDelta < -5) {
    return {
      ok: false,
      reason: `literary_concrete_drop: ${before.concreteRatio}% → ${after.concreteRatio}% (specificity lost)`,
      beforeScore,
      afterScore,
      flatteningDetails: { type: 'concrete_drop', delta: concreteDelta },
    };
  }

  // Reject if ending punch is lost
  if (before.endingPunch === true && after.endingPunch === false) {
    return {
      ok: false,
      reason: `literary_ending_lost: ending punch was true, now false`,
      beforeScore,
      afterScore,
      flatteningDetails: { type: 'ending_lost' },
    };
  }

  return { ok: true, reason: null, beforeScore, afterScore, flatteningDetails: null };
}


// ─── Routing Report ──────────────────────────────────────────────────────

/**
 * Build a summary report of model routing decisions across all chunks.
 *
 * @param {Object[]} chunkReports - Array of per-chunk routing details
 * @returns {{ modelDistribution: Object, weaknessDistribution: Object, totalChunks: number, routedChunks: number }}
 */
export function buildRecastModelRoutingReport(chunkReports) {
  const reports = chunkReports || [];
  const modelDistribution = {};
  const weaknessDistribution = {};
  let routedChunks = 0;

  for (const report of reports) {
    if (!report || !report.selectedModel) continue;
    routedChunks++;

    // Model distribution
    const model = report.selectedModel;
    modelDistribution[model] = (modelDistribution[model] || 0) + 1;

    // Weakness distribution
    const weaknesses = report.weaknessTypes || [];
    for (const w of weaknesses) {
      weaknessDistribution[w] = (weaknessDistribution[w] || 0) + 1;
    }
  }

  return {
    modelDistribution,
    weaknessDistribution,
    totalChunks: reports.length,
    routedChunks,
  };
}
