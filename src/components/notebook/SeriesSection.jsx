import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, RefreshCw, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import mammoth from 'mammoth';
import {
  extractSeriesBible,
  formatCharactersForStoryBible,
  buildCanonFromSeriesBible,
  formatUnresolvedThreads,
  sanitizeSeriesBible,
} from '@/lib/seriesBible';

export default function SeriesSection({ values, onFieldChange, project, busyLabel, onRefresh }) {
  const [bibles, setBibles] = useState([]);
  const [loading, setLoading] = useState(false);

  // Inline upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [seriesName, setSeriesName] = useState(values.series_name || '');
  const [prevBookNumber, setPrevBookNumber] = useState(1);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.entities.SeriesBible.list('-created_date', 50).then(setBibles).catch(() => {});
  }, []);

  // Sync series name from project values
  useEffect(() => {
    if (values.series_name && !seriesName) setSeriesName(values.series_name);
  }, [values.series_name]);

  const handleReloadBible = async () => {
    if (!values.series_bible_id) return;
    setLoading(true);
    try {
      const results = await base44.entities.SeriesBible.filter({ id: values.series_bible_id });
      const bible = results?.[0];
      if (!bible) { toast.error('Series bible not found'); return; }

      let characters = [];
      try { characters = JSON.parse(bible.characters_json || '[]'); } catch {}
      let unresolvedThreads = [];
      try { unresolvedThreads = JSON.parse(bible.unresolved_threads || '[]'); } catch {}
      let resolvedThreads = [];
      try { resolvedThreads = JSON.parse(bible.resolved_threads || '[]'); } catch {}
      let deathsAndLosses = [];
      try { deathsAndLosses = JSON.parse(bible.deaths_and_losses || '[]'); } catch {}
      let secretsRevealed = [];
      try { secretsRevealed = JSON.parse(bible.secrets_revealed || '[]'); } catch {}

      const extraction = {
        characters,
        rules_and_systems: bible.rules_and_systems,
        deaths_and_losses: deathsAndLosses,
        secrets_revealed: secretsRevealed,
        resolved_threads: resolvedThreads,
        unresolved_threads: unresolvedThreads,
        world_state: bible.world_state,
        voice_profile: bible.voice_profile,
      };

      onFieldChange('characters_md', formatCharactersForStoryBible(characters));
      onFieldChange('world_md', bible.world_state || '');
      onFieldChange('canon_md', buildCanonFromSeriesBible(extraction));
      onFieldChange('voice_md', bible.voice_profile || '');
      onFieldChange('mystery_md', formatUnresolvedThreads(unresolvedThreads));
      toast.success('Story bible fields reloaded from series bible');
    } catch (err) {
      toast.error('Failed to load series bible');
    } finally {
      setLoading(false);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.docx') || file.name.endsWith('.txt'))) {
      setUploadFile(file);
    } else {
      toast.error('Please upload a .docx or .txt file');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setUploadFile(file);
  };

  const handleAnalyze = async () => {
    if (!uploadFile || !seriesName || !project) return;
    setProgress('Reading manuscript…');
    setResult(null);

    try {
      let manuscriptText = '';
      if (uploadFile.name.endsWith('.txt')) {
        manuscriptText = await uploadFile.text();
      } else if (uploadFile.name.endsWith('.docx')) {
        const arrayBuffer = await uploadFile.arrayBuffer();
        const parsed = await mammoth.extractRawText({ arrayBuffer });
        manuscriptText = parsed.value;
      }

      if (!manuscriptText || manuscriptText.length < 1000) {
        toast.error('Could not read manuscript or file is too short.');
        setProgress(null);
        return;
      }

      const wordCount = manuscriptText.split(/\s+/).length;
      setProgress(`Analyzing manuscript (${Math.round(wordCount / 1000)}K words)…`);

      // Run extraction using shared utility
      const extraction = await extractSeriesBible(
        manuscriptText,
        uploadFile.name.replace(/\.\w+$/, ''),
        null,
        setProgress
      );

      if (!extraction) {
        setProgress('Extraction failed. Try again.');
        return;
      }

      setProgress('Saving series bible…');

      // Set series name and save (sanitize to ensure all fields are correct types)
      extraction.seriesBible.series_name = seriesName;
      const savedBible = await base44.entities.SeriesBible.create(sanitizeSeriesBible(extraction.seriesBible));

      setProgress('Linking to project…');

      // CRITICAL: Only update series fields and story bible content.
      // Do NOT touch any Setup fields (genre, pov, tense, premise, etc.)
      const seriesUpdate = {
        series_name: seriesName,
        series_number: (prevBookNumber || 1) + 1,
        series_bible_id: savedBible.id,
      };

      // Populate EMPTY story bible fields from extraction (Foundation, not Setup)
      const extractionResult = extraction.extractionResult;
      const charsMd = formatCharactersForStoryBible(extractionResult.characters);
      const canonMd = buildCanonFromSeriesBible(extractionResult);
      const mysteryMd = formatUnresolvedThreads(extractionResult.unresolved_threads);
      const worldMd = extractionResult.world_state || '';
      const voiceMd = extractionResult.voice_profile || '';

      // Only populate empty fields — don't overwrite existing content
      if (!project.characters_md || project.characters_md.length < 50) seriesUpdate.characters_md = charsMd;
      if (!project.world_md || project.world_md.length < 50) seriesUpdate.world_md = worldMd;
      if (!project.canon_md || project.canon_md.length < 50) seriesUpdate.canon_md = canonMd;
      if (!project.mystery_md || project.mystery_md.length < 50) seriesUpdate.mystery_md = mysteryMd;
      if (!project.voice_md || project.voice_md.length < 50) seriesUpdate.voice_md = voiceMd;

      await base44.entities.NovelProject.update(project.id, seriesUpdate);

      // Update local settings drafts for series fields only
      onFieldChange('series_name', seriesName);
      onFieldChange('series_number', (prevBookNumber || 1) + 1);
      onFieldChange('series_bible_id', savedBible.id);

      // Refresh bibles list
      base44.entities.SeriesBible.list('-created_date', 50).then(setBibles).catch(() => {});

      setResult({
        characterCount: extractionResult.characters?.length || 0,
        resolvedCount: extractionResult.resolved_threads?.length || 0,
        unresolvedCount: extractionResult.unresolved_threads?.length || 0,
        locationCount: extractionResult.key_locations?.length || 0,
        deathCount: extractionResult.deaths_and_losses?.length || 0,
      });

      setProgress(null);
      toast.success('Series bible created and linked to project!');

      // Refresh project data
      onRefresh?.();
    } catch (err) {
      console.error('[SERIES] Upload extraction failed:', err);
      setProgress('Error: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCloseUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setProgress(null);
    setResult(null);
  };

  return (
    <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-background/60 p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Series</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Series Name</Label>
        <Input value={values.series_name || ''} onChange={e => onFieldChange('series_name', e.target.value)} placeholder="Leave blank if standalone" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Book Number</Label>
          <Input type="number" min={1} value={values.series_number || ''} onChange={e => { const v = parseInt(e.target.value); onFieldChange('series_number', isNaN(v) ? null : v); }} className="w-24" placeholder="1" />
          <p className="text-[10px] text-muted-foreground">Used in title (e.g., "Book 2")</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Series Display Order</Label>
          <Input type="number" min={1} value={values.series_order || ''} onChange={e => { const v = parseInt(e.target.value); onFieldChange('series_order', isNaN(v) ? 0 : v); }} className="w-24" placeholder="1" />
          <p className="text-[10px] text-muted-foreground">Sort position in series folder</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Series Bible</Label>
        <Select value={values.series_bible_id || '_none'} onValueChange={v => onFieldChange('series_bible_id', v === '_none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="No series bible" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— No series bible (standalone) —</SelectItem>
            {bibles.map(sb => (
              <SelectItem key={sb.id} value={sb.id}>
                {sb.series_name} ({sb.books_analyzed} book{sb.books_analyzed > 1 ? 's' : ''})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Inline upload for creating a new series bible */}
      {!values.series_bible_id && (
        <div>
          {!showUpload ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUpload(true)}
              className="rounded-full text-[11px] h-8 gap-1.5 w-full"
            >
              <Upload className="h-3 w-3" /> Upload Previous Book to Create Series Bible
            </Button>
          ) : (
            <div className="mt-2 rounded-xl border border-border/70 bg-card/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Upload Previous Book</span>
                <button onClick={handleCloseUpload} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground leading-5">
                Upload the completed manuscript (.docx or .txt) from the previous book. The AI will extract characters, world state, plot threads, and voice — then populate your story bible. Your current settings will NOT be changed.
              </p>

              {/* Series name */}
              <div className="space-y-1">
                <Label className="text-[11px]">Series Name</Label>
                <Input
                  value={seriesName}
                  onChange={e => setSeriesName(e.target.value)}
                  placeholder="e.g., The Heretic Sacrament"
                  className="h-8 text-xs"
                />
              </div>

              {/* Book number */}
              <div className="space-y-1">
                <Label className="text-[11px]">The uploaded book is # in the series</Label>
                <Input
                  type="number"
                  value={prevBookNumber}
                  min={1}
                  onChange={e => setPrevBookNumber(parseInt(e.target.value) || 1)}
                  className="h-8 text-xs w-20"
                />
              </div>

              {/* File upload */}
              {!uploadFile ? (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={e => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border-2 border-dashed border-border/70 bg-background/50 p-5 text-center cursor-pointer hover:border-primary/40 transition-colors"
                >
                  <p className="text-xs text-muted-foreground">📄 Drop .docx or .txt here, or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.txt"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 px-3 py-2">
                  <span className="text-xs text-green-800 dark:text-green-300">📄 {uploadFile.name}</span>
                  <button onClick={() => setUploadFile(null)} className="text-destructive hover:text-destructive/80">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Analyze button */}
              {uploadFile && (
                <Button
                  onClick={handleAnalyze}
                  disabled={!!busyLabel || !seriesName || !!progress}
                  size="sm"
                  className="w-full rounded-full text-xs h-8 gap-1.5"
                >
                  {progress ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> {progress}</>
                  ) : (
                    <><BookOpen className="h-3 w-3" /> Analyze & Build Series Bible</>
                  )}
                </Button>
              )}

              {/* Progress */}
              {progress && !uploadFile && (
                <p className="text-[11px] text-muted-foreground">{progress}</p>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-1.5">
                  <div className="rounded-lg bg-green-50/60 dark:bg-green-950/20 px-3 py-1.5 text-[11px] text-green-800 dark:text-green-300">
                    ✅ {result.characterCount} characters extracted
                  </div>
                  <div className="rounded-lg bg-green-50/60 dark:bg-green-950/20 px-3 py-1.5 text-[11px] text-green-800 dark:text-green-300">
                    ✅ {result.resolvedCount} resolved, {result.unresolvedCount} open threads
                  </div>
                  <div className="rounded-lg bg-green-50/60 dark:bg-green-950/20 px-3 py-1.5 text-[11px] text-green-800 dark:text-green-300">
                    ✅ {result.locationCount} locations cataloged
                  </div>
                  {result.deathCount > 0 && (
                    <div className="rounded-lg bg-yellow-50/60 dark:bg-yellow-950/20 px-3 py-1.5 text-[11px] text-yellow-800 dark:text-yellow-300">
                      ⚠️ {result.deathCount} character death(s) recorded
                    </div>
                  )}
                  <div className="rounded-lg bg-green-50/60 dark:bg-green-950/20 px-3 py-1.5 text-[11px] text-green-800 dark:text-green-300">
                    ✅ Series bible saved and linked to project
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {values.series_bible_id && (
        <Button variant="outline" size="sm" onClick={handleReloadBible} disabled={loading} className="rounded-full text-[11px] h-8 gap-1.5 w-full">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Reload Series Bible into Story Bible
        </Button>
      )}
    </div>
  );
}