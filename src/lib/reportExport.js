/**
 * WAVE7-REPORTEXPORT — let the Tools tab's expensive reports leave the screen.
 *
 * Critic, Compare, Analytics and the Anthology polish report were all
 * display-only: ToolsTab unmounts the active sub-page on every tool switch, so a
 * 40-chapter deep critique (~120 sequential local-model calls — the most
 * expensive artifact the app produces) was destroyed by a single click. A
 * novelist wants that report open beside the manuscript for a month, or handed
 * to a beta reader or a developmental editor.
 *
 * Markdown, because it pastes into anything and survives.
 */

export function downloadMarkdown(filename, markdown) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function slugify(value, fallback = 'manuscript') {
  const s = String(value || '').trim().toLowerCase()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 60);
  return s || fallback;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function reportFilename(project, kind) {
  return `${slugify(project?.title)}-${kind}-${stamp()}.md`;
}

function header(project, title) {
  const bits = [
    `# ${title}`,
    '',
    `**${project?.title || 'Untitled'}**${project?.author_name ? ` · ${project.author_name}` : ''}`,
    `${project?.genre || 'Unspecified genre'} · generated ${stamp()} by Unity Book Studio`,
    '',
    '---',
    '',
  ];
  return bits.join('\n');
}

const list = (items, bullet = '-') =>
  (items || []).filter(Boolean).map((i) => `${bullet} ${typeof i === 'string' ? i : JSON.stringify(i)}`).join('\n');

/* ── Critic: deep critique + reviewer panel ─────────────────────────────── */
export function buildCritiqueMarkdown(project, critiqueResults, panelReviews, consensus) {
  let md = header(project, 'Editorial Critique');

  const syn = critiqueResults?.synthesis;
  if (syn) {
    md += '## Synthesis\n\n';
    if (syn.dashboard?.length) {
      md += '| Area | Score | Verdict |\n|---|---|---|\n';
      for (const d of syn.dashboard) md += `| ${d.area} | ${d.score} | ${d.verdict || ''} |\n`;
      md += '\n';
    }
    if (syn.threadWatch?.length) md += `### Thread Watch\n${list(syn.threadWatch)}\n\n`;
    if (syn.marketability) md += `### Marketability\n${syn.marketability}\n\n`;
    if (syn.priorityFixList?.length) {
      md += '## Priority Fix List\n\n';
      for (const f of syn.priorityFixList) {
        md += `- **[${f.severity}] Ch.${f.chapterNumber}** — ${f.description}\n`;
        if (f.quote) md += `  > ${String(f.quote).replace(/\n/g, ' ')}\n`;
      }
      md += '\n';
    }
  }

  const plan = critiqueResults?.planReport;
  if (plan?.planAvailable && plan.beatDelivery?.length) {
    md += '## Outline Delivery\n\n';
    for (const b of plan.beatDelivery) {
      md += `### Chapter ${b.chapterNumber}\n`;
      if (b.beatsMissing?.length) md += `**Missing:** ${b.beatsMissing.join(' · ')}\n\n`;
      if (b.beatsAltered?.length) md += `**Altered:** ${b.beatsAltered.join(' · ')}\n\n`;
      if (b.beatsDelivered?.length) md += `**Delivered:** ${b.beatsDelivered.join(' · ')}\n\n`;
    }
  }

  if (critiqueResults?.chapterCritiques?.length) {
    md += '## Per-Chapter Critique\n\n';
    for (const c of critiqueResults.chapterCritiques) {
      md += `### Chapter ${c.chapterNumber}${c.title ? ` — ${c.title}` : ''}\n\n`;
      if (c.strengths?.length) md += `**Strengths**\n${list(c.strengths.map((s) => s.description || s))}\n\n`;
      if (c.weaknesses?.length) {
        md += '**Weaknesses**\n';
        for (const w of c.weaknesses) {
          md += `- [${w.severity}] ${w.description}${w.fixType ? ` _(${w.fixType})_` : ''}\n`;
          if (w.quote) md += `  > ${String(w.quote).replace(/\n/g, ' ')}\n`;
        }
        md += '\n';
      }
    }
  }

  if (panelReviews?.length) {
    md += '## Reviewer Panel\n\n';
    if (consensus) {
      md += `**Critic:** ${consensus.critic?.percent_fresh}% fresh · **Audience:** ${consensus.audience?.percent_fresh}% fresh\n\n`;
    }
    for (const r of panelReviews) {
      md += `### ${r.outlet} — ${r.rating_display || r.rating_label}\n\n${r.review}\n\n`;
      if (r.summary_line) md += `_${r.summary_line}_\n\n`;
      if (r.topFixes?.length) md += `**Would fix:**\n${list(r.topFixes)}\n\n`;
    }
  }
  return md;
}

