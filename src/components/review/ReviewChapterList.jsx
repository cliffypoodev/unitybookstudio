import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, MinusCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { chapterHasContent } from '@/lib/chapterStorage';
import { resolveChapterContent } from '@/lib/chapterStorage';
import { getChapterIssues } from '@/lib/manuscriptStats';
import { mechanicalScore } from '@/lib/mechanicalScore';

function ScoreDot({ score }) {
  if (score >= 85) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />;
  if (score >= 70) return <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />;
  return <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />;
}

function ChapterIssuePopup({ chapter, onClose }) {
  const [issues, setIssues] = useState(null);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const content = await resolveChapterContent(chapter);
      if (cancelled) return;
      const s = mechanicalScore(content);
      const iss = getChapterIssues(content);
      setScore(s.score);
      setIssues(iss);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [chapter?.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chapter {chapter.chapter_number}</p>
        <h3 className="mt-1 font-display text-xl text-foreground">{chapter.title}</h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing…</span>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <ScoreDot score={score} />
              <span className="text-lg font-semibold text-foreground">{score}/100</span>
              <span className="text-xs text-muted-foreground">Clean Score</span>
            </div>

            <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issues Detected</h4>
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-300">No issues found — chapter is publication-ready</span>
                </div>
              ) : (
                issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2">
                    <Badge variant="outline" className="shrink-0 text-[9px] mt-0.5">
                      {issue.type}
                    </Badge>
                    <span className="text-sm text-foreground">{issue.detail}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// WAVE9-DEADPROPS: busyLabel was accepted and never used — this list only opens
// a read-only popup, so there is nothing to gate on a busy state.
export default function ReviewChapterList({ chapters }) {
  const [popupChapter, setPopupChapter] = useState(null);

  return (
    <div className="rounded-[2rem] border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-2xl text-foreground">Chapters</h3>
        <Badge variant="outline">{chapters.filter(c => chapterHasContent(c)).length} drafted</Badge>
      </div>

      <div className="grid gap-2 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
        {chapters.map((chapter) => {
          const hasContent = chapterHasContent(chapter);
          const cleanScore = chapter.clean_score || 0;

          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => hasContent && setPopupChapter(chapter)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${hasContent ? 'border-border/60 bg-background/60 hover:bg-background/90 cursor-pointer' : 'border-border/40 bg-background/30 opacity-50 cursor-default'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ch. {chapter.chapter_number}</p>
                  {hasContent && <ScoreDot score={cleanScore} />}
                </div>
                <div className="flex items-center gap-1.5">
                  {hasContent && cleanScore > 0 && (
                    <span className={`rounded-full px-1.5 py-0 text-[9px] font-semibold ${cleanScore >= 85 ? 'bg-green-500/15 text-green-700' : cleanScore >= 70 ? 'bg-yellow-500/15 text-yellow-700' : 'bg-red-500/15 text-red-700'}`}>
                      {cleanScore}
                    </span>
                  )}
                  {!hasContent && <Badge variant="outline" className="text-[9px] px-1.5 py-0">No draft</Badge>}
                </div>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{chapter.title}</p>
            </button>
          );
        })}
      </div>

      {popupChapter && (
        <ChapterIssuePopup chapter={popupChapter} onClose={() => setPopupChapter(null)} />
      )}
    </div>
  );
}