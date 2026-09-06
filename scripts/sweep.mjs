#!/usr/bin/env node
// scripts/sweep.mjs — SWEEP-1 (UBS_plan.md Phase 2A)
//
// Runs the mechanical repetition sweep over a project's already-extracted
// BeatLedgerEntry rows, prints the report, and saves it as a PublishingAsset
// (kind: 'repetition_sweep_report') so it shows in Saved Assets — the same
// field shape savePublishingAsset (src/components/tools/SavedAssetsPanel.jsx)
// already uses: { project_id, kind, label, content, created_date }.
//
//   node scripts/sweep.mjs --project <id> [--threshold 0.72]
//
// Report only: never writes Chapter or NovelProject. Reads BeatLedgerEntry
// through the store API (same runner-token pattern as the backfill
// scripts); the one optional model call (entity aliasing) goes through
// callAgentWithMeta with the project's own routed model (same reasoning as
// the backfill scripts: avoid an unnecessary swap on the shared single-slot
// router) and taskType 'beat_extraction' (BEATLEDGER-1C's own agent key —
// this is the same kind of structured, writer-model task, not the beat
// PLANNER's 'beats' taskType).
//
// repetitionSweep.js/modelRouting.js have transitive @/ imports, so running
// this for real needs the alias loader — self-relaunches with it when
// invoked directly, same idiom as beats-backfill.mjs/deltas-backfill.mjs.
// Every such import is lazy inside runSweepCommand, so sweep1.acceptance.mjs
// can test everything with a mocked store and no model calls.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createStoreClient,
  readRunnerToken,
  resolveDataDir,
} from './ubs-run.mjs';

export const SWEEP_SCRIPT_VERSION = 'sweep-script-v1';

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
 * Runs the sweep and saves the report as a PublishingAsset. Every real
 * dependency is injectable via opts: opts.store, opts.sweepProject,
 * opts.formatSweepReport, opts.pickModel, opts.callAgentWithMeta.
 */
export async function runSweepCommand(opts) {
  const {
    projectId,
    threshold,
    store,
    sweepProject: sweepFn,
    formatSweepReport: formatFn,
    pickModel: pickModelFn,
    callAgentWithMeta,
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const resolvedThreshold = Number.isFinite(Number(threshold)) ? Number(threshold) : undefined;

  let callLLM;
  if (typeof callAgentWithMeta === 'function' && typeof pickModelFn === 'function') {
    const model = pickModelFn(project);
    callLLM = (prompt) => callAgentWithMeta({ prompt, taskType: 'beat_extraction', model, temperature: 0.2, maxTokens: 2048 });
  }

  const result = await sweepFn(projectId, {
    store,
    ...(resolvedThreshold !== undefined ? { threshold: resolvedThreshold } : {}),
    callLLM,
  });

  const report = formatFn(result, {
    ...(resolvedThreshold !== undefined ? { threshold: resolvedThreshold } : {}),
    projectTitle: project?.title || '',
  });
  log(report);

  const asset = await store.PublishingAsset.create({
    project_id: projectId,
    kind: 'repetition_sweep_report',
    label: `Sweep ${new Date().toISOString().slice(0, 10)}`,
    content: JSON.stringify(result, null, 2),
    created_date: new Date().toISOString(),
  });
  log(`[SWEEP-1] report saved as PublishingAsset ${asset?.id || '(no id returned)'}.`);

  return { result, report, asset };
}

async function buildSweepDeps() {
  const [{ sweepProject, formatSweepReport }, { pickModel }, { callAgentWithMeta }] = await Promise.all([
    import('../src/lib/repetitionSweep.js'),
    import('../src/lib/modelRouting.js'),
    import('../src/lib/localLLM.js'),
  ]);
  return {
    sweepProject,
    formatSweepReport,
    pickModel: (project) => pickModel('prose', project),
    callAgentWithMeta,
  };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const flags = parseArgs(argv);
  if (!flags.project) {
    console.error('Usage: sweep.mjs --project <id> [--threshold 0.72]');
    process.exitCode = 1;
    return;
  }
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });
  // LOCALLLM-NODE-1: localLLM.js reads UBS_RUNNER_TOKEN at module-load time.
  process.env.UBS_RUNNER_TOKEN = token;
  const deps = await buildSweepDeps();

  await runSweepCommand({
    projectId: flags.project,
    threshold: flags.threshold,
    store,
    ...deps,
  });
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
      console.error('[SWEEP-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
