import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import {
  BookOpen, ArrowLeft, ArrowRight, Plus, Upload, Loader2, CheckCircle,
  AlertTriangle, Library, Sparkles, Layers, Link2, X, Pencil, Check,
  ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Search, FileText, Users, Globe,
  Clock, Skull, Shield, Zap, BarChart3, MessageSquare, Trash2, Copy,
  Download, LinkIcon, Unlink, RefreshCw, GitBranch, BookCopy, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  extractSeriesBible, formatCharactersForStoryBible, buildCanonFromSeriesBible,
  formatUnresolvedThreads, sanitizeSeriesBible,
} from '@/lib/seriesBible';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { parseSeriesField, describeFieldFailures } from '@/lib/seriesBibleFields';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import { extractAllVolumeBibles, loadVolumeBible, getEntryContractForVolume, getExitContractForVolume } from '@/lib/volumeBible';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import SeriesPolishView from '@/components/series/SeriesPolishView';
import VolumeBiblesView from '@/components/series/VolumeBiblesView';

/* =============================================================================
 * SeriesManager — Notebook aesthetic
 *
 * Visual language:
 *   - Cormorant Garamond for display headings
 *   - Caveat for kickers/annotations
 *   - Warm cream bg, ink-brown text, gold accent
 *   - Rounded-[2rem] cards with warm shadows
 *   - Phase-dot + uppercase tracking for labels
 * ========================================================================== */

const SEQUEL_FLAVORS = [
  { id: 'standalone', emoji: '\u{1F4D8}', label: 'Standalone Sequel',
    description: 'Shares pen name and world but story is self-contained. No continuity canon carried over.',
    requiresBible: false },
  { id: 'continuation', emoji: '\u{1F4D6}', label: 'True Continuation',
    description: 'Picks up after the prior book. Characters, deaths, threads, and world state injected into story bible.',
    requiresBible: true },
  { id: 'anthology_volume', emoji: '\u{1F4DA}', label: 'Anthology Volume',
    description: 'Next volume of a multi-volume anthology series. Fresh standalone stories under the shared theme.',
    requiresBible: false },
];

export default function SeriesManager() {
  const navigate = useNavigate();
  const [view, setView] = useState('library');
  const [selectedBible, setSelectedBible] = useState(null);

  const { data: bibles = [], isLoading: loadingBibles, refetch: refetchBibles } = useQuery({
    queryKey: ['series-bibles'], queryFn: () => base44.entities.SeriesBible.list(),
  });
  const { data: allProjects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['all-novel-projects'], queryFn: () => base44.entities.NovelProject.list(),
  });

  const refreshAll = useCallback(() => { refetchBibles(); refetchProjects(); }, [refetchBibles, refetchProjects]);

  const projectsBySeries = useMemo(() => {
    const map = {};
    allProjects.forEach((p) => {
      if (p.series_bible_id) {
        if (!map[p.series_bible_id]) map[p.series_bible_id] = [];
        map[p.series_bible_id].push(p);
      }
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => (a.series_number || 0) - (b.series_number || 0)));
    return map;
  }, [allProjects]);

  const unlinkedProjects = useMemo(() => allProjects.filter((p) => !p.series_bible_id), [allProjects]);
  const [selectedVolume, setSelectedVolume] = useState(null);
  const goBack = () => { setSelectedBible(null); setSelectedVolume(null); setView('library'); };

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Signature radial glow background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-accent/35 blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-secondary blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-8 sm:px-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition hover:border-border hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">Unity Book Studio</p>
            <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">Series Manager</h1>
          </div>
          <div className="w-[120px]" />
        </div>

        {view === 'library' && (
          <LibraryView bibles={bibles} loadingBibles={loadingBibles} projectsBySeries={projectsBySeries}
            allProjects={allProjects} unlinkedProjects={unlinkedProjects}
            onNewSeries={() => setView('new_series')}
            onSequelFromBible={(b) => { setSelectedBible(b); setView('sequel'); }}
            onSeriesPolish={(b) => { setSelectedBible(b); setView('series_polish'); }}
            onSeriesCritic={(b) => { setSelectedBible(b); setView('series_critic'); }}
            onMergeBook={(b) => { setSelectedBible(b); setView('merge_book'); }}
            onVolumeBibles={(b) => { setSelectedBible(b); setView('volume_bibles'); }}
            onContinuity={(b) => { setSelectedBible(b); setView('continuity'); }}
            onSpinoff={(b, vol) => { setSelectedBible(b); setSelectedVolume(vol); setView('spinoff'); }}
            onRewrite={(b, vol) => { setSelectedBible(b); setSelectedVolume(vol); setView('rewrite_volume'); }}
            navigate={navigate} refreshAll={refreshAll} />
        )}
        {view === 'new_series' && <NewSeriesView unlinkedProjects={unlinkedProjects} onBack={() => setView('library')} onDone={() => { refreshAll(); toast.success('Series created'); setView('library'); }} />}
        {view === 'sequel' && selectedBible && <SequelView bible={selectedBible} allProjects={allProjects} onBack={goBack} onCreated={(pid) => { refreshAll(); toast.success('Next volume created'); navigate(`/projects/${pid}`); }} />}
        {view === 'series_polish' && selectedBible && <SeriesPolishView bible={selectedBible} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} />}
        {view === 'series_critic' && selectedBible && <SeriesCriticView bible={selectedBible} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} />}
        {view === 'merge_book' && selectedBible && <MergeBookView bible={selectedBible} onBack={goBack} onDone={() => { refreshAll(); toast.success('Series bible updated'); setView('library'); }} />}
        {view === 'volume_bibles' && selectedBible && <VolumeBiblesView bible={selectedBible} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} refreshAll={refreshAll} />}
        {view === 'spinoff' && selectedBible && selectedVolume && <SpinoffView bible={selectedBible} volume={selectedVolume} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} onCreated={(pid) => { refreshAll(); toast.success('Spinoff created'); navigate(`/projects/${pid}`); }} />}
        {view === 'rewrite_volume' && selectedBible && selectedVolume && <RewriteVolumeView bible={selectedBible} volume={selectedVolume} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} navigate={navigate} />}
        {view === 'continuity' && selectedBible && <SeriesContinuityView bible={selectedBible} projects={projectsBySeries[selectedBible.id] || []} onBack={goBack} />}
      </div>
    </main>
  );
}

/* ── Notebook-style section heading ───────────────────────────────────────── */

function SectionKicker({ children }) {
  return <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{children}</p>;
}

function BackButton({ onClick, label = 'Back' }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition hover:border-border hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}

/* ── LIBRARY VIEW ─────────────────────────────────────────────────────────── */

function LibraryView({ bibles, loadingBibles, projectsBySeries, allProjects, unlinkedProjects, onNewSeries, onSequelFromBible, onSeriesPolish, onSeriesCritic, onMergeBook, onVolumeBibles, onContinuity, onSpinoff, onRewrite, navigate, refreshAll }) {
  if (loadingBibles) return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="flex items-center justify-between rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/30">
            <Library className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <p className="font-display text-xl text-foreground">Your Series</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {bibles.length} bible{bibles.length === 1 ? '' : 's'} · {allProjects.filter((p) => p.series_bible_id).length} linked · {unlinkedProjects.length} unlinked
            </p>
          </div>
        </div>
        <Button onClick={onNewSeries} className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> New Series</Button>
      </div>

      {bibles.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-border/50 bg-card/40 p-14 text-center backdrop-blur-sm">
          <Library className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-display text-lg text-muted-foreground">No series yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Click "New Series" to group books and track continuity.</p>
        </div>
      )}

      {bibles.map((bible) => (
        <SeriesCard key={bible.id} bible={bible} volumes={projectsBySeries[bible.id] || []} unlinkedProjects={unlinkedProjects}
          onSequelFromBible={onSequelFromBible} onSeriesPolish={onSeriesPolish} onSeriesCritic={onSeriesCritic} onMergeBook={onMergeBook} onVolumeBibles={onVolumeBibles} onContinuity={onContinuity}
          onSpinoff={onSpinoff} onRewrite={onRewrite}
          navigate={navigate} refreshAll={refreshAll} />
      ))}
    </div>
  );
}

/* ── SERIES CARD ──────────────────────────────────────────────────────────── */

