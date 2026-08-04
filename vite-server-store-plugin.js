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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');

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

const cache = {};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function entityFilePath(entityName) {
  return path.join(DATA_DIR, `${entityName}.json`);
}

function loadStore(entityName) {
  if (cache[entityName]) return cache[entityName];

  ensureDataDir();
  const filePath = entityFilePath(entityName);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      cache[entityName] = JSON.parse(raw);
    } catch {
      cache[entityName] = [];
    }
  } else {
    cache[entityName] = [];
  }
  return cache[entityName];
}

/**
 * Atomic flush: write to a .tmp sibling then rename over the target.
 * fs.renameSync is atomic on POSIX when src and dst are on the same
 * filesystem, so a crash mid-write leaves either the old file or the
 * new file — never a partial/corrupt file.
 */
function flushStore(entityName) {
  ensureDataDir();
  const filePath = entityFilePath(entityName);
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(cache[entityName] || [], null, 2), 'utf8');
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

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.replace('/api/store/', '').split('/');
  const entity = parts[0];
  const action = parts[1];
  const id = parts[2] ? decodeURIComponent(parts[2]) : null;

  if (!ENTITY_STORES.includes(entity)) {
    return sendError(res, `Unknown entity: ${entity}`, 404);
  }

  // Read-only actions — no lock needed, serve directly from cache
  if (action === 'list' || action === 'filter' || action === 'get') {
    const store = loadStore(entity);
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
      }
    } catch (err) {
      console.error(`[SERVER-STORE] Error in ${entity}/${action}:`, err);
      sendError(res, err.message, 500);
    }
    return;
  }

  // Mutating actions — serialize through per-entity mutex
  const release = await acquireEntityLock(entity);
  try {
    // Re-read store under lock (cache is authoritative since all mutations
    // hold the lock, but loadStore is cheap — just returns cache ref)
    const store = loadStore(entity);

    switch (action) {
      case 'create': {
        const data = await readBody(req);
        const now = nowISO();
        const record = {
          ...data,
          id: data.id || generateId(),
          created_date: data.created_date || now,
          updated_date: data.updated_date || now,
          created_by: data.created_by || 'local@unitybookstudio.app',
        };
        store.push(record);
        cache[entity] = store;
        flushStore(entity);
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
        cache[entity] = store;
        flushStore(entity);
        sendJSON(res, updated);
        break;
      }

      case 'delete': {
        if (!id) { release(); return sendError(res, 'Missing id'); }
        const delIdx = store.findIndex(r => r.id === id);
        if (delIdx < 0) { release(); return sendError(res, `${entity} with id ${id} not found`, 404); }
        store.splice(delIdx, 1);
        cache[entity] = store;
        flushStore(entity);
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

// ── Vite Plugin ─────────────────────────────────────────────────────────

export default function serverStorePlugin() {
  return {
    name: 'server-store',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/routerheal')) {
          // ROUTERHEAL-1: self-heal endpoint for the wedged llama router.
          handleRouterHeal(req, res);
        } else if (req.url && req.url.startsWith('/api/store/')) {
          handleRequest(req, res);
        } else {
          next();
        }
      });
      console.log('[SERVER-STORE] Middleware active — data dir:', DATA_DIR);
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
const ROUTERHEAL_PORT = Number(process.env.UBS_LLAMA_PORT || 8080);
const ROUTERHEAL_LAUNCH = process.env.UBS_LLAMA_LAUNCH ||
  '/Users/cliff/.local/bin/llama serve --models-dir /Users/cliff/llama-models --models-max 2 --models-autoload --host 127.0.0.1 --port 8080 --ctx-size 32768 --parallel 1 --cache-ram 8192';
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
// Fixes: poll the port until it is genuinely free before relaunching; poll
// /v1/models until the router actually serves (a 35B cold load takes far
// longer than the old 5s); retry the spawn once if the first never binds;
// report healed = modelsOk, never a bare PID; and let the cooldown be bypassed
// when the router is NOT serving - a cooldown exists to stop thrashing, not to
// prevent recovery from a dead router.
const ROUTERHEAL_PORT_FREE_MS = 20000;
const ROUTERHEAL_SERVING_MS = 90000;
const ROUTERHEAL_MIN_INTERVAL_MS = 45000;

function routerHealProbe() {
  return new Promise((resolve) => {
    const probe = httpGet({ host: '127.0.0.1', port: ROUTERHEAL_PORT, path: '/v1/models', timeout: 8000 }, (r) => {
      let body = '';
      r.on('data', (c) => { body += c; });
      r.on('end', () => resolve(r.statusCode === 200 && body.includes('"data"')));
    });
    probe.on('error', () => resolve(false));
    probe.on('timeout', () => { probe.destroy(); resolve(false); });
  });
}

async function routerHealPortFree(maxMs = ROUTERHEAL_PORT_FREE_MS) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const pids = await routerHealExec(`lsof -t -nP -iTCP:${ROUTERHEAL_PORT} -sTCP:LISTEN`);
    if (!pids) return true;
    if (Date.now() >= deadline) return false;
    await routerHealSleep(1000);
  }
}

