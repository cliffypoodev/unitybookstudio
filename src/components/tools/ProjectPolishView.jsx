/* ============================================================================
 * ⚠️  DEAD CODE — DO NOT EDIT EXPECTING UI CHANGES  (WAVE5-DEADSTAMP, Aug 2026)
 *
 * Nothing imports this file. Editing it has NO effect on the running app —
 * past AI sessions repeatedly wasted hours "fixing" components like this one.
 * Live implementation: the live fiction polish is lib/manuscriptPolishRunner via ProjectStudio.
 * Kept (not deleted) at the owner's request; recoverable context only.
 * ========================================================================== */
import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, RefreshCw, Download, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { recastBannedVocabulary } from '@/lib/aiSlopReduction';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { calculateManuscriptStats, calculateManuscriptStatsNonfiction, detectHighFreqPhrases, isNonfictionProject, isComedyProject } from '@/lib/manuscriptStats';
import { countWords } from '@/lib/autonovel';
import { prepareChapterContent, prepareBackupContent } from '@/lib/chapterStorage';
import { refreshProjectWordCount } from '@/lib/projectWordCount';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { runNonfictionPolish } from '@/lib/nonfictionPolish';
import { runExternalAiPatternFix } from '@/lib/externalAiPatterns';
import { fixHangingQuotes } from '@/lib/quoteFixPolish';
import { runAiDetectionResistance } from '@/lib/aiDetectionResist';
import { runVocabCaps, runSentenceStarterVariation } from '@/lib/vocabCaps';
import { fixVoicePatterns } from '@/lib/voicePatternPolish';
import { runDialogueTagCaps } from '@/lib/dialogueTagPolish';
import { runPunctuationCleanup, runSpellingFixes, runBrokenSentenceFixes, runCopingMechanismCaps, runDialoguePunctuationFix, runDialogueFillerFix, runEmDashReducer, runProgressiveReducer } from '@/lib/punctuationPolish';
import { runAntiDetectionPolish } from '@/lib/antiDetectionPolish';
import { runAutoProofreadChain, formatAutoProofreadSummary } from '@/lib/autoProofreadChain';
import { isAnthologyProject } from '@/lib/anthologyEngine';
import { runCrossChapterBodyLanguageDedup, runAnthologyVocabBans, runContaminationDetector, runNarrativeClusterDetector } from '@/lib/anthologyPolishChecks';
import { runCapitalizationHygiene } from '@/lib/capitalizationPolish';
import { runTransitionWordCaps, runChatGPTVocabCaps, runNotJustButReducer, runYetMisuseFixer, runThinkOfItAsCapper, runAiPhraseCapper } from '@/lib/chatgptPatternPolish';
import { runStackedClauseVariation } from '@/lib/sentencePatternPolish';
import { detectCrossBookContamination, contaminationFindingsToQueueItems, detectNameVariants, nameVariantFindingsToQueueItems } from '@/lib/contaminationDetector';
import { detectDuplicateScenes, duplicateSceneFindingsToQueueItems } from '@/lib/duplicateSceneDetector';
import { runModelQuirkScan, quirkFindingsToQueueItems } from '@/lib/modelQuirkChecks';
import { runTransitionCleanup } from '@/lib/transitionCleanup';
import { pickModel } from '@/lib/modelRouting';
import { runFinalProofread } from '@/lib/finalProofread';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';