function SeriesCard({ bible, volumes, unlinkedProjects, onSequelFromBible, onSeriesPolish, onSeriesCritic, onMergeBook, onVolumeBibles, onContinuity, onSpinoff, onRewrite, navigate, refreshAll }) {
  const [collapsed, setCollapsed] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(bible.series_name || '');
  const [savingName, setSavingName] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [addBookId, setAddBookId] = useState('');
  const [addingBook, setAddingBook] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [volWordCounts, setVolWordCounts] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const counts = {};
      for (const vol of volumes) {
        if (vol.word_count && vol.word_count > 0) { counts[vol.id] = vol.word_count; continue; }
        try {
          const chapters = await base44.entities.Chapter.filter({ project_id: vol.id });
          counts[vol.id] = chapters.reduce((s, ch) => s + (ch.word_count || 0), 0);
        } catch (e) { counts[vol.id] = 0; }
      }
      if (!cancelled) setVolWordCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [volumes]);

  const getVolWc = (vol) => volWordCounts[vol.id] || vol.word_count || 0;
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [frOldName, setFrOldName] = useState('');
  const [frNewName, setFrNewName] = useState('');
  const [frRunning, setFrRunning] = useState(false);

  const handleSeriesFindReplace = async () => {
    if (!frOldName.trim() || !frNewName.trim() || frOldName.trim() === frNewName.trim()) return;
    setFrRunning(true);
    let totalReplaced = 0; let volumesChanged = 0;
    // WAVE9-SILENTSERIES: this loop rewrites the manuscript. Anything it could
    // not read is now counted and reported instead of quietly skipped.
    const unreadableVolumes = [];
    let skippedChapters = 0;
    try {
      for (const vol of volumes) {
        let chapters = [];
        let volReadable = true;
        try { chapters = await base44.entities.Chapter.filter({ project_id: vol.id }); }
        catch (e) {
          try { chapters = (await base44.entities.Chapter.list()).filter(c => c.project_id === vol.id); }
          catch (e2) {
            // Both reads failed: this whole volume goes untouched. Saying
            // "replaced across 3 volumes" while silently missing a fourth is
            // worse than saying nothing.
            volReadable = false;
            console.warn('[SERIES-FIND-REPLACE] could not read chapters for', vol.title || vol.id, e2?.message || e2);
            unreadableVolumes.push(vol.title || `Volume ${vol.series_number || '?'}`);
          }
        }
        if (!volReadable) continue;
        let volChanged = false;
        for (const ch of chapters) {
          let freshCh = null;
          try { const r = await base44.entities.Chapter.filter({ id: ch.id }); if (r?.[0]) freshCh = r[0]; }
          catch (e) { console.warn('[SERIES-FIND-REPLACE] refresh failed for chapter', ch.id, e?.message || e); }
          if (!freshCh) {
            // Falling back to the stale list copy would compute the replacement
            // from old text and then SAVE it, overwriting anything newer. Skip.
            skippedChapters += 1;
            continue;
          }
          const { resolveChapterContent: resolve, prepareChapterContent } = await import('@/lib/chapterStorage');
          const content = await resolve(freshCh);
          if (!content) continue;
          const rx = new RegExp('\\b' + frOldName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
          const matches = content.match(rx);
          if (!matches || matches.length === 0) continue;
          const newContent = content.replace(rx, frNewName.trim());
          totalReplaced += matches.length; volChanged = true;
          const contentFields = await prepareChapterContent(newContent, vol.id, freshCh.id, freshCh);
          await base44.entities.Chapter.update(freshCh.id, { ...contentFields });
        }
        if (volChanged) volumesChanged++;
      }
      toast.success(`Replaced "${frOldName}" → "${frNewName}": ${totalReplaced} instances across ${volumesChanged} volume(s)`);
      if (unreadableVolumes.length > 0) {
        toast.warning(
          `Skipped ${unreadableVolumes.length} volume(s) that could not be read: ${unreadableVolumes.join(', ')}. ` +
          'Those still contain the old name — re-run once they load.',
          { duration: 12000 }
        );
      }
      if (skippedChapters > 0) {
        toast.warning(
          `Skipped ${skippedChapters} chapter(s) whose latest version could not be fetched. ` +
          'They were left untouched rather than rewritten from a stale copy.',
          { duration: 12000 }
        );
      }
      setShowFindReplace(false); setFrOldName(''); setFrNewName('');
    } catch (err) { toast.error('Failed: ' + (err.message || 'unknown')); }
    finally { setFrRunning(false); }
  };

  const saveName = async () => {
    if (!nameDraft.trim() || nameDraft.trim() === bible.series_name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await base44.entities.SeriesBible.update(bible.id, { series_name: nameDraft.trim() });
      for (const v of volumes) await base44.entities.NovelProject.update(v.id, { series_name: nameDraft.trim() });
      toast.success('Series name updated'); refreshAll();
    } catch (err) { toast.error('Failed to update name'); }
    finally { setSavingName(false); setEditingName(false); }
  };

  const handleAddBook = async () => {
    if (!addBookId) return;
    setAddingBook(true);
    try {
      const nextNum = volumes.length > 0 ? Math.max(...volumes.map((v) => v.series_number || 0)) + 1 : 1;
      await base44.entities.NovelProject.update(addBookId, { series_bible_id: bible.id, series_name: bible.series_name, series_number: nextNum });
      await base44.entities.SeriesBible.update(bible.id, { books_analyzed: (bible.books_analyzed || 0) + 1 });
      toast.success('Book added to series'); setShowAddBook(false); setAddBookId(''); refreshAll();
    } catch (err) { toast.error('Failed to add book'); }
    finally { setAddingBook(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      for (const v of volumes) await base44.entities.NovelProject.update(v.id, { series_bible_id: '', series_name: '', series_number: null, series_flavor: '', series_flavor_note: '' });
      await base44.entities.SeriesBible.delete(bible.id);
      toast.success('Series bible deleted'); refreshAll();
    } catch (err) { toast.error('Failed to delete'); }
    finally { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const clone = { ...bible }; delete clone.id; delete clone.created_date; delete clone.updated_date;
      clone.series_name = (bible.series_name || 'Untitled') + ' (Copy)'; clone.books_analyzed = 0;
      await base44.entities.SeriesBible.create(clone);
      toast.success('Bible duplicated'); refreshAll();
    } catch (err) { toast.error('Failed to duplicate'); }
    finally { setDuplicating(false); }
  };

  const handleExport = () => {
    let md = `# Series Bible: ${bible.series_name || 'Untitled'}\n\n`;
    md += `**Books Analyzed:** ${bible.books_analyzed || 0}\n**Last Book:** ${bible.last_book_title || '—'}\n\n`;
    // WAVE9-SILENTSERIES: an unreadable roster used to vanish from the export
    // with no gap where it had been, so the file looked complete.
    const exportBad = [];
    const exportChars = parseSeriesField(bible.characters_json, null, 'characters', exportBad);
    if (exportChars) md += `## Characters\n\n${formatCharactersForStoryBible(exportChars)}\n\n`;
    else if (bible.characters_json) md += '## Characters\n\n_Could not be read from the series bible — see the app for the raw value._\n\n';
    const fields = [['world_state','World State'],['rules_and_systems','Rules & Systems'],['key_locations','Key Locations'],['tone_and_themes','Tone & Themes'],['timeline','Timeline'],['relationships','Relationships'],['voice_profile','Voice Profile'],['power_levels','Power Levels'],['last_book_ending','Last Book Ending']];
    fields.forEach(([k,lbl]) => { if (bible[k]) md += `## ${lbl}\n\n${bible[k]}\n\n`; });
    const arrFields = [['resolved_threads','Resolved Threads'],['unresolved_threads','Unresolved Threads'],['deaths_and_losses','Deaths & Losses'],['secrets_revealed','Secrets Revealed'],['secrets_remaining','Secrets Remaining']];
    arrFields.forEach(([k,lbl]) => {
      if (bible[k]) { try { const arr = JSON.parse(bible[k]); md += `## ${lbl}\n\n${arr.map((t,i) => `${i+1}. ${t}`).join('\n')}\n\n`; } catch (e) { md += `## ${lbl}\n\n${bible[k]}\n\n`; } }
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${(bible.series_name || 'series-bible').replace(/\s+/g, '-').toLowerCase()}.md`; a.click();
    URL.revokeObjectURL(url);
    const exportWarning = describeFieldFailures(exportBad, 'The exported file marks where it should have been.');
    if (exportWarning) toast.warning(exportWarning, { duration: 10000 });
    else toast.success('Bible exported');
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-lg">
      {/* Header */}
      <div className="border-b border-border/40 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <button onClick={() => setCollapsed(!collapsed)} className="shrink-0 rounded-full p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          </button>
          {editingName ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditingName(false); setNameDraft(bible.series_name || ''); } }}
                className="h-8 rounded-full text-sm font-medium" autoFocus disabled={savingName} />
              <button onClick={saveName} disabled={savingName} className="rounded-full p-1 text-green-600 hover:bg-green-50">
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button onClick={() => { setEditingName(false); setNameDraft(bible.series_name || ''); }} className="rounded-full p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2" onClick={() => setEditingName(true)}>
              <p className="truncate font-display text-lg text-foreground">{bible.series_name || 'Untitled Series'}</p>
              <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
            </div>
          )}
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{volumes.length} book{volumes.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-9">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={() => onSeriesPolish(bible)}><Search className="h-3 w-3" /> Polish</Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={() => onSeriesCritic(bible)}><MessageSquare className="h-3 w-3" /> Critique</Button>
          <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs" onClick={() => onSequelFromBible(bible)}><Plus className="h-3 w-3" /> Sequel</Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Series Health Summary */}
          {volumes.length > 0 && (
            <div className="mx-4 mb-2 mt-2 rounded-2xl bg-secondary/50 p-3.5">
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <div><span className="text-muted-foreground">Total: </span><span className="font-semibold text-foreground">{volumes.reduce((s, v) => s + getVolWc(v), 0).toLocaleString()} words</span></div>
                <div><span className="text-muted-foreground">Avg/vol: </span><span className="font-semibold">{Math.round(volumes.reduce((s, v) => s + getVolWc(v), 0) / volumes.length).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Bibles: </span><span className="font-semibold">{volumes.filter(v => v.volume_bible_json).length}/{volumes.length}</span></div>
                {(() => {
                  const wcs = volumes.map(v => getVolWc(v)).filter(w => w > 0);
                  if (wcs.length < 2) return null;
                  const avg = wcs.reduce((s, w) => s + w, 0) / wcs.length;
                  const outliers = volumes.filter(v => getVolWc(v) > 0 && Math.abs(getVolWc(v) - avg) > avg * 0.3);
                  if (outliers.length === 0) return null;
                  return <span className="text-amber-600">⚠️ {outliers.length} volume{outliers.length > 1 ? 's' : ''} differ &gt;30% from avg</span>;
                })()}
              </div>
              {/* Mini word count bars */}
              <div className="mt-2.5 flex h-8 items-end gap-1">
                {volumes.map(vol => {
                  const maxWc = Math.max(...volumes.map(v => getVolWc(v)), 1);
                  const pct = (getVolWc(vol) / maxWc * 100);
                  return (
                    <div key={vol.id} className="flex flex-1 flex-col items-center gap-0.5" title={`Book ${vol.series_number}: ${getVolWc(vol).toLocaleString()} words`}>
                      <div className="w-full rounded-t-sm bg-primary/25 transition-all" style={{ height: Math.max(2, pct * 0.3) + 'px' }} />
                      <span className="text-[8px] text-muted-foreground">#{vol.series_number || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Volume list */}
          <div className="space-y-0.5 px-3 pb-2 pt-1">
            {volumes.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No volumes linked yet.</p>}
            {volumes.map((vol, idx) => (
              <VolumeRow key={vol.id} project={vol} isFirst={idx === 0} isLast={idx === volumes.length - 1}
                allVolumes={volumes} navigate={navigate} refreshAll={refreshAll}
                onSpinoff={(proj) => onSpinoff(bible, proj)}
                onRewrite={(proj) => onRewrite(bible, proj)}
                wordCount={getVolWc(vol)} />
            ))}
          </div>

          {/* Add book inline */}
          {showAddBook && (
            <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-secondary/40 p-3">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select value={addBookId} onChange={(e) => setAddBookId(e.target.value)} className="h-8 flex-1 rounded-full border border-border bg-background px-3 text-sm">
                <option value="">— Select a project —</option>
                {unlinkedProjects.map((p) => <option key={p.id} value={p.id}>{p.title || 'Untitled'} ({p.project_type || 'fiction'})</option>)}
              </select>
              <Button size="sm" className="h-8 rounded-full text-xs" onClick={handleAddBook} disabled={!addBookId || addingBook}>
                {addingBook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
              </Button>
              <button onClick={() => { setShowAddBook(false); setAddBookId(''); }} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Management bar */}
          <div className="flex flex-wrap items-center gap-1 border-t border-border/30 px-4 py-2.5">
            <MgmtBtn icon={LinkIcon} label="Add Book" onClick={() => setShowAddBook(!showAddBook)} />
            <MgmtBtn icon={RefreshCw} label="Merge Book" onClick={() => onMergeBook(bible)} />
            <MgmtBtn icon={BookOpen} label="Volume Bibles" onClick={() => onVolumeBibles(bible)} />
            <MgmtBtn icon={Layers} label="Continuity" onClick={() => onContinuity(bible)} />
            <MgmtBtn icon={Search} label="Find & Replace" onClick={() => setShowFindReplace(!showFindReplace)} />
            <MgmtBtn icon={Download} label="Export" onClick={handleExport} />
            <MgmtBtn icon={Copy} label="Duplicate" onClick={handleDuplicate} disabled={duplicating} spinning={duplicating} />
            <div className="flex-1" />
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600">Delete bible? Books will be unlinked.</span>
                <Button variant="destructive" size="sm" className="h-6 rounded-full px-2 text-xs" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Yes, Delete'}
                </Button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            ) : (
              <MgmtBtn icon={Trash2} label="Delete" onClick={() => setShowDeleteConfirm(true)} danger />
            )}
          </div>

          {/* Find & Replace */}
          {showFindReplace && (
            <div className="mx-4 mb-3 space-y-2 rounded-2xl border border-border/50 bg-secondary/30 p-3">
              <p className="text-xs font-semibold text-foreground">🔍 Series-Wide Find & Replace</p>
              <p className="text-[10px] text-muted-foreground">Replaces across ALL chapters in ALL volumes of this series.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={frOldName} onChange={(e) => setFrOldName(e.target.value)}
                  placeholder="Find..." className="h-8 w-32 rounded-full border border-border bg-background px-3 text-xs" disabled={frRunning} />
                <span className="text-xs text-muted-foreground">→</span>
                <input value={frNewName} onChange={(e) => setFrNewName(e.target.value)}
                  placeholder="Replace with..." className="h-8 w-32 rounded-full border border-border bg-background px-3 text-xs" disabled={frRunning}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSeriesFindReplace(); }} />
                <Button size="sm" className="h-8 rounded-full px-3 text-xs" onClick={handleSeriesFindReplace}
                  disabled={frRunning || !frOldName.trim() || !frNewName.trim()}>
                  {frRunning ? <><Loader2 className="h-3 w-3 animate-spin" /> Running…</> : 'Replace All'}
                </Button>
                <button onClick={() => { setShowFindReplace(false); setFrOldName(''); setFrNewName(''); }}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MgmtBtn({ icon: Icon, label, onClick, disabled, spinning, danger }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors disabled:opacity-40
        ${danger ? 'text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      {spinning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />} {label}
    </button>
  );
}

/* ── VOLUME ROW ───────────────────────────────────────────────────────────── */

function VolumeRow({ project, isFirst, isLast, allVolumes, navigate, refreshAll, onSpinoff, onRewrite, wordCount }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(project.title || '');
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState(String(project.series_number || 1));
  const [saving, setSaving] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const saveTitle = async () => {
    if (!titleDraft.trim() || titleDraft.trim() === project.title) { setEditingTitle(false); return; }
    setSaving(true);
    try { await base44.entities.NovelProject.update(project.id, { title: titleDraft.trim() }); toast.success('Title updated'); refreshAll(); }
    catch (err) { toast.error('Failed'); } finally { setSaving(false); setEditingTitle(false); }
  };

  const saveNumber = async () => {
    const num = parseInt(numberDraft, 10);
    if (isNaN(num) || num < 1 || num === project.series_number) { setEditingNumber(false); return; }
    setSaving(true);
    try { await base44.entities.NovelProject.update(project.id, { series_number: num }); toast.success('Book # updated'); refreshAll(); }
    catch (err) { toast.error('Failed'); } finally { setSaving(false); setEditingNumber(false); }
  };

  const swapWith = async (other) => {
    const myNum = project.series_number || (allVolumes.indexOf(project) + 1);
    const otherNum = other.series_number || (allVolumes.indexOf(other) + 1);
    setSaving(true);
    try {
      await base44.entities.NovelProject.update(project.id, { series_number: otherNum });
      await base44.entities.NovelProject.update(other.id, { series_number: myNum });
      refreshAll();
    } catch (err) { toast.error('Failed to reorder'); } finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await base44.entities.NovelProject.update(project.id, { series_bible_id: '', series_name: '', series_number: null, series_flavor: '', series_flavor_note: '' });
      toast.success(`"${project.title || 'Untitled'}" removed from series`); refreshAll();
    } catch (err) { toast.error('Failed to remove'); } finally { setSaving(false); setShowRemove(false); }
  };

  return (
    <div className="group flex items-center gap-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/30">
      {/* Reorder arrows */}
      <div className="flex shrink-0 flex-col gap-0">
        <button onClick={() => { const i = allVolumes.indexOf(project); if (i > 0) swapWith(allVolumes[i-1]); }}
          disabled={isFirst || saving} className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button onClick={() => { const i = allVolumes.indexOf(project); if (i >= 0 && i < allVolumes.length - 1) swapWith(allVolumes[i+1]); }}
          disabled={isLast || saving} className="rounded p-0.5 text-muted-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-20">
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Book number */}
      {editingNumber ? (
        <div className="flex items-center gap-1">
          <Input value={numberDraft} onChange={(e) => setNumberDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNumber(); if (e.key === 'Escape') setEditingNumber(false); }}
            className="h-7 w-12 rounded-full text-center text-xs" type="number" min="1" autoFocus />
          <button onClick={saveNumber} className="p-0.5 text-green-600"><Check className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button onClick={() => setEditingNumber(true)}
          className="flex h-7 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
          title="Edit book number">#{project.series_number || '?'}</button>
      )}

      {/* Title */}
      {editingTitle ? (
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            className="h-7 flex-1 rounded-full text-xs" autoFocus />
          <button onClick={saveTitle} className="p-0.5 text-green-600"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => { setEditingTitle(false); setTitleDraft(project.title || ''); }} className="p-0.5 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button onClick={() => navigate(`/projects/${project.id}`)}
          className="flex-1 truncate text-left font-display text-sm text-foreground transition-colors hover:text-primary">
          {project.title || 'Untitled'}
        </button>
      )}

      {!editingTitle && (
        <button onClick={() => setEditingTitle(true)}
          className="shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100" title="Edit title">
          <Pencil className="h-3 w-3" />
        </button>
      )}

      {/* Tags */}
      <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
        {project.series_flavor === 'continuation' ? 'cont.' : project.series_flavor === 'anthology_volume' ? 'anth.' : project.series_flavor === 'standalone' ? 'standalone' : (project.project_type === 'anthology' || project.book_type === 'anthology') ? 'anth.' : ''}
      </span>
      <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
        {(wordCount || project.word_count) ? ((wordCount || project.word_count) >= 1000 ? Math.round((wordCount || project.word_count) / 1000) + 'K' : (wordCount || project.word_count)) + ' words' : '—'}
      </span>
      {project.phase && (
        <span className={'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ' + (
          project.phase === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          project.phase === 'polished' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
          project.phase === 'drafting' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
          'bg-secondary text-muted-foreground'
        )}>{project.phase}</span>
      )}
      {project.volume_bible_json && <span className="shrink-0 text-[9px]" title="Volume bible extracted">📖</span>}

      {/* Hover actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onRewrite && <button onClick={() => onRewrite(project)} className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400" title="Rewrite">Rewrite</button>}
        {onSpinoff && <button onClick={() => onSpinoff(project)} className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400" title="Spinoff">Spinoff</button>}
      </div>

      {/* Remove */}
      {showRemove ? (
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={handleRemove} disabled={saving} className="text-[10px] text-red-600 hover:underline">{saving ? '...' : 'Confirm'}</button>
          <button onClick={() => setShowRemove(false)} className="text-[10px] text-muted-foreground hover:underline">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowRemove(true)}
          className="shrink-0 rounded-full p-1 text-red-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100" title="Remove from series">
          <Unlink className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
 * IMPLEMENTED VIEWS — All stubs replaced with real functionality
 * ══════════════════════════════════════════════════════════════════════════════ */

/* ── NEW SERIES VIEW ─────────────────────────────────────────────────────── */

function NewSeriesView({ unlinkedProjects, onBack, onDone }) {
  const [seriesName, setSeriesName] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileRef = useRef(null);

  const toggleProject = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleCreate = async () => {
    if (!seriesName.trim()) { toast.error('Enter a series name'); return; }
    setLoading(true);
    try {
      let bibleData = { series_name: seriesName.trim(), books_analyzed: 0 };

      // If a manuscript file was uploaded, extract a series bible from it
      if (uploadFile) {
        setProgress('Parsing uploaded file…');
        let fullText = '';
        if (uploadFile.name.endsWith('.txt')) {
          fullText = await uploadFile.text();
        } else {
          const arrayBuffer = await uploadFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          fullText = result.value || '';
        }
        if (fullText.trim().length < 200) {
          toast.error('File has too little text to extract a bible'); setLoading(false); return;
        }
        const { seriesBible } = await extractSeriesBible(fullText, uploadFile.name.replace(/\.\w+$/, ''), null, setProgress);
        bibleData = { ...bibleData, ...seriesBible, series_name: seriesName.trim(), books_analyzed: 1 };
      }

      setProgress('Creating series bible…');
      const sanitized = sanitizeSeriesBible(bibleData);
      const created = await base44.entities.SeriesBible.create(sanitized);

      // Link selected projects
      if (selectedIds.length > 0) {
        setProgress('Linking projects…');
        for (let i = 0; i < selectedIds.length; i++) {
          await base44.entities.NovelProject.update(selectedIds[i], {
            series_bible_id: created.id,
            series_name: seriesName.trim(),
            series_number: i + 1,
          });
          if (i < selectedIds.length - 1) await new Promise(r => setTimeout(r, 300));
        }
        await base44.entities.SeriesBible.update(created.id, { books_analyzed: selectedIds.length + (uploadFile ? 1 : 0) });
      }

      onDone();
    } catch (err) {
      console.error('[NewSeries]', err);
      toast.error('Failed to create series: ' + (err.message || 'unknown'));
    } finally { setLoading(false); setProgress(''); }
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>New Series</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">Create a New Series</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Name your series, optionally select existing projects to include, and optionally upload a manuscript to extract a series bible from.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label className="mb-1.5 text-xs font-semibold text-foreground">Series Name</Label>
            <Input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="e.g. Hollywood Unhinged"
              className="rounded-full" disabled={loading} />
          </div>

          {unlinkedProjects.length > 0 && (
            <div>
              <Label className="mb-1.5 text-xs font-semibold text-foreground">Link Existing Projects (optional)</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border/50 bg-secondary/20 p-3">
                {unlinkedProjects.map(p => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/30">
                    <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => toggleProject(p.id)}
                      className="h-3.5 w-3.5 rounded accent-primary" disabled={loading} />
                    <span className="flex-1 truncate text-sm text-foreground">{p.title || 'Untitled'}</span>
                    <span className="text-[10px] text-muted-foreground">{p.project_type || 'fiction'}</span>
                  </label>
                ))}
              </div>
              {selectedIds.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{selectedIds.length} selected — they'll be numbered in the order shown.</p>}
            </div>
          )}

          <div>
            <Label className="mb-1.5 text-xs font-semibold text-foreground">Upload Manuscript for Bible Extraction (optional)</Label>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" onClick={() => fileRef.current?.click()} disabled={loading}>
                <Upload className="h-3 w-3" /> {uploadFile ? uploadFile.name : 'Choose .docx or .txt'}
              </Button>
              {uploadFile && <button onClick={() => { setUploadFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <input ref={fileRef} type="file" accept=".docx,.doc,.txt" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleCreate} disabled={loading || !seriesName.trim()} className="gap-1.5 rounded-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {loading ? 'Creating…' : 'Create Series'}
            </Button>
            {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SEQUEL VIEW ─────────────────────────────────────────────────────────── */

function SequelView({ bible, allProjects, onBack, onCreated }) {
  const [selectedFlavor, setSelectedFlavor] = useState(null);
  const [loading, setLoading] = useState(false);

  const linkedVolumes = useMemo(() => {
    return allProjects.filter(p => p.series_bible_id === bible.id).sort((a, b) => (a.series_number || 0) - (b.series_number || 0));
  }, [allProjects, bible.id]);

  const nextNumber = linkedVolumes.length > 0 ? Math.max(...linkedVolumes.map(v => v.series_number || 0)) + 1 : 1;
  const lastVolume = linkedVolumes.length > 0 ? linkedVolumes[linkedVolumes.length - 1] : null;

  const handleCreate = async () => {
    if (!selectedFlavor) return;
    setLoading(true);
    try {
      // WAVE9-SILENTSERIES: anything unreadable is collected rather than dropped.
      const unreadable = [];
      const flavorNote = buildFlavorNote(selectedFlavor, bible.series_name, lastVolume?.title || 'Book 1', bible);
      const richSeed = buildSeriesSeedConcept(selectedFlavor, bible, lastVolume, nextNumber, unreadable);
      const projectPayload = {
        title: `${bible.series_name || 'Untitled'} — Volume ${nextNumber}`,
        seed_concept: richSeed,
        series_bible_id: bible.id,
        series_name: bible.series_name || '',
        series_number: nextNumber,
        series_flavor: selectedFlavor,
        series_flavor_note: flavorNote,
      };

      if (selectedFlavor === 'continuation') {
        const chars = parseSeriesField(bible.characters_json, null, 'characters', unreadable);
        if (chars) projectPayload.characters_md = formatCharactersForStoryBible(chars);

        if (bible.world_state) projectPayload.world_md = bible.world_state;

        const threads = parseSeriesField(bible.unresolved_threads, null, 'unresolved threads', unreadable);
        // Raw text is better than nothing here — a human can still read it.
        projectPayload.mystery_md = threads
          ? formatUnresolvedThreads(threads)
          : (bible.unresolved_threads || undefined);
        const canonBlock = buildCanonFromSeriesBible(bible);
        if (canonBlock) projectPayload.canon_md = canonBlock;
        if (bible.voice_profile) projectPayload.voice_md = bible.voice_profile;
      }

      if (selectedFlavor === 'standalone') {
        if (bible.world_state) projectPayload.world_md = bible.world_state;
        if (bible.tone_and_themes) projectPayload.voice_md = `Tone: ${bible.tone_and_themes}`;
      }

      if (selectedFlavor === 'anthology_volume') {
        // WAVE2-ENUMFIX: book_type enum is fiction|nonfiction only —
        // 'anthology' belongs in project_type. The corrupt value used to reach
        // storage (the badge at the series list even compensated for it).
        projectPayload.book_type = 'fiction';
        projectPayload.project_type = 'anthology';
        // Inject series-level tone and world so anthology volumes stay consistent
        if (bible.tone_and_themes) projectPayload.voice_md = `Series tone & themes: ${bible.tone_and_themes}`;
        if (bible.world_state) projectPayload.world_md = bible.world_state;
        if (bible.rules_and_systems) projectPayload.canon_md = `Series rules: ${bible.rules_and_systems}`;
        // Carry anthology-specific settings from previous volume
        if (lastVolume) {
          if (lastVolume.anthology_theme) projectPayload.anthology_theme = lastVolume.anthology_theme;
          if (lastVolume.anthology_theme_type) projectPayload.anthology_theme_type = lastVolume.anthology_theme_type;
          if (lastVolume.anthology_story_length) projectPayload.anthology_story_length = lastVolume.anthology_story_length;
          if (lastVolume.anthology_variety) projectPayload.anthology_variety = lastVolume.anthology_variety;
        }
      }

      // Copy author/genre/style settings from previous volume
      if (lastVolume) {
        if (lastVolume.author_name) projectPayload.author_name = lastVolume.author_name;
        if (lastVolume.genre) projectPayload.genre = lastVolume.genre;
        if (lastVolume.subgenre) projectPayload.subgenre = lastVolume.subgenre;
        if (lastVolume.beat_style) projectPayload.beat_style = lastVolume.beat_style;
        if (lastVolume.language_intensity !== undefined) projectPayload.language_intensity = lastVolume.language_intensity;
        if (lastVolume.pov_mode) projectPayload.pov_mode = lastVolume.pov_mode;
        if (lastVolume.tense) projectPayload.tense = lastVolume.tense;
        if (!projectPayload.project_type && lastVolume.project_type) projectPayload.project_type = lastVolume.project_type;
      }

      const created = await base44.entities.NovelProject.create(projectPayload);
      await base44.entities.SeriesBible.update(bible.id, { books_analyzed: (bible.books_analyzed || 0) + 1 });

      // WAVE9-SILENTSERIES: the volume is still created — but say what is missing
      // from it. Silently omitting "DEAD — DO NOT RESURRECT" is how a character
      // walks back into book four alive.
      const warning = describeFieldFailures(unreadable, 'The new volume was created without it.');
      if (warning) toast.warning(warning, { duration: 12000 });

      onCreated(created.id);
    } catch (err) {
      console.error('[Sequel]', err);
      toast.error('Failed to create volume: ' + (err.message || 'unknown'));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>New Volume</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">New Volume in "{bible.series_name}"</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will be Book #{nextNumber}{lastVolume ? ` (after "${lastVolume.title || 'Untitled'}")` : ''}. Pick a sequel flavor:
        </p>

        <div className="mt-5 space-y-3">
          {SEQUEL_FLAVORS.map(flavor => (
            <button key={flavor.id} onClick={() => setSelectedFlavor(flavor.id)} disabled={loading}
              className={`w-full rounded-2xl border p-4 text-left transition-all ${
                selectedFlavor === flavor.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/50 bg-secondary/20 hover:border-border hover:bg-secondary/40'
              }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{flavor.emoji}</span>
                <div className="flex-1">
                  <p className="font-display text-base font-medium text-foreground">{flavor.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{flavor.description}</p>
                </div>
                {selectedFlavor === flavor.id && <CheckCircle className="h-5 w-5 shrink-0 text-primary" />}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleCreate} disabled={loading || !selectedFlavor} className="gap-1.5 rounded-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {loading ? 'Creating…' : `Create Book #${nextNumber}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── MERGE BOOK VIEW ─────────────────────────────────────────────────────── */

function MergeBookView({ bible, onBack, onDone }) {
  const [mode, setMode] = useState('project');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const fileRef = useRef(null);

  const { data: allProjects = [] } = useQuery({
    queryKey: ['all-novel-projects-merge'], queryFn: () => base44.entities.NovelProject.list(),
  });

  const handleMerge = async () => {
    setLoading(true);
    try {
      let manuscriptText = '';
      let bookTitle = '';

      if (mode === 'upload' && uploadFile) {
        setProgress('Parsing uploaded file…');
        if (uploadFile.name.endsWith('.txt')) {
          manuscriptText = await uploadFile.text();
        } else {
          const arrayBuffer = await uploadFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          manuscriptText = result.value || '';
        }
        bookTitle = uploadFile.name.replace(/\.\w+$/, '');
      } else if (mode === 'project' && selectedProjectId) {
        setProgress('Loading chapters from project…');
        const project = allProjects.find(p => p.id === selectedProjectId);
        bookTitle = project?.title || 'Untitled';
        let chapters = [];
        try { chapters = await base44.entities.Chapter.filter({ project_id: selectedProjectId }); }
        catch (e) { chapters = (await base44.entities.Chapter.list()).filter(c => c.project_id === selectedProjectId); }
        chapters.sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
        const bodyChapters = chapters.filter(ch => chapterHasContent(ch) && isBodyChapter(ch));
        const parts = [];
        for (const ch of bodyChapters) {
          const content = await resolveChapterContent(ch);
          if (content) parts.push(content);
        }
        manuscriptText = parts.join('\n\n');
      } else {
        toast.error('Select a project or upload a file'); setLoading(false); return;
      }

      if (manuscriptText.trim().length < 200) {
        toast.error('Not enough text to extract a bible'); setLoading(false); return;
      }

      const { seriesBible: extracted } = await extractSeriesBible(manuscriptText, bookTitle, bible, setProgress);

      setProgress('Merging into series bible…');
      const mergePayload = {};

      // WAVE9-SILENTSERIES: this is an APPEND, and it used to be able to become
      // an overwrite. If the stored roster failed to parse, `existingChars` fell
      // back to [] and the merge wrote that back — erasing every character from
      // every previous book, silently, at the exact moment the writer thought
      // they were enriching the bible. A field we cannot read is a field we
      // refuse to replace.
      const mergeSkipped = [];

      if (extracted.characters_json) {
        const existingChars = parseSeriesField(bible.characters_json, null, 'characters', mergeSkipped);
        const newChars = parseSeriesField(extracted.characters_json, [], 'newly extracted characters', mergeSkipped);

        if (existingChars === null && bible.characters_json) {
          // Unreadable existing roster — leave characters_json untouched.
          console.warn('[SERIES-MERGE] refusing to overwrite unreadable characters_json');
        } else {
          const merged = Array.isArray(existingChars) ? [...existingChars] : [];
          const existingNames = new Set(merged.map(c => (c.name || '').toLowerCase()));
          for (const nc of (Array.isArray(newChars) ? newChars : [])) {
            if (!existingNames.has((nc.name || '').toLowerCase())) merged.push(nc);
          }
          mergePayload.characters_json = JSON.stringify(merged);
        }
      }

      // Merge array fields — same rule.
      const arrayFields = ['unresolved_threads', 'resolved_threads', 'deaths_and_losses', 'secrets_revealed', 'secrets_remaining'];
      for (const field of arrayFields) {
        if (!extracted[field]) continue;
        const label = field.replace(/_/g, ' ');
        const existing = parseSeriesField(bible[field], null, label, mergeSkipped);
        const incoming = parseSeriesField(extracted[field], [], `newly extracted ${label}`, mergeSkipped);

        if (existing === null && bible[field]) {
          console.warn(`[SERIES-MERGE] refusing to overwrite unreadable ${field}`);
          continue;
        }
        const base = Array.isArray(existing) ? existing : [];
        const add = Array.isArray(incoming) ? incoming : [];
        mergePayload[field] = JSON.stringify([...base, ...add.filter(item => !base.includes(item))]);
      }

      // Merge text fields
      const textFields = ['world_state', 'rules_and_systems', 'key_locations', 'tone_and_themes', 'timeline', 'voice_profile', 'power_levels'];
      for (const field of textFields) {
        if (extracted[field] && extracted[field] !== bible[field]) {
          const existing = bible[field] || '';
          const incoming = typeof extracted[field] === 'string' ? extracted[field] : JSON.stringify(extracted[field]);
          mergePayload[field] = existing ? existing + '\n\n--- Merged from: ' + bookTitle + ' ---\n\n' + incoming : incoming;
        }
      }

      mergePayload.books_analyzed = (bible.books_analyzed || 0) + 1;
      mergePayload.last_book_title = bookTitle;
      if (extracted.last_book_ending) mergePayload.last_book_ending = extracted.last_book_ending;

      const sanitized = sanitizeSeriesBible(mergePayload);
      await base44.entities.SeriesBible.update(bible.id, sanitized);

      const mergeWarning = describeFieldFailures(
        mergeSkipped,
        'Those fields were left exactly as they were rather than overwritten.'
      );
      if (mergeWarning) toast.warning(mergeWarning, { duration: 14000 });

      // If merging from a project, link it
      if (mode === 'project' && selectedProjectId) {
        const project = allProjects.find(p => p.id === selectedProjectId);
        if (project && !project.series_bible_id) {
          const existingLinked = allProjects.filter(p => p.series_bible_id === bible.id);
          const nextNum = existingLinked.length > 0 ? Math.max(...existingLinked.map(v => v.series_number || 0)) + 1 : 1;
          await base44.entities.NovelProject.update(selectedProjectId, {
            series_bible_id: bible.id, series_name: bible.series_name, series_number: nextNum,
          });
        }
      }

      onDone();
    } catch (err) {
      console.error('[MergeBook]', err);
      toast.error('Merge failed: ' + (err.message || 'unknown'));
    } finally { setLoading(false); setProgress(''); }
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>Merge Book</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">Merge Into "{bible.series_name}"</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a book's characters, events, and threads to this series bible. Select an existing project or upload a manuscript.
        </p>

        <div className="mt-5 flex gap-2">
          <button onClick={() => setMode('project')} disabled={loading}
            className={`flex-1 rounded-2xl border p-3 text-center text-xs transition-all ${mode === 'project' ? 'border-primary bg-primary/5 font-semibold text-foreground' : 'border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'}`}>
            <FileText className="mx-auto mb-1 h-5 w-5" /> Select Project
          </button>
          <button onClick={() => setMode('upload')} disabled={loading}
            className={`flex-1 rounded-2xl border p-3 text-center text-xs transition-all ${mode === 'upload' ? 'border-primary bg-primary/5 font-semibold text-foreground' : 'border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40'}`}>
            <Upload className="mx-auto mb-1 h-5 w-5" /> Upload File
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {mode === 'project' && (
            <div>
              <Label className="mb-1.5 text-xs font-semibold text-foreground">Select Project</Label>
              <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-9 w-full rounded-full border border-border bg-background px-3 text-sm" disabled={loading}>
                <option value="">— Choose a project —</option>
                {allProjects.filter(p => p.id !== bible.id).map(p => (
                  <option key={p.id} value={p.id}>{p.title || 'Untitled'} ({p.project_type || 'fiction'}){p.series_bible_id ? ' [linked]' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {mode === 'upload' && (
            <div>
              <Label className="mb-1.5 text-xs font-semibold text-foreground">Upload Manuscript</Label>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" onClick={() => fileRef.current?.click()} disabled={loading}>
                  <Upload className="h-3 w-3" /> {uploadFile ? uploadFile.name : 'Choose .docx or .txt'}
                </Button>
                {uploadFile && <button onClick={() => { setUploadFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-xs text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <input ref={fileRef} type="file" accept=".docx,.doc,.txt" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setUploadFile(e.target.files[0]); }} />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleMerge} className="gap-1.5 rounded-full"
              disabled={loading || (mode === 'project' && !selectedProjectId) || (mode === 'upload' && !uploadFile)}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Merging…' : 'Merge Into Bible'}
            </Button>
            {progress && <span className="text-xs text-muted-foreground">{progress}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SERIES CRITIC VIEW ──────────────────────────────────────────────────── */

function SeriesCriticView({ bible, projects, onBack }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setResults(null);
    try {
      const volumeBlocks = [];
      for (let i = 0; i < projects.length; i++) {
        const vol = projects[i];
        setProgress(`Loading Book ${vol.series_number || i + 1}: "${vol.title || 'Untitled'}"…`);

        let excerpt = '';
        if (vol.volume_bible_json) {
          try {
            const vb = typeof vol.volume_bible_json === 'string' ? JSON.parse(vol.volume_bible_json) : vol.volume_bible_json;
            excerpt = JSON.stringify(vb, null, 2).substring(0, 3000);
          } catch (e) {
            // WAVE9-SILENTSERIES: excerpt stays empty and the analysis runs on
            // nothing; at minimum leave a trail rather than none.
            console.warn('[SERIES] unreadable volume_bible_json for', vol.title || vol.id, e?.message || e);
          }
        }
        if (!excerpt) {
          const parts = [];
          if (vol.characters_md) parts.push('CHARACTERS:\n' + vol.characters_md.substring(0, 1500));
          if (vol.world_md) parts.push('WORLD:\n' + vol.world_md.substring(0, 1000));
          if (vol.canon_md) parts.push('CANON:\n' + vol.canon_md.substring(0, 1000));
          if (vol.mystery_md) parts.push('THREADS:\n' + vol.mystery_md.substring(0, 800));
          if (parts.length > 0) excerpt = parts.join('\n\n');
        }
        if (!excerpt) {
          try {
            const chapters = await base44.entities.Chapter.filter({ project_id: vol.id });
            const body = chapters.filter(ch => chapterHasContent(ch) && isBodyChapter(ch)).sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
            if (body.length > 0) {
              const first = await resolveChapterContent(body[0]);
              const last = body.length > 1 ? await resolveChapterContent(body[body.length - 1]) : '';
              excerpt = (first || '').substring(0, 2000) + '\n\n[...]\n\n' + (last || '').substring(0, 2000);
            }
          } catch (e) {
            console.warn('[SERIES] could not build a chapter excerpt for', vol.title || vol.id, e?.message || e);
          }
        }
        if (excerpt) {
          volumeBlocks.push(`=== BOOK ${vol.series_number || i + 1}: "${vol.title || 'Untitled'}" ===\n${excerpt}`);
        }
      }

      if (volumeBlocks.length === 0) {
        setResults({ summary: 'No volume data available. Extract volume bibles first, or ensure projects have story bible fields or chapter content.', categories: [] });
        return;
      }

      let bibleContext = '';
      if (bible.tone_and_themes) bibleContext += 'SERIES THEMES: ' + bible.tone_and_themes.substring(0, 500) + '\n';
      if (bible.world_state) bibleContext += 'WORLD STATE: ' + bible.world_state.substring(0, 500) + '\n';

      setProgress('Running series critique via Gemini…');
      const response = await invokeLLMWithRetry({
        model: 'gemini_3_flash',
        fallback_model: 'deepseek/deepseek-chat-v3-0324',
        temperature: 0.2,
        max_tokens: 4000,
        prompt: `You are a developmental editor evaluating a ${volumeBlocks.length}-book series called "${bible.series_name || 'Untitled Series'}" for commercial viability.

${bibleContext}

${volumeBlocks.join('\n\n')}

Analyze the series across these categories:

1. ARC PROGRESSION — Does each book raise the stakes? Does the overall arc build to a satisfying crescendo? Are there books that stall the momentum?
2. CHARACTER GROWTH — Do protagonists and key characters show measurable growth across books? Are arcs earned or rushed? Any characters who regress without justification?
3. STAKES ESCALATION — Does each book's central conflict feel bigger/deeper than the last? Any books where stakes deflate?
4. THEMATIC CONSISTENCY — Are the core themes maintained and deepened? Any tonal whiplash between volumes?
5. MARKETABILITY — Would a reader who finished Book 1 buy Book 2? Where might readers drop off? What's the series hook?

Return JSON only, no markdown:
{
  "summary": "Overall 2-3 sentence series assessment with a letter grade A-F",
  "categories": [
    {
      "name": "Arc Progression",
      "grade": "A-F letter grade",
      "strengths": ["specific strength"],
      "weaknesses": ["specific weakness"],
      "recommendation": "One concrete action to improve"
    }
  ],
  "dropoff_risk": "Which book # is the biggest risk for reader dropoff and why",
  "series_hook": "What makes this series compelling enough to keep reading"
}`,
      });

      let text = typeof response === 'string' ? response : (response?.text || '');
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { summary: text.substring(0, 800), categories: [] }; }
      setResults(parsed);
    } catch (err) {
      console.error('[SeriesCritic]', err);
      setResults({ summary: 'Analysis failed: ' + err.message, categories: [] });
    } finally { setLoading(false); setProgress(''); }
  }, [bible, projects]);

  const gradeColor = (grade) => {
    if (!grade) return 'text-muted-foreground';
    const g = grade.toUpperCase().charAt(0);
    if (g === 'A') return 'text-green-600';
    if (g === 'B') return 'text-blue-600';
    if (g === 'C') return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>Series Critique</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">{bible.series_name || 'Untitled Series'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Evaluates arc progression, character growth, stakes escalation, thematic consistency, and marketability across {projects.length} volume{projects.length !== 1 ? 's' : ''}.
        </p>

        {!loading && !results && (
          <Button onClick={handleAnalyze} className="mt-4 gap-1.5 rounded-full" disabled={projects.length < 2}>
            <Sparkles className="h-4 w-4" /> {projects.length < 2 ? 'Need 2+ volumes' : 'Run Series Critique'}
          </Button>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {progress || 'Analyzing…'}
          </div>
        )}

        {results && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-secondary/30 p-4">
              <p className="text-sm text-foreground">{results.summary}</p>
            </div>

            {results.categories?.length > 0 && (
              <div className="space-y-3">
                {results.categories.map((cat, i) => (
                  <div key={i} className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-base font-medium text-foreground">{cat.name}</p>
                      <span className={`font-display text-2xl font-bold ${gradeColor(cat.grade)}`}>{cat.grade}</span>
                    </div>
                    {cat.strengths?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600">Strengths</p>
                        {cat.strengths.map((s, j) => <p key={j} className="mt-0.5 text-xs text-muted-foreground">+ {s}</p>)}
                      </div>
                    )}
                    {cat.weaknesses?.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-red-500">Weaknesses</p>
                        {cat.weaknesses.map((w, j) => <p key={j} className="mt-0.5 text-xs text-muted-foreground">− {w}</p>)}
                      </div>
                    )}
                    {cat.recommendation && (
                      <div className="mt-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">Recommendation</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{cat.recommendation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(results.dropoff_risk || results.series_hook) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {results.dropoff_risk && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800/30 dark:bg-amber-950/20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">⚠ Dropoff Risk</p>
                    <p className="mt-1 text-xs text-foreground">{results.dropoff_risk}</p>
                  </div>
                )}
                {results.series_hook && (
                  <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 dark:border-green-800/30 dark:bg-green-950/20">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600">🪝 Series Hook</p>
                    <p className="mt-1 text-xs text-foreground">{results.series_hook}</p>
                  </div>
                )}
              </div>
            )}

            <Button variant="outline" onClick={() => setResults(null)} className="gap-1.5 rounded-full text-xs">
              <RefreshCw className="h-3 w-3" /> Run Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SERIES CONTINUITY VIEW ──────────────────────────────────────────────── */

function SeriesContinuityView({ bible, projects, onBack }) {
  const [threadData, setThreadData] = useState(null);
  const [characterData, setCharacterData] = useState(null);
  // WAVE9-SILENTSERIES: an unreadable field used to render as an empty list,
  // which on a continuity dashboard reads as "nothing outstanding" — the exact
  // opposite of what it means.
  const [unreadable, setUnreadable] = useState([]);

  useEffect(() => {
    const bad = [];
    const unresolvedThreads = parseSeriesField(bible.unresolved_threads, [], 'unresolved threads', bad);
    const resolvedThreads = parseSeriesField(bible.resolved_threads, [], 'resolved threads', bad);
    const deaths = parseSeriesField(bible.deaths_and_losses, [], 'deaths and losses', bad);
    const characters = parseSeriesField(bible.characters_json, [], 'characters', bad);
    setUnreadable(bad);

    const allThreads = [
      ...unresolvedThreads.map(t => ({ thread: typeof t === 'string' ? t : (t.thread || t.description || JSON.stringify(t)), resolved: false })),
      ...resolvedThreads.map(t => ({ thread: typeof t === 'string' ? t : (t.thread || t.description || JSON.stringify(t)), resolved: true })),
    ];

    const enrichedThreads = allThreads.map(t => {
      let introducedIn = '?';
      for (const vol of projects) {
        if (vol.volume_bible_json) {
          try {
            const vb = typeof vol.volume_bible_json === 'string' ? JSON.parse(vol.volume_bible_json) : vol.volume_bible_json;
            const allVbThreads = [
              ...(vb.unresolved_threads || []),
              ...(vb.resolved_threads || []),
              ...(vb.plot_threads || []),
            ].map(x => typeof x === 'string' ? x : (x.thread || x.description || ''));
            if (allVbThreads.some(vt => vt.toLowerCase().includes(t.thread.substring(0, 30).toLowerCase()))) {
              introducedIn = `Book ${vol.series_number || '?'}`;
              break;
            }
          } catch (e) {
            // Origin stays '?' — correct, but say why it could not be found.
            console.warn('[SERIES] thread origin lookup skipped Book', vol.series_number, e?.message || e);
          }
        }
      }
      return { ...t, introducedIn };
    });

    setThreadData(enrichedThreads);

    const charArcs = characters.map(c => {
      const arc = {
        name: c.name || 'Unknown',
        role: c.role || '',
        statusAtEnd: c.status_at_end || 'unknown',
        arcStart: c.arc_start || '',
        arcEnd: c.arc_end || '',
        isDead: deaths.some(d => (typeof d === 'string' ? d : '').toLowerCase().includes((c.name || '').toLowerCase())),
      };
      arc.volumeStates = [];
      for (const vol of projects) {
        if (vol.volume_bible_json) {
          try {
            const vb = typeof vol.volume_bible_json === 'string' ? JSON.parse(vol.volume_bible_json) : vol.volume_bible_json;
            const vbChars = vb.characters || [];
            const match = vbChars.find(vc => (vc.name || '').toLowerCase() === (c.name || '').toLowerCase());
            if (match) {
              arc.volumeStates.push({ volume: vol.series_number || '?', status: match.status_at_end || match.status || 'present', notes: match.arc_end || match.arc_summary || '' });
            }
          } catch (e) {
            console.warn('[SERIES] character arc lookup skipped Book', vol.series_number, e?.message || e);
          }
        }
      }
      return arc;
    });

    setCharacterData(charArcs);
  }, [bible, projects]);

  const unresolvedOld = (threadData || []).filter(t => !t.resolved && t.introducedIn !== '?' && parseInt(t.introducedIn.replace(/\D/g, '')) <= (projects.length - 1));

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>Continuity Tracker</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">{bible.series_name || 'Untitled Series'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Thread and character state tracking across {projects.length} volume{projects.length !== 1 ? 's' : ''}.
        </p>

        {unreadable.length > 0 && (
          <div className="mt-4 rounded-2xl border border-red-300 bg-red-50/60 p-3 dark:border-red-800/40 dark:bg-red-950/20">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">
              This tracker is incomplete
            </p>
            <p className="mt-1 text-[11px] text-red-600 dark:text-red-300">
              {describeFieldFailures(unreadable)} An empty list below does not mean nothing is
              outstanding — it means that data could not be read.
            </p>
          </div>
        )}

        {unresolvedOld.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⚠ {unresolvedOld.length} thread{unresolvedOld.length !== 1 ? 's' : ''} introduced 2+ books ago still unresolved</p>
            <div className="mt-1 space-y-0.5">
              {unresolvedOld.map((t, i) => (
                <p key={i} className="text-[11px] text-amber-600 dark:text-amber-300">• {t.thread.substring(0, 120)}{t.thread.length > 120 ? '…' : ''} — since {t.introducedIn}</p>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Plot Threads</p>
          {(!threadData || threadData.length === 0) ? (
            <p className="mt-2 text-xs text-muted-foreground">No threads found in series bible. Extract volume bibles first.</p>
          ) : (
            <div className="mt-2 space-y-1">
              {threadData.map((t, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl bg-secondary/20 px-3 py-2">
                  <span className={`mt-0.5 shrink-0 text-sm ${t.resolved ? 'text-green-500' : 'text-amber-500'}`}>
                    {t.resolved ? '✓' : '○'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground">{t.thread}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.resolved ? 'Resolved' : 'Open'}{t.introducedIn !== '?' ? ` — introduced ${t.introducedIn}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Character Arcs</p>
          {(!characterData || characterData.length === 0) ? (
            <p className="mt-2 text-xs text-muted-foreground">No characters found in series bible.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {characterData.filter(c => c.role !== 'minor').map((c, i) => (
                <div key={i} className="rounded-2xl border border-border/40 bg-secondary/20 p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-display text-sm font-medium text-foreground">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.role}</span>
                    {c.isDead && <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">DEAD</span>}
                    {c.statusAtEnd && c.statusAtEnd !== 'unknown' && !c.isDead && (
                      <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">{c.statusAtEnd}</span>
                    )}
                  </div>
                  {(c.arcStart || c.arcEnd) && (
                    <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                      {c.arcStart && <span className="text-muted-foreground">Start: {c.arcStart.substring(0, 80)}</span>}
                      {c.arcStart && c.arcEnd && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                      {c.arcEnd && <span className="text-foreground">End: {c.arcEnd.substring(0, 80)}</span>}
                    </div>
                  )}
                  {c.volumeStates.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.volumeStates.map((vs, j) => (
                        <span key={j} className="rounded-full bg-accent/30 px-2 py-0.5 text-[9px] text-muted-foreground" title={vs.notes}>
                          Book {vs.volume}: {vs.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── SPINOFF VIEW ────────────────────────────────────────────────────────── */

function SpinoffView({ bible, volume, projects, onBack, onCreated }) {
  const [spinoffTitle, setSpinoffTitle] = useState(`${volume.title || 'Untitled'} — Spinoff`);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!spinoffTitle.trim()) { toast.error('Enter a title'); return; }
    setLoading(true);
    try {
      // Build rich seed_concept with spinoff context
      const spinoffSeedParts = [
        `Spinoff branching from Book ${volume.series_number}: "${volume.title || 'Untitled'}" in the "${bible.series_name || 'Untitled'}" series.`,
        'SPINOFF TYPE: New standalone story that branches from the exit state of the source volume. Characters and world carry forward but the plot goes in a new direction.',
      ];
      // WAVE9-SILENTSERIES: a spinoff whose seed silently lost the exit state of
      // the volume it branches from is a spinoff of nothing.
      const spinoffBad = [];
      const vb = parseSeriesField(volume.volume_bible_json, null, `Book ${volume.series_number || '?'} volume bible`, spinoffBad);
      if (vb) {
        if (vb.characters) {
          const charList = vb.characters.slice(0, 10).map(c => `${c.name} (${c.role || '?'}): ${c.status_at_end || c.status || 'alive'}`).join('\n');
          spinoffSeedParts.push('CHARACTERS AT EXIT:\n' + charList);
        }
        if (vb.world_state) spinoffSeedParts.push('WORLD STATE: ' + (typeof vb.world_state === 'string' ? vb.world_state : JSON.stringify(vb.world_state)).substring(0, 600));
        if (vb.unresolved_threads?.length) spinoffSeedParts.push('UNRESOLVED THREADS:\n- ' + vb.unresolved_threads.slice(0, 8).map(t => typeof t === 'string' ? t : (t.thread || t.description || '')).join('\n- '));
      }
      if (bible.tone_and_themes) spinoffSeedParts.push('SERIES TONE: ' + bible.tone_and_themes.substring(0, 300));

      const projectPayload = {
        title: spinoffTitle.trim(),
        seed_concept: spinoffSeedParts.join('\n\n'),
        series_bible_id: bible.id,
        series_name: bible.series_name || '',
        series_number: (Math.max(...projects.map(p => p.series_number || 0), 0)) + 1,
        series_flavor: 'standalone',
        series_flavor_note: `Spinoff branching from Book ${volume.series_number}: "${volume.title}". Uses exit state from that volume.`,
      };

      // Same parsed value as above — no second parse, no second silent failure.
      if (vb) {
        if (vb.characters) {
          projectPayload.characters_md = vb.characters.map(c => `**${c.name}** (${c.role || 'unknown'}): ${c.status_at_end || c.status || 'alive'}. ${c.arc_end || c.arc_summary || ''}`).join('\n\n');
        }
        if (vb.world_state) projectPayload.world_md = typeof vb.world_state === 'string' ? vb.world_state : JSON.stringify(vb.world_state);
        if (vb.unresolved_threads) {
          const threads = Array.isArray(vb.unresolved_threads) ? vb.unresolved_threads : [];
          projectPayload.mystery_md = threads.map(t => typeof t === 'string' ? `- ${t}` : `- ${t.thread || t.description || JSON.stringify(t)}`).join('\n');
        }
      }

      if (!projectPayload.world_md && bible.world_state) projectPayload.world_md = bible.world_state;
      if (bible.voice_profile) projectPayload.voice_md = bible.voice_profile;

      if (volume.author_name) projectPayload.author_name = volume.author_name;
      if (volume.genre) projectPayload.genre = volume.genre;
      if (volume.subgenre) projectPayload.subgenre = volume.subgenre;
      if (volume.project_type) projectPayload.project_type = volume.project_type;
      if (volume.beat_style) projectPayload.beat_style = volume.beat_style;
      if (volume.language_intensity !== undefined) projectPayload.language_intensity = volume.language_intensity;

      const created = await base44.entities.NovelProject.create(projectPayload);
      await base44.entities.SeriesBible.update(bible.id, { books_analyzed: (bible.books_analyzed || 0) + 1 });

      const spinoffWarning = describeFieldFailures(spinoffBad, 'The spinoff was created without that exit state.');
      if (spinoffWarning) toast.warning(spinoffWarning, { duration: 12000 });

      onCreated(created.id);
    } catch (err) {
      console.error('[Spinoff]', err);
      toast.error('Failed to create spinoff: ' + (err.message || 'unknown'));
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>Spinoff</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">Spinoff from Book {volume.series_number}: "{volume.title}"</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Creates a new project branching from this volume's exit state. Characters, world, and unresolved threads from the source volume will be injected.
        </p>

        {!volume.volume_bible_json && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/30 dark:bg-amber-950/20">
            <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> No volume bible extracted yet. The spinoff will use series-level data instead. Consider extracting a volume bible first for better results.
            </p>
          </div>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <Label className="mb-1.5 text-xs font-semibold text-foreground">Spinoff Title</Label>
            <Input value={spinoffTitle} onChange={(e) => setSpinoffTitle(e.target.value)} className="rounded-full" disabled={loading} />
          </div>
          <Button onClick={handleCreate} disabled={loading || !spinoffTitle.trim()} className="gap-1.5 rounded-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
            {loading ? 'Creating…' : 'Create Spinoff'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── REWRITE VOLUME VIEW ─────────────────────────────────────────────────── */

// WAVE9-DEADPROPS: this view only navigates to the project; it changes nothing
// in the series list, so there is nothing for refreshAll to refresh.
function RewriteVolumeView({ bible, volume, projects, onBack, navigate }) {
  const [entryContract, setEntryContract] = useState(null);
  const [exitContract, setExitContract] = useState(null);
  const [loadingContracts, setLoadingContracts] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingContracts(true);
      try {
        const entry = getEntryContractForVolume(projects, volume.series_number);
        const exit = getExitContractForVolume(projects, volume.series_number);
        setEntryContract(entry);
        setExitContract(exit);
      } catch (e) { console.error('[RewriteVolume]', e); }
      finally { setLoadingContracts(false); }
    })();
  }, [volume, projects]);

  const handleNavigateToProject = () => {
    navigate(`/projects/${volume.id}`);
  };

  const renderContract = (title, emoji, contract) => {
    if (!contract || Object.keys(contract).length === 0) return (
      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{emoji} {title}: No contract data. Extract volume bibles for adjacent books first.</p>
      </div>
    );
    return (
      <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">{emoji} {title}</p>
        <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          {contract.description && <p className="text-foreground">{contract.description}</p>}
          {contract.characters_required_alive?.length > 0 && <p><span className="font-medium text-foreground">Must be alive:</span> {contract.characters_required_alive.join(', ')}</p>}
          {contract.characters_required_dead?.length > 0 && <p><span className="font-medium text-foreground">Must be dead:</span> {contract.characters_required_dead.join(', ')}</p>}
          {contract.characters_alive?.length > 0 && <p><span className="font-medium text-foreground">Alive at end:</span> {contract.characters_alive.join(', ')}</p>}
          {contract.characters_dead?.length > 0 && <p><span className="font-medium text-foreground">Dead at end:</span> {contract.characters_dead.join(', ')}</p>}
          {contract.threads_that_must_be_open?.length > 0 && <p><span className="font-medium text-foreground">Open threads:</span> {contract.threads_that_must_be_open.join('; ')}</p>}
          {contract.threads_open_for_next?.length > 0 && <p><span className="font-medium text-foreground">Open for next:</span> {contract.threads_open_for_next.join('; ')}</p>}
          {contract.threads_closed?.length > 0 && <p><span className="font-medium text-foreground">Closed:</span> {contract.threads_closed.join('; ')}</p>}
          {contract.world_facts_assumed?.length > 0 && <p><span className="font-medium text-foreground">World facts:</span> {contract.world_facts_assumed.join('; ')}</p>}
          {contract.world_state_facts?.length > 0 && <p><span className="font-medium text-foreground">World state:</span> {contract.world_state_facts.join('; ')}</p>}
          {contract.emotional_state_of_protagonist && <p><span className="font-medium text-foreground">Protagonist state:</span> {contract.emotional_state_of_protagonist}</p>}
          {contract.cliffhangers?.length > 0 && <p><span className="font-medium text-foreground">Cliffhangers:</span> {contract.cliffhangers.join('; ')}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} />
      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <SectionKicker>Rewrite Volume</SectionKicker>
        <h2 className="mt-1 font-display text-2xl text-foreground">Rewrite Book {volume.series_number}: "{volume.title}"</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This volume must respect the contracts of adjacent books. Review the constraints below, then open the project to begin rewriting.
        </p>

        {loadingContracts ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {renderContract('Entry Contract (from Book ' + ((volume.series_number || 1) - 1) + ')', '📥', entryContract)}
            {renderContract('Exit Contract (required by Book ' + ((volume.series_number || 1) + 1) + ')', '📤', exitContract)}
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleNavigateToProject} className="gap-1.5 rounded-full">
            <BookOpen className="h-4 w-4" /> Open Project
          </Button>
          <p className="text-[10px] text-muted-foreground">
            The entry/exit contracts above define what this rewrite must preserve.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

/**
 * Builds a rich seed_concept that carries series bible context through foundation
 * regeneration cycles. seed_concept is a protected field — it survives when the
 * user regenerates the foundation, unlike characters_md/world_md/etc. which get
 * overwritten. This ensures the foundation LLM always has series context.
 */
// WAVE9-SILENTSERIES: `sink` collects the names of fields that could not be
// read, so the caller can tell the writer which continuity is missing from the
// seed instead of handing them a quietly incomplete one.
function buildSeriesSeedConcept(flavor, bible, lastVolume, volumeNumber, sink) {
  const parts = [`This is Book ${volumeNumber} in the "${bible.series_name || 'Untitled'}" series.`];

  if (lastVolume) {
    parts.push(`Previous volume: "${lastVolume.title || 'Untitled'}" (Book ${lastVolume.series_number || volumeNumber - 1}).`);
  }

  if (flavor === 'continuation') {
    parts.push('SEQUEL TYPE: True Continuation — picks up directly after the previous book. All characters, world state, unresolved threads, and consequences carry forward.');
    if (bible.last_book_ending) parts.push(`PREVIOUS BOOK ENDED: ${String(bible.last_book_ending).substring(0, 600)}`);
    // Characters — who's alive, who's dead. If this field cannot be read, the
    // "DO NOT RESURRECT" line silently never reaches the prompt.
    const chars = parseSeriesField(bible.characters_json, [], 'characters', sink);
    if (Array.isArray(chars) && chars.length > 0) {
      const alive = chars.filter(c => c.status_at_end !== 'dead').map(c => `${c.name} (${c.role || 'unknown'}): ${c.arc_end || c.status_at_end || 'alive'}`);
      const dead = chars.filter(c => c.status_at_end === 'dead').map(c => c.name);
      if (alive.length > 0) parts.push('RETURNING CHARACTERS:\n' + alive.slice(0, 15).join('\n'));
      if (dead.length > 0) parts.push('DEAD — DO NOT RESURRECT: ' + dead.join(', '));
    }
    // Unresolved threads
    const threads = parseSeriesField(bible.unresolved_threads, [], 'unresolved threads', sink);
    if (Array.isArray(threads) && threads.length > 0) {
      parts.push('UNRESOLVED THREADS TO ADDRESS:\n- ' + threads.slice(0, 10).join('\n- '));
    }
    // Secrets
    const secrets = parseSeriesField(bible.secrets_remaining, [], 'secrets remaining', sink);
    if (Array.isArray(secrets) && secrets.length > 0) {
      parts.push('SECRETS NOT YET REVEALED:\n- ' + secrets.slice(0, 8).join('\n- '));
    }
    // World state
    if (bible.world_state) parts.push('WORLD STATE AT END OF PREVIOUS BOOK: ' + bible.world_state.substring(0, 800));
    // Tone
    if (bible.tone_and_themes) parts.push('SERIES TONE & THEMES: ' + bible.tone_and_themes.substring(0, 400));
    // Rules
    if (bible.rules_and_systems) parts.push('WORLD RULES: ' + bible.rules_and_systems.substring(0, 400));
  }

  if (flavor === 'standalone') {
    parts.push('SEQUEL TYPE: Standalone — shares the world and pen name but story is self-contained. New characters, new conflict. No continuity canon required.');
    if (bible.world_state) parts.push('SHARED WORLD: ' + bible.world_state.substring(0, 600));
    if (bible.tone_and_themes) parts.push('SERIES TONE: ' + bible.tone_and_themes.substring(0, 400));
    if (bible.rules_and_systems) parts.push('WORLD RULES TO RESPECT: ' + bible.rules_and_systems.substring(0, 400));
  }

  if (flavor === 'anthology_volume') {
    parts.push('SEQUEL TYPE: Anthology Volume — next volume of a multi-volume anthology series. Fresh standalone stories under the shared theme. Each chapter is a self-contained story with unique characters.');
    if (bible.tone_and_themes) parts.push('SERIES TONE & THEMES (maintain across volumes): ' + bible.tone_and_themes.substring(0, 400));
    if (bible.world_state) parts.push('SHARED WORLD/SETTING: ' + bible.world_state.substring(0, 400));
    if (bible.rules_and_systems) parts.push('SERIES RULES: ' + bible.rules_and_systems.substring(0, 400));
    if (lastVolume?.anthology_theme) parts.push('ANTHOLOGY THEME: ' + lastVolume.anthology_theme);
  }

  return parts.join('\n\n');
}

function buildFlavorNote(flavor, seriesName, lastBook, bible) {
  if (flavor === 'continuation') return `True continuation of ${seriesName}. Picks up after ${lastBook}. ` + (bible.last_book_ending ? `Previous book ended: ${String(bible.last_book_ending).substring(0,300)}` : 'See series bible.');
  if (flavor === 'standalone') return `Standalone volume in ${seriesName}. Shares world and pen name with ${lastBook} but story stands alone.`;
  if (flavor === 'anthology_volume') return `Next volume of the ${seriesName} anthology series. Fresh standalone stories under the shared theme.`;
  return '';
}