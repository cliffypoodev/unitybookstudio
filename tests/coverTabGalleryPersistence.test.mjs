/**
 * coverTabGalleryPersistence.test.mjs
 *
 * Tests metadata shape and gallery data structure:
 * default settings keys, prompt output shape, safety constraints,
 * dimension presets, custom dimension clamping, and default seed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultCoverSettingsForModel,
  getCoverDimensionsForPreset,
  COVER_SIZE_PRESETS,
} from '../src/lib/coverComfyWorkflows.js';

import { buildCoverPrompt } from '../src/lib/coverPromptBuilder.js';
import { buildCoverSafetyConstraints } from '../src/lib/coverSafety.js';

describe('Cover Tab — Gallery Persistence Data', () => {

  // ── Generation Metadata Shape ───────────────────────────────────────────

  it('getDefaultCoverSettingsForModel(flux) has all expected metadata keys', () => {
    const settings = getDefaultCoverSettingsForModel('flux');
    const expectedKeys = ['modelPipeline', 'checkpoint', 'steps', 'sampler', 'scheduler', 'seed', 'sizePreset'];
    for (const key of expectedKeys) {
      assert.ok(key in settings, `Missing expected key: ${key}`);
    }
  });

  // ── Prompt Output Shape ─────────────────────────────────────────────────

  it('prompt output includes positive and negative strings', () => {
    const project = { genre: 'thriller', title: 'Test' };
    const result = buildCoverPrompt(project, { modelPipeline: 'flux' });
    assert.ok(typeof result.positive === 'string', 'positive should be a string');
    assert.ok(typeof result.negative === 'string', 'negative should be a string');
    assert.ok(result.positive.length > 0, 'positive should be non-empty');
  });

  // ── Safety Constraints ──────────────────────────────────────────────────

  it('safety constraints include safetyLevel', () => {
    const project = { genre: 'children', book_type: 'picture book' };
    const constraints = buildCoverSafetyConstraints(project);
    assert.ok('safetyLevel' in constraints, 'safetyLevel key should exist');
    assert.ok(typeof constraints.safetyLevel === 'string', 'safetyLevel should be a string');
  });

  // ── Dimension Presets ───────────────────────────────────────────────────

  it('getCoverDimensionsForPreset returns width and height for all standard presets', () => {
    const standardPresets = ['ebook_portrait', 'paperback_6x9_front', 'square_promo', 'vertical_poster'];
    for (const preset of standardPresets) {
      const dims = getCoverDimensionsForPreset(preset);
      assert.ok(typeof dims.width === 'number' && dims.width > 0, `${preset} should have positive width`);
      assert.ok(typeof dims.height === 'number' && dims.height > 0, `${preset} should have positive height`);
    }
  });

  // ── Custom Dimension Clamping ───────────────────────────────────────────

  it('custom dimensions are clamped to 512-4096 range (small input)', () => {
    const dims = getCoverDimensionsForPreset('custom', { width: 100, height: 100 });
    assert.ok(dims.width >= 512, `Width ${dims.width} should be >= 512`);
    assert.ok(dims.height >= 512, `Height ${dims.height} should be >= 512`);
  });

  it('getCoverDimensionsForPreset(custom, {width:100, height:100}) returns at least 512x512', () => {
    const dims = getCoverDimensionsForPreset('custom', { width: 100, height: 100 });
    assert.equal(dims.width, 512);
    assert.equal(dims.height, 512);
  });

  it('getCoverDimensionsForPreset(custom, {width:9999, height:9999}) returns at most 4096x4096', () => {
    const dims = getCoverDimensionsForPreset('custom', { width: 9999, height: 9999 });
    assert.ok(dims.width <= 4096, `Width ${dims.width} should be <= 4096`);
    assert.ok(dims.height <= 4096, `Height ${dims.height} should be <= 4096`);
    assert.equal(dims.width, 4096);
    assert.equal(dims.height, 4096);
  });

  // ── Default Seed ────────────────────────────────────────────────────────

  it('default seed in settings is -1 (random)', () => {
    const settings = getDefaultCoverSettingsForModel('flux');
    assert.equal(settings.seed, -1);
  });
});
