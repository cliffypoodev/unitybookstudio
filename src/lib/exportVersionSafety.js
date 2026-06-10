// =============================================================
// exportVersionSafety.js — Phase 3B Export Backup Safety
// Hardened Version
//
// Purpose:
// - Create a backup snapshot before Export overwrites a chapter.
// - Prefer existing backup_content / backup_content_url fields first.
// - Avoid depending on new schema fields unless Base44 accepts them.
// - Log clearly when backup is created, skipped, or fails.
//
// Safe:
// - Backup failures do NOT block normal chapter saves.
// - Does not change editor behavior by itself.
// - Works even if rich backup fields are not added to the Chapter schema.
// =============================================================

import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { resolveChapterContent, prepareBackupContent } from '@/lib/chapterStorage';
import {
  resolveRichHtmlContent,
  resolveRichDeltaContent,
  getRichContentAvailability,
} from '@/lib/richContentStorage';

const ENABLE_RICH_BACKUP_FIELDS = false;

// Flip this to true only after confirming your Chapter entity schema includes:
// export_backup_html
// export_backup_delta
// export_backup_meta_json
//
// Leaving it false makes this helper use the already-existing backup_content
// and backup_content_url path only, which is much safer in Base44.

function safeString(value = '') {
  if (value === null || value === undefined) return '';
  return String(value);
}

