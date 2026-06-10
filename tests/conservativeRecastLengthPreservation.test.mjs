/**
 * conservativeRecastLengthPreservation.test.mjs
 *
 * Tests the conservative mode prompt and length anchoring:
 * RECAST_MODE enum, getWordRatioForMode, buildChunkRecastPrompt with
 * mode-aware length blocks, validateRecast with mode-specific ratio
 * enforcement and new return fields.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECAST_MODE,
  getWordRatioForMode,
  buildChunkRecastPrompt,
  validateRecast,
} from '../src/lib/antiChatbotRecastPipeline.js';

import {
  analyzeProseTexture,
} from '../src/lib/antiChatbotProse.js';


// ─── Generic ~100-word prose chunk for tests ──────────────────────────────

const GENERIC_CHUNK = `The morning light filtered through the tall windows of the old library, casting long rectangles of gold across the worn oak tables. Dust motes drifted lazily in the shafts of brightness, spinning and tumbling without any particular destination. A few students sat scattered among the stacks, their laptops open, their headphones on, their attention fixed on screens glowing faintly in the dim interior. Outside, the campus bell tower struck nine, its resonant chime rolling across the quadrangle and fading into the distant hum of traffic beyond the iron gates. Nobody looked up. The world continued as it always had.`;


// ═════════════════════════════════════════════════════════════════════════════
// 1. RECAST_MODE ENUM
// ═════════════════════════════════════════════════════════════════════════════

describe('RECAST_MODE enum', () => {
  it('has conservative mode', () => {
    assert.strictEqual(RECAST_MODE.CONSERVATIVE, 'conservative');
  });

  it('has standard mode', () => {
    assert.strictEqual(RECAST_MODE.STANDARD, 'standard');
  });

  it('has aggressive mode', () => {
    assert.strictEqual(RECAST_MODE.AGGRESSIVE, 'aggressive');
  });

  it('has exactly 3 modes', () => {
    const keys = Object.keys(RECAST_MODE);
    assert.strictEqual(keys.length, 3, `Expected 3 modes, got ${keys.length}: ${keys.join(', ')}`);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. getWordRatioForMode
// ═════════════════════════════════════════════════════════════════════════════

describe('getWordRatioForMode', () => {
  it('conservative returns { minWordRatio: 0.92, maxWordRatio: 1.10 }', () => {
    const result = getWordRatioForMode('conservative');
    assert.deepStrictEqual(result, { minWordRatio: 0.92, maxWordRatio: 1.10 });
  });

  it('standard returns { minWordRatio: 0.85, maxWordRatio: 1.10 }', () => {
    const result = getWordRatioForMode('standard');
    assert.deepStrictEqual(result, { minWordRatio: 0.85, maxWordRatio: 1.10 });
  });

  it('aggressive returns { minWordRatio: 0.75, maxWordRatio: 1.15 }', () => {
    const result = getWordRatioForMode('aggressive');
    assert.deepStrictEqual(result, { minWordRatio: 0.75, maxWordRatio: 1.15 });
  });

  it('undefined defaults to conservative', () => {
    const result = getWordRatioForMode(undefined);
    assert.deepStrictEqual(result, { minWordRatio: 0.92, maxWordRatio: 1.10 });
  });

  it('unknown mode defaults to conservative', () => {
    const result = getWordRatioForMode('unknown');
    assert.deepStrictEqual(result, { minWordRatio: 0.92, maxWordRatio: 1.10 });
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. buildChunkRecastPrompt — Conservative Mode
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — conservative mode', () => {
  const metrics = analyzeProseTexture(GENERIC_CHUNK);

  it('includes LENGTH PRESERVATION (MANDATORY', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'conservative' }
    );
    assert.ok(prompt.includes('LENGTH PRESERVATION (MANDATORY'), `Prompt should include LENGTH PRESERVATION block`);
  });

  it('includes original word count', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'conservative' }
    );
    const wordCount = GENERIC_CHUNK.split(/\s+/).filter(Boolean).length;
    assert.ok(prompt.includes(`${wordCount} words`), `Prompt should include original word count (${wordCount})`);
  });

  it('includes min and max word counts', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'conservative' }
    );
    const wordCount = GENERIC_CHUNK.split(/\s+/).filter(Boolean).length;
    const minWords = Math.floor(wordCount * 0.92);
    const maxWords = Math.ceil(wordCount * 1.10);
    assert.ok(prompt.includes(`${minWords}`), `Prompt should include min words (${minWords})`);
    assert.ok(prompt.includes(`${maxWords}`), `Prompt should include max words (${maxWords})`);
  });

  it('includes Do NOT summarize', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'conservative' }
    );
    assert.ok(prompt.includes('Do NOT summarize'), 'Conservative prompt should include "Do NOT summarize"');
  });

  it('includes paragraph count', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'conservative' }
    );
    const paragraphCount = (GENERIC_CHUNK.match(/\n\n/g) || []).length + 1;
    assert.ok(prompt.includes(`${paragraphCount} paragraph`), `Prompt should include paragraph count (${paragraphCount})`);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 4. buildChunkRecastPrompt — Standard Mode
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — standard mode', () => {
  const metrics = analyzeProseTexture(GENERIC_CHUNK);

  it('includes LENGTH GUIDANCE', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'standard' }
    );
    assert.ok(prompt.includes('LENGTH GUIDANCE'), 'Standard mode prompt should include LENGTH GUIDANCE');
  });

  it('does NOT include LENGTH PRESERVATION (MANDATORY', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
      { recastMode: 'standard' }
    );
    assert.ok(!prompt.includes('LENGTH PRESERVATION (MANDATORY'), 'Standard mode should NOT include LENGTH PRESERVATION block');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 5. buildChunkRecastPrompt — RECAST MODE and Profile
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — RECAST MODE label and profiles', () => {
  const metrics = analyzeProseTexture(GENERIC_CHUNK);

  it('always includes RECAST MODE:', () => {
    for (const mode of ['conservative', 'standard', 'aggressive']) {
      const prompt = buildChunkRecastPrompt(
        { text: GENERIC_CHUNK }, { genre: 'fiction' }, metrics,
        { recastMode: mode }
      );
      assert.ok(prompt.includes('RECAST MODE:'), `Prompt with mode '${mode}' should include RECAST MODE:`);
    }
  });

  it('nonfiction profile includes NONFICTION CONSTRAINTS', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'nonfiction' }, metrics,
      { recastMode: 'conservative' }
    );
    assert.ok(prompt.includes('NONFICTION CONSTRAINTS'), 'Nonfiction prompt should include NONFICTION CONSTRAINTS');
  });

  it('thriller profile does NOT include NONFICTION CONSTRAINTS', () => {
    const prompt = buildChunkRecastPrompt(
      { text: GENERIC_CHUNK }, { genre: 'thriller' }, metrics,
      { recastMode: 'conservative' }
    );
    assert.ok(!prompt.includes('NONFICTION CONSTRAINTS'), 'Thriller prompt should NOT include NONFICTION CONSTRAINTS');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 6. validateRecast — Mode-Specific Ratio Enforcement
// ═════════════════════════════════════════════════════════════════════════════

describe('validateRecast — mode-specific ratio enforcement', () => {
  // Build a ~100-word original
  const original = GENERIC_CHUNK;
  const origWords = original.split(/\s+/).filter(Boolean).length;

  // Build an 88% word-count recast — synthetic version that preserves structure but is shorter.
  // Original is 99 words; 88% = ~87 words. Must not trigger proper noun checks.
  const shortRecast88 = `The morning light filtered through the tall windows of the old library, casting long rectangles of gold across the worn oak tables. Dust motes drifted lazily in the shafts of brightness, spinning and tumbling without destination. A few students sat scattered among the stacks, their laptops open, their headphones on, attention fixed on screens glowing faintly in the dim interior. Outside, the campus bell tower struck nine, its resonant chime rolling across the quadrangle and fading into the hum of traffic beyond the iron gates. Nobody looked up.`;

  it('conservative mode rejects text at 88% word ratio (below 92%)', () => {
    const result = validateRecast(original, shortRecast88, { recastMode: 'conservative' });
    assert.strictEqual(result.ok, false, `Expected rejection at ${Math.round(result.ratio * 100)}% ratio in conservative mode`);
    assert.strictEqual(result.failureType, 'word_count_ratio');
  });

  it('standard mode accepts text at 88% ratio (above 85%)', () => {
    const result = validateRecast(original, shortRecast88, { recastMode: 'standard' });
    assert.strictEqual(result.ok, true, `Expected acceptance at ${Math.round(result.ratio * 100)}% ratio in standard mode, got error: ${result.error}`);
  });

  it('returns origWords, recastWords, ratio, minAllowed, maxAllowed, failureType fields', () => {
    const result = validateRecast(original, shortRecast88, { recastMode: 'conservative' });
    assert.ok(typeof result.origWords === 'number', 'origWords should be a number');
    assert.ok(typeof result.recastWords === 'number', 'recastWords should be a number');
    assert.ok(typeof result.ratio === 'number', 'ratio should be a number');
    assert.ok(typeof result.minAllowed === 'number', 'minAllowed should be a number');
    assert.ok(typeof result.maxAllowed === 'number', 'maxAllowed should be a number');
    assert.ok('failureType' in result, 'result should have failureType field');
  });

  it('returns failureType word_count_ratio when ratio is too low', () => {
    const result = validateRecast(original, shortRecast88, { recastMode: 'conservative' });
    assert.strictEqual(result.failureType, 'word_count_ratio', `Expected failureType 'word_count_ratio', got '${result.failureType}'`);
  });

  it('conservative mode is default when no mode specified', () => {
    // 88% ratio should fail with no mode (defaults to conservative 92%)
    const result = validateRecast(original, shortRecast88);
    assert.strictEqual(result.ok, false, 'Default mode (conservative) should reject 88% ratio');
    assert.strictEqual(result.failureType, 'word_count_ratio');
  });
});
