// Build array of page objects for the flip book preview
// Each page: { type: 'cover'|'title'|'toc'|'chapter'|'back', html, label, chapterIndex? }

import { deduplicateChapters } from '@/lib/chapterDedup';

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    // Scene breaks
    .replace(/^[-*]{3,}\s*$/gm, '<div class="scene-break">• • •</div>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Paragraphs: split on double newlines
    .split(/\n\n+/)
    .map((block) => {
      block = block.trim();
      if (!block) return '';
      if (block.startsWith('<div class="scene-break">')) return block;
      if (block.startsWith('#')) {
        // skip headings — we render chapter headers separately
        return '';
      }
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');
  return html;
}

// Split long chapter content into multiple pages by approximate character count
function splitIntoPages(htmlContent, charsPerPage = 1800) {
  // Split into blocks (paragraphs, scene breaks)
  const blocks = htmlContent.split(/(?=<p>|<div class="scene-break">)/);
  const pages = [];
  let currentPage = '';
  let currentLen = 0;

  for (const block of blocks) {
    const textLen = block.replace(/<[^>]+>/g, '').length;
    if (currentLen + textLen > charsPerPage && currentPage.trim()) {
      pages.push(currentPage);
      currentPage = block;
      currentLen = textLen;
    } else {
      currentPage += block;
      currentLen += textLen;
    }
  }
  if (currentPage.trim()) pages.push(currentPage);
  return pages;
}

export function buildFlipBookPages(project, chapters) {
  const ordered = deduplicateChapters(
    [...chapters]
      .filter((ch) => (ch.content_md || ch.beat_summary))
      .sort((a, b) => a.chapter_number - b.chapter_number)
  );

  const pages = [];

  // Front cover (hard) — use generated cover image if available
  const coverUrl = project?.cover_image_url || project?.cover_art_url || '';
  const frontCoverHtml = coverUrl
    ? `<div class="cover-page front-cover" style="padding:0;background:none;">
        <img src="${escapeHtml(coverUrl)}" alt="Cover" style="width:100%;height:100%;object-fit:cover;" />
      </div>`
    : `<div class="cover-page front-cover">
        <div class="cover-title">${escapeHtml(project?.title || 'Untitled')}</div>
        <div class="cover-subtitle">${escapeHtml(project?.tagline || project?.genre || '')}</div>
        <div class="cover-author">${escapeHtml(project?.author_name || '')}</div>
      </div>`;
  pages.push({
    type: 'cover',
    hard: true,
    label: 'Front Cover',
    html: frontCoverHtml,
  });

  // Title page (soft)
  pages.push({
    type: 'title',
    hard: false,
    label: 'Title Page',
    html: `
      <div class="inner-page title-page">
        <div class="tp-title">${escapeHtml(project?.title || 'Untitled')}</div>
        <div class="tp-subtitle">${escapeHtml(project?.tagline || '')}</div>
        <div class="tp-author">by ${escapeHtml(project?.author_name || 'Author')}</div>
      </div>
    `,
  });

  // Table of contents
  const tocItems = ordered.map((ch) =>
    `<div class="toc-item"><span class="toc-num">Chapter ${ch.chapter_number}</span><span class="toc-title">${escapeHtml(ch.title || '')}</span></div>`
  ).join('');
  pages.push({
    type: 'toc',
    hard: false,
    label: 'Table of Contents',
    html: `
      <div class="inner-page toc-page">
        <div class="toc-header">Contents</div>
        ${tocItems}
      </div>
    `,
  });

  // Chapter pages
  const chapterStartIndices = [];
  for (const ch of ordered) {
    const content = ch.content_md || ch.beat_summary || '';
    const bodyHtml = markdownToHtml(content);
    const contentPages = splitIntoPages(bodyHtml, 1800);

    for (let i = 0; i < contentPages.length; i++) {
      const isFirst = i === 0;
      if (isFirst) chapterStartIndices.push(pages.length);

      const header = isFirst ? `
        <div class="ch-header">
          <div class="ch-number">CHAPTER ${ch.chapter_number}</div>
          <div class="ch-title">${escapeHtml(ch.title || '')}</div>
        </div>
      ` : '';

      pages.push({
        type: 'chapter',
        hard: false,
        label: isFirst ? `Ch. ${ch.chapter_number}: ${ch.title || ''}` : `Ch. ${ch.chapter_number} (cont.)`,
        chapterIndex: ordered.indexOf(ch),
        isChapterStart: isFirst,
        html: `
          <div class="inner-page chapter-page">
            ${header}
            <div class="ch-body${isFirst ? ' first-page' : ''}">${contentPages[i]}</div>
          </div>
        `,
      });
    }
  }

  // If odd number of interior pages, add a blank
  // Total pages including covers should be even for spread display
  const interiorCount = pages.length - 1; // minus front cover
  if (interiorCount % 2 !== 0) {
    pages.push({
      type: 'blank',
      hard: false,
      label: '',
      html: '<div class="inner-page blank-page"></div>',
    });
  }

  // Back cover (hard)
  pages.push({
    type: 'back',
    hard: true,
    label: 'Back Cover',
    html: `
      <div class="cover-page back-cover">
        <div class="back-blurb">${escapeHtml(project?.tagline || project?.seed_concept || '')}</div>
        <div class="back-author">${escapeHtml(project?.author_name || '')}</div>
      </div>
    `,
  });

  return { pages, chapterStartIndices };
}