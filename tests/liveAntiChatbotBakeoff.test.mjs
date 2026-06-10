/**
 * liveAntiChatbotBakeoff.test.mjs — Validates the bakeoff methodology and results
 *
 * Tests that:
 * 1. Version B (hardened) outscores Version A (baseline) across all genres
 * 2. Chatbot pattern counts drop for hardened versions
 * 3. The scoring system correctly separates chatbot from human-quality prose
 * 4. No false negatives (good prose scored as bad)
 */

import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns, SIGNATURE_VOICE_BLOCK } = await import(modulePath);

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

// Load bakeoff results
const resultsPath = join(process.cwd(), 'smoke-test-output/live-anti-chatbot-bakeoff/bakeoff-results.json');
const bakeoff = JSON.parse(readFileSync(resultsPath, 'utf8'));

// ════════════════════════════════════════════════════════════════════════════
section('1. VERSION B OUTSCORES VERSION A');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: B composite > A composite`, () => {
    assert.ok(r.versionB.texture.compositeScore > r.versionA.texture.compositeScore,
      `B (${r.versionB.texture.compositeScore}) should beat A (${r.versionA.texture.compositeScore})`);
  });
}

test('Average improvement ≥ 15 points', () => {
  assert.ok(bakeoff.avgDelta >= 15, `Expected ≥15 avg delta, got ${bakeoff.avgDelta}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('2. CHATBOT PATTERNS DROP');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: B has fewer chatbot patterns than A`, () => {
    assert.ok(r.versionB.patterns.total < r.versionA.patterns.total,
      `B (${r.versionB.patterns.total}) should have fewer than A (${r.versionA.patterns.total})`);
  });

  test(`${r.name}: B chatbot density lower than A`, () => {
    assert.ok(r.versionB.patterns.density < r.versionA.patterns.density,
      `B density (${r.versionB.patterns.density}) should be lower than A (${r.versionA.patterns.density})`);
  });
}

test('Average pattern reduction ≥ 5', () => {
  assert.ok(bakeoff.avgPatternDrop >= 5, `Expected ≥5 avg pattern drop, got ${bakeoff.avgPatternDrop}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('3. GRADE BAND SEPARATION');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: A grade is CHATBOT_ADJACENT or worse`, () => {
    const acceptable = ['CHATBOT_SLOP', 'CHATBOT_ADJACENT'];
    assert.ok(acceptable.includes(r.versionA.texture.grade),
      `A grade should be chatbot-level, got ${r.versionA.texture.grade}`);
  });

  test(`${r.name}: B grade is GOOD or better`, () => {
    const acceptable = ['GOOD', 'EXCELLENT'];
    assert.ok(acceptable.includes(r.versionB.texture.grade),
      `B grade should be GOOD+, got ${r.versionB.texture.grade}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('4. SPECIFIC METRIC IMPROVEMENTS');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: B has lower filter verb density`, () => {
    assert.ok(r.versionB.texture.filterVerbDensity <= r.versionA.texture.filterVerbDensity,
      `B filter density (${r.versionB.texture.filterVerbDensity}) should be ≤ A (${r.versionA.texture.filterVerbDensity})`);
  });

  test(`${r.name}: B has zero thesis statements`, () => {
    assert.equal(r.versionB.texture.thesisStatementDensity, 0,
      `B should have zero thesis statements`);
  });

  test(`${r.name}: B has zero "not just" patterns`, () => {
    assert.equal(r.versionB.texture.notJustDensity, 0,
      `B should have zero "not just" patterns`);
  });

  test(`${r.name}: B has zero balanced reflection`, () => {
    assert.equal(r.versionB.texture.balancedReflectionCount, 0,
      `B should have zero balanced reflection`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('5. NO OVERCORRECTION — B DIAGNOSTICS');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: B has ≤3 diagnostics (not over-flagged)`, () => {
    assert.ok(r.versionB.texture.diagnostics.length <= 3,
      `B should have ≤3 diagnostics, got ${r.versionB.texture.diagnostics.length}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('6. SIGNATURE_VOICE_BLOCK IS ACTIVE');
// ════════════════════════════════════════════════════════════════════════════

test('SIGNATURE_VOICE_BLOCK is non-empty', () => {
  assert.ok(SIGNATURE_VOICE_BLOCK.length > 500);
});

test('craftCompact re-exports SIGNATURE_VOICE_BLOCK', () => {
  const src = readFileSync(join(process.cwd(), 'src/lib/craftCompact.js'), 'utf8');
  assert.ok(src.includes('SIGNATURE_VOICE_BLOCK'));
  assert.ok(!src.includes("HUMAN_PROSE_PRIORITY_BLOCK = '';"));
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`LIVE ANTI-CHATBOT BAKEOFF TESTS: ${passed} passed, ${failed} failed`);

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
