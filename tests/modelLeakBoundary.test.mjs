import assert from 'assert';
import { detectModelControlTokens, stripModelControlTokens, scrubModelLeaks } from '../src/lib/modelLeakGuard.js';
import { callLlama } from '../src/lib/localLLM.js';
import { rewriteFlaggedSpots } from '../src/lib/repetitionRewrite.js';
import { polishChapterWithLLM } from '../src/lib/llmProsePolisher.js';

async function runTests() {
  console.log('Running Model Leak Boundary Tests...');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed++;
      console.log(`✅ ${name}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${name}`);
      console.error(e);
    }
  }

  await test('detectModelControlTokens: identifies /nothink', () => {
    const text = 'Here is some prose.\n\n/nothink\n\nMore prose.';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.strictEqual(leaks[0].token.trim().toLowerCase(), '/nothink');
  });

  await test('detectModelControlTokens: identifies <think>', () => {
    const text = '<think>Let me think</think> Here is the output.';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.ok(leaks[0].token.toLowerCase().includes('<think>'));
  });

  await test('detectModelControlTokens: identifies <|im_end|>', () => {
    const text = 'Something <|im_end|>';
    const leaks = detectModelControlTokens(text);
    assert.strictEqual(leaks.length, 1);
    assert.ok(leaks[0].token.includes('<|'));
  });

  await test('stripModelControlTokens: removes /nothink entirely', () => {
    const text = 'Here is some prose.\n\n/nothink\n\nMore prose.';
    const result = stripModelControlTokens(text);
    assert.strictEqual(result.text, 'Here is some prose.\n\nMore prose.');
    assert.strictEqual(result.removed, 1);
  });

  await test('scrubModelLeaks: tracks token-only paragraph removals correctly', () => {
    const text = 'Paragraph 1.\n\n/nothink\n\nParagraph 2.\n\n<think>I should write something here.</think>\n\nParagraph 3.';
    const result = scrubModelLeaks(text, 'Ch.1');
    assert.strictEqual(result.text, 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.');
    assert.strictEqual(result.paragraphsRemoved, 2);
    assert.strictEqual(result.tokensRemoved, 2);
  });

  await test('scrubModelLeaks: does NOT count inline tokens as paragraph removals', () => {
    const text = 'Paragraph 1.\n\nParagraph 2 /nothink is here.\n\nParagraph 3.';
    const result = scrubModelLeaks(text, 'Ch.1');
    assert.strictEqual(result.text, 'Paragraph 1.\n\nParagraph 2 is here.\n\nParagraph 3.');
    assert.strictEqual(result.paragraphsRemoved, 0); // No full paragraph was removed
    assert.strictEqual(result.tokensRemoved, 1);
  });

  await test('localLLM: scrubs control tokens at the network boundary', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Valid prose.\n\n/nothink\n\n<|im_end|>' } }]
        })
      });
      const response = await callLlama({ prompt: 'test' });
      assert.strictEqual(response, 'Valid prose.');
      assert.ok(!response.includes('/nothink'));
      assert.ok(!response.includes('<|im_end|>'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await test('repetitionRewrite: strips echoed control tokens and rejects token-only responses', async () => {
    const chapterText = 'The repeated opening went here. It was a dark and stormy night.';
    const globalOverused = new Set(['the repeated opening went']);

    // 1. Valid prose + echoed token
    const callLLMValid = async () => 'A better opening arrived. It was a dark and stormy night.\n\n/nothink';
    const res1 = await rewriteFlaggedSpots({ chapterText, globalOverused, callLLM: callLLMValid });
    assert.ok(res1.changed);
    assert.ok(!res1.text.includes('/nothink'));
    assert.ok(res1.text.includes('A better opening arrived.'));

    // 2. Token-only response becomes empty and is rejected (original prose remains)
    const callLLMEmpty = async () => '/nothink';
    const res2 = await rewriteFlaggedSpots({ chapterText, globalOverused, callLLM: callLLMEmpty });
    assert.ok(!res2.changed);
    assert.strictEqual(res2.text, chapterText);
  });

  await test('llmProsePolisher: strips echoed control tokens', async () => {
    const chapterText = 'Some prose that needs polishing. We add more words to make sure the ratio is okay and it passes the test.';
    const callLLM = async () => 'Some prose that needs polishing. We add more words to make sure the ratio is okay and it passes the test.\n\n/nothink\n\n<|im_end|>';
    const res = await polishChapterWithLLM({ chapterText, callLLM });
    assert.ok(res.ok);
    assert.ok(!res.text.includes('/nothink'));
    assert.ok(!res.text.includes('<|im_end|>'));
    assert.ok(res.text.includes('Some prose that needs'));
  });

  await test('llmProsePolisher: does NOT reject "the next move" in legitimate prose', async () => {
    const callLLM = async () => 'They had to decide what the next move would be. We add more words to make sure the ratio is okay and it passes the length checks for the polisher to accept it as valid prose output.';
    const res = await polishChapterWithLLM({ chapterText: 'They had to decide what the next move would be. We add more words to make sure the ratio is okay and it passes the length checks for the polisher to accept it as valid prose output.', callLLM });
    assert.ok(res.ok);
    assert.ok(res.text.includes('the next move'));
  });

  await test('llmProsePolisher: rejects standalone "Next Move: Rewrite the opening"', async () => {
    const callLLM = async () => 'Next Move: Rewrite the opening\n\nWe add more words to make sure the ratio is okay and it passes the length checks for the polisher to accept it as valid prose output.';
    const res = await polishChapterWithLLM({ chapterText: 'We add more words to make sure the ratio is okay and it passes the length checks for the polisher to accept it as valid prose output.', callLLM });
    assert.ok(!res.ok);
    assert.strictEqual(res.error, 'LLM output contains process leakage: ^\\s*(?:#+\\s*|\\*\\*|[-*]\\s*)?(?:Best\\s+)?Next Move\\b');
  });

  console.log(`\nTests complete. ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests();
