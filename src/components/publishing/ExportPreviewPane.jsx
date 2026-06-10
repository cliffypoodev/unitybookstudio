// =============================================================
// ExportPreviewPane.jsx — Polished Book Preview Pane
//
// Purpose:
// - Display-only publishing preview for Export tab.
// - Does NOT mutate chapters.
// - Does NOT touch save/export/backup logic.
// - Adds cleaner preview controls:
//   - Single page / spread view
//   - Fit / 75 / 90 / 100 / 125 zoom
//   - Print-safe preview shell
//   - Better loading/empty state
//   - Independent smooth scrolling
//
// Compatible with existing ExportTab usage:
//
// <ExportPreviewPane
//   project={project}
//   chapters={orderedWithEdits}
//   publishSettings={publishSettings}
// />
// =============================================================

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  FileText,
  Layers2,
  Maximize2,
  Minus,
  PanelTop,
  Plus,
  ScrollText,
  ZoomIn,
} from 'lucide-react';

import { generateBookCSS } from '@/lib/generateBookCSS';
import { buildBookHtml } from '@/lib/buildBookHtml';
import { parseTrimSize } from '@/lib/publishConstants';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

const ZOOM_OPTIONS = [
  { label: 'Fit', value: 'fit' },
  { label: '75%', value: '75' },
  { label: '90%', value: '90' },
  { label: '100%', value: '100' },
  { label: '125%', value: '125' },
];

function getZoomScale(zoomMode) {
  if (zoomMode === '75') return 0.75;
  if (zoomMode === '90') return 0.9;
  if (zoomMode === '100') return 1;
  if (zoomMode === '125') return 1.25;
  return 1;
}

function getNextZoom(zoomMode, direction) {
  const numeric = ['75', '90', '100', '125'];

  if (zoomMode === 'fit') {
    return direction === 'in' ? '90' : '75';
  }

  const index = numeric.indexOf(String(zoomMode));
  if (index === -1) return '100';

  if (direction === 'in') {
    return numeric[Math.min(numeric.length - 1, index + 1)];
  }

  return numeric[Math.max(0, index - 1)];
}

function countWords(chapters = []) {
  return chapters.reduce((sum, chapter) => {
    const content = String(chapter?.content_md || chapter?.beat_summary || '');
    const words = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;

    return sum + words;
  }, 0);
}

function chapterHasVisibleContent(chapter) {
  const content = String(chapter?.content_md || chapter?.beat_summary || '').trim();
  return content.length > 0;
}

function PreviewShell({
  children,
  pageWidth,
  pageHeight,
  zoomMode,
  zoomScale,
  viewMode,
}) {
  if (viewMode === 'spread') {
    return (
      <div
        className={cn(
          'mx-auto grid origin-top gap-5 transition-transform duration-150',
          zoomMode === 'fit'
            ? 'w-full max-w-[min(100%,calc(var(--preview-page-width)*2+1.25rem))] grid-cols-1 xl:grid-cols-2'
            : 'grid-cols-2'
        )}
        style={
          zoomMode === 'fit'
            ? undefined
            : {
                width: `${pageWidth * 2 + 20}px`,
                transform: `scale(${zoomScale})`,
                marginBottom: `${Math.max(80, pageHeight * (zoomScale - 1))}px`,
              }
        }
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'mx-auto origin-top transition-transform duration-150',
        zoomMode === 'fit'
          ? 'w-full max-w-[var(--preview-page-width)]'
          : 'w-[var(--preview-page-width)]'
      )}
      style={
        zoomMode === 'fit'
          ? undefined
          : {
              transform: `scale(${zoomScale})`,
              marginBottom: `${Math.max(80, pageHeight * (zoomScale - 1))}px`,
            }
      }
    >
      {children}
    </div>
  );
}

function PreviewPage({ children, label = 'Preview Page', muted = false }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[26px] border border-border/60 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.14)]',
        muted && 'opacity-80'
      )}
    >
      <div className="flex h-11 items-center justify-center border-b border-border/30 bg-gradient-to-b from-background to-muted/30">
        <span className="text-[10px] font-black uppercase tracking-[0.34em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="preview-page-body min-h-[var(--preview-page-min-height)] bg-white">
        {children}
      </div>
    </div>
  );
}

