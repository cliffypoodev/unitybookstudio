/**
 * vite-server-store-plugin.js
 *
 * Vite configureServer middleware that provides JSON REST endpoints
 * mirroring localDB's entity API. Data is stored as flat JSON files
 * in the data/ directory (git-ignored).
 *
 * Endpoints (all under /api/store):
 *   GET    /:entity/list          → all records
 *   POST   /:entity/filter        → filtered records (body: { query, sort, limit })
 *   GET    /:entity/get/:id       → single record by id
 *   POST   /:entity/create        → create record (body: record data)
 *   POST   /:entity/update/:id    → update record (body: fields to merge)
 *   DELETE /:entity/delete/:id    → delete record
 *
 * Mutations are serialized per-entity via an async mutex queue so that
 * concurrent read-modify-write cycles never interleave. Writes are
 * atomic: data is flushed to a .tmp file then renamed over the target.
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec as cpExec, spawn as cpSpawn } from 'node:child_process';
import { get as httpGet } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  SESSION_COOKIE, usersExist, createUser, authenticate, getUserById,
  getSecret, createSessionToken, verifySessionToken, parseCookies,
  userDataDir, migrateLegacyData,
  ensureRunnerToken, verifyRunnerToken,
} from './server/authCore.js'; // AUTH-1 / RUNNER-1

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// AUTH-1: env-overridable so batteries can run against a temp directory
// without ever touching the live data dir. Default is unchanged.
const DATA_DIR = process.env.UBS_DATA_DIR || path.join(__dirname, 'data');

const ENTITY_STORES = [
  'NovelProject', 'Chapter', 'SeriesBible', 'AuthorStyle',
  'CoverArtGallery', 'PromptCatalog', 'ProjectFolder',
  'BookProject', '_FileStore', '_MigrationMeta',
  'PublishingAsset',
];

// ── Per-entity async mutex ──────────────────────────────────────────────
// Each entity gets its own queue so mutations to different entities can
// still run concurrently (e.g. Chapter and _FileStore in parallel), but
// mutations to the SAME entity file are strictly serialized.

const entityLocks = {};

/**
 * Acquire a per-entity mutex. Returns a release function.
 * While the lock is held, all other callers for the same entity wait
 * in FIFO order.
 */
