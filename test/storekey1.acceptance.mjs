// STOREKEY-1 acceptance battery — _FileStore create is an upsert by id.
//
// Live evidence (Arc I finding 62): _FileStore.json had 4,858 records across
// only 4,620 distinct ids — every research/foundation resave of the same
// blob appended a duplicate instead of replacing it (a chapter's NF flagship
// research key was stored 68 times). `case 'create'` never checked whether
// the id already existed; it just pushed. Fixed here for `_FileStore` only —
// every other entity keeps today's append-only create — plus a one-time
// load-time dedupe so stores that already accumulated duplicates before this
// fix landed self-heal the first time they're read into the cache.
//
// Runs the REAL plugin (vite-server-store-plugin.js) against a TEMP data dir
// via the UBS_DATA_DIR override, calling handleRequest directly with a fake
// req/res (matching test/auth1.acceptance.mjs's established pattern) — the
// live data directory is never touched.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-storekey1-'));
process.env.UBS_DATA_DIR = TMP; // must be set BEFORE the plugin import below

const plugin = await import('../vite-server-store-plugin.js');
const { handleRequest, loadStore, cache } = plugin;

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

const UID = 'u-storekey1';

async function create(entity, body) {
  const res = fakeRes();
  await handleRequest(fakeReq({ url: `/api/store/${entity}/create`, method: 'POST', body }), res, UID);
  return res;
}
async function list(entity) {
  const res = fakeRes();
  await handleRequest(fakeReq({ url: `/api/store/${entity}/list` }), res, UID);
  return json(res);
}

// ── 1. baseline: a fresh create still returns 201 and appends ──
{
  const res = await create('_FileStore', { id: 'blob-a', content: 'v1' });
  check('1. baseline create returns 201', res.statusCode === 201, `got ${res.statusCode}`);
  check('1b. baseline create appends to the store', (await list('_FileStore')).length === 1);
}

// ── 2/3/4: a second create with the same id upserts, not appends ──
{
  const createdAt = json(await (async () => {
    const res = fakeRes();
    await handleRequest(fakeReq({ url: '/api/store/_FileStore/get/blob-a' }), res, UID);
    return res;
  })());
  const originalCreatedDate = createdAt.created_date;

  // STOREKEY-1B: nowISO() is new Date().toISOString() (millisecond precision).
  // Two creates issued back-to-back can land in the same millisecond, making
  // check 4b flaky rather than deterministic. The store has no injectable
  // clock, so force the second create's timestamp into a later millisecond.
  await new Promise((resolve) => { setTimeout(resolve, 3); });
  const res2 = await create('_FileStore', { id: 'blob-a', content: 'v2' });
  check('2. a second create with the same id does not add a new record', (await list('_FileStore')).length === 1,
    `store now has ${(await list('_FileStore')).length} record(s)`);
  check('2b. the upsert response is 200, not 201', res2.statusCode === 200, `got ${res2.statusCode}`);

  const survivor = json(res2);
  check('3. the survivor is the NEWER body', survivor.content === 'v2', JSON.stringify(survivor));

  check('4. created_date is preserved from the original create, not overwritten',
    survivor.created_date === originalCreatedDate, `original=${originalCreatedDate} survivor=${survivor.created_date}`);
  check('4b. updated_date is refreshed on the upsert', survivor.updated_date !== originalCreatedDate || survivor.updated_date !== createdAt.updated_date);
}

// ── 5. another entity (Chapter) still appends on a duplicate-id create ──
{
  await create('Chapter', { id: 'ch-dup', title: 'One' });
  const res2 = await create('Chapter', { id: 'ch-dup', title: 'Two' });
  const chapters = await list('Chapter');
  check('5. Chapter create with a duplicate id still returns 201 (append, not upsert)', res2.statusCode === 201, `got ${res2.statusCode}`);
  check('5b. Chapter store now has BOTH records (append-only untouched)',
    chapters.length === 2 && chapters.some((c) => c.title === 'One') && chapters.some((c) => c.title === 'Two'),
    JSON.stringify(chapters));
}

