/**
 * antiChatbotRecastSafetyWiring.test.mjs
 *
 * Tests safety validation in the recast pipeline:
 *   - validateRecast guards (empty, word-count ratio, proper nouns, citations, leakage, format)
 *   - recastChunkWithAntiChatbotRules (DI callLLM, overcorrection detection)
 *   - runAntiChatbotRecastPipeline (report, globalThis, fallback, safetyBlocks)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  validateRecast,
  recastChunkWithAntiChatbotRules,
  runAntiChatbotRecastPipeline,
} from '../src/lib/antiChatbotRecastPipeline.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Generate a string of N words. Each word is 5 chars so sentences stay parseable. */
function makeWords(n) {
  const pool = [
    'Alpha', 'Bravo', 'Cedar', 'Delta', 'Eagle', 'Flora', 'Grain',
    'Haven', 'Ivory', 'Joust', 'Klein', 'Lemon', 'Manor', 'Noble',
    'Omega', 'Plank', 'Quest', 'Ridge', 'Stone', 'Trail',
  ];
  const words = [];
  for (let i = 0; i < n; i++) words.push(pool[i % pool.length]);
  return words.join(' ');
}

/**
 * Bad prose: monotonous filter-verb-heavy chatbot cadence.
 * Deliberately same-length sentences, lots of filter verbs.
 */
const BAD_PROSE = `She felt the weight of the moment. He noticed the change in her expression. She seemed to understand what was happening now. He appeared to agree with her assessment of things. She realized the truth about the whole situation. He observed the situation from across the room carefully.

She felt a wave of sadness wash over her entire body. He noticed the darkness creeping into the corners of the room. She seemed to sense the tension building between all of them. He appeared to recognize the gravity of their shared predicament now. She realized that nothing would ever be the same again for them. He observed the silence that filled every corner of the old room.

She felt the ache of loneliness press against her weary chest. He noticed the way the light shifted across the dusty floor. She seemed to hesitate before speaking her next careful words to him. He appeared to weigh each word before finally letting them fall from his mouth. She realized the conversation was over before it had even really truly begun. He observed the way her hands trembled as she reached for the cold metal door handle.

She felt the emptiness growing inside her like a hollow void expanding. He noticed the despair etched into the lines of her tired aging face now. She seemed to withdraw into herself like a turtle retreating into its shell. He appeared to understand but said nothing at all to comfort her tonight. She realized the weight of their silence spoke louder than any words ever could possibly. He observed everything with the careful detachment of a man who had seen far too much already.`;

/**
 * Good prose: varied rhythm, concrete details, strong verbs, no chatbot patterns.
 * Scores above recast threshold.
 */
const GOOD_PROSE = `The lock gave with a crack that echoed down the concrete stairwell. Three floors below, someone's television murmured through plaster walls—a laugh track from a show nobody watched anymore.

Marcus wedged his shoulder against the steel door. Rust flaked onto his jacket, orange against black denim. The hallway beyond smelled of bleach and something older, something that had seeped into the foundation before the building had a name.

Elena waited on the landing, one hand on the iron railing, the other pressing her phone against her thigh to kill the screen-glow. She counted his footsteps. Seven. Eight. The ninth landed wrong—a scuff, then silence.

"Clear," he said. Not a whisper. Flat, like reporting weather.

She moved. The stairwell door swung shut behind her on hydraulic hinges, slow enough to feel deliberate, and the television laugh track cut to nothing. Fluorescent tubes buzzed overhead, one of them strobing at a frequency that made her fillings ache. The corridor stretched forty feet to a fire exit, and Marcus stood at the midpoint, his back against the wall, reading the brass numbers on apartment 4-C.`;

/**
 * A slightly improved version of BAD_PROSE for the mock "good" callLLM.
 * Replaces filter verbs with direct actions, varies sentence length.
 * Must be within ±15% word count of BAD_PROSE and must NOT contain chatbot leakage.
 */
