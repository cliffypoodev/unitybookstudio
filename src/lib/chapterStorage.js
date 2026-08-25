/**
 * Utilities for handling large chapter content that may exceed entity field size limits.
 *
 * When content is too large, it is uploaded to GitHub via the uploadToGitHub backend
 * function and the raw URL is stored on the Chapter entity.
 *
 * Important 2026-05 fixes:
 * - Do NOT keep overwriting the same GitHub raw URL for polished chapter content.
 * - GitHub/raw/CDN can return stale content immediately after overwrite.
 * - Use a unique filename per save so every polished save gets a fresh URL.
 * - Prefer transient polished content if the current browser session has it.
 * - Resolve GitHub raw content through the Base44 backend proxy first to avoid CORS.
 */

import { base44 } from '@/api/base44Client';
import { listFileVersions } from '@/lib/localDB'; // VERSIONS-1B

// Base44 enforces a field size limit on content_md.
// Chapters over this size must be uploaded as files and stored as content_md_url.
const MAX_INLINE_SIZE = 10000;

const CHAPTER_STORAGE_VERSION = 'chapterStorage-v3-proxy-fetch-cache-safe';

console.log(`[CHAPTER-STORAGE] Loaded ${CHAPTER_STORAGE_VERSION}`);

function normalizeText(value) {
  if (value == null) return '';

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function countWords(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function makeSafeId(value, fallback = 'item') {
  const raw = String(value || fallback);
  const cleaned = raw
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return cleaned || fallback;
}

function makeUniqueUploadFilename(prefix, chapterId) {
  const safePrefix = makeSafeId(prefix || 'chapter', 'chapter');
  const safeChapterId = makeSafeId(chapterId || Date.now(), 'chapter');
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8);

  return `${safePrefix}-${safeChapterId}-${stamp}-${random}`;
}

function cacheBustUrl(url, extra = '') {
  if (!url) return '';

  const separator = url.includes('?') ? '&' : '?';
  const bust = `_t=${Date.now()}${extra ? `_${encodeURIComponent(extra)}` : ''}`;

  return `${url}${separator}${bust}`;
}

function looksLikeUsableContent(text) {
  const normalized = normalizeText(text);
  return normalized.length > 50 && countWords(normalized) > 10;
}

function getExpectedMetadata(chapter = {}) {
  const expectedWords = Number(chapter.polish_saved_word_count || chapter.content_md_word_count || 0);
  const expectedChars = Number(chapter.polish_saved_char_count || chapter.content_md_char_count || 0);
  const previewStart = normalizeText(chapter.polish_saved_preview_start || '');
  const previewEnd = normalizeText(chapter.polish_saved_preview_end || '');

  return {
    expectedWords: Number.isFinite(expectedWords) ? expectedWords : 0,
    expectedChars: Number.isFinite(expectedChars) ? expectedChars : 0,
    previewStart,
    previewEnd,
  };
}

function contentLooksStaleAgainstMetadata(text, chapter = {}) {
  const normalized = normalizeText(text);
  const {
    expectedWords,
    expectedChars,
    previewStart,
    previewEnd,
  } = getExpectedMetadata(chapter);

  if (!normalized) return true;

  const actualWords = countWords(normalized);
  const actualChars = normalized.length;

  if (expectedChars > 0) {
    const charDelta = Math.abs(actualChars - expectedChars);
    const charRatio = charDelta / expectedChars;

    if (charRatio > 0.03) {
      console.warn('[CHAPTER-STORAGE] Resolved content char-count mismatch:', {
        actualChars,
        expectedChars,
        charRatio,
      });
      return true;
    }
  }

  if (expectedWords > 0) {
    const wordDelta = Math.abs(actualWords - expectedWords);
    const wordRatio = wordDelta / expectedWords;

    if (wordRatio > 0.03) {
      console.warn('[CHAPTER-STORAGE] Resolved content word-count mismatch:', {
        actualWords,
        expectedWords,
        wordRatio,
      });
      return true;
    }
  }

  if (previewStart && previewStart.length >= 80) {
    const needle = previewStart.slice(0, Math.min(160, previewStart.length)).trim();

    if (needle && !normalized.includes(needle)) {
      console.warn('[CHAPTER-STORAGE] Resolved content does not contain expected start preview.');
      return true;
    }
  }

  if (previewEnd && previewEnd.length >= 80) {
    const needle = previewEnd.slice(Math.max(0, previewEnd.length - 160)).trim();

    if (needle && !normalized.includes(needle)) {
      console.warn('[CHAPTER-STORAGE] Resolved content does not contain expected end preview.');
      return true;
    }
  }

  return false;
}

function extractProxyText(response) {
  const data = response?.data || response || {};

  const text =
    data.text ??
    data.content ??
    data.body ??
    data.result?.text ??
    data.result?.content ??
    '';

  return normalizeText(text);
}

async function fetchTextViaBackendProxy(url, label = 'chapter') {
  if (!url) return '';

  try {
    console.log(`[RESOLVE] ${label} — proxy fetching via Base44 function`);

    const response = await base44.functions.invoke('fetchFromGitHub', {
      url,
      file_url: url,
      raw_url: url,
    });

    const text = extractProxyText(response);

    console.log(`[RESOLVE] ${label} — proxy fetch result:`, {
      chars: text.length,
      words: countWords(text),
      ok: looksLikeUsableContent(text),
    });

    if (looksLikeUsableContent(text)) {
      return text;
    }

    const data = response?.data || response || {};
    if (data.error) {
      console.warn(`[RESOLVE] ${label} — proxy returned error:`, data.error);
    }

    return '';
  } catch (error) {
    console.warn(`[RESOLVE] ${label} — proxy fetch failed:`, error?.message || String(error));
    return '';
  }
}

async function fetchTextDirectNoCache(url, label = 'chapter') {
  const attempts = [
    cacheBustUrl(url, 'direct-a'),
    cacheBustUrl(url, 'direct-b'),
  ];

  for (let i = 0; i < attempts.length; i += 1) {
    const attemptUrl = attempts[i];

    try {
      const response = await fetch(attemptUrl, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      console.log(`[RESOLVE] ${label} — direct fetch attempt ${i + 1} status:`, response.status, 'ok:', response.ok);

      if (response.ok) {
        const text = normalizeText(await response.text());

        console.log(`[RESOLVE] ${label} — direct fetched ${text.length} chars`);

        if (looksLikeUsableContent(text)) {
          return text;
        }

        console.warn(`[RESOLVE] ${label} — direct fetched content too short:`, text.length, 'chars');
      } else {
        console.warn(`[RESOLVE] ${label} — direct fetch failed:`, response.status, response.statusText);
      }
    } catch (error) {
      console.warn(`[RESOLVE] ${label} — direct URL fetch error:`, error?.message || String(error));
    }

    if (i < attempts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 450 + i * 450));
    }
  }

  return '';
}

