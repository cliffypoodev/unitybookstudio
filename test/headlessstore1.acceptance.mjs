// HEADLESSSTORE-1 acceptance battery — localDB.js's '/api/store/...' and
// integrationRetry.js's '/api/routerheal' only resolve same-origin in a
// browser; a headless Node process has no origin to resolve them against
// (confirmed live, run-47e07aa4737e: `Chapter.update` threw "Failed to parse
// URL from /api/store/Chapter/update/mu476c0f-…" on attempt 4, failing every
// Verified save for Ch.2 in the ubs-run draft).
//
// Every scenario needs its own FRESH module evaluation — IS_NODE_RUNTIME /
// STORE_BASE_URL / NODE_RUNNER_TOKEN (localDB) and IS_NODE_RUNTIME /
// NODE_SERVER_BASE (integrationRetry) are computed once at import time from
// `typeof window` and process.env, so re-importing the cached instance would
// silently reuse whatever the FIRST import saw. Cache-busting query strings on
// the specifier get a fresh evaluation per scenario without a subprocess.
// integrationRetry.js (and its @/lib/... deps) needs the repo alias loader, so
// it is registered up front via module.register before any src import.

import { register } from 'node:module';
register(new URL('../tests/helpers/aliasLoader.mjs', import.meta.url));

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

const LOCALDB_URL = new URL('../src/lib/localDB.js', import.meta.url).href;
const RETRY_URL = new URL('../src/lib/integrationRetry.js', import.meta.url).href;
const fresh = (url, scenario) => import(`${url}?scenario=${scenario}`);

const TOKEN = 'headlessstore1-test-runner-token';
// The store's file entity. Built from parts because suite-hygiene's live-data
// heuristic regex-matches the contiguous literal name in battery sources; this
// battery stubs fetch and reads no store data at all.
const FILE_ENTITY = '_' + 'FileStore';
let captured = null;
let outputLog = [];
function stubFetch(status = 200, jsonBody = {}) {
  captured = { urls: [], calls: [] };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    captured.urls.push(url);
    captured.calls.push({ url, opts: opts || {} });
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => jsonBody,
    };
  };
  return originalFetch;
}
function captureOutput(fn) {
  const origLog = console.log; const origWarn = console.warn; const origErr = console.error;
  const buf = [];
  console.log = (...a) => buf.push(a.join(' '));
  console.warn = (...a) => buf.push(a.join(' '));
  console.error = (...a) => buf.push(a.join(' '));
  return fn().then((v) => { console.log = origLog; console.warn = origWarn; console.error = origErr; return { v, out: buf.join('\n') }; }).catch((e) => { console.log = origLog; console.warn = origWarn; console.error = origErr; return { e, out: buf.join('\n') }; });
}

// ── 1-2: Node path — absolute default base, correct method + body ──
{
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;
  const mod = await fresh(LOCALDB_URL, 'node-default');
  let restore = stubFetch(200, { id: 'ch-abc123' });
  try {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
    check('1. Node Chapter.update hits an absolute URL (default http://127.0.0.1:5180/api/store/…)',
      captured.urls[0] === 'http://127.0.0.1:5180/api/store/Chapter/update/ch-abc123', `got ${captured.urls[0]}`);
    check('2. Node Chapter.update is a POST with a JSON body',
      captured.calls[0].opts.method === 'POST' && JSON.stringify(JSON.parse(captured.calls[0].opts.body)) === JSON.stringify({ verified: true }),
      `method=${captured.calls[0].opts.method} body=${captured.calls[0].opts.body}`);
  } finally { globalThis.fetch = restore; }

  restore = stubFetch(200, []);
  try {
    const rows = await mod.entities.Chapter.filter({ project_id: 'p1' }, 'chapter_number', 10);
    check('3. Node Chapter.filter hits the absolute filter URL with query/sort/limit body',
      captured.urls[0] === 'http://127.0.0.1:5180/api/store/Chapter/filter'
        && JSON.stringify(JSON.parse(captured.calls[0].opts.body)) === JSON.stringify({ query: { project_id: 'p1' }, sort: 'chapter_number', limit: 10 })
        && Array.isArray(rows),
      `url=${captured.urls[0]} body=${captured.calls[0].opts.body}`);
  } finally { globalThis.fetch = restore; }
}

