import React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * DraftIntegrityBanner — persistent summary shown after Draft All completes.
 *
 * Props:
 *   report: { total, withContent, emptyChapterNumbers, timestamp } | null
 *   onRedraftEmpty: () => void
 *   onDismiss: () => void
 *   busyLabel: string — when non-empty, disables the re-draft button
 */
export default function DraftIntegrityBanner({ report, onRedraftEmpty, onDismiss, busyLabel }) {
  if (!report) return null;

  const { total, withContent, emptyChapterNumbers } = report;
  const allGood = emptyChapterNumbers.length === 0;

  return (
    <div
      data-testid="draft-integrity-banner"
      className={`rounded-xl border px-4 py-3 text-xs leading-5 ${
        allGood
          ? 'border-emerald-300/70 bg-emerald-50/70 text-emerald-950 dark:border-emerald-700/50 dark:bg-emerald-950/30 dark:text-emerald-200'
          : 'border-amber-300/70 bg-amber-50/70 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {allGood ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          )}

          <div>
            <span className="font-semibold">
              Draft complete: {withContent} of {total} chapters have content.
            </span>

            {!allGood && (
              <p className="mt-0.5 text-amber-900/80 dark:text-amber-300/80">
                Empty/failed: {emptyChapterNumbers.map((n) => `Ch.${n}`).join(', ')}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss integrity report"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!allGood && onRedraftEmpty && (
        <div className="mt-2">
          <Button
            onClick={onRedraftEmpty}
            disabled={!!busyLabel}
            size="sm"
            variant="outline"
            className="h-7 rounded-full border-amber-400 px-3 text-[10px] text-amber-800 hover:text-amber-900 dark:border-amber-600 dark:text-amber-300"
            data-testid="redraft-empty-button"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Re-draft empty chapters ({emptyChapterNumbers.length})
          </Button>
        </div>
      )}
    </div>
  );
}
