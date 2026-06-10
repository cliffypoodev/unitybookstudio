// digitalEquityPolishRegression.mjs
// Regression tests using real snippets from the Digital Equity v5 DOCX.
// Run: node tests/digitalEquityPolishRegression.mjs

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
    console.log(`  \u2705 ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \u274c ${name}`);
    console.log(`     ${e.message}`);
  }
}

console.log('\n\u2550\u2550\u2550 Digital Equity Polish Regression Tests \u2550\u2550\u2550\n');

// ── 1. Ch5: "She were carrying" ──
test('1. Ch5: "She were carrying an inheritance" → malformed detected', () => {
  const snippet =
    'gnawing weight in her chest. She were carrying an inheritance she had never asked for.';
  const result = runProsePolishQualityGate(snippet);
  assert.ok(result.malformed.count > 0, 'should detect "She were"');
  assert.strictEqual(result.malformed.matches[0].pattern, 'she-were');
});

// ── 2. Ch5: "She was it monopolistic practice" ──
test('2. Ch5: "She was it monopolistic practice" → malformed detected', () => {
  const snippet =
    'good at selling scarcity? She was it monopolistic practice or genuine concern?';
  const result = runProsePolishQualityGate(snippet);
  assert.ok(result.malformed.count > 0, 'should detect "She was it"');
  assert.strictEqual(result.malformed.matches[0].pattern, 'she-was-it');
});

// ── 3. Ch6: "She were those just metrics?" ──
test('3. Ch6: "She were those just metrics?" → malformed detected', () => {
  const snippet =
    'rhythm of their shared routine. She were those just metrics? Or something more?';
  const result = runProsePolishQualityGate(snippet);
  assert.ok(result.malformed.count > 0, 'should detect "She were"');
});

// ── 4. Ch6: "Was was it a failure" → repair ──
test('4. Ch6: "Was was it a failure" → detected and repaired', () => {
  const snippet =
    'Why did she disappear? Was was it a failure, or was it something more deliberate?';
  const gate = runProsePolishQualityGate(snippet);
  assert.ok(gate.malformed.count > 0, 'detect "Was was"');

  const repair = runDeterministicGrammarRepair(snippet);
  assert.ok(repair.text.includes('Was it a failure'), 'repaired to "Was it a failure"');
  assert.ok(!repair.text.includes('Was was'), '"Was was" should be removed');
});

// ── 5. Ch6: "a obvious thing" → repair ──
test('5. Ch6: "a obvious thing" → detected and repaired', () => {
  const snippet =
    'no longer a void of sound, but a obvious thing that demanded attention.';
  const gate = runProsePolishQualityGate(snippet);
  assert.ok(gate.malformed.count > 0, 'detect "a obvious"');

  const repair = runDeterministicGrammarRepair(snippet);
  assert.ok(repair.text.includes('an obvious'), 'repaired to "an obvious"');
});

// ── 6. Ch10: "as if she were performing" → NOT malformed (subjunctive) ──
test('6. Ch10: "as if she were performing" → NOT malformed (subjunctive)', () => {
  const snippet =
    'almost ritualistic, as if she were performing an ancient ceremony of renewal.';
  const result = runProsePolishQualityGate(snippet);
  assert.strictEqual(result.malformed.count, 0, 'subjunctive should not flag');
});

// ── 7. Ch13: "as if he were setting" → NOT malformed (subjunctive) ──
test('7. Ch13: "as if he were setting himself up" → NOT malformed (subjunctive)', () => {
  const snippet =
    'mahogany table as if he were setting himself up for a performance.';
  const result = runProsePolishQualityGate(snippet);
  assert.strictEqual(result.malformed.count, 0, 'subjunctive should not flag');
});

// ── 8. Ch13: "Was was it external fraud" → repair ──
test('8. Ch13: "Was was it external fraud" → detected and repaired', () => {
  const snippet =
    'data set being corrupted? Was was it external fraud, or an inside failure?';
  const gate = runProsePolishQualityGate(snippet);
  assert.ok(gate.malformed.count > 0);

  const repair = runDeterministicGrammarRepair(snippet);
  assert.ok(repair.text.includes('Was it external fraud'));
  assert.ok(!repair.text.includes('Was was'));
});

// ── 9. Ch19: "as if he were an exhibit" → NOT malformed (subjunctive) ──
test('9. Ch19: "as if he were an exhibit himself" → NOT malformed (subjunctive)', () => {
  const snippet = 'positioned as if he were an exhibit himself, frozen in time.';
  const result = runProsePolishQualityGate(snippet);
  assert.strictEqual(result.malformed.count, 0);
});

// ── 10. Post-gate: malformed → ok=false, BLOCK_POLISH_SAVE ──
test('10. Post-gate: chapters with malformed grammar → ok=false, BLOCK_POLISH_SAVE', () => {
  const chapterText =
    'She were carrying something heavy. ' +
    'They was uncertain about the outcome. ' +
    'Was was it intentional? The rest of the chapter is fine prose that goes on for a while.';
  const result = runProsePolishQualityGate(chapterText);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.recommendedAction, 'BLOCK_POLISH_SAVE');
});

// ── 11. Post-gate: clean chapter → ok=true ──
test('11. Post-gate: chapter without malformed grammar → ok=true', () => {
  const chapterText =
    'She walked through the corridor, her footsteps echoing softly. ' +
    'The morning sun cast long shadows across the marble floor. ' +
    'He sat at the desk, reviewing the documents with careful attention.';
  const result = runProsePolishQualityGate(chapterText);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.recommendedAction, 'PASS');
});

// ── 12. Missing opening quote: "The game is the model, Marcus," ──
test('12. Missing opening quote: "The game is the model, Marcus,\\u201d" → detected', () => {
  const snippet =
    'filled with dread.\u201d The game is the model, Marcus,\u201d she retorted sharply.';
  const result = runProsePolishQualityGate(snippet);
  assert.ok(result.quoteIssues.count > 0, 'should detect missing opening quote');

  const repair = repairMissingOpeningQuotes(snippet);
  assert.ok(repair.repairs.length > 0, 'should have at least one repair');
  assert.ok(
    repair.text.includes('\u201cThe game is the model'),
    'should insert opening quote'
  );
});

// ── 13. Missing opening quote: "Adrenaline is just chemical…" ──
test('13. Missing opening quote: "Adrenaline is just chemical…\\u201d" → detected', () => {
  const snippet =
    'adrenaline.\u201d Adrenaline is just chemical energy expenditure rate variance,\u201d Marcus corrected gently.';
  const result = runProsePolishQualityGate(snippet);
  assert.ok(result.quoteIssues.count > 0, 'should detect missing opening quote');

  const repair = repairMissingOpeningQuotes(snippet);
  assert.ok(repair.repairs.length > 0);
  assert.ok(
    repair.text.includes('\u201cAdrenaline is just'),
    'should insert opening quote before "Adrenaline"'
  );
});

// ── Summary ──
console.log(
  `\n\u2550\u2550\u2550 Results: ${passed} passed, ${failed} failed \u2550\u2550\u2550\n`
);
process.exit(failed > 0 ? 1 : 0);