/**
 * Rewrites a raw.githubusercontent.com URL to use the local Vite dev proxy path.
 * Returns null if the URL is not a GitHub raw URL or we're not in a local dev context.
 *
 * Local dev: http(s)://localhost or 127.0.0.1 port 5180
 * GitHub raw URL: https://raw.githubusercontent.com/owner/repo/branch/path
 * Rewritten to:  /github-raw/owner/repo/branch/path  (served by Vite proxy)
 */
function rewriteForLocalGitHubProxy(url) {
  if (!url) return null;
  const { hostname, port } = window.location;
  const isLocalDev = (hostname === 'localhost' || hostname === '127.0.0.1') && port === '5180';
  if (!isLocalDev) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'raw.githubusercontent.com') return null;
    return '/github-raw' + parsed.pathname + (parsed.search || '');
  } catch {
    return null;
  }
}

async function fetchTextViaLocalProxy(url, label = 'chapter') {
  const localUrl = rewriteForLocalGitHubProxy(url);
  if (!localUrl) return '';

  try {
    console.log(`[RESOLVE] ${label} — local Vite proxy fetch:`, localUrl);
    const response = await fetch(localUrl, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(`[RESOLVE] ${label} — local proxy fetch status:`, response.status);
      return '';
    }
    const text = normalizeText(await response.text());
    if (looksLikeUsableContent(text)) {
      console.log(`[RESOLVE] ${label} — local proxy fetch success: ${text.length} chars`);
      return text;
    }
    console.warn(`[RESOLVE] ${label} — local proxy content too short: ${text.length} chars`);
    return '';
  } catch (err) {
    console.warn(`[RESOLVE] ${label} — local proxy fetch error:`, err?.message);
    return '';
  }
}

