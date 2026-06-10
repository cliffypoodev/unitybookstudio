import React, { useState, useCallback } from 'react';
import { Loader2, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';

export default function SeriesPolishView({ bible, projects, onBack }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setResults(null);
    try {
      const bibles = [];
      for (let i = 0; i < projects.length; i++) {
        const vol = projects[i];
        setProgress(`Loading Book ${vol.series_number || i + 1}: ${vol.title || 'Untitled'}…`);

        let bibleText = '';

        // Try volume_bible_json first
        if (vol.volume_bible_json) {
          try {
            const vb = typeof vol.volume_bible_json === 'string' ? JSON.parse(vol.volume_bible_json) : vol.volume_bible_json;
            bibleText = JSON.stringify(vb, null, 2);
          } catch {}
        }

        // Try story bible fields
        if (!bibleText) {
          const parts = [];
          if (vol.characters_md) parts.push('CHARACTERS:\n' + vol.characters_md.substring(0, 2000));
          if (vol.world_md) parts.push('WORLD:\n' + vol.world_md.substring(0, 1500));
          if (vol.canon_md) parts.push('CANON:\n' + vol.canon_md.substring(0, 1500));
          if (vol.voice_md) parts.push('VOICE:\n' + vol.voice_md.substring(0, 500));
          if (vol.mystery_md) parts.push('THREADS:\n' + vol.mystery_md.substring(0, 1000));
          if (parts.length > 0) bibleText = parts.join('\n\n');
        }

        // Fallback: read first/last chapter excerpts
        if (!bibleText) {
          try {
            const chapters = await base44.entities.Chapter.filter({ project_id: vol.id }, 'chapter_number', 200);
            const body = chapters.filter(ch => chapterHasContent(ch) && isBodyChapter(ch)).sort((a, b) => (a.chapter_number || 0) - (b.chapter_number || 0));
            if (body.length > 0) {
              const first = await resolveChapterContent(body[0]);
              const last = body.length > 1 ? await resolveChapterContent(body[body.length - 1]) : '';
              bibleText = `OPENING:\n${(first || '').substring(0, 1500)}\n\nENDING:\n${(last || '').substring(0, 1500)}`;
            }
          } catch {}
        }

        bibles.push({
          number: vol.series_number || i + 1,
          title: vol.title || 'Untitled',
          bible: bibleText || '[No bible data available]',
        });

        await new Promise(r => setTimeout(r, 200));
      }

      if (bibles.length < 2) {
        setResults({ issues: [], summary: 'Need at least 2 volumes to check cross-book consistency.' });
        return;
      }

      setProgress('Analyzing cross-book consistency with Gemini Flash…');

      const bibleBlock = bibles.map(b =>
        `=== BOOK ${b.number}: "${b.title}" ===\n${b.bible.substring(0, 4000)}`
      ).join('\n\n');

      const response = await invokeLLMWithRetry({
        model: 'gemini_3_flash',
        fallback_model: 'deepseek/deepseek-chat-v3-0324',
        temperature: 0.15,
        max_tokens: 3000,
        prompt: `You are a series continuity editor analyzing the story bibles of a ${bibles.length}-book series called "${bible.series_name || 'Untitled Series'}".

${bibleBlock}

Find ALL cross-book inconsistencies. Check for:
1. CHARACTER CONTRADICTIONS — name spelling changes, age/appearance shifts, personality reversals, dead characters reappearing
2. WORLD INCONSISTENCIES — rules that change between books, locations described differently, technology/magic that works differently
3. TIMELINE ERRORS — events referenced at wrong times, character ages not tracking, seasons/dates contradicting
4. THREAD CONTINUITY — plot threads opened in one book and never addressed, resolved threads reopened without explanation
5. TONE/VOICE DRIFT — significant shifts in narrative voice or genre conventions between volumes

For each issue found, specify which books are involved and what the contradiction is.

Return JSON only, no markdown:
{"summary":"One paragraph overall assessment","issues":[{"severity":"critical|major|minor","category":"character|world|timeline|thread|tone","books_involved":[1,3],"description":"What is inconsistent","suggestion":"How to fix it"}]}`,
      });

      let text = typeof response === 'string' ? response : (response?.text || '');
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = { summary: text.substring(0, 500), issues: [] }; }

      setResults(parsed);
    } catch (err) {
      setResults({ summary: 'Analysis failed: ' + err.message, issues: [] });
    } finally {
      setLoading(false);
      setProgress('');
    }
  }, [bible, projects]);

  const sevColor = { critical: '#c0392b', major: '#e67e22', minor: '#2980b9' };
  const catLabel = { character: 'CHARACTER', world: 'WORLD', timeline: 'TIMELINE', thread: 'THREAD', tone: 'TONE' };

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm transition hover:border-border hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">Series Continuity Check</p>
        <h2 className="font-display text-2xl text-foreground">{bible.series_name || 'Untitled Series'}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Analyzes story bibles from {projects.length} volume{projects.length !== 1 ? 's' : ''} to find cross-book inconsistencies in characters, world-building, timeline, and plot threads.
        </p>

        {!loading && !results && (
          <Button onClick={handleAnalyze} disabled={projects.length < 2} className="mt-4 rounded-full gap-2">
            <Loader2 className="h-4 w-4" style={{ display: 'none' }} />
            Analyze Series Consistency
          </Button>
        )}

        {loading && (
          <div className="mt-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{progress}</span>
          </div>
        )}

        {results && (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-border/50 bg-secondary/30 p-4">
              <p className="text-sm text-foreground">{results.summary}</p>
            </div>

            {results.issues && results.issues.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">{results.issues.length} issue{results.issues.length !== 1 ? 's' : ''} found</p>
                {results.issues.map((issue, i) => (
                  <div key={i} className="rounded-xl border border-border/50 bg-background/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: (sevColor[issue.severity] || '#999') + '18', color: sevColor[issue.severity] || '#999' }}>
                        {(issue.severity || 'minor').toUpperCase()}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {catLabel[issue.category] || issue.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Books {(issue.books_involved || []).join(' & ')}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{issue.description}</p>
                    {issue.suggestion && (
                      <p className="mt-2 text-xs text-muted-foreground italic">{issue.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle className="h-4 w-4" /> No cross-book inconsistencies detected.
              </div>
            )}

            <Button onClick={handleAnalyze} variant="outline" size="sm" className="rounded-full text-xs">
              Run Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}