function acquireEntityLock(entityName) {
  if (!entityLocks[entityName]) {
    entityLocks[entityName] = { queue: [], locked: false };
  }
  const lock = entityLocks[entityName];

  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (!lock.locked) {
        lock.locked = true;
        resolve(() => {
          lock.locked = false;
          if (lock.queue.length > 0) {
            const next = lock.queue.shift();
            next();
          }
        });
      } else {
        lock.queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

// ── In-memory cache + disk I/O ──────────────────────────────────────────

// AUTH-1: stores are per-user. Every cache key and file path is scoped by
// the session user's id — data/users/<uid>/<Entity>.json — so a filtering
// bug can never leak another user's records: the other user's file is simply
// never opened. Entity locks are scoped the same way.
const cache = {};

function storeKey(uid, entityName) {
  return `${uid}/${entityName}`;
}

function userStoreDir(uid) {
  return userDataDir(DATA_DIR, uid);
}

function ensureDataDir(uid) {
  const dir = userStoreDir(uid);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function entityFilePath(uid, entityName) {
  return path.join(userStoreDir(uid), `${entityName}.json`);
}

function loadStore(uid, entityName) {
  const key = storeKey(uid, entityName);
  if (cache[key]) return cache[key];

  ensureDataDir(uid);
  const filePath = entityFilePath(uid, entityName);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      cache[key] = JSON.parse(raw);
      if (entityName === '_FileStore') dedupeFileStoreOnLoad(uid, entityName);
    } catch {
      cache[key] = [];
    }
  } else {
    cache[key] = [];
  }
  return cache[key];
}

// ── STOREKEY-1: _FileStore load-time dedupe ─────────────────────────────
// _FileStore keys are content-addressed (same id == same logical blob).
// Before the create-time upsert below existed, a resave appended a
// duplicate id instead of replacing it, so a later `find`/`findIndex` could
// resolve to whichever duplicate came first — not necessarily the newest
// one. This runs once, the moment a _FileStore array is first read off disk
// into the cache (loadStore's cache-miss branch, above — the existing
// `if (cache[key]) return cache[key];` fast path guarantees it never runs
// twice for the same uid+entity in one process lifetime), collapses every
// duplicate id to its LAST occurrence, and flushes the cleaned array back
// to disk. No-op (no log, no rewrite) when the loaded array has no
// duplicate ids. Never runs for any other entity.
function dedupeFileStoreOnLoad(uid, entityName) {
  const key = storeKey(uid, entityName);
  const records = cache[key];
  if (!Array.isArray(records) || records.length === 0) return;

  const lastIndexById = new Map();
  const idCounts = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r && typeof r.id === 'string') {
      lastIndexById.set(r.id, i);
      idCounts.set(r.id, (idCounts.get(r.id) || 0) + 1);
    }
  }

  const duplicateKeyCount = [...idCounts.values()].filter((c) => c > 1).length;
  if (duplicateKeyCount === 0) return;

  const deduped = records.filter((r, i) => {
    if (!r || typeof r.id !== 'string') return true; // no id to key on — never drop it
    return lastIndexById.get(r.id) === i; // keep only the LAST occurrence of each id
  });
  const removedCount = records.length - deduped.length;

  cache[key] = deduped;
  console.log(`[STOREKEY-1] ${uid}: collapsed ${removedCount} duplicate _FileStore record(s) across ${duplicateKeyCount} key(s)`);
  flushStore(uid, entityName);
}

/**
 * Atomic flush: write to a .tmp sibling then rename over the target.
 * fs.renameSync is atomic on POSIX when src and dst are on the same
 * filesystem, so a crash mid-write leaves either the old file or the
 * new file — never a partial/corrupt file.
 */
function flushStore(uid, entityName) {
  ensureDataDir(uid);
  const filePath = entityFilePath(uid, entityName);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(cache[storeKey(uid, entityName)] || [], null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function nowISO() {
  return new Date().toISOString();
}

// ── Helper: parse JSON body from IncomingMessage ────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function sendError(res, message, status = 400) {
  sendJSON(res, { error: message }, status);
}

// ── Matching / sorting (mirrors localDB.js) ─────────────────────────────

function matchesFilter(record, query) {
  if (!query || typeof query !== 'object') return true;
  for (const [key, value] of Object.entries(query)) {
    if (record[key] !== value) return false;
  }
  return true;
}

function sortRecords(records, sortField) {
  if (!sortField) return records;
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  return [...records].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return desc ? bVal - aVal : aVal - bVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal));
    return desc ? -cmp : cmp;
  });
}

// ── Route handler ───────────────────────────────────────────────────────