async function fetchTextNoCache(url, label = 'chapter') {
  /*
   * Priority order:
   * 1. Local Vite dev proxy (/github-raw/*) — works in localhost:5180 context,
   *    bypasses CSP since it's same-origin. No-ops in base44 cloud sandbox.
   * 2. Base44 backend proxy (fetchFromGitHub cloud function) — works in cloud sandbox.
   * 3. Browser direct fetch — typically CSP-blocked in base44 sandbox; last resort.
   */
  const localProxied = await fetchTextViaLocalProxy(url, label);
  if (looksLikeUsableContent(localProxied)) return localProxied;

  const proxied = await fetchTextViaBackendProxy(url, label);
  if (looksLikeUsableContent(proxied)) return proxied;

  console.warn(`[RESOLVE] ${label} — backend proxy unavailable/empty; direct fetch skipped (CSP blocked)`);

  return '';
}

/**
 * Uploads content to GitHub via the uploadToGitHub backend function.
 * Returns { file_url, sha, path } on success, or null on failure.
 */
async function uploadViaGitHub(content, projectId, chapterId, prefix = 'chapter') {
  const normalized = normalizeText(content);
  const filename = makeUniqueUploadFilename(prefix, chapterId);

  const payload = {
    content: normalized,
    projectId: projectId || 'default',
    chapterId: chapterId || String(Date.now()),
    filename,
  };

  /*
   * GitHub can return 409 if the file changes between SHA lookup and PUT.
   * Unique filenames should make conflicts rare, but keep the retry.
   *
   * DRAFTSAVE-1: retry EVERY failure, not just 409, with three attempts.
   * A transient upload failure used to fall through to
   * preserveExistingLargeContent, silently pointing a freshly drafted chapter
   * back at its pre-draft blob — a chapter of work lost with zero errors.
   */
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await base44.functions.invoke('uploadToGitHub', payload);
      const data = response.data || response;

      if (data.error) {
        console.warn('[CHAPTER-STORAGE] GitHub upload returned error:', data.error);

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
          continue;
        }

        return null;
      }

      if (data.file_url) {
        console.log(`[CHAPTER-STORAGE] Uploaded to GitHub: ${data.file_url}`, {
          version: CHAPTER_STORAGE_VERSION,
          filename,
          path: data.path || '',
          sha: data.sha || '',
          chars: normalized.length,
          words: countWords(normalized),
        });

        return {
          ...data,
          filename,
        };
      }

      return null;
    } catch (error) {
      console.warn('[CHAPTER-STORAGE] GitHub upload failed:', error?.message || 'unknown');

      // DRAFTSAVE-1: any thrown failure retries, not just 409.
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        continue;
      }

      return null;
    }
  }

  return null;
}

function preserveExistingLargeContent(existingChapter) {
  if (existingChapter?.content_md_url) {
    // DRAFTSAVE-1: this branch means NEW content was NOT persisted and the
    // record will keep pointing at PRE-SAVE text. That is data loss unless a
    // caller notices — scream, do not whisper. (Live REDUX ch.3: a full
    // redraft vanished this way with zero errors on screen.)
    console.error('[DRAFTSAVE-1] Upload failed after retries; record still points at the PREVIOUS content blob. The text you just generated/edited is NOT saved. Preserving old content_md_url:', existingChapter.content_md_url);

    return {
      content_md: '',
      content_md_url: existingChapter.content_md_url,
      content_md_upload_failed: true,
      content_md_preserved_existing_url: true,
      content_storage_version: CHAPTER_STORAGE_VERSION,
    };
  }

  return null;
}

