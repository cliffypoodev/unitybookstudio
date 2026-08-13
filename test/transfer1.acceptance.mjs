// TRANSFER-1 acceptance battery — move a book between user libraries.
//
// The requirement (Cliff, 2026-08-13): create another account and move a couple of
// titles from the main library over to it. A "book" is the NovelProject record plus
// everything it owns: Chapters (project_id), PublishingAsset (project_id),
// CoverArtGallery (project_id), and every _FileStore blob under "<projectId>/".
// Copy-to-target flushes BEFORE remove-from-source (crash duplicates, never loses).
// Locks are taken in sorted order across both users (no deadlock). folder_id is
// cleared (folders are per-user).
//
// Runs the REAL handlers against a TEMP data dir (UBS_DATA_DIR set before import).
// Fixtures are generic.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-transfer1-'));
process.env.UBS_DATA_DIR = TMP; // must be set BEFORE the plugin import below

const plugin = await import('../vite-server-store-plugin.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

function fakeReq({ url, method = 'GET', cookie = '', body = null }) {
  return {
    url, method, headers: { cookie },
    on(event, cb) {
      if (event === 'data' && body != null) cb(Buffer.from(JSON.stringify(body)));
      if (event === 'end') cb();
    },
  };
}
function fakeRes() {
  return { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(d) { this.body = String(d || ''); } };
}
const json = (res) => { try { return JSON.parse(res.body); } catch { return null; } };
const cookieFrom = (res) => String(res.headers['set-cookie'] || '').split(';')[0];

// ── setup: two users via the real endpoints ──
let res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/setup', method: 'POST', body: { username: 'owner', password: 'password123' } }), res);
const ownerCookie = cookieFrom(res);
const uidA = json(res).user.id;
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/create-user', method: 'POST', cookie: ownerCookie, body: { username: 'partner', password: 'password456' } }), res);
const uidB = json(res).user.id;

// seed owner's library: 2 books, one with chapters/blobs/assets/covers, plus a decoy
const mk = async (entity, body, uid) => { const r = fakeRes(); await plugin.handleRequest(fakeReq({ url: `/api/store/${entity}/create`, method: 'POST', body }), r, uid); return json(r); };
const bookOne = await mk('NovelProject', { id: 'gen-one', title: 'Generic Book One', folder_id: 'folder-a' }, uidA);
await mk('NovelProject', { id: 'gen-two', title: 'Generic Book Two' }, uidA);
await mk('Chapter', { id: 'ch1', project_id: 'gen-one', chapter_number: 1 }, uidA);
await mk('Chapter', { id: 'ch2', project_id: 'gen-one', chapter_number: 2 }, uidA);
await mk('Chapter', { id: 'ch-decoy', project_id: 'gen-two', chapter_number: 1 }, uidA);
await mk('_FileStore', { id: 'gen-one/ch1/blob-a', content: 'alpha' }, uidA);
await mk('_FileStore', { id: 'gen-one/outline_md/blob-b', content: 'beta' }, uidA);
await mk('_FileStore', { id: 'gen-two/ch1/blob-decoy', content: 'decoy' }, uidA);
await mk('PublishingAsset', { id: 'asset-1', project_id: 'gen-one', kind: 'blurb' }, uidA);
await mk('CoverArtGallery', { id: 'cover-1', project_id: 'gen-one' }, uidA);

// ── refusal cases ──
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/transfer-project', method: 'POST', body: { projectId: 'gen-one', toUsername: 'partner' } }), res);
check('1. transfer WITHOUT session -> 401', res.statusCode === 401);
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/transfer-project', method: 'POST', cookie: ownerCookie, body: { projectId: 'gen-one', toUsername: 'nobody' } }), res);
check('2. unknown destination refused', res.statusCode === 400 && /No such user/.test(json(res).error));
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/transfer-project', method: 'POST', cookie: ownerCookie, body: { projectId: 'gen-one', toUsername: 'owner' } }), res);
check('3. transfer to self refused', /already in your library/.test(json(res).error));
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/transfer-project', method: 'POST', cookie: ownerCookie, body: { projectId: 'not-mine', toUsername: 'partner' } }), res);
check('4. project not in your library refused (404)', res.statusCode === 404);

// ── the transfer ──
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/transfer-project', method: 'POST', cookie: ownerCookie, body: { projectId: 'gen-one', toUsername: 'PARTNER' } }), res);
const result = json(res);
check('5. transfer succeeds (username case-insensitive)', result?.ok === true);
check('6. counts: 2 chapters, 2 blobs, 1 asset, 1 cover', result.chapters === 2 && result.blobs === 2 && result.assets === 1 && result.covers === 1);

// ── source state ──
const list = async (entity, uid) => { const r = fakeRes(); await plugin.handleRequest(fakeReq({ url: `/api/store/${entity}/list` }), r, uid); return json(r); };
const aProjects = await list('NovelProject', uidA);
check('7. book gone from source library; decoy book remains', aProjects.length === 1 && aProjects[0].id === 'gen-two');
check('8. source chapters: only the decoy remains', (await list('Chapter', uidA)).every((c) => c.project_id === 'gen-two'));
check('9. source blobs: only the decoy remains', (await list('_FileStore', uidA)).every((b) => b.id.startsWith('gen-two/')));
check('10. source assets/covers empty', (await list('PublishingAsset', uidA)).length === 0 && (await list('CoverArtGallery', uidA)).length === 0);

// ── target state ──
const bProjects = await list('NovelProject', uidB);
check('11. book present in destination library', bProjects.length === 1 && bProjects[0].id === 'gen-one' && bProjects[0].title === 'Generic Book One');
check('12. folder_id cleared on the moved book', bProjects[0].folder_id === null);
const bChapters = await list('Chapter', uidB);
check('13. destination has both chapters with ids intact', bChapters.length === 2 && bChapters.some((c) => c.id === 'ch1') && bChapters.some((c) => c.id === 'ch2'));
const bBlobs = await list('_FileStore', uidB);
check('14. destination has both blobs with content intact', bBlobs.length === 2 && bBlobs.find((b) => b.id === 'gen-one/ch1/blob-a')?.content === 'alpha');
check('15. destination has the asset and cover', (await list('PublishingAsset', uidB)).length === 1 && (await list('CoverArtGallery', uidB)).length === 1);

// ── on-disk separation after transfer ──
const aFile = JSON.parse(fs.readFileSync(path.join(TMP, 'users', uidA, 'NovelProject.json'), 'utf8'));
const bFile = JSON.parse(fs.readFileSync(path.join(TMP, 'users', uidB, 'NovelProject.json'), 'utf8'));
check('16. on disk: book only in destination file', !aFile.some((r) => r.id === 'gen-one') && bFile.some((r) => r.id === 'gen-one'));

// ── UI wiring (source-level) ──
const LOGIN = fs.readFileSync(new URL('../src/pages/Login.jsx', import.meta.url), 'utf8');
check('17. Login page has the transfer picker + destination field', /Transfer a book/.test(LOGIN) && /transferProject\(transferBook, transferTo\)/.test(LOGIN));
const CLIENT = fs.readFileSync(new URL('../src/api/base44Client.js', import.meta.url), 'utf8');
check('18. client exposes auth.transferProject', /async transferProject\(projectId, toUsername\)/.test(CLIENT));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
