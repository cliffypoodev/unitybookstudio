import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, CheckCircle2 } from 'lucide-react';

const SEVERITY_STYLES = {
  critical: 'border-red-500/40 bg-red-500/5',
  moderate: 'border-yellow-500/40 bg-yellow-500/5',
  minor: 'border-border/60 bg-background/60',
};

const CATEGORY_LABELS = {
  slop: 'AI Slop',
  repetition: 'Repetition',
  pov_break: 'POV Break',
  tense_drift: 'Tense Drift',
  pacing: 'Pacing',
  continuity: 'Continuity',
  dialogue: 'Dialogue',
  telling: 'Show vs Tell',
  cliche: 'Cliché',
  structure: 'Structure',
};

function IssueRow({ issue }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border ${SEVERITY_STYLES[issue.severity] || SEVERITY_STYLES.minor}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-background/40 transition-colors"
      >
        <ChevronRight className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
          {CATEGORY_LABELS[issue.category] || issue.category}
        </Badge>
        <Badge
          variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}
          className="text-[9px] px-1.5 py-0 shrink-0"
        >
          {issue.severity}
        </Badge>
        <span className="truncate text-foreground">{issue.description}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2 text-xs">
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-600/70 mb-1">Problem</p>
            <p className="text-foreground leading-5 italic">"{issue.quote}"</p>
          </div>
          <div className="rounded-lg bg-green-500/5 border border-green-500/20 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600/70 mb-1">Fix</p>
            <p className="text-foreground leading-5">"{issue.fix}"</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReviewIssueList({ issues, strengths, autoFixed }) {
  const critical = issues?.filter((i) => i.severity === 'critical') || [];
  const moderate = issues?.filter((i) => i.severity === 'moderate') || [];
  const minor = issues?.filter((i) => i.severity === 'minor') || [];

  return (
    <div className="space-y-4">
      {/* Strengths */}
      {strengths?.length > 0 && (
        <div className="rounded-[1.25rem] border border-green-500/30 bg-green-500/5 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-green-700/70 mb-2">Strengths</p>
          <ul className="space-y-1">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-5 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      {(issues?.length > 0) && (
        <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {autoFixed ? 'Issues Found & Fixed' : 'Issues Found'}
            </p>
            <div className="flex gap-1.5 text-[9px]">
              {critical.length > 0 && <Badge variant="destructive" className="px-1.5 py-0">{critical.length} critical</Badge>}
              {moderate.length > 0 && <Badge variant="secondary" className="px-1.5 py-0">{moderate.length} moderate</Badge>}
              {minor.length > 0 && <Badge variant="outline" className="px-1.5 py-0">{minor.length} minor</Badge>}
            </div>
          </div>
          <div className="space-y-1.5">
            {[...critical, ...moderate, ...minor].map((issue, i) => (
              <IssueRow key={i} issue={issue} />
            ))}
          </div>
        </div>
      )}

      {issues?.length === 0 && (
        <div className="rounded-[1.25rem] border border-green-500/30 bg-green-500/5 p-6 text-center text-sm text-green-700">
          ✨ No issues found — this chapter is clean!
        </div>
      )}
    </div>
  );
}