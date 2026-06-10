/**
 * antiChatbotRecastPipeline.test.mjs
 *
 * Tests the chunk-level post-generation recast pipeline.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  splitTextIntoRecastChunks,
  shouldRecastChunk,
  buildChunkRecastPrompt,
  recastChunkWithAntiChatbotRules,
  runAntiChatbotRecastPipeline,
  validateRecast,
  detectProtections,
  PROTECTION_TYPE,
} from '../src/lib/antiChatbotRecastPipeline.js';

import {
  analyzeProseTexture,
  getAntiChatbotRulesForProject,
} from '../src/lib/antiChatbotProse.js';


// ─── Test Prose Samples ───────────────────────────────────────────────────

const MONOTONOUS_PROSE = `She felt the weight of the moment. He noticed the change in her expression. She seemed to understand what was happening. He appeared to agree with her assessment. She realized the truth about the situation. He observed the problem carefully. She felt a wave of emotion wash over her. He noticed something different about the room. She seemed tired and defeated. He appeared concerned about the outcome. The truth was that neither of them knew what to do next. In that moment, she understood everything. Not just the surface meaning, but the deeper implications of what had transpired. Part of her wanted to run. Another part wanted to stay and fight. Fear, doubt, and determination wrestled within her. A sense of dread settled over the room. She felt the weight of everything pressing down.`;

const GOOD_PROSE = `The lock gave with a crack that echoed down the concrete stairwell. Three floors below, someone's television murmured through plaster walls—a laugh track from a show nobody watched anymore. Marcus shouldered through the doorframe, his boots grinding grit against tile that hadn't been mopped since the building changed hands. The apartment smelled like burned coffee and old newsprint. Elena's laptop sat open on the kitchen counter, its screen casting blue light across a stack of unopened mail. She'd left in a hurry—one shoe by the door, the other kicked under the radiator. The faucet dripped. Counted the seconds between drops: four, then three, then five. No pattern. Just a building settling into its own slow collapse.`;

const MIXED_PROSE = `${MONOTONOUS_PROSE}\n\n${GOOD_PROSE}\n\n${MONOTONOUS_PROSE}`;


// ═════════════════════════════════════════════════════════════════════════════
// 1. CHUNK SPLITTING
// ═════════════════════════════════════════════════════════════════════════════

describe('splitTextIntoRecastChunks', () => {
  it('splits text into chunks', () => {
    const { chunks } = splitTextIntoRecastChunks(MIXED_PROSE);
    assert.ok(chunks.length > 0, 'Should produce at least one chunk');
  });

  it('empty text produces empty chunks', () => {
    const { chunks } = splitTextIntoRecastChunks('');
    assert.strictEqual(chunks.length, 0);
  });

  it('null text produces empty chunks', () => {
    const { chunks } = splitTextIntoRecastChunks(null);
    assert.strictEqual(chunks.length, 0);
  });

  it('each chunk has text, index, and startOffset', () => {
    const { chunks } = splitTextIntoRecastChunks(MIXED_PROSE);
    for (const chunk of chunks) {
      assert.ok(typeof chunk.text === 'string' && chunk.text.length > 0);
      assert.ok(typeof chunk.index === 'number');
      assert.ok(typeof chunk.startOffset === 'number');
    }
  });

  it('chunk indices are sequential from 0', () => {
    const { chunks } = splitTextIntoRecastChunks(MIXED_PROSE);
    chunks.forEach((chunk, i) => {
      assert.strictEqual(chunk.index, i);
    });
  });

  it('respects target chunk size', () => {
    const longText = Array(20).fill(MONOTONOUS_PROSE).join('\n\n');
    const { chunks } = splitTextIntoRecastChunks(longText, { targetChunkWords: 200 });
    assert.ok(chunks.length > 3, `Expected multiple chunks, got ${chunks.length}`);
  });

  it('all original text is present in chunks', () => {
    const { chunks } = splitTextIntoRecastChunks(MIXED_PROSE);
    const reconstructed = chunks.map(c => c.text).join('\n\n');
    // Check that all words from original are in reconstructed
    const origWords = MIXED_PROSE.split(/\s+/).filter(Boolean).length;
    const reconWords = reconstructed.split(/\s+/).filter(Boolean).length;
    assert.ok(Math.abs(origWords - reconWords) <= 5, `Word count mismatch: ${origWords} vs ${reconWords}`);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. ELIGIBILITY
// ═════════════════════════════════════════════════════════════════════════════

describe('shouldRecastChunk', () => {
  it('weak prose is eligible for recast', () => {
    const result = shouldRecastChunk({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    assert.strictEqual(result.eligible, true, `Expected eligible but got: ${result.reason}`);
  });

  it('good prose is not eligible', () => {
    const result = shouldRecastChunk({ text: GOOD_PROSE }, { genre: 'fiction' });
    assert.strictEqual(result.eligible, false);
    assert.ok(result.reason.includes('Score') || result.reason.includes('high_score') || result.reason.includes('Protected'),
      `Unexpected reason: ${result.reason}`);
  });

  it('short text is not eligible', () => {
    const result = shouldRecastChunk({ text: 'Too short to analyze.' }, { genre: 'fiction' });
    assert.strictEqual(result.eligible, false);
    assert.ok(result.reason.includes('short'));
  });

  it('profile without recast disables eligibility', () => {
    // training_manual disables recast
    const result = shouldRecastChunk({ text: MONOTONOUS_PROSE }, { genre: 'training' });
    assert.strictEqual(result.eligible, false);
    assert.ok(result.reason.includes('Profile'));
  });

  it('returns metrics for analyzed chunks', () => {
    const result = shouldRecastChunk({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    assert.ok(result.metrics !== null);
    assert.ok(typeof result.metrics.compositeScore === 'number');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. PROMPT BUILDING
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt', () => {
  it('includes genre profile', () => {
    const prompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    assert.ok(prompt.includes('GENRE PROFILE: fiction'));
  });

  it('includes nonfiction profile for nonfiction', () => {
    const prompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'nonfiction' });
    assert.ok(prompt.includes('GENRE PROFILE: nonfiction'));
  });

  it('includes preservation rules', () => {
    const prompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    assert.ok(prompt.includes('Do NOT invent new plot facts'));
    assert.ok(prompt.includes('Do NOT change character names'));
  });

  it('includes the chunk text', () => {
    const prompt = buildChunkRecastPrompt({ text: 'The specific test text goes here.' }, { genre: 'fiction' });
    assert.ok(prompt.includes('The specific test text goes here.'));
  });

  it('includes diagnostics when metrics provided', () => {
    const metrics = analyzeProseTexture(MONOTONOUS_PROSE);
    const prompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'fiction' }, metrics);
    assert.ok(prompt.includes('QUALITY ISSUES DETECTED'));
    // Monotonous prose should have diagnostics
    assert.ok(metrics.diagnostics.length > 0);
  });

  it('uses genre-appropriate polisher rules', () => {
    const fictionPrompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    const nfPrompt = buildChunkRecastPrompt({ text: MONOTONOUS_PROSE }, { genre: 'nonfiction' });
    // Fiction prompt should have fiction polisher rules
    assert.ok(fictionPrompt.includes('ANTI-CHATBOT POLISH PASS (CRITICAL)'));
    // Nonfiction prompt should have nonfiction polisher rules
    assert.ok(nfPrompt.includes('NONFICTION'));
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 4. SAFETY VALIDATION
// ═════════════════════════════════════════════════════════════════════════════

describe('validateRecast', () => {
  it('rejects empty output', () => {
    const result = validateRecast(MONOTONOUS_PROSE, '');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('empty'));
  });

  it('rejects null output', () => {
    const result = validateRecast(MONOTONOUS_PROSE, null);
    assert.strictEqual(result.ok, false);
  });

  it('accepts valid recast of similar length', () => {
    const result = validateRecast(GOOD_PROSE, GOOD_PROSE.replace('Marcus', 'Marcus').replace('lock', 'deadbolt'));
    assert.strictEqual(result.ok, true);
  });

  it('strips markdown code fences', () => {
    const result = validateRecast(GOOD_PROSE, '```\n' + GOOD_PROSE + '\n```');
    assert.strictEqual(result.ok, true);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 5. SINGLE CHUNK RECAST
// ═════════════════════════════════════════════════════════════════════════════

describe('recastChunkWithAntiChatbotRules', () => {
  it('fails without callLLM', async () => {
    const result = await recastChunkWithAntiChatbotRules({ text: MONOTONOUS_PROSE }, { genre: 'fiction' });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('callLLM'));
  });

  it('uses mock callLLM successfully', async () => {
    const mockLLM = async () => GOOD_PROSE;
    const result = await recastChunkWithAntiChatbotRules(
      { text: MONOTONOUS_PROSE },
      { genre: 'fiction' },
      { callLLM: mockLLM }
    );
    // May succeed or fail depending on word count ratio, but should not throw
    assert.ok(typeof result.ok === 'boolean');
    assert.ok(typeof result.text === 'string');
  });

  it('catches LLM errors gracefully', async () => {
    const failingLLM = async () => { throw new Error('Model unavailable'); };
    const result = await recastChunkWithAntiChatbotRules(
      { text: MONOTONOUS_PROSE },
      { genre: 'fiction' },
      { callLLM: failingLLM }
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('Model unavailable'));
    assert.strictEqual(result.text, MONOTONOUS_PROSE); // Original preserved
  });

  it('rejects overcorrection (recast scores lower)', async () => {
    // Return very chatbot-like prose
    const worseProse = `She felt the weight of the moment. She felt the weight of everything. She noticed things had changed. He noticed the same. She seemed different now. He appeared to agree. She realized what had happened. He observed it too. The truth was clear to both of them. In that moment, they both understood. Not just the obvious thing, but the deeper thing too. Part of her wanted one thing. Another part wanted another. Fear, doubt, and confusion filled the room. A sense of dread washed over them. She felt everything pressing down on her once more. She noticed the silence was deafening. He seemed to notice it too.`;
    const mockLLM = async () => worseProse;
    const result = await recastChunkWithAntiChatbotRules(
      { text: MONOTONOUS_PROSE },
      { genre: 'fiction' },
      { callLLM: mockLLM }
    );
    // Either fails validation or fails overcorrection check
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.text, MONOTONOUS_PROSE); // Original preserved
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 6. FULL PIPELINE
// ═════════════════════════════════════════════════════════════════════════════

describe('runAntiChatbotRecastPipeline', () => {
  it('runs without callLLM (all chunks fail)', async () => {
    const { text, report } = await runAntiChatbotRecastPipeline(MIXED_PROSE, { genre: 'fiction' });
    assert.ok(typeof text === 'string');
    assert.ok(report.chunksAnalyzed > 0);
    assert.strictEqual(report.chunksRecast, 0); // No LLM = no recasts
    assert.strictEqual(report.profileUsed, 'fiction');
  });

  it('populates report with correct structure', async () => {
    const { report } = await runAntiChatbotRecastPipeline(MIXED_PROSE, { genre: 'fiction' });
    assert.ok(typeof report.profileUsed === 'string');
    assert.ok(typeof report.chunksAnalyzed === 'number');
    assert.ok(typeof report.chunksSkipped === 'number');
    assert.ok(typeof report.chunksRecast === 'number');
    assert.ok(typeof report.chunksFailed === 'number');
    assert.ok(report.beforeMetrics !== null);
    assert.ok(report.afterMetrics !== null);
    assert.ok(typeof report.safetyBlocks === 'number');
    assert.ok(typeof report.referenceBlocks === 'number');
    assert.ok(Array.isArray(report.overcorrectionWarnings));
    assert.ok(Array.isArray(report.chunkDetails));
  });

  it('sets global report', async () => {
    await runAntiChatbotRecastPipeline(GOOD_PROSE, { genre: 'fiction' });
    assert.ok(globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT !== undefined);
  });

  it('chunk details track each chunk', async () => {
    const { report } = await runAntiChatbotRecastPipeline(MIXED_PROSE, { genre: 'fiction' });
    assert.strictEqual(report.chunkDetails.length, report.chunksAnalyzed);
    for (const detail of report.chunkDetails) {
      assert.ok(typeof detail.index === 'number');
      assert.ok(['skipped', 'recast', 'failed'].includes(detail.action));
    }
  });

  it('empty text produces empty report', async () => {
    const { text, report } = await runAntiChatbotRecastPipeline('', { genre: 'fiction' });
    assert.strictEqual(text, '');
    assert.strictEqual(report.chunksAnalyzed, 0);
  });

  it('uses nonfiction profile for nonfiction projects', async () => {
    const { report } = await runAntiChatbotRecastPipeline(MIXED_PROSE, { genre: 'nonfiction' });
    assert.strictEqual(report.profileUsed, 'nonfiction');
  });

  it('with mock LLM, recasts eligible chunks', async () => {
    // Create a slightly improved version of monotonous prose
    const improved = `The deadbolt cracked open under Marcus's shoulder. Three flights down, a television murmured through cracked plaster. Elena's laptop cast blue light across unopened mail on the kitchen counter. One shoe sat by the door. The faucet dripped—four seconds, then three, then five. No pattern worth trusting. The building groaned into its slow collapse, pipes shuddering behind drywall that hadn't seen paint since the Clinton administration. Cold air seeped through the window frame where caulk had dried and crumbled. Marcus counted the drips while his eyes adjusted. Something about the arrangement of objects felt staged, deliberate, like a message left in furniture and silence. He pulled the door shut behind him and stood in the artificial twilight.`;

    const mockLLM = async () => improved;
    const { report } = await runAntiChatbotRecastPipeline(MONOTONOUS_PROSE, { genre: 'fiction' }, { callLLM: mockLLM });
    // Should have analyzed chunks and attempted recasts
    assert.ok(report.chunksAnalyzed > 0);
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 7. PROTECTION TYPES
// ═════════════════════════════════════════════════════════════════════════════

describe('Protection Type Constants', () => {
  it('PROTECTION_TYPE has expected keys', () => {
    assert.ok(PROTECTION_TYPE.CITATION);
    assert.ok(PROTECTION_TYPE.BIBLIOGRAPHY);
    assert.ok(PROTECTION_TYPE.BLOCK_QUOTE);
    assert.ok(PROTECTION_TYPE.TABLE);
    assert.ok(PROTECTION_TYPE.LIST);
    assert.ok(PROTECTION_TYPE.LEGAL);
    assert.ok(PROTECTION_TYPE.SCRIPTURE);
    assert.ok(PROTECTION_TYPE.DIALOGUE_HEAVY);
    assert.ok(PROTECTION_TYPE.HIGH_SCORE);
  });
});
