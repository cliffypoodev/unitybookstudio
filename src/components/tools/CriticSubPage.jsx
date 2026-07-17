import React, { useState, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp, Wrench, BookOpen, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SourceSelector from '@/components/tools/SourceSelector';
import UploadZone from '@/components/tools/UploadZone';
import { isAnthologyProject } from '@/lib/anthologyEngine';
import { countWords } from '@/lib/autonovel';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { loadManuscriptChapters, getFullText } from '@/lib/manuscriptLoader';
import { base44 } from '@/api/base44Client';
import CriticConsensus from '@/components/tools/CriticConsensus';
import CriticReviewCard from '@/components/tools/CriticReviewCard';
import { resolveChapterContent } from '@/lib/chapterStorage';
import {
  pickReviewerPanel,
  buildReviewerPrompt,
  REVIEWER_RESPONSE_SCHEMA,
  computeConsensus,
  runReviewerPanelSequential,
} from '@/lib/criticPanel';

// Deep critique pipeline imports
import { buildManuscriptEvidenceReport } from '@/lib/manuscriptEvidence';
import { buildPlanDeliveryReport } from '@/lib/planCrossCheck';
import { runDeepCritique } from '@/lib/critiquePipeline';
import { applySurgicalFixes } from '@/lib/surgicalFix';

/* ═══════════════════════════════════════════════════════════════════════════
 * ANTHOLOGY / CONTINUOUS EXCERPT BUILDERS (preserved from original)
 * ═════════════════════════════════════════════════════════════════════════ */

function buildCriticExcerpt(fullText) {
  const opening = fullText.substring(0, 40000);
  const midpoint = Math.floor(fullText.length / 2);
  const middle = fullText.substring(midpoint - 2500, midpoint + 2500);
  const ending = fullText.substring(fullText.length - 10000);
  return opening + '\n\n[...MIDDLE OF MANUSCRIPT...]\n\n' + middle + '\n\n[...END OF MANUSCRIPT...]\n\n' + ending;
}

function buildAnthologyExcerpt(normalizedChapters) {
  if (!normalizedChapters?.length) return '';
  const TOTAL_BUDGET = 50000;
  const numStories = normalizedChapters.length;
  const perStoryBudget = Math.floor((TOTAL_BUDGET - (numStories * 250)) / numStories);
  const openingBudget = Math.floor(perStoryBudget * 0.67);
  const closingBudget = perStoryBudget - openingBudget;
  const parts = [];
  parts.push(`[ANTHOLOGY EXCERPT — ${numStories} STORIES SAMPLED]\n\nThis excerpt contains the opening and closing of every story in the collection so you can evaluate the full range.\n`);
  for (const ch of normalizedChapters) {
    const content = ch.content || '';
    const title = ch.title || `Story ${ch.chapter_number}`;
    const wordCount = ch.word_count || 0;
    parts.push(`\n═══════════════════════════════════════════\nSTORY ${ch.chapter_number}: ${title}\n(${wordCount.toLocaleString()} words total)\n═══════════════════════════════════════════\n`);
    if (content.length <= perStoryBudget) {
      parts.push(content);
    } else {
      parts.push(content.substring(0, openingBudget).trim());
      parts.push('\n\n[...story continues...]\n\n');
      parts.push(content.substring(content.length - closingBudget).trim());
    }
  }
  return parts.join('');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * REVIEWER PANEL (preserved from original)
 * ═════════════════════════════════════════════════════════════════════════ */

async function runSingleReviewer(reviewer, context) {
  const prompt = buildReviewerPrompt(reviewer, context);
  try {
    const response = await invokeLLMWithRetry({
      task_type: 'critique',
      prompt,
      response_json_schema: REVIEWER_RESPONSE_SCHEMA,
      temperature: 0.3,
      max_tokens: 3000,
    });
    let data = typeof response === 'string' ? response : response;
    if (typeof data === 'string') {
      data = data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      data = JSON.parse(data);
    }
    const ratingNumeric = Math.max(0, Math.min(100,
      Number.isFinite(Number(data.rating_numeric)) ? Math.round(Number(data.rating_numeric)) : 50
    ));
    return {
      outlet: data.outlet || reviewer.outlet,
      icon: data.icon || reviewer.icon,
      rating_label: data.rating_label || '—',
      rating_numeric: ratingNumeric,
      rating_display: data.rating_display || data.rating_label || '—',
      review: data.review || 'Review unavailable.',
      summary_line: data.summary_line || '',
      audience_prediction: Math.max(0, Math.min(100,
        Number.isFinite(Number(data.audience_prediction)) ? Math.round(Number(data.audience_prediction)) : ratingNumeric
      )),
      audience_reasoning: data.audience_reasoning || '',
    };
  } catch (err) {
    console.error(`[CRITIC] ${reviewer.outlet} call failed:`, err?.message || err);
    return {
      outlet: reviewer.outlet, icon: reviewer.icon,
      rating_label: 'N/A', rating_numeric: 50, rating_display: 'N/A',
      review: `Review generation failed for ${reviewer.outlet}. (${err?.message || 'Unknown error'})`,
      summary_line: '', audience_prediction: 50, audience_reasoning: '', _failed: true,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS — Dashboard, Chapter Critique Card, Fix List, Evidence
 * ═════════════════════════════════════════════════════════════════════════ */

function ScoreBadge({ score, color }) {
  const bg = color === 'green' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : color === 'amber' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg}`}>
      {score}
    </span>
  );
}

function DashboardPanel({ dashboard, threadWatch, marketability }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
      <h3 className="font-display text-xl text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" /> Synthesis Dashboard
      </h3>
      <div className="grid grid-cols-5 gap-3">
        {dashboard.map((d) => (
          <div key={d.area} className="text-center space-y-1">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{d.area}</div>
            <div className="text-2xl font-bold"><ScoreBadge score={d.score} color={d.color} /></div>
            <div className="text-xs text-muted-foreground">{d.verdict}</div>
          </div>
        ))}
      </div>
      {threadWatch?.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">⚠ Thread Watch</div>
          <ul className="text-sm text-amber-200/80 space-y-1">
            {threadWatch.map((t, i) => <li key={i}>• {t}</li>)}
          </ul>
        </div>
      )}
      {marketability && (
        <div className="mt-2 p-3 rounded-lg bg-muted/30">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Marketability</div>
          <p className="text-sm text-foreground/80">{marketability}</p>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }) {
  const cls = severity === 'A' ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : severity === 'B' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    : 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cls}`}>{severity}</span>;
}

function ChapterCritiqueCard({ critique, onSelectFix, selectedFixes }) {
  const [expanded, setExpanded] = useState(false);
  const contractIcon = critique.contractPassed
    ? <CheckCircle className="h-4 w-4 text-emerald-400" />
    : <AlertTriangle className="h-4 w-4 text-amber-400" />;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Chapter {critique.chapterNumber}</span>
          {contractIcon}
          <div className="flex gap-1.5 ml-2">
            {Object.entries(critique.scores).map(([area, score]) => (
              <span key={area} className="text-xs text-muted-foreground" title={area}>
                {area.slice(0, 2).toUpperCase()}: <span className={score >= 7 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400'}>{score}</span>
              </span>
            ))}
          </div>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30">
          {/* Strengths */}
          {critique.strengths?.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths</div>
              {critique.strengths.map((s, i) => (
                <div key={i} className="mb-2 text-sm">
                  <p className="text-foreground/90">{s.description}</p>
                  {s.quote && <blockquote className="mt-1 pl-3 border-l-2 border-emerald-500/30 text-xs text-muted-foreground italic">"{s.quote}"</blockquote>}
                </div>
              ))}
            </div>
          )}

          {/* Weaknesses */}
          <div>
            <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Weaknesses</div>
            {(critique.weaknesses || []).map((w, i) => {
              const fixId = `${critique.chapterNumber}-${i}`;
              const isSelected = selectedFixes?.has(fixId);
              return (
                <div key={i} className={`mb-3 p-3 rounded-lg border transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-border/30 bg-muted/10'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={w.severity} />
                        <span className="text-xs text-muted-foreground uppercase">{w.fixType}</span>
                      </div>
                      <p className="text-sm text-foreground/90">{w.description}</p>
                      {w.quote && <blockquote className="mt-1 pl-3 border-l-2 border-red-500/20 text-xs text-muted-foreground italic">"{w.quote}"</blockquote>}
                    </div>
                    {w.fixType === 'prose' && (
                      <button
                        className={`shrink-0 p-1.5 rounded-lg border transition-all ${isSelected ? 'border-primary bg-primary/20 text-primary' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'}`}
                        onClick={(e) => { e.stopPropagation(); onSelectFix?.(fixId, w); }}
                        title={isSelected ? 'Deselect fix' : 'Select for surgical fix'}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Put-down moments */}
          {critique.putDownMoments?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Put-Down Moments</div>
              <ul className="text-sm text-muted-foreground space-y-0.5">
                {critique.putDownMoments.map((m, i) => <li key={i}>• {m}</li>)}
              </ul>
            </div>
          )}

          {/* Contract violations */}
          {!critique.contractPassed && critique.contractViolations?.length > 0 && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <div className="text-[10px] font-semibold text-amber-400 uppercase mb-1">Contract Violations</div>
              <ul className="text-xs text-amber-200/60 space-y-0.5">
                {critique.contractViolations.map((v, i) => <li key={i}>⚠ {v}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PriorityFixPanel({ fixes, selectedFixes, onToggleFix }) {
  if (!fixes?.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
      <h3 className="font-display text-lg text-foreground flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" /> Priority Fix List
        <span className="text-xs text-muted-foreground ml-auto">{selectedFixes?.size || 0} selected</span>
      </h3>
      <div className="max-h-80 overflow-y-auto space-y-2">
        {fixes.map((fix, i) => {
          const fixId = `${fix.chapterNumber}-${i}`;
          const isSelected = selectedFixes?.has(fixId);
          return (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-muted/10">
              <SeverityBadge severity={fix.severity} />
              <div className="flex-1 min-w-0">
                <span className="text-muted-foreground">Ch.{fix.chapterNumber}</span>
                <span className="mx-1.5 text-border">·</span>
                <span className="text-foreground/80">{fix.description}</span>
                {fix.quote && <div className="text-xs text-muted-foreground truncate mt-0.5">"{fix.quote}"</div>}
              </div>
              {fix.fixType === 'prose' && (
                <button
                  className={`shrink-0 p-1 rounded ${isSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  onClick={() => onToggleFix?.(fixId, fix)}
                >
                  <Wrench className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EvidenceMiniPanel({ evidence }) {
  if (!evidence) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
      <h3 className="font-display text-lg text-foreground">📊 Manuscript Evidence</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-foreground">{evidence.manuscript.totalWords.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total Words</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{evidence.manuscript.chapterCount}</div>
          <div className="text-xs text-muted-foreground">Chapters</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{evidence.manuscript.ttr}</div>
          <div className="text-xs text-muted-foreground">TTR</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ═════════════════════════════════════════════════════════════════════════ */

export default function CriticSubPage({ project, chapters, busyLabel, setBusyLabel }) {
  const [source, setSource] = useState(project?.id ? 'project' : 'upload');
  const [uploadedContent, setUploadedContent] = useState(null);
  const [activeTab, setActiveTab] = useState('deep-critique');

  // Deep critique state
  const [critiqueResults, setCritiqueResults] = useState(null);
  const [evidenceData, setEvidenceData] = useState(null);
  const [selectedFixes, setSelectedFixes] = useState(new Set());
  const [fixLog, setFixLog] = useState(null);
  const [loadedChapters, setLoadedChapters] = useState(null);

  // Reviewer panel state (preserved)
  const [panelResults, setPanelResults] = useState(null);

  const isBusy = !!busyLabel;

  const handleFileLoaded = (parsed) => {
    setUploadedContent(parsed);
    setCritiqueResults(null);
    setPanelResults(null);
  };

  const toggleFix = useCallback((fixId, fix) => {
    setSelectedFixes(prev => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  }, []);

  /* ── DEEP CRITIQUE HANDLER ─────────────────────────────────────────────── */

  const handleDeepCritique = async () => {
    if (isBusy) return;

    setBusyLabel('Deep Critique: Loading chapters…');

    try {
      const normalizedChapters = await loadManuscriptChapters(source, project, chapters, uploadedContent);
      if (!normalizedChapters.length) {
        toast.error(source === 'project' ? 'No chapters found.' : 'Upload a manuscript first.');
        return;
      }

      if (normalizedChapters.length < 3) {
        toast.error('Need at least 3 drafted chapters for deep critique.');
        return;
      }

      // Build loaded array in the shape the pipeline expects
      const loaded = normalizedChapters.map(ch => ({
        chapter: { chapter_number: ch.chapter_number, title: ch.title },
        content: ch.content || '',
        original: ch.content || '',
      }));
      setLoadedChapters(loaded);

      // STAGE 1: Evidence (deterministic, fast)
      setBusyLabel('Deep Critique: Building evidence report…');
      const evidence = buildManuscriptEvidenceReport(loaded, project);
      setEvidenceData(evidence);

      // STAGE 2: Plan cross-check
      setBusyLabel('Deep Critique: Cross-checking against outline…');
      const planReport = await buildPlanDeliveryReport({
        project,
        chapters: loaded,
        evidence,
        onProgress: (label) => setBusyLabel(`Deep Critique: ${label}`),
      });

      // STAGE 3: Per-chapter critique + synthesis
      setBusyLabel('Deep Critique: Critiquing chapters… (this may take 1–3 minutes)');
      const critique = await runDeepCritique({
        loaded,
        project,
        evidence,
        planReport,
        onProgress: (label) => setBusyLabel(`Deep Critique: ${label}`),
      });

      setCritiqueResults({ ...critique, planReport, evidence });
      setSelectedFixes(new Set());
      setFixLog(null);

      const passedCount = critique.chapterCritiques.filter(c => c.contractPassed).length;
      const totalCount = critique.chapterCritiques.length;
      toast.success(`Deep critique complete — ${passedCount}/${totalCount} chapters passed contract validation`);

    } catch (err) {
      console.error('[DEEP-CRITIQUE] Pipeline failed:', err);
      toast.error('Deep critique failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  /* ── APPLY SURGICAL FIXES HANDLER ──────────────────────────────────────── */

  const handleApplyFixes = async () => {
    if (isBusy || !critiqueResults || !loadedChapters || selectedFixes.size === 0) return;

    // Collect the issues from the priority fix list matching selected IDs
    const issues = [];
    const fixList = critiqueResults.synthesis.priorityFixList || [];
    fixList.forEach((fix, i) => {
      const fixId = `${fix.chapterNumber}-${i}`;
      if (selectedFixes.has(fixId)) {
        issues.push(fix);
      }
    });

    // Also collect from chapter critiques
    for (const cc of critiqueResults.chapterCritiques) {
      (cc.weaknesses || []).forEach((w, i) => {
        const fixId = `${cc.chapterNumber}-${i}`;
        if (selectedFixes.has(fixId) && !issues.find(is => is.quote === w.quote && is.chapterNumber === cc.chapterNumber)) {
          issues.push({
            severity: w.severity,
            chapterNumber: cc.chapterNumber,
            quote: w.quote,
            description: w.description,
            fixType: w.fixType,
            source: 'deep-critique',
          });
        }
      });
    }

    if (issues.length === 0) {
      toast.error('No fixable issues selected.');
      return;
    }

    setBusyLabel(`Surgical Fix: Applying ${issues.length} fixes…`);

    try {
      const result = await applySurgicalFixes({
        loaded: loadedChapters,
        issues,
        project,
        onProgress: (label) => setBusyLabel(`Surgical Fix: ${label}`),
      });

      setFixLog(result);

      const applied = result.results.filter(r => r.status === 'applied').length;
      const failed = result.results.filter(r => r.status === 'failed').length;
      const skipped = result.results.filter(r => r.status === 'skipped').length;
      const reverted = result.results.filter(r => r.status === 'reverted').length;

      toast.success(`Fixes complete — ${applied} applied, ${failed} failed, ${skipped} skipped${reverted > 0 ? `, ${reverted} reverted` : ''}`);
    } catch (err) {
      console.error('[SURGICAL-FIX] Failed:', err);
      toast.error('Surgical fix failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  /* ── REVIEWER PANEL HANDLER (preserved from original) ──────────────────── */

  const handleRunPanel = async () => {
    if (isBusy) return;

    try {
      setBusyLabel('Critic: Loading chapters…');
      let title = project?.title || 'Untitled';
      let genre = project?.genre || 'Fiction';
      const isAnthology = isAnthologyProject(project);

      setPanelResults({ consensus: null, reviews: [] });

      const normalizedChapters = await loadManuscriptChapters(source, project, chapters, uploadedContent);
      if (!normalizedChapters.length) {
        toast.error(source === 'project' ? 'No chapters found.' : 'Upload a manuscript first.');
        return;
      }

      if (source === 'upload' && uploadedContent?.title) title = uploadedContent.title;
      const fullText = getFullText(normalizedChapters);
      const wordCount = countWords(fullText);
      if (wordCount < 5000) {
        toast.error('Manuscript too short for critique (' + wordCount + ' words). Need at least 5,000.');
        return;
      }
      if (source === 'project' && normalizedChapters.length < 3) {
        toast.error('Need at least 3 drafted chapters for a meaningful critique.');
        return;
      }

      const excerpt = isAnthology ? buildAnthologyExcerpt(normalizedChapters) : buildCriticExcerpt(fullText);
      const resolvedType = project?.project_type || project?.book_type || 'fiction';
      const authorName = project?.author_name || 'the author';
      const panel = pickReviewerPanel(project, genre, resolvedType);

      // Series context (preserved)
      let seriesContext = { isSeries: false, seriesName: '', seriesNumber: 0, priorVolumeTitle: '', seriesUnresolvedThreads: [], seriesResolvedThreads: [], seriesDeathsAndLosses: [], seriesSecretsRevealed: [], seriesLastBookEnding: '' };
      const seriesNumber = Number(project?.series_number || 0);
      const hasSeriesLink = !!(project?.series_bible_id && seriesNumber >= 2);
      if (hasSeriesLink) {
        try {
          setBusyLabel('Critic: Loading series bible…');
          const bibles = await base44.entities.SeriesBible.filter({ id: project.series_bible_id });
          const bible = bibles?.[0];
          if (bible) {
            const safeParse = (s) => { if (!s) return []; if (Array.isArray(s)) return s; try { return JSON.parse(s) || []; } catch { return []; } };
            let priorVolumeTitle = bible.last_book_title || '';
            if (project?.prior_volume_id) { try { const priors = await base44.entities.NovelProject.filter({ id: project.prior_volume_id }); if (priors?.[0]?.title) priorVolumeTitle = priors[0].title; } catch {} }
            seriesContext = { isSeries: true, seriesName: bible.series_name || project.series_name || '', seriesNumber, priorVolumeTitle, seriesUnresolvedThreads: safeParse(bible.unresolved_threads), seriesResolvedThreads: safeParse(bible.resolved_threads), seriesDeathsAndLosses: safeParse(bible.deaths_and_losses), seriesSecretsRevealed: safeParse(bible.secrets_revealed), seriesLastBookEnding: bible.last_book_ending || '' };
          }
        } catch (err) { console.warn('[CRITIC] Series bible load failed:', err?.message); }
      }

      const reviewerContext = {
        title, genre, wordCount, excerpt, authorName, projectType: resolvedType, isAnthology,
        anthologyTheme: project?.anthology_theme || project?.seed_concept || 'unspecified',
        isMultiPov: project?.pov_mode === 'third-multi', ...seriesContext,
      };

      const t0 = Date.now();

      const reviews = await runReviewerPanelSequential(
        panel,
        (reviewer) => runSingleReviewer(reviewer, reviewerContext),
        (reviewer, index, total) => {
          setBusyLabel(`Critic: Reviewer ${index} of ${total} — ${reviewer.outlet}…`);
        },
        (partialReviews) => {
          const consensus = computeConsensus(partialReviews);
          setPanelResults({ consensus, reviews: partialReviews });
        }
      );

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.warn('[CRITIC] Reviews returned in', elapsed + 's.');
      const consensus = computeConsensus(reviews);
      const failedCount = reviews.filter((r) => r._failed).length;
      if (failedCount > 0) toast.warning(`Panel complete — ${failedCount} reviewers failed.`);
      else toast.success(`Critic: ${consensus.critic.percent_fresh}% Fresh · Audience: ${consensus.audience.percent_fresh}%`);
      setPanelResults({ consensus, reviews });
    } catch (err) {
      console.error('[CRITIC] Panel failed:', err);
      toast.error('Critic panel failed: ' + (err.message || 'Unknown error'));
    } finally {
      setBusyLabel('');
    }
  };

  /* ── RENDER ─────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-3xl text-foreground">Critic</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Evidence-grounded deep critique with surgical fix engine, plus the original reviewer panel.
        </p>
      </div>

      <SourceSelector source={source} setSource={setSource} project={project} />

      {source === 'upload' && (
        <UploadZone onFileLoaded={handleFileLoaded} loaded={uploadedContent} />
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/30 w-fit">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'deep-critique' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('deep-critique')}
        >
          🔍 Deep Critique
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'reviewer-panel' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setActiveTab('reviewer-panel')}
        >
          🎬 Reviewer Panel
        </button>
      </div>

      {/* ── DEEP CRITIQUE TAB ────────────────────────────────────────────── */}
      {activeTab === 'deep-critique' && (
        <div className="space-y-4">
          <div className="text-center">
            <Button
              onClick={handleDeepCritique}
              disabled={isBusy || (source === 'upload' && !uploadedContent?.text)}
              size="lg"
              className="rounded-full px-8 gap-2"
            >
              {isBusy && busyLabel?.includes('Deep Critique') ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace('Deep Critique: ', '')}</>
              ) : (
                <>🔍 Run Deep Critique</>
              )}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Evidence → Plan Cross-Check → Per-Chapter Critique → Synthesis Dashboard
            </p>
          </div>

          {critiqueResults && (
            <div className="space-y-4">
              {/* Evidence mini panel */}
              <EvidenceMiniPanel evidence={evidenceData} />

              {/* Dashboard */}
              <DashboardPanel
                dashboard={critiqueResults.synthesis.dashboard}
                threadWatch={critiqueResults.synthesis.threadWatch}
                marketability={critiqueResults.synthesis.marketability}
              />

              {/* Priority fix list with select toggles */}
              <PriorityFixPanel
                fixes={critiqueResults.synthesis.priorityFixList}
                selectedFixes={selectedFixes}
                onToggleFix={toggleFix}
              />

              {/* Apply fixes button */}
              {selectedFixes.size > 0 && (
                <div className="text-center">
                  <Button
                    onClick={handleApplyFixes}
                    disabled={isBusy}
                    variant="default"
                    size="lg"
                    className="rounded-full px-8 gap-2"
                  >
                    {isBusy && busyLabel?.includes('Surgical Fix') ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace('Surgical Fix: ', '')}</>
                    ) : (
                      <>🔧 Apply {selectedFixes.size} Surgical Fix{selectedFixes.size > 1 ? 'es' : ''}</>
                    )}
                  </Button>
                </div>
              )}

              {/* Fix log */}
              {fixLog && (
                <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-2">
                  <h3 className="font-display text-lg text-foreground">Fix Results</h3>
                  {fixLog.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {r.status === 'applied' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> :
                       r.status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-red-400" /> :
                       r.status === 'reverted' ? <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> :
                       <span className="text-muted-foreground text-xs">—</span>}
                      <span className="text-foreground/80">Ch.{r.chapterNumber}: {r.status}</span>
                      {r.detail && <span className="text-muted-foreground text-xs">({r.detail})</span>}
                    </div>
                  ))}
                  {fixLog.chapterSaves?.length > 0 && (
                    <div className="text-xs text-emerald-400 mt-1">
                      ✅ {fixLog.chapterSaves.length} chapter{fixLog.chapterSaves.length > 1 ? 's' : ''} saved to manuscript
                    </div>
                  )}
                </div>
              )}

              {/* Per-chapter critiques (collapsible) */}
              <div className="space-y-2">
                <h3 className="font-display text-lg text-foreground">Per-Chapter Critiques</h3>
                {critiqueResults.chapterCritiques.map((cc) => (
                  <ChapterCritiqueCard
                    key={cc.chapterNumber}
                    critique={cc}
                    onSelectFix={toggleFix}
                    selectedFixes={selectedFixes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVIEWER PANEL TAB (preserved) ────────────────────────────────── */}
      {activeTab === 'reviewer-panel' && (
        <div className="space-y-4">
          <div className="text-center">
            <Button
              onClick={handleRunPanel}
              disabled={isBusy || (source === 'upload' && !uploadedContent?.text)}
              size="lg"
              className="rounded-full px-8 gap-2"
            >
              {isBusy && busyLabel?.includes('Critic') && !busyLabel?.includes('Deep Critique') ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> {busyLabel.replace('Critic: ', '')}</>
              ) : (
                <>🎬 Run Critic Panel</>
              )}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Ten independent reviews from real-world publication voices. Rotten Tomatoes score computed deterministically.
            </p>
          </div>

          {panelResults && (
            <div className="space-y-4">
              <CriticConsensus consensus={panelResults.consensus} />
              {panelResults.reviews.map((review, i) => (
                <CriticReviewCard key={i} review={review} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}