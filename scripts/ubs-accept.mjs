#!/usr/bin/env node
// scripts/ubs-accept.mjs — ACCEPT-1 (§12 as a machine-checked report)
//
// A Node CLI that reads one project's stored chapters through the SAME
// authenticated, read-only pattern scripts/ubs-run.mjs already uses
// (createStoreClient/readRunnerToken/resolveDataDir — imported, not
// reimplemented), computes every plan §12 acceptance criterion from the real
// detector functions those criteria are defined against, and prints one
// PASS/FAIL/N/A line per criterion plus a final ACCEPTANCE: n/m summary.
// Never calls a store write method (Chapter.update / NovelProject.update).
//
//   node scripts/ubs-accept.mjs --project <id> [--run <runId>] [--json out.json]
//
// Matching ubs-run.mjs's own architecture exactly: every real "@/"-transitive
// detector module (exportSafetyGate.js, malformedSentence.js,
// characterStateLedger.js, aiSlopReduction.js, templateFamilies.js,
// crossChapterDedupe.js, closedWorldText.js, bibliographyGenerator.js,
// bibliographyEntryShape.js, nameGate.js, pronounLock.js, projectType.js,
// sceneDuplicateSweep.js) is imported LAZILY (await import(), inside
// buildAcceptanceReport) — so importing this file, or calling
// fetchProjectMaterial/parseArgs, never needs the alias loader; only
// actually CALLING buildAcceptanceReport does, matching runDraftCommand's
// own lazy-import convention and the reason given in ubs-run.mjs's header.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  resolveDataDir, readRunnerToken, createStoreClient, loadRunState, parseArgs,
} from './ubs-run.mjs';

export const UBS_ACCEPT_VERSION = 'ubs-accept-v1';

const HERE = fileURLToPath(import.meta.url);

function countParagraphs(text) {
  return String(text || '').split(/\n{2,}/).filter((p) => p.trim()).length;
}

function line(key, label, status, detail = '') {
  return { key, label, status, detail };
}

/**
 * Pure — takes already-fetched data, returns the full §12 report. No network
 * I/O, no store writes. `runState` (optional) is the object loadRunState()
 * returns for a --run <runId>; only its per-chapter `paragraphCount` (set at
 * draft time by runDraftCommand) is read here.
 */
