// src/lib/localDB.js
// Server-backed entity store for Unity Book Studio.
// Replaces IndexedDB with fetch() to the Vite server-store plugin
// so all devices share the same data.
//
// The old IndexedDB code is preserved in the `idb` namespace
// for one-time migration (Step 3).

const DB_NAME = 'UnityBookStudio';
const DB_VERSION = 1;

const ENTITY_STORES = [
  'NovelProject', 'Chapter', 'SeriesBible', 'AuthorStyle',
  'CoverArtGallery', 'PromptCatalog', 'ProjectFolder',
  'BookProject', // legacy alias
  '_FileStore',  // local file storage (replaces GitHub)
  'PublishingAsset', // saved tool outputs (blurbs, titles, transforms, etc.)
];

// ══════════════════════════════════════════════════════════════════════════
// LEGACY IndexedDB CODE — kept for migration reads only. NOT used at runtime.
// ══════════════════════════════════════════════════════════════════════════

let _db = null;

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('No IndexedDB'));
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const name of ENTITY_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' });
          store.createIndex('created_by', 'created_by', { unique: false });
          store.createIndex('project_id', 'project_id', { unique: false });
          store.createIndex('created_date', 'created_date', { unique: false });
          store.createIndex('updated_date', 'updated_date', { unique: false });
        }
      }
    };

    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function idbTxStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

async function idbGetAllFromStore(storeName) {
  const store = await idbTxStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Read all data from IndexedDB — used for migration ONLY */
export async function idbExportAllData() {
  const dump = {};
  for (const name of ENTITY_STORES) {
    try {
      dump[name] = await idbGetAllFromStore(name);
    } catch {
      dump[name] = [];
    }
  }
  return dump;
}

// ══════════════════════════════════════════════════════════════════════════
// SERVER ADAPTER — all runtime operations go through fetch()
// ══════════════════════════════════════════════════════════════════════════

const API_BASE = '/api/store';

async function serverFetch(entityName, action, options = {}) {
  const { id, body, method } = options;
  const idSuffix = id ? `/${encodeURIComponent(id)}` : '';
  const url = `${API_BASE}/${entityName}/${action}${idSuffix}`;

  const fetchOptions = { method: method || (body ? 'POST' : 'GET') };
  if (body) {
    fetchOptions.headers = { 'Content-Type': 'application/json' };
    fetchOptions.body = JSON.stringify(body);
  }

  const resp = await fetch(url, fetchOptions);
  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(errBody.error || `Server store error: ${resp.status}`);
  }
  return resp.json();
}

// ── Helpers (still used by some callers) ────────────────────────────────

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

// ── Entity API (mirrors Base44 SDK) — now via server ────────────────────

function createEntityProxy(entityName) {
  return {
    async create(data) {
      const record = await serverFetch(entityName, 'create', { body: data });
      console.log(`[LOCAL-DB] ${entityName}.create → id:${record.id}`);
      return record;
    },

    async bulkCreate(items) {
      const results = [];
      for (const item of items) {
        const record = await this.create(item);
        results.push(record);
      }
      console.log(`[LOCAL-DB] ${entityName}.bulkCreate → ${results.length} records`);
      return results;
    },

    async get(id) {
      return serverFetch(entityName, 'get', { id });
    },

    async filter(query, sortField, limit) {
      return serverFetch(entityName, 'filter', {
        body: { query, sort: sortField, limit },
      });
    },

    async list() {
      return serverFetch(entityName, 'list');
    },

    async update(id, fields) {
      return serverFetch(entityName, 'update', { id, body: fields });
    },

    async delete(id) {
      await serverFetch(entityName, 'delete', { id, method: 'DELETE' });
      console.log(`[LOCAL-DB] ${entityName}.delete → id:${id}`);
    },
  };
}

// ── File Storage (replaces GitHub) ──

export async function storeFile(key, content) {
  await serverFetch('_FileStore', 'create', {
    body: {
      id: key,
      content,
      created_by: 'local',
    },
  });
  return `local://${key}`;
}

export async function retrieveFile(key) {
  // Handle local:// URLs
  const cleanKey = key.replace(/^local:\/\//, '');
  try {
    const record = await serverFetch('_FileStore', 'get', { id: cleanKey });
    return record?.content || null;
  } catch {
    return null;
  }
}

export async function isLocalFileUrl(url) {
  return url && typeof url === 'string' && url.startsWith('local://');
}

// ── Export entity proxies ──

export const entities = {
  NovelProject: createEntityProxy('NovelProject'),
  Chapter: createEntityProxy('Chapter'),
  SeriesBible: createEntityProxy('SeriesBible'),
  AuthorStyle: createEntityProxy('AuthorStyle'),
  CoverArtGallery: createEntityProxy('CoverArtGallery'),
  PromptCatalog: createEntityProxy('PromptCatalog'),
  ProjectFolder: createEntityProxy('ProjectFolder'),
  BookProject: createEntityProxy('BookProject'),
  PublishingAsset: createEntityProxy('PublishingAsset'),
};

// ── Database Utilities ──

export async function exportAllData() {
  const dump = {};
  for (const name of ENTITY_STORES) {
    dump[name] = await serverFetch(name, 'list');
  }
  return dump;
}

export async function importAllData(dump) {
  for (const [name, records] of Object.entries(dump)) {
    if (!ENTITY_STORES.includes(name)) continue;
    for (const record of records) {
      // Use create with the record's existing id/dates to preserve them
      await serverFetch(name, 'create', { body: record });
    }
  }
}

export async function clearAllData() {
  for (const name of ENTITY_STORES) {
    const all = await serverFetch(name, 'list');
    for (const record of all) {
      await serverFetch(name, 'delete', { id: record.id, method: 'DELETE' });
    }
  }
}

export { openDB };
