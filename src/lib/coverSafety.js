/**
 * coverSafety.js — Cover art generation safety constraints
 *
 * Ensures generated cover prompts are appropriate for the project type,
 * genre, and audience. Adds mandatory safety negatives and validates
 * prompt content.
 *
 * @module coverSafety
 */

// ─── Safety Rules ─────────────────────────────────────────────────────────

const CHILDREN_BLOCKED_TERMS = [
  'gore', 'blood', 'violent', 'death', 'murder', 'weapon', 'knife', 'gun',
  'corpse', 'body', 'horror', 'terrifying', 'nightmare', 'demon',
  'nsfw', 'explicit', 'nude', 'nudity', 'sexual', 'erotic', 'sensual',
  'drugs', 'alcohol', 'smoking', 'addiction',
  'torture', 'abuse', 'suicide', 'self-harm',
];

const ADULT_ONLY_GENRES = ['erotica', 'dark erotica'];

const CHILDREN_GENRES = [
  'children', 'middle grade', 'mg', 'chapter book',
  'kids', 'juvenile fiction', 'picture book', 'young reader',
];

// ─── Core Functions ───────────────────────────────────────────────────────

/**
 * Build safety constraints for a project.
 *
 * @param {Object} project - Project data (genre, book_type, etc.)
 * @param {Object} [settings] - Generation settings
 * @returns {{ isChildSafe: boolean, isAdultOnly: boolean, mandatoryNegatives: string[], blockedTerms: string[], safetyLevel: string }}
 */
export function buildCoverSafetyConstraints(project, settings = {}) {
  const genre = `${project?.genre || ''} ${project?.subgenre || ''}`.toLowerCase();
  const bookType = (project?.book_type || '').toLowerCase();

  const isChildSafe = CHILDREN_GENRES.some(cg => genre.includes(cg) || bookType.includes(cg));
  const isAdultOnly = ADULT_ONLY_GENRES.some(ag => genre.includes(ag));

  let safetyLevel = 'standard';
  const mandatoryNegatives = [];
  const blockedTerms = [];

  if (isChildSafe) {
    safetyLevel = 'children';
    mandatoryNegatives.push(
      'nsfw', 'explicit', 'nudity', 'sexual', 'violence', 'gore', 'blood',
      'weapons', 'death', 'horror', 'scary', 'dark themes', 'alcohol', 'drugs',
      'smoking', 'abuse', 'self-harm',
    );
    blockedTerms.push(...CHILDREN_BLOCKED_TERMS);
  } else if (isAdultOnly) {
    safetyLevel = 'adult';
    // Adult genres: minimal safety constraints, but still no illegal content
    mandatoryNegatives.push('child', 'minor', 'underage');
  } else {
    // Standard: most genres
    safetyLevel = 'standard';
    mandatoryNegatives.push('nsfw', 'explicit', 'nudity');

    // Business/nonfiction: extra clean
    if (genre.includes('business') || genre.includes('self-help') || genre.includes('nonfiction')) {
      safetyLevel = 'professional';
      mandatoryNegatives.push('violence', 'blood', 'horror', 'dark', 'scary');
    }
  }

  // PonyXL-specific: always add quality guards for non-adult
  if (settings.modelPipeline === 'ponyxl' && !isAdultOnly) {
    if (!mandatoryNegatives.includes('nsfw')) mandatoryNegatives.push('nsfw');
    if (!mandatoryNegatives.includes('explicit')) mandatoryNegatives.push('explicit');
  }

  return {
    isChildSafe,
    isAdultOnly,
    mandatoryNegatives,
    blockedTerms,
    safetyLevel,
  };
}

/**
 * Validate a cover prompt for safety issues.
 *
 * @param {string} prompt - The positive prompt to check
 * @param {Object} project
 * @param {Object} [settings]
 * @returns {{ safe: boolean, issues: string[] }}
 */
export function validateCoverPromptSafety(prompt, project, settings = {}) {
  const constraints = buildCoverSafetyConstraints(project, settings);
  const promptLower = (prompt || '').toLowerCase();
  const issues = [];

  // Check blocked terms for children's content
  if (constraints.isChildSafe) {
    for (const term of constraints.blockedTerms) {
      if (promptLower.includes(term)) {
        issues.push(`Blocked term "${term}" found in prompt (children's content)`);
      }
    }
  }

  // Check for obviously unsafe content in all non-adult genres
  if (!constraints.isAdultOnly) {
    const unsafePatterns = [
      /\bchild\s*(nude|naked|undressed)/i,
      /\bexplicit\s*(sexual|content)/i,
    ];
    for (const pattern of unsafePatterns) {
      if (pattern.test(prompt)) {
        issues.push(`Unsafe pattern detected: ${pattern.source}`);
      }
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}

/**
 * Sanitize a negative prompt by adding mandatory safety negatives.
 *
 * @param {string} negativePrompt - User/template negative prompt
 * @param {Object} project
 * @param {Object} [settings]
 * @returns {string} Sanitized negative prompt
 */
export function sanitizeCoverNegativePrompt(negativePrompt, project, settings = {}) {
  const constraints = buildCoverSafetyConstraints(project, settings);
  const existing = (negativePrompt || '').toLowerCase();
  const parts = [negativePrompt || ''];

  for (const neg of constraints.mandatoryNegatives) {
    if (!existing.includes(neg)) {
      parts.push(neg);
    }
  }

  return parts.filter(Boolean).join(', ');
}
