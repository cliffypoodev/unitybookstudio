#!/usr/bin/env node
/**
 * Unit tests for exactFinalLine.js
 * Run: node tests/exactFinalLine.test.mjs
 */

import { extractRequiredFinalLine, enforceExactFinalLine } from '../src/lib/exactFinalLine.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push({ name, actual, expected });
    console.log(`  ❌ ${name}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Got:      ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(name, actual, expected) {
  if (typeof actual === 'string' && actual.includes(expected)) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push({ name, actual, expected: `includes "${expected}"` });
    console.log(`  ❌ ${name}`);
    console.log(`     Expected to include: ${JSON.stringify(expected)}`);
    console.log(`     Got:                 ${JSON.stringify(actual)}`);
  }
}

function assertEndsWith(name, actual, expected) {
  if (typeof actual === 'string' && actual.trimEnd().endsWith(expected)) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push({ name, actual: actual?.slice?.(-120), expected: `ends with "${expected}"` });
    console.log(`  ❌ ${name}`);
    console.log(`     Expected to end with: ${JSON.stringify(expected)}`);
    console.log(`     Got (tail):           ${JSON.stringify(actual?.slice?.(-120))}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  EXTRACTOR TESTS
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ extractRequiredFinalLine ═══\n');

// Test 1: Multiline — line on next line
assert(
  'multiline: next-line final line',
  extractRequiredFinalLine(
    'Write a chapter.\n\nThe final line must be exactly:\nThe ledger was dated May 12th.'
  ),
  'The ledger was dated May 12th.'
);

// Test 2: Same-line final line
assert(
  'same-line: final line after colon',
  extractRequiredFinalLine(
    'Write a chapter.\n\nThe final sentence must be exactly: The tea cooled untouched beside Vivian\'s hand.'
  ),
  "The tea cooled untouched beside Vivian's hand."
);

// Test 3: Quoted dialogue on next line
assert(
  'multiline: dialogue on next line',
  extractRequiredFinalLine(
    'Write a chapter.\n\nThe final line must be exactly:\n"You were never supposed to find her name."'
  ),
  '"You were never supposed to find her name."'
);

// Test 4: Same-line quoted dialogue
assert(
  'same-line: quoted dialogue',
  extractRequiredFinalLine(
    'End with this exact line: "You were never supposed to find her name."'
  ),
  '"You were never supposed to find her name."'
);

// Test 5: Backtick-wrapped line
assert(
  'backtick-wrapped line',
  extractRequiredFinalLine(
    'The final line must be exactly: `The ledger was dated May 12th.`'
  ),
  'The ledger was dated May 12th.'
);

// Test 6: No exact final line present
assert(
  'no instruction: returns null',
  extractRequiredFinalLine(
    'Write a chapter about dogs.\nMake it exciting.\nThe end should feel satisfying.'
  ),
  null
);

// Test 7: "final image must be concrete" should NOT trigger
assert(
  'false positive: "final image must be concrete" returns null',
  extractRequiredFinalLine(
    'The final image must be concrete and sensory:\nThe tea cooled untouched beside Vivian\'s hand.'
  ),
  null
);

// Test 8: "End with:" variant
assert(
  '"End with:" trigger',
  extractRequiredFinalLine(
    'Write the chapter.\nEnd with:\nShe closed the door behind her.'
  ),
  'She closed the door behind her.'
);

// Test 9: "The final line is exactly:" variant
assert(
  '"final line is exactly" trigger',
  extractRequiredFinalLine(
    'The final line is exactly:\nThe morning came regardless.'
  ),
  'The morning came regardless.'
);

// Test 10: "The final line should be exactly:" variant
assert(
  '"final line should be exactly" trigger',
  extractRequiredFinalLine(
    'The final line should be exactly:\nNothing moved.'
  ),
  'Nothing moved.'
);

// Test 11: Empty after colon, blank line, then content
assert(
  'multiline with blank line between',
  extractRequiredFinalLine(
    'The final line must be exactly:\n\nThe ledger was dated May 12th.'
  ),
  'The ledger was dated May 12th.'
);

// Test 12: "End with gut-punch dialogue" should NOT trigger (no colon + exact line)
assert(
  'false positive: "end with gut-punch" returns null',
  extractRequiredFinalLine(
    'End with gut-punch dialogue from Jebediah.'
  ),
  null
);

// Test 13: "The final sentence must be:" variant
assert(
  '"final sentence must be:" trigger',
  extractRequiredFinalLine(
    'The final sentence must be:\nThe rain stopped.'
  ),
  'The rain stopped.'
);

// Test 14: Same-line with backtick wrapper (backticks ARE stripped, quotes are NOT)
assert(
  'same-line: backtick wrapper is stripped',
  extractRequiredFinalLine(
    'The final line must be exactly: `The ledger was dated May 12th.`'
  ),
  'The ledger was dated May 12th.'
);

// Test 14b: Quotes are preserved (never stripped — could be dialogue)
assert(
  'same-line: quotes are preserved (not stripped)',
  extractRequiredFinalLine(
    'The final line must be exactly: "The ledger was dated May 12th."'
  ),
  '"The ledger was dated May 12th."'
);

// Test 15: "End with the exact sentence:" variant
assert(
  '"End with the exact sentence:" trigger',
  extractRequiredFinalLine(
    'End with the exact sentence: She never looked back.'
  ),
  'She never looked back.'
);


// ═══════════════════════════════════════════════════════════════
//  ENFORCER TESTS
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ enforceExactFinalLine ═══\n');

// Suppress console output during tests
const origLog = console.log;
const origWarn = console.warn;
console.log = () => {};
console.warn = () => {};

// Test E1: No required line → unchanged
{
  const input = 'Body paragraph.\n\nThe ending is here.';
  const result = enforceExactFinalLine(input, null, 'Test');
  assert('E1: null required → unchanged', result.text, input);
  assert('E1: patched=false', result.patched, false);
}

// Test E2: Text already ends correctly → unchanged
{
  const input = 'Body paragraph.\n\nThe ledger was dated May 12th.';
  const result = enforceExactFinalLine(input, 'The ledger was dated May 12th.', 'Test');
  assert('E2: already correct → unchanged', result.text, input);
  assert('E2: patched=false', result.patched, false);
}

// Test E3: Replace paraphrased ending (short final paragraph)
{
  const input = 'Body paragraph.\n\nThe tea had cooled, having long since lost any semblance of warmth, mirroring the sudden chill settling over the room.';
  const required = "The tea cooled untouched beside Vivian's hand.";
  const result = enforceExactFinalLine(input, required, 'Ch.2');
  assert('E3: patched=true', result.patched, true);
  assertEndsWith('E3: ends with required line', result.text, required);
  assertIncludes('E3: body preserved', result.text, 'Body paragraph.');
}

// Test E4: Dialogue required line preserves quotes
{
  const input = 'She stared at the plaque.\n\n"You should never have come here," he said quietly.';
  const required = '"You were never supposed to find her name."';
  const result = enforceExactFinalLine(input, required, 'Ch.3');
  assert('E4: patched=true', result.patched, true);
  assertEndsWith('E4: ends with dialogue', result.text, '"You were never supposed to find her name."');
  assertIncludes('E4: body preserved', result.text, 'She stared at the plaque.');
}

// Test E5: Long final paragraph — replaces last sentence only
{
  const longPara = 'Margot stood in the doorway, her fingers tracing the edge of the receipt. The paper was brittle, yellowed with age, and the ink had faded to a sepia whisper. She held it up to the light and read the names again. The room grew quiet around her.';
  const input = 'First paragraph here.\n\n' + longPara;
  const required = 'The ledger was dated May 12th.';
  const result = enforceExactFinalLine(input, required, 'Ch.1');
  assert('E5: patched=true', result.patched, true);
  assertEndsWith('E5: ends with required', result.text, required);
  assertIncludes('E5: first paragraph preserved', result.text, 'First paragraph here.');
  // Should keep most of the long paragraph
  assertIncludes('E5: long para body preserved', result.text, 'her fingers tracing the edge');
}

// Test E6: undefined required (extraction warning) → unchanged
{
  const input = 'Body paragraph.\n\nEnding text.';
  const result = enforceExactFinalLine(input, undefined, 'Test');
  assert('E6: undefined → unchanged', result.text, input);
  assert('E6: patched=false', result.patched, false);
  assertIncludes('E6: warning message', result.message, 'WARNING');
}

// Test E7: Already ends with required + trailing whitespace
{
  const input = 'Body.\n\nThe ledger was dated May 12th.   \n  ';
  const result = enforceExactFinalLine(input, 'The ledger was dated May 12th.', 'Test');
  assert('E7: trailing whitespace → still matches', result.patched, false);
}

// Restore console
console.log = origLog;
console.warn = origWarn;

// ═══════════════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50));
if (failed > 0) {
  console.log('\n  FAILURES:');
  for (const f of failures) {
    console.log(`    ❌ ${f.name}`);
  }
  process.exit(1);
} else {
  console.log('\n  ✅ All tests passed!');
}