function preserveExistingLargeBackup(existingChapter) {
  if (existingChapter?.backup_content_url) {
    console.warn('[CHAPTER-STORAGE] Backup upload failed; preserving existing backup_content_url instead of truncating backup.');

    return {
      backup_content: '',
      backup_content_url: existingChapter.backup_content_url,
      backup_upload_failed: true,
      backup_preserved_existing_url: true,
      backup_storage_version: CHAPTER_STORAGE_VERSION,
    };
  }

  return null;
}

/**
 * Prepares content_md for saving to a Chapter entity.
 * If the content is small enough, returns it inline.
 * If too large, uploads to GitHub and returns the URL.
 *
 * @param {string} content - The markdown content to save
 * @param {string} [projectId] - Project ID for organizing files
 * @param {string} [chapterId] - Chapter ID for filename
 * @param {object} [existingChapter] - Existing Chapter entity, used to preserve content_md_url if upload fails
 * @returns {Promise<object>} Fields to spread into the update payload
 */
export async function prepareChapterContent(content, projectId, chapterId, existingChapter = null) {
  const normalized = normalizeText(content);
  // VERSIONS-1: every save records what content_md_url pointed at BEFORE this
  // save, so a per-chapter "Restore previous version" action has something
  // real to restore to. Empty when the previous version was inline-only —
  // there is no durable URL to go back to in that case.
  const previousContentMdUrl = existingChapter?.content_md_url || '';

  if (!normalized || normalized.length <= MAX_INLINE_SIZE) {
    return {
      content_md: normalized || '',
      content_md_url: '',
      content_md_upload_failed: false,
      content_storage_version: CHAPTER_STORAGE_VERSION,
      content_md_word_count: countWords(normalized),
      content_md_char_count: normalized.length,
      previous_content_md_url: previousContentMdUrl,
    };
  }

  const result = await uploadViaGitHub(normalized, projectId, chapterId, 'chapter');

  if (result?.file_url) {
    return {
      content_md: '',
      content_md_url: result.file_url,
      content_md_upload_failed: false,
      content_md_uploaded_at: new Date().toISOString(),
      content_md_storage_path: result.path || '',
      content_md_storage_sha: result.sha || '',
      content_md_storage_filename: result.filename || '',
      content_storage_version: CHAPTER_STORAGE_VERSION,
      content_md_word_count: countWords(normalized),
      content_md_char_count: normalized.length,
      previous_content_md_url: previousContentMdUrl,
    };
  }

  const preserved = preserveExistingLargeContent(existingChapter);
  if (preserved) return { ...preserved, previous_content_md_url: previousContentMdUrl };

  /*
   * Brand-new oversized content cannot fit safely inline.
   * Return an explicit failure marker and a preview instead of pretending the full
   * save succeeded.
   */
  console.warn('[CHAPTER-STORAGE] Upload failed and no existing URL was available. Saving preview only and marking upload failure.');

  return {
    content_md: normalized.slice(0, MAX_INLINE_SIZE),
    content_md_url: '',
    content_md_upload_failed: true,
    content_md_preview_only: true,
    content_storage_version: CHAPTER_STORAGE_VERSION,
    content_md_word_count: countWords(normalized),
    content_md_char_count: normalized.length,
    previous_content_md_url: previousContentMdUrl,
  };
}

/**
 * Resolves the actual content of a chapter, fetching from URL if needed.
 *
 * Important order:
 * 1. Transient polished session content
 * 2. Large inline/transient content if present
 * 3. content_md_url through backend proxy
 * 4. direct browser fetch fallback
 * 5. inline fallback
 *
 * @param {object} chapter - Chapter entity record
 * @returns {Promise<string>} The full markdown content
 */
