#!/usr/bin/env node
// scripts/proselab-summary.mjs — PROSELAB-1 report script (UBS_plan.md Phase 0.3)
//
// Reads ProseLabCapture records for one project through the app's real store
// API (the same runner-token auth scripts/ubs-run.mjs uses — never reads or
// writes data/ JSON directly) and prints per-scene prompt sizes, a section
// breakdown, and attempt counts. Read-only; makes no generation calls.
//
//   node scripts/proselab-summary.mjs --project <id>
//
// Relative imports only (test/proselab1.acceptance.mjs imports the pure
// summarizer/formatter functions directly under bare Node). ubs-run.mjs's
// own imports are all Node builtins, so importing it here does not need the
// alias loader ubs-run.mjs itself uses for its @/-importing commands.

import { readRunnerToken, resolveDataDir } from './ubs-run.mjs';
import { pathToFileURL } from 'node:url';

export const PROSELAB_SUMMARY_VERSION = 'proselab-summary-v1';

export function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    }
  }
  return flags;
}

export async function fetchCaptures({ baseUrl, token, projectId, fetchImpl = fetch }) {
  const query = projectId ? { project_id: projectId } : {};
  const res = await fetchImpl(`${baseUrl}/api/store/ProseLabCapture/filter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-ubs-runner-token': token },
    body: JSON.stringify({ query, sort: 'timestamp' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`ProseLabCapture filter failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Pure summarizer — no I/O. One row per captured attempt, plus aggregate
 * totals and a per-key average across every record's prompt_sections.
 *
 * Phase 0 note: prompt_sections is best-effort and will be empty on most
 * records today — the compiled prompt's named sub-blocks are not exposed at
 * the wrapped call sites without instrumenting buildFictionPrompt's
 * internals, which this capture-only phase deliberately does not do (see
 * docs/pipeline-map.md §1, src/lib/proseLab.js).
 */
export function summarizeCaptures(records = []) {
  const scenes = records
    .slice()
    .sort((a, b) =>
      (a.chapter ?? 0) - (b.chapter ?? 0) ||
      String(a.scene_id).localeCompare(String(b.scene_id)) ||
      (a.attempt ?? 0) - (b.attempt ?? 0)
    )
    .map((r) => ({
      chapter: r.chapter ?? null,
      sceneId: r.scene_id ?? null,
      attempt: r.attempt ?? 1,
      model: r.model ?? null,
      promptCharCount: r.prompt_char_count ?? 0,
      outputWordCount: r.output_word_count ?? 0,
      accepted: r.accepted !== false,
      repairReason: r.repair_reason ?? null,
    }));

  const attemptCounts = {};
  for (const r of records) {
    const n = r.attempt ?? 1;
    attemptCounts[n] = (attemptCounts[n] || 0) + 1;
  }

  const promptCharCounts = records.map((r) => r.prompt_char_count ?? 0).filter((n) => Number.isFinite(n));
  const avgPromptCharCount = promptCharCounts.length
    ? Math.round(promptCharCounts.reduce((a, b) => a + b, 0) / promptCharCounts.length)
    : 0;
  const maxPromptCharCount = promptCharCounts.length ? Math.max(...promptCharCounts) : 0;

  const sectionTotals = {};
  const sectionCounts = {};
  for (const r of records) {
    const sections = r.prompt_sections && typeof r.prompt_sections === 'object' ? r.prompt_sections : {};
    for (const [key, value] of Object.entries(sections)) {
      if (typeof value !== 'number') continue;
      sectionTotals[key] = (sectionTotals[key] || 0) + value;
      sectionCounts[key] = (sectionCounts[key] || 0) + 1;
    }
  }
  const sectionAverages = Object.fromEntries(
    Object.keys(sectionTotals).map((key) => [key, Math.round(sectionTotals[key] / sectionCounts[key])])
  );

  return {
    totalRecords: records.length,
    attemptCounts,
    avgPromptCharCount,
    maxPromptCharCount,
    sectionAverages,
    scenes,
  };
}

export function formatSummaryReport(summary, { projectId } = {}) {
  const lines = [];
  lines.push(`PROSE LAB SUMMARY${projectId ? ` — project ${projectId}` : ''}`);
  lines.push(`Records: ${summary.totalRecords}`);
  lines.push(`Attempt counts: ${Object.entries(summary.attemptCounts).map(([n, c]) => `attempt ${n}: ${c}`).join(', ') || 'none'}`);
  lines.push(`Prompt size — avg ${summary.avgPromptCharCount} chars, max ${summary.maxPromptCharCount} chars`);
  if (Object.keys(summary.sectionAverages).length) {
    lines.push('Section breakdown (avg chars, records that reported a value):');
    for (const [key, value] of Object.entries(summary.sectionAverages)) {
      lines.push(`  ${key}: ${value}`);
    }
  } else {
    lines.push('Section breakdown: none reported (Phase 0 scope — see docs/pipeline-map.md §1)');
  }
  lines.push('');
  lines.push('Per-scene:');
  for (const s of summary.scenes) {
    lines.push(
      `  Ch.${s.chapter ?? '?'} ${s.sceneId ?? '?'} attempt ${s.attempt} [${s.model ?? '?'}] `
      + `prompt ${s.promptCharCount} chars, output ${s.outputWordCount} words, accepted=${s.accepted}`
      + `${s.repairReason ? `, reason=${s.repairReason}` : ''}`
    );
  }
  return lines.join('\n');
}

async function main(argv) {
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: proselab-summary.mjs --project <id>');
    process.exitCode = 1;
    return;
  }
  const dataDir = resolveDataDir();
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const records = await fetchCaptures({ baseUrl, token, projectId: flags.project });
  const summary = summarizeCaptures(records);
  console.log(formatSummaryReport(summary, { projectId: flags.project }));
}

const isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  main(process.argv.slice(2)).catch((err) => {
    console.error('[PROSELAB] fatal:', err?.stack || err);
    process.exitCode = 1;
  });
}
