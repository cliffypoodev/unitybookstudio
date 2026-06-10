/**
 * Utilities for handling large seed_concept content that may exceed entity field size limits.
 * Mirrors the same upload-then-URL pattern used in chapterStorage.js.
 */
import { base44 } from '@/api/base44Client';

const MAX_INLINE_SIZE = 10000;

/**
 * Uploads content to GitHub via the uploadToGitHub backend function.
 */
async function uploadViaGitHub(content, projectId) {
  try {
    const response = await base44.functions.invoke('uploadToGitHub', {
      content,
      projectId: projectId || 'default',
      chapterId: 'seed-concept',
      filename: `seed-concept-${projectId || Date.now()}`,
    });
    const data = response.data || response;
    if (data.error) {
      console.warn('[SEED-STORAGE] GitHub upload returned error:', data.error);
      return null;
    }
    if (data.file_url) {
      console.log(`[SEED-STORAGE] Uploaded to GitHub: ${data.file_url}`);
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[SEED-STORAGE] GitHub upload failed:', err?.message || 'unknown');
    return null;
  }
}

/**
 * Prepares seed_concept for saving to a NovelProject entity.
 * If small enough, saves inline. If too large, uploads to GitHub and returns the URL.
 *
 * @param {string} content - The seed concept content
 * @param {string} [projectId] - Project ID for organizing files
 * @returns {Promise<{seed_concept: string, seed_concept_url: string}>}
 */
export async function prepareSeedConcept(content, projectId) {
  if (!content || content.length <= MAX_INLINE_SIZE) {
    return { seed_concept: content || '', seed_concept_url: '' };
  }

  // Content is too large — upload to GitHub
  const result = await uploadViaGitHub(content, projectId);
  if (result?.file_url) {
    // Store a truncated preview inline + the full URL
    return {
      seed_concept: content.slice(0, 500) + '\n\n[Full concept stored externally]',
      seed_concept_url: result.file_url,
    };
  }

  // GitHub upload failed — truncate as last resort
  console.warn('[SEED-STORAGE] Upload failed. Truncating to ' + MAX_INLINE_SIZE + ' chars.');
  return {
    seed_concept: content.slice(0, MAX_INLINE_SIZE),
    seed_concept_url: '',
  };
}

/**
 * Resolves the full seed_concept content from a project, fetching from URL if needed.
 *
 * @param {object} project - NovelProject entity record
 * @returns {Promise<string>} The full seed concept content
 */
export async function resolveSeedConcept(project) {
  if (!project) return '';

  // If there's a URL, fetch the full content via local proxy (CSP blocks direct fetch)
  if (project.seed_concept_url) {
    try {
      const response = await base44.functions.invoke('fetchFromGitHub', {
        url: project.seed_concept_url,
        file_url: project.seed_concept_url,
        raw_url: project.seed_concept_url,
      });
      const data = response?.data || response || {};
      const text = data?.content || data?.result?.content || '';
      if (text && text.length > 50) return text;
    } catch (e) {
      console.warn('[SEED-STORAGE] Failed to fetch seed_concept_url:', e?.message);
    }
  }

  // Fall back to inline content
  return project.seed_concept || '';
}