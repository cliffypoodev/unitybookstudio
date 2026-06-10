/**
 * Deduplicates chapters that share the same chapter_number.
 * Keeps the one with the highest word count, discards stubs.
 */
export function deduplicateChapters(chapters) {
  const byNumber = {};
  for (const ch of chapters) {
    const num = ch.chapter_number;
    if (!byNumber[num]) {
      byNumber[num] = ch;
    } else {
      // Keep the one with higher word count
      const existingWords = (byNumber[num].content_md || '').split(/\s+/).length;
      const newWords = (ch.content_md || '').split(/\s+/).length;
      if (newWords > existingWords) {
        byNumber[num] = ch;
      }
    }
  }
  return Object.values(byNumber).sort((a, b) => a.chapter_number - b.chapter_number);
}