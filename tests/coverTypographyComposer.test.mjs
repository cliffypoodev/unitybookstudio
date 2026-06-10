/**
 * coverTypographyComposer.test.mjs — Tests for typography compositor
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_FAMILIES,
  getFontFamilyById,
  TITLE_PLACEMENT_PRESETS,
  AUTHOR_PLACEMENT_PRESETS,
  SAFE_MARGINS,
  calculateSafeMargins,
  DEFAULT_TYPOGRAPHY_SETTINGS,
  validateTypographySettings,
  buildTypographyOverlay,
} from '../src/lib/coverTypographyComposer.js';

describe('coverTypographyComposer', () => {
  describe('FONT_FAMILIES', () => {
    it('includes at least 10 font families', () => {
      assert.ok(FONT_FAMILIES.length >= 10, `Expected 10+ fonts, got ${FONT_FAMILIES.length}`);
    });

    it('each font has id, label, family, category', () => {
      for (const f of FONT_FAMILIES) {
        assert.ok(f.id, 'Missing id');
        assert.ok(f.label, 'Missing label');
        assert.ok(f.family, 'Missing family');
        assert.ok(f.category, 'Missing category');
      }
    });

    it('includes serif, sans-serif, display, and script categories', () => {
      const categories = new Set(FONT_FAMILIES.map(f => f.category));
      assert.ok(categories.has('serif'));
      assert.ok(categories.has('sans-serif'));
      assert.ok(categories.has('display'));
      assert.ok(categories.has('script'));
    });
  });

  describe('getFontFamilyById', () => {
    it('returns georgia for known id', () => {
      const font = getFontFamilyById('georgia');
      assert.equal(font.id, 'georgia');
      assert.ok(font.family.includes('Georgia'));
    });

    it('returns fallback for unknown id', () => {
      const font = getFontFamilyById('nonexistent');
      assert.ok(font.id, 'Should return a fallback font');
    });
  });

  describe('TITLE_PLACEMENT_PRESETS', () => {
    it('has top_center, top_left, center, bottom_center, bottom_left', () => {
      assert.ok(TITLE_PLACEMENT_PRESETS.top_center);
      assert.ok(TITLE_PLACEMENT_PRESETS.top_left);
      assert.ok(TITLE_PLACEMENT_PRESETS.center);
      assert.ok(TITLE_PLACEMENT_PRESETS.bottom_center);
      assert.ok(TITLE_PLACEMENT_PRESETS.bottom_left);
    });

    it('each preset has x, y, textAlign', () => {
      for (const [, p] of Object.entries(TITLE_PLACEMENT_PRESETS)) {
        assert.equal(typeof p.x, 'number');
        assert.equal(typeof p.y, 'number');
        assert.ok(p.textAlign);
      }
    });
  });

  describe('AUTHOR_PLACEMENT_PRESETS', () => {
    it('has bottom_center and top_center', () => {
      assert.ok(AUTHOR_PLACEMENT_PRESETS.bottom_center);
      assert.ok(AUTHOR_PLACEMENT_PRESETS.top_center);
    });
  });

  describe('calculateSafeMargins', () => {
    it('returns trimPx and textSafePx at 300 DPI', () => {
      const result = calculateSafeMargins(1600, 2400, 300);
      assert.equal(result.trimPx, Math.round(0.125 * 300));
      assert.equal(result.textSafePx, Math.round(0.25 * 300));
    });

    it('returns safeRect within cover dimensions', () => {
      const result = calculateSafeMargins(1600, 2400);
      assert.ok(result.safeRect.x > 0);
      assert.ok(result.safeRect.y > 0);
      assert.ok(result.safeRect.width < 1600);
      assert.ok(result.safeRect.height < 2400);
    });

    it('safe area is smaller than cover area', () => {
      const result = calculateSafeMargins(1600, 2400);
      assert.ok(result.safeRect.width + 2 * result.safeRect.x === 1600);
    });
  });

  describe('DEFAULT_TYPOGRAPHY_SETTINGS', () => {
    it('has title, subtitle, author, series, tagline fields', () => {
      assert.ok('titleText' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('subtitleText' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('authorText' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('seriesText' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('taglineText' in DEFAULT_TYPOGRAPHY_SETTINGS);
    });

    it('has font, size, weight, color for title', () => {
      assert.ok('titleFontId' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('titleFontSize' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('titleFontWeight' in DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok('titleColor' in DEFAULT_TYPOGRAPHY_SETTINGS);
    });

    it('has safeMargins enabled by default', () => {
      assert.equal(DEFAULT_TYPOGRAPHY_SETTINGS.safeMargins, true);
    });

    it('has shadow enabled for title by default', () => {
      assert.equal(DEFAULT_TYPOGRAPHY_SETTINGS.titleShadow, true);
    });
  });

  describe('validateTypographySettings', () => {
    it('validates good settings', () => {
      const result = validateTypographySettings(DEFAULT_TYPOGRAPHY_SETTINGS);
      assert.ok(result.valid);
      assert.equal(result.errors.length, 0);
    });

    it('rejects title font size below 8', () => {
      const result = validateTypographySettings({ titleFontSize: 3 });
      assert.ok(!result.valid);
      assert.ok(result.errors.some(e => e.includes('Title font size')));
    });

    it('rejects title font size above 400', () => {
      const result = validateTypographySettings({ titleFontSize: 500 });
      assert.ok(!result.valid);
    });

    it('rejects invalid title color', () => {
      const result = validateTypographySettings({ titleColor: 'not-a-color' });
      assert.ok(!result.valid);
    });

    it('accepts valid hex color', () => {
      const result = validateTypographySettings({ titleColor: '#FF0000' });
      assert.ok(result.valid);
    });

    it('accepts rgba color', () => {
      const result = validateTypographySettings({ titleColor: 'rgba(255,0,0,1)' });
      assert.ok(result.valid);
    });
  });

  describe('buildTypographyOverlay', () => {
    it('returns empty layers for empty settings', () => {
      const result = buildTypographyOverlay({});
      assert.ok(Array.isArray(result.layers));
      assert.equal(result.layers.length, 0);
    });

    it('returns title layer when titleText is set', () => {
      const result = buildTypographyOverlay({ titleText: 'My Book' });
      assert.equal(result.layers.length, 1);
      assert.equal(result.layers[0].role, 'title');
      assert.equal(result.layers[0].text, 'My Book');
    });

    it('returns title + author layers', () => {
      const result = buildTypographyOverlay({ titleText: 'My Book', authorText: 'Jane Doe' });
      const roles = result.layers.map(l => l.role);
      assert.ok(roles.includes('title'));
      assert.ok(roles.includes('author'));
    });

    it('returns series + title + subtitle + tagline + author in order', () => {
      const result = buildTypographyOverlay({
        seriesText: 'The Series #1',
        titleText: 'Book Title',
        subtitleText: 'A Subtitle',
        taglineText: 'A tagline',
        authorText: 'Author Name',
      });
      const roles = result.layers.map(l => l.role);
      assert.deepEqual(roles, ['series', 'title', 'subtitle', 'tagline', 'author']);
    });

    it('title layer uses configured font', () => {
      const result = buildTypographyOverlay({ titleText: 'Test', titleFontId: 'impact' });
      assert.ok(result.layers[0].font.includes('Impact'));
    });

    it('title layer uses configured placement', () => {
      const result = buildTypographyOverlay({ titleText: 'Test', titlePlacement: 'center' });
      assert.equal(result.layers[0].x, 0.5);
      assert.equal(result.layers[0].y, 0.45);
    });

    it('title shadow is present when enabled', () => {
      const result = buildTypographyOverlay({ titleText: 'Test', titleShadow: true });
      assert.ok(result.layers[0].shadow);
    });

    it('title shadow is null when disabled', () => {
      const result = buildTypographyOverlay({ titleText: 'Test', titleShadow: false });
      assert.equal(result.layers[0].shadow, null);
    });

    it('glow is applied when enabled', () => {
      const result = buildTypographyOverlay({ titleText: 'Test', glowEnabled: true });
      assert.ok(result.layers[0].glow);
    });

    it('safeMargins passed through', () => {
      const result = buildTypographyOverlay({ safeMargins: false });
      assert.equal(result.safeMargins, false);
    });
  });
});