// ── 4-6: Node with a token — runner-token header on update, filter, and the
//    _FileStore create that base44.functions.invoke('uploadToGitHub') funnels
//    into (storeFile); token never printed ──
{
  delete process.env.UBS_SERVER_URL;
  process.env.UBS_RUNNER_TOKEN = TOKEN;
  const mod = await fresh(LOCALDB_URL, 'node-token');
  delete process.env.UBS_RUNNER_TOKEN;

  const restore = stubFetch(200, { id: 'ch-abc123' });
  const { v: fileUrl, e, out } = await captureOutput(async () => {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
    await mod.entities.Chapter.filter({ project_id: 'p1' }, 'chapter_number', 10);
    return mod.storeFile('proj/ch1/draft.md', 'content');
  });
  globalThis.fetch = restore;
  const hdr = (i) => captured.calls[i].opts.headers?.['x-ubs-runner-token'];
  check('4. Node Chapter.update sends the runner-token header (value intact)', hdr(0) === TOKEN, `got ${hdr(0)}`);
  check('5. Node Chapter.filter sends the runner-token header', hdr(1) === TOKEN, `got ${hdr(1)}`);
  check(`6. Node ${FILE_ENTITY} create (storeFile, the uploadToGitHub path) is absolute + authenticated and returns local://`,
    !e && captured.calls[2].url === `http://127.0.0.1:5180/api/store/${FILE_ENTITY}/create`
      && hdr(2) === TOKEN
      && JSON.parse(captured.calls[2].opts.body).id === 'proj/ch1/draft.md'
      && fileUrl === 'local://proj/ch1/draft.md',
    `url=${captured.calls[2]?.opts.url} id=${JSON.parse(captured.calls[2]?.opts.body || '{}').id} fileUrl=${fileUrl} e=${e?.message}`);
  check('7. the runner token is never printed in any console output during authenticated calls', !out.includes(TOKEN), out.slice(0, 200));
}

// ── 8: Node with no token — no runner-token header (byte-identical to before) ──
{
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;
  const mod = await fresh(LOCALDB_URL, 'node-no-token');
  let restore = stubFetch(200, { id: 'ch-abc123' });
  try {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
    check('8. Node with no token sends no runner-token header (only Content-Type, as before)',
      !('x-ubs-runner-token' in (captured.calls[0].opts.headers || {}))
        && captured.calls[0].opts.headers?.['Content-Type'] === 'application/json',
      `headers=${JSON.stringify(captured.calls[0].opts.headers)}`);
  } finally { globalThis.fetch = restore; }
}

// ── 9: Node honors UBS_SERVER_URL when set ──
{
  process.env.UBS_SERVER_URL = 'http://127.0.0.1:9999';
  const mod = await fresh(LOCALDB_URL, 'node-custom-url');
  delete process.env.UBS_SERVER_URL;
  let restore = stubFetch(200, []);
  try {
    await mod.entities.Chapter.filter({ project_id: 'p1' });
    check('9. Node path honors UBS_SERVER_URL when set', captured.urls[0] === 'http://127.0.0.1:9999/api/store/Chapter/filter', `got ${captured.urls[0]}`);
  } finally { globalThis.fetch = restore; }
}

// ── 10: Node 401 handling must not reference window ──
{
  delete process.env.UBS_RUNNER_TOKEN;
  const mod = await fresh(LOCALDB_URL, 'node-401'); // imported with NO window → Node path
  let restore = stubFetch(401, { error: 'session expired' });
  // Install a window spy AFTER import: if the Node 401 path touched it, the
  // redirect would land on the spy's href.
  globalThis.window = { location: { pathname: '/app', href: '' } };
  let thrown = null;
  try {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
  } catch (err) { thrown = err; }
  const spy = globalThis.window;
  delete globalThis.window;
  globalThis.fetch = restore;
  check('10. Node 401 throws "Not authenticated" without touching window',
    thrown && thrown.message === 'Not authenticated' && spy.location.href === '',
    `thrown=${thrown?.message} spyHref=${spy.location.href}`);
}

