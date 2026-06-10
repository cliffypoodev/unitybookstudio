// tests/polishPipelineIntegration.test.mjs — Integration tests for the full polish pipeline
import assert from 'node:assert';
import { polishChapterWithLLM, validatePolisherOutput } from '../src/lib/llmProsePolisher.js';
import { runProsePolishQualityGate, runDeterministicGrammarRepair, repairMissingOpeningQuotes } from '../src/lib/prosePolishQualityGate.js';
import { runManuscriptSafetyGate } from '../src/lib/manuscriptSafetyGate.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

// ── Test Data ──

const TEST_CHAPTER = `The Patron\u2019s Palette

Marcus stared at the board. She were carrying the burden of the platform\u2019s legacy. The game is the model, Marcus,\u201d she retorted with ice in her voice.

The system wasn\u2019t just a tool\u2014it wasn\u2019t just a mechanism. He felt the weight of their expectations. He realized the truth was something deeper.

The platform wasn\u2019t just failing. It wasn\u2019t just breaking. Everything felt wrong. She wasn\u2019t just worried. The weight of responsibility washed over her.

But Marcus pressed on. \u201cWe rebuild from scratch,\u201d he declared. \u201cEvery algorithm, every dataset.\u201d

\u201cAnd the users?\u201d Zara challenged.

\u201cThey\u2019ll understand,\u201d Marcus said, though he wasn\u2019t just uncertain\u2014he was terrified.`;

const POLISHED_CHAPTER = `The Patron\u2019s Palette

Marcus stared at the board. She carried the burden of the platform\u2019s legacy. \u201cThe game is the model, Marcus,\u201d she retorted with ice in her voice.

The system had become a burden\u2014a mechanism grinding against its own purpose. He sensed their expectations pressing in from every direction.

The platform buckled under its own contradictions. Everything had gone sideways. Worry etched lines into her face that hadn\u2019t been there a month ago.

But Marcus pressed on. \u201cWe rebuild from scratch,\u201d he declared. \u201cEvery algorithm, every dataset.\u201d

\u201cAnd the users?\u201d Zara challenged.

\u201cThey\u2019ll understand,\u201d Marcus said, though uncertainty had given way to something closer to dread.`;

const mockPolishLLM = async () => POLISHED_CHAPTER;

const mockFailLLM = async () => { throw new Error('Ollama connection refused'); };

const mockProcessLeakedLLM = async () => `Here is the revised chapter:
Action Plan: fix everything about Marcus.

Marcus stared at the board.`;

console.log('\n═══ Polish Pipeline Integration Tests ═══\n');

// ── Test 1: Pre-polish safety gate passes clean chapter ──
await test('1. Pre-polish safety gate passes chapter (no process leaks/contamination)', async () => {
  const gate = runManuscriptSafetyGate(TEST_CHAPTER, { stage: 'pre-polish' });
  assert.strictEqual(gate.ok, true, 'Safety gate should pass — chapter has grammar issues but no process leaks or contamination');
});

// ── Test 2: LLM polish returns result ──
await test('2. LLM polish is called and returns different text', async () => {
  const result = await polishChapterWithLLM({
    chapterText: TEST_CHAPTER,
    chapterTitle: "The Patron\u2019s Palette",
    chapterNumber: 2,
    callLLM: mockPolishLLM,
  });
  assert.strictEqual(result.ok, true, 'Polish should succeed');
  assert.notStrictEqual(result.text, TEST_CHAPTER, 'Text should be different from original');
});

// ── Test 3: Deterministic grammar repair runs after LLM ──
await test('3. Deterministic grammar repair catches "She were" in original, not in polished', async () => {
  const originalRepair = runDeterministicGrammarRepair(TEST_CHAPTER);
  assert.ok(originalRepair.repairs.length > 0, 'Original should have grammar issues ("She were")');

  const polishedRepair = runDeterministicGrammarRepair(POLISHED_CHAPTER);
  assert.strictEqual(polishedRepair.repairs.length, 0, 'Polished should have no grammar issues (LLM fixed "She were" → "She carried")');
});

