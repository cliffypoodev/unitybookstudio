// llmProsePolisher.test.mjs
// Run: node tests/llmProsePolisher.test.mjs

import assert from 'node:assert';
import { polishChapterWithLLM, validatePolisherOutput, PROSE_POLISHER_SYSTEM_PROMPT } from '../src/lib/llmProsePolisher.js';

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

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

// ─── MOCK LLMs ──────────────────────────────────────────────────────────────

const SAMPLE_CHAPTER = `The Patron's Palette

Marcus stared at the digital board, its pixels flickering with the weight of a thousand decisions. The courtroom was not just a battleground—it was a crucible. He felt the tension rising like a tide.

Zara leaned forward. "You realize what this means?" she asked, her voice carrying the weight of years of litigation.

"I do," Marcus replied. "The system wasn't just broken—it was designed to fail."

The algorithm churned through data points, each one a testament to the platform's decay. Marcus realized that the truth was something he could no longer ignore. The platform wasn't just failing its users. It was consuming them.

He stood. The weight of the moment pressed against his chest. "We rebuild," he declared. "Every line of code."

"And the cost?" Zara challenged.

"Whatever it takes," Marcus said, though the weight of that promise felt heavier than anything he'd carried before.`;

// Mock LLM that returns good polish
const mockGoodLLM = async (prompt, systemPrompt) => {
  // Return slightly modified version of the input chapter text
  // Extract the chapter text from the prompt
  const match = prompt.match(/Chapter Text:\n([\s\S]+?)\n\nReturn only/);
  if (!match) return 'Fallback polished text. The courtroom was silent.';
  let text = match[1];
  // Simulate light polish: remove "not just" and "felt"
  text = text.replace(/not just/g, '').replace(/\bfelt\b/g, 'sensed');
  return text;
};

// Mock LLM that returns process notes
const mockProcessNotesLLM = async () => 'Here is the revised chapter:\n\nAction Plan:\n- Fix dialogue\n- Improve flow\n\nThe courtroom was silent.';

// Mock LLM that returns contamination
const mockContaminatedLLM = async () => 'The Unity Supported Living team assembled for the compliance documentation review. Marcus checked the care documentation system.';

// Mock LLM that cuts too much (50% shorter)
const mockTooShortLLM = async () => 'Short. Very short output.';

// Mock LLM that fails
const mockFailLLM = async () => { throw new Error('Ollama connection refused'); };

console.log('\n═══ LLM Prose Polisher Tests ═══\n');

// ── 1. LLM output with process notes is rejected ──
await testAsync('1. LLM output with process notes is rejected', async () => {
  const result = await polishChapterWithLLM({
    chapterText: SAMPLE_CHAPTER,
    chapterTitle: "The Patron's Palette",
    chapterNumber: 1,
    callLLM: mockProcessNotesLLM,
  });
  assert.strictEqual(result.ok, false, 'should reject process notes');
  assert.ok(
    result.error.toLowerCase().includes('process') ||
    result.error.toLowerCase().includes('leakage') ||
    result.error.toLowerCase().includes('here is the revised') ||
    result.error.toLowerCase().includes('action plan'),
    `error should mention process leakage, got: ${result.error}`
  );
});

// ── 2. LLM output with contamination is rejected ──
await testAsync('2. LLM output with contamination is rejected', async () => {
  const result = await polishChapterWithLLM({
    chapterText: SAMPLE_CHAPTER,
    chapterTitle: "The Patron's Palette",
    chapterNumber: 1,
    callLLM: mockContaminatedLLM,
  });
  assert.strictEqual(result.ok, false, 'should reject contamination');
  assert.ok(result.error.toLowerCase().includes('contamination'),
    `error should mention contamination, got: ${result.error}`);
});

// ── 3. LLM output that is 50% shorter is rejected ──
await testAsync('3. LLM output that is 50% shorter is rejected', async () => {
  const result = await polishChapterWithLLM({
    chapterText: SAMPLE_CHAPTER,
    chapterTitle: "The Patron's Palette",
    chapterNumber: 1,
    callLLM: mockTooShortLLM,
  });
  assert.strictEqual(result.ok, false, 'should reject too-short output');
  assert.ok(
    result.error.toLowerCase().includes('word') ||
    result.error.toLowerCase().includes('short') ||
    result.error.toLowerCase().includes('cut') ||
    result.error.toLowerCase().includes('empty'),
    `error should mention word count, got: ${result.error}`
  );
});

// ── 4. Clean LLM output passes ──
await testAsync('4. Clean LLM output passes', async () => {
  const result = await polishChapterWithLLM({
    chapterText: SAMPLE_CHAPTER,
    chapterTitle: "The Patron's Palette",
    chapterNumber: 1,
    callLLM: mockGoodLLM,
  });
  assert.strictEqual(result.ok, true, `should pass clean output, got error: ${result.error}`);
});

// ── 5. LLM call failure returns fallback ──
await testAsync('5. LLM call failure returns fallback', async () => {
  const result = await polishChapterWithLLM({
    chapterText: SAMPLE_CHAPTER,
    chapterTitle: "The Patron's Palette",
    chapterNumber: 1,
    callLLM: mockFailLLM,
  });
  assert.strictEqual(result.ok, false, 'should fail on connection error');
  assert.ok(
    result.error.toLowerCase().includes('connection') ||
    result.error.toLowerCase().includes('failed') ||
    result.error.toLowerCase().includes('refused'),
    `error should mention connection, got: ${result.error}`
  );
  assert.strictEqual(result.text, SAMPLE_CHAPTER, 'text should equal original (unchanged)');
});

