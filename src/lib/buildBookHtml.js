// =============================================================
// buildBookHtml.js — Phase 2F Export Output Upgrade
//
// Purpose:
// - Build clean manuscript HTML for preview / PDF / print.
// - Build Markdown and plain-text exports.
// - Preserve manuscript structure better:
//   headings, scene breaks, blockquotes, lists, links, bold, italic,
//   underline HTML fallback, strikethrough, front matter, back matter.
// - Keep compatibility with existing content_md storage.
// - Avoid new dependencies.
// =============================================================

import { deduplicateChapters } from '@/lib/chapterDedup';
import { isFrontMatter, isBackMatter, isBodyChapter } from '@/lib/bibliographyGenerator';
import { mdToHtml, stripHtmlToText } from '@/lib/mdHtmlConvert';

function esc(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numberToWord(n) {
  const num = Number(n || 0);

  const words = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
    'Twenty',
    'Twenty-One',
    'Twenty-Two',
    'Twenty-Three',
    'Twenty-Four',
    'Twenty-Five',
    'Twenty-Six',
    'Twenty-Seven',
    'Twenty-Eight',
    'Twenty-Nine',
    'Thirty',
  ];

  return words[num] || String(num || '');
}

function safeId(value = '') {
  return String(value || 'section')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function stripExportFlags(text = '') {
  return String(text || '')
    .replace(/\s*\[VERIFY:[^\]]*\]/g, '')
    .replace(/\[The following account is a composite[^\]]*\]\s*/g, '')
    .replace(/\[Composite character[^\]]*\]\s*/gi, '')
    .replace(/\[Source needed[^\]]*\]\s*/gi, '')
    .trim();
}

function stripTopChapterHeading(text = '') {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  while (lines.length && !lines[0].trim()) {
    lines.shift();
  }

  if (!lines.length) return '';

  const first = lines[0].trim();

  // Remove a repeated chapter title heading when the export already renders the title separately.
  if (/^#{1,3}\s+/.test(first)) {
    lines.shift();
    return lines.join('\n').trim();
  }

  // Also strip common generated headings:
  // "Chapter 1: Title", "Chapter One — Title", etc.
  if (/^chapter\s+([0-9]+|[a-z-]+)\s*[:—-]\s+/i.test(first)) {
    lines.shift();
    return lines.join('\n').trim();
  }

  return String(text || '').trim();
}

function normalizeSceneBreaks(text = '') {
  return String(text || '')
    .replace(/^\s*—{3,}\s*$/gm, '---')
    .replace(/^\s*–{3,}\s*$/gm, '---')
    .replace(/^\s*\*\s*\*\s*\*\s*$/gm, '---')
    .replace(/^\s*•\s*•\s*•\s*$/gm, '---')
    .replace(/^\s*⁂\s*$/gm, '---');
}

function removeDangerousHtml(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/javascript:/gi, '');
}

function normalizeHtmlForBook(html = '') {
  return removeDangerousHtml(html)
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p><br\s*\/?><\/p>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>')
    .replace(/<hr([^>]*)>/gi, '<hr class="scene-break" />')
    .replace(/<strong>\s*<\/strong>/gi, '')
    .replace(/<em>\s*<\/em>/gi, '')
    .trim();
}

function addFirstParagraphClasses(html = '') {
  let output = String(html || '');

  // Mark the first regular paragraph in the section.
  let markedFirst = false;

  output = output.replace(/<p(?![^>]*class=)([^>]*)>/i, (match, attrs) => {
    if (markedFirst) return match;
    markedFirst = true;
    return `<p class="firstPara"${attrs || ''}>`;
  });

  output = output.replace(/<p\s+class="([^"]*)"/i, (match, className) => {
    if (markedFirst) return match;

    markedFirst = true;

    if (String(className).split(/\s+/).includes('firstPara')) {
      return match;
    }

    return `<p class="${className} firstPara"`;
  });

  // Mark first paragraph after every scene break.
  output = output.replace(
    /(<hr class="scene-break" \/>\s*)<p(?![^>]*class=)([^>]*)>/gi,
    '$1<p class="firstPara"$2>'
  );

  output = output.replace(
    /(<hr class="scene-break" \/>\s*)<p\s+class="([^"]*)"/gi,
    (match, before, className) => {
      if (String(className).split(/\s+/).includes('firstPara')) {
        return match;
      }

      return `${before}<p class="${className} firstPara"`;
    }
  );

  return output;
}

function unwrapSection(html = '') {
  return String(html || '')
    .replace(/^<section class="chapter">/i, '')
    .replace(/<\/section>\s*$/i, '')
    .trim();
}

function getChapterContent(chapter) {
  return String(chapter?.content_md || chapter?.beat_summary || '');
}

function hasMeaningfulContent(chapter) {
  return stripExportFlags(getChapterContent(chapter)).trim().length > 0;
}

