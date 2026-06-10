/**
 * blockbusterQualityCalibration.test.mjs — Pipeline wiring tests
 *
 * Validates that the anti-chatbot prose module is correctly wired
 * into the live generation and polish pipelines.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Test harness ──
let passed = 0;
let failed = 0;
const failures = [];
const sectionResults = {};
let currentSection = '';

function section(name) {
  currentSection = name;
  sectionResults[name] = { total: 0, passed: 0 };
  console.log(`\n=== ${name} ===`);
}

function test(name, fn) {
  sectionResults[currentSection].total++;
  try {
    fn();
    passed++;
    sectionResults[currentSection].passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ section: currentSection, name, error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1: craftCompact.js wiring
// ════════════════════════════════════════════════════════════════════════════

section('1. CRAFT COMPACT WIRING');

test('HUMAN_PROSE_PRIORITY_BLOCK is non-empty', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/craftCompact.js'), 'utf8');
  assert.ok(!src.includes("export const HUMAN_PROSE_PRIORITY_BLOCK = '';"),
    'HUMAN_PROSE_PRIORITY_BLOCK should NOT be empty string');
  assert.ok(src.includes('SIGNATURE_VOICE_BLOCK'),
    'Should import SIGNATURE_VOICE_BLOCK');
});

test('craftCompact imports from antiChatbotProse', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/craftCompact.js'), 'utf8');
  assert.ok(src.includes("import { SIGNATURE_VOICE_BLOCK } from"),
    'Should import SIGNATURE_VOICE_BLOCK');
  assert.ok(src.includes('antiChatbotProse'),
    'Should reference antiChatbotProse module');
});

test('Other craft constants remain empty (Phase 3 preserved)', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/craftCompact.js'), 'utf8');
  assert.ok(src.includes("export const COMPACT_CRAFT_RULES = '';"), 'COMPACT_CRAFT_RULES should be empty');
  assert.ok(src.includes("export const COMPACT_ANTI_SLOP = '';"), 'COMPACT_ANTI_SLOP should be empty');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2: sceneWriter.js injection
// ════════════════════════════════════════════════════════════════════════════

section('2. SCENE WRITER INJECTION');

test('sceneWriter imports HUMAN_PROSE_PRIORITY_BLOCK', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('HUMAN_PROSE_PRIORITY_BLOCK'), 'Should import HUMAN_PROSE_PRIORITY_BLOCK');
});

test('buildFictionPrompt includes HUMAN_PROSE_PRIORITY_BLOCK', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  const funcStart = src.indexOf('function buildFictionPrompt(');
  const returnBlock = src.indexOf('HUMAN_PROSE_PRIORITY_BLOCK', funcStart);
  assert.ok(returnBlock > funcStart, 'HUMAN_PROSE_PRIORITY_BLOCK should be in buildFictionPrompt return');
});

test('buildNoSlopBlock still includes anti-repetition rules', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('ANTI_REPETITION_RULES'), 'Should still use ANTI_REPETITION_RULES');
});

test('buildManuscriptPurityBlock still present', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/sceneWriter.js'), 'utf8');
  assert.ok(src.includes('function buildManuscriptPurityBlock'), 'Should still have buildManuscriptPurityBlock');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3: llmProsePolisher.js wiring
// ════════════════════════════════════════════════════════════════════════════

section('3. PROSE POLISHER WIRING');

test('Polisher imports POLISHER_ANTI_CHATBOT_RULES', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/llmProsePolisher.js'), 'utf8');
  assert.ok(src.includes('POLISHER_ANTI_CHATBOT_RULES'),
    'Should import POLISHER_ANTI_CHATBOT_RULES');
});

test('Polisher system prompt includes anti-chatbot rules', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/llmProsePolisher.js'), 'utf8');
  assert.ok(src.includes('POLISHER_ANTI_CHATBOT_RULES'),
    'PROSE_POLISHER_SYSTEM_PROMPT should reference anti-chatbot rules');
});

test('Polisher preserves existing AI-slop rules', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/llmProsePolisher.js'), 'utf8');
  assert.ok(src.includes('AI-SLOP REDUCTION'), 'Should preserve AI-SLOP REDUCTION section');
  assert.ok(src.includes('DIALOGUE MECHANICS'), 'Should preserve DIALOGUE MECHANICS section');
});

test('Polisher preserves validation guardrails', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/llmProsePolisher.js'), 'utf8');
  assert.ok(src.includes('PROCESS_LEAKAGE_PATTERNS'), 'Should preserve leakage detection');
  assert.ok(src.includes('CONTAMINATION_PATTERNS'), 'Should preserve contamination detection');
  assert.ok(src.includes('validatePolisherOutput'), 'Should preserve output validation');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4: enforcementBlock.js status
// ════════════════════════════════════════════════════════════════════════════

section('4. ENFORCEMENT BLOCK STATUS');

test('MANDATORY_ENFORCEMENT_BLOCK is empty (Phase 3 — documented)', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/enforcementBlock.js'), 'utf8');
  assert.ok(src.includes("export const MANDATORY_ENFORCEMENT_BLOCK = '';"),
    'MANDATORY_ENFORCEMENT_BLOCK should be empty (Phase 3 migration)');
});

test('enforcementBlock.js documents the Phase 3 migration', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/enforcementBlock.js'), 'utf8');
  assert.ok(src.includes('PHASE 3'), 'Should document Phase 3 migration');
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5: antiChatbotProse.js module structure
// ════════════════════════════════════════════════════════════════════════════

section('5. MODULE STRUCTURE');

test('antiChatbotProse.js exists', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.length > 1000, 'Module should be substantial');
});

test('Exports SIGNATURE_VOICE_BLOCK', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.includes('export const SIGNATURE_VOICE_BLOCK'));
});

test('Exports POLISHER_ANTI_CHATBOT_RULES', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.includes('export const POLISHER_ANTI_CHATBOT_RULES'));
});

test('Exports analyzeProseTexture', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.includes('export function analyzeProseTexture'));
});

test('Exports countChatbotPatterns', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.includes('export function countChatbotPatterns'));
});

test('Contains VERSION constant', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/antiChatbotProse.js'), 'utf8');
  assert.ok(src.includes("export const VERSION = 'ANTI-CHATBOT-PROSE"));
});

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6: Build files
// ════════════════════════════════════════════════════════════════════════════

section('6. BUILD VERIFICATION');

test('Source files exist and are non-empty', () => {
  const files = [
    'src/lib/antiChatbotProse.js',
    'src/lib/craftCompact.js',
    'src/lib/llmProsePolisher.js',
    'src/lib/enforcementBlock.js',
    'src/lib/sceneWriter.js',
    'src/lib/aiSlopReduction.js',
  ];
  for (const f of files) {
    const path = join(process.cwd(), f);
    const content = readFileSync(path, 'utf8');
    assert.ok(content.length > 100, `${f} should be non-empty`);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`BLOCKBUSTER QUALITY CALIBRATION TESTS: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  ❌ [${f.section}] ${f.name}: ${f.error}`);
  }
}

console.log(`${'='.repeat(64)}`);

console.log('\nSection Summary:');
for (const [name, r] of Object.entries(sectionResults)) {
  const icon = r.passed === r.total ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${r.passed}/${r.total}`);
}

console.log();

if (failed > 0) process.exit(1);
