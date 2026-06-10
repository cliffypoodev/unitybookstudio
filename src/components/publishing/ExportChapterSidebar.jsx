// =============================================================
// ExportChapterSidebar.jsx — Polished Manuscript Navigator
//
// Purpose:
// - Cleaner chapter/section navigation for Export tab.
// - Groups Front Matter / Chapters / Back Matter.
// - Adds search.
// - Shows content status, word count, and dirty/unsaved state.
// - Handles undefined/null chapters safely.
// - Does NOT mutate chapters.
// - Compatible with existing ExportTab usage:
//
// <ExportChapterSidebar
//   chapters={resolvedChapters.length ? resolvedChapters : ordered}
//   selectedChapterId={selectedChapterId}
//   dirtyChapterId={isEditorDirty ? selectedChapterId : null}
//   onSelect={handleChapterSelect}
// />
// =============================================================

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';

import { chapterHasContent } from '@/lib/chapterStorage';
import { isFrontMatter, isBackMatter, isBodyChapter } from '@/lib/bibliographyGenerator';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function safeText(value = '') {
  return String(value || '');
}

function stripHtml(value = '') {
  return safeText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(chapter) {
  const content = safeText(chapter?.content_md || chapter?.beat_summary || chapter?.content_html || '');
  return stripHtml(content)
    .split(/\s+/)
    .filter(Boolean).length;
}

function getSectionType(chapter) {
  if (isFrontMatter(chapter)) return 'Front Matter';
  if (isBackMatter(chapter)) return 'Back Matter';
  if (isBodyChapter(chapter)) return 'Chapter';
  return 'Section';
}

function getChapterNumber(chapter, fallbackIndex = 0) {
  if (isFrontMatter(chapter)) return 'F';
  if (isBackMatter(chapter)) return 'B';

  return chapter?.chapter_number || fallbackIndex + 1;
}

function getChapterTitle(chapter, fallbackIndex = 0) {
  if (!chapter) return 'Untitled Section';

  if (chapter.title) return chapter.title;

  if (isFrontMatter(chapter)) return 'Front Matter';
  if (isBackMatter(chapter)) return 'Back Matter';

  return `Chapter ${chapter.chapter_number || fallbackIndex + 1}`;
}

function sortChapters(chapters = []) {
  const safe = Array.isArray(chapters) ? chapters.filter(Boolean) : [];

  return [...safe].sort((a, b) => {
    const aNum = Number(a?.chapter_number || 0);
    const bNum = Number(b?.chapter_number || 0);
    return aNum - bNum;
  });
}

function groupChapters(chapters = []) {
  const sorted = sortChapters(chapters);

  const front = sorted.filter((chapter) => isFrontMatter(chapter));
  const body = sorted.filter((chapter) => isBodyChapter(chapter));
  const back = sorted.filter((chapter) => isBackMatter(chapter));
  const other = sorted.filter(
    (chapter) =>
      !isFrontMatter(chapter) &&
      !isBodyChapter(chapter) &&
      !isBackMatter(chapter)
  );

  return [
    {
      id: 'front',
      label: 'Front Matter',
      icon: FileText,
      chapters: front,
      emptyText: 'No front matter',
    },
    {
      id: 'body',
      label: 'Chapters',
      icon: BookOpen,
      chapters: body.length ? body : other,
      emptyText: 'No chapters',
    },
    {
      id: 'back',
      label: 'Back Matter',
      icon: Layers,
      chapters: back,
      emptyText: 'No back matter',
    },
  ];
}

function filterGroups(groups, query) {
  const lower = query.trim().toLowerCase();

  if (!lower) return groups;

  return groups.map((group) => ({
    ...group,
    chapters: group.chapters.filter((chapter, index) => {
      const title = getChapterTitle(chapter, index);
      const number = safeText(chapter?.chapter_number);
      const type = getSectionType(chapter);

      return [title, number, type]
        .join(' ')
        .toLowerCase()
        .includes(lower);
    }),
  }));
}

function StatusBadge({ hasContent, isDirty }) {
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Unsaved
      </span>
    );
  }

  if (hasContent) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Draft
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">
      Empty
    </span>
  );
}

