import React from 'react';
import { Search, RefreshCcw, Loader2, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const RESEARCH_SECTIONS = [
  { key: 'key_figures', label: 'Key People & Figures', desc: 'Real names, roles, dates active, documented actions' },
  { key: 'key_events', label: 'Key Events & Incidents', desc: 'Real events, dates, what happened, sources' },
  { key: 'institutions', label: 'Key Institutions & Organizations', desc: 'Studios, agencies, unions, their roles' },
  { key: 'timeline', label: 'Timeline', desc: 'Chronological sequence of documented events' },
  { key: 'primary_sources', label: 'Primary Sources Available', desc: 'Court records, memoirs, biographies, archives' },
  { key: 'competing_narratives', label: 'Competing Narratives', desc: 'Official story vs what evidence shows' },
];

function formatResearchValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object') return JSON.stringify(item, null, 2);
      return String(item);
    }).join('\n\n');
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export default function ResearchSection({ researchData, onResearch, onReResearch, onOutlineResearch, onFateResearch, onResearchChange, busyLabel }) {
  const [expanded, setExpanded] = React.useState({});
  const isResearching = !!busyLabel && busyLabel.includes('research');
  const hasResearch = researchData && Object.keys(researchData).length > 0;
  const status = isResearching ? 'researching' : hasResearch ? 'complete' : 'not_started';

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFieldChange = (key, newValue) => {
    onResearchChange({ ...researchData, [key]: newValue });
  };

  return (
    <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--notebook-muted)]">Deep Research</p>
          <p className="mt-1 text-sm text-[var(--notebook-muted)]">
            {status === 'not_started' && 'Run research before generating the story bible.'}
            {status === 'researching' && 'DeepSeek is gathering verified facts…'}
            {status === 'complete' && 'Research complete — edit or re-run below.'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'complete' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status === 'researching' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <div className="flex gap-2">
        {!hasResearch ? (
          <Button onClick={onResearch} disabled={isResearching} className="rounded-full" size="sm">
            {isResearching ? (
              <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Researching…</>
            ) : (
              <><Search className="mr-2 h-3.5 w-3.5" /> Research This Topic</>
            )}
          </Button>
        ) : (
          <>
            <Button onClick={onReResearch} disabled={isResearching} variant="outline" className="rounded-full" size="sm">
              {isResearching ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Re-researching…</>
              ) : (
                <><RefreshCcw className="mr-2 h-3.5 w-3.5" /> Re-Research</>
              )}
            </Button>
            <Button onClick={onOutlineResearch} disabled={isResearching} variant="outline" className="rounded-full" size="sm">
              {isResearching ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Researching Gaps…</>
              ) : (
                <><Search className="mr-2 h-3.5 w-3.5" /> Research Outline Gaps</>
              )}
            </Button>
            <Button onClick={onFateResearch} disabled={isResearching} variant="outline" className="rounded-full" size="sm">
              {isResearching ? (
                <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Researching Fates…</>
              ) : (
                <><Search className="mr-2 h-3.5 w-3.5" /> Research Figure Fates</>
              )}
            </Button>
          </>
        )}
      </div>

      {hasResearch && (
        <div className="space-y-2">
          {RESEARCH_SECTIONS.map(({ key, label, desc }) => {
            const isOpen = expanded[key];
            const value = formatResearchValue(researchData[key]);

            return (
              <div key={key} className="rounded-xl border border-border/60 bg-background/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(key)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-background/90 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <Label htmlFor={`research-${key}`} className="sr-only">{label}</Label>
                    <Textarea
                      id={`research-${key}`}
                      value={value}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="min-h-[10rem] rounded-xl bg-background/80 p-3 text-xs font-mono"
                      placeholder={`Add or edit ${label.toLowerCase()}…`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}