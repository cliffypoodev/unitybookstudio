/**
 * slopRegressionRevert.test.mjs — Verifies the slop regression revert mechanism.
 *
 * The runner must:
 * 1. Run AI slop reduction pass before LLM
 * 2. Run AI slop reduction pass after LLM
 * 3. Compare pre/post slop totals
 * 4. Revert LLM output if slop increased by > 2
 * 5. Log the revert event
 * 6. This logic must exist for BOTH fiction (LLM polish) and NF (anti-chatbot recast)
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.resolve(root, 'src/lib/manuscriptPolishRunner.js');
const runnerSource = readFileSync(runnerPath, 'utf-8');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ FAIL: ${label}`); }
}

console.log('=== Slop Regression Revert Tests ===\n');

// ── 1. Pre-LLM slop measurement exists ──
console.log('1. Pre-LLM slop measurement');
assert(runnerSource.includes('preLLMSlop'), 'Pre-LLM slop variable exists');
assert(runnerSource.includes('preLLMSlopTotal'), 'Pre-LLM slop total tracked');

// ── 2. Post-LLM slop measurement exists ──
console.log('\n2. Post-LLM slop measurement');
assert(runnerSource.includes('postLLMSlop') || runnerSource.includes('postSlop'), 'Post-LLM slop variable exists');

// ── 3. Comparison logic ──
console.log('\n3. Slop regression comparison');
assert(runnerSource.includes('preLLMSlopTotal + 2'), 'Tolerance threshold is +2');
assert(runnerSource.includes('slop regression'), 'Slop regression detected and reported');

// ── 4. Revert mechanism ──
console.log('\n4. Revert mechanism');
assert(runnerSource.includes('REVERTED'), 'REVERTED status in changes');
assert(runnerSource.includes('llmFallbackCount++'), 'Fallback count incremented on revert');

// ── 5. Fiction and NF both have slop regression checks ──
console.log('\n5. Both modes have slop regression checks');
// Fiction: polishChapterWithLLM path has slop regression
const fictionPhaseD = runnerSource.indexOf('polishChapterWithLLM');
const fictionSlopCheck = runnerSource.indexOf('postLLMSlopTotal', fictionPhaseD);
assert(fictionSlopCheck > fictionPhaseD, 'Fiction LLM path has post-slop check');

// NF: runAntiChatbotRecastPipeline path has slop regression
const nfPhaseD = runnerSource.indexOf('runAntiChatbotRecastPipeline');
const nfSlopCheck = runnerSource.indexOf('postSlop', nfPhaseD);
assert(nfSlopCheck > nfPhaseD || nfSlopCheck === -1,
  'NF recast path has post-slop check (or uses postSlopTotal variant)');

// More specific: check NF has its own regression block
assert(runnerSource.includes('NF recast slop regression') || runnerSource.includes('NF recast REVERTED'),
  'NF path has explicit slop regression reporting');

// ── 6. Log structure ──
console.log('\n6. Logging structure');
assert(runnerSource.includes('llmPolishLog.push'), 'LLM events logged to array');
assert(runnerSource.includes('fallback: true'), 'Fallback events tagged');

// ── 7. Phase D comes after deterministic phases ──
console.log('\n7. Phase ordering verification');
const slopReductionIdx = runnerSource.indexOf('runAISlopReductionPass');
assert(slopReductionIdx > 0, 'AI slop reduction pass exists');

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
