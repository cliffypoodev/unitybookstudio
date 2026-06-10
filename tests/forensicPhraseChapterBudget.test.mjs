// tests/forensicPhraseChapterBudget.test.mjs
// Verifies forensic phrase budgets: budget=1, per-chapter, grammatical recasts, varied outputs

import { reduceAISlopDeterministic, buildAISlopBudgetReport } from '../src/lib/aiSlopReduction.js';

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

console.log('\n=== FORENSIC PHRASE CHAPTER BUDGET TESTS ===\n');

// ── TEST 1: 3x 'the available accounts indicate' reduced to 1 ──
console.log('── Test 1: 3x "the available accounts indicate" → 1 ──');
{
  const text = [
    'The available accounts indicate that the fire started at dawn.',
    'Furthermore, the available accounts indicate a second blaze by noon.',
    'Finally, the available accounts indicate the town was evacuated.',
  ].join(' ');

  const result = reduceAISlopDeterministic(text);
  const remaining = (result.text.match(/the available accounts indicate/gi) || []).length;
  assert('1a. At most 1 "the available accounts indicate" remains', remaining <= 1);
  assert('1b. At least 1 remains (within budget)', remaining >= 1);
  assert('1c. Repairs were applied', result.repairs.length >= 2);

  // Verify repairs have non-empty replacements
  for (const r of result.repairs) {
    assert(`1d. Repair "${r.original}" → non-empty "${r.replacement}"`, r.replacement.length > 0);
  }
}

// ── TEST 2: Budget is per-chapter (separate calls both allow 1) ──
console.log('\n── Test 2: Per-chapter budgets ──');
{
  const chapter1 = [
    'The available accounts indicate the bridge collapsed.',
    'Also, the available accounts indicate flood damage.',
    'The available accounts indicate total loss.',
  ].join(' ');

  const chapter2 = [
    'The available accounts indicate the treaty was signed.',
    'The available accounts indicate both parties agreed.',
    'The available accounts indicate celebrations followed.',
  ].join(' ');

  const result1 = reduceAISlopDeterministic(chapter1);
  const result2 = reduceAISlopDeterministic(chapter2);

  const remaining1 = (result1.text.match(/the available accounts indicate/gi) || []).length;
  const remaining2 = (result2.text.match(/the available accounts indicate/gi) || []).length;

  assert('2a. Chapter 1 has exactly 1 remaining', remaining1 === 1);
  assert('2b. Chapter 2 has exactly 1 remaining', remaining2 === 1);
  assert('2c. Both chapters independently allow 1', remaining1 === 1 && remaining2 === 1);
}

// ── TEST 3: Recasts are grammatically valid ──
console.log('\n── Test 3: Grammatical validity of recasts ──');
{
  const forensicPhrases = [
    { phrase: 'the available accounts indicate', text: 'The available accounts indicate the fire started. The available accounts indicate the wind shifted. The available accounts indicate everyone fled.' },
    { phrase: 'the available accounts suggest',  text: 'The available accounts suggest a conspiracy. The available accounts suggest hidden motives. The available accounts suggest corruption.' },
    { phrase: 'what remains unclear is',         text: 'What remains unclear is the motive. What remains unclear is the timeline. What remains unclear is the cause.' },
    { phrase: 'the record shows',                text: 'The record shows a payment. The record shows a transfer. The record shows a discrepancy.' },
    { phrase: 'the surviving record shows',      text: 'The surviving record shows a siege. The surviving record shows heavy losses. The surviving record shows a surrender.' },
  ];

  for (const { phrase, text } of forensicPhrases) {
    const result = reduceAISlopDeterministic(text);
    // Text should still be non-empty
    assert(`3a. "${phrase}" output is non-empty`, result.text.trim().length > 20);

    // Sentences should end with punctuation
    const sentences = result.text.split(/[.!?]/).filter(s => s.trim().length > 0);
    assert(`3b. "${phrase}" sentences still present (${sentences.length})`, sentences.length >= 2);

    // No double spaces or dangling punctuation
    const doubleSpaces = (result.text.match(/  +/g) || []).length;
    assert(`3c. "${phrase}" no double spaces`, doubleSpaces === 0);
  }
}

// ── TEST 4: Recasts vary across occurrences ──
console.log('\n── Test 4: Recast variation ──');
{
  // Use 4 occurrences to allow checking cycling
  const text = [
    'The available accounts indicate the siege began.',
    'The available accounts indicate reinforcements arrived.',
    'The available accounts indicate surrender followed.',
    'The available accounts indicate peace was restored.',
  ].join(' ');

  const result = reduceAISlopDeterministic(text);

  // Should have at least 3 repairs (4 occurrences - 1 budget = 3 excess)
  const forensicRepairs = result.repairs.filter(r => r.pattern === 'the available accounts indicate');
  assert('4a. At least 3 forensic repairs', forensicRepairs.length >= 3);

  // Check that replacements are not all the same
  if (forensicRepairs.length >= 2) {
    const uniqueReplacements = new Set(forensicRepairs.map(r => r.replacement.toLowerCase()));
    assert(`4b. Varied recasts (${uniqueReplacements.size} unique replacements)`, uniqueReplacements.size >= 2);
  }
}

// ── TEST 5: Budget report detects forensic phrase over-budget ──
console.log('\n── Test 5: Budget report detection ──');
{
  const text = 'The record shows a crime. The record shows a motive. The record shows a weapon.';
  const report = buildAISlopBudgetReport(text);

  const recordEntry = report.budgets.find(b => b.name === 'the record shows');
  assert('5a. Budget report includes "the record shows"', !!recordEntry);
  if (recordEntry) {
    assert('5b. Actual count = 3', recordEntry.actual === 3);
    assert('5c. Budget = 1', recordEntry.budget === 1);
    assert('5d. Over budget', recordEntry.over === true);
    assert('5e. Over by 2', recordEntry.overBy === 2);
  }
}

// ── TEST 6: Single occurrence stays untouched (within budget) ──
console.log('\n── Test 6: Single occurrence within budget ──');
{
  const text = 'The available accounts indicate the king was deposed. Life went on.';
  const result = reduceAISlopDeterministic(text);
  assert('6a. No repairs needed', result.repairs.length === 0);
  assert('6b. Text unchanged', result.text.trim() === text.trim());
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`FORENSIC PHRASE BUDGET: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All forensic phrase budget tests passed! ✅');
}
