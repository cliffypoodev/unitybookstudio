// tests/surgicalFix.test.mjs — Surgical fix engine tests
// Validates paragraph extraction, splicing, content-loss guard, and fix flow.

import assert from 'node:assert';
import { applySurgicalFixes, findContainingParagraph, spliceParagraph, normalizeForMatch, countWords } from '../src/lib/surgicalFix.js';

/* ═══════════════════════════════════════════════════════════════════════════
 * CHAPTER FIXTURE
 * ═════════════════════════════════════════════════════════════════════════ */

const CH1_TEXT = `The ship crept into harbor as dawn broke over the eastern hills. Marcus stood at the bow, his hands gripping the salt-worn railing. Behind him, Elena checked the manifest for the third time, her pen scratching against damp paper.

"We should have arrived yesterday," she muttered without looking up.

"The current was against us," Marcus replied. He watched the harbor master emerge from a squat stone building, lantern in hand despite the growing light.

The dock was empty except for a pair of fishing boats. Their nets hung like gray curtains from wooden frames. The smell of old fish and tar mixed with the salt breeze.

Captain Aldric appeared on deck, his coat buttoned to the throat. He surveyed the harbor with narrowed eyes. Whatever he saw seemed to satisfy him because he gave a single nod to the helmsman.

"Bring her alongside the eastern pier," Aldric ordered. His voice carried no emotion, but Marcus noticed the captain's left hand was clenched into a fist inside his pocket.

The crew moved with quiet efficiency. No one spoke above a whisper. Marcus had served on enough vessels to know that silence before docking meant the crew was nervous. They had reason to be.`;

/* ═══════════════════════════════════════════════════════════════════════════
 * MOCK LLM — returns a rewritten paragraph
 * ═════════════════════════════════════════════════════════════════════════ */

const mockPolishLLM = async (prompt) => {
  // Replace the tell-don't-show paragraph with a shown version
  if (prompt.includes('silence before docking')) {
    return `The crew moved with quiet efficiency. No one spoke above a whisper. A deckhand fumbled a rope and winced at the look from the bosun. Another pressed his lips together so tightly they turned white. Marcus watched their stiff movements and clenched jaws. They had reason to be careful.`;
  }
  // Generic fallback — return something reasonable
  return prompt.match(/TARGET PARAGRAPH.*?:\n([\s\S]*?)(?:\n\n|FOLLOWING)/)?.[1]?.trim() || 'Fallback paragraph text here.';
};

/* LLM that returns way too short text (triggers content-loss guard) */
const truncatingLLM = async () => 'Short.';

