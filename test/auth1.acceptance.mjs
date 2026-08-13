// AUTH-1 acceptance battery — login + per-user data separation.
//
// The requirement (Cliff, 2026-08-13): a login page that cleanly separates all
// projects per user so no one else can view them. Design: scrypt-hashed local
// accounts, HMAC-signed httpOnly session cookies, HARD per-user data
// directories (data/users/<uid>/<Entity>.json — the store layer never opens
// another user's file), first-run migration that moves the legacy top-level
// stores into the first account atomically, and a session gate on /api/store,
// /api/routerheal, /llama and /search-bridge.
//
// Runs the REAL modules (server/authCore.js + the vite plugin's exported
// handlers) against a TEMP data dir via the UBS_DATA_DIR override — the live
// data directory is never touched. Fixtures are generic.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ubs-auth1-'));
process.env.UBS_DATA_DIR = TMP; // must be set BEFORE the plugin import below

const {
  hashPassword, verifyPassword, createSessionToken, verifySessionToken,
  createUser, authenticate, usersExist, getSecret, userDataDir, migrateLegacyData,
  SESSION_COOKIE,
} = await import('../server/authCore.js');
const plugin = await import('../vite-server-store-plugin.js');

let failures = 0;
const check = (name, pass, detail) => { console.log((pass ? 'PASS ' : 'FAIL ') + name + (pass || !detail ? '' : `\n      ${detail}`)); if (!pass) failures += 1; };

// ── fake req/res for the HTTP handlers ──
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
  const res = { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(data) { this.body = String(data || ''); this.done = true; } };
  return res;
}
const json = (res) => { try { return JSON.parse(res.body); } catch { return null; } };
const cookieFrom = (res) => String(res.headers['set-cookie'] || '').split(';')[0];

// ── 1. crypto primitives ──
const { salt, hash } = hashPassword('correct horse battery');
check('1. scrypt verify accepts the right password', verifyPassword('correct horse battery', salt, hash));
check('2. scrypt verify rejects the wrong password', !verifyPassword('wrong password!', salt, hash));

const secret = getSecret(TMP);
const token = createSessionToken('u-abc123', secret);
check('3. session token round-trips', verifySessionToken(token, secret)?.uid === 'u-abc123');
check('4. tampered token rejected', verifySessionToken(token.slice(0, -4) + 'AAAA', secret) === null);
check('5. expired token rejected', verifySessionToken(createSessionToken('u-abc123', secret, -1000), secret) === null);

// ── 2. user rules ──
let threw = '';
try { createUser(TMP, { username: 'x', password: 'longenough1' }); } catch (e) { threw = e.message; }
check('6. short username refused', /at least 2/.test(threw));
threw = '';
try { createUser(TMP, { username: 'valid', password: 'short' }); } catch (e) { threw = e.message; }
check('7. short password refused', /at least 8/.test(threw));
threw = '';
try { userDataDir(TMP, '../evil'); } catch (e) { threw = e.message; }
check('8. path-traversal uid refused', /Invalid user id/.test(threw));

// ── 3. first-run setup + legacy migration through the REAL auth endpoint ──
// Plant generic legacy stores at the top level (the pre-AUTH layout).
fs.writeFileSync(path.join(TMP, 'NovelProject.json'), JSON.stringify([{ id: 'p1', title: 'Generic Book One' }, { id: 'p2', title: 'Generic Book Two' }]));
fs.writeFileSync(path.join(TMP, 'Chapter.json'), JSON.stringify([{ id: 'c1', project_id: 'p1', chapter_number: 1 }]));

let res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/status' }), res);
check('9. status before setup: no users, not authenticated', json(res).usersExist === false && json(res).authenticated === false);

res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/setup', method: 'POST', body: { username: 'OwnerOne', password: 'password123', displayName: 'Owner One' } }), res);
const setupBody = json(res);
const ownerCookie = cookieFrom(res);
check('10. first-run setup creates the account and a session cookie', res.statusCode === 201 && ownerCookie.startsWith(SESSION_COOKIE + '='));
check('11. setup migrated the legacy stores', Array.isArray(setupBody.migrated) && setupBody.migrated.includes('NovelProject') && setupBody.migrated.includes('Chapter'));
const uidA = setupBody.user.id;
check('12. legacy files physically moved into the first user dir',
  !fs.existsSync(path.join(TMP, 'NovelProject.json')) && fs.existsSync(path.join(TMP, 'users', uidA, 'NovelProject.json')));
