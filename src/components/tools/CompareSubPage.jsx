import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Upload,
  Loader2,
  Trophy,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Microscope,
  Users,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { invokeLLMWithRetry } from '@/lib/integrationRetry';
import { pickModel, pickFallbackModel } from '@/lib/modelRouting';
import {
  pickReviewerPanel,
  buildReviewerPrompt,
  REVIEWER_RESPONSE_SCHEMA,
  computeConsensus,
} from '@/lib/criticPanel';
import {
  loadVersionData,
  METRIC_REGISTRY,
  formatMetric,
  declareMetricWinner,
  tallyWinners,
  computeChapterMatrix,
  computePhraseDeltas,
} from '@/lib/compareMetrics';

/* =============================================================================
 * DROPZONE — accepts .docx, .txt, .md (no longer .txt-only)
 * ========================================================================== */

function DropZone({ label, onFile, loadedName }) {
  const [dragOver, setDragOver] = useState(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragOver
          ? 'border-primary bg-primary/5'
          : loadedName
          ? 'border-green-400/50 bg-green-50/30 dark:bg-green-950/20'
          : 'border-border/60 hover:border-border'
      }`}
    >
      {loadedName ? (
        <>
          <FileText className="h-5 w-5 text-green-600 mb-1" />
          <p className="text-xs font-medium text-green-700 dark:text-green-400 truncate max-w-full">{loadedName}</p>
        </>
      ) : (
        <>
          <Upload className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">{label}</p>
          <label className="mt-2 cursor-pointer rounded-full bg-secondary px-3 py-1 text-[10px] font-medium text-secondary-foreground hover:bg-secondary/80">
            Choose file
            <input
              type="file"
              accept=".docx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files[0] && onFile(e.target.files[0])}
            />
          </label>
          <p className="mt-1 text-[10px] text-muted-foreground/70">.docx / .txt / .md</p>
        </>
      )}
    </div>
  );
}

/* =============================================================================
 * VERSION SOURCE PICKER
 *
 * One per side. Selects between: current project, a different saved project,
 * or file upload. Renders the appropriate input for the chosen source.
 * ========================================================================== */

function VersionSourcePicker({
  sideLabel,
  currentProject,
  currentChapters,
  allProjects,
  loadingProjects,
  spec,
  onChange,
  loadedVersion,
  loading,
}) {
  const [mode, setMode] = useState(() => {
    if (spec?.type === 'currentProject') return 'current';
    if (spec?.type === 'otherProject') return 'other';
    return 'upload';
  });

  const currentDisabled = !currentProject?.id;

  const setSpec = useCallback((nextSpec) => onChange(nextSpec), [onChange]);

  const onCurrentClick = () => {
    if (currentDisabled) return;
    setMode('current');
    setSpec({ type: 'currentProject', project: currentProject, chapters: currentChapters });
  };
  const onOtherClick = () => { setMode('other'); setSpec(null); };
  const onUploadClick = () => { setMode('upload'); setSpec(null); };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{sideLabel}</h3>

      <div className="flex rounded-lg border border-border/60 bg-secondary/30 p-0.5 w-fit">
        <button
          onClick={onCurrentClick}
          disabled={currentDisabled}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
            mode === 'current' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          } ${currentDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
          title={currentDisabled ? 'Open a project to use this option' : ''}
        >Current Project</button>
        <button
          onClick={onOtherClick}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
            mode === 'other' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >Saved Project</button>
        <button
          onClick={onUploadClick}
          className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
            mode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >Upload File</button>
      </div>

      {mode === 'current' && currentProject?.id && (
        <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/20 p-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{currentProject.title || 'Current Project'}</span>
          <span className="text-[10px] text-muted-foreground">({currentChapters?.length || 0} chapters)</span>
        </div>
      )}

      {mode === 'other' && (
        <div className="space-y-2">
          {loadingProjects ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading project list…
            </div>
          ) : (
            <select
              value={spec?.type === 'otherProject' ? spec.projectId : ''}
              onChange={(e) => {
                const pid = e.target.value;
                if (!pid) { setSpec(null); return; }
                const proj = allProjects.find((p) => p.id === pid);
                setSpec({ type: 'otherProject', projectId: pid, projectTitle: proj?.title || 'Saved project' });
              }}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs"
            >
              <option value="">Choose a saved project…</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title || 'Untitled'}{p.updated_date ? `  ·  ${new Date(p.updated_date).toLocaleDateString()}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'upload' && (
        <DropZone
          label={`${sideLabel} manuscript file`}
          onFile={(file) => setSpec({ type: 'upload', file })}
          loadedName={
            loadedVersion?.name && spec?.type === 'upload'
              ? loadedVersion.name
              : spec?.type === 'upload' ? spec.file?.name : null
          }
        />
      )}

      {loadedVersion && (
        <div className="flex items-center gap-2 rounded-xl border border-green-400/50 bg-green-50/40 dark:bg-green-950/20 p-2.5">
          <FileText className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <span className="text-[11px] font-medium text-green-700 dark:text-green-400 truncate">{loadedVersion.name}</span>
          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
            {loadedVersion.aggregates.totalWords.toLocaleString()} words · {loadedVersion.chapters.length} ch
          </span>
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Analyzing…
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * METRIC ROW — renders a single comparison row with winner highlighting
 * ========================================================================== */

function MetricRow({ metric, versionA, versionB }) {
  const valueA = metric.get(versionA);
  const valueB = metric.get(versionB);
  const winner = declareMetricWinner(valueA, valueB, metric.higherIsBetter);
  const delta = typeof valueA === 'number' && typeof valueB === 'number' ? valueB - valueA : null;

  return (
    <tr className="border-b border-border/30">
      <td className="py-2 pr-3 text-xs text-muted-foreground">{metric.label}</td>
      <td className={`py-2 px-3 text-xs text-center font-medium ${winner === 'A' ? 'text-green-600 dark:text-green-500' : 'text-foreground'}`}>
        {formatMetric(valueA, metric.fmt)}
      </td>
      <td className={`py-2 px-3 text-xs text-center font-medium ${winner === 'B' ? 'text-green-600 dark:text-green-500' : 'text-foreground'}`}>
        {formatMetric(valueB, metric.fmt)}
      </td>
      <td className={`py-2 pl-3 text-xs text-center ${
        delta === null || delta === 0 ? 'text-muted-foreground'
        : winner === 'B' ? 'text-green-600 dark:text-green-500'
        : winner === 'A' ? 'text-red-500 dark:text-red-400'
        : 'text-muted-foreground'
      }`}>
        {delta === null || delta === 0
          ? '—'
          : (delta > 0 ? '+' : '') + (Math.abs(delta) < 1 ? delta.toFixed(2) : Math.round(delta * 10) / 10)}
      </td>
    </tr>
  );
}

/* =============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export default function CompareSubPage({ project, chapters, busyLabel, setBusyLabel }) {
  const [specA, setSpecA] = useState(project?.id ? { type: 'currentProject', project, chapters } : null);
  const [specB, setSpecB] = useState(null);
  const [versionA, setVersionA] = useState(null);
  const [versionB, setVersionB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  const [allProjects, setAllProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [verdict, setVerdict] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  const [criticComparing, setCriticComparing] = useState(false);
  const [criticDone, setCriticDone] = useState(false);

  // Fetch saved projects list once
  useEffect(() => {
    let cancelled = false;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const list = await base44.entities.NovelProject.list('-updated_date', 100);
        if (!cancelled) setAllProjects(Array.isArray(list) ? list : []);
      } catch (err) {
        console.warn('[COMPARE] Could not list projects:', err?.message);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };
    fetchProjects();
    return () => { cancelled = true; };
  }, []);

  // Auto-load version A whenever its spec is set
  useEffect(() => {
    let cancelled = false;
    if (!specA) { setVersionA(null); return; }
    setLoadingA(true);
    setVersionA(null);
    loadVersionData(specA, (msg) => setBusyLabel(`A: ${msg}`))
      .then((v) => { if (!cancelled) setVersionA(v); })
      .catch((err) => {
        console.error('[COMPARE] Load A failed:', err);
        toast.error('Failed to load Version A: ' + (err?.message || 'unknown'));
      })
      .finally(() => { if (!cancelled) { setLoadingA(false); setBusyLabel(''); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specA]);

  // Auto-load version B
  useEffect(() => {
    let cancelled = false;
    if (!specB) { setVersionB(null); return; }
    setLoadingB(true);
    setVersionB(null);
    loadVersionData(specB, (msg) => setBusyLabel(`B: ${msg}`))
      .then((v) => { if (!cancelled) setVersionB(v); })
      .catch((err) => {
        console.error('[COMPARE] Load B failed:', err);
        toast.error('Failed to load Version B: ' + (err?.message || 'unknown'));
      })
      .finally(() => { if (!cancelled) { setLoadingB(false); setBusyLabel(''); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specB]);

  const bothLoaded = !!(versionA && versionB);
  const tally = useMemo(() => (bothLoaded ? tallyWinners(versionA, versionB) : null), [bothLoaded, versionA, versionB]);
  const chapterMatrix = useMemo(() => (bothLoaded ? computeChapterMatrix(versionA, versionB) : []), [bothLoaded, versionA, versionB]);
  const phraseDeltas = useMemo(() => (bothLoaded ? computePhraseDeltas(versionA, versionB) : { removed: [], introduced: [] }), [bothLoaded, versionA, versionB]);

  const groupedMetrics = useMemo(() => {
    const groups = { forensic: [], mechanics: [], scale: [], craft: [] };
    for (const m of METRIC_REGISTRY) {
      if (m.group === 'forensic') groups.forensic.push(m);
      else if (m.group === 'mechanics') groups.mechanics.push(m);
      else if (['totalWords', 'chapterCount', 'avgWordCount'].includes(m.key)) groups.scale.push(m);
      else groups.craft.push(m);
    }
    return groups;
  }, []);

  /* ------------------------------------------------------------------- */
  /* CRITIC PANEL COMPARISON — runs full 10-reviewer panel on both sides */
  /* ------------------------------------------------------------------- */

  const runCriticComparison = useCallback(async () => {
    if (!bothLoaded) return;
    setCriticComparing(true);
    setCriticDone(false);

    try {
      // Reviewer runner (inline — same logic as CriticSubPage's runSingleReviewer)
      const runReviewer = async (reviewer, context) => {
        const prompt = buildReviewerPrompt(reviewer, context);
        try {
          const response = await invokeLLMWithRetry({
            prompt,
            response_json_schema: REVIEWER_RESPONSE_SCHEMA,
            model: 'gemini_3_flash',
            fallback_model: 'gemini_3_flash',
            temperature: 0.3,
          });
          let data = response;
          if (typeof data === 'string') {
            data = data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            data = JSON.parse(data);
          }
          const ratingNumeric = Math.max(0, Math.min(100, Number.isFinite(Number(data.rating_numeric)) ? Math.round(Number(data.rating_numeric)) : 50));
          return {
            outlet: data.outlet || reviewer.outlet,
            icon: data.icon || reviewer.icon,
            rating_label: data.rating_label || '—',
            rating_numeric: ratingNumeric,
            rating_display: data.rating_display || data.rating_label || '—',
            review: data.review || '',
            summary_line: data.summary_line || '',
            audience_prediction: Math.max(0, Math.min(100, Number.isFinite(Number(data.audience_prediction)) ? Math.round(Number(data.audience_prediction)) : ratingNumeric)),
            audience_reasoning: data.audience_reasoning || '',
          };
        } catch (err) {
          console.error(`[COMPARE/CRITIC] ${reviewer.outlet} failed:`, err?.message);
          return {
            outlet: reviewer.outlet,
            icon: reviewer.icon,
            rating_label: 'N/A',
            rating_numeric: 50,
            rating_display: 'N/A',
            review: `Review failed: ${err?.message}`,
            summary_line: '',
            audience_prediction: 50,
            audience_reasoning: '',
            _failed: true,
          };
        }
      };

      // Run panel for each version, one side at a time
      for (const [label, version, setter] of [
        ['A', versionA, setVersionA],
        ['B', versionB, setVersionB],
      ]) {
        setBusyLabel(`Critic panel: running 10 reviewers on Version ${label}…`);
        const panel = pickReviewerPanel(
          { project_type: version.projectType, genre: version.genre },
          version.genre,
          version.projectType
        );
        const excerpt =
          version.fullText.length > 50000
            ? version.fullText.substring(0, 40000) +
              `\n\n[...MIDDLE OF MANUSCRIPT...]\n\n${version.fullText.substring(
                Math.floor(version.fullText.length / 2) - 2500,
                Math.floor(version.fullText.length / 2) + 2500
              )}\n\n[...END OF MANUSCRIPT...]\n\n${version.fullText.substring(version.fullText.length - 10000)}`
            : version.fullText;
        const context = {
          title: version.name,
          genre: version.genre,
          wordCount: version.aggregates.totalWords,
          excerpt,
          authorName: 'the author',
          projectType: version.projectType,
          isAnthology: false,
          anthologyTheme: 'unspecified',
        };
        const reviews = await Promise.all(panel.map((r) => runReviewer(r, context)));
        const consensus = computeConsensus(reviews);
        setter((prev) => (prev ? { ...prev, critic: { reviews, consensus } } : prev));
        console.warn(
          `[COMPARE/CRITIC] Version ${label}: critic=${consensus.critic.percent_fresh}% audience=${consensus.audience.percent_fresh}%`
        );
      }

      setCriticDone(true);
      toast.success('Critic panel comparison complete');
    } catch (err) {
      console.error('[COMPARE/CRITIC] Failed:', err);
      toast.error('Critic comparison failed: ' + (err?.message || 'Unknown'));
    } finally {
      setCriticComparing(false);
      setBusyLabel('');
    }
  }, [bothLoaded, versionA, versionB, setBusyLabel]);

  /* ------------------------------------------------------------------- */
  /* LLM VERDICT — feeds the whole metric pack and gets a structured call */
  /* ------------------------------------------------------------------- */

  const runVerdict = useCallback(async () => {
    if (!bothLoaded) return;
    setVerdictLoading(true);
    try {
      const metricLines = METRIC_REGISTRY.map((m) => {
        const a = m.get(versionA);
        const b = m.get(versionB);
        const winner = declareMetricWinner(a, b, m.higherIsBetter);
        const dir = m.higherIsBetter === null ? '' : (m.higherIsBetter ? 'higher=better' : 'lower=better');
        return `  ${m.label.padEnd(26)} A=${formatMetric(a, m.fmt).padStart(8)}  B=${formatMetric(b, m.fmt).padStart(8)}  winner=${winner || 'tie'}  ${dir}`;
      }).join('\n');

      const phraseLines =
        phraseDeltas.removed.length > 0 || phraseDeltas.introduced.length > 0
          ? `\nPHRASE CHANGES:\n  Removed in B: ${phraseDeltas.removed.slice(0, 8).map((p) => `"${p.phrase}" (${p.count}×)`).join(', ') || '(none)'}\n  Introduced in B: ${phraseDeltas.introduced.slice(0, 8).map((p) => `"${p.phrase}" (${p.count}×)`).join(', ') || '(none)'}`
          : '';

      const criticSection = versionA.critic && versionB.critic
        ? `\nCRITIC PANEL (10-reviewer):\n  Version A: Critic ${versionA.critic.consensus.critic.percent_fresh}% Fresh / Audience ${versionA.critic.consensus.audience.percent_fresh}% — ${versionA.critic.consensus.critic.one_line}\n  Version B: Critic ${versionB.critic.consensus.critic.percent_fresh}% Fresh / Audience ${versionB.critic.consensus.audience.percent_fresh}% — ${versionB.critic.consensus.critic.one_line}`
        : '';

      const prompt = `You are an editorial analyst producing a definitive comparison verdict between two manuscript versions. You will receive a full metric panel including forensic-audit scores, mechanical prose signatures, and (if available) critic-panel consensus. Your job is to declare which version is stronger and WHY, with specific named observations.

VERSION A: ${versionA.name} — ${versionA.aggregates.totalWords.toLocaleString()} words, ${versionA.chapters.length} chapters
VERSION B: ${versionB.name} — ${versionB.aggregates.totalWords.toLocaleString()} words, ${versionB.chapters.length} chapters

METRIC COMPARISON (A vs B):
${metricLines}
${phraseLines}
${criticSection}

FORENSIC FINDINGS:
  Version A Primary Mechanic: ${versionA.forensic?.primary_mechanic || 'unknown'}
  Version A Forensic Marker: ${versionA.forensic?.forensic_marker_description || 'unknown'}
  Version B Primary Mechanic: ${versionB.forensic?.primary_mechanic || 'unknown'}
  Version B Forensic Marker: ${versionB.forensic?.forensic_marker_description || 'unknown'}

Write your verdict as JSON. No markdown fences. Follow this shape exactly:

{
  "winner": "A" | "B" | "tie",
  "confidence": "low" | "moderate" | "high",
  "improvements": [
    "3-5 specific observations of what the winning version does BETTER. Reference specific metrics and forensic findings by name. Each item: one sentence, concrete."
  ],
  "regressions": [
    "2-4 specific observations of what the losing version does BETTER than the winner. Trade-offs are real. If none meaningful, return an empty array."
  ],
  "verdict": "A 2-3 sentence summary explaining the winner declaration. Cite the decisive metrics by name."
}`;

      const response = await invokeLLMWithRetry({
        prompt,
        model: pickModel('compare'),
        fallback_model: pickFallbackModel('compare'),
        temperature: 0.4,
        response_json_schema: {
          type: 'object',
          properties: {
            winner: { type: 'string' },
            confidence: { type: 'string' },
            improvements: { type: 'array', items: { type: 'string' } },
            regressions: { type: 'array', items: { type: 'string' } },
            verdict: { type: 'string' },
          },
          required: ['winner', 'verdict'],
        },
      });
      let data = response;
      if (typeof data === 'string') {
        data = data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        data = JSON.parse(data);
      }
      setVerdict({
        winner: data.winner || 'tie',
        confidence: data.confidence || 'moderate',
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        regressions: Array.isArray(data.regressions) ? data.regressions : [],
        verdict: data.verdict || 'No verdict available.',
      });
    } catch (err) {
      console.error('[COMPARE] Verdict failed:', err);
      toast.error('Verdict generation failed: ' + (err?.message || 'Unknown'));
    } finally {
      setVerdictLoading(false);
    }
  }, [bothLoaded, versionA, versionB, phraseDeltas]);

  const reset = () => {
    setSpecA(null);
    setSpecB(null);
    setVersionA(null);
    setVersionB(null);
    setVerdict(null);
    setCriticDone(false);
  };

  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      <div>
        <p className="notebook-kicker">Manuscript Tools</p>
        <h2 className="font-display text-2xl text-foreground">Compare Versions</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Side-by-side comparison of two manuscript versions. Uses the same forensic scores, mechanical
          metrics, and optional 10-reviewer critic panel as the Analytics and Critic tabs.
        </p>
      </div>

      {/* Source pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <VersionSourcePicker
          sideLabel="Version A"
          currentProject={project}
          currentChapters={chapters}
          allProjects={allProjects}
          loadingProjects={loadingProjects}
          spec={specA}
          onChange={(next) => { setSpecA(next); setVerdict(null); setCriticDone(false); }}
          loadedVersion={versionA}
          loading={loadingA}
        />
        <VersionSourcePicker
          sideLabel="Version B"
          currentProject={project}
          currentChapters={chapters}
          allProjects={allProjects}
          loadingProjects={loadingProjects}
          spec={specB}
          onChange={(next) => { setSpecB(next); setVerdict(null); setCriticDone(false); }}
          loadedVersion={versionB}
          loading={loadingB}
        />
      </div>

      {(versionA || versionB) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset} className="rounded-full text-xs gap-1">
            <XIcon className="h-3 w-3" /> Reset
          </Button>
        </div>
      )}

      {busyLabel && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">{busyLabel}</span>
        </div>
      )}

      {bothLoaded && (
        <div className="space-y-4">
          {/* Winner banner */}
          {tally && (
            <div className={`rounded-2xl border-2 p-4 ${
              tally.overall === 'A' ? 'border-blue-400/60 bg-blue-50/50 dark:bg-blue-950/20'
              : tally.overall === 'B' ? 'border-green-400/60 bg-green-50/50 dark:bg-green-950/20'
              : 'border-border/60 bg-card/60'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <Trophy className={`h-6 w-6 ${tally.overall === 'A' ? 'text-blue-600' : tally.overall === 'B' ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Mechanical Winner</p>
                    <p className="text-lg font-bold">
                      {tally.overall === 'tie' ? 'Too close to call — tied' : `Version ${tally.overall} wins`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className={tally.aWins > tally.bWins ? 'font-bold text-blue-600' : 'text-muted-foreground'}>A: {tally.aWins}</span>
                  <span className={tally.bWins > tally.aWins ? 'font-bold text-green-600' : 'text-muted-foreground'}>B: {tally.bWins}</span>
                  <span className="text-muted-foreground">Ties: {tally.ties}</span>
                </div>
              </div>
            </div>
          )}

          {/* Forensic scores */}
          {versionA.forensic && versionB.forensic && (
            <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
              <h3 className="font-display text-lg mb-3 flex items-center gap-2">
                <Microscope className="h-4 w-4" /> Forensic Scores
              </h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-left">Metric</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">A</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">B</th>
                    <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedMetrics.forensic.map((m) => (
                    <MetricRow key={m.key} metric={m} versionA={versionA} versionB={versionB} />
                  ))}
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-3 text-xs text-muted-foreground">Critic Status</td>
                    <td className="py-2 px-3 text-xs text-center">{versionA.forensic.criticStatus}</td>
                    <td className="py-2 px-3 text-xs text-center">{versionB.forensic.criticStatus}</td>
                    <td className="py-2 pl-3 text-xs text-center text-muted-foreground">
                      {versionA.forensic.criticStatus === versionB.forensic.criticStatus ? '—' : '↔'}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <div className="rounded-xl bg-secondary/30 border border-border/40 p-3">
                  <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">A — Primary Mechanic</p>
                  <p className="text-sm font-display text-foreground mt-0.5">{versionA.forensic.primary_mechanic}</p>
                  <p className="text-[11px] italic text-muted-foreground mt-1">{versionA.forensic.forensic_marker_description}</p>
                </div>
                <div className="rounded-xl bg-secondary/30 border border-border/40 p-3">
                  <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">B — Primary Mechanic</p>
                  <p className="text-sm font-display text-foreground mt-0.5">{versionB.forensic.primary_mechanic}</p>
                  <p className="text-[11px] italic text-muted-foreground mt-1">{versionB.forensic.forensic_marker_description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mechanical metrics */}
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
            <h3 className="font-display text-lg mb-3">Mechanical Comparison</h3>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-left">Metric</th>
                  <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">A</th>
                  <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">B</th>
                  <th className="pb-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Δ</th>
                </tr>
              </thead>
              <tbody>
                {groupedMetrics.scale.map((m) => (
                  <MetricRow key={m.key} metric={m} versionA={versionA} versionB={versionB} />
                ))}
                {groupedMetrics.craft.map((m) => (
                  <MetricRow key={m.key} metric={m} versionA={versionA} versionB={versionB} />
                ))}
                {groupedMetrics.mechanics.map((m) => (
                  <MetricRow key={m.key} metric={m} versionA={versionA} versionB={versionB} />
                ))}
              </tbody>
            </table>
          </div>

          {chapterMatrix.length > 0 && <ChapterMatrix rows={chapterMatrix} />}
          {(phraseDeltas.removed.length > 0 || phraseDeltas.introduced.length > 0) && (
            <PhraseDiff removed={phraseDeltas.removed} introduced={phraseDeltas.introduced} />
          )}

          <CriticPanelSection
            versionA={versionA}
            versionB={versionB}
            comparing={criticComparing}
            done={criticDone}
            onRun={runCriticComparison}
          />

          <VerdictPanel
            verdict={verdict}
            loading={verdictLoading}
            onRun={runVerdict}
            onRegenerate={() => { setVerdict(null); runVerdict(); }}
          />
        </div>
      )}
    </div>
  );
}

/* =============================================================================
 * SUB-COMPONENTS
 * ========================================================================== */

function ChapterMatrix({ rows }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, 10);

  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">Per-Chapter Changes</h3>
        <span className="text-[10px] text-muted-foreground">{rows.length} chapters compared</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="pb-1.5 pr-2 text-[10px] uppercase tracking-wider text-muted-foreground text-left">Ch</th>
              <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Words</th>
              <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">Clean</th>
              <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">AI Risk</th>
              <th className="pb-1.5 px-2 text-[10px] uppercase tracking-wider text-muted-foreground text-center">FK</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.index} className="border-b border-border/20">
                <td className="py-1.5 pr-2 text-muted-foreground">Ch.{r.index}</td>
                <td className={`py-1.5 px-2 text-center ${
                  r.wordCountDelta === 0 ? 'text-muted-foreground'
                  : r.wordCountDelta > 0 ? 'text-blue-600 dark:text-blue-400'
                  : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {r.wordCountA.toLocaleString()} → {r.wordCountB.toLocaleString()}
                  <span className="text-[10px] ml-1">({r.wordCountDelta > 0 ? '+' : ''}{r.wordCountDelta})</span>
                </td>
                <td className={`py-1.5 px-2 text-center ${
                  r.cleanDelta === 0 ? 'text-muted-foreground'
                  : r.cleanDelta > 0 ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
                }`}>
                  {r.cleanA}% → {r.cleanB}%
                  <span className="text-[10px] ml-1">({r.cleanDelta > 0 ? '+' : ''}{r.cleanDelta})</span>
                </td>
                <td className={`py-1.5 px-2 text-center ${
                  r.aiRiskDelta === 0 ? 'text-muted-foreground'
                  : r.aiRiskDelta < 0 ? 'text-green-600 dark:text-green-500'
                  : 'text-red-600 dark:text-red-500'
                }`}>
                  {r.aiRiskA}% → {r.aiRiskB}%
                  <span className="text-[10px] ml-1">({r.aiRiskDelta > 0 ? '+' : ''}{r.aiRiskDelta})</span>
                </td>
                <td className="py-1.5 px-2 text-center text-muted-foreground">
                  {r.readabilityA.toFixed(1)} → {r.readabilityB.toFixed(1)}
                  <span className="text-[10px] ml-1">({r.readabilityDelta > 0 ? '+' : ''}{r.readabilityDelta.toFixed(1)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Show only first 10' : `Show all ${rows.length} chapters`}
        </button>
      )}
    </div>
  );
}

function PhraseDiff({ removed, introduced }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <h3 className="font-display text-lg mb-3">Phrase Changes (A → B)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
            Removed or reduced in B
          </p>
          {removed.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No high-frequency phrases removed.</p>
          ) : (
            <div className="space-y-1">
              {removed.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate mr-2">"{p.phrase}"</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {p.count}×{p.remaining != null ? ` → ${p.remaining}×` : ' → 0'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
            Introduced in B
          </p>
          {introduced.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No new high-frequency phrases.</p>
          ) : (
            <div className="space-y-1">
              {introduced.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-foreground truncate mr-2">"{p.phrase}"</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{p.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CriticPanelSection({ versionA, versionB, comparing, done, onRun }) {
  const bothHaveCritic = !!(versionA.critic && versionB.critic);
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display text-lg flex items-center gap-2">
            <Users className="h-4 w-4" /> Critic Panel Comparison
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Runs the full 10-reviewer panel on both versions. Takes ~2–3 minutes.
          </p>
        </div>
        {!bothHaveCritic && (
          <Button onClick={onRun} disabled={comparing} size="sm" className="rounded-full gap-1.5">
            {comparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
            {comparing ? 'Running…' : 'Run Deep Comparison'}
          </Button>
        )}
      </div>
      {bothHaveCritic && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <CriticVersionCard label="Version A" name={versionA.name} critic={versionA.critic} />
          <CriticVersionCard label="Version B" name={versionB.name} critic={versionB.critic} />
        </div>
      )}
    </div>
  );
}

function CriticVersionCard({ label, name, critic }) {
  if (!critic?.consensus) return null;
  const { critic: c, audience: a, divergence } = critic.consensus;
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground truncate mb-2">{name}</p>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-card/80 border border-border/40 p-2 text-center">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">🍅 Critic</p>
          <p className="text-xl font-bold text-foreground">{c.percent_fresh}%</p>
          <p className="text-[10px] text-muted-foreground">★ {c.average_stars} · {c.fresh_count}/{c.total_reviews}</p>
        </div>
        <div className="flex-1 rounded-lg bg-card/80 border border-border/40 p-2 text-center">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground">🍿 Audience</p>
          <p className="text-xl font-bold text-foreground">{a.percent_fresh}%</p>
          <p className="text-[10px] text-muted-foreground">★ {a.average_stars} · {a.fresh_count}/{a.total_reviews}</p>
        </div>
      </div>
      {divergence?.label && (
        <p className="text-[10px] italic text-muted-foreground mt-2">{divergence.label}</p>
      )}
    </div>
  );
}

function VerdictPanel({ verdict, loading, onRun, onRegenerate }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-lg flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> LLM Editorial Verdict
        </h3>
        {verdict && (
          <Button onClick={onRegenerate} variant="ghost" size="sm" className="rounded-full text-xs">Regenerate</Button>
        )}
      </div>

      {!verdict && (
        <Button onClick={onRun} disabled={loading} size="sm" className="rounded-full gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}
          {loading ? 'Generating verdict…' : 'Generate Editorial Verdict'}
        </Button>
      )}

      {verdict && (
        <div className="space-y-3">
          <div className={`rounded-xl p-3 border-2 ${
            verdict.winner === 'A' ? 'border-blue-400/60 bg-blue-50/40 dark:bg-blue-950/20'
            : verdict.winner === 'B' ? 'border-green-400/60 bg-green-50/40 dark:bg-green-950/20'
            : 'border-border/50 bg-secondary/30'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <p className="text-base font-bold text-foreground">
                Winner: {verdict.winner === 'tie' ? 'Tie' : `Version ${verdict.winner}`}
              </p>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Confidence: {verdict.confidence}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{verdict.verdict}</p>
          </div>

          {verdict.improvements.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-green-700 dark:text-green-500 mb-1">Improvements</p>
              <ul className="space-y-1">
                {verdict.improvements.map((imp, i) => (
                  <li key={i} className="text-xs text-foreground/90 flex items-start gap-1.5">
                    <span className="text-green-600 mt-0.5">+</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verdict.regressions.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-orange-700 dark:text-orange-500 mb-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Regressions / Trade-offs
              </p>
              <ul className="space-y-1">
                {verdict.regressions.map((reg, i) => (
                  <li key={i} className="text-xs text-foreground/90 flex items-start gap-1.5">
                    <span className="text-orange-600 mt-0.5">−</span>
                    <span>{reg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}