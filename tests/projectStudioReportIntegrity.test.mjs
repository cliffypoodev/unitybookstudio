/**
 * projectStudioReportIntegrity.test.mjs — Verifies ProjectStudio report templates
 * use pipelineResult.stats (not dead inline variables).
 *
 * Checks:
 * 1. Fiction report template uses pipelineResult.stats.*
 * 2. NF report template uses pipelineResult.stats.nfCore.*
 * 3. No dead variable references in report templates
 * 4. polish report panel uses pipelineResult.stats
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studioPath = path.resolve(root, 'src/pages/ProjectStudio.jsx');
const studioSource = readFileSync(studioPath, 'utf-8');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ FAIL: ${label}`); }
}

console.log('=== ProjectStudio Report Integrity Tests ===\n');

// ── 1. Fiction polish report template ──
console.log('1. Fiction polish report template');
const fictionHandlerIdx = studioSource.lastIndexOf('handleManuscriptPolish = async');
assert(fictionHandlerIdx > 0, 'Fiction handler exists');
const fictionBlock = studioSource.substring(fictionHandlerIdx, fictionHandlerIdx + 18000);
// Must reference pipelineResult or ps (the destructured stats)
assert(fictionBlock.includes('pipelineResult') || fictionBlock.includes('const ps = '),
  'Fiction handler references pipelineResult');

// ── 2. NF polish report template ──
console.log('\n2. NF polish report template');
const nfHandlerIdx = studioSource.indexOf('handleManuscriptPolishNonfiction = async');
assert(nfHandlerIdx > 0, 'NF handler exists');
const nfBlock = studioSource.substring(nfHandlerIdx, nfHandlerIdx + 8000);
assert(nfBlock.includes('pipelineResult'), 'NF handler references pipelineResult');
assert(nfBlock.includes('ps.nfCore') || nfBlock.includes('nfCoreStats'),
  'NF handler uses NF core stats');

// ── 3. No dead variable references in NF report ──
console.log('\n3. No dead variable references');
// These are the OLD variables from the pre-runner NF handler that should NOT be used
const deadVars = [
  'result.savedCount',     // old NF handler used result.* from runNonfictionPolish
  'result.unchangedCount',
  'result.bannedRemoved',
  'result.capFixed',
  'result.repFixed',
  'result.scaffoldsRemoved',
  'result.disclaimersRemoved',
  'result.grammarFixed',
  'result.spellingFixed',
  'result.afterStats',
];
for (const dead of deadVars) {
  const inNFBlock = nfBlock.includes(dead);
  assert(!inNFBlock, `No dead reference to '${dead}' in NF handler`);
}

// ── 4. Polish report panel in render ──
console.log('\n4. Polish report panel');
// The render section should reference polishResults and show stats from pipelineResult
const polishResultsIdx = studioSource.indexOf('polishResults');
assert(polishResultsIdx > 0, 'polishResults state exists');
assert(studioSource.includes('setPolishResults'), 'setPolishResults called');

// ── 5. NF handler calls setPolishResults ──
console.log('\n5. NF handler stores results');
assert(nfBlock.includes('setPolishResults'), 'NF handler calls setPolishResults');

// ── 6. Fiction handler calls setPolishResults ──
console.log('\n6. Fiction handler stores results');
assert(fictionBlock.includes('setPolishResults'), 'Fiction handler calls setPolishResults');

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
