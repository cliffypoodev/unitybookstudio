// RUNNER-1 acceptance battery — scripts/ubs-run.mjs + the localhost-only
// runner token in server/authCore.js / vite-server-store-plugin.js.
//
// Every check here runs against a scratch data directory under the OS temp
// dir (never `data/` — AUTH-1's own UBS_DATA_DIR override exists precisely
// so batteries can do this) and a fully mocked store/orchestrator/gate, so
// this file makes zero real network calls, zero real LLM calls, and zero
// writes anywhere near the live app's data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  ensureRunnerToken, verifyRunnerToken, createUser,
} from '../server/authCore.js';
import {
  UBS_RUN_VERSION, parseChapterRange, parseArgs, createStoreClient,
  runDraftCommand, runExportCommand, loadRunState, generateRunId,
  runStopPath, configureHeadlessEnvironment,
} from '../scripts/ubs-run.mjs';

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

function mkScratchDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

check('0. scripts/ubs-run.mjs exports a version string', typeof UBS_RUN_VERSION === 'string' && UBS_RUN_VERSION.length > 0);

// ── 1-3: the localhost-only runner token (server/authCore.js) ──────────────
{
  const dataDir = mkScratchDir('ubs-runner1-auth-');
  try {
    const token = ensureRunnerToken(dataDir);
    check('0b. ensureRunnerToken creates a 64-hex-char token', /^[0-9a-f]{64}$/.test(token));

    const user = createUser(dataDir, { username: 'runnertester', password: 'runnertesterpassword', displayName: 'Runner Tester' });
    ensureRunnerToken(dataDir); // mirrors the setup handler's re-bind call

    const resolved = verifyRunnerToken(dataDir, '127.0.0.1', token);
    check('1. token accepted on localhost resolves the uid', resolved?.id === user.id, JSON.stringify(resolved));

    const resolvedV6 = verifyRunnerToken(dataDir, '::1', token);
    check('1b. token accepted from ::1 too', resolvedV6?.id === user.id);

    const offLocalhost = verifyRunnerToken(dataDir, '10.0.0.5', token);
    check('2. token rejected off-localhost (mock socket address)', offLocalhost === null, JSON.stringify(offLocalhost));

    const wrongToken = verifyRunnerToken(dataDir, '127.0.0.1', 'not-the-real-token-value-at-all');
    check('3. wrong token is rejected (constant-time compare fails closed)', wrongToken === null);

    const noToken = verifyRunnerToken(dataDir, '127.0.0.1', '');
    check('3b. an empty/missing token is rejected', noToken === null);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── chapter range parsing ────────────────────────────────────────────────
check('4. --chapters 3-5 parses inclusively', JSON.stringify(parseChapterRange('3-5')) === JSON.stringify([3, 4, 5]));
check('4b. a single chapter number parses to a one-element list', JSON.stringify(parseChapterRange('7')) === JSON.stringify([7]));
check('4c. no --chapters value means "all" (null)', parseChapterRange(undefined) === null);
check('4d. an invalid range throws rather than silently drafting nothing/everything',
  (() => { try { parseChapterRange('5-3'); return false; } catch { return true; } })());

// ── CLI argument parsing ─────────────────────────────────────────────────
{
  const { command, flags } = parseArgs(['draft', '--project', 'proj-1', '--chapters', '1-20', '--resume', 'run-abc']);
  check('5. parseArgs reads the command and every flag', command === 'draft' && flags.project === 'proj-1' && flags.chapters === '1-20' && flags.resume === 'run-abc');
}

// ── in-memory fake store + orchestrator for the draft-loop checks ────────
function makeFakeStore(project, chapters) {
  const chapterMap = new Map(chapters.map((c) => [c.id, { ...c }]));
  return {
    NovelProject: { get: async (id) => (id === project.id ? { ...project } : null) },
    Chapter: {
      get: async (id) => chapterMap.get(id) || null,
      filter: async () => [...chapterMap.values()].sort((a, b) => a.chapter_number - b.chapter_number),
      update: async (id, fields) => {
        const merged = { ...chapterMap.get(id), ...fields, id };
        chapterMap.set(id, merged);
        return merged;
      },
    },
  };
}

const FIXTURE_PROJECT = { id: 'proj-1', title: 'Fixture Project' };
const FIXTURE_CHAPTERS = [
  { id: 'ch-1', chapter_number: 1, title: 'One' },
  { id: 'ch-2', chapter_number: 2, title: 'Two' },
  { id: 'ch-3', chapter_number: 3, title: 'Three' },
];

// ── 6-7: checkpoint per chapter + strict sequential ordering ──────────────
{
  const dataDir = mkScratchDir('ubs-runner1-draft-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
    const callOrder = [];
    const mockRunChapterDraft = async ({ chapter }) => {
      callOrder.push(chapter.chapter_number);
      return { content: `drafted content for chapter ${chapter.chapter_number}`, status: 'drafted' };
    };

    const result = await runDraftCommand({
      projectId: 'proj-1',
      store,
      runChapterDraft: mockRunChapterDraft,
      deps: {},
      dataDir,
      log: () => {},
    });

    check('6. every targeted chapter reaches a terminal status in the run state',
      Object.values(result.state.chapters).every((c) => c.status === 'done'));
    check('6b. a checkpoint is written per chapter with a content sha256',
      Object.values(result.state.chapters).every((c) => typeof c.contentSha256 === 'string' && /^[0-9a-f]{64}$/.test(c.contentSha256)));
    check('6c. the run state persists to disk under the scratch data dir (not data/)',
      loadRunState(dataDir, result.runId) !== null);
    check('7. chapters ran strictly sequentially, in chapter_number order', JSON.stringify(callOrder) === JSON.stringify([1, 2, 3]));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 7b. ACCEPT-1-FIX-ADVERSARIAL-REVIEW-FINDINGS: paragraphCount is read from
// the chapter's actually-stored content (via store.Chapter.get), not from
// runChapterDraftFn's raw pre-save return value — proven by having the mock
// return one paragraph count while separately updating the fake store with a
// DIFFERENT (already-"normalized") paragraph count, the same divergence the
// real chapterOrchestrator.js/prepareChapterContent pipeline can produce ──
{
  const dataDir = mkScratchDir('ubs-runner1-paracount-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, [FIXTURE_CHAPTERS[0]]);
    const mockRunChapterDraft = async ({ chapter }) => {
      // Raw return value looks like ONE paragraph (no \n{2,} run) ...
      const rawContent = 'First line.\n   \nSecond line.';
      // ... but simulate the real save pipeline normalizing that
      // whitespace-only line into a real blank-line paragraph break before
      // it lands in the store, exactly like chapterStorage.js's
      // normalizeText does.
      await store.Chapter.update(chapter.id, { content_md: rawContent.replace(/\n[ \t]+\n/g, '\n\n') });
      return { content: rawContent, status: 'drafted' };
    };
    const result = await runDraftCommand({ projectId: 'proj-1', store, runChapterDraft: mockRunChapterDraft, deps: {}, dataDir, log: () => {} });
    check('7b. paragraphCount reflects the stored (normalized) content, not the raw pre-save return value',
      result.state.chapters['ch-1']?.paragraphCount === 2, JSON.stringify(result.state.chapters['ch-1']));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 7c. a chapter saved URL-backed (no content_md) omits paragraphCount
// rather than recording a wrong count against an empty string ──
{
  const dataDir = mkScratchDir('ubs-runner1-urlbacked-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, [FIXTURE_CHAPTERS[0]]);
    const mockRunChapterDraft = async ({ chapter }) => {
      await store.Chapter.update(chapter.id, { content_md: '', content_md_url: 'local://big-chapter-blob' });
      return { content: 'a very long chapter that ended up stored by URL', status: 'drafted' };
    };
    const result = await runDraftCommand({ projectId: 'proj-1', store, runChapterDraft: mockRunChapterDraft, deps: {}, dataDir, log: () => {} });
    check('7c. a URL-backed chapter (empty content_md) omits paragraphCount instead of recording 0',
      result.state.chapters['ch-1']?.status === 'done' && !('paragraphCount' in (result.state.chapters['ch-1'] || {})), JSON.stringify(result.state.chapters['ch-1']));
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 8: --resume skips chapters already marked done ────────────────────────
{
  const dataDir = mkScratchDir('ubs-runner1-resume-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
    const firstCallOrder = [];
    const first = await runDraftCommand({
      projectId: 'proj-1',
      chapterSpec: '1-2',
      store,
      runChapterDraft: async ({ chapter }) => { firstCallOrder.push(chapter.chapter_number); return { content: 'x', status: 'drafted' }; },
      deps: {},
      dataDir,
      log: () => {},
    });

    const secondCallOrder = [];
    const second = await runDraftCommand({
      projectId: 'proj-1',
      chapterSpec: '1-3',
      resumeRunId: first.runId,
      store,
      runChapterDraft: async ({ chapter }) => { secondCallOrder.push(chapter.chapter_number); return { content: 'y', status: 'drafted' }; },
      deps: {},
      dataDir,
      log: () => {},
    });

    check('8. --resume skips chapters already marked done', JSON.stringify(secondCallOrder) === JSON.stringify([3]),
      `first pass drafted ${JSON.stringify(firstCallOrder)}, resume pass drafted ${JSON.stringify(secondCallOrder)}`);
    check('8b. the resumed run keeps the original runId', second.runId === first.runId);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 9: a stop file halts the run after the current chapter ────────────────
{
  const dataDir = mkScratchDir('ubs-runner1-stop-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
    const runId = generateRunId();
    const callOrder = [];
    const result = await runDraftCommand({
      projectId: 'proj-1',
      resumeRunId: runId,
      store,
      runChapterDraft: async ({ chapter }) => {
        callOrder.push(chapter.chapter_number);
        if (chapter.chapter_number === 1) {
          fs.mkdirSync(path.dirname(runStopPath(dataDir, runId)), { recursive: true });
          fs.writeFileSync(runStopPath(dataDir, runId), 'stop');
        }
        return { content: 'x', status: 'drafted' };
      },
      deps: {},
      dataDir,
      log: () => {},
    });

    check('9. the stop file halts the run after the chapter in flight when it appeared',
      JSON.stringify(callOrder) === JSON.stringify([1]), `callOrder=${JSON.stringify(callOrder)}`);
    check('9b. the halted chapter itself still completed (stop is checked BEFORE the next chapter, not mid-chapter)',
      result.state.chapters['ch-1']?.status === 'done');
    check('9c. chapters after the stop point are left pending, not silently dropped',
      result.state.chapters['ch-2']?.status === 'pending' && result.state.chapters['ch-3']?.status === 'pending');
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 10: a chapter error does not abort the whole run (fail-open across the batch) ──
{
  const dataDir = mkScratchDir('ubs-runner1-error-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
    const result = await runDraftCommand({
      projectId: 'proj-1',
      store,
      runChapterDraft: async ({ chapter }) => {
        if (chapter.chapter_number === 2) throw new Error('simulated drafting failure');
        return { content: 'x', status: 'drafted' };
      },
      deps: {},
      dataDir,
      log: () => {},
    });
    check('10. one chapter erroring does not stop the rest of the run',
      result.state.chapters['ch-1'].status === 'done' &&
      result.state.chapters['ch-2'].status === 'error' &&
      result.state.chapters['ch-3'].status === 'done');
    check('10b. runDraftCommand reports the error count for the caller to act on', result.erroredCount === 1);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 10c-10h: RUNNER1-NOCG-1 — a missing/empty draft result must be recorded
// as an ERROR, never a `done` with sha256('') (false success exposed by
// smoke run run-320aea5ad8b1: the orchestrator's BIBLEGATE returns undefined
// instead of throwing when the story bible is incomplete) ──
{
  const dataDir = mkScratchDir('ubs-runner1-nocg-');
  try {
    const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    // (1) undefined result (the BIBLEGATE shape) → error, not done
    {
      const store = makeFakeStore(FIXTURE_PROJECT, [FIXTURE_CHAPTERS[0]]);
      const result = await runDraftCommand({
        projectId: 'proj-1',
        store,
        runChapterDraft: async () => undefined,
        deps: {},
        dataDir,
        log: () => {},
      });
      const rec = result.state.chapters['ch-1'];
      check('10c. an undefined orchestrator result is recorded as error, not done',
        rec.status === 'error' && typeof rec.error === 'string' && rec.error.includes('Chapter 1') && /no content/i.test(rec.error),
        JSON.stringify(rec));
      // (3a) no empty-content SHA and no paragraphCount on the failure
      check('10d. the failed chapter records neither the empty-string sha nor a paragraphCount',
        rec.contentSha256 !== EMPTY_SHA256 && !('contentSha256' in rec) && !('paragraphCount' in rec),
        JSON.stringify(rec));
    }

    // (2a) empty-string content → error, not done
    {
      const store = makeFakeStore(FIXTURE_PROJECT, [FIXTURE_CHAPTERS[1]]);
      const result = await runDraftCommand({
        projectId: 'proj-1',
        chapterSpec: '2',
        store,
        runChapterDraft: async () => ({ content: '', status: 'drafted' }),
        deps: {},
        dataDir,
        log: () => {},
      });
      const rec = result.state.chapters['ch-2'];
      check('10e. empty-string content is rejected as error, not done, with a clear message and no hash/paragraphCount',
        rec.status === 'error' && result.erroredCount === 1 &&
        !('contentSha256' in rec) && !('paragraphCount' in rec) &&
        typeof rec.error === 'string' && rec.error.includes('Chapter 2') && /no content/i.test(rec.error),
        JSON.stringify({ rec, erroredCount: result.erroredCount }));
    }

    // (2b) whitespace-only content → error, not done
    {
      const store = makeFakeStore(FIXTURE_PROJECT, [FIXTURE_CHAPTERS[2]]);
      const result = await runDraftCommand({
        projectId: 'proj-1',
        chapterSpec: '3',
        store,
        runChapterDraft: async () => ({ content: '   \t\n  ', status: 'drafted' }),
        deps: {},
        dataDir,
        log: () => {},
      });
      const rec = result.state.chapters['ch-3'];
      check('10f. whitespace-only content is rejected as error, not done, with a clear message and no hash/paragraphCount',
        rec.status === 'error' && result.erroredCount === 1 &&
        !('contentSha256' in rec) && !('paragraphCount' in rec) &&
        typeof rec.error === 'string' && rec.error.includes('Chapter 3') && /no content/i.test(rec.error),
        JSON.stringify({ rec, erroredCount: result.erroredCount }));
    }

    // (5) batch behavior after one chapter fails is unchanged: fail-open
    // across the batch, erroredCount counts it, and the GOOD chapters are
    // still `done` with the sha of their real content (proves (4) too —
    // a normal nonempty draft remains successful).
    {
      const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
      const result = await runDraftCommand({
        projectId: 'proj-1',
        store,
        runChapterDraft: async ({ chapter }) => (
          chapter.chapter_number === 2
            ? undefined
            : { content: `real content for chapter ${chapter.chapter_number}`, status: 'drafted' }
        ),
        deps: {},
        dataDir,
        log: () => {},
      });
      const c1 = result.state.chapters['ch-1'];
      const c2 = result.state.chapters['ch-2'];
      const c3 = result.state.chapters['ch-3'];
      const goodSha = (n) => crypto.createHash('sha256').update(`real content for chapter ${n}`).digest('hex');
      check('10g. one no-content failure does not stop the batch; good chapters stay done with their real sha',
        c1.status === 'done' && c3.status === 'done' && c2.status === 'error' &&
        c1.contentSha256 === goodSha(1) && c3.contentSha256 === goodSha(3),
        JSON.stringify({ c1, c2, c3 }));
      check('10h. erroredCount counts the no-content failure so the CLI exits non-zero', result.erroredCount === 1);
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 11: export runs the gate and exits non-zero when blocked ─────────────
{
  const dataDir = mkScratchDir('ubs-runner1-export-');
  try {
    const store = makeFakeStore(FIXTURE_PROJECT, FIXTURE_CHAPTERS);
    process.exitCode = undefined;
    const blockedReport = await runExportCommand({
      projectId: 'proj-1',
      store,
      runGate: async () => ({ blocked: true, hardFailures: [{ chapterNumber: 2, reasons: ['simulated'] }], passed: [] }),
      log: () => {},
    });
    check('11. export command runs the gate and exits non-zero when blocked',
      blockedReport.blocked === true && process.exitCode === 1);

    process.exitCode = undefined;
    const passedReport = await runExportCommand({
      projectId: 'proj-1',
      store,
      runGate: async () => ({ blocked: false, hardFailures: [], passed: [{ chapterNumber: 1 }] }),
      log: () => {},
    });
    check('11b. export command exits zero when the gate passes',
      passedReport.blocked === false && process.exitCode === 0);
    process.exitCode = undefined;
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 12: the Node-side store client shapes requests correctly (no browser) ──
{
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }), text: async () => '' };
  };
  const client = createStoreClient({ baseUrl: 'http://127.0.0.1:5180', token: 'test-token-value', fetchImpl });
  await client.Chapter.filter({ project_id: 'proj-1' }, 'chapter_number', 500);
  await client.Chapter.update('ch-1', { content_md: 'x' });
  await client.NovelProject.get('proj-1');

  check('12. the store client sends the runner token header on every call',
    calls.every((c) => c.options.headers['x-ubs-runner-token'] === 'test-token-value'));
  check('12b. filter posts to /api/store/Chapter/filter with the query/sort/limit body',
    calls[0].url === 'http://127.0.0.1:5180/api/store/Chapter/filter' &&
    JSON.parse(calls[0].options.body).sort === 'chapter_number');
  check('12c. update posts to /api/store/Chapter/update/:id', calls[1].url === 'http://127.0.0.1:5180/api/store/Chapter/update/ch-1');
  check('12d. get reads /api/store/NovelProject/get/:id', calls[2].url === 'http://127.0.0.1:5180/api/store/NovelProject/get/proj-1' && calls[2].options.method === 'GET');
}

// ── 13a: main() calls configureHeadlessEnvironment at the right moment ───
{
  const src = fs.readFileSync(
    path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'scripts', 'ubs-run.mjs'),
    'utf8'
  );
  const mainStart = src.indexOf('async function main');
  const callIdx = src.indexOf('configureHeadlessEnvironment({ token, baseUrl });', mainStart);
  const baseUrlIdx = src.indexOf('const baseUrl = process.env.UBS_SERVER_URL', mainStart);
  const storeIdx = src.indexOf('createStoreClient({ baseUrl, token })', mainStart);
  const dispatchIdx = src.indexOf("if (command === 'draft')", mainStart);

  check('13a. main() calls configureHeadlessEnvironment({ token, baseUrl })',
    callIdx !== -1);
  check('13b. the call is positioned after baseUrl is resolved',
    callIdx !== -1 && baseUrlIdx !== -1 && callIdx > baseUrlIdx);
  check('13c. the call precedes createStoreClient and command dispatch',
    callIdx !== -1 && storeIdx !== -1 && dispatchIdx !== -1 &&
    callIdx < storeIdx && callIdx < dispatchIdx);
}

// ── 13: configureHeadlessEnvironment injects token + server URL ──────────
{
  const sentinelToken = 'headless-sentinel-token-000';
  const priorToken = process.env.UBS_RUNNER_TOKEN;
  const priorUrl = process.env.UBS_SERVER_URL;
  try {
    configureHeadlessEnvironment({ token: sentinelToken, baseUrl: 'http://127.0.0.1:5199' });
    check('13. configureHeadlessEnvironment sets UBS_RUNNER_TOKEN',
      process.env.UBS_RUNNER_TOKEN === sentinelToken);
    check('13b. configureHeadlessEnvironment sets UBS_SERVER_URL',
      process.env.UBS_SERVER_URL === 'http://127.0.0.1:5199');
  } finally {
    if (priorToken === undefined) delete process.env.UBS_RUNNER_TOKEN;
    else process.env.UBS_RUNNER_TOKEN = priorToken;
    if (priorUrl === undefined) delete process.env.UBS_SERVER_URL;
    else process.env.UBS_SERVER_URL = priorUrl;
  }
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
