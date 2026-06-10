import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';

/**
 * Load manuscript chapters from either a project or parsed upload.
 * Returns a normalized array of { chapter_number, title, content, id?, word_count }
 */
export async function loadManuscriptChapters(source, project, chapters, uploadParsed) {
  if (source === 'project' && project && chapters?.length) {
    const body = chapters
      .filter(ch => chapterHasContent(ch) && isBodyChapter(ch))
      .sort((a, b) => a.chapter_number - b.chapter_number);

    const result = [];
    for (const ch of body) {
      const content = await resolveChapterContent(ch);
      if (content && content.length > 50) {
        result.push({
          chapter_number: ch.chapter_number,
          title: ch.title || 'Chapter ' + ch.chapter_number,
          content,
          id: ch.id,
          word_count: countWords(content),
        });
      }
    }
    return result;
  }

  if (source === 'upload' && uploadParsed?.chapters) {
    return uploadParsed.chapters.map((ch, i) => ({
      chapter_number: i + 1,
      title: ch.title || 'Chapter ' + (i + 1),
      content: ch.content || '',
      word_count: countWords(ch.content || ''),
    }));
  }

  return [];
}

/**
 * Get full manuscript text from normalized chapters
 */
export function getFullText(normalizedChapters) {
  return normalizedChapters.map(ch => ch.content).join('\n\n');
}