export async function resolveChapterContent(chapter) {
  if (!chapter) return '';

  const label = `Chapter ${chapter.chapter_number || chapter.id || ''}`.trim();

  /*
   * CRITICAL EXPORT FIX:
   * The fixer mutates the current chapter object with __polishedContent after saving.
   * If export runs in the same session, this should beat URL fetches.
   * __safeReplacedContent is set by safeChapterReplace.js after a successful replacement.
   */
  const transientPolished = normalizeText(
    chapter.__safeReplacedContent ||
      chapter.__polishedContent ||
      chapter.__polishSavedContent ||
      chapter.__polishExportContent ||
      ''
  );

  if (looksLikeUsableContent(transientPolished)) {
    console.log('[RESOLVE]', label, '— using transient polished content:', {
      chars: transientPolished.length,
      words: countWords(transientPolished),
      version: CHAPTER_STORAGE_VERSION,
    });

    return transientPolished;
  }

  /*
   * If a current-session caller attached long content_md manually, trust it before URL.
   * Persisted long content_md should not exist because Base44 rejects it, but local
   * runtime objects may contain it.
   */
  const inline = normalizeText(
    chapter.content_md ||
      chapter.content ||
      chapter.prose ||
      chapter.body ||
      chapter.finalText ||
      chapter.cleanedText ||
      ''
  );

  if (looksLikeUsableContent(inline) && inline.length > MAX_INLINE_SIZE) {
    console.log('[RESOLVE]', label, '— using large inline/transient field before URL:', {
      chars: inline.length,
      words: countWords(inline),
      version: CHAPTER_STORAGE_VERSION,
    });

    return inline;
  }

  if (chapter.content_md_url) {
    console.log('[RESOLVE]', label, '— resolving URL through backend proxy:', chapter.content_md_url);

    const fetched = normalizeText(await fetchTextNoCache(chapter.content_md_url, label));

    if (looksLikeUsableContent(fetched)) {
      const stale = contentLooksStaleAgainstMetadata(fetched, chapter);

      if (!stale) {
        console.log('[RESOLVE]', label, '— resolved URL content accepted:', {
          chars: fetched.length,
          words: countWords(fetched),
          version: CHAPTER_STORAGE_VERSION,
        });

        return fetched;
      }

      /*
       * If URL content appears stale but inline/transient content exists, prefer inline.
       * If no better content exists, return fetched instead of empty, but log loudly.
       */
      if (looksLikeUsableContent(inline)) {
        console.warn('[RESOLVE]', label, '— URL content looked stale; falling back to inline field.');

        return inline;
      }

      /*
       * SAFETY-GATE RECOVERY for metadata-only staleness:
       * If URL content looks stale (metadata mismatch) but no inline fallback exists,
       * run the manuscript safety gate on the fetched content. If it PASSES the gate,
       * the content is likely correct but metadata drifted — accept it and tag for
       * metadata refresh. If it FAILS the gate, it's genuinely contaminated — tag as stale.
       *
       * Lazy-import to avoid circular dependency: manuscriptSafetyGate doesn't import chapterStorage.
       */
      let gatePassedStaleContent = false;
      try {
        const { runManuscriptSafetyGate } = await import('./manuscriptSafetyGate.js');
        const gate = runManuscriptSafetyGate(fetched, { stage: 'stale-url-recovery' });

        // Accept content if:
        // - gate passes (ok=true)
        // - gate recommends WARN_ONLY (minor issues)
        // - gate recommends REJECT_MANUAL_REVIEW with malformed grammar only
        //   (no process leaks or contamination — just repairable grammar issues)
        const hasHardFailures = gate.processLeaks.matches.length > 0 || gate.contamination.matches.length > 0;
        const isRecoverableGrammarOnly = !hasHardFailures && gate.recommendedAction === 'REJECT_MANUAL_REVIEW';

        if (gate.ok || gate.recommendedAction === 'WARN_ONLY' || isRecoverableGrammarOnly) {
          gatePassedStaleContent = true;
          const recoveryType = isRecoverableGrammarOnly
            ? 'PASSES safety gate (malformed grammar only — repairable by polish)'
            : 'PASSES safety gate';
          console.log('[RESOLVE]', label, `— URL content is stale (metadata mismatch) but ${recoveryType}. Accepting with metadata-refresh tag.`);
          // Tag for metadata refresh but accept the content
          chapter.__needsMetadataRefresh = true;
          chapter.__metadataRefreshReason = `${label}: URL content passed safety gate but metadata (preview/count) doesn't match. Metadata should be refreshed to match current URL content.`;
          if (isRecoverableGrammarOnly) {
            chapter.__hasMalformedGrammar = true;
            chapter.__malformedGrammarCount = gate.malformed.matches.length;
          }
        }
      } catch (gateErr) {
        console.warn('[RESOLVE]', label, '— could not run safety gate on stale content:', gateErr?.message);
      }

      if (gatePassedStaleContent) {
        return fetched;
      }

      console.warn('[RESOLVE]', label, '— URL content looked stale AND failed safety gate. Returning stale content with warning tag.');
      // Tag the chapter object so callers (export) can detect stale resolution
      chapter.__staleContentResolution = true;
      chapter.__staleContentWarning = `${label}: URL content looked stale (metadata mismatch) and failed safety gate, no inline fallback exists. Content may be outdated.`;
      return fetched;
    }

    console.warn('[RESOLVE]', label, '— URL content unavailable/too short; falling back to inline.');
  } else {
    console.log('[RESOLVE]', label, '— no content_md_url, using inline. content_md length:', inline.length);
  }

  if (looksLikeUsableContent(inline)) {
    return inline;
  }

  if (chapter.content_md) return chapter.content_md;

  return '';
}

