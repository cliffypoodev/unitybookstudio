/**
 * coverTabModelSelectorUI.test.mjs
 *
 * Tests that model selection changes pipeline settings correctly.
 * Verifies Flux vs PonyXL defaults, workflow scheduler routing,
 * and genre-based pipeline recommendations.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDefaultCoverSettingsForModel,
  buildCoverWorkflowForModel,
  COVER_MODEL_PIPELINES,
} from '../src/lib/coverComfyWorkflows.js';

import { getRecommendedPipeline } from '../src/lib/coverGenreTemplates.js';

describe('Cover Tab — Model Selector UI Wiring', () => {

  // ── Negative Prompt Support ─────────────────────────────────────────────

  it('selecting flux → getDefaultCoverSettingsForModel returns supportsNegative=false', () => {
    const settings = getDefaultCoverSettingsForModel('flux');
    assert.equal(settings.supportsNegative, false);
  });

  it('selecting ponyxl → getDefaultCoverSettingsForModel returns supportsNegative=true', () => {
    const settings = getDefaultCoverSettingsForModel('ponyxl');
    assert.equal(settings.supportsNegative, true);
  });

  // ── Workflow Scheduler Routing ──────────────────────────────────────────

  it('buildCoverWorkflowForModel(flux) uses scheduler simple in KSampler', () => {
    const workflow = buildCoverWorkflowForModel('flux', {
      positivePrompt: 'test',
      width: 1600,
      height: 2400,
    });
    assert.equal(workflow['5'].inputs.scheduler, 'simple');
  });

  it('buildCoverWorkflowForModel(ponyxl) uses scheduler normal in KSampler', () => {
    const workflow = buildCoverWorkflowForModel('ponyxl', {
      positivePrompt: 'test',
      negativePrompt: 'bad',
      width: 1600,
      height: 2400,
    });
    assert.equal(workflow['5'].inputs.scheduler, 'normal');
  });

  // ── Genre → Pipeline Recommendations ────────────────────────────────────

  it('getRecommendedPipeline(horror) returns ponyxl', () => {
    assert.equal(getRecommendedPipeline('horror'), 'ponyxl');
  });

  it('getRecommendedPipeline(literary fiction) returns flux', () => {
    assert.equal(getRecommendedPipeline('literary fiction'), 'flux');
  });

  it('getRecommendedPipeline(romance) returns flux', () => {
    assert.equal(getRecommendedPipeline('romance'), 'flux');
  });

  it('getRecommendedPipeline(dark fantasy) returns ponyxl', () => {
    assert.equal(getRecommendedPipeline('dark fantasy'), 'ponyxl');
  });

  // ── Pipeline Default Constants ──────────────────────────────────────────

  it('COVER_MODEL_PIPELINES.flux.defaultSteps is 20', () => {
    assert.equal(COVER_MODEL_PIPELINES.flux.defaultSteps, 20);
  });

  it('COVER_MODEL_PIPELINES.ponyxl.defaultCfg is 7', () => {
    assert.equal(COVER_MODEL_PIPELINES.ponyxl.defaultCfg, 7);
  });
});
