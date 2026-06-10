import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  Image,
  Layers3,
  Loader2,
  SearchCheck,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  calculateManuscriptStats,
  calculateManuscriptStatsNonfiction,
  isNonfictionProject,
  isComedyProject,
  detectHighFreqPhrases,
} from '@/lib/manuscriptStats';
import { resolveChapterContent, chapterHasContent } from '@/lib/chapterStorage';
import { isBodyChapter } from '@/lib/bibliographyGenerator';

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function safeText(value = '') {
  return String(value || '').trim();
}

function basicWordCount(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function MiniStat({ icon: Icon, value, label, tone = 'default' }) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-border/60 bg-background/80 text-foreground';

  return (
    <div className={`rounded-2xl border px-3 py-2.5 text-center shadow-sm ${toneClass}`}>
      <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-white/60 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </div>

      <p className="text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function MetricCard({ value, label, tone = 'default' }) {
  const color =
    tone === 'good'
      ? 'text-emerald-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'danger'
          ? 'text-red-700'
          : 'text-foreground';

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 px-2 py-2 text-center shadow-sm">
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, primary = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition',
        primary
          ? 'border-primary/40 bg-primary text-primary-foreground shadow-sm hover:opacity-90'
          : 'border-border/60 bg-background/80 text-foreground hover:bg-muted'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
          primary ? 'bg-white/20 text-primary-foreground' : 'bg-primary/10 text-primary'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p className="min-w-0 truncate text-xs font-semibold">{label}</p>
    </button>
  );
}

function WarningItem({ children, critical = false }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] leading-4',
        critical
          ? 'border-red-200 bg-red-50 text-red-900'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function ReadinessStep({ label, complete }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/80 px-2.5 py-2">
      {complete ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <span className="h-3.5 w-3.5 rounded-full border border-border bg-card" />
      )}

      <span
        className={cn(
          'text-[11px] font-semibold',
          complete ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </div>
  );
}

function scoreTone(score) {
  if (score >= 90) return 'good';
  if (score >= 75) return 'warn';
  return 'danger';
}

