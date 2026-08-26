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

import {
  ensureRunnerToken, verifyRunnerToken, createUser,
} from '../server/authCore.js';
import {
  UBS_RUN_VERSION, parseChapterRange, parseArgs, createStoreClient,
  runDraftCommand, runExportCommand, loadRunState, generateRunId,
  runStopPath,
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

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
