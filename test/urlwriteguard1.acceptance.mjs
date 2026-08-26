// URLWRITE-GUARD-1 acceptance battery — the store refuses the corruption shape.
//
// The Base44-era corruption shape: a Chapter's content_md is empty while
// content_md_url points at nothing this store can resolve (a remote URL, or
// a local:// key with no _FileStore record for that uid). Live evidence
// (Arc I finding 62): 1,579+ chapters, 100% either inline content_md or a
// resolvable local:// key, 0 remote, 0 unresolvable — this guard exists to
// keep it that way rather than to fix an existing problem.
//
// Runs the REAL plugin (vite-server-store-plugin.js) against a TEMP data dir
// via the UBS_DATA_DIR override, calling handleRequest directly with a fake
// req/res (matching test/auth1.acceptance.mjs's established pattern) — the
// live data directory is never touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-urlwriteguard1-'));
process.env.UBS_DATA_DIR = TMP; // must be set BEFORE the plugin import below

const plugin = await import('../vite-server-store-plugin.js');
const { handleRequest } = plugin;

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

function fakeReq({ url, method = 'GET', body = null }) {
  return {
    url, method, headers: {},
    on(event, cb) {
      if (event === 'data' && body != null) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    },
  };
}
function fakeRes() {
  return { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(data) { this.body = String(data || ''); this.done = true; } };
}
const json = (res) => { try { return JSON.parse(res.body); } catch { return null; } };

const UID = 'u-urlwriteguard1';

async function createOn(entity, body) {
  const res = fakeRes();
  await handleRequest(fakeReq({ url: `/api/store/${entity}/create`, method: 'POST', body }), res, UID);
  return res;
}
async function updateOn(entity, id, fields) {
  const res = fakeRes();
  await handleRequest(fakeReq({ url: `/api/store/${entity}/update/${id}`, method: 'POST', body: fields }), res, UID);
  return res;
}
async function list(entity) {
  const res = fakeRes();
  await handleRequest(fakeReq({ url: `/api/store/${entity}/list` }), res, UID);
  return json(res);
}

const originalWarn = console.warn;
let warnLog = [];
console.warn = (...args) => { warnLog.push(args.join(' ')); };

// ── (a) CREATE: remote URL + empty content_md -> 422 ──
{
  warnLog = [];
  const res = await createOn('Chapter', { project_id: 'projA', chapter_number: 1, content_md: '', content_md_url: 'https://example.com/dead.md' });
  check('1. remote URL + empty content_md is rejected (422)', res.statusCode === 422, `got ${res.statusCode}`);
  check('1b. the error message is prefixed URLWRITE-GUARD-1:', /^URLWRITE-GUARD-1:/.test(json(res)?.error || ''), JSON.stringify(json(res)));
  check('1c. the exact log line is emitted',
    warnLog.includes('[URLWRITE-GUARD-1] Ch.1 of projA rejected: content_md empty while content_md_url=https://example.com/dead.md does not resolve'),
    JSON.stringify(warnLog));
  check('1d. the record was NOT persisted', (await list('Chapter')).length === 0);
}

// ── (b) CREATE: local:// key that does NOT resolve -> 422 ──
{
  const res = await createOn('Chapter', { project_id: 'projB', chapter_number: 2, content_md: '', content_md_url: 'local://projB/ch2/does-not-exist' });
  check('2. unresolvable local:// key + empty content_md is rejected (422)', res.statusCode === 422, `got ${res.statusCode}`);
  check('2b. the error message is present', typeof json(res)?.error === 'string' && json(res).error.length > 0);
}

// ── (b-cont) same rejection on UPDATE, via the merged record ──
{
  const createRes = await createOn('Chapter', { project_id: 'projB', chapter_number: 3, content_md: '', content_md_url: '' });
  check('2c. an empty new chapter is legal to create', createRes.statusCode === 201, `got ${createRes.statusCode}`);
  const chapterId = json(createRes).id;

  const updateRes = await updateOn('Chapter', chapterId, { content_md_url: 'local://projB/ch3/still-missing' });
  check('2d. an update that introduces an unresolvable local:// key (content_md still empty) is rejected (422)',
    updateRes.statusCode === 422, `got ${updateRes.statusCode}`);
}