/* ═══════════════════════════════════════════════════════════════════════════
 * TEST HARNESS
 * ═════════════════════════════════════════════════════════════════════════ */

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✅ ' + name);
  } catch (e) {
    failed++;
    failures.push(name);
    console.error('  ❌ ' + name + ': ' + e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * UNIT TESTS — helpers
 * ═════════════════════════════════════════════════════════════════════════ */

console.log('\n=== SURGICAL FIX ENGINE TESTS ===\n');

test('1. findContainingParagraph locates correct paragraph', () => {
  const result = findContainingParagraph(CH1_TEXT, 'silence before docking');
  assert(result, 'Should find paragraph');
  assert(result.paragraph.includes('The crew moved'), 'Paragraph should start with "The crew moved"');
  assert(result.paragraph.includes('They had reason to be'), 'Paragraph should contain "They had reason to be"');
});

test('2. findContainingParagraph returns null for missing quote', () => {
  const result = findContainingParagraph(CH1_TEXT, 'this text does not exist anywhere');
  assert.strictEqual(result, null, 'Should return null for missing quote');
});

test('3. spliceParagraph replaces paragraph exactly', () => {
  const original = 'First para.\n\nSecond para.\n\nThird para.';
  const result = spliceParagraph(original, 'Second para.', 'REPLACED.');
  assert.strictEqual(result, 'First para.\n\nREPLACED.\n\nThird para.');
});

test('4. spliceParagraph returns null on no match', () => {
  const result = spliceParagraph('Some text.', 'Missing text.', 'New text.');
  assert.strictEqual(result, null);
});

test('5. countWords handles edge cases', () => {
  assert.strictEqual(countWords(''), 0);
  assert.strictEqual(countWords(null), 0);
  assert.strictEqual(countWords('hello world'), 2);
  assert.strictEqual(countWords('  spaces  between  '), 2);
});

test('6. normalizeForMatch collapses whitespace and quotes', () => {
  const result = normalizeForMatch('\u201cHello,\u201d  she   said');
  assert.strictEqual(result, '"Hello," she said');
});

/* ═══════════════════════════════════════════════════════════════════════════
 * INTEGRATION TESTS — full fix flow
 * ═════════════════════════════════════════════════════════════════════════ */

(async () => {
  // Test 7: Successful prose fix
  const loaded = [
    { chapter: { chapter_number: 1, title: 'The Arrival' }, content: CH1_TEXT, original: CH1_TEXT },
  ];

  const issues = [
    {
      severity: 'A',
      chapterNumber: 1,
      quote: 'Marcus had served on enough vessels to know that silence before docking meant the crew was nervous',
      description: "The crew's nervousness is told rather than shown",
      fixType: 'prose',
    },
  ];

  const saveLog = [];
  const result = await applySurgicalFixes({
    loaded,
    issues,
    project: {},
    _llmOverride: mockPolishLLM,
    _saveOverride: async (chNum, content, stamp) => {
      saveLog.push({ chNum, stamp, wordCount: countWords(content) });
      return { status: 'saved' };
    },
  });

  test('7. Prose fix applied successfully', () => {
    const applied = result.results.filter(r => r.status === 'applied');
    assert(applied.length >= 1, 'Should have at least 1 applied fix, got ' + applied.length);
  });

  test('8. Revised text no longer contains tell-not-show passage', () => {
    const newContent = loaded[0].content;
    assert(!newContent.includes('Marcus had served on enough vessels'),
      'Tell-not-show passage should be removed');
  });

  test('9. Chapter save was triggered', () => {
    assert(saveLog.length >= 1, 'Should have saved at least 1 chapter');
    assert.strictEqual(saveLog[0].chNum, 1);
  });

  test('10. Revision stamp included in save', () => {
    assert(saveLog[0].stamp.includes('CRITIC-FIX'), 'Stamp should contain CRITIC-FIX');
  });

  // Test 11: Content-loss guard
  const loaded2 = [
    { chapter: { chapter_number: 1, title: 'The Arrival' }, content: CH1_TEXT, original: CH1_TEXT },
  ];

  const result2 = await applySurgicalFixes({
    loaded: loaded2,
    issues: [{
      severity: 'A', chapterNumber: 1,
      quote: 'Marcus had served on enough vessels to know that silence before docking meant the crew was nervous',
      description: 'Test truncation', fixType: 'prose',
    }],
    project: {},
    _llmOverride: truncatingLLM,
    _saveOverride: async () => ({ status: 'saved' }),
  });

  test('11. Truncating LLM fix fails length check', () => {
    const fixResult = result2.results.find(r => r.chapterNumber === 1);
    assert(fixResult, 'Should have a result for chapter 1');
    assert(fixResult.status === 'failed' || fixResult.status === 'reverted',
      'Should fail or revert, got: ' + fixResult.status);
  });

  // Test 12: Manual/structural fixes are skipped
  const loaded3 = [
    { chapter: { chapter_number: 1, title: 'Test' }, content: 'Some content.', original: 'Some content.' },
  ];

  const result3 = await applySurgicalFixes({
    loaded: loaded3,
    issues: [{ severity: 'B', chapterNumber: 1, quote: 'Some', description: 'Test', fixType: 'manual' }],
    project: {},
    _llmOverride: mockPolishLLM,
  });

  test('12. Manual fix type is skipped', () => {
    assert.strictEqual(result3.results[0].status, 'skipped');
  });

  // Test 13: Missing chapter returns stale
  const result4 = await applySurgicalFixes({
    loaded: loaded3,
    issues: [{ severity: 'A', chapterNumber: 99, quote: 'test', description: 'test', fixType: 'prose' }],
    project: {},
    _llmOverride: mockPolishLLM,
  });

  test('13. Missing chapter returns stale', () => {
    assert.strictEqual(result4.results[0].status, 'stale');
  });

  /* ═══════════════════════════════════════════════════════════════════════
   * SUMMARY
   * ═════════════════════════════════════════════════════════════════════ */

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SURGICAL FIX: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'═'.repeat(60)}`);
  if (failed > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ❌ ${f}`);
    process.exit(1);
  } else {
    console.log('All surgical fix tests passed! ✅');
  }
})();
