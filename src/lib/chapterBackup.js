/**
 * WAVE8-SNAPSHOT — one guarded path for every tool-initiated chapter overwrite.
 *
 * The single-slot backup layer already existed in chapterStorage
 * (`backup_content` / `backup_content_url`) and OutlineEditor already renders a
 * "Restore Original" button gated on `chapterHasBackup`. But the snapshot-then-
 * overwrite sequence lived inline inside ProjectStudio as a closure over that
 * page's state, so no tool outside ProjectStudio could take a snapshot. Every
 * tool that wanted to write a chapter therefore either wrote without an undo,
 * or (in the AI Check's case) declined to write at all and made the novelist
 * copy-paste by hand.
 *
 * This module lifts that sequence out so any caller gets the same contract:
 *
 *   snapshot the current content → write the new content → verify the write
 *
 * If the snapshot fails, the write does not happen. A destructive edit with no
 * undo is worse than no edit.
 *
 * @module chapterBackup
 */

import { base44 } from '@/api/base44Client.js';
import {
  resolveChapterContent,
  resolveBackupContent,
  prepareChapterContent,
  prepareBackupContent,
  chapterHasBackup,
} from '@/lib/chapterStorage.js';
import { clearRichContentFields } from '@/lib/richContentStorage.js';
import { runWithNetworkRetry } from '@/lib/requestRetry.js';
import { verifiedChapterSave } from '@/lib/verifiedChapterSave.js';
import { countWords } from '@/lib/autonovel.js';
import { locatePassage, assessReplacement } from '@/lib/passageLocator.js';

export { locatePassage, assessReplacement } from '@/lib/passageLocator.js';

/**
 * Snapshot a chapter's current content into its backup slot.
 *
 * Single-slot by design, matching the existing schema: taking a new snapshot
 * replaces the previous one, and restoring consumes it. This is an undo button,
 * not a version-control system.
 *
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function snapshotChapter(chapter, projectId, reason = '') {
  if (!chapter?.id) return { ok: false, reason: 'no chapter id' };

  try {
    const existingText = await resolveChapterContent(chapter);
    if (!existingText || !existingText.trim()) {
      // Nothing to lose — an empty chapter needs no undo.
      return { ok: true, skipped: true, reason: 'chapter was empty' };
    }

    const backupFields = await prepareBackupContent(existingText, projectId, chapter.id, chapter);

    // prepareBackupContent degrades to a truncated preview when the offload
    // upload fails. A truncated backup is a false promise of undo, so refuse.
    if (backupFields.backup_preview_only) {
      return { ok: false, reason: 'backup storage unavailable — refusing to overwrite without a full snapshot' };
    }

    await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
      ...backupFields,
      revision_notes: [
        reason || 'Snapshot before overwrite',
        chapter.revision_notes || '',
      ].filter(Boolean).join('\n'),
    }));

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
}

/**
 * Restore a chapter from its backup slot and consume the slot.
 *
 * @returns {Promise<{ ok: boolean, content?: string, reason?: string }>}
 */
export async function restoreChapterSnapshot(chapter, projectId) {
  if (!chapter?.id) return { ok: false, reason: 'no chapter id' };
  if (!chapterHasBackup(chapter)) return { ok: false, reason: 'no snapshot available' };

  try {
    const backup = await resolveBackupContent(chapter);
    if (!backup || !backup.trim()) return { ok: false, reason: 'snapshot was empty or unreadable' };

    const contentFields = await prepareChapterContent(backup, projectId, chapter.id, chapter);

    await runWithNetworkRetry(() => base44.entities.Chapter.update(chapter.id, {
      ...clearRichContentFields(),
      content_md_fallback_present: true,
      ...contentFields,
      word_count: countWords(backup),
      backup_content: '',
      backup_content_url: '',
    }));

    return { ok: true, content: backup };
  } catch (err) {
    return { ok: false, reason: err?.message || String(err) };
  }
}

/* ── passage-level apply ─────────────────────────────────────────────────── */

/**
 * Replace one passage inside a chapter, snapshotting first and verifying after.
 *
 * @param {object}  params
 * @param {object}  params.chapter      The chapter entity record
 * @param {string}  params.projectId
 * @param {string}  params.original     The passage as it currently reads
 * @param {string}  params.replacement  The passage as it should read
 * @param {string}  [params.reason]     Recorded in revision_notes
 * @returns {Promise<{ ok: boolean, reason?: string, content?: string }>}
 */
export async function applyPassageToChapter({ chapter, projectId, original, replacement, reason }) {
  if (!chapter?.id) return { ok: false, reason: 'no chapter to write to' };

  const next = String(replacement || '').trim();
  if (!next) return { ok: false, reason: 'replacement text is empty' };

  // WAVE8-PROPORTION: refuse a "rewrite" that is plainly not a rewrite of this
  // passage, before it reaches the manuscript.
  const scale = assessReplacement(original, next);
  if (!scale.ok) return { ok: false, reason: scale.reason };

  let content;
  try {
    content = await resolveChapterContent(chapter);
  } catch (err) {
    return { ok: false, reason: `could not read the chapter — ${err?.message || err}` };
  }

  const hit = locatePassage(content, original);
  if (!hit.found) return { ok: false, reason: hit.reason };

  const updated = content.slice(0, hit.start) + next + content.slice(hit.end);
  if (updated === content) return { ok: false, reason: 'the rewrite is identical to the original' };

  const snap = await snapshotChapter(chapter, projectId, reason || 'Snapshot before passage rewrite');
  if (!snap.ok) return { ok: false, reason: `snapshot failed, nothing was changed — ${snap.reason}` };

  let contentFields;
  try {
    contentFields = await prepareChapterContent(updated, projectId, chapter.id, chapter);
  } catch (err) {
    return { ok: false, reason: `could not prepare the chapter for saving — ${err?.message || err}` };
  }

  const saved = await verifiedChapterSave({
    chapterId: chapter.id,
    chapterNumber: chapter.chapter_number,
    writtenContent: updated,
    savePayload: {
      ...clearRichContentFields(),
      content_md_fallback_present: true,
      ...contentFields,
      word_count: countWords(updated),
    },
  });

  if (!saved.ok) return { ok: false, reason: saved.reason || 'the save could not be verified' };
  return { ok: true, content: updated };
}

/**
 * Replace a chapter's entire body, snapshotting first and verifying after.
 *
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function replaceChapterContent({ chapter, projectId, content, reason }) {
  if (!chapter?.id) return { ok: false, reason: 'no chapter to write to' };

  const next = String(content || '');
  if (!next.trim()) return { ok: false, reason: 'refusing to save an empty chapter' };

  const snap = await snapshotChapter(chapter, projectId, reason || 'Snapshot before manual rewrite');
  if (!snap.ok) return { ok: false, reason: `snapshot failed, nothing was changed — ${snap.reason}` };

  let contentFields;
  try {
    contentFields = await prepareChapterContent(next, projectId, chapter.id, chapter);
  } catch (err) {
    return { ok: false, reason: `could not prepare the chapter for saving — ${err?.message || err}` };
  }

  const saved = await verifiedChapterSave({
    chapterId: chapter.id,
    chapterNumber: chapter.chapter_number,
    writtenContent: next,
    savePayload: {
      ...clearRichContentFields(),
      content_md_fallback_present: true,
      ...contentFields,
      word_count: countWords(next),
    },
  });

  if (!saved.ok) return { ok: false, reason: saved.reason || 'the save could not be verified' };
  return { ok: true };
}

console.log('[CHAPTER-BACKUP] v1 loaded — snapshot-then-write active');
