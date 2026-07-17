import assert from 'assert';
import { detectModelControlTokens, stripModelControlTokens, scrubModelLeaks } from '../src/lib/modelLeakGuard.js';

function runTests() {
  console.log('Running Model Leak Boundary Tests...');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${name}`);
      console.error(e);
    }
  }

  test('detectModelControlTokens: identifies /nothink', () => {
    const text = 'Here is some prose.\n\n/nothink\n\nMore prose.';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.strictEqual(leaks[0].token.trim().toLowerCase(), '/nothink');
  });

  test('detectModelControlTokens: identifies <think>', () => {
    const text = '<think>Let me think</think> Here is the output.';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.ok(leaks[0].token.toLowerCase().includes('<think>'));
  });
  
  test('detectModelControlTokens: identifies <|im_end|>', () => {
    const text = 'Something <|im_end|>';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.ok(leaks[0].token.includes('<|'));
  });

  test('stripModelControlTokens: removes /nothink entirely', () => {
    const text = 'Here is some prose.\n\n/nothink\n\nMore prose.';
    const result = stripModelControlTokens(text);
    assert.strictEqual(result.text, 'Here is some prose.\n\nMore prose.');
    assert.strictEqual(result.removed, 1);
  });

  test('scrubModelLeaks: tracks token-only paragraph removals correctly', () => {
    const text = 'Paragraph 1.\n\n/nothink\n\nParagraph 2.\n\n<think>I should write something here.</think>\n\nParagraph 3.';
    const result = scrubModelLeaks(text, 'Ch.1');
    assert.strictEqual(result.text, 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.');
    assert.strictEqual(result.paragraphsRemoved, 2);
    assert.strictEqual(result.tokensRemoved, 2);
  });

  test('scrubModelLeaks: does NOT count inline tokens as paragraph removals', () => {
    const text = 'Paragraph 1.\n\nParagraph 2 /nothink is here.\n\nParagraph 3.';
    const result = scrubModelLeaks(text, 'Ch.1');
    assert.strictEqual(result.text, 'Paragraph 1.\n\nParagraph 2 is here.\n\nParagraph 3.');
    assert.strictEqual(result.paragraphsRemoved, 0); // No full paragraph was removed
    assert.strictEqual(result.tokensRemoved, 1);
  });

  console.log(`\nTests complete. ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
