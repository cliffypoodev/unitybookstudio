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
 * Takes already-fetched data, returns the full §12 report. No store writes,
 * ever. NOT unconditionally network-free, though: for a project with
 * series_bible_id set, runPreExportSafetyGate's own Series Contract Gate
 * lazily reaches a real network call (a SeriesBible read, fail-open,
 * wrapped in try/catch) — a pre-existing property of the gate this script
 * calls directly, not something added here. `runState` (optional) is the
 * object loadRunState() returns for a --run <runId>; only its per-chapter
 * `paragraphCount` (set at draft time by runDraftCommand) is read here.
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
    { buildPriorChapterEventLedger },
    { findProseEventCollisions },
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
    import('../src/lib/eventLedger.js'),
    import('../src/lib/eventCollision.js'),
  ]);

  const sortedChapters = chapters.slice().sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));
  const bodyChapters = sortedChapters.filter((ch) => isBodyChapter(ch));
  const bodies = bodyChapters.map((ch) => String(ch.content_md || ''));
  // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: exportSafetyGate.js derives cast
  // two different, DELIBERATELY different ways depending on the check. A
  // sheet-only bible (numbered/heading/bold entries) covers most real
  // projects, but a plain-paragraph bio or an all-caps initialism name yields
  // an empty/incomplete sheet-only cast — MALFORMEDSENT-1 (msCast) and
  // CHARSTATE-1 (stateCastNames) both fold in chapter prose as a second
  // name-discovery source for exactly this reason (exportSafetyGate.js:718,
  // 895); an empty cast here would silently disable all
  // DEPARTED_CHARACTER_ACTIVE/DUPLICATE_INTRODUCTION detection. NAMEGATE-1
  // stays sheet-ONLY on purpose (exportSafetyGate.js:774, "NAMEGATE-1B": a
  // name invented only in prose must still register as unknown, so folding
  // prose into ITS cast would blind the gate to that exact defect).
  const cast = harvestCastNames(project?.characters_md, bodies);
  const namegateCast = harvestCastNames(project?.characters_md, []);
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

  // ── EVENT_CLASS_REPLAY 0 — PARTIAL, disclosed as such. The live app
  // (sceneWriter.js) audits each new SCENE against an in-memory
  // `runtimeLedger` accumulated turn-by-turn as the book is written; that
  // ledger's WITHIN-chapter (scene-to-scene) portion is ephemeral and never
  // persisted, so it cannot be reconstructed here. But the CROSS-chapter
  // portion — the headline scenario EVENTLEDGER-1B/SCENECOLLIDE-1 were built
  // to catch, a chapter re-staging an event a PRIOR chapter's own persisted
  // beat contract already completed — reads entirely from
  // chapter.scene_beats_json, which IS in the store. Reconstructing that with
  // the exact same functions the live app uses (buildPriorChapterEventLedger,
  // findProseEventCollisions) is strictly more honest than a blanket N/A;
  // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS. ──
  {
    let crossChapterReplay = 0;
    const replayHits = [];
    for (const ch of bodyChapters) {
      const ledger = buildPriorChapterEventLedger(bodyChapters, Number(ch.chapter_number));
      if (!ledger.events.length) continue;
      const collisions = findProseEventCollisions(ledger.events, ch.content_md || '');
      crossChapterReplay += collisions.length;
      if (collisions.length) replayHits.push(`Ch.${ch.chapter_number}: ${collisions.length} re-staged event(s)`);
    }
    criteria.push(line('event-class-replay', 'EVENT_CLASS_REPLAY 0 (cross-chapter only)', crossChapterReplay === 0 ? 'PASS' : 'FAIL',
      crossChapterReplay === 0
        ? '0 cross-chapter replay(s) — within-chapter (scene-to-scene) replay uses an in-memory runtime ledger never persisted to the store and is not covered by this criterion'
        : replayHits.join(' | ')));
  }

  // ── same-chapter scene dups 0. NOTE (ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS,
  // strengthened): src/lib/sceneDuplicateSweep.js declares itself dead code in
  // its own header (nothing imports it; the live implementation is an inline
  // fork in src/pages/ProjectStudio.jsx) — this measures the standalone
  // library function the plan named (sceneDuplicateSweep.js:793). This is NOT
  // merely "a slightly stale copy": the two implementations have diverged in
  // their confidence thresholds (e.g. maxRemovalRatioPerChapter 0.55 here vs.
  // 0.10 live) and CAN, and empirically do, produce OPPOSITE PASS/FAIL
  // verdicts on the identical manuscript — a paraphrased (non-verbatim)
  // alternate-draft duplicate can score FAIL here while the live app's own
  // pipeline would only flag it for human review, not block on it. Treat this
  // criterion's result as informational about this specific library function,
  // not as a proxy for what the shipping app would actually do. ──
  const dupeLoaded = bodyChapters.map((ch) => ({ chapter: ch, content: ch.content_md || '', original: ch.content_md || '' }));
  const dupeReport = runSceneDuplicateSweep(dupeLoaded, null, {});
  const sceneDupeCount = (dupeReport.chapterReports || []).reduce((sum, r) => sum + (r.removals || []).length + (r.reportedOnly || 0), 0);
  criteria.push(line('scene-dupes', 'Same-chapter scene duplicates 0', sceneDupeCount === 0 ? 'PASS' : 'FAIL',
    `${sceneDupeCount} duplicate block(s) [measured against the dead-code src/lib/sceneDuplicateSweep.js, NOT the live inline fork in ProjectStudio.jsx — the two can produce opposite verdicts on the same input; treat this as informational, not a proxy for live app behavior]`));

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
  // field, reported separately as "not reached" rather than silently PASS).
  // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: match entries to body chapters
  // BY CHAPTER NUMBER, not by comparing two differently-scoped counts — the
  // gate ran on ALL chapters (front/back matter included), so a scanned
  // front-matter entry could previously pad the "reached" count and mask an
  // un-scanned BODY chapter that hard-failed earlier in the gate's own
  // pipeline (before BOOKGATE-2 ever computed .structural). ──
  const allGateEntries = [...(gate.passed || []), ...(gate.warnings || []), ...(gate.hardFailures || [])];
  const entryByChapterNumber = new Map(allGateEntries.filter((e) => typeof e.chapterNumber === 'number').map((e) => [e.chapterNumber, e]));
  const bodyChapterEntries = bodyChapters.map((ch) => entryByChapterNumber.get(Number(ch.chapter_number)));
  const notReached = bodyChapterEntries.filter((e) => !e || !e.structural).length;
  const unbalanced = bodyChapterEntries.filter((e) => e && e.structural && !e.structural.quoteBalance?.pass).length;
  criteria.push(line('quote-balance', 'Quote balance 100% every chapter', (unbalanced === 0 && notReached === 0) ? 'PASS' : 'FAIL',
    `${unbalanced} unbalanced chapter(s)${notReached > 0 ? `, ${notReached} body chapter(s) not reached by the gate's structural check` : ''}`));

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
    // stats are local to the gate's own loop) — inferred from hardFailures.
    // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: the shape alone
    // (chapterNumber: number, recommendedAction: 'REJECT_REGENERATE') is NOT
    // unique to TEMPORAL-1 — manuscriptSafetyGate.js's own critical
    // process-leak/contamination push uses the exact same shape, for every
    // project type, and was misattributed as a temporal violation before this
    // fix. TEMPORAL-1's own reasons are always prefixed literally
    // "[TEMPORAL-1]" (exportSafetyGate.js's push site), so match on that
    // instead of the shape alone.
    const temporalCount = (gate.hardFailures || []).filter((f) => typeof f.chapterNumber === 'number' && (f.reasons || []).some((r) => String(r).startsWith('[TEMPORAL-1]'))).length;
    criteria.push(line('temporal', 'TEMPORAL-1 0', temporalCount === 0 ? 'PASS' : 'FAIL', `${temporalCount} chapter(s)`));

    const backMatter = sortedChapters.filter((ch) => isBackMatter(ch));
    const bestEntryCount = backMatter.reduce((best, ch) => Math.max(best, countBibliographyEntries(ch.content_md || '')), 0);
    criteria.push(line('sources-present', 'NF Sources section present (≥4 entries)', bestEntryCount >= 4 ? 'PASS' : 'FAIL', `best back-matter chapter has ${bestEntryCount} entries`));

    criteria.push(line('namegate', '[NAMEGATE-1] (fiction-only)', 'N/A', 'nonfiction project'));

    const isAnthology = String(project?.project_type || '').toLowerCase() === 'anthology' || Boolean(project?.anthology_theme);
    // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: this used to read
    // project.research_data — the WRONG field. The real app always writes
    // research_data as a JSON-stringified structured object
    // (key_figures/key_events/timeline; see src/pages/ProjectStudio.jsx and
    // researchStorage.js's describeResearchSize, which parses research_data
    // expecting exactly that shape) — not prose, so fenceForeignEntities
    // could never find anything fenceable there and this criterion was an
    // unconditional hollow PASS on every real anthology project, not merely
    // N/A when data was missing. The live NFANTH-CW-1 fencing
    // (sceneWriter.js's getProjectResearchText) actually resolves prose via
    // resolveResearchContent(project), which reads project.research_md
    // (falling back to project.research_md_url with a network fetch for
    // legacy records). Reading research_md directly here, deliberately NOT
    // calling resolveResearchContent, to keep this report free of network
    // calls beyond the one already-disclosed exception (the gate's Series
    // Contract check) — RESEARCHQUALITY-2B keeps research_md full and inline
    // on every save, so a URL-only fallback should only affect legacy
    // records, reported N/A below rather than silently measuring nothing.
    const researchMd = String(project?.research_md || '');
    const researchIsStub = researchMd.includes('[Full research stored externally]') || researchMd.length < 600;
    if (!isAnthology) {
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology-only)', 'N/A', 'not an anthology project'));
    } else if (!researchMd || researchIsStub) {
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology)', 'N/A',
        !researchMd ? 'project has no research_md to audit' : 'research_md is a URL-backed stub — this report does not resolve research_md_url over the network'));
    } else {
      const { buildStoryEntityOwnership, fenceForeignEntities } = await import('../src/lib/storyEntityOwnership.js');
      const ownership = buildStoryEntityOwnership(project, sortedChapters);
      const fencedByChapter = bodyChapters
        .map((ch) => ({ chapterNumber: ch.chapter_number, fenced: fenceForeignEntities(researchMd, ownership, Number(ch.chapter_number)).fenced }))
        .filter((r) => r.fenced.length > 0);
      const totalFenced = fencedByChapter.reduce((sum, r) => sum + r.fenced.length, 0);
      criteria.push(line('cross-case-atoms', 'No cross-case atoms (anthology)', totalFenced === 0 ? 'PASS' : 'FAIL',
        totalFenced === 0 ? '0 foreign paragraph(s) fenced' : fencedByChapter.map((r) => `Ch.${r.chapterNumber}: ${r.fenced.length} foreign paragraph(s)`).join(' | ')));
    }
  } else {
    // ── fiction-only: [NAMEGATE-1] unknown persons 0 ──
    const evidence = buildFictionEvidence(project, { chapters: [] });
    const namegateTotal = bodyChapters.reduce((sum, ch) => sum + findUnknownPersons(ch.content_md || '', { evidence, cast: namegateCast }).length, 0);
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