check('13. migration is idempotent', migrateLegacyData(TMP, uidA, ['NovelProject']).skipped === 'already-migrated');

res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/setup', method: 'POST', body: { username: 'intruder', password: 'password123' } }), res);
check('14. second setup refused once users exist', res.statusCode === 403);

// ── 4. login / me / bad credentials ──
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/login', method: 'POST', body: { username: 'ownerone', password: 'WRONG-password' } }), res);
check('15. wrong password -> 401', res.statusCode === 401);

res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/me', cookie: ownerCookie }), res);
check('16. /me with cookie returns the user', json(res)?.username === 'ownerone');
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/me' }), res);
check('17. /me without cookie -> 401', res.statusCode === 401);

// ── 5. second user via create-user (auth-required) + HARD separation ──
res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/create-user', method: 'POST', body: { username: 'guest', password: 'password456' } }), res);
check('18. create-user WITHOUT session -> 401', res.statusCode === 401);

res = fakeRes();
await plugin.handleAuth(fakeReq({ url: '/api/auth/create-user', method: 'POST', cookie: ownerCookie, body: { username: 'guest', password: 'password456' } }), res);
const uidB = json(res).user.id;
check('19. create-user with session succeeds', res.statusCode === 201 && !!uidB);

// owner sees the migrated books; guest sees an EMPTY library
res = fakeRes();
await plugin.handleRequest(fakeReq({ url: '/api/store/NovelProject/list', cookie: ownerCookie }), res, uidA);
check('20. owner lists the 2 migrated books', json(res).length === 2);
res = fakeRes();
await plugin.handleRequest(fakeReq({ url: '/api/store/NovelProject/list' }), res, uidB);
check('21. second user lists ZERO books (hard separation)', Array.isArray(json(res)) && json(res).length === 0);

// guest creates a book; owner must never see it, and it must live in guest's dir
res = fakeRes();
await plugin.handleRequest(fakeReq({ url: '/api/store/NovelProject/create', method: 'POST', body: { title: 'Guest Private Book' } }), res, uidB);
check('22. guest creates a record in their own store', res.statusCode === 201);
res = fakeRes();
await plugin.handleRequest(fakeReq({ url: '/api/store/NovelProject/list' }), res, uidA);
check('23. owner still sees exactly 2 (guest book invisible)', json(res).length === 2 && !json(res).some((r) => r.title === 'Guest Private Book'));
const guestFile = JSON.parse(fs.readFileSync(path.join(TMP, 'users', uidB, 'NovelProject.json'), 'utf8'));
const ownerFile = JSON.parse(fs.readFileSync(path.join(TMP, 'users', uidA, 'NovelProject.json'), 'utf8'));
check('24. on-disk separation: guest book only in guest file', guestFile.some((r) => r.title === 'Guest Private Book') && !ownerFile.some((r) => r.title === 'Guest Private Book'));

// ── 6. the middleware session gate (source-level: protected prefixes) ──
const SRC = fs.readFileSync(new URL('../vite-server-store-plugin.js', import.meta.url), 'utf8');
check('25. gate protects store, routerheal, llama, and search-bridge',
  /PROTECTED_PREFIXES = \['\/api\/store\/', '\/api\/routerheal', '\/llama', '\/search-bridge'\]/.test(SRC));
check('26. session cookie is httpOnly', /HttpOnly/.test(SRC));
const APP = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
check('27. /login renders outside the auth gate', APP.includes("window.location.pathname === '/login'"));
const LDB = fs.readFileSync(new URL('../src/lib/localDB.js', import.meta.url), 'utf8');
check('28. store client redirects to /login on 401', LDB.includes("resp.status === 401") && LDB.includes("'/login'"));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(failures === 0 ? '\nACCEPTANCE: ALL CHECKS MATCHED' : `\nACCEPTANCE: ${failures} CHECK(S) DID NOT MATCH`);
process.exit(failures === 0 ? 0 : 1);