function EmptyPreview({ title, message }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-[26px] border border-dashed border-border/70 bg-background/80 p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <FileText className="h-6 w-6" />
        </div>

        <p className="mt-4 text-base font-black text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export default function ExportPreviewPane({
  project,
  chapters = [],
  publishSettings,
}) {
  const [zoomMode, setZoomMode] = useState('fit');
  const [viewMode, setViewMode] = useState('single');

  const safeChapters = useMemo(() => {
    return Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  }, [chapters]);

  const visibleChapters = useMemo(() => {
    return safeChapters.filter(chapterHasVisibleContent);
  }, [safeChapters]);

  const totalWords = useMemo(() => countWords(visibleChapters), [visibleChapters]);

  const trim = useMemo(() => {
    return parseTrimSize(publishSettings?.trimSize || '5in x 8in');
  }, [publishSettings?.trimSize]);

  const pageMetrics = useMemo(() => {
    const trimWidth = Number(trim.w || 5);
    const trimHeight = Number(trim.h || 8);
    const ratio = trimHeight / trimWidth;

    const baseWidth = 620;
    const width = baseWidth;
    const height = Math.round(baseWidth * ratio);

    return {
      width,
      height,
      ratio,
    };
  }, [trim.w, trim.h]);

  const zoomScale = getZoomScale(zoomMode);
  const zoomLabel = ZOOM_OPTIONS.find((option) => option.value === zoomMode)?.label || 'Fit';

  const bookHtml = useMemo(() => {
    if (!visibleChapters.length) return '';

    try {
      return buildBookHtml(project || {}, visibleChapters, publishSettings || {});
    } catch (err) {
      console.warn('[EXPORT PREVIEW] Failed to build book HTML:', err);
      return '';
    }
  }, [project, visibleChapters, publishSettings]);

  const previewCss = useMemo(() => {
    try {
      return generateBookCSS(
        publishSettings || {},
        project?.title || '',
        project?.author_name || '',
        'preview'
      );
    } catch (err) {
      console.warn('[EXPORT PREVIEW] Failed to generate preview CSS:', err);
      return '';
    }
  }, [publishSettings, project?.title, project?.author_name]);

  const styleVars = useMemo(
    () => ({
      '--preview-page-width': `${pageMetrics.width}px`,
      '--preview-page-min-height': `${pageMetrics.height}px`,
    }),
    [pageMetrics.width, pageMetrics.height]
  );

  const hasPreview = Boolean(bookHtml && visibleChapters.length);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f3efe6]"
      style={styleVars}
    >
      <div className="flex min-h-[46px] shrink-0 items-center gap-2 border-b border-border/50 bg-background/85 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <BookOpen className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-black text-foreground">Book Preview</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {visibleChapters.length.toLocaleString()} sections · {totalWords.toLocaleString()} words
            </p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 sm:flex">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-black transition',
                viewMode === 'single'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title="Single page preview"
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Single</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('spread')}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-black transition',
                viewMode === 'spread'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
              title="Two-page spread preview"
            >
              <Layers2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Spread</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setZoomMode(getNextZoom(zoomMode, 'out'))}
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>

          <label
            className="inline-flex h-8 items-center gap-1 rounded-full border border-border/60 bg-background px-2 text-[10px] font-bold text-foreground"
            title="Preview zoom"
          >
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />

            <select
              value={zoomMode}
              onChange={(event) => setZoomMode(event.target.value)}
              className="h-7 cursor-pointer bg-transparent text-[10px] font-bold outline-none"
              aria-label="Preview zoom"
            >
              {ZOOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </label>

          <button
            type="button"
            onClick={() => setZoomMode(getNextZoom(zoomMode, 'in'))}
            className="hidden h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomMode('fit')}
            className={cn(
              'hidden h-8 w-8 items-center justify-center rounded-full border text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex',
              zoomMode === 'fit'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 bg-background'
            )}
            title="Fit preview"
            aria-label="Fit preview"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border/35 bg-muted/20 px-3 text-[10px] text-muted-foreground">
        <PanelTop className="h-3.5 w-3.5" />

        <span className="truncate">
          {publishSettings?.trimSize || '5in x 8in'} · {publishSettings?.paragraphFont || 'Times New Roman'} · {publishSettings?.fontSize || 12}pt · {zoomLabel}
        </span>

        <span className="ml-auto hidden truncate sm:inline">
          Display preview only — final PDF/DOCX export may vary slightly by renderer.
        </span>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto',
          zoomMode === 'fit' ? 'px-5 py-8' : 'px-8 py-10'
        )}
      >
        {!visibleChapters.length && (
          <EmptyPreview
            title="No manuscript content ready for preview"
            message="Drafted chapters will appear here after the export workspace finishes resolving saved content from the database."
          />
        )}

        {visibleChapters.length > 0 && !hasPreview && (
          <EmptyPreview
            title="Preview could not be generated"
            message="The manuscript content exists, but the preview renderer could not build the book HTML. Try refreshing the Export tab."
          />
        )}

        {hasPreview && (
          <>
            <style>{`
              .export-preview-renderer {
                color: #16110d;
              }

              .export-preview-renderer .manuscript-preview-root {
                max-width: none !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                box-shadow: none !important;
                background: transparent !important;
              }

              .export-preview-renderer .preview-page,
              .export-preview-renderer .book-page,
              .export-preview-renderer section,
              .export-preview-renderer article {
                max-width: none;
              }

              .export-preview-renderer img {
                max-width: 100%;
                height: auto;
              }

              ${previewCss}
            `}</style>

            <PreviewShell
              pageWidth={pageMetrics.width}
              pageHeight={pageMetrics.height}
              zoomMode={zoomMode}
              zoomScale={zoomScale}
              viewMode={viewMode}
            >
              <PreviewPage label={viewMode === 'spread' ? 'Left Page' : 'Preview Page'}>
                <div
                  className="export-preview-renderer px-[clamp(42px,9%,86px)] py-[clamp(44px,9%,92px)]"
                  dangerouslySetInnerHTML={{ __html: bookHtml }}
                />
              </PreviewPage>

              {viewMode === 'spread' && (
                <PreviewPage label="Right Page" muted>
                  <div className="flex min-h-[var(--preview-page-min-height)] items-center justify-center px-10 py-14 text-center">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Layers2 className="h-6 w-6" />
                      </div>

                      <p className="mt-4 text-sm font-black text-foreground">
                        Spread preview placeholder
                      </p>

                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        This view reserves space for a two-page spread. Full pagination can be added later if we build page-splitting.
                      </p>
                    </div>
                  </div>
                </PreviewPage>
              )}
            </PreviewShell>
          </>
        )}
      </div>
    </div>
  );
}