/**
 * Checks if a chapter has any content.
 * Use this instead of `!!chapter.content_md` for existence checks.
 */
export function chapterHasContent(chapter) {
  return !!(
    chapter?.__polishedContent ||
    chapter?.__polishSavedContent ||
    chapter?.content_md ||
    chapter?.content_md_url ||
    chapter?.content ||
    chapter?.prose ||
    chapter?.body ||
    chapter?.finalText ||
    chapter?.cleanedText
  );
}

/**
 * Prepares backup_content for saving to a Chapter entity.
 * Mirrors prepareChapterContent but for the backup fields.
 */
export async function prepareBackupContent(content, projectId, chapterId, existingChapter = null) {
  const normalized = normalizeText(content);

  if (!normalized || normalized.length <= MAX_INLINE_SIZE) {
    return {
      backup_content: normalized || '',
      backup_content_url: '',
      backup_upload_failed: false,
      backup_storage_version: CHAPTER_STORAGE_VERSION,
      backup_word_count: countWords(normalized),
      backup_char_count: normalized.length,
    };
  }

  const result = await uploadViaGitHub(normalized, projectId, chapterId, 'backup');

  if (result?.file_url) {
    return {
      backup_content: '',
      backup_content_url: result.file_url,
      backup_upload_failed: false,
      backup_uploaded_at: new Date().toISOString(),
      backup_storage_path: result.path || '',
      backup_storage_sha: result.sha || '',
      backup_storage_filename: result.filename || '',
      backup_storage_version: CHAPTER_STORAGE_VERSION,
      backup_word_count: countWords(normalized),
      backup_char_count: normalized.length,
    };
  }

  const preserved = preserveExistingLargeBackup(existingChapter);
  if (preserved) return preserved;

  console.warn('[CHAPTER-STORAGE] Backup upload failed and no existing backup URL was available; saving preview only.');

  return {
    backup_content: normalized.slice(0, MAX_INLINE_SIZE),
    backup_content_url: '',
    backup_upload_failed: true,
    backup_preview_only: true,
    backup_storage_version: CHAPTER_STORAGE_VERSION,
    backup_word_count: countWords(normalized),
    backup_char_count: normalized.length,
  };
}

