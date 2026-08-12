import React, { useState, useEffect } from 'react';
import { BookOpen, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { extractSeriesBible, formatCharactersForStoryBible, buildCanonFromSeriesBible, formatUnresolvedThreads, sanitizeSeriesBible } from '@/lib/seriesBible';

export default function SeriesBibleView({ parsed, project, busyLabel, setBusyLabel, onBack }) {
  const navigate = useNavigate();
  const [seriesName, setSeriesName] = useState(project?.series_name || '');
  const [bookNumber, setBookNumber] = useState(1);
  const [existingBibleId, setExistingBibleId] = useState('');
  const [savedBibles, setSavedBibles] = useState([]);
  const [extractionResult, setExtractionResult] = useState(null);
  const [savedBibleId, setSavedBibleId] = useState(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    base44.entities.SeriesBible.list('-created_date', 50).then(setSavedBibles).catch(() => {});
  }, []);

  const handleAnalyze = async () => {
    if (!parsed?.chapters?.length) return;
    const fullText = parsed.chapters.map(ch => ch.content).join('\n\n');
    const existingSB = existingBibleId ? savedBibles.find(sb => sb.id === existingBibleId) : null;

    try {
      const result = await extractSeriesBible(fullText, parsed.fileName || 'Untitled', existingSB, setBusyLabel);
      let saved;
      if (existingSB) {
        await base44.entities.SeriesBible.update(existingSB.id, sanitizeSeriesBible({ ...result.seriesBible, series_name: existingSB.series_name }));
        saved = { ...existingSB, ...result.seriesBible };
      } else {
        result.seriesBible.series_name = seriesName || 'Untitled Series';
        saved = await base44.entities.SeriesBible.create(sanitizeSeriesBible(result.seriesBible));
      }
      setExtractionResult(result.extractionResult);
      setSavedBibleId(saved.id);
      setAnalysisComplete(true);
      toast.success('Series bible extracted successfully!');
    } catch (err) {
      toast.error(err.message || 'Extraction failed');
    } finally {
      setBusyLabel('');
    }
  };

  const handleCreateNextBook = async () => {
    if (!extractionResult || !savedBibleId) return;
    setBusyLabel('Creating next book…');
    try {
      const newProject = await base44.entities.NovelProject.create({
        title: (seriesName || 'Series') + ' — Book ' + (bookNumber + 1),
        seed_concept: 'Continuation of ' + (seriesName || 'the series') + '. See series bible for full context.',
        series_name: seriesName,
        series_number: bookNumber + 1,
        series_bible_id: savedBibleId,
        genre: project?.genre || '',
        project_type: project?.project_type || 'fiction',
        book_type: project?.book_type || 'fiction',
        pov_mode: project?.pov_mode || 'third-close', // WAVE2-POVNORMALIZE: canonical slugs
        tense: project?.tense || 'past',
        author_name: project?.author_name || '',
        beat_style: project?.beat_style || 'Tension-Driven',
        scene_beat_style: project?.beat_style || 'Tension-Driven',
        chapter_target: 20,
        chapter_length_preset: 'standard',
        chapter_length_target: 3500,
        target_chapter_words: 3500,
        total_word_target: 70000,
        characters_md: formatCharactersForStoryBible(extractionResult.characters),
        world_md: extractionResult.world_state || '',
        canon_md: buildCanonFromSeriesBible(extractionResult),
        voice_md: extractionResult.voice_profile || '',
        mystery_md: formatUnresolvedThreads(extractionResult.unresolved_threads),
        phase: 'foundation',
        status: 'idle',
      });
      navigate(`/projects/${newProject.id}`);
    } catch (err) {
      toast.error('Failed to create project: ' + err.message);
    } finally {
      setBusyLabel('');
    }
  };

  const characters = extractionResult?.characters || [];
  const resolved = extractionResult?.resolved_threads || [];
  const unresolved = extractionResult?.unresolved_threads || [];
  const locations = extractionResult?.key_locations || [];
  const deaths = extractionResult?.deaths_and_losses || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-chart-1" /> Series Bible
        </h3>
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full text-xs">← Back</Button>
      </div>

      {!analysisComplete ? (
        <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Series Name</Label>
            <Input value={seriesName} onChange={e => setSeriesName(e.target.value)} placeholder="e.g., The Heretic Sacrament" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">This manuscript is Book #</Label>
            <Input type="number" min={1} value={bookNumber} onChange={e => setBookNumber(parseInt(e.target.value) || 1)} className="w-24" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link to existing series bible (optional)</Label>
            <Select value={existingBibleId || '_none'} onValueChange={v => setExistingBibleId(v === '_none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="New series" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— New series (no previous bible) —</SelectItem>
                {savedBibles.map(sb => (
                  <SelectItem key={sb.id} value={sb.id}>
                    {sb.series_name} ({sb.books_analyzed} book{sb.books_analyzed > 1 ? 's' : ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAnalyze} disabled={!!busyLabel} className="w-full rounded-full gap-2">
            {busyLabel ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}</> : <><BookOpen className="h-4 w-4" /> Analyze Manuscript & Build Series Bible</>}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-5 space-y-3">
            <h4 className="font-display text-base text-foreground">Series Bible Extracted</h4>
            <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> {characters.length} characters extracted
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> {resolved.length} resolved, {unresolved.length} unresolved threads
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200/50 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> {locations.length} locations cataloged
            </div>
            {deaths.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> {deaths.length} death(s)/loss(es) — cannot undo in Book {bookNumber + 1}
              </div>
            )}
          </div>

          <Button onClick={handleCreateNextBook} disabled={!!busyLabel} className="w-full rounded-full gap-2 bg-green-600 hover:bg-green-700 text-white">
            {busyLabel ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel}</> : <><ArrowRight className="h-4 w-4" /> Create Book {bookNumber + 1}: Start Next Volume</>}
          </Button>
        </div>
      )}
    </div>
  );
}