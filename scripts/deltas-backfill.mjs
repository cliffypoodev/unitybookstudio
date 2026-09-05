#!/usr/bin/env node
// scripts/deltas-backfill.mjs — SCENEDELTA-1 backfill (UBS_plan.md Phase 1B)
//
// Derives a delta for each existing planned scene (from a chapter's saved
// scene_beats_json) with one model call per scene, sequential, writing
// results to the new SceneDelta entity. Never modifies
// Chapter.scene_beats_json — Phase 2's gate reads deltas from either place.
//
//   node scripts/deltas-backfill.mjs --project <id>
//
// Mirrors scripts/beats-backfill.mjs exactly: same store client, same
// self-relaunch-with-alias-loader idiom (sceneDelta.js/modelRouting.js have
// transitive @/ imports), same lazy-import-inside-the-command pattern so
// the battery can test argument parsing / scene-beat parsing / idempotency
// / sequencing with everything else injected. Sequential — one chapter,
// one scene at a time, in a for loop — never Promise.all.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createStoreClient,
  readRunnerToken,
  resolveDataDir,
  parseChapterRange,
} from './ubs-run.mjs';

export const DELTAS_BACKFILL_VERSION = 'deltas-backfill-v1';

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

/**
 * Parses a chapter's saved scene_beats_json (compactSceneBeatsForEntity's
 * output shape, ProjectStudio.jsx) into its array of planned-scene beat
 * objects. Tolerates every shape the compactor can produce (fiction
 * {compacted_for_entity_field, beats:[...]}, nonfiction {sections:[...]},
 * or a raw array) and a missing/unparseable field (returns []).
 */
export function parsePlannedScenes(chapter) {
  const raw = chapter?.scene_beats_json;
  if (!raw) return [];
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.beats)) return parsed.beats;
  if (Array.isArray(parsed?.sections)) return parsed.sections;
  if (Array.isArray(parsed?.scenes)) return parsed.scenes;
  return [];
}

/**
 * Sequential, idempotent scene-level backfill. Every real dependency is
 * injectable via opts: opts.store, opts.deriveSceneDelta, opts.recordSceneDelta,
 * opts.pickModel, opts.callAgentWithMeta.
 */
export async function runDeltasBackfillCommand(opts) {
  const {
    projectId,
    chapterSpec,
    store,
    deriveSceneDelta: deriveFn,
    recordSceneDelta: recordFn,
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
  log(`[SCENEDELTA-1] backfill: project ${projectId}, ${targetChapters.length} chapter(s) targeted, model=${extractorModel}.`);
  // BEATLEDGER-1B (same fix, same file shape): built AFTER extractorModel is
  // resolved, forwarding `model: extractorModel` explicitly on every call.
  const callLLM = (prompt) => callAgentWithMeta({ prompt, taskType: 'beats', model: extractorModel, temperature: 0.2, maxTokens: 1024 });

  const report = { skipped: [], derived: [], failed: [] };

  for (const chapter of targetChapters) {
    const chapterNumber = chapter.chapter_number;
    const scenes = parsePlannedScenes(chapter);
    if (scenes.length === 0) {
      log(`[SCENEDELTA-1] Ch.${chapterNumber}: no planned scenes — skipping.`);
      report.skipped.push(chapterNumber);
      continue;
    }

    // Idempotent: a chapter already backfilled is skipped, never re-derived.
    const existing = await store.SceneDelta.filter({
      project_id: projectId,
      chapter_id: chapter.id,
      source: 'backfill',
    });
    if (existing.length > 0) {
      log(`[SCENEDELTA-1] Ch.${chapterNumber}: already backfilled (${existing.length} entr${existing.length === 1 ? 'y' : 'ies'}) — skipping.`);
      report.skipped.push(chapterNumber);
      continue;
    }

    let chapterDerivedCount = 0;
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const sceneBeat = scenes[sceneIndex];
      try {
        const delta = await deriveFn({ project, chapterNumber, sceneIndex, sceneBeat, callLLM });
        await recordFn({
          project,
          chapterId: chapter.id,
          chapterNumber,
          sceneIndex,
          delta,
          source: 'backfill',
          create: (doc) => store.SceneDelta.create(doc),
        });
        chapterDerivedCount += 1;
      } catch (err) {
        log(`[SCENEDELTA-1] Ch.${chapterNumber} scene ${sceneIndex}: FAILED — ${err?.message || err}`);
        report.failed.push({ chapterNumber, sceneIndex, error: err?.message || String(err) });
      }
    }
    log(`[SCENEDELTA-1] Ch.${chapterNumber}: ${chapterDerivedCount}/${scenes.length} scene delta(s) derived.`);
    if (chapterDerivedCount > 0) report.derived.push({ chapterNumber, count: chapterDerivedCount });
  }

  log(`[SCENEDELTA-1] backfill done: ${report.derived.length} chapter(s) with derived deltas, ${report.skipped.length} skipped, ${report.failed.length} FAILED scene(s).`);
  return report;
}

async function buildDeltasBackfillDeps() {
  const [{ deriveSceneDelta, recordSceneDelta }, { pickModel }, { callAgentWithMeta }] = await Promise.all([
    import('../src/lib/sceneDelta.js'),
    import('../src/lib/modelRouting.js'),
    import('../src/lib/localLLM.js'),
  ]);
  return {
    deriveSceneDelta,
    recordSceneDelta,
    pickModel: (project) => pickModel('prose', project),
    callAgentWithMeta,
  };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: deltas-backfill.mjs --project <id> [--chapters 1-20]');
    process.exitCode = 1;
    return;
  }
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });
  const deps = await buildDeltasBackfillDeps();

  const report = await runDeltasBackfillCommand({
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
      console.error('[SCENEDELTA-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
