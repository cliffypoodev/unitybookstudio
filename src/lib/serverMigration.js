// src/lib/serverMigration.js
// One-time auto-migration: IndexedDB → server store.
//
// Rules:
//   - Only runs if the server store is empty AND IndexedDB has data.
//   - Uses existing idbExportAllData (read from IndexedDB) and
//     importAllData (write through the new server adapter).
//   - Never deletes or modifies IndexedDB data — it stays as backup.
//   - Idempotent: writes a _MigrationMeta flag record; re-running
//     boot never duplicates.
//   - Logs per-store record counts.

import { idbExportAllData, importAllData } from '@/lib/localDB';

const MIGRATION_FLAG_ID = 'idb-to-server-v1';

/**
 * Check if migration has already completed (flag record in _MigrationMeta).
 */
async function hasMigrated() {
  try {
    const resp = await fetch(`/api/store/_MigrationMeta/get/${MIGRATION_FLAG_ID}`);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Check if the server store has any real data (any entity store non-empty).
 */
async function isServerEmpty() {
  const entityNames = [
    'NovelProject', 'Chapter', 'SeriesBible', 'AuthorStyle',
    'CoverArtGallery', 'PromptCatalog', 'ProjectFolder', 'BookProject',
  ];
  for (const name of entityNames) {
    try {
      const resp = await fetch(`/api/store/${name}/list`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.length > 0) return false;
      }
    } catch {
      // Server not available — can't migrate
      return false;
    }
  }
  return true;
}

/**
 * Check if IndexedDB has any data worth migrating.
 */
async function hasIdbData() {
  try {
    const dump = await idbExportAllData();
    const totalRecords = Object.values(dump).reduce((sum, arr) => sum + arr.length, 0);
    return { hasData: totalRecords > 0, dump, totalRecords };
  } catch {
    return { hasData: false, dump: {}, totalRecords: 0 };
  }
}

/**
 * Set the migration-complete flag in the server store.
 */
async function setMigrationFlag(counts) {
  await fetch('/api/store/_MigrationMeta/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: MIGRATION_FLAG_ID,
      completed_at: new Date().toISOString(),
      counts,
    }),
  });
}

/**
 * Run the migration. Returns { migrated, message, counts }.
 */
export async function runServerMigration() {
  // 1. Already migrated?
  if (await hasMigrated()) {
    console.log('[MIGRATION] Already migrated — skipping.');
    return { migrated: false, message: 'Already migrated', counts: {} };
  }

  // 2. Server already has data?
  if (!(await isServerEmpty())) {
    console.log('[MIGRATION] Server store already has data — skipping.');
    return { migrated: false, message: 'Server not empty', counts: {} };
  }

  // 3. Check IndexedDB
  const { hasData, dump, totalRecords } = await hasIdbData();
  if (!hasData) {
    console.log('[MIGRATION] IndexedDB is empty — nothing to migrate.');
    return { migrated: false, message: 'IndexedDB empty', counts: {} };
  }

  // 4. Migrate using existing importAllData (writes through server adapter)
  console.log(`[MIGRATION] Starting migration of ${totalRecords} records from IndexedDB…`);

  const counts = {};
  for (const [name, records] of Object.entries(dump)) {
    counts[name] = records.length;
    if (records.length > 0) {
      console.log(`[MIGRATION]   ${name}: ${records.length} records`);
    }
  }

  await importAllData(dump);

  // 5. Set completion flag
  await setMigrationFlag(counts);

  console.log(`[MIGRATION] ✅ Complete — ${totalRecords} records migrated.`);
  return { migrated: true, message: 'Migration complete', counts };
}
