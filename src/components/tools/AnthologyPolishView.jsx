import React, { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { resolveChapterContent, chapterHasContent, prepareChapterContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { countWords } from '@/lib/autonovel';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { base44 } from '@/api/base44Client';
import {
  runCrossChapterDedup,
  analyzeStructuralArcs,
  analyzeEndings,
  analyzePronounDistribution,
  detectContamination,
  analyzeLengthDistribution,
} from '@/lib/anthologyPolish';
import {
  runCrossChapterBodyLanguageDedup,
  runAnthologyVocabBans,
  runContaminationDetector,
  runNarrativeClusterDetector,
  runLiteraryAtmosphericCap,
  runChapterOpenerFrequencyDetector,
  runAnthologyHardErrorDetector,
} from '@/lib/anthologyPolishChecks';

import AnthologyPolishReport from './AnthologyPolishReport';
import { refreshProjectWordCount } from '@/lib/projectWordCount';

export default function AnthologyPolishView({ project, chapters, busyLabel, setBusyLabel, onRefreshAll }) {
  const [report, setReport] = useState(null);
  const isBusy = !!busyLabel;
  const drafted = chapters.filter(c => chapterHasContent(c) && isBodyChapter(c));

  const handleAnthologyPolish = async () => {
    if (!project || isBusy || !drafted.length) return;

    const allChapters = [...drafted].sort((a, b) => a.chapter_number - b.chapter_number);
    setBusyLabel('Anthology Polish: Loading chapters…');

    try {
      // Load all chapter content
      const loaded = [];
      for (let i = 0; i < allChapters.length; i++) {
        const ch = allChapters[i];
        setBusyLabel(`Anthology Polish: Loading ${i + 1}/${allChapters.length}…`);
        const content = await resolveChapterContent(ch);
        if (content && content.length > 50) {
          loaded.push({ chapter: ch, content, original: content });
        }
      }

      if (!loaded.length) {
        toast.error('No content found.');
        setBusyLabel('');
        return;
      }

      // STEP 0a: Contamination detector — remove cross-project name leaks & genre-mismatched vocab
      console.log('[ANTHOLOGY-POLISH] Running runContaminationDetector on', loaded.length, 'chapters');
      const contamFixResult = await runContaminationDetector(loaded, setBusyLabel, project);
      console.log('[ANTHOLOGY-POLISH] Contamination fixes:', contamFixResult.contaminationFixed, '| Genre vocab fixes:', contamFixResult.genreVocabFixed);

      // STEP 0a2: Narrative-level cluster detector — flag wrong-genre scenes for manual review
      const narrativeResult = runNarrativeClusterDetector(loaded, setBusyLabel);
      console.warn('[ANTHOLOGY-POLISH] Narrative flags:', narrativeResult.narrativeContaminationFlags);

      // STEP 0b: Cross-chapter body language dedup — remove repeated gestures across stories
      console.log('[ANTHOLOGY-POLISH] Running runCrossChapterBodyLanguageDedup');
      const bodyLangResult = runCrossChapterBodyLanguageDedup(loaded, setBusyLabel);
      console.log('[ANTHOLOGY-POLISH] Body language dedup fixes:', bodyLangResult.bodyLangFixed);

      // STEP 0c: Anthology vocab bans — remove/replace AI-favorite words
      console.log('[ANTHOLOGY-POLISH] Running runAnthologyVocabBans');
      const anthVocabResult = runAnthologyVocabBans(loaded, setBusyLabel);
      console.log('[ANTHOLOGY-POLISH] Anthology vocab bans fixes:', anthVocabResult.anthVocabFixed);

      // STEP 0d: Literary atmospheric cap — only fires for literary anthologies.
      // Caps "quiet", "silence", "light", "whisper", etc. at 1-3 uses per chapter.
      // Skipped silently for non-literary projects (e.g. thrillers, sci-fi).
      console.log('[ANTHOLOGY-POLISH] Running runLiteraryAtmosphericCap');
      const atmosphericResult = runLiteraryAtmosphericCap(loaded, setBusyLabel, project);
      console.log('[ANTHOLOGY-POLISH] Atmospheric cap fixes:', atmosphericResult.atmosphericFixed, '(skipped:', atmosphericResult.skipped, ')');

      // ── SAVE deterministic fixes to DB FIRST (before any LLM calls that might crash) ──
      let savedCount = 0;
      let skippedCount = 0;
      const totalChangedChars = loaded.reduce((sum, f) => sum + Math.abs(f.content.length - f.original.length), 0);
      console.warn(`[ANTHOLOGY-SAVE] ========== SAVE LOOP START (before LLM steps) ==========`);
      console.warn(`[ANTHOLOGY-SAVE] ${loaded.length} chapters loaded. Total char delta: ${totalChangedChars}`);
      console.warn(`[ANTHOLOGY-SAVE] Chapters with changes: ${loaded.filter(f => f.content !== f.original).length}`);
      setBusyLabel('Anthology Polish: Saving…');
      for (let i = 0; i < loaded.length; i++) {
        const f = loaded[i];
        const chNum = f.chapter.chapter_number || '?';
        console.warn('[POLISH-SAVE]', 'Ch.' + chNum, f.chapter.title, 'changed:', f.content !== f.original, 'contentLen:', f.content.length, 'originalLen:', f.original.length);
        const changed = f.content !== f.original;

        if (!changed) {
          skippedCount++;
          continue;
        }

        const lenDiff = f.original.length - f.content.length;
        console.warn(`[ANTHOLOGY-SAVE] Ch.${chNum}: CHANGED. Diff: ${lenDiff} chars. original=${f.original.length} → content=${f.content.length}`);
        setBusyLabel(`Anthology Polish: Saving Ch.${chNum} (${savedCount + 1})…`);

        const contentFields = await prepareChapterContent(f.content, project?.id, f.chapter.id, f.chapter);
        const newWordCount = countWords(f.content);

        const updatePayload = {
          content_md: contentFields.content_md || '',
          content_md_url: contentFields.content_md_url || '',
          word_count: newWordCount,
        };

        console.warn(`[ANTHOLOGY-SAVE] Ch.${chNum}: Writing to DB. id=${f.chapter.id} | inline=${(updatePayload.content_md || '').length} | url=${updatePayload.content_md_url || 'none'} | wc=${newWordCount}`);

        await runWithNetworkRetry(() =>
          base44.entities.Chapter.update(f.chapter.id, updatePayload)
        );
        savedCount++;
      }

      console.warn(`[ANTHOLOGY-SAVE] COMPLETE: ${savedCount} saved, ${skippedCount} unchanged`);
      if (savedCount > 0) refreshProjectWordCount(project?.id); // WAVE2-WORDCOUNT

      // Refresh cache immediately after saves so Export tab picks up changes
      if (savedCount > 0 && onRefreshAll) {
        console.warn('[ANTHOLOGY-SAVE] Refreshing cache after saves…');
        await onRefreshAll();
      }

      // ── LLM-based analysis steps (wrapped individually — failures don't kill the function) ──

      // STEP 1: Cross-chapter phrase dedup via LLM (modifies text — additional save if it changes anything)
      let dedupResult = { totalRewritten: 0, changes: [], duplicates: [] };
      try {
        dedupResult = await runCrossChapterDedup(loaded, setBusyLabel);
        // If dedup changed content, save again
        let dedupSaved = 0;
        for (const f of loaded) {
          if (f.content !== f.original) {
            const cf = await prepareChapterContent(f.content, project?.id, f.chapter.id, f.chapter);
            await runWithNetworkRetry(() => base44.entities.Chapter.update(f.chapter.id, {
              content_md: cf.content_md || '', content_md_url: cf.content_md_url || '', word_count: countWords(f.content),
            }));
            dedupSaved++;
          }
        }
        if (dedupSaved > 0) {
          savedCount += dedupSaved;
          console.warn(`[ANTHOLOGY-SAVE] Dedup saved ${dedupSaved} additional chapters`);
          if (onRefreshAll) await onRefreshAll();
        }
      } catch (dedupErr) {
        console.error('[ANTHOLOGY-POLISH] Cross-chapter dedup FAILED (non-fatal):', dedupErr.message);
        dedupResult.changes.push('⚠️ Cross-chapter dedup failed: ' + dedupErr.message);
      }

      // STEP 2: Structural arcs (LLM analysis — read-only)
      let arcsResult = { arcs: [], changes: [] };
      try {
        arcsResult = await analyzeStructuralArcs(loaded, setBusyLabel);
      } catch (arcErr) {
        console.error('[ANTHOLOGY-POLISH] Structural arcs FAILED (non-fatal):', arcErr.message);
        arcsResult = { arcs: [], changes: ['⚠️ Structural arc analysis failed: ' + arcErr.message] };
      }

      // STEP 3: Ending variety (LLM analysis — read-only)
      let endingsResult = { endings: [], changes: [] };
      try {
        endingsResult = await analyzeEndings(loaded, setBusyLabel);
      } catch (endErr) {
        console.error('[ANTHOLOGY-POLISH] Ending analysis FAILED (non-fatal):', endErr.message);
        endingsResult = { endings: [], changes: ['⚠️ Ending analysis failed: ' + endErr.message] };
      }

      // STEP 4: Pronoun distribution (local — cannot fail)
      setBusyLabel('Anthology Polish: Pronoun analysis…');
      const pronounResult = analyzePronounDistribution(loaded);

      // STEP 5: Contamination detector (local — cannot fail)
      setBusyLabel('Anthology Polish: Contamination scan…');
      const contaminationResult = detectContamination(loaded, project);

      // STEP 6: Length normalization (local — cannot fail)
      setBusyLabel('Anthology Polish: Length analysis…');
      const lengthResult = analyzeLengthDistribution(loaded);

      // STEP 7: Chapter opener frequency detector — flag-only (Fix E).
      // Catches chapters with too many sentences starting with the same 2 words
      // (e.g. "It was" × 7, "Her mother" × 8). Does not modify content.
      setBusyLabel('Anthology Polish: Opener frequency scan…');
      const openerResult = runChapterOpenerFrequencyDetector(loaded, setBusyLabel);

      // STEP 8: Hard error detector — flag-only (Fixes A+B).
      // Catches truncated honorifics ("Dr. His"), lowercase-after-period
      // sentences, and subjectless fragments. Does not modify content.
      setBusyLabel('Anthology Polish: Hard error scan…');
      const hardErrorResult = runAnthologyHardErrorDetector(loaded, setBusyLabel);

      setReport({
        contamFix: contamFixResult,
        bodyLang: bodyLangResult,
        anthVocab: anthVocabResult,
        atmospheric: atmosphericResult,
        dedup: dedupResult,
        arcs: arcsResult,
        endings: endingsResult,
        pronouns: pronounResult,
        contamination: contaminationResult,
        length: lengthResult,
        openers: openerResult,
        hardErrors: hardErrorResult,
        narrative: narrativeResult,
        savedCount,
        timestamp: new Date().toISOString(),
      });

      const totalFixes =
        (contamFixResult.contaminationFixed || 0) +
        (contamFixResult.genreVocabFixed || 0) +
        (bodyLangResult.bodyLangFixed || 0) +
        (anthVocabResult.anthVocabFixed || 0) +
        (atmosphericResult.atmosphericFixed || 0) +
        (dedupResult.totalRewritten || 0);
      const totalFlags =
        (openerResult.openerFlags?.length || 0) +
        (hardErrorResult.hardErrorFlags?.length || 0) +
        (narrativeResult.narrativeContaminationFlags?.length || 0);
      const flagSuffix = totalFlags > 0 ? `, ${totalFlags} flags for review` : '';
      toast.success(`Anthology polish complete! ${savedCount} chapters saved, ${totalFixes} total fixes${flagSuffix}.`);
    } catch (err) {
      console.error('[ANTHOLOGY-POLISH] Error:', err);
      toast.error('Anthology polish failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
      if (onRefreshAll) await onRefreshAll();
    }
  };

  if (!drafted.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No drafted chapters. Draft chapters first.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Action button */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm text-center">
        <Badge className="mb-2">📚 Anthology Cross-Chapter Analysis</Badge>
        <div className="mt-3">
          <Button onClick={handleAnthologyPolish} disabled={isBusy} size="lg" className="rounded-full px-8 gap-2">
            {isBusy && busyLabel?.includes('Anthology') ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace(/Anthology Polish:\s*/, '')}</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Run Anthology Polish</>
            )}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground max-w-md mx-auto">
          Cross-chapter phrase dedup, structural arc analysis, ending variety, pronoun distribution, contamination scan, and length normalization.
        </p>
      </div>

      {/* Report */}
      {report && <AnthologyPolishReport report={report} />}
    </div>
  );
}