// ── 6. load-time dedupe collapses a seeded 3x-duplicated id to 1 and logs the count ──
{
  const UID2 = 'u-storekey1-dedupe';
  const dir = path.join(TMP, 'users', UID2);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '_FileStore.json'), JSON.stringify([
    { id: 'dupe-key', content: 'first' },
    { id: 'dupe-key', content: 'second' },
    { id: 'dupe-key', content: 'last' },
    { id: 'unique-key', content: 'only-one' },
  ], null, 2));

  const originalLog = console.log;
  const captured = [];
  console.log = (...args) => { captured.push(args.join(' ')); };
  let loaded;
  try {
    loaded = loadStore(UID2, '_FileStore');
  } finally {
    console.log = originalLog;
  }

  check('6. load-time dedupe collapses the 3x-duplicated id down to 1 record',
    loaded.filter((r) => r.id === 'dupe-key').length === 1, JSON.stringify(loaded));
  check('6b. the survivor is the LAST occurrence (content === "last")',
    loaded.find((r) => r.id === 'dupe-key')?.content === 'last');
  check('6c. a non-duplicated id is left untouched', loaded.find((r) => r.id === 'unique-key')?.content === 'only-one');
  check('6d. the exact log line is emitted',
    captured.includes(`[STOREKEY-1] ${UID2}: collapsed 2 duplicate _FileStore record(s) across 1 key(s)`),
    JSON.stringify(captured));
  check('6e. the deduped store was flushed back to disk',
    JSON.parse(fs.readFileSync(path.join(dir, '_FileStore.json'), 'utf8')).length === 2);
}

// ── 7. a store with NO duplicates is not rewritten at load time ──
{
  const UID3 = 'u-storekey1-clean';
  const dir = path.join(TMP, 'users', UID3);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, '_FileStore.json');
  fs.writeFileSync(filePath, JSON.stringify([{ id: 'a', content: '1' }, { id: 'b', content: '2' }], null, 2));
  const mtimeBefore = fs.statSync(filePath).mtimeMs;

  const originalLog = console.log;
  const captured = [];
  console.log = (...args) => { captured.push(args.join(' ')); };
  let loaded;
  try {
    loaded = loadStore(UID3, '_FileStore');
  } finally {
    console.log = originalLog;
  }
  const mtimeAfter = fs.statSync(filePath).mtimeMs;

  check('7. a store with no duplicates is not rewritten (mtime unchanged)', mtimeAfter === mtimeBefore,
    `before=${mtimeBefore} after=${mtimeAfter}`);
  check('7b. no [STOREKEY-1] line is logged when there is nothing to collapse',
    !captured.some((l) => l.includes('[STOREKEY-1]')), JSON.stringify(captured));
  check('7c. the loaded array is unchanged', loaded.length === 2);
}

// ── 8. dedupe never runs for a non-_FileStore entity, even with duplicate ids ──
{
  const UID4 = 'u-storekey1-nonfilestore';
  const dir = path.join(TMP, 'users', UID4);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'Chapter.json'), JSON.stringify([
    { id: 'dup', title: 'A' },
    { id: 'dup', title: 'B' },
  ], null, 2));

  const originalLog = console.log;
  const captured = [];
  console.log = (...args) => { captured.push(args.join(' ')); };
  let loaded;
  try {
    loaded = loadStore(UID4, 'Chapter');
  } finally {
    console.log = originalLog;
  }

  check('8. a non-_FileStore entity keeps duplicate ids untouched on load', loaded.length === 2, JSON.stringify(loaded));
  check('8b. no [STOREKEY-1] line is logged for a non-_FileStore entity', !captured.some((l) => l.includes('[STOREKEY-1]')));
}

// ── 9. delete is unaffected by the upsert/dedupe changes ──
{
  const res = fakeRes();
  await handleRequest(fakeReq({ url: '/api/store/_FileStore/delete/blob-a', method: 'DELETE' }), res, UID);
  check('9. delete still works after the upsert change', json(res)?.ok === true, JSON.stringify(json(res)));
  check('9b. the deleted record is gone from the list', (await list('_FileStore')).every((r) => r.id !== 'blob-a'));
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
