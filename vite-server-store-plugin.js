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
        if (req.url && req.url.startsWith('/api/store/')) {
          handleRequest(req, res);
        } else {
          next();
        }
      });
      console.log('[SERVER-STORE] Middleware active — data dir:', DATA_DIR);
    },
  };
}

// Export for test harness
export { handleRequest, ENTITY_STORES, DATA_DIR, loadStore, flushStore, cache };
