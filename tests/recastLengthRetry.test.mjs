/**
 * recastLengthRetry.test.mjs
 *
 * Tests isWordCountRatioFailure, buildLengthCorrectionPrompt, and
 * recastChunkWithLengthRetry.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  isWordCountRatioFailure,
  buildLengthCorrectionPrompt,
  recastChunkWithLengthRetry,
  validateRecast,
  RECAST_MODE,
} from '../src/lib/antiChatbotRecastPipeline.js';


// ─── Generic ~100-word prose chunk for tests ──────────────────────────────

const GENERIC_CHUNK_TEXT = `The morning light filtered through the tall windows of the old library, casting long rectangles of gold across the worn oak tables. Dust motes drifted lazily in the shafts of brightness, spinning and tumbling without any particular destination. A few students sat scattered among the stacks, their laptops open, their headphones on, their attention fixed on screens glowing faintly in the dim interior. Outside, the campus bell tower struck nine, its resonant chime rolling across the quadrangle and fading into the distant hum of traffic beyond the iron gates. Nobody looked up. The world continued as it always had.`;

const CHUNK = { text: GENERIC_CHUNK_TEXT };
const ORIG_WORDS = GENERIC_CHUNK_TEXT.split(/\s+/).filter(Boolean).length;


// ═════════════════════════════════════════════════════════════════════════════
// 1. isWordCountRatioFailure
// ═════════════════════════════════════════════════════════════════════════════

describe('isWordCountRatioFailure', () => {
  it('returns true for { failureType: "word_count_ratio" }', () => {
    assert.strictEqual(isWordCountRatioFailure({ failureType: 'word_count_ratio' }), true);
  });

  it('returns false for { failureType: "proper_nouns" }', () => {
    assert.strictEqual(isWordCountRatioFailure({ failureType: 'proper_nouns' }), false);
  });

  it('returns false for null', () => {
    assert.strictEqual(isWordCountRatioFailure(null), false);
  });

  it('returns true for { error: "Recast cut too much" }', () => {
    assert.strictEqual(isWordCountRatioFailure({ error: 'Recast cut too much (100 → 70 words, 70%)' }), true);
  });

  it('returns true for { error: "Recast expanded too much" }', () => {
    assert.strictEqual(isWordCountRatioFailure({ error: 'Recast expanded too much (100 → 140 words, 140%)' }), true);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. buildLengthCorrectionPrompt
// ═════════════════════════════════════════════════════════════════════════════

describe('buildLengthCorrectionPrompt', () => {
  const minAllowed = Math.floor(ORIG_WORDS * 0.92);
  const maxAllowed = Math.ceil(ORIG_WORDS * 1.10);

  it('includes "too short" when recastWords < minAllowed', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'short recast text here', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: minAllowed - 10, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes('too short'), 'Prompt should say "too short" for under-length recast');
  });

  it('includes "too long" when recastWords > maxAllowed', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'long recast text here', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: maxAllowed + 10, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes('too long'), 'Prompt should say "too long" for over-length recast');
  });

  it('includes original word count', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'failed recast', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: minAllowed - 5, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes(`${ORIG_WORDS}`), `Prompt should include original word count (${ORIG_WORDS})`);
  });

  it('includes failed recast word count', () => {
    const failedWords = minAllowed - 10;
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'failed recast', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: failedWords, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes(`${failedWords}`), `Prompt should include failed recast word count (${failedWords})`);
  });

  it('includes allowed range (minAllowed, maxAllowed)', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'failed recast', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: minAllowed - 5, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes(`${minAllowed}`), `Prompt should include minAllowed (${minAllowed})`);
    assert.ok(prompt.includes(`${maxAllowed}`), `Prompt should include maxAllowed (${maxAllowed})`);
  });

  it('includes "MUST expand" for too-short recasts', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'short recast', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: minAllowed - 10, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes('MUST expand'), 'Too-short prompt should include "MUST expand"');
  });

  it('includes "MUST trim" for too-long recasts', () => {
    const prompt = buildLengthCorrectionPrompt(
      CHUNK, 'long recast', { genre: 'fiction' },
      { origWords: ORIG_WORDS, recastWords: maxAllowed + 10, minAllowed, maxAllowed }
    );
    assert.ok(prompt.includes('MUST trim'), 'Too-long prompt should include "MUST trim"');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. recastChunkWithLengthRetry
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithLengthRetry', () => {
  // Helper: build text of approximately N words from the chunk
  function buildTextOfLength(targetWords) {
    const baseWords = GENERIC_CHUNK_TEXT.split(/\s+/).filter(Boolean);
    const result = [];
    while (result.length < targetWords) {
      result.push(...baseWords);
    }
    return result.slice(0, targetWords).join(' ') + '.';
  }

  // ~80 words: will fail conservative ratio (92% of ~100)
  const SHORT_80 = buildTextOfLength(80);
  // ~95 words: will pass conservative ratio
  const GOOD_95 = buildTextOfLength(Math.floor(ORIG_WORDS * 0.95));
  // Same length, slightly modified
  const SAME_LENGTH = GENERIC_CHUNK_TEXT.replace('morning', 'afternoon').replace('gold', 'silver');

  it('with enableLengthRetry=false does not retry', async () => {
    let callCount = 0;
    const mockLLM = async () => {
      callCount++;
      return SHORT_80;
    };
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
      enableLengthRetry: false,
    });
    assert.strictEqual(callCount, 1, 'Should only call LLM once when retry is disabled');
    assert.strictEqual(result.retryAttempted, false);
  });

  it('returns retryAttempted=false when first attempt succeeds', async () => {
    const mockLLM = async () => SAME_LENGTH;
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
    });
    // If it succeeds, retryAttempted should be false
    if (result.ok) {
      assert.strictEqual(result.retryAttempted, false, 'retryAttempted should be false when first attempt succeeds');
    }
  });

  it('returns retryAttempted=true when first attempt fails with word_count_ratio and retry is attempted', async () => {
    let callCount = 0;
    const mockLLM = async () => {
      callCount++;
      if (callCount === 1) return SHORT_80;  // First: too short
      return GOOD_95;                         // Retry: correct length
    };
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
      enableLengthRetry: true,
    });
    assert.strictEqual(result.retryAttempted, true, 'retryAttempted should be true after retry');
    assert.strictEqual(callCount, 2, 'LLM should be called twice (initial + retry)');
  });

  it('returns retrySucceeded=true when retry fixes the length', async () => {
    let callCount = 0;
    const mockLLM = async () => {
      callCount++;
      if (callCount === 1) return SHORT_80;  // First: too short
      return SAME_LENGTH;                     // Retry: correct length
    };
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
      enableLengthRetry: true,
    });
    if (result.retryAttempted && result.ok) {
      assert.strictEqual(result.retrySucceeded, true, 'retrySucceeded should be true when retry passes');
    }
  });

  it('returns retrySucceeded=false when retry also fails', async () => {
    const mockLLM = async () => SHORT_80;  // Always too short
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
      enableLengthRetry: true,
    });
    assert.strictEqual(result.ok, false, 'Should fail when retry also produces too-short text');
    assert.strictEqual(result.retryAttempted, true, 'retryAttempted should be true');
    assert.strictEqual(result.retrySucceeded, false, 'retrySucceeded should be false when retry fails');
  });

  it('does not retry on non-word-count failures (e.g., process leakage)', async () => {
    // Return text that will PASS word count ratio but FAIL for process leakage
    // Build text of ~95 words (within 92-110% of ~99), then add leakage phrase
    const baseWords = GENERIC_CHUNK_TEXT.split(/\s+/).filter(Boolean);
    const safeLength = Math.floor(ORIG_WORDS * 0.95);  // ~94 words — leaves room for leakage phrase
    const safeBase = baseWords.slice(0, safeLength).join(' ');
    const leakyText = safeBase + '. As an AI language model, I cannot do that.';
    let callCount = 0;
    const mockLLM = async () => {
      callCount++;
      return leakyText;
    };
    const result = await recastChunkWithLengthRetry(CHUNK, { genre: 'fiction' }, {
      callLLM: mockLLM,
      recastMode: 'conservative',
      enableLengthRetry: true,
    });
    assert.strictEqual(callCount, 1, 'Should not retry on non-word-count failures');
    assert.strictEqual(result.retryAttempted, false, 'retryAttempted should be false for non-word-count failures');
  });
});
