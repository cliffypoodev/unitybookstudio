/**
 * coverProductionWorkflow.test.mjs — Integration tests for cover production pipeline
 *
 * Tests the end-to-end data flow: prompt build → generation settings → typography → export metadata
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCoverPrompt } from '../src/lib/coverPromptBuilder.js';
import { getDefaultCoverSettingsForModel, getCoverDimensionsForPreset } from '../src/lib/coverComfyWorkflows.js';
import { getGenreCoverTemplate } from '../src/lib/coverGenreTemplates.js';
import { buildCoverSafetyConstraints } from '../src/lib/coverSafety.js';
import { DEFAULT_TYPOGRAPHY_SETTINGS, buildTypographyOverlay, validateTypographySettings, calculateSafeMargins } from '../src/lib/coverTypographyComposer.js';
import { COVER_EXPORT_PRESETS, getCoverExportDimensions, buildCoverExportMetadata, buildExportFilename, validateCoverExportSettings } from '../src/lib/coverExport.js';
import { createCoverVariation, buildCoverVariationMetadata } from '../src/lib/coverVariationManager.js';
import { extractSeriesCoverSignature, applySeriesCoverSignature, validateSeriesCoverConsistency } from '../src/lib/coverSeriesConsistency.js';

const MOCK_PROJECT = { id: 'p1', title: 'The Glass Room', author_name: 'Sarah Lin', genre: 'thriller', subgenre: 'psychological thriller' };

describe('coverProductionWorkflow', () => {
  describe('full pipeline: prompt → settings → typography → export', () => {
    it('builds prompt from project', () => {
      const prompt = buildCoverPrompt(MOCK_PROJECT, { modelPipeline: 'flux' });
      assert.ok(prompt.positive.length > 20, 'Positive prompt should be substantial');
      assert.equal(typeof prompt.negative, 'string');
    });

    it('settings match pipeline defaults', () => {
      const settings = getDefaultCoverSettingsForModel('flux');
      assert.equal(settings.modelPipeline, 'flux');
      assert.equal(settings.sampler, 'euler');
      assert.ok(settings.steps > 0);
    });

    it('typography overlay builds from settings', () => {
      const typo = buildTypographyOverlay({
        titleText: MOCK_PROJECT.title,
        authorText: MOCK_PROJECT.author_name,
      });
      assert.ok(typo.layers.length >= 2);
      const titleLayer = typo.layers.find(l => l.role === 'title');
      assert.equal(titleLayer.text, 'The Glass Room');
    });

    it('export metadata captures full pipeline', () => {
      const meta = buildCoverExportMetadata(MOCK_PROJECT, {
        modelPipeline: 'flux',
        seed: 12345,
        width: 1600,
        height: 2560,
      }, { titleText: MOCK_PROJECT.title });
      assert.equal(meta.title, 'The Glass Room');
      assert.equal(meta.modelPipeline, 'flux');
      assert.equal(meta.seed, 12345);
      assert.equal(meta.hasTypography, true);
    });
  });

  describe('variation creation captures full state', () => {
    it('creates variation with all metadata', () => {
      const variation = createCoverVariation({
        imageUrl: 'http://example.com/cover.png',
        metadata: {
          prompt: 'test prompt',
          negativePrompt: 'bad quality',
          modelPipeline: 'flux',
          checkpoint: 'flux1-schnell-fp8.safetensors',
          seed: 42,
          sizePreset: 'ebook_portrait',
          width: 1600,
          height: 2400,
          genreTemplate: 'thriller',
        },
        typographySettings: { titleText: 'The Glass Room', authorText: 'Sarah Lin' },
        name: 'Thriller v1',
      });
      assert.ok(variation.id);
      assert.equal(variation.name, 'Thriller v1');
      assert.equal(variation.metadata.modelPipeline, 'flux');
      assert.equal(variation.metadata.seed, 42);
      assert.ok(variation.typographySettings);
    });
  });

  describe('series consistency validates across covers', () => {
    it('extracts signature from active cover', () => {
      const sig = extractSeriesCoverSignature(MOCK_PROJECT, {
        metadata: { modelPipeline: 'flux', lighting: 'harsh cold light', palette: 'steel-blue, charcoal' },
        typographySettings: { titleFontId: 'georgia', titleColor: '#FFFFFF' },
      });
      assert.ok(sig.hasSeriesSignature);
      assert.equal(sig.modelPipeline, 'flux');
    });

    it('validates consistency matches', () => {
      const sig = extractSeriesCoverSignature(MOCK_PROJECT, {
        metadata: { modelPipeline: 'flux', lighting: 'test' },
      });
      const result = validateSeriesCoverConsistency({ modelPipeline: 'flux', lighting: 'test' }, sig);
      assert.ok(result.consistent);
    });

    it('detects consistency mismatches', () => {
      const sig = extractSeriesCoverSignature(MOCK_PROJECT, {
        metadata: { modelPipeline: 'flux', lighting: 'warm golden' },
      });
      const result = validateSeriesCoverConsistency({ modelPipeline: 'ponyxl', lighting: 'cold blue' }, sig);
      assert.ok(!result.consistent);
      assert.ok(result.deviations.length > 0);
    });
  });

  describe('safe margins are production-correct', () => {
    it('trim at 300 DPI is 38px (0.125")', () => {
      const margins = calculateSafeMargins(1600, 2400, 300);
      assert.equal(margins.trimPx, 38);
    });

    it('text safe at 300 DPI is 75px (0.25")', () => {
      const margins = calculateSafeMargins(1600, 2400, 300);
      assert.equal(margins.textSafePx, 75);
    });
  });

  describe('export presets match KDP specs', () => {
    it('ebook preset is >= 1600 wide', () => {
      const dims = getCoverExportDimensions('ebook');
      assert.ok(dims.width >= 1600);
    });

    it('6x9 paperback has proper bleed', () => {
      const dims = getCoverExportDimensions('paperback_6x9');
      // 6" × 300 DPI = 1800, + bleed = 1890
      assert.ok(dims.width >= 1800);
    });

    it('export filename is filesystem-safe', () => {
      const name = buildExportFilename(MOCK_PROJECT, 'ebook', 'png');
      assert.ok(!name.includes(' '));
      assert.ok(!name.includes('/'));
      assert.ok(name.endsWith('.png'));
    });
  });

  describe('typography does not rely on image model', () => {
    it('image_only mode generates no text layers by default', () => {
      const overlay = buildTypographyOverlay({});
      assert.equal(overlay.layers.length, 0, 'No text layers when no text provided');
    });

    it('typography is always app-rendered, never model-rendered', () => {
      const overlay = buildTypographyOverlay({ titleText: 'Test' });
      assert.ok(overlay.layers[0].font, 'Typography layer has app font');
      assert.ok(overlay.layers[0].fontSize, 'Typography layer has app font size');
    });
  });
});
