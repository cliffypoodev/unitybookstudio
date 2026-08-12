import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, FlaskConical, Plus, RefreshCcw } from 'lucide-react';
import { runFictionResearch, researchTopic } from '@/lib/fictionResearch';
import { base44 } from '@/api/base44Client';
import { resolveResearchContent, prepareResearchContent, projectHasResearch } from '@/lib/researchStorage';
import ReactMarkdown from 'react-markdown';

export default function ResearchSubPage({ project, busyLabel, setBusyLabel, onProjectRefresh }) {
  const [manualTopic, setManualTopic] = useState('');
  const [researching, setResearching] = useState(false);
  const [localResearchMd, setLocalResearchMd] = useState(null);
  const [resolvedProjectResearch, setResolvedProjectResearch] = useState('');
  const [displayMd, setDisplayMd] = useState('');

  // Resolve research content from URL on mount / project change
  React.useEffect(() => {
    let cancelled = false;
    resolveResearchContent(project).then((content) => {
      if (!cancelled) setResolvedProjectResearch(content);
    });
    return () => { cancelled = true; };
  }, [project?.research_md, project?.research_md_url, project?.id]);

  const researchMd = localResearchMd || resolvedProjectResearch || '';

  const handleRunResearch = async () => {
    setResearching(true);
    setLocalResearchMd(null);
    try {
      await runFictionResearch(project, setBusyLabel);
      setBusyLabel('');
      // Re-fetch the project to get updated research_md
      const fresh = await base44.entities.NovelProject.filter({ id: project.id });
      if (fresh[0]) {
        // Resolve content from URL if needed
        const resolved = await resolveResearchContent(fresh[0]);
        setLocalResearchMd(resolved);
        if (onProjectRefresh) onProjectRefresh(fresh[0]);
      }
    } catch (e) {
      console.error('[RESEARCH]', e);
      setBusyLabel('');
    }
    setResearching(false);
  };

  const handleManualResearch = async () => {
    if (!manualTopic.trim()) return;
    setResearching(true);
    setBusyLabel(`Researching: ${manualTopic.substring(0, 50)}…`);
    try {
      const topic = {
        category: 'other',
        fictional_element: manualTopic,
        real_world_basis: manualTopic,
        research_questions: [manualTopic],
        priority: 'important',
      };
      const findings = await researchTopic(topic);
      if (findings) {
        let existing = resolvedProjectResearch || '';
        existing += `\n\n## ${manualTopic} (Manual Research)\n`;
        existing += `### Real Science\n${findings.findings?.real_science || ''}\n`;
        if (findings.findings?.terminology?.length) {
          existing += '### Terminology\n' + findings.findings.terminology.map((t) => `- ${t}`).join('\n') + '\n';
        }
        if (findings.findings?.common_mistakes?.length) {
          existing += '### Mistakes to Avoid\n' + findings.findings.common_mistakes.map((m) => `- ${m}`).join('\n') + '\n';
        }
        if (findings.findings?.sensory_details) {
          existing += `### Sensory Details\n${findings.findings.sensory_details}\n`;
        }
        if (findings.findings?.procedural_steps) {
          existing += `### Procedure\n${findings.findings.procedural_steps}\n`;
        }
        if (findings.findings?.constraints) {
          existing += `### Constraints\n${findings.findings.constraints}\n`;
        }
        if (findings.findings?.expert_dialogue?.length) {
          existing += '### Expert Dialogue\n' + findings.findings.expert_dialogue.map((d) => `- "${d}"`).join('\n') + '\n';
        }
        existing += '\n---\n';
        const manualResearchFields = await prepareResearchContent(existing, project?.id);
        // Belt-and-suspenders: never let research save overwrite twist settings
        delete manualResearchFields.num_twists;
        delete manualResearchFields.twist_count;
        delete manualResearchFields.twist_intensity;
        await base44.entities.NovelProject.update(project.id, manualResearchFields);
        setLocalResearchMd(existing);
        if (onProjectRefresh) {
          const fresh = await base44.entities.NovelProject.filter({ id: project.id });
          if (fresh[0]) onProjectRefresh(fresh[0]);
        }
      }
      setManualTopic('');
    } catch (e) {
      console.error('[RESEARCH] Manual research failed:', e);
    }
    setBusyLabel('');
    setResearching(false);
  };

  const hasStoryBible = !!(project?.world_md || project?.characters_md || project?.outline_md);
  const charCount = researchMd.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl text-[var(--notebook-ink,hsl(var(--foreground)))]">
          Plausibility Research
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Analyze your story bible for elements that touch real-world science, technology, medicine, law, or specialized knowledge.
          The AI researches the real foundations and produces a Plausibility Brief that grounds your fiction.
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleRunResearch}
          disabled={researching || !hasStoryBible || !!busyLabel}
          className="rounded-full gap-2 bg-[#2e5a88] hover:bg-[#234770]"
        >
          {researching ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Researching…</>
          ) : (
            <><FlaskConical className="h-4 w-4" /> {researchMd ? 'Re-run Full Research' : 'Run Plausibility Research'}</>
          )}
        </Button>
        {!hasStoryBible && (
          <p className="text-xs text-muted-foreground self-center">Generate a story bible first on the Foundation tab.</p>
        )}
      </div>

      {/* Progress */}
      {busyLabel && busyLabel.includes('Research') && (
        <div className="flex items-center gap-3 rounded-xl border border-[#2e5a88]/30 bg-[#2e5a88]/5 px-4 py-3">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#2e5a88]" />
          <span className="text-xs font-medium">{busyLabel}</span>
        </div>
      )}

      {/* Manual topic input */}
      <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Research a Specific Topic</p>
        <div className="flex gap-2">
          <Input
            value={manualTopic}
            onChange={(e) => setManualTopic(e.target.value)}
            placeholder="e.g., How does a Faraday cage actually work?"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleManualResearch()}
          />
          <Button
            onClick={handleManualResearch}
            disabled={researching || !manualTopic.trim() || !!busyLabel}
            size="sm"
            className="rounded-full gap-1 bg-[#2e5a88] hover:bg-[#234770]"
          >
            {researching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Research
          </Button>
        </div>
      </div>

      {/* Direct DB load bypass */}
      <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5 space-y-3">
        <button onClick={async () => {
          const rows = await base44.entities.NovelProject.filter({ id: project.id });
          const fresh = rows[0];
          const resolved = await resolveResearchContent(fresh);
          setDisplayMd(resolved || 'No research content found (inline or URL)');
          alert('Loaded: ' + resolved.length + ' chars. Inline: ' + (fresh?.research_md || '').length + ' | URL: ' + (fresh?.research_md_url || 'none'));
        }} className="px-4 py-2 bg-[#2e5a88] text-white rounded-full text-sm font-medium hover:bg-[#234770]">
          📥 Load Research from Database
        </button>
        <textarea value={displayMd} readOnly style={{width:'100%', minHeight:'400px', padding:'12px', fontSize:'0.85rem'}} />
      </div>

      {/* Plausibility Brief display */}
      {researchMd ? (
        <div className="rounded-[1.5rem] border border-border/70 bg-white/45 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-[#2e5a88]" />
              <span className="text-sm font-bold text-[#2e5a88]">Plausibility Brief</span>
            </div>
            <Badge variant="outline" className="text-[10px]">{Math.round(charCount / 1000)}K chars</Badge>
          </div>
          <div className="max-h-[600px] overflow-y-auto rounded-xl border border-border/50 bg-background/80 p-4">
            <ReactMarkdown className="prose prose-sm max-w-none text-foreground [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h2]:text-[#2e5a88] [&_h3]:text-[#2e5a88]/80 [&_h2]:mt-6 [&_h3]:mt-4 [&_li]:text-xs [&_p]:text-sm [&_p]:leading-relaxed">
              {researchMd}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-background/50 p-8 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No research data yet. Run Plausibility Research after building your story bible.</p>
        </div>
      )}
    </div>
  );
}