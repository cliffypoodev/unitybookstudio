/**
 * Utilities for handling large foundation fields (outline_md, characters_md, world_md, etc.)
 * that may exceed Base44 entity field limits.
 *
 * v2.1 — GitHub-backed foundation storage
 * - Uploads oversized foundation markdown to GitHub through uploadToGitHub.
 * - Stores the returned raw URL in <field>_url.
 * - Clears the oversized inline field so NovelProject.update() does not 400.
 * - Resolves URL-backed fields through the Base44 fetchFromGitHub proxy first.
 * - Keeps small fields inline for speed.
 */
import { base44 } from '@/api/base44Client';

const FOUNDATION_STORAGE_VERSION = 'foundationStorage-v2.1-github-large-field-safe';

console.log(`[FOUNDATION-STORAGE] Loaded ${FOUNDATION_STORAGE_VERSION}`);

// Keep this comfortably below the Base44 text-field ceiling.
const MAX_INLINE_SIZE = 9000;

// Fields that may overflow and have corresponding *_url fields on NovelProject.
const OVERFLOWABLE_FIELDS = [
  'outline_md',
  'characters_md',
  'world_md',
  'canon_md',
  'voice_md',
  'mystery_md',
  'twists_md',
  'research_md',
];

function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{5,}/g, '\n\n\n')
    .trim();
}

function countWords(text) {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  return normalized.split(/\s+/).filter(Boolean).length;
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function makeSafeId(value, fallback = 'foundation') {
  const cleaned = String(value || fallback)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
  return cleaned || fallback;
}

function makeUniqueUploadFilename(field, projectId) {
  const safeField = makeSafeId(field || 'foundation', 'foundation');
  const safeProjectId = makeSafeId(projectId || 'project', 'project');
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);
  return `foundation-${safeField}-${safeProjectId}-${stamp}-${random}`;
}

function extractProxyText(response) {
  const data = response?.data || response || {};
  return normalizeText(
    data.text ??
    data.content ??
    data.body ??
    data.result?.text ??
    data.result?.content ??
    ''
  );
}

async function fetchTextViaBackendProxy(url, label = 'foundation') {
  if (!url) return '';
  try {
    const response = await base44.functions.invoke('fetchFromGitHub', {
      url,
      file_url: url,
      raw_url: url,
    });
    const text = extractProxyText(response);
    if (text) return text;
  } catch (error) {
    console.warn(`[FOUNDATION-STORAGE] Proxy fetch failed for ${label}:`, error?.message || String(error));
  }
  return '';
}

async function fetchTextDirect(url, label = 'foundation') {
  if (!url) return '';
  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}_t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
    if (!response.ok) {
      console.warn(`[FOUNDATION-STORAGE] Direct fetch failed for ${label}: HTTP ${response.status}`);
      return '';
    }
    return normalizeText(await response.text());
  } catch (error) {
    console.warn(`[FOUNDATION-STORAGE] Direct fetch failed for ${label}:`, error?.message || String(error));
    return '';
  }
}

async function uploadFoundationField(content, projectId, field) {
  const normalized = normalizeText(content);
  if (!normalized) return null;

  const filename = makeUniqueUploadFilename(field, projectId);
  const payload = {
    content: normalized,
    projectId: projectId || 'foundation',
    chapterId: field || 'foundation',
    filename,
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await base44.functions.invoke('uploadToGitHub', payload);
      const data = response?.data || response || {};

      if (data.error) {
        console.warn(`[FOUNDATION-STORAGE] GitHub upload returned error for ${field}:`, data.error);
        if (attempt < 2 && /409|conflict/i.test(String(data.error))) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }
        return null;
      }

      if (data.file_url) {
        console.log(`[FOUNDATION-STORAGE] Uploaded ${field} to GitHub: ${data.file_url}`, {
          chars: normalized.length,
          words: countWords(normalized),
          filename,
          path: data.path || '',
        });
        return { ...data, filename };
      }
    } catch (error) {
      const status = error?.response?.status || error?.status;
      console.warn(`[FOUNDATION-STORAGE] GitHub upload failed for ${field}:`, error?.message || String(error));
      if (attempt < 2 && (status === 409 || /409|conflict/i.test(error?.message || ''))) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        continue;
      }
      return null;
    }
  }

  return null;
}

