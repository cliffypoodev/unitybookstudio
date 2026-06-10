/**
 * recastFilterVerbTargeting.test.mjs
 *
 * Tests the FILTER_VERB_TARGETING_BLOCK constant from antiChatbotRecastPipeline.js.
 * Validates that the block contains all required target verbs, exception instructions,
 * and rate guidance.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FILTER_VERB_TARGETING_BLOCK,
} from '../src/lib/antiChatbotRecastPipeline.js';

describe('FILTER_VERB_TARGETING_BLOCK — Structure', () => {
  it('1. is a non-empty string', () => {
    assert.equal(typeof FILTER_VERB_TARGETING_BLOCK, 'string');
    assert.ok(FILTER_VERB_TARGETING_BLOCK.trim().length > 0, 'Block should not be empty');
  });

  it('2. contains "FILTER VERB TARGETING:" header', () => {
    assert.ok(
      FILTER_VERB_TARGETING_BLOCK.includes('FILTER VERB TARGETING:'),
      'Block should contain the FILTER VERB TARGETING header',
    );
  });
});

describe('FILTER_VERB_TARGETING_BLOCK — Target Verbs', () => {
  it('3. contains "felt" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"felt"'), 'Should contain "felt"');
  });

  it('4. contains "realized" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"realized"'), 'Should contain "realized"');
  });

  it('5. contains "noticed" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"noticed"'), 'Should contain "noticed"');
  });

  it('6. contains "watched" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"watched"'), 'Should contain "watched"');
  });

  it('7. contains "saw" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"saw"'), 'Should contain "saw"');
  });

  it('8. contains "heard" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"heard"'), 'Should contain "heard"');
  });

  it('9. contains "seemed" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"seemed"'), 'Should contain "seemed"');
  });

  it('10. contains "wondered" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"wondered"'), 'Should contain "wondered"');
  });

  it('11. contains "knew" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"knew"'), 'Should contain "knew"');
  });

  it('12. contains "understood" target verb', () => {
    assert.ok(FILTER_VERB_TARGETING_BLOCK.includes('"understood"'), 'Should contain "understood"');
  });
});

describe('FILTER_VERB_TARGETING_BLOCK — Exception & Rate Guidance', () => {
  it('13. contains "Do NOT mechanically" exception instruction', () => {
    assert.ok(
      FILTER_VERB_TARGETING_BLOCK.includes('Do NOT mechanically'),
      'Should contain exception instruction about not mechanically stripping verbs',
    );
  });

  it('14. contains "dialogue" exception', () => {
    assert.ok(
      FILTER_VERB_TARGETING_BLOCK.includes('dialogue'),
      'Should mention dialogue as an exception context',
    );
  });

  it('15. contains "1-2 per 500 words" rate guidance', () => {
    assert.ok(
      FILTER_VERB_TARGETING_BLOCK.includes('1-2 per 500 words'),
      'Should contain rate guidance of 1-2 per 500 words',
    );
  });
});