function sortChapters(chapters = []) {
  return [...chapters].sort((a, b) => {
    const aNum = Number(a?.chapter_number || 0);
    const bNum = Number(b?.chapter_number || 0);
    return aNum - bNum;
  });
}

function getSectionTitle(chapter, fallback = 'Untitled Section') {
  return String(chapter?.title || fallback).trim();
}

function resolveHeaderContent(type, project, chapter) {
  if (type === 'Book Title') return esc(project?.title || '');
  if (type === 'Author Name') return esc(project?.author_name || '');
  if (type === 'Chapter Title') return esc(chapter?.title || '');
  if (type === 'Chapter Number') return esc(chapter?.chapter_number || '');
  return '';
}

function buildRunningMatter(project, chapter, publishSettings = {}) {
  const verso = resolveHeaderContent(publishSettings.versoPageHeaders, project, chapter);
  const recto = resolveHeaderContent(publishSettings.rectoPageHeaders, project, chapter);
  const chapterNumber = esc(chapter?.chapter_number || '');

  return {
    header: `<div class="preview-running-header"><span>${verso}</span><span>${recto}</span></div>`,
    footer: `<div class="preview-running-footer"><span>${chapterNumber}</span></div>`,
  };
}

/**
 * Converts a chapter's stored manuscript content into export HTML.
 *
 * Kept as a named export because other publishing components may already
 * import it. This now delegates the actual markdown conversion to the upgraded
 * mdHtmlConvert bridge, then applies book/export-specific cleanup.
 */
export function parseChapterToHtml(markdown, options = {}) {
  const {
    stripFirstHeading = true,
    emptyText = '[No content]',
  } = options;

  let source = stripExportFlags(markdown || '');

  if (stripFirstHeading) {
    source = stripTopChapterHeading(source);
  }

  source = normalizeSceneBreaks(source);

  if (!source.trim()) {
    return `<section class="chapter"><p class="firstPara">${esc(emptyText)}</p></section>`;
  }

  let html = mdToHtml(source);
  html = normalizeHtmlForBook(html);
  html = addFirstParagraphClasses(html);

  return `<section class="chapter">${html}</section>`;
}

function renderTitlePage(project) {
  return `
    <div class="front-matter title-page" id="title-page">
      <div class="title-page-wrap">
        <h1 class="title">${esc(project?.title || 'Untitled')}</h1>
        ${project?.tagline ? `<h2 class="subtitle">${esc(project.tagline)}</h2>` : ''}
        ${project?.author_name ? `<p class="author">${esc(project.author_name)}</p>` : ''}
      </div>
    </div>
  `;
}

function renderDefaultCopyright(project) {
  return `
    <div class="front-matter copyright-page" id="copyright-page">
      <div class="ugc">
        <p>Copyright &copy; ${new Date().getFullYear()} ${esc(project?.author_name || '')}</p>
        <p>All rights reserved.</p>
      </div>
    </div>
  `;
}

