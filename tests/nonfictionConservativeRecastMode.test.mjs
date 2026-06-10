/**
 * nonfictionConservativeRecastMode.test.mjs
 *
 * Tests nonfiction-specific conservative behavior in buildChunkRecastPrompt:
 * NONFICTION CONSTRAINTS block presence for nonfiction, business_guide,
 * training_manual profiles; absence for fiction profiles; combined with
 * conservative-mode length preservation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildChunkRecastPrompt,
} from '../src/lib/antiChatbotRecastPipeline.js';

import {
  analyzeProseTexture,
} from '../src/lib/antiChatbotProse.js';


// ─── Generic ~100-word prose chunk for tests ──────────────────────────────

const GENERIC_CHUNK_TEXT = `The morning light filtered through the tall windows of the old library, casting long rectangles of gold across the worn oak tables. Dust motes drifted lazily in the shafts of brightness, spinning and tumbling without any particular destination. A few students sat scattered among the stacks, their laptops open, their headphones on, their attention fixed on screens glowing faintly in the dim interior. Outside, the campus bell tower struck nine, its resonant chime rolling across the quadrangle and fading into the distant hum of traffic beyond the iron gates. Nobody looked up. The world continued as it always had.`;

const CHUNK = { text: GENERIC_CHUNK_TEXT };
const METRICS = analyzeProseTexture(GENERIC_CHUNK_TEXT);


// ═════════════════════════════════════════════════════════════════════════════
// 1. Nonfiction Profile — NONFICTION CONSTRAINTS
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — nonfiction NONFICTION CONSTRAINTS', () => {
  it('nonfiction genre includes NONFICTION CONSTRAINTS', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('NONFICTION CONSTRAINTS'), 'Nonfiction prompt should include NONFICTION CONSTRAINTS');
  });

  it('nonfiction prompt includes "Do NOT add lyrical texture"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Do NOT add lyrical texture'), 'Should warn against lyrical texture');
  });

  it('nonfiction prompt includes "Do NOT add scene dramatization"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Do NOT add scene dramatization'), 'Should warn against scene dramatization');
  });

  it('nonfiction prompt includes "Do NOT add unsupported examples"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Do NOT add unsupported examples'), 'Should warn against unsupported examples');
  });

  it('nonfiction prompt includes "Prioritize clarity, authority"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Prioritize clarity, authority'), 'Should prioritize clarity and authority');
  });

  it('nonfiction prompt includes "Preserve ALL headings"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Preserve ALL headings'), 'Should preserve headings');
  });

  it('nonfiction prompt includes "Preserve ALL citation-like material"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Preserve ALL citation-like material'), 'Should preserve citation-like material');
  });

  it('nonfiction prompt includes "CLARITY and AUTHORITY, not style"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('CLARITY and AUTHORITY, not style'), 'Should emphasize clarity and authority over style');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. Other Nonfiction Profiles
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — business_guide and training_manual profiles', () => {
  it('business_guide profile includes NONFICTION CONSTRAINTS', () => {
    const prompt = buildChunkRecastPrompt(
      CHUNK,
      { genre: 'business', project_type: 'guide' },
      METRICS,
      { recastMode: 'conservative' }
    );
    assert.ok(prompt.includes('NONFICTION CONSTRAINTS'), 'business_guide prompt should include NONFICTION CONSTRAINTS');
  });

  it('training_manual profile includes NONFICTION CONSTRAINTS', () => {
    // training_manual is detected by genre: 'training' or book_type: 'training'
    // but recastEligible is false for training_manual — the prompt is still built
    // so we test that the prompt includes the block when profileKey is training_manual
    const prompt = buildChunkRecastPrompt(
      CHUNK,
      { book_type: 'training' },
      METRICS,
      { recastMode: 'conservative' }
    );
    assert.ok(prompt.includes('NONFICTION CONSTRAINTS'), 'training_manual prompt should include NONFICTION CONSTRAINTS');
  });
});


// ═════════════════════════════════════════════════════════════════════════════
// 3. Fiction Profiles — NO NONFICTION CONSTRAINTS
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — fiction profiles do NOT include NONFICTION CONSTRAINTS', () => {
  const fictionProfiles = [
    { genre: 'thriller' },
    { genre: 'literary', subgenre: 'literary' },
    { genre: 'memoir' },
    { genre: 'fiction' },
  ];

  for (const profile of fictionProfiles) {
    it(`${profile.genre} does NOT include NONFICTION CONSTRAINTS`, () => {
      const prompt = buildChunkRecastPrompt(CHUNK, profile, METRICS, { recastMode: 'conservative' });
      assert.ok(!prompt.includes('NONFICTION CONSTRAINTS'), `${profile.genre} prompt should NOT include NONFICTION CONSTRAINTS`);
    });
  }
});


// ═════════════════════════════════════════════════════════════════════════════
// 4. Nonfiction + Conservative Mode Combined
// ═════════════════════════════════════════════════════════════════════════════

describe('buildChunkRecastPrompt — nonfiction conservative combined', () => {
  it('nonfiction conservative prompt includes length preservation block', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('LENGTH PRESERVATION (MANDATORY'), 'Nonfiction conservative should include LENGTH PRESERVATION');
  });

  it('nonfiction conservative prompt includes original word count', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    const wordCount = GENERIC_CHUNK_TEXT.split(/\s+/).filter(Boolean).length;
    assert.ok(prompt.includes(`${wordCount} words`), `Should include original word count (${wordCount})`);
  });

  it('nonfiction conservative prompt includes "Do NOT summarize"', () => {
    const prompt = buildChunkRecastPrompt(CHUNK, { genre: 'nonfiction' }, METRICS, { recastMode: 'conservative' });
    assert.ok(prompt.includes('Do NOT summarize'), 'Nonfiction conservative should include "Do NOT summarize"');
  });
});
