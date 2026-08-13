// DIALOGUEMECHANICS-1 acceptance.
//
// WAVE9-TESTPROMOTE: this lived at src/lib/dialogueMechanicsRepair.test.js — 27
// real assertions against a module that IS live (exportSafetyGate and
// surgicalFix both import it at export time), sitting in the source tree where
// no runner ever looked at it. It passed, and had been passing unobserved.
// Moved into the suite and given the house summary line so a regression in
// dialogue-quote repair fails the batteries instead of nobody.
import {
  detectDialogueQuoteIssues,
  repairMissingDialogueOpeners,
  runDialogueMechanicsPass,
  VERSION,
} from '../src/lib/dialogueMechanicsRepair.js';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
let passed = 0;
let failures = 0;

function assert(condition, label, detail) {
  if (condition) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}`);
    if (detail) console.log(`      ${detail}`);
    failures += 1;
  }
}

console.log('\n=== dialogueMechanicsRepair.js Test Suite ===\n');
console.log(`VERSION: ${VERSION}\n`);

// ─── Detection Tests ─────────────────────────────────────────────────────────

console.log('--- Detection Tests ---');

// Should detect:
const detectCases = [
  { input: 'The game is the model, Marcus,\u201d she retorted', desc: 'curly close, mid-para' },
  { input: 'And I thrive on efficiency,\u201d he countered', desc: 'curly close, para start' },
  { input: 'No,\u201d she countered', desc: 'short speech, para start' },
  { input: 'Precisely,\u201d the system confirmed', desc: '"the system" speaker' },
  { input: 'It hides your sister,\u201d Aether replied', desc: 'named speaker Aether' },
  { input: 'Necessary,\u201d Elena repeated', desc: 'named speaker Elena' },
  { input: 'No," she countered', desc: 'straight quote, para start' },
  { input: 'Exactly," Elena said', desc: 'straight quote, named speaker' },
];

for (const tc of detectCases) {
  const result = detectDialogueQuoteIssues(tc.input);
  assert(result.count > 0, `Detect: "${tc.desc}" → found ${result.count} issue(s)`,
    result.count === 0 ? `Input: ${tc.input}` : undefined);
}

// Should NOT detect:
const noDetectCases = [
  { input: '\u201cThis is properly quoted,\u201d she said', desc: 'already has opener (curly)' },
  { input: '"This is properly quoted," she said', desc: 'already has opener (straight)' },
  { input: 'He didn\u2019t want to go.', desc: 'apostrophe, not dialogue' },
  { input: 'The weather was cold. She walked home.', desc: 'plain narration' },
];

for (const tc of noDetectCases) {
  const result = detectDialogueQuoteIssues(tc.input);
  assert(result.count === 0, `No-detect: "${tc.desc}" → found ${result.count}`,
    result.count > 0 ? `Input: ${tc.input}\nIssues: ${JSON.stringify(result.issues)}` : undefined);
}

// ─── Repair Tests ────────────────────────────────────────────────────────────

console.log('\n--- Repair Tests ---');

const repairCases = [
  {
    input: 'No,\u201d she countered',
    expected: '\u201cNo,\u201d she countered',
    desc: 'short para start (curly)',
  },
  {
    input: 'The game is the model, Marcus,\u201d she retorted',
    expectedContains: '\u201c',
    desc: 'mid-para curly repair inserts \u201c',
  },
  {
    input: 'And I thrive on efficiency,\u201d he countered',
    expectedContains: '\u201c',
    desc: 'para start curly repair inserts \u201c',
  },
  {
    input: 'Precisely,\u201d the system confirmed',
    expected: '\u201cPrecisely,\u201d the system confirmed',
    desc: 'the system speaker repair',
  },
  {
    input: 'It hides your sister,\u201d Aether replied',
    expectedContains: '\u201c',
    desc: 'named speaker Aether repair',
  },
  {
    input: 'Necessary,\u201d Elena repeated',
    expected: '\u201cNecessary,\u201d Elena repeated',
    desc: 'named speaker Elena repair',
  },
  {
    input: 'No," she countered',
    expected: '"No," she countered',
    desc: 'straight quote repair preserves straight style',
  },
];

for (const tc of repairCases) {
  const result = repairMissingDialogueOpeners(tc.input);
  if (tc.expected) {
    assert(result.text.trim() === tc.expected, `Repair: "${tc.desc}"`,
      `Expected: ${tc.expected}\n      Got:      ${result.text.trim()}`);
  } else if (tc.expectedContains) {
    assert(result.text.includes(tc.expectedContains), `Repair: "${tc.desc}" contains ${tc.expectedContains}`,
      `Got: ${result.text.trim()}`);
  }
}

// Should NOT repair (already correct):
const noRepairCases = [
  { input: '\u201cThis is properly quoted,\u201d she said', desc: 'already correct (curly)' },
  { input: 'He didn\u2019t want to go.', desc: 'apostrophe, not dialogue' },
];

for (const tc of noRepairCases) {
  const result = repairMissingDialogueOpeners(tc.input);
  assert(result.repairs.length === 0, `No-repair: "${tc.desc}" → ${result.repairs.length} repairs`,
    result.repairs.length > 0 ? `Repairs: ${JSON.stringify(result.repairs)}` : undefined);
  assert(result.text.trim() === tc.input.trim(), `No-repair: text unchanged for "${tc.desc}"`,
    result.text.trim() !== tc.input.trim() ? `Expected: ${tc.input}\n      Got:      ${result.text.trim()}` : undefined);
}

// ─── Orchestration Test ──────────────────────────────────────────────────────

console.log('\n--- Orchestration Test ---');

const multiLine = [
  'No,\u201d she countered',
  '\u201cThis is fine,\u201d he said',
  'Precisely,\u201d the system confirmed',
].join('\n');

const orchResult = runDialogueMechanicsPass(multiLine);
assert(orchResult.beforeCount === 2, `Orchestration: beforeCount = ${orchResult.beforeCount} (expect 2)`);
assert(orchResult.afterCount === 0, `Orchestration: afterCount = ${orchResult.afterCount} (expect 0)`);
assert(orchResult.improved === true, `Orchestration: improved = ${orchResult.improved}`);
assert(orchResult.repairs.length === 2, `Orchestration: repairs = ${orchResult.repairs.length} (expect 2)`);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failures} failed ===`);
console.log(failures === 0 ? 'ACCEPTANCE: ALL CHECKS MATCHED' : `ACCEPTANCE: ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
