/**
 * draftIntegrityReport.js
 *
 * After Draft All completes, reads ALL project chapters back from the DB
 * (not in-memory state) and classifies each body chapter as "has content"
 * (≥100 words) or "empty/failed" (<100 words or no content).
 *
 * Returns a report object for the DraftIntegrityBanner UI.
 *
 * @module draftIntegrityReport
 */

import { base44 } from '@/api/base44Client';
import { resolveChapterContent } from '@/lib/chapterStorage';

const MIN_WORD_COUNT = 100;

function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Compute a draft integrity report by reading chapters fresh from the DB.
 *
 * @param {string}   projectId       The project ID to fetch chapters for
 * @param {function} isBodyChapter   Filter function: (chapter) => boolean
 * @returns {Promise<{
 *   total: number,
 *   withContent: number,
 *   emptyChapterNumbers: number[],
 *   emptyChapterIds: string[],
 *   details: Array<{ chapterNumber: number, id: string, wordCount: number }>,
 *   timestamp: number
 * }>}
 */
export async function computeDraftIntegrityReport(projectId, isBodyChapter) {
  console.log('[DRAFT-INTEGRITY] Computing integrity report from DB for project:', projectId);

  // Read fresh from DB — NOT from React state
  const freshChapters = await base44.entities.Chapter.filter(
    { project_id: projectId },
    'chapter_number',
    200,
  );

  const bodyChapters = freshChapters
    .filter((ch) => isBodyChapter(ch))
    .sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));

  const details = [];
  const emptyChapterNumbers = [];
  const emptyChapterIds = [];

  // Resolve content for each body chapter in parallel (safe since resolveChapterContent is read-only)
  const contentResults = await Promise.all(
    bodyChapters.map(async (ch) => {
      try {
        const content = await resolveChapterContent(ch);
        return { chapter: ch, content };
      } catch (err) {
        console.warn(`[DRAFT-INTEGRITY] Ch.${ch.chapter_number}: resolve failed — ${err?.message}`);
        return { chapter: ch, content: '' };
      }
    }),
  );

  for (const { chapter, content } of contentResults) {
    const wordCount = countWords(content);
    const entry = {
      chapterNumber: chapter.chapter_number,
      id: chapter.id,
      wordCount,
    };
    details.push(entry);

    if (wordCount < MIN_WORD_COUNT) {
      emptyChapterNumbers.push(chapter.chapter_number);
      emptyChapterIds.push(chapter.id);
    }
  }

  const total = bodyChapters.length;
  const withContent = total - emptyChapterNumbers.length;

  const report = {
    total,
    withContent,
    emptyChapterNumbers,
    emptyChapterIds,
    details,
    timestamp: Date.now(),
  };

  console.log(`[DRAFT-INTEGRITY] Report: ${withContent}/${total} have content. Empty: [${emptyChapterNumbers.join(', ')}]`);

  return report;
}

export const DRAFT_INTEGRITY_VERSION = 'draftIntegrityReport-v1';

console.log(`[DRAFT-INTEGRITY] ${DRAFT_INTEGRITY_VERSION} loaded`);