// ── Test 4: Post-polish quality gate catches remaining hard failures ──
await test('4. Post-polish quality gate catches malformed in original, passes polished', async () => {
  const originalGate = runProsePolishQualityGate(TEST_CHAPTER);
  assert.strictEqual(originalGate.ok, false, 'Original should fail quality gate (has "She were")');
  assert.ok(originalGate.malformed.count > 0, 'Original should have malformed grammar');

  const polishedGate = runProsePolishQualityGate(POLISHED_CHAPTER);
  assert.strictEqual(polishedGate.malformed.count, 0, 'Polished should have no malformed grammar');
});

// ── Test 5: Missing opening quote detected ──
await test('5. Missing opening quote is detected when pattern matches', async () => {
  // The detection pattern requires: closing-quote + space + CapitalizedSpeech + closing-quote
  // This is the real pattern from the v5 DOCX
  const textWithMissingQuote = `You don\u2019t need to feed the model your existential dread.\u201d The game is the model, Marcus,\u201d she retorted with ice.`;
  const gate = runProsePolishQualityGate(textWithMissingQuote);
  assert.ok(gate.quoteIssues.count > 0, 'Should detect missing opening quote after close-quote + speech');
});

// ── Test 6: Polished text has fewer slop patterns ──
await test('6. Polished text has fewer slop patterns than original', async () => {
  const originalSlop = runProsePolishQualityGate(TEST_CHAPTER).slopCounts.total;
  const polishedSlop = runProsePolishQualityGate(POLISHED_CHAPTER).slopCounts.total;
  assert.ok(polishedSlop < originalSlop, `Polished (${polishedSlop}) should have fewer slop than original (${originalSlop})`);
});

// ── Test 7: Process-leaked LLM output is blocked ──
await test('7. Process-leaked LLM output is blocked', async () => {
  const result = await polishChapterWithLLM({
    chapterText: TEST_CHAPTER,
    chapterTitle: "The Patron\u2019s Palette",
    chapterNumber: 2,
    callLLM: mockProcessLeakedLLM,
  });
  assert.strictEqual(result.ok, false, 'Should reject process-leaked output');
  assert.ok(result.error, 'Should have an error');
});

// ── Test 8: Failed LLM doesn't overwrite original ──
await test('8. Failed LLM preserves original text', async () => {
  const result = await polishChapterWithLLM({
    chapterText: TEST_CHAPTER,
    chapterTitle: "The Patron\u2019s Palette",
    chapterNumber: 2,
    callLLM: mockFailLLM,
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.text, TEST_CHAPTER, 'Original text must be preserved when LLM fails');
});

// ── Test 9: Full pipeline simulation ──
await test('9. Full pipeline: safety gate → LLM polish → grammar repair → quote repair → quality gate', async () => {
  // Step 1: Pre-polish safety gate
  const safetyGate = runManuscriptSafetyGate(TEST_CHAPTER, { stage: 'pre-polish' });
  assert.strictEqual(safetyGate.ok, true, 'Safety gate should pass');

  // Step 2: LLM polish
  const llmResult = await polishChapterWithLLM({
    chapterText: TEST_CHAPTER,
    chapterTitle: "The Patron\u2019s Palette",
    chapterNumber: 2,
    callLLM: mockPolishLLM,
  });
  assert.strictEqual(llmResult.ok, true, 'LLM polish should succeed');

  // Step 3: Deterministic grammar repair
  const grammarResult = runDeterministicGrammarRepair(llmResult.text);
  let finalText = grammarResult.text;

  // Step 4: Missing opening quote repair
  const quoteResult = repairMissingOpeningQuotes(finalText);
  finalText = quoteResult.text;

  // Step 5: Post-polish quality gate
  const qualityGate = runProsePolishQualityGate(finalText);

  // Verify final result is cleaner than original
  const originalGate = runProsePolishQualityGate(TEST_CHAPTER);
  assert.ok(qualityGate.malformed.count <= originalGate.malformed.count, 'Final should have fewer or equal malformed issues');
  assert.ok(qualityGate.slopCounts.total < originalGate.slopCounts.total, 'Final should have fewer slop patterns');
  assert.ok(finalText !== TEST_CHAPTER, 'Final text should differ from original');
});

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
