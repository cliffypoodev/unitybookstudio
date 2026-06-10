/**
 * Import UBS Full Export JSON into local IndexedDB.
 *
 * This reads the UBS-FullExport JSON (which contains projects, chapters,
 * coverArt, seriesBibles, folders, and prompts with all original metadata)
 * and inserts every record into the matching IndexedDB object store.
 *
 * All original IDs and relationships (project_id, folder_id, etc.) are preserved.
 *
 * Usage — open browser console at http://localhost:5180 and run:
 *
 *   await import('/src/tools/importFullExport.js')
 *
 * A file picker opens. Select UBS-FullExport-2026-05-31.json.
 */

const DB_NAME = 'UnityBookStudio';
const DB_VERSION = 1;

const ENTITY_STORES = [
  'NovelProject', 'Chapter', 'SeriesBible', 'AuthorStyle',
  'CoverArtGallery', 'PromptCatalog', 'ProjectFolder',
  'BookProject', '_FileStore',
];

/** Map JSON export keys → IndexedDB store names */
const KEY_TO_STORE = {
  projects:     'NovelProject',
  chapters:     'Chapter',
  coverArt:     'CoverArtGallery',
  authorStyles: 'AuthorStyle',
  seriesBibles: 'SeriesBible',
  folders:      'ProjectFolder',
  prompts:      'PromptCatalog',
};

function openDB() {
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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function putRecord(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function countStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function importFullExport(file) {
  console.log(`[IMPORT] Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);

  const text = await file.text();
  const data = JSON.parse(text);

  console.log(`[IMPORT] Export version: ${data.version || 'unknown'}`);
  console.log(`[IMPORT] Exported at: ${data.exported_at || 'unknown'}`);
  console.log(`[IMPORT] Counts:`, data.counts || {});

  const db = await openDB();

  // Show current DB state before import
  console.log(`[IMPORT] --- Current DB state (before import) ---`);
  for (const storeName of ENTITY_STORES) {
    try {
      const count = await countStore(db, storeName);
      console.log(`[IMPORT]   ${storeName}: ${count} records`);
    } catch { /* store might not exist */ }
  }

  const results = {};

  for (const [jsonKey, storeName] of Object.entries(KEY_TO_STORE)) {
    const records = data[jsonKey];
    if (!records || !Array.isArray(records) || records.length === 0) {
      console.log(`[IMPORT] ${jsonKey} → ${storeName}: 0 records (skipped)`);
      results[jsonKey] = { total: 0, imported: 0, errors: 0 };
      continue;
    }

    console.log(`[IMPORT] ${jsonKey} → ${storeName}: importing ${records.length} records...`);
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i++) {
      try {
        const record = { ...records[i] };

        // Ensure the record has an id (required by IndexedDB keyPath)
        if (!record.id) {
          record.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        }

        // Remap created_by to the local user
        if (record.created_by) {
          record.original_created_by = record.created_by;
          record.created_by = 'local@unitybookstudio.app';
        }

        await putRecord(db, storeName, record);
        imported++;

        // Progress logging every 100 records
        if ((i + 1) % 100 === 0 || i === records.length - 1) {
          console.log(`[IMPORT]   ${storeName}: ${i + 1}/${records.length} ...`);
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.warn(`[IMPORT]   Error on ${storeName} record ${i}:`, err.message);
        }
      }
    }

    results[jsonKey] = { total: records.length, imported, errors };
    console.log(`[IMPORT]   ${storeName}: ✅ ${imported} imported, ❌ ${errors} errors`);
  }

  // Show final DB state
  console.log(`[IMPORT] --- Final DB state (after import) ---`);
  for (const storeName of ENTITY_STORES) {
    try {
      const count = await countStore(db, storeName);
      console.log(`[IMPORT]   ${storeName}: ${count} records`);
    } catch { /* store might not exist */ }
  }

  console.log(`[IMPORT] ====================================`);
  console.log(`[IMPORT] IMPORT COMPLETE`);
  for (const [key, r] of Object.entries(results)) {
    if (r.total > 0) {
      console.log(`[IMPORT]   ${key}: ${r.imported}/${r.total} imported${r.errors > 0 ? ` (${r.errors} errors)` : ''}`);
    }
  }
  console.log(`[IMPORT] ====================================`);
  console.log(`[IMPORT] 👉 Refresh the page to see your projects!`);

  return results;
}

// Auto-run: open file picker
const input = document.createElement('input');
input.type = 'file';
input.accept = '.json';

input.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const results = await importFullExport(file);
    const totalImported = Object.values(results).reduce((sum, r) => sum + r.imported, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors, 0);
    alert(`Import complete!\n\n✅ ${totalImported} total records imported\n   ${results.projects?.imported || 0} projects\n   ${results.chapters?.imported || 0} chapters\n   ${results.coverArt?.imported || 0} cover art\n   ${results.seriesBibles?.imported || 0} series bibles\n   ${results.folders?.imported || 0} folders\n   ${results.prompts?.imported || 0} prompts\n${totalErrors > 0 ? `\n❌ ${totalErrors} errors (check console)` : ''}\n\nRefresh the page to see your library!`);
  } catch (err) {
    console.error('[IMPORT] Fatal error:', err);
    alert('Import failed: ' + err.message);
  }
};

input.click();
