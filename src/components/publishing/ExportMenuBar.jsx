// =============================================================
// ExportMenuBar.jsx
// Ultra-compact responsive command bar
//
// Fixes:
// - Prevents button distortion when both side panes are open.
// - Keeps left and right pane toggles reachable.
// - Uses compact icon-first buttons in constrained layouts.
// - Keeps Export dropdown export-only.
// =============================================================

import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  FileArchive,
  FileDown,
  FileOutput,
  FileText,
  Focus,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Printer,
  RefreshCw,
  Save,
  Settings,
  SplitSquareHorizontal,
  SquarePen,
  ClipboardCheck,
} from 'lucide-react';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function formatSavedTime(value) {
  if (!value) return '';

  try {
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function CompactButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  active = false,
  showLabel = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2 text-xs font-bold transition',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border/70 bg-background/75 text-foreground hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {showLabel && <span className="hidden 2xl:inline">{label}</span>}
    </button>
  );
}

function PaneToggleButton({ side = 'left', open, onClick }) {
  const isLeft = side === 'left';

  const Icon = isLeft
    ? open
      ? PanelLeftClose
      : PanelLeftOpen
    : open
      ? PanelRightClose
      : PanelRightOpen;

  const title = isLeft
    ? open
      ? 'Hide chapters pane'
      : 'Show chapters pane'
    : open
      ? 'Hide inspector pane'
      : 'Show inspector pane';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-foreground shadow-sm transition hover:bg-muted"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function MenuSection({ label, children }) {
  return (
    <div className="py-1.5">
      <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  detail,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
        'text-foreground hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-45'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold">{label}</span>

        {detail ? (
          <span className="block truncate text-[10px] text-muted-foreground">
            {detail}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export default function ExportMenuBar({
  onSave,
  isSaving,
  onExport,
  exportDisabled,
  onOpenSettings,
  chapterTitle,
  chapterNumber,
  wordCount = 0,
  lastSaved,
  onRefreshFromDB,
  isResolving,
  isDirty,
  viewMode = 'editor',
  onViewModeChange,

  onOpenHealthCheck,
  chaptersPaneOpen = true,
  onToggleChaptersPane,
  inspectorPaneOpen = true,
  onToggleInspectorPane,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  const savedTime = formatSavedTime(lastSaved);

  const currentChapterLabel = chapterNumber
    ? `Chapter ${chapterNumber}`
    : 'Current Section';

  useEffect(() => {
    if (!exportOpen) return;

    const handleClickOutside = (event) => {
      if (!exportMenuRef.current) return;

      if (!exportMenuRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setExportOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [exportOpen]);

  const closeAndRun = (fn) => {
    setExportOpen(false);

    if (typeof fn === 'function') {
      fn();
    }
  };

  const setView = (mode) => {
    if (typeof onViewModeChange === 'function') {
      onViewModeChange(mode);
    }
  };

  const doExport = (format) => {
    if (typeof onExport === 'function') {
      onExport(format);
    }
  };

  const saveDisabled = isSaving || isResolving;

  return (
    <div className="shrink-0 border-b border-border/50 bg-background/90">
      <div className="grid min-h-[50px] grid-cols-[auto_minmax(80px,1fr)_auto_auto] items-center gap-1.5 px-2 py-2">
        {/* LEFT CHAPTERS PANE TOGGLE */}
        {typeof onToggleChaptersPane === 'function' ? (
          <PaneToggleButton
            side="left"
            open={chaptersPaneOpen}
            onClick={onToggleChaptersPane}
          />
        ) : (
          <div className="h-8 w-0" />
        )}

        {/* FLEXIBLE TITLE BLOCK */}
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground 2xl:flex">
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-xs font-black text-foreground xl:text-sm">
                {currentChapterLabel}
                {chapterTitle ? ` — ${chapterTitle}` : ''}
              </p>

              {isDirty ? (
                <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 xl:text-[10px]">
                  Unsaved
                </span>
              ) : (
                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 2xl:inline-flex">
                  <CheckCircle2 className="h-3 w-3" />
                  Ready
                </span>
              )}

              {isResolving ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 xl:text-[10px]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="hidden xl:inline">Syncing</span>
                </span>
              ) : null}
            </div>

            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {Number(wordCount || 0).toLocaleString()} words
              {savedTime ? ` • Saved ${savedTime}` : ''}
            </p>
          </div>
        </div>

        {/* COMPACT ACTIONS */}
        <div className="flex shrink-0 items-center justify-end gap-1 overflow-visible">
          <div className="hidden shrink-0 items-center gap-1 rounded-full border border-border/60 bg-card/70 p-1 lg:flex">
            <CompactButton
              active={viewMode === 'editor'}
              icon={SquarePen}
              label="Editor"
              onClick={() => setView('editor')}
              showLabel={false}
            />

            <CompactButton
              active={viewMode === 'split'}
              icon={SplitSquareHorizontal}
              label="Split"
              onClick={() => setView('split')}
              showLabel={false}
            />

            <CompactButton
              active={viewMode === 'preview'}
              icon={Eye}
              label="Preview"
              onClick={() => setView('preview')}
              showLabel={false}
            />

            <CompactButton
              active={viewMode === 'focus'}
              icon={Focus}
              label="Focus"
              onClick={() => setView('focus')}
              showLabel={false}
            />
          </div>

          {typeof onOpenHealthCheck === 'function' && (
            <CompactButton
              icon={ClipboardCheck}
              label="Manuscript Health Check"
              onClick={onOpenHealthCheck}
              showLabel={false}
            />
          )}

          <CompactButton
            icon={Save}
            label={isSaving ? 'Saving' : 'Save'}
            onClick={onSave}
            disabled={saveDisabled}
            showLabel={false}
          />

          <CompactButton
            icon={RefreshCw}
            label={isResolving ? 'Refreshing' : 'Refresh'}
            onClick={onRefreshFromDB}
            disabled={isResolving}
            showLabel={false}
          />

          <CompactButton
            icon={Settings}
            label="Page Setup"
            onClick={onOpenSettings}
            showLabel={false}
          />

          {/* EXPORT DROPDOWN */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((value) => !value)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-border/70 bg-background/75 px-2 text-xs font-bold text-foreground transition hover:bg-muted',
                exportOpen && 'bg-muted'
              )}
              title="Export options"
              aria-label="Export options"
            >
              <FileOutput className="h-4 w-4" />
              <span className="hidden 2xl:inline">Export</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {exportOpen && (
              <div className="absolute right-0 top-10 z-[80] w-72 overflow-hidden rounded-2xl border border-border bg-background p-2 shadow-2xl">
                <MenuSection label="Export Options">
                  <MenuItem
                    icon={Printer}
                    label="Print / PDF"
                    detail="Open browser print dialog"
                    disabled={exportDisabled}
                    onClick={() => closeAndRun(() => doExport('pdf'))}
                  />

                  <MenuItem
                    icon={FileDown}
                    label="Export DOCX"
                    detail="Download Word manuscript"
                    disabled={exportDisabled}
                    onClick={() => closeAndRun(() => doExport('docx'))}
                  />

                  <MenuItem
                    icon={FileArchive}
                    label="Export Markdown"
                    detail="Download markdown backup"
                    disabled={exportDisabled}
                    onClick={() => closeAndRun(() => doExport('md'))}
                  />

                  <MenuItem
                    icon={Copy}
                    label="Copy Manuscript Text"
                    detail="Copy plain text to clipboard"
                    disabled={exportDisabled}
                    onClick={() => closeAndRun(() => doExport('clipboard'))}
                  />
                </MenuSection>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT INSPECTOR PANE TOGGLE */}
        {typeof onToggleInspectorPane === 'function' ? (
          <PaneToggleButton
            side="right"
            open={inspectorPaneOpen}
            onClick={onToggleInspectorPane}
          />
        ) : (
          <div className="h-8 w-0" />
        )}
      </div>
    </div>
  );
}