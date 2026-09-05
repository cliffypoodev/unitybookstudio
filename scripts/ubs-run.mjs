#!/usr/bin/env node
// scripts/ubs-run.mjs — RUNNER-1 (HEADLESS-1, §10 I2)
//
// A Node CLI that drives runChapterDraft (src/lib/chapterOrchestrator.js)
// without a browser: `draft`, `polish`, `export`. Talks to the same dev
// server (vite-server-store-plugin.js) the app itself uses, over HTTP,
// authenticated by a localhost-only runner token
// (data/_auth/runner.token — see server/authCore.js's ensureRunnerToken /
// verifyRunnerToken) instead of a session cookie.
//
//   node scripts/ubs-run.mjs draft --project <id> [--chapters 1-20] [--resume <runId>]
//   node scripts/ubs-run.mjs polish --project <id>
//   node scripts/ubs-run.mjs export --project <id>
//
// chapterOrchestrator.js (and manuscriptPolishRunner.js / exportSafetyGate.js)
// have transitive @/ imports, so running this for real needs the alias
// loader — this file self-relaunches with it when invoked directly, the
// same way test/orch1.acceptance.mjs does. Importing it as a module (the
// battery does this) never triggers the relaunch or touches those modules:
// every real import is a lazy `await import()` inside the command that
// needs it, so runner1.acceptance.mjs can test everything else — argument
// parsing, run-state, the sequential loop, the token functions it shares
// with the server — as a plain `node test/runner1.acceptance.mjs`, deps
// fully injected, matching every other battery in this suite.
//
// SEQFIX-1: chapters draft strictly one at a time, in a for loop, never
// Promise.all/allSettled — the same "one LLM call at a time" rule as the
// rest of this codebase.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export const UBS_RUN_VERSION = 'ubs-run-v1';

const HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(HERE), '..');

// ── data dir (AUTH-1's own env-override convention — batteries run against
// a scratch directory and never touch the live data/ tree) ──────────────
export function resolveDataDir() {
  return process.env.UBS_DATA_DIR || path.join(REPO_ROOT, 'data');
}

// ── chapter range parsing ─────────────────────────────────────────────────
// "3-5" -> [3,4,5] (inclusive); "7" -> [7]; null/undefined -> null (all).
export function parseChapterRange(spec) {
  if (spec == null || spec === '') return null;
  const s = String(spec).trim();
  const rangeMatch = s.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      throw new Error(`Invalid --chapters range: "${spec}"`);
    }
    const out = [];
    for (let n = start; n <= end; n++) out.push(n);
    return out;
  }
  const single = Number(s);
  if (!Number.isFinite(single)) throw new Error(`Invalid --chapters value: "${spec}"`);
  return [single];
}

// ── runner token (read-only from the CLI's side; the server owns creation) ──
export function readRunnerToken(dataDir) {
  const f = path.join(dataDir, '_auth', 'runner.token');
  if (!fs.existsSync(f)) {
    throw new Error(`No runner token at ${f} — start the dev server once (npm run dev) to generate it.`);
  }
  return fs.readFileSync(f, 'utf8').trim();
}

// ── Node-side store client — fetch to the dev server, no browser ────────
const RUNNER_TOKEN_HEADER = 'x-ubs-runner-token';

export function createStoreClient({ baseUrl, token, fetchImpl = fetch }) {
  async function call(method, url, body) {
    const res = await fetchImpl(`${baseUrl}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', [RUNNER_TOKEN_HEADER]: token },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Store request ${method} ${url} failed: ${res.status} ${text}`);
    }
    return res.json();
  }
  function entity(name) {
    return {
      // BEATLEDGER-1: encodeURIComponent so a _FileStore key containing `/`
      // (every real one — `${projectId}/${chapterId}/chapter-....md`) survives
      // as ONE path segment; the server's route parser splits the raw
      // pathname on `/` before decoding, so an un-encoded id would be sliced
      // into several. Harmless for Chapter/NovelProject's plain ids.
      get: (id) => call('GET', `/api/store/${name}/get/${encodeURIComponent(id)}`),
      filter: (query = {}, sort, limit) => call('POST', `/api/store/${name}/filter`, { query, sort, limit }),
      update: (id, fields) => call('POST', `/api/store/${name}/update/${encodeURIComponent(id)}`, fields),
      create: (fields) => call('POST', `/api/store/${name}/create`, fields),
    };
  }
  return {
    Chapter: entity('Chapter'),
    NovelProject: entity('NovelProject'),
    // BEATLEDGER-1: _FileStore (resolving a chapter's content_md_url without
    // reading data/ files directly) and BeatLedgerEntry (the backfill writes).
    _FileStore: entity('_FileStore'),
    BeatLedgerEntry: entity('BeatLedgerEntry'),
    // SCENEDELTA-1: the deltas-backfill script's writes.
    SceneDelta: entity('SceneDelta'),
  };
}