function SectionGroup({
  group,
  selectedChapterId,
  dirtyChapterId,
  onSelect,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = group.icon;

  const totalWords = useMemo(() => {
    return group.chapters.reduce((sum, chapter) => sum + countWords(chapter), 0);
  }, [group.chapters]);

  return (
    <div className="rounded-2xl border border-border/50 bg-background/70">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}

        <Icon className="h-4 w-4 text-muted-foreground" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-wide text-foreground">
            {group.label}
          </p>

          <p className="text-[10px] text-muted-foreground">
            {group.chapters.length} section{group.chapters.length === 1 ? '' : 's'}
            {totalWords ? ` · ${totalWords.toLocaleString()} words` : ''}
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t border-border/40 p-1.5">
          {group.chapters.length ? (
            group.chapters.map((chapter, index) => {
              const isActive = chapter?.id === selectedChapterId;
              const isDirty = chapter?.id === dirtyChapterId;
              const hasContent = chapterHasContent(chapter);
              const words = countWords(chapter);
              const title = getChapterTitle(chapter, index);
              const type = getSectionType(chapter);
              const number = getChapterNumber(chapter, index);

              return (
                <button
                  key={chapter?.id || `${group.id}-${index}`}
                  type="button"
                  onClick={() => onSelect?.(chapter?.id)}
                  className={cn(
                    'group mb-1 flex w-full items-start gap-2 rounded-xl px-2.5 py-2.5 text-left transition',
                    isActive
                      ? 'bg-primary/10 text-foreground ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-lg px-1 text-[10px] font-black',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground group-hover:bg-background'
                    )}
                  >
                    {number}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-sm leading-tight',
                            isActive ? 'font-black text-foreground' : 'font-semibold'
                          )}
                        >
                          {title}
                        </p>

                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {type}
                          {words ? ` · ${words.toLocaleString()} words` : ''}
                        </p>
                      </div>

                      <StatusBadge hasContent={hasContent} isDirty={isDirty} />
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center">
              <p className="text-[11px] font-bold text-muted-foreground">{group.emptyText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ExportChapterSidebar({
  chapters = [],
  selectedChapterId,
  dirtyChapterId = null,
  onSelect,
}) {
  const [query, setQuery] = useState('');

  const safeChapters = useMemo(() => {
    return Array.isArray(chapters) ? chapters.filter(Boolean) : [];
  }, [chapters]);

  const groups = useMemo(() => {
    return filterGroups(groupChapters(safeChapters), query);
  }, [safeChapters, query]);

  const totalWords = useMemo(() => {
    return safeChapters.reduce((sum, chapter) => sum + countWords(chapter), 0);
  }, [safeChapters]);

  const draftedCount = useMemo(() => {
    return safeChapters.filter((chapter) => chapterHasContent(chapter)).length;
  }, [safeChapters]);

  return (
    <aside className="flex h-full w-full flex-col bg-background/85 md:w-[280px] md:shrink-0">
      <div className="shrink-0 border-b border-border/50 px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-foreground">Manuscript</p>
            <p className="truncate text-[10px] text-muted-foreground">
              {safeChapters.length.toLocaleString()} sections · {draftedCount.toLocaleString()} drafted
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border/50 bg-card/70 p-2">
            <p className="text-sm font-black text-foreground">{totalWords.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">words</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-card/70 p-2">
            <p className="text-sm font-black text-foreground">{draftedCount}</p>
            <p className="text-[10px] text-muted-foreground">drafted</p>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sections…"
            className="h-9 w-full rounded-2xl border border-border bg-card pl-8 pr-3 text-xs font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {safeChapters.length ? (
          <div className="space-y-2">
            {groups.map((group) => (
              <SectionGroup
                key={group.id}
                group={group}
                selectedChapterId={selectedChapterId}
                dirtyChapterId={dirtyChapterId}
                onSelect={onSelect}
                defaultOpen={group.id === 'body' || group.chapters.length > 0}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Sparkles className="h-5 w-5" />
              </div>

              <p className="mt-3 text-sm font-black text-foreground">No sections yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Drafted chapters and manuscript sections will appear here after they are created.
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}