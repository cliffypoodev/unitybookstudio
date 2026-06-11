import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  chapterHasContent,
  resolveChapterContent,
} from '@/lib/chapterStorage';

import {
  calculateManuscriptStats,
  calculateManuscriptStatsNonfiction,
  detectHighFreqPhrases,
  isComedyProject,
  isNonfictionProject,
} from '@/lib/manuscriptStats';

import { isBodyChapter } from '@/lib/bibliographyGenerator';
import { isAnthologyProject } from '@/lib/anthologyEngine';
import { countWords } from '@/lib/autonovel';
import { base44 } from '@/api/base44Client';
import { runWithNetworkRetry } from '@/lib/requestRetry';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
// NOTE: fixEntireManuscript is intentionally NOT imported here.
// All polish is routed through ProjectStudio's handlePolishRouted → runManuscriptPolishPipeline.

const MANUSCRIPT_DASHBOARD_VERSION = 'ManuscriptDashboard-fixer-prop-safe-v2';
console.log('[MANUSCRIPT-DASHBOARD] Loaded', MANUSCRIPT_DASHBOARD_VERSION);

function StatCard({ value, label }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-center">
      <div className="text-xl font-semibold text-foreground">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function SafeValue({ value, fallback = '—' }) {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
}

function safeDisplayText(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value?.then === 'function') return fallback || 'Working…';

  try {
    if (typeof value === 'object') {
      return value.message || value.label || value.status || value.summary || JSON.stringify(value);
    }
  } catch {
    return fallback;
  }

  return String(value);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractPolishSummary(polishResults, localPolishReport) {
  const report = localPolishReport || polishResults;

  if (!report) return null;

  if (report.summary) return report.summary;

  if (report.before && report.after) {
    return [
      'Polish complete.',
      '',
      `Before clean score: ${report.before.cleanScore ?? 'n/a'}`,
      `After clean score: ${report.after.cleanScore ?? 'n/a'}`,
      `Changes: ${report.changes?.length || 0}`,
    ].join('\n');
  }

  if (typeof report === 'string') return report;

  try {
    return JSON.stringify(report, null, 2);
  } catch {
    return 'Polish complete.';
  }
}

export default function ManuscriptDashboard({
  project,
  chapters = [],
  busyLabel,
  polishResults,
  onPolish,
  onFixEntireManuscript,
  onManuscriptPolish,
  onStop,
}) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [critique, setCritique] = useState(null);
  const [critiqueRating, setCritiqueRating] = useState(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [critiqueProgress, setCritiqueProgress] = useState('');

  const [localPolishRunning, setLocalPolishRunning] = useState(false);
  const [localPolishProgress, setLocalPolishProgress] = useState('');
  const [localPolishReport, setLocalPolishReport] = useState(null);
  const [localPolishError, setLocalPolishError] = useState('');

  const drafted = useMemo(() => {
    return [...chapters]
      .filter((chapter) => chapterHasContent(chapter) && isBodyChapter(chapter))
      .sort((a, b) => Number(a.chapter_number || 0) - Number(b.chapter_number || 0));
  }, [chapters]);

  const isBusy = Boolean(busyLabel || localPolishRunning || critiqueLoading);
  const isNF = isNonfictionProject(project);
  const isComedy = isComedyProject(project);
  const isAnthology = isAnthologyProject(project);

  const polishHandler =
    onFixEntireManuscript ||
    onManuscriptPolish ||
    onPolish;

  const loadStats = async () => {
    if (!drafted.length) {
      setStats(null);
      return;
    }

    setLoadingStats(true);
    setStatsError('');

    try {
      let allText = '';
      let totalWords = 0;

      for (const chapter of drafted) {
        const content = await resolveChapterContent(chapter);
        const safeContent = content || '';

        allText += `${safeContent}\n\n`;
        totalWords += countWords(safeContent);
      }

      const comedyOpts = isComedy ? { isComedy: true } : {};
      const anthologyOpts = isAnthology
        ? { isAnthology: true, chapterCount: drafted.length }
        : {};

      const statsOpts = {
        ...comedyOpts,
        ...anthologyOpts,
      };

      const calculated = isNF
        ? calculateManuscriptStatsNonfiction(allText)
        : calculateManuscriptStats(allText, statsOpts);

      calculated.wordCount = totalWords;
      calculated.chapterCount = drafted.length;
      calculated.avgWordsPerChapter = drafted.length
        ? Math.round(totalWords / drafted.length)
        : 0;
      calculated.highFreqPhrases = detectHighFreqPhrases(allText, drafted.length);

      setStats(calculated);
    } catch (error) {
      console.error('[MANUSCRIPT-DASHBOARD] Stats failed:', error);
      setStatsError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafted.length, project?.id]);

  const handleRunPolish = async () => {
    if (isBusy) return;

    if (!project) {
      setLocalPolishError('Project is required before Fix Entire Manuscript can run.');
      return;
    }

    if (!drafted.length) {
      setLocalPolishError('No drafted body chapters were found to fix.');
      return;
    }

    const confirmed = window.confirm(
      'Run Fix Entire Manuscript now?\n\nThis will use the safety-gated polish engine. Unsafe chapter changes should be rejected before save.'
    );

    if (!confirmed) return;

    setLocalPolishRunning(true);
    setLocalPolishProgress('Fix Manuscript: starting…');
    setLocalPolishError('');
    setLocalPolishReport(null);

    const setSafeProgress = (value) => {
      setLocalPolishProgress(safeDisplayText(value, 'Fix Manuscript: working…'));
    };

    try {
      const payload = {
        project,
        chapters: drafted,
        onProgress: setSafeProgress,
        refreshAfterSave: loadStats,
      };

      let report = null;

      /*
       * The polish handler is always a ProjectStudio wrapper (handlePolishRouted)
       * that uses its own state for project/chapters. Extra args are safely ignored.
       */
      report = await polishHandler(payload);

      if (!report) {
        // Parent wrapper performed the work but returned nothing — keep UI stable.
        report = {
          summary: 'Fix Entire Manuscript completed. Refresh stats/export to review results.',
        };
      }

      if (report) {
        setLocalPolishReport(report);
      }

      await loadStats();
    } catch (error) {
      console.error('[MANUSCRIPT-DASHBOARD] Fix Entire Manuscript failed:', error);
      setLocalPolishError(error instanceof Error ? error.message : String(error));
    } finally {
      setLocalPolishProgress('');
      setLocalPolishRunning(false);
    }
  };

  const handleGenerateCritique = async () => {
    if (!project || isBusy || critiqueLoading) return;
    if (drafted.length < 3) return;

    setCritiqueLoading(true);
    setCritiqueProgress('Loading sample chapters…');

    try {
      const first = await resolveChapterContent(drafted[0]);
      const middleIndex = Math.floor(drafted.length / 2);
      const mid = await resolveChapterContent(drafted[middleIndex]);
      const last = await resolveChapterContent(drafted[drafted.length - 1]);

      const sample = [
        `CHAPTER 1 (Opening):\n${String(first || '').substring(0, 2000)}`,
        `\n\nCHAPTER ${middleIndex + 1} (Midpoint):\n${String(mid || '').substring(0, 2000)}`,
        `\n\nCHAPTER ${drafted.length} (Ending):\n${String(last || '').substring(0, 2000)}`,
      ].join('\n');

      const prompt = `You are a senior book editor at the New York Times Book Review. Write a pre-publication editorial assessment.

MANUSCRIPT INFO:
- Title: ${project.title || 'Untitled'}
- Genre: ${project.genre || 'Fiction'}
- Word Count: ~${(stats?.wordCount || drafted.length * 4000).toLocaleString()}
- Chapters: ${drafted.length}

${sample}

Write a 400-500 word editorial assessment covering:
1. PROSE QUALITY: Voice, sentence construction, readability. Is the writing distinctive?
2. MARKETABILITY: What shelf? Target reader? Comparable titles? Commercial audience?
3. STRENGTHS: What works? What keeps pages turning?
4. WEAKNESSES: What would you flag in an editorial letter?
5. VERDICT: One-sentence recommendation — acquire, pass, or revise-and-resubmit.

Be direct, knowledgeable, commercially aware. Not falsely encouraging. Not cruel. Useful.

After your written assessment, on the very last line, provide a star rating in this exact format:
RATING: [number]/5

The rating must be in half-star increments: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, or 5.

Return only the assessment and rating.`;

      setCritiqueProgress('Generating editorial assessment…');

      const response = await invokeLLMWithRetry({
        prompt,
        model: 'gemini_3_flash',
        fallback_model: 'deepseek/deepseek-v3.2-20251201',
      });

      setCritiqueProgress('Processing results…');

      let critiqueText =
        typeof response === 'string'
          ? response
          : response?.text || response?.content || String(response || '');

      let starRating = null;
      const ratingMatch = critiqueText.match(/RATING:\s*([\d.]+)\s*\/\s*5/i);

      if (ratingMatch) {
        starRating = parseFloat(ratingMatch[1]);
        starRating = Math.round(Math.min(5, Math.max(0, starRating)) * 2) / 2;
        critiqueText = critiqueText.replace(/RATING:\s*[\d.]+\s*\/\s*5/i, '').trim();
      }

      setCritique(critiqueText);
      setCritiqueRating(starRating);

      if (project?.id) {
        const verdictMatch = critiqueText.match(/(?:VERDICT|Verdict|Recommendation)[:\s]+([^\n]+)/i);
        const verdict = verdictMatch ? verdictMatch[1].trim().substring(0, 200) : null;

        const updateFields = {};

        if (starRating !== null) updateFields.critique_rating = starRating;
        if (verdict) updateFields.critique_verdict = verdict;

        if (Object.keys(updateFields).length) {
          runWithNetworkRetry(() =>
            base44.entities.NovelProject.update(project.id, updateFields)
          ).catch(() => {});
        }
      }
    } catch (error) {
      console.error('[CRITIQUE] Failed:', error);
    } finally {
      setCritiqueProgress('');
      setCritiqueLoading(false);
    }
  };

  const handleExportReviewPDF = () => {
    if (!project || !stats) return;

    const title = project.title || 'Untitled';
    const author = project.author_name || 'Unknown Author';
    const genre = project.genre || 'Fiction';
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const cleanScore = stats.cleanScore || 0;
    const polishSummary = extractPolishSummary(polishResults, localPolishReport);

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page{margin:1in;size:letter}
      body{font-family:Georgia,'Times New Roman',serif;color:#333;line-height:1.6}
      .header{text-align:center;border-bottom:2px solid #8B4513;padding-bottom:20px;margin-bottom:30px}
      .report-type{font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#8B4513;margin-bottom:5px}
      .book-title{font-size:28px;font-weight:bold;margin:10px 0 5px;color:#1a1a1a}
      .book-author{font-size:16px;font-style:italic;color:#555}
      .report-date{font-size:12px;color:#888;margin-top:10px}
      h2{font-size:18px;color:#8B4513;border-bottom:1px solid #ddd;padding-bottom:5px;margin-top:30px}
      .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:15px 0}
      .stat-box{text-align:center;padding:12px 8px;background:#f9f6f1;border:1px solid #e0d5c5;border-radius:6px}
      .stat-value{font-size:24px;font-weight:bold;color:#1a1a1a}
      .stat-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-top:4px}
      .score{text-align:center;margin:20px 0;padding:20px;background:#f9f6f1;border:2px solid #e0d5c5;border-radius:10px}
      .score-number{font-size:48px;font-weight:bold}
      .fresh{color:#4CAF50}.mixed{color:#DAA520}.rotten{color:#c0392b}
      .summary{white-space:pre-wrap;font-size:13px;background:#faf8f5;border-left:3px solid #8B4513;padding:12px;margin:12px 0}
      .critique{font-size:14px;line-height:1.8;text-align:justify;margin:15px 0;padding:15px;background:#faf8f5;border-left:3px solid #8B4513}
      .stars{text-align:center;font-size:28px;letter-spacing:4px;margin:10px 0;color:#DAA520}
      .footer{margin-top:40px;padding-top:15px;border-top:1px solid #ddd;font-size:11px;color:#aaa;text-align:center}
    </style></head><body>`;

    html += `<div class="header">
      <div class="report-type">Manuscript Quality Report</div>
      <div class="book-title">${escapeHtml(title)}</div>
      <div class="book-author">by ${escapeHtml(author)}</div>
      <div class="report-date">${today} • ${escapeHtml(genre)}</div>
    </div>`;

    html += `<h2>Manuscript Overview</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${(stats.wordCount || 0).toLocaleString()}</div><div class="stat-label">Words</div></div>
      <div class="stat-box"><div class="stat-value">${stats.chapterCount || 0}</div><div class="stat-label">Chapters</div></div>
      <div class="stat-box"><div class="stat-value">${(stats.avgWordsPerChapter || 0).toLocaleString()}</div><div class="stat-label">Avg / Chapter</div></div>
      <div class="stat-box"><div class="stat-value">${stats.estimatedPages || Math.ceil((stats.wordCount || 0) / 250)}</div><div class="stat-label">Est. Pages</div></div>
    </div>`;

    html += `<h2>Publication Readiness</h2>
    <div class="score">
      <div class="score-number ${cleanScore >= 85 ? 'fresh' : cleanScore >= 70 ? 'mixed' : 'rotten'}">${cleanScore}%</div>
      <div>${cleanScore >= 90 ? 'Certified Fresh' : cleanScore >= 85 ? 'Fresh' : cleanScore >= 70 ? 'Mixed' : 'Rotten'}</div>
    </div>`;

    html += `<h2>Technical Flags</h2>
    <div class="stats-grid">
      <div class="stat-box"><div class="stat-value">${stats.bannedWords || 0}</div><div class="stat-label">Banned Words</div></div>
      <div class="stat-box"><div class="stat-value">${stats.voiceWas || 0}</div><div class="stat-label">Voice Patterns</div></div>
      <div class="stat-box"><div class="stat-value">${stats.capErrors || 0}</div><div class="stat-label">Cap Errors</div></div>
      <div class="stat-box"><div class="stat-value">${stats.scaffolds || 0}</div><div class="stat-label">Scaffold Leaks</div></div>
    </div>`;

    if (polishSummary) {
      html += `<h2>Polish Summary</h2><div class="summary">${escapeHtml(polishSummary)}</div>`;
    }

    if (critique) {
      html += `<h2>Editorial Assessment</h2>`;

      if (critiqueRating !== null) {
        html += `<div class="stars">${'★'.repeat(Math.round(critiqueRating))}${'☆'.repeat(Math.max(0, 5 - Math.round(critiqueRating)))}</div>
        <div style="text-align:center;font-weight:bold;color:#555">${critiqueRating} / 5</div>`;
      }

      html += `<div class="critique">${critique
        .split('\n')
        .filter((paragraph) => paragraph.trim())
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join('')}</div>`;
    }

    html += `<div class="footer">Generated by Unity Book Studio • ${today}</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      };
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, '-') || 'manuscript'}-quality-report.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
  };

  const cleanScore = stats?.cleanScore || 0;
  const readinessLabel =
    cleanScore >= 90
      ? 'Certified Fresh'
      : cleanScore >= 85
        ? 'Fresh'
        : cleanScore >= 70
          ? 'Mixed'
          : 'Rotten';

  const readinessIcon =
    cleanScore >= 85
      ? '🍅'
      : cleanScore >= 70
        ? '🟡'
        : '🤢';

  const readinessExplanation =
    cleanScore >= 90
      ? 'Publication-ready. Ship it.'
      : cleanScore >= 85
        ? 'Near publication-ready. Minor polish may help.'
        : cleanScore >= 70
          ? 'Needs a polish pass.'
          : 'Significant cleanup needed. Run Fix Entire Manuscript.';

  const polishSummary = extractPolishSummary(polishResults, localPolishReport);

  if (!drafted.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        No drafted chapters to review. Draft chapters first in the Chapters tab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            isNF
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : isAnthology
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          {isNF ? '📚 Nonfiction Mode' : isAnthology ? '🧩 Anthology Mode' : '📖 Fiction Mode'}
        </span>

        <p className="text-xs text-muted-foreground">
          Polish is routed through the safety-gated manuscript fixer.
        </p>
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Manuscript Health</h2>

          <Button
            variant="ghost"
            size="sm"
            onClick={loadStats}
            disabled={loadingStats || isBusy}
            className="h-7 rounded-full px-3 text-[10px]"
          >
            {loadingStats ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>

        {statsError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {statsError}
          </div>
        ) : null}

        {loadingStats && !stats ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing manuscript…</span>
          </div>
        ) : stats ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard value={(stats.wordCount || 0).toLocaleString()} label="Words" />
              <StatCard value={stats.chapterCount || 0} label="Chapters" />
              <StatCard
                value={(stats.avgWordsPerChapter || 0).toLocaleString()}
                label="Avg / Chapter"
              />
              <StatCard
                value={stats.estimatedPages || Math.ceil((stats.wordCount || 0) / 250)}
                label="Est. Pages"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard value={<SafeValue value={stats.cleanScore} />} label="Clean Score" />
              <StatCard value={<SafeValue value={stats.bannedWords} />} label="Banned Words" />
              <StatCard value={<SafeValue value={stats.voiceWas} />} label="Voice Patterns" />
              <StatCard value={<SafeValue value={stats?.hangingQuotes ?? 0} />} label="Open Quotes" />
              <StatCard
                value={<SafeValue value={stats?.burstiness} />}
                label={`Rhythm (${stats?.burstinessRating || '—'})`}
              />
              <StatCard value={<SafeValue value={stats?.avgSentenceLength} />} label="Avg Sent. Len" />
              <StatCard value={<SafeValue value={stats?.predictablePhrases} />} label="Predictable" />
              <StatCard
                value={stats?.aiFavoritePer10k != null ? `${stats.aiFavoritePer10k}/10K` : '—'}
                label="AI Vocab"
              />
            </div>

            {stats.highFreqPhrases?.length > 0 ? (
              <div className="mt-4 rounded-xl border border-yellow-300/40 bg-yellow-50/50 p-3 dark:bg-yellow-950/20">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                  High-Frequency Phrases
                </p>

                <div className="space-y-1">
                  {stats.highFreqPhrases.map(([phrase, count], index) => (
                    <p key={`${phrase}-${index}`} className="text-xs text-yellow-800 dark:text-yellow-300">
                      “{phrase}” — {count} times
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {stats ? (
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 text-center backdrop-blur-sm">
          <h2 className="mb-4 font-display text-xl text-foreground">Publication Readiness</h2>

          <div className="flex flex-col items-center gap-1">
            <span className="text-5xl">{readinessIcon}</span>
            <span className="text-4xl font-bold text-foreground">{cleanScore}%</span>

            <Badge
              variant={
                cleanScore >= 85
                  ? 'default'
                  : cleanScore >= 70
                    ? 'secondary'
                    : 'destructive'
              }
              className="mt-1"
            >
              {readinessLabel}
            </Badge>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{readinessExplanation}</p>
        </div>
      ) : null}

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 backdrop-blur-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-display text-xl text-foreground">Fix Entire Manuscript</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Runs the ProjectStudio safety-gated polish engine. The old anti-slop rules still run,
              but destructive changes are rejected before saving.
            </p>
          </div>
        </div>

        {busyLabel || localPolishRunning || localPolishProgress ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {safeDisplayText(busyLabel || localPolishProgress, 'Fix Entire Manuscript is running…')}
            </span>
          </div>
        ) : null}

        {localPolishError ? (
          <div className="mb-4 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{localPolishError}</div>
          </div>
        ) : null}

        {polishSummary ? (
          <div className="mb-4 rounded-xl border border-green-500/30 bg-green-50/50 p-4 dark:bg-green-950/20">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              Last polish report
            </div>

            <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs text-green-900 dark:text-green-200">
              {polishSummary}
            </pre>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleRunPolish}
            disabled={isBusy || !polishHandler}
            className="rounded-full gap-2"
          >
            <Wrench className="h-4 w-4" />
            Fix Entire Manuscript
          </Button>

          {onStop && (busyLabel || localPolishRunning) ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onStop}
              className="rounded-full"
            >
              Stop
            </Button>
          ) : null}
        </div>

        {!polishHandler ? (
          <p className="mt-3 text-xs text-destructive">
            No polish handler was passed into ManuscriptDashboard. Check ProjectStudio.jsx props.
          </p>
        ) : null}
      </div>

      <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 backdrop-blur-sm">
        <h2 className="mb-3 font-display text-xl text-foreground">Editorial Assessment</h2>

        {!critique ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              Generate a high-level editorial critique assessing marketability, audience reception,
              prose quality, and commercial potential.
            </p>

            <Button
              onClick={handleGenerateCritique}
              disabled={isBusy || critiqueLoading || drafted.length < 3}
              className="rounded-full gap-2"
            >
              {critiqueLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {critiqueProgress || 'Generating…'}
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  Generate Editorial Critique
                </>
              )}
            </Button>

            {drafted.length < 3 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Need at least 3 chapters for a critique.
              </p>
            ) : null}
          </>
        ) : (
          <>
            {critiqueRating !== null ? (
              <div className="my-4 text-center">
                <div className="text-[32px] leading-none tracking-wider">
                  {[1, 2, 3, 4, 5].map((star) => {
                    if (critiqueRating >= star) {
                      return (
                        <span key={star} style={{ color: '#DAA520' }}>
                          ★
                        </span>
                      );
                    }

                    if (critiqueRating >= star - 0.5) {
                      return (
                        <span key={star} style={{ position: 'relative', display: 'inline-block' }}>
                          <span style={{ color: '#ccc' }}>★</span>
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              width: '50%',
                              overflow: 'hidden',
                              color: '#DAA520',
                            }}
                          >
                            ★
                          </span>
                        </span>
                      );
                    }

                    return (
                      <span key={star} style={{ color: '#ccc' }}>
                        ★
                      </span>
                    );
                  })}
                </div>

                <div className="mt-1 text-lg font-semibold text-muted-foreground">
                  {critiqueRating} / 5
                </div>
              </div>
            ) : null}

            <div className="prose prose-sm prose-slate max-w-none font-serif leading-7 dark:prose-invert">
              <ReactMarkdown>{critique}</ReactMarkdown>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCritique(null);
                setCritiqueRating(null);
              }}
              className="mt-4 rounded-full text-xs"
            >
              Regenerate
            </Button>
          </>
        )}
      </div>

      {stats ? (
        <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 text-center backdrop-blur-sm">
          <Button
            onClick={handleExportReviewPDF}
            disabled={isBusy}
            variant="outline"
            className="rounded-full gap-2"
          >
            <Download className="h-4 w-4" />
            Export Quality Report
          </Button>

          <p className="mt-2 text-[10px] text-muted-foreground">
            Opens a print dialog. Select “Save as PDF” for a professional report.
          </p>
        </div>
      ) : null}
    </div>
  );
}