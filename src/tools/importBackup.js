/**
 * Import UBS Backup — Extracts .docx files from a zip backup and creates
 * NovelProject + Chapter records in IndexedDB.
 *
 * Run this in the browser console at http://localhost:5180 after the app loads.
 *
 * Usage:
 *   1. Open the app in your browser
 *   2. Open DevTools console (Cmd+Option+J)
 *   3. Paste and run: await import('/src/tools/importBackup.js')
 *   4. A file picker opens — select UBS-Backup-2026-05-31.zip
 *   5. Wait for import to complete
 */

import { base44 } from '@/api/base44Client';

// Dynamically load mammoth (already in package.json) for .docx parsing
async function loadMammoth() {
  const mammoth = await import('mammoth');
  return mammoth.default || mammoth;
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Parse a .docx buffer into plain text paragraphs using mammoth.
 */
async function docxToText(arrayBuffer) {
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

/**
 * Split manuscript text into chapters.
 * Looks for lines starting with "Chapter X" or all-caps headings.
 */
function splitIntoChapters(fullText, projectTitle) {
  const lines = fullText.split('\n');

  // Find chapter boundaries
  const chapterPattern = /^(chapter\s+\d+|chapter\s+[ivxlcdm]+|part\s+\d+|part\s+[ivxlcdm]+)\b/i;
  const boundaries = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (chapterPattern.test(trimmed)) {
      boundaries.push({ lineIndex: i, title: trimmed });
    }
  }

  // If no chapter headings found, treat as single chapter
  if (boundaries.length === 0) {
    return [{
      chapter_number: 1,
      title: projectTitle || 'Full Manuscript',
      content: fullText.trim(),
    }];
  }

  const chapters = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].lineIndex;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].lineIndex : lines.length;

    // The chapter title is the first line, content is the rest
    const chapterLines = lines.slice(start + 1, end);
    const content = chapterLines.join('\n').trim();

    // Extract a clean title — take the heading line, optionally followed by a subtitle
    let title = boundaries[i].title;
    // If the next non-empty line looks like a subtitle, include it
    const nextLine = lines[start + 1]?.trim();
    if (nextLine && nextLine.length < 100 && !nextLine.includes('.') && nextLine.length > 0) {
      // Check if it's a subtitle (short, no periods)
      const words = nextLine.split(/\s+/).length;
      if (words <= 10) {
        title = `${boundaries[i].title}: ${nextLine}`;
      }
    }

    chapters.push({
      chapter_number: i + 1,
      title,
      content,
    });
  }

  // If there's content before the first chapter heading, add it as "Front Matter"
  if (boundaries[0].lineIndex > 0) {
    const frontMatter = lines.slice(0, boundaries[0].lineIndex).join('\n').trim();
    if (frontMatter.length > 100) {
      chapters.unshift({
        chapter_number: 0,
        title: 'Front Matter',
        content: frontMatter,
      });
      // Re-number
      chapters.forEach((ch, i) => { ch.chapter_number = i; });
    }
  }

  return chapters;
}

/**
 * Create a project title from a filename.
 */
function titleFromFilename(filename) {
  return filename
    .replace(/\.docx$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Count words in text.
 */
function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Main import function.
 */
export async function importBackupZip(file) {
  console.log('[IMPORT] Starting backup import...');

  // Load JSZip from CDN if not already loaded
  if (!window.JSZip) {
    console.log('[IMPORT] Loading JSZip...');
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  const zip = await window.JSZip.loadAsync(file);
  const docxFiles = Object.keys(zip.files).filter(f => f.endsWith('.docx') && !f.startsWith('__MACOSX'));

  console.log(`[IMPORT] Found ${docxFiles.length} .docx files in backup`);

  const results = { success: 0, failed: 0, errors: [] };
  const mammoth = await loadMammoth();

  for (let i = 0; i < docxFiles.length; i++) {
    const filename = docxFiles[i];
    const title = titleFromFilename(filename.split('/').pop());

    try {
      console.log(`[IMPORT] ${i + 1}/${docxFiles.length}: "${title}"...`);

      // Extract .docx content
      const arrayBuffer = await zip.files[filename].async('arraybuffer');
      const rawText = await docxToText(arrayBuffer);

      if (!rawText || rawText.trim().length < 10) {
        console.warn(`[IMPORT] Skipping "${title}" — no text content`);
        results.failed++;
        results.errors.push(`${title}: empty or no text`);
        continue;
      }

      const totalWords = countWords(rawText);

      // Split into chapters
      const chapters = splitIntoChapters(rawText, title);

      // Create the project
      const now = nowISO();
      const project = await base44.entities.NovelProject.create({
        title,
        project_type: 'fiction',
        book_type: 'fiction',
        status: 'imported',
        genre: '',
        author_name: '',
        chapter_target: chapters.length,
        word_count_total: totalWords,
        seed_concept: `Imported from Base44 backup on ${new Date().toLocaleDateString()}`,
        beat_style: 'Fast-Paced Thriller',
        pov_mode: 'Third Person Limited',
        tense: 'Past',
        language_intensity: 2,
      });

      console.log(`[IMPORT]   Project created: id=${project.id}, ${totalWords} words`);

      // Create chapters
      for (const ch of chapters) {
        const chapterData = {
          project_id: project.id,
          chapter_number: ch.chapter_number,
          title: ch.title,
          status: 'completed',
          content_md: ch.content,
          content_md_word_count: countWords(ch.content),
          content_md_char_count: ch.content.length,
          content_storage_version: 'import-from-backup',
        };

        await base44.entities.Chapter.create(chapterData);
      }

      console.log(`[IMPORT]   ${chapters.length} chapters created`);
      results.success++;

    } catch (err) {
      console.error(`[IMPORT] Failed: "${title}":`, err);
      results.failed++;
      results.errors.push(`${title}: ${err.message}`);
    }
  }

  console.log(`[IMPORT] ============================`);
  console.log(`[IMPORT] COMPLETE`);
  console.log(`[IMPORT]   Success: ${results.success}/${docxFiles.length}`);
  console.log(`[IMPORT]   Failed:  ${results.failed}/${docxFiles.length}`);
  if (results.errors.length > 0) {
    console.log(`[IMPORT]   Errors:`);
    results.errors.forEach(e => console.log(`[IMPORT]     - ${e}`));
  }
  console.log(`[IMPORT] ============================`);
  console.log(`[IMPORT] Refresh the page to see your projects on the Dashboard.`);

  return results;
}

/**
 * Auto-run: open file picker and import.
 */
async function run() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log(`[IMPORT] Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    const results = await importBackupZip(file);
    alert(`Import complete!\n\n✅ ${results.success} projects imported\n❌ ${results.failed} failed\n\nRefresh the page to see them.`);
  };

  input.click();
}

run();