async function handleRequest(req, res, uid) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace('/api/store/', '').split('/');
  const entity = parts[0];
  const action = parts[1];
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;

  if (!ENTITY_STORES.includes(entity)) {
    return sendError(res, `Unknown entity: ${entity}`, 404);
  }

  // Read-only actions — no lock needed, serve directly from cache
  if (action === 'list' || action === 'filter' || action === 'get' || action === 'versions') {
    const store = loadStore(uid, entity);
    try {
      switch (action) {
        case 'list': {
          sendJSON(res, store);
          break;
        }
        case 'filter': {
          const body = await readBody(req);
          let results = store.filter(r => matchesFilter(r, body.query));
          results = sortRecords(results, body.sort);
          if (body.limit && body.limit > 0) results = results.slice(0, body.limit);
          sendJSON(res, results);
          break;
        }
        case 'get': {
          if (!id) return sendError(res, 'Missing id');
          const record = store.find(r => r.id === id);
          if (!record) return sendError(res, `${entity} with id ${id} not found`, 404);
          sendJSON(res, record);
          break;
        }
        // VERSIONS-1B: version history by key prefix, metadata only. _FileStore
        // is ~110MB — `list` sends every record's full content over the wire,
        // which is exactly wrong for "does an older version of this one
        // chapter exist" and would balloon the response for no reason. This
        // filters server-side and never puts `content` in the response.
        case 'versions': {
          const body = await readBody(req);
          const prefix = String(body?.prefix || '');
          if (!prefix) return sendError(res, 'Missing prefix');
          const results = store
            .filter((r) => typeof r?.id === 'string' && r.id.startsWith(prefix))
            .map((r) => ({
              id: r.id,
              created_date: r.created_date || null,
              bytes: typeof r.content === 'string' ? Buffer.byteLength(r.content, 'utf8') : 0,
            }))
            .sort((a, b) => a.id.localeCompare(b.id));
          sendJSON(res, results);
          break;
        }
      }
    } catch (err) {
      console.error(`[SERVER-STORE] Error in ${entity}/${action}:`, err);
      sendError(res, err.message, 500);
    }
    return;
  }

  // Mutating actions — serialize through per-entity mutex (AUTH-1: per user+entity)
  const release = await acquireEntityLock(storeKey(uid, entity));
  try {
    // Re-read store under lock (cache is authoritative since all mutations
    // hold the lock, but loadStore is cheap — just returns cache ref)
    const store = loadStore(uid, entity);

    switch (action) {
      case 'create': {
        const data = await readBody(req);
        const now = nowISO();
        const id = data.id || generateId();

        // STOREKEY-1: _FileStore is content-addressed — a second create for
        // an id that already exists is a resave of the same blob, not a new
        // record. Replace it in place (same array index), keep the original
        // created_date, stamp updated_date, respond 200. Every other entity
        // keeps today's plain append (201, unconditional push) untouched.
        if (entity === '_FileStore') {
          const existingIdx = store.findIndex((r) => r.id === id);
          if (existingIdx >= 0) {
            const merged = {
              ...store[existingIdx],
              ...data,
              id,
              created_date: store[existingIdx].created_date,
              updated_date: now,
            };
            store[existingIdx] = merged;
            cache[storeKey(uid, entity)] = store;
            flushStore(uid, entity);
            sendJSON(res, merged, 200);
            break;
          }
        }

        const record = {
          ...data,
          id,
          created_date: data.created_date || now,
          updated_date: data.updated_date || now,
          created_by: data.created_by || 'local@unitybookstudio.app',
        };
        store.push(record);
        cache[storeKey(uid, entity)] = store;
        flushStore(uid, entity);
        sendJSON(res, record, 201);
        break;
      }

      case 'update': {
        if (!id) { release(); return sendError(res, 'Missing id'); }
        const idx = store.findIndex(r => r.id === id);
        if (idx < 0) { release(); return sendError(res, `${entity} with id ${id} not found`, 404); }
        const fields = await readBody(req);
        const updated = {
          ...store[idx],
          ...fields,
          id, // preserve original id
          updated_date: nowISO(),
        };
        store[idx] = updated;
        cache[storeKey(uid, entity)] = store;
        flushStore(uid, entity);
        sendJSON(res, updated);
        break;
      }

      case 'delete': {
        if (!id) { release(); return sendError(res, 'Missing id'); }
        const delIdx = store.findIndex(r => r.id === id);
        if (delIdx < 0) { release(); return sendError(res, `${entity} with id ${id} not found`, 404); }
        store.splice(delIdx, 1);
        cache[storeKey(uid, entity)] = store;
        flushStore(uid, entity);
        sendJSON(res, { ok: true });
        break;
      }

      default:
        sendError(res, `Unknown action: ${action}`, 404);
    }
  } catch (err) {
    console.error(`[SERVER-STORE] Error in ${entity}/${action}:`, err);
    sendError(res, err.message, 500);
  } finally {
    release();
  }
}

