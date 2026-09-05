#!/usr/bin/env node
// scripts/beats-backfill.mjs — BEATLEDGER-1 backfill (UBS_plan.md Phase 1A)
//
// Runs beat extraction over an ALREADY-FINISHED manuscript, at CHAPTER
// granularity (scene_number: null, source: 'backfill' — a saved chapter has
// no persisted scene boundaries, see docs/pipeline-map.md §5). Talks to the
// same dev server (vite-server-store-plugin.js) the app itself uses, over
// HTTP, authenticated by the runner token — same pattern as
// scripts/ubs-run.mjs, whose createStoreClient/readRunnerToken/
// resolveDataDir/parseChapterRange this file reuses directly.
//
//   node scripts/beats-backfill.mjs --project <id> [--chapters 1-20]
//
// Never reads or writes data/ files directly: a chapter's prose resolves
// through the store API alone — inline content_md when present, otherwise
// content_md_url (a `local://<key>` reference) via store._FileStore.get,
// mirroring retrieveFile's own `local://` stripping (src/lib/localDB.js).
// Writes go only to the new BeatLedgerEntry entity — never Chapter.update,
// never NovelProject.update.
//
// beatLedger.js's extractSceneBeats/recordSceneBeats and modelRouting.js's
// pickModel have transitive @/ imports, so running this for real needs the
// alias loader — this file self-relaunches with it when invoked directly,
// the same way ubs-run.mjs does. Importing it as a module (the battery does
// this) never triggers the relaunch: every @/-importing module is a lazy
// `await import()` inside runBackfillCommand, so beatledger1.acceptance.mjs
// can test argument parsing, chapter-prose resolution, idempotency, and the
// FAILED-vs-zero-beat report with everything else injected.
//
// Sequential: one chapter at a time, in a for loop — never Promise.all —
// the same "one LLM call at a time" rule as the rest of this codebase.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createStoreClient,
  readRunnerToken,
  resolveDataDir,
  parseChapterRange,
} from './ubs-run.mjs';

export const BEATS_BACKFILL_VERSION = 'beats-backfill-v1';

const HERE = fileURLToPath(import.meta.url);

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

