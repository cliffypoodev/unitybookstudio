/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live preview is inside ExportTab.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
// =============================================================
// SOURCE: zachhannum/orca — PagedPreviewer.tsx concept
// Simplified: uses iframe + srcDoc for Base44 compatibility
// =============================================================

import React, { useMemo } from 'react';

export default function NewManuscriptPreview({ bookHtml, bookCSS, width = 280 }) {
  const srcDoc = useMemo(() => {
    // Strip @page rules for web rendering (browsers don't support them)
    const webCSS = bookCSS.replace(/@page[^{]*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/g, '');

    return `<!doctype html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Georgia&family=Inter:wght@400;500;600&family=Lora:wght@400;500;600&family=Merriweather:wght@400;700&family=Libre+Baskerville:wght@400;700&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #f5f5f0; padding: 16px; font-family: serif; }
.page-container {
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  margin-bottom: 12px;
  padding: 0.4in 0.35in;
  max-width: 100%;
  overflow: hidden;
}
/* Scale down for miniature preview */
section p, .chapter-ugc p { font-size: 7pt !important; line-height: 1.3 !important; }
h1, h2, h3 { font-size: 10pt !important; }
.chapter-number { font-size: 8pt !important; }
.chapter-title { font-size: 10pt !important; }
.chapter-title-wrap { margin-top: 0.5in !important; margin-bottom: 0.3in !important; }
.title-page-wrap { margin-top: 0.8in !important; padding-top: 15% !important; }
.title-page-wrap .title { font-size: 12pt !important; }
.title-page-wrap .subtitle { font-size: 9pt !important; }
.toc-title { font-size: 9pt !important; }
.preview-running-header { font-size: 6pt !important; }
.preview-running-footer { font-size: 6pt !important; }
.firstPara::first-letter { font-size: 3em !important; }
${webCSS}
</style>
</head><body>
<div class="page-container manuscript-preview-root">${bookHtml}</div>
</body></html>`;
  }, [bookHtml, bookCSS]);

  return (
    <div className="hidden w-56 shrink-0 flex-col rounded-2xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm xl:flex xl:w-64">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Preview</p>
      <iframe title="Manuscript preview" srcDoc={srcDoc} className="min-h-0 flex-1 rounded-xl border border-border bg-white" />
    </div>
  );
}