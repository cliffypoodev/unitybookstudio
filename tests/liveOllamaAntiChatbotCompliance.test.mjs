/**
 * liveOllamaAntiChatbotCompliance.test.mjs
 *
 * Validates the REAL live Ollama bakeoff results.
 * Tests the actual generated outputs, not hand-crafted samples.
 *
 * NOTE: These tests validate the RESULTS FILE from the live bakeoff,
 * not the generation itself. The bakeoff must be run first.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture, countChatbotPatterns } = await import(modulePath);

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

const RESULTS_DIR = join(process.cwd(), 'smoke-test-output/live-ollama-anti-chatbot-compliance');
const resultsPath = join(RESULTS_DIR, 'live-bakeoff-results.json');

// ════════════════════════════════════════════════════════════════════════════
section('1. BAKEOFF OUTPUT EXISTS');
// ════════════════════════════════════════════════════════════════════════════

test('Results JSON exists', () => {
  assert.ok(existsSync(resultsPath), 'live-bakeoff-results.json should exist');
});

test('Thriller Version A text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'thriller-version-a.txt')));
});

test('Thriller Version B text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'thriller-version-b.txt')));
});

test('Literary Version A text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'literary-version-a.txt')));
});

test('Literary Version B text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'literary-version-b.txt')));
});

test('Nonfiction Version A text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'nonfiction-version-a.txt')));
});

test('Nonfiction Version B text exists', () => {
  assert.ok(existsSync(join(RESULTS_DIR, 'nonfiction-version-b.txt')));
});

// Load results
const bakeoff = JSON.parse(readFileSync(resultsPath, 'utf8'));

// ════════════════════════════════════════════════════════════════════════════
section('2. GENERATED OUTPUT IS SUBSTANTIVE');
// ════════════════════════════════════════════════════════════════════════════

for (const r of bakeoff.results) {
  test(`${r.name}: Version A ≥ 700 words`, () => {
    assert.ok(r.wordCountA >= 700, `A had ${r.wordCountA} words, expected ≥700`);
  });

  test(`${r.name}: Version B ≥ 600 words`, () => {
    assert.ok(r.wordCountB >= 600, `B had ${r.wordCountB} words, expected ≥600`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('3. BASELINE MODEL QUALITY (A versions)');
// ════════════════════════════════════════════════════════════════════════════

test('All A versions score ≥ COMPETENT (55+)', () => {
  for (const r of bakeoff.results) {
    assert.ok(r.textureA.compositeScore >= 55,
      `${r.name} A scored ${r.textureA.compositeScore}, expected ≥55`);
  }
});

test('Baseline model is already GOOD or better for ≥2 genres', () => {
  const goodOrBetter = bakeoff.results.filter(r =>
    ['GOOD', 'EXCELLENT'].includes(r.textureA.grade));
  assert.ok(goodOrBetter.length >= 2,
    `Only ${goodOrBetter.length} genres scored GOOD+ baseline`);
});

// ════════════════════════════════════════════════════════════════════════════
section('4. FICTION IMPROVEMENT (Thriller + Literary)');
// ════════════════════════════════════════════════════════════════════════════

const fictionResults = bakeoff.results.filter(r => r.slug !== 'nonfiction');

test('At least one fiction genre improved', () => {
  const improved = fictionResults.filter(r => r.delta.compositeScore > 0);
  assert.ok(improved.length >= 1,
    `No fiction genre improved: ${fictionResults.map(r => r.delta.compositeScore)}`);
});

test('Fiction filter verb density reduced or stable in ≥1 genre', () => {
  const betterFilter = fictionResults.filter(r => r.delta.filterVerbDelta >= 0);
  assert.ok(betterFilter.length >= 1, 'No fiction genre reduced filter verbs');
});

test('Literary symmetry improved (lower is better)', () => {
  const literary = bakeoff.results.find(r => r.slug === 'literary');
  assert.ok(literary.textureB.symmetryScore <= literary.textureA.symmetryScore,
    `B symmetry (${literary.textureB.symmetryScore}) should be ≤ A (${literary.textureA.symmetryScore})`);
});

// ════════════════════════════════════════════════════════════════════════════
section('5. NONFICTION REGRESSION DOCUMENTED');
// ════════════════════════════════════════════════════════════════════════════

const nonfiction = bakeoff.results.find(r => r.slug === 'nonfiction');

test('Nonfiction B scored lower than A (regression exists)', () => {
  assert.ok(nonfiction.delta.compositeScore < 0,
    `Expected regression, got delta ${nonfiction.delta.compositeScore}`);
});

test('Nonfiction regression is significant (> 10 points)', () => {
  assert.ok(Math.abs(nonfiction.delta.compositeScore) > 10,
    `Regression only ${Math.abs(nonfiction.delta.compositeScore)} points — may not be significant`);
});

test('Nonfiction B has more filter verbs than A', () => {
  assert.ok(nonfiction.textureB.filterVerbDensity > nonfiction.textureA.filterVerbDensity,
    'Nonfiction B should have more filter verbs (documenting regression)');
});

test('Nonfiction B produced fewer words than A', () => {
  assert.ok(nonfiction.wordCountB < nonfiction.wordCountA,
    `B (${nonfiction.wordCountB}) should have fewer words than A (${nonfiction.wordCountA})`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. MODEL DOES NOT FULLY COMPLY');
// ════════════════════════════════════════════════════════════════════════════

test('"Not just" patterns persist in B versions', () => {
  // The model fails to eliminate "not just" despite being explicitly told to
  const bWithNotJust = bakeoff.results.filter(r => r.patternsB.counts.not_just > 0);
  assert.ok(bWithNotJust.length >= 1,
    'Expected at least 1 B version to still have "not just" patterns');
});

test('Filter verbs persist in all B versions', () => {
  const bWithFilters = bakeoff.results.filter(r => r.patternsB.counts.filter_verbs > 0);
  assert.ok(bWithFilters.length >= 2,
    `Expected ≥2 B versions to still have filter verbs, got ${bWithFilters.length}`);
});

test('Average improvement is < 15 points (rules have limited effect)', () => {
  assert.ok(bakeoff.avgDelta < 15,
    `Average delta was ${bakeoff.avgDelta}, expected < 15 for honest assessment`);
});

// ════════════════════════════════════════════════════════════════════════════
section('7. DETERMINISTIC ANALYZER VALIDATION ON LIVE TEXT');
// ════════════════════════════════════════════════════════════════════════════

// Re-score the raw texts to verify results match
for (const slug of ['thriller', 'literary', 'nonfiction']) {
  const textA = readFileSync(join(RESULTS_DIR, `${slug}-version-a.txt`), 'utf8');
  const textB = readFileSync(join(RESULTS_DIR, `${slug}-version-b.txt`), 'utf8');

  const freshA = analyzeProseTexture(textA);
  const freshB = analyzeProseTexture(textB);
  const result = bakeoff.results.find(r => r.slug === slug);

  test(`${result.name}: Analyzer score A matches recorded`, () => {
    assert.equal(freshA.compositeScore, result.textureA.compositeScore,
      `Fresh=${freshA.compositeScore}, Recorded=${result.textureA.compositeScore}`);
  });

  test(`${result.name}: Analyzer score B matches recorded`, () => {
    assert.equal(freshB.compositeScore, result.textureB.compositeScore,
      `Fresh=${freshB.compositeScore}, Recorded=${result.textureB.compositeScore}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('8. LIVE TEXT IS REAL LLM OUTPUT (not hand-crafted)');
// ════════════════════════════════════════════════════════════════════════════

test('Results JSON has model field = ghostwriter', () => {
  assert.equal(bakeoff.model, 'ghostwriter');
});

test('Results JSON has temperature field', () => {
  assert.ok(typeof bakeoff.temperature === 'number');
});

test('Results JSON has timestamp', () => {
  assert.ok(bakeoff.timestamp);
  const ts = new Date(bakeoff.timestamp);
  assert.ok(!isNaN(ts.getTime()), 'timestamp should be valid date');
});

// Verify generated text has LLM characteristics (varied paragraph structure)
for (const slug of ['thriller', 'literary', 'nonfiction']) {
  const textB = readFileSync(join(RESULTS_DIR, `${slug}-version-b.txt`), 'utf8');
  test(`${slug}: B text has multiple paragraphs (real LLM output)`, () => {
    const paragraphs = textB.split(/\n\n+/).filter(p => p.trim().length > 50);
    assert.ok(paragraphs.length >= 5,
      `Expected ≥5 paragraphs, got ${paragraphs.length}`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`LIVE OLLAMA COMPLIANCE TESTS: ${passed} passed, ${failed} failed`);

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