function getPayloadProjectId(payload = {}) {
  return (
    payload.id ||
    payload.project_id ||
    payload.projectId ||
    payload.novel_project_id ||
    makeSafeId(payload.title || 'foundation-project', 'foundation-project')
  );
}

/**
 * Prepares a NovelProject save payload.
 * Oversized foundation fields are uploaded to GitHub and stored as *_url fields.
 * This prevents Base44 400 errors such as:
 * "Field 'outline_md' exceeds the maximum allowed size."
 */
export async function prepareFoundationPayload(payload = {}) {
  const next = { ...payload };
  const projectId = getPayloadProjectId(next);

  for (const field of OVERFLOWABLE_FIELDS) {
    const urlField = `${field}_url`;
    const text = normalizeText(next[field]);

    // If the field itself somehow already contains a URL, normalize it into *_url.
    if (isUrl(text)) {
      next[urlField] = text;
      next[field] = '';
      continue;
    }

    if (!text) {
      // Do not erase an existing URL unless caller explicitly supplied a new inline value.
      if (next[urlField]) next[urlField] = String(next[urlField] || '').trim();
      continue;
    }

    if (text.length <= MAX_INLINE_SIZE) {
      next[field] = text;
      // Keep any old URL only if caller explicitly supplied it. For fresh inline content,
      // clear stale URLs so the inline field is the source of truth.
      if (!payload[urlField]) next[urlField] = '';
      continue;
    }

    const uploaded = await uploadFoundationField(text, projectId, field);
    if (!uploaded?.file_url) {
      const existingUrl = payload[urlField] || next[urlField] || '';
      if (existingUrl) {
        console.warn(`[FOUNDATION-STORAGE] Upload failed for ${field}; preserving existing ${urlField}.`);
        next[field] = '';
        next[urlField] = existingUrl;
        next[`${field}_upload_failed`] = true;
        next.foundation_storage_version = FOUNDATION_STORAGE_VERSION;
        continue;
      }

      throw new Error(`Could not upload oversized foundation field '${field}'. Save blocked to avoid Base44 field-size failure.`);
    }

    next[field] = '';
    next[urlField] = uploaded.file_url;
    next[`${field}_uploaded_at`] = new Date().toISOString();
    next[`${field}_storage_path`] = uploaded.path || '';
    next[`${field}_storage_sha`] = uploaded.sha || '';
    next[`${field}_storage_filename`] = uploaded.filename || '';
    next[`${field}_word_count`] = countWords(text);
    next[`${field}_char_count`] = text.length;
    next[`${field}_upload_failed`] = false;
    next.foundation_storage_version = FOUNDATION_STORAGE_VERSION;
  }

  return next;
}

/**
 * Resolves a foundation field value, fetching from URL if needed.
 */
export async function resolveFoundationField(project, field) {
  if (!project) return '';

  const inline = normalizeText(project[field]);
  if (inline && !isUrl(inline)) return inline;

  const url = isUrl(inline) ? inline : String(project[`${field}_url`] || '').trim();
  if (!url) return '';

  const viaProxy = await fetchTextViaBackendProxy(url, field);
  if (viaProxy) return viaProxy;

  console.warn(`[FOUNDATION-STORAGE] Proxy fetch empty for ${field}; direct fetch skipped (CSP blocked)`);
  return '';
}

/**
 * Resolves all overflowable foundation fields for a project.
 */
export async function resolveAllFoundationFields(project) {
  if (!project) return {};

  const resolved = {};
  for (const field of OVERFLOWABLE_FIELDS) {
    resolved[field] = await resolveFoundationField(project, field);
  }
  return resolved;
}