/* ── Compare ────────────────────────────────────────────────────────────── */
export function buildCompareMarkdown(project, versionA, versionB, verdict, winner) {
  let md = header(project, 'Version Comparison');
  md += `**A:** ${versionA?.name || 'Version A'}  \n**B:** ${versionB?.name || 'Version B'}\n\n`;
  if (winner) md += `**Mechanical winner:** ${winner}\n\n`;

  const a = versionA?.metrics || {};
  const b = versionB?.metrics || {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  if (keys.length) {
    md += '## Metrics\n\n| Metric | A | B |\n|---|---|---|\n';
    for (const k of keys) md += `| ${k} | ${a[k] ?? '—'} | ${b[k] ?? '—'} |\n`;
    md += '\n';
  }

  if (verdict) {
    md += '## Editorial Verdict\n\n';
    if (verdict.winner) md += `**Winner:** ${verdict.winner}${verdict.confidence ? ` (${verdict.confidence} confidence)` : ''}\n\n`;
    if (verdict.improvements?.length) md += `### Improvements\n${list(verdict.improvements)}\n\n`;
    if (verdict.regressions?.length) md += `### Regressions\n${list(verdict.regressions)}\n\n`;
    if (verdict.verdict) md += `${verdict.verdict}\n\n`;
  }
  return md;
}

/* ── Analytics ──────────────────────────────────────────────────────────── */
export function buildAnalyticsMarkdown(project, stats, chapterMetrics, forensic, evidence) {
  let md = header(project, 'Manuscript Analytics');

  if (stats) {
    md += '## Overview\n\n';
    for (const [k, v] of Object.entries(stats)) {
      if (v == null || typeof v === 'object') continue;
      md += `- **${k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}:** ${v}\n`;
    }
    md += '\n';
  }

  if (chapterMetrics?.length) {
    md += '## Per-Chapter\n\n| Ch | Title | Words | Dialogue % | Readability | Vocab % | AI Risk |\n|---|---|---|---|---|---|---|\n';
    for (const c of chapterMetrics) {
      md += `| ${c.chapterNumber ?? ''} | ${c.title || ''} | ${c.wordCount ?? ''} | ${c.dialogueRatio ?? ''} | ${c.readability ?? ''} | ${c.vocabDiversity ?? ''} | ${c.aiRisk ?? ''} |\n`;
    }
    md += '\n';
  }

  if (forensic) {
    md += '## Forensic Audit\n\n';
    for (const [k, v] of Object.entries(forensic)) {
      if (v == null || typeof v === 'object') continue;
      md += `- **${k}:** ${v}\n`;
    }
    md += '\n';
  }

  if (evidence?.chapters?.length) {
    md += '## Evidence Engine — quality gate\n\n| Ch | Words | Slop | Action |\n|---|---|---|---|\n';
    for (const c of evidence.chapters) {
      md += `| ${c.chapterNumber ?? ''} | ${c.words ?? ''} | ${c.slopDensity ?? ''} | ${c.qualityGateAction || ''} |\n`;
    }
    md += '\n';
  }
  return md;
}

/* ── Anthology polish ───────────────────────────────────────────────────── */
export function buildAnthologyMarkdown(project, report) {
  let md = header(project, 'Anthology Polish Report');
  md += `${report?.savedCount ?? 0} chapters modified · ${report?.dedup?.totalRewritten ?? 0} phrases rewritten\n\n`;

  const section = (title, items) => {
    if (!items?.length) return '';
    return `## ${title}\n${list(items)}\n\n`;
  };

  md += section('Contamination fixes', report?.contamFix?.changes);
  md += section('Body-language dedup', report?.bodyLang?.changes);
  md += section('Vocabulary bans', report?.anthVocab?.changes);
  if (report?.atmospheric?.skipped) {
    md += `## Literary Atmospheric Cap\nSkipped — ${report.atmospheric.skipReason || 'not a literary project'}.\n\n`;
  } else {
    md += section('Literary atmospheric cap', report?.atmospheric?.changes);
  }
  md += section('Cross-chapter phrase dedup', report?.dedup?.changes);

  const flags = [
    ...(report?.hardErrors?.warnings || []).map((w) => `**Hard error:** ${w}`),
    ...(report?.openers?.warnings || []).map((w) => `**Repeated opener:** ${w}`),
    ...(report?.narrative?.warnings || []).map((w) => `**Genre contamination:** ${w}`),
  ];
  md += section('⚠️ Manual review required', flags);
  return md;
}
