/**
 * coverComfyWorkflows.test.mjs — Tests for coverComfyWorkflows.js
 *
 * Covers:
 *   - Checkpoint constants
 *   - COVER_MODEL_PIPELINES structure
 *   - COVER_SIZE_PRESETS (5 entries, dimensions)
 *   - COVER_TYPOGRAPHY_MODES
 *   - getCoverDimensionsForPreset (fallback + custom)
 *   - buildFluxCoverWorkflow node graph shape
 *   - buildPonyXLCoverWorkflow node graph shape
 *   - buildCoverWorkflowForModel routing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FLUX_CHECKPOINT_NAME,
  PONYXL_CHECKPOINT_NAME,
  COVER_MODEL_PIPELINES,
  COVER_SIZE_PRESETS,
  COVER_TYPOGRAPHY_MODES,
  DEFAULT_SIZE_PRESET,
  getCoverDimensionsForPreset,
  buildFluxCoverWorkflow,
  buildPonyXLCoverWorkflow,
  buildCoverWorkflowForModel,
} from '../src/lib/coverComfyWorkflows.js';

describe('coverComfyWorkflows', () => {
  // ── Constants ──────────────────────────────────────────────────
  it('FLUX_CHECKPOINT_NAME is a string', () => {
    assert.equal(typeof FLUX_CHECKPOINT_NAME, 'string');
    assert.ok(FLUX_CHECKPOINT_NAME.length > 0);
  });

  it('PONYXL_CHECKPOINT_NAME is cyberrealisticPony_v180Coreshift.safetensors', () => {
    assert.equal(PONYXL_CHECKPOINT_NAME, 'cyberrealisticPony_v180Coreshift.safetensors');
  });

  it('COVER_MODEL_PIPELINES has flux and ponyxl entries', () => {
    assert.ok(COVER_MODEL_PIPELINES.flux, 'missing flux entry');
    assert.ok(COVER_MODEL_PIPELINES.ponyxl, 'missing ponyxl entry');
    assert.equal(COVER_MODEL_PIPELINES.flux.id, 'flux');
    assert.equal(COVER_MODEL_PIPELINES.ponyxl.id, 'ponyxl');
  });

  // ── Size Presets ───────────────────────────────────────────────
  it('COVER_SIZE_PRESETS has 5 entries', () => {
    const keys = Object.keys(COVER_SIZE_PRESETS);
    assert.equal(keys.length, 5);
    assert.ok(keys.includes('ebook_portrait'));
    assert.ok(keys.includes('paperback_6x9_front'));
    assert.ok(keys.includes('square_promo'));
    assert.ok(keys.includes('vertical_poster'));
    assert.ok(keys.includes('custom'));
  });

  it('DEFAULT_SIZE_PRESET is ebook_portrait', () => {
    assert.equal(DEFAULT_SIZE_PRESET, 'ebook_portrait');
  });

  it('ebook_portrait is 1600×2400', () => {
    assert.equal(COVER_SIZE_PRESETS.ebook_portrait.width, 1600);
    assert.equal(COVER_SIZE_PRESETS.ebook_portrait.height, 2400);
  });

  // ── getCoverDimensionsForPreset ────────────────────────────────
  it('returns default ebook_portrait for unknown preset', () => {
    const dims = getCoverDimensionsForPreset('nonexistent_preset');
    assert.equal(dims.width, 1600);
    assert.equal(dims.height, 2400);
  });

  it('custom preset uses provided dimensions', () => {
    const dims = getCoverDimensionsForPreset('custom', { width: 2000, height: 3000 });
    assert.equal(dims.width, 2000);
    assert.equal(dims.height, 3000);
  });

  // ── Typography Modes ───────────────────────────────────────────
  it('COVER_TYPOGRAPHY_MODES has image_only, typography_reference, final_cover_composite_later', () => {
    assert.ok(COVER_TYPOGRAPHY_MODES.image_only);
    assert.ok(COVER_TYPOGRAPHY_MODES.typography_reference);
    assert.ok(COVER_TYPOGRAPHY_MODES.final_cover_composite_later);
    assert.equal(COVER_TYPOGRAPHY_MODES.image_only.id, 'image_only');
  });

  // ── buildFluxCoverWorkflow ─────────────────────────────────────
  it('buildFluxCoverWorkflow returns object with CheckpointLoaderSimple node', () => {
    const wf = buildFluxCoverWorkflow({ positivePrompt: 'test prompt', seed: 42 });
    assert.equal(wf['1'].class_type, 'CheckpointLoaderSimple');
    assert.ok(wf['2'].class_type === 'CLIPTextEncode');
    assert.ok(wf['7'].class_type === 'SaveImage');
  });

  it('buildFluxCoverWorkflow uses euler sampler and simple scheduler', () => {
    const wf = buildFluxCoverWorkflow({ positivePrompt: 'test', seed: 42 });
    assert.equal(wf['5'].inputs.sampler_name, 'euler');
    assert.equal(wf['5'].inputs.scheduler, 'simple');
  });

  // ── buildPonyXLCoverWorkflow ───────────────────────────────────
  it('buildPonyXLCoverWorkflow returns object with CLIPTextEncode for positive and negative', () => {
    const wf = buildPonyXLCoverWorkflow({
      positivePrompt: 'dark castle',
      negativePrompt: 'bright, happy',
      seed: 42,
    });
    // Node 2 = positive, Node 3 = negative
    assert.equal(wf['2'].class_type, 'CLIPTextEncode');
    assert.equal(wf['2'].inputs.text, 'dark castle');
    assert.equal(wf['3'].class_type, 'CLIPTextEncode');
    assert.equal(wf['3'].inputs.text, 'bright, happy');
  });

  it('buildPonyXLCoverWorkflow uses euler sampler and normal scheduler', () => {
    const wf = buildPonyXLCoverWorkflow({ positivePrompt: 'test', seed: 42 });
    assert.equal(wf['5'].inputs.sampler_name, 'euler');
    assert.equal(wf['5'].inputs.scheduler, 'normal');
  });

  // ── buildCoverWorkflowForModel routing ─────────────────────────
  it('buildCoverWorkflowForModel("flux") uses simple scheduler (flux path)', () => {
    const wf = buildCoverWorkflowForModel('flux', { positivePrompt: 'x', seed: 42 });
    assert.equal(wf['5'].inputs.scheduler, 'simple');
  });

  it('buildCoverWorkflowForModel("ponyxl") uses normal scheduler (ponyxl path)', () => {
    const wf = buildCoverWorkflowForModel('ponyxl', { positivePrompt: 'x', seed: 42 });
    assert.equal(wf['5'].inputs.scheduler, 'normal');
  });
});
