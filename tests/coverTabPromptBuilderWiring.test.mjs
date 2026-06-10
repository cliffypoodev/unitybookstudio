/**
 * coverTabPromptBuilderWiring.test.mjs
 *
 * Tests prompt builder integration with genre templates, typography modes,
 * three-line prompt structure, custom overrides, series signatures,
 * and PonyXL quality tag injection.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCoverPrompt,
  buildKittlStyleThreeLinePrompt,
  buildTypographyInstruction,
  getSeriesCoverSignature,
} from '../src/lib/coverPromptBuilder.js';

import { getGenreCoverTemplate } from '../src/lib/coverGenreTemplates.js';

// ── Project Mocks ─────────────────────────────────────────────────────────

const thrillerProject = {
  genre: 'thriller',
  subgenre: 'psychological thriller',
  title: 'The Glass Room',
  author_name: 'Jane Doe',
};

const romanceProject = {
  genre: 'romance',
  subgenre: 'contemporary romance',
  title: 'Sunset Harbor',
  author_name: 'Alice Moon',
};

const horrorProject = {
  genre: 'horror',
  subgenre: 'supernatural horror',
  title: 'The Dark Below',
};

describe('Cover Tab — Prompt Builder Wiring', () => {

  // ── Basic Prompt Output ─────────────────────────────────────────────────

  it('buildCoverPrompt for thriller returns {positive, negative} with non-empty positive', () => {
    const result = buildCoverPrompt(thrillerProject, { modelPipeline: 'flux' });
    assert.ok(typeof result.positive === 'string' && result.positive.length > 0, 'positive prompt should be non-empty');
    assert.ok(typeof result.negative === 'string', 'negative prompt should be a string');
  });

  it('buildCoverPrompt for thriller includes genre template lighting in positive', () => {
    const template = getGenreCoverTemplate('thriller', 'psychological thriller');
    const result = buildCoverPrompt(thrillerProject, { modelPipeline: 'flux' });
    // The template lighting should appear in the positive prompt
    assert.ok(
      result.positive.includes(template.lighting),
      `Expected positive to include template lighting "${template.lighting.substring(0, 40)}..."`,
    );
  });

  // ── Typography Modes ────────────────────────────────────────────────────

  it('typography_reference mode includes quoted title in prompt addition', () => {
    const result = buildTypographyInstruction(thrillerProject, {
      typographyMode: 'typography_reference',
    });
    assert.ok(
      result.promptAddition.includes('"The Glass Room"'),
      `Expected prompt addition to include quoted title, got: ${result.promptAddition.substring(0, 80)}`,
    );
  });

  it('image_only typography mode adds "No text" to prompt', () => {
    const result = buildTypographyInstruction(thrillerProject, {
      typographyMode: 'image_only',
    });
    assert.ok(
      result.promptAddition.includes('No text'),
      `Expected "No text" in prompt addition, got: ${result.promptAddition.substring(0, 80)}`,
    );
  });

  // ── Genre Template Effects ──────────────────────────────────────────────

  it('genre template for horror affects prompt output — contains horror palette terms', () => {
    const template = getGenreCoverTemplate('horror', 'supernatural horror');
    const result = buildCoverPrompt(horrorProject, { modelPipeline: 'ponyxl' });
    // The template palette should appear in the positive prompt (via three-line builder)
    assert.ok(
      result.positive.includes(template.palette),
      `Expected horror palette "${template.palette.substring(0, 40)}..." in positive`,
    );
  });

  // ── Three-Line Prompt Structure ─────────────────────────────────────────

  it('buildKittlStyleThreeLinePrompt for romance returns 3-line structure', () => {
    const result = buildKittlStyleThreeLinePrompt(romanceProject);
    assert.ok(result.line1 && typeof result.line1 === 'string', 'line1 should exist');
    assert.ok(result.line2 && typeof result.line2 === 'string', 'line2 should exist');
    assert.ok(result.line3 && typeof result.line3 === 'string', 'line3 should exist');
    assert.ok(result.full && typeof result.full === 'string', 'full should exist');
  });

  it('buildKittlStyleThreeLinePrompt line1 contains "Vertical portrait"', () => {
    const result = buildKittlStyleThreeLinePrompt(romanceProject);
    assert.ok(
      result.line1.includes('Vertical portrait'),
      `Expected "Vertical portrait" in line1, got: ${result.line1.substring(0, 60)}`,
    );
  });

  // ── Custom Overrides ────────────────────────────────────────────────────

  it('custom lighting override replaces template lighting', () => {
    const customLighting = 'neon blue city glow, rain-slicked streets';
    const result = buildKittlStyleThreeLinePrompt(thrillerProject, {
      lighting: customLighting,
    });
    assert.ok(
      result.line1.includes(customLighting),
      'Custom lighting should appear in line1',
    );
  });

  it('custom palette override replaces template palette', () => {
    const customPalette = 'electric pink, deep black, chrome silver';
    const result = buildKittlStyleThreeLinePrompt(thrillerProject, {
      palette: customPalette,
    });
    assert.ok(
      result.line3.includes(customPalette),
      'Custom palette should appear in line3',
    );
  });

  // ── Series Signature ────────────────────────────────────────────────────

  it('getSeriesCoverSignature with seriesLighting returns hasSeriesSignature=true', () => {
    const result = getSeriesCoverSignature(thrillerProject, {
      seriesLighting: 'cold steel overhead fluorescent',
    });
    assert.equal(result.hasSeriesSignature, true);
    assert.ok(result.seriesBlock.includes('cold steel overhead fluorescent'));
  });

  it('getSeriesCoverSignature with no data returns hasSeriesSignature=false', () => {
    const result = getSeriesCoverSignature(thrillerProject, {});
    assert.equal(result.hasSeriesSignature, false);
    assert.equal(result.seriesBlock, '');
  });

  // ── PonyXL Quality Tags ─────────────────────────────────────────────────

  it('PonyXL prompt for horror includes score_9 quality tags', () => {
    const result = buildCoverPrompt(horrorProject, { modelPipeline: 'ponyxl' });
    assert.ok(
      result.positive.includes('score_9'),
      `Expected PonyXL prompt to include "score_9", got start: ${result.positive.substring(0, 60)}`,
    );
  });
});
