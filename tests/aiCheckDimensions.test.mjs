// tests/aiCheckDimensions.test.mjs — Behavioral test for deterministic 5-dimension AI scoring
// Validates that buildDimensionReport returns correct structure and deterministic scores.

import assert from 'node:assert';

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST HARNESS
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

const _tests = [];
function test(name, fn) {
  _tests.push({ name, fn });
}
async function runTests() {
  for (const { name, fn } of _tests) {
    try {
      await fn();
      passed++;
      console.log('  ✅ ' + name);
    } catch (e) {
      failed++;
      failures.push(name);
      console.error('  ❌ ' + name + ': ' + e.message);
    }
  }
}

console.log('\n=== AI CHECK DIMENSIONS — BEHAVIORAL TESTS ===\n');

/* ═══════════════════════════════════════════════════════════════════════════
 * MODULE IMPORT
 * ═════════════════════════════════════════════════════════════════════════ */

let buildDimensionReport, DIMENSION_WEIGHTS;

try {
  const mod = await import('../src/lib/aiCheckDimensions.js');
  buildDimensionReport = mod.buildDimensionReport;
  DIMENSION_WEIGHTS = mod.DIMENSION_WEIGHTS;
  console.log('  ✅ Module imports successfully');
  passed++;
} catch (e) {
  console.error('  ❌ Module import failed:', e.message);
  failed++;
  failures.push('Module import');
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST DATA — clearly AI-sounding vs. clearly human prose
 * ═════════════════════════════════════════════════════════════════════════ */

// AI-sounding text: uniform sentence lengths, AI vocabulary, overused transitions
const AI_TEXT = `
However, the tapestry of human experience is profoundly nuanced. Moreover, it underscores the multifaceted nature of our shared landscape. Furthermore, this pivotal moment represents the quintessential culmination of years of commendable effort. Additionally, the intricacies of modern society demand a more delicate approach.

Nevertheless, the vibrant testament to innovation speaks volumes. Consequently, we must embark on a journey of discovery that is both meaningful and transformative. Specifically, the renowned scholars have identified patterns that are significant and noteworthy. Ultimately, this serves as a beacon of hope.

However, the nuanced perspective reveals layers of complexity. Moreover, the multifaceted approach taken by leaders has been commendable. Furthermore, these pivotal developments underscore the importance of vigilance. Additionally, the tapestry of culture weaves together disparate threads.

Nevertheless, the landscape continues to evolve in meaningful ways. Consequently, we must delve deeper into the intricacies of this phenomenon. Specifically, the culmination of these efforts yields remarkable results. Ultimately, this quintessential transformation speaks to the human spirit.

However, the vibrant community stands as a testament to perseverance. Moreover, the renowned institutions have championed innovation. Furthermore, this pivotal era underscores the need for collaboration. Additionally, the nuanced understanding of complex systems is commendable.
`.trim();

// Human-sounding text: varied sentence lengths, natural vocabulary, no AI transitions
const HUMAN_TEXT = `
She yanked the door open. Behind it: nothing but cold air and the smell of damp concrete. Three floors down, someone was whistling—off-key, tuneless, the kind of sound that made you want to cover your ears.

"You sure about this?" Marco asked. He didn't wait for an answer. He never did.

Rain hammered the tin roof. A gust shoved wet leaves against the window, and for a second it sounded like fingers tapping. She flinched. Stupid. Just the wind.

The coffee had gone cold hours ago but she drank it anyway, bitter and gritty, because sitting still wasn't an option. Her knee bounced. The fluorescent light buzzed overhead—one of the tubes was dying, flickering every few seconds in a way that made the shadows jump.

Marco came back with two sandwiches wrapped in wax paper. Turkey and Swiss, no mustard. He remembered. "Eat," he said. That was it. That was all he said.

Down in the parking lot, a car alarm went off. Then stopped. Then started again. She closed her eyes and counted backwards from twenty. When she opened them, he was watching her with that look—half worried, half annoyed.

"I'm fine," she said.

He unwrapped his sandwich. "Yeah. Sure you are."
`.trim();

/* ═══════════════════════════════════════════════════════════════════════════
 * TESTS
 * ═════════════════════════════════════════════════════════════════════════ */

test('buildDimensionReport exists and is a function', () => {
  assert.strictEqual(typeof buildDimensionReport, 'function');
});

test('DIMENSION_WEIGHTS exists with 5 entries', () => {
  assert.ok(DIMENSION_WEIGHTS, 'DIMENSION_WEIGHTS should be defined');
  assert.strictEqual(Object.keys(DIMENSION_WEIGHTS).length, 5);
});

test('returns empty result for short text', () => {
  const result = buildDimensionReport('too short');
  assert.deepStrictEqual(result.dimensions, []);
  assert.strictEqual(result.compositeScore, 0);
});

test('returns empty result for null/undefined', () => {
  const r1 = buildDimensionReport(null);
  assert.strictEqual(r1.compositeScore, 0);
  const r2 = buildDimensionReport(undefined);
  assert.strictEqual(r2.compositeScore, 0);
  const r3 = buildDimensionReport('');
  assert.strictEqual(r3.compositeScore, 0);
});

test('returns 5 dimensions for valid text', () => {
  const result = buildDimensionReport(AI_TEXT);
  assert.strictEqual(result.dimensions.length, 5, `Expected 5 dimensions, got ${result.dimensions.length}`);
});

test('each dimension has required fields', () => {
  const result = buildDimensionReport(AI_TEXT);
  for (const dim of result.dimensions) {
    assert.ok(dim.key, 'key is required');
    assert.ok(dim.label, 'label is required');
    assert.ok(dim.detail, 'detail is required');
    assert.strictEqual(typeof dim.score, 'number', 'score must be a number');
    assert.ok(dim.score >= 0 && dim.score <= 100, `score ${dim.score} must be 0-100`);
  }
});

test('compositeScore is between 0 and 100', () => {
  const r1 = buildDimensionReport(AI_TEXT);
  assert.ok(r1.compositeScore >= 0 && r1.compositeScore <= 100,
    `AI compositeScore ${r1.compositeScore} out of range`);

  const r2 = buildDimensionReport(HUMAN_TEXT);
  assert.ok(r2.compositeScore >= 0 && r2.compositeScore <= 100,
    `Human compositeScore ${r2.compositeScore} out of range`);
});

test('AI text scores higher than human text (composite)', () => {
  const ai = buildDimensionReport(AI_TEXT);
  const human = buildDimensionReport(HUMAN_TEXT);

  console.log(`    AI composite: ${ai.compositeScore}, Human composite: ${human.compositeScore}`);
  assert.ok(ai.compositeScore > human.compositeScore,
    `AI (${ai.compositeScore}) should score higher than human (${human.compositeScore})`);
});

test('AI text scores higher on Transition Overuse dimension', () => {
  const ai = buildDimensionReport(AI_TEXT);
  const human = buildDimensionReport(HUMAN_TEXT);

  const aiTrans = ai.dimensions.find(d => d.key === 'transitionOveruse');
  const humanTrans = human.dimensions.find(d => d.key === 'transitionOveruse');

  assert.ok(aiTrans, 'AI should have transitionOveruse dimension');
  assert.ok(humanTrans, 'Human should have transitionOveruse dimension');
  console.log(`    AI transitions: ${aiTrans.score}, Human transitions: ${humanTrans.score}`);
  assert.ok(aiTrans.score > humanTrans.score,
    `AI transition (${aiTrans.score}) should exceed human (${humanTrans.score})`);
});

test('AI text scores higher on Vocabulary Soup dimension', () => {
  const ai = buildDimensionReport(AI_TEXT);
  const human = buildDimensionReport(HUMAN_TEXT);

  const aiVocab = ai.dimensions.find(d => d.key === 'vocabSoup');
  const humanVocab = human.dimensions.find(d => d.key === 'vocabSoup');

  console.log(`    AI vocab soup: ${aiVocab.score}, Human vocab soup: ${humanVocab.score}`);
  assert.ok(aiVocab.score > humanVocab.score,
    `AI vocab (${aiVocab.score}) should exceed human (${humanVocab.score})`);
});

test('results are deterministic (same input → same output)', () => {
  const r1 = buildDimensionReport(AI_TEXT);
  const r2 = buildDimensionReport(AI_TEXT);

  assert.strictEqual(r1.compositeScore, r2.compositeScore, 'Composite must be deterministic');
  for (let i = 0; i < r1.dimensions.length; i++) {
    assert.strictEqual(r1.dimensions[i].score, r2.dimensions[i].score,
      `Dimension ${r1.dimensions[i].key} must be deterministic`);
  }
});

test('dimension keys match expected set', () => {
  const result = buildDimensionReport(AI_TEXT);
  const keys = result.dimensions.map(d => d.key).sort();
  const expected = ['rhythmRigidity', 'slopDensity', 'structuralMonotony', 'transitionOveruse', 'vocabSoup'];
  assert.deepStrictEqual(keys, expected);
});

test('wordCount is returned correctly', () => {
  const result = buildDimensionReport(AI_TEXT);
  assert.ok(result.wordCount > 0, 'wordCount should be positive');
  assert.strictEqual(typeof result.wordCount, 'number');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * RUN
 * ═════════════════════════════════════════════════════════════════════════ */

await runTests();

console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
if (failures.length) {
  console.log('Failures:', failures.join(', '));
}
process.exit(failed > 0 ? 1 : 0);
