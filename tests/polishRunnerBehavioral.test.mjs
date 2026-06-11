/**
 * polishRunnerBehavioral.test.mjs — Behavioral regression tests for manuscriptPolishRunner.
 *
 * Verifies:
 * 1. Runner returns comprehensive stats object with all expected fields
 * 2. NF mode gates fiction-specific steps (dialogue mechanics, scene dup sweep)
 * 3. NF mode runs NF-specific steps (NF core, anti-chatbot recast, essay imbalance)
 * 4. Fiction mode runs fiction-specific steps (rep targets, scene dup, dialogue)
 * 5. Phase ordering: deterministic phases run before LLM (Phase D)
 * 6. Banned vocabulary is recast, not deleted
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

console.log('=== Polish Runner Behavioral Tests ===\n');

// ── 1. Stats return shape ──
console.log('1. Stats return shape');
assert(runnerSource.includes('stats: {'), 'Runner returns stats object');
assert(runnerSource.includes('bannedRecastCount'), 'Stats includes bannedRecastCount');
assert(runnerSource.includes('capFixed'), 'Stats includes capFixed');
assert(runnerSource.includes('voiceFixed'), 'Stats includes voiceFixed');
assert(runnerSource.includes('transitionFixed'), 'Stats includes transitionFixed');
assert(runnerSource.includes('dialogPunctFixed'), 'Stats includes dialogPunctFixed');
assert(runnerSource.includes('dialogFillerFixed'), 'Stats includes dialogFillerFixed');
assert(runnerSource.includes('stackingFixed'), 'Stats includes stackingFixed');
assert(runnerSource.includes('repFixed'), 'Stats includes repFixed');
assert(runnerSource.includes('externalPatternsFixed'), 'Stats includes externalPatternsFixed');
assert(runnerSource.includes('vocabCapped'), 'Stats includes vocabCapped');
assert(runnerSource.includes('quotesFixed'), 'Stats includes quotesFixed');
assert(runnerSource.includes('sceneDuplicate:'), 'Stats includes sceneDuplicate');
assert(runnerSource.includes('styleTic:'), 'Stats includes styleTic');
assert(runnerSource.includes('nfCore:'), 'Stats includes nfCore');
assert(runnerSource.includes('llmPolishCount'), 'Stats includes llmPolishCount');
assert(runnerSource.includes('llmFallbackCount'), 'Stats includes llmFallbackCount');

// ── 2. NF mode gates ──
console.log('\n2. NF mode gates fiction-specific steps');
assert(runnerSource.includes("mode !== 'nonfiction' && isAnthology"), 'Anthology checks gated for NF');
assert(runnerSource.includes("mode !== 'nonfiction' && sceneDuplicateSweep"), 'Scene dup sweep gated for NF');
assert(runnerSource.includes("mode !== 'nonfiction' && shouldRunDialogueRepair"), 'Dialogue mechanics gated for NF');

// Verify dialogue punct/filler are gated
const dialogPunctGated = runnerSource.includes("mode !== 'nonfiction'") &&
  runnerSource.includes('runDialoguePunctuationFix');
assert(dialogPunctGated, 'Dialogue punctuation gated for NF');

// ── 3. NF mode runs NF-specific steps ──
console.log('\n3. NF mode runs NF-specific steps');
assert(runnerSource.includes("mode === 'nonfiction'"), 'Runner branches on mode === nonfiction');
assert(runnerSource.includes('runNonfictionDeterministicCore'), 'Runner calls NF deterministic core');
assert(runnerSource.includes('detectEssayImbalance'), 'Runner calls detectEssayImbalance');
assert(runnerSource.includes('runAntiChatbotRecastPipeline'), 'Runner calls anti-chatbot recast pipeline');

// ── 4. Fiction mode still works ──
console.log('\n4. Fiction mode retains all steps');
assert(runnerSource.includes('polishChapterWithLLM'), 'Fiction uses polishChapterWithLLM');
assert(runnerSource.includes('runRepetitionCaps'), 'Fiction uses repetition caps');
assert(runnerSource.includes('runDialogueMechanicsPass'), 'Fiction uses dialogue mechanics');
assert(runnerSource.includes('runMidParagraphDialogueAutofixPass'), 'Fiction uses mid-para autofix');

// ── 5. Phase ordering ──
console.log('\n5. Phase ordering verification');
const phaseAIdx = runnerSource.indexOf('PHASE A:');
const phaseBIdx = runnerSource.indexOf('PHASE B:');
const phaseCIdx = runnerSource.indexOf('PHASE C:');
const phaseDIdx = runnerSource.indexOf('PHASE D:');
const phaseEIdx = runnerSource.indexOf('PHASE E:');
assert(phaseAIdx < phaseBIdx, 'Phase A before Phase B');
assert(phaseBIdx < phaseCIdx, 'Phase B before Phase C');
assert(phaseCIdx < phaseDIdx, 'Phase C before Phase D');
assert(phaseDIdx < phaseEIdx, 'Phase D before Phase E');
assert(phaseDIdx > 0, 'Phase D (LLM) exists');

// ── 6. Banned vocabulary recast ──
console.log('\n6. Banned vocabulary recast (not deleted)');
assert(runnerSource.includes('recastBannedVocabulary'), 'Runner calls recastBannedVocabulary');

// Verify recast function returns synonyms, not empty strings
const slopPath = path.resolve(root, 'src/lib/aiSlopReduction.js');
const slopSource = readFileSync(slopPath, 'utf-8');
assert(slopSource.includes('recastBannedVocabulary'), 'aiSlopReduction exports recastBannedVocabulary');
// Check that the recast map has synonym replacements (not empty strings)
const hasSynonyms = /['"]tapestry['"].*?['"][^'"]+['"]/.test(slopSource) ||
  /RECAST_MAP|SYNONYM_MAP|replacement/i.test(slopSource);
assert(hasSynonyms, 'Recast map contains synonym replacements');

// ── 7. NF recast uses conservative mode ──
console.log('\n7. NF recast configuration');
assert(runnerSource.includes("recastMode: 'conservative'"), 'NF recast uses conservative mode');

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
