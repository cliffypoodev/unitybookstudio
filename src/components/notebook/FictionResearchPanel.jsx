import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { runFictionResearch } from '@/lib/fictionResearch';
import { resolveResearchContent, projectHasResearch } from '@/lib/researchStorage';

export default function FictionResearchPanel({ project, busyLabel, onResearchComplete, onResearchMdChange }) {
  const [researching, setResearching] = useState(false);
  const [localBusy, setLocalBusy] = useState('');
  const [localResearchMd, setLocalResearchMd] = useState(null);
  const [resolvedProjectResearch, setResolvedProjectResearch] = useState('');

  // Resolve research content from URL on mount / project change
  React.useEffect(() => {
    let cancelled = false;
    resolveResearchContent(project).then((content) => {
      if (!cancelled) setResolvedProjectResearch(content);
    });
    return () => { cancelled = true; };
  }, [project?.research_md, project?.research_md_url, project?.id]);

  // Use local state if we just generated, otherwise fall back to resolved project data
  const researchMd = localResearchMd || resolvedProjectResearch || '';
  const hasResearch = !!researchMd || projectHasResearch(project);

  const handleRun = async () => {
    setResearching(true);
    setLocalResearchMd(null); // Clear stale local state
    try {
      const md = await runFictionResearch(project, setLocalBusy);
      setLocalBusy('');
      console.log('[RESEARCH] runFictionResearch returned:', md ? `${md.length} chars` : 'null/empty');
      if (md && md.length > 10) {
        setLocalResearchMd(md);
        // Push directly into docDrafts so the Foundation "Research" textarea updates immediately
        if (onResearchMdChange) onResearchMdChange(md);
        toast.success(`Research brief generated (${Math.round(md.length / 1000)}K chars).`);
      } else {
        toast.info('No researchable topics found in the story bible.');
      }
      // Refresh project data from DB
      if (onResearchComplete) {
        try { await onResearchComplete(); } catch (e) { console.warn('[RESEARCH] refresh failed', e); }
      }
    } catch (e) {
      console.error('[RESEARCH] Error:', e);
      toast.error('Research failed: ' + (e.message || 'Unknown error'));
      setLocalBusy('');
    }
    setResearching(false);
  };

  const busy = localBusy || (busyLabel && busyLabel.includes('Research') ? busyLabel : '');

  return (
    <div className="rounded-[1.5rem] border border-[#2e5a88]/30 bg-[#2e5a88]/5 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-[#2e5a88]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#2e5a88]">Plausibility Research</span>
        </div>
        {hasResearch && (
          <Badge variant="outline" className="text-[10px] border-[#2e5a88]/30 text-[#2e5a88]">
            {Math.round(researchMd.length / 1000)}K chars
          </Badge>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {hasResearch
          ? 'Research brief generated. The prose model will use real terminology and respect physical constraints.'
          : 'Analyze your story bible for technical, scientific, or specialized elements and research their real-world foundations.'}
      </p>

      {busy && (
        <div className="flex items-center gap-2 rounded-xl border border-[#2e5a88]/20 bg-white/60 px-3 py-2">
          <Loader2 className="h-3 w-3 animate-spin text-[#2e5a88]" />
          <span className="text-[11px] text-[#2e5a88]">{busy}</span>
        </div>
      )}

      <Button
        onClick={handleRun}
        disabled={researching || !!busyLabel}
        variant={hasResearch ? 'outline' : 'default'}
        className="rounded-full gap-2 text-xs"
      >
        {researching ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Researching…</>
        ) : (
          <><FlaskConical className="h-3.5 w-3.5" /> {hasResearch ? 'Re-run Research' : 'Run Plausibility Research'}</>
        )}
      </Button>

      {hasResearch && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-border/50 bg-white/60 p-3 text-xs leading-5 text-muted-foreground whitespace-pre-wrap">
          {researchMd.substring(0, 1500)}
          {researchMd.length > 1500 && '…'}
        </div>
      )}
    </div>
  );
}