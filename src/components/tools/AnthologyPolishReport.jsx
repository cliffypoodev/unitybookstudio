import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

function ReportSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/80 p-5 backdrop-blur-sm">
      <h3 className="font-display text-lg mb-3">{title}</h3>
      {children}
    </div>
  );
}

function WarningList({ warnings }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

const PATTERN_LABELS = {
  PATTERN_A: 'A — Alone → Stranger → Epiphany',
  PATTERN_B: 'B — Conflict → Escalation → Resolution',
  PATTERN_C: 'C — Discovery → Investigation → Revelation',
  PATTERN_D: 'D — Tension → Confrontation → Shift',
  PATTERN_E: 'E — Other',
};

const ENDING_LABELS = {
  QUIET_OBSERVATION: 'Quiet Observation',
  ACTIVE_DECISION: 'Active Decision',
  DIALOGUE: 'Dialogue',
  AMBIGUOUS_OPEN: 'Ambiguous / Open',
  HARD_CLOSE: 'Hard Close',
};

export default function AnthologyPolishReport({ report }) {
  if (!report) return null;

  const { dedup, arcs, endings, pronouns, contamination, length, savedCount,
          atmospheric, openers, hardErrors, narrative,
          // WAVE7-ANTHREPORT: three steps that rewrite the manuscript had no
          // report section at all — you could not see what they changed.
          contamFix, bodyLang, anthVocab } = report;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 backdrop-blur-sm text-center">
        <Badge variant="secondary" className="text-xs">
          {savedCount} chapters modified · {dedup?.totalRewritten || 0} phrases rewritten
        </Badge>
      </div>

      {/* Step 1: Phrase Dedup */}
      <ReportSection title="1. Cross-Chapter Phrase Dedup">
        {dedup?.summary?.length > 0 ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {dedup.summary.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No phrases appeared in 3+ chapters.</p>
        )}
        {dedup?.changes?.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">View rewrites ({dedup.changes.length})</summary>
            <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-xs text-muted-foreground">
              {dedup.changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </details>
        )}
      </ReportSection>

      {/* Step 2: Structural Arcs */}
      <ReportSection title="2. Structural Arc Tagging">
        {arcs?.arcs?.length > 0 && (
          <>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Ch.</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Pattern</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Reason</th>
                </tr>
              </thead>
              <tbody>
                {arcs.arcs.map((a, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 text-foreground font-medium">{a.chapter_number}</td>
                    <td className="py-1"><Badge variant="outline" className="text-[9px] px-1.5 py-0">{a.pattern?.replace('PATTERN_', '')}</Badge></td>
                    <td className="py-1 text-muted-foreground">{a.brief_reason || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(arcs.patternCounts || {}).map(([p, c]) => (
                <Badge key={p} variant="secondary" className="text-[9px]">{PATTERN_LABELS[p] || p}: {c}</Badge>
              ))}
            </div>
          </>
        )}
        <WarningList warnings={arcs?.warnings} />
      </ReportSection>

      {/* Step 3: Ending Variety */}
      <ReportSection title="3. Ending Variety Check">
        {endings?.endings?.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(endings.typeCounts || {}).map(([t, c]) => (
                <Badge key={t} variant="secondary" className="text-[9px]">{ENDING_LABELS[t] || t}: {c}</Badge>
              ))}
            </div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Ch.</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Ending Type</th>
                </tr>
              </thead>
              <tbody>
                {endings.endings.map((e, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 text-foreground font-medium">{e.chapter_number}</td>
                    <td className="py-1 text-muted-foreground">{ENDING_LABELS[e.type] || e.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <WarningList warnings={endings?.warnings} />
      </ReportSection>

      {/* Step 4: Pronoun Distribution */}
      <ReportSection title="4. Pronoun Distribution">
        {pronouns?.chapterPronouns?.length > 0 && (
          <>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Ch.</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground text-center">he/him</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground text-center">she/her</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground text-center">they/them</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Dominant</th>
                </tr>
              </thead>
              <tbody>
                {pronouns.chapterPronouns.map((cp, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 text-foreground font-medium">{cp.chNum}</td>
                    <td className="py-1 text-center text-muted-foreground">{cp.he}</td>
                    <td className="py-1 text-center text-muted-foreground">{cp.she}</td>
                    <td className="py-1 text-center text-muted-foreground">{cp.they}</td>
                    <td className="py-1"><Badge variant="outline" className="text-[9px] px-1.5 py-0">{cp.dominant}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(pronouns.dominantCounts || {}).map(([p, c]) => (
                <Badge key={p} variant="secondary" className="text-[9px]">{p}: {c} chapters</Badge>
              ))}
            </div>
          </>
        )}
        <WarningList warnings={pronouns?.warnings} />
      </ReportSection>

      {/* Step 5: Contamination */}
      <ReportSection title="5. Contamination Detector">
        {contamination?.warnings?.length > 0 ? (
          <WarningList warnings={contamination.warnings} />
        ) : (
          <p className="text-xs text-muted-foreground">No contamination detected.</p>
        )}
      </ReportSection>

      {/* Step 6: Length Normalization */}
      <ReportSection title="6. Length Normalization">
        {length && (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg border border-border/50 bg-background/60 p-2 text-center">
                <div className="text-sm font-semibold">{length.min?.toLocaleString()}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Min</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/60 p-2 text-center">
                <div className="text-sm font-semibold">{length.max?.toLocaleString()}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Max</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/60 p-2 text-center">
                <div className="text-sm font-semibold">{length.mean?.toLocaleString()}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Mean</div>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/60 p-2 text-center">
                <div className="text-sm font-semibold">{length.stdDev?.toLocaleString()}</div>
                <div className="text-[9px] uppercase text-muted-foreground">Std Dev</div>
              </div>
            </div>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground">Ch.</th>
                  <th className="pb-1.5 text-[10px] uppercase text-muted-foreground text-right">Words</th>
                </tr>
              </thead>
              <tbody>
                {length.wordCounts?.map((wc, i) => {
                  const deviation = Math.abs(wc.words - length.mean) / length.mean;
                  const isOutlier = deviation > 0.4;
                  return (
                    <tr key={i} className={`border-b border-border/30 ${isOutlier ? 'text-destructive' : ''}`}>
                      <td className="py-1 font-medium">{wc.chNum}</td>
                      <td className="py-1 text-right">{wc.words.toLocaleString()}{isOutlier && ' ⚠️'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        <WarningList warnings={length?.warnings} />
      </ReportSection>

      {/* ── NEW SECTIONS — added for Afterlight-style anthology fixes ── */}

      {/* Literary Atmospheric Cap (only shown when it ran) */}
      {atmospheric?.skipped && (
        <ReportSection title="Literary Atmospheric Cap">
          <div className="text-xs text-muted-foreground">
            Skipped — {atmospheric.skipReason || 'not a literary project'}. This pass substitutes
            words inside metaphor families (water, textile, garden, architecture, math), which would
            rewrite load-bearing nouns in genre fiction.
          </div>
        </ReportSection>
      )}

      {atmospheric && !atmospheric.skipped && (
        <ReportSection title="Literary Atmospheric Cap">
          <div className="text-xs text-muted-foreground">
            {/* WAVE7-ANTHREPORT: describes what this pass actually does — it
                substitutes metaphor-family words, it does not remove sentences. */}
            Thinned repeated metaphor families (water, textile, garden, architecture, math) by
            substituting alternatives — e.g. <em>tide</em> → <em>pull</em>, <em>structure</em> → <em>shape</em>.
            <br />
            <span className="text-foreground font-medium mt-1 inline-block">{atmospheric.totalAdjusted || 0} substitution(s) across the anthology.</span>
          </div>
          {atmospheric.changes?.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">View changes ({atmospheric.changes.length})</summary>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 text-[11px] text-muted-foreground">
                {atmospheric.changes.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </details>
          )}
        </ReportSection>
      )}

      {/* MANUAL REVIEW REQUIRED — flag-only detectors */}
      {/* WAVE7-ANTHREPORT: these detectors return { changes, warnings } where
          warnings are plain strings. The old markup read flag.chapter_number /
          .type / .snippet off objects that never existed, so this whole section
          could never render — the hard-error detector ran and its findings were
          invisible. */}
      {(openers?.warnings?.length > 0 ||
        hardErrors?.warnings?.length > 0 ||
        narrative?.warnings?.length > 0) && (
        <ReportSection title="⚠️ Manual Review Required">
          <p className="text-[11px] text-muted-foreground mb-3">
            Flagged for you to look at — nothing here was changed automatically.
          </p>

          {hardErrors?.warnings?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-destructive mb-2 uppercase tracking-wider">
                Hard Errors ({hardErrors.warnings.length})
              </h4>
              <ul className="space-y-1">
                {hardErrors.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-destructive" />
                    <span className="text-[11px] text-foreground/90">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {openers?.warnings?.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                Repeated Sentence Openers ({openers.warnings.length})
              </h4>
              <ul className="space-y-1">
                {openers.warnings.map((w, i) => (
                  <li key={i} className="rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] text-foreground/90">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {narrative?.warnings?.length > 0 && (
            <div className="mb-2">
              <h4 className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                Narrative Genre Contamination ({narrative.warnings.length})
              </h4>
              <p className="text-[11px] text-muted-foreground mb-2">
                Vocabulary suggesting wrong-genre scene leakage. Consider regenerating from the Bible.
              </p>
              <ul className="space-y-1">
                {narrative.warnings.map((w, i) => (
                  <li key={i} className="rounded-lg bg-yellow-500/10 px-3 py-2 text-[11px] text-foreground/90">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </ReportSection>
      )}
    </div>
  );
}