export async function buildAcceptanceReport({ project, chapters, runState = null }) {
  const [
    { runPreExportSafetyGate },
    { scanMalformedSentences },
    { buildCharacterState, auditProseAgainstCharacterState },
    { measureSimileDensity, buildBookStyleLedger, SIMILE_DENSITY_BUDGET_PER_1K },
    { TEMPLATE_FAMILIES, computeFamilyBookSpend },
    { findCrossChapterDuplicateSentences },
    { closedWorldCheck },
    { isFrontMatter, isBackMatter, isBodyChapter, countBibliographyEntries },
    { findUnknownPersons, buildFictionEvidence },
    { harvestCastNames },
    { isNonfictionProject },
    { runSceneDuplicateSweep },
  ] = await Promise.all([
    import('../src/lib/exportSafetyGate.js'),
    import('../src/lib/malformedSentence.js'),
    import('../src/lib/characterStateLedger.js'),
    import('../src/lib/aiSlopReduction.js'),
    import('../src/lib/templateFamilies.js'),
    import('../src/lib/crossChapterDedupe.js'),
    import('../src/lib/closedWorldText.js'),
    import('../src/lib/bibliographyGenerator.js'),
    import('../src/lib/nameGate.js'),
    import('../src/lib/pronounLock.js'),
    import('../src/lib/projectType.js'),
    import('../src/lib/sceneDuplicateSweep.js'),
  ]);

  const sortedChapters = chapters.slice().sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
  const bodyChapters = sortedChapters.filter((ch) => isBodyChapter(ch));
  const bodies = bodyChapters.map((ch) => String(ch.content_md || ''));
  const cast = harvestCastNames(project?.characters_md, []);
  const isNF = isNonfictionProject(project);
  const criteria = [];

  // ── export gate: blocked=false, hardFailures=0 ──
  const gate = await runPreExportSafetyGate(sortedChapters, { project });
  criteria.push(line('gate', 'Export gate: blocked=false, hardFailures=0', gate.blocked ? 'FAIL' : 'PASS',
    gate.blocked
      ? (gate.hardFailures || []).map((f) => `Ch.${f.chapterNumber}: ${(f.reasons || [])[0] || 'no reason given'}`).join(' | ')
      : `${(gate.hardFailures || []).length} hard failure(s)`));

  // ── [MALFORMEDSENT] Gate scan: 0 ──
  const malformedTotal = bodyChapters.reduce((sum, ch) => sum + scanMalformedSentences(ch.content_md || '', cast).length, 0);
  criteria.push(line('malformedsent', '[MALFORMEDSENT] Gate scan', malformedTotal === 0 ? 'PASS' : 'FAIL', `${malformedTotal} malformed sentence(s)`));

  // ── DEPARTED_CHARACTER_ACTIVE 0, DUPLICATE_INTRODUCTION 0 — each chapter
  // audited against the state built from ONLY the chapters before it, matching
  // how the live app audits a new chapter against prior history, not the
  // whole (including future) book. ──
  let departedActive = 0;
  let duplicateIntro = 0;
  const charStateFailures = [];
  for (let i = 0; i < bodyChapters.length; i++) {
    const priorChapters = bodyChapters.slice(0, i).map((ch) => ({ chapterNumber: Number(ch.chapter_number), text: ch.content_md || '' }));
    const state = buildCharacterState(priorChapters, cast);
    const violations = auditProseAgainstCharacterState(bodyChapters[i].content_md || '', state, cast);
    for (const v of violations) {
      if (v.code === 'DEPARTED_CHARACTER_ACTIVE') departedActive += 1;
      else if (v.code === 'DUPLICATE_INTRODUCTION') duplicateIntro += 1;
      charStateFailures.push(`Ch.${bodyChapters[i].chapter_number}: ${v.code} (${v.name})`);
    }
  }
  criteria.push(line('departed-character', 'DEPARTED_CHARACTER_ACTIVE 0', departedActive === 0 ? 'PASS' : 'FAIL', `${departedActive} violation(s)`));
  criteria.push(line('duplicate-introduction', 'DUPLICATE_INTRODUCTION 0', duplicateIntro === 0 ? 'PASS' : 'FAIL', `${duplicateIntro} violation(s)`));

  // ── EVENT_CLASS_REPLAY 0 — N/A. This is a DRAFT-TIME guard: the live app
  // (sceneWriter.js) audits each new scene against an in-memory
  // `runtimeLedger` accumulated turn-by-turn as the book is written. That
  // ledger is ephemeral and is never persisted to the store, so a
  // finished-book, read-from-the-store report has no `prior_completed_events`
  // to reconstruct — there is nothing correct to compute here after the fact. ──
  criteria.push(line('event-class-replay', 'EVENT_CLASS_REPLAY 0', 'N/A',
    'draft-time-only check against an in-memory runtime ledger never persisted to the store — not reconstructable from a finished book'));

  // ── same-chapter scene dups 0. NOTE: src/lib/sceneDuplicateSweep.js
  // declares itself dead code in its own header (nothing imports it; the
  // live implementation is an inline fork in src/pages/ProjectStudio.jsx)
  // — this measures the standalone library function the plan named
  // (sceneDuplicateSweep.js:793), not necessarily the exact code path the
  // running app takes. Flagged here, not silently swapped for a guess. ──
  const dupeLoaded = bodyChapters.map((ch) => ({ chapter: ch, content: ch.content_md || '', original: ch.content_md || '' }));
  const dupeReport = runSceneDuplicateSweep(dupeLoaded, null, {});
  const sceneDupeCount = (dupeReport.chapterReports || []).reduce((sum, r) => sum + (r.removals || []).length + (r.reportedOnly || 0), 0);
  criteria.push(line('scene-dupes', 'Same-chapter scene duplicates 0', sceneDupeCount === 0 ? 'PASS' : 'FAIL',
    `${sceneDupeCount} duplicate block(s) [measured against src/lib/sceneDuplicateSweep.js — see note: this file is dead code per its own header; the live app uses an inline fork in ProjectStudio.jsx]`));

  // ── simile density ≤ 3.0/1k book-wide, per-chapter max ──
  const styleLedger = buildBookStyleLedger(bodies);
  const bookWidePer1k = styleLedger.simile.per1k;
  let maxChapterPer1k = 0;
  let maxChapterNum = null;
  for (const ch of bodyChapters) {
    const d = measureSimileDensity(ch.content_md || '');
    if (d.per1k > maxChapterPer1k) { maxChapterPer1k = d.per1k; maxChapterNum = ch.chapter_number; }
  }
  criteria.push(line('simile-density', `Simile density ≤ ${SIMILE_DENSITY_BUDGET_PER_1K}/1k book-wide`,
    bookWidePer1k <= SIMILE_DENSITY_BUDGET_PER_1K ? 'PASS' : 'FAIL',
    `book-wide ${bookWidePer1k}/1k; per-chapter max ${maxChapterPer1k}/1k (Ch.${maxChapterNum})`));

  // ── every template family within budget ──
  const familySpend = computeFamilyBookSpend(bodies);
  const overBudget = TEMPLATE_FAMILIES.filter((f) => (familySpend[f.name] || 0) > f.bookBudget);
  criteria.push(line('template-budget', 'Every template family within its book budget', overBudget.length === 0 ? 'PASS' : 'FAIL',
    overBudget.map((f) => `${f.name}: ${familySpend[f.name]}/${f.bookBudget}`).join(', ')
    || TEMPLATE_FAMILIES.map((f) => `${f.name}: ${familySpend[f.name] || 0}/${f.bookBudget}`).join(', ')));

  // ── cross-chapter 12+-word duplicates 0 ──
  const crossDupes = findCrossChapterDuplicateSentences(bodyChapters.map((ch) => ({ chapterNumber: Number(ch.chapter_number), text: ch.content_md || '' })));
  criteria.push(line('cross-chapter-dupes', 'Cross-chapter 12+-word duplicates 0', crossDupes.length === 0 ? 'PASS' : 'FAIL',
    crossDupes.slice(0, 5).map((d) => `Ch.${d.a}→Ch.${d.b}: "${d.sentence.slice(0, 60)}…"`).join(' | ')));

  // ── quote balance 100% every chapter — read from the gate's own per-chapter
  // entries (present only on chapters that reached BOOKGATE-2 inside the
  // gate's loop; a chapter that hard-failed earlier never gets a `.structural`
  // field, reported separately as "not reached" rather than silently PASS). ──
  const allGateEntries = [...(gate.passed || []), ...(gate.warnings || []), ...(gate.hardFailures || [])];
  const withStructural = allGateEntries.filter((e) => e.structural);
  const unbalanced = withStructural.filter((e) => !e.structural.quoteBalance?.pass);
  const notReached = bodyChapters.length - withStructural.length;
  criteria.push(line('quote-balance', 'Quote balance 100% every chapter', (unbalanced.length === 0 && notReached === 0) ? 'PASS' : 'FAIL',
    `${unbalanced.length} unbalanced chapter(s)${notReached > 0 ? `, ${notReached} chapter(s) not reached by the gate's structural check` : ''}`));

  // ── paragraph count before polish == after polish (± allowances) ──
  if (runState) {
    const mismatches = [];
    let anyMeasured = false;
    for (const ch of bodyChapters) {
      const before = runState.chapters?.[ch.id]?.paragraphCount;
      if (before === undefined) continue;
      anyMeasured = true;
      const after = countParagraphs(ch.content_md || '');
      if (before !== after) mismatches.push(`Ch.${ch.chapter_number}: draft ${before} → current ${after}`);
    }
    criteria.push(line('paragraph-count', 'Paragraph count before polish == after polish',
      !anyMeasured ? 'N/A' : (mismatches.length === 0 ? 'PASS' : 'FAIL'),
      !anyMeasured ? 'no chapter in this run has a recorded draft-stage paragraphCount' : mismatches.join(' | ')));
  } else {
    criteria.push(line('paragraph-count', 'Paragraph count before polish == after polish', 'N/A', 'no --run <runId> given'));
  }

  // ── NF-only criteria ──
  if (isNF) {
    const closedWorldTotal = bodyChapters.reduce((sum, ch) => sum + closedWorldCheck(ch.content_md || '', project).length, 0);
    criteria.push(line('closed-world', 'NF closed-world flags 0', closedWorldTotal === 0 ? 'PASS' : 'FAIL', `${closedWorldTotal} flag(s)`));

    // TEMPORAL-1 has no dedicated field on the gate's return object (per-chapter
    // stats are local to the gate's own loop) — inferred from hardFailures
    // shaped exactly like its push site (chapter-level, recommendedAction
    // REJECT_REGENERATE). This is the ONLY currently-active hard-failure at
    // that shape while MALFORMEDSENT_HARD_BLOCK/NAMEGATE_HARD_BLOCK stay
    // false; if either flips true this proxy would need to also exclude them.
    const temporalCount = (gate.hardFailures || []).filter((f) => f.recommendedAction === 'REJECT_REGENERATE' && typeof f.chapterNumber === 'number').length;
    criteria.push(line('temporal', 'TEMPORAL-1 0', temporalCount === 0 ? 'PASS' : 'FAIL', `${temporalCount} chapter(s)`));

    const backMatter = sortedChapters.filter((ch) => isBackMatter(ch));
    const bestEntryCount = backMatter.reduce((best, ch) => Math.max(best, countBibliographyEntries(ch.content_md || '')), 0);
    criteria.push(line('sources-present', 'NF Sources section present (≥4 entries)', bestEntryCount >= 4 ? 'PASS' : 'FAIL', `best back-matter chapter has ${bestEntryCount} entries`));

    criteria.push(line('namegate', '[NAMEGATE-1] (fiction-only)', 'N/A', 'nonfiction project'));

    const isAnthology = String(project?.project_type || '').toLowerCase() === 'anthology' || Boolean(project?.anthology_theme);
    if (!isAnthology) {
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology-only)', 'N/A', 'not an anthology project'));
    } else if (typeof project?.research_data !== 'string' || !project.research_data) {
      // NFANTH-CW-1's shared research corpus lives on the PROJECT, not per
      // chapter (getProjectResearchText resolves it via
      // resolveResearchContent(project) — see src/lib/sceneWriter.js); a
      // project with no research_data has nothing to fence-check.
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology)', 'N/A', 'project has no research_data to audit'));
    } else {
      const { buildStoryEntityOwnership, fenceForeignEntities } = await import('../src/lib/storyEntityOwnership.js');
      const ownership = buildStoryEntityOwnership(project, sortedChapters);
      const fencedByChapter = bodyChapters
        .map((ch) => ({ chapterNumber: ch.chapter_number, fenced: fenceForeignEntities(project.research_data, ownership, Number(ch.chapter_number)).fenced }))
        .filter((r) => r.fenced.length > 0);
      const totalFenced = fencedByChapter.reduce((sum, r) => sum + r.fenced.length, 0);
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology)', totalFenced === 0 ? 'PASS' : 'FAIL',
        totalFenced === 0 ? '0 foreign paragraph(s) fenced' : fencedByChapter.map((r) => `Ch.${r.chapterNumber}: ${r.fenced.length} foreign paragraph(s)`).join(' | ')));
    }
  } else {
    // ── fiction-only: [NAMEGATE-1] unknown persons 0 ──
    const evidence = buildFictionEvidence(project, { chapters: [] });
    const namegateTotal = bodyChapters.reduce((sum, ch) => sum + findUnknownPersons(ch.content_md || '', { evidence, cast }).length, 0);
    criteria.push(line('namegate', '[NAMEGATE-1] Gate scan: unknown persons 0', namegateTotal === 0 ? 'PASS' : 'FAIL', `${namegateTotal} unknown person mention(s)`));

    for (const key of ['closed-world', 'temporal', 'sources-present', 'cross-case-atoms']) {
      criteria.push(line(key, `${key} (nonfiction-only)`, 'N/A', 'fiction project'));
    }
  }

  // ── front matter present, body ≥ 1 chapter, back matter (NF) ──
  criteria.push(line('front-matter', 'Front matter present', sortedChapters.some((ch) => isFrontMatter(ch)) ? 'PASS' : 'FAIL', ''));
  criteria.push(line('body-chapters', 'Body ≥ 1 chapter', bodyChapters.length >= 1 ? 'PASS' : 'FAIL', `${bodyChapters.length} body chapter(s)`));
  if (isNF) {
    criteria.push(line('back-matter', 'Back matter present (NF)', sortedChapters.some((ch) => isBackMatter(ch)) ? 'PASS' : 'FAIL', ''));
  } else {
    criteria.push(line('back-matter', 'Back matter present (nonfiction-only)', 'N/A', 'fiction project'));
  }

  // ── DOCX opens and reads to the end — always a human step ──
  criteria.push(line('docx-open', 'DOCX opens and reads to the end', 'N/A', 'human step — not machine-checkable'));

  const scored = criteria.filter((c) => c.status !== 'N/A');
  const passed = scored.filter((c) => c.status === 'PASS');
  const allPass = passed.length === scored.length;
  const summary = `ACCEPTANCE: ${passed.length}/${scored.length} criteria PASS`;

  return { criteria, allPass, summary, scoredCount: scored.length, passedCount: passed.length };
}

