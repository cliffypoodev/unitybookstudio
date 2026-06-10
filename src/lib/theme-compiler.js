// Orca + Buckram CSS Generator
// Converts a BookTheme (PublishSettings) object into CSS strings.
// Format-aware: 'web' for preview, 'pdf' for print, 'epub' for reflowable.

const TRIM_SIZES = {
  '5x8': { w: 5, h: 8 },
  '5.25x8': { w: 5.25, h: 8 },
  '5.5x8.5': { w: 5.5, h: 8.5 },
  '6x9': { w: 6, h: 9 },
  '7x10': { w: 7, h: 10 },
  '8.5x11': { w: 8.5, h: 11 },
  '8x10': { w: 8, h: 10 },
  '5.06x7.81': { w: 5.06, h: 7.81 },
};

export function getTrimSize(theme) {
  const t = TRIM_SIZES[theme.trimSize] || TRIM_SIZES['6x9'];
  return { width: `${t.w}in`, height: `${t.h}in`, w: t.w, h: t.h };
}

// --- @page rules (Orca usePagedCss pattern) ---
function compilePageRules(theme, format) {
  if (format === 'epub') return '';
  const trim = getTrimSize(theme);
  const m = theme.margins;

  let css = '';

  if (format === 'pdf') {
    css += `
      @page {
        size: ${trim.width} ${trim.height};
        margin-top: ${m.top}in;
        margin-bottom: ${m.bottom}in;
        margin-inside: ${m.inside}in;
        margin-outside: ${m.outside}in;
      }
      @page :left {
        margin-left: ${m.inside}in;
        margin-right: ${m.outside}in;
        @top-left { content: string(verso-header); font-family: ${theme.headerFont}, sans-serif; font-size: ${theme.headerSize}pt; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; }
        @bottom-left { content: counter(page); font-family: ${theme.headerFont}, sans-serif; font-size: ${theme.headerSize}pt; color: #6b7280; }
      }
      @page :right {
        margin-left: ${m.outside}in;
        margin-right: ${m.inside}in;
        @top-right { content: string(recto-header); font-family: ${theme.headerFont}, sans-serif; font-size: ${theme.headerSize}pt; text-transform: uppercase; letter-spacing: 0.12em; color: #6b7280; }
        @bottom-right { content: counter(page); font-family: ${theme.headerFont}, sans-serif; font-size: ${theme.headerSize}pt; color: #6b7280; }
      }
      @page chapter:first {
        @top-left { content: none; }
        @top-right { content: none; }
      }
      @page frontmatter { @bottom-center { content: counter(page, lower-roman); } @top-left { content: none; } @top-right { content: none; } }
      .front-matter { page: frontmatter; }
      .chapter { page: chapter; break-before: page; }
    `;
  }

  return css;
}

// --- Page container for web preview ---
function compileWebContainer(theme) {
  const trim = getTrimSize(theme);
  const m = theme.margins;
  return `
    .manuscript-preview-root {
      max-width: ${trim.width};
      margin: 0 auto;
      background: white;
      color: #171717;
    }
    .chapter, .front-matter, .back-matter {
      padding: ${m.top}in ${m.outside}in ${m.bottom}in ${m.inside}in;
      break-before: page;
      page-break-before: always;
    }
    .chapter:first-of-type { break-before: auto; page-break-before: auto; }
    .front-matter:first-child { break-before: auto; page-break-before: auto; }
  `;
}

// --- Body + paragraph typography (Orca + Buckram _elements.scss) ---
function compileTypography(theme, format) {
  const bodySize = format === 'web' ? Math.max(theme.bodySize, 13) : theme.bodySize;
  const lineHeight = format === 'web' ? Math.max(theme.lineHeight, 1.6) : theme.lineHeight;

  return `
    .manuscript-preview-root {
      font-family: '${theme.bodyFont}', 'Cormorant Garamond', Georgia, serif;
      font-size: ${bodySize}pt;
      line-height: ${lineHeight};
      text-align: ${theme.textAlign || 'justify'};
      -webkit-hyphens: ${theme.hyphens !== false ? 'auto' : 'none'};
      hyphens: ${theme.hyphens !== false ? 'auto' : 'none'};
      orphans: ${theme.orphans || 2};
      widows: ${theme.widows || 2};
    }
    .chapter-ugc p {
      margin: 0 0 ${theme.paragraphStyle === 'block' ? '0.85em' : '0'};
      text-indent: ${theme.paragraphStyle === 'indented' ? `${theme.indentSize || 0.22}in` : '0'};
    }
    .chapter-ugc p.firstPara {
      text-indent: 0;
    }
    .chapter-ugc p + p {
      ${theme.paragraphStyle === 'indented' ? 'margin-top: 0;' : ''}
    }
  `;
}

// --- Chapter title (Orca + Buckram _chapters.scss) ---
function compileChapterTitles(theme) {
  return `
    .chapter-title-wrap {
      text-align: ${theme.chapterTitleAlign || 'center'};
      margin: 0 0 2em;
      padding-top: 2em;
    }
    .chapter-number {
      display: ${theme.chapterNumberFormat === 'none' ? 'none' : 'block'};
      font-family: '${theme.headingFont}', serif;
      font-size: ${Math.round((theme.headingSize || 20) * 0.55)}pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin: 0 0 0.5em;
      color: #4b5563;
    }
    .chapter-title {
      font-family: '${theme.headingFont}', serif;
      font-size: ${theme.headingSize || 20}pt;
      font-weight: 400;
      margin: 0;
      line-height: 1.2;
    }
  `;
}