function renderFrontMatterChapter(chapter) {
  const content = getChapterContent(chapter);

  if (!stripExportFlags(content).trim()) return '';

  const title = getSectionTitle(chapter, '');
  const bodyHtml = unwrapSection(
    parseChapterToHtml(content, {
      stripFirstHeading: false,
      emptyText: '',
    })
  );

  const hasHeadingInContent = /^#{1,6}\s+/m.test(stripExportFlags(content).trim()) || /^<h[1-6][\s>]/i.test(stripExportFlags(content).trim());

  return `
    <div class="front-matter front-matter-section" id="fm-${safeId(chapter?.id || chapter?.chapter_number || title)}">
      <div class="ugc front-matter-ugc">
        ${title && !hasHeadingInContent ? `<h1 class="front-matter-title">${esc(title)}</h1>` : ''}
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderToc(bodyChapters) {
  if (!bodyChapters.length) return '';

  return `
    <div class="front-matter toc" id="toc">
      <div class="toc-wrap">
        <h1 class="toc-title">Contents</h1>
        <ul class="toc-list">
          ${bodyChapters
            .map((chapter, index) => {
              const number = chapter?.chapter_number || index + 1;
              const title = getSectionTitle(chapter, `Chapter ${number}`);

              return `
                <li>
                  <a href="#chapter-${safeId(number)}">
                    <span class="toc-chapter-number">${esc(number)}</span>
                    <span class="toc-chapter-title">${esc(title)}</span>
                  </a>
                </li>
              `;
            })
            .join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderBodyChapter(project, chapter, index, publishSettings = {}) {
  const chapterNumber = chapter?.chapter_number || index + 1;
  const chapterTitle = getSectionTitle(chapter, `Chapter ${chapterNumber}`);
  const content = getChapterContent(chapter);

  const bodyHtml = stripExportFlags(content).trim()
    ? unwrapSection(
        parseChapterToHtml(content, {
          stripFirstHeading: true,
          emptyText: '[No content]',
        })
      )
    : '<p class="firstPara">[No content]</p>';

  const { header, footer } = buildRunningMatter(project, chapter, publishSettings);

  return `
    <div class="chapter standard" id="chapter-${safeId(chapterNumber)}">
      ${header}
      <div class="chapter-title-wrap">
        <h3 class="chapter-number">Chapter ${esc(numberToWord(chapterNumber))}</h3>
        <h2 class="chapter-title">${esc(chapterTitle)}</h2>
      </div>
      <div class="ugc chapter-ugc">
        ${bodyHtml}
      </div>
      ${footer}
    </div>
  `;
}

function renderBackMatterChapter(chapter) {
  const content = getChapterContent(chapter);

  if (!stripExportFlags(content).trim()) return '';

  const title = getSectionTitle(chapter, 'Back Matter');
  const bodyHtml = unwrapSection(
    parseChapterToHtml(content, {
      stripFirstHeading: true,
      emptyText: '',
    })
  );

  return `
    <div class="back-matter" id="bm-${safeId(chapter?.id || chapter?.chapter_number || title)}">
      <div class="ugc back-matter-ugc">
        <h1 class="back-matter-title">${esc(title)}</h1>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderAboutAuthor(project, backMatterChapters) {
  const hasAboutAuthor = backMatterChapters.some((chapter) =>
    String(chapter?.title || '').toLowerCase().includes('about the author')
  );

  if (!project?.author_name || hasAboutAuthor) return '';

  return `
    <div class="back-matter" id="about-author">
      <div class="ugc back-matter-ugc">
        <h1 class="back-matter-title">About the Author</h1>
        <p>${esc(project.author_name)} is the author of ${esc(project.title || 'this work')}.</p>
      </div>
    </div>
  `;
}

export function buildBookHtml(project = {}, chapters = [], publishSettings = {}) {
  const dedupedChapters = deduplicateChapters(sortChapters(chapters));

  const frontMatterChapters = dedupedChapters.filter((chapter) => isFrontMatter(chapter));
  const bodyChapters = dedupedChapters.filter((chapter) => isBodyChapter(chapter));
  const backMatterChapters = dedupedChapters.filter((chapter) => isBackMatter(chapter));

  let html = '';

  html += renderTitlePage(project);

  if (frontMatterChapters.length) {
    html += frontMatterChapters.map(renderFrontMatterChapter).join('');
  } else {
    html += renderDefaultCopyright(project);
  }

  html += renderToc(bodyChapters);

  html += bodyChapters
    .map((chapter, index) => renderBodyChapter(project, chapter, index, publishSettings))
    .join('');

  html += backMatterChapters.map(renderBackMatterChapter).join('');

  html += renderAboutAuthor(project, backMatterChapters);

  return html;
}

function markdownSectionForChapter(chapter) {
  const content = stripExportFlags(getChapterContent(chapter));

  if (isFrontMatter(chapter)) {
    const title = getSectionTitle(chapter, '');

    if (!content.trim()) return '';

    // If content already begins with a heading, do not add another.
    if (/^#{1,6}\s+/m.test(content.trim())) {
      return content.trim();
    }

    return title ? `# ${title}\n\n${content}`.trim() : content.trim();
  }

  if (isBackMatter(chapter)) {
    const title = getSectionTitle(chapter, 'Back Matter');
    const cleaned = stripTopChapterHeading(content);
    return `# ${title}\n\n${cleaned}`.trim();
  }

  const chapterNumber = chapter?.chapter_number || '';
  const title = getSectionTitle(chapter, `Chapter ${chapterNumber}`);
  const cleaned = stripTopChapterHeading(content);

  return `## Chapter ${chapterNumber}: ${title}\n\n${cleaned}`.trim();
}

export function buildMarkdownExport(project = {}, chapters = []) {
  const sorted = deduplicateChapters(sortChapters(chapters));
  const front = sorted.filter((chapter) => isFrontMatter(chapter));
  const body = sorted.filter((chapter) => isBodyChapter(chapter));
  const back = sorted.filter((chapter) => isBackMatter(chapter));
  const ordered = [...front, ...body, ...back];

  const parts = [
    `# ${project?.title || 'Untitled Project'}`,
    project?.tagline ? `\n${project.tagline}` : '',
    project?.author_name ? `\nby ${project.author_name}` : '',
    '',
    ...ordered.map(markdownSectionForChapter).filter(Boolean),
  ];

  return parts
    .join('\n\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function buildPlainTextExport(project = {}, chapters = []) {
  const markdown = buildMarkdownExport(project, chapters);

  return stripHtmlToText(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+[.)]\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export function buildHtmlDocument(project = {}, chapters = [], publishSettings = {}, css = '') {
  const body = buildBookHtml(project, chapters, publishSettings);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(project?.title || 'Untitled')}</title>
<style>
${css || ''}
</style>
</head>
<body>
<div class="manuscript-preview-root">
${body}
</div>
</body>
</html>`;
}