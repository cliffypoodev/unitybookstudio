/**
 * coverPromptBuilder.test.mjs — Tests for coverPromptBuilder.js
 *
 * Covers:
 *   - buildKittlStyleThreeLinePrompt structure (line1/2/3/full)
 *   - buildTypographyInstruction modes
 *   - buildFluxCoverPrompt (positive/negative shape)
 *   - buildPonyXLCoverPrompt (quality tags, negatives)
 *   - buildCoverPrompt routing by genre
 *   - getSeriesCoverSignature
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKittlStyleThreeLinePrompt,
  buildTypographyInstruction,
  buildGenreCoverStyleBlock,
  getSeriesCoverSignature,
  buildFluxCoverPrompt,
  buildPonyXLCoverPrompt,
  buildCoverPrompt,
} from '../src/lib/coverPromptBuilder.js';

describe('coverPromptBuilder', () => {
  // ── buildKittlStyleThreeLinePrompt ─────────────────────────────
  describe('buildKittlStyleThreeLinePrompt', () => {
    const project = { genre: 'horror', subgenre: 'supernatural horror' };
    const result = buildKittlStyleThreeLinePrompt(project);

    it('returns object with line1, line2, line3, full', () => {
      assert.ok(typeof result.line1 === 'string');
      assert.ok(typeof result.line2 === 'string');
      assert.ok(typeof result.line3 === 'string');
      assert.ok(typeof result.full === 'string');
    });

    it('line1 contains lighting from genre template', () => {
      // Horror template lighting includes "moonlight"
      assert.ok(result.line1.toLowerCase().includes('moonlight') || result.line1.toLowerCase().includes('light'));
    });

    it('line2 contains subject from genre template', () => {
      // Horror template subject includes "ominous" or "threshold" or "door"
      assert.ok(result.line2.toLowerCase().includes('ominous') || result.line2.toLowerCase().includes('threshold') || result.line2.toLowerCase().includes('door'));
    });

    it('line3 contains palette from genre template', () => {
      // Horror template palette includes "charcoal" and "blood"
      assert.ok(result.line3.toLowerCase().includes('charcoal') || result.line3.toLowerCase().includes('black'));
    });

    it('full is line1 + line2 + line3 joined by newlines', () => {
      const expected = `${result.line1}\n${result.line2}\n${result.line3}`;
      assert.equal(result.full, expected);
    });
  });

  // ── buildTypographyInstruction ─────────────────────────────────
  describe('buildTypographyInstruction', () => {
    it('image_only mode adds no-text instruction', () => {
      const project = { genre: 'romance', title: 'Summer Hearts' };
      const result = buildTypographyInstruction(project, { typographyMode: 'image_only' });
      assert.ok(result.promptAddition.toLowerCase().includes('no text'));
    });

    it('typography_reference mode includes quoted title', () => {
      const project = { genre: 'romance', title: 'Summer Hearts' };
      const result = buildTypographyInstruction(project, { typographyMode: 'typography_reference' });
      assert.ok(result.promptAddition.includes('"Summer Hearts"'));
    });
  });

  // ── buildFluxCoverPrompt ───────────────────────────────────────
  describe('buildFluxCoverPrompt', () => {
    const project = { genre: 'literary fiction', title: 'The Quiet Ones' };
    const result = buildFluxCoverPrompt(project);

    it('returns { positive, negative }', () => {
      assert.ok(typeof result.positive === 'string');
      assert.ok(typeof result.negative === 'string');
    });

    it('positive includes three-line content', () => {
      // Should contain flat artwork lead text from line1
      assert.ok(result.positive.includes('2:3 aspect ratio'));
    });

    it('negative includes flat artwork negatives', () => {
      assert.ok(result.negative.includes('physical book'));
    });
  });

  // ── buildPonyXLCoverPrompt ─────────────────────────────────────
  describe('buildPonyXLCoverPrompt', () => {
    const project = { genre: 'horror', subgenre: 'supernatural horror' };
    const result = buildPonyXLCoverPrompt(project);

    it('positive includes quality tags (score_9)', () => {
      assert.ok(result.positive.includes('score_9'));
    });

    it('negative includes quality guards (score_1)', () => {
      assert.ok(result.negative.includes('score_1'));
    });
  });

  // ── buildCoverPrompt routing ───────────────────────────────────
  describe('buildCoverPrompt', () => {
    it('routes to flux for literary fiction', () => {
      const project = { genre: 'literary fiction', title: 'The Quiet Ones' };
      const result = buildCoverPrompt(project);
      // Flux prompts do NOT start with score tags
      assert.ok(!result.positive.startsWith('score_9'));
      // But do contain the three-line content
      assert.ok(result.positive.includes('2:3 aspect ratio'));
    });

    it('routes to ponyxl for horror', () => {
      const project = { genre: 'horror', subgenre: 'supernatural horror' };
      const result = buildCoverPrompt(project);
      // PonyXL prompts start with quality tags
      assert.ok(result.positive.includes('score_9'));
    });
  });

  // ── getSeriesCoverSignature ────────────────────────────────────
  describe('getSeriesCoverSignature', () => {
    it('returns hasSeriesSignature=false when no series data provided', () => {
      const result = getSeriesCoverSignature({}, {});
      assert.equal(result.hasSeriesSignature, false);
      assert.equal(result.seriesBlock, '');
    });

    it('returns hasSeriesSignature=true when series data provided', () => {
      const result = getSeriesCoverSignature({}, {
        seriesLighting: 'warm amber glow',
        seriesPalette: 'gold and burgundy',
      });
      assert.equal(result.hasSeriesSignature, true);
      assert.ok(result.seriesBlock.includes('warm amber glow'));
      assert.ok(result.seriesBlock.includes('gold and burgundy'));
    });
  });
});
