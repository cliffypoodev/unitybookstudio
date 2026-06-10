/**
 * coverTabComfyUIWiring.test.mjs — Integration tests for Cover Tab ComfyUI wiring
 *
 * Verifies that modules wire together correctly:
 *   prompt builder → workflow builder → dimensions → safety
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildCoverPrompt } from '../src/lib/coverPromptBuilder.js';
import {
  buildCoverWorkflowForModel,
  getCoverDimensionsForPreset,
} from '../src/lib/coverComfyWorkflows.js';
import { getGenreCoverTemplate } from '../src/lib/coverGenreTemplates.js';
import {
  buildCoverSafetyConstraints,
  sanitizeCoverNegativePrompt,
  validateCoverPromptSafety,
} from '../src/lib/coverSafety.js';
import { normalizeComfyUIError } from '../src/lib/comfyuiClient.js';

describe('Cover Tab ComfyUI Wiring (Integration)', () => {
  // ── 1. Full pipeline: prompt → workflow → dimensions ───────────
  it('ebook_portrait dimensions are 2:3 ratio (1600×2400)', () => {
    const project = { genre: 'literary fiction', title: 'The Quiet Ones' };
    const prompt = buildCoverPrompt(project);
    const dims = getCoverDimensionsForPreset('ebook_portrait');
    const wf = buildCoverWorkflowForModel('flux', {
      positivePrompt: prompt.positive,
      width: dims.width,
      height: dims.height,
      seed: 42,
    });

    assert.equal(dims.width, 1600);
    assert.equal(dims.height, 2400);
    assert.equal(dims.width / dims.height, 2 / 3);
    assert.equal(wf['4'].inputs.width, 1600);
    assert.equal(wf['4'].inputs.height, 2400);
  });

  // ── 2. Horror → ponyxl → negative prompt node ─────────────────
  it('horror project prompt → ponyxl workflow → has negative prompt in node 3', () => {
    const project = { genre: 'horror', subgenre: 'supernatural horror' };
    const prompt = buildCoverPrompt(project);
    const wf = buildCoverWorkflowForModel('ponyxl', {
      positivePrompt: prompt.positive,
      negativePrompt: prompt.negative,
      seed: 42,
    });

    assert.ok(prompt.negative.length > 0, 'negative prompt should not be empty');
    assert.equal(wf['3'].inputs.text, prompt.negative);
  });

  // ── 3. Romance → flux → empty negative ─────────────────────────
  it('romance project prompt → flux workflow → node 3 is empty negative', () => {
    const project = { genre: 'romance', title: 'Summer Hearts' };
    const prompt = buildCoverPrompt(project);
    const wf = buildCoverWorkflowForModel('flux', {
      positivePrompt: prompt.positive,
      seed: 42,
    });

    // Flux workflow always sets node 3 text to empty string
    assert.equal(wf['3'].inputs.text, '');
  });

  // ── 4. Children → safety → prompt is safe ──────────────────────
  it('children project safety constraints applied and clean prompt passes', () => {
    const project = { genre: 'children', subgenre: 'middle grade' };
    const safety = buildCoverSafetyConstraints(project);
    const prompt = buildCoverPrompt(project);
    const validation = validateCoverPromptSafety(prompt.positive, project);

    assert.equal(safety.isChildSafe, true);
    assert.equal(validation.safe, true);
  });

  // ── 5. Generated metadata shape ────────────────────────────────
  it('generated metadata shape includes modelPipeline, seed, prompt, dimensions', () => {
    const project = { genre: 'thriller', title: 'Dark Mirror' };
    const prompt = buildCoverPrompt(project);
    const dims = getCoverDimensionsForPreset('ebook_portrait');
    const seed = 12345;
    const modelPipeline = 'ponyxl';

    const metadata = {
      modelPipeline,
      seed,
      prompt: { positive: prompt.positive, negative: prompt.negative },
      dimensions: dims,
    };

    assert.equal(metadata.modelPipeline, 'ponyxl');
    assert.equal(metadata.seed, 12345);
    assert.ok(typeof metadata.prompt.positive === 'string');
    assert.ok(typeof metadata.prompt.negative === 'string');
    assert.equal(metadata.dimensions.width, 1600);
    assert.equal(metadata.dimensions.height, 2400);
  });

  // ── 6. Typography mode affects prompt output ───────────────────
  it('typography mode affects prompt output', () => {
    const project = { genre: 'romance', title: 'Summer Hearts' };
    const imageOnly = buildCoverPrompt(project, { typographyMode: 'image_only' });
    const typoRef = buildCoverPrompt(project, { typographyMode: 'typography_reference' });

    // image_only adds "no text" instruction
    assert.ok(imageOnly.positive.toLowerCase().includes('no text'));
    // typography_reference includes the quoted title
    assert.ok(typoRef.positive.includes('"Summer Hearts"'));
  });

  // ── 7. Custom dimensions through getCoverDimensionsForPreset ──
  it('custom dimensions work through getCoverDimensionsForPreset', () => {
    const dims = getCoverDimensionsForPreset('custom', { width: 2048, height: 2048 });
    assert.equal(dims.width, 2048);
    assert.equal(dims.height, 2048);

    const wf = buildCoverWorkflowForModel('flux', {
      positivePrompt: 'test',
      width: dims.width,
      height: dims.height,
      seed: 42,
    });
    assert.equal(wf['4'].inputs.width, 2048);
    assert.equal(wf['4'].inputs.height, 2048);
  });

  // ── 8. normalizeComfyUIError produces user-friendly messages ──
  it('normalizeComfyUIError produces user-friendly messages', () => {
    const connErr = normalizeComfyUIError(new Error('ECONNREFUSED'));
    assert.ok(connErr.includes('Cannot connect'));

    const timeoutErr = normalizeComfyUIError(new Error('request timed out'));
    assert.ok(timeoutErr.includes('timed out'));

    const serverErr = normalizeComfyUIError(new Error('HTTP 500'));
    assert.ok(serverErr.includes('server error'));
  });

  // ── 9. Series signature preserved in prompt ────────────────────
  it('series signature preserved in prompt when provided', () => {
    const project = { genre: 'literary fiction', title: 'The Quiet Ones' };
    const settings = {
      seriesLighting: 'warm amber glow from candles',
      seriesPalette: 'gold, cream, and burgundy',
    };
    const prompt = buildCoverPrompt(project, settings);
    assert.ok(prompt.positive.includes('warm amber glow from candles'));
    assert.ok(prompt.positive.includes('gold, cream, and burgundy'));
  });

  // ── 10. Genre template fields flow into prompt builder output ─
  it('genre template fields flow into prompt builder output', () => {
    const project = { genre: 'horror', subgenre: 'supernatural horror' };
    // getGenreCoverTemplate with genre+subgenre combines to 'horror supernatural horror'
    const template = getGenreCoverTemplate(project.genre, project.subgenre);
    const prompt = buildCoverPrompt(project);

    // Template lighting should appear in positive prompt
    assert.ok(prompt.positive.includes(template.lighting));
    // Template subject should appear
    assert.ok(prompt.positive.includes(template.subject));
  });
});