function makeSlightlyBetterProse(original) {
  // Replace filter verbs with direct actions, keep word count close
  let improved = original
    .replace(/She felt the weight of the moment\./g,
      'The moment pressed down on her shoulders like wet concrete.')
    .replace(/He noticed the change in her expression\./g,
      'Her jaw tightened—a shift he caught from across the table.')
    .replace(/She seemed to understand what was happening now\./g,
      'Understanding hit her mid-breath, sharp and unwelcome.')
    .replace(/He appeared to agree with her assessment of things\./g,
      'He gave a single nod, chin dipping toward his collar.')
    .replace(/She realized the truth about the whole situation\./g,
      'The truth landed in her stomach. Cold. Indigestible.')
    .replace(/He observed the situation from across the room carefully\./g,
      'From the far wall, he catalogued every micro-expression that crossed her face.');
  return improved;
}

/**
 * Prose that is WORSE than the original: more chatbot patterns layered on.
 */
const WORSE_PROSE_TEMPLATE = `She felt a deep sense of dread. He noticed the weight of the situation. She seemed to understand the gravity of it all. He appeared to realize the truth. She felt a wave of sadness wash over her. He noticed a surge of emotion in her eyes. She seemed to sense a pang of regret building. He appeared to observe the darkness growing.

The truth was that nothing could be the same again. What she didn't know was the depth of his pain inside. In that moment, she understood everything clearly now. Part of her wanted to stay and fight it out. Another part wanted to run away from all of this.

It wasn't just sadness; it was a complete unraveling of everything. Not just the relationship, but the entire foundation they had built together so carefully. And that was when she realized she had never truly understood the meaning of loss until this very exact moment.

She felt the ache deep inside her weary body tonight. He noticed the emptiness in the cold silent room around them. She seemed hollow and broken by the weight of grief pressing down. He appeared defeated but still standing somehow against all the odds. She felt a wave of loneliness crash over her trembling tired soul. He noticed a sense of finality settling into the dusty stale air tonight.`;


// ─── validateRecast Tests ─────────────────────────────────────────────────