async function routerHealWaitServing(maxMs = ROUTERHEAL_SERVING_MS) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    if (await routerHealProbe()) return true;
    if (Date.now() >= deadline) return false;
    await routerHealSleep(2000);
  }
}

function routerHealSpawn() {
  const parts = ROUTERHEAL_LAUNCH.split(/\s+/).filter(Boolean);
  const logFd = fs.openSync(ROUTERHEAL_LOG, 'a');
  const child = cpSpawn(parts[0], parts.slice(1), { detached: true, stdio: ['ignore', logFd, logFd] });
  child.unref();
  fs.closeSync(logFd);
  return child.pid || null;
}

async function performRouterHeal() {
  const listenPid = await routerHealExec(`lsof -t -nP -iTCP:${ROUTERHEAL_PORT} -sTCP:LISTEN`);
  if (listenPid) {
    for (const pid of listenPid.split(/\s+/).filter(Boolean)) await routerHealExec(`kill ${pid}`);
  }
  // Leftover workers: llama processes that are not ollama, not hermes, and
  // not node/vite tooling. The router does NOT respawn a killed worker, so
  // orphans must go before relaunch.
  const psOut = await routerHealExec('ps ax -o pid=,command=');
  for (const line of psOut.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const pid = m[1];
    const command = m[2];
    if (!/llama/i.test(command)) continue;
    if (/ollama|hermes|node|vite|grep/i.test(command)) continue;
    await routerHealExec(`kill ${pid}`);
  }
  // Wait for the socket to be genuinely released before relaunching.
  const portFree = await routerHealPortFree();
  const relaunchPid = routerHealSpawn();
  let modelsOk = await routerHealWaitServing();
  let retriedSpawn = false;
  let relaunchPid2 = null;
  if (!modelsOk) {
    // The usual cause is the bind race losing to a socket still in teardown.
    // One retry, after the port is confirmed free.
    retriedSpawn = true;
    await routerHealPortFree();
    relaunchPid2 = routerHealSpawn();
    modelsOk = await routerHealWaitServing();
  }
  return {
    killedListenPid: listenPid || null,
    portFree,
    relaunchPid,
    retriedSpawn,
    relaunchPid2,
    modelsOk,
  };
}

async function handleRouterHeal(req, res) {
  res.setHeader('Content-Type', 'application/json');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'POST only' }));
    return;
  }
  const now = Date.now();
  const sinceLast = now - routerHealLastRun;
  if (sinceLast < ROUTERHEAL_COOLDOWN_MS) {
    // ROUTERHEAL-2: a cooldown must never strand a DEAD router. Refuse only
    // when the router is actually serving (nothing to heal), or when the last
    // attempt was seconds ago (a tight loop). Otherwise heal.
    if (await routerHealProbe()) {
      console.warn('[ROUTERHEAL-2] heal request refused: router is serving, nothing to heal');
      res.end(JSON.stringify({ healed: false, reason: 'already-serving' }));
      return;
    }
    if (sinceLast < ROUTERHEAL_MIN_INTERVAL_MS) {
      console.warn('[ROUTERHEAL-2] heal request refused: minimum interval not elapsed');
      res.end(JSON.stringify({ healed: false, reason: 'cooldown' }));
      return;
    }
    console.warn('[ROUTERHEAL-2] within cooldown but router is DOWN — healing anyway');
  }
  routerHealLastRun = now;
  console.warn(`[ROUTERHEAL-1] heal requested — restarting llama router on port ${ROUTERHEAL_PORT}`);
  try {
    const result = await performRouterHeal();
    console.warn('[ROUTERHEAL-2] result:', JSON.stringify(result));
    // healed reflects whether the router actually SERVES, not whether a PID exists.
    res.end(JSON.stringify({ healed: result.modelsOk === true, ...result }));
  } catch (healErr) {
    console.warn('[ROUTERHEAL-1] heal failed:', healErr?.message || healErr);
    res.end(JSON.stringify({ healed: false, reason: String(healErr?.message || healErr) }));
  }
}

// Export for test harness
export { handleRequest, ENTITY_STORES, DATA_DIR, loadStore, flushStore, cache, handleRouterHeal, performRouterHeal };