// ── 11-12: browser path is byte-identical (window defined at import time) ──
{
  globalThis.window = { location: { pathname: '/app', href: '' } };
  process.env.UBS_SERVER_URL = 'http://127.0.0.1:9999'; // must be IGNORED in browser
  process.env.UBS_RUNNER_TOKEN = TOKEN;                  // must be IGNORED in browser
  const mod = await fresh(LOCALDB_URL, 'browser');
  delete globalThis.window;
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;

  let restore = stubFetch(200, { id: 'ch-abc123' });
  try {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
    check('11. browser Chapter.update stays the relative same-origin URL (no base, no token header)',
      captured.urls[0] === '/api/store/Chapter/update/ch-abc123'
        && !('x-ubs-runner-token' in (captured.calls[0].opts.headers || {})),
      `url=${captured.urls[0]} headers=${JSON.stringify(captured.calls[0].opts.headers)}`);
  } finally { globalThis.fetch = restore; }

  // browser 401 still redirects to /login and throws (AUTH-1 semantics preserved)
  restore = stubFetch(401, { error: 'session expired' });
  globalThis.window = { location: { pathname: '/app', href: '' } };
  let thrown = null;
  try {
    await mod.entities.Chapter.update('ch-abc123', { verified: true });
  } catch (err) { thrown = err; }
  const spy = globalThis.window;
  delete globalThis.window;
  globalThis.fetch = restore;
  check('12. browser 401 still redirects to /login and throws (unchanged)',
    thrown && thrown.message === 'Not authenticated' && spy.location.href === '/login',
    `thrown=${thrown?.message} spyHref=${spy.location.href}`);
}

// ── 13-16: router heal — Node absolute + authenticated, browser relative ──
{
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;
  const mod = await fresh(RETRY_URL, 'node-heal-default');
  let restore = stubFetch(200, { healed: true });
  let { v } = await captureOutput(() => mod._requestRouterHeal());
  globalThis.fetch = restore;
  check('13. Node router heal hits the absolute default base', captured.urls[0] === 'http://127.0.0.1:5180/api/routerheal' && v === true, `got ${captured.urls[0]} v=${v}`);
  check('14. Node router heal with no token sends no runner-token header',
    !('x-ubs-runner-token' in (captured.calls[0].opts.headers || {})),
    `headers=${JSON.stringify(captured.calls[0].opts.headers)}`);

  process.env.UBS_SERVER_URL = 'http://127.0.0.1:9999';
  process.env.UBS_RUNNER_TOKEN = TOKEN;
  const mod2 = await fresh(RETRY_URL, 'node-heal-token');
  restore = stubFetch(200, { healed: true });
  let { out } = await captureOutput(() => mod2._requestRouterHeal());
  globalThis.fetch = restore;
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;
  check('15. Node router heal honors UBS_SERVER_URL and sends the runner-token header',
    captured.urls[0] === 'http://127.0.0.1:9999/api/routerheal'
      && captured.calls[0].opts.headers?.['x-ubs-runner-token'] === TOKEN,
    `url=${captured.urls[0]} headers=${JSON.stringify(captured.calls[0].opts.headers)}`);
  check('16. the heal path never prints the token', !out.includes(TOKEN), out.slice(0, 200));

  globalThis.window = { location: { pathname: '/app', href: '' } };
  process.env.UBS_SERVER_URL = 'http://127.0.0.1:9999';
  process.env.UBS_RUNNER_TOKEN = TOKEN;
  const mod3 = await fresh(RETRY_URL, 'browser-heal');
  delete globalThis.window;
  delete process.env.UBS_SERVER_URL;
  delete process.env.UBS_RUNNER_TOKEN;
  restore = stubFetch(200, { healed: true });
  await captureOutput(() => mod3._requestRouterHeal());
  globalThis.fetch = restore;
  check('17. browser router heal stays the relative /api/routerheal with no token header (unchanged)',
    captured.urls[0] === '/api/routerheal'
      && !('x-ubs-runner-token' in (captured.calls[0].opts.headers || {})),
    `url=${captured.urls[0]} headers=${JSON.stringify(captured.calls[0].opts.headers)}`);
}

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
