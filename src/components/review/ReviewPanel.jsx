import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ScanSearch, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { chapterHasContent } from '@/lib/chapterStorage';
import ReviewScoreCard from '@/components/review/ReviewScoreCard';
import ReviewIssueList from '@/components/review/ReviewIssueList';

export default function ReviewPanel({ chapter, reviewData, onScan, busyLabel }) {
  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Select a chapter to scan and review.
      </div>
    );
  }

  const isBusy = !!busyLabel;
  const isScanning = isBusy && busyLabel.includes('Scanning');
  const review = reviewData?.[chapter.id] || null;
  const hasContent = chapterHasContent(chapter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Chapter {chapter.chapter_number}</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-foreground">{chapter.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={chapter.status === 'reviewed' ? 'default' : 'outline'} className="text-[10px]">{chapter.status}</Badge>
          {(chapter.scan_fix_passes || 0) >= 2 && (
            <span className="text-[10px] text-orange-600 font-medium">Max passes reached</span>
          )}
          <Button onClick={() => onScan(chapter)} disabled={isBusy || !hasContent || (chapter.scan_fix_passes || 0) >= 2} className="rounded-full px-4">
            {isScanning ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scanning…</>
            ) : (chapter.scan_fix_passes || 0) >= 2 ? (
              <><ScanSearch className="mr-1.5 h-3.5 w-3.5" /> Limit Reached</>
            ) : (
              <><ScanSearch className="mr-1.5 h-3.5 w-3.5" /> {review ? 'Re-scan' : 'Scan Chapter'} ({2 - (chapter.scan_fix_passes || 0)} left)</>
            )}
          </Button>
        </div>
      </div>

      {!hasContent && (
        <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-background/50 p-6 text-center text-sm text-muted-foreground">
          This chapter has no draft content yet. Draft it first in the Chapters tab.
        </div>
      )}

      {/* Score cards */}
      {review && <ReviewScoreCard review={review} />}

      {/* Issues */}
      {review && <ReviewIssueList issues={review.issues} strengths={review.strengths} autoFixed={!!review.revised_content_md} />}

      {/* Auto-applied confirmation */}
      {review?.revised_content_md && (
        <div className="flex items-center gap-2 rounded-[1.25rem] border border-green-200 bg-green-50/70 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">All fixes were automatically applied to the chapter draft.</span>
        </div>
      )}

      {/* Nonfiction integrity warnings (composites, FOIA, unverified stats) */}
      {chapter.quality_scan && chapter.quality_scan.match(/Unlabeled Composites|Unverified Statistics|Fabrication risk/) && (
        <div className="rounded-[1.25rem] border border-orange-300/50 bg-orange-50/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-700">Nonfiction Integrity</p>
          </div>
          <div className="space-y-1">
            {chapter.quality_scan.split('\n').filter(Boolean)
              .filter(w => w.startsWith('Unlabeled Composites') || w.startsWith('Unverified Statistics') || w.startsWith('Source Anachronisms') || w.startsWith('Fabrication risk'))
              .map((warning, idx) => (
                <p key={idx} className="text-sm leading-6 text-orange-800">{warning}</p>
              ))}
          </div>
        </div>
      )}

      {/* Quality scan warnings (word repetition, POV drift) */}
      {chapter.quality_scan && (
        <div className="rounded-[1.25rem] border border-yellow-300/50 bg-yellow-50/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-700">Quality Warnings</p>
          </div>
          <div className="space-y-1">
            {chapter.quality_scan.split('\n').filter(Boolean)
              .filter(w => !w.startsWith('Unlabeled Composites') && !w.startsWith('Unverified Statistics') && !w.startsWith('Source Anachronisms') && !w.startsWith('Fabrication risk'))
              .map((warning, idx) => (
                <p key={idx} className="text-sm leading-6 text-yellow-800">{warning}</p>
              ))}
          </div>
        </div>
      )}

      {/* Revision notes from previous scans */}
      {!review && chapter.revision_notes && (
        <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Previous Revision Notes</p>
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{chapter.revision_notes}</p>
        </div>
      )}
    </div>
  );
}