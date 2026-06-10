/**
 * coverSeriesConsistency.test.mjs — Tests for coverSeriesConsistency.js
 *
 * Covers:
 *   - extractSeriesCoverSignature: full metadata, empty cover, lighting extraction
 *   - applySeriesCoverSignature: override fields, preserve unrelated fields
 *   - validateSeriesCoverConsistency: matching + mismatched settings
 *   - buildSeriesCoverConsistencyReport: shape and content
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractSeriesCoverSignature,
  applySeriesCoverSignature,
  validateSeriesCoverConsistency,
  buildSeriesCoverConsistencyReport,
} from '../src/lib/coverSeriesConsistency.js';

const fullMetadata = {
  lighting: 'dramatic side-lit',
  palette: 'dark moody blues',
  compositionPattern: 'centered figure',
  modelPipeline: 'flux',
  exportPreset: 'kdp_paperback',
  prompt: 'dark fantasy castle',
};

const fullCover = {
  id: 'cover-1',
  name: 'Book 1 Cover',
  metadata: fullMetadata,
  typographySettings: {
    fontFamily: 'Cinzel',
    titleColor: '#FFFFFF',
    subtitleColor: '#CCCCCC',
    authorColor: '#AAAAAA',
  },
  isActive: true,
};

const project = { title: 'The Dark Series', genre: 'fantasy' };

describe('coverSeriesConsistency', () => {
  // ── extractSeriesCoverSignature ───────────────────────────────
  describe('extractSeriesCoverSignature', () => {
    it('with full metadata returns hasSeriesSignature=true', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      assert.equal(sig.hasSeriesSignature, true);
      assert.equal(sig.lighting, 'dramatic side-lit');
      assert.equal(sig.palette, 'dark moody blues');
      assert.equal(sig.modelPipeline, 'flux');
    });

    it('with empty cover returns hasSeriesSignature=false', () => {
      const sig = extractSeriesCoverSignature(project, {});
      assert.equal(sig.hasSeriesSignature, false);
      assert.equal(sig.lighting, '');
      assert.equal(sig.palette, '');
    });

    it('extracts lighting from metadata', () => {
      const cover = { metadata: { lighting: 'soft ambient' } };
      const sig = extractSeriesCoverSignature(project, cover);
      assert.equal(sig.lighting, 'soft ambient');
    });
  });

  // ── applySeriesCoverSignature ─────────────────────────────────
  describe('applySeriesCoverSignature', () => {
    it('overrides modelPipeline', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = { modelPipeline: 'ponyxl', prompt: 'something' };
      const updated = applySeriesCoverSignature(settings, sig);
      assert.equal(updated.modelPipeline, 'flux');
    });

    it('overrides lighting', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = { lighting: 'flat', prompt: 'something' };
      const updated = applySeriesCoverSignature(settings, sig);
      assert.equal(updated.lighting, 'dramatic side-lit');
    });

    it('overrides palette', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = { palette: 'bright pastels' };
      const updated = applySeriesCoverSignature(settings, sig);
      assert.equal(updated.palette, 'dark moody blues');
    });

    it('preserves fields not in signature', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = { prompt: 'epic warrior', seed: 42, width: 1024 };
      const updated = applySeriesCoverSignature(settings, sig);
      assert.equal(updated.prompt, 'epic warrior');
      assert.equal(updated.seed, 42);
      assert.equal(updated.width, 1024);
    });
  });

  // ── validateSeriesCoverConsistency ────────────────────────────
  describe('validateSeriesCoverConsistency', () => {
    it('with matching settings returns consistent=true', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = {
        lighting: 'dramatic side-lit',
        palette: 'dark moody blues',
        compositionPattern: 'centered figure',
        modelPipeline: 'flux',
        exportPreset: 'kdp_paperback',
        typographyStyle: {
          fontFamily: 'Cinzel',
          titleColor: '#FFFFFF',
          subtitleColor: '#CCCCCC',
          authorColor: '#AAAAAA',
        },
      };
      const result = validateSeriesCoverConsistency(settings, sig);
      assert.equal(result.consistent, true);
      assert.equal(result.deviations.length, 0);
    });

    it('with mismatch returns deviations', () => {
      const sig = extractSeriesCoverSignature(project, fullCover);
      const settings = {
        lighting: 'flat overhead',
        palette: 'dark moody blues',
        compositionPattern: 'centered figure',
        modelPipeline: 'ponyxl', // mismatch
        exportPreset: 'kdp_paperback',
      };
      const result = validateSeriesCoverConsistency(settings, sig);
      assert.equal(result.consistent, false);
      assert.ok(result.deviations.length >= 2);
      const fields = result.deviations.map((d) => d.field);
      assert.ok(fields.includes('lighting'));
      assert.ok(fields.includes('modelPipeline'));
    });
  });

  // ── buildSeriesCoverConsistencyReport ─────────────────────────
  describe('buildSeriesCoverConsistencyReport', () => {
    it('returns title, coverCount, issues array', () => {
      const cover2 = {
        id: 'cover-2',
        name: 'Book 2 Cover',
        metadata: {
          ...fullMetadata,
          lighting: 'flat overhead', // deviation
        },
        isActive: false,
      };
      const report = buildSeriesCoverConsistencyReport(project, [fullCover, cover2]);
      assert.equal(report.title, 'The Dark Series');
      assert.equal(report.coverCount, 2);
      assert.ok(Array.isArray(report.issues));
      assert.ok(report.issues.length > 0);
      assert.ok(typeof report.recommendation === 'string');
    });
  });
});