// ── run state: data/_runs/<runId>.json + .log + .stop ────────────────────
export function runsDir(dataDir) { return path.join(dataDir, '_runs'); }
export function runStatePath(dataDir, runId) { return path.join(runsDir(dataDir), `${runId}.json`); }
export function runLogPath(dataDir, runId) { return path.join(runsDir(dataDir), `${runId}.log`); }
export function runStopPath(dataDir, runId) { return path.join(runsDir(dataDir), `${runId}.stop`); }

export function generateRunId() {
  return `run-${crypto.randomBytes(6).toString('hex')}`;
}

function ensureRunsDir(dataDir) {
  fs.mkdirSync(runsDir(dataDir), { recursive: true });
}

export function loadRunState(dataDir, runId) {
  const f = runStatePath(dataDir, runId);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

export function saveRunState(dataDir, runId, state) {
  ensureRunsDir(dataDir);
  const f = runStatePath(dataDir, runId);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, f);
}

export function createRunState({ runId, projectId, chapterIds }) {
  const chapters = {};
  for (const id of chapterIds) chapters[id] = { status: 'pending' };
  return { runId, projectId, chapters, createdAt: new Date().toISOString() };
}

export function markChapterStatus(state, chapterId, status, extra = {}) {
  state.chapters[chapterId] = { ...state.chapters[chapterId], status, ...extra, updatedAt: new Date().toISOString() };
  return state;
}

export function isStopRequested(dataDir, runId) {
  return fs.existsSync(runStopPath(dataDir, runId));
}

