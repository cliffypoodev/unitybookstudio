import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Cpu,
  Gauge,
  GitBranch,
  History,
  Layers3,
  ListChecks,
  Loader2,
  Mountain,
  PenLine,
  RefreshCw,
  RotateCcw,
  Route,
  Sparkles,
  Square,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { chapterHasContent, chapterHasBackup } from '@/lib/chapterStorage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SaveIndicator from '@/components/notebook/SaveIndicator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SceneBeatsList from '@/components/novel/SceneBeatsList';
import { getWritingModelInfo } from '@/lib/writingModel';
import { normalizeModelId , FICTION_PROSE_MODELS } from '@/lib/modelRouting';
import {
  getArcDescription,
  getChapterPacing,
} from '@/lib/pacingModulation';

const OUTLINE_EDITOR_VERSION = 'OutlineEditor-arc-beat-dashboard-v3';

console.log('[OUTLINE-EDITOR] Loaded', OUTLINE_EDITOR_VERSION);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseSceneBeats(beatsJson) {
  if (!beatsJson) return [];

  try {
    const parsed = typeof beatsJson === 'string' ? JSON.parse(beatsJson) : beatsJson;

    if (Array.isArray(parsed)) return parsed;

    if (Array.isArray(parsed?.beats)) return parsed.beats;
    if (Array.isArray(parsed?.scene_beats)) return parsed.scene_beats;
    if (Array.isArray(parsed?.scenes)) return parsed.scenes;

    return [];
  } catch {
    return [];
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildBeatDiagnostics(beats) {
  if (!beats.length) {
    return {
      count: 0,
      avgTension: 0,
      minTension: 0,
      maxTension: 0,
      spread: 0,
      repeatedTension: false,
      hasConcreteChange: false,
      hasForwardConsequence: false,
      warnings: ['No scene beats are currently generated for this chapter.'],
    };
  }

  const tensions = beats
    .map((beat) => safeNumber(
      beat.tension_level ??
      beat.tension ??
      beat.intensity ??
      beat.pressure_level,
      NaN
    ))
    .filter((n) => Number.isFinite(n));

  const avgTension = tensions.length
    ? Math.round((tensions.reduce((sum, n) => sum + n, 0) / tensions.length) * 10) / 10
    : 0;

  const minTension = tensions.length ? Math.min(...tensions) : 0;
  const maxTension = tensions.length ? Math.max(...tensions) : 0;
  const spread = maxTension - minTension;

  const joined = JSON.stringify(beats).toLowerCase();

  const hasConcreteChange =
    /change|turn|decision|choice|reveal|discovers|learns|consequence|cost|commit|conflict|threat|evidence|clue|intimacy|betray|loss|plan|break/.test(joined);

  const hasForwardConsequence =
    /next|consequence|aftermath|forces|leaves|sets up|sets-up|carry|future|chapter|cannot go back|irreversible/.test(joined);

  const repeatedTension = tensions.length >= 3 && new Set(tensions).size <= 1;

  const warnings = [];

  if (repeatedTension) {
    warnings.push('All scene beats appear to share the same tension value. Regenerate beats if this chapter should have more internal movement.');
  }

  if (spread < 2 && tensions.length >= 4) {
    warnings.push('Scene-beat tension spread is narrow. The chapter may feel flat unless the prose creates variation through intimacy, discovery, strategy, or dread.');
  }

  if (!hasConcreteChange) {
    warnings.push('Scene beats do not clearly advertise a concrete change. Every chapter should alter knowledge, leverage, relationship, danger, plan, or moral position.');
  }

  if (!hasForwardConsequence) {
    warnings.push('Scene beats do not clearly define how the next chapter starts differently. Add consequence or forward pull.');
  }

  return {
    count: beats.length,
    avgTension,
    minTension,
    maxTension,
    spread,
    repeatedTension,
    hasConcreteChange,
    hasForwardConsequence,
    warnings,
  };
}

function getCurveIcon(direction) {
  const d = String(direction || '').toLowerCase();

  if (d.includes('spike') || d.includes('climb') || d.includes('rise')) return TrendingUp;
  if (d.includes('dip') || d.includes('drop') || d.includes('recovery') || d.includes('valley')) return TrendingDown;
  if (d.includes('peak') || d.includes('payoff')) return Mountain;
  return Activity;
}

function getCurveLabel(direction) {
  const value = String(direction || 'balanced').replace(/[_-]+/g, ' ');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTensionTone(tension) {
  if (tension >= 8) return 'text-red-600 dark:text-red-400';
  if (tension >= 6) return 'text-orange-600 dark:text-orange-400';
  if (tension >= 4) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function MiniMetric({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
      {detail && <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{detail}</div>}
    </div>
  );
}

function CraftBriefCard({ pacing }) {
  const style = pacing?.styleBrief;

  if (!style) return null;

  const lines = [
    style.identity,
    style.pacing,
    style.sceneLogic,
    style.proseTexture,
    style.dialogue,
    style.warning,
  ].filter(Boolean);

  if (!lines.length) return null;

  return (
    <div className="rounded-[1.25rem] border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Beat Style Craft Brief
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {lines.slice(0, 6).map((line, idx) => (
          <div key={idx} className="rounded-xl border border-border/50 bg-background/70 px-3 py-2 text-xs leading-5 text-foreground">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function ArcBeatDashboard({ project, chapter, chapters, beats }) {
  const totalChapters =
    safeNumber(project?.chapter_target, 0) ||
    safeNumber(project?.estimated_chapters, 0) ||
    (chapters || []).length ||
    20;

  const chapterNumber = safeNumber(chapter?.chapter_number || chapter?.number, 1) || 1;

  const pacing = useMemo(() => {
    try {
      return getChapterPacing(
        chapterNumber,
        totalChapters,
        project?.story_arc || 'three_act',
        project?.beat_style || project?.scene_beat_style || ''
      );
    } catch (error) {
      console.warn('[OUTLINE-EDITOR] pacing dashboard failed:', error);
      return null;
    }
  }, [chapterNumber, totalChapters, project?.story_arc, project?.beat_style, project?.scene_beat_style]);

  const diagnostics = useMemo(() => buildBeatDiagnostics(beats), [beats]);

  if (!pacing) return null;

  const CurveIcon = getCurveIcon(pacing.curveDirection);
  const arcDescription = getArcDescription(project?.story_arc || 'three_act');

  const tensionTone = getTensionTone(pacing.tension);
  const nextTone = getTensionTone(pacing.nextTension);
  const previousTone = getTensionTone(pacing.previousTension);

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Arc & Beat Dashboard
              </span>
            </div>
            <h3 className="mt-1 font-display text-xl leading-tight text-foreground">
              {pacing.arcName}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {arcDescription}
            </p>
          </div>

          <div className="rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
            Chapter {chapterNumber} of {totalChapters} · {pacing.position}% through
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MiniMetric
            icon={Gauge}
            label="Tension"
            value={<span className={tensionTone}>{pacing.tension}/10</span>}
            detail={`Previous ${pacing.previousTension}/10 → next ${pacing.nextTension}/10`}
          />

          <MiniMetric
            icon={CurveIcon}
            label="Curve"
            value={getCurveLabel(pacing.curveDirection)}
            detail={pacing.chapterRole}
          />

          <MiniMetric
            icon={Activity}
            label="Pace"
            value={String(pacing.pace || 'measured').toUpperCase()}
            detail={`Interiority: ${String(pacing.interiority || 'balanced').toUpperCase()}`}
          />

          <MiniMetric
            icon={GitBranch}
            label="Scene Shape"
            value={pacing.sceneShape || 'Arc-aware scene'}
            detail={pacing.breathingRoom ? `Breath: ${pacing.breathingRoom}` : 'No extended breathing room required'}
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Chapter-to-Chapter Energy Map
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border/50 bg-card/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Previous</div>
              <div className={`mt-1 text-lg font-bold ${previousTone}`}>{pacing.previousTension}</div>
            </div>
            <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">This Chapter</div>
              <div className={`mt-1 text-lg font-bold ${tensionTone}`}>{pacing.tension}</div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/70 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next</div>
              <div className={`mt-1 text-lg font-bold ${nextTone}`}>{pacing.nextTension}</div>
            </div>
          </div>
        </div>

        {Array.isArray(pacing.sceneBeatLadder) && pacing.sceneBeatLadder.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Recommended Internal Beat Ladder
              </span>
            </div>

            <div className="grid gap-2">
              {pacing.sceneBeatLadder.map((line, idx) => (
                <div key={idx} className="flex gap-2 rounded-xl bg-card/70 px-3 py-2 text-xs leading-5 text-foreground">
                  <span className="font-mono text-[10px] text-muted-foreground">{idx + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniMetric
            icon={Layers3}
            label="Scene Beats"
            value={diagnostics.count ? `${diagnostics.count} beat(s)` : 'None yet'}
            detail={diagnostics.count ? `Average tension ${diagnostics.avgTension}/10` : 'Generate beats before drafting'}
          />
          <MiniMetric
            icon={Activity}
            label="Beat Spread"
            value={diagnostics.count ? `${diagnostics.minTension}–${diagnostics.maxTension}` : 'N/A'}
            detail={diagnostics.count ? `Spread: ${diagnostics.spread}` : 'No beat data to inspect'}
          />
          <MiniMetric
            icon={diagnostics.hasForwardConsequence ? CheckCircle2 : AlertTriangle}
            label="Forward Pull"
            value={diagnostics.hasForwardConsequence ? 'Detected' : 'Needs Check'}
            detail={diagnostics.hasForwardConsequence ? 'Beats mention consequence/next-state logic' : 'Final beat should define changed starting conditions'}
          />
        </div>

        {diagnostics.warnings.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50/70 p-3 dark:bg-amber-950/20">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                Beat Quality Warnings
              </span>
            </div>

            <ul className="space-y-1 text-xs leading-5 text-amber-800 dark:text-amber-200">
              {diagnostics.warnings.map((warning, idx) => (
                <li key={idx}>- {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CraftBriefCard pacing={pacing} />
    </div>
  );
}

export default function OutlineEditor({
  project,
  chapter,
  chapters,
  chapterDraft,
  onDraftChange,
  onSave,
  isSaving,
  onGenerateBeats,
  onDraftChapter,
  onDraftAll,
  onRewriteChapter,
  onRewriteAll,
  busyLabel,
  lastSaved,
  onStop,
  onRestoreOriginal,
  onRestorePreviousVersion,
  hasPreviousVersion,
  // WAVE5-MODELPICKER: these six props were passed by ProjectStudio all along
  // but never destructured — the per-chapter model picker literally could not
  // exist. Now it does.
  selectedProseModel,
  onProseModelChange,
  globalDefaultModel,
  hasChapterOverride,
  onResetToDefault,
  isFiction,
}) {
  const writingModel = getWritingModelInfo(project);
  const hasDraftContent = chapterHasContent(chapter) || !!chapterDraft;
  const undrafted = (chapters || []).filter((c) => c.status === 'planned' || c.status === 'beats_ready').length;

  const beats = useMemo(() => parseSceneBeats(chapter?.scene_beats_json), [chapter?.scene_beats_json]);

  if (!chapter) {
    return (
      <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted-foreground">
        Select a chapter from the queue to view its arc role, beats, and draft.
      </div>
    );
  }

  const draftedWithLabel = (() => {
    if (!chapter.drafted_with_model) return '';
    const normalized = normalizeModelId(chapter.drafted_with_model) || chapter.drafted_with_model;
    if (normalized === writingModel.model) return writingModel.label;
    return normalized;
  })();

  const beatButtonBusy = !!busyLabel && String(busyLabel).toLowerCase().includes('beat');

  // WAVE5-MODELPICKER: per-chapter prose model control (fiction only).
  const modelPicker = isFiction && onProseModelChange ? (
    <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2.5 py-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Prose model</span>
      <select
        value={selectedProseModel || globalDefaultModel || ''}
        onChange={(e) => onProseModelChange(chapter.id, e.target.value)}
        className="h-6 rounded border border-border bg-background px-1.5 text-[11px]"
        title="Model used to draft THIS chapter"
      >
        {FICTION_PROSE_MODELS.map((m) => (
          <option key={m.id} value={m.id} title={m.description}>{m.label}</option>
        ))}
      </select>
      {hasChapterOverride && (
        <button
          type="button"
          onClick={() => onResetToDefault?.(chapter.id)}
          className="text-[10px] text-muted-foreground underline hover:text-foreground"
          title="Clear this chapter's override and use the project default"
        >
          reset
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-5 min-w-0">
      {modelPicker}
      {/* Chapter header */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Chapter {chapter.chapter_number}
          </p>
          <h2 className="mt-1 break-words font-display text-2xl leading-tight text-foreground">
            {chapter.title}
          </h2>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge
            variant={chapter.status === 'planned' ? 'outline' : 'secondary'}
            className="text-[10px]"
          >
            {chapter.status}
          </Badge>

          {onGenerateBeats && (
            <Button
              onClick={onGenerateBeats}
              disabled={!!busyLabel}
              size="sm"
              variant="outline"
              className="h-8 rounded-full px-3 text-[10px]"
            >
              {beatButtonBusy ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="mr-1 h-3 w-3" />
                  {chapter.scene_beats_json ? 'Regenerate Beats' : 'Generate Beats'}
                </>
              )}
            </Button>
          )}

          {onRestoreOriginal && chapterHasBackup(chapter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRestoreOriginal}
              disabled={!!busyLabel}
              className="h-8 rounded-full px-3 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Restore Original
            </Button>
          )}

          {onRestorePreviousVersion && hasPreviousVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRestorePreviousVersion}
              disabled={!!busyLabel}
              className="h-8 rounded-full px-3 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <History className="mr-1 h-3 w-3" />
              Restore Previous Version
            </Button>
          )}

          <SaveIndicator
            onSave={onSave}
            isSaving={isSaving}
            lastSaved={lastSaved}
            label="Save"
          />
        </div>
      </div>

      <ArcBeatDashboard
        project={project}
        chapter={chapter}
        chapters={chapters}
        beats={beats}
      />

      {/* Beat summary */}
      {chapter.beat_summary && (
        <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Chapter Beat Summary
            </span>
          </div>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
            {chapter.beat_summary}
          </p>
        </div>
      )}

      {/* Scene beats */}
      {chapter.scene_beats_json && (
        <div className="rounded-[1.25rem] border border-border/70 bg-background/70 p-4">
          <div className="mb-3 flex items-center gap-1.5">
            <Layers3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Generated Scene Beats
            </span>
          </div>
          <SceneBeatsList beatsJson={chapter.scene_beats_json} />
        </div>
      )}

      {/* Draft actions */}
      <div className="flex flex-col items-center gap-3 rounded-[1.25rem] border border-border/70 bg-background/70 px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[10px] text-muted-foreground">
          <Cpu className="h-3.5 w-3.5 text-primary" />
          <span className="uppercase tracking-widest">Writing Engine</span>
          <span className="font-semibold text-foreground">{writingModel.label}</span>
          <span className="text-muted-foreground/60">fixed</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onDraftChapter && (
            <Button
              onClick={onDraftChapter}
              disabled={!!busyLabel}
              className="rounded-full px-6"
            >
              {busyLabel &&
              (busyLabel.includes('Drafting') || busyLabel.includes('beats')) &&
              !busyLabel.includes('Rewriting') ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {busyLabel}
                </>
              ) : (
                <>
                  <PenLine className="mr-1.5 h-3.5 w-3.5" />
                  Draft Chapter
                </>
              )}
            </Button>
          )}

          {onRewriteChapter && hasDraftContent && (
            <Button
              onClick={onRewriteChapter}
              disabled={!!busyLabel}
              variant="secondary"
              className="rounded-full px-6"
            >
              {busyLabel && busyLabel.includes('Rewriting chapter') ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {busyLabel}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Rewrite Chapter
                </>
              )}
            </Button>
          )}

          {onStop && !!busyLabel && !busyLabel.includes('stopping') && (
            <Button
              onClick={onStop}
              variant="destructive"
              className="rounded-full px-6"
            >
              <Square className="mr-1.5 h-3.5 w-3.5" />
              Stop After Current
            </Button>
          )}

          {onDraftAll && undrafted > 0 && (
            <Button
              onClick={onDraftAll}
              disabled={!!busyLabel}
              variant="outline"
              className="rounded-full px-6"
            >
              {busyLabel && busyLabel.includes('remaining') ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Drafting All…
                </>
              ) : (
                <>
                  <PenLine className="mr-1.5 h-3.5 w-3.5" />
                  Draft All Remaining ({undrafted})
                </>
              )}
            </Button>
          )}

          {onRewriteAll && chapters.some((c) => chapterHasContent(c)) && (
            <Button
              onClick={onRewriteAll}
              disabled={!!busyLabel}
              variant="outline"
              className="rounded-full px-6"
            >
              {busyLabel && busyLabel.includes('Rewriting all') ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Rewriting All…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Rewrite All Drafted
                </>
              )}
            </Button>
          )}
        </div>

        {chapter.status === 'drafted' && (
          <span className="text-[10px] text-muted-foreground">
            Re-drafting or rewriting will overwrite the current content.
          </span>
        )}
      </div>

      {/* Draft editor */}
      <div className="space-y-2">
        <Label htmlFor="chapter-draft" className="text-xs">
          Draft Content
        </Label>
        <Textarea
          id="chapter-draft"
          value={chapterDraft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Chapter draft will appear here after generation, or start writing…"
          className="min-h-[28rem] rounded-[1.25rem] bg-background/80 p-4 text-sm leading-7"
        />
      </div>

      {/* Stats row */}
      {(chapter.word_count > 0 || chapter.score > 0 || chapter.drafted_with_model) && (
        <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          {chapter.word_count > 0 && (
            <span>{chapter.word_count.toLocaleString()} words</span>
          )}

          {chapter.score > 0 && <span>Score: {chapter.score}/10</span>}

          {chapter.voice_adherence > 0 && (
            <span>Voice: {chapter.voice_adherence}/10</span>
          )}

          {chapter.slop_score > 0 && (
            <span>Slop: {chapter.slop_score}/10</span>
          )}

          {chapter.drafted_with_model && (
            <span>Drafted with: {draftedWithLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
