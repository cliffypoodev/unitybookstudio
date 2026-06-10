/**
 * Cover Variation Manager — in-memory + localStorage cover variation management.
 *
 * A "variation" is a saved cover generation result with all its metadata:
 * image URL, prompt/model settings, typography, and timestamps.
 *
 * Variations are stored per-project in localStorage as JSON arrays.
 * Pure helper functions (create, duplicate, update, buildMetadata) work
 * without localStorage and are safe to call server-side or in tests.
 *
 * USAGE
 *   const v = createCoverVariation({ imageUrl, metadata, name: 'Dark Theme' });
 *   saveProjectVariations(projectId, [v]);
 *   const all = getProjectVariations(projectId);
 */

/** @type {string} localStorage key prefix */
export const VARIATION_STORAGE_KEY = 'ubs_cover_variations_';

/** Internal counter for default naming within a session */
let _variationCounter = 0;

/**
 * Create a new cover variation.
 * @param {Object} params
 * @param {string} params.imageUrl - URL or data URL of the cover image
 * @param {Object} params.metadata - Generation metadata
 * @param {string} params.metadata.prompt
 * @param {string} params.metadata.negativePrompt
 * @param {string} params.metadata.modelPipeline - 'flux' | 'ponyxl'
 * @param {string} params.metadata.checkpoint
 * @param {number} params.metadata.seed
 * @param {string} params.metadata.sizePreset
 * @param {number} params.metadata.width
 * @param {number} params.metadata.height
 * @param {string} params.metadata.genreTemplate
 * @param {Object} [params.typographySettings]
 * @param {string} [params.name] - User-given name, defaults to 'Variation N'
 * @returns {{ id: string, name: string, imageUrl: string, metadata: Object, typographySettings: Object|null, createdAt: string, isActive: boolean }}
 */
export function createCoverVariation({ imageUrl, metadata, typographySettings, name }) {
  _variationCounter += 1;
  return {
    id: crypto.randomUUID(),
    name: name || `Variation ${_variationCounter}`,
    imageUrl,
    metadata: { ...metadata },
    typographySettings: typographySettings || null,
    createdAt: new Date().toISOString(),
    isActive: false,
  };
}

/**
 * Duplicate a variation with a new ID.
 * The copy gets a "(Copy)" suffix on its name, a fresh ID, and a new timestamp.
 * @param {Object} variation - The variation to duplicate
 * @returns {Object} A new variation object
 */
export function duplicateCoverVariation(variation) {
  return {
    ...variation,
    id: crypto.randomUUID(),
    name: `${variation.name} (Copy)`,
    metadata: { ...variation.metadata },
    typographySettings: variation.typographySettings
      ? { ...variation.typographySettings }
      : null,
    createdAt: new Date().toISOString(),
    isActive: false,
  };
}

/**
 * Update fields on a variation. Returns a new object — does not mutate.
 * The `id` and `createdAt` fields are never overwritten.
 * @param {Object} variation - The variation to update
 * @param {Object} updates - Fields to merge
 * @returns {Object} Updated variation
 */
export function updateCoverVariation(variation, updates) {
  return {
    ...variation,
    ...updates,
    // Guard immutable identity fields
    id: variation.id,
    createdAt: variation.createdAt,
  };
}

/**
 * Get all variations for a project from localStorage.
 * Returns an empty array if nothing is stored or localStorage is unavailable.
 * @param {string} projectId
 * @returns {Array<Object>}
 */
export function getProjectVariations(projectId) {
  try {
    const raw = localStorage.getItem(`${VARIATION_STORAGE_KEY}${projectId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save variations array for a project to localStorage.
 * @param {string} projectId
 * @param {Array<Object>} variations
 */
export function saveProjectVariations(projectId, variations) {
  try {
    localStorage.setItem(
      `${VARIATION_STORAGE_KEY}${projectId}`,
      JSON.stringify(variations),
    );
  } catch (err) {
    console.warn('[COVER-VARIATION] Failed to save variations:', err?.message);
  }
}

/**
 * Select a variation as the active cover.
 * Sets `isActive = true` on the target and `isActive = false` on all others,
 * then persists the updated array to localStorage.
 * @param {string} projectId
 * @param {string} variationId
 * @returns {Array<Object>} The updated variations array
 */
export function selectActiveCoverVariation(projectId, variationId) {
  const variations = getProjectVariations(projectId);
  const updated = variations.map((v) => ({
    ...v,
    isActive: v.id === variationId,
  }));
  saveProjectVariations(projectId, updated);
  return updated;
}

/**
 * Delete a variation from a project's stored list.
 * @param {string} projectId
 * @param {string} variationId
 * @returns {Array<Object>} The remaining variations
 */
export function deleteCoverVariation(projectId, variationId) {
  const variations = getProjectVariations(projectId);
  const remaining = variations.filter((v) => v.id !== variationId);
  saveProjectVariations(projectId, remaining);
  return remaining;
}

/**
 * Build metadata snapshot from current generation settings.
 * Extracts the fields that fully describe how a cover was generated.
 * @param {Object} project - The current project
 * @param {Object} settings - Current generation settings
 * @returns {Object} Metadata snapshot
 */
export function buildCoverVariationMetadata(project, settings) {
  return {
    prompt: settings.prompt || '',
    negativePrompt: settings.negativePrompt || '',
    modelPipeline: settings.modelPipeline || '',
    checkpoint: settings.checkpoint || '',
    seed: settings.seed ?? -1,
    sizePreset: settings.sizePreset || '',
    width: settings.width || 0,
    height: settings.height || 0,
    genreTemplate: settings.genreTemplate || '',
    projectGenre: project.genre || '',
    projectTitle: project.title || '',
  };
}
