/**
 * liveRecastNonfictionRegressionResolution.test.mjs
 *
 * Validates that the nonfiction regression from the PREVIOUS bakeoff (-17 points)
 * is now resolved in the genre-conditional recast bakeoff.
 *
 * Compares:
 *   OLD: smoke-test-output/live-ollama-anti-chatbot-compliance/live-bakeoff-results.json
 *   NEW: smoke-test-output/live-genre-conditional-recast-bakeoff/live-recast-bakeoff-results.json
 *
 * NOTE: These tests validate RESULTS FILES from live bakeoffs,
 * not the generation itself. Both bakeoffs must be run first.
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

// ── Paths ────────────────────────────────────────────────────────────────────
const OLD_DIR = join(process.cwd(), 'smoke-test-output/live-ollama-anti-chatbot-compliance');
const NEW_DIR = join(process.cwd(), 'smoke-test-output/live-genre-conditional-recast-bakeoff');

const oldResultsPath = join(OLD_DIR, 'live-bakeoff-results.json');
const newResultsPath = join(NEW_DIR, 'live-recast-bakeoff-results.json');

// ════════════════════════════════════════════════════════════════════════════
section('1. PREVIOUS REGRESSION DOCUMENTED');
// ════════════════════════════════════════════════════════════════════════════

test('Old results JSON exists', () => {
  assert.ok(existsSync(oldResultsPath), 'live-bakeoff-results.json should exist in old results dir');
});

const oldBakeoff = JSON.parse(readFileSync(oldResultsPath, 'utf8'));
const oldNonfiction = oldBakeoff.results.find(r => r.slug === 'nonfiction');

test('Old nonfiction delta.compositeScore < 0 (regression existed)', () => {
  assert.ok(oldNonfiction.delta.compositeScore < 0,
    `Expected negative delta, got ${oldNonfiction.delta.compositeScore}`);
});

test('Old nonfiction regression was > 10 points', () => {
  assert.ok(Math.abs(oldNonfiction.delta.compositeScore) > 10,
    `Regression was only ${Math.abs(oldNonfiction.delta.compositeScore)} points — expected > 10`);
});

// ════════════════════════════════════════════════════════════════════════════
section('2. REGRESSION RESOLVED');
// ════════════════════════════════════════════════════════════════════════════

const newBakeoff = JSON.parse(readFileSync(newResultsPath, 'utf8'));
const newNonfiction = newBakeoff.results.find(r => r.slug === 'nonfiction');

test('New nonfiction delta.compositeScore >= -5 (not significantly worse)', () => {
  assert.ok(newNonfiction.delta.compositeScore >= -5,
    `New delta is ${newNonfiction.delta.compositeScore}, expected >= -5`);
});

test('New nonfiction B score >= old nonfiction B score', () => {
  assert.ok(newNonfiction.textureB.compositeScore >= oldNonfiction.textureB.compositeScore,
    `New B score ${newNonfiction.textureB.compositeScore} should be >= old B score ${oldNonfiction.textureB.compositeScore}`);
});

test('New nonfiction B grade is COMPETENT or GOOD or EXCELLENT', () => {
  const acceptable = ['COMPETENT', 'GOOD', 'EXCELLENT'];
  assert.ok(acceptable.includes(newNonfiction.textureB.grade),
    `New B grade is "${newNonfiction.textureB.grade}", expected one of ${acceptable.join(', ')}`);
});

test('Improvement from old approach: new delta is better than old delta', () => {
  // "Better" means closer to 0 or positive — i.e. new delta > old delta
  assert.ok(newNonfiction.delta.compositeScore > oldNonfiction.delta.compositeScore,
    `New delta ${newNonfiction.delta.compositeScore} should be > old delta ${oldNonfiction.delta.compositeScore}`);
});

// ════════════════════════════════════════════════════════════════════════════
section('3. NONFICTION CONTENT PRESERVED');
// ════════════════════════════════════════════════════════════════════════════

const newBPath = join(NEW_DIR, 'nonfiction-version-b.txt');

test('nonfiction-version-b.txt exists in new results', () => {
  assert.ok(existsSync(newBPath), 'nonfiction-version-b.txt should exist in new results dir');
});

const newBText = readFileSync(newBPath, 'utf8');
const newBWords = newBText.split(/\s+/).filter(w => w.length > 0);

test('B text has >= 800 words', () => {
  assert.ok(newBWords.length >= 800,
    `B text has ${newBWords.length} words, expected >= 800`);
});

test('B text contains factual/data-like content (numbers or percentages)', () => {
  const hasNumbers = /\d+/.test(newBText);
  const hasPercentages = /%|\bpercent/i.test(newBText);
  assert.ok(hasNumbers || hasPercentages,
    'Nonfiction B should contain numbers or percentages as factual content');
});

test('B text does not contain fiction artifacts (< 3 instances)', () => {
  const fictionPatterns = /sensory overload|the weight of|she felt|he felt a wave|heart pounded with/gi;
  const matches = newBText.match(fictionPatterns) || [];
  assert.ok(matches.length < 3,
    `Found ${matches.length} fiction artifact(s): ${matches.join(', ')} — expected < 3`);
});

// ════════════════════════════════════════════════════════════════════════════
section('4. CITATION AND REFERENCE INTEGRITY');
// ════════════════════════════════════════════════════════════════════════════

const newAPath = join(NEW_DIR, 'nonfiction-version-a.txt');
const newAText = readFileSync(newAPath, 'utf8');

// Check parenthetical citations: (Something, Year) pattern
const citationPattern = /\([A-Z][a-z]+.*?,\s*\d{4}\)/g;
const aCitations = newAText.match(citationPattern) || [];
const bCitations = newBText.match(citationPattern) || [];

test('If A text has parenthetical citations, B preserves them', () => {
  if (aCitations.length > 0) {
    assert.ok(bCitations.length >= aCitations.length,
      `A has ${aCitations.length} citation(s) but B only has ${bCitations.length}`);
  } else {
    // No citations in A — pass trivially
    assert.ok(true, 'No parenthetical citations in A to preserve');
  }
});

// Check headings (# lines)
const headingPattern = /^#{1,6}\s+.+$/gm;
const aHeadings = newAText.match(headingPattern) || [];
const bHeadings = newBText.match(headingPattern) || [];

test('If A has headings, B has same or more headings', () => {
  if (aHeadings.length > 0) {
    assert.ok(bHeadings.length >= aHeadings.length,
      `A has ${aHeadings.length} heading(s) but B only has ${bHeadings.length}`);
  } else {
    assert.ok(true, 'No headings in A to preserve');
  }
});

// Word count ratio check — B should not invent new claims
const newAWords = newAText.split(/\s+/).filter(w => w.length > 0);
const wordCountRatio = newBWords.length / newAWords.length;

test('B does not invent new claims (word count ratio 0.85 - 1.10)', () => {
  assert.ok(wordCountRatio >= 0.85 && wordCountRatio <= 1.10,
    `Word count ratio is ${wordCountRatio.toFixed(3)} (B=${newBWords.length}, A=${newAWords.length}), expected 0.85–1.10`);
});

// ════════════════════════════════════════════════════════════════════════════
section('5. GENRE PROFILE CORRECT');
// ════════════════════════════════════════════════════════════════════════════

test('New nonfiction result profileKey == "nonfiction"', () => {
  assert.equal(newNonfiction.profileKey, 'nonfiction',
    `profileKey is "${newNonfiction.profileKey}", expected "nonfiction"`);
});

test('New nonfiction recastReport.profileUsed == "nonfiction"', () => {
  assert.equal(newNonfiction.recastReport.profileUsed, 'nonfiction',
    `profileUsed is "${newNonfiction.recastReport.profileUsed}", expected "nonfiction"`);
});

test('Profile is NOT fiction, thriller, or literary', () => {
  const wrong = ['fiction', 'thriller', 'literary'];
  assert.ok(!wrong.includes(newNonfiction.profileKey),
    `profileKey "${newNonfiction.profileKey}" should not be fiction/thriller/literary`);
  assert.ok(!wrong.includes(newNonfiction.recastReport.profileUsed),
    `profileUsed "${newNonfiction.recastReport.profileUsed}" should not be fiction/thriller/literary`);
});

// ════════════════════════════════════════════════════════════════════════════
section('6. NONFICTION CLARITY METRICS');
// ════════════════════════════════════════════════════════════════════════════

const freshB = analyzeProseTexture(newBText);

test('Filter verb density in B <= 5.0/1K (nonfiction should be clean)', () => {
  assert.ok(freshB.filterVerbDensity <= 5.0,
    `Filter verb density is ${freshB.filterVerbDensity}/1K, expected <= 5.0`);
});

test('Thesis statement density <= 2.0/1K', () => {
  assert.ok(freshB.thesisStatementDensity <= 2.0,
    `Thesis statement density is ${freshB.thesisStatementDensity}/1K, expected <= 2.0`);
});

test('Generic emotion density == 0 (nonfiction should have none)', () => {
  assert.equal(freshB.genericEmotionDensity, 0,
    `Generic emotion density is ${freshB.genericEmotionDensity}, expected 0`);
});

// ════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${'='.repeat(64)}`);
console.log(`NONFICTION REGRESSION RESOLUTION TESTS: ${passed} passed, ${failed} failed`);

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
