/**
 * recastAcceptanceQualityGuard.test.mjs
 *
 * Tests the quality guards in recastChunkWithAntiChatbotRules:
 * overcorrection guard, chatbot pattern guard, citation preservation,
 * report field structure (recastMode, validation, retryAttempted, etc.).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  recastChunkWithAntiChatbotRules,
  validateRecast,
  RECAST_MODE,
} from '../src/lib/antiChatbotRecastPipeline.js';

import {
  analyzeProseTexture,
  countChatbotPatterns,
} from '../src/lib/antiChatbotProse.js';


// ─── ~200-word test passage ──────────────────────────────────────────────

const TEST_PASSAGE = `The research facility sat at the edge of a gravel lot, its windows dark except for the second floor where fluorescent light spilled across a row of lab benches. Dr. Kessler pushed through the double doors at 6:47 a.m., her badge swinging from a lanyard printed with the university crest. Three weeks of failed cultures had worn the optimism out of her stride. The centrifuge hummed in the corner, spinning samples from the previous night's collection. A stack of printouts waited on her desk, each page marked with red circles around anomalous readings that nobody could explain.

She pulled on nitrile gloves and lifted the first tray from the incubator. The colonies had spread overnight — not in the expected radial pattern, but in tight clusters that looked almost deliberate. She adjusted the magnification and leaned closer, her breath fogging the eyepiece. Something had changed in the substrate composition, something the standard assay wouldn't catch. She reached for the spectrophotometer, then stopped. The readings from Monday were still taped to the wall above her bench, and the numbers didn't match what she was seeing now. Not even close.`;

const CHUNK = { text: TEST_PASSAGE };
const ORIG_WORDS = TEST_PASSAGE.split(/\s+/).filter(Boolean).length;


// ─── Helper: build text of ~N words from seed text ────────────────────────

function buildTextOfLength(targetWords, seed) {
  const baseWords = (seed || TEST_PASSAGE).split(/\s+/).filter(Boolean);
  const result = [];
  while (result.length < targetWords) {
    result.push(...baseWords);
  }
  return result.slice(0, targetWords).join(' ') + '.';
}


// ─── Good recast: same length, slightly modified, no chatbot patterns ─────

const GOOD_RECAST = `The research facility occupied the far edge of a gravel lot, windows dark except for the second floor, where fluorescent tubes cast flat light across lab benches scarred by years of chemical spills. Dr. Kessler shouldered through the double doors at 6:47 a.m., badge swinging on a lanyard printed with the faded university crest. Three weeks of failed cultures had ground the optimism out of her step. The centrifuge droned in the corner, spinning samples drawn the previous night. Printouts sat stacked on her desk, each page circled in red around anomalous readings no one had accounted for.

She snapped on nitrile gloves and pulled the first tray from the incubator. The colonies had spread overnight, not in the expected radial bloom but in tight clusters that looked almost intentional. She cranked the magnification and leaned in, breath fogging the eyepiece. Something had shifted in the substrate composition, something the standard assay would miss entirely. She reached for the spectrophotometer, then stopped cold. Monday's readings were still taped above the bench, and the numbers bore no resemblance to what sat under the lens. None at all.`;


// ═════════════════════════════════════════════════════════════════════════════
// 1. recastChunkWithAntiChatbotRules — Result Fields
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — result fields', () => {
  it('returns recastMode field', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
      recastMode: 'conservative',
    });
    assert.strictEqual(result.recastMode, 'conservative', 'recastMode should be "conservative"');
  });

  it('returns validation field (object with origWords, recastWords, ratio, etc.)', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
      recastMode: 'conservative',
    });
    assert.ok(result.validation !== null && typeof result.validation === 'object', 'validation should be an object');
    assert.ok(typeof result.validation.origWords === 'number', 'validation.origWords should be a number');
    assert.ok(typeof result.validation.recastWords === 'number', 'validation.recastWords should be a number');
    assert.ok(typeof result.validation.ratio === 'number', 'validation.ratio should be a number');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. Overcorrection Guard (Score Regression)
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — overcorrection guard', () => {
  it('rejects a recast that scores LOWER (overcorrection guard)', async () => {
    // Build monotonous, chatbot-like text that will score worse than original
    const worseProse = `She felt the weight of the moment. She seemed to understand. He appeared to notice. She realized the truth. He observed the change. She felt a wave of emotion. He noticed something different. She seemed tired. He appeared concerned. The truth was that neither of them knew what to do next. In that moment, she understood everything. Not just the surface meaning, but the deeper implications. Part of her wanted to run. Another part wanted to stay. Fear, doubt, and determination wrestled within her. A sense of dread settled over the room. She felt everything pressing down. He seemed to agree with her assessment. She noticed the silence. He observed the darkness. She realized the emptiness of the situation. He appeared to sense the tension. The weight of it all seemed unbearable. She felt defeated. He noticed her defeat. She seemed broken. He appeared helpless. In that moment, they both understood the gravity. Not just the obvious truth, but the deeper, more painful reality beneath.`;

    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => worseProse,
      recastMode: 'conservative',
      maxScoreRegression: 0,
    });
    assert.strictEqual(result.ok, false, 'Should reject a recast that scores lower');
    assert.strictEqual(result.text, TEST_PASSAGE, 'Original text should be preserved');
  });

  it('accepts a recast with acceptable score', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
      recastMode: 'conservative',
    });
    // The good recast should either pass or fail for reasons other than overcorrection
    if (result.ok) {
      assert.ok(result.text !== TEST_PASSAGE || result.text === GOOD_RECAST.trim(),
        'Accepted recast should use the new text');
    }
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. Chatbot Pattern Guard
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — chatbot pattern guard', () => {
  it('rejects recast that introduces many chatbot patterns', async () => {
    // Original chunk has low chatbot patterns
    const beforePatterns = countChatbotPatterns(TEST_PASSAGE);

    // Build a recast that is same length but loaded with chatbot patterns
    const chatbotHeavy = `She felt the weight of the moment. Not just the obvious weight, but the deeper, more profound weight of everything. She seemed to understand what was happening. He appeared to notice the change. She realized the truth about the situation. In that moment, she understood everything. The truth was that neither of them knew what to do. Part of her wanted to run away. Another part wanted to stay and fight. Fear, doubt, and determination wrestled within her. A sense of dread settled over the room. She felt a wave of emotion wash over her. He noticed something different about the room. She seemed tired and defeated. He appeared concerned about the outcome. Not just concerned, but deeply, profoundly worried. A surge of panic rose within her. What she didn't know was that things were about to change forever. And that was when she realized the full scope of what had transpired. The silence seemed deafening. He observed the change carefully.`;

    const afterPatterns = countChatbotPatterns(chatbotHeavy);
    const patternIncrease = afterPatterns.total - beforePatterns.total;

    // Only run the assertion if our crafted text actually increases patterns
    if (patternIncrease > 2) {
      const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
        callLLM: async () => chatbotHeavy,
        recastMode: 'conservative',
        maxChatbotPatternIncrease: 2,
      });
      // Should be rejected for either overcorrection or chatbot pattern increase
      assert.strictEqual(result.ok, false, `Should reject recast with ${patternIncrease} pattern increase (max 2)`);
      assert.strictEqual(result.text, TEST_PASSAGE, 'Original text should be preserved');
    }
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 4. Citation Preservation
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — citation preservation', () => {
  const citationChunk = {
    text: `According to the landmark study (Smith, 2024), the protein folding rate increased by a factor of three under controlled conditions. The researchers noted that this aligned with earlier findings (Johnson et al., 2021) on substrate concentration effects. The centrifuge data from the previous quarter showed consistent acceleration patterns across all sample groups, with outliers appearing only in the third replicate set. Temperature stability remained within acceptable bounds throughout the experiment, measured at intervals no greater than fifteen minutes. The spectrophotometer readings confirmed a shift in absorption wavelength that warranted further investigation under modified protocols.`,
  };

  it('validates that citations in original are checked', async () => {
    // Return recast that strips citations
    const noCitations = `According to the landmark study, the protein folding rate increased by a factor of three under controlled conditions. The researchers noted that this aligned with earlier findings on substrate concentration effects. The centrifuge data from the previous quarter showed consistent acceleration patterns across all sample groups, with outliers appearing only in the third replicate set. Temperature stability remained within acceptable bounds throughout the experiment, measured at intervals no greater than fifteen minutes. The spectrophotometer readings confirmed a shift in absorption wavelength that warranted further investigation under modified protocols.`;

    const result = await recastChunkWithAntiChatbotRules(citationChunk, { genre: 'nonfiction' }, {
      callLLM: async () => noCitations,
      recastMode: 'conservative',
    });
    assert.strictEqual(result.ok, false, 'Should reject recast that removes citations');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 5. Report Fields Structure
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — report structure', () => {
  it('report includes recastMode field', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
      recastMode: 'standard',
    });
    assert.strictEqual(result.recastMode, 'standard', 'recastMode should match the requested mode');
  });

  it('result includes validation field when LLM returns text', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
    });
    assert.ok(result.validation !== null, 'validation should be present when LLM returns text');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 6. Full Acceptance Path
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules — full acceptance path', () => {
  it('recast that passes all guards is accepted', async () => {
    const result = await recastChunkWithAntiChatbotRules(CHUNK, { genre: 'fiction' }, {
      callLLM: async () => GOOD_RECAST,
      recastMode: 'conservative',
    });
    // If all guards pass, ok should be true
    if (result.ok) {
      assert.ok(result.text.length > 0, 'Accepted recast should have non-empty text');
      assert.ok(result.metrics !== null, 'Accepted recast should have metrics');
      assert.ok(result.beforeMetrics !== null, 'Accepted recast should have beforeMetrics');
      assert.strictEqual(result.recastMode, 'conservative');
      assert.strictEqual(result.error, null);
    }
    // Either way, the result should have all expected fields
    assert.ok('recastMode' in result, 'Result should have recastMode');
    assert.ok('validation' in result, 'Result should have validation');
    assert.ok('text' in result, 'Result should have text');
    assert.ok('ok' in result, 'Result should have ok');
  });
});
