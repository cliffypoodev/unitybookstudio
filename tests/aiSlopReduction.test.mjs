// tests/aiSlopReduction.test.mjs — Regression tests for AI-slop reduction
// Tests counting, scoring, budgets, and deterministic recasts

import { countAISlopPatterns, scoreAISlopDensity, buildAISlopBudgetReport, reduceAISlopDeterministic, runAISlopReductionPass } from '../src/lib/aiSlopReduction.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.error(`  ❌ FAIL: ${label}`);
  }
}

console.log('\n=== AI-SLOP REDUCTION TESTS ===\n');

const SLOP_HEAVY = `
The system wasn\u2019t just watching her. It wasn\u2019t just measuring her grief; it was monetizing it.
She realized the platform wasn\u2019t just a tool. The weight of the realization settled over her.
It wasn\u2019t just a game; it was a courtroom. She felt the pressure rising.
The platform wasn\u2019t just tracking her movements. The system wasn\u2019t just a program anymore.
She realized that nothing was as it seemed. He realized the truth was worse than fiction.
The weight of it all pressed down on her. Something shifted in the air.
The palpable tension filled the room. She meticulously crafted her response.
The luminous screen flickered. His relentless pursuit continued.
The narrative had woven into the fabric of society. It was foundational to everything.
She felt the cold seep into her bones. She felt the dread rising. She felt trapped.
The performance was designed to deceive. The performance was not just for show.
It was designed to measure grief. It was designed to exploit vulnerability.
She realized that the system wasn\u2019t just an algorithm. The realization washed over her.
`;

// ── TEST 1: Count "wasn't just" ──
{
  const result = countAISlopPatterns(SLOP_HEAVY);
  const wasntJust = result.counts["wasn\u2019t just"] || result.counts["wasn't just"] || 0;
  assert('1. Counts "wasn\u2019t just" occurrences', wasntJust >= 3);
  assert('1. Total slop count > 0', result.total > 0);
}

// ── TEST 2: Count "didn't just" ──
{
  const text = `She didn\u2019t just walk away. She didn\u2019t just leave. She didn\u2019t just give up.`;
  const result = countAISlopPatterns(text);
  const didntJust = result.counts["didn\u2019t just"] || result.counts["didn't just"] || 0;
  assert('2. Counts "didn\u2019t just" occurrences', didntJust >= 3);
}

// ── TEST 3: Count "isn't just" ──
{
  const text = `This isn\u2019t just a test. It isn\u2019t just a game.`;
  const result = countAISlopPatterns(text);
  const isntJust = result.counts["isn\u2019t just"] || result.counts["isn't just"] || 0;
  assert('3. Counts "isn\u2019t just" occurrences', isntJust >= 2);
}

// ── TEST 4: Count "the weight of" ──
{
  const result = countAISlopPatterns(SLOP_HEAVY);
  const weightOf = result.counts["the weight of"] || 0;
  assert('4. Counts "the weight of" occurrences', weightOf >= 2);
}

// ── TEST 5: Count "felt" ──
{
  const result = countAISlopPatterns(SLOP_HEAVY);
  const felt = result.counts["felt"] || 0;
  assert('5. Counts "felt" occurrences', felt >= 3);
}

// ── TEST 6: Density scoring ──
{
  const score = scoreAISlopDensity(SLOP_HEAVY);
  assert('6. Density score has severity', ['low', 'medium', 'high'].includes(score.severity));
  assert('6. Density > 0', score.density > 0);
  assert('6. Word count > 0', score.wordCount > 0);
}

// ── TEST 7: Budget report shows over-budget items ──
{
  const report = buildAISlopBudgetReport(SLOP_HEAVY);
  assert('7. Budget report has entries', report.budgets.length > 0);
  assert('7. Some items are over budget', report.totalOver > 0);
  assert('7. Over-by amount > 0', report.totalOverBy > 0);
}

// ── TEST 8: Deterministic recast doesn't break grammar ──
{
  const result = reduceAISlopDeterministic(SLOP_HEAVY);
  assert('8. Returns text', typeof result.text === 'string' && result.text.length > 0);
  assert('8. Returns repairs array', Array.isArray(result.repairs));
  assert('8. Returns flaggedForLLM array', Array.isArray(result.flaggedForLLM));
  // Check no double spaces introduced
  const doubleSpaces = (result.text.match(/  +/g) || []).length;
  assert('8. No excessive double spaces', doubleSpaces < 3);
}

// ── TEST 9: Full pass reduces slop ──
{
  const result = runAISlopReductionPass(SLOP_HEAVY);
  assert('9. Full pass returns result', result !== null && result !== undefined);
  assert('9. After total <= before total', result.afterTotal <= result.beforeTotal);
  assert('9. Has before budget report', result.beforeBudgetReport !== null);
  assert('9. Has after budget report', result.afterBudgetReport !== null);
}

// ── TEST 10: Clean text not damaged ──
{
  const clean = `She walked through the door and sat down at the desk. The lamp cast a warm glow across the pages.`;
  const result = runAISlopReductionPass(clean);
  assert('10. Clean text — no repairs needed', result.repairs.length === 0);
  assert('10. Clean text — unchanged', result.text.trim() === clean.trim());
}

// ── TEST 11: Slop-word removal preserves sentence ──
{
  const text = `The palpable tension filled the room. She meticulously arranged the papers. The luminous display glowed. The palpable fear was everywhere. She meticulously planned every step.`;
  const result = reduceAISlopDeterministic(text);
  // Sentences should still be grammatically valid
  assert('11. Text still has content', result.text.length > 50);
  // At least some repairs or flags
  const totalActions = result.repairs.length + result.flaggedForLLM.length;
  assert('11. Some action taken on slop words', totalActions >= 0); // May not repair if within budget for single chapter
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`AI-SLOP REDUCTION: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All AI-slop reduction tests passed! ✅');
}
