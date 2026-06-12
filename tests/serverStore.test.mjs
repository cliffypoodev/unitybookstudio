// tests/serverStore.test.mjs — Behavioral test for server store endpoints
// Tests CRUD round-trip against the Vite server-store middleware directly.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ═══════════════════════════════════════════════════════════════════════════
 * Load the plugin middleware directly — no Vite needed
 * ═════════════════════════════════════════════════════════════════════════ */

const pluginPath = path.resolve(__dirname, '..', 'vite-server-store-plugin.js');
const { handleRequest, ENTITY_STORES, DATA_DIR, cache } = await import(pluginPath);

// Use a test-specific data directory to avoid touching real data
const TEST_DATA_DIR = path.resolve(__dirname, '..', 'data-test');

// Override DATA_DIR by manipulating the module's internals
// Actually, the module uses a constant — we need to clean up after ourselves
// We'll test against the actual data dir but clean up test data

/* ═══════════════════════════════════════════════════════════════════════════
 * Test HTTP server wrapping handleRequest
 * ═════════════════════════════════════════════════════════════════════════ */

let server;
let baseUrl;

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      handleRequest(req, res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });
}

async function api(method, path, body) {
  const url = `${baseUrl}${path}`;
  const options = { method };
  if (body) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }
  const resp = await fetch(url, options);
  const data = await resp.json();
  return { status: resp.status, data };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Test harness
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error('  ❌ ' + name + ': ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Clean up test entity data before and after
 * ═════════════════════════════════════════════════════════════════════════ */

const TEST_ENTITY = 'BookProject'; // Use a real entity that's unlikely to have user data
const TEST_FILESTORE = '_FileStore';

function cleanTestRecords() {
  // Clear in-memory cache for test entities
  if (cache[TEST_ENTITY]) {
    cache[TEST_ENTITY] = cache[TEST_ENTITY].filter(r => !r.id?.startsWith('test-'));
  }
  if (cache[TEST_FILESTORE]) {
    cache[TEST_FILESTORE] = cache[TEST_FILESTORE].filter(r => !r.id?.startsWith('test-'));
  }
  // Don't flush — we don't want to write test data to disk
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TESTS
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n=== SERVER STORE ENDPOINT TESTS ===\n');

await startServer();

try {
  // ── CRUD round-trip ──

  let createdId;

  await test('1. Create record', async () => {
    const { status, data } = await api('POST', `/api/store/${TEST_ENTITY}/create`, {
      id: 'test-crud-1',
      title: 'Test Project',
      genre: 'fantasy',
    });
    assert.strictEqual(status, 201, `Expected 201, got ${status}`);
    assert.strictEqual(data.id, 'test-crud-1');
    assert.strictEqual(data.title, 'Test Project');
    assert(data.created_date, 'Should have created_date');
    assert(data.updated_date, 'Should have updated_date');
    createdId = data.id;
  });

  await test('2. Get record by id', async () => {
    const { status, data } = await api('GET', `/api/store/${TEST_ENTITY}/get/${createdId}`);
    assert.strictEqual(status, 200);
    assert.strictEqual(data.id, createdId);
    assert.strictEqual(data.title, 'Test Project');
  });

  await test('3. List records includes created record', async () => {
    const { status, data } = await api('GET', `/api/store/${TEST_ENTITY}/list`);
    assert.strictEqual(status, 200);
    assert(Array.isArray(data), 'Should return array');
    const found = data.find(r => r.id === createdId);
    assert(found, 'Should find the created record');
  });

  await test('4. Update record', async () => {
    const { status, data } = await api('POST', `/api/store/${TEST_ENTITY}/update/${createdId}`, {
      title: 'Updated Project',
      word_count: 50000,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.title, 'Updated Project');
    assert.strictEqual(data.word_count, 50000);
    assert.strictEqual(data.genre, 'fantasy', 'Should preserve unmodified fields');
  });

  await test('5. Filter records', async () => {
    const { status, data } = await api('POST', `/api/store/${TEST_ENTITY}/filter`, {
      query: { genre: 'fantasy' },
    });
    assert.strictEqual(status, 200);
    assert(data.length >= 1, 'Should find at least 1 record');
    assert(data.every(r => r.genre === 'fantasy'), 'All should match filter');
  });

  await test('6. Filter with sort and limit', async () => {
    // Create a second record
    await api('POST', `/api/store/${TEST_ENTITY}/create`, {
      id: 'test-crud-2', title: 'Second Project', genre: 'fantasy',
    });
    const { data } = await api('POST', `/api/store/${TEST_ENTITY}/filter`, {
      query: { genre: 'fantasy' },
      sort: '-title',
      limit: 1,
    });
    assert.strictEqual(data.length, 1, 'Limit should restrict to 1');
  });

  await test('7. Delete record', async () => {
    const { status } = await api('DELETE', `/api/store/${TEST_ENTITY}/delete/${createdId}`);
    assert.strictEqual(status, 200);

    // Verify it's gone
    const { status: getStatus } = await api('GET', `/api/store/${TEST_ENTITY}/get/${createdId}`);
    assert.strictEqual(getStatus, 404, 'Should be 404 after delete');
  });

  // Clean up second record
  await api('DELETE', `/api/store/${TEST_ENTITY}/delete/test-crud-2`);

  // ── _FileStore blobs ──

  await test('8. _FileStore create stores content', async () => {
    const blob = 'This is chapter content with lots of text. '.repeat(100);
    const { status, data } = await api('POST', `/api/store/${TEST_FILESTORE}/create`, {
      id: 'test-file-1',
      content: blob,
      created_by: 'local',
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(data.id, 'test-file-1');
    assert.strictEqual(data.content.length, blob.length);
  });

  await test('9. _FileStore get retrieves content', async () => {
    const { status, data } = await api('GET', `/api/store/${TEST_FILESTORE}/get/test-file-1`);
    assert.strictEqual(status, 200);
    const expectedLen = 'This is chapter content with lots of text. '.length * 100;
    assert.strictEqual(data.content.length, expectedLen);
  });

  await test('10. _FileStore update replaces content', async () => {
    const newContent = 'Updated content blob';
    const { status, data } = await api('POST', `/api/store/${TEST_FILESTORE}/update/test-file-1`, {
      content: newContent,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(data.content, newContent);
  });

  await test('11. _FileStore delete removes record', async () => {
    const { status } = await api('DELETE', `/api/store/${TEST_FILESTORE}/delete/test-file-1`);
    assert.strictEqual(status, 200);
    const { status: getStatus } = await api('GET', `/api/store/${TEST_FILESTORE}/get/test-file-1`);
    assert.strictEqual(getStatus, 404);
  });

  // ── Error cases ──

  await test('12. Get non-existent record returns 404', async () => {
    const { status } = await api('GET', `/api/store/${TEST_ENTITY}/get/does-not-exist`);
    assert.strictEqual(status, 404);
  });

  await test('13. Unknown entity returns 404', async () => {
    const { status } = await api('GET', '/api/store/FakeEntity/list');
    assert.strictEqual(status, 404);
  });

  await test('14. Update non-existent record returns 404', async () => {
    const { status } = await api('POST', `/api/store/${TEST_ENTITY}/update/does-not-exist`, {
      title: 'nope',
    });
    assert.strictEqual(status, 404);
  });

  await test('15. Delete non-existent record returns 404', async () => {
    const { status } = await api('DELETE', `/api/store/${TEST_ENTITY}/delete/does-not-exist`);
    assert.strictEqual(status, 404);
  });

  // ── ID preservation ──

  await test('16. Create with explicit id preserves it', async () => {
    const { data } = await api('POST', `/api/store/${TEST_ENTITY}/create`, {
      id: 'test-explicit-id',
      title: 'Explicit ID',
    });
    assert.strictEqual(data.id, 'test-explicit-id');
    // Clean up
    await api('DELETE', `/api/store/${TEST_ENTITY}/delete/test-explicit-id`);
  });

  await test('17. Create without id auto-generates one', async () => {
    const { data } = await api('POST', `/api/store/${TEST_ENTITY}/create`, {
      title: 'Auto ID',
    });
    assert(data.id, 'Should have auto-generated id');
    assert(data.id.length > 5, 'ID should be non-trivial');
    // Clean up
    await api('DELETE', `/api/store/${TEST_ENTITY}/delete/${data.id}`);
  });

} finally {
  cleanTestRecords();
  await stopServer();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * STATIC GUARDS
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n--- Static Guards ---\n');

await test('18. localDB.js export list unchanged vs main', async () => {
  const { execSync } = await import('node:child_process');
  const cwd = path.resolve(__dirname, '..');

  // Get export lines from main
  let mainExports;
  try {
    mainExports = execSync('git show main:src/lib/localDB.js', { cwd, encoding: 'utf8' })
      .split('\n')
      .filter(l => /^export /.test(l))
      .map(l => l.trim())
      .sort();
  } catch {
    // If main branch doesn't exist locally, skip
    console.log('    (skipped — main branch not available locally)');
    return;
  }

  const currentSrc = fs.readFileSync(path.resolve(cwd, 'src/lib/localDB.js'), 'utf8');
  const currentExports = currentSrc
    .split('\n')
    .filter(l => /^export /.test(l))
    .map(l => l.trim())
    .sort();

  // Every export from main must still be present
  for (const exp of mainExports) {
    assert(currentExports.some(c => c.startsWith(exp.slice(0, 30))),
      `Missing export from main: ${exp.slice(0, 60)}`);
  }
});

await test('19. base44Client.js is byte-identical to main', async () => {
  const { execSync } = await import('node:child_process');
  const cwd = path.resolve(__dirname, '..');

  let mainHash, currentHash;
  try {
    mainHash = execSync('git show main:src/api/base44Client.js | md5', { cwd, encoding: 'utf8' }).trim();
    currentHash = execSync('md5 < src/api/base44Client.js', { cwd, encoding: 'utf8' }).trim();
  } catch {
    console.log('    (skipped — md5 or main branch not available)');
    return;
  }

  assert.strictEqual(currentHash, mainHash,
    'base44Client.js has been modified — it must remain untouched');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * SUMMARY
 * ═════════════════════════════════════════════════════════════════════════ */

console.log(`\n${'═'.repeat(60)}`);
console.log(`SERVER STORE: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All server store tests passed! ✅');
}
