import React, { useMemo } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Image,
  Layers3,
  Loader2,
  PenLine,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDraftedCount } from '@/lib/autonovel';
import { chapterHasContent } from '@/lib/chapterStorage';
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

function countChapterWords(chapters = []) {
  return safeArray(chapters).reduce((sum, chapter) => {
    return sum + Number(chapter?.word_count || 0);
  }, 0);
}

function getBodyChapters(chapters = []) {
  return safeArray(chapters).filter((chapter) => isBodyChapter(chapter));
}

function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, value || 0)) * 100)}%`;
}

function MiniStat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
      </div>

      <p className="mt-1 text-lg font-semibold leading-none text-foreground">{value}</p>

      {sub ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function CompactProgress({ label, value = 0, detail, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-3 py-2.5 shadow-sm">
      <div className="mb-1.5 flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <span className="ml-auto text-[11px] font-semibold text-foreground">{percent(value)}</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: percent(value) }}
        />
      </div>

      {detail ? <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function PipelineStep({ label, complete, warning }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs',
        complete
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : warning
            ? 'border-amber-200 bg-amber-50 text-amber-900'
            : 'border-border/60 bg-card/70 text-muted-foreground'
      )}
    >
      {complete ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      ) : warning ? (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <span className="h-3 w-3 shrink-0 rounded-full border border-border bg-background" />
      )}

      <span className="font-semibold">{label}</span>
    </div>
  );
}

export default function StudioOverview({
  project,
  chapters,
  busyLabel,
  onGenerateFoundation,
  onGenerateCover,
  onEvaluate,
}) {
  const safeChapters = useMemo(() => safeArray(chapters), [chapters]);
  const bodyChapters = useMemo(() => getBodyChapters(safeChapters), [safeChapters]);

  const drafted = getDraftedCount(safeChapters);
  const draftedBody = bodyChapters.filter((chapter) => chapterHasContent(chapter)).length;
  const totalBody = bodyChapters.length || Number(project?.chapter_target || 0) || safeChapters.length || 0;

  // WAVE4-OFFLOADREAD: total_word_target is the real schema field — the old
  // read used a name that never existed on the entity, so the Word Target
  // meter sat at 0% forever. total_word_count is the Wave-2 rollup.
  const wordCount = Number(project?.total_word_count || 0) || countChapterWords(safeChapters);
  const targetWords = Number(project?.total_word_target || 0);
  const targetChapters = Number(project?.chapter_target || totalBody || 0);

  const draftProgress = targetChapters > 0 ? drafted / targetChapters : 0;
  const wordProgress = targetWords > 0 ? wordCount / targetWords : 0;

  const foundationFields = [
    'world_md',
    'characters_md',
    'outline_md',
    'canon_md',
    'voice_md',
    'seed_concept',
  ];

  // WAVE4-OFFLOADREAD: a field offloaded to *_url has its inline copy blanked —
  // count it as done when either form is present, so a full 40KB story bible
  // stops reading "0 of 6 documents populated".
  const foundationDone = foundationFields.filter(
    (field) => safeText(project?.[field]).length > 50 || safeText(project?.[`${field}_url`]).length > 0
  ).length;
  const foundationTotal = foundationFields.length;
  const foundationProgress = foundationTotal > 0 ? foundationDone / foundationTotal : 0;

  const hasSetupBasics = Boolean(
    safeText(project?.title) &&
      safeText(project?.genre) &&
      safeText(project?.author_name || project?.author_voice)
  );

  const hasOutline = Boolean(safeText(project?.outline_md).length > 100 || safeChapters.length > 0);
  const hasDrafts = drafted > 0;
  const polishStarted = Boolean(project?.critique_rating || project?.critique_verdict);
  const exportReady = drafted > 0 && drafted >= Math.max(1, targetChapters || drafted);

  const genreLine = [project?.genre, project?.subgenre].filter(Boolean).join(' / ') || 'No genre selected';
  const authorLine = project?.author_name || project?.author_voice || 'No author/voice set';

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Project Control Center
            </p>

            <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-foreground">
              {project?.title || 'Untitled Project'}
            </h2>

            {project?.tagline || project?.seed_concept ? (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {project?.tagline || project?.seed_concept}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Add a seed concept or tagline so this project has a clear creative target.
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {genreLine}
              </span>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {authorLine}
              </span>
            </div>
          </div>
        </div>
      </section>

      {busyLabel && (
        <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {busyLabel}
        </div>
      )}

      <section className="grid gap-2 sm:grid-cols-2">
        <MiniStat
          icon={PenLine}
          label="Words"
          value={wordCount.toLocaleString()}
          sub={targetWords ? `${Math.max(0, targetWords - wordCount).toLocaleString()} remaining` : 'No target set'}
        />

        <MiniStat
          icon={Layers3}
          label="Drafted"
          value={`${drafted} / ${targetChapters || safeChapters.length || '—'}`}
          sub={drafted < targetChapters ? `Next: chapter ${drafted + 1}` : 'Draft target reached'}
        />

        <MiniStat
          icon={FileText}
          label="Est. Pages"
          value={Math.max(1, Math.ceil(wordCount / 250)).toLocaleString()}
          sub="Rough paperback estimate"
        />

        <MiniStat
          icon={Target}
          label="Avg / Chapter"
          value={safeChapters.length ? Math.round(wordCount / safeChapters.length).toLocaleString() : '—'}
          sub="Across loaded sections"
        />
      </section>

      <section className="space-y-2">
        <CompactProgress
          icon={Wand2}
          label="Draft Progress"
          value={draftProgress}
          detail={`${drafted.toLocaleString()} drafted out of ${targetChapters || safeChapters.length || 0} planned sections.`}
        />

        <CompactProgress
          icon={Sparkles}
          label="Foundation"
          value={foundationProgress}
          detail={`${foundationDone} of ${foundationTotal} core foundation documents populated.`}
        />

        <CompactProgress
          icon={Target}
          label="Word Target"
          value={targetWords ? wordProgress : 0}
          detail={targetWords ? `${wordCount.toLocaleString()} of ${targetWords.toLocaleString()} target words.` : 'Set a target word count in Setup.'}
        />
      </section>

      <section className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm">
        <div className="mb-2">
          <p className="text-sm font-semibold text-foreground">Writing Pipeline</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Quick status check for this book.
          </p>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <PipelineStep label="Setup" complete={hasSetupBasics} warning={!hasSetupBasics} />
          <PipelineStep label="Foundation" complete={foundationDone >= 4} warning={foundationDone < 3} />
          <PipelineStep label="Outline" complete={hasOutline} warning={!hasOutline} />
          <PipelineStep label="Draft" complete={hasDrafts} warning={!hasDrafts} />
          <PipelineStep label="Polish" complete={polishStarted} />
          <PipelineStep label="Export Ready" complete={exportReady} />
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-background/80 p-3 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-foreground">Primary Actions</p>

        <div className="grid gap-2">
          <Button
            onClick={onGenerateFoundation}
            className="min-h-9 w-full rounded-full text-xs font-semibold"
            disabled={Boolean(busyLabel)}
          >
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Generate / Refresh Foundation
          </Button>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              onClick={onEvaluate}
              variant="outline"
              className="min-h-9 rounded-full text-xs font-semibold"
              disabled={Boolean(busyLabel)}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              Evaluate
            </Button>

            <Button
              onClick={onGenerateCover}
              variant="outline"
              className="min-h-9 rounded-full text-xs font-semibold"
              disabled={Boolean(busyLabel)}
            >
              <Image className="mr-2 h-3.5 w-3.5" />
              Cover Art
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}