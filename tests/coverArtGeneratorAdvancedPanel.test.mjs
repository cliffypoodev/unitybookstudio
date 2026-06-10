/**
 * coverArtGeneratorAdvancedPanel.test.mjs
 *
 * Tests the advanced panel data logic by importing from the lib modules.
 * Verifies model pipeline definitions, size presets, typography modes,
 * default settings, genre template count, and dimension helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getComfyUIBaseUrl,
  COMFYUI_DEFAULT_BASE_URL,
  normalizeComfyUIError,
} from '../src/lib/comfyuiClient.js';

import {
  COVER_MODEL_PIPELINES,
  COVER_SIZE_PRESETS,
  COVER_TYPOGRAPHY_MODES,
  getDefaultCoverSettingsForModel,
  getCoverDimensionsForPreset,
} from '../src/lib/coverComfyWorkflows.js';

import { getAllGenreCoverTemplates } from '../src/lib/coverGenreTemplates.js';

describe('CoverArtGenerator Advanced Panel Data Logic', () => {

  // ── Model Pipelines ─────────────────────────────────────────────────────

  it('COVER_MODEL_PIPELINES has flux and ponyxl keys', () => {
    assert.ok(COVER_MODEL_PIPELINES.flux, 'flux key missing');
    assert.ok(COVER_MODEL_PIPELINES.ponyxl, 'ponyxl key missing');
  });

  it('COVER_MODEL_PIPELINES.flux.label is Flux', () => {
    assert.equal(COVER_MODEL_PIPELINES.flux.label, 'Flux');
  });

  it('COVER_MODEL_PIPELINES.ponyxl.label contains PonyXL', () => {
    assert.ok(
      COVER_MODEL_PIPELINES.ponyxl.label.includes('PonyXL'),
      `Expected label to contain "PonyXL", got "${COVER_MODEL_PIPELINES.ponyxl.label}"`,
    );
  });

  // ── Size Presets ────────────────────────────────────────────────────────

  it('COVER_SIZE_PRESETS has all expected preset keys', () => {
    const expected = ['ebook_portrait', 'paperback_6x9_front', 'square_promo', 'vertical_poster', 'custom'];
    for (const key of expected) {
      assert.ok(COVER_SIZE_PRESETS[key], `Missing size preset key: ${key}`);
    }
  });

  // ── Typography Modes ────────────────────────────────────────────────────

  it('COVER_TYPOGRAPHY_MODES has image_only, typography_reference, final_cover_composite_later', () => {
    const expected = ['image_only', 'typography_reference', 'final_cover_composite_later'];
    for (const key of expected) {
      assert.ok(COVER_TYPOGRAPHY_MODES[key], `Missing typography mode key: ${key}`);
    }
  });

  // ── Default Settings ────────────────────────────────────────────────────

  it('getDefaultCoverSettingsForModel(flux) returns modelPipeline flux', () => {
    const settings = getDefaultCoverSettingsForModel('flux');
    assert.equal(settings.modelPipeline, 'flux');
  });

  it('getDefaultCoverSettingsForModel(ponyxl) returns modelPipeline ponyxl', () => {
    const settings = getDefaultCoverSettingsForModel('ponyxl');
    assert.equal(settings.modelPipeline, 'ponyxl');
  });

  it('getDefaultCoverSettingsForModel(flux).sampler is euler', () => {
    const settings = getDefaultCoverSettingsForModel('flux');
    assert.equal(settings.sampler, 'euler');
  });

  it('getDefaultCoverSettingsForModel(ponyxl).steps is 25', () => {
    const settings = getDefaultCoverSettingsForModel('ponyxl');
    assert.equal(settings.steps, 25);
  });

  // ── Genre Templates ─────────────────────────────────────────────────────

  it('getAllGenreCoverTemplates returns 10 items', () => {
    const templates = getAllGenreCoverTemplates();
    assert.equal(templates.length, 10, `Expected 10 templates, got ${templates.length}`);
  });

  // ── Dimension Helpers ───────────────────────────────────────────────────

  it('getCoverDimensionsForPreset(ebook_portrait) returns 1600x2400', () => {
    const dims = getCoverDimensionsForPreset('ebook_portrait');
    assert.deepStrictEqual(dims, { width: 1600, height: 2400 });
  });

  // ── ComfyUI URL ─────────────────────────────────────────────────────────

  it('COMFYUI_DEFAULT_BASE_URL is http://127.0.0.1:8188', () => {
    assert.equal(COMFYUI_DEFAULT_BASE_URL, 'http://127.0.0.1:8000');
  });
});