// ── (c) local:// key that DOES resolve -> 200, record unchanged (the common case) ──
{
  const fsRes = await createOn('_FileStore', { id: 'projC/ch3/chapter-ch3-20260101000000-aaa', content: 'Real chapter prose.' });
  check('setup: seed _FileStore record for the resolvable case', fsRes.statusCode === 201, `got ${fsRes.statusCode}`);

  const createRes = await createOn('Chapter', {
    project_id: 'projC', chapter_number: 3,
    content_md: '', content_md_url: 'local://projC/ch3/chapter-ch3-20260101000000-aaa',
  });
  check('3. local:// + resolvable is accepted (201)', createRes.statusCode === 201, `got ${createRes.statusCode}`);
  const created = json(createRes);
  check('3b. content_md_url is byte-identical, unchanged', created.content_md_url === 'local://projC/ch3/chapter-ch3-20260101000000-aaa');
  check('3c. content_md is still empty, not rewritten', created.content_md === '');

  const updateRes = await updateOn('Chapter', created.id, { title: 'Renamed' });
  check('3d. an unrelated-field update on a resolvable-url chapter is accepted (200, not 422)', updateRes.statusCode === 200, `got ${updateRes.statusCode}`);
  check('3e. the resolvable content_md_url survives the unrelated update unchanged', json(updateRes).content_md_url === 'local://projC/ch3/chapter-ch3-20260101000000-aaa');
}

// ── (d) inline content_md present -> 200 regardless of content_md_url ──
{
  const res1 = await createOn('Chapter', { project_id: 'projD', chapter_number: 1, content_md: 'Some real inline prose.', content_md_url: 'https://example.com/dead.md' });
  check('4. inline content_md wins over a dead content_md_url (201)', res1.statusCode === 201, `got ${res1.statusCode}`);

  const res2 = await createOn('Chapter', { project_id: 'projD', chapter_number: 2, content_md: 'More inline prose.' });
  check('4b. inline content_md with content_md_url absent entirely (201)', res2.statusCode === 201, `got ${res2.statusCode}`);

  const legalEmpty = json(await createOn('Chapter', { project_id: 'projD', chapter_number: 4 }));
  const res3 = await updateOn('Chapter', legalEmpty.id, { content_md: 'Newly written prose.', content_md_url: 'https://example.com/dead.md' });
  check('4c. an update that sets inline content_md while content_md_url stays dead is accepted (200)', res3.statusCode === 200, `got ${res3.statusCode}`);
}

// ── (e) both empty -> 200 (brand-new empty chapter legal) ──
{
  const res1 = await createOn('Chapter', { project_id: 'projE', chapter_number: 1 });
  check('5. both content_md and content_md_url empty is accepted (201)', res1.statusCode === 201, `got ${res1.statusCode}`);

  const res2 = await updateOn('Chapter', json(res1).id, { title: 'Still Untitled' });
  check('5b. an unrelated update on a still-empty chapter is accepted (200)', res2.statusCode === 200, `got ${res2.statusCode}`);
}

// ── (f) the guard never affects a non-Chapter entity ──
{
  const res1 = await createOn('NovelProject', { title: 'Fixture Project', content_md: '', content_md_url: 'https://example.com/dead.md' });
  check('6. NovelProject with the same dead shape is unaffected (201)', res1.statusCode === 201, `got ${res1.statusCode}`);

  const res2 = await createOn('_FileStore', { id: 'unrelated-key', content_md: '', content_md_url: 'https://example.com/dead.md' });
  check('6b. _FileStore with the same dead shape is unaffected (201)', res2.statusCode === 201, `got ${res2.statusCode}`);
}

console.warn = originalWarn;

// ── source-shape smoke check: the guard is wired into both handlers exactly once each ──
{
  const src = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
  const createBlock = src.slice(src.indexOf("case 'create'"), src.indexOf("case 'update'"));
  const updateBlock = src.slice(src.indexOf("case 'update'"), src.indexOf("case 'delete'"));
  check('7. checkUrlwriteGuard1 is wired into case \'create\' exactly once', (createBlock.match(/checkUrlwriteGuard1\(/g) || []).length === 1);
  check('7b. checkUrlwriteGuard1 is wired into case \'update\' exactly once', (updateBlock.match(/checkUrlwriteGuard1\(/g) || []).length === 1);

  // Adversarial-review finding: the enclosing switch's own `finally { release(); }`
  // already releases the per-entity mutex exactly once when a case returns early —
  // an explicit `release();` right before the guard's `return` would fire it TWICE,
  // letting a second queued Chapter request acquire the lock while the first is
  // still mid-response (a real, reproduced double-grant, not theoretical). Pin the
  // guard's rejection line to call release() zero times, not once, so this can't
  // silently regress back to the double-release shape.
  const guardRejectLines = [...createBlock.matchAll(/if \(guardError\) \{ ([^}]+) \}/g), ...updateBlock.matchAll(/if \(guardError\) \{ ([^}]+) \}/g)];
  check('8. the guard\'s early return does not manually release the mutex (the enclosing finally already does, exactly once)',
    guardRejectLines.length === 2 && guardRejectLines.every((m) => !/\brelease\(\)/.test(m[1])),
    JSON.stringify(guardRejectLines.map((m) => m[1])));
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
