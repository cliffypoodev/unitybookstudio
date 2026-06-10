/**
 * nonfictionRecastAuthorityPrompt.test.mjs
 *
 * Tests the NONFICTION_AUTHORITY_RECAST_BLOCK constant and its integration
 * into buildChunkRecastPrompt for nonfiction and business profiles.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NONFICTION_AUTHORITY_RECAST_BLOCK,
  buildChunkRecastPrompt,
} from '../src/lib/antiChatbotRecastPipeline.js';

import { analyzeProseTexture } from '../src/lib/antiChatbotProse.js';

// ── Shared test prose chunk (~100 words) ──
const SAMPLE_PROSE = `The data seemed to suggest that the program had a significant impact on the community. Hernandez noticed that outcomes varied by region, with some areas showing improvements while others remained unchanged. She realized the implications were broader than expected. The research showed that several factors contributed to the disparity, including funding levels, staff experience, and local infrastructure. Furthermore, it was important to note that the analysis covered only a two-year period. The results raised important questions about the future of the initiative and its commitment to equity across all districts.`;

const SAMPLE_CHUNK = { text: SAMPLE_PROSE };

function getMetrics() {
  return analyzeProseTexture(SAMPLE_PROSE);
}

// ── Profile helpers ──
const nonfictionProfile = { genre: 'nonfiction' };
const businessProfile = { book_type: 'business', project_type: 'guide' };
const thrillerProfile = { subgenre: 'thriller' };
const literaryProfile = { subgenre: 'literary' };

describe('NONFICTION_AUTHORITY_RECAST_BLOCK — Content Validation', () => {
  it('1. is a non-empty string', () => {
    assert.equal(typeof NONFICTION_AUTHORITY_RECAST_BLOCK, 'string');
    assert.ok(NONFICTION_AUTHORITY_RECAST_BLOCK.trim().length > 0, 'Block should not be empty');
  });

  it('2. contains "Replace vague abstraction"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Replace vague abstraction'),
      'Should contain instruction to replace vague abstraction',
    );
  });

  it('3. contains "Strengthen paragraph openings"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Strengthen paragraph openings'),
      'Should contain instruction to strengthen paragraph openings',
    );
  });

  it('4. contains "Strengthen paragraph endings"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Strengthen paragraph endings'),
      'Should contain instruction to strengthen paragraph endings',
    );
  });

  it('5. contains "essay-bot transitions"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('essay-bot transitions'),
      'Should contain instruction about essay-bot transitions',
    );
  });

  it('6. contains "Moreover"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Moreover'),
      'Should list "Moreover" as an essay-bot transition to remove',
    );
  });

  it('7. contains "Furthermore"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Furthermore'),
      'Should list "Furthermore" as an essay-bot transition to remove',
    );
  });

  it('8. contains "Additionally"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('Additionally'),
      'Should list "Additionally" as an essay-bot transition to remove',
    );
  });

  it('9. contains "source discipline"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('source discipline'),
      'Should contain instruction about preserving source discipline',
    );
  });

  it('10. contains "citation-like references"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('citation-like references'),
      'Should contain instruction about preserving citation-like references',
    );
  });

  it('11. contains "PRECISION and AUTHORITY"', () => {
    assert.ok(
      NONFICTION_AUTHORITY_RECAST_BLOCK.includes('PRECISION and AUTHORITY'),
      'Should state the goal as PRECISION and AUTHORITY',
    );
  });
});

describe('NONFICTION_AUTHORITY_RECAST_BLOCK — Integration with buildChunkRecastPrompt', () => {
  it('12. nonfiction profile includes NONFICTION AUTHORITY RECAST in prompt', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, nonfictionProfile, getMetrics());
    assert.ok(
      prompt.includes('NONFICTION AUTHORITY RECAST:'),
      'Nonfiction prompt should include NONFICTION AUTHORITY RECAST block',
    );
  });

  it('13. business_guide profile includes NONFICTION AUTHORITY RECAST in prompt', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, businessProfile, getMetrics());
    assert.ok(
      prompt.includes('NONFICTION AUTHORITY RECAST:'),
      'Business guide prompt should include NONFICTION AUTHORITY RECAST block',
    );
  });

  it('14. thriller profile does NOT include NONFICTION AUTHORITY RECAST', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, thrillerProfile, getMetrics());
    assert.ok(
      !prompt.includes('NONFICTION AUTHORITY RECAST:'),
      'Thriller prompt should NOT include NONFICTION AUTHORITY RECAST block',
    );
  });

  it('15. literary profile does NOT include NONFICTION AUTHORITY RECAST', () => {
    const prompt = buildChunkRecastPrompt(SAMPLE_CHUNK, literaryProfile, getMetrics());
    assert.ok(
      !prompt.includes('NONFICTION AUTHORITY RECAST:'),
      'Literary prompt should NOT include NONFICTION AUTHORITY RECAST block',
    );
  });
});
