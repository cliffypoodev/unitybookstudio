/**
 * @module polishPipelineConfig
 *
 * Configuration profiles and decision functions for the polish pipeline.
 * Each profile tailors slop reduction, dialogue repair, LLM recasting,
 * polish intensity, and reference integrity checking to a specific genre
 * or document type.
 *
 * Every profile enforces `hardSafety: true` unconditionally.
 */

import { detectReferenceSections, extractInlineCitations } from './referenceIntegrityGate.js';

// ---------------------------------------------------------------------------
// Dialogue-detection verbs (lowercase, no character names)
// ---------------------------------------------------------------------------

/** @type {string[]} */
const DIALOGUE_VERBS = [
  'said',
  'asked',
  'replied',
  'answered',
  'whispered',
  'shouted',
  'muttered',
  'murmured',
  'exclaimed',
  'demanded',
  'insisted',
  'suggested',
  'wondered',
  'added',
  'continued',
  'explained',
  'called',
  'cried',
  'yelled',
  'screamed',
  'sighed',
  'groaned',
  'laughed',
  'snapped',
  'hissed',
  'pleaded',
  'begged',
  'stammered',
  'stuttered',
  'remarked',
  'noted',
  'observed',
  'responded',
  'retorted',
  'declared',
  'announced',
  'admitted',
  'confessed',
  'warned',
  'promised',
  'agreed',
  'protested',
  'objected',
  'interrupted',
  'repeated',
  'urged',
  'cautioned',
  'conceded',
];

// ---------------------------------------------------------------------------
// Profile definitions
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} PolishProfile
 * @property {boolean|'auto'}  dialogueRepair    - Whether to run dialogue repair.
 * @property {'high'|'medium'|'low'|'conservative'} slopReduction - Slop-reduction intensity.
 * @property {boolean}         llmSentenceRecast - Whether LLM sentence recasting is allowed.
 * @property {'high'|'medium'|'low'|'conservative'} polishIntensity - Overall polish intensity.
 * @property {boolean}         [preserveVoice]   - Preserve the author's narrative voice.
 * @property {boolean}         [preserveStructure] - Preserve structural elements (headings, bullets, steps).
 * @property {boolean}         hardSafety        - Hard safety mode (always true).
 */

/**
 * Predefined polish profiles keyed by genre / document type.
 *
 * @type {Record<string, PolishProfile>}
 */
