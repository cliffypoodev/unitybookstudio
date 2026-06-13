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
 * If small enough, saves inline. If too large, uploads via GitHub/local store and returns the URL.
 * CRITICAL: Always preserves the FULL text inline as a fallback to avoid silent 500-char truncations.
 *
 * @param {string} content - The research markdown content
 * @param {string} [projectId] - Project ID for organizing files
 * @returns {Promise<{research_md: string, research_md_url: string}>}
 */
export async function prepareResearchContent(content, projectId) {
  if (!content || content.length <= MAX_INLINE_SIZE) {
    return { research_md: content || '', research_md_url: '' };
  }

  // Content is too large — upload to local/GitHub store
  const result = await uploadViaGitHub(content, projectId);
  if (result?.file_url) {
    return {
      // Correctness beats inline-size optimization. Store the full text inline.
      // Do NOT reduce research_md to a 500-char stub that becomes a silent fallback.
      research_md: content,
      research_md_url: result.file_url,
    };
  }

  // GitHub/local upload failed — store full text inline rather than a truncated preview
  console.warn('[RESEARCH-STORAGE] Upload failed. Storing FULL text inline anyway.');
  return {
    research_md: content,
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

/**
 * Detects if a project suffers from the truncated-research bug (a dead URL + truncated inline fallback).
 * Existing projects (like Juneteenth) have a dead research_md_url and a truncated research_md.
 * Returns { isTruncated: boolean, reason: string }
 */
export async function checkResearchIntegrity(project) {
  if (!project) return { isTruncated: false, reason: '' };

  const url = project.research_md_url;
  const inline = project.research_md || '';

  if (!url) return { isTruncated: false, reason: '' }; // No URL -> relies purely on inline

  // It has a URL. Check if inline is clearly truncated.
  // The old code stored the first 500 chars + '\n\n[Full research stored externally]'
  const hasTruncationMarker = inline.includes('[Full research stored externally]');
  const isSuspiciouslyShort = inline.length > 0 && inline.length < 600;

  // Only run the fetch check if the inline content actually looks truncated.
  // If the inline content is long (e.g. 50,000 chars), then even if the URL is dead,
  // we have the full text, so we're safe.
  if (!hasTruncationMarker && !isSuspiciouslyShort) {
    return { isTruncated: false, reason: '' };
  }

  // URL exists, and inline text is a stub. We MUST be able to resolve the URL.
  let fetchedText = '';
  try {
    const response = await base44.functions.invoke('fetchFromGitHub', {
      url: url, file_url: url, raw_url: url,
    });
    const data = response?.data || response || {};
    fetchedText = data?.content || data?.result?.content || '';
  } catch (e) {
    console.warn('[RESEARCH-STORAGE] Integrity check failed to fetch research_md_url:', e?.message);
  }

  if (fetchedText && fetchedText.length > 50) {
    return { isTruncated: false, reason: '' }; // URL resolves perfectly
  }

  // 💥 URL is dead/empty AND the fallback is a truncated stub.
  console.error(`[RESEARCH-STORAGE] ERROR: Project ${project.id || 'unknown'} has an unresolvable research URL (${url}) AND a truncated inline fallback. Nonfiction drafts will be low quality until research is re-run.`);
  return { 
    isTruncated: true, 
    reason: 'External research URL is unresolvable and the local fallback is a truncated preview stub.' 
  };
}