export function appendRunLog(dataDir, runId, line) {
  ensureRunsDir(dataDir);
  fs.appendFileSync(runLogPath(dataDir, runId), `[${new Date().toISOString()}] ${line}\n`, 'utf8');
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

// ── draft ─────────────────────────────────────────────────────────────────
//
// generateSceneBeats: draftChapter's original beat-planning dependency
// (ProjectStudio.jsx's own generateSceneBeats, ~150 lines of prompt/ledger
// assembly, not extracted by ORCH-1) has no headless equivalent yet — that
// is its own extraction, out of scope here. The honest default below reuses
// a chapter's already-planned scene_beats_json (the normal case — beats are
// planned once via the UI) and fails clearly, rather than silently faking
// generation, when a chapter has none.
function defaultGenerateSceneBeats(chapter) {
  if (chapter?.scene_beats_json) return chapter.scene_beats_json;
  throw new Error(
    `Chapter ${chapter?.chapter_number ?? chapter?.id} has no scene_beats_json. ` +
    `scripts/ubs-run.mjs does not generate beats headlessly (out of scope for RUNNER-1) — ` +
    `plan this chapter's beats in the app first.`
  );
}

async function buildDraftDeps({ store, dataDir, runId, project, chapters }) {
  const orchestrator = await import('../src/lib/chapterOrchestrator.js');
  const projectContentGuard = await import('../src/lib/projectContentGuard.js');
  const chapterStorage = await import('../src/lib/chapterStorage.js');
  const requestRetry = await import('../src/lib/requestRetry.js');
  const modelRouting = await import('../src/lib/modelRouting.js');
  const integrationRetry = await import('../src/lib/integrationRetry.js');
  const pipelineDiag = await import('../src/lib/pipelineDiag.js');

  const chapterHasPersistedManuscriptContent = (chapter) => Boolean(
    chapterStorage.chapterHasContent(chapter) ||
    chapter?.content_html || chapter?.content_html_url ||
    chapter?.content_delta || chapter?.content_delta_url
  );

  return {
    runChapterDraftFn: orchestrator.runChapterDraft,
    deps: {
      Chapter: store.Chapter,
      NovelProject: store.NovelProject,
      invokeLLMWithRetry: integrationRetry.invokeLLMWithRetry,
      pipelineSnapshot: pipelineDiag.snapshot,
      onProgress: (event) => appendRunLog(dataDir, runId, `[PROGRESS] ${JSON.stringify(event)}`),
      toast: { error: (msg) => appendRunLog(dataDir, runId, `[TOAST-ERROR] ${msg}`) },
      refreshAll: async () => {},
      runProjectContentGuardBeforeSave: (chapter, text, sourceLabel) => {
        const guard = projectContentGuard.validateProjectChapterContent({ project, chapter, chapters, content: text });
        if (guard?.shouldBlockSave) throw projectContentGuard.makeProjectContentGuardError(chapter, guard);
        return guard;
      },
      generateSceneBeats: async (chapter) => defaultGenerateSceneBeats(chapter),
      backupChapterBeforeGeneratedOverwrite: async (chapter, reason) => {
        if (!chapter?.id || !chapterHasPersistedManuscriptContent(chapter)) return false;
        const existingText = await chapterStorage.resolveChapterContent(chapter);
        if (!existingText || !existingText.trim()) return false;
        const backupFields = await chapterStorage.prepareBackupContent(existingText, project?.id, chapter.id, chapter);
        await requestRetry.runWithNetworkRetry(() => store.Chapter.update(chapter.id, {
          ...backupFields,
          revision_notes: [reason || 'Backup before generated overwrite', chapter.revision_notes || ''].filter(Boolean).join('\n'),
        }));
        return true;
      },
      projectId: project?.id,
      chapterProseModels: {},
      settingsDrafts: {},
    },
  };
}

/**
 * Sequential chapter draft loop (SEQFIX-1). Every real I/O boundary is
 * injectable via opts for the battery: opts.store, opts.runChapterDraft,
 * opts.buildDeps, opts.dataDir.
 */
export async function runDraftCommand(opts) {
  const {
    projectId,
    chapterSpec,
    resumeRunId,
    dataDir = resolveDataDir(),
    store,
    runChapterDraft: injectedRunChapterDraft,
    buildDeps = buildDraftDeps,
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const allChapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
  const wantedNumbers = parseChapterRange(chapterSpec);
  const targetChapters = (wantedNumbers
    ? allChapters.filter((c) => wantedNumbers.includes(Number(c.chapter_number)))
    : allChapters
  ).slice().sort((a, b) => Number(a.chapter_number) - Number(b.chapter_number));

  const runId = resumeRunId || generateRunId();
  let state = resumeRunId ? loadRunState(dataDir, resumeRunId) : null;
  if (!state) state = createRunState({ runId, projectId, chapterIds: targetChapters.map((c) => c.id) });
  saveRunState(dataDir, runId, state);
  log(`[RUNNER-1] run ${runId}: ${targetChapters.length} chapter(s) targeted.`);

  let runChapterDraftFn = injectedRunChapterDraft;
  let deps;
  if (!runChapterDraftFn) {
    const built = await buildDeps({ store, dataDir, runId, project, chapters: allChapters });
    runChapterDraftFn = built.runChapterDraftFn;
    deps = built.deps;
  } else {
    deps = opts.deps || {};
  }

  for (const chapter of targetChapters) {
    if (isStopRequested(dataDir, runId)) {
      appendRunLog(dataDir, runId, `Stop file present — halting before chapter ${chapter.chapter_number}.`);
      log(`[RUNNER-1] stop requested — halting before chapter ${chapter.chapter_number}.`);
      break;
    }
    const existing = state.chapters[chapter.id];
    if (existing && existing.status === 'done') {
      log(`[RUNNER-1] chapter ${chapter.chapter_number} already done — skipping (--resume).`);
      continue;
    }

    markChapterStatus(state, chapter.id, 'running');
    saveRunState(dataDir, runId, state);
    appendRunLog(dataDir, runId, `Chapter ${chapter.chapter_number}: drafting.`);
    try {
      const result = await runChapterDraftFn({ project, chapter, chapters: allChapters, deps, options: {} });
      const contentSha256 = sha256(result?.content || '');
      // ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: runChapterDraftFn's
      // returned `content` is the RAW pre-save text (chapterOrchestrator.js
      // passes it to prepareChapterContent, which normalizes it — collapsing
      // leading whitespace on a line, among other things — before it is
      // ever written to content_md). Computing paragraphCount from the raw
      // return value would compare apples to oranges against
      // scripts/ubs-accept.mjs's later read of the actually-stored,
      // normalized content_md, producing a spurious mismatch unrelated to
      // polish. Re-read the chapter's real stored content instead, so both
      // the "before" and "after" figures are computed on the same
      // normalized text through the same pipeline.
      const savedChapter = await store.Chapter.get(chapter.id);
      // A large chapter can be saved URL-backed (content_md empty,
      // content_md_url set) — resolving that URL here would need the same
      // localDB machinery chapterStorage.js's resolveChapterContent uses,
      // which is more coupling than this narrow fix warrants. Omit
      // paragraphCount for that chapter rather than recording a wrong count
      // computed against an empty string; ubs-accept.mjs already treats a
      // missing paragraphCount as "not measured", not a mismatch.
      const extra = { contentSha256 };
      if (savedChapter?.content_md) {
        extra.paragraphCount = String(savedChapter.content_md).split(/\n{2,}/).filter((p) => p.trim()).length;
      }
      markChapterStatus(state, chapter.id, 'done', extra);
      appendRunLog(dataDir, runId, `Chapter ${chapter.chapter_number}: done (sha256 ${contentSha256.slice(0, 12)}…).`);
      log(`[RUNNER-1] chapter ${chapter.chapter_number}: done.`);
    } catch (err) {
      markChapterStatus(state, chapter.id, 'error', { error: err?.message || String(err) });
      appendRunLog(dataDir, runId, `Chapter ${chapter.chapter_number}: ERROR ${err?.message || err}`);
      log(`[RUNNER-1] chapter ${chapter.chapter_number}: ERROR — ${err?.message || err}`);
    }
    saveRunState(dataDir, runId, state);
  }

  const erroredCount = Object.values(state.chapters).filter((c) => c.status === 'error').length;
  return { runId, state, erroredCount };
}

// ── polish ────────────────────────────────────────────────────────────────
export async function runPolishCommand(opts) {
  const {
    projectId,
    store,
    runPipeline: injectedRunPipeline,
    sceneDuplicateSweep: injectedSceneDuplicateSweep,
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const chapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);
  const loaded = chapters.map((c) => ({ chapter: c, content: c.content_md || '', original: c.content_md || '' }));

  let runPipeline = injectedRunPipeline;
  let mode = opts.mode;
  if (!runPipeline) {
    const [{ runManuscriptPolishPipeline }, { isNonfictionProject }] = await Promise.all([
      import('../src/lib/manuscriptPolishRunner.js'),
      import('../src/lib/manuscriptStats.js'),
    ]);
    runPipeline = runManuscriptPolishPipeline;
    mode = mode || (isNonfictionProject(project) ? 'nonfiction' : 'fiction');
  }

  // SCENEDUP-3: inject the same live sweep the ProjectStudio.jsx UI passes,
  // so headless polish gets parity with in-app polish (finding 67).
  let sceneDuplicateSweep = injectedSceneDuplicateSweep;
  if (!sceneDuplicateSweep) {
    ({ runSceneDuplicateSweep: sceneDuplicateSweep } = await import('../src/lib/sceneDuplicateSweep.js'));
  }

  const result = await runPipeline({ loaded, project, onProgress: (label) => log(`[POLISH] ${label}`), allowLLM: true, mode, sceneDuplicateSweep });

  for (const item of loaded) {
    if (item.content !== item.original) {
      await store.Chapter.update(item.chapter.id, { content_md: item.content, word_count: undefined });
    }
  }

  log(`[RUNNER-1] polish complete: ${(result?.changes || []).length} change(s).`);
  return result;
}

// ── export ────────────────────────────────────────────────────────────────
export async function runExportCommand(opts) {
  const {
    projectId,
    store,
    runGate: injectedRunGate,
    log = (line) => console.log(line),
  } = opts;

  const project = await store.NovelProject.get(projectId);
  const chapters = await store.Chapter.filter({ project_id: projectId }, 'chapter_number', 500);

  let runGate = injectedRunGate;
  if (!runGate) {
    const { runPreExportSafetyGate } = await import('../src/lib/exportSafetyGate.js');
    runGate = runPreExportSafetyGate;
  }

  const report = await runGate(chapters, { project });
  if (report?.blocked) {
    log(`[RUNNER-1] export BLOCKED: ${(report.hardFailures || []).length} hard failure(s).`);
    process.exitCode = 1;
    return report;
  }
  log(`[RUNNER-1] export safety gate passed: ${(report.passed || []).length} chapter(s).`);
  process.exitCode = 0;
  return report;
}

// ── CLI ───────────────────────────────────────────────────────────────────
export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    }
  }
  return { command, flags };
}

async function main(argv) {
  const dataDir = resolveDataDir();
  const { command, flags } = parseArgs(argv);
  const token = readRunnerToken(dataDir);
  const baseUrl = process.env.UBS_SERVER_URL || 'http://127.0.0.1:5180';
  const store = createStoreClient({ baseUrl, token });

  if (command === 'draft') {
    const result = await runDraftCommand({
      projectId: flags.project,
      chapterSpec: flags.chapters,
      resumeRunId: flags.resume,
      dataDir,
      store,
    });
    console.log(`[RUNNER-1] run ${result.runId} finished — ${result.erroredCount} error(s).`);
    process.exitCode = result.erroredCount > 0 ? 1 : 0;
  } else if (command === 'polish') {
    await runPolishCommand({ projectId: flags.project, store });
  } else if (command === 'export') {
    await runExportCommand({ projectId: flags.project, store });
  } else {
    console.error('Usage: ubs-run.mjs <draft|polish|export> --project <id> [--chapters 1-20] [--resume <runId>]');
    process.exitCode = 1;
  }
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
      console.error('[RUNNER-1] fatal:', err?.stack || err);
      process.exitCode = 1;
    });
  }
}
