import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { chapterHasContent } from '@/lib/chapterStorage';
import { isFrontMatter, isBackMatter, isBodyChapter } from '@/lib/bibliographyGenerator';

function countWords(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function getPlainText(text = '') {
  return String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getContentStatus(chapter, isDirty) {
  if (isDirty) return 'dirty';

  const text = String(chapter?.content_md || chapter?.beat_summary || '').trim();

  if (text.length > 0 || chapterHasContent(chapter)) return 'ready';
  if (chapter?.resolved_content_error) return 'warning';

  return 'empty';
}

function getSectionType(chapter) {
  if (!chapter) return 'No section';
  if (isFrontMatter(chapter)) return 'Front Matter';
  if (isBackMatter(chapter)) return 'Back Matter';
  if (isBodyChapter(chapter)) return 'Chapter';
  return 'Section';
}

function getStatusDisplay(status) {
  if (status === 'dirty') {
    return {
      label: 'Unsaved edits',
      detail: 'This section has local changes.',
      icon: Sparkles,
      className: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  if (status === 'ready') {
    return {
      label: 'Ready',
      detail: 'This section has exportable content.',
      icon: CheckCircle2,
      className: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    };
  }

  if (status === 'warning') {
    return {
      label: 'Load warning',
      detail: 'Content loaded from fallback or has a resolution warning.',
      icon: AlertTriangle,
      className: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    };
  }

  return {
    label: 'Empty',
    detail: 'No exportable content found.',
    icon: AlertTriangle,
    className: 'border-border/70 bg-muted/45 text-muted-foreground',
  };
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/35 py-2 last:border-b-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[150px] text-right text-xs font-medium text-foreground">
        {value || '—'}
      </span>
    </div>
  );
}

function InspectorCard({ title, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-background/55 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-bold text-foreground">{title}</p>
      </div>
      {children}
    </section>
  );
}

export default function ExportInspectorPanel({
  chapter,
  editorValue,
  isDirty,
  isSaving,
  isResolving,
  publishSettings,
  exportDisabled,
  onSave,
  onRefreshFromDB,
  onOpenSettings,
  onExport,
}) {
  const markdownWords = countWords(chapter?.content_md || chapter?.beat_summary || '');
  const editorWords = countWords(editorValue || '');
  const words = editorWords || markdownWords;

  const plain = getPlainText(editorValue || chapter?.content_md || chapter?.beat_summary || '');
  const chars = plain.length;
  const paragraphs = plain ? String(editorValue || '').split(/<\/p>|\\n\\n+/).filter(Boolean).length : 0;

  const status = getContentStatus(chapter, isDirty);
  const statusDisplay = getStatusDisplay(status);
  const StatusIcon = statusDisplay.icon;

  const sectionType = getSectionType(chapter);
  const readingMinutes = Math.max(1, Math.ceil(words / 225));

  return (
    <aside className="hidden w-[290px] shrink-0 flex-col border-l border-border/50 bg-background/82 xl:flex">
      <div className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">Inspector</p>
            <p className="truncate text-[10px] text-muted-foreground">
              Section status & export tools
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <InspectorCard title="Current Section" icon={BookOpen}>
          <div className="space-y-2">
            <div className="rounded-xl bg-card/65 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {sectionType}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-foreground">
                {chapter?.title || (chapter?.chapter_number ? `Chapter ${chapter.chapter_number}` : 'No section selected')}
              </p>
            </div>

            <div className={`rounded-xl border px-3 py-2 ${statusDisplay.className}`}>
              <div className="flex items-center gap-2">
                <StatusIcon className="h-3.5 w-3.5" />
                <p className="text-xs font-bold">{statusDisplay.label}</p>
              </div>
              <p className="mt-1 text-[10px] leading-4 opacity-85">
                {statusDisplay.detail}
              </p>
            </div>
          </div>
        </InspectorCard>

        <InspectorCard title="Document Stats" icon={Type}>
          <div className="rounded-xl bg-card/55 px-3 py-1">
            <InfoRow label="Words" value={words.toLocaleString()} />
            <InfoRow label="Characters" value={chars.toLocaleString()} />
            <InfoRow label="Paragraphs" value={paragraphs.toLocaleString()} />
            <InfoRow label="Reading" value={`${readingMinutes} min`} />
          </div>
        </InspectorCard>

        <InspectorCard title="Publishing Setup" icon={FileText}>
          <div className="rounded-xl bg-card/55 px-3 py-1">
            <InfoRow label="Trim" value={publishSettings?.trimSize || '6x9'} />
            <InfoRow label="Font" value={publishSettings?.paragraphFont || 'Default'} />
            <InfoRow label="Size" value={`${publishSettings?.fontSize || 12} pt`} />
            <InfoRow label="Spacing" value={publishSettings?.lineHeight || 'Default'} />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="mt-3 h-8 w-full rounded-full gap-1.5 text-xs"
          >
            <Settings className="h-3.5 w-3.5" />
            Page Settings
          </Button>
        </InspectorCard>

        <InspectorCard title="Quick Actions" icon={Sparkles}>
          <div className="grid gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              disabled={isSaving}
              className="h-8 rounded-full gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving…' : 'Save Section'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefreshFromDB}
              disabled={isResolving}
              className="h-8 rounded-full gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResolving ? 'animate-spin' : ''}`} />
              {isResolving ? 'Refreshing…' : 'Refresh DB'}
            </Button>
          </div>
        </InspectorCard>

        <InspectorCard title="Export" icon={Download}>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => onExport('pdf')}
              className="h-8 justify-start rounded-full gap-1.5 text-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => onExport('docx')}
              className="h-8 justify-start rounded-full gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              DOCX
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportDisabled}
              onClick={() => onExport('md')}
              className="h-8 justify-start rounded-full gap-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Markdown
            </Button>
          </div>

          {exportDisabled && (
            <p className="mt-2 rounded-xl border border-border/50 bg-muted/35 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
              Export is disabled until chapter content is resolved and at least one section has manuscript text.
            </p>
          )}
        </InspectorCard>

        <InspectorCard title="Sync" icon={Clock}>
          <p className="text-[10px] leading-4 text-muted-foreground">
            Autosave runs after edits settle. Manual save is safest before switching sections, refreshing, or exporting.
          </p>

          {isResolving && (
            <p className="mt-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] leading-4 text-primary">
              Resolving chapter content from storage. Wait for this to finish before exporting.
            </p>
          )}
        </InspectorCard>
      </div>
    </aside>
  );
}