function StatCard({ value, label }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-center">
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export default function ProjectPolishView({ project, chapters, busyLabel, setBusyLabel, onRunProofread, proofreadBusy }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [polishResults, setPolishResults] = useState(null);
  const [critique, setCritique] = useState(null);
  const [critiqueRating, setCritiqueRating] = useState(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);

  // Final Proofread state
  const [finalCheckRunning, setFinalCheckRunning] = useState(false);
  const [finalCheckProgress, setFinalCheckProgress] = useState('');
  const [finalCheckResults, setFinalCheckResults] = useState(null); // { findings, spine, stats }

  // Missing-noun review queue — persists across Polish runs in-session.
  // Each item: { id, chapterNumber, pattern, context, suggestion, dismissed }
  // dismissed items stay in the queue but are greyed out so you know you've
  // handled them. Fresh Polish runs re-populate by merging new findings.
  const [reviewQueue, setReviewQueue] = useState([]);
  const [rewritingId, setRewritingId] = useState(null); // ID of item currently being rewritten
  const [rewritePreview, setRewritePreview] = useState(null); // { id, original, rewritten, chapterNumber, chapterId }

  // ── REWRITE HANDLER ──────────────────────────────────────────
  // Sends the flagged text + surrounding context to the LLM for a
  // surgical rewrite, then shows a preview for author approval.
  const handleRewriteItem = async (item) => {
    setRewritingId(item.id);
    setRewritePreview(null);

    try {
      // Find the chapter
      const ch = chapters.find(c => c.chapter_number === item.chapterNumber) ||
                 chapters[item.chapterNumber - 1];
      if (!ch) { toast.error('Chapter ' + item.chapterNumber + ' not found'); setRewritingId(null); return; }

      // CRITICAL: fetch fresh from DB — the chapters prop may be stale from React Query cache
      let freshCh;
      try {
        const results = await base44.entities.Chapter.filter({ id: ch.id });
        freshCh = results?.[0] || ch;
      } catch (e) { freshCh = ch; }

      const content = await resolveChapterContent(freshCh);
      if (!content) { toast.error('Could not load chapter content'); setRewritingId(null); return; }

      // Extract wider context (200 chars around the flagged pattern)
      // Multiple fallback strategies to find the text in the chapter
      const normalizeQuotes = (s) => s.replace(/[\u201c\u201d\u2018\u2019]/g, (c) => c === '\u201c' || c === '\u201d' ? '"' : "'").replace(/\u2014/g, '--').replace(/\u2013/g, '-');

      let patIdx = content.indexOf(item.pattern);

      // Fallback 1: try with normalized quotes
      if (patIdx < 0) {
        const normContent = normalizeQuotes(content);
        const normPat = normalizeQuotes(item.pattern);
        const normIdx = normContent.indexOf(normPat);
        if (normIdx >= 0) patIdx = normIdx;
      }

      // Fallback 2: context field
      if (patIdx < 0 && item.context) {
        const cleanCtx = (item.context || '').replace(/^…|…$/g, '').trim();
        if (cleanCtx.length > 10) {
          patIdx = content.indexOf(cleanCtx);
          if (patIdx < 0) {
            const normIdx = normalizeQuotes(content).indexOf(normalizeQuotes(cleanCtx));
            if (normIdx >= 0) patIdx = normIdx;
          }
        }
      }

      // Fallback 3: first 40 chars
      if (patIdx < 0) {
        const shortPat = item.pattern.substring(0, 40);
        if (shortPat.length > 5) {
          patIdx = content.indexOf(shortPat);
          if (patIdx < 0) patIdx = normalizeQuotes(content).indexOf(normalizeQuotes(shortPat));
        }
      }

      // Fallback 4: extract 4+ distinctive words and search for them as a sequence
      if (patIdx < 0) {
        const words = item.pattern.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 6);
        if (words.length >= 3) {
          const wordPattern = words.join('\\s+(?:\\S+\\s+){0,3}');
          try {
            const rx = new RegExp(wordPattern, 'i');
            const m = rx.exec(content);
            if (m) patIdx = m.index;
          } catch (e) { /* regex failed, skip */ }
        }
      }

      if (patIdx < 0) {
        // Pattern was likely already fixed by a batch rewrite — auto-dismiss
        toast.success('Ch.' + item.chapterNumber + ': text already modified by a previous rewrite — marking done');
        setReviewQueue(prev => prev.map(i => i.id === item.id ? { ...i, dismissed: true } : i));
        setRewritingId(null);
        return;
      }
      const ctxStart = Math.max(0, patIdx - 200);
      const ctxEnd = Math.min(content.length, patIdx + Math.max(item.pattern.length, 80) + 200);
      const wideContext = content.substring(ctxStart, ctxEnd);

      // Build the rewrite prompt
      const isDroppedSV = item.detectorType === 'droppedSubjectVerb';
      const isYetMisuse = item.detectorType === 'yetMisuse';
      const isMissingNoun = !item.detectorType && !item.contaminationType;
      const isProgressive = item.detectorType === 'progressiveTense';

      let fixInstruction = '';
      if (isMissingNoun) {
        fixInstruction = 'The phrase has an orphaned adjective — "a [adjective], like..." is missing its noun. Insert the correct noun after the adjective. For example "a cold, like a bolt" should be "a cold knot, like a bolt."';
      } else if (isDroppedSV) {
        fixInstruction = 'The sentence appears to have a dropped subject-verb at the start (e.g., "He felt" or "She was" was cut). Restore the missing subject and verb so the sentence is grammatically complete.';
      } else if (isYetMisuse) {
        fixInstruction = '"yet" is being used incorrectly as a list connector or conjunction where it should be "and," a period, or an em-dash. Fix the conjunction while preserving the meaning.';
      } else if (isProgressive) {
        fixInstruction = 'Convert "was/were [verb]ing" progressive past tense to simple past tense. "She was running" becomes "She ran." Only keep progressive if the action is literally being interrupted.';
      } else {
        fixInstruction = 'Fix the flagged issue while preserving the original voice, tone, and meaning. Make the minimum change necessary.';
      }

      const prompt = `You are a prose editor. Fix ONLY the flagged problem in the text below. Do NOT rewrite anything else. Preserve the author's voice exactly.

PROBLEM: ${item.suggestion || fixInstruction}

FIX INSTRUCTION: ${fixInstruction}

SURROUNDING CONTEXT:
"""
${wideContext}
"""

FLAGGED TEXT TO FIX:
"""
${item.pattern}
"""

Return ONLY the fixed version of the FLAGGED TEXT. No explanation, no quotes around it, no "here's the fix" — just the corrected text, ready to drop in as a replacement.`;

      const result = await invokeLLMWithRetry({
        prompt,
        model: pickModel('critique'),
        fallback_model: 'deepseek/deepseek-v3.2-20251201',
        temperature: 0.3,
        max_tokens: 500,
      });

      let rewritten = typeof result === 'string' ? result : (result?.text || result?.content || String(result || ''));
      rewritten = rewritten.replace(/^["'`]+|["'`]+$/g, '').trim();
      // Strip markdown fences
      rewritten = rewritten.replace(/^```\w*\s*/g, '').replace(/\s*```$/g, '').trim();

      if (!rewritten || rewritten.length < 3) {
        toast.error('LLM returned empty rewrite');
        setRewritingId(null);
        return;
      }

      setRewritePreview({
        id: item.id,
        original: item.pattern,
        rewritten,
        chapterNumber: item.chapterNumber,
        chapterId: ch.id,
        fullContent: content,
      });
      setRewritingId(null);

    } catch (err) {
      console.error('[REWRITE] Error:', err);
      toast.error('Rewrite failed: ' + (err.message || 'unknown error'));
      setRewritingId(null);
    }
  };

  // ── ACCEPT REWRITE ──────────────────────────────────────────
  const handleAcceptRewrite = async () => {
    if (!rewritePreview) return;
    const { id, original, rewritten, chapterId, fullContent } = rewritePreview;

    try {
      setBusyLabel('Saving rewrite…');
      const newContent = fullContent.replace(original, rewritten);
      if (newContent === fullContent) {
        toast.error('Original text not found — chapter may have changed');
        setRewritePreview(null);
        setBusyLabel('');
        return;
      }

      const existingCh = chapters.find((c) => c.id === chapterId) || null;
      const contentFields = await prepareChapterContent(newContent, project?.id, chapterId, existingCh);
      await runWithNetworkRetry(() => base44.entities.Chapter.update(chapterId, {
        ...contentFields,
        word_count: countWords(newContent),
      }));

      toast.success('Rewrite applied to Ch.' + rewritePreview.chapterNumber);
      // Mark the review item as dismissed
      setReviewQueue(prev => prev.map(i => i.id === id ? { ...i, dismissed: true } : i));
      setRewritePreview(null);
      setBusyLabel('');
    } catch (err) {
      console.error('[REWRITE-SAVE] Error:', err);
      toast.error('Save failed: ' + (err.message || 'unknown error'));
      setBusyLabel('');
    }
  };

  // Null-guard: chapters can be undefined on the first render before the
  // parent's React Query resolves. Calling .filter() on undefined crashes
  // the entire app to a blank page. Normalize to [] so the first render
  // is a no-op until real data arrives.
  const safeChapters = Array.isArray(chapters) ? chapters : [];
  const drafted = safeChapters.filter(c => chapterHasContent(c) && isBodyChapter(c));
  const isBusy = !!busyLabel;
  const isNF = isNonfictionProject(project);

  const loadStats = async () => {
    if (!drafted.length) return;
    setLoadingStats(true);
    let allText = '';
    let totalWords = 0;
    for (const ch of drafted) {
      const content = await resolveChapterContent(ch);
      allText += content + '\n\n';
      totalWords += countWords(content);
    }
    const s = isNF ? calculateManuscriptStatsNonfiction(allText) : calculateManuscriptStats(allText);
    s.wordCount = totalWords;
    s.chapterCount = drafted.length;
    s.avgWordsPerChapter = Math.round(totalWords / drafted.length);
    s.highFreqPhrases = detectHighFreqPhrases(allText, drafted.length);
    setStats(s);
    setLoadingStats(false);
  };

  useEffect(() => { loadStats(); }, [safeChapters.length]);

  // ── FULL POLISH PIPELINE (mirrors ProjectStudio.handleManuscriptPolish) ──
  const handlePolish = async () => {
    if (!project || isBusy) return;
    const allChapters = [...safeChapters].filter(ch => chapterHasContent(ch) && isBodyChapter(ch)).sort((a, b) => a.chapter_number - b.chapter_number);
    if (!allChapters.length) { toast.error('No drafted chapters to polish.'); return; }

    const isComedy = isComedyProject(project);
    console.log('>>> POLISH TOOLS TAB FUNCTION FIRED AT: ' + new Date().toISOString());
    console.log('[POLISH-TOOLS] ========== STARTING FULL POLISH ==========');
    setBusyLabel('Polish: Loading chapters…');

    try {
    // STEP 1: Load — fetch FRESH from DB (chapters prop may be stale React Query cache)
    const loaded = [];
    for (let i = 0; i < allChapters.length; i++) {
      const ch = allChapters[i];
      const chNum = ch.chapter_number || (i + 1);
      setBusyLabel(`Polish: Loading chapter ${chNum} of ${allChapters.length}…`);
      // Fetch fresh from DB to avoid stale React Query cache
      let freshCh = ch;
      try {
        const results = await base44.entities.Chapter.filter({ id: ch.id });
        if (results?.[0]) freshCh = results[0];
      } catch (e) { /* fall back to cached */ }
      const content = await resolveChapterContent(freshCh);
      if (content && content.length > 50) {
        loaded.push({ chapter: freshCh, content, original: content });
        console.log('[POLISH-TOOLS] Loaded Ch.' + chNum + ': ' + content.length + ' chars (fresh from DB)');
      }
    }
    if (!loaded.length) { toast.error('No content found.'); setBusyLabel(''); return; }
    const totalChars = loaded.reduce((s, f) => s + f.content.length, 0);
    console.log('[POLISH-TOOLS] Loaded', loaded.length, 'chapters,', totalChars, 'chars');
    console.warn('[POLISH] All chapters loaded:', loaded.length);
    console.warn('[POLISH] isNF:', isNF, '| isComedy:', isComedy);
    console.warn('[POLISH] Starting polish steps...');

    const comedyOpts = isComedy ? { isComedy: true } : undefined;

    // ── STEP 0: Strip damaged transition openers from previous polish runs ──
    // This MUST run before ANY other polish step. Previous versions of the
    // polish tool injected fiction openers ("For a moment,", "Without thinking,")
    // and nonfiction openers ("In practice,", "Notice that", "Consider:")
    // into sentence-start positions. On long manuscripts each opener appeared
    // 20-50x, creating AI-detection fingerprints. This step strips them all
    // so the downstream polish operates on clean text.
    console.warn('[POLISH] STEP 0: Transition damage cleanup...');
    const cleanupResult = runTransitionCleanup(loaded, setBusyLabel);
    if (cleanupResult.totalStripped > 0) {
      console.warn('[POLISH] STEP 0: Stripped', cleanupResult.totalStripped, 'damaged openers');
    }

    console.warn('[POLISH] Computing before stats...');
    const beforeStats = isNF
      ? calculateManuscriptStatsNonfiction(loaded.map(f => f.content).join('\n\n'))
      : calculateManuscriptStats(loaded.map(f => f.content).join('\n\n'), comedyOpts);
    console.warn('[POLISH] Before stats computed. cleanScore:', beforeStats.cleanScore);

    if (isNF) {
      // Nonfiction delegates to its own full pipeline
      setBusyLabel('Polish (NF): Running nonfiction polish…');
      const result = await runNonfictionPolish({ loaded, onProgress: setBusyLabel, project });
      // Merge Step 0 cleanup changes into results
      const allNfChanges = [...cleanupResult.changes, ...result.changes];
      setPolishResults({ before: beforeStats, after: result.afterStats, changes: allNfChanges, timestamp: new Date().toISOString() });

      // ── Auto-Proofread chain (mirrors fiction branch below). Runs AI
      //    Proofread on fresh post-polish content, auto-accepts critical/minor
      //    findings, and fires the subject-restoration phase. ──
      const proofResult = await runAutoProofreadChain(project, safeChapters, setBusyLabel);
      const proofSummary = formatAutoProofreadSummary(proofResult);

      const polishLine = `Nonfiction Polish Complete! ${result.savedCount} chapters updated.`;
      const combined = polishLine + proofSummary;
      console.log('[POLISH-TOOLS] NF COMPLETE:', combined);
      if (proofResult?.error || proofResult?.chaptersFailed > 0) {
        toast.warning(combined, { duration: 25000 });
      } else {
        toast.success(combined, { duration: 25000 });
      }
    } else {
      // ── FICTION FULL PIPELINE ──
      const changes = [...cleanupResult.changes];
      const chapterCount = loaded.length;

      // STEP 2: Banned words
      console.warn('[POLISH] STEP 2: Banned words...');
      setBusyLabel('Polish: Removing banned words…');
      // POLISHFIX-1: banned words are RECAST to synonyms, never deleted.
      // Deleting left dropped-word artifacts ("a testament to" -> "a  to").
      let bannedRemoved = 0;
      for (const f of loaded) {
        const recast = recastBannedVocabulary(f.content);
        if (recast.recasts.length > 0) {
          f.content = recast.text;
          bannedRemoved += recast.recasts.length;
          changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': recast ' + recast.recasts.length + ' banned word(s)');
        }
      }

      // STEP 2b: Anthology-specific checks (body language dedup, vocab bans, contamination)
      let anthologyStats = { bodyLangFixed: 0, anthVocabFixed: 0, contaminationFixed: 0, genreVocabFixed: 0 };
      console.warn('[ANTHOLOGY-POLISH] GATE CHECK (Tools): isAnthologyProject=' + isAnthologyProject(project) + ' | project.project_type="' + (project.project_type || '') + '"');
      if (isAnthologyProject(project)) {
        console.warn('[ANTHOLOGY-POLISH] ENTERING anthology code path (Tools). Chapters:', loaded.length);
        console.warn('[POLISH] STEP 2b: Anthology checks...');
        const bodyResult = runCrossChapterBodyLanguageDedup(loaded, setBusyLabel);
        changes.push(...bodyResult.changes);
        anthologyStats.bodyLangFixed = bodyResult.bodyLangFixed || 0;

        const anthVocabResult = runAnthologyVocabBans(loaded, setBusyLabel);
        changes.push(...anthVocabResult.changes);
        anthologyStats.anthVocabFixed = anthVocabResult.anthVocabFixed || 0;

        const contamResult = await runContaminationDetector(loaded, setBusyLabel, project);
        changes.push(...contamResult.changes);
        anthologyStats.contaminationFixed = contamResult.contaminationFixed || 0;
        anthologyStats.genreVocabFixed = contamResult.genreVocabFixed || 0;

        const narrativeResult = runNarrativeClusterDetector(loaded, setBusyLabel);
        console.warn('[ANTHOLOGY-POLISH] Narrative flags:', narrativeResult.narrativeContaminationFlags);
      }

      // STEP 3: Punctuation cleanup + spelling fixes
      console.warn('[POLISH] STEP 3: Punctuation + spelling...');
      const punctResult = runPunctuationCleanup(loaded, setBusyLabel);
      changes.push(...punctResult.changes);
      const spellingResult = runSpellingFixes(loaded, setBusyLabel);
      changes.push(...spellingResult.changes);

      // STEP 3b: Cap fix (simple post-period fix — kept for backward compat)
      setBusyLabel('Polish: Fixing capitalization…');
      let capFixed = 0;
      for (const f of loaded) {
        const before = f.content;
        f.content = f.content.replace(/([.!?])\s+([a-z])/g, (match, punct, letter, offset) => {
          if (offset >= 2 && f.content[offset - 1] === '.' && f.content[offset - 2] === '.') return match;
          if (offset >= 2 && /[A-Z][a-z]/.test(f.content.substring(offset - 2, offset))) return match;
          return punct + ' ' + letter.toUpperCase();
        });
        if (f.content !== before) {
          const fixed = (before.match(/[.!?]\s+[a-z]/g) || []).length - (f.content.match(/[.!?]\s+[a-z]/g) || []).length;
          if (fixed > 0) { capFixed += fixed; changes.push('Ch.' + (f.chapter.chapter_number || '?') + ': fixed ' + fixed + ' cap errors'); }
        }
      }

      // STEP 3c: Capitalization hygiene (mid-sentence caps, title fragments,
      // standalone lowercase "i" pronouns). Also flags missing-noun sites.
      const capHygieneResult = runCapitalizationHygiene(loaded, setBusyLabel);
      changes.push(...capHygieneResult.changes);
      const capHygieneFixed = capHygieneResult.capFixed;
      const missingNounWarnings = capHygieneResult.warnings || [];
      if (missingNounWarnings.length > 0) {
        console.warn('[POLISH] ⚠️ Missing-noun sites flagged:', missingNounWarnings.length);
        missingNounWarnings.forEach(w => console.warn('  Ch.' + w.chapterNumber + ': ' + w.pattern + ' — ' + w.suggestion));
      }

      // Cross-book contamination scan (detect-only, no modifications)
      setBusyLabel('Polish: Scanning for cross-book contamination…');
      const contamFindings = detectCrossBookContamination(loaded, project);
      const contamQueueItems = contaminationFindingsToQueueItems(contamFindings);
      if (contamFindings.length > 0) {
        console.warn('[POLISH] 🚨 Potential cross-book contamination:', contamFindings.length, 'names');
        contamFindings.forEach(f => console.warn('  ' + f.name + ': ' + f.totalCount + 'x in chapters ' + f.chaptersAppearing.join(',') + ' — ' + f.reason));
        changes.push('⚠️ ' + contamFindings.length + ' contamination candidate(s) flagged for review');
      }

      // Name variant scan (detect-only — flags Kael/Kaelen type inconsistencies)
      setBusyLabel('Polish: Scanning for name variants…');
      const variantFindings = detectNameVariants(loaded);
      const variantQueueItems = nameVariantFindingsToQueueItems(variantFindings);
      if (variantFindings.length > 0) {
        console.warn('[POLISH] ⚠️ Name variants detected:', variantFindings.length);
        variantFindings.forEach(f => console.warn('  ' + f.nameA + ' / ' + f.nameB + ': ' + f.suggestion));
        changes.push('⚠️ ' + variantFindings.length + ' name variant(s) flagged for review');
      }

      // Duplicate scene scan (detect-only — flags repeated passages and scene echoes)
      setBusyLabel('Polish: Scanning for duplicate scenes…');
      const dupeFindings = detectDuplicateScenes(loaded);
      const dupeQueueItems = duplicateSceneFindingsToQueueItems(dupeFindings);
      if (dupeFindings.length > 0) {
        console.warn('[POLISH] ⚠️ Duplicate scenes detected:', dupeFindings.length);
        dupeFindings.forEach(f => console.warn('  ' + f.type + ': Ch.' + f.chapterA + ' ↔ Ch.' + f.chapterB + ' — ' + f.description));
        changes.push('⚠️ ' + dupeFindings.length + ' duplicate scene(s) flagged for review');
      }

      // Merge new findings into review queue (missing-nouns + contamination).
      // Auto-prune items whose text no longer contains the flagged pattern.
      setReviewQueue(prev => {
        // Collect all current-chapter text for pattern-existence check
        const currentTextByChapter = new Map();
        for (const f of loaded) {
          currentTextByChapter.set(String(f.chapter?.chapter_number || '?'), f.content);
        }
        // Full manuscript (for contamination items which live across chapters)
        const fullManuscript = loaded.map(f => f.content).join('\n\n');

        const patternStillExists = (item) => {
          // Contamination items: check if the name still appears in the WHOLE
          // manuscript at all. If the author deleted every instance, remove.
          if (item.contaminationType) {
            return fullManuscript.includes(item.pattern);
          }
          // Missing-noun items: check the specific chapter
          const text = currentTextByChapter.get(String(item.chapterNumber));
          if (!text) return true; // chapter not in this polish run — preserve
          return text.includes(item.pattern);
        };

        // Keep only items whose pattern still exists
        const stillRelevant = prev.filter(patternStillExists);

        const byKey = new Map(stillRelevant.map(item => [item.id, item]));

        // Add new missing-noun warnings
        for (const w of missingNounWarnings) {
          const key = w.chapterNumber + '|' + w.pattern;
          if (!byKey.has(key)) {
            byKey.set(key, {
              id: key,
              chapterNumber: w.chapterNumber,
              pattern: w.pattern,
              context: w.context,
              suggestion: w.suggestion,
              contaminationType: false,
              dismissed: false,
              addedAt: Date.now(),
            });
          }
        }

        // Add new contamination findings
        for (const c of contamQueueItems) {
          if (!byKey.has(c.id)) {
            byKey.set(c.id, c);
          }
        }

        // Add new name variant findings
        for (const v of variantQueueItems) {
          if (!byKey.has(v.id)) {
            byKey.set(v.id, v);
          }
        }

        // Add new duplicate scene findings
        for (const d of dupeQueueItems) {
          if (!byKey.has(d.id)) {
            byKey.set(d.id, d);
          }
        }

        return Array.from(byKey.values()).sort((a, b) => {
          // Active items first, then contamination items (more critical) first,
          // then by chapter number.
          if (a.dismissed !== b.dismissed) return a.dismissed ? 1 : -1;
          if (a.contaminationType !== b.contaminationType) return a.contaminationType ? -1 : 1;
          const chA = parseInt(a.chapterNumber) || 999;
          const chB = parseInt(b.chapterNumber) || 999;
          return chA - chB;
        });
      });

      // STEP 3d: Transition-word caps ("Still,", "Instead,", "At last,", "In truth,", "By then,")
      const transitionResult = runTransitionWordCaps(loaded, setBusyLabel);
      changes.push(...transitionResult.changes);
      const transitionFixed = transitionResult.transitionWordsFixed;

      // STEP 3d-bis: "Not just X, but Y" reducer (global cap 3, per-chapter cap 1)
      const njbResult = runNotJustButReducer(loaded, setBusyLabel);
      changes.push(...njbResult.changes);

      // STEP 3d-ter: "Yet" misuse fixer (", yet noun" → ". Noun")
      const yetResult = runYetMisuseFixer(loaded, setBusyLabel);
      changes.push(...yetResult.changes);

      // STEP 3d-qua: "Think of it as" capper (global cap 2)
      const toiaResult = runThinkOfItAsCapper(loaded, setBusyLabel);
      changes.push(...toiaResult.changes);

      // STEP 3d-qui: AI phrase capper (weight of, air was, wave of, etc.)
      const aiPhraseResult = runAiPhraseCapper(loaded, setBusyLabel);
      changes.push(...aiPhraseResult.changes);

      // STEP 3e: Dialogue punctuation placement (move . ! ? inside closing quotes)
      const dialogPunctResult = runDialoguePunctuationFix(loaded, setBusyLabel);
      changes.push(...dialogPunctResult.changes);
      const dialogPunctFixed = dialogPunctResult.dialogPunctFixed;

      // STEP 3f: Dialogue filler fix (strip junk "yet"/"then"/"and"/"but" before quotes)
      const dialogFillerResult = runDialogueFillerFix(loaded, setBusyLabel);
      changes.push(...dialogFillerResult.changes);
      const dialogFillerFixed = dialogFillerResult.dialogFillerFixed;

      // STEP 3g: Stacked -ing clause variation (caps "[Subject], [verb]ing [phrase], [verb]" rhythm)
      const stackingResult = runStackedClauseVariation(loaded, setBusyLabel);
      changes.push(...stackingResult.changes);
      const stackingFixed = stackingResult.stackingFixed;

      // STEP 4: Voice patterns
      console.warn('[POLISH] STEP 4: Voice patterns...');
      setBusyLabel('Polish: Fixing voice patterns…');
      const voiceResult = fixVoicePatterns(loaded, chapterCount);
      changes.push(...voiceResult.changes);

      // STEP 4b: External AI patterns
      console.warn('[POLISH] STEP 4b: External AI patterns...');
      setBusyLabel('Polish: Scanning for external AI patterns…');
      const extResult = runExternalAiPatternFix(loaded);
      changes.push(...extResult.changes);

      // STEP 5: Repetition caps
      console.warn('[POLISH] STEP 5: Repetition caps...');
      setBusyLabel('Polish: Fixing repetition…');
      const targets = [
        { pattern: /\bshuddered\b/gi, name: 'shuddered', maxTotal: Math.max(6, chapterCount * 0.3), replacements: ['trembled','flinched','stiffened','shook','went rigid'] },
        { pattern: /\bthe silence\b/gi, name: 'the silence', maxTotal: Math.max(8, chapterCount * 0.4), replacements: ['the quiet','the stillness','the hush','the dead air'] },
        { pattern: /\bthe darkness\b/gi, name: 'the darkness', maxTotal: Math.max(8, chapterCount * 0.4), replacements: ['the gloom','the shadow','the black','the dark'] },
        { pattern: /\bwhispered\b/gi, name: 'whispered', maxTotal: Math.max(12, chapterCount * 0.5), replacements: ['murmured','breathed','said softly'] },
        { pattern: /\bexhaled\b/gi, name: 'exhaled', maxTotal: Math.max(6, chapterCount * 0.3), replacements: ['breathed out','let out a breath','released a breath'] },
        { pattern: /\bclenched\b/gi, name: 'clenched', maxTotal: Math.max(10, chapterCount * 0.5), replacements: ['tightened','curled','balled','gripped'] },
        { pattern: /\bsuddenly\b/gi, name: 'suddenly', maxTotal: Math.max(6, chapterCount * 0.3), replacements: [] },
        { pattern: /\bsomehow\b/gi, name: 'somehow', maxTotal: Math.max(isComedy ? 12 : 4, chapterCount * (isComedy ? 0.6 : 0.2)), replacements: [] },
        // ── Action verb fixation (survived 2 polish passes on Dustbowl Pitstop) ──
        { pattern: /\bstared\b/gi, name: 'stared', maxTotal: Math.max(15, chapterCount * 0.7), replacements: ['looked','watched','eyed','fixed on','studied','glanced'] },
        { pattern: /\bstood\b/gi, name: 'stood', maxTotal: Math.max(18, chapterCount * 0.9), replacements: ['waited','remained','lingered','stayed','held still','paused'] },
        { pattern: /\bleaned\b/gi, name: 'leaned', maxTotal: Math.max(12, chapterCount * 0.6), replacements: ['rested','braced','tilted','shifted','settled','propped'] },
        { pattern: /\bstopped\b/gi, name: 'stopped', maxTotal: Math.max(15, chapterCount * 0.7), replacements: ['halted','froze','paused','went still','caught himself','pulled up short'] },
        // ── Hedge adverbs ──
        { pattern: /\bslowly\b/gi, name: 'slowly', maxTotal: Math.max(8, chapterCount * 0.4), replacements: [] },
        { pattern: /\bslightly\b/gi, name: 'slightly', maxTotal: Math.max(8, chapterCount * 0.4), replacements: [] },
        // ── Ambient crutch ──
        { pattern: /\bsomewhere\b/gi, name: 'somewhere', maxTotal: Math.max(10, chapterCount * 0.5), replacements: [] },
        // ── Filter words (delete excess — these weaken prose) ──
        { pattern: /\bjust\b/gi, name: 'just', maxTotal: Math.max(30, chapterCount * 1.5), replacements: [] },
        { pattern: /\bvery\b/gi, name: 'very', maxTotal: Math.max(12, chapterCount * 0.6), replacements: [] },
      ];
      let repFixed = 0;
      for (const t of targets) {
        // Re-scan current text (not stale snapshot) for accurate counts
        const freshText = loaded.map(f => f.content).join('\n\n');
        const total = (freshText.match(t.pattern) || []).length;
        const cap = Math.round(t.maxTotal);
        if (total <= cap) continue;
        const excess = total - cap;
        let replaced = 0;
        let globalInstanceIdx = 0;
        let repIdx = 0;

        console.log('[POLISH] Repetition "' + t.name + '": ' + total + ' (cap: ' + cap + ', removing ' + excess + ')');

        // Sort chapters by count descending so we trim from heaviest first
        const chCounts = loaded.map((f, idx) => ({ idx, count: (f.content.match(t.pattern) || []).length })).sort((a, b) => b.count - a.count);
        for (const cc of chCounts) {
          if (replaced >= excess) break;
          if (cc.count <= 0) continue;
          const f = loaded[cc.idx];
          f.content = f.content.replace(t.pattern, (match) => {
            globalInstanceIdx++;
            if (globalInstanceIdx <= cap || replaced >= excess) return match;
            replaced++; repFixed++;
            if (t.replacements.length === 0) return '';
            const rep = t.replacements[repIdx++ % t.replacements.length];
            return rep === '' ? '' : (match[0] === match[0].toUpperCase() ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep);
          });
          if (replaced > 0) {
            f.content = f.content.replace(/  +/g, ' ');
          }
        }
        if (replaced > 0) {
          changes.push('Repetition "' + t.name + '": ' + total + ' → ' + cap + ' (' + replaced + ' replaced)');
        }
      }

      // STEP 5b: Dialogue tag + action beat caps + breath-stem cap
      console.warn('[POLISH] STEP 5b: Dialogue tags...');
      setBusyLabel('Polish: Capping dialogue tags…');
      console.log('[POLISH-TOOLS] Starting dialogue tag + breath stem cap...');
      const dialogueResult = runDialogueTagCaps(loaded, setBusyLabel);
      changes.push(...dialogueResult.changes);
      console.log('[POLISH-TOOLS] Dialogue tags capped:', dialogueResult.dialogueTagsFixed, '| Breath:', dialogueResult.breathFixed);

      // STEP 5c: Coping mechanism / recurring action caps
      console.log('[POLISH-TOOLS] Starting coping mechanism caps...');
      const copingResult = runCopingMechanismCaps(loaded, setBusyLabel);
      changes.push(...copingResult.changes);
      console.log('[POLISH-TOOLS] Coping mechanisms capped:', copingResult.copingFixed);

      // STEP 5d: Broken sentence artifact fixes
      const brokenResult = runBrokenSentenceFixes(loaded, setBusyLabel);
      changes.push(...brokenResult.changes);

      // STEP 6: Phrase detection
      console.warn('[POLISH] STEP 6: Phrase detection...');
      setBusyLabel('Polish: Detecting phrases…');
      const updatedText = loaded.map(f => f.content).join('\n\n');
      const phraseCounts = {};
      const wordList = updatedText.toLowerCase().split(/\s+/);
      for (let i = 0; i < wordList.length - 1; i++) {
        const w1 = wordList[i].replace(/[^a-z]/g, '');
        const w2 = wordList[i + 1].replace(/[^a-z]/g, '');
        if (w1.length < 3 || w2.length < 3) continue;
        const p = w1 + ' ' + w2;
        const skip = ['of the','in the','to the','on the','at the','and the','for the','was the','from the','with the','into the','that the','but the','had been','would be','could be','did not','was not','had not','she had','he had','she was','he was','her eyes','his eyes','she said','he said','they had','it was','there was','back to','out of','up to','one of','down the','through the','over the','around the','about the','under the','after the','before the','between the','across the','along the','toward the','against the','looked at','turned to','moved to','went to','came to','not the','all the','like the','than the','just the','even the','only the'];
        if (skip.includes(p)) continue;
        phraseCounts[p] = (phraseCounts[p] || 0) + 1;
      }
      const phraseThreshold = Math.max(chapterCount * 6, 80);
      const highFreq = Object.entries(phraseCounts).filter(([, c]) => c > phraseThreshold).sort((a, b) => b[1] - a[1]).slice(0, 15);
      for (const [phrase, count] of highFreq) changes.push('⚠️ "' + phrase + '" appears ' + count + 'x');

      // STEP 7: AI vocabulary caps
      console.warn('[POLISH] STEP 7: AI vocabulary caps...');
      setBusyLabel('Polish: Capping AI vocabulary…');
      const vocabResult = runVocabCaps(loaded, setBusyLabel, { project });
      changes.push(...vocabResult.changes);
      console.log('[POLISH-TOOLS] Vocab capped:', vocabResult.vocabCapped);

      // STEP 7b: ChatGPT vocabulary contamination caps
      // Catches "delve", "tapestry", "resplendent" etc. — the AI-signature
      // vocabulary that goes beyond the banned-words list.
      const chatgptResult = runChatGPTVocabCaps(loaded, setBusyLabel);
      changes.push(...chatgptResult.changes);

      // STEP 8: Sentence starter variation
      console.warn('[POLISH] STEP 8: Sentence starters...');
      const starterResult = runSentenceStarterVariation(loaded, setBusyLabel);
      changes.push(...starterResult.changes);

      // STEP 8b: Anti-detection polish (triplets, parallels, staccato, metaphors, coping, telling tags)
      console.warn('[POLISH] STEP 8b: Anti-detection polish...');
      setBusyLabel('Polish: Running anti-detection polish…');
      const antiDetResult = runAntiDetectionPolish(loaded, setBusyLabel, { project });
      changes.push(...antiDetResult.changes);
      console.log('[POLISH-TOOLS] Anti-detection: triplets=' + antiDetResult.tripletsFixed +
        ', parallels=' + antiDetResult.parallelsFixed +
        ', staccato=' + antiDetResult.staccatoFixed +
        ', coping=' + antiDetResult.copingFixed +
        ', tellingTags=' + antiDetResult.tellingTagsFixed +
        ', emDashFixed=' + antiDetResult.emDashFixed +
        ', emDashFlagged=' + antiDetResult.emDashFlagged +
        ', antithesis=' + antiDetResult.antithesisFlagged +
        ', echoes=' + antiDetResult.echoesFlagged +
        ', articles=' + antiDetResult.articlesFixed +
        ', tagLoops=' + antiDetResult.tagLoopsFlagged);

      // STEP 9: AI detection resistance (burstiness, predictability, paragraphs)
      console.warn('[POLISH] STEP 9: AI detection resistance...');
      const aiResist = runAiDetectionResistance(loaded, setBusyLabel);
      changes.push(...aiResist.changes);

      // STEP 9b: Em-dash density reducer
      console.warn('[POLISH] STEP 9b: Em-dash reducer...');
      const emDashReduce = runEmDashReducer(loaded, setBusyLabel);
      changes.push(...emDashReduce.changes);

      // STEP 9c: Progressive tense converter (was/were [verb]ing → simple past)
      console.warn('[POLISH] STEP 9c: Progressive tense...');
      const progReduce = runProgressiveReducer(loaded, setBusyLabel);
      changes.push(...progReduce.changes);

      // STEP 10: Quote fix (LAST text step)
      console.warn('[POLISH] STEP 10: Quote fix...');
      setBusyLabel('Polish: Fixing hanging quotations…');
      const quoteResult = fixHangingQuotes(loaded);
      changes.push(...quoteResult.changes);

      // STEP 10b: Garbled quote cleanup (DeepSeek timeout artifacts)
      // Strips runs of 2+ consecutive smart closing quotes or straight quotes
      let garbledFixed = 0;
      for (const f of loaded) {
        const before10b = f.content;
        f.content = f.content.replace(/[\u201d]{2,}/g, '\u201d');
        f.content = f.content.replace(/[\u201c]{2,}/g, '\u201c');
        f.content = f.content.replace(/"{2,}/g, '"');
        if (f.content !== before10b) {
          garbledFixed++;
          const chNum = f.chapter?.chapter_number || '?';
          console.warn('[POLISH] STEP 10b: Fixed garbled quotes in Ch.' + chNum);
        }
      }
      if (garbledFixed > 0) {
        changes.push('Garbled quote strings cleaned in ' + garbledFixed + ' chapters');
        console.warn('[POLISH] STEP 10b: Garbled quotes fixed in ' + garbledFixed + ' chapters');
      }

      // STEP 11: Save
      console.warn('[POLISH] STEP 11: Saving...');
      setBusyLabel('Polish: Saving…');
      let savedCount = 0;
      let unchangedCount = 0;
      for (let i = 0; i < loaded.length; i++) {
        const f = loaded[i];
        const chNum = f.chapter.chapter_number || (i + 1);
        if (f.content === f.original) { unchangedCount++; console.log('[POLISH-TOOLS] Ch.' + chNum + ': UNCHANGED (lengths: ' + f.original.length + ' → ' + f.content.length + ')'); continue; }
        console.log('[POLISH-TOOLS] Ch.' + chNum + ': CHANGED (lengths: ' + f.original.length + ' → ' + f.content.length + ')');
        setBusyLabel(`Polish: Saving chapter ${chNum}…`);
        const contentFields = await prepareChapterContent(f.content, project?.id, f.chapter.id, f.chapter);
        // Only backup if chapter doesn't already have a backup (preserve original pre-polish backup)
        const backupFields = f.chapter.backup_content || f.chapter.backup_content_url
          ? {}
          : await prepareBackupContent(f.original, project?.id, f.chapter.id, f.chapter);
        await runWithNetworkRetry(() => base44.entities.Chapter.update(f.chapter.id, {
          ...contentFields,
          ...backupFields,
          word_count: countWords(f.content),
        }));
        savedCount++;
        console.log('[POLISH-TOOLS] Saved Ch.' + chNum);
      }

      if (savedCount > 0) refreshProjectWordCount(project?.id); // WAVE2-WORDCOUNT

      window.alert('POLISH SAVE REPORT: ' + savedCount + ' chapters saved, ' + unchangedCount + ' unchanged out of ' + loaded.length + ' total');

      const afterStats = calculateManuscriptStats(loaded.map(f => f.content).join('\n\n'), comedyOpts);
      setPolishResults({ before: beforeStats, after: afterStats, changes, timestamp: new Date().toISOString() });

      const anthLine = anthologyStats.bodyLangFixed || anthologyStats.anthVocabFixed || anthologyStats.contaminationFixed || anthologyStats.genreVocabFixed
        ? `\nAnthology: BodyLang: ${anthologyStats.bodyLangFixed} | Vocab: ${anthologyStats.anthVocabFixed} | Contam: ${anthologyStats.contaminationFixed} | Genre: ${anthologyStats.genreVocabFixed}`
        : '';

      // Surface missing-noun sites in the report for author review (flag only)
      const warningBlock = missingNounWarnings.length > 0
        ? '\n\n⚠️ MISSING-NOUN SITES (review manually — not auto-fixed):\n' +
          missingNounWarnings.map(w => `  Ch.${w.chapterNumber}: "${w.pattern}"`).join('\n') +
          '\n  Full context in browser console.'
        : '';

      const polishReport = `Polish complete!\n${savedCount} chapters saved, ${unchangedCount} unchanged\n` +
        `Banned: ${bannedRemoved} | Cap: ${capFixed}+${capHygieneFixed} | Voice: ${voiceResult.voiceFixed}\n` +
        `Dialogue tags: ${dialogueResult.dialogueTagsFixed} | Breath: ${dialogueResult.breathFixed}\n` +
        `Repetition: ${repFixed} | Vocab: ${vocabResult.vocabCapped} | ChatGPTVocab: ${chatgptResult.chatgptVocabFixed || 0}\n` +
        `Transitions: ${transitionFixed} | DialogPunct: ${dialogPunctFixed} | DialogFiller: ${dialogFillerFixed} | Stack: ${stackingFixed}\n` +
        `Coping: ${copingResult.copingFixed} | Spelling: ${spellingResult.spellingFixed} | Artifacts: ${brokenResult.artifactsFixed}\n` +
        `Quotes: ${quoteResult.quotesFixed}` + anthLine + warningBlock;
      console.log('[POLISH-TOOLS] POLISH PHASE COMPLETE:', polishReport);

      // ── Auto-Proofread chain — runs AI Proofread on post-polish content,
      //    auto-accepts critical/minor findings, saves them. Single click.
      //    Falls through silently if it fails; polish result is already saved. ──
      const proofResult = await runAutoProofreadChain(project, safeChapters, setBusyLabel);
      const proofSummary = formatAutoProofreadSummary(proofResult);

      const combined = polishReport + proofSummary;
      console.log('[POLISH-TOOLS] COMPLETE:', combined);
      if (proofResult?.error || proofResult?.chaptersFailed > 0) {
        toast.warning(combined, { duration: 25000 });
      } else {
        toast.info(combined, { duration: 25000 });
      }
    }

    } catch (polishError) {
      window.alert('POLISH CRASHED: ' + (polishError.message || String(polishError)) + '\n\nStack: ' + (polishError.stack || '').substring(0, 300));
      console.error('[POLISH-TOOLS] FATAL ERROR:', polishError);
    } finally {
      setBusyLabel('');
      loadStats();
    }

    // ── AUTO-CHAIN: Quirk Scan after Polish ──
    // User choice: rather than needing to click both buttons, Polish
    // automatically fires Quirk Scan on completion. This populates the
    // Review Queue with LLM-quirk findings (dropped subject-verb, "yet"
    // misuse, etc.) so authors get a single unified "here's everything
    // that needs human judgment" list every polish run.
    //
    // We do NOT abort on Quirk Scan failure — Polish already succeeded,
    // and the scan is a flag-only diagnostic. Errors are logged silently.
    try {
      await handleQuirkScan();
    } catch (quirkErr) {
      console.warn('[POLISH-CHAIN] Quirk Scan chain failed (non-fatal):', quirkErr?.message || quirkErr);
    }
  };

  // ── FINAL PROOFREAD CHECK ──────────────────────────────────
  // "Fresh eyes" pass — sends polished chapters to a DIFFERENT model
  // that reads the manuscript cold and flags anything a human editor would catch.
  const handleFinalCheck = async () => {
    if (!project || isBusy || finalCheckRunning || drafted.length < 1) return;
    setFinalCheckRunning(true);
    setFinalCheckResults(null);
    setFinalCheckProgress('Loading chapters…');

    try {
      const loaded = [];
      for (const ch of drafted) {
        // Fetch fresh from DB
        let freshCh = ch;
        try {
          const results = await base44.entities.Chapter.filter({ id: ch.id });
          if (results?.[0]) freshCh = results[0];
        } catch (e) { /* fall back to cached */ }
        const content = await resolveChapterContent(freshCh);
        loaded.push({
          content: content || '',
          chapterTitle: freshCh.title || ch.title || `Chapter ${ch.chapter_number || '?'}`,
          chapter: freshCh,
        });
      }

      const results = await runFinalProofread(loaded, project, setFinalCheckProgress);
      setFinalCheckResults(results);

      // Merge per-chapter findings that have original_text into the Review Queue
      // so the ✨ Rewrite button works on them
      if (results.findings?.length > 0) {
        const newItems = results.findings
          .filter(f => f.original_text && f.source === 'final_check')
          .map((f, idx) => ({
            id: 'fc-' + Date.now() + '-' + idx,
            chapterNumber: f.chapter,
            pattern: f.original_text,
            context: f.original_text.substring(0, 80),
            suggestion: f.description + (f.suggested_fix ? ' → ' + f.suggested_fix : ''),
            dismissed: false,
            detectorType: 'finalCheck',
            subType: f.category,
            severity: f.severity,
          }));
        if (newItems.length > 0) {
          setReviewQueue(prev => {
            const existingIds = new Set(prev.map(i => i.pattern));
            const fresh = newItems.filter(i => !existingIds.has(i.pattern));
            return [...prev, ...fresh];
          });
        }
      }
    } catch (err) {
      console.error('[FINAL-CHECK] Error:', err);
      toast.error('Final check failed: ' + (err.message || 'unknown'));
    } finally {
      setFinalCheckRunning(false);
      setFinalCheckProgress('');
    }
  };

  // ── BATCH REWRITE ALL ──────────────────────────────────────
  // Rewrites all pending items in a group sequentially, auto-accepts each.
  const [batchRewriting, setBatchRewriting] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [renameState, setRenameState] = useState(null); // { itemId, oldName, newName, running }
  const [dupeFixState, setDupeFixState] = useState(null); // { itemId, keepChapter, removeChapter, running }

  // ── DUPLICATE SCENE FIX ──────────────────────────────────────
  // Picks the chapter to keep, rewrites the duplicate in the other chapter
  // with a replacement scene that advances the plot differently.
  const handleDuplicateSceneFix = async (item, keepChNum, removeChNum) => {
    setDupeFixState(prev => ({ ...prev, running: true }));
    setBusyLabel('Fixing duplicate: rewriting Ch.' + removeChNum + '…');

    try {
      // Fetch both chapters fresh
      const keepCh = chapters.find(c => c.chapter_number === keepChNum);
      const removeCh = chapters.find(c => c.chapter_number === removeChNum);
      if (!keepCh || !removeCh) { toast.error('Chapter not found'); setDupeFixState(null); setBusyLabel(''); return; }

      let keepFresh, removeFresh;
      try {
        const r1 = await base44.entities.Chapter.filter({ id: keepCh.id });
        keepFresh = r1?.[0] || keepCh;
      } catch (e) { keepFresh = keepCh; }
      try {
        const r2 = await base44.entities.Chapter.filter({ id: removeCh.id });
        removeFresh = r2?.[0] || removeCh;
      } catch (e) { removeFresh = removeCh; }

      const keepContent = await resolveChapterContent(keepFresh);
      const removeContent = await resolveChapterContent(removeFresh);
      if (!removeContent) { toast.error('Could not load Ch.' + removeChNum); setDupeFixState(null); setBusyLabel(''); return; }

      // Find the duplicate passage in the remove chapter
      const dupeText = item.pattern.substring(0, 60);

      // Get context around the duplicate — 500 chars before and after
      const dupeIdx = removeContent.toLowerCase().indexOf(dupeText.toLowerCase());
      const beforeCtx = dupeIdx > 0 ? removeContent.substring(Math.max(0, dupeIdx - 500), dupeIdx) : removeContent.substring(0, 500);
      const afterCtx = dupeIdx >= 0 ? removeContent.substring(dupeIdx + dupeText.length, dupeIdx + dupeText.length + 500) : removeContent.substring(removeContent.length - 500);

      // Ask LLM to rewrite the duplicate passage into something that advances the plot differently
      setBusyLabel('Generating replacement scene for Ch.' + removeChNum + '…');
      const rewritePrompt = `You are rewriting a passage in Chapter ${removeChNum} of a novel because it duplicates a scene from Chapter ${keepChNum}.

The ORIGINAL passage in Ch.${removeChNum} that needs replacement:
"${item.pattern}"

What comes BEFORE this passage in Ch.${removeChNum}:
"${beforeCtx.substring(beforeCtx.length - 300)}"

What comes AFTER this passage in Ch.${removeChNum}:
"${afterCtx.substring(0, 300)}"

The scene that STAYS in Ch.${keepChNum} (DO NOT duplicate this):
"${keepContent.substring(0, 400)}"

TASK: Write a replacement passage that:
1. Fits seamlessly between the before and after text
2. Advances the plot in a DIFFERENT direction than the Ch.${keepChNum} version
3. Maintains the same characters, tone, and voice
4. Is approximately the same length as the original passage
5. Does NOT repeat the same events, dialogue, or descriptions from Ch.${keepChNum}

Return ONLY the replacement prose. No preamble, no commentary.`;

      const result = await invokeLLMWithRetry({
        prompt: rewritePrompt,
        model: project.model_override || 'openrouter:anthropic/claude-sonnet-4',
        temperature: 0.7,
        max_tokens: 2000,
      });

      const replacement = typeof result === 'string' ? result : (result?.text || '');
      if (!replacement || replacement.length < 50) { toast.error('LLM returned empty replacement'); setDupeFixState(null); setBusyLabel(''); return; }

      // Replace the duplicate passage in the chapter content
      let newContent = removeContent;
      if (dupeIdx >= 0 && item.pattern.length > 20) {
        // Find the full passage (not just the truncated pattern)
        const patEnd = dupeIdx + item.pattern.length;
        newContent = removeContent.substring(0, dupeIdx) + replacement.trim() + removeContent.substring(patEnd);
      } else {
        // Fallback: try a looser match
        const words = item.pattern.split(/\s+/).slice(0, 8).join('\\s+');
        try {
          const rx = new RegExp(words, 'i');
          newContent = removeContent.replace(rx, replacement.trim());
        } catch (e) {
          toast.error('Could not locate duplicate passage in chapter');
          setDupeFixState(null); setBusyLabel(''); return;
        }
      }

      // Save
      setBusyLabel('Saving Ch.' + removeChNum + '…');
      const contentFields = await prepareChapterContent(newContent, project?.id, removeFresh.id, removeFresh);
      await runWithNetworkRetry(() => base44.entities.Chapter.update(removeFresh.id, {
        ...contentFields,
        word_count: countWords(newContent),
      }));

      toast.success('Duplicate scene in Ch.' + removeChNum + ' replaced with new scene');
      setReviewQueue(prev => prev.map(i => i.id === item.id ? { ...i, dismissed: true } : i));
      setDupeFixState(null);
    } catch (err) {
      toast.error('Fix failed: ' + (err.message || 'unknown'));
    } finally {
      setBusyLabel('');
      setDupeFixState(null);
    }
  };

  // ── RENAME HANDLER (for name variant items) ──────────────────
  // Does find/replace across ALL chapters for a character name.
  const handleRename = async (oldName, newName, itemId) => {
    if (!newName || newName.trim() === oldName) { toast.error('Enter a different name'); return; }
    const trimmed = newName.trim();
    setRenameState(prev => ({ ...prev, running: true }));
    setBusyLabel('Renaming "' + oldName + '" → "' + trimmed + '"…');

    let totalReplaced = 0;
    try {
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        // Fetch fresh
        let freshCh = ch;
        try {
          const results = await base44.entities.Chapter.filter({ id: ch.id });
          if (results?.[0]) freshCh = results[0];
        } catch (e) { /* fall back */ }

        const content = await resolveChapterContent(freshCh);
        if (!content) continue;

        // Count occurrences
        const rx = new RegExp('\\b' + oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
        const matches = content.match(rx);
        if (!matches || matches.length === 0) continue;

        const newContent = content.replace(rx, trimmed);
        totalReplaced += matches.length;

        setBusyLabel(`Renaming: Ch.${ch.chapter_number || (i+1)} (${matches.length} instances)…`);
        const contentFields = await prepareChapterContent(newContent, project?.id, freshCh.id, freshCh);
        await runWithNetworkRetry(() => base44.entities.Chapter.update(freshCh.id, {
          ...contentFields,
          word_count: countWords(newContent),
        }));
      }

      toast.success(`Renamed "${oldName}" → "${trimmed}" — ${totalReplaced} instances across all chapters`);
      setReviewQueue(prev => prev.map(i => i.id === itemId ? { ...i, dismissed: true } : i));
      setRenameState(null);
    } catch (err) {
      toast.error('Rename failed: ' + (err.message || 'unknown'));
    } finally {
      setBusyLabel('');
    }
  };

  const handleBatchRewriteGroup = async (groupKey) => {
    const pendingItems = reviewQueue.filter(i => {
      if (i.dismissed || i.contaminationType) return false;
      // Determine group key for this item
      let k = 'missingNoun';
      if (i.contaminationType) k = 'contamination';
      else if (i.detectorType === 'droppedSubjectVerb') k = 'droppedSubjectVerb';
      else if (i.detectorType === 'finalCheck') k = 'finalCheck';
      else if (i.detectorType === 'yetMisuse') k = 'yetMisuse:' + (i.subType || 'other');
      return k === groupKey;
    });

    if (pendingItems.length === 0) { toast.error('No pending items to rewrite'); return; }
    setBatchRewriting(true);
    setBatchProgress(`0/${pendingItems.length}`);

    let successCount = 0;
    let failCount = 0;
    // Group items by chapter for efficient loading
    const byChapter = {};
    for (const item of pendingItems) {
      if (!byChapter[item.chapterNumber]) byChapter[item.chapterNumber] = [];
      byChapter[item.chapterNumber].push(item);
    }

    for (const [chNumStr, items] of Object.entries(byChapter)) {
      const chNum = parseInt(chNumStr);
      const ch = chapters.find(c => c.chapter_number === chNum) || chapters[chNum - 1];
      if (!ch) { failCount += items.length; continue; }

      // CRITICAL: fetch fresh from DB — chapters prop may be stale
      let freshCh;
      try {
        const results = await base44.entities.Chapter.filter({ id: ch.id });
        freshCh = results?.[0] || ch;
      } catch (e) { freshCh = ch; }

      let content = await resolveChapterContent(freshCh);
      if (!content) { failCount += items.length; continue; }

      let contentChanged = false;

      for (const item of items) {
        setBatchProgress(`${successCount + failCount}/${pendingItems.length} — Ch.${chNum}`);

        // Find the pattern in the content
        let patIdx = content.indexOf(item.pattern);
        if (patIdx < 0 && item.context) {
          const cleanCtx = (item.context || '').replace(/^…|…$/g, '').trim();
          if (cleanCtx.length > 10) patIdx = content.indexOf(cleanCtx);
        }
        if (patIdx < 0) {
          const shortPat = item.pattern.substring(0, 40);
          if (shortPat.length > 5) patIdx = content.indexOf(shortPat);
        }
        if (patIdx < 0) { failCount++; continue; }

        const ctxStart = Math.max(0, patIdx - 200);
        const ctxEnd = Math.min(content.length, patIdx + Math.max(item.pattern.length, 80) + 200);
        const wideContext = content.substring(ctxStart, ctxEnd);

        // Build fix instruction based on type
        let fixInstruction = 'Fix the flagged issue while preserving the original voice, tone, and meaning. Make the minimum change necessary.';
        if (item.detectorType === 'finalCheck') {
          fixInstruction = item.suggestion || fixInstruction;
        } else if (item.detectorType === 'yetMisuse') {
          fixInstruction = '"yet" is being used incorrectly. Fix the conjunction while preserving the meaning.';
        } else if (item.detectorType === 'droppedSubjectVerb') {
          fixInstruction = 'Restore the missing subject and verb so the sentence is grammatically complete.';
        } else if (!item.detectorType && !item.contaminationType) {
          fixInstruction = 'Insert the correct noun after the adjective.';
        }

        try {
          const result = await invokeLLMWithRetry({
            prompt: `You are a prose editor. Fix ONLY the flagged problem. Preserve the author's voice exactly.\n\nPROBLEM: ${fixInstruction}\n\nSURROUNDING CONTEXT:\n"""\n${wideContext}\n"""\n\nFLAGGED TEXT TO FIX:\n"""\n${item.pattern}\n"""\n\nReturn ONLY the fixed text. No explanation, no quotes around it — just the corrected text.`,
            model: pickModel('critique'),
            fallback_model: 'deepseek/deepseek-v3.2-20251201',
            temperature: 0.3,
            max_tokens: 500,
          });

          let rewritten = typeof result === 'string' ? result : (result?.text || result?.content || String(result || ''));
          rewritten = rewritten.replace(/^["'`]+|["'`]+$/g, '').replace(/^```\w*\s*/g, '').replace(/\s*```$/g, '').trim();

          if (!rewritten || rewritten.length < 3) { failCount++; continue; }

          // Apply the rewrite directly to the content
          const newContent = content.replace(item.pattern, rewritten);
          if (newContent !== content) {
            content = newContent;
            contentChanged = true;
            successCount++;
            // Mark as dismissed
            setReviewQueue(prev => prev.map(i => i.id === item.id ? { ...i, dismissed: true } : i));
          } else {
            failCount++;
          }
        } catch (err) {
          console.warn('[BATCH-REWRITE] Item failed:', err.message);
          failCount++;
        }
      }

      // Save the chapter if any rewrites were applied
      if (contentChanged) {
        try {
          const contentFields = await prepareChapterContent(content, project?.id, ch.id, ch);
          await runWithNetworkRetry(() => base44.entities.Chapter.update(ch.id, {
            ...contentFields,
            word_count: countWords(content),
          }));
        } catch (err) {
          console.error('[BATCH-REWRITE] Save failed for Ch.' + chNum + ':', err.message);
        }
      }
    }

    setBatchRewriting(false);
    setBatchProgress('');
    toast.success(`Batch rewrite: ${successCount} fixed, ${failCount} skipped`);
  };

  const handleCritique = async () => {
    if (!project || isBusy || critiqueLoading || drafted.length < 3) return;
    setCritiqueLoading(true);
    const first = await resolveChapterContent(drafted[0]);
    const mid = await resolveChapterContent(drafted[Math.floor(drafted.length / 2)]);
    const last = await resolveChapterContent(drafted[drafted.length - 1]);
    const sample = [
      'CHAPTER 1:\n' + first.substring(0, 2000),
      '\nCHAPTER ' + (Math.floor(drafted.length / 2) + 1) + ':\n' + mid.substring(0, 2000),
      '\nCHAPTER ' + drafted.length + ':\n' + last.substring(0, 2000),
    ].join('\n');
    const prompt = `You are a senior book editor. Write a 400-word editorial assessment of this ${project.genre || 'fiction'} manuscript "${project.title || 'Untitled'}" (~${(stats?.wordCount || drafted.length * 4000).toLocaleString()} words, ${drafted.length} chapters). Cover: prose quality, marketability, strengths, weaknesses, verdict. On the last line: RATING: [number]/5 (half-star increments).\n\n${sample}`;
    try {
      const response = await invokeLLMWithRetry({ prompt, model: 'gemini_3_flash', fallback_model: 'deepseek/deepseek-v3.2-20251201' });
      let text = typeof response === 'string' ? response : (response?.text || response?.content || String(response || ''));
      let rating = null;
      const match = text.match(/RATING:\s*([\d.]+)\s*\/\s*5/i);
      if (match) { rating = Math.round(Math.min(5, Math.max(0, parseFloat(match[1]))) * 2) / 2; text = text.replace(/RATING:\s*[\d.]+\s*\/\s*5/i, '').trim(); }
      setCritique(text);
      setCritiqueRating(rating);
      if (project?.id && rating !== null) {
        runWithNetworkRetry(() => base44.entities.NovelProject.update(project.id, { critique_rating: rating })).catch(() => {});
      }
    } finally { setCritiqueLoading(false); }
  };

  // ── Model Quirk Scan ──
  // On-demand scan for LLM-specific bugs that don't appear in every
  // manuscript. Flag-only — merges findings into the Review Queue.
  // Targets: dropped "He felt"/"She felt"/"It was" subject-verb fragments,
  // Lumimaid "yet" conjunction misuse, and dialogue-punct audit.
  //
  // Kept separate from the main Polish button because:
  //  (a) the dropped-subject bug is model-specific (mostly Lumimaid erotica),
  //  (b) the "yet" threshold needs manuscript-level rate context,
  //  (c) running this on every polish would waste cycles on DeepSeek/Trinity
  //      output that doesn't have these quirks.
  const [quirkSummary, setQuirkSummary] = useState(null);
  const handleQuirkScan = async () => {
    if (!project || isBusy) return;
    setBusyLabel('Quirk Scan: Loading chapters…');

    try {
      // Load chapter content FRESH from DB, same pattern the polish handler uses
      const loaded = [];
      for (let i = 0; i < drafted.length; i++) {
        const ch = drafted[i];
        setBusyLabel('Quirk Scan: Loading chapter ' + (ch.chapter_number || (i + 1)) + '…');
        const content = await resolveChapterContent(ch);
        if (content && content.length > 50) {
          loaded.push({ chapter: ch, content });
        }
      }
      if (!loaded.length) {
        toast.error('No chapter content loaded for scan.');
        return;
      }

      // Run the detectors
      const { findings, summary } = runModelQuirkScan(loaded, setBusyLabel);
      const queueItems = quirkFindingsToQueueItems(findings);

      // Merge into Review Queue. Use the same auto-prune logic as the main
      // polish handler — drop items whose pattern no longer appears in the
      // chapter (which can happen if the user already hand-edited the spot).
      setReviewQueue(prev => {
        const currentTextByChapter = new Map();
        for (const f of loaded) {
          currentTextByChapter.set(String(f.chapter?.chapter_number || '?'), f.content);
        }
        const fullManuscript = loaded.map(f => f.content).join('\n\n');
        const patternStillExists = (item) => {
          if (item.contaminationType) return fullManuscript.includes(item.pattern);
          const text = currentTextByChapter.get(String(item.chapterNumber));
          if (!text) return true;
          return text.includes(item.pattern);
        };
        const stillRelevant = prev.filter(patternStillExists);
        const byKey = new Map(stillRelevant.map(item => [item.id, item]));
        for (const q of queueItems) {
          if (!byKey.has(q.id)) byKey.set(q.id, q);
        }
        return Array.from(byKey.values())
          .sort((a, b) => {
            const aDis = a.dismissed ? 1 : 0;
            const bDis = b.dismissed ? 1 : 0;
            if (aDis !== bDis) return aDis - bDis;
            const aCh = parseInt(a.chapterNumber) || 0;
            const bCh = parseInt(b.chapterNumber) || 0;
            return aCh - bCh;
          });
      });

      setQuirkSummary(summary);

      // Build human-friendly report
      const parts = [];
      parts.push('Quirk Scan complete in ' + Math.round(summary.elapsedMs / 100) / 10 + 's.');
      parts.push('');
      if (summary.byType.droppedSubjectVerb > 0) {
        parts.push('🚨 Dropped subject-verb: ' + summary.byType.droppedSubjectVerb + ' finding(s). Likely missing "He felt" / "She felt" / "It was" at sentence starts.');
      } else {
        parts.push('✅ Dropped subject-verb: 0 findings.');
      }
      if (summary.yetTriggered) {
        parts.push('⚠️ "yet" misuse: ' + summary.byType.yetMisuse + ' instance(s) flagged (rate ' + summary.yetRate + '/1K words — above threshold). Common Lumimaid tic.');
      } else {
        parts.push('✅ "yet" misuse: ' + summary.yetTotalInstances + ' instance(s) found (rate ' + summary.yetRate + '/1K — below 0.5 threshold, not flagged).');
      }
      parts.push('');
      parts.push('📊 Dialogue-punct audit: ' + summary.dialoguePunctTotal + ' instance(s) of punctuation outside quotes.');
      if (summary.dialoguePunctTotal > 0) {
        parts.push('   Run Polish to auto-fix these, or inspect: ' + summary.dialoguePunctPerChapter.slice(0, 5).map(d => 'Ch.' + d.chapterNumber + ' (' + d.count + ')').join(', '));
      }
      parts.push('');
      parts.push(summary.totalFindings > 0
        ? 'ℹ️ Findings merged into Review Queue below. Click ✓ Done to mark items handled.'
        : '✨ Manuscript is clean on all three checks.'
      );
      const report = parts.join('\n');

      toast.info(report, { duration: 30000 });
      console.warn('[QUIRK-SCAN] Report:\n' + report);

    } catch (err) {
      console.error('[QUIRK-SCAN] FATAL:', err);
      toast.error('Quirk Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  const cleanScore = stats?.cleanScore || 0;
  const rtLabel = cleanScore >= 90 ? 'Certified Fresh' : cleanScore >= 85 ? 'Fresh' : cleanScore >= 70 ? 'Mixed' : 'Rotten';
  const rtIcon = cleanScore >= 85 ? '🍅' : cleanScore >= 70 ? '🟡' : '🤢';

  if (!drafted.length) {
    return <div className="text-center text-sm text-muted-foreground py-8">No drafted chapters found. Draft chapters first.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Badge>{isNF ? '📚 Nonfiction' : '📖 Fiction'}</Badge>
      </div>

      {/* ─────────── CARD 1: POLISH MANUSCRIPT ─────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Polish Manuscript
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Runs ~25 deterministic fixes across the whole book: banned words, voice patterns, dialogue punctuation, capitalization, transition caps, vocabulary caps, burstiness, and more. Then an auto-proofread pass applies safe grammar/spelling fixes. Pure code — instant, free, no AI. Saves directly to the project.
            </p>
          </div>
          <Button
            onClick={handlePolish}
            disabled={isBusy}
            size="lg"
            className="rounded-full px-6 gap-2 flex-shrink-0"
          >
            {isBusy && (busyLabel?.includes('Polish') || busyLabel?.includes('Auto-Proofread'))
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace(/(?:Polish(?:\s*\(NF\))?|Auto-Proofread):\s*/, '')}</>
              : <><Sparkles className="h-4 w-4" /> Polish</>}
          </Button>
        </div>
      </div>

      {/* ─────────── CARD 2: SCAN FOR MODEL QUIRKS ─────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg flex items-center gap-2">
              <span className="text-base">🔍</span>
              Scan for Model Quirks
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Flags LLM-specific bugs that polish doesn't catch: dropped "He felt" / "She felt" / "It was" subject-verb fragments, Lumimaid "yet" conjunction misuse, orphan sentence fragments. Flag-only — findings go to the Review Queue below for your judgment. No prose is modified.
            </p>
          </div>
          <Button
            onClick={handleQuirkScan}
            disabled={isBusy}
            size="lg"
            variant="outline"
            className="rounded-full px-6 gap-2 flex-shrink-0"
          >
            {isBusy && busyLabel?.includes('Quirk Scan')
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace('Quirk Scan: ', '')}</>
              : <>🔍 Quirk Scan</>}
          </Button>
        </div>
      </div>

      {/* ─────────── CARD 3: RUN AI PROOFREADER ─────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg flex items-center gap-2">
              <span className="text-base">🤖</span>
              Run AI Proofreader
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              AI scans each chapter for semantic issues a regex can't catch: weak prose, repeated ideas, continuity errors, pacing breaks, POV drift. Suggests drop-in rewrites you can accept or reject per finding. Uses ~20 LLM calls; takes 2-4 minutes.
            </p>
          </div>
          <Button
            onClick={onRunProofread}
            disabled={isBusy || !onRunProofread}
            size="lg"
            variant="outline"
            className="rounded-full px-6 gap-2 flex-shrink-0"
          >
            {proofreadBusy
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel?.replace(/Proofreading:\s*/, '') || 'Running…'}</>
              : <>🤖 Proofread</>}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl">Manuscript Health</h3>
          <Button variant="ghost" size="sm" onClick={loadStats} disabled={loadingStats} className="rounded-full text-[10px] h-7 px-3">
            {loadingStats ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </Button>
        </div>
        {stats ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <StatCard value={stats.wordCount?.toLocaleString() || '—'} label="Words" />
              <StatCard value={stats.chapterCount || '—'} label="Chapters" />
              <StatCard value={stats.avgWordsPerChapter?.toLocaleString() || '—'} label="Avg / Chapter" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard value={stats.cleanScore} label="Clean Score" />
              <StatCard value={stats.bannedWords} label="Banned Words" />
              <StatCard value={stats.voiceWas} label="Voice Patterns" />
            </div>
          </>
        ) : loadingStats ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : null}
      </div>

      {/* RT Score */}
      {stats && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm text-center">
          <span className="text-5xl">{rtIcon}</span>
          <div className="text-4xl font-bold mt-1">{cleanScore}%</div>
          <Badge variant={cleanScore >= 85 ? 'default' : cleanScore >= 70 ? 'secondary' : 'destructive'} className="mt-1">{rtLabel}</Badge>
        </div>
      )}

      {/* Polish results comparison */}
      {polishResults && (
        <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
          <h3 className="font-display text-xl mb-3">Polish Results</h3>
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b border-border/50"><th className="pb-2 text-[10px] uppercase text-muted-foreground">Metric</th><th className="pb-2 text-[10px] uppercase text-muted-foreground text-center">Before</th><th className="pb-2 text-[10px] uppercase text-muted-foreground text-center">After</th></tr></thead>
            <tbody>
              {[['Banned Words', polishResults.before.bannedWords, polishResults.after.bannedWords], ['Voice Patterns', polishResults.before.voiceWas, polishResults.after.voiceWas], ['Clean Score', polishResults.before.cleanScore + '%', polishResults.after.cleanScore + '%']].map(([m, b, a]) => (
                <tr key={m} className="border-b border-border/30"><td className="py-1.5 text-muted-foreground">{m}</td><td className="py-1.5 text-center">{b}</td><td className="py-1.5 text-center">{a}</td></tr>
              ))}
            </tbody>
          </table>
          {polishResults.changes?.length > 0 && (
            <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">View changes ({polishResults.changes.length})</summary>
              <ul className="mt-2 max-h-36 overflow-y-auto space-y-1 text-xs text-muted-foreground">{polishResults.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {/* Review Queue — missing-noun sites and other flag-only findings */}
      {reviewQueue.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl text-amber-700 dark:text-amber-400">
              📝 Review Queue
              <span className="ml-2 text-sm text-muted-foreground font-sans">
                ({reviewQueue.filter(i => !i.dismissed).length} pending
                {reviewQueue.some(i => i.dismissed) && ` · ${reviewQueue.filter(i => i.dismissed).length} done`})
              </span>
            </h3>
            {reviewQueue.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Clear all ' + reviewQueue.length + ' review items? This cannot be undone.')) {
                    setReviewQueue([]);
                  }
                }}
                className="text-xs text-muted-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            These are spots where Polish or the Quirk Scan detected a possible issue that needs author judgment — missing nouns, cross-book contamination, dropped subject-verb fragments, or conjunction misuse. The tool can flag them but can't auto-fix because it doesn't know the right word. Click a chapter number to jump there and fix, then mark done.
          </p>

          {/* ── GROUPED REVIEW QUEUE ─────────────────────────────────────
              Items are bucketed by (detectorType, subType) so the author
              can walk through them in "same-kind-of-surgery" batches.
              Missing-noun and contamination items don't use subtypes, so
              they each render as a single group. "yet" misuse has 4 subtype
              groups (dialogueFragment, questionLike, continuation, other).
          */}
          {(() => {
            // Bucket the queue into groups
            const groups = new Map();
            const getGroupKey = (item) => {
              if (item.contaminationType) return 'contamination';
              if (item.detectorType === 'droppedSubjectVerb') return 'droppedSubjectVerb';
              if (item.detectorType === 'finalCheck') return 'finalCheck';
              if (item.detectorType === 'nameVariant') return 'nameVariant';
              if (item.detectorType === 'duplicateScene') return 'duplicateScene';
              if (item.detectorType === 'yetMisuse') {
                return 'yetMisuse:' + (item.subType || 'other');
              }
              return 'missingNoun';
            };

            const GROUP_LABELS = {
              'missingNoun': { title: '🟡 Missing noun sites', subtitle: 'The detector flagged "a ADJ, VERB" patterns where a noun may have been dropped. Human judgment required to pick the word.' },
              'contamination': { title: '🚨 Cross-book contamination', subtitle: 'Names that appear heavily concentrated in few chapters — likely from another project. If intentional, add to the project character bible.' },
              'nameVariant': { title: '🔤 Name variants', subtitle: 'Two similar spellings of what may be the same character (e.g., Kael vs Kaelen). Pick one and find/replace the other across the manuscript.' },
              'duplicateScene': { title: '📋 Duplicate scenes', subtitle: 'Near-identical passages or repeated plot beats across chapters. One instance should be rewritten or removed.' },
              'droppedSubjectVerb': { title: '🚨 Dropped subject-verb', subtitle: 'Sentences that look like "He felt" / "She felt" / "It was" was cut from the front. Read context to pick the right lead-in.' },
              'finalCheck': { title: '🔎 Final Proofread', subtitle: 'Issues found by a fresh LLM reading the polished manuscript cold — garbled text, continuity errors, awkward phrasing, attribution confusion.' },
              'yetMisuse:dialogueFragment': { title: '💬 "yet" — dialogue or fragment', subtitle: 'These are inside or near dialogue. Usually needs an em-dash (—) or period, not a conjunction swap.' },
              'yetMisuse:questionLike': { title: '❓ "yet" — question-like', subtitle: 'Near question punctuation or interrogative words. Usually needs a question mark, or the "yet" should be cut.' },
              'yetMisuse:continuation': { title: '→ "yet" — continuation', subtitle: 'Same subject continues across the comma. Often reads better as ", and " — quick swap.' },
              'yetMisuse:other': { title: '🔧 "yet" — other structural', subtitle: "Doesn't fit the above patterns. Read aloud and decide case-by-case." },
            };

            const GROUP_ORDER = [
              'contamination',
              'duplicateScene',
              'nameVariant',
              'droppedSubjectVerb',
              'finalCheck',
              'missingNoun',
              'yetMisuse:dialogueFragment',
              'yetMisuse:questionLike',
              'yetMisuse:continuation',
              'yetMisuse:other',
            ];

            // Bucket
            for (const item of reviewQueue) {
              const key = getGroupKey(item);
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push(item);
            }

            // Render in order
            return GROUP_ORDER.filter(k => groups.has(k) && groups.get(k).length > 0).map(key => {
              const items = groups.get(key);
              const meta = GROUP_LABELS[key] || { title: key, subtitle: '' };
              const pending = items.filter(i => !i.dismissed).length;
              const done = items.filter(i => i.dismissed).length;

              return (
                <details key={key} open={pending > 0} className="mb-3 rounded-lg border border-border/60 bg-background/40">
                  <summary className="cursor-pointer px-3 py-2 select-none hover:bg-background/80 rounded-lg">
                    <span className="font-semibold text-sm">{meta.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({pending} pending{done > 0 ? ` · ${done} done` : ''})
                    </span>
                    <p className="mt-1 text-[11px] text-muted-foreground font-normal">{meta.subtitle}</p>
                  </summary>

                  {/* Batch actions for large groups */}
                  {pending > 5 && (
                    <div className="mx-3 mt-1 mb-2 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground flex-1 min-w-0">
                        {key.startsWith('yetMisuse') ? '💡 Re-run Polish Step 7 to auto-fix, or use Rewrite All for LLM-powered fixes.' : `${pending} items — use batch actions to speed up review.`}
                      </span>
                      <Button
                        variant="default"
                        size="sm"
                        className="text-[10px] h-6 px-2 gap-1"
                        disabled={batchRewriting || !!busyLabel}
                        onClick={() => handleBatchRewriteGroup(key)}
                      >
                        {batchRewriting ? <><Loader2 className="h-3 w-3 animate-spin" /> {batchProgress}</> : <>✨ Rewrite All ({pending})</>}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={() => {
                          setReviewQueue(prev => prev.map(i => {
                            if (getGroupKey(i) === key && !i.dismissed) return { ...i, dismissed: true };
                            return i;
                          }));
                          toast.success(`${pending} items dismissed`);
                        }}
                      >
                        Dismiss All ({pending})
                      </Button>
                    </div>
                  )}
                  <ul className="space-y-2 px-3 pb-3 pt-1">
                    {items.map(item => {
                      const isQuirk = item.detectorType === 'droppedSubjectVerb' || item.detectorType === 'yetMisuse';
                      const isDroppedSV = item.detectorType === 'droppedSubjectVerb';
                      const isYetMisuse = item.detectorType === 'yetMisuse';
                      return (
                      <li
                        key={item.id}
                        className={
                          'rounded-lg border p-3 text-sm transition-opacity ' +
                          (item.dismissed
                            ? 'border-border/40 bg-muted/30 opacity-50'
                            : item.contaminationType
                              ? 'border-red-500/50 bg-red-50/40 dark:bg-red-950/20'
                              : isDroppedSV
                                ? 'border-orange-500/50 bg-orange-50/40 dark:bg-orange-950/20'
                                : isYetMisuse
                                  ? 'border-sky-500/40 bg-sky-50/30 dark:bg-sky-950/20'
                                  : 'border-amber-500/40 bg-background/70')
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {item.contaminationType && (
                                <Badge variant="destructive" className="text-[10px]">
                                  🚨 Contamination
                                </Badge>
                              )}
                              {isDroppedSV && (
                                <Badge className="text-[10px] bg-orange-600 hover:bg-orange-700">
                                  🚨 Dropped subject-verb
                                </Badge>
                              )}
                              {isYetMisuse && (
                                <Badge className="text-[10px] bg-sky-600 hover:bg-sky-700">
                                  "yet" misuse
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                Ch. {item.chapterNumber}
                              </Badge>
                              <code className={
                                'text-xs font-mono break-all ' +
                                (item.contaminationType
                                  ? 'text-red-700 dark:text-red-400'
                                  : isDroppedSV
                                    ? 'text-orange-700 dark:text-orange-400'
                                    : isYetMisuse
                                      ? 'text-sky-700 dark:text-sky-400'
                                      : 'text-amber-700 dark:text-amber-400')
                              }>
                                "{item.pattern}"
                              </code>
                            </div>
                            {item.context && (
                              <div className="text-xs text-muted-foreground italic mb-1 break-words">
                                {item.contaminationType ? item.context : '…' + item.context + '…'}
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground">
                              {item.suggestion}
                            </div>
                            {item.contaminationType && (
                              <div className="text-[10px] text-muted-foreground mt-1 italic">
                                💡 If this character IS canon, add the name to your project's character bible to stop the flag. Otherwise, use Find/Replace in your editor to remove or rename.
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {item.detectorType === 'duplicateScene' ? (
                              /* Duplicate scene fix flow */
                              dupeFixState && dupeFixState.itemId === item.id ? (
                                <div className="flex flex-col gap-1">
                                  {dupeFixState.running ? (
                                    <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Replacing scene…</div>
                                  ) : (
                                    <>
                                      <div className="text-[10px] text-muted-foreground mb-1">Keep scene in which chapter?</div>
                                      <Button size="sm" className="text-xs h-7" onClick={() => handleDuplicateSceneFix(item, dupeFixState.chA, dupeFixState.chB)}>
                                        Keep Ch.{dupeFixState.chA}, rewrite Ch.{dupeFixState.chB}
                                      </Button>
                                      <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleDuplicateSceneFix(item, dupeFixState.chB, dupeFixState.chA)}>
                                        Keep Ch.{dupeFixState.chB}, rewrite Ch.{dupeFixState.chA}
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => setDupeFixState(null)} className="text-xs h-7 text-muted-foreground">Cancel</Button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled={item.dismissed || batchRewriting}
                                  onClick={() => {
                                    // Parse chapter numbers from "Ch.4 ↔ Ch.7"
                                    const chMatch = (item.chapterNumber || '').match(/(\d+).*?(\d+)/);
                                    if (!chMatch) { toast.error('Could not parse chapter numbers'); return; }
                                    setDupeFixState({ itemId: item.id, chA: parseInt(chMatch[1]), chB: parseInt(chMatch[2]), running: false });
                                  }}
                                  className="text-xs h-7 gap-1"
                                >
                                  📋 Fix Duplicate
                                </Button>
                              )
                            ) : item.detectorType === 'nameVariant' ? (
                              /* Rename flow for name variants */
                              renameState && renameState.itemId === item.id ? (
                                <div className="flex flex-col gap-1">
                                  <div className="text-[10px] text-muted-foreground">Replace "{renameState.oldName}" with:</div>
                                  <input
                                    value={renameState.newName}
                                    onChange={(e) => setRenameState(prev => ({ ...prev, newName: e.target.value }))}
                                    className="h-7 text-xs w-28 rounded border border-border bg-background px-2"
                                    placeholder="New name"
                                    autoFocus
                                    disabled={renameState.running}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(renameState.oldName, renameState.newName, item.id); }}
                                  />
                                  <Button
                                    size="sm"
                                    disabled={renameState.running || !renameState.newName}
                                    onClick={() => handleRename(renameState.oldName, renameState.newName, item.id)}
                                    className="text-xs h-7 gap-1"
                                  >
                                    {renameState.running ? <><Loader2 className="h-3 w-3 animate-spin" /> Renaming…</> : '✓ Rename All'}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setRenameState(null)} className="text-xs h-7 text-muted-foreground">Cancel</Button>
                                </div>
                              ) : (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    disabled={item.dismissed || batchRewriting}
                                    onClick={() => {
                                      // Parse which names are in this variant pair
                                      const parts = item.pattern.split(' / ');
                                      const nameA = parts[0]?.trim();
                                      const nameB = parts[1]?.trim();
                                      // Default: rename the less-common variant to the more-common one
                                      const countA = parseInt((item.context.match(new RegExp('"' + nameA + '"\\s+(\\d+)x')) || [])[1]) || 0;
                                      const countB = parseInt((item.context.match(new RegExp('"' + nameB + '"\\s+(\\d+)x')) || [])[1]) || 0;
                                      const oldName = countA >= countB ? nameB : nameA;
                                      const newName = countA >= countB ? nameA : nameB;
                                      setRenameState({ itemId: item.id, oldName, newName, running: false });
                                    }}
                                    className="text-xs h-7 gap-1"
                                  >
                                    🔤 Rename
                                  </Button>
                                </>
                              )
                            ) : !item.contaminationType && (
                              <Button
                                variant="default"
                                size="sm"
                                disabled={rewritingId === item.id || item.dismissed || batchRewriting}
                                onClick={() => handleRewriteItem(item)}
                                className="text-xs h-7 gap-1"
                              >
                                {rewritingId === item.id ? <><Loader2 className="h-3 w-3 animate-spin" /> Rewriting…</> : '✨ Rewrite'}
                              </Button>
                            )}
                            <Button
                              variant={item.dismissed ? 'ghost' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setReviewQueue(prev =>
                                  prev.map(i => i.id === item.id ? { ...i, dismissed: !i.dismissed } : i)
                                );
                              }}
                              className="text-xs h-7"
                            >
                              {item.dismissed ? 'Undo' : '✓ Done'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReviewQueue(prev => prev.filter(i => i.id !== item.id));
                              }}
                              className="text-xs h-7 text-muted-foreground"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                        {/* Rewrite preview for this item */}
                        {rewritePreview && rewritePreview.id === item.id && (
                          <div className="mt-3 rounded-lg border border-green-500/50 bg-green-50/30 dark:bg-green-950/20 p-3">
                            <div className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">✨ Rewrite Preview — Ch. {rewritePreview.chapterNumber}</div>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              <div>
                                <span className="font-semibold text-red-600 dark:text-red-400">Original: </span>
                                <span className="line-through opacity-60">{rewritePreview.original}</span>
                              </div>
                              <div>
                                <span className="font-semibold text-green-600 dark:text-green-400">Rewrite: </span>
                                <span>{rewritePreview.rewritten}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={handleAcceptRewrite}
                                disabled={!!busyLabel}
                                className="text-xs h-7 gap-1 bg-green-600 hover:bg-green-700"
                              >
                                {busyLabel === 'Saving rewrite…' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : '✓ Accept & Save'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRewritePreview(null)}
                                className="text-xs h-7"
                              >
                                ✗ Reject
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRewriteItem(item)}
                                disabled={rewritingId === item.id}
                                className="text-xs h-7 text-muted-foreground"
                              >
                                ↻ Try again
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                </details>
              );
            });
          })()}

          <p className="mt-3 text-[10px] text-muted-foreground">
            Tip: After you edit a chapter and re-run Polish, already-fixed items are auto-removed from this list.
          </p>
        </div>
      )}

      {/* Final Proofread Check — "Fresh Eyes" */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <h3 className="font-display text-xl mb-1">🔎 Final Proofread Check</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Sends the polished manuscript to a different AI model that reads it cold — like a human editor seeing it for the first time. Catches garbled text, continuity errors, awkward phrasing, and anything the polish pipeline missed.
        </p>

        {!finalCheckResults && (
          <div className="flex items-center gap-3">
            <Button
              onClick={handleFinalCheck}
              disabled={isBusy || finalCheckRunning || drafted.length < 1}
              className="rounded-full gap-2"
            >
              {finalCheckRunning ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {finalCheckProgress || 'Running…'}</>
              ) : (
                <><Search className="h-3.5 w-3.5" /> Run Final Check</>
              )}
            </Button>
            {drafted.length < 1 && <p className="text-xs text-muted-foreground">Need at least 1 drafted chapter.</p>}
          </div>
        )}

        {finalCheckRunning && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">{finalCheckProgress}</p>
          </div>
        )}

        {finalCheckResults && (
          <div className="space-y-3">
            {/* Stats summary */}
            <div className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-medium">{finalCheckResults.stats.critical} Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm font-medium">{finalCheckResults.stats.major} Major</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-400" />
                <span className="text-sm font-medium">{finalCheckResults.stats.minor} Minor</span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">
                {finalCheckResults.stats.chaptersScanned} chapters scanned · Model: {finalCheckResults.stats.model}
              </span>
            </div>

            {/* Cross-chapter findings (no original_text — display inline) */}
            {finalCheckResults.findings.filter(f => f.source === 'final_check_cross').length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cross-Chapter Consistency</p>
                {finalCheckResults.findings.filter(f => f.source === 'final_check_cross').map((f, idx) => {
                  const sc = f.severity === 'critical' ? 'border-red-500/50 bg-red-50/30 dark:bg-red-950/20' : f.severity === 'major' ? 'border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20' : 'border-blue-400/30 bg-blue-50/20 dark:bg-blue-950/10';
                  const dot = f.severity === 'critical' ? 'bg-red-500' : f.severity === 'major' ? 'bg-amber-500' : 'bg-blue-400';
                  return (
                    <div key={'cross-' + idx} className={`rounded-lg border p-3 text-sm ${sc}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.severity} — {(f.category || '').replace(/_/g, ' ')}</span>
                        {f.chapters_involved && <span className="text-xs text-muted-foreground ml-auto">Ch. {f.chapters_involved.join(' & ')}</span>}
                      </div>
                      <p className="text-sm text-foreground">{f.description}</p>
                      {f.suggested_fix && <p className="mt-1 text-xs text-primary">💡 {f.suggested_fix}</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Per-chapter findings go to the Review Queue above (with ✨ Rewrite) */}
            {finalCheckResults.findings.filter(f => f.source === 'final_check').length > 0 && (
              <p className="text-xs text-muted-foreground">
                ✅ {finalCheckResults.findings.filter(f => f.source === 'final_check').length} per-chapter findings added to the Review Queue above — use ✨ Rewrite to fix them.
              </p>
            )}

            {finalCheckResults.stats.total === 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 p-4 text-center">
                <p className="text-sm text-green-700 dark:text-green-400">✅ No issues found. Manuscript is clean.</p>
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => setFinalCheckResults(null)} className="rounded-full text-xs">
              Run Again
            </Button>
          </div>
        )}
      </div>

      {/* Critique */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
        <h3 className="font-display text-xl mb-3">Editorial Assessment</h3>
        {!critique ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">AI editorial critique assessing prose, marketability, and commercial potential.</p>
            <Button onClick={handleCritique} disabled={isBusy || critiqueLoading || drafted.length < 3} className="rounded-full gap-2">
              {critiqueLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</> : <><FileText className="h-3.5 w-3.5" /> Generate Critique</>}
            </Button>
            {drafted.length < 3 && <p className="mt-2 text-xs text-muted-foreground">Need at least 3 chapters.</p>}
          </>
        ) : (
          <>
            {critiqueRating !== null && (
              <div className="text-center mb-3">
                <div className="text-3xl">{[1,2,3,4,5].map(s => <span key={s} style={{ color: critiqueRating >= s - 0.5 ? '#DAA520' : '#ccc' }}>★</span>)}</div>
                <div className="text-lg font-semibold text-muted-foreground">{critiqueRating} / 5</div>
              </div>
            )}
            <div className="prose prose-sm prose-slate dark:prose-invert max-w-none"><ReactMarkdown>{critique}</ReactMarkdown></div>
            <Button variant="outline" size="sm" onClick={() => { setCritique(null); setCritiqueRating(null); }} className="mt-3 rounded-full text-xs">Regenerate</Button>
          </>
        )}
      </div>
    </div>
  );
}