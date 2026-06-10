// prosePolisherQualityGate.test.mjs
// Run: node tests/prosePolisherQualityGate.test.mjs

import assert from 'node:assert';
import {
  runProsePolishQualityGate,
  runDeterministicGrammarRepair,
  repairMissingOpeningQuotes,
} from '../src/lib/prosePolishQualityGate.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

console.log('\n═══ Prose Polish Quality Gate Tests ═══\n');

// ── 1. "She were carrying" is detected as malformed ──
test('1. "She were carrying" is detected as malformed', () => {
  const result = runProsePolishQualityGate('She were carrying a heavy load.');
  assert.ok(result.malformed.count > 0, 'should detect malformed grammar');
  assert.strictEqual(result.malformed.matches[0].pattern, 'she-were');
});

// ── 2. "as if she were performing" is NOT detected (subjunctive) ──
test('2. "as if she were performing" is NOT detected (subjunctive)', () => {
  const result = runProsePolishQualityGate(
    'She moved as if she were performing an ancient ritual.'
  );
  assert.strictEqual(result.malformed.count, 0, 'subjunctive should not flag');
});

// ── 3. "Was was it a failure?" is detected and repaired ──
test('3. "Was was it a failure?" is detected and repaired', () => {
  const gate = runProsePolishQualityGate('Was was it a failure?');
  assert.ok(gate.malformed.count > 0, 'should detect "Was was"');

  const repair = runDeterministicGrammarRepair('Was was it a failure?');
  assert.ok(repair.text.includes('Was it a failure'), 'should repair to "Was it a failure"');
  assert.ok(!repair.text.includes('Was was'), 'double "Was was" should be gone');
});

// ── 4. "They was running" is detected and repaired ──
test('4. "They was running" is detected and repaired to "They were running"', () => {
  const gate = runProsePolishQualityGate('They was running fast.');
  assert.ok(gate.malformed.count > 0);

  const repair = runDeterministicGrammarRepair('They was running fast.');
  assert.ok(repair.text.includes('They were running'));
});

// ── 5. "a obvious" is detected and repaired ──
test('5. "a obvious" is detected and repaired to "an obvious"', () => {
  const gate = runProsePolishQualityGate('It was a obvious thing to do.');
  assert.ok(gate.malformed.count > 0);

  const repair = runDeterministicGrammarRepair('It was a obvious thing to do.');
  assert.ok(repair.text.includes('an obvious'));
});

// ── 6. Clean prose passes (ok=true, PASS) ──
test('6. Clean prose passes (ok=true, PASS)', () => {
  const text =
    'The sun set behind the mountains. She walked through the garden, ' +
    'her eyes scanning the horizon.';
  const result = runProsePolishQualityGate(text);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.recommendedAction, 'PASS');
});

// ── 7. "wasn't just" is counted as slop ──
test('7. "wasn\\u2019t just" is counted as slop', () => {
  const result = runProsePolishQualityGate('It wasn\u2019t just a game.');
  assert.ok(result.slopCounts.total > 0);
  assert.ok(result.slopCounts.perPattern["wasn\u2019t just"] > 0);
});

// ── 8. "didn't just" is counted as slop ──
test('8. "didn\\u2019t just" is counted as slop', () => {
  const result = runProsePolishQualityGate('She didn\u2019t just walk away.');
  assert.ok(result.slopCounts.total > 0);
  assert.ok(result.slopCounts.perPattern["didn\u2019t just"] > 0);
});

// ── 9. "not just" is counted as slop ──
test('9. "not just" is counted as slop', () => {
  const result = runProsePolishQualityGate('It was not just a theory.');
  assert.ok(result.slopCounts.total > 0);
  assert.ok(result.slopCounts.perPattern['not just'] > 0);
});

// ── 10. Slop-free text returns slopCounts.total = 0 ──
test('10. Slop-free text returns slopCounts.total = 0', () => {
  const text = 'The dog barked at the moon. Rain fell softly on the tin roof.';
  const result = runProsePolishQualityGate(text);
  assert.strictEqual(result.slopCounts.total, 0);
});

// ── 11. Multiple malformed → BLOCK_POLISH_SAVE ──
test('11. Multiple malformed → BLOCK_POLISH_SAVE', () => {
  const text = 'She were running. They was hiding. Was was it over?';
  const result = runProsePolishQualityGate(text);
  assert.ok(result.malformed.count >= 3);
  assert.strictEqual(result.recommendedAction, 'BLOCK_POLISH_SAVE');
  assert.strictEqual(result.ok, false);
});

// ── 12. Quote issues detected ──
test('12. Quote issues detected (missing opening quote)', () => {
  const text =
    'filled with dread.\u201d The game is the model, Marcus,\u201d she retorted sharply.';
  const result = runProsePolishQualityGate(text);
  assert.ok(result.quoteIssues.count > 0, 'should detect missing opening quote');
});

// ── 13. Grammar repair doesn't break clean text ──
test('13. Grammar repair doesn\u2019t break clean text', () => {
  const clean = 'She was tired. He was resting. They were gone.';
  const repair = runDeterministicGrammarRepair(clean);
  assert.strictEqual(repair.text, clean, 'clean text should be unchanged');
  assert.strictEqual(repair.repairs.length, 0, 'no repairs on clean text');
});

// ── 14. "He were an exhibit" is detected (not subjunctive) ──
test('14. "He were an exhibit" is detected (not subjunctive)', () => {
  const result = runProsePolishQualityGate('He were an exhibit in the museum.');
  assert.ok(result.malformed.count > 0);
  assert.strictEqual(result.malformed.matches[0].pattern, 'he-were');
});

// ── 15. "as if he were an exhibit" is NOT detected (subjunctive) ──
test('15. "as if he were an exhibit" is NOT detected (subjunctive)', () => {
  const result = runProsePolishQualityGate(
    'He stood as if he were an exhibit himself.'
  );
  assert.strictEqual(result.malformed.count, 0);
});

// ── Summary ──
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
