/**
 * antiChatbotLongformDriftGuard.test.mjs
 *
 * Tests that longform drift is detected and documented.
 * Validates the drift analysis from the live Ollama bakeoff.
 *
 * Drift = quality drop from opening to ending of a single generation.
 * This is a critical failure mode where the model follows rules
 * initially but reverts to default cadence after ~400 words.
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const modulePath = join(process.cwd(), 'src/lib/antiChatbotProse.js');
const { analyzeProseTexture } = await import(modulePath);

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

// ════════════════════════════════════════════════════════════════════════════
section('1. DRIFT ANALYSIS FILES EXIST');
// ════════════════════════════════════════════════════════════════════════════

const SLUGS = ['thriller', 'literary', 'nonfiction'];
for (const slug of SLUGS) {
  test(`${slug}-drift-analysis.json exists`, () => {
    assert.ok(existsSync(join(RESULTS_DIR, `${slug}-drift-analysis.json`)));
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('2. DRIFT DATA STRUCTURE');
// ════════════════════════════════════════════════════════════════════════════

for (const slug of SLUGS) {
  const driftPath = join(RESULTS_DIR, `${slug}-drift-analysis.json`);
  if (!existsSync(driftPath)) continue;
  const drift = JSON.parse(readFileSync(driftPath, 'utf8'));

  test(`${slug}: Has opening/middle/ending scores`, () => {
    assert.ok(typeof drift.opening?.compositeScore === 'number');
    assert.ok(typeof drift.middle?.compositeScore === 'number');
    assert.ok(typeof drift.ending?.compositeScore === 'number');
  });

  test(`${slug}: Has drift value`, () => {
    assert.ok(typeof drift.drift === 'number');
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('3. LITERARY DRIFT DETECTED');
// ════════════════════════════════════════════════════════════════════════════

const literaryDriftPath = join(RESULTS_DIR, 'literary-drift-analysis.json');
if (existsSync(literaryDriftPath)) {
  const litDrift = JSON.parse(readFileSync(literaryDriftPath, 'utf8'));

  test('Literary opening scores EXCELLENT (85+)', () => {
    assert.ok(litDrift.opening.compositeScore >= 85,
      `Opening scored ${litDrift.opening.compositeScore}, expected ≥85`);
  });

  test('Literary ending scores below opening', () => {
    assert.ok(litDrift.ending.compositeScore < litDrift.opening.compositeScore,
      `Ending ${litDrift.ending.compositeScore} should be < opening ${litDrift.opening.compositeScore}`);
  });

  test('Literary drift ≥ 15 points (significant)', () => {
    assert.ok(litDrift.drift >= 15,
      `Drift was ${litDrift.drift}, expected ≥15 for significance`);
  });

  test('Literary filter verbs increase from opening to ending', () => {
    assert.ok(litDrift.ending.filterVerbDensity > litDrift.opening.filterVerbDensity,
      `Ending filter density (${litDrift.ending.filterVerbDensity}) should exceed opening (${litDrift.opening.filterVerbDensity})`);
  });
}

// ════════════════════════════════════════════════════════════════════════════
section('4. INDEPENDENT DRIFT VERIFICATION ON RAW TEXT');
// ════════════════════════════════════════════════════════════════════════════

// Re-run drift analysis on the raw literary B text independently
const litBPath = join(RESULTS_DIR, 'literary-version-b.txt');
if (existsSync(litBPath)) {
  const litText = readFileSync(litBPath, 'utf8');
  const sentences = litText.split(/(?<=[.!?])\s+(?=[A-Z"'"""])/);

  test('Literary B has enough sentences for drift analysis', () => {
    assert.ok(sentences.length >= 15,
      `Only ${sentences.length} sentences, need ≥15`);
  });

  if (sentences.length >= 15) {
    const third = Math.floor(sentences.length / 3);
    const opening = sentences.slice(0, third).join(' ');
    const ending = sentences.slice(third * 2).join(' ');

    const openScore = analyzeProseTexture(opening);
    const endScore = analyzeProseTexture(ending);

    test('Independently verified: opening > ending', () => {
      assert.ok(openScore.compositeScore > endScore.compositeScore,
        `Opening ${openScore.compositeScore} should exceed ending ${endScore.compositeScore}`);
    });

    test('Independently verified: drift magnitude matches file', () => {
      const computedDrift = openScore.compositeScore - endScore.compositeScore;
      // Allow ±2 tolerance for rounding
      const fileDrift = JSON.parse(readFileSync(literaryDriftPath, 'utf8')).drift;
      assert.ok(Math.abs(computedDrift - fileDrift) <= 2,
        `Computed drift ${computedDrift} should match file drift ${fileDrift} (±2)`);
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
section('5. DRIFT PATTERN: FILTER VERB ACCUMULATION');
// ════════════════════════════════════════════════════════════════════════════

// Test the hypothesis: at least one fiction genre shows downward drift
// (filter verbs accumulate as the model loses the prompt signal)
const driftScores = [];
for (const slug of ['thriller', 'literary']) {
  const bPath = join(RESULTS_DIR, `${slug}-version-b.txt`);
  if (!existsSync(bPath)) continue;

  const text = readFileSync(bPath, 'utf8');
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 400) continue;

  const firstHalf = words.slice(0, Math.floor(words.length / 2)).join(' ');
  const secondHalf = words.slice(Math.floor(words.length / 2)).join(' ');

  const firstScore = analyzeProseTexture(firstHalf);
  const secondScore = analyzeProseTexture(secondHalf);
  driftScores.push({ slug, first: firstScore.compositeScore, second: secondScore.compositeScore });

  test(`${slug}: Half-by-half scores recorded for drift analysis`, () => {
    // Document the scores — both upward and downward drift are valid findings
    assert.ok(typeof firstScore.compositeScore === 'number');
    console.log(`      First half: ${firstScore.compositeScore} | Second half: ${secondScore.compositeScore} | Delta: ${firstScore.compositeScore - secondScore.compositeScore}`);
  });
}

test('At least one fiction genre shows downward drift (first > second)', () => {
  const drifting = driftScores.filter(d => d.first > d.second);
  assert.ok(drifting.length >= 1,
    `Expected ≥1 genre with downward drift: ${JSON.stringify(driftScores)}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. NONFICTION STABILITY (NO DRIFT BUT LOW BASELINE)');
// ════════════════════════════════════════════════════════════════════════════

const nfDriftPath = join(RESULTS_DIR, 'nonfiction-drift-analysis.json');
if (existsSync(nfDriftPath)) {
  const nfDrift = JSON.parse(readFileSync(nfDriftPath, 'utf8'));

  test('Nonfiction drift is ≤ 10 (stable but low)', () => {
    assert.ok(Math.abs(nfDrift.drift) <= 10,
      `Nonfiction drift was ${nfDrift.drift}, expected ≤10 (stable)`);
  });

  test('Nonfiction scores consistently COMPETENT across sections', () => {
    const allCompetent = [nfDrift.opening, nfDrift.middle, nfDrift.ending]
      .every(s => s.compositeScore >= 55);
    assert.ok(allCompetent,
      'All nonfiction sections should score ≥55 (COMPETENT)');
  });
}

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`LONGFORM DRIFT GUARD TESTS: ${passed} passed, ${failed} failed`);

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