// ── AUTH-1: session + auth endpoints ────────────────────────────────────
//
// Session is a stateless HMAC token in an httpOnly cookie. Every protected
// route resolves the session user and scopes all data access to that user's
// directory. Registration: open ONLY while zero users exist (first-run
// setup); after that, new accounts can only be created by a logged-in user.
//
// PROTECTED: /api/store/*, /api/routerheal, /llama/*, /search-bridge/*
// (the model and bridge proxies are gated too, so a LAN stranger cannot use
// the GPU or the research bridge without an account).
// OPEN: /api/auth/*, static/module serving (curl checks on /src/* still work).

const AUTH_COOKIE_ATTRS = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000';

function getSessionUser(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const session = verifySessionToken(cookies[SESSION_COOKIE], getSecret(DATA_DIR));
  if (!session) return null;
  return getUserById(DATA_DIR, session.uid);
}

// RUNNER-1: a second, narrower credential for scripts/ubs-run.mjs (a Node
// CLI with no browser to hold a session cookie) — valid only from loopback,
// never accepted from any other address even with a correct token.
const RUNNER_TOKEN_HEADER = 'x-ubs-runner-token';

function getRunnerTokenUser(req) {
  const presented = req.headers && req.headers[RUNNER_TOKEN_HEADER];
  if (!presented) return null;
  const user = verifyRunnerToken(DATA_DIR, req.socket && req.socket.remoteAddress, presented);
  if (!user) {
    console.warn(`[RUNNER-1] Rejected runner token from ${req.socket && req.socket.remoteAddress}: invalid token or non-loopback address.`);
  }
  return user;
}

