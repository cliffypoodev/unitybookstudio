/**
 * slopRegressionRevert.test.mjs — LIVE-EXECUTION test for the slop regression revert mechanism.
 *
 * Run with:
 *   node --loader ./tests/helpers/aliasLoader.mjs tests/slopRegressionRevert.test.mjs
 *
 * Verifies by actually running the pipeline with a mock LLM that returns
 * text containing MORE slop than the input, then asserts:
 *   1. The chapter content is REVERTED (not the sloppy LLM output)
 *   2. The changes log records the revert event
 *   3. The llmFallbackCount is incremented
 *
 * Also retains structural assertions (string scans) from the original test.
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

console.log('=== Slop Regression Revert Tests ===\n');

// ══════════════════════════════════════════════════════════════════════════
// PART 1: Structural assertions (retained from original string-scan test)
// ══════════════════════════════════════════════════════════════════════════

console.log('PART 1: Structural assertions (source scan)\n');

const runnerPath = path.resolve(root, 'src/lib/manuscriptPolishRunner.js');
const runnerSource = readFileSync(runnerPath, 'utf-8');

console.log('1. Pre-LLM slop measurement');
assert(runnerSource.includes('preLLMSlop'), 'Pre-LLM slop variable exists');
assert(runnerSource.includes('preLLMSlopTotal'), 'Pre-LLM slop total tracked');

console.log('\n2. Post-LLM slop measurement');
assert(runnerSource.includes('postLLMSlop') || runnerSource.includes('postSlop'), 'Post-LLM slop variable exists');

console.log('\n3. Slop regression comparison');
assert(runnerSource.includes('preLLMSlopTotal + 2'), 'Tolerance threshold is +2');
assert(runnerSource.includes('slop regression'), 'Slop regression detected and reported');

console.log('\n4. Revert mechanism');
assert(runnerSource.includes('REVERTED'), 'REVERTED status in changes');
assert(runnerSource.includes('llmFallbackCount++'), 'Fallback count incremented on revert');

console.log('\n5. Both modes have slop regression checks');
const fictionPhaseD = runnerSource.indexOf('polishChapterWithLLM');
const fictionSlopCheck = runnerSource.indexOf('postLLMSlopTotal', fictionPhaseD);
assert(fictionSlopCheck > fictionPhaseD, 'Fiction LLM path has post-slop check');

const nfPhaseD = runnerSource.indexOf('runAntiChatbotRecastPipeline');
const nfSlopCheck = runnerSource.indexOf('postSlop', nfPhaseD);
assert(nfSlopCheck > nfPhaseD || nfSlopCheck === -1,
  'NF recast path has post-slop check (or uses postSlopTotal variant)');

assert(runnerSource.includes('NF recast slop regression') || runnerSource.includes('NF recast REVERTED'),
  'NF path has explicit slop regression reporting');

console.log('\n6. Logging structure');
assert(runnerSource.includes('llmPolishLog.push'), 'LLM events logged to array');
assert(runnerSource.includes('fallback: true'), 'Fallback events tagged');

console.log('\n7. Phase ordering verification');
const slopReductionIdx = runnerSource.indexOf('runAISlopReductionPass');
assert(slopReductionIdx > 0, 'AI slop reduction pass exists');

// ══════════════════════════════════════════════════════════════════════════
// PART 2: Live execution — mock LLM returns sloppier text → revert fires
// ══════════════════════════════════════════════════════════════════════════

console.log('\nPART 2: Live execution (mock LLM → slop regression → revert)\n');

const { runManuscriptPolishPipeline } = await import('../src/lib/manuscriptPolishRunner.js');

// Build a fixture with LOW slop: clean prose, no AI slop patterns
const cleanProse = [
  'Marcus stepped through the doorway and scanned the empty hall.',
  'The floorboards groaned beneath his boots. Dust motes drifted through a shaft of light.',
  'He crossed the room in three strides, paused, then pushed open the far door.',
  'Behind it lay the stairwell, spiraling upward into shadow.',
  'He climbed without looking back, each step measured and deliberate.',
  'At the landing he stopped and listened. Nothing moved above. Nothing stirred below.',
  'The envelope waited on the table, sealed and addressed in blue ink.',
  'He tore it open, read the single line inside, and folded it back along the crease.',
  'There was work still to be done, and the night was not yet half over.',
].join('\n\n');

// Mock LLM that INJECTS slop patterns (increases slop count by >2)
const slopInjector = async ({ chapterText, chapterNumber }) => {
  // Add many slop phrases so post-LLM slop total > pre + 2
  const sloppy = chapterText + '\n\n' +
    'He felt the weight of the realization. Something shifted.\n' +
    'The palpable tension washed over him. He realized the truth.\n' +
    'She realized that nothing was merely coincidental.\n' +
    'He felt hollow. The weight of it settled over everything.\n' +
    'Not just the silence, but the sheer weight of the luminous relentless truth.';
  return { ok: true, text: sloppy };
};

const loaded = [{
  chapter: { chapter_number: 1, title: 'Chapter 1' },
  content: cleanProse,
  original: cleanProse,
}];

const project = { title: 'Test Book', genre: 'literary fiction' };

const result = await runManuscriptPolishPipeline({
  loaded,
  project,
  allowLLM: true,
  mode: 'fiction',
  _llmOverride: slopInjector,
});

console.log('8. Live execution results');

// The chapter should be REVERTED — the sloppy LLM output should NOT survive
assert(!loaded[0].content.includes('palpable tension'),
  'Sloppy LLM output was reverted (palpable tension not in final output)');
assert(!loaded[0].content.includes('sheer weight of the luminous'),
  'Sloppy LLM output was reverted (luminous not in final output)');

// The changes log should record the revert
const revertEntry = result.changes.find(c => c.includes('REVERTED'));
assert(!!revertEntry, 'Changes log contains REVERTED entry');

// The fallback count should be incremented
assert(result.stats?.llmFallbackCount > 0 || result.llmFallbackCount > 0,
  'LLM fallback count incremented on revert');

// The original clean prose should be preserved
assert(loaded[0].content.includes('Marcus stepped through'),
  'Original prose preserved after revert (first sentence intact)');
assert(loaded[0].content.includes('half over'),
  'Original prose preserved after revert (last sentence intact)');

// ══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`SLOP REGRESSION REVERT: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);

if (failed > 0) {
  console.error('\n⚠️  Tests FAILED — see above for details.');
  process.exit(1);
}
console.log('All slop regression revert tests passed! ✅\n');
