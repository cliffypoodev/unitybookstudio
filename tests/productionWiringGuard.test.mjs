// tests/productionWiringGuard.test.mjs — Final production wiring guard
// Verifies the complete pipeline-unification refactor is correctly wired.
// Run: node tests/productionWiringGuard.test.mjs

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.error(`  ❌ FAIL: ${name}`); }
}

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (rel) => readFileSync(resolve(root, rel), 'utf-8');

// ═══════════════════════════════════════════════════════════════════════════
// 1. MANUSCRIPT POLISH RUNNER EXISTS AND EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 1: manuscriptPolishRunner.js ──');
const runner = read('src/lib/manuscriptPolishRunner.js');
assert(runner.includes('export async function runManuscriptPolishPipeline'), 'Runner exports runManuscriptPolishPipeline');
assert(runner.includes('PHASE A'), 'Runner has Phase A (pre-pass)');
assert(runner.includes('PHASE B'), 'Runner has Phase B (style/voice)');
assert(runner.includes('PHASE C'), 'Runner has Phase C (chapter cleanup)');
assert(runner.includes('PHASE D'), 'Runner has Phase D (LLM last)');
assert(runner.includes('PHASE E'), 'Runner has Phase E (quality gate)');
assert(runner.includes('recastBannedVocabulary'), 'Runner uses recastBannedVocabulary (not delete)');
assert(runner.includes('slop regression'), 'Runner has LLM slop regression check');

// ═══════════════════════════════════════════════════════════════════════════
// 2. PROJECTSTUDIO WIRED TO RUNNER
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 2: ProjectStudio wiring ──');
const studio = read('src/pages/ProjectStudio.jsx');
assert(studio.includes("import { runManuscriptPolishPipeline }"), 'ProjectStudio imports runner');
assert(studio.includes('runManuscriptPolishPipeline({'), 'ProjectStudio calls runner');
assert(studio.includes('handleRedraftAllFresh = async ()'), 'ProjectStudio has handleRedraftAllFresh');
const redraftCode = studio.substring(studio.indexOf('handleRedraftAllFresh'), studio.indexOf('handleStop'));
assert(redraftCode.includes('const laneLimit = isNonfictionMode ? NONFICTION_DRAFT_LANE_LIMIT'), 'handleRedraftAllFresh uses standard draft lane limits');
assert(!redraftCode.includes('chapterHasPersistedManuscriptContent'), 'handleRedraftAllFresh does NOT filter out chapters with content');
assert(!studio.includes('STEP 2: Remove banned words'), 'Inline Step 2 deleted');
assert(!studio.includes('STEP 3: Fix capitalization'), 'Inline Step 3 deleted');
assert(!studio.includes('STEP 12b-3b'), 'Inline Step 12b-3b deleted');

// ═══════════════════════════════════════════════════════════════════════════
// 3. BANNED VOCABULARY USES RECAST (NEVER DELETE)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 3: Banned vocabulary recast ──');
const slopReduction = read('src/lib/aiSlopReduction.js');
assert(slopReduction.includes('export function recastBannedVocabulary'), 'recastBannedVocabulary exported');
assert(slopReduction.includes('BANNED_VOCAB_MAP'), 'Synonym map exists');
// Verify runner uses recast, not regex-delete
assert(runner.includes('recastBannedVocabulary(f.content)'), 'Runner calls recastBannedVocabulary');
assert(!runner.includes("replace(rx, '')"), 'Runner never regex-deletes banned words');

// ═══════════════════════════════════════════════════════════════════════════
// 4. LLM RUNS LAST (after deterministic)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 4: LLM ordering ──');
const phaseAIdx = runner.indexOf('PHASE A');
const phaseBIdx = runner.indexOf('PHASE B');
const phaseCIdx = runner.indexOf('PHASE C');
const phaseDIdx = runner.indexOf('PHASE D');
const phaseEIdx = runner.indexOf('PHASE E');
assert(phaseAIdx < phaseBIdx, 'Phase A before Phase B');
assert(phaseBIdx < phaseCIdx, 'Phase B before Phase C');
assert(phaseCIdx < phaseDIdx, 'Phase C before Phase D (deterministic before LLM)');
assert(phaseDIdx < phaseEIdx, 'Phase D before Phase E (LLM before gate)');
assert(runner.indexOf('polishChapterWithLLM') > runner.indexOf('runDeterministicGrammarRepair'), 'LLM after deterministic grammar');