function setSessionCookie(res, uid) {
  const token = createSessionToken(uid, getSecret(DATA_DIR));
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${AUTH_COOKIE_ATTRS}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function handleAuth(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.pathname.replace('/api/auth/', '').split('/')[0];
  try {
    switch (action) {
      case 'status': {
        const user = getSessionUser(req);
        return sendJSON(res, { usersExist: usersExist(DATA_DIR), authenticated: !!user, user: user || null });
      }
      case 'me': {
        const user = getSessionUser(req);
        if (!user) return sendError(res, 'Not authenticated', 401);
        return sendJSON(res, user);
      }
      case 'setup': {
        if (req.method !== 'POST') return sendError(res, 'POST only', 405);
        if (usersExist(DATA_DIR)) return sendError(res, 'Setup already completed. Log in instead.', 403);
        const body = await readBody(req);
        const user = createUser(DATA_DIR, body);
        // First account inherits every legacy book: atomic renames, manifest-guarded.
        const migration = migrateLegacyData(DATA_DIR, user.id, ENTITY_STORES);
        console.log(`[AUTH-1] First account '${user.username}' created; migrated legacy stores: ${migration.migrated.join(', ') || 'none'}`);
        ensureRunnerToken(DATA_DIR); // RUNNER-1: bind runner.token.json to the first user immediately
        setSessionCookie(res, user.id);
        return sendJSON(res, { user, migrated: migration.migrated }, 201);
      }
      case 'login': {
        if (req.method !== 'POST') return sendError(res, 'POST only', 405);
        const body = await readBody(req);
        const user = authenticate(DATA_DIR, body.username, body.password);
        if (!user) return sendError(res, 'Invalid username or password.', 401);
        setSessionCookie(res, user.id);
        console.log(`[AUTH-1] Login: ${user.username}`);
        return sendJSON(res, user);
      }
      case 'logout': {
        if (req.method !== 'POST') return sendError(res, 'POST only', 405);
        clearSessionCookie(res);
        return sendJSON(res, { ok: true });
      }
      case 'transfer-project': {
        // TRANSFER-1: move ONE book — project record, its chapters, its publishing
        // assets, its cover art, and every _FileStore blob under "<projectId>/" —
        // from the SESSION user's store to another existing account. Copy-to-target
        // is flushed BEFORE remove-from-source, so a crash mid-transfer duplicates
        // (recoverable) rather than loses. Series membership and folders do not
        // transfer: folder_id is cleared (folders are per-user).
        if (req.method !== 'POST') return sendError(res, 'POST only', 405);
        const actor = getSessionUser(req);
        if (!actor) return sendError(res, 'Not authenticated', 401);
        const body = await readBody(req);
        const projectId = String(body.projectId || '').trim();
        const target = authenticateTargetUser(body.toUsername);
        if (!projectId) return sendError(res, 'Missing projectId');
        if (!target) return sendError(res, 'No such user.');
        if (target.id === actor.id) return sendError(res, 'That book is already in your library.');
        const result = await transferProject(actor.id, target.id, projectId);
        if (result.error) return sendError(res, result.error, result.status || 400);
        console.log(`[TRANSFER-1] '${projectId}' moved ${actor.username} -> ${target.username}: ` +
          `chapters=${result.chapters} assets=${result.assets} covers=${result.covers} blobs=${result.blobs}`);
        return sendJSON(res, result);
      }
      case 'create-user': {
        if (req.method !== 'POST') return sendError(res, 'POST only', 405);
        const actor = getSessionUser(req);
        if (!actor) return sendError(res, 'Not authenticated', 401);
        const body = await readBody(req);
        const user = createUser(DATA_DIR, body);
        console.log(`[AUTH-1] User '${user.username}' created by '${actor.username}'`);
        return sendJSON(res, { user }, 201);
      }
      default:
        return sendError(res, `Unknown auth action: ${action}`, 404);
    }
  } catch (err) {
    return sendError(res, err.message, 400);
  }
}

// ── TRANSFER-1 helpers ──────────────────────────────────────────────────

function authenticateTargetUser(username) {
  const uname = String(username || '').trim().toLowerCase();
  const users = loadUsersForTransfer();
  return users.find((u) => u.username === uname) || null;
}

function loadUsersForTransfer() {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, '_auth', 'users.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return []; }
}

/**
 * Move a project and every record it owns from one user's store to another's.
 * Locks are acquired for all affected user+entity stores in SORTED order so two
 * concurrent transfers can never deadlock. Target stores are flushed before the
 * source records are removed.
 */
async function transferProject(fromUid, toUid, projectId) {
  const entities = ['NovelProject', 'Chapter', 'PublishingAsset', 'CoverArtGallery', '_FileStore'];
  const lockKeys = entities.flatMap((e) => [storeKey(fromUid, e), storeKey(toUid, e)]).sort();
  const releases = [];
  for (const key of lockKeys) releases.push(await acquireEntityLock(key));
  try {
    const srcProjects = loadStore(fromUid, 'NovelProject');
    const projIdx = srcProjects.findIndex((r) => r.id === projectId);
    if (projIdx < 0) return { error: 'That book is not in your library.', status: 404 };

    const pick = {
      Chapter: (r) => r.project_id === projectId,
      PublishingAsset: (r) => r.project_id === projectId,
      CoverArtGallery: (r) => r.project_id === projectId,
      _FileStore: (r) => String(r.id || '').startsWith(projectId + '/'),
    };

    // 1. copy into the target stores and flush them first
    const moved = {};
    const project = { ...srcProjects[projIdx], folder_id: null };
    const tgtProjects = loadStore(toUid, 'NovelProject');
    tgtProjects.push(project);
    cache[storeKey(toUid, 'NovelProject')] = tgtProjects;
    flushStore(toUid, 'NovelProject');
    for (const entity of Object.keys(pick)) {
      const srcStore = loadStore(fromUid, entity);
      const records = srcStore.filter(pick[entity]);
      moved[entity] = records.length;
      if (records.length) {
        const tgtStore = loadStore(toUid, entity);
        tgtStore.push(...records);
        cache[storeKey(toUid, entity)] = tgtStore;
        flushStore(toUid, entity);
      }
    }

    // 2. only now remove from the source stores
    srcProjects.splice(projIdx, 1);
    cache[storeKey(fromUid, 'NovelProject')] = srcProjects;
    flushStore(fromUid, 'NovelProject');
    for (const entity of Object.keys(pick)) {
      if (!moved[entity]) continue;
      const srcStore = loadStore(fromUid, entity);
      const kept = srcStore.filter((r) => !pick[entity](r));
      cache[storeKey(fromUid, entity)] = kept;
      flushStore(fromUid, entity);
    }

    return { ok: true, projectId, title: project.title || '', chapters: moved.Chapter, assets: moved.PublishingAsset, covers: moved.CoverArtGallery, blobs: moved._FileStore };
  } finally {
    releases.reverse().forEach((release) => release());
  }
}

const PROTECTED_PREFIXES = ['/api/store/', '/api/routerheal', '/llama', '/search-bridge'];

// ── Vite Plugin ─────────────────────────────────────────────────────────

export default function serverStorePlugin() {
  return {
    name: 'server-store',
    configureServer(server) {
      ensureRunnerToken(DATA_DIR); // RUNNER-1: data/_auth/runner.token ready before the first request
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/auth/')) {
          handleAuth(req, res);
          return;
        }
        if (req.url && PROTECTED_PREFIXES.some((p) => req.url.startsWith(p))) {
          const user = getSessionUser(req) || getRunnerTokenUser(req);
          if (!user) {
            return sendError(res, 'Not authenticated', 401);
          }
          if (req.url.startsWith('/api/routerheal')) {
            // ROUTERHEAL-1: self-heal endpoint for the wedged llama router.
            handleRouterHeal(req, res);
          } else if (req.url.startsWith('/api/store/')) {
            handleRequest(req, res, user.id);
          } else {
            next(); // authenticated /llama and /search-bridge fall through to the proxy
          }
          return;
        }
        next();
      });
      console.log('[SERVER-STORE] Middleware active — data dir:', DATA_DIR, '| AUTH-1 session gate on');
    },
  };
}

