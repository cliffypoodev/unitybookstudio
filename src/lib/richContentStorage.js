// =============================================================
// richContentStorage.js — Phase 3 Prep, GitHub-backed version
//
// Purpose:
// - Prepare rich editor persistence using the same uploadToGitHub
//   pathway already used by chapterStorage.js.
// - Supports future fields:
//   content_html
//   content_html_url
//   content_delta
//   content_delta_url
//   content_format
//
// Safe:
// - Does not change current markdown save/load behavior by itself.
// - Keeps markdown as the durable fallback.
// - Uses existing Base44 backend function uploadToGitHub for large rich content.
// =============================================================

import { base44 } from '@/api/base44Client';

const MAX_INLINE_HTML_SIZE = 10_000;
const MAX_INLINE_DELTA_SIZE = 10_000;

const RICH_CONTENT_FORMATS = {
  HTML_V1: 'html_v1',
  QUILL_DELTA_V1: 'quill_delta_v1',
  MARKDOWN_V1: 'markdown_v1',
};

function safeString(value = '') {
  if (value === null || value === undefined) return '';
  return String(value);
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

function safeJsonParse(value, fallback = null) {
  if (!value) return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sanitizeFilenamePart(value = 'unknown') {
  return safeString(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

async function uploadViaGitHub(content, projectId, chapterId, prefix = 'rich') {
  try {
    const safeProjectId = projectId || 'default';
    const safeChapterId = chapterId || String(Date.now());
    const safePrefix = sanitizeFilenamePart(prefix);

    const response = await base44.functions.invoke('uploadToGitHub', {
      content: safeString(content),
      projectId: safeProjectId,
      chapterId: safeChapterId,
      filename: `${safePrefix}-${safeChapterId}-${Date.now()}`,
    });

    const data = response?.data || response;

    if (data?.error) {
      console.warn('[RICH-CONTENT-STORAGE] GitHub upload returned error:', data.error);
      return null;
    }

    if (data?.file_url) {
      console.log(`[RICH-CONTENT-STORAGE] Uploaded ${safePrefix} to GitHub: ${data.file_url}`);
      return data;
    }

    return null;
  } catch (err) {
    console.warn('[RICH-CONTENT-STORAGE] GitHub upload failed:', err?.message || err);
    return null;
  }
}

async function fetchTextFromUrl(url, label = 'rich content') {
  if (!url) return '';

  try {
    // Use the local base44Client proxy instead of direct fetch (CSP blocks direct).
    const response = await base44.functions.invoke('fetchFromGitHub', {
      url,
      file_url: url,
      raw_url: url,
    });
    const data = response?.data || response || {};
    const text = data?.content || data?.result?.content || '';
    if (text) return text;
  } catch (err) {
    console.warn(`[RICH-CONTENT-STORAGE] URL fetch error for ${label}:`, err?.message || err);
  }
  return '';
}

/**
 * Prepare rich HTML fields for future Chapter persistence.
 *
 * This returns payload fields only. The caller still decides whether to save.
 */
export async function prepareRichHtmlContent(html, projectId, chapterId) {
  const safeHtml = safeString(html);

  if (!safeHtml.trim()) {
    return {
      content_html: '',
      content_html_url: '',
      content_format: RICH_CONTENT_FORMATS.MARKDOWN_V1,
    };
  }

  if (safeHtml.length <= MAX_INLINE_HTML_SIZE) {
    return {
      content_html: safeHtml,
      content_html_url: '',
      content_format: RICH_CONTENT_FORMATS.HTML_V1,
    };
  }

  const result = await uploadViaGitHub(safeHtml, projectId, chapterId, 'content-html');

  if (result?.file_url) {
    return {
      content_html: '',
      content_html_url: result.file_url,
      content_format: RICH_CONTENT_FORMATS.HTML_V1,
    };
  }

  // Last resort: keep a truncated inline HTML preview instead of total loss.
  console.warn('[RICH-CONTENT-STORAGE] HTML upload failed. Truncating inline HTML fallback.');

  return {
    content_html: safeHtml.slice(0, MAX_INLINE_HTML_SIZE),
    content_html_url: '',
    content_format: RICH_CONTENT_FORMATS.HTML_V1,
  };
}

/**
 * Resolve rich HTML from a chapter record.
 */
export async function resolveRichHtmlContent(chapter) {
  if (!chapter) return '';

  if (chapter.content_html) {
    return safeString(chapter.content_html);
  }

  if (chapter.content_html_url) {
    return fetchTextFromUrl(chapter.content_html_url, 'content_html_url');
  }

  return '';
}

/**
 * Prepare Quill Delta fields for future Chapter persistence.
 *
 * Accepts either:
 * - a Quill Delta object
 * - a JSON string
 */
export async function prepareRichDeltaContent(delta, projectId, chapterId) {
  const deltaText =
    typeof delta === 'string'
      ? delta
      : safeJsonStringify(delta || { ops: [] });

  if (!deltaText.trim() || deltaText === '{}') {
    return {
      content_delta: '',
      content_delta_url: '',
      content_format: RICH_CONTENT_FORMATS.MARKDOWN_V1,
    };
  }

  if (deltaText.length <= MAX_INLINE_DELTA_SIZE) {
    return {
      content_delta: deltaText,
      content_delta_url: '',
      content_format: RICH_CONTENT_FORMATS.QUILL_DELTA_V1,
    };
  }

  const result = await uploadViaGitHub(deltaText, projectId, chapterId, 'content-delta');

  if (result?.file_url) {
    return {
      content_delta: '',
      content_delta_url: result.file_url,
      content_format: RICH_CONTENT_FORMATS.QUILL_DELTA_V1,
    };
  }

  console.warn('[RICH-CONTENT-STORAGE] Delta upload failed. Truncating inline Delta fallback.');

  return {
    content_delta: deltaText.slice(0, MAX_INLINE_DELTA_SIZE),
    content_delta_url: '',
    content_format: RICH_CONTENT_FORMATS.QUILL_DELTA_V1,
  };
}

/**
 * Resolve Quill Delta from a chapter record.
 */
export async function resolveRichDeltaContent(chapter, parse = true) {
  if (!chapter) return parse ? null : '';

  let raw = '';

  if (chapter.content_delta) {
    raw = safeString(chapter.content_delta);
  } else if (chapter.content_delta_url) {
    raw = await fetchTextFromUrl(chapter.content_delta_url, 'content_delta_url');
  }

  if (!parse) return raw;

  return safeJsonParse(raw, null);
}

/**
 * Prepare both rich HTML and Delta payloads.
 *
 * This will be used when ExportTab starts saving actual editor state.
 */
export async function prepareRichEditorPayload({
  html,
  delta,
  markdown,
  projectId,
  chapterId,
}) {
  const safeMarkdown = safeString(markdown);

  const htmlPayload = await prepareRichHtmlContent(html, projectId, chapterId);
  const deltaPayload = await prepareRichDeltaContent(delta, projectId, chapterId);

  const hasDelta =
    Boolean(deltaPayload.content_delta || deltaPayload.content_delta_url) &&
    deltaPayload.content_format === RICH_CONTENT_FORMATS.QUILL_DELTA_V1;

  const hasHtml =
    Boolean(htmlPayload.content_html || htmlPayload.content_html_url) &&
    htmlPayload.content_format === RICH_CONTENT_FORMATS.HTML_V1;

  return {
    ...htmlPayload,
    ...deltaPayload,

    content_md_fallback_present: Boolean(safeMarkdown.trim()),
    content_format: hasDelta
      ? RICH_CONTENT_FORMATS.QUILL_DELTA_V1
      : hasHtml
        ? RICH_CONTENT_FORMATS.HTML_V1
        : RICH_CONTENT_FORMATS.MARKDOWN_V1,
  };
}

/**
 * Check what rich content is available on a chapter.
 */
export function getRichContentAvailability(chapter) {
  return {
    hasHtml: Boolean(chapter?.content_html || chapter?.content_html_url),
    hasDelta: Boolean(chapter?.content_delta || chapter?.content_delta_url),
    hasMarkdown: Boolean(chapter?.content_md || chapter?.content_md_url),
    contentFormat: chapter?.content_format || '',
  };
}

/**
 * Future loader priority:
 * 1. Quill Delta, if available
 * 2. HTML, if available
 * 3. Markdown fallback, handled by current chapterStorage/mdHtmlConvert flow
 */
export async function resolveBestRichContent(chapter) {
  const availability = getRichContentAvailability(chapter);

  if (availability.hasDelta) {
    const delta = await resolveRichDeltaContent(chapter, true);

    if (delta) {
      return {
        type: RICH_CONTENT_FORMATS.QUILL_DELTA_V1,
        delta,
        html: '',
      };
    }
  }

  if (availability.hasHtml) {
    const html = await resolveRichHtmlContent(chapter);

    if (html) {
      return {
        type: RICH_CONTENT_FORMATS.HTML_V1,
        delta: null,
        html,
      };
    }
  }

  return {
    type: RICH_CONTENT_FORMATS.MARKDOWN_V1,
    delta: null,
    html: '',
  };
}

export function richContentFieldsAreEmpty(chapter) {
  return !(
    chapter?.content_html ||
    chapter?.content_html_url ||
    chapter?.content_delta ||
    chapter?.content_delta_url
  );
}

export function clearRichContentFields() {
  return {
    content_html: '',
    content_html_url: '',
    content_delta: '',
    content_delta_url: '',
    content_format: RICH_CONTENT_FORMATS.MARKDOWN_V1,
    content_md_fallback_present: false,
  };
}

export { RICH_CONTENT_FORMATS };