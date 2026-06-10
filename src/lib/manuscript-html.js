// Pressbooks HTML structure + Orca buildBook pipeline
// Produces semantic HTML with .firstPara for drop caps, <section class="chapter">,
// and Pressbooks class conventions for front/back matter.

function esc(text = '') {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Orca rehypeFirstParagraph equivalent — marks first <p> of each chapter and
// first <p> after each scene break with class="firstPara"
function renderChapterBody(contentMd = '', sceneBreakGlyph = '***') {
  const blocks = contentMd.split(/\n\n+/).filter(Boolean);
  let isFirstPara = true;
  const html = [];

  for (const block of blocks) {
    const trimmed = block.trim();

    // Detect scene breaks: ***, ---, ⁂, •••, #, ♥, ✦, or any configured glyph
    const breakPatterns = ['***', '---', '⁂', '• • •', '#', '♥', '✦', sceneBreakGlyph];
    if (breakPatterns.includes(trimmed) || /^[-*#]{3,}$/.test(trimmed)) {
      html.push('<hr class="scene-break" />');
      isFirstPara = true;
      continue;
    }

    // Handle markdown headings within content (rare but possible)
    if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#+)/)[1].length;
      const text = trimmed.replace(/^#+\s*/, '');
      html.push(`<h${level}>${esc(text)}</h${level}>`);
      isFirstPara = true;
      continue;
    }

    // Paragraph — apply firstPara class for drop cap targeting
    const safe = esc(trimmed).replace(/\n/g, '<br />');
    const cls = isFirstPara ? ' class="firstPara"' : '';
    html.push(`<p${cls}>${safe}</p>`);
    isFirstPara = false;
  }

  return html.join('\n');
}

function numberToWord(n) {
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
    'Twenty-One', 'Twenty-Two', 'Twenty-Three', 'Twenty-Four', 'Twenty-Five', 'Twenty-Six', 'Twenty-Seven', 'Twenty-Eight', 'Twenty-Nine', 'Thirty',
    'Thirty-One', 'Thirty-Two', 'Thirty-Three', 'Thirty-Four', 'Thirty-Five', 'Thirty-Six', 'Thirty-Seven', 'Thirty-Eight', 'Thirty-Nine', 'Forty',
    'Forty-One', 'Forty-Two', 'Forty-Three', 'Forty-Four', 'Forty-Five', 'Forty-Six', 'Forty-Seven', 'Forty-Eight', 'Forty-Nine', 'Fifty'];
  return words[n] || String(n);
}

function numberToRoman(n) {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

function formatChapterNumber(num, format) {
  if (format === 'word') return `Chapter ${numberToWord(num)}`;
  if (format === 'roman') return `Chapter ${numberToRoman(num)}`;
  if (format === 'none') return '';
  return `Chapter ${num}`;
}

function resolveHeaderContent(type, project, chapter) {
  if (type === 'bookTitle') return esc(project.title || '');
  if (type === 'authorName') return esc(project.author_name || '');
  if (type === 'chapterTitle') return esc(chapter?.title || '');
  return '';
}

// --- Front matter (Pressbooks HTML structure) ---
function renderFrontMatter(project, theme) {
  const parts = [];

  if (theme.sections.halfTitle) {
    parts.push(`<div class="front-matter" id="half-title"><h1 class="title">${esc(project.title || 'Untitled')}</h1></div>`);
  }
  if (theme.sections.titlePage) {
    parts.push(`<div class="front-matter title-page" id="title-page"><div class="title-page-wrap"><h1 class="title">${esc(project.title || 'Untitled')}</h1><h2 class="subtitle">${esc(project.tagline || '')}</h2><p class="author">${esc(project.author_name || '')}</p></div></div>`);
  }
  if (theme.sections.copyright) {
    parts.push(`<div class="front-matter copyright-page" id="copyright-page"><div class="ugc"><p>Copyright © ${new Date().getFullYear()} ${esc(project.author_name || '')}</p><p>All rights reserved.</p></div></div>`);
  }
  if (theme.sections.dedication && theme.dedicationText) {
    parts.push(`<div class="front-matter" id="dedication"><p>${esc(theme.dedicationText)}</p></div>`);
  }
  if (theme.sections.epigraph && theme.epigraphText) {
    parts.push(`<div class="front-matter" id="epigraph"><blockquote>${esc(theme.epigraphText)}</blockquote></div>`);
  }

  return parts.join('\n');
}

// --- TOC with Pressbooks structure ---
function renderTOC(chapters, theme) {
  if (!theme.sections.toc) return '';
  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const items = sorted.map((ch) =>
    `<li><a href="#chapter-${ch.chapter_number}"><span class="toc-chapter-title">${esc(ch.title || `Chapter ${ch.chapter_number}`)}</span></a></li>`
  ).join('\n');

  return `<div class="front-matter toc" id="toc"><div class="toc-wrap"><h1 class="toc-title">Contents</h1><ul class="toc-list">${items}</ul></div></div>`;
}

// --- Back matter ---
function renderBackMatter(theme) {
  if (!theme.sections.aboutAuthor || !theme.aboutAuthorText) return '';
  return `<div class="back-matter" id="about-author"><div class="ugc"><h1 class="back-matter-title">About the Author</h1><p>${esc(theme.aboutAuthorText)}</p></div></div>`;
}

// --- Chapter HTML (Orca buildBook + rehypeSection pattern) ---
function renderChapter(project, chapter, theme, includeRunningHeaders = true) {
  const chapterNum = formatChapterNumber(chapter.chapter_number, theme.chapterNumberFormat);
  const versoContent = resolveHeaderContent(theme.versoHeader, project, chapter);
  const rectoContent = resolveHeaderContent(theme.rectoHeader, project, chapter);

  const runningHeader = includeRunningHeaders
    ? `<div class="preview-running-header"><span>${versoContent}</span><span>${rectoContent}</span></div>`
    : '';

  const runningFooter = includeRunningHeaders
    ? `<div class="preview-running-footer"><span>${chapter.chapter_number}</span></div>`
    : '';

  return `
<div class="chapter standard" id="chapter-${chapter.chapter_number}">
  ${runningHeader}
  <div class="chapter-title-wrap">
    ${chapterNum ? `<h3 class="chapter-number">${esc(chapterNum)}</h3>` : ''}
    <h2 class="chapter-title">${esc(chapter.title || `Chapter ${chapter.chapter_number}`)}</h2>
  </div>
  <div class="ugc chapter-ugc">
    ${renderChapterBody(chapter.content_md || chapter.beat_summary || '', theme.sceneBreak)}
  </div>
  ${runningFooter}
</div>`;
}

// --- Main builder ---
export function buildManuscriptHtml(project, chapters, theme, selectedChapterId = null) {
  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  const toRender = selectedChapterId ? sorted.filter((ch) => ch.id === selectedChapterId) : sorted;
  const includeHeaders = !selectedChapterId || toRender.length === 1;

  const chapterHtml = toRender.map((ch) => renderChapter(project, ch, theme, includeHeaders)).join('\n');
  const frontMatter = renderFrontMatter(project, theme);
  const toc = renderTOC(sorted, theme);
  const backMatter = renderBackMatter(theme);

  return `<div class="manuscript-preview-root">${frontMatter}${toc}${chapterHtml}${backMatter}</div>`;
}

// --- Export helpers ---
export function buildMarkdownManuscript(project, chapters) {
  const sorted = [...chapters].sort((a, b) => a.chapter_number - b.chapter_number);
  return [`# ${project.title || 'Untitled Project'}`, '', project.tagline || '', '',
    ...sorted.flatMap((ch) => [`## Chapter ${ch.chapter_number}: ${ch.title}`, '', ch.content_md || ch.beat_summary || '', ''])
  ].join('\n');
}

export function buildPlainTextManuscript(project, chapters) {
  return buildMarkdownManuscript(project, chapters).replace(/^#+\s/gm, '').replace(/\*\*/g, '');
}