// ── ROUTERHEAL-1 ────────────────────────────────────────────────────────
// The local llama router wedges intermittently (3× on 2026-08-02): a worker
// dies, the router keeps proxying to the dead port, and every completion
// returns 500 "Compute error" until a human kills and relaunches the router.
// The browser cannot restart a Mac process — but this dev-server middleware
// can. POST /api/routerheal runs the recorded recovery: kill the LISTEN
// process on the router port, kill leftover llama workers (NEVER anything
// named ollama or hermes), relaunch the recorded command, probe /v1/models.
// Rate-limited to one heal per 5 minutes so a misfiring client can never
// restart-loop the router. Launch line/port/log are env-overridable.
const ROUTERHEAL_PORT = Number(process.env.UBS_LLAMA_PORT || 8081); // ROUTERSPLIT-1: UBS-only router
const ROUTERHEAL_LAUNCH = process.env.UBS_LLAMA_LAUNCH ||
  '/Users/cliff/.local/bin/llama serve --models-dir /Users/cliff/llama-models --models-max 1 --models-autoload --host 127.0.0.1 --port 8081 --ctx-size 65536 --parallel 1 --cache-ram 0';
const ROUTERHEAL_LOG = process.env.UBS_LLAMA_LOG || '/tmp/llama-router.log';
const ROUTERHEAL_COOLDOWN_MS = 5 * 60 * 1000;
let routerHealLastRun = 0;

