/**
 * Utilities for handling large research content that may exceed entity field size limits.
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
      chapterId: 'research',
      filename: `research-${projectId || Date.now()}`,
    });
    const data = response.data || response;
    if (data.error) {
      console.warn('[RESEARCH-STORAGE] GitHub upload returned error:', data.error);
      return null;
    }
    if (data.file_url) {
      console.log(`[RESEARCH-STORAGE] Uploaded to GitHub: ${data.file_url}`);
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[RESEARCH-STORAGE] GitHub upload failed:', err?.message || 'unknown');
    return null;
  }
}

/**
 * Prepares research_md for saving to a NovelProject entity.
 * If small enough, saves inline. If too large, uploads to GitHub and returns the URL.
 *
 * @param {string} content - The research markdown content
 * @param {string} [projectId] - Project ID for organizing files
 * @returns {Promise<{research_md: string, research_md_url: string}>}
 */
export async function prepareResearchContent(content, projectId) {
  if (!content || content.length <= MAX_INLINE_SIZE) {
    return { research_md: content || '', research_md_url: '' };
  }

  // Content is too large — upload to GitHub
  const result = await uploadViaGitHub(content, projectId);
  if (result?.file_url) {
    return {
      research_md: content.slice(0, 500) + '\n\n[Full research stored externally]',
      research_md_url: result.file_url,
    };
  }

  // GitHub upload failed — truncate as last resort
  console.warn('[RESEARCH-STORAGE] Upload failed. Truncating to ' + MAX_INLINE_SIZE + ' chars.');
  return {
    research_md: content.slice(0, MAX_INLINE_SIZE),
    research_md_url: '',
  };
}

/**
 * Resolves the actual research content from a project, fetching from URL if needed.
 *
 * @param {object} project - NovelProject entity record
 * @returns {Promise<string>} The full research markdown content
 */
export async function resolveResearchContent(project) {
  if (!project) return '';

  // Prefer URL — it has the most recently saved full version
  if (project.research_md_url) {
    try {
      // Use the local base44Client proxy instead of direct fetch (CSP blocks direct).
      const response = await base44.functions.invoke('fetchFromGitHub', {
        url: project.research_md_url,
        file_url: project.research_md_url,
        raw_url: project.research_md_url,
      });
      const data = response?.data || response || {};
      const text = data?.content || data?.result?.content || '';
      if (text && text.length > 50) return text;
    } catch (e) {
      console.warn('[RESEARCH-STORAGE] Failed to fetch research_md_url:', e?.message);
    }
  }

  // Fall back to inline content
  if (project.research_md) return project.research_md;

  return '';
}

/**
 * Checks if a project has any research content (inline or via URL).
 */
export function projectHasResearch(project) {
  return !!(project?.research_md || project?.research_md_url);
}