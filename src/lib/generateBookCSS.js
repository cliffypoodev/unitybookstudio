// =============================================================
// SOURCE: zachhannum/orca — app/renderer/pagedjs/usePagedCss.ts
// Adapted from Zustand hook to pure function for Base44
// Enhanced with pressbooks/buckram @page patterns
// =============================================================

import { parseTrimSize, getLineHeightValue } from './publishConstants';

export function generateBookCSS(ps, bookTitle = '', authorName = '', format = 'pdf') {
  let css = '';
  const lineHeightValue = getLineHeightValue(ps.lineHeight);
  const dim = parseTrimSize(ps.trimSize);

  // Lead-in CSS
  const leadInCSS = (() => {
    switch (ps.leadIn) {
      case 'Italics': return 'font-style: italic;';
      case 'Small Caps': return 'font-variant: small-caps;';
      default: return '';
    }
  })();

  // Page header content
  const getPageHeader = (headerType) => {
    switch (headerType) {
      case 'Author Name': return `content: '${authorName}';`;
      case 'Book Title': return `content: '${bookTitle}';`;
      case 'Chapter Title': return `content: string(chapterTitle);`;
      default: return "content: '';";
    }
  };

  // --- Body + paragraphs ---
  css += `
    .manuscript-preview-root {
      font-family: '${ps.paragraphFont}', serif;
      font-size: ${format === 'web' ? Math.max(ps.fontSize, 13) : ps.fontSize}pt;
      line-height: ${format === 'web' ? Math.max(parseFloat(lineHeightValue), 1.5) : lineHeightValue};
      color: #171717;
      orphans: 2; widows: 2;
      hyphens: auto; text-justify: inter-word;
    }
    section p, .chapter-ugc p {
      text-align: justify;
      line-height: ${lineHeightValue};
      font-size: ${ps.fontSize}pt;
      font-family: '${ps.paragraphFont}', serif;
      orphans: 2; widows: 2; hyphens: auto;
      font-weight: 400; margin: 0;
      ${ps.paragraphBreak === 'Indented'
        ? 'text-indent: 2em;'
        : 'text-indent: 0; margin-bottom: 0.8em;'
      }
    }
    .chapter-ugc p.firstPara { text-indent: 0; }
  `;

  // --- Blockquotes ---
  css += `
    blockquote p { text-align: left; font-style: italic; text-indent: unset; }
    blockquote { font-size: 0.9em; line-height: 1.2em; margin: 1em; }
  `;

  // --- Lead-in ---
  if (leadInCSS) {
    css += `.firstPara::first-line, .chapter-ugc p.firstPara::first-line { ${leadInCSS} }\n`;
  }

  // --- Drop cap ---
  if (ps.dropCap) {
    css += `
      .firstPara::first-letter, .chapter-ugc p.firstPara::first-letter {
        ${ps.dropCapFont && ps.dropCapEnableAdvancedSettings ? `font-family: '${ps.dropCapFont}', serif;` : ''}
        float: left; font-size: 5em; font-variant: normal; font-style: normal;
        margin: 0.1em 0.1em 0.1em 0;
        ${ps.dropCapEnableAdvancedSettings
          ? `line-height: ${ps.dropCapLineHeight}; margin-bottom: ${ps.dropCapBottomMargin}em;`
          : 'line-height: 0.65;'}
      }
      .firstPara, .chapter-ugc p.firstPara { text-indent: 0em !important; }
    `;
  }

  // --- Chapter titles ---
  css += `
    .chapter-title-wrap { margin-top: 1.5in; margin-bottom: 0.5in; text-align: center; }
    .chapter-title-wrap .chapter-number {
      display: block; font-family: '${ps.paragraphFont}', serif;
      font-size: 1em; font-weight: normal; text-align: center;
      letter-spacing: 0.1em; margin-bottom: 0.5em; color: #4b5563;
    }
    .chapter-title-wrap .chapter-title {
      display: block; font-family: '${ps.paragraphFont}', serif;
      font-size: 1.4em; font-weight: normal; text-align: center;
      hyphens: none; letter-spacing: 0.05em;
      string-set: chapterTitle content(text);
    }
    h1 { font-family: '${ps.paragraphFont}', serif; font-size: 18pt; text-align: center; letter-spacing: 0.1em; font-weight: 300; }
    h2 { font-family: '${ps.paragraphFont}', serif; font-size: 15pt; text-align: center; font-weight: 400; letter-spacing: 0.1em; margin-bottom: 0.5in; }
  `;

  // --- @page rules (PDF only) ---
  if (format === 'pdf') {
    css += `
      @page { size: ${dim.w}in ${dim.h}in; margin-top: ${ps.topMargin}in; margin-bottom: ${ps.bottomMargin}in; font-family: '${ps.paragraphFont}', serif; font-size: ${ps.fontSize}pt; }
      @page :left {
        margin-right: ${ps.insideMargin}in; margin-left: ${ps.outsideMargin}in;
        @top-left { vertical-align: center; content: counter(page); }
        @top-center { vertical-align: center; ${getPageHeader(ps.versoPageHeaders)} font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; }
      }
      @page :right {
        margin-left: ${ps.insideMargin}in; margin-right: ${ps.outsideMargin}in;
        @top-right { vertical-align: center; content: counter(page); }
        @top-center { vertical-align: center; ${getPageHeader(ps.rectoPageHeaders)} font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; }
      }
      section { page: chapter; page-break-after: always; }
      @page chapter:first {
        @top-right { content: ''; } @top-left { content: ''; } @top-center { content: ''; }
        ${ps.dropFolio ? '@bottom-center { vertical-align: center; content: counter(page); }' : ''}
      }
      .front-matter { page: frontmatter; }
      @page frontmatter {
        @bottom-center { content: counter(page, lower-roman); }
        @top-left { content: ''; } @top-right { content: ''; } @top-center { content: ''; }
      }
    `;
  }

  // --- Web preview container ---
  if (format === 'web') {
    css += `
      .manuscript-preview-root { max-width: ${dim.w}in; margin: 0 auto; background: white; }
      .chapter, .front-matter, .back-matter {
        padding: ${ps.topMargin}in ${ps.outsideMargin}in ${ps.bottomMargin}in ${ps.insideMargin}in;
        break-before: page; page-break-before: always;
      }
      .chapter:first-of-type, .front-matter:first-child { break-before: auto; page-break-before: auto; }
    `;
  }

  // --- Scene breaks ---
  css += `
    hr, hr.scene-break { border: none; }
    hr::before, hr.scene-break::before {
      content: ${ps.sceneBreak === 'None' ? "' '" : `'${ps.sceneBreak}'`};
      display: block; text-align: center; margin: 0.9em 0; letter-spacing: 0.4em; color: #6b7280; font-size: 0.9em;
    }
  `;

  // --- Front/back matter ---
  css += `
    .front-matter { text-align: center; }
    .front-matter .title-page-wrap { padding-top: 30%; }
    .front-matter .title-page-wrap .title { font-family: '${ps.paragraphFont}', serif; font-size: 2em; font-weight: 400; margin: 0 0 0.5em; }
    .front-matter .title-page-wrap .subtitle { font-size: 1.1em; font-style: italic; color: #6b7280; margin: 0 0 1em; }
    .front-matter .title-page-wrap .author { font-size: 1em; color: #4b5563; letter-spacing: 0.1em; }
    .front-matter.copyright-page { font-size: 0.85em; color: #6b7280; padding-top: 20%; }
    .front-matter.copyright-page p { margin: 0.25em 0; }
    .front-matter.toc .toc-title { font-size: 1.4em; margin: 0 0 1em; font-weight: 400; }
    .toc-list { list-style: none; padding: 0; margin: 0; text-align: left; }
    .toc-list li { padding: 0.35em 0; border-bottom: 1px dotted #d1d5db; }
    .toc-list li a { text-decoration: none; color: inherit; }
    .back-matter { text-align: left; page-break-before: always; }
    .back-matter .back-matter-title { font-family: '${ps.paragraphFont}', serif; font-size: 1.2em; text-align: center; margin-top: 1.5in; margin-bottom: 0.5in; }
    .ugc { margin-top: 0; }
    .chapter-ugc p:first-of-type { text-indent: 0; }
    #toc ul { list-style: none; margin: 0; padding: 0; line-height: 1.6em; }
    #toc li { list-style: none; margin: 0.3em 0; padding: 0; }
    #toc a { text-decoration: none; color: inherit; }
  `;

  // --- Running headers for web preview ---
  if (format === 'web') {
    css += `
      .preview-running-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 0 0 1em; border-bottom: 0.5px solid #e5e7eb; margin-bottom: 1.5em;
        font-family: '${ps.paragraphFont}', sans-serif; font-size: 9pt;
        text-transform: uppercase; letter-spacing: 0.15em; color: #9ca3af;
      }
      .preview-running-footer {
        display: flex; justify-content: center; padding: 1em 0 0;
        border-top: 0.5px solid #e5e7eb; margin-top: 1.5em;
        font-family: '${ps.paragraphFont}', sans-serif; font-size: 9pt; color: #9ca3af;
      }
    `;
  }

  return css;
}

export function generateEditorCSS(ps) {
  return generateBookCSS(ps, '', '', 'web');
}