const routerHealExec = (cmd) => new Promise((resolve) => {
  cpExec(cmd, { timeout: 15000 }, (err, stdout) => resolve(String(stdout || '').trim()));
});
const routerHealSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── ROUTERHEAL-2 ────────────────────────────────────────────────────────
// Two failures observed on the live ch.3 run (2026-08-04), both from the
// router log and the app console:
//   1. RELAUNCH RACE. The heal killed the listener, slept a fixed 3s+1s, and
//      spawned. The new process died on startup with
//      "couldn't bind HTTP server socket, hostname: 127.0.0.1, port: 8080"
//      because the port had not been released yet. A fixed sleep cannot know
//      when the socket is free; polling can.
//   2. THE HEAL LIED, THEN THE COOLDOWN BLOCKED RECOVERY. `healed: true` was
//      returned unconditionally - it reported success whenever a PID existed,
//      even with modelsOk false - and the 5-minute cooldown then refused the
//      next heal ({"healed":false,"reason":"cooldown"}), so three retries hit
//      a dead router and the chapter lost its critique pass.
// These two failures are why recovery must poll the port until it is
// genuinely free before relaunching, poll /v1/models until the router
// actually serves (a 35B cold load takes far longer than the old 5s), retry
// the spawn once if the first never binds, report healed = modelsOk (never a
// bare PID), and let the cooldown be bypassed when the router is NOT serving
// - a cooldown exists to stop thrashing, not to prevent recovery from a dead
// router. ROUTERHEAL-3 (below) is what actually does this polling and
// retrying now, out of process in the detached shell script - not here.
const ROUTERHEAL_MIN_INTERVAL_MS = 45000;

// ROUTERHEAL-3 — the recovery runs OUT OF PROCESS.
//
// The in-process version died mid-request on 2026-08-04 and took the whole dev
// server with it: /api/routerheal returned ERR_EMPTY_RESPONSE, vite dropped, and
// a completed 3,594-word chapter had nowhere to save. A repair path must never
// be able to kill the thing it is repairing. The endpoint now fires a detached
// shell script and returns immediately; all waiting, killing, relaunching and
// polling happens in that child. The client already waits and retries.
//
// Root cause of the crashes themselves was separate and is fixed in the launch
// line above: the router ran with --models-max 2, so a 20GB and a 21GB model
// were resident at once and every swap tried to add a third. One model at a
// time is what the machine can actually hold.
const ROUTERHEAL_SCRIPT = process.env.UBS_HEAL_SCRIPT ||
  '/Users/cliff/Downloads/UBS/scripts/ubs-heal-router.sh';

function routerHealProbe() {
  return new Promise((resolve) => {
    try {
      const probe = httpGet({ host: '127.0.0.1', port: ROUTERHEAL_PORT, path: '/v1/models', timeout: 4000 }, (r) => {
        let body = '';
        r.on('data', (c) => { body += c; });
        r.on('end', () => resolve(r.statusCode === 200 && body.includes('"data"')));
      });
      probe.on('error', () => resolve(false));
      probe.on('timeout', () => { try { probe.destroy(); } catch { /* ignore */ } resolve(false); });
    } catch { resolve(false); }
  });
}

function spawnDetachedHeal() {
  const child = cpSpawn('/bin/bash', [ROUTERHEAL_SCRIPT], { detached: true, stdio: 'ignore' });
  child.unref();
  return child.pid || null;
}

async function handleRouterHeal(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }
  try {
    if (await routerHealProbe()) {
      res.end(JSON.stringify({ healed: false, reason: 'already-serving' }));
      return;
    }
    const now = Date.now();
    if (now - routerHealLastRun < ROUTERHEAL_MIN_INTERVAL_MS) {
      res.end(JSON.stringify({ healed: false, reason: 'cooldown' }));
      return;
    }
    routerHealLastRun = now;
    const pid = spawnDetachedHeal();
    console.warn(`[ROUTERHEAL-3] detached heal started (pid ${pid}) — see /tmp/ubs-heal.log`);
    res.end(JSON.stringify({ healed: false, started: true, healPid: pid }));
  } catch (healErr) {
    // Never let a repair path take down the server it runs inside.
    console.warn('[ROUTERHEAL-3] heal dispatch failed:', healErr?.message || healErr);
    try { res.end(JSON.stringify({ healed: false, reason: String(healErr?.message || healErr) })); } catch { /* ignore */ }
  }
}


// Export for test harness
export { handleRequest, handleAuth, getSessionUser, ENTITY_STORES, DATA_DIR, loadStore, flushStore, cache, handleRouterHeal, routerHealProbe, spawnDetachedHeal };