/**
 * Resolves the backup content of a chapter, fetching from URL if needed.
 */
export async function resolveBackupContent(chapter) {
  if (!chapter) return '';

  const inline = normalizeText(chapter.backup_content || '');
  if (looksLikeUsableContent(inline)) return inline;

  if (chapter.backup_content_url) {
    const label = `Backup ${chapter.chapter_number || chapter.id || ''}`.trim();
    const fetched = normalizeText(await fetchTextNoCache(chapter.backup_content_url, label));

    if (looksLikeUsableContent(fetched)) return fetched;
  }

  return '';
}

/**
 * Checks if a chapter has backup content available.
 */
export function chapterHasBackup(chapter) {
  return !!(chapter?.backup_content || chapter?.backup_content_url);
}

/**
 * VERSIONS-1B: every stored version of this chapter's content, oldest first
 * (metadata only — id, created_date, bytes; never content). A chapter's
 * _FileStore keys all share the `${projectId}/${chapterId}/` prefix
 * (handleUploadToGitHub, base44Client.js) regardless of which save wrote them,
 * so this finds every version ever saved, not just the immediately-previous one.
 */
export async function listChapterVersions(chapter) {
  const projectId = chapter?.project_id;
  const chapterId = chapter?.id;
  if (!projectId || !chapterId) return [];
  return listFileVersions(`${projectId}/${chapterId}/`);
}

const stripLocalPrefix = (url) => String(url || '').replace(/^local:\/\//, '');

// VERSIONS-1C: a chapter's key prefix holds TWO independent filename
// families — `chapter-...` (uploadViaGitHub(..., 'chapter'), every real
// content save) and `backup-...` (uploadViaGitHub(..., 'backup'),
// prepareBackupContent's separate backup_content_url track). Because
// "backup-" sorts lexically before "chapter-", a naive sort across every
// key under the prefix can hand findImmediatelyOlderVersion a backup blob
// as if it were the chapter's own oldest content version. A restore must
// only ever walk within the current key's own family.
function keyFamily(key) {
  const basename = String(key || '').split('/').pop() || '';
  const m = basename.match(/^([a-zA-Z0-9]+)-/);
  return m ? m[1] : '';
}

/**
 * VERSIONS-1B: the version immediately before `chapter`'s CURRENT
 * content_md_url in the store's own history — the fallback restore target
 * for a chapter saved before VERSIONS-1 landed (no previous_content_md_url
 * recorded). History is sorted oldest-first; the current version's own key
 * (and anything at or after it) is excluded — only strictly-older entries
 * IN THE SAME FILENAME FAMILY count (VERSIONS-1C), and the LAST of those
 * (closest to current) is the answer. Returns a `local://` URL, or '' when
 * there is nothing older.
 */
export async function findImmediatelyOlderVersion(chapter) {
  const currentKey = stripLocalPrefix(chapter?.content_md_url);
  if (!currentKey) return '';
  const currentFamily = keyFamily(currentKey);
  const versions = await listChapterVersions(chapter);
  const older = versions.filter((v) => v.id < currentKey && keyFamily(v.id) === currentFamily);
  if (!older.length) return '';
  return `local://${older[older.length - 1].id}`;
}

/**
 * VERSIONS-1 / VERSIONS-1B: does this chapter have a previous saved version
 * to restore? True when previous_content_md_url was recorded directly (every
 * save since VERSIONS-1), OR — for a chapter saved before VERSIONS-1 landed
 * — when findImmediatelyOlderVersion finds one in the store's own history.
 * Async: the history check is a server round-trip.
 */
export async function chapterHasPreviousVersion(chapter) {
  if (chapter?.previous_content_md_url) return true;
  return !!(await findImmediatelyOlderVersion(chapter));
}

export const chapterStorageVersion = CHAPTER_STORAGE_VERSION;