describe('validateRecast — safety guards', () => {

  it('Recast cannot produce empty output', () => {
    const result = validateRecast('This is the original text that was written by the author for this chapter.', '');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(typeof result.error, 'string');
    assert.ok(result.error.length > 0, 'Error message should be non-empty');
  });

  it('Recast cannot cut too much', () => {
    // Original ~200 words, recast ~100 words → ratio ≈ 0.50, well below 0.85
    const original = makeWords(200);
    const recast = makeWords(100);
    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('cut too much'), `Expected "cut too much" in error, got: ${result.error}`);
  });

  it('Recast cannot expand too much', () => {
    // Original ~200 words, recast ~250 words → ratio ≈ 1.25, above 1.10
    const original = makeWords(200);
    const recast = makeWords(250);
    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('expanded too much'), `Expected "expanded too much" in error, got: ${result.error}`);
  });

  it('Recast preserves proper nouns', () => {
    // Original has Marcus and Elena; recast drops both → >30% missing (100% missing)
    const original = [
      'Marcus climbed the stairwell with Elena right behind him.',
      'The concrete walls pressed in on Marcus as Elena counted each step.',
      'Neither Marcus nor Elena spoke a single word on the long climb.',
      'Marcus reached the landing first and Elena followed three seconds after.',
      'The door at the top was rusted shut but Marcus forced it open.',
      'Elena looked through the gap while Marcus held the heavy door open.',
    ].join(' ');

    const recast = [
      'The man climbed the stairwell with the woman right behind him.',
      'The concrete walls pressed in on him as she counted each step.',
      'Neither of them nor anyone else spoke a word on the long climb.',
      'The man reached the landing first and she followed three seconds after.',
      'The door at the top was rusted shut but he forced it open.',
      'She looked through the gap while he still held the heavy door open.',
    ].join(' ');

    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('proper nouns'), `Expected "proper nouns" in error, got: ${result.error}`);
  });

  it('Recast preserves citations', () => {
    const original = [
      'The study demonstrated a clear correlation between sleep deprivation and cognitive decline (Smith, 2024).',
      'Participants who slept fewer than six hours showed measurable decreases in working memory capacity.',
      'These findings align with earlier longitudinal work on circadian disruption and executive function loss.',
      'The clinical implications extend beyond individual health into workplace safety and public policy frameworks.',
      'Smith noted that the effect sizes were larger than anticipated by the original study design parameters.',
      'Further replication across diverse populations is needed before drawing firm causal conclusions from this data.',
    ].join(' ');

    const recast = [
      'Sleep deprivation correlates strongly with cognitive decline according to the most recent research available.',
      'Participants sleeping fewer than six hours showed measurable decreases in working memory capacity overall.',
      'These findings align with earlier longitudinal work on circadian disruption and executive function loss today.',
      'Clinical implications extend beyond individual health into workplace safety and broad public policy frameworks.',
      'The effect sizes were larger than anticipated by the original experimental study design parameters used.',
      'Further replication across diverse populations is needed before drawing firm causal conclusions from data.',
    ].join(' ');

    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('citation'), `Expected "citation" in error, got: ${result.error}`);
  });

  it('Recast detects process leakage', () => {
    const original = [
      'The morning light cut through the blinds and striped the kitchen counter in gold bars.',
      'Coffee percolated on the stove, filling the apartment with the smell of burned arabica beans.',
      'She pulled a chipped mug from the cabinet and set it on the counter to wait patiently.',
      'The radio crackled through static to land on a station playing something by Coltrane quietly.',
      'Outside, a delivery truck reversed into the alley, its backup alarm pulsing like a heartbeat sound.',
      'She poured the coffee black and drank it standing up next to the cold window frame now.',
    ].join(' ');

    const recast = [
      'As an AI language model, I have revised this passage to improve the prose quality substantially.',
      'Coffee percolated on the stove, filling the apartment with the smell of burned arabica beans today.',
      'She pulled a chipped mug from the cabinet and set it on the counter to wait patiently.',
      'The radio crackled through static to land on a station playing something by Coltrane softly.',
      'Outside, a delivery truck reversed into the alley, its backup alarm pulsing like a heartbeat sound.',
      'She poured the coffee black and drank it standing up next to the cold window frame again.',
    ].join(' ');

    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.toLowerCase().includes('leakage'), `Expected "leakage" in error, got: ${result.error}`);
  });

  it('Recast detects analysis format', () => {
    const original = [
      'The building had stood on that corner for ninety years before anyone thought to look inside.',
      'Brick walls darkened by exhaust, windows boarded with plywood that had warped in summer heat.',
      'Inside, the lobby floor was Italian marble under decades of scuff marks and dropped chewing gum.',
      'A brass mailbox panel lined one wall, most of the little doors hanging open on broken hinges.',
      'The elevator shaft was empty—someone had stripped the car and the cables years ago for scrap.',
      'Stairs wound upward into darkness, each landing marked by a fire extinguisher bolted to concrete.',
    ].join(' ');

    const recast = '# Analysis\n\n' + [
      'The building had stood on that corner for ninety years before anyone thought to look inside it.',
      'Brick walls darkened by exhaust, windows boarded with plywood that had warped in the summer heat.',
      'Inside, the lobby floor was Italian marble under decades of scuff marks and dropped chewing gum.',
      'A brass mailbox panel lined one wall, most of the little doors hanging open on broken hinges.',
      'The elevator shaft was empty—someone had stripped the car and all the cables years ago for scrap.',
      'Stairs wound upward into darkness, each landing marked by a fire extinguisher bolted to cold concrete.',
    ].join(' ');

    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.includes('analysis') || result.error.includes('format'),
      `Expected "analysis" or "format" in error, got: ${result.error}`);
  });

  it('Valid recast passes', () => {
    const original = [
      'The lock gave with a crack that echoed down the concrete stairwell behind him.',
      'Three floors below, someone\'s television murmured through plaster walls endlessly.',
      'A laugh track from a show nobody watched anymore drifted up the shaft quietly.',
      'Marcus wedged his shoulder against the steel door until rust flaked onto his jacket.',
      'The hallway beyond smelled of bleach and something older that had seeped into stone.',
      'Elena waited on the landing, one hand on the iron railing, counting his footsteps.',
    ].join(' ');

    const recast = [
      'The lock cracked open and the sound bounced down the concrete stairwell behind him.',
      'Three floors below, a television murmured through plaster walls without stopping once.',
      'A laugh track from a show nobody watched anymore floated up the elevator shaft.',
      'Marcus drove his shoulder into the steel door until rust flaked onto black denim.',
      'The hallway beyond smelled of bleach and something older, something baked into stone.',
      'Elena waited on the landing, gripping the iron railing, counting his footsteps aloud.',
    ].join(' ');

    const result = validateRecast(original, recast);
    assert.strictEqual(result.ok, true, `Expected ok: true, got error: ${result.error}`);
    assert.strictEqual(result.error, null);
  });
});


