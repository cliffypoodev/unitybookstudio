// tests/dialogueMechanicsRepair.test.mjs — Regression tests for dialogue mechanics repair
// Tests the detectDialogueQuoteIssues and repairMissingDialogueOpeners functions

import { detectDialogueQuoteIssues, repairMissingDialogueOpeners, runDialogueMechanicsPass } from '../src/lib/dialogueMechanicsRepair.js';

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

console.log('\n=== DIALOGUE MECHANICS REPAIR TESTS ===\n');

// ── TEST 1: Detect and repair "The game is the model, Marcus," she retorted ──
{
  const text = `Her eyes held a cold dread.\u201d The game is the model, Marcus,\u201d she retorted, her voice sharp.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('1. "The game is the model, Marcus," she retorted — detected', result.beforeCount > 0);
  assert('1. "The game is the model, Marcus," she retorted — repaired', result.repairs.length > 0);
  assert('1. After repair, issue count reduced', result.afterCount < result.beforeCount);
}

// ── TEST 2: Detect and repair "And I thrive on efficiency," he countered ──
{
  const text = `Something bad.\u201d And I thrive on efficiency,\u201d he countered instantly.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('2. "And I thrive on efficiency," he countered — detected', result.beforeCount > 0);
  assert('2. "And I thrive on efficiency," he countered — repaired', result.repairs.length > 0);
}

// ── TEST 3: Detect and repair "No," she said ──
{
  const text = `No,\u201d she said immediately.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('3. "No," she said — detected', result.beforeCount > 0);
  assert('3. "No," she said — repaired with opening quote', result.text.includes('\u201c'));
}

// ── TEST 4: Detect and repair "Exactly," Elena said ──
{
  const text = `Exactly,\u201d Elena said firmly.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('4. "Exactly," Elena said — detected', result.beforeCount > 0);
  assert('4. "Exactly," Elena said — repaired', result.repairs.length > 0);
}

// ── TEST 5: Detect and repair "Necessary," Elena repeated ──
{
  const text = `The mandate was clear.\u201d Necessary,\u201d Elena repeated, tasting the word.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('5. "Necessary," Elena repeated — detected', result.beforeCount > 0);
  assert('5. "Necessary," Elena repeated — repaired', result.repairs.length > 0);
}

// ── TEST 6: Detect and repair "It hides your sister," Aether replied ──
{
  const text = `The question hung.\u201d It hides your sister,\u201d Aether replied gently.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('6. "It hides your sister," Aether replied — detected', result.beforeCount > 0);
  assert('6. "It hides your sister," Aether replied — repaired', result.repairs.length > 0);
}

// ── TEST 7: Clean quoted dialogue remains unchanged ──
{
  const text = `\u201cThis is properly quoted,\u201d she said. \u201cAnd so is this,\u201d he replied.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('7. Clean quoted dialogue — no issues detected', result.beforeCount === 0);
  assert('7. Clean quoted dialogue — text unchanged', result.text === text);
}

// ── TEST 8: Apostrophes are preserved ──
{
  const text = `He didn\u2019t want to go. She couldn\u2019t believe it. They won\u2019t stop.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('8. Apostrophes preserved — no issues detected', result.beforeCount === 0);
  assert('8. Apostrophes preserved — text unchanged', result.text === text);
  assert('8. Apostrophes still present', result.text.includes('\u2019'));
}

// ── TEST 9: Quoted labels/system terms not damaged ──
{
  const text = `The system displayed "ERROR_CODE_42" on screen. The label read "CAUTION" in bold letters.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('9. System labels — not damaged', result.text.includes('ERROR_CODE_42'));
  assert('9. System labels — CAUTION preserved', result.text.includes('CAUTION'));
}

// ── TEST 10: Straight quote variants ──
{
  const text = `No," she said immediately.`;
  const result = runDialogueMechanicsPass(text, {});
  assert('10. Straight quote variant — detected', result.beforeCount > 0);
}

// ── TEST 11: Mid-paragraph after narration ──
{
  const text = `She paused, considering the implications. Precisely,\u201d the system confirmed. \u201cAn interesting development.\u201d`;
  const result = runDialogueMechanicsPass(text, {});
  assert('11. Mid-paragraph — detected after narration', result.beforeCount > 0);
  assert('11. Mid-paragraph — repaired', result.repairs.length > 0);
}

// ── SUMMARY ──
console.log(`\n${'═'.repeat(60)}`);
console.log(`DIALOGUE MECHANICS REPAIR: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(60)}`);
if (failed > 0) {
  console.log('Failures:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('All dialogue mechanics repair tests passed! ✅');
}
