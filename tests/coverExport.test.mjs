/**
 * coverExport.test.mjs — Tests for cover export presets and utilities
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COVER_EXPORT_PRESETS,
  getCoverExportDimensions,
  validateCoverExportSettings,
  buildCoverExportMetadata,
  buildExportFilename,
} from '../src/lib/coverExport.js';

describe('coverExport', () => {
  describe('COVER_EXPORT_PRESETS', () => {
    it('has ebook, paperback_6x9, paperback_5x8, square_promo, vertical_promo, custom', () => {
      assert.ok(COVER_EXPORT_PRESETS.ebook);
      assert.ok(COVER_EXPORT_PRESETS.paperback_6x9);
      assert.ok(COVER_EXPORT_PRESETS.paperback_5x8);
      assert.ok(COVER_EXPORT_PRESETS.square_promo);
      assert.ok(COVER_EXPORT_PRESETS.vertical_promo);
      assert.ok(COVER_EXPORT_PRESETS.custom);
    });

    it('ebook dimensions are 1600x2560', () => {
      assert.equal(COVER_EXPORT_PRESETS.ebook.width, 1600);
      assert.equal(COVER_EXPORT_PRESETS.ebook.height, 2560);
    });

    it('6x9 paperback has valid dimensions with bleed', () => {
      const p = COVER_EXPORT_PRESETS.paperback_6x9;
      assert.ok(p.width >= 1800, 'Width should include bleed');
      assert.ok(p.height >= 2700, 'Height should include bleed');
    });

    it('5x8 paperback has valid dimensions', () => {
      const p = COVER_EXPORT_PRESETS.paperback_5x8;
      assert.ok(p.width >= 1500);
      assert.ok(p.height >= 2400);
    });

    it('square promo is 2000x2000', () => {
      assert.equal(COVER_EXPORT_PRESETS.square_promo.width, 2000);
      assert.equal(COVER_EXPORT_PRESETS.square_promo.height, 2000);
    });

    it('vertical promo is 1080x1920', () => {
      assert.equal(COVER_EXPORT_PRESETS.vertical_promo.width, 1080);
      assert.equal(COVER_EXPORT_PRESETS.vertical_promo.height, 1920);
    });

    it('each preset has id, label, description', () => {
      for (const [key, preset] of Object.entries(COVER_EXPORT_PRESETS)) {
        assert.ok(preset.id, `${key} missing id`);
        assert.ok(preset.label, `${key} missing label`);
        assert.ok(preset.description, `${key} missing description`);
      }
    });
  });

  describe('getCoverExportDimensions', () => {
    it('returns ebook dimensions for ebook preset', () => {
      const d = getCoverExportDimensions('ebook');
      assert.equal(d.width, 1600);
      assert.equal(d.height, 2560);
      assert.equal(d.dpi, 300);
    });

    it('returns custom dimensions clamped to range', () => {
      const d = getCoverExportDimensions('custom', { width: 100, height: 100 });
      assert.ok(d.width >= 512);
      assert.ok(d.height >= 512);
    });

    it('clamps custom max to 6000', () => {
      const d = getCoverExportDimensions('custom', { width: 9999, height: 9999 });
      assert.ok(d.width <= 6000);
      assert.ok(d.height <= 6000);
    });

    it('falls back to ebook for unknown preset', () => {
      const d = getCoverExportDimensions('nonexistent');
      assert.equal(d.width, 1600);
    });
  });

  describe('validateCoverExportSettings', () => {
    it('rejects missing image source', () => {
      const result = validateCoverExportSettings({});
      assert.ok(!result.valid);
      assert.ok(result.errors.some(e => e.includes('image source')));
    });

    it('accepts settings with imageUrl', () => {
      const result = validateCoverExportSettings({ imageUrl: 'http://example.com/img.png', preset: 'ebook' });
      assert.ok(result.valid);
    });

    it('accepts settings with canvas', () => {
      const result = validateCoverExportSettings({ canvas: {}, preset: 'ebook' });
      assert.ok(result.valid);
    });

    it('rejects custom preset with small width', () => {
      const result = validateCoverExportSettings({ imageUrl: 'test', preset: 'custom', width: 100, height: 1000 });
      assert.ok(!result.valid);
    });

    it('rejects invalid format', () => {
      const result = validateCoverExportSettings({ imageUrl: 'test', format: 'bmp' });
      assert.ok(!result.valid);
    });

    it('rejects invalid quality', () => {
      const result = validateCoverExportSettings({ imageUrl: 'test', quality: 2 });
      assert.ok(!result.valid);
    });
  });

  describe('buildCoverExportMetadata', () => {
    const mockProject = { id: 'p1', title: 'Test Book', author_name: 'Author', genre: 'fiction' };

    it('includes title and author from project', () => {
      const meta = buildCoverExportMetadata(mockProject, {});
      assert.equal(meta.title, 'Test Book');
      assert.equal(meta.author, 'Author');
    });

    it('includes exportedAt timestamp', () => {
      const meta = buildCoverExportMetadata(mockProject, {});
      assert.ok(meta.exportedAt);
      assert.ok(meta.exportedAt.includes('T'));
    });

    it('includes modelPipeline from coverAsset', () => {
      const meta = buildCoverExportMetadata(mockProject, { modelPipeline: 'flux', seed: 42 });
      assert.equal(meta.modelPipeline, 'flux');
      assert.equal(meta.seed, 42);
    });

    it('detects typography presence', () => {
      const meta = buildCoverExportMetadata(mockProject, {}, { titleText: 'Title' });
      assert.equal(meta.hasTypography, true);
    });

    it('detects no typography', () => {
      const meta = buildCoverExportMetadata(mockProject, {}, {});
      assert.equal(meta.hasTypography, false);
    });

    it('handles null project gracefully', () => {
      const meta = buildCoverExportMetadata(null, {});
      assert.equal(meta.title, 'Untitled');
      assert.equal(meta.author, 'Unknown Author');
    });
  });

  describe('buildExportFilename', () => {
    it('creates a safe filename', () => {
      const name = buildExportFilename({ title: 'My Book! @#$' }, 'ebook', 'png');
      assert.ok(name.endsWith('.png'));
      assert.ok(!name.includes('!'));
      assert.ok(!name.includes('@'));
    });

    it('includes preset label', () => {
      const name = buildExportFilename({ title: 'Test' }, 'ebook', 'png');
      assert.ok(name.includes('ebook'));
    });

    it('includes timestamp', () => {
      const name = buildExportFilename({ title: 'Test' }, 'ebook', 'png');
      const parts = name.split('-');
      const last = parts[parts.length - 1].replace('.png', '');
      assert.ok(Number(last) > 1000000000000);
    });

    it('truncates long titles', () => {
      const longTitle = 'A'.repeat(100);
      const name = buildExportFilename({ title: longTitle }, 'ebook', 'png');
      assert.ok(name.length < 120);
    });

    it('handles null project', () => {
      const name = buildExportFilename(null, 'ebook', 'png');
      assert.ok(name.startsWith('cover-'));
    });
  });
});
