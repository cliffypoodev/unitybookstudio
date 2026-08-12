/**
 * WAVE2-WORDCOUNT — project-level word-count rollup.
 *
 * Dashboard cards, the library header, and VolumeBiblesView all read
 * project.total_word_count, but nothing ever wrote it — every book showed
 * "0 words" forever. Chapter-level word_count IS maintained at every save,
 * so this helper simply rolls it up (body chapters only — copyright pages
 * and bibliographies don't count toward the manuscript) and stamps the
 * project. Call it after any operation that saves chapter content.
 *
 * Failures are non-fatal by design: a missed rollup just means a slightly
 * stale number on the dashboard, and the next save catches it up.
 */
import { base44 } from '@/api/base44Client';
import { isBodyChapter } from '@/lib/bibliographyGenerator';

export async function refreshProjectWordCount(projectId) {
  if (!projectId) return 0;
  try {
    const chapters = await base44.entities.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
    const total = (chapters || [])
      .filter((ch) => isBodyChapter(ch))
      .reduce((sum, ch) => sum + (Number(ch.word_count) || 0), 0);
    await base44.entities.NovelProject.update(projectId, { total_word_count: total });
    return total;
  } catch (err) {
    console.warn('[WORDCOUNT] Rollup failed for project', projectId, '—', err?.message || err);
    return 0;
  }
}
