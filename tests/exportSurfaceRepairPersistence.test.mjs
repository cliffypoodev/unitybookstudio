/**
 * exportSurfaceRepairPersistence.test.mjs — Verifies export surface repairs persist to DB.
 *
 * The ExportTab must:
 * 1. Import prepareChapterContent (the persistence function)
 * 2. Call it during export to save repaired content back to DB
 * 3. Import resolveChapterContent to read verified content
 * 4. The polish handler save loop must use prepareChapterContent
 * 5. The save loop must write word_count
 * 6. The save loop must clear stale content fields
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ FAIL: ${label}`); }
}

console.log('=== Export Surface Repair Persistence Tests ===\n');

// ── 1. ExportTab imports ──
console.log('1. ExportTab imports');
const exportTabPath = path.resolve(root, 'src/components/publishing/ExportTab.jsx');
const exportTabSource = readFileSync(exportTabPath, 'utf-8');
assert(exportTabSource.includes('prepareChapterContent'), 'ExportTab imports prepareChapterContent');
assert(exportTabSource.includes('resolveChapterContent'), 'ExportTab imports resolveChapterContent');

// ── 2. Polish handler save loop (fiction) ──
console.log('\n2. Fiction polish save loop');
const studioPath = path.resolve(root, 'src/pages/ProjectStudio.jsx');
const studioSource = readFileSync(studioPath, 'utf-8');

// Fiction handler — find the handleManuscriptPolish save loop
const fictionHandlerIdx = studioSource.indexOf('handleManuscriptPolish = async');
assert(fictionHandlerIdx > 0, 'Fiction handleManuscriptPolish exists');
const fictionSaveSection = studioSource.substring(fictionHandlerIdx, fictionHandlerIdx + 12000);
assert(fictionSaveSection.includes('prepareChapterContent'), 'Fiction save loop uses prepareChapterContent');
assert(fictionSaveSection.includes('word_count'), 'Fiction save loop writes word_count');

// ── 3. NF handler save loop ──
console.log('\n3. NF polish save loop');
const nfHandlerIdx = studioSource.indexOf('handleManuscriptPolishNonfiction = async');
assert(nfHandlerIdx > 0, 'NF handleManuscriptPolishNonfiction exists');
const nfSaveSection = studioSource.substring(nfHandlerIdx, nfHandlerIdx + 5000);
assert(nfSaveSection.includes('prepareChapterContent'), 'NF save loop uses prepareChapterContent');
assert(nfSaveSection.includes('word_count'), 'NF save loop writes word_count');
assert(nfSaveSection.includes('runManuscriptPolishPipeline'), 'NF handler calls unified pipeline');

// ── 4. Stale field clearing ──
console.log('\n4. Stale field clearing');
assert(nfSaveSection.includes('staleClear'), 'NF save loop clears stale fields');
assert(nfSaveSection.includes('__polishedContent') || nfSaveSection.includes('finalText'),
  'NF save loop clears legacy content fields');

// ── 5. Backup content ──
console.log('\n5. Backup content');
assert(nfSaveSection.includes('prepareBackupContent'), 'NF save loop creates backup');
assert(fictionSaveSection.includes('prepareBackupContent'), 'Fiction save loop creates backup');

// ── 6. Read-back verification pattern ──
console.log('\n6. Export read-back');
assert(exportTabSource.includes('resolveChapterContent'), 'Export reads content back from DB');

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
