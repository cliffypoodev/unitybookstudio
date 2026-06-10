/**
 * prosePolisherRecastTuning.test.mjs
 *
 * Tests the v3 prompt construction changes in antiChatbotRecastPipeline.js:
 * - RECAST_MODEL_NAME constant
 * - VERSION string
 * - buildChunkRecastPrompt genre-conditional block inclusion/exclusion
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECAST_MODEL_NAME,
  VERSION,
  FILTER_VERB_TARGETING_BLOCK,
  THRILLER_RECAST_EXAMPLES,
  LITERARY_RECAST_EXAMPLES,
  NONFICTION_RECAST_EXAMPLES,
  NONFICTION_AUTHORITY_RECAST_BLOCK,
  buildChunkRecastPrompt,
} from '../src/lib/antiChatbotRecastPipeline.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

// ── Shared test prose chunk (~100 words) ──
const SAMPLE_PROSE = `Marcus felt the cold air press against his face as he stepped outside. He noticed the streetlights had gone dark, one by one, stretching down Maple Avenue like a line of extinguished candles. He realized something was wrong when the silence settled — no traffic, no wind, nothing. He watched a single sheet of newspaper tumble across the empty intersection. He seemed to understand, without anyone telling him, that the city had changed overnight. The weight of it pressed down, heavy and certain. He wondered if anyone else had noticed.`;

const SAMPLE_CHUNK = { text: SAMPLE_PROSE };

function getMetrics() {
  return analyzeProseTexture(SAMPLE_PROSE);
}

// ── Profile helpers ──
const thrillerProfile = { subgenre: 'thriller' };
const literaryProfile = { subgenre: 'literary' };
const fictionProfile = { genre: 'fiction' };
const memoirProfile = { genre: 'memoir' };
const nonfictionProfile = { genre: 'nonfiction' };
const businessProfile = { book_type: 'business', project_type: 'guide' };
const trainingProfile = { book_type: 'training_manual' };

describe('v3 Prose Polisher Recast Tuning — Constants', () => {
  it('1. RECAST_MODEL_NAME equals "prose-recast-polisher"', () => {
    assert.equal(RECAST_MODEL_NAME, 'prose-recast-polisher');
  });

  it('2. VERSION contains "v5.0" (updated from v4)', () => {
    assert.ok(VERSION.includes('v5.0'), `VERSION should contain "v5.0", got: ${VERSION}`);
  });
});

describe('v3 Prose Polisher Recast Tuning — Filter Verb Targeting Block Inclusion', () => {
  it('3. thriller profile includes FILTER VERB TARGETING', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    assert.ok(prompt.includes('FILTER VERB TARGETING:'), 'Thriller prompt should include FILTER VERB TARGETING');
  });

  it('4. literary profile includes FILTER VERB TARGETING', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, literaryProfile, getMetrics());
    assert.ok(prompt.includes('FILTER VERB TARGETING:'), 'Literary prompt should include FILTER VERB TARGETING');
  });

  it('5. fiction profile includes FILTER VERB TARGETING', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, fictionProfile, getMetrics());
    assert.ok(prompt.includes('FILTER VERB TARGETING:'), 'Fiction prompt should include FILTER VERB TARGETING');
  });

  it('6. nonfiction profile does NOT include FILTER VERB TARGETING', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, nonfictionProfile, getMetrics());
    assert.ok(!prompt.includes('FILTER VERB TARGETING:'), 'Nonfiction prompt should NOT include FILTER VERB TARGETING');
  });

  it('7. training_manual profile does NOT include FILTER VERB TARGETING', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, trainingProfile, getMetrics());
    assert.ok(!prompt.includes('FILTER VERB TARGETING:'), 'Training manual prompt should NOT include FILTER VERB TARGETING');
  });
});

describe('v3 Prose Polisher Recast Tuning — Genre Example Block Inclusion', () => {
  it('8. thriller profile includes THRILLER_RECAST_EXAMPLES content', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    assert.ok(prompt.includes('EXAMPLE — THRILLER RECAST:'), 'Thriller prompt should include EXAMPLE — THRILLER RECAST');
  });

  it('9. literary profile includes LITERARY_RECAST_EXAMPLES content', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, literaryProfile, getMetrics());
    assert.ok(prompt.includes('EXAMPLE — LITERARY RECAST:'), 'Literary prompt should include EXAMPLE — LITERARY RECAST');
  });

  it('10. fiction profile includes LITERARY_RECAST_EXAMPLES (literary examples for generic fiction)', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, fictionProfile, getMetrics());
    assert.ok(prompt.includes('EXAMPLE — LITERARY RECAST:'), 'Fiction prompt should include EXAMPLE — LITERARY RECAST');
  });

  it('11. memoir profile includes LITERARY_RECAST_EXAMPLES', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, memoirProfile, getMetrics());
    assert.ok(prompt.includes('EXAMPLE — LITERARY RECAST:'), 'Memoir prompt should include EXAMPLE — LITERARY RECAST');
  });

  it('12. nonfiction profile includes NONFICTION_RECAST_EXAMPLES content', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, nonfictionProfile, getMetrics());
    assert.ok(prompt.includes('EXAMPLE — NONFICTION RECAST:'), 'Nonfiction prompt should include EXAMPLE — NONFICTION RECAST');
  });
});

describe('v3 Prose Polisher Recast Tuning — Nonfiction Authority Block', () => {
  it('13. nonfiction profile includes NONFICTION_AUTHORITY_RECAST_BLOCK content', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, nonfictionProfile, getMetrics());
    assert.ok(prompt.includes('NONFICTION AUTHORITY RECAST:'), 'Nonfiction prompt should include NONFICTION AUTHORITY RECAST');
  });

  it('14. business_guide profile includes NONFICTION_AUTHORITY_RECAST_BLOCK content', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, businessProfile, getMetrics());
    assert.ok(prompt.includes('NONFICTION AUTHORITY RECAST:'), 'Business guide prompt should include NONFICTION AUTHORITY RECAST');
  });

  it('15. training_manual profile does NOT include NONFICTION AUTHORITY RECAST', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, trainingProfile, getMetrics());
    assert.ok(!prompt.includes('NONFICTION AUTHORITY RECAST:'), 'Training manual prompt should NOT include NONFICTION AUTHORITY RECAST');
  });

  it('16. training_manual profile does NOT include genre examples', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, trainingProfile, getMetrics());
    assert.ok(!prompt.includes('EXAMPLE — THRILLER RECAST:'), 'Training manual should not have thriller examples');
    assert.ok(!prompt.includes('EXAMPLE — LITERARY RECAST:'), 'Training manual should not have literary examples');
    assert.ok(!prompt.includes('EXAMPLE — NONFICTION RECAST:'), 'Training manual should not have nonfiction examples');
  });
});

describe('v3 Prose Polisher Recast Tuning — Prompt Ordering & Regression', () => {
  it('17. FILTER VERB TARGETING appears after LENGTH PRESERVATION in fiction prompt', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    const lengthIdx = prompt.indexOf('LENGTH PRESERVATION');
    const filterIdx = prompt.indexOf('FILTER VERB TARGETING:');
    assert.ok(lengthIdx >= 0, 'LENGTH PRESERVATION should be present');
    assert.ok(filterIdx >= 0, 'FILTER VERB TARGETING should be present');
    assert.ok(filterIdx > lengthIdx, 'FILTER VERB TARGETING should appear after LENGTH PRESERVATION');
  });

  it('18. genre examples appear in the prompt for each applicable profile', () => {
    const thrillerPrompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    assert.ok(thrillerPrompt.includes('WEAK ORIGINAL:'), 'Thriller prompt should contain example weak original');
    assert.ok(thrillerPrompt.includes('ACCEPTABLE CONSERVATIVE RECAST:'), 'Thriller prompt should contain acceptable recast example');

    const nonficPrompt = buildChunkRecastPrompt(SAMPLE_CHUNK, nonfictionProfile, getMetrics());
    assert.ok(nonficPrompt.includes('WEAK ORIGINAL:'), 'Nonfiction prompt should contain example weak original');
  });

  it('19. buildChunkRecastPrompt includes LENGTH PRESERVATION for conservative mode (regression)', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, fictionProfile, getMetrics(), { recastMode: 'conservative' });
    assert.ok(prompt.includes('LENGTH PRESERVATION'), 'Conservative mode should include LENGTH PRESERVATION');
  });

  it('20. buildChunkRecastPrompt includes polisherRules from resolved profile (regression)', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    // Thriller uses POLISHER_FICTION_RULES which contains "ANTI-CHATBOT POLISH PASS"
    assert.ok(prompt.includes('ANTI-CHATBOT POLISH PASS'), 'Prompt should include polisherRules content');
  });
});
