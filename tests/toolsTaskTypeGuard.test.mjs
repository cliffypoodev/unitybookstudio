// tests/toolsTaskTypeGuard.test.mjs — Static guard for invokeLLMWithRetry task_type values
// Scans all source files to ensure every invokeLLMWithRetry call uses a valid task_type.
// This is a compile-time guard — no runtime needed.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

/* ═══════════════════════════════════════════════════════════════════════════
 * CONFIGURATION
 * ═════════════════════════════════════════════════════════════════════════ */

const VALID_TASK_TYPES = new Set([
  'analytics',
  'critique',
  'foundation',
  'outline',
  'polish',
  'proofread',
  'prose',
  'publishing',
  'research',
  'transform',
]);

const SRC_DIR = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..', 'src');
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

/* ═══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ═════════════════════════════════════════════════════════════════════════ */

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results.push(...walk(full));
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * SCAN
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

console.log('\n=== TOOLS TASK_TYPE GUARD — STATIC ANALYSIS ===\n');

const files = walk(SRC_DIR);
console.log(`  Scanning ${files.length} source files...\n`);

// Pattern: task_type: 'something' or task_type: "something"
const TASK_TYPE_RE = /task_type:\s*['"]([^'"]+)['"]/g;
// Pattern for dynamic task_type (variable reference)
const DYNAMIC_RE = /task_type:\s*([a-zA-Z_$][a-zA-Z0-9_$.]*)/g;

let totalCallSites = 0;
const violations = [];
const dynamicSites = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const relPath = path.relative(SRC_DIR, file);

  // Skip files that don't use invokeLLMWithRetry
  if (!content.includes('invokeLLMWithRetry')) continue;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    // Check for static task_type values
    let match;
    TASK_TYPE_RE.lastIndex = 0;
    while ((match = TASK_TYPE_RE.exec(line)) !== null) {
      totalCallSites++;
      const taskType = match[1];

      if (!VALID_TASK_TYPES.has(taskType)) {
        violations.push({
          file: relPath,
          line: lineIdx + 1,
          taskType,
          lineText: line.trim(),
        });
      }
    }

    // Check for dynamic task_type references (potential issues)
    if (line.includes('task_type:') && !TASK_TYPE_RE.test(line)) {
      DYNAMIC_RE.lastIndex = 0;
      const dynMatch = DYNAMIC_RE.exec(line);
      if (dynMatch) {
        const ref = dynMatch[1];
        // Skip string literals (already handled above)
        if (!ref.startsWith("'") && !ref.startsWith('"')) {
          dynamicSites.push({
            file: relPath,
            line: lineIdx + 1,
            ref,
            lineText: line.trim(),
          });
        }
      }
    }
  }
}

// Test: No invalid task_type values
if (violations.length === 0) {
  passed++;
  console.log(`  ✅ All ${totalCallSites} task_type values are valid`);
} else {
  failed++;
  failures.push('Invalid task_type values found');
  console.error(`  ❌ ${violations.length} invalid task_type value(s):`);
  for (const v of violations) {
    console.error(`     ${v.file}:${v.line} — task_type: '${v.taskType}'`);
    console.error(`       ${v.lineText}`);
  }
}

// Test: At least some call sites were found (sanity check)
if (totalCallSites > 0) {
  passed++;
  console.log(`  ✅ Found ${totalCallSites} static task_type call sites`);
} else {
  failed++;
  failures.push('No task_type call sites found');
  console.error('  ❌ No task_type call sites found — is the scan pattern correct?');
}

// Info: Dynamic sites (not an error, just a warning)
if (dynamicSites.length > 0) {
  console.log(`  ⚠️  ${dynamicSites.length} dynamic task_type reference(s) (review manually):`);
  for (const d of dynamicSites) {
    console.log(`     ${d.file}:${d.line} — task_type: ${d.ref}`);
  }
}

// Test: Verify the valid set hasn't been corrupted
{
  const expectedMinimum = 8;
  assert.ok(VALID_TASK_TYPES.size >= expectedMinimum,
    `VALID_TASK_TYPES should have at least ${expectedMinimum} entries, got ${VALID_TASK_TYPES.size}`);
  passed++;
  console.log(`  ✅ VALID_TASK_TYPES has ${VALID_TASK_TYPES.size} entries`);
}

// Test: Key task types exist
for (const required of ['prose', 'critique', 'outline', 'transform', 'publishing']) {
  assert.ok(VALID_TASK_TYPES.has(required), `Missing required task_type: ${required}`);
}
passed++;
console.log('  ✅ All required core task_types present');

/* ═══════════════════════════════════════════════════════════════════════════
 * ENTITY REGISTRATION GUARD — PublishingAsset must exist in both stores
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n--- Entity Registration Guard ---\n');

const localDBPath = path.join(SRC_DIR, 'lib', 'localDB.js');
const pluginPath = path.resolve(SRC_DIR, '..', 'vite-server-store-plugin.js');

if (fs.existsSync(localDBPath)) {
  const localDB = fs.readFileSync(localDBPath, 'utf8');
  if (localDB.includes('PublishingAsset')) {
    passed++;
    console.log('  ✅ PublishingAsset registered in localDB.js');
  } else {
    failed++;
    failures.push('PublishingAsset not in localDB.js');
    console.error('  ❌ PublishingAsset not found in localDB.js');
  }
} else {
  failed++;
  failures.push('localDB.js not found');
  console.error('  ❌ localDB.js not found');
}

if (fs.existsSync(pluginPath)) {
  const plugin = fs.readFileSync(pluginPath, 'utf8');
  if (plugin.includes('PublishingAsset')) {
    passed++;
    console.log('  ✅ PublishingAsset registered in vite-server-store-plugin.js');
  } else {
    failed++;
    failures.push('PublishingAsset not in vite-server-store-plugin.js');
    console.error('  ❌ PublishingAsset not found in vite-server-store-plugin.js');
  }
} else {
  failed++;
  failures.push('vite-server-store-plugin.js not found');
  console.error('  ❌ vite-server-store-plugin.js not found');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * DELETED ORPHAN GUARD — verify removed files stay removed
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n--- Deleted Orphan Guard ---\n');

const mustNotExist = [
  'components/tools/PolishSubPage.jsx',
  'components/tools/QuerySubPage.jsx',
  'components/tools/UploadSubPage.jsx',
];

for (const rel of mustNotExist) {
  const full = path.join(SRC_DIR, rel);
  if (fs.existsSync(full)) {
    failed++;
    failures.push(`Orphan ${rel} still exists`);
    console.error(`  ❌ Orphan file still exists: ${rel}`);
  } else {
    passed++;
    console.log(`  ✅ Orphan confirmed deleted: ${rel}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RESULTS
 * ═════════════════════════════════════════════════════════════════════════ */

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.log('Failures:', failures.join(', '));
}
process.exit(failed > 0 ? 1 : 0);
