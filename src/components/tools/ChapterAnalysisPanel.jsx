import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChapterAnalysisPanel({ analysis, onReanalyze }) {
  if (!analysis) return null;

  const { issues, issueCount } = analysis;

  return (
    <div className="rounded-xl border border-border/70 bg-card/80 p-3.5 shrink-0">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-sm font-semibold text-foreground">Chapter Analysis</h4>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onReanalyze} className="rounded-full gap-1 text-[10px] h-6 px-2 text-muted-foreground">
            <RefreshCw className="h-3 w-3" /> Re-analyze
          </Button>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            issueCount === 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
              : issueCount <= 3
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
          }`}>
            {issueCount === 0 ? '✅ Clean' : `${issueCount} issue${issueCount > 1 ? 's' : ''} found`}
          </span>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-background border border-border/40 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{issue.severity === 'high' ? '🔴' : '🟡'}</span>
                <span className="text-foreground truncate">{issue.description}</span>
              </div>
              {issue.example && (
                <span className="text-[10px] text-muted-foreground italic truncate max-w-[180px] shrink-0">
                  "{issue.example}"
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">No issues detected — chapter is clean.</p>
      )}
    </div>
  );
}