/**
 * Thin fetch boundary — the only place this script talks to the store.
 * Read-only: NovelProject.get and Chapter.filter only, never .update.
 */
export async function fetchProjectMaterial({ store, projectId, dataDir, runId }) {
  const project = await store.NovelProject.get(projectId);
  const chapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
  const runState = runId ? loadRunState(dataDir, runId) : null;
  return { project, chapters, runState };
}

function printReport(report) {
  for (const c of report.criteria) {
    console.log(`${c.status.padEnd(4)} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\n${report.summary}`);
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const { flags } = parseArgs(['accept', ...argv]);
  if (!flags.project) {
    console.error('Usage: ubs-accept.mjs --project <id> [--run <runId>] [--json out.json]');
    process.exitCode = 1;
    return;
  }
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });

  const { project, chapters, runState } = await fetchProjectMaterial({ store, projectId: flags.project, dataDir, runId: flags.run });
  const report = await buildAcceptanceReport({ project, chapters, runState });
  printReport(report);

  if (flags.json) {
    fs.writeFileSync(path.resolve(String(flags.json)), JSON.stringify(report, null, 2));
  }
  process.exitCode = report.allPass ? 0 : 1;
}

const isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  if (!process.env.__UBS_ACCEPT_RELAUNCHED) {
    const aliasLoader = fileURLToPath(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--loader', aliasLoader, HERE, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, __UBS_ACCEPT_RELAUNCHED: '1' },
    });
    process.exit(result.status ?? 1);
  } else {
    main(process.argv.slice(2)).catch((err) => {
      console.error('[ACCEPT-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
