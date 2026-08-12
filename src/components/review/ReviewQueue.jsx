/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live review UI is ManuscriptDashboard + ReviewChapterList.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React from 'react';
import { ScanSearch, Loader2, CheckCircle2, AlertCircle, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { chapterHasContent } from '@/lib/chapterStorage';

export default function ReviewQueue({ chapters, selectedChapterId, onSelect, reviewData, onScanAll, onScanFixAll, onManuscriptPolish, busyLabel }) {
  const drafted = chapters.filter((c) => chapterHasContent(c));
  const scanned = drafted.filter((c) => reviewData?.[c.id]);
  const isBusy = !!busyLabel;

  function getChapterIcon(chapter) {
    const review = reviewData?.[chapter.id];
    if (!review) return null;
    const critic = Number(review.critic_score) || 0;
    const audience = Number(review.audience_score) || 0;
    const avg = (critic + audience) / 2;
    if (avg >= 75) return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    if (avg >= 60) return <MinusCircle className="h-3.5 w-3.5 text-yellow-600" />;
    return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
  }

  function getScoreBadge(chapter) {
    const review = reviewData?.[chapter.id];
    if (!review) return null;
    const critic = Number(review.critic_score) || 0;
    const audience = Number(review.audience_score) || 0;
    const avg = Math.round((critic + audience) / 2);
    const color = avg >= 75 ? 'bg-green-500/15 text-green-700' : avg >= 60 ? 'bg-yellow-500/15 text-yellow-700' : 'bg-red-500/15 text-red-700';
    return <span className={`rounded-full px-1.5 py-0 text-[9px] font-semibold ${color}`}>{avg}%</span>;
  }

  return (
    <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-2xl text-foreground">Scan & Fix</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {onScanFixAll && drafted.length > 0 && (
            <Button onClick={onScanFixAll} disabled={isBusy} size="sm" className="rounded-full px-3 text-[10px] h-7">
              {isBusy && busyLabel.includes('Scan & Fix') ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Fixing…</>
              ) : (
                <>🔧 Scan & Fix All ({drafted.length})</>
              )}
            </Button>
          )}
          {onManuscriptPolish && drafted.length > 0 && (
            <Button onClick={onManuscriptPolish} disabled={isBusy} size="sm" variant="secondary" className="rounded-full px-3 text-[10px] h-7">
              {isBusy && busyLabel.includes('Polish') ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> {busyLabel.replace('Polish: ', '')}</>
              ) : (
              <>✨ Polish Manuscript</>
              )}
            </Button>
          )}
          {drafted.length > 0 && (
            <Button onClick={onScanAll} disabled={isBusy} size="sm" variant="outline" className="rounded-full px-3 text-[10px] h-7">
              {isBusy && busyLabel.includes('Scanning all') ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Scanning…</>
              ) : (
                <><ScanSearch className="mr-1 h-3 w-3" /> Scan All ({drafted.length})</>
              )}
            </Button>
          )}
          <Badge variant="outline">{scanned.length}/{drafted.length} scanned</Badge>
        </div>
      </div>

      <div className="grid gap-2">
        {chapters.map((chapter) => {
          const isActive = chapter.id === selectedChapterId;
          const hasContent = chapterHasContent(chapter);

          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelect(chapter.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${isActive ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-background/60 hover:bg-background/90'} ${!hasContent ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ch. {chapter.chapter_number}</p>
                  {getChapterIcon(chapter)}
                </div>
                <div className="flex items-center gap-1.5">
                  {getScoreBadge(chapter)}
                  {!hasContent && <Badge variant="outline" className="text-[9px] px-1.5 py-0">No draft</Badge>}
                </div>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{chapter.title}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}