// ── 6. System prompt includes preserve-plot rules ──
test('6. System prompt includes preserve-plot rules', () => {
  assert.ok(PROSE_POLISHER_SYSTEM_PROMPT.includes('Preserve all plot events'),
    'should include "Preserve all plot events"');
  assert.ok(PROSE_POLISHER_SYSTEM_PROMPT.includes('Output finished fiction prose ONLY'),
    'should include "Output finished fiction prose ONLY"');
});

// ── 7. System prompt includes slop reduction rules ──
test('7. System prompt includes slop reduction rules', () => {
  assert.ok(
    PROSE_POLISHER_SYSTEM_PROMPT.includes("wasn\u2019t just") || PROSE_POLISHER_SYSTEM_PROMPT.includes("wasn't just"),
    'should include "wasn\'t just"'
  );
  assert.ok(PROSE_POLISHER_SYSTEM_PROMPT.includes('not just'),
    'should include "not just"');
});

// ── 8. validatePolisherOutput rejects empty output ──
test('8. validatePolisherOutput rejects empty output', () => {
  const result = validatePolisherOutput('', SAMPLE_CHAPTER, 'Title');
  assert.strictEqual(result.ok, false, 'should reject empty output');
});

// ── 9. validatePolisherOutput rejects analysis format ──
test('9. validatePolisherOutput rejects analysis format', () => {
  const result = validatePolisherOutput('# Chapter Analysis\n- Issue 1\n- Issue 2', SAMPLE_CHAPTER, 'Title');
  assert.strictEqual(result.ok, false, 'should reject analysis format');
});

// ── 10. validatePolisherOutput passes clean prose ──
test('10. validatePolisherOutput passes clean prose', () => {
  const result = validatePolisherOutput(SAMPLE_CHAPTER, SAMPLE_CHAPTER, "The Patron's Palette");
  assert.strictEqual(result.ok, true, `should pass clean prose, got error: ${result.error}`);
  assert.strictEqual(result.error, null, 'error should be null');
});

// ── 11. validatePolisherOutput rejects model disclaimer ──
test('11. validatePolisherOutput rejects model disclaimer', () => {
  const result = validatePolisherOutput(
    'As an AI language model, I cannot rewrite this chapter. Here is my attempt...',
    SAMPLE_CHAPTER,
    'Title'
  );
  assert.strictEqual(result.ok, false, 'should reject model disclaimer');
});

// ── 12. validatePolisherOutput warns about chapter opening with "The air" ──
test('12. validatePolisherOutput warns about "The air" opening', () => {
  // Build text starting with "The air" that's long enough and similar word count
  const airOpening = 'The air was thick with anticipation as Marcus entered the room. ' + SAMPLE_CHAPTER.substring(SAMPLE_CHAPTER.indexOf('\n\n') + 2);
  const result = validatePolisherOutput(airOpening, SAMPLE_CHAPTER, 'Title');
  assert.strictEqual(result.ok, true, 'should still pass (warning, not rejection)');
  assert.ok(result.warnings.some(w => w.toLowerCase().includes('the air')),
    `warnings should mention "The air", got: ${JSON.stringify(result.warnings)}`);
});

// ── 13. Word count expansion beyond 115% is rejected ──
test('13. Word count expansion beyond 115% is rejected', () => {
  // Original ~100 words
  const original100 = 'The gallery was quiet. Marcus stood before the canvas, brush in hand. ' +
    'He studied the composition carefully, noting each flaw and strength. ' +
    'The colors blended in ways he had not anticipated. Sarah appeared behind him, ' +
    'holding two cups of coffee. She set one on the workbench without a word. ' +
    'He nodded his thanks. Outside, the rain had begun to fall, tapping against ' +
    'the skylights in an irregular rhythm. The afternoon light shifted, ' +
    'casting new shadows across the half-finished painting. He picked up the palette knife. ' +
    'Time was running out. The exhibition opened in three days. ' +
    'Every stroke mattered now. He took a breath and began.';

  // Expanded ~150 words (well over 115%)
  const expanded150 = 'The gallery was incredibly quiet and still. Marcus stood tall and resolute before the large canvas, ' +
    'his favorite brush gripped firmly in his right hand. He studied the complex composition with great care and attention, ' +
    'methodically noting each subtle flaw and hidden strength that revealed itself upon close inspection. ' +
    'The rich colors blended and merged in surprising ways he had absolutely not anticipated or foreseen. ' +
    'Sarah appeared silently behind him, carefully holding two steaming cups of freshly brewed coffee. ' +
    'She gently set one on the cluttered workbench without uttering a single word. He nodded his grateful thanks. ' +
    'Outside the tall windows, the cold autumn rain had begun to fall steadily, tapping rhythmically against ' +
    'the old skylights in an irregular but soothing pattern. The pale afternoon light shifted dramatically, ' +
    'casting long new shadows across the half-finished oil painting propped on the easel. He carefully picked up the palette knife. ' +
    'Time was rapidly running out and he knew it well. The important exhibition opened to the public in just three short days. ' +
    'Every single brush stroke mattered deeply now more than ever before. He took a slow deep breath and determinedly began his work anew.';

  const result = validatePolisherOutput(expanded150, original100, 'Title');
  assert.strictEqual(result.ok, false, 'should reject over-expanded output');
});

// ── Summary ──
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
process.exit(failed > 0 ? 1 : 0);