export default function HomeDashboard({ project, chapters, onNavigateTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const safeChapters = useMemo(() => safeArray(chapters), [chapters]);

  const bodyChapters = useMemo(() => {
    return safeChapters.filter((chapter) => chapterHasContent(chapter) && isBodyChapter(chapter));
  }, [safeChapters]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!project || !safeChapters.length) {
        setStats(null);
        return;
      }

      const draftedBodyChapters = safeChapters.filter(
        (chapter) => chapterHasContent(chapter) && isBodyChapter(chapter)
      );

      if (!draftedBodyChapters.length) {
        setStats(null);
        return;
      }

      setLoading(true);

      let fullText = '';

      try {
        for (const chapter of draftedBodyChapters) {
          const content = await resolveChapterContent(chapter);
          if (content) fullText += `${content}\n\n`;
        }

        if (cancelled) return;

        if (fullText.length < 500) {
          setStats(null);
          setLoading(false);
          return;
        }

        const isNF = isNonfictionProject(project);
        const comedyOpts = isComedyProject(project) ? { isComedy: true } : undefined;
        const calculated = isNF
          ? calculateManuscriptStatsNonfiction(fullText)
          : calculateManuscriptStats(fullText, comedyOpts);

        const wordCount = basicWordCount(fullText);
        calculated.wordCount = wordCount;
        calculated.chapterCount = draftedBodyChapters.length;
        calculated.avgWordsPerChapter = draftedBodyChapters.length
          ? Math.round(wordCount / draftedBodyChapters.length)
          : 0;
        calculated.estimatedPages = Math.ceil(wordCount / 250) + draftedBodyChapters.length;
        calculated.highFreqPhrases = detectHighFreqPhrases(fullText, Math.max(draftedBodyChapters.length, 1));

        if (!cancelled) {
          setStats(calculated);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[HOME DASHBOARD] Failed to load manuscript stats:', err);

        if (!cancelled) {
          setStats(null);
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [project?.id, safeChapters]);

  const warnings = useMemo(() => {
    const list = [];

    if (!safeText(project?.title)) list.push({ text: 'Project title is missing.', critical: true });
    if (!safeText(project?.author_name)) list.push({ text: 'Author name / pen name is missing.' });
    if (!safeText(project?.genre)) list.push({ text: 'Genre has not been selected.' });
    if (!safeText(project?.subgenre)) list.push({ text: 'Subgenre is missing.' });
    if (!safeText(project?.target_audience)) list.push({ text: 'Target audience is not defined.' });
    if (!safeText(project?.author_voice) && !safeText(project?.voice_md)) list.push({ text: 'Author voice/style guidance is thin.' });
    if (!safeText(project?.outline_md) && !safeChapters.length) list.push({ text: 'No outline or chapter plan is available.', critical: true });
    if (!bodyChapters.length) list.push({ text: 'No drafted body chapters detected yet.', critical: true });

    return list;
  }, [project, safeChapters.length, bodyChapters.length]);

  const cleanScore = stats?.cleanScore ?? null;
  const rtLabel =
    cleanScore >= 90
      ? 'Certified Fresh'
      : cleanScore >= 85
        ? 'Fresh'
        : cleanScore >= 70
          ? 'Mixed'
          : cleanScore !== null
            ? 'Needs Work'
            : 'No Score';

  const rtIcon = cleanScore >= 85 ? '🍅' : cleanScore >= 70 ? '🟡' : cleanScore !== null ? '🛠️' : '—';

  const critiqueRating = project?.critique_rating || null;
  const critiqueVerdict = project?.critique_verdict || null;

  const setupComplete = Boolean(
    safeText(project?.title) &&
      safeText(project?.genre) &&
      safeText(project?.author_name)
  );
  const foundationComplete = Boolean(
    safeText(project?.seed_concept).length > 40 &&
      (safeText(project?.outline_md).length > 100 || safeChapters.length > 0)
  );
  const draftStarted = bodyChapters.length > 0;
  const polishStarted = Boolean(critiqueRating || critiqueVerdict || cleanScore);
  const exportReady = Boolean(stats?.wordCount && bodyChapters.length > 0 && warnings.filter((w) => w.critical).length === 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Analyzing manuscript…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Project Intelligence
            </p>
            <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              Where you left off
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Live manuscript status, warnings, quick actions, and readiness tracking.
            </p>
          </div>
        </div>
      </section>

      {!stats ? (
        <section className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>

          <p className="mt-3 text-sm font-semibold text-foreground">No drafted manuscript stats yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Generate a foundation and draft chapters to unlock manuscript quality stats here.
          </p>

          <Button
            onClick={() => onNavigateTab?.('outline')}
            className="mt-4 rounded-full text-xs font-semibold"
          >
            <Wand2 className="mr-2 h-3.5 w-3.5" />
            Go Draft Chapters
          </Button>
        </section>
      ) : (
        <>
          <section className="grid gap-2 sm:grid-cols-2">
            <MiniStat icon={BookOpen} value={stats.wordCount?.toLocaleString() || '—'} label="Words" />
            <MiniStat icon={Layers3} value={stats.chapterCount || '—'} label="Chapters" />
            <MiniStat icon={FileText} value={stats.estimatedPages || '—'} label="Est. Pages" />
            <MiniStat icon={Target} value={stats.avgWordsPerChapter?.toLocaleString() || '—'} label="Avg / Chapter" />
          </section>

          <section className="rounded-2xl border border-border/70 bg-background/80 p-4 text-center shadow-sm">
            <span className="text-2xl">{rtIcon}</span>

            <div
              className={cn(
                'mt-1 text-3xl font-semibold',
                scoreTone(cleanScore || 0) === 'good'
                  ? 'text-emerald-600'
                  : scoreTone(cleanScore || 0) === 'warn'
                    ? 'text-amber-600'
                    : 'text-red-600'
              )}
            >
              {cleanScore !== null ? `${cleanScore}%` : '—'}
            </div>

            <Badge
              variant={cleanScore >= 85 ? 'default' : cleanScore >= 70 ? 'secondary' : 'destructive'}
              className="mt-1 text-[10px]"
            >
              {rtLabel}
            </Badge>

            <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">
              {cleanScore >= 90
                ? 'Publication-ready shape. Still proofread before final upload.'
                : cleanScore >= 85
                  ? 'Strong draft. Minor polish may help.'
                  : cleanScore >= 70
                    ? 'Usable, but needs a cleanup pass.'
                    : 'Significant cleanup still recommended.'}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <MetricCard
              value={stats.bannedWords ?? '—'}
              label="Banned"
              tone={stats.bannedWords > 0 ? 'danger' : 'good'}
            />
            <MetricCard
              value={stats.voiceWas ?? '—'}
              label="Voice"
              tone={stats.voiceWas > 20 ? 'warn' : 'good'}
            />
            <MetricCard
              value={stats.capErrors ?? '—'}
              label="Cap Err"
              tone={stats.capErrors > 0 ? 'warn' : 'good'}
            />
            <MetricCard
              value={stats.scaffolds ?? '—'}
              label="Scaffolds"
              tone={stats.scaffolds > 0 ? 'danger' : 'good'}
            />
            <MetricCard
              value={stats?.burstiness ?? '—'}
              label={`Rhythm ${stats?.burstinessRating ? `(${stats.burstinessRating})` : ''}`}
              tone={stats?.burstiness > 8 ? 'good' : stats?.burstiness > 6 ? 'warn' : 'danger'}
            />
            <MetricCard value={stats?.avgSentenceLength ?? '—'} label="Avg Sent." />
            <MetricCard
              value={stats?.predictablePhrases ?? '—'}
              label="Predictable"
              tone={(stats?.predictablePhrases || 0) > 10 ? 'warn' : 'good'}
            />
            <MetricCard
              value={stats?.aiFavoritePer10k != null ? `${stats.aiFavoritePer10k}/10K` : '—'}
              label="AI Vocab"
              tone={(stats?.aiFavoritePer10k || 0) > 7 ? 'warn' : 'good'}
            />
          </section>

          {critiqueRating !== null ? (
            <section className="rounded-2xl border border-border/70 bg-background/80 p-4 text-center shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Editorial Rating
              </p>

              <div className="mt-2 text-2xl tracking-[0.16em] text-amber-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star}>{critiqueRating >= star ? '★' : '☆'}</span>
                ))}
              </div>

              <p className="mt-1 text-xs font-semibold text-foreground">{critiqueRating} / 5</p>

              {critiqueVerdict ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{critiqueVerdict}</p>
              ) : null}
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border/70 bg-background/80 p-3 text-center">
              <p className="text-sm font-semibold text-foreground">No editorial critique yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Run critique or polish tools to get a reviewer-style score.
              </p>
            </section>
          )}
        </>
      )}

      <section className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Readiness Tracker</p>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <ReadinessStep label="Setup complete" complete={setupComplete} />
          <ReadinessStep label="Foundation ready" complete={foundationComplete} />
          <ReadinessStep label="Draft started" complete={draftStarted} />
          <ReadinessStep label="Polish started" complete={polishStarted} />
          <ReadinessStep label="Export-ready draft" complete={exportReady} />
          <ReadinessStep label="Cover direction started" complete={Boolean(project?.cover_prompt || project?.cover_art_url)} />
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <p className="text-sm font-semibold text-foreground">Project Warnings</p>
          </div>

          <div className="space-y-1.5">
            {warnings.slice(0, 6).map((warning, index) => (
              <WarningItem key={`${warning.text}-${index}`} critical={warning.critical}>
                {warning.text}
              </WarningItem>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-sm font-semibold text-foreground">Quick Actions</p>
        </div>

        <div className="grid gap-2">
          <QuickAction
            icon={Wand2}
            label="Draft or edit chapters"
            onClick={() => onNavigateTab?.('outline')}
            primary
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <QuickAction
              icon={SearchCheck}
              label="Polish Manuscript"
              onClick={() => onNavigateTab?.('review')}
            />
            <QuickAction
              icon={Eye}
              label="Preview"
              onClick={() => onNavigateTab?.('preview')}
            />
            <QuickAction
              icon={Image}
              label="Cover Studio"
              onClick={() => onNavigateTab?.('cover')}
            />
            <QuickAction
              icon={FileText}
              label="Export"
              onClick={() => onNavigateTab?.('export')}
            />
          </div>
        </div>
      </section>
    </div>
  );
}