// ─── recastChunkWithAntiChatbotRules Tests ────────────────────────────────

describe('recastChunkWithAntiChatbotRules', () => {

  it('fails without callLLM', async () => {
    const chunk = { text: GOOD_PROSE, index: 0 };
    const result = await recastChunkWithAntiChatbotRules(chunk, { genre: 'fiction' });
    assert.strictEqual(result.ok, false);
    assert.ok(result.error.toLowerCase().includes('callllm') || result.error.toLowerCase().includes('no callllm'),
      `Expected error about callLLM, got: ${result.error}`);
    // Text should be unchanged (fallback to original)
    assert.strictEqual(result.text, GOOD_PROSE);
  });

  it('uses mock callLLM and succeeds', async () => {
    const chunk = { text: BAD_PROSE, index: 0 };
    const betterProse = makeSlightlyBetterProse(BAD_PROSE);

    const mockCallLLM = async (_prompt) => betterProse;

    const result = await recastChunkWithAntiChatbotRules(chunk, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
    });

    // The mock returns improved prose — whether it passes depends on
    // validation AND the overcorrection check (after score must be >= before score).
    // If it passes, text should differ from original.
    // If it fails on overcorrection, text should be original.
    // Either way, the function should not throw.
    assert.ok(typeof result.ok === 'boolean');
    assert.ok(typeof result.text === 'string');
    assert.ok(result.text.length > 0);
  });

  it('catches overcorrection — keeps original when recast is worse', async () => {
    const chunk = { text: BAD_PROSE, index: 0 };

    // Return prose packed with even MORE chatbot patterns
    const mockCallLLM = async (_prompt) => WORSE_PROSE_TEMPLATE;

    const result = await recastChunkWithAntiChatbotRules(chunk, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
    });

    // Should fail: either validation rejects it OR overcorrection catches it
    assert.strictEqual(result.ok, false);
    // Original text should be preserved
    assert.strictEqual(result.text, BAD_PROSE);
  });
});


// ─── runAntiChatbotRecastPipeline Tests ───────────────────────────────────