// --- Drop cap (Orca FirstLineDecorations + Buckram _dropcaps.scss) ---
function compileDropCap(theme) {
  if (!theme.dropCapEnabled) {
    return '';
  }

  const lines = theme.dropCapLines || 3;
  const font = theme.dropCapFont || theme.headingFont;

  return `
    .chapter-ugc p.firstPara::first-letter {
      float: left;
      font-family: '${font}', serif;
      font-size: ${lines * 1.15}em;
      line-height: 0.8;
      padding-right: 0.08em;
      padding-top: 0.05em;
      font-weight: 400;
      color: #171717;
    }
  `;
}

// --- Lead-in (Orca FirstLineDecorations) ---
function compileLeadIn(theme) {
  if (theme.leadInStyle === 'none' || !theme.leadInStyle) return '';

  if (theme.leadInStyle === 'smallcaps') {
    return `
      .chapter-ugc p.firstPara::first-line {
        font-variant: small-caps;
        font-size: 1.05em;
      }
    `;
  }
  if (theme.leadInStyle === 'italics') {
    return `
      .chapter-ugc p.firstPara::first-line {
        font-style: italic;
      }
    `;
  }
  return '';
}

// --- Scene breaks (Orca ParagraphSettings + Buckram _separators.scss) ---
function compileSceneBreaks(theme) {
  const glyph = (theme.sceneBreak || '***').replace(/'/g, "\\'");
  return `
    hr.scene-break {
      border: none;
      text-align: center;
      margin: 1.5em 0;
      height: auto;
      overflow: visible;
    }
    hr.scene-break::before {
      content: '${glyph}';
      display: block;
      letter-spacing: 0.4em;
      color: #6b7280;
      font-size: 0.9em;
    }
  `;
}

// --- Running headers (Orca HeadersSettings + Buckram _running-content.scss) ---
function compileRunningHeaders(theme, format) {
  if (format === 'pdf') {
    return `
      .chapter-title-wrap h2.chapter-title {
        string-set: chapterTitle content(text);
      }
      .recto-header-string { string-set: recto-header content(text); }
      .verso-header-string { string-set: verso-header content(text); }
    `;
  }

  // Web preview: render header/footer divs
  return `
    .preview-running-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 0 1em;
      border-bottom: 0.5px solid #e5e7eb;
      margin-bottom: 1.5em;
      font-family: '${theme.headerFont || theme.bodyFont}', sans-serif;
      font-size: ${theme.headerSize || 9}pt;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #9ca3af;
    }
    .preview-running-footer {
      display: flex;
      justify-content: center;
      padding: 1em 0 0;
      border-top: 0.5px solid #e5e7eb;
      margin-top: 1.5em;
      font-family: '${theme.headerFont || theme.bodyFont}', sans-serif;
      font-size: ${theme.headerSize || 9}pt;
      color: #9ca3af;
    }
    .chapter:first-of-type .preview-running-header {
      visibility: ${theme.suppressFirstPageHeader ? 'hidden' : 'visible'};
    }
  `;
}

// --- Front matter + back matter (Buckram _front-matter.scss + Pressbooks structure) ---
function compileFrontBackMatter() {
  return `
    .front-matter {
      text-align: center;
    }
    .front-matter .title-page-wrap {
      padding-top: 30%;
    }
    .front-matter .title-page-wrap .title {
      font-size: 2em;
      font-weight: 400;
      margin: 0 0 0.5em;
    }
    .front-matter .title-page-wrap .subtitle {
      font-size: 1.1em;
      font-weight: 400;
      color: #6b7280;
      margin: 0 0 1em;
    }
    .front-matter .title-page-wrap .author {
      font-size: 1em;
      color: #4b5563;
      margin: 0;
    }
    .front-matter.copyright-page { font-size: 0.85em; color: #6b7280; text-align: center; padding-top: 20%; }
    .front-matter.copyright-page p { margin: 0.25em 0; }
    .front-matter.toc .toc-title { font-size: 1.4em; margin: 0 0 1em; font-weight: 400; }
    .toc-list { list-style: none; padding: 0; margin: 0; text-align: left; }
    .toc-list li { display: flex; justify-content: space-between; padding: 0.35em 0; border-bottom: 1px dotted #d1d5db; }
    .toc-list li a { text-decoration: none; color: inherit; display: flex; justify-content: space-between; width: 100%; }
    .toc-chapter-title { flex: 1; }
    .toc-page-number { color: #9ca3af; margin-left: 1em; }
    .back-matter { text-align: left; }
    .back-matter .back-matter-title { font-size: 1.3em; font-weight: 400; margin: 0 0 1em; }
    .back-matter .ugc p { margin: 0 0 0.8em; }
    .front-matter#half-title { padding-top: 35%; }
    .front-matter#half-title .title { font-size: 1.6em; }
    .front-matter#dedication { padding-top: 25%; font-style: italic; color: #4b5563; }
    .front-matter#epigraph { padding-top: 20%; font-style: italic; color: #4b5563; }
    .front-matter#epigraph blockquote { margin: 0; padding: 0; border: none; }
  `;
}

// --- Main compiler ---
export function compileThemeCSS(theme, format = 'web') {
  const sections = [
    format === 'web' ? compileWebContainer(theme) : compilePageRules(theme, format),
    compileTypography(theme, format),
    compileChapterTitles(theme),
    compileDropCap(theme),
    compileLeadIn(theme),
    compileSceneBreaks(theme),
    compileRunningHeaders(theme, format),
    compileFrontBackMatter(),
  ];

  return sections.join('\n');
}