const stripLocalPrefix = (url) => String(url || '').replace(/^local:\/\//, '');

/**
 * Resolves one chapter's full prose through the store API only — inline
 * content_md when usable, otherwise content_md_url's `_FileStore` blob.
 * Never reads data/ files directly.
 */
export async function resolveChapterProse(chapter, store) {
  const inline = typeof chapter?.content_md === 'string' ? chapter.content_md : '';
  if (inline.trim()) return inline;
  const url = chapter?.content_md_url;
  if (!url) return '';
  const key = stripLocalPrefix(url);
  if (!key) return '';
  const record = await store._FileStore.get(key);
  return typeof record?.content === 'string' ? record.content : '';
}

/**
 * Sequential, idempotent chapter-level backfill. Every real dependency is
 * injectable via opts so the battery can run this with no store, no model,
 * no network: opts.store, opts.extractSceneBeats, opts.recordSceneBeats,
 * opts.resolveChapterProse, opts.pickModel, opts.callAgentWithMeta.
 */
export async function runBackfillCommand(opts) {
  const {
    projectId,
    chapterSpec,
    store,
    resolveChapterProse: resolveProseFn = resolveChapterProse,
    extractSceneBeats: extractFn,
    recordSceneBeats: recordFn,
    pickModel: pickModelFn,
    callAgentWithMeta,
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const allChapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
  const wantedNumbers = parseChapterRange(chapterSpec);
  const targetChapters = (wantedNumbers
    ? allChapters.filter((c) => wantedNumbers.includes(Number(c.chapter_number)))
    : allChapters
  ).slice().sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));

  const extractorModel = pickModelFn(project);
  log(`[BEATLEDGER-1] backfill: project ${projectId}, ${targetChapters.length} chapter(s) targeted, model=${extractorModel}.`);
  // BEATLEDGER-1B: built here, AFTER extractorModel is resolved, and passed
  // `model: extractorModel` explicitly on every call — this was the bug: the
  // previous callLLM closure was built before any project/model was known
  // and never forwarded a model at all, so callAgentWithMeta fell back to
  // resolveAgent's OWN (wrong, for nonfiction) model choice.
  const callLLM = (prompt) => callAgentWithMeta({ prompt, taskType: 'beats', model: extractorModel, temperature: 0.2, maxTokens: 2048 });

  const report = { skipped: [], counts: [], failed: [] };

  for (const chapter of targetChapters) {
    const chapterNumber = chapter.chapter_number;
    // Idempotent: a chapter already backfilled is skipped, never re-extracted.
    const existing = await store.BeatLedgerEntry.filter({
      project_id: projectId,
      chapter_id: chapter.id,
      source: 'backfill',
    });
    if (existing.length > 0) {
      log(`[BEATLEDGER-1] Ch.${chapterNumber}: already backfilled (${existing.length} entr${existing.length === 1 ? 'y' : 'ies'}) — skipping.`);
      report.skipped.push(chapterNumber);
      continue;
    }

    const prose = await resolveProseFn(chapter, store);
    if (!prose.trim()) {
      log(`[BEATLEDGER-1] Ch.${chapterNumber}: no resolvable prose — skipping.`);
      report.skipped.push(chapterNumber);
      continue;
    }

    try {
      const beats = await extractFn({
        project,
        chapterNumber,
        sceneNumber: null,
        prose,
        callLLM,
      });
      await recordFn({
        beats,
        project,
        chapterId: chapter.id,
        chapterNumber,
        sceneNumber: null,
        sceneAnchor: prose.slice(0, 120),
        sceneHash: null,
        source: 'backfill',
        extractorModel,
        create: (doc) => store.BeatLedgerEntry.create(doc),
      });
      log(`[BEATLEDGER-1] Ch.${chapterNumber}: ${beats.length} beat(s).`);
      report.counts.push({ chapterNumber, beats: beats.length });
    } catch (err) {
      log(`[BEATLEDGER-1] Ch.${chapterNumber}: FAILED — ${err?.message || err}`);
      report.failed.push({ chapterNumber, error: err?.message || String(err) });
    }
  }

  const zeroBeatChapters = report.counts.filter((c) => c.beats === 0).map((c) => c.chapterNumber);
  log(`[BEATLEDGER-1] backfill done: ${report.counts.length} extracted, ${report.skipped.length} skipped, ${report.failed.length} FAILED.`);
  if (zeroBeatChapters.length) {
    log(`[BEATLEDGER-1] zero-beat chapters (not failures): ${zeroBeatChapters.join(', ')}`);
  }
  if (report.failed.length) {
    log(`[BEATLEDGER-1] FAILED chapters (distinct from zero-beat): ${report.failed.map((f) => f.chapterNumber).join(', ')}`);
  }

  return report;
}

async function buildBackfillDeps() {
  const [{ extractSceneBeats, recordSceneBeats }, { pickModel }, { callAgentWithMeta }] = await Promise.all([
    import('../src/lib/beatLedger.js'),
    import('../src/lib/modelRouting.js'),
    import('../src/lib/localLLM.js'),
  ]);
  return {
    extractSceneBeats,
    recordSceneBeats,
    pickModel: (project) => pickModel('prose', project),
    callAgentWithMeta,
  };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: beats-backfill.mjs --project <id> [--chapters 1-20]');
    process.exitCode = 1;
    return;
  }
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });
  // LOCALLLM-NODE-1: localLLM.js reads UBS_RUNNER_TOKEN at module-load time
  // to authenticate its own '/llama' calls under Node — must be set BEFORE
  // buildBackfillDeps() dynamically imports it.
  process.env.UBS_RUNNER_TOKEN = token;
  const deps = await buildBackfillDeps();

  const report = await runBackfillCommand({
    projectId: flags.project,
    chapterSpec: flags.chapters,
    store,
    ...deps,
  });
  process.exitCode = report.failed.length > 0 ? 1 : 0;
}

const isEntryPoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntryPoint) {
  if (!process.env.__UBS_RUN_RELAUNCHED) {
    const aliasLoader = fileURLToPath(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));
    const result = spawnSync(process.execPath, ['--loader', aliasLoader, HERE, ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: { ...process.env, __UBS_RUN_RELAUNCHED: '1' },
    });
    process.exit(result.status ?? 1);
  } else {
    main(process.argv.slice(2)).catch((err) => {
      console.error('[BEATLEDGER-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