const POLISH_PROFILES = {
  fiction: {
    dialogueRepair: true,
    slopReduction: 'high',
    llmSentenceRecast: true,
    polishIntensity: 'high',
    preserveVoice: true,
    hardSafety: true,
    referenceIntegrity: 'auto',
  },

  nonfiction: {
    dialogueRepair: 'auto',
    slopReduction: 'medium',
    llmSentenceRecast: true,
    polishIntensity: 'medium',
    preserveVoice: false,
    hardSafety: true,
    referenceIntegrity: true,
  },

  training_manual: {
    dialogueRepair: 'auto',
    slopReduction: 'low',
    llmSentenceRecast: false,
    polishIntensity: 'low',
    preserveStructure: true,
    hardSafety: true,
    referenceIntegrity: true,
  },

  business_guide: {
    dialogueRepair: 'auto',
    slopReduction: 'medium',
    llmSentenceRecast: false,
    polishIntensity: 'medium',
    preserveStructure: true,
    hardSafety: true,
    referenceIntegrity: true,
  },

  memoir: {
    dialogueRepair: 'auto',
    slopReduction: 'medium',
    llmSentenceRecast: true,
    polishIntensity: 'medium',
    preserveVoice: true,
    hardSafety: true,
    referenceIntegrity: 'auto',
  },

  unknown: {
    dialogueRepair: 'auto',
    slopReduction: 'conservative',
    llmSentenceRecast: false,
    polishIntensity: 'low',
    hardSafety: true,
    referenceIntegrity: 'auto',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the profile key from a project object.
 * Checks `project.genre` first, then `project.type`, falling back to
 * `'unknown'` when neither matches a known profile.
 *
 * @param {Object} project
 * @param {string} [project.genre]
 * @param {string} [project.type]
 * @returns {string} A key into {@link POLISH_PROFILES}.
 */
function _resolveProfileKey(project) {
  if (!project) return 'unknown';

  const genre = typeof project.genre === 'string'
    ? project.genre.toLowerCase().replace(/[\s-]+/g, '_')
    : null;

  const type = typeof project.type === 'string'
    ? project.type.toLowerCase().replace(/[\s-]+/g, '_')
    : null;

  // Alias mapping for common genre/type variants
  const ALIASES = {
    training: 'training_manual',
    manual: 'training_manual',
    business: 'business_guide',
    guide: 'business_guide',
    novel: 'fiction',
    short_story: 'fiction',
    anthology: 'fiction',
    sci_fi: 'fiction',
    thriller: 'fiction',
    horror: 'fiction',
    investigative_journalism: 'nonfiction',
    history: 'nonfiction',
    biography: 'nonfiction',
    religious_historical_fiction: 'fiction',
    caregiving: 'training_manual',
  };

  // Direct match
  if (genre && POLISH_PROFILES[genre]) return genre;
  if (type && POLISH_PROFILES[type]) return type;

  // Alias match
  if (genre && ALIASES[genre]) return ALIASES[genre];
  if (type && ALIASES[type]) return ALIASES[type];

  // Combined genre+type match
  const combined = [genre, type].filter(Boolean).join('_');
  if (POLISH_PROFILES[combined]) return combined;
  if (ALIASES[combined]) return ALIASES[combined];

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the full {@link PolishProfile} for a project.
 *
 * Resolution order: `project.genre` → `project.type` → `'unknown'`.
 *
 * @param {Object} project
 * @param {string} [project.genre]
 * @param {string} [project.type]
 * @returns {PolishProfile}
 */
function getPolishProfileForProject(project) {
  const key = _resolveProfileKey(project);
  return { ...POLISH_PROFILES[key] };
}

/**
 * Return slop budgets adjusted by the project's profile.
 *
 * Higher-intensity profiles get larger budgets (more aggressive reduction);
 * conservative profiles get the smallest budgets to minimise risk.
 *
 * @param {Object} project
 * @returns {{ maxSlopPerChapter: number, maxSlopPerParagraph: number, intensity: string }}
 */
function getSlopBudgetsForProject(project) {
  const profile = getPolishProfileForProject(project);

  /** @type {Record<string, { maxSlopPerChapter: number, maxSlopPerParagraph: number }>} */
  const budgetsByIntensity = {
    high:         { maxSlopPerChapter: 20, maxSlopPerParagraph: 5 },
    medium:       { maxSlopPerChapter: 12, maxSlopPerParagraph: 3 },
    low:          { maxSlopPerChapter: 6,  maxSlopPerParagraph: 2 },
    conservative: { maxSlopPerChapter: 3,  maxSlopPerParagraph: 1 },
  };

  const budgets = budgetsByIntensity[profile.slopReduction] || budgetsByIntensity.conservative;

  return {
    ...budgets,
    intensity: profile.slopReduction,
  };
}

/**
 * Return safety thresholds for the project.
 *
 * Safety thresholds are always strict regardless of profile — every profile
 * sets `hardSafety: true`.
 *
 * @param {Object} project
 * @returns {{ hardSafety: boolean, blockUnsafeRewrites: boolean, requireReviewAboveThreshold: boolean, maxUnsafeTokenRatio: number }}
 */
function getSafetyThresholdsForProject(project) {
  // Always strict, irrespective of profile.
  return {
    hardSafety: true,
    blockUnsafeRewrites: true,
    requireReviewAboveThreshold: true,
    maxUnsafeTokenRatio: 0.0,
  };
}

/**
 * Determine whether dialogue repair should run for the given chapter text.
 *
 * When the profile sets `dialogueRepair: true` we always run it.
 * When `dialogueRepair: 'auto'` we detect dialogue heuristically:
 *
 * 1. A closing straight or curly quote followed by a space and a dialogue
 *    verb (e.g. `" said`, `\u201d whispered`).
 * 2. An opening straight or curly quote at the start of a paragraph
 *    (beginning of text or after a blank line).
 *
 * Character names are intentionally **not** used for detection.
 *
 * @param {string}  chapterText - The full text of the chapter.
 * @param {Object}  project
 * @returns {boolean}
 */
function shouldRunDialogueRepair(chapterText, project) {
  const profile = getPolishProfileForProject(project);

  // Explicit boolean overrides detection.
  if (profile.dialogueRepair === true) return true;
  if (profile.dialogueRepair === false) return false;

  // 'auto' — detect dialogue in the text.
  if (!chapterText || typeof chapterText !== 'string') return false;

  const verbAlternation = DIALOGUE_VERBS.join('|');

  // Pattern 1: closing quote + space + dialogue verb
  // Matches straight `"` and right-curly `\u201d` closing quotes.
  const closingQuoteVerb = new RegExp(
    `["\u201d]\\s+(?:${verbAlternation})\\b`,
    'i',
  );
  if (closingQuoteVerb.test(chapterText)) return true;

  // Pattern 2: opening quote at the start of a paragraph.
  // A paragraph starts at the very beginning of text or after a newline
  // (possibly preceded by another newline / whitespace).
  const paragraphOpenQuote = /(?:^|(?:\r?\n\s*\r?\n)\s*)["\u201c]/m;
  if (paragraphOpenQuote.test(chapterText)) return true;

  return false;
}

/**
 * Determine whether AI slop reduction should run for a project.
 *
 * Returns `true` for any profile whose `slopReduction` level is not
 * `'conservative'` — conservative profiles opt out to minimise risk.
 *
 * @param {Object} project
 * @returns {boolean}
 */
function shouldRunAISlopReduction(project) {
  const profile = getPolishProfileForProject(project);
  return profile.slopReduction !== 'conservative';
}

/**
 * Determine whether LLM sentence recasting should run.
 *
 * Requires **both** the profile to allow it (`llmSentenceRecast: true`)
 * **and** a model to be available in `modelConfig`.
 *
 * @param {Object}  project
 * @param {Object}  [modelConfig]
 * @param {string}  [modelConfig.model]    - Model identifier.
 * @param {boolean} [modelConfig.available] - Whether the model endpoint is reachable.
 * @returns {boolean}
 */
function shouldRunLLMSentenceRecast(project, modelConfig) {
  const profile = getPolishProfileForProject(project);

  if (!profile.llmSentenceRecast) return false;

  // A usable model must be specified and marked available.
  if (!modelConfig) return false;
  if (!modelConfig.model) return false;
  if (modelConfig.available === false) return false;

  return true;
}

/**
 * Return the allowed polish intensity for a project.
 *
 * @param {Object} project
 * @returns {'high'|'medium'|'low'|'conservative'}
 */
function getAllowedPolishIntensity(project) {
  const profile = getPolishProfileForProject(project);
  return profile.polishIntensity;
}

/**
 * Determine whether the reference integrity gate should run.
 *
 * When the profile sets `referenceIntegrity: true` (nonfiction, training_manual,
 * business_guide), the gate always runs.
 * When `referenceIntegrity: 'auto'` (fiction, memoir, unknown), the gate runs
 * only when reference sections or inline citations are detected in the text.
 * When `referenceIntegrity: false`, the gate is skipped.
 *
 * @param {string}  text    - The full manuscript text to check.
 * @param {Object}  project
 * @returns {boolean}
 */
function shouldRunReferenceIntegrity(text, project) {
  const profile = getPolishProfileForProject(project);

  // Explicit boolean overrides detection.
  if (profile.referenceIntegrity === true) return true;
  if (profile.referenceIntegrity === false) return false;

  // 'auto' — detect reference content in the text.
  if (!text || typeof text !== 'string') return false;

  const sections = detectReferenceSections(text);
  if (sections.length > 0) return true;

  const citations = extractInlineCitations(text);
  if (citations.length > 0) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  POLISH_PROFILES,
  getPolishProfileForProject,
  getSlopBudgetsForProject,
  getSafetyThresholdsForProject,
  shouldRunDialogueRepair,
  shouldRunAISlopReduction,
  shouldRunLLMSentenceRecast,
  getAllowedPolishIntensity,
  shouldRunReferenceIntegrity,
};
