// Parse uploaded .docx / .txt files client-side using mammoth (no server upload needed)
import mammoth from 'mammoth';

export async function parseDocxFile(file) {
  let fullText = '';

  if (file.name.endsWith('.txt')) {
    fullText = await file.text();
  } else {
    // .docx or .doc — use mammoth to extract raw text
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    fullText = result.value || '';
  }

  if (!fullText.trim()) {
    throw new Error('No text content found in file');
  }

  // Split into chapters by common heading patterns
  const chapters = splitIntoChapters(fullText);
  const totalWords = countWordsSimple(fullText);
  const estimatedPages = Math.ceil(totalWords / 250);

  return {
    fullText,
    chapters,
    totalWords,
    estimatedPages,
    chapterCount: chapters.length,
  };
}

function splitIntoChapters(text) {
  // Match "Chapter N", "CHAPTER N", "Chapter N: Title", "Part N", "Section N", etc.
  const chapterPattern = /^(chapter\s+[\dIVXivx]+[^\n]*|part\s+[\dIVXivx]+[^\n]*|section\s+[\dIVXivx]+[^\n]*|prologue[^\n]*|epilogue[^\n]*)/gim;
  const matches = [...text.matchAll(chapterPattern)];

  if (matches.length < 2) {
    // No chapter headings found — treat as single chapter
    return [{ chapter_number: 1, title: 'Full Manuscript', content: text.trim(), word_count: countWordsSimple(text) }];
  }

  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const title = matches[i][1].trim();
    const content = text.slice(start + matches[i][0].length, end).trim();
    chapters.push({
      chapter_number: i + 1,
      title,
      content,
      word_count: countWordsSimple(content),
    });
  }

  return chapters;
}

function countWordsSimple(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}