function countWords(text = '') {
  return safeString(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasUsefulText(value = '') {
  return safeString(value).trim().length > 0;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

function sanitizeReason(reason = '') {
  return safeString(reason)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 140) || 'Export save backup';
}

function normalizeForCompare(value = '') {
  return safeString(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

/**
 * Fetch the freshest Chapter record before creating a backup.
 */
export async function fetchFreshChapter(chapterId) {
  if (!chapterId) {
    console.warn('[EXPORT VERSION SAFETY] fetchFreshChapter skipped: missing chapterId');
    return null;
  }

  try {
    const rows = await runWithNetworkRetry(() =>
      base44.entities.Chapter.filter({ id: chapterId })
    );

    const chapter = rows?.[0] || null;

    if (!chapter) {
      console.warn('[EXPORT VERSION SAFETY] No chapter found for backup lookup:', chapterId);
    }

    return chapter;
  } catch (err) {
    console.warn('[EXPORT VERSION SAFETY] Failed to fetch fresh chapter:', err?.message || err);
    return null;
  }
}

/**
 * Resolve all previous content formats currently available on the chapter.
 */
export async function resolvePreviousChapterState(chapter) {
  if (!chapter) {
    return {
      markdown: '',
      html: '',
      deltaRaw: '',
      deltaParsed: null,
      availability: {
        hasMarkdown: false,
        hasHtml: false,
        hasDelta: false,
        contentFormat: '',
      },
    };
  }

  const availability = getRichContentAvailability(chapter);

  let markdown = '';
  let html = '';
  let deltaRaw = '';
  let deltaParsed = null;

  try {
    markdown = await resolveChapterContent(chapter);
  } catch (err) {
    console.warn('[EXPORT VERSION SAFETY] Markdown resolve failed:', err?.message || err);
    markdown = safeString(chapter.content_md || chapter.beat_summary || '');
  }

  if (availability.hasHtml) {
    try {
      html = await resolveRichHtmlContent(chapter);
    } catch (err) {
      console.warn('[EXPORT VERSION SAFETY] Rich HTML resolve failed:', err?.message || err);
      html = safeString(chapter.content_html || '');
    }
  }

  if (availability.hasDelta) {
    try {
      deltaRaw = await resolveRichDeltaContent(chapter, false);
      deltaParsed = await resolveRichDeltaContent(chapter, true);
    } catch (err) {
      console.warn('[EXPORT VERSION SAFETY] Rich Delta resolve failed:', err?.message || err);
      deltaRaw = safeString(chapter.content_delta || '');
      deltaParsed = null;
    }
  }

  return {
    markdown: safeString(markdown),
    html: safeString(html),
    deltaRaw: safeString(deltaRaw),
    deltaParsed,
    availability,
  };
}

/**
 * Decide whether a backup should be created.
 *
 * This hardened version backs up whenever:
 * - previous content exists, AND
 * - incoming content is different OR caller forces backup.
 */
export async function shouldCreateExportBackup({
  chapterId,
  incomingMarkdown,
  incomingHtml,
  force = false,
}) {
  const freshChapter = await fetchFreshChapter(chapterId);

  if (!freshChapter) {
    console.warn('[EXPORT VERSION SAFETY] Backup skipped: no fresh chapter.');
    return {
      shouldBackup: false,
      freshChapter: null,
      previous: null,
      reason: 'No fresh chapter found',
    };
  }

  const previous = await resolvePreviousChapterState(freshChapter);

  const previousMarkdown = normalizeForCompare(previous.markdown);
  const nextMarkdown = normalizeForCompare(incomingMarkdown);

  const previousHtml = normalizeForCompare(previous.html);
  const nextHtml = normalizeForCompare(incomingHtml);

  const previousHasContent =
    hasUsefulText(previousMarkdown) ||
    hasUsefulText(previousHtml) ||
    hasUsefulText(previous.deltaRaw) ||
    hasUsefulText(freshChapter.content_md) ||
    hasUsefulText(freshChapter.beat_summary) ||
    hasUsefulText(freshChapter.content_md_url);

  if (!previousHasContent) {
    console.log('[EXPORT VERSION SAFETY] Backup skipped: chapter has no previous content.', {
      chapterId,
    });

    return {
      shouldBackup: false,
      freshChapter,
      previous,
      reason: 'No previous content',
    };
  }

  if (force) {
    return {
      shouldBackup: true,
      freshChapter,
      previous,
      reason: 'Forced backup',
    };
  }

  if (previousMarkdown && nextMarkdown && previousMarkdown !== nextMarkdown) {
    return {
      shouldBackup: true,
      freshChapter,
      previous,
      reason: 'Markdown changed',
    };
  }

  if (previousHtml && nextHtml && previousHtml !== nextHtml) {
    return {
      shouldBackup: true,
      freshChapter,
      previous,
      reason: 'HTML changed',
    };
  }

  if (!previousHtml && nextHtml && previousMarkdown) {
    return {
      shouldBackup: true,
      freshChapter,
      previous,
      reason: 'Rich HTML introduced',
    };
  }

  console.log('[EXPORT VERSION SAFETY] Backup skipped: incoming content matches existing content.', {
    chapterId,
    previousMarkdownChars: previousMarkdown.length,
    nextMarkdownChars: nextMarkdown.length,
    previousHtmlChars: previousHtml.length,
    nextHtmlChars: nextHtml.length,
  });

  return {
    shouldBackup: false,
    freshChapter,
    previous,
    reason: 'No meaningful change',
  };
}

/**
 * Build backup payload.
 *
 * By default, this only writes:
 * - backup_content
 * - backup_content_url
 *
 * That avoids schema crashes from unknown fields.
 */
export async function buildExportBackupPayload({
  chapter,
  projectId,
  chapterId,
  reason = 'Export save backup',
}) {
  const targetChapter = chapter || (await fetchFreshChapter(chapterId));

  if (!targetChapter?.id && !chapterId) {
    console.warn('[EXPORT VERSION SAFETY] Cannot build backup payload: missing chapter.');
    return {};
  }

  const resolved = await resolvePreviousChapterState(targetChapter);

  const previousMarkdown =
    resolved.markdown ||
    targetChapter.content_md ||
    targetChapter.beat_summary ||
    '';

  const hasMarkdown = hasUsefulText(previousMarkdown);
  const hasHtml = hasUsefulText(resolved.html);
  const hasDelta = hasUsefulText(resolved.deltaRaw);

  if (!hasMarkdown && !hasHtml && !hasDelta) {
    console.log('[EXPORT VERSION SAFETY] No content available to back up.');
    return {};
  }

  let markdownBackupFields = {};

  if (hasMarkdown) {
    try {
      markdownBackupFields = await prepareBackupContent(
        previousMarkdown,
        projectId || targetChapter.project_id || 'project',
        chapterId || targetChapter.id
      );
    } catch (err) {
      console.warn('[EXPORT VERSION SAFETY] prepareBackupContent failed; using inline fallback:', err?.message || err);

      markdownBackupFields = {
        backup_content: previousMarkdown.slice(0, 9000),
        backup_content_url: '',
      };
    }
  } else if (hasHtml) {
    // Last-resort backup if markdown is missing but HTML exists.
    markdownBackupFields = {
      backup_content: resolved.html.slice(0, 9000),
      backup_content_url: '',
    };
  } else if (hasDelta) {
    markdownBackupFields = {
      backup_content: resolved.deltaRaw.slice(0, 9000),
      backup_content_url: '',
    };
  }

  const meta = {
    reason: sanitizeReason(reason),
    backed_up_at: new Date().toISOString(),
    chapter_id: chapterId || targetChapter.id || '',
    project_id: projectId || targetChapter.project_id || '',
    prior_word_count: countWords(previousMarkdown || resolved.html),
    had_markdown: hasMarkdown,
    had_html: hasHtml,
    had_delta: hasDelta,
    prior_content_format: targetChapter.content_format || resolved.availability.contentFormat || '',
  };

  if (!ENABLE_RICH_BACKUP_FIELDS) {
    return {
      ...markdownBackupFields,
    };
  }

  return {
    ...markdownBackupFields,
    export_backup_html: hasHtml ? resolved.html.slice(0, 20000) : '',
    export_backup_delta: hasDelta ? resolved.deltaRaw.slice(0, 20000) : '',
    export_backup_meta_json: safeJsonStringify(meta),
  };
}

/**
 * Create/update backup fields on the chapter before save.
 *
 * This does not throw unless throwOnFailure is true.
 */
export async function createExportBackupBeforeSave({
  chapterId,
  projectId,
  reason = 'Export save backup',
  throwOnFailure = false,
}) {
  if (!chapterId) {
    console.warn('[EXPORT VERSION SAFETY] Backup skipped: missing chapterId.');
    return {};
  }

  try {
    const freshChapter = await fetchFreshChapter(chapterId);

    if (!freshChapter) {
      console.warn('[EXPORT VERSION SAFETY] No fresh chapter found; backup skipped:', chapterId);
      return {};
    }

    const backupPayload = await buildExportBackupPayload({
      chapter: freshChapter,
      projectId,
      chapterId,
      reason,
    });

    if (!Object.keys(backupPayload).length) {
      console.log('[EXPORT VERSION SAFETY] Backup payload empty; backup skipped.', {
        chapterId,
        reason,
      });

      return {};
    }

    await runWithNetworkRetry(() =>
      base44.entities.Chapter.update(chapterId, backupPayload)
    );

    console.log('[EXPORT VERSION SAFETY] Backup created before export save:', {
      chapterId,
      reason,
      payloadKeys: Object.keys(backupPayload),
      backupContentChars: safeString(backupPayload.backup_content).length,
      backupUrl: backupPayload.backup_content_url || '',
    });

    return backupPayload;
  } catch (err) {
    console.warn('[EXPORT VERSION SAFETY] Backup failed:', err?.message || err);

    if (throwOnFailure) {
      throw err;
    }

    return {};
  }
}

/**
 * Safe one-call helper for ExportTab.
 *
 * Use this immediately before writing new markdown/rich payloads.
 */
export async function backupExportChapterIfChanged({
  chapterId,
  projectId,
  incomingMarkdown,
  incomingHtml,
  reason = 'Export save backup',
  force = false,
}) {
  if (!chapterId) {
    console.warn('[EXPORT VERSION SAFETY] Conditional backup skipped: missing chapterId.');
    return {};
  }

  try {
    const decision = await shouldCreateExportBackup({
      chapterId,
      incomingMarkdown,
      incomingHtml,
      force,
    });

    console.log('[EXPORT VERSION SAFETY] Backup decision:', {
      chapterId,
      shouldBackup: decision.shouldBackup,
      reason: decision.reason,
    });

    if (!decision.shouldBackup) {
      return {};
    }

    return createExportBackupBeforeSave({
      chapterId,
      projectId,
      reason: `${reason} — ${decision.reason}`,
      throwOnFailure: false,
    });
  } catch (err) {
    console.warn('[EXPORT VERSION SAFETY] Conditional backup failed:', err?.message || err);
    return {};
  }
}

/**
 * Utility for showing backup status later in an inspector/version panel.
 */
export function getExportBackupInfo(chapter) {
  let meta = null;

  try {
    meta = chapter?.export_backup_meta_json
      ? JSON.parse(chapter.export_backup_meta_json)
      : null;
  } catch {
    meta = null;
  }

  return {
    hasMarkdownBackup: Boolean(chapter?.backup_content || chapter?.backup_content_url),
    hasHtmlBackup: Boolean(chapter?.export_backup_html),
    hasDeltaBackup: Boolean(chapter?.export_backup_delta),
    meta,
  };
}

/**
 * Restore payload builder.
 *
 * This does not update the database by itself. It returns fields that can be
 * merged into a Chapter update later.
 */
export function buildRestoreExportBackupPayload(chapter) {
  if (!chapter) return {};

  const payload = {};

  if (chapter.backup_content) {
    payload.content_md = chapter.backup_content;
    payload.content_md_url = '';
    payload.word_count = countWords(chapter.backup_content);
  }

  if (chapter.backup_content_url && !chapter.backup_content) {
    payload.restore_backup_content_url = chapter.backup_content_url;
  }

  if (ENABLE_RICH_BACKUP_FIELDS && chapter.export_backup_html) {
    payload.content_html = chapter.export_backup_html;
    payload.content_html_url = '';
    payload.content_format = 'html_v1';
  }

  if (ENABLE_RICH_BACKUP_FIELDS && chapter.export_backup_delta) {
    payload.content_delta = chapter.export_backup_delta;
    payload.content_delta_url = '';
    payload.content_format = 'quill_delta_v1';
  }

  return payload;
}

/**
 * Optional cleanup fields after a user intentionally discards backup history.
 */
export function clearExportBackupFields() {
  if (!ENABLE_RICH_BACKUP_FIELDS) {
    return {
      backup_content: '',
      backup_content_url: '',
    };
  }

  return {
    backup_content: '',
    backup_content_url: '',
    export_backup_html: '',
    export_backup_delta: '',
    export_backup_meta_json: '',
  };
}