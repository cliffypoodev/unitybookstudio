import React from 'react';
import { ChevronRight, Loader2, PenLine, Square, Tags, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FICTION_PROSE_MODELS, normalizeModelId } from '@/lib/modelRouting';
import { isGenericChapterTitle } from '@/lib/chapterMetadataRepair';
import { isBodyChapter } from '@/lib/bibliographyGenerator';

const CHAPTER_QUEUE_VERSION = 'ChapterQueue-metadata-repair-v2';

console.log('[CHAPTER-QUEUE] Loaded', CHAPTER_QUEUE_VERSION);

function safeText(value) {
  return String(value || '').trim();
}

function chapterLabel(chapter) {
  const num = chapter?.chapter_number || '?';
  if (isGenericChapterTitle(chapter?.title, num)) return `Chapter ${num}`;
  return chapter.title;
}

function chapterNeedsMetadata(chapter) {
  return isGenericChapterTitle(chapter?.title, chapter?.chapter_number) || safeText(chapter?.beat_summary).length < 40;
}

export default function ChapterQueue({
  chapters,
  selectedChapterId,
  onSelect,
  onDraftAll,
  busyLabel,
  chapterProgress = {},
  onStop,
  onRepairMetadata,
  onRedraftAllFresh,
}) {
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const bodyChapters = safeChapters.filter(isBodyChapter);
  const undrafted = safeChapters.filter((c) => c.status === 'planned' || c.status === 'beats_ready' || c.status === 'error').length;
  const metadataIssueCount = safeChapters.filter(chapterNeedsMetadata).length;

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-3 backdrop-blur-sm overflow-hidden">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-2xl text-foreground">Chapter Queue</h3>
          {metadataIssueCount > 0 && (
            <p className="mt-1 flex items-center gap-1.5 text-[10px] leading-4 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {metadataIssueCount} title/description issue(s)
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {onRepairMetadata && metadataIssueCount > 0 && (
            <Button
              onClick={onRepairMetadata}
              disabled={!!busyLabel}
              size="sm"
              variant="outline"
              className="h-7 rounded-full px-3 text-[10px] border-amber-300 text-amber-800 hover:text-amber-900 dark:text-amber-300"
            >
              {busyLabel && String(busyLabel).toLowerCase().includes('metadata') ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Repairing…
                </>
              ) : (
                <>
                  <Tags className="mr-1 h-3 w-3" />
                  Repair Titles
                </>
              )}
            </Button>
          )}

          {onDraftAll && undrafted > 0 && (
            <Button onClick={onDraftAll} disabled={!!busyLabel} size="sm" variant="outline" className="rounded-full px-3 text-[10px] h-7">
              {busyLabel && busyLabel.includes('remaining') ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Drafting…</>
              ) : (
                <><PenLine className="mr-1 h-3 w-3" /> Draft All ({undrafted})</>
              )}
            </Button>
          )}

          {onRedraftAllFresh && bodyChapters.length > 0 && (
            <Button 
              onClick={onRedraftAllFresh} 
              disabled={!!busyLabel} 
              size="sm" 
              variant="outline" 
              className="rounded-full px-3 text-[10px] h-7 border-blue-400 text-blue-700 hover:text-blue-800 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              {busyLabel && busyLabel.includes('Re-drafting') ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Re-drafting…</>
              ) : (
                <><RefreshCw className="mr-1 h-3 w-3" /> Re-draft All (fresh)</>
              )}
            </Button>
          )}

          {onStop && !!busyLabel && !busyLabel.includes('stopping') && (
            <Button onClick={onStop} size="sm" variant="destructive" className="rounded-full px-3 text-[10px] h-7">
              <Square className="mr-1 h-3 w-3" /> Stop
            </Button>
          )}

          <Badge variant="outline">{safeChapters.length} total</Badge>
        </div>
      </div>

      {busyLabel && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="text-xs font-medium text-foreground">{busyLabel}</span>
        </div>
      )}

      <div className="grid gap-2">
        {safeChapters.map((chapter) => {
          const isActive = chapter.id === selectedChapterId;
          const progressLabel = chapterProgress[chapter.id];
          const isBeingProcessed = !!progressLabel;
          const needsMeta = chapterNeedsMetadata(chapter);
          const normalizedModel = normalizeModelId(chapter.drafted_with_model) || chapter.drafted_with_model;
          const modelLabel = FICTION_PROSE_MODELS.find((m) => m.id === normalizedModel)?.label || normalizedModel;

          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelect(chapter.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors overflow-hidden ${
                isBeingProcessed
                  ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20'
                  : isActive
                    ? 'border-primary/40 bg-primary/5'
                    : needsMeta
                      ? 'border-amber-300/70 bg-amber-50/40 hover:bg-amber-50/70 dark:bg-amber-950/10'
                      : 'border-border/60 bg-background/60 hover:bg-background/90'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ch. {chapter.chapter_number}</p>

                <div className="flex items-center gap-1.5">
                  {needsMeta && !isBeingProcessed && <AlertTriangle className="h-3 w-3 text-amber-600" />}
                  {isBeingProcessed && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                  <Badge
                    variant={chapter.status === 'error' ? 'destructive' : chapter.status === 'planned' ? 'outline' : 'secondary'}
                    className="text-[9px] px-1.5 py-0"
                  >
                    {isBeingProcessed ? 'processing…' : chapter.status === 'error' ? 'stub/error' : chapter.status}
                  </Badge>
                </div>
              </div>

              <p className="mt-1 truncate text-sm font-medium text-foreground">
                {chapterLabel(chapter)}
              </p>

              {needsMeta && (
                <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  Needs title/description repair
                </p>
              )}

              {isBeingProcessed && (
                <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 truncate">
                  {progressLabel}
                </p>
              )}

              {chapter.drafted_with_model && (
                <p className="mt-0.5 text-[9px] text-muted-foreground/70 truncate">
                  {modelLabel}
                </p>
              )}

              {chapter.beat_summary && (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{chapter.beat_summary}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
