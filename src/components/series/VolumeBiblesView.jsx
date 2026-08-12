import React, { useState, useCallback, useEffect } from 'react';
import { ArrowLeft, Loader2, BookOpen, ChevronDown, ChevronRight, RefreshCw, CheckCircle, AlertTriangle, Users, Globe, Clock, Skull, Zap, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { extractVolumeBible, saveVolumeBible, loadVolumeBible } from '@/lib/volumeBible';

function ContractSection({ title, icon: Icon, contract }) {
  const [open, setOpen] = useState(false);
  if (!contract || Object.keys(contract).length === 0) return null;
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent/20 transition-colors">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {title}
      </button>
      {open && (
        <div className="space-y-2 px-4 pb-3 text-xs text-muted-foreground">
          {contract.description && <p className="text-foreground">{contract.description}</p>}
          {contract.characters_required_alive?.length > 0 && <p><span className="font-medium text-foreground">Must be alive:</span> {contract.characters_required_alive.join(', ')}</p>}
          {contract.characters_required_dead?.length > 0 && <p><span className="font-medium text-foreground">Must be dead:</span> {contract.characters_required_dead.join(', ')}</p>}
          {contract.characters_alive?.length > 0 && <p><span className="font-medium text-foreground">Alive at end:</span> {contract.characters_alive.join(', ')}</p>}
          {contract.characters_dead?.length > 0 && <p><span className="font-medium text-foreground">Dead at end:</span> {contract.characters_dead.join(', ')}</p>}
          {contract.threads_that_must_be_open?.length > 0 && <div><span className="font-medium text-foreground">Open threads:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.threads_that_must_be_open.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.threads_open_for_next?.length > 0 && <div><span className="font-medium text-foreground">Open for next:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.threads_open_for_next.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.threads_closed?.length > 0 && <div><span className="font-medium text-foreground">Closed:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.threads_closed.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.world_facts_assumed?.length > 0 && <div><span className="font-medium text-foreground">World facts:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.world_facts_assumed.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.world_state_facts?.length > 0 && <div><span className="font-medium text-foreground">World state:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.world_state_facts.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.cliffhangers?.length > 0 && <div><span className="font-medium text-foreground">Cliffhangers:</span><ul className="ml-4 mt-1 list-disc space-y-0.5">{contract.cliffhangers.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {contract.emotional_state_of_protagonist && <p><span className="font-medium text-foreground">Protagonist state:</span> {contract.emotional_state_of_protagonist}</p>}
        </div>
      )}
    </div>
  );
}

function BibleSection({ bible }) {
  const [open, setOpen] = useState(true);
  if (!bible || Object.keys(bible).length === 0) return null;
  if (bible.note) return <p className="text-xs text-muted-foreground italic">{bible.note}</p>;
  if (bible.error) return <p className="text-xs text-red-500">{bible.error}</p>;

  return (
    <div className="space-y-2">
      {/* Characters */}
      {bible.characters_at_end?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 overflow-hidden">
          <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent/20 transition-colors">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Characters at End ({bible.characters_at_end.length})
          </button>
          {open && (
            <div className="space-y-2 px-4 pb-3">
              {bible.characters_at_end.map((ch, i) => (
                <div key={i} className="rounded-lg bg-background/60 p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{ch.name}</span>
                    <span className={'rounded-full px-1.5 py-0.5 text-[9px] font-medium ' + (
                      ch.status === 'dead' ? 'bg-red-100 text-red-700' :
                      ch.status === 'transformed' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    )}>{ch.status}</span>
                  </div>
                  {ch.arc_position && <p className="mt-1 text-muted-foreground">{ch.arc_position}</p>}
                  {ch.emotional_state && <p className="text-muted-foreground">Emotional: {ch.emotional_state}</p>}
                  {ch.key_relationships && <p className="text-muted-foreground">Relationships: {ch.key_relationships}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Events */}
      {bible.key_events?.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-foreground"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Key Events</p>
          <ol className="ml-4 list-decimal space-y-0.5 text-xs text-muted-foreground">{bible.key_events.map((e, i) => <li key={i}>{e}</li>)}</ol>
        </div>
      )}

      {/* Threads */}
      {(bible.threads_opened?.length > 0 || bible.threads_closed?.length > 0 || bible.threads_ongoing?.length > 0) && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 space-y-1.5">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><Zap className="h-3.5 w-3.5 text-muted-foreground" /> Plot Threads</p>
          {bible.threads_opened?.length > 0 && <div className="text-xs"><span className="font-medium text-amber-700">Opened:</span><ul className="ml-4 mt-0.5 list-disc text-muted-foreground">{bible.threads_opened.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {bible.threads_closed?.length > 0 && <div className="text-xs"><span className="font-medium text-green-700">Closed:</span><ul className="ml-4 mt-0.5 list-disc text-muted-foreground">{bible.threads_closed.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {bible.threads_ongoing?.length > 0 && <div className="text-xs"><span className="font-medium text-blue-700">Ongoing:</span><ul className="ml-4 mt-0.5 list-disc text-muted-foreground">{bible.threads_ongoing.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        </div>
      )}

      {/* World State */}
      {bible.world_state_at_end && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-foreground"><Globe className="h-3.5 w-3.5 text-muted-foreground" /> World State</p>
          <p className="text-xs text-muted-foreground">{bible.world_state_at_end}</p>
        </div>
      )}

      {/* Last Scene */}
      {bible.last_scene_summary && (
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
          <p className="mb-1 text-xs font-semibold text-foreground">Final Scene</p>
          <p className="text-xs text-muted-foreground">{bible.last_scene_summary}</p>
        </div>
      )}

      {/* Tone */}
      {bible.tone_and_style && (
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Tone:</span> {bible.tone_and_style}</p>
      )}
    </div>
  );
}

function VolumeCard({ project, projects }) {
  const [expanded, setExpanded] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState('');
  const [data, setData] = useState(() => loadVolumeBible(project));

  // WAVE3-EXTRACTALL: "Extract All" saves bibles and calls refreshAll(), but the
  // card key never changes, so the lazy initializer above never re-ran — five
  // finished extractions still showed "Extract Bible" until a full page reload.
  // Re-derive from the refreshed project prop.
  useEffect(() => { setData(loadVolumeBible(project)); }, [project]);

  const handleExtract = useCallback(async () => {
    setExtracting(true);
    try {
      let chapters = await base44.entities.Chapter.filter({ project_id: project.id });
      chapters = chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
      if (chapters.length === 0) { setProgress('No chapters found'); setExtracting(false); return; }

      const extraction = await extractVolumeBible(project, chapters, setProgress);
      await saveVolumeBible(project.id, extraction.volumeBible, extraction.entryContract, extraction.exitContract);
      setData(extraction);
      setExpanded(true);
      setProgress('');
    } catch (err) {
      setProgress('Failed: ' + err.message);
    } finally {
      setExtracting(false);
    }
  }, [project]);

  const hasBible = !!data;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => hasBible && setExpanded(!expanded)} disabled={!hasBible}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition hover:bg-accent disabled:opacity-30">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          #{project.series_number || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm text-foreground">{project.title || 'Untitled'}</p>
          <p className="text-[10px] text-muted-foreground">{project.phase || '—'} · {(project.total_word_count || 0).toLocaleString()} words</p>
        </div>
        {hasBible ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-green-600"><CheckCircle className="h-3 w-3" /> Bible ready</span>
            <Button variant="outline" size="sm" className="h-7 gap-1 rounded-full px-2.5 text-[10px]" onClick={handleExtract} disabled={extracting}>
              <RefreshCw className={`h-3 w-3 ${extracting ? 'animate-spin' : ''}`} /> Re-extract
            </Button>
          </div>
        ) : (
          <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={handleExtract} disabled={extracting}>
            {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
            {extracting ? 'Extracting…' : 'Extract Bible'}
          </Button>
        )}
      </div>

      {extracting && progress && (
        <div className="flex items-center gap-2 border-t border-border/30 px-5 py-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{progress}</span>
        </div>
      )}

      {expanded && data && (
        <div className="space-y-3 border-t border-border/30 px-5 py-4">
          <BibleSection bible={data.volumeBible} />
          <ContractSection title="Entry Contract (what this book requires)" icon={Shield} contract={data.entryContract} />
          <ContractSection title="Exit Contract (what this book delivers)" icon={Zap} contract={data.exitContract} />
        </div>
      )}
    </div>
  );
}

export default function VolumeBiblesView({ bible, projects, onBack, refreshAll }) {
  const [extractingAll, setExtractingAll] = useState(false);
  const [progress, setProgress] = useState('');

  const sorted = [...projects].sort((a, b) => (a.series_number || 0) - (b.series_number || 0));
  const withBible = sorted.filter(p => p.volume_bible_json);

  const handleExtractAll = useCallback(async () => {
    setExtractingAll(true);
    try {
      const { extractAllVolumeBibles } = await import('@/lib/volumeBible');
      await extractAllVolumeBibles(sorted, setProgress);
      refreshAll();
    } catch (err) {
      setProgress('Failed: ' + err.message);
    } finally {
      setExtractingAll(false);
      setProgress('');
    }
  }, [sorted, refreshAll]);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition hover:border-border hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Volume Bibles</p>
        <h2 className="font-display text-2xl text-foreground">{bible.series_name || 'Untitled Series'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {withBible.length}/{sorted.length} volumes have extracted bibles. Each bible captures the state of characters, world, and plot threads at the end of that volume.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={handleExtractAll} disabled={extractingAll || sorted.length === 0} className="gap-1.5 rounded-full text-xs">
            {extractingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {extractingAll ? 'Extracting All…' : `Extract All (${sorted.length} volumes)`}
          </Button>
          {extractingAll && progress && <span className="text-xs text-muted-foreground">{progress}</span>}
        </div>
      </div>

      <div className="space-y-3">
        {sorted.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No volumes linked to this series yet.</p>}
        {sorted.map(project => (
          <VolumeCard key={project.id} project={project} projects={sorted} />
        ))}
      </div>
    </div>
  );
}