// ═══════════════════════════════════════════════════════════════════════════
// 5. AGENT ROUTING — model forwarded, task_type present
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 5: Agent routing ──');
const retry = read('src/lib/integrationRetry.js');
assert(retry.includes('model: resolvedModel'), 'integrationRetry forwards model');
const criticalFiles = [
  ['chapterRepair.js', 'prose'],
  ['forensicAnalytics.js', 'research'],
  ['postDraftCleanup.js', 'polish'],
  ['finalProofread.js', 'polish'],
  ['seriesBible.js', 'foundation'],
];
for (const [file, taskType] of criticalFiles) {
  const code = read('src/lib/' + file);
  assert(code.includes(`task_type: '${taskType}'`), `${file} has task_type: '${taskType}'`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. ENFORCEMENT LAYER RESTORED
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 6: Enforcement layer ──');
const enforcement = read('src/lib/enforcementBlock.js');
assert(enforcement.includes('SCENE-FIRST DIRECTIVE'), 'Enforcement has scene-first rule');
assert(enforcement.includes('BANNED VOCABULARY'), 'Enforcement has banned vocabulary rule');
assert(enforcement.includes('PRONOUN CORRUPTION GUARD'), 'Enforcement has pronoun guard');
const craft = read('src/lib/craftCompact.js');
assert(craft.includes('SCENE CRAFT RULES'), 'Craft rules restored');
assert(craft.includes("Show, don't tell"), 'Craft rule 1 present');

// ═══════════════════════════════════════════════════════════════════════════
// 7. PROMPT DE-SEEDING
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 7: Prompt de-seeding ──');
const sceneWriter = read('src/lib/sceneWriter.js');
assert(!sceneWriter.includes('Prefer "the available accounts indicate'), 'Forensic phrase seeding removed');
assert(sceneWriter.includes('BANNED phrases'), 'Replacement bans present');
assert(sceneWriter.includes('includeFullCraft = true'), 'Full craft enabled');

// ═══════════════════════════════════════════════════════════════════════════
// 8. EXPORT IDEMPOTENCE
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 8: Export idempotence ──');
const exportTab = read('src/components/publishing/ExportTab.jsx');
assert(exportTab.includes('EXPORT-PERSIST'), 'Export persist logic present');
assert(exportTab.includes('prepareChapterContent'), 'Uses prepareChapterContent for persist');

// ═══════════════════════════════════════════════════════════════════════════
// 9. CRITIC RUBRIC EXTENSION
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 9: Critic rubric ──');
const critic = read('src/lib/criticPanel.js');
assert(critic.includes('commercial_eval'), 'Schema has commercial_eval');
assert(critic.includes('firstLineHook'), 'Has firstLineHook dimension');
assert(critic.includes('aiSmoothnessAbsence'), 'Has aiSmoothnessAbsence dimension');
assert(critic.includes('topFixes'), 'Has topFixes array');
assert(critic.includes('audience_prediction'), 'Keeps existing audience_prediction');

// ═══════════════════════════════════════════════════════════════════════════
// 10. MODELFILES CAPTURED
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── 10: Modelfiles ──');
const modelFiles = ['ghostwriter', 'story-architect', 'researcher', 'publishing-critic', 'prose-polisher'];
for (const name of modelFiles) {
  const path = resolve(root, `models/${name}.Modelfile`);
  assert(existsSync(path), `${name}.Modelfile exists`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`PRODUCTION WIRING GUARD: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
  console.error(`\n❌ ${failed} UNEXPECTED failure(s) — DO NOT SHIP`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${passed} production wiring checks passed — SHIP IT`);
  process.exit(0);
}
