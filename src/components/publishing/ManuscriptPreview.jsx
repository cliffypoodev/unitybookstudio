import React from 'react';
import { buildManuscriptHtml } from '@/lib/manuscript-html';
import { compileThemeCSS } from '@/lib/theme-compiler';

export default function ManuscriptPreview({ project, chapters, theme, selectedChapterId }) {
  const srcDoc = React.useMemo(() => {
    const css = compileThemeCSS(theme, 'web');
    const html = buildManuscriptHtml(project, chapters, theme, selectedChapterId);
    return `<!doctype html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&family=Lora:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{margin:0;padding:16px;background:#eef2f7;font-family:Inter,sans-serif;}
${css}
</style>
</head><body>${html}</body></html>`;
  }, [project, chapters, theme, selectedChapterId]);

  return (
    <div className="hidden w-56 shrink-0 flex-col rounded-2xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm xl:flex xl:w-64">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">Preview</p>
      <iframe title="Manuscript preview" srcDoc={srcDoc} className="min-h-0 flex-1 rounded-xl border border-border bg-white" />
    </div>
  );
}