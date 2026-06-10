// src/lib/localDB.js
// IndexedDB-backed entity store for Unity Book Studio
// Replaces Base44 cloud entities with local persistent storage.

const DB_NAME = 'UnityBookStudio';
const DB_VERSION = 1;

const ENTITY_STORES = [
  'NovelProject', 'Chapter', 'SeriesBible', 'AuthorStyle',
  'CoverArtGallery', 'PromptCatalog', 'ProjectFolder',
  'BookProject', // legacy alias
  '_FileStore',  // local file storage (replaces GitHub)
];

let _db = null;

function openDB() {
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

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function nowISO() {
  return new Date().toISOString();
}

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

async function txStore(storeName, mode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

async function getAllFromStore(storeName) {
  const store = await txStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getByKey(storeName, key) {
  const store = await txStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function putRecord(storeName, record) {
  const store = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = () => reject(req.error);
  });
}

async function deleteByKey(storeName, key) {
  const store = await txStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Entity API (mirrors Base44 SDK) ──

function createEntityProxy(entityName) {
  return {
    async create(data) {
      const now = nowISO();
      const record = {
        ...data,
        id: generateId(),
        created_date: now,
        updated_date: now,
        created_by: 'local@unitybookstudio.app',
      };
      await putRecord(entityName, record);
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
      const record = await getByKey(entityName, id);
      if (!record) throw new Error(`${entityName} with id ${id} not found`);
      return record;
    },

    async filter(query, sortField, limit) {
      const all = await getAllFromStore(entityName);
      let results = all.filter(r => matchesFilter(r, query));
      results = sortRecords(results, sortField);
      if (limit && limit > 0) results = results.slice(0, limit);
      return results;
    },

    async list() {
      return getAllFromStore(entityName);
    },

    async update(id, fields) {
      const existing = await getByKey(entityName, id);
      if (!existing) throw new Error(`${entityName} with id ${id} not found`);
      const updated = {
        ...existing,
        ...fields,
        id, // preserve original id
        updated_date: nowISO(),
      };
      await putRecord(entityName, updated);
      return updated;
    },

    async delete(id) {
      await deleteByKey(entityName, id);
      console.log(`[LOCAL-DB] ${entityName}.delete → id:${id}`);
    },
  };
}

// ── File Storage (replaces GitHub) ──

export async function storeFile(key, content) {
  const record = {
    id: key,
    content,
    created_date: nowISO(),
    updated_date: nowISO(),
    created_by: 'local',
  };
  await putRecord('_FileStore', record);
  return `local://${key}`;
}

export async function retrieveFile(key) {
  // Handle local:// URLs
  const cleanKey = key.replace(/^local:\/\//, '');
  const record = await getByKey('_FileStore', cleanKey);
  return record?.content || null;
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
};

// ── Database Utilities ──

export async function exportAllData() {
  const dump = {};
  for (const name of ENTITY_STORES) {
    dump[name] = await getAllFromStore(name);
  }
  return dump;
}

export async function importAllData(dump) {
  for (const [name, records] of Object.entries(dump)) {
    if (!ENTITY_STORES.includes(name)) continue;
    for (const record of records) {
      await putRecord(name, record);
    }
  }
}

export async function clearAllData() {
  for (const name of ENTITY_STORES) {
    const store = await txStore(name, 'readwrite');
    await new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export { openDB };
