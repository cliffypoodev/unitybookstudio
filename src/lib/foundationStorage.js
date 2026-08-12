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
// RESEARCHQUALITY-2B: fields listed here are NEVER blanked into a *_url by
// prepareFoundationPayload. They stay in OVERFLOWABLE_FIELDS so URL-backed
// legacy records still hydrate on read; only the offload-and-blank is retired.
const INLINE_ALWAYS_FIELDS = ['research_md'];

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

/**
 * STOREDEDUPE-1 — a content fingerprint, so an unchanged field is not re-uploaded.
 *
 * MEASURED on the live store, 2026-08-04:
 *
 *   entries                      3,770
 *   total content               80.9 MB
 *   unique content              24.1 MB
 *   byte-identical duplicates   56.8 MB  (70%)
 *   one 38 KB research_md blob stored 324 times = 12.0 MB
 *
 * prepareFoundationPayload uploaded a NEW timestamped blob every time a payload
 * carried an oversized field, whether or not the text had changed. Combined with
 * the save-triggered reload loop (WATCHLOOP-1) the store grew without bound, and
 * every load now parses 87 MB of JSON to reach 24 MB of content.
 *
 * Web Crypto is deliberately NOT used: crypto.subtle requires a secure context and
 * Cliff reaches this app over http on a LAN address, where it is undefined. This is
 * FNV-1a 64-bit, computed in two 32-bit halves so it stays exact in doubles, and it
 * is paired with the exact byte length. A false "unchanged" verdict would need two
 * different documents of IDENTICAL length to collide on 64 bits; the fingerprint is
 * recorded on the payload so the decision is always auditable.
 */
export function foundationContentHash(text) {
  const str = String(text == null ? '' : text);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  return `len${str.length}-fnv${hex}`;
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

/**
 * STOREDEDUPE-1 — blobs are namespaced by PROJECT ID, never by a title.
 *
 * The old fallback chain ended in `makeSafeId(payload.title || 'foundation-project')`,
 * so a payload with no id was filed under a slug of its title, and a payload with
 * neither was filed under the literal string "foundation-project". Measured on the
 * live store: 1,308 of 3,770 entries (35%) sit under that placeholder, and the SAME
 * 13,841-char characters document was written twice 75 seconds apart - once under
 * "The-Gilded-Hour" and once under "foundation-project" - because two call sites
 * disagreed about whether a title was present.
 *
 * A title is not an identity: two books may share one, and one book's title may
 * change. When no id is available the namespace is explicitly "unknown-project" and
 * it is announced, so the condition is visible instead of silently minting a new
 * namespace per title.
 */
function getPayloadProjectId(payload = {}, explicitId = '') {
  // STOREDEDUPE-2: the caller knows the id — it calls NovelProject.update(project.id, ...)
  // on the very next line — but all three call sites passed only the field payload,
  // which carries no id. Measured live 2026-08-04: saving the character sheet logged
  // "no project id (title: null)" and filed the blob under "unknown-project". An
  // explicit parameter is used rather than injecting id into the payload, because the
  // payload becomes the update BODY and must not carry an id field.
  const id = explicitId
    || payload.id || payload.project_id || payload.projectId || payload.novel_project_id;
  if (id) return makeSafeId(id, 'unknown-project');
  console.warn(
    '[STOREDEDUPE-1] foundation payload has no project id '
    + `(title: ${JSON.stringify(payload.title || null)}); filing blobs under "unknown-project". `
    + 'The caller should pass the project id.',
  );
  return 'unknown-project';
}

/**
 * Prepares a NovelProject save payload.
 * Oversized foundation fields are uploaded to GitHub and stored as *_url fields.
 * This prevents Base44 400 errors such as:
 * "Field 'outline_md' exceeds the maximum allowed size."
 */
export async function prepareFoundationPayload(payload = {}, projectIdOverride = '') {
  const next = { ...payload };
  const projectId = getPayloadProjectId(next, projectIdOverride); // STOREDEDUPE-2

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

    // RESEARCHQUALITY-2B: research evidence is never blanked out of the record.
    // The closed-world gates (buildFactLedger, closedWorldCheck) read
    // project.research_md RAW; offload-and-blank thinned the polish/export
    // closed world (measured live 2026-08-08: flagship fate attestation 2/31
    // raw vs 14/31 with the brief; the Molasses record was re-blanked the same
    // day by a bible save). The local server store has no field-size ceiling
    // (research_data 23,758 chars lives inline on the flagship record).
    // researchStorage.prepareResearchContent owns research_md sizing.
    if (INLINE_ALWAYS_FIELDS.includes(field)) {
      next[field] = text;
      continue;
    }

    if (text.length <= MAX_INLINE_SIZE) {
      next[field] = text;
      // Keep any old URL only if caller explicitly supplied it. For fresh inline content,
      // clear stale URLs so the inline field is the source of truth.
      if (!payload[urlField]) next[urlField] = '';
      continue;
    }

    // STOREDEDUPE-1: identical content already stored -> keep the blob, skip the write.
    const hash = foundationContentHash(text);
    const priorHash = payload[`${field}_storage_hash`] || next[`${field}_storage_hash`] || '';
    const priorUrl = payload[urlField] || next[urlField] || '';
    if (priorUrl && priorHash && priorHash === hash) {
      console.log(
        `[STOREDEDUPE-1] ${field} unchanged (${text.length} chars, ${hash}) - reusing the stored blob, no upload`,
      );
      next[field] = '';
      next[urlField] = priorUrl;
      next[`${field}_storage_hash`] = hash;
      next[`${field}_word_count`] = countWords(text);
      next[`${field}_char_count`] = text.length;
      next[`${field}_upload_failed`] = false;
      next.foundation_storage_version = FOUNDATION_STORAGE_VERSION;
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
    next[`${field}_storage_hash`] = hash; // STOREDEDUPE-1
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