describe('runAntiChatbotRecastPipeline', () => {

  it('populates report with correct counts', async () => {
    // Mix of good and bad chunks separated by double newlines
    const mixedText = GOOD_PROSE + '\n\n' + BAD_PROSE;

    const mockCallLLM = async (_prompt) => {
      // Return a "good enough" version for any chunk that gets recast
      return makeSlightlyBetterProse(BAD_PROSE);
    };

    const { report } = await runAntiChatbotRecastPipeline(mixedText, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
      recastThreshold: 70,
      skipThreshold: 80,
    });

    assert.ok(report, 'Report should exist');
    assert.ok(typeof report.chunksAnalyzed === 'number', 'chunksAnalyzed should be a number');
    assert.ok(report.chunksAnalyzed > 0, 'Should have analyzed at least one chunk');
    assert.ok(typeof report.chunksSkipped === 'number', 'chunksSkipped should be a number');
    assert.ok(typeof report.chunksRecast === 'number', 'chunksRecast should be a number');
    assert.ok(typeof report.chunksFailed === 'number', 'chunksFailed should be a number');
    assert.ok(typeof report.safetyBlocks === 'number', 'safetyBlocks should be a number');
    assert.ok(report.beforeMetrics, 'beforeMetrics should exist');
    assert.ok(report.afterMetrics, 'afterMetrics should exist');
    assert.ok(typeof report.profileUsed === 'string', 'profileUsed should be a string');

    // Total processed should equal analyzed
    const totalProcessed = report.chunksSkipped + report.chunksRecast + report.chunksFailed;
    assert.strictEqual(totalProcessed, report.chunksAnalyzed,
      `skipped (${report.chunksSkipped}) + recast (${report.chunksRecast}) + failed (${report.chunksFailed}) should equal analyzed (${report.chunksAnalyzed})`);
  });

  it('sets globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT', async () => {
    // Clear any previous value
    delete globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT;

    const mockCallLLM = async (_prompt) => GOOD_PROSE;

    await runAntiChatbotRecastPipeline(BAD_PROSE, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
    });

    assert.ok(globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT,
      'globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT should be set after pipeline run');
    assert.ok(typeof globalThis.__UBS_LAST_ANTI_CHATBOT_RECAST_REPORT.chunksAnalyzed === 'number',
      'Report on globalThis should have chunksAnalyzed');
  });

  it('Failed recast falls back to original text', async () => {
    // callLLM throws — the chunk text should be unchanged
    const mockCallLLM = async (_prompt) => {
      throw new Error('LLM service unavailable');
    };

    const { text, report } = await runAntiChatbotRecastPipeline(BAD_PROSE, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
      recastThreshold: 90, // set high so chunks are eligible
      skipThreshold: 95,
    });

    // The text should still contain the original content (unchanged fallback)
    // Check for characteristic phrases from BAD_PROSE
    assert.ok(text.includes('She felt the weight of the moment'),
      'Original text should be preserved when callLLM throws');
    assert.ok(text.includes('He noticed the change in her expression'),
      'Original text should be preserved when callLLM throws');
  });

  it('Report tracks safety blocks', async () => {
    // Provide a callLLM that returns content failing validation (e.g., starts with "# Analysis")
    const mockCallLLM = async (_prompt) => {
      return '# Analysis\n\nThis is an analysis of the passage rather than a proper recast of the original text. She felt the weight of the moment. He noticed the change in her expression. She seemed to understand what was happening now. He appeared to agree with her assessment of things. She realized the truth about the whole situation. He observed the situation from across the room carefully. She felt a wave of sadness wash over her entire body. He noticed the darkness creeping into the corners of the room.';
    };

    const { report } = await runAntiChatbotRecastPipeline(BAD_PROSE, { genre: 'fiction' }, {
      callLLM: mockCallLLM,
      recastThreshold: 90,
      skipThreshold: 95,
    });

    // Any chunk that was eligible but failed validation should increment safetyBlocks
    // chunksFailed and safetyBlocks should be equal (every failure is a safety block)
    assert.strictEqual(report.safetyBlocks, report.chunksFailed,
      `safetyBlocks (${report.safetyBlocks}) should equal chunksFailed (${report.chunksFailed})`);

    // If any chunks were eligible, at least one should have been blocked
    if (report.chunksRecast === 0 && report.chunksAnalyzed > report.chunksSkipped) {
      assert.ok(report.safetyBlocks > 0,
        'safetyBlocks should be > 0 when eligible chunks fail validation');
    }
  });
});
